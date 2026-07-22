import {
  Color,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Quaternion,
  Ray,
  Vector3,
  type Material,
  type WebGLRenderer,
} from 'three';
import {
  createDryingRackModel,
  createResearchBenchModel,
  createSmelterModel,
  type DryingRackVisuals,
  type ResearchBenchVisuals,
  type SmelterVisuals,
} from '../art/ProgressionModels';
import type { MaterialLibrary } from '../art/Materials';
import {
  BRICK_DRY_SECONDS,
  MAX_DRYING_BRICKS,
  MAX_PROGRESSION_DEVICES,
  RESEARCH_PROJECTS,
  SMELT_SECONDS,
  addWetBrick,
  advanceProgressionDevice,
  canLearnProject,
  collectDryBricks,
  collectSmelter,
  createProgressionDevice,
  progressionDeviceProgress,
  progressionPlacementItem,
  startSmelter,
  type ProgressionDeviceType,
  type SavedProgressionDevice,
  type SavedProgressionState,
} from '../domain/progression';
import {
  ITEM_DEFINITIONS,
  addItems,
  bundleLabel,
  itemCount,
  type ItemBundle,
} from '../domain/items';
import { useGameStore, type ProgressionFeedback } from '../../state/gameStore';
import { matchesInputAction } from '../domain/inputBindings';
import type { AudioSystem } from './AudioSystem';
import type { PlayerController } from './PlayerController';
import { RAFT_TILE_X, RAFT_TILE_Z, type GridCoordinate, type RaftSystem } from './RaftSystem';
import type { SplashSystem } from './SplashSystem';

type ProgressionVisuals = ResearchBenchVisuals | DryingRackVisuals | SmelterVisuals;

interface ProgressionRuntime {
  state: SavedProgressionDevice;
  model: Group;
  visuals: ProgressionVisuals;
}

const VALID_COLOR = new Color(0x72d4b3);
const INVALID_COLOR = new Color(0xe26f55);
const WET_BRICK_COLOR = new Color(0x7a5048);
const DRY_BRICK_COLOR = new Color(0xd6a084);

const DEVICE_NAMES: Record<ProgressionDeviceType, string> = {
  researchBench: '盐迹研究台',
  dryingBricks: '潮红湿砖',
  smelter: '回潮熔炉',
};

const DEVICE_LIMITS: Record<ProgressionDeviceType, number> = {
  researchBench: 1,
  dryingBricks: 3,
  smelter: 2,
};

function sameCoordinate(a: GridCoordinate | null, b: GridCoordinate | null): boolean {
  return Boolean(a && b && a.x === b.x && a.z === b.z);
}

export class ProgressionSystem {
  private readonly devices = new Map<string, ProgressionRuntime>();
  private readonly previewMaterials: Record<ProgressionDeviceType, MeshStandardMaterial> = {
    researchBench: new MeshStandardMaterial({ color: 0x72d4b3, roughness: 0.72, transparent: true, opacity: 0.5, depthWrite: false }),
    dryingBricks: new MeshStandardMaterial({ color: 0x72d4b3, roughness: 0.72, transparent: true, opacity: 0.5, depthWrite: false }),
    smelter: new MeshStandardMaterial({ color: 0x72d4b3, roughness: 0.72, transparent: true, opacity: 0.5, depthWrite: false }),
  };
  private readonly previews: Record<ProgressionDeviceType, Group>;
  private readonly ray = new Ray();
  private readonly forward = new Vector3();
  private readonly localOrigin = new Vector3();
  private readonly localDirection = new Vector3();
  private readonly localHit = new Vector3();
  private readonly localCenter = new Vector3();
  private readonly toCenter = new Vector3();
  private readonly closest = new Vector3();
  private readonly worldHit = new Vector3();
  private readonly inverseRaftRotation = new Quaternion();
  private placementType: ProgressionDeviceType | null = null;
  private placementCoordinate: GridCoordinate | null = null;
  private placementRotation = 0;
  private placementValid = false;
  private focused: ProgressionRuntime | null = null;
  private inputEnabled = false;
  private lastPrompt: string | null = null;
  private lastRaftRevision = -1;
  private feedbackElapsed = 0;
  private smelterMode: 'metalOre' | 'sand' = 'metalOre';
  private noticeTimer: number | null = null;
  private serial = 0;

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly camera: PerspectiveCamera,
    private readonly materials: MaterialLibrary,
    private readonly raft: RaftSystem,
    private readonly player: PlayerController,
    private readonly audio: AudioSystem,
    private readonly splashes: SplashSystem,
    savedState: SavedProgressionState,
    private readonly hasExternalOccupant: (coordinate: GridCoordinate) => boolean = () => false,
  ) {
    useGameStore.getState().hydrateProgression(savedState);
    this.previews = {
      researchBench: this.createPreview('researchBench'),
      dryingBricks: this.createPreview('dryingBricks'),
      smelter: this.createPreview('smelter'),
    };
    this.raft.group.add(this.previews.researchBench, this.previews.dryingBricks, this.previews.smelter);
    for (const device of savedState.devices) this.addRuntime({ ...device, brickElapsed: [...device.brickElapsed] });
    this.lastRaftRevision = this.raft.currentRevision;
    this.publishFeedback();
    this.renderer.domElement.addEventListener('mousedown', this.onPointerDown);
    this.renderer.domElement.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('keydown', this.onKeyDown);
  }

  setPlacementType(type: ProgressionDeviceType | null): void {
    if (this.placementType === type) return;
    this.placementType = type;
    this.placementCoordinate = null;
    this.placementValid = false;
    Object.values(this.previews).forEach((preview) => (preview.visible = false));
    this.clearPrompt();
  }

  setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
    if (enabled) return;
    Object.values(this.previews).forEach((preview) => (preview.visible = false));
    this.focused = null;
    for (const runtime of this.devices.values()) this.highlightFor(runtime).visible = false;
    this.clearPrompt();
  }

  update(time: number, delta: number): void {
    if (this.raft.currentRevision !== this.lastRaftRevision) {
      this.lastRaftRevision = this.raft.currentRevision;
      this.removeOrphanedDevices();
    }
    let activeForges = 0;
    for (const runtime of this.devices.values()) {
      if (delta > 0) {
        const result = advanceProgressionDevice(runtime.state, delta);
        runtime.state = result.device;
        if (result.event === 'brick-dry') {
          this.audio.playBrickDry();
          this.showNotice('一块盐壳耐火砖已完全晾干');
        } else if (result.event === 'smelter-ready') {
          this.audio.playSmelterReady();
          this.showNotice(runtime.state.smeltInput === 'sand' ? '熔炉中的潮镜玻璃板已经退火' : '熔炉中的潮铸金属锭已凝固');
        }
      }
      if (runtime.state.type === 'smelter' && runtime.state.phase === 'working') activeForges += 1;
      this.updateVisuals(runtime, time);
    }
    this.audio.setProgressionForgeActivity(Math.min(1, activeForges * 0.72));

    this.feedbackElapsed -= delta;
    if (this.feedbackElapsed <= 0) {
      this.feedbackElapsed = 0.16;
      this.publishFeedback();
    }
    if (!this.inputEnabled) return;
    if (this.placementType) this.updatePlacementPreview();
    else this.updateFocus();
  }

  getSavedState(): SavedProgressionState {
    const knowledge = useGameStore.getState().progression;
    return {
      researched: [...knowledge.researched],
      learned: [...knowledge.learned],
      devices: [...this.devices.values()].map(({ state }) => ({
        ...state,
        elapsed: Number(state.elapsed.toFixed(3)),
        brickElapsed: state.brickElapsed.map((elapsed) => Number(elapsed.toFixed(3))),
      })),
    };
  }

  hasDeviceAt(coordinate: GridCoordinate): boolean {
    for (const { state } of this.devices.values()) {
      if (state.x === coordinate.x && state.z === coordinate.z) return true;
    }
    return false;
  }

  dismantleAt(coordinate: GridCoordinate): boolean {
    let runtime: ProgressionRuntime | null = null;
    for (const candidate of this.devices.values()) {
      if (candidate.state.x === coordinate.x && candidate.state.z === coordinate.z) {
        runtime = candidate;
        break;
      }
    }
    if (!runtime) return false;
    const refund = this.dismantleRefund(runtime.state);
    const store = useGameStore.getState();
    const preview = addItems(store.inventory, refund);
    if (Object.keys(preview.rejected).length > 0) {
      this.audio.playDenied();
      this.showNotice('背包没有空间收回设备与内部物资');
      return false;
    }
    store.addItemBundle(refund);
    const interrupted = runtime.state.type === 'smelter' && runtime.state.phase !== 'idle';
    this.removeRuntime(runtime);
    this.publishFeedback();
    this.showNotice(interrupted ? '熔炉已拆解，炉内矿物损失' : `${DEVICE_NAMES[runtime.state.type]}已收回`);
    return true;
  }

  resolvePlayerCollision(position: Vector3, previous: Vector3, footHeight = 0): void {
    if (footHeight > 1.8) return;
    for (const runtime of this.devices.values()) {
      const centerX = runtime.state.x * RAFT_TILE_X;
      const centerZ = runtime.state.z * RAFT_TILE_Z;
      const radius = runtime.state.type === 'dryingBricks' ? 0.58 : 0.69;
      if (Math.hypot(position.x - centerX, position.z - centerZ) >= radius) continue;
      position.x = previous.x;
      position.z = previous.z;
      return;
    }
  }

  dispose(): void {
    this.renderer.domElement.removeEventListener('mousedown', this.onPointerDown);
    this.renderer.domElement.removeEventListener('contextmenu', this.onContextMenu);
    window.removeEventListener('keydown', this.onKeyDown);
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);
    for (const runtime of [...this.devices.values()]) this.removeRuntime(runtime);
    this.raft.group.remove(this.previews.researchBench, this.previews.dryingBricks, this.previews.smelter);
    Object.values(this.previewMaterials).forEach((material) => material.dispose());
    this.audio.setProgressionForgeActivity(0);
  }

  private createModel(type: ProgressionDeviceType): Group {
    if (type === 'researchBench') return createResearchBenchModel(this.materials);
    if (type === 'dryingBricks') return createDryingRackModel(this.materials);
    return createSmelterModel(this.materials);
  }

  private createPreview(type: ProgressionDeviceType): Group {
    const preview = this.createModel(type);
    preview.name = `${type}-placement-preview`;
    preview.visible = false;
    preview.renderOrder = 3;
    preview.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const sources = Array.isArray(object.material) ? object.material : [object.material];
      sources.forEach((material) => {
        if (!this.isSharedMaterial(material) && material !== this.previewMaterials[type]) material.dispose();
      });
      object.material = this.previewMaterials[type];
      object.castShadow = false;
      object.receiveShadow = false;
      object.visible = true;
    });
    if (type === 'researchBench') {
      (preview.userData.researchBenchVisuals as ResearchBenchVisuals).highlight.visible = false;
    } else if (type === 'dryingBricks') {
      const visuals = preview.userData.dryingRackVisuals as DryingRackVisuals;
      visuals.bricks.forEach((brick, index) => (brick.visible = index === 0));
      visuals.highlight.visible = false;
    } else {
      const visuals = preview.userData.smelterVisuals as SmelterVisuals;
      visuals.fire.visible = false;
      visuals.smoke.forEach((puff) => (puff.visible = false));
      visuals.sparks.forEach((spark) => (spark.visible = false));
      visuals.ore.visible = false;
      visuals.ingot.visible = false;
      visuals.highlight.visible = false;
    }
    return preview;
  }

  private addRuntime(state: SavedProgressionDevice): ProgressionRuntime {
    const model = this.createModel(state.type);
    model.position.set(state.x * RAFT_TILE_X, 0.09, state.z * RAFT_TILE_Z);
    model.rotation.y = state.rotation;
    const visuals = state.type === 'researchBench'
      ? model.userData.researchBenchVisuals as ResearchBenchVisuals
      : state.type === 'dryingBricks'
        ? model.userData.dryingRackVisuals as DryingRackVisuals
        : model.userData.smelterVisuals as SmelterVisuals;
    const runtime = { state, model, visuals };
    this.devices.set(state.id, runtime);
    this.raft.group.add(model);
    this.updateVisuals(runtime, 0);
    return runtime;
  }

  private removeRuntime(runtime: ProgressionRuntime): void {
    this.raft.group.remove(runtime.model);
    this.devices.delete(runtime.state.id);
    runtime.model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.geometry.dispose();
      const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
      objectMaterials.forEach((material) => {
        if (!this.isSharedMaterial(material)) material.dispose();
      });
    });
    if (this.focused === runtime) {
      this.focused = null;
      this.clearPrompt();
    }
  }

  private typeCount(type: ProgressionDeviceType): number {
    let count = 0;
    for (const runtime of this.devices.values()) if (runtime.state.type === type) count += 1;
    return count;
  }

  private updatePlacementPreview(): void {
    const type = this.placementType!;
    const preview = this.previews[type];
    this.camera.getWorldDirection(this.forward);
    this.inverseRaftRotation.copy(this.raft.group.quaternion).invert();
    this.localOrigin.copy(this.camera.position).sub(this.raft.group.position).applyQuaternion(this.inverseRaftRotation);
    this.localDirection.copy(this.forward).applyQuaternion(this.inverseRaftRotation).normalize();
    this.ray.set(this.localOrigin, this.localDirection);
    if (Math.abs(this.ray.direction.y) < 0.02) {
      preview.visible = false;
      this.setPrompt('将视线移向木筏表面');
      return;
    }
    const distance = (0.1 - this.ray.origin.y) / this.ray.direction.y;
    if (distance <= 0 || distance > 6.2) {
      preview.visible = false;
      this.setPrompt('将视线移向木筏表面');
      return;
    }
    this.ray.at(distance, this.localHit);
    const coordinate = this.raft.localToGrid(this.localHit);
    const changed = !sameCoordinate(this.placementCoordinate, coordinate);
    this.placementCoordinate = coordinate;
    const centerX = coordinate.x * RAFT_TILE_X;
    const centerZ = coordinate.z * RAFT_TILE_Z;
    const clearOfPlayer = !this.player.isOnRaft() || Math.hypot(this.player.localPosition.x - centerX, this.player.localPosition.z - centerZ) > 0.82;
    const belowTypeLimit = this.typeCount(type) < DEVICE_LIMITS[type];
    const belowTotalLimit = this.devices.size < MAX_PROGRESSION_DEVICES;
    this.placementValid =
      belowTypeLimit &&
      belowTotalLimit &&
      this.raft.hasTile(coordinate) &&
      !this.hasDeviceAt(coordinate) &&
      !this.hasExternalOccupant(coordinate) &&
      clearOfPlayer;
    this.placementRotation = Math.round(Math.atan2(-this.localDirection.x, -this.localDirection.z) / (Math.PI / 2)) * (Math.PI / 2);
    preview.visible = true;
    preview.position.set(centerX, 0.09, centerZ);
    preview.rotation.y = this.placementRotation;
    const material = this.previewMaterials[type];
    material.color.copy(this.placementValid ? VALID_COLOR : INVALID_COLOR);
    material.opacity = this.placementValid ? 0.5 : 0.31;
    if (!changed) return;
    if (this.placementValid) this.setPrompt(`安置${DEVICE_NAMES[type]}`);
    else if (!belowTypeLimit || !belowTotalLimit) this.setPrompt(`${DEVICE_NAMES[type]}数量已达上限`);
    else if (!this.raft.hasTile(coordinate)) this.setPrompt('设备必须安置在完整筏格上');
    else if (this.hasDeviceAt(coordinate) || this.hasExternalOccupant(coordinate)) this.setPrompt('这个筏格已有设备');
    else this.setPrompt('离开当前筏格后再安置');
  }

  private placeDevice(): void {
    if (!this.placementType || !this.placementCoordinate || !this.placementValid) {
      this.audio.playDenied();
      return;
    }
    const type = this.placementType;
    const item = progressionPlacementItem(type);
    const store = useGameStore.getState();
    if (!store.spendItems({ [item]: 1 })) {
      this.audio.playDenied();
      this.showNotice(`${ITEM_DEFINITIONS[item].shortName}已不在背包中`);
      store.setPlacementDevice(null);
      return;
    }
    this.serial += 1;
    const state = createProgressionDevice(
      type,
      this.placementCoordinate.x,
      this.placementCoordinate.z,
      this.placementRotation,
      `${type}-${Date.now().toString(36)}-${this.serial.toString(36)}`,
    );
    this.addRuntime(state);
    this.raft.gridToLocal(this.placementCoordinate, this.worldHit);
    this.raft.localPointToWorld(this.worldHit, this.worldHit);
    const color = type === 'researchBench' ? 0x79a9a1 : type === 'dryingBricks' ? 0xb36e57 : 0xd0785d;
    this.splashes.spawnImpact(this.worldHit, color, type === 'dryingBricks' ? 16 : 26);
    if (type === 'dryingBricks') this.audio.playBrickPlace();
    else this.audio.playDevicePlace();
    this.showNotice(type === 'dryingBricks' ? '潮红湿砖已放到通风架上' : `${DEVICE_NAMES[type]}已固定`);
    store.setPlacementDevice(null);
    this.publishFeedback();
  }

  private updateFocus(): void {
    const store = useGameStore.getState();
    const fishingBusy = store.selectedTool === 'fishingRod' && store.fishing.phase !== 'idle';
    for (const runtime of this.devices.values()) this.highlightFor(runtime).visible = false;
    if (store.selectedTool === 'hammer' || fishingBusy) {
      this.focused = null;
      this.clearPrompt();
      return;
    }
    this.camera.getWorldDirection(this.forward);
    this.inverseRaftRotation.copy(this.raft.group.quaternion).invert();
    this.localOrigin.copy(this.camera.position).sub(this.raft.group.position).applyQuaternion(this.inverseRaftRotation);
    this.localDirection.copy(this.forward).applyQuaternion(this.inverseRaftRotation).normalize();
    let best: ProgressionRuntime | null = null;
    let bestAlong = Number.POSITIVE_INFINITY;
    for (const runtime of this.devices.values()) {
      const height = runtime.state.type === 'smelter' ? 0.82 : runtime.state.type === 'researchBench' ? 0.78 : 0.3;
      this.localCenter.set(runtime.state.x * RAFT_TILE_X, height, runtime.state.z * RAFT_TILE_Z);
      this.toCenter.copy(this.localCenter).sub(this.localOrigin);
      const along = this.toCenter.dot(this.localDirection);
      if (along <= 0 || along > 3.8 || along >= bestAlong) continue;
      this.closest.copy(this.localDirection).multiplyScalar(along).add(this.localOrigin);
      const radius = runtime.state.type === 'dryingBricks' ? 0.68 : 0.78;
      if (this.closest.distanceToSquared(this.localCenter) > radius * radius) continue;
      best = runtime;
      bestAlong = along;
    }
    this.focused = best;
    if (!best) {
      this.clearPrompt();
      return;
    }
    this.highlightFor(best).visible = true;
    this.setPrompt(this.interactionLabel(best));
  }

  private interactionLabel(runtime: ProgressionRuntime): string {
    const { state } = runtime;
    const store = useGameStore.getState();
    if (state.type === 'researchBench') {
      return store.progression.learnable > 0 ? `打开研究台 · ${store.progression.learnable} 项可学习` : '打开盐迹研究台';
    }
    if (state.type === 'dryingBricks') {
      const dry = state.brickElapsed.filter((elapsed) => elapsed >= BRICK_DRY_SECONDS).length;
      if (dry > 0) return `收取 ${dry} 块盐壳耐火砖`;
      if (state.brickElapsed.length < MAX_DRYING_BRICKS && itemCount(store.inventory, 'wetBrick') > 0) {
        return `放上一块湿砖 · ${state.brickElapsed.length}/${MAX_DRYING_BRICKS}`;
      }
      const remaining = Math.ceil(Math.max(0, BRICK_DRY_SECONDS - Math.max(...state.brickElapsed)));
      return `晾干中 · ${remaining} 秒`;
    }
    if (state.phase === 'working') {
      const material = state.smeltInput === 'sand' ? '玻璃澄清' : '矿石熔炼';
      return `${material}中 · ${Math.ceil(SMELT_SECONDS - state.elapsed)} 秒`;
    }
    if (state.phase === 'ready') return state.smeltInput === 'sand' ? '收取潮镜玻璃板' : '收取潮铸金属锭';
    const input = this.smelterMode;
    const missing: string[] = [];
    if (itemCount(store.inventory, input) < 1) missing.push(input === 'sand' ? '浅礁细砂' : '金属矿');
    if (itemCount(store.inventory, 'timber') < 2) missing.push('漂木×2');
    if (missing.length > 0) return `${input === 'sand' ? '玻璃板' : '金属锭'}炉料 · 需要 ${missing.join('、')}`;
    return input === 'sand' ? '装入细砂与漂木，烧制玻璃板' : '装入金属矿与漂木并点燃';
  }

  private interact(): void {
    const runtime = this.focused;
    if (!runtime) return;
    const store = useGameStore.getState();
    if (runtime.state.type === 'researchBench') {
      store.setOverlayPanel('research');
      if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
      this.audio.playResearchOpen();
      this.clearPrompt();
      return;
    }
    if (runtime.state.type === 'dryingBricks') {
      const dryCount = runtime.state.brickElapsed.filter((elapsed) => elapsed >= BRICK_DRY_SECONDS).length;
      if (dryCount > 0) {
        const output = { dryBrick: dryCount };
        const preview = addItems(store.inventory, output);
        if (Object.keys(preview.rejected).length > 0) {
          this.audio.playDenied();
          this.showNotice('背包没有空间收下耐火砖');
          return;
        }
        store.addItemBundle(output);
        const collected = collectDryBricks(runtime.state);
        runtime.state = collected.device;
        this.audio.playBrickCollect();
        this.showNotice(bundleLabel(output));
        if (runtime.state.brickElapsed.length === 0) this.removeRuntime(runtime);
      } else if (runtime.state.brickElapsed.length < MAX_DRYING_BRICKS && store.spendItems({ wetBrick: 1 })) {
        runtime.state = addWetBrick(runtime.state);
        this.audio.playBrickPlace();
        this.showNotice('又放上一块潮红湿砖');
      } else {
        this.audio.playDenied();
        this.showNotice(this.interactionLabel(runtime));
      }
    } else if (runtime.state.phase === 'idle') {
      const input = this.smelterMode;
      if (!store.spendItems({ [input]: 1, timber: 2 })) {
        this.audio.playDenied();
        this.showNotice(this.interactionLabel(runtime));
        return;
      }
      runtime.state = startSmelter(runtime.state, input);
      this.audio.playSmelterLoad();
      this.showNotice(input === 'sand' ? '细砂已装入坩埚，炉膛开始澄清玻璃' : '矿石已装入坩埚，炉膛开始升温');
    } else if (runtime.state.phase === 'ready') {
      const output: ItemBundle = runtime.state.smeltInput === 'sand' ? { glassPane: 1 } : { metalIngot: 1 };
      const preview = addItems(store.inventory, output);
      if (Object.keys(preview.rejected).length > 0) {
        this.audio.playDenied();
        this.showNotice(runtime.state.smeltInput === 'sand' ? '背包没有空间收下玻璃板' : '背包没有空间收下金属锭');
        return;
      }
      const glass = runtime.state.smeltInput === 'sand';
      store.addItemBundle(output);
      runtime.state = collectSmelter(runtime.state);
      this.audio.playSmelterCollect(glass);
      this.showNotice(bundleLabel(output));
    }
    this.updateVisuals(runtime, 0);
    this.publishFeedback();
    if (this.devices.has(runtime.state.id)) this.setPrompt(this.interactionLabel(runtime));
  }

  private updateVisuals(runtime: ProgressionRuntime, time: number): void {
    const { state } = runtime;
    if (state.type === 'researchBench') {
      const visuals = runtime.visuals as ResearchBenchVisuals;
      visuals.dial.rotation.y = time * 0.2;
      visuals.page.rotation.z = Math.sin(time * 0.65 + state.x) * 0.006;
      const learnable = useGameStore.getState().progression.learnable;
      visuals.indicator.opacity = learnable > 0 ? 0.52 + Math.sin(time * 4.2) * 0.22 : 0.24;
      return;
    }
    if (state.type === 'dryingBricks') {
      const visuals = runtime.visuals as DryingRackVisuals;
      visuals.bricks.forEach((brick, index) => {
        const elapsed = state.brickElapsed[index];
        brick.visible = elapsed !== undefined;
        if (elapsed === undefined) return;
        const progress = MathUtils.clamp(elapsed / BRICK_DRY_SECONDS, 0, 1);
        brick.material.color.copy(WET_BRICK_COLOR).lerp(DRY_BRICK_COLOR, MathUtils.smoothstep(progress, 0.12, 1));
        brick.material.roughness = MathUtils.lerp(0.68, 0.96, progress);
        brick.scale.y = MathUtils.lerp(1.04, 0.92, progress);
      });
      return;
    }
    const visuals = runtime.visuals as SmelterVisuals;
    const heating = state.phase === 'working';
    const ready = state.phase === 'ready';
    const progress = progressionDeviceProgress(state);
    visuals.fire.visible = heating;
    visuals.ore.visible = heating && progress < 0.72;
    if (visuals.ore.material instanceof MeshStandardMaterial) {
      visuals.ore.material.color.setHex(state.smeltInput === 'sand' ? 0xd9cda8 : 0x5f8583);
      visuals.ore.material.metalness = state.smeltInput === 'sand' ? 0 : 0.62;
      visuals.ore.material.roughness = state.smeltInput === 'sand' ? 0.92 : 0.52;
    }
    visuals.ore.scale.setScalar(MathUtils.lerp(1, 0.55, progress));
    visuals.ingot.visible = ready;
    if (visuals.ingot.material instanceof MeshStandardMaterial) {
      const glass = state.smeltInput === 'sand';
      visuals.ingot.material.color.setHex(glass ? 0x83c9c4 : 0xb4d0c9);
      visuals.ingot.material.metalness = glass ? 0.05 : 0.72;
      visuals.ingot.material.roughness = glass ? 0.24 : 0.36;
      visuals.ingot.material.transparent = glass;
      visuals.ingot.material.opacity = glass ? 0.82 : 1;
    }
    visuals.crucible.rotation.z = heating ? Math.sin(time * 1.7) * 0.012 : 0;
    visuals.door.rotation.y = MathUtils.damp(visuals.door.rotation.y, state.phase === 'idle' ? -0.72 : 0, 4.5, 0.016);
    visuals.light.intensity = heating ? 1.25 + Math.sin(time * 15.5) * 0.24 : ready ? 0.22 : 0;
    visuals.heatGlow.opacity = heating ? 0.42 + Math.sin(time * 12.4) * 0.1 : ready ? 0.12 : 0;
    visuals.fire.children.forEach((child, index) => {
      if (!(child instanceof Mesh) || child.userData.phase === undefined) return;
      const pulse = 0.82 + Math.sin(time * (9.2 + index * 0.7) + child.userData.phase) * 0.16;
      child.scale.y = (1.08 + (index % 3) * 0.22) * pulse;
      child.position.x = (index - 2) * 0.07 + Math.sin(time * 5.2 + child.userData.phase) * 0.012;
    });
    visuals.smoke.forEach((puff, index) => {
      const cycle = (time * 0.24 + puff.userData.phase) % 1;
      puff.visible = heating;
      puff.position.set(-0.14 + Math.sin(index * 2.1 + time * 0.5) * cycle * 0.13, 1.7 + cycle * 1.0, -0.06 + Math.cos(index + time * 0.4) * cycle * 0.1);
      puff.scale.set(0.34 + cycle * 0.72, 0.46 + cycle * 0.92, 0.34 + cycle * 0.72);
      if (puff.material instanceof MeshBasicMaterial) puff.material.opacity = heating ? Math.sin(cycle * Math.PI) * 0.075 : 0;
    });
    visuals.sparks.forEach((spark, index) => {
      const cycle = (time * (0.52 + (index % 3) * 0.08) + spark.userData.phase) % 1;
      spark.visible = heating;
      spark.position.set(Math.sin(index * 3.2) * (0.08 + cycle * 0.25), 0.52 + cycle * 0.72, 0.35 + Math.cos(index * 1.7) * cycle * 0.12);
      if (spark.material instanceof MeshBasicMaterial) spark.material.opacity = heating ? Math.sin(cycle * Math.PI) * 0.82 : 0;
    });
  }

  private dismantleRefund(state: SavedProgressionDevice): ItemBundle {
    if (state.type === 'researchBench') return { researchBenchKit: 1 };
    if (state.type === 'smelter') return { smelterKit: 1 };
    const dry = state.brickElapsed.filter((elapsed) => elapsed >= BRICK_DRY_SECONDS).length;
    const wet = state.brickElapsed.length - dry;
    return { ...(dry > 0 ? { dryBrick: dry } : {}), ...(wet > 0 ? { wetBrick: wet } : {}) };
  }

  private removeOrphanedDevices(): void {
    for (const runtime of [...this.devices.values()]) {
      if (this.raft.hasTile(runtime.state)) continue;
      this.raft.gridToLocal(runtime.state, this.worldHit);
      this.raft.localPointToWorld(this.worldHit, this.worldHit);
      this.splashes.spawn(this.worldHit);
      this.splashes.spawnImpact(this.worldHit, runtime.state.type === 'smelter' ? 0xa35443 : 0x79624e, 30);
      this.removeRuntime(runtime);
      this.audio.playDeviceLost();
      this.showNotice(`${DEVICE_NAMES[runtime.state.type]}随筏格落海`);
    }
    this.publishFeedback();
  }

  private publishFeedback(): void {
    const knowledge = useGameStore.getState().progression;
    const feedback: Omit<ProgressionFeedback, 'researched' | 'learned'> = {
      researchBenches: 0,
      dryingRacks: 0,
      wetBricks: 0,
      dryBricks: 0,
      smelters: 0,
      working: 0,
      ready: 0,
      progress: 0,
      learnable: (Object.keys(RESEARCH_PROJECTS) as Array<keyof typeof RESEARCH_PROJECTS>)
        .filter((projectId) => canLearnProject(knowledge, projectId)).length,
    };
    let brickProgress = 0;
    let smelterProgress = 0;
    for (const { state } of this.devices.values()) {
      if (state.type === 'researchBench') feedback.researchBenches += 1;
      else if (state.type === 'dryingBricks') {
        feedback.dryingRacks += 1;
        feedback.dryBricks += state.brickElapsed.filter((elapsed) => elapsed >= BRICK_DRY_SECONDS).length;
        feedback.wetBricks += state.brickElapsed.filter((elapsed) => elapsed < BRICK_DRY_SECONDS).length;
        brickProgress = Math.max(brickProgress, progressionDeviceProgress(state));
      } else {
        feedback.smelters += 1;
        if (state.phase === 'working') feedback.working += 1;
        if (state.phase === 'ready') feedback.ready += 1;
        smelterProgress = Math.max(smelterProgress, progressionDeviceProgress(state));
      }
    }
    feedback.progress = feedback.ready > 0 || feedback.working > 0 ? smelterProgress : brickProgress;
    useGameStore.getState().setProgressionFeedback(feedback);
  }

  private highlightFor(runtime: ProgressionRuntime): Mesh {
    return (runtime.visuals as ResearchBenchVisuals | DryingRackVisuals | SmelterVisuals).highlight;
  }

  private isSharedMaterial(material: Material): boolean {
    return (
      this.materials.wood.some((candidate) => candidate === material) ||
      Object.values(this.materials).some((candidate) => candidate === material)
    );
  }

  private setPrompt(prompt: string): void {
    this.lastPrompt = prompt;
    useGameStore.getState().setInteraction(prompt, 'progression');
  }

  private clearPrompt(): void {
    const store = useGameStore.getState();
    if (this.lastPrompt && store.interaction === this.lastPrompt) store.setInteraction(null, 'progression');
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
    if (!this.inputEnabled || !this.placementType) return;
    if (event.button === 0) this.placeDevice();
    else if (event.button === 2) useGameStore.getState().setPlacementDevice(null);
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    if (this.inputEnabled && this.placementType) event.preventDefault();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (
      matchesInputAction('alternate', event.code) &&
      !event.repeat &&
      this.inputEnabled &&
      !this.placementType &&
      this.focused?.state.type === 'smelter' &&
      this.focused.state.phase === 'idle' &&
      useGameStore.getState().interactionOwner === 'progression'
    ) {
      this.smelterMode = this.smelterMode === 'metalOre' ? 'sand' : 'metalOre';
      this.audio.playUi();
      this.showNotice(this.smelterMode === 'sand' ? '炉料切换为潮镜玻璃板' : '炉料切换为潮铸金属锭');
      this.setPrompt(this.interactionLabel(this.focused));
      return;
    }
    if (
      !matchesInputAction('interact', event.code) ||
      event.repeat ||
      !this.inputEnabled ||
      this.placementType ||
      useGameStore.getState().interactionOwner !== 'progression'
    ) return;
    this.interact();
  };
}
