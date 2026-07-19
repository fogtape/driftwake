import { Group, MathUtils, Scene, Vector3 } from 'three';
import type { MaterialLibrary } from '../art/Materials';
import { createDebrisModel, type DebrisKind, varyModel } from '../art/ProceduralModels';
import { salvageLoot, type ItemBundle } from '../domain/items';
import type { SavedWorldDrop } from '../domain/save';
import { createSeededRandom, randomRange, type RandomSource } from '../math/random';
import { sampleWaveHeight } from '../math/waves';
import { selectActiveDebris } from './debrisQuality';

interface SalvageTargetBase {
  model: Group;
  kind: DebrisKind;
  loot: ItemBundle;
  bobPhase: number;
  driftSpeed: number;
  spinSpeed: number;
  active: boolean;
  latched: boolean;
}

export interface DebrisItem extends SalvageTargetBase {
  source: 'drift';
}

export interface WorldDrop extends SalvageTargetBase {
  source: 'drop';
}

export type SalvageTarget = DebrisItem | WorldDrop;

const KIND_SEQUENCE: readonly DebrisKind[] = [
  'timber',
  'polymer',
  'fiber',
  'timber',
  'fiber',
  'timber',
  'polymer',
  'barrel',
  'timber',
  'fiber',
  'cache',
];

const WORLD_DROP_POOL_SIZE = 8;

function bundleHasItems(bundle: ItemBundle): boolean {
  return Object.values(bundle).some((amount) => (amount ?? 0) > 0);
}

function mergeBundles(first: ItemBundle, second: ItemBundle): ItemBundle {
  const merged = { ...first };
  for (const [id, amount] of Object.entries(second)) {
    const key = id as keyof ItemBundle;
    merged[key] = (merged[key] ?? 0) + (amount ?? 0);
  }
  return merged;
}

export class DebrisField {
  readonly items: DebrisItem[] = [];
  readonly worldDrops: WorldDrop[] = [];
  private readonly allTargets: SalvageTarget[] = [];
  private readonly random: RandomSource = createSeededRandom(0xd71f7a9);
  private requestedCount: number;

  constructor(scene: Scene, materials: MaterialLibrary, count = 30, savedDrops: readonly SavedWorldDrop[] = []) {
    this.requestedCount = count;
    const prototypes = new Map<DebrisKind, Group>();
    for (const kind of new Set(KIND_SEQUENCE)) {
      prototypes.set(kind, createDebrisModel(kind, materials));
    }
    for (let index = 0; index < count; index += 1) {
      const kind = KIND_SEQUENCE[index % KIND_SEQUENCE.length];
      const model = prototypes.get(kind)!.clone(true);
      model.name = `debris-${kind}-${index}`;
      varyModel(model, index + 1);
      scene.add(model);
      const item: DebrisItem = {
        model,
        kind,
        source: 'drift',
        loot: {},
        bobPhase: randomRange(this.random, 0, Math.PI * 2),
        driftSpeed: randomRange(this.random, 0.52, 0.9),
        spinSpeed: randomRange(this.random, -0.18, 0.18),
        active: true,
        latched: false,
      };
      this.items.push(item);
      this.allTargets.push(item);
      this.respawn(item, index === 0 ? -3.7 : index < 8 ? -10 - index * 5 : undefined);
    }
    const dropPrototype = createDebrisModel('cache', materials);
    for (let index = 0; index < WORLD_DROP_POOL_SIZE; index += 1) {
      const model = dropPrototype.clone(true);
      model.name = `world-salvage-drop-${index}`;
      model.visible = false;
      model.scale.setScalar(0.58);
      scene.add(model);
      const drop: WorldDrop = {
        model,
        kind: 'cache',
        source: 'drop',
        loot: {},
        bobPhase: randomRange(this.random, 0, Math.PI * 2),
        driftSpeed: randomRange(this.random, 0.12, 0.22),
        spinSpeed: randomRange(this.random, -0.12, 0.12),
        active: false,
        latched: false,
      };
      this.worldDrops.push(drop);
      this.allTargets.push(drop);
    }
    for (const saved of savedDrops.slice(0, WORLD_DROP_POOL_SIZE)) {
      const restored = this.spawnWorldDrop(saved.loot, new Vector3(saved.x, saved.y, saved.z));
      restored?.model.position.set(saved.x, saved.y, saved.z);
    }
  }

  get activeCount(): number {
    return this.items.reduce((count, item) => count + (item.active ? 1 : 0), 0);
  }

  get activeWorldDropCount(): number {
    return this.worldDrops.reduce((count, drop) => count + (drop.active ? 1 : 0), 0);
  }

  get targets(): readonly SalvageTarget[] {
    return this.allTargets;
  }

  getSavedDrops(): SavedWorldDrop[] {
    return this.worldDrops
      .filter((drop) => drop.active && bundleHasItems(drop.loot))
      .map((drop) => ({
        loot: { ...drop.loot },
        x: drop.model.position.x,
        y: drop.model.position.y,
        z: drop.model.position.z,
      }));
  }

  setQuality(highQuality: boolean): void {
    this.requestedCount = Math.min(this.items.length, highQuality ? 30 : 18);
    this.applyQualityBudget();
  }

  update(time: number, delta: number): void {
    for (const target of this.targets) {
      if (!target.active || target.latched) continue;
      target.model.position.z += target.driftSpeed * delta;
      target.model.position.x += Math.sin(time * 0.21 + target.bobPhase) * delta * 0.035;
      target.model.position.y =
        sampleWaveHeight(target.model.position.x, target.model.position.z, time) +
        0.07 +
        Math.sin(time * 1.25 + target.bobPhase) * 0.035;
      target.model.rotation.y += target.spinSpeed * delta;
      target.model.rotation.z = Math.sin(time * 0.72 + target.bobPhase) * 0.11;
      if (target.source === 'drift' && target.model.position.z > 11) this.respawn(target);
      else if (target.source === 'drop' && target.model.position.z > 18) target.model.position.z = -12;
    }
  }

  findCollision(point: Vector3, radius: number): SalvageTarget | null {
    let closest: SalvageTarget | null = null;
    let closestDistance = radius;
    for (const target of this.targets) {
      if (!target.active || target.latched) continue;
      const distance = target.model.position.distanceTo(point);
      if (distance < closestDistance) {
        closest = target;
        closestDistance = distance;
      }
    }
    return closest;
  }

  latch(target: SalvageTarget): void {
    target.active = true;
    target.model.visible = true;
    target.latched = true;
  }

  release(target: SalvageTarget): void {
    target.latched = false;
    if (target.source === 'drift') this.applyQualityBudget();
  }

  getLoot(target: SalvageTarget): ItemBundle {
    return { ...target.loot };
  }

  settleCollection(target: SalvageTarget, accepted: ItemBundle, rejected: ItemBundle): void {
    if (target.source === 'drop') {
      if (!bundleHasItems(accepted)) {
        this.release(target);
        return;
      }
      target.latched = false;
      target.loot = { ...rejected };
      target.active = bundleHasItems(rejected);
      target.model.visible = target.active;
      return;
    }
    if (!bundleHasItems(accepted) && !bundleHasItems(rejected)) {
      this.release(target);
      return;
    }
    const position = target.model.position.clone();
    target.latched = false;
    this.respawn(target);
    this.applyQualityBudget();
    if (bundleHasItems(rejected)) this.spawnWorldDrop(rejected, position);
  }

  spawnWorldDrop(bundle: ItemBundle, position: Vector3, relocateOnMerge = false): WorldDrop | null {
    if (!bundleHasItems(bundle)) return null;
    const inactive = this.worldDrops.find((drop) => !drop.active);
    if (!inactive) {
      const nearest = this.worldDrops.reduce((best, drop) =>
        drop.model.position.distanceToSquared(position) < best.model.position.distanceToSquared(position) ? drop : best,
      );
      nearest.loot = mergeBundles(nearest.loot, bundle);
      if (relocateOnMerge) {
        nearest.latched = false;
        nearest.model.visible = true;
        nearest.model.position.copy(position);
        nearest.model.position.x += randomRange(this.random, -0.24, 0.24);
        nearest.model.position.z += randomRange(this.random, -0.18, 0.18);
      }
      return nearest;
    }
    inactive.loot = { ...bundle };
    inactive.active = true;
    inactive.latched = false;
    inactive.model.visible = true;
    inactive.model.position.copy(position);
    inactive.model.position.x += randomRange(this.random, -0.24, 0.24);
    inactive.model.position.z += randomRange(this.random, -0.18, 0.18);
    inactive.model.rotation.set(0, randomRange(this.random, 0, Math.PI * 2), 0);
    return inactive;
  }

  private respawn(item: DebrisItem, forcedZ?: number): void {
    item.latched = false;
    item.model.visible = item.active;
    item.model.position.set(
      randomRange(this.random, -17, 17),
      0,
      forcedZ ?? randomRange(this.random, -84, -46),
    );
    item.model.rotation.y = randomRange(this.random, 0, Math.PI * 2);
    item.loot = salvageLoot(item.kind, this.random());
    item.driftSpeed = randomRange(this.random, 0.52, 0.9);
    item.spinSpeed = randomRange(this.random, -0.18, 0.18);
    const scale = item.kind === 'cache' || item.kind === 'barrel'
      ? randomRange(this.random, 0.82, 1.04)
      : randomRange(this.random, 0.86, 1.18);
    item.model.scale.setScalar(scale);
  }

  private applyQualityBudget(): void {
    const activeItems = selectActiveDebris(this.items.map((item) => item.latched), this.requestedCount);
    for (let index = 0; index < this.items.length; index += 1) {
      const item = this.items[index];
      item.active = activeItems[index];
      item.model.visible = item.active;
    }
  }

  dispose(scene: Scene): void {
    for (const item of this.items) scene.remove(item.model);
    for (const drop of this.worldDrops) scene.remove(drop.model);
    this.items.length = 0;
    this.worldDrops.length = 0;
    this.allTargets.length = 0;
  }
}
