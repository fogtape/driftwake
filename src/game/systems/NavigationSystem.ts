import {
  Color,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Quaternion,
  Ray,
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
import type { MaterialLibrary } from '../art/Materials';
import {
  COURSE_STEP,
  NAVIGATION_DEVICE_DEFINITIONS,
  advanceNavigationState,
  bearingTo,
  cardinalLabel,
  createNavigationDevice,
  cycleNavigationRoute,
  navigationMetrics,
  normalizeAngle,
  reinforceNavigationSail,
  shortestAngle,
  type NavigationRouteMode,
  type NavigationDeviceType,
  type NavigationMetrics,
  type SavedNavigationDevice,
  type SavedNavigationState,
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
  visuals: NavigationModelVisuals;
  deployVisual: number;
}

const VALID_COLOR = new Color(0x72d4b3);
const INVALID_COLOR = new Color(0xe26f55);

const ROUTE_LABELS: Record<NavigationRouteMode, string> = {
  manual: '自由航向',
  island: '追踪浅滩',
  shelter: '顺风避险',
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
  private serial = 0;

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly camera: PerspectiveCamera,
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
    };
    this.previews = {
      sail: this.createPreview('sail'),
      anchor: this.createPreview('anchor'),
      helm: this.createPreview('helm'),
    };
    this.raft.group.add(this.previews.sail, this.previews.anchor, this.previews.helm);
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
    this.clearPrompt();
  }

  setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
    if (enabled) return;
    this.focused = null;
    this.previews.sail.visible = false;
    this.previews.anchor.visible = false;
    this.previews.helm.visible = false;
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
      const advanced = advanceNavigationState(current, delta, this.targetBearing());
      const sailIsDeployed = advanced.devices.some((device) => device.type === 'sail' && device.deployed);
      this.state = advanced;
      this.applyAdvancedDevices(advanced.devices);
      if (sailWasDeployed && !sailIsDeployed && advanced.sailStrain >= 0.7) {
        this.audio.playSailOverload();
        this.showNotice('阵风载荷过高，拾风帆已自动泄压收紧');
      }
    }
    this.metrics = this.calculateMetrics();
    this.raft.setHeading(this.state.heading);
    this.runtimes.forEach((runtime) => this.updateRuntime(runtime, time, delta));
    this.audio.setSailActivity(this.metrics.sailDeployed ? this.metrics.windCapture : 0);

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
      const radius = runtime.state.type === 'sail' ? 0.38 : runtime.state.type === 'helm' ? 0.54 : 0.48;
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
    for (const runtime of [...this.runtimes.values()]) this.removeRuntime(runtime);
    this.raft.group.remove(this.previews.sail, this.previews.anchor, this.previews.helm);
    this.disposeGroup(this.previews.sail);
    this.disposeGroup(this.previews.anchor);
    this.disposeGroup(this.previews.helm);
    this.previewMaterials.sail.dispose();
    this.previewMaterials.anchor.dispose();
    this.previewMaterials.helm.dispose();
  }

  private currentState(): SavedNavigationState {
    return { ...this.state, devices: [...this.runtimes.values()].map(({ state }) => ({ ...state })) };
  }

  private calculateMetrics(): NavigationMetrics {
    const encounter = this.island.getEncounterState();
    return navigationMetrics(this.currentState(), bearingTo(encounter.x, encounter.z));
  }

  private targetBearing(): number {
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
    return createHelmModel(this.materials);
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
      visuals: model.userData.navigationVisuals as NavigationModelVisuals,
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
    } else {
      this.updateHelmVisuals(runtime.visuals, time, delta);
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
    const activeRoute = this.metrics.routeMode === 'manual' ? 0 : this.metrics.routeMode === 'island' ? 1 : 2;
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
    this.placementValid =
      typeAvailable && onTile && edgeRequired && !this.hasExternalOccupant(coordinate) && !this.hasDeviceAt(coordinate) && clearOfPlayer;
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
        runtime.state.type === 'sail' ? 1.52 : runtime.state.type === 'helm' ? 0.88 : 0.82,
        runtime.state.z * RAFT_TILE_Z,
      );
      this.toCenter.copy(this.localCenter).sub(this.localOrigin);
      const along = this.toCenter.dot(this.localDirection);
      if (along <= 0 || along > 3.7 || along >= bestAlong) continue;
      this.closest.copy(this.localDirection).multiplyScalar(along).add(this.localOrigin);
      const radius = runtime.state.type === 'sail' ? 0.7 : runtime.state.type === 'helm' ? 0.76 : 0.86;
      if (this.closest.distanceToSquared(this.localCenter) > radius * radius) continue;
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
    if (runtime.state.type === 'helm') return `切换航线 · ${ROUTE_LABELS[this.state.routeMode]}`;
    if (runtime.state.deployed) return '起锚恢复航行';
    return this.island.getEncounterState().phase === 'docked' ? '抛下潮石锚' : '海床太深，无法锚泊';
  }

  private interact(): void {
    const runtime = this.focused;
    if (!runtime) return;
    if (runtime.state.type === 'sail' && !runtime.state.reinforced && itemCount(useGameStore.getState().inventory, 'stormRigKit') > 0) {
      const store = useGameStore.getState();
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
      this.state = { ...this.state, routeMode: cycleNavigationRoute(this.state.routeMode) };
      this.metrics = this.calculateMetrics();
      this.audio.playHelmRoute();
      this.publishFeedback();
      this.showNotice(`航线切换为${ROUTE_LABELS[this.state.routeMode]}`);
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
    this.splashes.spawnImpact(this.worldHit, type === 'sail' ? 0xd9cda8 : type === 'helm' ? 0x78aaa1 : 0x8f5742, 24);
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
      sailStrain: this.metrics.sailStrain,
      routeMode: this.metrics.routeMode,
      weatherPhase: this.metrics.weatherPhase,
      stormIntensity: this.metrics.stormIntensity,
      gust: this.metrics.gust,
      driftRisk,
    });
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
          material !== this.previewMaterials.helm
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
    if (event.code === 'KeyR' && (this.focused?.state.type === 'sail' || this.focused?.state.type === 'helm')) {
      this.adjustCourse(event.shiftKey);
    }
  };
}
