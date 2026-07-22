import {
  AdditiveBlending,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  MathUtils,
  Mesh,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Ray,
  Scene,
  Vector3,
  type Material,
  type WebGLRenderer,
} from 'three';
import { createHookModel } from '../art/ProceduralModels';
import {
  createReefModel,
  createReefNodeModel,
  type ReefModelVisuals,
  type ReefNodeVisuals,
} from '../art/UnderwaterModels';
import type { MaterialLibrary } from '../art/Materials';
import {
  OPEN_WATER_FLOOR_Y,
  applyReefHit,
  generateReefNodes,
  sampleReefFloorHeight,
  sanitizeUnderwaterState,
  type ReefNodeDefinition,
  type ReefNodeType,
  type SavedReefNode,
  type SavedUnderwaterState,
} from '../domain/underwater';
import { addItems, bundleLabel } from '../domain/items';
import { createSeededRandom, randomRange } from '../math/random';
import { useGameStore } from '../../state/gameStore';
import { matchesInputAction } from '../domain/inputBindings';
import type { PlayerSurface } from '../domain/save';
import type { AudioSystem } from './AudioSystem';
import type { IslandSystem } from './IslandSystem';
import type { PlayerController } from './PlayerController';
import type { SplashSystem } from './SplashSystem';

interface ReefRuntime {
  definition: ReefNodeDefinition;
  state: SavedReefNode;
  model: Group;
  visuals: ReefNodeVisuals;
  baseY: number;
  hitPulse: number;
  harvestTime: number;
}

const RESOURCE_LABELS: Record<ReefNodeType, string> = {
  sand: '浅礁细砂',
  clay: '潮红黏土',
  metalOre: '盐壳金属矿',
  seaweed: '长叶海草',
};

const RESOURCE_COLORS: Record<ReefNodeType, number> = {
  sand: 0xd9cda8,
  clay: 0xb56f59,
  metalOre: 0x73aaa5,
  seaweed: 0x5e9b72,
};

function createParticleField(count: number, color: number, size: number, opacity: number): Points {
  const positions = new Float32Array(count * 3);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const material = new PointsMaterial({
    color,
    size,
    sizeAttenuation: true,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  points.visible = false;
  return points;
}

export class UnderwaterSystem {
  private reef = new Group();
  private visuals: ReefModelVisuals = { caustics: null!, frondBatch: null!, fronds: [], fishSchools: [], obstacles: [] };
  private readonly nodes = new Map<string, ReefRuntime>();
  private readonly hookViewModel: Group;
  private readonly ray = new Ray();
  private readonly forward = new Vector3();
  private readonly center = new Vector3();
  private readonly closest = new Vector3();
  private readonly toCenter = new Vector3();
  private readonly impactPosition = new Vector3();
  private readonly localCandidate = new Vector3();
  private readonly localPrevious = new Vector3();
  private readonly bubbles = createParticleField(44, 0xb9fff2, 0.055, 0.7);
  private readonly sediment = createParticleField(86, 0xd8d6b7, 0.028, 0.24);
  private readonly random = createSeededRandom(0xb0bb1e);
  private state: SavedUnderwaterState;
  private focused: ReefRuntime | null = null;
  private swingTarget: ReefRuntime | null = null;
  private inputEnabled = false;
  private hookEquipped = false;
  private swingTime = 0;
  private impactResolved = false;
  private lastPrompt: string | null = null;
  private noticeTimer: number | null = null;
  private oxygenWarningBand = 3;
  private particlesInitialized = false;

  constructor(
    private readonly scene: Scene,
    private readonly camera: PerspectiveCamera,
    private readonly renderer: WebGLRenderer,
    private readonly materials: MaterialLibrary,
    private readonly audio: AudioSystem,
    private readonly splashes: SplashSystem,
    private readonly island: IslandSystem,
    private readonly player: PlayerController,
    savedState: SavedUnderwaterState,
  ) {
    const encounter = this.island.getEncounterState();
    this.state = sanitizeUnderwaterState(savedState, encounter.seed, encounter.cycle);
    this.hookViewModel = createHookModel(materials);
    this.hookViewModel.name = 'first-person-reef-hook';
    this.hookViewModel.scale.setScalar(0.86);
    this.hookViewModel.visible = false;
    this.camera.add(this.hookViewModel);
    this.scene.add(this.bubbles, this.sediment);
    this.rebuildReef();
    this.reef.visible = false;
    this.renderer.domElement.addEventListener('mousedown', this.onPointerDown);
    window.addEventListener('keydown', this.onKeyDown);
    this.publishFeedback();
  }

  setHookEquipped(equipped: boolean): void {
    this.hookEquipped = equipped;
    this.hookViewModel.visible = equipped && this.player.getSurface() === 'water';
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

  onPlayerSurfaceChange(surface: PlayerSurface): void {
    this.hookViewModel.visible = this.hookEquipped && surface === 'water';
    if (surface === 'water') {
      this.audio.playWaterEntry();
      this.showNotice('滑入盐冠浅礁');
    } else {
      this.focused = null;
      this.nodes.forEach((runtime) => (runtime.visuals.highlight.visible = false));
      this.clearPrompt();
    }
  }

  sampleWaterFloorHeight(worldX: number, worldZ: number): number | null {
    const encounter = this.island.getEncounterState();
    if (encounter.phase === 'approaching') return OPEN_WATER_FLOOR_Y;
    const localX = (worldX - encounter.x) / encounter.scale;
    const localZ = (worldZ - encounter.z) / encounter.scale;
    const height = sampleReefFloorHeight(encounter.seed, localX, localZ);
    return height === null ? OPEN_WATER_FLOOR_Y : height * encounter.scale;
  }

  getMaterialMapNames(): string[] {
    const materials = [
      ['reefRock', this.materials.reefRock],
      ['warmCoral', this.materials.coralWarm],
      ['paleCoral', this.materials.coralPale],
      ['seaweed', this.materials.seaweed],
      ['ore', this.materials.ore],
      ['clay', this.materials.clay],
      ['reefFish', this.materials.reefFish],
    ] as const;
    return materials.flatMap(([role, material]) => {
      const region = typeof material.userData.pbrAtlasRegion === 'string'
        ? material.userData.pbrAtlasRegion
        : 'none';
      return [
        `${role}[${region}]:albedo=${material.map?.name ?? 'none'}`,
        `${role}[${region}]:normal=${material.normalMap?.name ?? 'none'}`,
        `${role}[${region}]:roughness=${material.roughnessMap?.name ?? 'none'}`,
      ];
    });
  }

  resolvePlayerCollision(position: Vector3, previous: Vector3): void {
    const encounter = this.island.getEncounterState();
    if (encounter.phase === 'approaching') return;
    this.worldToReef(position, this.localCandidate);
    this.worldToReef(previous, this.localPrevious);
    if (!this.isBlocked(this.localCandidate.x, this.localCandidate.z)) return;
    const candidateX = this.localCandidate.x;
    const candidateZ = this.localCandidate.z;
    if (!this.isBlocked(candidateX, this.localPrevious.z)) this.localCandidate.z = this.localPrevious.z;
    else if (!this.isBlocked(this.localPrevious.x, candidateZ)) this.localCandidate.x = this.localPrevious.x;
    else {
      this.localCandidate.x = this.localPrevious.x;
      this.localCandidate.z = this.localPrevious.z;
    }
    position.x = encounter.x + this.localCandidate.x * encounter.scale;
    position.z = encounter.z + this.localCandidate.z * encounter.scale;
  }

  update(time: number, delta: number): void {
    const encounter = this.island.getEncounterState();
    if (encounter.seed !== this.state.islandSeed || encounter.cycle !== this.state.islandCycle) {
      this.state = sanitizeUnderwaterState(null, encounter.seed, encounter.cycle);
      this.rebuildReef();
    }
    this.reef.position.set(encounter.x, 0, encounter.z);
    this.reef.scale.setScalar(encounter.scale);
    const distance = Math.hypot(encounter.x, encounter.z);
    this.reef.visible =
      useGameStore.getState().phase === 'playing' &&
      this.player.getSurface() === 'water' &&
      (encounter.phase !== 'approaching' || distance < 48);

    const inWater = this.player.getSurface() === 'water';
    const submerged = this.player.isSubmerged();
    this.hookViewModel.visible = inWater && this.hookEquipped;
    const causticMap = this.visuals.caustics.material.alphaMap;
    if (causticMap) causticMap.offset.set(time * 0.012, -time * 0.008);
    this.animateReef(time, delta);
    this.updateHook(time, delta);
    this.updateParticles(time, delta, submerged);
    this.audio.setUnderwaterActivity(submerged ? MathUtils.clamp(0.45 + this.player.getDepth() * 0.13, 0, 1) : 0);

    if (this.inputEnabled && inWater && encounter.phase !== 'approaching') this.updateFocus();
    else {
      this.focused = null;
      this.nodes.forEach((runtime) => (runtime.visuals.highlight.visible = false));
      this.clearPrompt();
    }

    const oxygen = useGameStore.getState().survival.oxygen;
    const warningBand = oxygen <= 10 ? 0 : oxygen <= 28 ? 1 : oxygen <= 50 ? 2 : 3;
    if (submerged && warningBand < this.oxygenWarningBand) {
      this.audio.playBreathWarning(warningBand === 0);
      if (warningBand === 1) this.showNotice('呼吸开始急促');
      else if (warningBand === 0) this.showNotice('氧气即将耗尽');
    }
    this.oxygenWarningBand = submerged ? warningBand : 3;
    useGameStore.getState().setPlayer({
      surface: this.player.getSurface(),
      depth: Number(this.player.getDepth().toFixed(2)),
      submerged,
    });
  }

  getSavedState(): SavedUnderwaterState {
    return {
      islandSeed: this.state.islandSeed,
      islandCycle: this.state.islandCycle,
      nodes: [...this.nodes.values()].map(({ state }) => ({ ...state })),
    };
  }

  dispose(): void {
    this.renderer.domElement.removeEventListener('mousedown', this.onPointerDown);
    window.removeEventListener('keydown', this.onKeyDown);
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);
    this.clearPrompt();
    this.audio.setUnderwaterActivity(0);
    this.camera.remove(this.hookViewModel);
    this.disposeGroup(this.hookViewModel);
    this.scene.remove(this.reef, this.bubbles, this.sediment);
    this.disposeGroup(this.reef);
    this.disposePoints(this.bubbles);
    this.disposePoints(this.sediment);
    this.nodes.clear();
  }

  private rebuildReef(): void {
    if (this.reef.parent) {
      this.scene.remove(this.reef);
      this.disposeGroup(this.reef);
    }
    this.reef = createReefModel(this.materials, this.state.islandSeed);
    this.visuals = this.reef.userData.reefVisuals as ReefModelVisuals;
    this.nodes.clear();
    const savedById = new Map(this.state.nodes.map((node) => [node.id, node]));
    for (const definition of generateReefNodes(this.state.islandSeed)) {
      const model = createReefNodeModel(definition.type, this.materials);
      const baseY = sampleReefFloorHeight(this.state.islandSeed, definition.x, definition.z) ?? -3;
      model.position.set(definition.x, baseY, definition.z);
      model.rotation.y = definition.rotation;
      const saved = savedById.get(definition.id);
      const state = {
        id: definition.id,
        health: MathUtils.clamp(saved?.health ?? definition.maxHealth, 0, definition.maxHealth),
      };
      const visuals = model.userData.reefNodeVisuals as ReefNodeVisuals;
      const runtime: ReefRuntime = {
        definition,
        state,
        model,
        visuals,
        baseY,
        hitPulse: 0,
        harvestTime: -1,
      };
      if (state.health <= 0) visuals.pivot.visible = false;
      this.nodes.set(definition.id, runtime);
      this.reef.add(model);
    }
    this.syncNodeState();
    const encounter = this.island.getEncounterState();
    this.reef.position.set(encounter.x, 0, encounter.z);
    this.reef.scale.setScalar(encounter.scale);
    this.scene.add(this.reef);
    this.publishFeedback();
  }

  private animateReef(time: number, delta: number): void {
    this.visuals.fronds.forEach((frond) => {
      const phase = frond.userData.phase as number;
      frond.rotation.z = Math.sin(time * 0.82 + phase) * 0.1;
      frond.rotation.x = Math.sin(time * 0.53 + phase * 0.7) * 0.035;
    });
    this.visuals.fishSchools.forEach((school, index) => {
      const phase = (school.userData.phase as number) + time * (0.18 + index * 0.035);
      const radius = school.userData.radius as number;
      school.position.set(Math.cos(phase) * radius, (school.userData.height as number) + Math.sin(time * 0.7 + index) * 0.18, Math.sin(phase) * radius * 0.76);
      school.rotation.y = -phase + Math.PI * 0.5;
      school.rotation.z = Math.sin(time * 1.8 + index) * 0.025;
    });
    for (const runtime of this.nodes.values()) {
      runtime.hitPulse = Math.max(0, runtime.hitPulse - delta * 4.4);
      runtime.visuals.fronds.forEach((frond) => {
        const phase = frond.userData.phase as number;
        frond.rotation.z = Math.sin(time * 0.9 + phase) * 0.13;
      });
      if (runtime.harvestTime >= 0) {
        runtime.harvestTime += delta;
        const scale = 1 - MathUtils.smoothstep(runtime.harvestTime, 0, 0.42);
        runtime.visuals.pivot.scale.setScalar(Math.max(0.02, scale));
        if (runtime.harvestTime >= 0.42) {
          runtime.visuals.pivot.visible = false;
          runtime.harvestTime = -1;
        }
      } else if (runtime.state.health > 0) {
        const pulse = 1 + Math.sin(time * 28) * runtime.hitPulse * 0.07;
        runtime.visuals.pivot.scale.setScalar(pulse);
        runtime.model.position.y = runtime.baseY + Math.sin(time * 1.3 + runtime.definition.rotation) * 0.012;
      }
      if (runtime.visuals.highlight.visible) {
        runtime.visuals.highlight.scale.setScalar(0.95 + Math.sin(time * 4.6) * 0.055);
      }
    }
  }

  private updateHook(time: number, delta: number): void {
    this.swingTime = Math.max(0, this.swingTime - delta);
    const progress = this.swingTime > 0 ? 1 - this.swingTime / 0.54 : 0;
    const arc = this.swingTime > 0 ? Math.sin(progress * Math.PI) : 0;
    const drift = Math.sin(time * 1.25) * 0.012;
    this.hookViewModel.position.set(0.54 + drift - arc * 0.24, -0.56 + arc * 0.16, -0.72 - arc * 0.44);
    this.hookViewModel.rotation.set(-0.88 - arc * 0.22, -0.2 + arc * 0.28, -0.42 + arc * 1.08);
    if (this.swingTime > 0 && !this.impactResolved && progress >= 0.43) {
      this.impactResolved = true;
      this.strike(this.swingTarget);
    }
  }

  private updateFocus(): void {
    this.camera.getWorldDirection(this.forward);
    this.ray.set(this.camera.position, this.forward);
    let best: ReefRuntime | null = null;
    let bestAlong = Number.POSITIVE_INFINITY;
    for (const runtime of this.nodes.values()) {
      runtime.visuals.highlight.visible = false;
      if (runtime.state.health <= 0) continue;
      runtime.model.getWorldPosition(this.center);
      this.center.y += runtime.definition.type === 'seaweed' ? 0.45 : 0.2;
      this.toCenter.copy(this.center).sub(this.ray.origin);
      const along = this.toCenter.dot(this.ray.direction);
      if (along <= 0 || along > 3.35 || along >= bestAlong) continue;
      this.closest.copy(this.ray.direction).multiplyScalar(along).add(this.ray.origin);
      const radius = runtime.definition.type === 'seaweed' ? 0.55 : 0.47;
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
    if (best.definition.requiresHook) {
      const landedHits = best.definition.maxHealth - best.state.health;
      const progress = landedHits > 0 ? ` · ${landedHits}/${best.definition.maxHealth}` : '';
      this.setPrompt(this.hookEquipped ? `开采${RESOURCE_LABELS[best.definition.type]}${progress}` : '需要打捞钩');
    } else {
      this.setPrompt(`收割${RESOURCE_LABELS[best.definition.type]}`);
    }
  }

  private strike(runtime: ReefRuntime | null): void {
    if (!runtime || runtime.state.health <= 0 || !runtime.definition.requiresHook) return;
    runtime.model.getWorldPosition(this.center);
    if (this.camera.position.distanceTo(this.center) > 3.8) return;
    const finalHit = runtime.state.health <= 1;
    if (finalHit && !this.canAccept(runtime.definition.output, `背包需要更多空间才能收下${RESOURCE_LABELS[runtime.definition.type]}`)) return;
    if (finalHit) useGameStore.getState().addItemBundle(runtime.definition.output);
    const hit = applyReefHit(runtime.state.health, runtime.definition.maxHealth);
    runtime.state.health = hit.health;
    runtime.hitPulse = 1;
    runtime.model.getWorldPosition(this.impactPosition);
    this.impactPosition.y += 0.18;
    this.splashes.spawnImpact(this.impactPosition, RESOURCE_COLORS[runtime.definition.type], finalHit ? 22 : 13);
    this.audio.playReefStrike(runtime.definition.type, finalHit);
    if (finalHit) {
      runtime.harvestTime = 0;
      runtime.visuals.highlight.visible = false;
      this.showNotice(bundleLabel(runtime.definition.output));
      this.focused = null;
      this.clearPrompt();
    }
    this.syncNodeState();
    this.publishFeedback();
  }

  private gatherSeaweed(runtime: ReefRuntime): void {
    if (runtime.state.health <= 0 || runtime.definition.requiresHook) return;
    if (!this.canAccept(runtime.definition.output, '背包没有空间收下海草')) return;
    useGameStore.getState().addItemBundle(runtime.definition.output);
    runtime.state.health = 0;
    runtime.harvestTime = 0;
    runtime.visuals.highlight.visible = false;
    runtime.model.getWorldPosition(this.impactPosition);
    this.impactPosition.y += 0.42;
    this.splashes.spawnImpact(this.impactPosition, RESOURCE_COLORS.seaweed, 16);
    this.audio.playReefGather();
    this.showNotice(bundleLabel(runtime.definition.output));
    this.focused = null;
    this.clearPrompt();
    this.syncNodeState();
    this.publishFeedback();
  }

  private canAccept(output: ReefNodeDefinition['output'], deniedMessage: string): boolean {
    const store = useGameStore.getState();
    const preview = addItems(store.inventory, output);
    if (Object.keys(preview.rejected).length === 0) return true;
    this.audio.playDenied();
    this.showNotice(deniedMessage);
    return false;
  }

  private updateParticles(time: number, delta: number, submerged: boolean): void {
    this.bubbles.visible = submerged;
    this.sediment.visible = submerged;
    if (!submerged) {
      this.particlesInitialized = false;
      return;
    }
    const bubbleAttribute = this.bubbles.geometry.getAttribute('position') as Float32BufferAttribute;
    if (!this.particlesInitialized) {
      for (let index = 0; index < bubbleAttribute.count; index += 1) this.resetBubble(bubbleAttribute, index, true);
      const sedimentAttribute = this.sediment.geometry.getAttribute('position') as Float32BufferAttribute;
      for (let index = 0; index < sedimentAttribute.count; index += 1) {
        sedimentAttribute.setXYZ(
          index,
          randomRange(this.random, -4.5, 4.5),
          randomRange(this.random, -2.6, 2.6),
          randomRange(this.random, -4.5, 4.5),
        );
      }
      sedimentAttribute.needsUpdate = true;
      this.particlesInitialized = true;
    }
    for (let index = 0; index < bubbleAttribute.count; index += 1) {
      const y = bubbleAttribute.getY(index) + delta * (0.24 + (index % 7) * 0.035);
      bubbleAttribute.setX(index, bubbleAttribute.getX(index) + Math.sin(time * 1.9 + index) * delta * 0.018);
      bubbleAttribute.setY(index, y);
      if (y > this.camera.position.y + 2.7 || this.camera.position.distanceToSquared(this.center.set(bubbleAttribute.getX(index), y, bubbleAttribute.getZ(index))) > 42) {
        this.resetBubble(bubbleAttribute, index, false);
      }
    }
    bubbleAttribute.needsUpdate = true;
    this.sediment.position.copy(this.camera.position);
    this.sediment.rotation.y = time * 0.015;
  }

  private resetBubble(attribute: Float32BufferAttribute, index: number, spreadAll: boolean): void {
    const angle = randomRange(this.random, 0, Math.PI * 2);
    const radius = randomRange(this.random, 0.35, 3.6);
    attribute.setXYZ(
      index,
      this.camera.position.x + Math.cos(angle) * radius,
      this.camera.position.y - (spreadAll ? randomRange(this.random, 0.2, 3.2) : randomRange(this.random, 1.8, 3.2)),
      this.camera.position.z + Math.sin(angle) * radius,
    );
  }

  private isBlocked(x: number, z: number): boolean {
    return this.visuals.obstacles.some((obstacle) => Math.hypot(x - obstacle.x, z - obstacle.z) < obstacle.radius + 0.2);
  }

  private worldToReef(world: Vector3, target: Vector3): Vector3 {
    const encounter = this.island.getEncounterState();
    return target.set(
      (world.x - encounter.x) / encounter.scale,
      world.y / encounter.scale,
      (world.z - encounter.z) / encounter.scale,
    );
  }

  private syncNodeState(): void {
    this.state = { ...this.state, nodes: [...this.nodes.values()].map(({ state }) => ({ ...state })) };
  }

  private publishFeedback(): void {
    useGameStore.getState().setReef({
      harvested: [...this.nodes.values()].filter((runtime) => runtime.state.health <= 0).length,
      total: this.nodes.size,
    });
  }

  private setPrompt(prompt: string): void {
    this.lastPrompt = prompt;
    useGameStore.getState().setInteraction(prompt, 'underwater');
  }

  private clearPrompt(): void {
    const store = useGameStore.getState();
    if (this.lastPrompt && store.interaction === this.lastPrompt) store.setInteraction(null, 'underwater');
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

  private disposePoints(points: Points): void {
    points.geometry.dispose();
    (points.material as PointsMaterial).dispose();
  }

  private isSharedMaterial(material: Material): boolean {
    return this.materials.wood.some((candidate) => candidate === material) || Object.values(this.materials).some((candidate) => candidate === material);
  }

  private readonly onPointerDown = (event: MouseEvent): void => {
    if (
      event.button !== 0 ||
      !this.inputEnabled ||
      !this.hookEquipped ||
      this.player.getSurface() !== 'water' ||
      this.swingTime > 0
    ) return;
    this.swingTime = 0.54;
    this.impactResolved = false;
    this.swingTarget = this.focused?.definition.requiresHook ? this.focused : null;
    this.audio.playReefHookSwing();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (
      !matchesInputAction('interact', event.code) ||
      event.repeat ||
      !this.inputEnabled ||
      this.player.getSurface() !== 'water' ||
      useGameStore.getState().interactionOwner !== 'underwater'
    ) return;
    if (this.focused && !this.focused.definition.requiresHook) this.gatherSeaweed(this.focused);
  };
}
