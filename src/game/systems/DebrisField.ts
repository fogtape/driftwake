import { Group, MathUtils, Scene, Vector3 } from 'three';
import type { MaterialLibrary } from '../art/Materials';
import { createDebrisModel, type DebrisKind, varyModel } from '../art/ProceduralModels';
import { createSeededRandom, randomRange, type RandomSource } from '../math/random';
import { sampleWaveHeight } from '../math/waves';
import { selectActiveDebris } from './debrisQuality';

export interface DebrisItem {
  model: Group;
  kind: DebrisKind;
  bobPhase: number;
  driftSpeed: number;
  spinSpeed: number;
  active: boolean;
  latched: boolean;
}

const KIND_SEQUENCE: readonly DebrisKind[] = [
  'timber',
  'polymer',
  'fiber',
  'timber',
  'fiber',
  'timber',
  'polymer',
  'cache',
];

export class DebrisField {
  readonly items: DebrisItem[] = [];
  private readonly random: RandomSource = createSeededRandom(0xd71f7a9);
  private requestedCount: number;

  constructor(scene: Scene, materials: MaterialLibrary, count = 30) {
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
        bobPhase: randomRange(this.random, 0, Math.PI * 2),
        driftSpeed: randomRange(this.random, 0.52, 0.9),
        spinSpeed: randomRange(this.random, -0.18, 0.18),
        active: true,
        latched: false,
      };
      this.items.push(item);
      this.respawn(item, index < 8 ? -10 - index * 5 : undefined);
    }
  }

  get activeCount(): number {
    return this.items.reduce((count, item) => count + (item.active ? 1 : 0), 0);
  }

  setQuality(highQuality: boolean): void {
    this.requestedCount = Math.min(this.items.length, highQuality ? 30 : 18);
    this.applyQualityBudget();
  }

  update(time: number, delta: number): void {
    for (const item of this.items) {
      if (!item.active || item.latched) continue;
      item.model.position.z += item.driftSpeed * delta;
      item.model.position.x += Math.sin(time * 0.21 + item.bobPhase) * delta * 0.035;
      item.model.position.y =
        sampleWaveHeight(item.model.position.x, item.model.position.z, time) +
        0.07 +
        Math.sin(time * 1.25 + item.bobPhase) * 0.035;
      item.model.rotation.y += item.spinSpeed * delta;
      item.model.rotation.z = Math.sin(time * 0.72 + item.bobPhase) * 0.11;
      if (item.model.position.z > 11) this.respawn(item);
    }
  }

  findCollision(point: Vector3, radius: number): DebrisItem | null {
    let closest: DebrisItem | null = null;
    let closestDistance = radius;
    for (const item of this.items) {
      if (!item.active || item.latched) continue;
      const distance = item.model.position.distanceTo(point);
      if (distance < closestDistance) {
        closest = item;
        closestDistance = distance;
      }
    }
    return closest;
  }

  latch(item: DebrisItem): void {
    item.active = true;
    item.model.visible = true;
    item.latched = true;
  }

  release(item: DebrisItem): void {
    item.latched = false;
    this.applyQualityBudget();
  }

  collect(item: DebrisItem): DebrisKind {
    const kind = item.kind;
    item.latched = false;
    this.respawn(item);
    this.applyQualityBudget();
    return kind;
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
    item.driftSpeed = randomRange(this.random, 0.52, 0.9);
    item.spinSpeed = randomRange(this.random, -0.18, 0.18);
    const scale = item.kind === 'cache' ? randomRange(this.random, 0.82, 1.04) : randomRange(this.random, 0.86, 1.18);
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
    this.items.length = 0;
  }
}
