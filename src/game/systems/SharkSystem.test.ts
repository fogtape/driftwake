import { MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, Scene, Vector3 } from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MaterialLibrary } from '../art/Materials';
import type { PlayerController } from './PlayerController';
import type { AudioSystem } from './AudioSystem';
import type { SplashSystem } from './SplashSystem';
import type { CollectionNetSystem } from './CollectionNetSystem';
import { RaftSystem } from './RaftSystem';
import { RaftStructureSystem } from './RaftStructureSystem';
import { SharkSystem } from './SharkSystem';
import { useGameStore } from '../../state/gameStore';

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
    useGameStore.getState().setInteraction(null);
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
      new PerspectiveCamera(),
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
      new PerspectiveCamera(),
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

  it('holds to harvest four deterministic carcass stages and never advances an unsettled rejection', () => {
    const materials = createTestMaterials();
    const scene = new Scene();
    const raft = new RaftSystem(materials, [{ x: 0, z: 0, health: 100 }]);
    const structures = new RaftStructureSystem(raft, materials, []);
    const player = {
      getSurface: () => 'raft',
      getWorldFootPosition: (target: Vector3) => target.set(0, 0, 0),
      applyWaterImpulse: vi.fn(),
    } as unknown as PlayerController;
    const camera = new PerspectiveCamera();
    camera.position.set(0, 1.35, 0);
    camera.lookAt(0, -0.2, -2.2);
    camera.updateMatrixWorld(true);
    const audio = {
      playSharkCarcassSurface: vi.fn(),
      playSharkHarvest: vi.fn(),
      playSharkCarcassSink: vi.fn(),
      playDenied: vi.fn(),
    } as unknown as AudioSystem;
    const splashes = {
      spawn: vi.fn(),
      spawnSharkHarvest: vi.fn(),
    } as unknown as SplashSystem;
    const onHarvest = vi.fn()
      .mockImplementationOnce((loot) => ({
        inventory: {},
        accepted: {},
        rejected: { ...loot },
        worldDropped: false,
      }))
      .mockImplementation((loot) => {
        useGameStore.getState().setInteraction('附近漂浮包', 'salvage');
        return {
          inventory: { ...loot },
          accepted: { ...loot },
          rejected: {},
          worldDropped: false,
        };
      });
    const onStateChange = vi.fn();
    const shark = new SharkSystem(
      scene,
      raft,
      structures,
      player,
      camera,
      materials,
      audio,
      splashes,
      vi.fn(),
      vi.fn(),
      null,
      {
        lifecycle: 'carcass',
        health: 0,
        x: 0,
        z: -2.2,
        harvestIndex: 0,
        remainingSeconds: 30,
      },
      onHarvest,
      onStateChange,
    );
    shark.setInputEnabled(true);
    shark.update(0, 1 / 60);
    expect(shark.getDiagnostics()).toMatchObject({
      lifecycle: 'carcass',
      carcassPhase: 'available',
      carcassFocused: true,
      harvestIndex: 0,
    });

    const pressHarvest = () => (shark as unknown as { onKeyDown: (event: KeyboardEvent) => void }).onKeyDown({
      code: 'KeyE',
      repeat: false,
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent);
    pressHarvest();
    for (let tick = 0; tick < 60; tick += 1) shark.update((tick + 1) / 60, 1 / 60);
    expect(onHarvest).toHaveBeenCalledTimes(1);
    expect(shark.getDiagnostics().harvestIndex).toBe(0);
    expect(vi.mocked(audio.playDenied)).toHaveBeenCalledTimes(1);

    pressHarvest();
    camera.position.x = 1.7;
    camera.updateMatrixWorld(true);
    for (let tick = 0; tick < 235; tick += 1) shark.update((tick + 61) / 60, 1 / 60);
    expect(onHarvest).toHaveBeenCalledTimes(5);
    expect(onHarvest.mock.calls.slice(1).map(([loot]) => loot)).toEqual([
      { sharkMeat: 1 },
      { sharkMeat: 1 },
      { sharkMeat: 1, sharkHide: 1 },
      { sharkTooth: 2 },
    ]);
    expect(shark.getDiagnostics()).toMatchObject({
      lifecycle: 'cooldown',
      carcassPhase: 'sinking',
      harvestIndex: 4,
      harvestEvents: 4,
      carcassFocused: false,
    });
    expect(shark.getSavedState()).toMatchObject({ lifecycle: 'cooldown', health: 0 });
    expect(vi.mocked(audio.playSharkHarvest)).toHaveBeenCalledTimes(4);
    expect(onStateChange).toHaveBeenCalledTimes(4);
    shark.dispose();
    structures.dispose();
  });

  it('keeps a settled carcass reachable after a maximum-range strike and replaces the combat prompt', () => {
    const materials = createTestMaterials();
    const scene = new Scene();
    const raft = new RaftSystem(materials, [{ x: 0, z: 0, health: 100 }]);
    const structures = new RaftStructureSystem(raft, materials, []);
    const player = {
      getSurface: () => 'raft',
      getWorldFootPosition: (target: Vector3) => target.set(0, 0, 0),
      applyWaterImpulse: vi.fn(),
    } as unknown as PlayerController;
    const camera = new PerspectiveCamera();
    camera.position.set(0, 1.35, 0);
    camera.lookAt(0, -0.24, -6);
    camera.updateMatrixWorld(true);
    useGameStore.getState().setInteraction('鲨鱼进入刺击距离', 'shark');
    const shark = new SharkSystem(
      scene,
      raft,
      structures,
      player,
      camera,
      materials,
      {} as AudioSystem,
      {} as SplashSystem,
      vi.fn(),
      vi.fn(),
      null,
      {
        lifecycle: 'carcass',
        health: 0,
        x: 0,
        z: -6,
        harvestIndex: 0,
        remainingSeconds: 30,
      },
    );
    shark.setInputEnabled(true);

    shark.update(0, 1 / 60);

    expect(shark.getDiagnostics()).toMatchObject({
      lifecycle: 'carcass',
      carcassPhase: 'available',
      carcassFocused: true,
    });
    expect(useGameStore.getState()).toMatchObject({
      interactionOwner: 'shark',
    });
    expect(useGameStore.getState().interaction).toContain('按住 E 割取');
    shark.dispose();
    structures.dispose();
  });

  it('restores a short cooldown and returns a healthy distant shark', () => {
    const materials = createTestMaterials();
    const scene = new Scene();
    const raft = new RaftSystem(materials, [{ x: 0, z: 0, health: 100 }]);
    const structures = new RaftStructureSystem(raft, materials, []);
    const player = {
      getSurface: () => 'raft',
      getWorldFootPosition: (target: Vector3) => target.set(0, 0, 0),
      applyWaterImpulse: vi.fn(),
    } as unknown as PlayerController;
    const onStateChange = vi.fn();
    const shark = new SharkSystem(
      scene,
      raft,
      structures,
      player,
      new PerspectiveCamera(),
      materials,
      {} as AudioSystem,
      {} as SplashSystem,
      vi.fn(),
      vi.fn(),
      null,
      { lifecycle: 'cooldown', health: 0, x: 0, z: 0, harvestIndex: 0, remainingSeconds: 0.05 },
      undefined,
      onStateChange,
    );
    shark.update(0.1, 0.1);
    expect(shark.getDiagnostics()).toMatchObject({
      lifecycle: 'active',
      carcassPhase: 'none',
      health: 100,
      mode: 'distant',
    });
    expect(shark.model.visible).toBe(true);
    expect(onStateChange).toHaveBeenCalledTimes(1);
    shark.dispose();
    structures.dispose();
  });
});
