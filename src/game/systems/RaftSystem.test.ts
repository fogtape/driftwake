import { MeshBasicMaterial, MeshStandardMaterial, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { MaterialLibrary } from '../art/Materials';
import { RaftSystem } from './RaftSystem';

function createTestMaterials(): MaterialLibrary {
  const material = () => new MeshStandardMaterial();
  return {
    wood: [material(), material(), material()],
    darkWood: material(),
    rope: material(),
    metal: material(),
    rustMetal: material(),
    polymer: material(),
    leaf: material(),
    rock: material(),
    foliage: material(),
    wovenFiber: material(),
    sharkSkin: material(),
    sharkMouth: material(),
    sharkEye: material(),
    reefSeabed: material(),
    reefRock: material(),
    coralWarm: material(),
    coralPale: material(),
    seaweed: material(),
    ore: material(),
    clay: material(),
    reefFish: material(),
    reefCaustic: new MeshBasicMaterial(),
    sailCloth: material(),
    planterSoil: material(),
    refractoryClay: material(),
    navigationAlloy: material(),
    cropLeaf: material(),
    cropDry: material(),
    cropFruit: material(),
    birdFeather: material(),
    birdWing: material(),
    birdBeak: material(),
    birdEye: material(),
  };
}

describe('RaftSystem topology', () => {
  it('retains an explicit navigation heading independently of wave motion', () => {
    const raft = new RaftSystem(createTestMaterials(), [{ x: 0, z: 0, health: 100 }]);
    raft.setHeading(Math.PI / 3);
    raft.update(2, 1 / 60);
    expect(raft.getHeading()).toBeCloseTo(Math.PI / 3);
    expect(Number.isFinite(raft.group.quaternion.y)).toBe(true);
  });

  it('only accepts empty cardinally adjacent foundation cells', () => {
    const raft = new RaftSystem(createTestMaterials(), [{ x: 0, z: 0, health: 100 }]);
    expect(raft.canAddTile({ x: 1, z: 0 })).toBe(true);
    expect(raft.canAddTile({ x: 1, z: 1 })).toBe(false);
    expect(raft.addTile({ x: 1, z: 0 })).toBe(true);
    expect(raft.addTile({ x: 1, z: 0 })).toBe(false);
    expect(raft.tileCount).toBe(2);
    expect(raft.removeTile({ x: 0, z: 0 })).toBe(true);
    expect(raft.tileCount).toBe(1);
  });

  it('tracks damage, repair and destruction per tile', () => {
    const raft = new RaftSystem(createTestMaterials(), [{ x: 0, z: 0, health: 100 }]);
    expect(raft.damageTile({ x: 0, z: 0 }, 34).tile?.health).toBe(66);
    expect(raft.getIntegrityStats()).toEqual({ tiles: 1, damagedTiles: 1, averageIntegrity: 66 });
    expect(raft.repairTile({ x: 0, z: 0 }, 20).tile?.health).toBe(86);
    expect(raft.addTile({ x: 1, z: 0 })).toBe(true);
    expect(raft.damageTile({ x: 0, z: 0 }, 100).destroyed).toBe(true);
    expect(raft.tileCount).toBe(1);
  });

  it('rejects removals that would split the remaining raft', () => {
    const raft = new RaftSystem(createTestMaterials(), [
      { x: -1, z: 0, health: 100 },
      { x: 0, z: 0, health: 100 },
      { x: 1, z: 0, health: 100 },
    ]);
    expect(raft.canRemoveTile({ x: 0, z: 0 })).toBe(false);
    expect(raft.removeTile({ x: 0, z: 0 })).toBe(false);
    expect(raft.tileCount).toBe(3);
  });

  it('keeps the final foundation alive until a death flow exists', () => {
    const raft = new RaftSystem(createTestMaterials(), [{ x: 0, z: 0, health: 20 }]);
    const result = raft.damageTile({ x: 0, z: 0 }, 100);
    expect(result.destroyed).toBe(false);
    expect(result.tile?.health).toBe(1);
    expect(raft.tileCount).toBe(1);
  });

  it('allows crossing the rounding boundary between adjacent foundations', () => {
    const raft = new RaftSystem(createTestMaterials(), [
      { x: 0, z: 0, health: 100 },
      { x: 1, z: 0, health: 100 },
    ]);
    const position = new Vector3(0.74, 1.54, 0);
    raft.clampLocalPosition(position);
    expect(position.x).toBeGreaterThan(0.72);
  });
});
