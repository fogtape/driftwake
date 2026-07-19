import { MeshBasicMaterial, MeshStandardMaterial, Scene, Vector3 } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MaterialLibrary } from '../art/Materials';
import type { PlayerController } from './PlayerController';
import type { AudioSystem } from './AudioSystem';
import type { SplashSystem } from './SplashSystem';
import type { CollectionNetSystem } from './CollectionNetSystem';
import { RaftSystem } from './RaftSystem';
import { RaftStructureSystem } from './RaftStructureSystem';
import { SharkSystem } from './SharkSystem';

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

describe('SharkSystem structure attacks', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setTimeout: vi.fn(() => 1),
      clearTimeout: vi.fn(),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('locks an exposed damaged structure and bites it twice without damaging its foundation', () => {
    const materials = createTestMaterials();
    const scene = new Scene();
    const raft = new RaftSystem(
      materials,
      Array.from({ length: 9 }, (_, index) => ({
        x: (index % 3) - 1,
        z: Math.floor(index / 3) - 1,
        health: 100,
      })),
    );
    const structures = new RaftStructureSystem(raft, materials, [{
      id: 'exposed-wall',
      type: 'wall',
      x: 1,
      z: 1,
      level: 0,
      rotation: 2,
      health: 75,
    }]);
    const player = {
      getSurface: () => 'raft',
      getWorldFootPosition: (target: Vector3) => target.set(0, 0, 0),
      applyWaterImpulse: vi.fn(),
    } as unknown as PlayerController;
    const audio = {
      playSharkWarning: vi.fn(),
      playSharkBite: vi.fn(),
      playStructureDamage: vi.fn(),
      playPlayerBite: vi.fn(),
      playSpearHit: vi.fn(),
    } as unknown as AudioSystem;
    const splashes = {
      spawn: vi.fn(),
      spawnImpact: vi.fn(),
      spawnStructureDamage: vi.fn(),
    } as unknown as SplashSystem;
    const onMutation = vi.fn();
    const shark = new SharkSystem(
      scene,
      raft,
      structures,
      player,
      materials,
      audio,
      splashes,
      vi.fn(),
      onMutation,
    );

    for (let tick = 0; tick < 2_700 && shark.getDiagnostics().structureDamageEvents < 2; tick += 1) {
      shark.update(tick / 60, 1 / 60);
    }

    expect(shark.getDiagnostics()).toMatchObject({
      lastRaftTargetKind: 'structure',
      lastRaftTargetId: 'exposed-wall',
      lastRaftTargetHealth: 7,
      structureDamageEvents: 2,
      foundationDamageEvents: 0,
    });
    expect(structures.getStructure('exposed-wall')?.health).toBe(7);
    expect(raft.getTile({ x: 1, z: 1 })?.health).toBe(100);
    expect(onMutation).toHaveBeenCalledTimes(2);
    expect(vi.mocked(audio.playStructureDamage)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(splashes.spawnStructureDamage)).toHaveBeenCalledTimes(2);
    shark.dispose();
    structures.dispose();
  });

  it('targets a damaged collection net and applies the host foundation armor reduction', () => {
    const materials = createTestMaterials();
    const scene = new Scene();
    const raft = new RaftSystem(
      materials,
      Array.from({ length: 9 }, (_, index) => ({
        x: (index % 3) - 1,
        z: Math.floor(index / 3) - 1,
        health: 100,
      })),
    );
    expect(raft.reinforceTile({ x: 1, z: 1 }).changed).toBe(true);
    const structures = new RaftStructureSystem(raft, materials, []);
    let netHealth = 40;
    const collectionNets = {
      findSharkTarget: vi.fn(() => ({
        id: 'armored-net',
        x: 1,
        z: 1,
        rotation: 2,
        health: netHealth,
        storage: { timber: 2 },
      })),
      getLocalImpactPosition: vi.fn((_id: string, target: Vector3) => {
        target.set(1.44, -0.05, 2.42);
        return true;
      }),
      damageByShark: vi.fn((_id: string, amount: number) => {
        netHealth = Math.max(0, netHealth - amount);
        return { changed: true, destroyed: netHealth === 0, health: netHealth, released: {} };
      }),
    } as unknown as CollectionNetSystem;
    const player = {
      getSurface: () => 'raft',
      getWorldFootPosition: (target: Vector3) => target.set(0, 0, 0),
      applyWaterImpulse: vi.fn(),
    } as unknown as PlayerController;
    const audio = {
      playSharkWarning: vi.fn(),
      playSharkBite: vi.fn(),
      playStructureDamage: vi.fn(),
      playPlayerBite: vi.fn(),
      playSpearHit: vi.fn(),
    } as unknown as AudioSystem;
    const splashes = {
      spawn: vi.fn(),
      spawnImpact: vi.fn(),
      spawnStructureDamage: vi.fn(),
    } as unknown as SplashSystem;
    const onMutation = vi.fn();
    const shark = new SharkSystem(
      scene,
      raft,
      structures,
      player,
      materials,
      audio,
      splashes,
      vi.fn(),
      onMutation,
      collectionNets,
    );

    for (let tick = 0; tick < 2_700 && shark.getDiagnostics().collectionNetDamageEvents < 2; tick += 1) {
      shark.update(tick / 60, 1 / 60);
    }

    expect(vi.mocked(collectionNets.damageByShark)).toHaveBeenNthCalledWith(1, 'armored-net', 15);
    expect(vi.mocked(collectionNets.damageByShark)).toHaveBeenNthCalledWith(2, 'armored-net', 15);
    expect(shark.getDiagnostics()).toMatchObject({
      lastRaftTargetKind: 'collectionNet',
      lastRaftTargetId: 'armored-net',
      lastRaftTargetHealth: 10,
      collectionNetDamageEvents: 2,
      structureDamageEvents: 0,
      foundationDamageEvents: 0,
    });
    expect(onMutation).toHaveBeenCalledTimes(2);
    expect(raft.getTile({ x: 1, z: 1 })?.health).toBe(100);
    shark.dispose();
    structures.dispose();
  });
});
