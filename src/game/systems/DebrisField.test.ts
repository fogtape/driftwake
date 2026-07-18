import { MeshStandardMaterial, Scene, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { MaterialLibrary } from '../art/Materials';
import { DebrisField } from './DebrisField';

function createSalvageMaterials(): MaterialLibrary {
  const material = new MeshStandardMaterial();
  return {
    wood: [material, material, material],
    darkWood: material,
    rope: material,
    rustMetal: material,
    polymer: material,
    leaf: material,
  } as MaterialLibrary;
}

describe('DebrisField salvage settlement', () => {
  it('restores world drops exactly and keeps rejected loot on the water', () => {
    const field = new DebrisField(new Scene(), createSalvageMaterials(), 11, [
      { loot: { timber: 2, polymer: 1 }, x: 1.25, y: 0.18, z: -2.5 },
    ]);
    expect(field.items.map((item) => item.kind)).toContain('barrel');
    expect(field.items.map((item) => item.kind)).toContain('cache');
    expect(field.getSavedDrops()).toEqual([
      { loot: { timber: 2, polymer: 1 }, x: 1.25, y: 0.18, z: -2.5 },
    ]);

    const drop = field.worldDrops[0];
    field.settleCollection(drop, { timber: 1 }, { timber: 1, polymer: 1 });
    expect(drop.active).toBe(true);
    expect(drop.loot).toEqual({ timber: 1, polymer: 1 });
    field.settleCollection(drop, drop.loot, {});
    expect(drop.active).toBe(false);
  });

  it('moves rejected drift loot into a pooled world drop without losing it', () => {
    const field = new DebrisField(new Scene(), createSalvageMaterials(), 1);
    const drift = field.items[0];
    field.settleCollection(drift, { timber: 1 }, { polymer: 2, fiber: 1 });
    expect(field.activeWorldDropCount).toBe(1);
    expect(field.getSavedDrops()[0]?.loot).toEqual({ polymer: 2, fiber: 1 });
    expect(drift.model.position.z).toBeLessThan(-40);
  });

  it('keeps a fully rejected drift pickup visible as a world drop', () => {
    const field = new DebrisField(new Scene(), createSalvageMaterials(), 1);
    const drift = field.items[0];
    const originalLoot = field.getLoot(drift);
    field.settleCollection(drift, {}, originalLoot);
    expect(field.activeWorldDropCount).toBe(1);
    expect(field.getSavedDrops()[0]?.loot).toEqual(originalLoot);
  });

  it('merges overflow when all pooled drop slots are active', () => {
    const field = new DebrisField(new Scene(), createSalvageMaterials(), 0);
    for (let index = 0; index < 9; index += 1) {
      field.spawnWorldDrop({ timber: 1 }, new Vector3(index * 2, 0, -4));
    }
    expect(field.activeWorldDropCount).toBe(8);
    const totalTimber = field.getSavedDrops().reduce((total, drop) => total + (drop.loot.timber ?? 0), 0);
    expect(totalTimber).toBe(9);
  });

  it('keeps a full debris pool finite through 600 simulated seconds', () => {
    const field = new DebrisField(new Scene(), createSalvageMaterials(), 30);
    const step = 1 / 60;
    for (let tick = 0; tick < 600 * 60; tick += 1) {
      const time = tick * step;
      field.update(time, step);
      if (tick % 600 === 0) {
        const target = field.items.find((item) => item.active && !item.latched);
        if (target) {
          field.latch(target);
          field.settleCollection(target, field.getLoot(target), {});
        }
      }
    }
    expect(field.activeCount).toBe(30);
    expect(field.activeWorldDropCount).toBe(0);
    for (const target of field.targets) {
      expect(target.model.position.toArray().every(Number.isFinite)).toBe(true);
    }
  }, 15_000);
});
