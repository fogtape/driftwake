import { MeshStandardMaterial, Object3D, Scene } from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { MaterialLibrary } from '../art/Materials';
import { RAFT_STRUCTURE_LEVEL_HEIGHT, type SavedRaftStructure } from '../domain/raftStructures';
import type { AudioSystem } from './AudioSystem';
import { RaftSystem } from './RaftSystem';
import type { RaftStructureSystem } from './RaftStructureSystem';
import type { SplashSystem } from './SplashSystem';
import { StructureCollapseSystem } from './StructureCollapseSystem';

function createTestMaterials(): MaterialLibrary {
  const material = () => new MeshStandardMaterial();
  return {
    wood: [material(), material()],
    darkWood: material(),
    rope: material(),
    rustMetal: material(),
    navigationAlloy: material(),
    wovenFiber: material(),
  } as unknown as MaterialLibrary;
}

function structure(
  id: string,
  type: SavedRaftStructure['type'],
  level = 0,
  health = 0,
): SavedRaftStructure {
  return { id, type, x: 0, z: -1, level, rotation: 0, health };
}

function createHarness() {
  const scene = new Scene();
  const materials = createTestMaterials();
  const raft = new RaftSystem(materials, [{ x: 0, z: -1, health: 100 }]);
  const structures = {
    positionObject(object: Object3D, saved: SavedRaftStructure) {
      object.position.set(saved.x * 1.44, saved.level * RAFT_STRUCTURE_LEVEL_HEIGHT, saved.z * 1.38);
      object.rotation.set(0, saved.rotation * Math.PI / 2, 0);
    },
  } as RaftStructureSystem;
  const splashes = { spawnStructureWaterImpact: vi.fn() } as unknown as SplashSystem;
  const audio = { playStructureSplash: vi.fn() } as unknown as AudioSystem;
  const impact = vi.fn();
  const collapse = new StructureCollapseSystem(
    scene,
    raft,
    structures,
    materials,
    splashes,
    audio,
    impact,
  );
  return { scene, collapse, splashes, audio, impact };
}

describe('StructureCollapseSystem', () => {
  it('keeps removed structures visible as split bodies through fall, water impact and retirement', () => {
    const { scene, collapse, splashes, audio, impact } = createHarness();
    expect(collapse.spawn([
      structure('broken-pillar', 'pillar'),
      structure('unsupported-floor', 'floor', 1, 90),
    ])).toBe(2);
    expect(collapse.getDiagnostics()).toMatchObject({ active: 2, activeBodies: 4, spawned: 2 });
    expect(scene.children.filter((child) => child.name.startsWith('structure-collapse-'))).toHaveLength(4);

    let time = 0;
    for (let step = 0; step < 150; step += 1) {
      time += 1 / 60;
      collapse.update(time, 1 / 60);
    }
    expect(collapse.getDiagnostics().waterImpacts).toBe(2);
    expect(vi.mocked(splashes.spawnStructureWaterImpact)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(audio.playStructureSplash)).toHaveBeenCalledTimes(2);
    expect(impact).toHaveBeenCalledTimes(2);

    for (let step = 0; step < 240; step += 1) {
      time += 1 / 60;
      collapse.update(time, 1 / 60);
    }
    expect(collapse.getDiagnostics()).toMatchObject({ active: 0, activeBodies: 0, retired: 2 });
    expect(scene.children.filter((child) => child.name.startsWith('structure-collapse-'))).toHaveLength(0);
    collapse.dispose();
  });

  it('caps cascade presentation without allowing transient scene growth to become persistent', () => {
    const { collapse } = createHarness();
    const cascade = Array.from({ length: 14 }, (_, index) => structure(`wall-${index}`, 'wall'));
    expect(collapse.spawn(cascade)).toBe(10);
    expect(collapse.getDiagnostics()).toMatchObject({ active: 10, activeBodies: 20, spawned: 10, discarded: 4 });

    collapse.spawn([structure('newest-wall', 'wall')]);
    expect(collapse.getDiagnostics()).toMatchObject({
      active: 10,
      activeBodies: 20,
      spawned: 11,
      retired: 1,
      lastStructureId: 'newest-wall',
    });
    collapse.dispose();
  });
});
