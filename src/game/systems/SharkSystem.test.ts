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
import { SPEAR_THRUST_TO_IMPACT_SECONDS } from '../domain/combat';
import {
  SHARK_COUNTER_CLOSE_LEAD_SECONDS,
  SHARK_RESPAWN_SECONDS,
  SHARK_SINK_SECONDS,
} from '../domain/shark';

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
    palmBark: material(),
    tidefruitSkin: material(),
    shoreGround: material(),
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
    structureFastener: material(),
    splinteredWood: material(),
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
    choirBronze: material(),
    stormCeramic: material(),
    cropLeaf: material(),
    cropDry: material(),
    cropFruit: material(),
    birdFeather: material(),
    birdWing: material(),
    birdBeak: material(),
    birdEye: material(),
    silverSpineSkin: material(),
    amberFinSkin: material(),
    sailtailRunnerSkin: material(),
    fishFlesh: material(),
    cookedFishFlesh: material(),
    burntFishFlesh: material(),
    saltfireIron: material(),
    saltEtchedPolymer: material(),
    fishEye: material(),
  };
}

function createCombatAudio(): AudioSystem {
  return {
    playSharkWarning: vi.fn(),
    playSharkWindup: vi.fn(),
    playSharkBite: vi.fn(),
    playSharkCounter: vi.fn(),
    playSharkMiss: vi.fn(),
    playStructureDamage: vi.fn(),
    playPlayerBite: vi.fn(),
    playSpearHit: vi.fn(),
  } as unknown as AudioSystem;
}

function createCombatSplashes(): SplashSystem {
  return {
    spawn: vi.fn(),
    spawnImpact: vi.fn(),
    spawnStructureDamage: vi.fn(),
    spawnSharkTelegraph: vi.fn(),
    spawnSharkCounter: vi.fn(),
    spawnSharkMiss: vi.fn(),
  } as unknown as SplashSystem;
}

describe('SharkSystem structure attacks', () => {
  beforeEach(() => {
    useGameStore.getState().setInteraction(null);
    useGameStore.setState({
      phase: 'playing',
      survival: { health: 100, thirst: 82, hunger: 74, oxygen: 100 },
    });
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
    const audio = createCombatAudio();
    const splashes = createCombatSplashes();
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
    const audio = createCombatAudio();
    const splashes = createCombatSplashes();
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

  it('opens a readable spear counter window and retreats before dealing raft damage', () => {
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
    const structures = new RaftStructureSystem(raft, materials, []);
    const player = {
      getSurface: () => 'raft',
      getWorldFootPosition: (target: Vector3) => target.set(0, 0, 0),
      applyWaterImpulse: vi.fn(),
    } as unknown as PlayerController;
    const camera = new PerspectiveCamera();
    const audio = createCombatAudio();
    const splashes = createCombatSplashes();
    const onMutation = vi.fn();
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
      onMutation,
    );

    let counterObserved = false;
    let countered = false;
    let counterInputTick: number | null = null;
    let counterPrimed = false;
    let promptVisibleAtImpact = true;
    for (let tick = 0; tick < 2_700 && !countered; tick += 1) {
      shark.update(tick / 60, 1 / 60);
      const diagnostics = shark.getDiagnostics();
      if (diagnostics.counterWindow) counterObserved = true;
      if (
        counterInputTick === null
        && diagnostics.counterWindow
        && diagnostics.secondsToImpact <= SHARK_COUNTER_CLOSE_LEAD_SECONDS + 0.025
      ) {
        counterInputTick = tick;
        counterPrimed = shark.isCounterWindowOpen();
      }
      if (
        counterInputTick === null
        || (tick - counterInputTick) / 60 < SPEAR_THRUST_TO_IMPACT_SECONDS
      ) continue;
      promptVisibleAtImpact = diagnostics.counterWindow;
      camera.position.copy(shark.model.position).add(new Vector3(0, 0.24, 3));
      camera.lookAt(shark.model.position);
      camera.updateMatrixWorld(true);
      countered = shark.receiveSpearStrike(camera, 34, counterPrimed);
    }

    expect(counterObserved).toBe(true);
    expect(counterInputTick).not.toBeNull();
    expect(counterPrimed).toBe(true);
    expect(promptVisibleAtImpact).toBe(false);
    expect(countered).toBe(true);
    expect(shark.getDiagnostics()).toMatchObject({
      health: 66,
      mode: 'retreating',
      attackPhase: 'recovery',
      counterWindow: false,
      telegraphEvents: 1,
      biteAttempts: 0,
      timedCounterEvents: 1,
      structureDamageEvents: 0,
      foundationDamageEvents: 0,
    });
    expect(onMutation).not.toHaveBeenCalled();
    expect(vi.mocked(audio.playSharkCounter)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(splashes.spawnSharkCounter)).toHaveBeenCalledTimes(1);
    shark.dispose();
    structures.dispose();
  });

  it('limits one water pursuit to two telegraphed bite attempts', () => {
    const materials = createTestMaterials();
    const scene = new Scene();
    const raft = new RaftSystem(materials, [{ x: 0, z: 0, health: 100 }]);
    const structures = new RaftStructureSystem(raft, materials, []);
    const player = {
      getSurface: () => 'water',
      getWorldFootPosition: (target: Vector3) => target.set(0, -0.2, 0),
      applyWaterImpulse: vi.fn(),
    } as unknown as PlayerController;
    const audio = createCombatAudio();
    const splashes = createCombatSplashes();
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
    );

    for (let tick = 0; tick < 1_200; tick += 1) {
      shark.update(tick / 60, 1 / 60);
      const diagnostics = shark.getDiagnostics();
      if (diagnostics.mode === 'retreating' && diagnostics.biteAttempts === 2) break;
    }

    const diagnostics = shark.getDiagnostics();
    expect(diagnostics).toMatchObject({
      mode: 'retreating',
      attackPhase: 'recovery',
      targetKind: 'none',
      telegraphEvents: 2,
      biteAttempts: 2,
      playerDamageEvents: 2,
      missedPlayerBites: 0,
    });
    expect(useGameStore.getState().survival.health).toBe(64);
    expect(vi.mocked(audio.playSharkWindup)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(audio.playPlayerBite)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(splashes.spawnSharkTelegraph)).toHaveBeenCalledTimes(2);
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
      totalHarvestEvents: 4,
      defeatEvents: 0,
      harvestedCarcassEvents: 1,
      expiredCarcassEvents: 0,
      respawnEvents: 0,
      carcassFocused: false,
    });
    expect(shark.getSavedState()).toMatchObject({ lifecycle: 'cooldown', health: 0 });
    expect(vi.mocked(audio.playSharkHarvest)).toHaveBeenCalledTimes(4);
    expect(onStateChange).toHaveBeenCalledTimes(4);

    const recoveryTicks = Math.ceil((SHARK_SINK_SECONDS + SHARK_RESPAWN_SECONDS + 1) * 60);
    for (let tick = 0; tick < recoveryTicks && shark.getDiagnostics().lifecycle !== 'active'; tick += 1) {
      shark.update((tick + 300) / 60, 1 / 60);
    }
    expect(shark.getDiagnostics()).toMatchObject({
      lifecycle: 'active',
      carcassPhase: 'none',
      health: 100,
      mode: 'distant',
      harvestIndex: 0,
      harvestProgress: 0,
      harvestEvents: 4,
      totalHarvestEvents: 4,
      harvestedCarcassEvents: 1,
      expiredCarcassEvents: 0,
      respawnEvents: 1,
      carcassFocused: false,
    });
    expect(shark.model.visible).toBe(true);
    expect(Math.hypot(
      shark.model.position.x - raft.group.position.x,
      shark.model.position.z - raft.group.position.z,
    )).toBeCloseTo(17.5, 4);
    expect(shark.getSavedState()).toMatchObject({ lifecycle: 'active', health: 100 });
    expect(useGameStore.getState().interactionOwner).not.toBe('shark');
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
