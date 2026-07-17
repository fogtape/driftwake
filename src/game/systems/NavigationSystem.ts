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
  Scene,
  Vector3,
  type BufferAttribute,
  type Material,
  type WebGLRenderer,
} from 'three';
import {
  createAnchorModel,
  createHelmModel,
  createSailModel,
  type AnchorModelVisuals,
  type HelmModelVisuals,
  type NavigationModelVisuals,
  type SailModelVisuals,
} from '../art/NavigationModels';
import {
  createAntennaModel,
  createReceiverModel,
  createSignalBeaconModel,
  type AntennaModelVisuals,
  type ReceiverModelVisuals,
  type SignalBeaconVisuals,
  type SignalModelVisuals,
} from '../art/SignalModels';
import type { MaterialLibrary } from '../art/Materials';
import {
  COURSE_STEP,
  NAVIGATION_DEVICE_DEFINITIONS,
  RECEIVER_CELL_SECONDS,
  SIGNAL_ARRAY_MAX_TILES,
  SIGNAL_ARRAY_MIN_TILES,
  SIGNAL_TARGETS,
  advanceNavigationState,
  bearingTo,
  cardinalLabel,
  createNavigationDevice,
  cycleNavigationRoute,
  cycleSignalTarget,
  installReceiverCell,
  navigationMetrics,
  normalizeAngle,
  reinforceNavigationAnchor,
  reinforceNavigationSail,
  signalArrayStatus,
  signalTelemetry,
  shortestAngle,
  toggleReceiverPower,
  type NavigationRouteMode,
  type NavigationDeviceType,
  type NavigationMetrics,
  type SavedNavigationDevice,
  type SavedNavigationState,
  type SignalArrayStatus,
} from '../domain/navigation';
import { ITEM_DEFINITIONS, addItems, itemCount, type ItemBundle } from '../domain/items';
import { useGameStore } from '../../state/gameStore';
import type { AudioSystem } from './AudioSystem';
import type { IslandSystem } from './IslandSystem';
import type { PlayerController } from './PlayerController';
import { RAFT_TILE_X, RAFT_TILE_Z, type GridCoordinate, type RaftSystem } from './RaftSystem';
import type { SplashSystem } from './SplashSystem';

interface NavigationRuntime {
  state: SavedNavigationDevice;
  model: Group;
  visuals: NavigationModelVisuals | SignalModelVisuals;
  deployVisual: number;
}

const VALID_COLOR = new Color(0x72d4b3);
const INVALID_COLOR = new Color(0xe26f55);

const ROUTE_LABELS: Record<NavigationRouteMode, string> = {
  manual: '自由航向',
  island: '追踪浅滩',
  shelter: '顺风避险',
  signal: '追踪信号',
};

function sameCoordinate(a: GridCoordinate | null, b: GridCoordinate | null): boolean {
  return Boolean(a && b && a.x === b.x && a.z === b.z);
}

export class NavigationSystem {
  private readonly runtimes = new Map<NavigationDeviceType, NavigationRuntime>();
  private readonly previews: Record<NavigationDeviceType, Group>;
  private readonly previewMaterials: Record<NavigationDeviceType, MeshStandardMaterial>;
  private readonly ray = new Ray();
  private readonly forward = new Vector3();
  private readonly localOrigin = new Vector3();
  private readonly localDirection = new Vector3();
  private readonly localHit = new Vector3();
  private readonly localCenter = new Vector3();
  private readonly toCenter = new Vector3();
  private readonly closest = new Vector3();
  private readonly worldHit = new Vector3();
  private readonly worldCenter = new Vector3();
  private readonly projectedCenter = new Vector3();
  private readonly inverseRaftRotation = new Quaternion();
  private state: SavedNavigationState;
  private metrics: NavigationMetrics;
  private placementType: NavigationDeviceType | null = null;
  private placementCoordinate: GridCoordinate | null = null;
  private placementRotation = 0;
  private placementValid = false;
  private focused: NavigationRuntime | null = null;
  private inputEnabled = false;
  private lastPrompt: string | null = null;
  private lastRaftRevision = -1;
  private feedbackElapsed = 0;
  private noticeTimer: number | null = null;
  private readonly signalBeacon: Group;
  private readonly signalBeaconVisuals: SignalBeaconVisuals;
  private signalPingElapsed = 1.2;
  private serial = 0;

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly camera: PerspectiveCamera,
    private readonly scene: Scene,
    private readonly materials: MaterialLibrary,
    private readonly raft: RaftSystem,
    private readonly player: PlayerController,
    private readonly island: IslandSystem,
    private readonly audio: AudioSystem,
    private readonly splashes: SplashSystem,
    savedState: SavedNavigationState,
    private readonly hasExternalOccupant: (coordinate: GridCoordinate) => boolean = () => false,
  ) {
    this.state = { ...savedState, devices: savedState.devices.map((device) => ({ ...device })) };
    this.previewMaterials = {
      sail: this.createPreviewMaterial(),
      anchor: this.createPreviewMaterial(),
      helm: this.createPreviewMaterial(),
      receiver: this.createPreviewMaterial(),
      antenna: this.createPreviewMaterial(),
    };
    this.previews = {
      sail: this.createPreview('sail'),
      anchor: this.createPreview('anchor'),
      helm: this.createPreview('helm'),
      receiver: this.createPreview('receiver'),
      antenna: this.createPreview('antenna'),
    };
    this.raft.group.add(...Object.values(this.previews));
    this.signalBeacon = createSignalBeaconModel(this.materials);
    this.signalBeaconVisuals = this.signalBeacon.userData.signalBeaconVisuals as SignalBeaconVisuals;
    this.scene.add(this.signalBeacon);
    this.state.devices.forEach((device) => this.addRuntime(device));
    this.syncStateDevices();
    this.metrics = this.calculateMetrics();
    this.raft.setHeading(this.state.heading);
    this.lastRaftRevision = this.raft.currentRevision;
    this.publishFeedback();
    this.renderer.domElement.addEventListener('mousedown', this.onPointerDown);
    this.renderer.domElement.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('keydown', this.onKeyDown);
  }

  setPlacementType(type: NavigationDeviceType | null): void {
    if (this.placementType === type) return;
    this.placementType = type;
    this.placementCoordinate = null;
    this.placementValid = false;
    this.previews.sail.visible = false;
    this.previews.anchor.visible = false;
    this.previews.helm.visible = false;
    this.previews.receiver.visible = false;
    this.previews.antenna.visible = false;
    this.clearPrompt();
  }

  setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
    if (enabled) return;
    this.focused = null;
    this.previews.sail.visible = false;
    this.previews.anchor.visible = false;
    this.previews.helm.visible = false;
    this.previews.receiver.visible = false;
    this.previews.antenna.visible = false;
    this.runtimes.forEach((runtime) => (runtime.visuals.highlight.visible = false));
    this.clearPrompt();
  }

  update(time: number, delta: number): void {
    if (this.raft.currentRevision !== this.lastRaftRevision) {
      this.lastRaftRevision = this.raft.currentRevision;
      this.removeOrphanedDevices();
    }
    if (delta > 0) {
      const current = this.currentState();
      const sailWasDeployed = current.devices.some((device) => device.type === 'sail' && device.deployed);
      const anchorWasDeployed = current.devices.some((device) => device.type === 'anchor' && device.deployed);
      const receiverWasOn = current.receiverOn;
      const previousVisited = new Set(current.visitedSignals);
      const advanced = advanceNavigationState(current, delta, this.targetBearing(current));
      const sailIsDeployed = advanced.devices.some((device) => device.type === 'sail' && device.deployed);
      const anchorIsDeployed = advanced.devices.some((device) => device.type === 'anchor' && device.deployed);
      this.state = advanced;
      this.applyAdvancedDevices(advanced.devices);
      if (sailWasDeployed && !sailIsDeployed && advanced.sailStrain >= 0.7) {
        this.audio.playSailOverload();
        this.showNotice('阵风载荷过高，拾风帆已自动泄压收紧');
      }
      if (anchorWasDeployed && !anchorIsDeployed && advanced.anchorStrain >= 0.68) {
        this.audio.playAnchor(false);
        this.showNotice('风暴载荷顶开绞盘，潮石锚已经回滑松脱');
      }
      if (receiverWasOn && !advanced.receiverOn && advanced.receiverCharge <= 0) {
        this.audio.playReceiverPower(false);
        this.showNotice('盐差电池已经耗尽，潮听接收台断电');
      }
      const reachedSignal = advanced.visitedSignals.find((signal) => !previousVisited.has(signal));
      if (reachedSignal) {
        this.audio.playSignalArrival();
        const nextSignal = advanced.discoveredSignals.find((signal) => !current.discoveredSignals.includes(signal));
        this.showNotice(nextSignal
          ? `抵达${SIGNAL_TARGETS[reachedSignal].name} · 捕获${SIGNAL_TARGETS[nextSignal].name}`
          : `抵达${SIGNAL_TARGETS[reachedSignal].name} · 信号链已完成`);
      }
    }
    this.metrics = this.calculateMetrics();
    this.raft.setHeading(this.state.heading);
    this.runtimes.forEach((runtime) => this.updateRuntime(runtime, time, delta));
    this.updateSignalBeacon(time, delta);
    this.audio.setSailActivity(this.metrics.sailDeployed ? this.metrics.windCapture : 0);
    const telemetry = signalTelemetry(this.currentState());
    this.audio.setReceiverActivity(telemetry.online ? 1 : 0);
    this.signalPingElapsed -= delta;
    if (telemetry.online && telemetry.distance !== null && this.signalPingElapsed <= 0) {
      const strength = MathUtils.clamp(1 - telemetry.distance / 430, 0.08, 1);
      this.audio.playSignalPing(strength);
      this.signalPingElapsed = MathUtils.lerp(5.4, 1.45, strength);
    }

    this.feedbackElapsed -= delta;
    if (this.feedbackElapsed <= 0) {
      this.feedbackElapsed = 0.12;
      this.publishFeedback();
    }

    if (!this.inputEnabled) return;
    if (this.placementType) this.updatePlacementPreview();
    else this.updateFocus();
  }

  getIslandTravel(): Pick<NavigationMetrics, 'approachRate' | 'dockDriftRate' | 'anchored'> {
    this.metrics = this.calculateMetrics();
    return {
      approachRate: this.metrics.approachRate,
      dockDriftRate: this.metrics.dockDriftRate,
      anchored: this.metrics.anchored,
    };
  }

  getWeather(): Pick<NavigationMetrics, 'weatherPhase' | 'stormIntensity' | 'gust'> {
    this.metrics = this.calculateMetrics();
    return {
      weatherPhase: this.metrics.weatherPhase,
      stormIntensity: this.metrics.stormIntensity,
      gust: this.metrics.gust,
    };
  }

  getSavedState(): SavedNavigationState {
    const current = this.currentState();
    return {
      ...current,
      windClock: Number(current.windClock.toFixed(3)),
      weatherClock: Number(current.weatherClock.toFixed(3)),
      courseAngle: Number(current.courseAngle.toFixed(5)),
      heading: Number(current.heading.toFixed(5)),
      sailStrain: Number(current.sailStrain.toFixed(4)),
      anchorStrain: Number(current.anchorStrain.toFixed(4)),
      worldX: Number(current.worldX.toFixed(3)),
      worldZ: Number(current.worldZ.toFixed(3)),
      receiverCharge: Number(current.receiverCharge.toFixed(3)),
      devices: current.devices.map((device) => ({ ...device })),
    };
  }

  hasDeviceAt(coordinate: GridCoordinate): boolean {
    return [...this.runtimes.values()].some(
      ({ state }) => state.x === coordinate.x && state.z === coordinate.z,
    );
  }

  dismantleAt(coordinate: GridCoordinate): boolean {
    const runtime = [...this.runtimes.values()].find(
      ({ state }) => state.x === coordinate.x && state.z === coordinate.z,
    );
    if (!runtime) return false;
    const kit = NAVIGATION_DEVICE_DEFINITIONS[runtime.state.type].kitItem;
    const refund: ItemBundle = {
      [kit]: 1,
      ...(runtime.state.type === 'sail' && runtime.state.reinforced ? { stormRigKit: 1 } : {}),
      ...(runtime.state.type === 'anchor' && runtime.state.reinforced ? { anchorBraceKit: 1 } : {}),
      ...(runtime.state.type === 'receiver' && this.state.receiverCharge >= RECEIVER_CELL_SECONDS * 0.92 ? { brineCell: 1 } : {}),
    };
    const store = useGameStore.getState();
    const preview = addItems(store.inventory, refund);
    if (Object.keys(preview.rejected).length > 0) {
      this.audio.playDenied();
      this.showNotice('背包没有空间收回航行设备');
      return false;
    }
    store.addItemBundle(refund);
    if (runtime.state.deployed) {
      runtime.state.deployed = false;
      if (runtime.state.type === 'anchor') this.audio.playAnchor(false);
    }
    this.removeRuntime(runtime);
    this.syncStateDevices();
    this.publishFeedback();
    this.showNotice(`${ITEM_DEFINITIONS[kit].shortName} 已收回`);
    return true;
  }

  resolvePlayerCollision(position: Vector3, previous: Vector3): void {
    for (const runtime of this.runtimes.values()) {
      const centerX = runtime.state.x * RAFT_TILE_X;
      const centerZ = runtime.state.z * RAFT_TILE_Z;
      const radius = runtime.state.type === 'sail' ? 0.38 : runtime.state.type === 'helm' ? 0.54 : runtime.state.type === 'receiver' ? 0.5 : 0.48;
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
    this.clearPrompt();
    this.audio.setSailActivity(0);
    this.audio.setReceiverActivity(0);
    for (const runtime of [...this.runtimes.values()]) this.removeRuntime(runtime);
    this.raft.group.remove(...Object.values(this.previews));
    Object.values(this.previews).forEach((preview) => this.disposeGroup(preview));
    Object.values(this.previewMaterials).forEach((material) => material.dispose());
    this.scene.remove(this.signalBeacon);
    this.disposeGroup(this.signalBeacon);
  }

  private currentState(): SavedNavigationState {
    return { ...this.state, devices: [...this.runtimes.values()].map(({ state }) => ({ ...state })) };
  }

  private calculateMetrics(): NavigationMetrics {
    const current = this.currentState();
    return navigationMetrics(current, this.targetBearing(current));
  }

  private targetBearing(state = this.currentState()): number {
    if (state.routeMode === 'signal') {
      const signal = signalTelemetry(state);
      if (signal.online && signal.bearing !== null) return signal.bearing;
    }
    const encounter = this.island.getEncounterState();
    return bearingTo(encounter.x, encounter.z);
  }

  private createPreviewMaterial(): MeshStandardMaterial {
    return new MeshStandardMaterial({
      color: VALID_COLOR,
      roughness: 0.72,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
  }

  private createModel(type: NavigationDeviceType): Group {
    if (type === 'sail') return createSailModel(this.materials);
    if (type === 'anchor') return createAnchorModel(this.materials);
    if (type === 'helm') return createHelmModel(this.materials);
    if (type === 'receiver') return createReceiverModel(this.materials);
    return createAntennaModel(this.materials);
  }

  private createPreview(type: NavigationDeviceType): Group {
    const preview = this.createModel(type);
    preview.name = `${type}-placement-preview`;
    preview.visible = false;
    preview.renderOrder = 3;
    preview.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
      sourceMaterials.forEach((material) => {
        if (!this.isSharedMaterial(material) && material !== this.previewMaterials[type]) material.dispose();
      });
      object.material = this.previewMaterials[type];
      object.castShadow = false;
      object.receiveShadow = false;
    });
    return preview;
  }

  private addRuntime(state: SavedNavigationDevice): NavigationRuntime {
    const model = this.createModel(state.type);
    model.position.set(state.x * RAFT_TILE_X, 0.08, state.z * RAFT_TILE_Z);
    model.rotation.y = state.rotation;
    const runtime: NavigationRuntime = {
      state: { ...state },
      model,
      visuals: model.userData.navigationVisuals as NavigationModelVisuals | SignalModelVisuals,
      deployVisual: state.deployed ? 1 : 0,
    };
    this.runtimes.set(state.type, runtime);
    this.raft.group.add(model);
    return runtime;
  }

  private applyAdvancedDevices(devices: SavedNavigationDevice[]): void {
    for (const device of devices) {
      const runtime = this.runtimes.get(device.type);
      if (runtime) runtime.state = { ...device };
    }
  }

  private removeRuntime(runtime: NavigationRuntime): void {
    this.raft.group.remove(runtime.model);
    this.runtimes.delete(runtime.state.type);
    if (runtime.state.type === 'helm') this.state = { ...this.state, routeMode: 'manual' };
    if (runtime.state.type === 'receiver') {
      this.state = { ...this.state, receiverOn: false, receiverCharge: 0, routeMode: this.state.routeMode === 'signal' ? 'manual' : this.state.routeMode };
    }
    if (runtime.state.type === 'antenna') {
      this.state = { ...this.state, receiverOn: false, routeMode: this.state.routeMode === 'signal' ? 'manual' : this.state.routeMode };
    }
    if (this.focused === runtime) {
      this.focused = null;
      this.clearPrompt();
    }
    this.disposeGroup(runtime.model);
  }

  private updateRuntime(runtime: NavigationRuntime, time: number, delta: number): void {
    const targetDeploy = runtime.state.deployed ? 1 : 0;
    const previousDeploy = runtime.deployVisual;
    runtime.deployVisual = MathUtils.damp(runtime.deployVisual, targetDeploy, runtime.state.type === 'sail' ? 3.4 : 2.6, delta);
    if (runtime.visuals.kind === 'sail') {
      this.updateSailVisuals(runtime, runtime.visuals, time);
    } else if (runtime.visuals.kind === 'anchor') {
      this.updateAnchorVisuals(runtime, runtime.visuals, time, previousDeploy);
    } else if (runtime.visuals.kind === 'helm') {
      this.updateHelmVisuals(runtime.visuals, time, delta);
    } else if (runtime.visuals.kind === 'receiver') {
      this.updateReceiverVisuals(runtime.visuals, time, delta);
    } else {
      this.updateAntennaVisuals(runtime.visuals, time);
    }
    if (runtime.visuals.highlight.visible) {
      const pulse = 0.96 + Math.sin(time * 4.5) * 0.045;
      runtime.visuals.highlight.scale.setScalar(pulse);
    }
  }

  private updateSailVisuals(runtime: NavigationRuntime, visuals: SailModelVisuals, time: number): void {
    visuals.pivot.rotation.y = shortestAngle(
      this.state.heading + runtime.state.rotation,
      this.state.courseAngle,
    );
    const windStrength = 0.35 + this.metrics.windCapture * 0.65 + this.metrics.stormIntensity * 0.42;
    const strain = this.state.sailStrain;
    const position = visuals.cloth.geometry.getAttribute('position') as BufferAttribute;
    const values = position.array as Float32Array;
    for (let index = 0; index < values.length; index += 3) {
      const baseX = visuals.clothBase[index];
      const baseY = visuals.clothBase[index + 1];
      const baseZ = visuals.clothBase[index + 2];
      const widthRatio = MathUtils.clamp((baseX - 0.075) / 1.54, 0, 1);
      values[index] = 0.075 + (baseX - 0.075) * MathUtils.lerp(0.055, 1, runtime.deployVisual);
      values[index + 1] = baseY;
      values[index + 2] =
        baseZ +
        Math.sin(time * 2.45 + baseY * 2.8 + widthRatio * 1.7) *
          Math.sin(widthRatio * Math.PI) *
          0.075 *
          windStrength *
          runtime.deployVisual +
        Math.sin(baseY * 16 + time * 1.4) * 0.018 * (1 - runtime.deployVisual) +
        Math.sin(time * 8.6 + baseY * 7.2) * Math.sin(widthRatio * Math.PI) * strain * 0.024;
    }
    position.needsUpdate = true;
    visuals.cloth.geometry.computeVertexNormals();
    visuals.streamerPivot.rotation.y = shortestAngle(
      this.state.heading + runtime.state.rotation,
      this.metrics.windAngle,
    );
    visuals.streamer.rotation.z = Math.sin(time * (6.2 + this.metrics.stormIntensity * 4.4)) * (0.13 + this.metrics.stormIntensity * 0.12);
    visuals.streamer.position.z = Math.sin(time * 4.7) * (0.025 + this.metrics.stormIntensity * 0.02);
    visuals.reinforcement.visible = runtime.state.reinforced;
    visuals.reinforcement.scale.x = MathUtils.lerp(0.07, 1, runtime.deployVisual);
  }

  private updateHelmVisuals(visuals: HelmModelVisuals, time: number, delta: number): void {
    const correction = shortestAngle(this.state.heading, this.metrics.effectiveCourse);
    const wheelTarget = -correction * 1.8 - this.metrics.gust * this.metrics.stormIntensity * 0.34;
    visuals.wheel.rotation.z = MathUtils.damp(visuals.wheel.rotation.z, wheelTarget, 5.2, delta);
    visuals.compassNeedle.rotation.y = -this.state.heading;
    visuals.gimbal.rotation.x = Math.sin(time * 1.35) * 0.022 * this.metrics.stormIntensity;
    visuals.gimbal.rotation.z = Math.cos(time * 1.12) * 0.018 * this.metrics.stormIntensity;
    visuals.gears.forEach((gear, index) => {
      gear.rotation.z += delta * (index % 2 ? -1 : 1) * (0.22 + Math.abs(correction) * 1.8);
    });
    const activeRoute = this.metrics.routeMode === 'manual'
      ? 0
      : this.metrics.routeMode === 'island'
        ? 1
        : this.metrics.routeMode === 'shelter'
          ? 2
          : 3;
    visuals.routePins.forEach((pin, index) => {
      if (!(pin.material instanceof MeshStandardMaterial)) return;
      const active = index === activeRoute;
      pin.scale.setScalar(active ? 1.3 + Math.sin(time * 3.6) * 0.08 : 0.86);
      pin.material.emissive.setHex(active ? 0x2c7669 : 0x000000);
      pin.material.emissiveIntensity = active ? 0.8 : 0;
    });
  }

  private updateAnchorVisuals(
    runtime: NavigationRuntime,
    visuals: AnchorModelVisuals,
    time: number,
    previousDeploy: number,
  ): void {
    const progress = runtime.deployVisual;
    visuals.rope.visible = progress > 0.02;
    visuals.rope.scale.y = Math.max(0.01, progress);
    visuals.rope.position.y = 0.16 - 1.4 * progress;
    visuals.anchor.position.y = 0.32 - 2.92 * progress + Math.sin(time * 1.8) * 0.025 * progress;
    visuals.anchor.rotation.y = Math.sin(time * 0.7) * 0.08 * progress;
    visuals.wheel.rotation.x += (progress - previousDeploy) * 7.8;
    visuals.reinforcement.visible = runtime.state.reinforced;
    if (runtime.state.reinforced) {
      visuals.reinforcement.rotation.x = Math.sin(time * 0.8) * this.state.anchorStrain * 0.008;
    }
  }

  private updateReceiverVisuals(visuals: ReceiverModelVisuals, time: number, delta: number): void {
    const telemetry = signalTelemetry(this.currentState());
    const online = telemetry.online;
    visuals.screenMaterial.emissive.setHex(online ? 0x155f4e : 0x071b19);
    visuals.screenMaterial.emissiveIntensity = MathUtils.damp(
      visuals.screenMaterial.emissiveIntensity,
      online ? 0.92 : 0.12,
      4.5,
      delta,
    );
    visuals.powerMaterial.color.setHex(online ? 0x72d4b3 : this.state.receiverCharge > 0 ? 0xefc35c : 0x532d29);
    visuals.powerMaterial.emissive.copy(visuals.powerMaterial.color);
    visuals.powerMaterial.emissiveIntensity = online ? 1.15 + Math.sin(time * 3.2) * 0.16 : 0.06;
    visuals.sweep.visible = online;
    if (online) visuals.sweep.rotation.z = -time * (1.48 + telemetry.visited * 0.17);
    visuals.blips.forEach((blip, index) => {
      blip.visible = online && index < telemetry.discovered;
      blip.scale.setScalar(0.76 + Math.sin(time * 4.8 + index * 1.9) * 0.22);
      blip.scale.z = 0.28;
    });
    const arraySteps = [
      this.runtimes.has('receiver'),
      this.runtimes.has('antenna'),
      telemetry.arrayStatus === 'ready',
    ];
    visuals.arrayLights.forEach((lamp, index) => {
      if (!(lamp.material instanceof MeshStandardMaterial)) return;
      const ready = arraySteps[index];
      lamp.material.color.setHex(ready ? (online ? 0x72d4b3 : 0xefc35c) : 0x8f3f36);
      lamp.material.emissive.copy(lamp.material.color);
      lamp.material.emissiveIntensity = ready ? (online ? 0.95 : 0.28) : 0.12;
    });
    const charge = this.state.receiverCharge / RECEIVER_CELL_SECONDS;
    visuals.chargeBars.forEach((bar, index) => {
      bar.visible = charge > index / visuals.chargeBars.length + 0.005;
      if (bar.material instanceof MeshStandardMaterial) {
        bar.material.emissiveIntensity = online ? 0.78 : 0.28;
      }
    });
    const frequency = Number.parseFloat(telemetry.frequency ?? '0');
    visuals.tuningDrums.forEach((drum, index) => {
      const digit = Math.floor(frequency * 10 ** index) % 10;
      drum.rotation.z = MathUtils.damp(drum.rotation.z, digit / 10 * Math.PI * 2, 5.5, delta);
    });
    const signalIndex = Math.max(0, this.state.discoveredSignals.indexOf(this.state.activeSignal));
    visuals.tuningNeedle.rotation.z = MathUtils.damp(
      visuals.tuningNeedle.rotation.z,
      -0.9 + signalIndex * 0.56,
      5,
      delta,
    );
  }

  private updateAntennaVisuals(visuals: AntennaModelVisuals, time: number): void {
    const telemetry = signalTelemetry(this.currentState());
    const ready = telemetry.arrayStatus === 'ready';
    visuals.mastPivots.forEach((mast, index) => {
      mast.rotation.z = Math.sin(time * 1.42 + index * 1.7) * (0.006 + this.metrics.stormIntensity * 0.014);
      mast.rotation.x = Math.cos(time * 1.16 + index) * (0.004 + this.metrics.stormIntensity * 0.01);
    });
    visuals.phaseMaterial.color.setHex(telemetry.online ? 0x72d4b3 : ready ? 0xefc35c : 0x8f3f36);
    visuals.phaseMaterial.emissive.copy(visuals.phaseMaterial.color);
    visuals.phaseMaterial.emissiveIntensity = telemetry.online ? 1 + Math.sin(time * 4.1) * 0.25 : ready ? 0.24 : 0.08;
    visuals.signalRings.forEach((ring, index) => {
      ring.visible = telemetry.online;
      const phase = (time * 0.38 + index / visuals.signalRings.length) % 1;
      ring.scale.setScalar(0.68 + phase * 0.88);
      if (ring.material instanceof MeshBasicMaterial) ring.material.opacity = (1 - phase) * 0.2;
    });
  }

  private updateSignalBeacon(time: number, delta: number): void {
    const telemetry = signalTelemetry(this.currentState());
    const visible = telemetry.online && telemetry.distance !== null && telemetry.distance <= 220 && telemetry.targetX !== null && telemetry.targetZ !== null;
    this.signalBeacon.visible = visible;
    if (!visible || telemetry.targetX === null || telemetry.targetZ === null) return;
    const deltaX = telemetry.targetX - this.state.worldX;
    const deltaZ = telemetry.targetZ - this.state.worldZ;
    this.signalBeacon.position.set(
      this.raft.group.position.x + deltaX,
      0.12 + Math.sin(time * 0.84) * 0.1,
      this.raft.group.position.z + deltaZ,
    );
    this.signalBeacon.rotation.y = Math.sin(time * 0.17) * 0.08;
    this.signalBeaconVisuals.rotor.rotation.y += delta * 0.48;
    this.signalBeaconVisuals.floats.forEach((float, index) => {
      float.rotation.z = Math.sin(time * 0.92 + index * 2.1) * 0.04;
      float.position.y = Math.sin(time * 1.05 + index * 2.1) * 0.035;
    });
    this.signalBeaconVisuals.beaconMaterial.emissiveIntensity = 1.1 + Math.sin(time * 5.3) * 0.48;
    this.signalBeaconVisuals.pulseRings.forEach((ring, index) => {
      const phase = (time * 0.36 + index / this.signalBeaconVisuals.pulseRings.length) % 1;
      ring.scale.setScalar(0.65 + phase * 2.25);
      if (ring.material instanceof MeshBasicMaterial) ring.material.opacity = (1 - phase) ** 2 * 0.38;
    });
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
    const clearOfPlayer =
      !this.player.isOnRaft() || Math.hypot(this.player.localPosition.x - centerX, this.player.localPosition.z - centerZ) > 0.72;
    const typeAvailable = !this.runtimes.has(type);
    const onTile = this.raft.hasTile(coordinate);
    const edgeRequired = type !== 'anchor' || this.isEdgeTile(coordinate);
    const arraySpacing = this.arrayPlacementStatus(type, coordinate);
    this.placementValid =
      typeAvailable && onTile && edgeRequired && arraySpacing === 'ready' && !this.hasExternalOccupant(coordinate) && !this.hasDeviceAt(coordinate) && clearOfPlayer;
    this.placementRotation =
      type === 'anchor'
        ? this.anchorOutwardRotation(coordinate)
        : Math.round(Math.atan2(-this.localDirection.x, -this.localDirection.z) / (Math.PI / 2)) * (Math.PI / 2);
    preview.visible = true;
    preview.position.set(centerX, 0.08, centerZ);
    preview.rotation.y = this.placementRotation;
    const material = this.previewMaterials[type];
    material.color.copy(this.placementValid ? VALID_COLOR : INVALID_COLOR);
    material.opacity = this.placementValid ? 0.5 : 0.31;
    if (!changed) return;
    if (this.placementValid) this.setPrompt(`安置${NAVIGATION_DEVICE_DEFINITIONS[type].name}`);
    else if (!typeAvailable) this.setPrompt(`木筏已经安装${NAVIGATION_DEVICE_DEFINITIONS[type].name}`);
    else if (!onTile) this.setPrompt('设备必须固定在完整筏格上');
    else if (!edgeRequired) this.setPrompt('潮石锚需要安置在木筏边缘');
    else if (arraySpacing === 'too-close') this.setPrompt(`接收台与阵列至少间隔${SIGNAL_ARRAY_MIN_TILES}格`);
    else if (arraySpacing === 'too-far') this.setPrompt(`接收台与阵列最多间隔${SIGNAL_ARRAY_MAX_TILES}格`);
    else if (this.hasExternalOccupant(coordinate) || this.hasDeviceAt(coordinate)) this.setPrompt('这个筏格已有设备');
    else this.setPrompt('离开当前筏格后再安置');
  }

  private updateFocus(): void {
    this.camera.getWorldDirection(this.forward);
    this.inverseRaftRotation.copy(this.raft.group.quaternion).invert();
    this.localOrigin.copy(this.camera.position).sub(this.raft.group.position).applyQuaternion(this.inverseRaftRotation);
    this.localDirection.copy(this.forward).applyQuaternion(this.inverseRaftRotation).normalize();
    let best: NavigationRuntime | null = null;
    let bestAlong = Number.POSITIVE_INFINITY;
    for (const runtime of this.runtimes.values()) {
      runtime.visuals.highlight.visible = false;
      this.localCenter.set(
        runtime.state.x * RAFT_TILE_X,
        runtime.state.type === 'sail'
          ? 1.52
          : runtime.state.type === 'antenna'
            ? 1.08
            : runtime.state.type === 'receiver'
              ? 0.8
              : runtime.state.type === 'helm'
                ? 0.88
                : 0.82,
        runtime.state.z * RAFT_TILE_Z,
      );
      this.toCenter.copy(this.localCenter).sub(this.localOrigin);
      const along = this.toCenter.dot(this.localDirection);
      if (along <= 0 || along > 3.7 || along >= bestAlong) continue;
      this.closest.copy(this.localDirection).multiplyScalar(along).add(this.localOrigin);
      const radius = runtime.state.type === 'sail' ? 0.7 : runtime.state.type === 'receiver' ? 0.78 : runtime.state.type === 'helm' ? 0.76 : 0.86;
      if (this.closest.distanceToSquared(this.localCenter) > radius * radius) {
        this.raft.localPointToWorld(this.localCenter, this.worldCenter);
        this.projectedCenter.copy(this.worldCenter).project(this.camera);
        const screenRadiusX = runtime.state.type === 'receiver' ? 0.24 : 0.18;
        const screenRadiusY = runtime.state.type === 'receiver' ? 0.3 : 0.24;
        if (Math.abs(this.projectedCenter.x) > screenRadiusX || Math.abs(this.projectedCenter.y) > screenRadiusY) continue;
      }
      best = runtime;
      bestAlong = along;
    }
    this.focused = best;
    if (!best) {
      this.clearPrompt();
      return;
    }
    best.visuals.highlight.visible = true;
    this.setPrompt(this.interactionLabel(best));
  }

  private interactionLabel(runtime: NavigationRuntime): string {
    if (runtime.state.type === 'sail') {
      if (!runtime.state.reinforced && itemCount(useGameStore.getState().inventory, 'stormRigKit') > 0) {
        return '为拾风帆加装横风抗扭索具';
      }
      return runtime.state.deployed
        ? `收起拾风帆 · 航向${cardinalLabel(this.state.courseAngle)}`
        : `展开拾风帆 · 航向${cardinalLabel(this.state.courseAngle)}`;
    }
    if (runtime.state.type === 'receiver') {
      const telemetry = signalTelemetry(this.currentState());
      if (telemetry.arrayStatus !== 'ready') return this.arrayStatusMessage(telemetry.arrayStatus);
      const charge = Math.round(this.state.receiverCharge / RECEIVER_CELL_SECONDS * 100);
      if (this.state.receiverCharge <= 0) {
        return itemCount(useGameStore.getState().inventory, 'brineCell') > 0
          ? '装入盐差电池并启动接收台'
          : '潮听接收台需要盐差电池';
      }
      return this.state.receiverOn ? `关闭潮听接收台 · 电量${charge}%` : `启动潮听接收台 · 电量${charge}%`;
    }
    if (runtime.state.type === 'antenna') {
      const status = signalArrayStatus(this.currentState());
      if (status !== 'ready') return this.arrayStatusMessage(status);
      const receiver = this.runtimes.get('receiver')!;
      const distance = Math.hypot(receiver.state.x - runtime.state.x, receiver.state.z - runtime.state.z);
      return `${this.state.receiverOn ? '阵列锁定' : '阵列待机'} · 间隔${distance.toFixed(1)}格`;
    }
    if (runtime.state.type === 'helm') return `切换航线 · ${ROUTE_LABELS[this.state.routeMode]}`;
    if (!runtime.state.reinforced && itemCount(useGameStore.getState().inventory, 'anchorBraceKit') > 0) {
      return '为潮石锚加装深锚锁链棘轮';
    }
    if (runtime.state.deployed) return '起锚恢复航行';
    return this.island.getEncounterState().phase === 'docked' ? '抛下潮石锚' : '海床太深，无法锚泊';
  }

  private interact(): void {
    const runtime = this.focused;
    if (!runtime) return;
    const store = useGameStore.getState();
    if (runtime.state.type === 'receiver') {
      const status = signalArrayStatus(this.currentState());
      if (status !== 'ready') {
        this.audio.playArrayDiagnostic(false);
        this.audio.playDenied();
        this.showNotice(this.arrayStatusMessage(status));
        return;
      }
      let next = this.currentState();
      let loadedCell = false;
      if (next.receiverCharge <= 0) {
        if (!store.spendItems({ brineCell: 1 })) {
          this.audio.playDenied();
          this.showNotice('背包中没有盐差电池');
          return;
        }
        next = installReceiverCell(next);
        loadedCell = true;
        this.audio.playReceiverCell();
      }
      next = toggleReceiverPower(next);
      this.state = next;
      this.applyAdvancedDevices(next.devices);
      this.audio.playReceiverPower(next.receiverOn);
      this.audio.playArrayDiagnostic(next.receiverOn);
      const signal = SIGNAL_TARGETS[next.activeSignal];
      this.showNotice(next.receiverOn
        ? `${loadedCell ? '盐差电池接通 · ' : ''}锁定 ${signal.frequency} · ${signal.name}`
        : '潮听接收台已关闭');
      this.metrics = this.calculateMetrics();
      this.publishFeedback();
      this.setPrompt(this.interactionLabel(runtime));
      return;
    }
    if (runtime.state.type === 'antenna') {
      const ready = signalArrayStatus(this.currentState()) === 'ready';
      this.audio.playArrayDiagnostic(ready);
      this.showNotice(ready ? '双桅相位差稳定，定向阵列可以工作' : this.arrayStatusMessage(signalArrayStatus(this.currentState())));
      return;
    }
    if (runtime.state.type === 'sail' && !runtime.state.reinforced && itemCount(useGameStore.getState().inventory, 'stormRigKit') > 0) {
      if (!store.spendItems({ stormRigKit: 1 })) {
        this.audio.playDenied();
        return;
      }
      const reinforced = reinforceNavigationSail(this.currentState());
      this.state = reinforced;
      this.applyAdvancedDevices(reinforced.devices);
      this.audio.playSailReinforce();
      this.showNotice('抗风横撑与双股受力索已锁紧');
      this.metrics = this.calculateMetrics();
      this.publishFeedback();
      this.setPrompt(this.interactionLabel(runtime));
      return;
    }
    if (runtime.state.type === 'helm') {
      const signalAvailable = signalTelemetry(this.currentState()).online;
      this.state = { ...this.state, routeMode: cycleNavigationRoute(this.state.routeMode, signalAvailable) };
      this.metrics = this.calculateMetrics();
      this.audio.playHelmRoute();
      this.publishFeedback();
      this.showNotice(`航线切换为${ROUTE_LABELS[this.state.routeMode]}`);
      this.setPrompt(this.interactionLabel(runtime));
      return;
    }
    if (runtime.state.type === 'anchor' && !runtime.state.reinforced && itemCount(store.inventory, 'anchorBraceKit') > 0) {
      if (!store.spendItems({ anchorBraceKit: 1 })) {
        this.audio.playDenied();
        return;
      }
      const reinforced = reinforceNavigationAnchor(this.currentState());
      this.state = reinforced;
      this.applyAdvancedDevices(reinforced.devices);
      this.audio.playAnchorReinforce();
      this.showNotice('防回滑棘轮与短节锁链已经锁紧锚机');
      this.metrics = this.calculateMetrics();
      this.publishFeedback();
      this.setPrompt(this.interactionLabel(runtime));
      return;
    }
    if (runtime.state.type === 'anchor' && !runtime.state.deployed && this.island.getEncounterState().phase !== 'docked') {
      this.audio.playDenied();
      this.showNotice('靠近浅滩后才能抓牢海床');
      return;
    }
    runtime.state.deployed = !runtime.state.deployed;
    if (runtime.state.type === 'sail') {
      this.audio.playSailToggle(runtime.state.deployed);
      this.showNotice(runtime.state.deployed ? '拾风帆已经展开' : '拾风帆已经收紧');
    } else {
      if (runtime.state.deployed) this.state = { ...this.state, anchorStrain: Math.min(this.state.anchorStrain, 0.55) };
      this.audio.playAnchor(runtime.state.deployed);
      this.showNotice(runtime.state.deployed ? '潮石锚已经抓牢' : '潮石锚已经回收');
    }
    this.syncStateDevices();
    this.metrics = this.calculateMetrics();
    this.publishFeedback();
    this.setPrompt(this.interactionLabel(runtime));
  }

  private adjustCourse(reverse: boolean): void {
    const sail = this.runtimes.get('sail');
    const helm = this.runtimes.get('helm');
    if ((!sail || this.focused !== sail) && (!helm || this.focused !== helm)) return;
    this.state = {
      ...this.state,
      routeMode: 'manual',
      courseAngle: normalizeAngle(this.state.courseAngle + COURSE_STEP * (reverse ? -1 : 1)),
    };
    this.audio.playSailTrim();
    this.metrics = this.calculateMetrics();
    this.publishFeedback();
    this.setPrompt(this.interactionLabel(this.focused!));
    this.showNotice(`航向调整至${cardinalLabel(this.state.courseAngle)}`);
  }

  private adjustSignal(reverse: boolean): void {
    const receiver = this.runtimes.get('receiver');
    if (!receiver || this.focused !== receiver || !this.state.receiverOn) return;
    const before = this.state.activeSignal;
    this.state = cycleSignalTarget(this.currentState(), reverse);
    if (this.state.activeSignal === before) {
      this.audio.playDenied();
      this.showNotice('当前只发现一个可追踪信号');
      return;
    }
    if (this.state.routeMode === 'signal') this.state = { ...this.state, courseAngle: this.targetBearing(this.state) };
    this.audio.playReceiverTune();
    const target = SIGNAL_TARGETS[this.state.activeSignal];
    this.showNotice(`调谐 ${target.frequency} · ${target.name}`);
    this.metrics = this.calculateMetrics();
    this.publishFeedback();
    this.setPrompt(this.interactionLabel(receiver));
  }

  private placeDevice(): void {
    const type = this.placementType;
    const coordinate = this.placementCoordinate;
    if (!type || !coordinate || !this.placementValid) {
      this.audio.playDenied();
      return;
    }
    const kit = NAVIGATION_DEVICE_DEFINITIONS[type].kitItem;
    const store = useGameStore.getState();
    if (!store.spendItems({ [kit]: 1 })) {
      this.audio.playDenied();
      this.showNotice(`${ITEM_DEFINITIONS[kit].shortName} 已不在背包中`);
      store.setPlacementDevice(null);
      return;
    }
    this.serial += 1;
    const state = createNavigationDevice(
      type,
      coordinate.x,
      coordinate.z,
      this.placementRotation,
      `${type}-${Date.now().toString(36)}-${this.serial.toString(36)}`,
    );
    this.addRuntime(state);
    this.syncStateDevices();
    this.raft.gridToLocal(coordinate, this.worldHit);
    this.raft.localPointToWorld(this.worldHit, this.worldHit);
    this.splashes.spawnImpact(
      this.worldHit,
      type === 'sail' ? 0xd9cda8 : type === 'helm' ? 0x78aaa1 : type === 'receiver' || type === 'antenna' ? 0x72d4b3 : 0x8f5742,
      24,
    );
    this.audio.playDevicePlace();
    this.showNotice(`${NAVIGATION_DEVICE_DEFINITIONS[type].name}已固定`);
    store.setPlacementDevice(null);
    this.publishFeedback();
  }

  private removeOrphanedDevices(): void {
    for (const runtime of [...this.runtimes.values()]) {
      if (this.raft.hasTile(runtime.state)) continue;
      this.removeRuntime(runtime);
      this.audio.playDeviceLost();
      this.showNotice(`${NAVIGATION_DEVICE_DEFINITIONS[runtime.state.type].name}随筏格损毁`);
    }
    this.syncStateDevices();
    this.publishFeedback();
  }

  private syncStateDevices(): void {
    this.state = { ...this.state, devices: [...this.runtimes.values()].map(({ state }) => ({ ...state })) };
  }

  private publishFeedback(): void {
    const encounter = this.island.getEncounterState();
    const playerAway = this.player.getSurface() !== 'raft';
    const driftRisk = encounter.phase === 'docked' && !this.metrics.anchored && playerAway;
    const sail = this.runtimes.get('sail');
    const anchor = this.runtimes.get('anchor');
    const helm = this.runtimes.get('helm');
    const receiver = this.runtimes.get('receiver');
    const antenna = this.runtimes.get('antenna');
    const signal = signalTelemetry(this.currentState());
    useGameStore.getState().setNavigation({
      windAngle: this.metrics.windAngle,
      courseAngle: this.metrics.effectiveCourse,
      heading: this.state.heading,
      windCapture: this.metrics.windCapture,
      courseAlignment: this.metrics.courseAlignment,
      speedKnots: this.metrics.speedKnots,
      sailInstalled: Boolean(sail),
      sailDeployed: sail?.state.deployed ?? false,
      anchorInstalled: Boolean(anchor),
      anchored: anchor?.state.deployed ?? false,
      helmInstalled: Boolean(helm),
      sailReinforced: sail?.state.reinforced ?? false,
      anchorReinforced: anchor?.state.reinforced ?? false,
      sailStrain: this.metrics.sailStrain,
      anchorStrain: this.metrics.anchorStrain,
      routeMode: this.metrics.routeMode,
      weatherPhase: this.metrics.weatherPhase,
      stormIntensity: this.metrics.stormIntensity,
      gust: this.metrics.gust,
      driftRisk,
      receiverInstalled: Boolean(receiver),
      antennaInstalled: Boolean(antenna),
      signalArrayStatus: signal.arrayStatus,
      receiverOn: this.state.receiverOn,
      receiverCharge: this.state.receiverCharge,
      activeSignalName: signal.targetName,
      activeSignalFrequency: signal.frequency,
      signalDistance: signal.distance,
      signalBearing: signal.bearing,
      discoveredSignals: signal.discovered,
      visitedSignals: signal.visited,
      worldX: this.state.worldX,
      worldZ: this.state.worldZ,
    });
  }

  private arrayPlacementStatus(type: NavigationDeviceType, coordinate: GridCoordinate): 'ready' | 'too-close' | 'too-far' {
    if (type !== 'receiver' && type !== 'antenna') return 'ready';
    const counterpart = this.runtimes.get(type === 'receiver' ? 'antenna' : 'receiver');
    if (!counterpart) return 'ready';
    const distance = Math.hypot(counterpart.state.x - coordinate.x, counterpart.state.z - coordinate.z);
    if (distance < SIGNAL_ARRAY_MIN_TILES) return 'too-close';
    if (distance > SIGNAL_ARRAY_MAX_TILES) return 'too-far';
    return 'ready';
  }

  private arrayStatusMessage(status: SignalArrayStatus): string {
    if (status === 'missing-receiver') return '阵列没有连接潮听接收台';
    if (status === 'missing-antenna') return '接收台没有连接双桅定向阵列';
    if (status === 'too-close') return `相位串扰：两台设备至少间隔${SIGNAL_ARRAY_MIN_TILES}格`;
    if (status === 'too-far') return `馈线损耗：两台设备最多间隔${SIGNAL_ARRAY_MAX_TILES}格`;
    return '信号阵列已经校准';
  }

  private isEdgeTile(coordinate: GridCoordinate): boolean {
    return this.raft.getEdgeTiles().some((tile) => tile.x === coordinate.x && tile.z === coordinate.z);
  }

  private anchorOutwardRotation(coordinate: GridCoordinate): number {
    const openings = [
      { x: 0, z: 1, rotation: 0 },
      { x: 1, z: 0, rotation: Math.PI / 2 },
      { x: 0, z: -1, rotation: Math.PI },
      { x: -1, z: 0, rotation: Math.PI * 1.5 },
    ].filter((direction) =>
      !this.raft.hasTile({ x: coordinate.x + direction.x, z: coordinate.z + direction.z }),
    );
    if (openings.length === 0) return this.placementRotation;
    return openings.reduce((best, direction) => {
      const score = direction.x * this.localDirection.x + direction.z * this.localDirection.z;
      const bestScore = best.x * this.localDirection.x + best.z * this.localDirection.z;
      return score > bestScore ? direction : best;
    }).rotation;
  }

  private setPrompt(prompt: string): void {
    this.lastPrompt = prompt;
    useGameStore.getState().setInteraction(prompt, 'navigation');
  }

  private clearPrompt(): void {
    const store = useGameStore.getState();
    if (this.lastPrompt && store.interaction === this.lastPrompt) store.setInteraction(null, 'navigation');
    this.lastPrompt = null;
  }

  private showNotice(message: string): void {
    useGameStore.getState().showNotice(message);
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => {
      if (useGameStore.getState().notice === message) useGameStore.getState().showNotice(null);
    }, 1700);
  }

  private disposeGroup(group: Group): void {
    group.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (
          !this.isSharedMaterial(material) &&
          material !== this.previewMaterials.sail &&
          material !== this.previewMaterials.anchor &&
          material !== this.previewMaterials.helm &&
          material !== this.previewMaterials.receiver &&
          material !== this.previewMaterials.antenna
        ) {
          material.dispose();
        }
      });
    });
  }

  private isSharedMaterial(material: Material): boolean {
    return (
      this.materials.wood.some((candidate) => candidate === material) ||
      Object.values(this.materials).some((candidate) => candidate === material)
    );
  }

  private readonly onPointerDown = (event: MouseEvent): void => {
    if (event.button !== 0 || !this.inputEnabled || !this.placementType) return;
    this.placeDevice();
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    if (this.placementType && this.inputEnabled) event.preventDefault();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat || !this.inputEnabled || this.placementType) return;
    if (event.code === 'KeyE' && this.focused && useGameStore.getState().interactionOwner === 'navigation') {
      this.interact();
      return;
    }
    if (event.code === 'KeyR' && this.focused?.state.type === 'receiver') {
      this.adjustSignal(event.shiftKey);
      return;
    }
    if (event.code === 'KeyR' && (this.focused?.state.type === 'sail' || this.focused?.state.type === 'helm')) {
      this.adjustCourse(event.shiftKey);
    }
  };
}
