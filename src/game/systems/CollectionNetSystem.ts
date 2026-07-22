import {
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Quaternion,
  Ray,
  Vector3,
  type Material,
  type WebGLRenderer,
} from 'three';
import {
  createCollectionNetModel,
  updateCollectionNetModel,
  type CollectionNetModelVisuals,
} from '../art/CollectionNetModel';
import type { MaterialLibrary } from '../art/Materials';
import {
  COLLECTION_NET_CAPACITY,
  COLLECTION_NET_MAX_HEALTH,
  COLLECTION_NET_REPAIR_AMOUNT,
  COLLECTION_NET_REPAIR_COST,
  canPlaceCollectionNet,
  captureIntoCollectionNet,
  collectionNetBlocksFoundationAt,
  collectionNetBlocksStructure,
  collectionNetOutsideCoordinate,
  collectionNetStoredUnits,
  damageCollectionNet,
  repairCollectionNet,
  selectSharkAttackCollectionNet,
  type CollectionNetPlacementReason,
  type CollectionNetRotation,
  type SavedCollectionNet,
} from '../domain/collectionNets';
import {
  INVENTORY_SLOT_CAPACITY,
  addItems,
  bundleLabel,
  itemCount,
  type ItemBundle,
} from '../domain/items';
import { useGameStore } from '../../state/gameStore';
import { matchesInputAction } from '../domain/inputBindings';
import type { AudioSystem } from './AudioSystem';
import type { DebrisField, SalvageTarget } from './DebrisField';
import { RAFT_TILE_X, RAFT_TILE_Z, type GridCoordinate, type RaftSystem } from './RaftSystem';
import type { SplashSystem } from './SplashSystem';
import type { StructurePlacementCandidate } from './RaftStructureSystem';

interface CollectionNetRuntime {
  state: SavedCollectionNet;
  model: Group;
  visuals: CollectionNetModelVisuals;
  nextCaptureAt: number;
}

export interface CollectionNetSharkMutation {
  changed: boolean;
  destroyed: boolean;
  health: number;
  released: ItemBundle;
}

const PLACEMENT_LABELS: Record<Exclude<CollectionNetPlacementReason, 'valid'>, string> = {
  'missing-host': '收集网必须卡在完整筏格边缘',
  'not-edge': '这一侧已有筏格，收集网需要朝向海面',
  occupied: '这段筏缘已经装有收集网',
  'out-of-bounds': '超出木筏建造边界',
  limit: '收集网数量已达上限',
};

function rotationFromOffset(offsetX: number, offsetZ: number, direction: Vector3): CollectionNetRotation {
  if (Math.max(Math.abs(offsetX), Math.abs(offsetZ)) < 0.14) {
    if (Math.abs(direction.x) > Math.abs(direction.z)) return direction.x >= 0 ? 1 : 3;
    return direction.z >= 0 ? 2 : 0;
  }
  if (Math.abs(offsetX) > Math.abs(offsetZ)) return offsetX >= 0 ? 1 : 3;
  return offsetZ >= 0 ? 2 : 0;
}

function outwardAxes(rotation: CollectionNetRotation): { x: number; z: number; tangentX: number; tangentZ: number } {
  if (rotation === 0) return { x: 0, z: -1, tangentX: 1, tangentZ: 0 };
  if (rotation === 1) return { x: 1, z: 0, tangentX: 0, tangentZ: 1 };
  if (rotation === 2) return { x: 0, z: 1, tangentX: -1, tangentZ: 0 };
  return { x: -1, z: 0, tangentX: 0, tangentZ: -1 };
}

export class CollectionNetSystem {
  private readonly nets = new Map<string, CollectionNetRuntime>();
  private readonly preview: Group;
  private readonly previewMaterial = new MeshStandardMaterial({
    color: 0x72d4b3,
    roughness: 0.68,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
  });
  private readonly ray = new Ray();
  private readonly forward = new Vector3();
  private readonly localOrigin = new Vector3();
  private readonly localDirection = new Vector3();
  private readonly localHit = new Vector3();
  private readonly localTarget = new Vector3();
  private readonly localCenter = new Vector3();
  private readonly closest = new Vector3();
  private readonly toCenter = new Vector3();
  private readonly worldImpact = new Vector3();
  private readonly inverseRaftRotation = new Quaternion();
  private readonly validColor = new Color(0x72d4b3);
  private readonly invalidColor = new Color(0xe26f55);
  private placementActive = false;
  private placementCandidate: Pick<SavedCollectionNet, 'x' | 'z' | 'rotation'> | null = null;
  private placementValid = false;
  private focused: CollectionNetRuntime | null = null;
  private inputEnabled = false;
  private lastPrompt: string | null = null;
  private lastRaftRevision = -1;
  private noticeTimer: number | null = null;
  private serial = 0;
  private captureEvents = 0;
  private damageEvents = 0;
  private nextDiagnosticAt = 0;
  private nearestDriftDiagnostic: string | null = null;

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly camera: PerspectiveCamera,
    private readonly materials: MaterialLibrary,
    private readonly raft: RaftSystem,
    private readonly debris: DebrisField,
    private readonly audio: AudioSystem,
    private readonly splashes: SplashSystem,
    savedNets: readonly SavedCollectionNet[],
    private readonly onChanged: () => void = () => undefined,
    private readonly onHammerUsed: (action: 'repair' | 'dismantle') => void = () => undefined,
    private readonly occupiedStructureEdges: () => ReadonlySet<string> = () => new Set(),
  ) {
    this.preview = this.createPreview();
    this.preview.visible = false;
    this.raft.group.add(this.preview);
    for (const state of savedNets) this.addRuntime({ ...state, storage: { ...state.storage } });
    this.lastRaftRevision = this.raft.currentRevision;
    this.publishFeedback();
    this.renderer.domElement.addEventListener('mousedown', this.onPointerDown);
    this.renderer.domElement.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('keydown', this.onKeyDown);
  }

  setPlacementActive(active: boolean): void {
    if (this.placementActive === active) return;
    this.placementActive = active;
    this.placementCandidate = null;
    this.placementValid = false;
    this.preview.visible = false;
    this.clearPrompt();
  }

  setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
    if (enabled) return;
    this.preview.visible = false;
    this.focused = null;
    this.clearPrompt();
  }

  update(time: number, _delta: number): void {
    if (this.raft.currentRevision !== this.lastRaftRevision) {
      this.lastRaftRevision = this.raft.currentRevision;
      this.removeInvalidNets();
    }

    this.inverseRaftRotation.copy(this.raft.group.quaternion).invert();
    let captured = false;
    for (const runtime of this.nets.values()) {
      updateCollectionNetModel(
        runtime.visuals,
        time,
        collectionNetStoredUnits(runtime.state.storage) / COLLECTION_NET_CAPACITY,
        runtime.state.health / COLLECTION_NET_MAX_HEALTH,
      );
      if (time >= runtime.nextCaptureAt && collectionNetStoredUnits(runtime.state.storage) < COLLECTION_NET_CAPACITY) {
        captured = this.captureDrift(runtime, time) || captured;
      }
    }
    if (captured) {
      this.publishFeedback();
      this.onChanged();
    }
    if (time >= this.nextDiagnosticAt) {
      this.nextDiagnosticAt = time + 1;
      this.refreshNearestDriftDiagnostic();
    }

    if (!this.inputEnabled) return;
    if (this.placementActive) this.updatePlacementPreview();
    else this.updateFocus();
  }

  getSavedNets(): SavedCollectionNet[] {
    return [...this.nets.values()]
      .map(({ state }) => ({
        ...state,
        health: Math.round(state.health),
        storage: { ...state.storage },
      }))
      .sort((a, b) => a.z - b.z || a.x - b.x || a.rotation - b.rotation);
  }

  blocksFoundationAt(coordinate: GridCoordinate): boolean {
    return collectionNetBlocksFoundationAt(
      [...this.nets.values()].map(({ state }) => state),
      coordinate,
    );
  }

  blocksStructure(candidate: StructurePlacementCandidate): boolean {
    return collectionNetBlocksStructure(
      [...this.nets.values()].map(({ state }) => state),
      candidate,
    );
  }

  findSharkTarget(fromRaftX: number, fromRaftZ: number): SavedCollectionNet | null {
    const selected = selectSharkAttackCollectionNet(
      [...this.nets.values()].map(({ state }) => state),
      fromRaftX,
      fromRaftZ,
    );
    return selected ? { ...selected, storage: { ...selected.storage } } : null;
  }

  getLocalImpactPosition(id: string, target: Vector3): boolean {
    const runtime = this.nets.get(id);
    if (!runtime) return false;
    this.localCaptureCenter(runtime.state, target);
    target.y = -0.05;
    return true;
  }

  damageByShark(id: string, amount: number): CollectionNetSharkMutation {
    const runtime = this.nets.get(id);
    if (!runtime) return { changed: false, destroyed: false, health: 0, released: {} };
    this.localCaptureCenter(runtime.state, this.localCenter);
    this.raft.localPointToWorld(this.localCenter, this.worldImpact);
    const result = damageCollectionNet(runtime.state, amount);
    if (!result.changed) {
      return { changed: false, destroyed: result.destroyed, health: runtime.state.health, released: {} };
    }
    this.damageEvents += 1;
    if (result.destroyed) {
      if (collectionNetStoredUnits(result.released) > 0) {
        this.debris.spawnWorldDrop(result.released, this.worldImpact, true);
      }
      if (this.focused === runtime) this.focused = null;
      this.removeRuntime(runtime);
      this.audio.playCollectionNetLost(this.worldImpact);
      this.splashes.spawnImpact(this.worldImpact, 0x8f5742, 26);
    } else if (result.net) {
      runtime.state = result.net;
    }
    this.publishFeedback();
    this.onChanged();
    return {
      changed: true,
      destroyed: result.destroyed,
      health: result.net?.health ?? 0,
      released: result.released,
    };
  }

  getDiagnostics(): {
    count: number;
    stored: number;
    focused: string | null;
    placement: string | null;
    placementValid: boolean;
    captures: number;
    damageEvents: number;
    firstHealth: number;
    mount: string | null;
    nearestDrift: string | null;
  } {
    const first = this.nets.values().next().value as CollectionNetRuntime | undefined;
    return {
      count: this.nets.size,
      stored: [...this.nets.values()].reduce((total, runtime) => total + collectionNetStoredUnits(runtime.state.storage), 0),
      focused: this.focused?.state.id ?? null,
      placement: this.placementCandidate
        ? `${this.placementCandidate.x},${this.placementCandidate.z},${this.placementCandidate.rotation}`
        : null,
      placementValid: this.placementValid,
      captures: this.captureEvents,
      damageEvents: this.damageEvents,
      firstHealth: first?.state.health ?? 0,
      mount: first ? `${first.state.x},${first.state.z},${first.state.rotation}` : null,
      nearestDrift: this.nearestDriftDiagnostic,
    };
  }

  getAimDiagnostics(): {
    camera: [number, number, number];
    forward: [number, number, number];
    firstNet: { id: string; center: [number, number, number] } | null;
  } {
    const first = this.nets.values().next().value as CollectionNetRuntime | undefined;
    if (first) this.localCaptureCenter(first.state, this.localCenter);
    return {
      camera: [this.localOrigin.x, this.localOrigin.y, this.localOrigin.z],
      forward: [this.localDirection.x, this.localDirection.y, this.localDirection.z],
      firstNet: first
        ? { id: first.state.id, center: [this.localCenter.x, -0.05, this.localCenter.z] }
        : null,
    };
  }

  dispose(): void {
    this.renderer.domElement.removeEventListener('mousedown', this.onPointerDown);
    this.renderer.domElement.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('keydown', this.onKeyDown);
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);
    for (const runtime of [...this.nets.values()]) this.removeRuntime(runtime);
    this.raft.group.remove(this.preview);
    this.disposeModel(this.preview);
    this.previewMaterial.dispose();
  }

  private createPreview(): Group {
    const preview = createCollectionNetModel(this.materials);
    preview.name = 'collection-net-placement-preview';
    preview.renderOrder = 3;
    preview.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const original = Array.isArray(object.material) ? object.material : [object.material];
      original.forEach((material) => {
        if (!this.isSharedMaterial(material)) material.dispose();
      });
      object.material = this.previewMaterial;
      object.castShadow = false;
      object.receiveShadow = false;
    });
    return preview;
  }

  private addRuntime(state: SavedCollectionNet): CollectionNetRuntime {
    const model = createCollectionNetModel(this.materials);
    model.name = `collection-net-${state.id}`;
    model.position.set(state.x * RAFT_TILE_X, 0.02, state.z * RAFT_TILE_Z);
    model.rotation.y = -state.rotation * Math.PI / 2;
    const runtime: CollectionNetRuntime = {
      state,
      model,
      visuals: model.userData.collectionNetVisuals as CollectionNetModelVisuals,
      nextCaptureAt: 0,
    };
    this.nets.set(state.id, runtime);
    this.raft.group.add(model);
    return runtime;
  }

  private removeRuntime(runtime: CollectionNetRuntime): void {
    this.nets.delete(runtime.state.id);
    this.raft.group.remove(runtime.model);
    this.disposeModel(runtime.model);
    if (this.focused === runtime) this.focused = null;
  }

  private disposeModel(model: Group): void {
    const geometries = new Set<unknown>();
    const ownedMaterials = new Set<Material>();
    model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      geometries.add(object.geometry);
      const list = Array.isArray(object.material) ? object.material : [object.material];
      list.forEach((material) => {
        if (!this.isSharedMaterial(material) && material !== this.previewMaterial) ownedMaterials.add(material);
      });
    });
    geometries.forEach((geometry) => (geometry as { dispose: () => void }).dispose());
    ownedMaterials.forEach((material) => material.dispose());
  }

  private isSharedMaterial(material: Material): boolean {
    return this.materials.wood.includes(material as MeshStandardMaterial)
      || Object.values(this.materials).some((candidate) => candidate === material);
  }

  private updatePlacementPreview(): void {
    this.updateLocalRay();
    if (Math.abs(this.ray.direction.y) < 0.02) {
      this.hidePreview('将视线移向木筏外缘');
      return;
    }
    const distance = (0.08 - this.ray.origin.y) / this.ray.direction.y;
    if (distance <= 0 || distance > 6.2) {
      this.hidePreview('将视线移向木筏外缘');
      return;
    }
    this.ray.at(distance, this.localHit);
    const direct = this.raft.getTile(this.raft.localToGrid(this.localHit));
    const host = direct ?? this.raft.getClosestTile(this.localHit);
    if (!host || Math.hypot(this.localHit.x - host.x * RAFT_TILE_X, this.localHit.z - host.z * RAFT_TILE_Z) > 1.22) {
      this.hidePreview('收集网必须卡在完整筏格边缘');
      return;
    }
    const offsetX = (this.localHit.x - host.x * RAFT_TILE_X) / RAFT_TILE_X;
    const offsetZ = (this.localHit.z - host.z * RAFT_TILE_Z) / RAFT_TILE_Z;
    const rotation = rotationFromOffset(offsetX, offsetZ, this.localDirection);
    const candidate = { x: host.x, z: host.z, rotation };
    const result = canPlaceCollectionNet(
      [...this.nets.values()].map(({ state }) => state),
      this.raft.getTiles(),
      candidate,
      this.occupiedStructureEdges(),
    );
    this.placementCandidate = candidate;
    this.placementValid = result.valid && itemCount(useGameStore.getState().inventory, 'collectionNetKit') > 0;
    this.preview.visible = true;
    this.preview.position.set(host.x * RAFT_TILE_X, 0.02, host.z * RAFT_TILE_Z);
    this.preview.rotation.y = -rotation * Math.PI / 2;
    this.previewMaterial.color.copy(this.placementValid ? this.validColor : this.invalidColor);
    this.previewMaterial.opacity = this.placementValid ? 0.52 : 0.32;
    if (!result.valid) this.setPrompt(PLACEMENT_LABELS[result.reason as Exclude<CollectionNetPlacementReason, 'valid'>]);
    else if (!this.placementValid) this.setPrompt('收集网套件已不在背包中');
    else this.setPrompt('固定潮兜收集网 · 左键确认');
  }

  private hidePreview(prompt: string): void {
    this.preview.visible = false;
    this.placementCandidate = null;
    this.placementValid = false;
    this.setPrompt(prompt);
  }

  private place(): void {
    if (!this.placementCandidate || !this.placementValid) {
      this.audio.playDenied();
      return;
    }
    const validation = canPlaceCollectionNet(
      [...this.nets.values()].map(({ state }) => state),
      this.raft.getTiles(),
      this.placementCandidate,
      this.occupiedStructureEdges(),
    );
    const store = useGameStore.getState();
    if (!validation.valid || !store.spendItems({ collectionNetKit: 1 })) {
      this.audio.playDenied();
      this.showNotice('收集网未能固定');
      return;
    }
    this.serial += 1;
    const state: SavedCollectionNet = {
      id: `net-${Date.now().toString(36)}-${this.serial.toString(36)}`,
      ...this.placementCandidate,
      health: COLLECTION_NET_MAX_HEALTH,
      storage: {},
    };
    this.addRuntime(state);
    this.localCaptureCenter(state, this.localCenter);
    this.raft.localPointToWorld(this.localCenter, this.worldImpact);
    this.splashes.spawnImpact(this.worldImpact, 0x72b8a0, 18);
    this.audio.playCollectionNetPlace();
    this.showNotice('潮兜收集网已固定在筏缘');
    store.setPlacementDevice(null);
    this.publishFeedback();
    this.onChanged();
  }

  private captureDrift(runtime: CollectionNetRuntime, time: number): boolean {
    for (const target of this.debris.targets) {
      if (!target.active || target.latched || target.source !== 'drift' || !this.intersectsNet(runtime.state, target)) continue;
      const result = captureIntoCollectionNet(runtime.state, this.debris.getLoot(target));
      if (collectionNetStoredUnits(result.accepted) === 0) return false;
      this.worldImpact.copy(target.model.position);
      runtime.state = result.net;
      runtime.nextCaptureAt = time + 0.48;
      this.debris.settleCollection(target, result.accepted, result.rejected);
      this.splashes.spawnImpact(this.worldImpact, target.kind === 'fiber' ? 0x91b57f : 0x8bc3be, 10);
      this.audio.playCollectionNetCatch(target.kind, this.worldImpact);
      this.captureEvents += 1;
      if (collectionNetStoredUnits(runtime.state.storage) >= COLLECTION_NET_CAPACITY) {
        this.showNotice('潮兜收集网已满，靠近后按 E 收取');
      }
      return true;
    }
    return false;
  }

  private intersectsNet(state: SavedCollectionNet, target: SalvageTarget): boolean {
    this.localTarget.copy(target.model.position)
      .sub(this.raft.group.position)
      .applyQuaternion(this.inverseRaftRotation);
    const axes = outwardAxes(state.rotation);
    const dx = this.localTarget.x - state.x * RAFT_TILE_X;
    const dz = this.localTarget.z - state.z * RAFT_TILE_Z;
    const outward = dx * axes.x + dz * axes.z;
    const across = Math.abs(dx * axes.tangentX + dz * axes.tangentZ);
    return outward >= 0.48 && outward <= 1.62 && across <= 0.64 && this.localTarget.y > -1.15 && this.localTarget.y < 0.75;
  }

  private refreshNearestDriftDiagnostic(): void {
    const first = this.nets.values().next().value as CollectionNetRuntime | undefined;
    if (!first) {
      this.nearestDriftDiagnostic = null;
      return;
    }
    this.localCaptureCenter(first.state, this.localCenter);
    let nearestDistance = Number.POSITIVE_INFINITY;
    this.nearestDriftDiagnostic = null;
    for (const target of this.debris.targets) {
      if (!target.active || target.latched || target.source !== 'drift') continue;
      this.localTarget.copy(target.model.position)
        .sub(this.raft.group.position)
        .applyQuaternion(this.inverseRaftRotation);
      const distance = Math.hypot(this.localTarget.x - this.localCenter.x, this.localTarget.z - this.localCenter.z);
      if (distance >= nearestDistance) continue;
      nearestDistance = distance;
      this.nearestDriftDiagnostic = `${this.localTarget.x.toFixed(2)},${this.localTarget.y.toFixed(2)},${this.localTarget.z.toFixed(2)}:${target.kind}`;
    }
  }

  private updateFocus(): void {
    this.updateLocalRay();
    let best: CollectionNetRuntime | null = null;
    let bestAlong = Number.POSITIVE_INFINITY;
    for (const runtime of this.nets.values()) {
      this.localCaptureCenter(runtime.state, this.localCenter);
      this.localCenter.y = -0.05;
      this.toCenter.copy(this.localCenter).sub(this.localOrigin);
      const along = this.toCenter.dot(this.localDirection);
      if (along <= 0 || along > 4.2 || along >= bestAlong) continue;
      this.closest.copy(this.localDirection).multiplyScalar(along).add(this.localOrigin);
      if (this.closest.distanceTo(this.localCenter) > 0.78) continue;
      best = runtime;
      bestAlong = along;
    }
    this.focused = best;
    if (!best) {
      this.clearPrompt();
      return;
    }
    const stored = collectionNetStoredUnits(best.state.storage);
    if (useGameStore.getState().selectedTool === 'hammer') {
      if (best.state.health < COLLECTION_NET_MAX_HEALTH) {
        this.setPrompt(
          `E 修补潮兜收集网 ${Math.round(best.state.health)}/${COLLECTION_NET_MAX_HEALTH} · ${bundleLabel(COLLECTION_NET_REPAIR_COST)} · 右键拆除`,
        );
      } else {
        this.setPrompt(`潮兜收集网 · 右键拆除 · ${stored}/${COLLECTION_NET_CAPACITY}`);
      }
    } else if (stored > 0) {
      this.setPrompt(`E 收取潮兜物资 · ${stored}/${COLLECTION_NET_CAPACITY}`);
    } else {
      this.setPrompt('潮兜收集网 · 等待漂流物');
    }
  }

  private collectFocused(): void {
    if (!this.focused) return;
    const stored = collectionNetStoredUnits(this.focused.state.storage);
    if (stored === 0) {
      this.audio.playDenied();
      return;
    }
    const result = useGameStore.getState().receiveItemBundle(this.focused.state.storage);
    if (collectionNetStoredUnits(result.accepted) === 0) {
      this.audio.playDenied();
      this.showNotice('背包没有空间收取网中物资');
      return;
    }
    this.focused.state = { ...this.focused.state, storage: result.rejected };
    this.audio.playCollectionNetCollect();
    this.showNotice(`${bundleLabel(result.accepted)}${collectionNetStoredUnits(result.rejected) > 0 ? ' · 网中仍有物资' : ''}`);
    this.publishFeedback();
    this.onChanged();
    this.updateFocus();
  }

  private repairFocused(): void {
    const runtime = this.focused;
    if (!runtime) return;
    const store = useGameStore.getState();
    if (runtime.state.health >= COLLECTION_NET_MAX_HEALTH || !store.spendItems(COLLECTION_NET_REPAIR_COST)) {
      this.audio.playDenied();
      if (runtime.state.health < COLLECTION_NET_MAX_HEALTH) this.showNotice('缺少修补收集网所需材料');
      return;
    }
    const result = repairCollectionNet(runtime.state, COLLECTION_NET_REPAIR_AMOUNT);
    if (!result.changed || !result.net) {
      store.addItemBundle(COLLECTION_NET_REPAIR_COST);
      this.audio.playDenied();
      return;
    }
    runtime.state = result.net;
    this.localCaptureCenter(runtime.state, this.localCenter);
    this.raft.localPointToWorld(this.localCenter, this.worldImpact);
    this.splashes.spawnRepair(this.worldImpact);
    this.audio.playRepair(this.worldImpact);
    this.showNotice(
      runtime.state.health >= COLLECTION_NET_MAX_HEALTH
        ? '潮兜收集网已完全修复'
        : `潮兜收集网已修补 · ${Math.round(runtime.state.health)}/${COLLECTION_NET_MAX_HEALTH}`,
    );
    this.publishFeedback();
    this.onHammerUsed('repair');
    this.onChanged();
    this.updateFocus();
  }

  private dismantleFocused(): boolean {
    const runtime = this.focused;
    if (!runtime) return false;
    const refund: ItemBundle = { ...runtime.state.storage };
    refund.collectionNetKit = itemCount(refund, 'collectionNetKit') + 1;
    const store = useGameStore.getState();
    const preview = addItems(store.inventory, refund, INVENTORY_SLOT_CAPACITY);
    if (Object.keys(preview.rejected).length > 0) {
      this.audio.playDenied();
      this.showNotice('背包没有空间收回收集网与网中物资');
      return true;
    }
    this.localCaptureCenter(runtime.state, this.localCenter);
    this.raft.localPointToWorld(this.localCenter, this.worldImpact);
    store.addItemBundle(refund);
    this.removeRuntime(runtime);
    this.splashes.spawnImpact(this.worldImpact, 0x8f6f51, 18);
    this.audio.playCollectionNetLost(this.worldImpact);
    this.showNotice('收集网与网中物资已收回');
    this.publishFeedback();
    this.onHammerUsed('dismantle');
    this.onChanged();
    return true;
  }

  private removeInvalidNets(): void {
    let changed = false;
    for (const runtime of [...this.nets.values()]) {
      const outside = collectionNetOutsideCoordinate(runtime.state);
      if (this.raft.hasTile(runtime.state) && !this.raft.hasTile(outside)) continue;
      this.localCaptureCenter(runtime.state, this.localCenter);
      this.raft.localPointToWorld(this.localCenter, this.worldImpact);
      if (collectionNetStoredUnits(runtime.state.storage) > 0) {
        this.debris.spawnWorldDrop(runtime.state.storage, this.worldImpact, true);
      }
      this.splashes.spawn(this.worldImpact);
      this.splashes.spawnImpact(this.worldImpact, 0x8f6f51, 24);
      this.audio.playCollectionNetLost(this.worldImpact);
      this.removeRuntime(runtime);
      changed = true;
    }
    if (!changed) return;
    this.showNotice('失去承托的收集网落海，网中物资漂在附近');
    this.publishFeedback();
    this.onChanged();
  }

  private updateLocalRay(): void {
    this.camera.getWorldDirection(this.forward);
    this.inverseRaftRotation.copy(this.raft.group.quaternion).invert();
    this.localOrigin.copy(this.camera.position).sub(this.raft.group.position).applyQuaternion(this.inverseRaftRotation);
    this.localDirection.copy(this.forward).applyQuaternion(this.inverseRaftRotation).normalize();
    this.ray.set(this.localOrigin, this.localDirection);
  }

  private localCaptureCenter(state: Pick<SavedCollectionNet, 'x' | 'z' | 'rotation'>, target: Vector3): Vector3 {
    const axes = outwardAxes(state.rotation);
    return target.set(
      state.x * RAFT_TILE_X + axes.x * 1.04,
      -0.12,
      state.z * RAFT_TILE_Z + axes.z * 1.04,
    );
  }

  private publishFeedback(): void {
    let stored = 0;
    let full = 0;
    let damaged = 0;
    for (const { state } of this.nets.values()) {
      const units = collectionNetStoredUnits(state.storage);
      stored += units;
      if (units >= COLLECTION_NET_CAPACITY) full += 1;
      if (state.health < COLLECTION_NET_MAX_HEALTH * 0.7) damaged += 1;
    }
    const capacity = this.nets.size * COLLECTION_NET_CAPACITY;
    useGameStore.getState().setCollectionNets({
      placed: this.nets.size,
      stored,
      capacity,
      full,
      damaged,
      progress: capacity > 0 ? stored / capacity : 0,
    });
  }

  private setPrompt(prompt: string): void {
    this.lastPrompt = prompt;
    useGameStore.getState().setInteraction(prompt, 'collectionNet');
  }

  private clearPrompt(): void {
    const store = useGameStore.getState();
    if (this.lastPrompt && store.interaction === this.lastPrompt) store.setInteraction(null, 'collectionNet');
    this.lastPrompt = null;
  }

  private showNotice(message: string): void {
    useGameStore.getState().showNotice(message);
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => {
      if (useGameStore.getState().notice === message) useGameStore.getState().showNotice(null);
    }, 1750);
  }

  private readonly onPointerDown = (event: MouseEvent): void => {
    if (!this.inputEnabled) return;
    if (this.placementActive) {
      if (event.button === 0) this.place();
      else if (event.button === 2) useGameStore.getState().setPlacementDevice(null);
      return;
    }
    if (event.button !== 2 || useGameStore.getState().selectedTool !== 'hammer' || !this.focused) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.dismantleFocused();
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    if (this.inputEnabled && (this.placementActive || (this.focused && useGameStore.getState().selectedTool === 'hammer'))) {
      event.preventDefault();
    }
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (
      !matchesInputAction('interact', event.code)
      || event.repeat
      || !this.inputEnabled
      || this.placementActive
      || useGameStore.getState().interactionOwner !== 'collectionNet'
    ) return;
    if (
      useGameStore.getState().selectedTool === 'hammer'
      && this.focused
      && this.focused.state.health < COLLECTION_NET_MAX_HEALTH
    ) {
      this.repairFocused();
    } else {
      this.collectFocused();
    }
  };
}
