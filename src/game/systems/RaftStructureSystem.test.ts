import { MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, Vector3 } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MaterialLibrary } from '../art/Materials';
import {
  RAFT_STRUCTURE_DEFINITIONS,
  RAFT_STRUCTURE_LEVEL_HEIGHT,
  type SavedRaftStructure,
} from '../domain/raftStructures';
import { useGameStore } from '../../state/gameStore';
import { RaftSystem } from './RaftSystem';
import { RaftStructureSystem } from './RaftStructureSystem';

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
    saltglassCollector: material(),
    sealedCanvas: material(),
    saltsealedGlove: material(),
    signalLaminate: material(),
    phosphorGlass: material(),
    cropLeaf: material(),
    cropDry: material(),
    cropFruit: material(),
    birdFeather: material(),
    birdWing: material(),
    birdBeak: material(),
    birdEye: material(),
  };
}

function saved(
  id: string,
  type: SavedRaftStructure['type'],
  x: number,
  z: number,
  level: number,
  rotation: SavedRaftStructure['rotation'] = 0,
  open = false,
): SavedRaftStructure {
  return {
    id,
    type,
    x,
    z,
    level,
    rotation,
    health: RAFT_STRUCTURE_DEFINITIONS[type].maxHealth,
    ...(type === 'door' ? { open } : {}),
  };
}

describe('RaftStructureSystem runtime', () => {
  beforeEach(() => {
    useGameStore.getState().setInteraction(null);
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('places detailed walls through a bounded set of instanced buckets', () => {
    const raft = new RaftSystem(createTestMaterials(), [{ x: 0, z: 0, health: 100 }]);
    const structures = new RaftStructureSystem(raft, createTestMaterials());
    expect(structures.place({ type: 'wall', x: 0, z: 0, level: 0, rotation: 1 })).not.toBeNull();
    expect(structures.count).toBe(1);
    expect(structures.group.children.length).toBeLessThanOrEqual(7);
    expect(structures.group.children.reduce((total, child) => total + ('count' in child ? Number(child.count) : 0), 0)).toBeGreaterThan(18);
    structures.dispose();
  });

  it('blocks the player at a wall or closed door but permits an open doorway', () => {
    const raft = new RaftSystem(createTestMaterials(), [
      { x: 0, z: 0, health: 100 },
      { x: 1, z: 0, health: 100 },
    ]);
    const wall = new RaftStructureSystem(raft, createTestMaterials(), [saved('wall', 'wall', 0, 0, 0, 1)]);
    const blocked = new Vector3(0.7, 1.54, 0);
    wall.resolvePlayerCollision(blocked, new Vector3(0.2, 1.54, 0));
    expect(blocked.x).toBeLessThan(0.5);
    wall.dispose();

    const closedDoor = new RaftStructureSystem(raft, createTestMaterials(), [saved('door', 'door', 0, 0, 0, 1)]);
    const closed = new Vector3(0.7, 1.54, 0);
    closedDoor.resolvePlayerCollision(closed, new Vector3(0.2, 1.54, 0));
    expect(closed.x).toBeLessThan(0.5);
    closedDoor.dispose();

    const openDoor = new RaftStructureSystem(raft, createTestMaterials(), [saved('door', 'door', 0, 0, 0, 1, true)]);
    const open = new Vector3(0.7, 1.54, 0);
    openDoor.resolvePlayerCollision(open, new Vector3(0.2, 1.54, 0));
    expect(open.x).toBe(0.7);
    openDoor.dispose();

    const upperWall = new RaftStructureSystem(raft, createTestMaterials(), [saved('upper', 'wall', 0, 0, 1, 1)]);
    const below = new Vector3(0.7, 1.54, 0);
    upperWall.resolvePlayerCollision(below, new Vector3(0.2, 1.54, 0), 0);
    expect(below.x).toBe(0.7);
    const upstairs = new Vector3(0.7, 3.72, 0);
    upperWall.resolvePlayerCollision(upstairs, new Vector3(0.2, 3.72, 0), RAFT_STRUCTURE_LEVEL_HEIGHT);
    expect(upstairs.x).toBeLessThan(0.5);
    upperWall.dispose();
  });

  it('exposes floor and roof undersides through the runtime sampler', () => {
    const raft = new RaftSystem(createTestMaterials(), [{ x: 0, z: 0, health: 100 }]);
    const structures = new RaftStructureSystem(raft, createTestMaterials(), [
      saved('floor', 'floor', 0, 0, 1),
      saved('roof', 'roof', 1, 0, 1),
    ]);
    expect(structures.getOverheadSurfaces(new Vector3(0, 0, 0))).toEqual([
      expect.objectContaining({ type: 'floor', structureId: 'floor' }),
    ]);
    expect(structures.getOverheadSurfaces(new Vector3(1.44, 0, 0))).toEqual([
      expect.objectContaining({ type: 'roof', structureId: 'roof' }),
    ]);
    structures.dispose();
  });

  it('only toggles a focused door while the structure interaction owns E', () => {
    const raft = new RaftSystem(createTestMaterials(), [{ x: 0, z: 0, health: 100 }]);
    const onDoorToggled = vi.fn();
    const structures = new RaftStructureSystem(
      raft,
      createTestMaterials(),
      [saved('door', 'door', 0, 0, 0)],
      onDoorToggled,
    );
    const camera = new PerspectiveCamera();
    camera.position.set(0, 1.1, -2.1);
    camera.lookAt(0, 1.05, -0.69);
    camera.updateMatrixWorld(true);
    structures.setInputEnabled(true);
    structures.updateDoorFocus(camera);
    expect(useGameStore.getState().interactionOwner).toBe('build');

    const keyHandler = vi.mocked(window.addEventListener).mock.calls.find(([type]) => type === 'keydown')?.[1] as EventListener;
    const event = { code: 'KeyE', repeat: false, preventDefault: vi.fn() } as unknown as KeyboardEvent;
    useGameStore.getState().setInteraction('操作设备', 'device');
    keyHandler(event);
    expect(structures.getStructure('door')?.open).toBe(false);
    expect(onDoorToggled).not.toHaveBeenCalled();

    useGameStore.getState().setInteraction('开启绳铰板门', 'build');
    keyHandler(event);
    expect(structures.getStructure('door')?.open).toBe(true);
    expect(onDoorToggled).toHaveBeenCalledWith(true);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    structures.dispose();
  });

  it('blocks support dismantling and cascades unsupported pieces after foundation loss', () => {
    const raft = new RaftSystem(createTestMaterials(), [
      { x: 0, z: 0, health: 100 },
      { x: 1, z: 0, health: 100 },
    ]);
    const structures = new RaftStructureSystem(raft, createTestMaterials(), [
      saved('pillar', 'pillar', 0, 0, 0),
      saved('floor', 'floor', 0, 0, 1),
      saved('upper-wall', 'wall', 0, 0, 1),
    ]);
    expect(structures.remove('pillar')).toEqual({ removed: null, blocked: true });
    expect(structures.canRemoveFoundation({ x: 0, z: 0 })).toBe(false);
    expect(raft.damageTile({ x: 0, z: 0 }, 100).destroyed).toBe(true);
    expect(structures.handleFoundationLoss().map((entry) => entry.id)).toEqual(['pillar', 'floor', 'upper-wall']);
    expect(structures.count).toBe(0);
    structures.dispose();
  });

  it('repairs visible damage to its type maximum without overspending health', () => {
    const raft = new RaftSystem(createTestMaterials(), [{ x: 0, z: 0, health: 100 }]);
    const structures = new RaftStructureSystem(raft, createTestMaterials(), [saved('wall', 'wall', 0, 0, 0)]);
    const damage = structures.damage('wall', 34);
    expect(damage).toMatchObject({ changed: true, destroyed: false, damageTaken: 34 });
    expect(damage.structure?.health).toBe(76);
    expect(structures.getDiagnostics()).toMatchObject({ damaged: 1, critical: 0 });

    const repaired = structures.repair('wall', RAFT_STRUCTURE_DEFINITIONS.wall.repairAmount);
    expect(repaired).toMatchObject({ changed: true, repaired: 34 });
    expect(repaired.structure?.health).toBe(RAFT_STRUCTURE_DEFINITIONS.wall.maxHealth);
    expect(structures.repair('wall', 999).changed).toBe(false);
    expect(structures.getDiagnostics()).toMatchObject({ damaged: 0, critical: 0, lowestHealthRatio: 1 });
    structures.dispose();
  });

  it('destroys a targeted support and returns its complete deterministic collapse chain', () => {
    const raft = new RaftSystem(createTestMaterials(), [{ x: 0, z: 0, health: 100 }]);
    const structures = new RaftStructureSystem(raft, createTestMaterials(), [
      saved('pillar', 'pillar', 0, 0, 0),
      saved('floor', 'floor', 0, 0, 1),
      saved('upper-wall', 'wall', 0, 0, 1),
    ]);
    const result = structures.damage('pillar', RAFT_STRUCTURE_DEFINITIONS.pillar.maxHealth);
    expect(result.destroyed).toBe(true);
    expect(result.structure).toBeNull();
    expect(result.removed.map((entry) => entry.id)).toEqual(['pillar', 'floor', 'upper-wall']);
    expect(structures.count).toBe(0);
    structures.dispose();
  });
});
