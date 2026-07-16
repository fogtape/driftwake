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
  type WebGLRenderer,
} from 'three';
import {
  createGrillModel,
  createPurifierModel,
  type DeviceModelVisuals,
} from '../art/ProceduralModels';
import type { MaterialLibrary } from '../art/Materials';
import {
  DEVICE_DEFINITIONS,
  MAX_RAFT_DEVICES,
  advanceDeviceState,
  collectDeviceOutput,
  createDeviceState,
  deviceOutput,
  deviceProgress,
  remainingDeviceSeconds,
  startDeviceCycle,
  type DeviceType,
  type SavedDeviceState,
} from '../domain/devices';
import { ITEM_DEFINITIONS, bundleLabel, hasItems, itemCount, type ItemId } from '../domain/items';
import { useGameStore, type DeviceFeedbackMap } from '../../state/gameStore';
import type { PlayerController } from './PlayerController';
import { RAFT_TILE_X, RAFT_TILE_Z, type GridCoordinate, type RaftSystem } from './RaftSystem';
import type { AudioSystem } from './AudioSystem';
import type { SplashSystem } from './SplashSystem';

interface DeviceRuntime {
  state: SavedDeviceState;
  model: Group;
  visuals: DeviceModelVisuals;
}

const COOKED_COLOR = new Color(0xb76a3f);
const BURNT_COLOR = new Color(0x2f2925);

function coordinateEquals(a: GridCoordinate | null, b: GridCoordinate | null): boolean {
  return Boolean(a && b && a.x === b.x && a.z === b.z);
}

export class DeviceSystem {
  private readonly devices = new Map<string, DeviceRuntime>();
  private readonly previews: Record<DeviceType, Group>;
  private readonly previewMaterials: Record<DeviceType, MeshStandardMaterial>;
  private readonly ray = new Ray();
  private readonly localOrigin = new Vector3();
  private readonly localDirection = new Vector3();
  private readonly localHit = new Vector3();
  private readonly localCenter = new Vector3();
  private readonly toCenter = new Vector3();
  private readonly closest = new Vector3();
  private readonly worldHit = new Vector3();
  private readonly forward = new Vector3();
  private readonly inverseRaftRotation = new Quaternion();
  private readonly rawColor = new Color();
  private readonly targetColor = new Color();
  private placementType: DeviceType | null = null;
  private placementCoordinate: GridCoordinate | null = null;
  private placementRotation = 0;
  private placementValid = false;
  private focused: DeviceRuntime | null = null;
  private inputEnabled = false;
  private lastPrompt: string | null = null;
  private lastRaftRevision = -1;
  private feedbackElapsed = 0;
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
    savedDevices: readonly SavedDeviceState[],
    private readonly hasExternalOccupant: (coordinate: GridCoordinate) => boolean = () => false,
  ) {
    this.previewMaterials = {
      purifier: new MeshStandardMaterial({
        color: 0x72d4b3,
        roughness: 0.72,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
      grill: new MeshStandardMaterial({
        color: 0x72d4b3,
        roughness: 0.72,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    };
    this.previews = {
      purifier: this.createPreview('purifier'),
      grill: this.createPreview('grill'),
    };
    this.raft.group.add(this.previews.purifier, this.previews.grill);
    for (const state of savedDevices) this.addRuntime({ ...state });
    this.lastRaftRevision = this.raft.currentRevision;
    this.publishFeedback();

    this.renderer.domElement.addEventListener('mousedown', this.onPointerDown);
    this.renderer.domElement.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('keydown', this.onKeyDown);
  }

  setPlacementType(type: DeviceType | null): void {
    if (this.placementType === type) return;
    this.placementType = type;
    this.placementCoordinate = null;
    this.placementValid = false;
    this.previews.purifier.visible = false;
    this.previews.grill.visible = false;
    this.clearPrompt();
  }

  setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
    if (!enabled) {
      this.previews.purifier.visible = false;
      this.previews.grill.visible = false;
      this.focused = null;
      this.clearPrompt();
    }
  }

  update(time: number, delta: number): void {
    if (this.raft.currentRevision !== this.lastRaftRevision) {
      this.lastRaftRevision = this.raft.currentRevision;
      this.removeOrphanedDevices();
    }

    for (const runtime of this.devices.values()) {
      if (delta > 0) {
        const result = advanceDeviceState(runtime.state, delta);
        runtime.state = result.device;
        if (result.event === 'ready') {
          this.audio.playDeviceReady(runtime.state.type === 'purifier');
          this.showNotice(runtime.state.type === 'purifier' ? '蒸馏淡水可以收取' : '银脊鱼火候正好');
        } else if (result.event === 'burnt') {
          this.audio.playDeviceBurnt();
          this.showNotice('烤架冒出焦烟');
        }
      }
      this.updateVisuals(runtime, time);
    }

    this.feedbackElapsed -= delta;
    if (this.feedbackElapsed <= 0) {
      this.feedbackElapsed = 0.18;
      this.publishFeedback();
    }

    if (!this.inputEnabled) return;
    if (this.placementType) this.updatePlacementPreview();
    else this.updateFocus();
  }

  getSavedDevices(): SavedDeviceState[] {
    return [...this.devices.values()].map(({ state }) => ({ ...state, elapsed: Number(state.elapsed.toFixed(3)) }));
  }

  hasDeviceAt(coordinate: GridCoordinate): boolean {
    return [...this.devices.values()].some(
      ({ state }) => state.x === coordinate.x && state.z === coordinate.z,
    );
  }

  dismantleAt(coordinate: GridCoordinate): boolean {
    const runtime = [...this.devices.values()].find(
      ({ state }) => state.x === coordinate.x && state.z === coordinate.z,
    );
    if (!runtime) return false;
    const kit = DEVICE_DEFINITIONS[runtime.state.type].kitItem;
    const accepted = useGameStore.getState().addItemBundle({ [kit]: 1 });
    if (itemCount(accepted, kit) < 1) {
      this.audio.playDenied();
      this.showNotice('背包没有空间收回设备');
      return false;
    }
    const interrupted = runtime.state.phase !== 'idle';
    this.removeRuntime(runtime);
    this.publishFeedback();
    this.showNotice(interrupted ? '设备已拆解，内部物资损失' : `${ITEM_DEFINITIONS[kit].shortName} 已收回`);
    return true;
  }

  resolvePlayerCollision(position: Vector3, previous: Vector3): void {
    for (const runtime of this.devices.values()) {
      const centerX = runtime.state.x * RAFT_TILE_X;
      const centerZ = runtime.state.z * RAFT_TILE_Z;
      if (Math.hypot(position.x - centerX, position.z - centerZ) >= 0.64) continue;
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
    for (const runtime of this.devices.values()) this.raft.group.remove(runtime.model);
    this.devices.clear();
    this.raft.group.remove(this.previews.purifier, this.previews.grill);
    this.previewMaterials.purifier.dispose();
    this.previewMaterials.grill.dispose();
    this.audio.setDeviceActivity(0, 0);
  }

  private createPreview(type: DeviceType): Group {
    const preview = type === 'purifier' ? createPurifierModel(this.materials) : createGrillModel(this.materials);
    preview.name = `${type}-placement-preview`;
    preview.visible = false;
    preview.renderOrder = 3;
    const visuals = preview.userData.deviceVisuals as DeviceModelVisuals;
    visuals.fire.visible = false;
    visuals.puffs.forEach((puff) => (puff.visible = false));
    if (visuals.food) visuals.food.visible = false;
    preview.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const originalMaterials = Array.isArray(object.material) ? object.material : [object.material];
      originalMaterials.forEach((material) => {
        if (!this.isSharedMaterial(material) && material !== this.previewMaterials[type]) material.dispose();
      });
      object.material = this.previewMaterials[type];
      object.castShadow = false;
      object.receiveShadow = false;
    });
    return preview;
  }

  private createModel(type: DeviceType): Group {
    return type === 'purifier' ? createPurifierModel(this.materials) : createGrillModel(this.materials);
  }

  private addRuntime(state: SavedDeviceState): DeviceRuntime {
    const model = this.createModel(state.type);
    model.position.set(state.x * RAFT_TILE_X, 0.09, state.z * RAFT_TILE_Z);
    model.rotation.y = state.rotation;
    const runtime: DeviceRuntime = {
      state,
      model,
      visuals: model.userData.deviceVisuals as DeviceModelVisuals,
    };
    this.devices.set(state.id, runtime);
    this.raft.group.add(model);
    this.updateVisuals(runtime, 0);
    return runtime;
  }

  private removeRuntime(runtime: DeviceRuntime): void {
    this.raft.group.remove(runtime.model);
    this.devices.delete(runtime.state.id);
    runtime.model.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (!this.isSharedMaterial(material)) material.dispose();
      });
    });
    if (this.focused === runtime) {
      this.focused = null;
      this.clearPrompt();
    }
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
    const changed = !coordinateEquals(this.placementCoordinate, coordinate);
    this.placementCoordinate = coordinate;
    const centerX = coordinate.x * RAFT_TILE_X;
    const centerZ = coordinate.z * RAFT_TILE_Z;
    const clearOfPlayer =
      !this.player.isOnRaft() || Math.hypot(this.player.localPosition.x - centerX, this.player.localPosition.z - centerZ) > 0.78;
    const belowLimit = this.devices.size < MAX_RAFT_DEVICES;
    this.placementValid =
      belowLimit &&
      this.raft.hasTile(coordinate) &&
      !this.hasDeviceAt(coordinate) &&
      !this.hasExternalOccupant(coordinate) &&
      clearOfPlayer;
    this.placementRotation = Math.round(Math.atan2(-this.localDirection.x, -this.localDirection.z) / (Math.PI / 2)) * (Math.PI / 2);
    preview.visible = true;
    preview.position.set(centerX, 0.09, centerZ);
    preview.rotation.y = this.placementRotation;
    const material = this.previewMaterials[type];
    material.color.setHex(this.placementValid ? 0x72d4b3 : 0xe26f55);
    material.opacity = this.placementValid ? 0.5 : 0.32;
    if (!changed) return;
    const definition = DEVICE_DEFINITIONS[type];
    if (this.placementValid) this.setPrompt(`安置${definition.name}`);
    else if (!belowLimit) this.setPrompt('筏上设备数量已达上限');
    else if (!this.raft.hasTile(coordinate)) this.setPrompt('设备必须固定在完整筏格上');
    else if (this.hasDeviceAt(coordinate) || this.hasExternalOccupant(coordinate)) this.setPrompt('这个筏格已有设备');
    else this.setPrompt('离开当前筏格后再安置');
  }

  private isSharedMaterial(material: unknown): boolean {
    return (
      this.materials.wood.some((candidate) => candidate === material) ||
      Object.values(this.materials).some((candidate) => candidate === material)
    );
  }

  private placeDevice(): void {
    if (!this.placementType || !this.placementCoordinate || !this.placementValid) {
      this.audio.playDenied();
      return;
    }
    const type = this.placementType;
    const definition = DEVICE_DEFINITIONS[type];
    const store = useGameStore.getState();
    if (!store.spendItems({ [definition.kitItem]: 1 })) {
      this.audio.playDenied();
      this.showNotice('设备套件已不在背包中');
      store.setPlacementDevice(null);
      return;
    }
    this.serial += 1;
    const state = createDeviceState(
      type,
      this.placementCoordinate.x,
      this.placementCoordinate.z,
      this.placementRotation,
      `${type}-${Date.now().toString(36)}-${this.serial.toString(36)}`,
    );
    this.addRuntime(state);
    this.raft.gridToLocal(this.placementCoordinate, this.worldHit);
    this.raft.localPointToWorld(this.worldHit, this.worldHit);
    this.splashes.spawnImpact(this.worldHit, type === 'purifier' ? 0x67c6cf : 0xe58a58, 20);
    this.audio.playDevicePlace();
    this.showNotice(`${definition.name}已固定`);
    store.setPlacementDevice(null);
    this.publishFeedback();
  }

  private updateFocus(): void {
    const storeState = useGameStore.getState();
    const fishingBusy = storeState.selectedTool === 'fishingRod' && storeState.fishing.phase !== 'idle';
    if (storeState.selectedTool === 'hammer' || fishingBusy) {
      this.focused = null;
      this.clearPrompt();
      return;
    }
    this.camera.getWorldDirection(this.forward);
    this.inverseRaftRotation.copy(this.raft.group.quaternion).invert();
    this.localOrigin.copy(this.camera.position).sub(this.raft.group.position).applyQuaternion(this.inverseRaftRotation);
    this.localDirection.copy(this.forward).applyQuaternion(this.inverseRaftRotation).normalize();
    let best: DeviceRuntime | null = null;
    let bestAlong = Number.POSITIVE_INFINITY;
    for (const runtime of this.devices.values()) {
      this.localCenter.set(runtime.state.x * RAFT_TILE_X, runtime.state.type === 'purifier' ? 0.58 : 0.42, runtime.state.z * RAFT_TILE_Z);
      this.toCenter.copy(this.localCenter).sub(this.localOrigin);
      const along = this.toCenter.dot(this.localDirection);
      if (along <= 0 || along > 3.5 || along >= bestAlong) continue;
      this.closest.copy(this.localDirection).multiplyScalar(along).add(this.localOrigin);
      const radius = runtime.state.type === 'purifier' ? 0.58 : 0.52;
      if (this.closest.distanceToSquared(this.localCenter) > radius * radius) continue;
      best = runtime;
      bestAlong = along;
    }
    this.focused = best;
    if (!best) {
      this.clearPrompt();
      return;
    }
    this.setPrompt(this.interactionLabel(best.state));
  }

  private interactionLabel(device: SavedDeviceState): string {
    const definition = DEVICE_DEFINITIONS[device.type];
    if (device.phase === 'working') return `${definition.name}运行中 · ${remainingDeviceSeconds(device)} 秒`;
    if (device.phase === 'ready') {
      if (device.type === 'purifier') return '收取蒸馏淡水';
      const burnIn = Math.max(0, Math.ceil(definition.duration + (definition.readyWindow ?? 0) - device.elapsed));
      return `收取烤银脊鱼 · ${burnIn} 秒后焦黑`;
    }
    if (device.phase === 'burnt') return '收取焦黑银脊鱼';
    const inventory = useGameStore.getState().inventory;
    if (hasItems(inventory, definition.input)) {
      return device.type === 'purifier' ? '装入空杯，舀取海水并点燃' : '放上银脊鱼并点燃';
    }
    const missing = (Object.entries(definition.input) as [ItemId, number][])
      .filter(([id, amount]) => itemCount(inventory, id) < amount)
      .map(([id]) => ITEM_DEFINITIONS[id].shortName)
      .join('、');
    return `需要 ${missing}`;
  }

  private interact(): void {
    const runtime = this.focused;
    if (!runtime) return;
    const store = useGameStore.getState();
    const definition = DEVICE_DEFINITIONS[runtime.state.type];
    if (runtime.state.phase === 'idle') {
      if (!store.spendItems(definition.input)) {
        this.audio.playDenied();
        this.showNotice(this.interactionLabel(runtime.state));
        return;
      }
      runtime.state = startDeviceCycle(runtime.state);
      this.audio.playIgnite();
      this.showNotice(runtime.state.type === 'purifier' ? '海水已舀入蒸馏槽' : '银脊鱼已放上烤架');
    } else if (runtime.state.phase === 'ready' || runtime.state.phase === 'burnt') {
      const output = deviceOutput(runtime.state);
      const outputId = Object.keys(output)[0] as ItemId;
      const accepted = store.addItemBundle(output);
      if (itemCount(accepted, outputId) < itemCount(output, outputId)) {
        this.audio.playDenied();
        this.showNotice('背包没有空位');
        return;
      }
      runtime.state = collectDeviceOutput(runtime.state);
      this.audio.playCollect();
      this.showNotice(bundleLabel(output));
    } else {
      return;
    }
    this.updateVisuals(runtime, 0);
    this.publishFeedback();
    this.setPrompt(this.interactionLabel(runtime.state));
  }

  private updateVisuals(runtime: DeviceRuntime, time: number): void {
    const { state, visuals } = runtime;
    const progress = deviceProgress(state);
    const heating = state.phase === 'working' || (state.type === 'grill' && state.phase === 'ready');
    visuals.fire.visible = heating;
    visuals.light.intensity = heating ? 0.78 + Math.sin(time * 17 + state.x) * 0.18 : 0;
    visuals.fire.children.forEach((child, index) => {
      if (!(child instanceof Mesh) || !(child.material instanceof MeshBasicMaterial) || child.userData.phase === undefined) return;
      const pulse = 0.82 + Math.sin(time * (8.5 + index * 0.6) + child.userData.phase) * 0.16;
      child.scale.y = (1.12 + (index % 2) * 0.36) * pulse;
      child.position.x = child.userData.baseX + Math.sin(time * 5.4 + child.userData.phase) * 0.012;
      child.material.opacity = 0.56 + pulse * 0.2;
    });
    visuals.embers.forEach((ember, index) => {
      if (!(ember.material instanceof MeshBasicMaterial)) return;
      ember.material.color.setHex(heating && Math.sin(time * 4.2 + index) > -0.2 ? 0xd54f2d : 0x5b2b24);
    });

    const puffing = (heating && (state.type === 'grill' || progress > 0.18)) || state.phase === 'burnt';
    const puffBase = state.type === 'purifier' ? 0.79 : 0.58;
    visuals.puffs.forEach((puff, index) => {
      const cycle = (time * (state.type === 'purifier' ? 0.28 : 0.2) + puff.userData.phase) % 1;
      puff.visible = puffing;
      puff.position.set(
        Math.sin(index * 2.4 + time * 0.7) * (0.035 + cycle * 0.12),
        puffBase + cycle * (state.type === 'purifier' ? 0.72 : 0.84),
        Math.cos(index * 1.8 + time * 0.55) * (0.03 + cycle * 0.1),
      );
      puff.scale.setScalar(0.5 + cycle * 1.65);
      if (puff.material instanceof MeshBasicMaterial) {
        puff.material.opacity = puffing ? Math.sin(cycle * Math.PI) * (state.type === 'purifier' ? 0.16 : 0.12) : 0;
        puff.material.color.setHex(state.phase === 'burnt' ? 0x57534e : state.type === 'purifier' ? 0xd5e8df : 0x848580);
      }
    });

    if (visuals.rawWater) {
      visuals.rawWater.visible = state.phase === 'working';
      const waterScale = 1 - progress * 0.28;
      visuals.rawWater.scale.set(waterScale, 1, waterScale);
      visuals.rawWater.position.y = 0.36 - progress * 0.035;
    }
    if (visuals.cleanWater) {
      const hasWater = state.phase === 'working' || state.phase === 'ready';
      visuals.cleanWater.visible = hasWater && progress > 0.08;
      const fill = MathUtils.clamp((progress - 0.08) / 0.92, 0.08, 1);
      visuals.cleanWater.scale.set(fill, 1, fill);
      visuals.cleanWater.position.y = 0.035 + fill * 0.075;
    }
    if (visuals.drip) {
      visuals.drip.visible = state.phase === 'working' && progress > 0.12;
      visuals.drip.position.y = 0.29 - ((time * 1.9) % 1) * 0.15;
      visuals.drip.scale.y = 1.2 + Math.sin(time * 7) * 0.35;
    }
    if (visuals.food && visuals.foodMeshes) {
      visuals.food.visible = state.phase !== 'idle';
      const cookedBlend = state.phase === 'burnt' ? 1 : MathUtils.smoothstep(progress, 0.18, 1);
      visuals.foodMeshes.forEach((mesh) => {
        this.rawColor.setHex(mesh.material.userData.rawColor ?? 0x8eb9bb);
        this.targetColor.copy(state.phase === 'burnt' ? BURNT_COLOR : COOKED_COLOR);
        mesh.material.color.copy(this.rawColor).lerp(this.targetColor, cookedBlend);
        mesh.material.roughness = MathUtils.lerp(0.48, state.phase === 'burnt' ? 0.96 : 0.72, cookedBlend);
      });
      visuals.food.position.y = 0.49 + (heating ? Math.sin(time * 8.2) * 0.005 : 0);
    }
  }

  private removeOrphanedDevices(): void {
    for (const runtime of [...this.devices.values()]) {
      if (this.raft.hasTile(runtime.state)) continue;
      this.raft.gridToLocal(runtime.state, this.worldHit);
      this.raft.localPointToWorld(this.worldHit, this.worldHit);
      this.splashes.spawn(this.worldHit);
      this.splashes.spawnImpact(this.worldHit, 0x8f5742, 28);
      this.removeRuntime(runtime);
      this.audio.playDeviceLost();
      this.showNotice(`${DEVICE_DEFINITIONS[runtime.state.type].name}随筏格落海`);
    }
    this.publishFeedback();
  }

  private publishFeedback(): void {
    const feedback: DeviceFeedbackMap = {
      purifier: { placed: 0, working: 0, ready: 0, burnt: 0, progress: 0 },
      grill: { placed: 0, working: 0, ready: 0, burnt: 0, progress: 0 },
    };
    let activeFire = 0;
    let activeSteam = 0;
    for (const { state } of this.devices.values()) {
      const entry = feedback[state.type];
      entry.placed += 1;
      if (state.phase === 'working') entry.working += 1;
      if (state.phase === 'ready') entry.ready += 1;
      if (state.phase === 'burnt') entry.burnt += 1;
      entry.progress = Math.max(entry.progress, deviceProgress(state));
      if (state.phase === 'working' || (state.type === 'grill' && state.phase === 'ready')) activeFire += 1;
      if (state.type === 'purifier' && state.phase === 'working' && deviceProgress(state) > 0.18) activeSteam += 1;
    }
    useGameStore.getState().setDevices(feedback);
    this.audio.setDeviceActivity(Math.min(1, activeFire * 0.62), Math.min(1, activeSteam * 0.8));
  }

  private setPrompt(prompt: string): void {
    this.lastPrompt = prompt;
    useGameStore.getState().setInteraction(prompt, 'device');
  }

  private clearPrompt(): void {
    const store = useGameStore.getState();
    if (this.lastPrompt && store.interaction === this.lastPrompt) store.setInteraction(null, 'device');
    this.lastPrompt = null;
  }

  private showNotice(message: string): void {
    useGameStore.getState().showNotice(message);
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => {
      if (useGameStore.getState().notice === message) useGameStore.getState().showNotice(null);
    }, 1650);
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
      event.code !== 'KeyE' ||
      event.repeat ||
      !this.inputEnabled ||
      this.placementType ||
      useGameStore.getState().interactionOwner !== 'device'
    ) return;
    this.interact();
  };
}
