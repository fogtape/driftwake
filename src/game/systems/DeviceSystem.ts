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
  createLockerModel,
  createSolarPurifierModel,
  createTripleGrillModel,
} from '../art/AdvancedDeviceModels';
import {
  createGrillModel,
  createPurifierModel,
  type DeviceModelVisuals,
} from '../art/ProceduralModels';
import type { MaterialLibrary } from '../art/Materials';
import {
  DEVICE_DEFINITIONS,
  LOCKER_SLOT_CAPACITY,
  MAX_RAFT_DEVICES,
  SOLAR_PURIFIER_CAPACITY,
  TRIPLE_GRILL_CAPACITY,
  TRIPLE_GRILL_FUEL_SECONDS,
  advanceDeviceState,
  collectDeviceOutput,
  collectSolarWater,
  collectTripleGrillOutput,
  createDeviceState,
  deviceOutput,
  deviceProgress,
  fuelTripleGrill,
  loadSolarPurifier,
  loadTripleGrill,
  remainingDeviceSeconds,
  startDeviceCycle,
  tripleGrillCounts,
  type DeviceType,
  type SavedDeviceState,
} from '../domain/devices';
import {
  INVENTORY_SLOT_CAPACITY,
  ITEM_DEFINITIONS,
  addItems,
  bundleLabel,
  hasItems,
  itemCount,
  removeItems,
  transferInventoryItem,
  usedInventorySlots,
  type ItemBundle,
  type ItemId,
} from '../domain/items';
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
const DEVICE_TYPES: readonly DeviceType[] = ['purifier', 'grill', 'solarPurifier', 'tripleGrill', 'locker'];

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
  private activeStorageId: string | null = null;
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
    this.previewMaterials = Object.fromEntries(DEVICE_TYPES.map((type) => [
      type,
      new MeshStandardMaterial({
        color: 0x72d4b3,
        roughness: 0.72,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    ])) as Record<DeviceType, MeshStandardMaterial>;
    this.previews = Object.fromEntries(DEVICE_TYPES.map((type) => [type, this.createPreview(type)])) as Record<DeviceType, Group>;
    this.raft.group.add(...Object.values(this.previews));
    for (const state of savedDevices) this.addRuntime(this.cloneState(state));
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
    Object.values(this.previews).forEach((preview) => (preview.visible = false));
    this.clearPrompt();
  }

  setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
    if (!enabled) {
      Object.values(this.previews).forEach((preview) => (preview.visible = false));
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
          const waterDevice = runtime.state.type === 'purifier' || runtime.state.type === 'solarPurifier';
          this.audio.playDeviceReady(waterDevice);
          this.showNotice(waterDevice ? `${DEVICE_DEFINITIONS[runtime.state.type].name}已有淡水` : '银脊鱼火候正好');
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
    return [...this.devices.values()].map(({ state }) => ({
      ...state,
      elapsed: Number(state.elapsed.toFixed(3)),
      waterQueue: state.waterQueue.map((elapsed) => Number(elapsed.toFixed(3))),
      grillSlots: state.grillSlots.map((slot) => ({ ...slot, elapsed: Number(slot.elapsed.toFixed(3)) })),
      fuelSeconds: Number(state.fuelSeconds.toFixed(3)),
      storage: { ...state.storage },
    }));
  }

  closeStorage(): void {
    if (this.activeStorageId !== null) this.audio.playStorageOpen(false);
    this.activeStorageId = null;
    useGameStore.getState().setStorage(null);
  }

  transferStorage(
    itemId: ItemId,
    direction: 'to-storage' | 'to-pack',
    amount: number = ITEM_DEFINITIONS[itemId].maxStack,
  ): boolean {
    const runtime = this.activeStorageId ? this.devices.get(this.activeStorageId) : null;
    if (!runtime || runtime.state.type !== 'locker') return false;
    const store = useGameStore.getState();
    if (direction === 'to-storage') {
      if (itemId === 'hook') {
        this.audio.playDenied();
        this.showNotice('打捞钩需要留在随身工具位');
        return false;
      }
      const result = transferInventoryItem(
        store.inventory,
        runtime.state.storage,
        itemId,
        amount,
        LOCKER_SLOT_CAPACITY,
      );
      if (result.moved <= 0 || !store.spendItems({ [itemId]: result.moved })) {
        this.audio.playDenied();
        this.showNotice('干舱储物格已满');
        return false;
      }
      runtime.state = { ...runtime.state, storage: result.target };
      this.showNotice(
        result.reason === 'partial'
          ? `${ITEM_DEFINITIONS[itemId].shortName}存入 ${result.moved}/${result.attempted} · 干舱已满`
          : `${ITEM_DEFINITIONS[itemId].shortName} ×${result.moved} 已存入`,
      );
    } else {
      const result = transferInventoryItem(
        runtime.state.storage,
        store.inventory,
        itemId,
        amount,
        INVENTORY_SLOT_CAPACITY,
      );
      if (result.moved <= 0) {
        this.audio.playDenied();
        this.showNotice('背包没有空位');
        return false;
      }
      const accepted = itemCount(store.addItemBundle({ [itemId]: result.moved }), itemId);
      if (accepted <= 0) {
        this.audio.playDenied();
        this.showNotice('背包没有空位');
        return false;
      }
      const storage = accepted === result.moved
        ? result.source
        : removeItems(runtime.state.storage, { [itemId]: accepted });
      if (!storage) return false;
      runtime.state = { ...runtime.state, storage };
      this.showNotice(
        result.reason === 'partial'
          ? `${ITEM_DEFINITIONS[itemId].shortName}取回 ${accepted}/${result.attempted} · 背包已满`
          : `${ITEM_DEFINITIONS[itemId].shortName} ×${accepted} 已取回`,
      );
    }
    this.audio.playStorageTransfer(direction === 'to-storage');
    this.publishStorage(runtime);
    this.updateVisuals(runtime, 0);
    return true;
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
    const store = useGameStore.getState();
    const refund: ItemBundle = runtime.state.type === 'locker' ? { ...runtime.state.storage } : {};
    refund[kit] = itemCount(refund, kit) + 1;
    const preview = addItems(store.inventory, refund, INVENTORY_SLOT_CAPACITY);
    if (Object.keys(preview.rejected).length > 0) {
      this.audio.playDenied();
      this.showNotice(runtime.state.type === 'locker' ? '背包没有空间收回储物柜与柜内物资' : '背包没有空间收回设备');
      return false;
    }
    store.addItemBundle(refund);
    const interrupted = runtime.state.phase !== 'idle';
    this.removeRuntime(runtime);
    this.publishFeedback();
    this.showNotice(interrupted ? '设备已拆解，内部物资损失' : `${ITEM_DEFINITIONS[kit].shortName} 已收回`);
    return true;
  }

  resolvePlayerCollision(position: Vector3, previous: Vector3, footHeight = 0): void {
    if (footHeight > 1.8) return;
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
    this.raft.group.remove(...Object.values(this.previews));
    Object.values(this.previewMaterials).forEach((material) => material.dispose());
    useGameStore.getState().setStorage(null);
    this.audio.setDeviceActivity(0, 0);
  }

  private createPreview(type: DeviceType): Group {
    const preview = this.createModel(type);
    preview.name = `${type}-placement-preview`;
    preview.visible = false;
    preview.renderOrder = 3;
    const visuals = preview.userData.deviceVisuals as DeviceModelVisuals;
    if (visuals.fire) visuals.fire.visible = false;
    visuals.puffs?.forEach((puff) => (puff.visible = false));
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
    if (type === 'purifier') return createPurifierModel(this.materials);
    if (type === 'grill') return createGrillModel(this.materials);
    if (type === 'solarPurifier') return createSolarPurifierModel(this.materials);
    if (type === 'tripleGrill') return createTripleGrillModel(this.materials);
    return createLockerModel(this.materials);
  }

  private addRuntime(state: SavedDeviceState): DeviceRuntime {
    const model = this.createModel(state.type);
    model.position.set(state.x * RAFT_TILE_X, 0.09, state.z * RAFT_TILE_Z);
    model.rotation.y = state.rotation;
    const runtime: DeviceRuntime = {
      state: this.cloneState(state),
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
    if (this.activeStorageId === runtime.state.id) this.closeStorage();
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

  private cloneState(state: SavedDeviceState): SavedDeviceState {
    return {
      ...state,
      waterQueue: [...state.waterQueue],
      grillSlots: state.grillSlots.map((slot) => ({ ...slot })),
      storage: { ...state.storage },
    };
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
    const impactColor = type === 'purifier' || type === 'solarPurifier'
      ? 0x67c6cf
      : type === 'locker'
        ? 0x708f8d
        : 0xe58a58;
    this.splashes.spawnImpact(this.worldHit, impactColor, type === 'locker' ? 26 : 20);
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
      const height = runtime.state.type === 'locker'
        ? 0.58
        : runtime.state.type === 'solarPurifier'
          ? 0.66
          : runtime.state.type === 'purifier'
            ? 0.58
            : 0.47;
      this.localCenter.set(runtime.state.x * RAFT_TILE_X, height, runtime.state.z * RAFT_TILE_Z);
      this.toCenter.copy(this.localCenter).sub(this.localOrigin);
      const along = this.toCenter.dot(this.localDirection);
      const interactionReach = runtime.state.type === 'locker' ? 4.1 : 3.5;
      if (along <= 0 || along > interactionReach || along >= bestAlong) continue;
      this.closest.copy(this.localDirection).multiplyScalar(along).add(this.localOrigin);
      const radius = runtime.state.type === 'locker'
        ? 0.98
        : runtime.state.type === 'solarPurifier' || runtime.state.type === 'tripleGrill'
          ? 0.7
        : runtime.state.type === 'purifier'
          ? 0.58
          : 0.52;
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
    const inventory = useGameStore.getState().inventory;
    if (device.type === 'locker') {
      return `打开干舱储物柜 · ${usedInventorySlots(device.storage)}/${LOCKER_SLOT_CAPACITY}`;
    }
    if (device.type === 'solarPurifier') {
      const occupied = device.waterQueue.length + device.freshWater;
      if (device.freshWater > 0) return `收取一杯蒸馏淡水 · ${device.freshWater}/${SOLAR_PURIFIER_CAPACITY}`;
      if (occupied < SOLAR_PURIFIER_CAPACITY) {
        return itemCount(inventory, 'emptyCup') > 0
          ? `舀入一杯海水 · ${occupied}/${SOLAR_PURIFIER_CAPACITY}`
          : `需要空杯 · ${occupied}/${SOLAR_PURIFIER_CAPACITY}`;
      }
      return `日照蒸馏中 · ${remainingDeviceSeconds(device)} 秒`;
    }
    if (device.type === 'tripleGrill') {
      const counts = tripleGrillCounts(device);
      if (counts.ready > 0) return `收取烤银脊鱼 · ${counts.ready} 份可取`;
      if (counts.burnt > 0) return `收取焦黑银脊鱼 · ${counts.burnt} 份`;
      if (device.grillSlots.length < TRIPLE_GRILL_CAPACITY) {
        const needsFuel = device.fuelSeconds < definition.duration;
        const missing = [
          ...(itemCount(inventory, 'rawFish') < 1 ? ['生鱼'] : []),
          ...(needsFuel && itemCount(inventory, 'timber') < 1 ? ['漂木'] : []),
        ];
        return missing.length > 0
          ? `需要 ${missing.join('、')} · ${device.grillSlots.length}/${TRIPLE_GRILL_CAPACITY}`
          : `放入一份银脊鱼 · ${device.grillSlots.length}/${TRIPLE_GRILL_CAPACITY}`;
      }
      if (device.fuelSeconds <= 0) return '炉膛熄灭 · 需要漂木';
      return `三槽烤制中 · ${remainingDeviceSeconds(device)} 秒`;
    }
    if (device.phase === 'working') return `${definition.name}运行中 · ${remainingDeviceSeconds(device)} 秒`;
    if (device.phase === 'ready') {
      if (device.type === 'purifier') return '收取蒸馏淡水';
      const burnIn = Math.max(0, Math.ceil(definition.duration + (definition.readyWindow ?? 0) - device.elapsed));
      return `收取烤银脊鱼 · ${burnIn} 秒后焦黑`;
    }
    if (device.phase === 'burnt') return '收取焦黑银脊鱼';
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
    if (runtime.state.type === 'locker') {
      this.activeStorageId = runtime.state.id;
      this.publishStorage(runtime);
      store.setOverlayPanel('storage');
      if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
      this.audio.playStorageOpen(true);
      this.clearPrompt();
      return;
    }
    if (runtime.state.type === 'solarPurifier') {
      if (runtime.state.freshWater > 0) {
        const preview = addItems(store.inventory, { freshWaterCup: 1 }, INVENTORY_SLOT_CAPACITY);
        if (itemCount(preview.accepted, 'freshWaterCup') < 1) {
          this.audio.playDenied();
          this.showNotice('背包没有空间收下淡水杯');
          return;
        }
        store.addItemBundle({ freshWaterCup: 1 });
        runtime.state = collectSolarWater(runtime.state);
        this.audio.playCollect();
        this.showNotice('+1 淡水杯');
      } else if (runtime.state.waterQueue.length < SOLAR_PURIFIER_CAPACITY) {
        if (!store.spendItems({ emptyCup: 1 })) {
          this.audio.playDenied();
          this.showNotice(this.interactionLabel(runtime.state));
          return;
        }
        runtime.state = loadSolarPurifier(runtime.state);
        this.audio.playWaterCharge();
        this.showNotice(`海水已注入冷凝位 · ${runtime.state.waterQueue.length + runtime.state.freshWater}/${SOLAR_PURIFIER_CAPACITY}`);
      } else {
        this.audio.playDenied();
        return;
      }
      this.updateVisuals(runtime, 0);
      this.publishFeedback();
      this.setPrompt(this.interactionLabel(runtime.state));
      return;
    }
    if (runtime.state.type === 'tripleGrill') {
      const counts = tripleGrillCounts(runtime.state);
      if (counts.ready > 0 || counts.burnt > 0) {
        const collected = collectTripleGrillOutput(runtime.state);
        const outputId = Object.keys(collected.output)[0] as ItemId;
        const preview = addItems(store.inventory, collected.output, INVENTORY_SLOT_CAPACITY);
        if (!outputId || itemCount(preview.accepted, outputId) < itemCount(collected.output, outputId)) {
          this.audio.playDenied();
          this.showNotice('背包没有空位');
          return;
        }
        store.addItemBundle(collected.output);
        runtime.state = collected.device;
        this.audio.playCollect();
        this.showNotice(bundleLabel(collected.output));
      } else if (runtime.state.grillSlots.length < TRIPLE_GRILL_CAPACITY) {
        const needsFuel = runtime.state.fuelSeconds < definition.duration;
        const cost: ItemBundle = { rawFish: 1, ...(needsFuel ? { timber: 1 } : {}) };
        if (!store.spendItems(cost)) {
          this.audio.playDenied();
          this.showNotice(this.interactionLabel(runtime.state));
          return;
        }
        runtime.state = loadTripleGrill(runtime.state);
        if (needsFuel) runtime.state = fuelTripleGrill(runtime.state);
        this.audio.playGrillSlot();
        if (needsFuel) this.audio.playIgnite();
        this.showNotice(`银脊鱼已放入第 ${runtime.state.grillSlots.length} 槽`);
      } else if (runtime.state.fuelSeconds <= 0 && store.spendItems({ timber: 1 })) {
        runtime.state = fuelTripleGrill(runtime.state);
        this.audio.playIgnite();
        this.showNotice('炉膛已补入漂木');
      } else {
        this.audio.playDenied();
        this.showNotice(this.interactionLabel(runtime.state));
        return;
      }
      this.updateVisuals(runtime, 0);
      this.publishFeedback();
      this.setPrompt(this.interactionLabel(runtime.state));
      return;
    }
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

  private publishStorage(runtime: DeviceRuntime): void {
    useGameStore.getState().setStorage({
      deviceId: runtime.state.id,
      name: DEVICE_DEFINITIONS[runtime.state.type].name,
      inventory: { ...runtime.state.storage },
      slots: usedInventorySlots(runtime.state.storage),
      capacity: LOCKER_SLOT_CAPACITY,
    });
  }

  private updateVisuals(runtime: DeviceRuntime, time: number): void {
    const { state, visuals } = runtime;
    if (state.type === 'locker') {
      const open = this.activeStorageId === state.id && useGameStore.getState().overlayPanel === 'storage';
      if (visuals.lid) visuals.lid.rotation.x = MathUtils.damp(visuals.lid.rotation.x, open ? -1.14 : 0, 5.2, 1 / 60);
      const usedSlots = usedInventorySlots(state.storage);
      visuals.storageMarkers?.forEach((marker, index) => {
        const active = index < usedSlots;
        marker.scale.y = MathUtils.lerp(marker.scale.y, active ? 1.12 : 0.46, 0.16);
        if (marker.material instanceof MeshStandardMaterial) {
          marker.material.color.setHex(active ? 0x91c2b7 : 0x536d69);
          marker.material.emissive.setHex(active ? 0x183d38 : 0x000000);
          marker.material.emissiveIntensity = active ? 0.7 : 0;
        }
      });
      return;
    }

    const progress = deviceProgress(state);
    if (state.type === 'solarPurifier') {
      const total = state.freshWater + state.waterQueue.length;
      visuals.waterCells?.forEach((water, index) => {
        const ready = index < state.freshWater;
        const queueIndex = index - state.freshWater;
        const queued = queueIndex >= 0 && queueIndex < state.waterQueue.length;
        const fill = ready ? 1 : queued ? MathUtils.clamp(state.waterQueue[queueIndex] / DEVICE_DEFINITIONS.solarPurifier.duration, 0.16, 1) : 0;
        water.visible = index < total;
        water.scale.set(0.88 + fill * 0.12, Math.max(0.12, fill), 0.88 + fill * 0.12);
        water.position.y = -0.1 + fill * 0.035;
        if (water.material instanceof MeshStandardMaterial) {
          water.material.color.setHex(ready ? 0x75e1df : 0x3b969d);
          water.material.emissive.setHex(ready ? 0x164b48 : 0x000000);
          water.material.emissiveIntensity = ready ? 0.45 : 0;
        }
      });
      visuals.waterReadyMarkers?.forEach((marker, index) => {
        marker.visible = index < state.freshWater;
        marker.scale.setScalar(0.9 + Math.sin(time * 4.2 + index) * 0.12);
        if (marker.material instanceof MeshStandardMaterial) {
          marker.material.emissive.setHex(0x2b8f83);
          marker.material.emissiveIntensity = 0.85;
        }
      });
      if (visuals.collectorPivot) visuals.collectorPivot.rotation.z = Math.sin(time * 0.16 + state.x * 0.4) * 0.012;
      const steaming = state.waterQueue.length > 0 && progress > 0.12;
      this.animatePuffs(visuals, time, steaming, 0.9, 0xd8eee8, 0.17, 0.3);
      if (visuals.drip) {
        visuals.drip.visible = steaming;
        visuals.drip.position.set((Math.floor(time * 1.5) % 5 - 2) * 0.19, 0.56 - ((time * 2.1) % 1) * 0.13, 0.19);
      }
      return;
    }

    const triple = state.type === 'tripleGrill';
    const heating = triple
      ? state.grillSlots.some((slot) => slot.phase !== 'burnt') && state.fuelSeconds > 0
      : state.phase === 'working' || (state.type === 'grill' && state.phase === 'ready');
    this.animateFire(visuals, time, state.x, heating);
    this.animatePuffs(
      visuals,
      time,
      (heating && (state.type === 'grill' || triple || progress > 0.18)) || state.phase === 'burnt',
      triple ? 0.74 : state.type === 'purifier' ? 0.79 : 0.58,
      state.phase === 'burnt' ? 0x57534e : state.type === 'purifier' ? 0xd5e8df : 0x848580,
      state.type === 'purifier' ? 0.16 : 0.12,
      state.type === 'purifier' ? 0.28 : 0.2,
    );

    if (triple) {
      visuals.foodSlots?.forEach((food, index) => {
        const slot = state.grillSlots[index];
        food.visible = Boolean(slot);
        if (!slot) return;
        food.position.y = 0.62 + (heating ? Math.sin(time * 8 + index * 0.8) * 0.004 : 0);
        const blend = slot.phase === 'burnt'
          ? 1
          : MathUtils.smoothstep(slot.elapsed / DEVICE_DEFINITIONS.tripleGrill.duration, 0.16, 1);
        visuals.foodSlotMeshes?.[index]?.forEach((mesh) => {
          this.rawColor.setHex(mesh.material.userData.rawColor ?? 0x8eb9bb);
          this.targetColor.copy(slot.phase === 'burnt' ? BURNT_COLOR : COOKED_COLOR);
          mesh.material.color.copy(this.rawColor).lerp(this.targetColor, blend);
          mesh.material.roughness = MathUtils.lerp(0.48, slot.phase === 'burnt' ? 0.96 : 0.72, blend);
        });
      });
      visuals.fuelBars?.forEach((bar, index) => {
        const active = state.fuelSeconds > index * TRIPLE_GRILL_FUEL_SECONDS + 0.01;
        bar.scale.x = active ? 1 : 0.36;
        if (bar.material instanceof MeshStandardMaterial) {
          bar.material.color.setHex(active ? 0xe09555 : 0x5f6f69);
          bar.material.emissive.setHex(active ? 0x6d2b18 : 0x000000);
          bar.material.emissiveIntensity = active ? 0.62 : 0;
        }
      });
      return;
    }

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

  private animateFire(visuals: DeviceModelVisuals, time: number, phaseOffset: number, heating: boolean): void {
    if (visuals.fire) visuals.fire.visible = heating;
    if (visuals.light) visuals.light.intensity = heating ? 0.78 + Math.sin(time * 17 + phaseOffset) * 0.18 : 0;
    visuals.fire?.children.forEach((child, index) => {
      if (!(child instanceof Mesh) || !(child.material instanceof MeshBasicMaterial) || child.userData.phase === undefined) return;
      const pulse = 0.82 + Math.sin(time * (8.5 + index * 0.6) + child.userData.phase) * 0.16;
      child.scale.y = (1.12 + (index % 2) * 0.36) * pulse;
      child.position.x = child.userData.baseX + Math.sin(time * 5.4 + child.userData.phase) * 0.012;
      child.material.opacity = 0.56 + pulse * 0.2;
    });
    visuals.embers?.forEach((ember, index) => {
      if (!(ember.material instanceof MeshBasicMaterial)) return;
      ember.material.color.setHex(heating && Math.sin(time * 4.2 + index) > -0.2 ? 0xd54f2d : 0x5b2b24);
    });
  }

  private animatePuffs(
    visuals: DeviceModelVisuals,
    time: number,
    active: boolean,
    baseHeight: number,
    color: number,
    opacity: number,
    speed: number,
  ): void {
    visuals.puffs?.forEach((puff, index) => {
      const cycle = (time * speed + puff.userData.phase) % 1;
      puff.visible = active;
      puff.position.set(
        Math.sin(index * 2.4 + time * 0.7) * (0.035 + cycle * 0.12),
        baseHeight + cycle * 0.82,
        Math.cos(index * 1.8 + time * 0.55) * (0.03 + cycle * 0.1),
      );
      puff.scale.setScalar(0.5 + cycle * 1.65);
      if (puff.material instanceof MeshBasicMaterial) {
        puff.material.opacity = active ? Math.sin(cycle * Math.PI) * opacity : 0;
        puff.material.color.setHex(color);
      }
    });
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
      solarPurifier: { placed: 0, working: 0, ready: 0, burnt: 0, progress: 0 },
      tripleGrill: { placed: 0, working: 0, ready: 0, burnt: 0, progress: 0 },
      locker: { placed: 0, working: 0, ready: 0, burnt: 0, progress: 0 },
    };
    let activeFire = 0;
    let activeSteam = 0;
    for (const { state } of this.devices.values()) {
      const entry = feedback[state.type];
      entry.placed += 1;
      if (state.type === 'solarPurifier') {
        entry.working += state.waterQueue.length;
        entry.ready += state.freshWater;
      } else if (state.type === 'tripleGrill') {
        const counts = tripleGrillCounts(state);
        entry.working += counts.working;
        entry.ready += counts.ready;
        entry.burnt += counts.burnt;
      } else {
        if (state.phase === 'working') entry.working += 1;
        if (state.phase === 'ready') entry.ready += 1;
        if (state.phase === 'burnt') entry.burnt += 1;
      }
      entry.progress = Math.max(entry.progress, deviceProgress(state));
      if (
        state.type === 'tripleGrill'
          ? state.grillSlots.length > 0 && state.fuelSeconds > 0
          : state.phase === 'working' || (state.type === 'grill' && state.phase === 'ready')
      ) activeFire += 1;
      if (
        (state.type === 'purifier' && state.phase === 'working' && deviceProgress(state) > 0.18) ||
        (state.type === 'solarPurifier' && state.waterQueue.length > 0 && deviceProgress(state) > 0.12)
      ) activeSteam += 1;
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
