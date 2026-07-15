import {
  Group,
  MathUtils,
  Mesh,
  PerspectiveCamera,
  Ray,
  Scene,
  Vector3,
  type Material,
  type WebGLRenderer,
} from 'three';
import {
  createAxeModel,
  createExplorableIsland,
  createHarvestNodeModel,
  type HarvestModelVisuals,
  type IslandModelVisuals,
} from '../art/ProceduralModels';
import type { MaterialLibrary } from '../art/Materials';
import {
  ISLAND_APPROACH_SECONDS,
  ISLAND_DEPART_SECONDS,
  ISLAND_DOCK_SECONDS,
  advanceIslandState,
  generateHarvestNodes,
  islandTransform,
  sampleIslandHeight,
  type HarvestNodeDefinition,
  type HarvestNodeType,
  type SavedHarvestNode,
  type SavedIslandState,
} from '../domain/island';
import { addItems, bundleLabel } from '../domain/items';
import { useGameStore } from '../../state/gameStore';
import type { PlayerSurface } from '../domain/save';
import type { AudioSystem } from './AudioSystem';
import type { PlayerController } from './PlayerController';
import type { SplashSystem } from './SplashSystem';

interface HarvestRuntime {
  definition: HarvestNodeDefinition;
  state: SavedHarvestNode;
  model: Group;
  visuals: HarvestModelVisuals;
  baseY: number;
  hitPulse: number;
  fallTime: number;
}

const RESOURCE_LABELS: Record<HarvestNodeType, string> = {
  palm: '盐冠棕榈',
  branch: '风干枝料',
  stone: '潮磨石堆',
  fruit: '落地潮果',
  fiber: '棕榈纤维簇',
};

const RESOURCE_COLORS: Record<HarvestNodeType, number> = {
  palm: 0xb98b52,
  branch: 0xc29a62,
  stone: 0xaaa89c,
  fruit: 0xb7cb69,
  fiber: 0x80ad71,
};

export class IslandSystem {
  private island = new Group();
  private visuals: IslandModelVisuals = { foam: [], obstacles: [] };
  private readonly nodes = new Map<string, HarvestRuntime>();
  private readonly axeViewModel: Group;
  private readonly ray = new Ray();
  private readonly forward = new Vector3();
  private readonly center = new Vector3();
  private readonly closest = new Vector3();
  private readonly toCenter = new Vector3();
  private readonly impactPosition = new Vector3();
  private readonly localCandidate = new Vector3();
  private readonly localPrevious = new Vector3();
  private player: PlayerController | null = null;
  private state: SavedIslandState;
  private focused: HarvestRuntime | null = null;
  private swingTarget: HarvestRuntime | null = null;
  private inputEnabled = false;
  private axeEquipped = false;
  private swingTime = 0;
  private impactResolved = false;
  private lastAudioActivity = -1;
  private feedbackElapsed = 0;
  private lastPrompt: string | null = null;
  private noticeTimer: number | null = null;

  constructor(
    private readonly scene: Scene,
    private readonly camera: PerspectiveCamera,
    private readonly renderer: WebGLRenderer,
    private readonly materials: MaterialLibrary,
    private readonly audio: AudioSystem,
    private readonly splashes: SplashSystem,
    savedState: SavedIslandState,
  ) {
    this.state = {
      ...savedState,
      nodes: savedState.nodes.map((node) => ({ ...node })),
    };
    this.axeViewModel = createAxeModel(materials);
    this.axeViewModel.name = 'first-person-stone-axe';
    this.axeViewModel.scale.setScalar(0.82);
    this.axeViewModel.visible = false;
    this.camera.add(this.axeViewModel);
    this.rebuildIsland();
    this.applyTransform();
    this.publishFeedback();
    this.renderer.domElement.addEventListener('mousedown', this.onPointerDown);
    window.addEventListener('keydown', this.onKeyDown);
  }

  setPlayer(player: PlayerController): void {
    this.player = player;
  }

  setAxeEquipped(equipped: boolean): void {
    this.axeEquipped = equipped;
    this.axeViewModel.visible = equipped;
    if (!equipped) {
      this.swingTime = 0;
      this.swingTarget = null;
    }
  }

  setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
    if (enabled) return;
    this.focused = null;
    this.nodes.forEach((runtime) => (runtime.visuals.highlight.visible = false));
    this.clearPrompt();
  }

  sampleGroundHeight(worldX: number, worldZ: number): number | null {
    if (this.state.phase !== 'docked') return null;
    const localX = (worldX - this.island.position.x) / this.island.scale.x;
    const localZ = (worldZ - this.island.position.z) / this.island.scale.z;
    const height = sampleIslandHeight(this.state.seed, localX, localZ);
    if (height === null || height < -0.035) return null;
    return this.island.position.y + height * this.island.scale.y;
  }

  resolvePlayerCollision(position: Vector3, previous: Vector3): void {
    if (this.state.phase !== 'docked') return;
    this.worldToIsland(position, this.localCandidate);
    this.worldToIsland(previous, this.localPrevious);
    if (!this.isBlocked(this.localCandidate.x, this.localCandidate.z)) return;

    const candidateX = this.localCandidate.x;
    const candidateZ = this.localCandidate.z;
    if (!this.isBlocked(candidateX, this.localPrevious.z)) {
      this.localCandidate.z = this.localPrevious.z;
    } else if (!this.isBlocked(this.localPrevious.x, candidateZ)) {
      this.localCandidate.x = this.localPrevious.x;
    } else {
      this.localCandidate.x = this.localPrevious.x;
      this.localCandidate.z = this.localPrevious.z;
    }
    position.x = this.island.position.x + this.localCandidate.x * this.island.scale.x;
    position.z = this.island.position.z + this.localCandidate.z * this.island.scale.z;
  }

  onPlayerSurfaceChange(surface: PlayerSurface): void {
    if (surface === 'island') this.showNotice('踏上盐冠浅滩');
    this.publishFeedback();
  }

  update(time: number, delta: number): void {
    const playerAshore = this.player?.getSurface() === 'island';
    const playerOnExpedition = this.player ? this.player.getSurface() !== 'raft' : false;
    if (delta > 0) {
      const advanced = advanceIslandState(this.state, delta, playerOnExpedition);
      this.state = advanced.state;
      if (advanced.event === 'arrived') {
        this.audio.playIslandArrival();
        this.showNotice('盐冠浅滩已经靠稳');
      } else if (advanced.event === 'departing') {
        this.showNotice('浅滩正被洋流带离');
      } else if (advanced.event === 'renewed') {
        this.rebuildIsland();
        this.showNotice('远处出现新的岛影');
      }
    }
    this.applyTransform();
    const transform = islandTransform(this.state);
    const shoreDistance = Math.max(0, Math.hypot(transform.x, transform.z) - 7);
    const resourcesVisible = this.state.phase !== 'approaching' || shoreDistance < 34;
    this.nodes.forEach((runtime) => (runtime.model.visible = resourcesVisible));
    this.visuals.foam.forEach((foam) => (foam.visible = this.state.phase !== 'approaching' || shoreDistance < 42));
    this.animateIsland(time, delta);
    this.updateAxe(time, delta);

    if (this.inputEnabled && playerAshore && this.state.phase === 'docked') this.updateFocus();
    else {
      this.focused = null;
      this.nodes.forEach((runtime) => (runtime.visuals.highlight.visible = false));
      this.clearPrompt();
    }

    const activity = this.state.phase === 'docked' ? 1 : MathUtils.clamp(1 - shoreDistance / 38, 0, 0.72);
    if (Math.abs(activity - this.lastAudioActivity) >= 0.02) {
      this.lastAudioActivity = activity;
      this.audio.setIslandActivity(activity);
    }
    this.feedbackElapsed -= delta;
    if (this.feedbackElapsed <= 0) {
      this.feedbackElapsed = 0.15;
      this.publishFeedback();
    }
  }

  getSavedState(): SavedIslandState {
    return {
      ...this.state,
      elapsed: Number(this.state.elapsed.toFixed(3)),
      nodes: [...this.nodes.values()].map(({ state }) => ({ ...state })),
    };
  }

  getEncounterState(): Pick<SavedIslandState, 'seed' | 'cycle' | 'phase'> & { x: number; z: number; scale: number } {
    const transform = islandTransform(this.state);
    return {
      seed: this.state.seed,
      cycle: this.state.cycle,
      phase: this.state.phase,
      ...transform,
    };
  }

  dispose(): void {
    this.renderer.domElement.removeEventListener('mousedown', this.onPointerDown);
    window.removeEventListener('keydown', this.onKeyDown);
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);
    this.clearPrompt();
    this.audio.setIslandActivity(0);
    this.camera.remove(this.axeViewModel);
    this.disposeGroup(this.axeViewModel);
    this.scene.remove(this.island);
    this.disposeGroup(this.island);
    this.nodes.clear();
  }

  private rebuildIsland(): void {
    if (this.island.parent) {
      this.scene.remove(this.island);
      this.disposeGroup(this.island);
    }
    this.island = createExplorableIsland(this.materials, this.state.seed);
    this.visuals = this.island.userData.islandVisuals as IslandModelVisuals;
    this.nodes.clear();
    const savedById = new Map(this.state.nodes.map((node) => [node.id, node]));
    for (const definition of generateHarvestNodes(this.state.seed)) {
      const model = createHarvestNodeModel(definition.type, this.materials);
      const height = sampleIslandHeight(this.state.seed, definition.x, definition.z) ?? 0;
      model.position.set(definition.x, height, definition.z);
      model.rotation.y = definition.rotation;
      const saved = savedById.get(definition.id);
      const state = {
        id: definition.id,
        health: MathUtils.clamp(saved?.health ?? definition.maxHealth, 0, definition.maxHealth),
      };
      const visuals = model.userData.harvestVisuals as HarvestModelVisuals;
      const runtime: HarvestRuntime = {
        definition,
        state,
        model,
        visuals,
        baseY: height,
        hitPulse: 0,
        fallTime: -1,
      };
      if (state.health <= 0) {
        visuals.pivot.visible = false;
        if (visuals.stump) visuals.stump.visible = true;
      }
      this.nodes.set(definition.id, runtime);
      this.island.add(model);
    }
    this.state = { ...this.state, nodes: [...this.nodes.values()].map(({ state }) => ({ ...state })) };
    this.scene.add(this.island);
  }

  private applyTransform(): void {
    const transform = islandTransform(this.state);
    this.island.position.set(transform.x, 0, transform.z);
    this.island.scale.setScalar(transform.scale);
  }

  private animateIsland(time: number, delta: number): void {
    this.visuals.foam.forEach((foam, index) => {
      const phase = foam.userData.phase as number;
      const pulse = 0.92 + Math.sin(time * 2.1 + phase * Math.PI * 2) * 0.12;
      foam.scale.y = pulse;
      foam.position.y = -0.075 + Math.sin(time * 1.8 + index * 0.61) * 0.025;
    });
    for (const runtime of this.nodes.values()) {
      runtime.hitPulse = Math.max(0, runtime.hitPulse - delta * 4.8);
      if (runtime.fallTime >= 0) {
        runtime.fallTime += delta;
        const progress = MathUtils.clamp(runtime.fallTime / 1.18, 0, 1);
        runtime.visuals.pivot.rotation.z = MathUtils.smoothstep(progress, 0, 1) * 1.42;
        if (progress >= 1) {
          runtime.visuals.pivot.visible = false;
          if (runtime.visuals.stump) runtime.visuals.stump.visible = true;
          runtime.fallTime = -1;
        }
      } else if (runtime.state.health > 0 && runtime.definition.type === 'palm') {
        runtime.visuals.pivot.rotation.z =
          Math.sin(time * 0.8 + runtime.definition.rotation) * 0.008 + Math.sin(time * 27) * runtime.hitPulse * 0.045;
      } else if (runtime.state.health > 0) {
        runtime.model.position.y = runtime.baseY + Math.sin(time * 1.9 + runtime.definition.rotation) * 0.012;
        runtime.model.rotation.z = Math.sin(time * 1.3 + runtime.definition.x) * 0.012;
      }
      if (runtime.visuals.highlight.visible) {
        runtime.visuals.highlight.scale.setScalar(0.94 + Math.sin(time * 4.2) * 0.045);
      }
    }
  }

  private updateAxe(time: number, delta: number): void {
    this.swingTime = Math.max(0, this.swingTime - delta);
    const progress = this.swingTime > 0 ? 1 - this.swingTime / 0.58 : 0;
    const arc = this.swingTime > 0 ? Math.sin(progress * Math.PI) : 0;
    const settle = Math.sin(time * 1.45) * 0.008;
    this.axeViewModel.position.set(0.55 + settle - arc * 0.18, -0.58 + arc * 0.13, -0.64 - arc * 0.38);
    this.axeViewModel.rotation.set(-0.9 - arc * 0.26, -0.18 + arc * 0.24, -0.38 + arc * 1.12);
    if (this.swingTime > 0 && !this.impactResolved && progress >= 0.42) {
      this.impactResolved = true;
      this.strikePalm(this.swingTarget);
    }
  }

  private updateFocus(): void {
    this.camera.getWorldDirection(this.forward);
    this.ray.set(this.camera.position, this.forward);
    let best: HarvestRuntime | null = null;
    let bestAlong = Number.POSITIVE_INFINITY;
    for (const runtime of this.nodes.values()) {
      runtime.visuals.highlight.visible = false;
      if (runtime.state.health <= 0) continue;
      runtime.model.getWorldPosition(this.center);
      this.center.y += runtime.definition.type === 'palm' ? 1.35 : 0.2;
      this.toCenter.copy(this.center).sub(this.ray.origin);
      const along = this.toCenter.dot(this.ray.direction);
      if (along <= 0 || along > 3.45 || along >= bestAlong) continue;
      this.closest.copy(this.ray.direction).multiplyScalar(along).add(this.ray.origin);
      const radius = runtime.definition.type === 'palm' ? 0.7 : 0.42;
      if (this.closest.distanceToSquared(this.center) > radius * radius) continue;
      best = runtime;
      bestAlong = along;
    }
    this.focused = best;
    if (!best) {
      this.clearPrompt();
      return;
    }
    best.visuals.highlight.visible = true;
    if (best.definition.requiresAxe) {
      this.setPrompt(this.axeEquipped ? `砍伐${RESOURCE_LABELS[best.definition.type]}` : '需要潮磨石斧');
    } else {
      this.setPrompt(`拾取${RESOURCE_LABELS[best.definition.type]}`);
    }
  }

  private gather(runtime: HarvestRuntime): void {
    if (runtime.state.health <= 0 || runtime.definition.requiresAxe) return;
    const store = useGameStore.getState();
    const preview = addItems(store.inventory, runtime.definition.output);
    if (Object.keys(preview.rejected).length > 0) {
      this.audio.playDenied();
      this.showNotice('背包没有空间收下这些物资');
      return;
    }
    store.addItemBundle(runtime.definition.output);
    runtime.state.health = 0;
    runtime.visuals.pivot.visible = false;
    runtime.visuals.highlight.visible = false;
    runtime.model.getWorldPosition(this.impactPosition);
    this.impactPosition.y += 0.18;
    this.splashes.spawnImpact(this.impactPosition, RESOURCE_COLORS[runtime.definition.type], 15);
    this.audio.playGather(runtime.definition.type);
    this.showNotice(bundleLabel(runtime.definition.output));
    this.syncNodeState();
    this.focused = null;
    this.clearPrompt();
    this.publishFeedback();
  }

  private strikePalm(runtime: HarvestRuntime | null): void {
    if (!runtime || runtime.state.health <= 0 || runtime.definition.type !== 'palm') return;
    runtime.model.getWorldPosition(this.center);
    if (this.camera.position.distanceTo(this.center) > 4.1) return;
    const finalHit = runtime.state.health <= 1;
    if (finalHit) {
      const store = useGameStore.getState();
      const preview = addItems(store.inventory, runtime.definition.output);
      if (Object.keys(preview.rejected).length > 0) {
        this.audio.playDenied();
        this.showNotice('背包需要更多空间才能砍倒棕榈');
        return;
      }
      store.addItemBundle(runtime.definition.output);
    }
    runtime.state.health -= 1;
    runtime.hitPulse = 1;
    runtime.model.getWorldPosition(this.impactPosition);
    this.impactPosition.y += 1.12;
    this.splashes.spawnImpact(this.impactPosition, RESOURCE_COLORS.palm, finalHit ? 24 : 13);
    this.audio.playChop(finalHit);
    if (finalHit) {
      runtime.fallTime = 0;
      runtime.visuals.highlight.visible = false;
      this.audio.playTreeFall();
      this.showNotice(bundleLabel(runtime.definition.output));
      this.focused = null;
      this.clearPrompt();
    }
    this.syncNodeState();
    this.publishFeedback();
  }

  private isBlocked(x: number, z: number): boolean {
    for (const obstacle of this.visuals.obstacles) {
      if (Math.hypot(x - obstacle.x, z - obstacle.z) < obstacle.radius + 0.27) return true;
    }
    for (const runtime of this.nodes.values()) {
      if (runtime.definition.type !== 'palm' || runtime.state.health <= 0) continue;
      if (Math.hypot(x - runtime.definition.x, z - runtime.definition.z) < 0.45) return true;
    }
    return false;
  }

  private worldToIsland(world: Vector3, target: Vector3): Vector3 {
    return target.set(
      (world.x - this.island.position.x) / this.island.scale.x,
      (world.y - this.island.position.y) / this.island.scale.y,
      (world.z - this.island.position.z) / this.island.scale.z,
    );
  }

  private syncNodeState(): void {
    this.state = { ...this.state, nodes: [...this.nodes.values()].map(({ state }) => ({ ...state })) };
  }

  private publishFeedback(): void {
    const transform = islandTransform(this.state);
    const duration =
      this.state.phase === 'approaching'
        ? ISLAND_APPROACH_SECONDS
        : this.state.phase === 'docked'
          ? ISLAND_DOCK_SECONDS
          : ISLAND_DEPART_SECONDS;
    const harvested = [...this.nodes.values()].filter((runtime) => runtime.state.health <= 0).length;
    useGameStore.getState().setIsland({
      phase: this.state.phase,
      distance: Math.round(Math.max(0, Math.hypot(transform.x, transform.z) - 7)),
      remaining: Math.max(0, Math.ceil(duration - this.state.elapsed)),
      ashore: this.player ? this.player.getSurface() !== 'raft' : false,
      harvested,
      total: this.nodes.size,
    });
  }

  private setPrompt(prompt: string): void {
    this.lastPrompt = prompt;
    useGameStore.getState().setInteraction(prompt);
  }

  private clearPrompt(): void {
    const store = useGameStore.getState();
    if (this.lastPrompt && store.interaction === this.lastPrompt) store.setInteraction(null);
    this.lastPrompt = null;
  }

  private showNotice(message: string): void {
    useGameStore.getState().showNotice(message);
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => {
      if (useGameStore.getState().notice === message) useGameStore.getState().showNotice(null);
    }, 1750);
  }

  private disposeGroup(group: Group): void {
    group.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => {
        if (!this.isSharedMaterial(material)) material.dispose();
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
    if (
      event.button !== 0 ||
      !this.inputEnabled ||
      !this.axeEquipped ||
      this.player?.getSurface() !== 'island' ||
      this.swingTime > 0
    ) {
      return;
    }
    this.swingTime = 0.58;
    this.impactResolved = false;
    this.swingTarget = this.focused?.definition.type === 'palm' ? this.focused : null;
    this.audio.playAxeSwing();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code !== 'KeyE' || event.repeat || !this.inputEnabled || this.player?.getSurface() !== 'island') return;
    if (this.focused && !this.focused.definition.requiresAxe) this.gather(this.focused);
  };
}
