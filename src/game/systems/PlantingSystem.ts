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
  createPlanterModel,
  createSaltwingBirdModel,
  type BirdModelVisuals,
  type PlanterModelVisuals,
} from '../art/PlantingModels';
import type { MaterialLibrary } from '../art/Materials';
import {
  MAX_PLANTERS,
  PLANTER_DEFINITION,
  PLANT_DRY_GRACE_SECONDS,
  advancePlanter,
  applyBirdDamage,
  createPlanterState,
  nextBirdVisitSeconds,
  planterHarvest,
  planterProgress,
  resetPlanter,
  sowPlanter,
  waterPlanter,
  type SavedPlanterState,
  type SavedPlantingState,
  type CropBirdPhase,
} from '../domain/planting';
import {
  INVENTORY_SLOT_CAPACITY,
  ITEM_DEFINITIONS,
  addItems,
  bundleLabel,
  itemCount,
} from '../domain/items';
import { useGameStore, type PlantingFeedback } from '../../state/gameStore';
import type { AudioSystem } from './AudioSystem';
import type { PlayerController } from './PlayerController';
import { RAFT_TILE_X, RAFT_TILE_Z, type GridCoordinate, type RaftSystem } from './RaftSystem';
import type { SplashSystem } from './SplashSystem';

interface PlanterRuntime {
  state: SavedPlanterState;
  model: Group;
  visuals: PlanterModelVisuals;
  growthVisual: number;
}

const VALID_COLOR = new Color(0x72d4b3);
const INVALID_COLOR = new Color(0xe26f55);

function sameCoordinate(a: GridCoordinate | null, b: GridCoordinate | null): boolean {
  return Boolean(a && b && a.x === b.x && a.z === b.z);
}

export class PlantingSystem {
  private readonly planters = new Map<string, PlanterRuntime>();
  private readonly previewMaterial = new MeshStandardMaterial({
    color: 0x72d4b3,
    roughness: 0.72,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  private readonly preview: Group;
  private readonly bird: Group;
  private readonly birdVisuals: BirdModelVisuals;
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
  private readonly birdPhaseStart = new Vector3();
  private readonly birdTargetPoint = new Vector3();
  private readonly birdPrevious = new Vector3();
  private readonly eligiblePlanters: PlanterRuntime[] = [];
  private state: SavedPlantingState;
  private placementActive = false;
  private placementCoordinate: GridCoordinate | null = null;
  private placementRotation = 0;
  private placementValid = false;
  private focused: PlanterRuntime | null = null;
  private birdFocused = false;
  private inputEnabled = false;
  private lastPrompt: string | null = null;
  private lastRaftRevision = -1;
  private feedbackElapsed = 0;
  private noticeTimer: number | null = null;
  private serial = 0;
  private birdPhase: CropBirdPhase = 'absent';
  private birdPhaseElapsed = 0;
  private birdTargetId: string | null = null;
  private lastPeckIndex = -1;

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly camera: PerspectiveCamera,
    private readonly materials: MaterialLibrary,
    private readonly raft: RaftSystem,
    private readonly player: PlayerController,
    private readonly audio: AudioSystem,
    private readonly splashes: SplashSystem,
    savedState: SavedPlantingState,
    private readonly hasExternalOccupant: (coordinate: GridCoordinate) => boolean = () => false,
  ) {
    this.state = {
      planters: savedState.planters.map((planter) => ({ ...planter })),
      birdClock: savedState.birdClock,
      birdVisit: savedState.birdVisit,
      birdPhase: savedState.birdPhase,
      birdElapsed: savedState.birdElapsed,
      birdTargetId: savedState.birdTargetId,
    };
    this.preview = this.createPreview();
    this.bird = createSaltwingBirdModel(this.materials);
    this.birdVisuals = this.bird.userData.birdVisuals as BirdModelVisuals;
    this.bird.visible = false;
    this.raft.group.add(this.preview, this.bird);
    for (const planter of this.state.planters) this.addRuntime({ ...planter });
    this.restoreBirdState();
    this.lastRaftRevision = this.raft.currentRevision;
    this.publishFeedback();

    this.renderer.domElement.addEventListener('mousedown', this.onPointerDown);
    this.renderer.domElement.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('keydown', this.onKeyDown);
  }

  setPlacementType(type: 'planter' | null): void {
    const active = type === 'planter';
    if (this.placementActive === active) return;
    this.placementActive = active;
    this.placementCoordinate = null;
    this.placementValid = false;
    this.preview.visible = false;
    this.clearPrompt();
  }

  setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
    if (enabled) return;
    this.preview.visible = false;
    this.focused = null;
    this.birdFocused = false;
    for (const runtime of this.planters.values()) runtime.visuals.highlight.visible = false;
    this.clearPrompt();
  }

  update(time: number, delta: number): void {
    if (this.raft.currentRevision !== this.lastRaftRevision) {
      this.lastRaftRevision = this.raft.currentRevision;
      this.removeOrphanedPlanters();
    }

    for (const runtime of this.planters.values()) {
      if (delta > 0) {
        const result = advancePlanter(runtime.state, delta);
        runtime.state = result.planter;
        if (result.event === 'dry') {
          this.showNotice('潮生作物盆已经缺水');
        } else if (result.event === 'mature') {
          this.audio.playPlantReady();
          this.showNotice('盐冠潮果已经成熟');
        } else if (result.event === 'withered') {
          this.audio.playPlantWither();
          this.showNotice('一株盐冠作物因缺水枯萎');
        }
      }
      this.updatePlanterVisuals(runtime, time, delta);
    }
    this.updateBird(time, delta);

    this.feedbackElapsed -= delta;
    if (this.feedbackElapsed <= 0) {
      this.feedbackElapsed = 0.16;
      this.publishFeedback();
    }

    if (!this.inputEnabled) return;
    if (this.placementActive) this.updatePlacementPreview();
    else this.updateFocus();
  }

  getSavedState(): SavedPlantingState {
    return {
      planters: [...this.planters.values()].map(({ state }) => ({
        ...state,
        growth: Number(state.growth.toFixed(4)),
        water: Number(state.water.toFixed(4)),
        drySeconds: Number(state.drySeconds.toFixed(3)),
        birdDamage: Number(state.birdDamage.toFixed(3)),
      })),
      birdClock: Number(this.state.birdClock.toFixed(3)),
      birdVisit: this.state.birdVisit,
      birdPhase: this.birdPhase,
      birdElapsed: Number(this.birdPhaseElapsed.toFixed(3)),
      birdTargetId: this.birdTargetId,
    };
  }

  hasDeviceAt(coordinate: GridCoordinate): boolean {
    for (const { state } of this.planters.values()) {
      if (state.x === coordinate.x && state.z === coordinate.z) return true;
    }
    return false;
  }

  dismantleAt(coordinate: GridCoordinate): boolean {
    let runtime: PlanterRuntime | null = null;
    for (const candidate of this.planters.values()) {
      if (candidate.state.x !== coordinate.x || candidate.state.z !== coordinate.z) continue;
      runtime = candidate;
      break;
    }
    if (!runtime) return false;
    const accepted = useGameStore.getState().addItemBundle({ planterKit: 1 });
    if (itemCount(accepted, 'planterKit') < 1) {
      this.audio.playDenied();
      this.showNotice('背包没有空间收回作物盆');
      return false;
    }
    const interrupted = runtime.state.phase !== 'empty';
    this.removeRuntime(runtime);
    if (this.birdTargetId === runtime.state.id) this.beginBirdFlee();
    this.publishFeedback();
    this.showNotice(interrupted ? '作物盆已拆解，盆中作物损失' : '作物盆套件已收回');
    return true;
  }

  resolvePlayerCollision(position: Vector3, previous: Vector3): void {
    for (const runtime of this.planters.values()) {
      const centerX = runtime.state.x * RAFT_TILE_X;
      const centerZ = runtime.state.z * RAFT_TILE_Z;
      if (Math.hypot(position.x - centerX, position.z - centerZ) >= 0.67) continue;
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
    for (const runtime of [...this.planters.values()]) this.removeRuntime(runtime);
    this.raft.group.remove(this.preview, this.bird);
    this.previewMaterial.dispose();
  }

  private createPreview(): Group {
    const preview = createPlanterModel(this.materials);
    preview.name = 'planter-placement-preview';
    preview.visible = false;
    preview.renderOrder = 3;
    const visuals = preview.userData.planterVisuals as PlanterModelVisuals;
    visuals.crop.visible = false;
    visuals.seedMarker.visible = false;
    visuals.moisture.visible = false;
    visuals.highlight.visible = false;
    preview.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
      sourceMaterials.forEach((material) => {
        if (!this.isSharedMaterial(material) && material !== this.previewMaterial) material.dispose();
      });
      object.material = this.previewMaterial;
      object.castShadow = false;
      object.receiveShadow = false;
    });
    return preview;
  }

  private addRuntime(state: SavedPlanterState): PlanterRuntime {
    const model = createPlanterModel(this.materials);
    model.position.set(state.x * RAFT_TILE_X, 0.09, state.z * RAFT_TILE_Z);
    model.rotation.y = state.rotation;
    const runtime: PlanterRuntime = {
      state,
      model,
      visuals: model.userData.planterVisuals as PlanterModelVisuals,
      growthVisual: state.growth,
    };
    this.planters.set(state.id, runtime);
    this.raft.group.add(model);
    this.updatePlanterVisuals(runtime, 0, 0);
    return runtime;
  }

  private removeRuntime(runtime: PlanterRuntime): void {
    this.raft.group.remove(runtime.model);
    this.planters.delete(runtime.state.id);
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

  private updatePlacementPreview(): void {
    this.camera.getWorldDirection(this.forward);
    this.inverseRaftRotation.copy(this.raft.group.quaternion).invert();
    this.localOrigin.copy(this.camera.position).sub(this.raft.group.position).applyQuaternion(this.inverseRaftRotation);
    this.localDirection.copy(this.forward).applyQuaternion(this.inverseRaftRotation).normalize();
    this.ray.set(this.localOrigin, this.localDirection);
    if (Math.abs(this.ray.direction.y) < 0.02) {
      this.preview.visible = false;
      this.setPrompt('将视线移向木筏表面');
      return;
    }
    const distance = (0.1 - this.ray.origin.y) / this.ray.direction.y;
    if (distance <= 0 || distance > 6.2) {
      this.preview.visible = false;
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
      !this.player.isOnRaft() || Math.hypot(this.player.localPosition.x - centerX, this.player.localPosition.z - centerZ) > 0.82;
    const belowLimit = this.planters.size < MAX_PLANTERS;
    this.placementValid =
      belowLimit &&
      this.raft.hasTile(coordinate) &&
      !this.hasDeviceAt(coordinate) &&
      !this.hasExternalOccupant(coordinate) &&
      clearOfPlayer;
    this.placementRotation = Math.round(Math.atan2(-this.localDirection.x, -this.localDirection.z) / (Math.PI / 2)) * (Math.PI / 2);
    this.preview.visible = true;
    this.preview.position.set(centerX, 0.09, centerZ);
    this.preview.rotation.y = this.placementRotation;
    this.previewMaterial.color.copy(this.placementValid ? VALID_COLOR : INVALID_COLOR);
    this.previewMaterial.opacity = this.placementValid ? 0.5 : 0.31;
    if (!changed) return;
    if (this.placementValid) this.setPrompt(`安置${PLANTER_DEFINITION.name}`);
    else if (!belowLimit) this.setPrompt('作物盆数量已达上限');
    else if (!this.raft.hasTile(coordinate)) this.setPrompt('作物盆必须固定在完整筏格上');
    else if (this.hasDeviceAt(coordinate) || this.hasExternalOccupant(coordinate)) this.setPrompt('这个筏格已有设备');
    else this.setPrompt('离开当前筏格后再安置');
  }

  private placePlanter(): void {
    if (!this.placementCoordinate || !this.placementValid) {
      this.audio.playDenied();
      return;
    }
    const store = useGameStore.getState();
    if (!store.spendItems({ planterKit: 1 })) {
      this.audio.playDenied();
      this.showNotice('作物盆套件已不在背包中');
      store.setPlacementDevice(null);
      return;
    }
    this.serial += 1;
    const planter = createPlanterState(
      this.placementCoordinate.x,
      this.placementCoordinate.z,
      this.placementRotation,
      `planter-${Date.now().toString(36)}-${this.serial.toString(36)}`,
    );
    this.addRuntime(planter);
    this.raft.gridToLocal(this.placementCoordinate, this.worldHit);
    this.raft.localPointToWorld(this.worldHit, this.worldHit);
    this.splashes.spawnImpact(this.worldHit, 0x79a568, 22);
    this.audio.playDevicePlace();
    this.showNotice('潮生作物盆已固定');
    store.setPlacementDevice(null);
    this.publishFeedback();
  }

  private updateFocus(): void {
    const store = useGameStore.getState();
    const fishingBusy = store.selectedTool === 'fishingRod' && store.fishing.phase !== 'idle';
    for (const runtime of this.planters.values()) runtime.visuals.highlight.visible = false;
    if (store.selectedTool === 'hammer' || fishingBusy) {
      this.focused = null;
      this.birdFocused = false;
      this.clearPrompt();
      return;
    }

    this.camera.getWorldDirection(this.forward);
    this.inverseRaftRotation.copy(this.raft.group.quaternion).invert();
    this.localOrigin.copy(this.camera.position).sub(this.raft.group.position).applyQuaternion(this.inverseRaftRotation);
    this.localDirection.copy(this.forward).applyQuaternion(this.inverseRaftRotation).normalize();
    let best: PlanterRuntime | null = null;
    let bestAlong = Number.POSITIVE_INFINITY;
    this.birdFocused = false;

    if (this.bird.visible && this.birdPhase !== 'fleeing') {
      this.localCenter.copy(this.bird.position);
      this.toCenter.copy(this.localCenter).sub(this.localOrigin);
      const along = this.toCenter.dot(this.localDirection);
      if (along > 0 && along < 5.2) {
        this.closest.copy(this.localDirection).multiplyScalar(along).add(this.localOrigin);
        if (this.closest.distanceToSquared(this.localCenter) < 0.48 * 0.48) {
          this.birdFocused = true;
          bestAlong = along;
        }
      }
    }

    for (const runtime of this.planters.values()) {
      this.localCenter.set(runtime.state.x * RAFT_TILE_X, 0.66, runtime.state.z * RAFT_TILE_Z);
      this.toCenter.copy(this.localCenter).sub(this.localOrigin);
      const along = this.toCenter.dot(this.localDirection);
      this.closest.copy(this.localDirection).multiplyScalar(along).add(this.localOrigin);
      const distanceSquared = this.closest.distanceToSquared(this.localCenter);
      if (along <= 0 || along > 3.6 || along >= bestAlong) continue;
      if (distanceSquared > 0.86 * 0.86) continue;
      best = runtime;
      this.birdFocused = false;
      bestAlong = along;
    }
    this.focused = best;
    if (best) best.visuals.highlight.visible = true;

    if (this.birdFocused) {
      this.setPrompt('驱赶盐翼盗鸟');
      return;
    }
    if (!best) {
      this.clearPrompt();
      return;
    }
    this.setPrompt(this.interactionLabel(best));
  }

  private interactionLabel(runtime: PlanterRuntime): string {
    const { state } = runtime;
    const birdThreatening = this.birdTargetId === state.id && (this.birdPhase === 'diving' || this.birdPhase === 'feeding');
    if (birdThreatening) return '驱赶盐翼盗鸟';
    const inventory = useGameStore.getState().inventory;
    if (state.phase === 'empty') {
      return itemCount(inventory, 'palmSeed') > 0 ? '埋入盐冠棕榈种' : '需要 棕榈种';
    }
    if (state.phase === 'sown') {
      return itemCount(inventory, 'freshWaterCup') > 0 ? '浇入一杯蒸馏淡水' : '需要 淡水杯';
    }
    if (state.phase === 'growing') {
      const progress = Math.round(state.growth * 100);
      const water = Math.round(state.water * 100);
      if (state.water < 0.38 && itemCount(inventory, 'freshWaterCup') > 0) return `补充淡水 · 生长 ${progress}%`;
      return `生长 ${progress}% · 水分 ${water}%`;
    }
    if (state.phase === 'dry') {
      const remaining = Math.max(0, Math.ceil(PLANT_DRY_GRACE_SECONDS - state.drySeconds));
      return itemCount(inventory, 'freshWaterCup') > 0
        ? `作物缺水 · ${remaining} 秒内浇水`
        : `缺少淡水杯 · ${remaining} 秒后枯萎`;
    }
    if (state.phase === 'mature') {
      const output = planterHarvest(state);
      return `收获 ${itemCount(output, 'palmFruit')} 枚盐冠潮果`;
    }
    return '清理枯萎作物';
  }

  private interact(): void {
    const runtime = this.focused;
    if (this.birdFocused || (runtime && this.birdTargetId === runtime.state.id && (this.birdPhase === 'diving' || this.birdPhase === 'feeding'))) {
      this.scareBird();
      return;
    }
    if (!runtime) return;
    const store = useGameStore.getState();
    if (runtime.state.phase === 'empty') {
      if (!store.spendItems({ palmSeed: 1 })) {
        this.audio.playDenied();
        this.showNotice('需要一枚盐冠棕榈种');
        return;
      }
      runtime.state = sowPlanter(runtime.state);
      this.audio.playPlantSeed();
      this.showNotice('种子已埋入培养土');
    } else if (
      runtime.state.phase === 'sown' ||
      runtime.state.phase === 'dry' ||
      (runtime.state.phase === 'growing' && runtime.state.water < 0.38)
    ) {
      if (!store.spendItems({ freshWaterCup: 1 })) {
        this.audio.playDenied();
        this.showNotice('需要一杯蒸馏淡水');
        return;
      }
      store.addItemBundle({ emptyCup: 1 });
      runtime.state = waterPlanter(runtime.state);
      this.audio.playPlantWater();
      this.showNotice('培养土已经浇透');
    } else if (runtime.state.phase === 'mature') {
      const output = planterHarvest(runtime.state);
      const preview = addItems(store.inventory, output, INVENTORY_SLOT_CAPACITY);
      if (Object.keys(preview.rejected).length > 0) {
        this.audio.playDenied();
        this.showNotice('背包没有空间收取作物');
        return;
      }
      store.addItemBundle(output);
      runtime.state = resetPlanter(runtime.state);
      this.audio.playPlantHarvest();
      this.showNotice(bundleLabel(output));
    } else if (runtime.state.phase === 'withered') {
      runtime.state = resetPlanter(runtime.state);
      this.audio.playPlantWither();
      this.showNotice('枯株已清出作物盆');
    } else {
      this.audio.playDenied();
      return;
    }
    this.updatePlanterVisuals(runtime, 0, 0);
    this.publishFeedback();
    this.setPrompt(this.interactionLabel(runtime));
  }

  private updatePlanterVisuals(runtime: PlanterRuntime, time: number, delta: number): void {
    const { state, visuals } = runtime;
    const targetGrowth = state.phase === 'empty' || state.phase === 'sown' ? 0 : state.growth;
    runtime.growthVisual = delta > 0
      ? MathUtils.damp(runtime.growthVisual, targetGrowth, 3.4, delta)
      : targetGrowth;
    const growth = runtime.growthVisual;
    const withered = state.phase === 'withered';
    visuals.seedMarker.visible = state.phase === 'sown' || (state.phase === 'growing' && growth < 0.09);
    visuals.crop.visible = growth > 0.025 || withered;
    visuals.stem.visible = growth > 0.07 || withered;
    visuals.stem.scale.y = Math.max(0.05, MathUtils.smoothstep(growth, 0.06, 0.72));
    visuals.stem.position.y = withered ? -0.04 : 0;

    visuals.leafPivots.forEach((pivot, index) => {
      const threshold = 0.08 + index * 0.075;
      const reveal = MathUtils.smoothstep(growth, threshold, threshold + 0.16);
      pivot.visible = reveal > 0.015 || (withered && index < Math.ceil(growth * visuals.leafPivots.length));
      pivot.scale.setScalar(Math.max(0.04, reveal));
      const tier = Math.floor(index / 3);
      const sway = withered ? 0 : Math.sin(time * 0.92 + index * 1.73) * (0.025 + growth * 0.018);
      pivot.rotation.x = withered ? 0.88 + index * 0.025 : -0.18 - tier * 0.075 + sway;
      pivot.rotation.z = withered ? (index % 2 ? -0.38 : 0.38) : Math.sin(time * 0.67 + index) * 0.035;
      const leaf = visuals.leafMeshes[index];
      leaf.material = withered ? this.materials.cropDry : this.materials.cropLeaf;
    });

    const visibleFruitCount = state.phase === 'mature'
      ? Math.max(1, 3 - Math.floor(state.birdDamage + 0.001))
      : 0;
    visuals.fruits.forEach((fruit, index) => {
      fruit.visible = index < visibleFruitCount;
      fruit.rotation.y = time * 0.25 + index;
      fruit.position.y = 0.54 + (index % 2) * 0.04 + Math.sin(time * 1.2 + index) * 0.006;
    });
    if (visuals.moisture.material instanceof MeshStandardMaterial) {
      visuals.moisture.visible = state.water > 0.01;
      visuals.moisture.material.opacity = Math.min(0.18, state.water * 0.17);
    }
  }

  private updateBird(time: number, delta: number): void {
    this.eligiblePlanters.length = 0;
    for (const runtime of this.planters.values()) {
      const { state } = runtime;
      if (
        state.growth >= 0.45 &&
        (state.phase === 'growing' || state.phase === 'dry' || state.phase === 'mature')
      ) this.eligiblePlanters.push(runtime);
    }
    const eligible = this.eligiblePlanters;
    if (this.birdPhase === 'absent') {
      this.bird.visible = false;
      if (delta > 0 && eligible.length > 0) {
        this.state.birdClock += delta;
        if (this.state.birdClock >= nextBirdVisitSeconds(this.state.birdVisit)) this.beginBirdVisit(eligible);
      }
      return;
    }

    this.bird.visible = true;
    this.birdPhaseElapsed += delta;
    const target = this.birdTargetId ? this.planters.get(this.birdTargetId) ?? null : null;
    if (!target && this.birdPhase !== 'fleeing') this.beginBirdFlee();
    if (target) this.birdTargetPoint.set(target.state.x * RAFT_TILE_X, 0.96, target.state.z * RAFT_TILE_Z);
    this.birdPrevious.copy(this.bird.position);

    if (this.birdPhase === 'circling' && target) {
      const angle = this.birdPhaseElapsed * 1.06 + this.state.birdVisit * 1.71;
      const radius = 2.35 - Math.min(0.55, this.birdPhaseElapsed * 0.065);
      this.bird.position.set(
        this.birdTargetPoint.x + Math.cos(angle) * radius,
        2.35 + Math.sin(angle * 1.7) * 0.18,
        this.birdTargetPoint.z + Math.sin(angle) * radius,
      );
      if (this.birdPhaseElapsed >= 6.4) this.setBirdPhase('diving');
    } else if (this.birdPhase === 'diving' && target) {
      const t = MathUtils.smoothstep(this.birdPhaseElapsed / 2.05, 0, 1);
      this.bird.position.copy(this.birdPhaseStart).lerp(this.birdTargetPoint, t);
      this.bird.position.y += Math.sin(t * Math.PI) * 0.28;
      if (this.birdPhaseElapsed >= 2.05) this.setBirdPhase('feeding');
    } else if (this.birdPhase === 'feeding' && target) {
      this.bird.position.set(
        this.birdTargetPoint.x + 0.14,
        this.birdTargetPoint.y + 0.02 + Math.sin(time * 4.6) * 0.015,
        this.birdTargetPoint.z + 0.08,
      );
      if (delta > 0) {
        target.state = applyBirdDamage(target.state, delta);
        const peckIndex = Math.floor(this.birdPhaseElapsed * 1.35);
        if (peckIndex !== this.lastPeckIndex) {
          this.lastPeckIndex = peckIndex;
          this.audio.playCropBirdPeck();
        }
      }
      if (this.birdPhaseElapsed >= 11.2) this.beginBirdFlee();
    } else if (this.birdPhase === 'fleeing') {
      const t = MathUtils.clamp(this.birdPhaseElapsed / 3.1, 0, 1);
      const awayX = this.birdPhaseStart.x >= this.birdTargetPoint.x ? 1 : -1;
      const awayZ = this.birdPhaseStart.z >= this.birdTargetPoint.z ? 1 : -1;
      this.bird.position.set(
        this.birdPhaseStart.x + awayX * t * 4.5,
        this.birdPhaseStart.y + t * 3.1,
        this.birdPhaseStart.z + awayZ * t * 3.7,
      );
      if (this.birdPhaseElapsed >= 3.1) {
        this.birdPhase = 'absent';
        this.birdTargetId = null;
        this.bird.visible = false;
      }
    }

    const movementX = this.bird.position.x - this.birdPrevious.x;
    const movementZ = this.bird.position.z - this.birdPrevious.z;
    if (Math.hypot(movementX, movementZ) > 0.0001) this.bird.rotation.y = Math.atan2(movementX, movementZ);
    this.updateBirdVisuals(time);
  }

  private beginBirdVisit(eligible: PlanterRuntime[]): void {
    const index = this.state.birdVisit % eligible.length;
    const target = eligible[index];
    this.state.birdClock = 0;
    this.state.birdVisit += 1;
    this.birdTargetId = target.state.id;
    this.birdTargetPoint.set(target.state.x * RAFT_TILE_X, 0.96, target.state.z * RAFT_TILE_Z);
    const angle = this.state.birdVisit * 1.71;
    this.bird.position.set(
      this.birdTargetPoint.x + Math.cos(angle) * 2.8,
      2.55,
      this.birdTargetPoint.z + Math.sin(angle) * 2.8,
    );
    this.setBirdPhase('circling');
    this.bird.visible = true;
    this.audio.playCropBirdWarning();
    this.showNotice('盐翼盗鸟盯上了作物');
  }

  private setBirdPhase(phase: Exclude<CropBirdPhase, 'absent'>): void {
    this.birdPhase = phase;
    this.birdPhaseElapsed = 0;
    this.lastPeckIndex = -1;
    this.birdPhaseStart.copy(this.bird.position);
  }

  private beginBirdFlee(): void {
    if (this.birdPhase === 'absent' || this.birdPhase === 'fleeing') return;
    this.setBirdPhase('fleeing');
  }

  private restoreBirdState(): void {
    this.birdPhase = this.state.birdPhase;
    this.birdPhaseElapsed = this.state.birdElapsed;
    this.birdTargetId = this.state.birdTargetId;
    const target = this.birdTargetId ? this.planters.get(this.birdTargetId) ?? null : null;
    if (!target || this.birdPhase === 'absent') {
      this.birdPhase = 'absent';
      this.birdPhaseElapsed = 0;
      this.birdTargetId = null;
      this.bird.visible = false;
      return;
    }
    this.birdTargetPoint.set(target.state.x * RAFT_TILE_X, 0.96, target.state.z * RAFT_TILE_Z);
    if (this.birdPhase === 'feeding') {
      this.bird.position.set(this.birdTargetPoint.x + 0.14, this.birdTargetPoint.y + 0.02, this.birdTargetPoint.z + 0.08);
    } else if (this.birdPhase === 'circling') {
      const angle = this.birdPhaseElapsed * 1.06 + this.state.birdVisit * 1.71;
      this.bird.position.set(
        this.birdTargetPoint.x + Math.cos(angle) * 2.1,
        2.35,
        this.birdTargetPoint.z + Math.sin(angle) * 2.1,
      );
    } else if (this.birdPhase === 'diving') {
      this.bird.position.set(this.birdTargetPoint.x + 0.8, 1.72, this.birdTargetPoint.z + 0.8);
    } else {
      this.bird.position.set(this.birdTargetPoint.x + 1.2, 1.7, this.birdTargetPoint.z + 1.2);
    }
    this.birdPhaseStart.copy(this.bird.position);
    this.bird.visible = true;
    this.updateBirdVisuals(0);
  }

  private scareBird(): void {
    if (this.birdPhase === 'absent' || this.birdPhase === 'fleeing') return;
    this.audio.playCropBirdScare();
    this.beginBirdFlee();
    this.showNotice('盐翼盗鸟被惊飞');
    this.publishFeedback();
    this.clearPrompt();
  }

  private updateBirdVisuals(time: number): void {
    const flying = this.birdPhase === 'circling' || this.birdPhase === 'diving' || this.birdPhase === 'fleeing';
    const flapSpeed = this.birdPhase === 'diving' ? 13.5 : this.birdPhase === 'fleeing' ? 16 : 9.4;
    const flap = flying ? Math.sin(time * flapSpeed) * 0.72 : 0.12;
    this.birdVisuals.leftWing.rotation.z = 0.16 + flap;
    this.birdVisuals.rightWing.rotation.z = -0.16 - flap;
    this.birdVisuals.leftWing.rotation.x = flying ? -0.12 : 0.42;
    this.birdVisuals.rightWing.rotation.x = flying ? -0.12 : 0.42;
    const peck = this.birdPhase === 'feeding' ? Math.max(0, Math.sin(time * 8.6)) : 0;
    this.birdVisuals.head.rotation.x = peck * 0.92;
    this.birdVisuals.tail.rotation.x = flying ? -0.18 + Math.sin(time * 4.2) * 0.08 : 0.14;
    this.birdVisuals.feet.visible = this.birdPhase === 'feeding' || this.birdPhase === 'diving';
  }

  private removeOrphanedPlanters(): void {
    for (const runtime of [...this.planters.values()]) {
      if (this.raft.hasTile(runtime.state)) continue;
      this.raft.gridToLocal(runtime.state, this.worldHit);
      this.raft.localPointToWorld(this.worldHit, this.worldHit);
      this.splashes.spawn(this.worldHit);
      this.splashes.spawnImpact(this.worldHit, 0x725640, 30);
      if (this.birdTargetId === runtime.state.id) this.beginBirdFlee();
      this.removeRuntime(runtime);
      this.audio.playDeviceLost();
      this.showNotice('潮生作物盆随筏格落海');
    }
    this.publishFeedback();
  }

  private publishFeedback(): void {
    const feedback: PlantingFeedback = {
      placed: this.planters.size,
      growing: 0,
      dry: 0,
      mature: 0,
      withered: 0,
      progress: 0,
      water: 0,
      birdActive: this.birdPhase !== 'absent' && this.birdPhase !== 'fleeing',
      birdThreat:
        this.birdPhase === 'feeding' ? 1 : this.birdPhase === 'diving' ? 0.74 : this.birdPhase === 'circling' ? 0.38 : 0,
    };
    let activeWater = 0;
    let activeCount = 0;
    for (const { state } of this.planters.values()) {
      if (state.phase === 'growing' || state.phase === 'sown') feedback.growing += 1;
      if (state.phase === 'dry') feedback.dry += 1;
      if (state.phase === 'mature') feedback.mature += 1;
      if (state.phase === 'withered') feedback.withered += 1;
      feedback.progress = Math.max(feedback.progress, planterProgress(state));
      if (state.phase === 'growing' || state.phase === 'dry' || state.phase === 'sown') {
        activeWater += state.water;
        activeCount += 1;
      }
    }
    feedback.water = activeCount > 0 ? activeWater / activeCount : feedback.mature > 0 ? 1 : 0;
    useGameStore.getState().setPlanting(feedback);
  }

  private isSharedMaterial(material: Material): boolean {
    return (
      this.materials.wood.some((candidate) => candidate === material) ||
      Object.values(this.materials).some((candidate) => candidate === material)
    );
  }

  private setPrompt(prompt: string): void {
    this.lastPrompt = prompt;
    useGameStore.getState().setInteraction(prompt, 'planting');
  }

  private clearPrompt(): void {
    const store = useGameStore.getState();
    if (this.lastPrompt && store.interaction === this.lastPrompt) store.setInteraction(null, 'planting');
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
    if (!this.inputEnabled || !this.placementActive) return;
    if (event.button === 0) this.placePlanter();
    else if (event.button === 2) useGameStore.getState().setPlacementDevice(null);
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    if (this.inputEnabled && this.placementActive) event.preventDefault();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (
      event.code !== 'KeyE' ||
      event.repeat ||
      !this.inputEnabled ||
      this.placementActive ||
      useGameStore.getState().interactionOwner !== 'planting'
    ) return;
    this.interact();
  };
}
