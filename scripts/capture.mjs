import { mkdir, writeFile } from 'node:fs/promises';
import { launchDriftwakeChromium, preparePlaywrightPlatform } from './browser-runtime.mjs';
import { assertEncodedFrameContent, assertFrameContent } from './capture-utils.mjs';

preparePlaywrightPlatform();

const { chromium } = await import('@playwright/test');

const baseUrl = process.env.DRIFTWAKE_URL ?? 'http://127.0.0.1:4173';
const captureOnly = process.env.CAPTURE_ONLY ?? 'all';
const desktopWidth = Number(process.env.CAPTURE_WIDTH ?? 1440);
const desktopHeight = Number(process.env.CAPTURE_HEIGHT ?? 900);
const captureQuality = process.env.CAPTURE_QUALITY;
const outputDir = new URL('../artifacts/screenshots/', import.meta.url);

if (captureQuality !== undefined && captureQuality !== 'low' && captureQuality !== 'high') {
  throw new Error('CAPTURE_QUALITY must be low or high');
}

const seededSave = {
  version: 10,
  savedAt: 1,
  player: {
    inventory: {
      hook: 1,
      hammer: 1,
      spear: 1,
      fishingRod: 1,
      axe: 1,
      timber: 18,
      polymer: 12,
      fiber: 14,
      scrap: 4,
      rope: 5,
      stone: 6,
      palmSeed: 2,
      palmFruit: 3,
      emergencyWater: 2,
      rawFish: 1,
      cookedFish: 1,
      emptyCup: 1,
      freshWaterCup: 1,
      purifierKit: 1,
      grillKit: 1,
      sailKit: 1,
      anchorKit: 1,
      planterKit: 1,
    },
    survival: { health: 92, thirst: 67, hunger: 61, oxygen: 100 },
    selectedTool: 'hook',
    playSeconds: 180,
    navigation: { surface: 'raft', x: 0, z: 0.92 },
  },
  raft: {
    tiles: Array.from({ length: 9 }, (_, index) => ({
      x: (index % 3) - 1,
      z: Math.floor(index / 3) - 1,
      health: index === 2 ? 66 : 100,
    })),
    devices: [
      { id: 'capture-purifier', type: 'purifier', x: -1, z: 0, rotation: 0, phase: 'ready', elapsed: 18 },
      { id: 'capture-grill', type: 'grill', x: 1, z: 0, rotation: Math.PI, phase: 'working', elapsed: 8 },
    ],
    navigation: {
      windClock: 41,
      courseAngle: -Math.PI / 8,
      heading: -Math.PI / 8,
      devices: [
        { id: 'capture-sail', type: 'sail', x: 0, z: -1, rotation: 0, deployed: true },
        { id: 'capture-anchor', type: 'anchor', x: -1, z: 1, rotation: Math.PI / 2, deployed: true },
      ],
    },
    planting: {
      birdClock: 8,
      birdVisit: 0,
      planters: [
        {
          id: 'capture-planter',
          x: 1,
          z: 1,
          rotation: -Math.PI / 2,
          phase: 'growing',
          growth: 0.72,
          water: 0.44,
          drySeconds: 0,
          birdDamage: 0,
        },
      ],
    },
    progression: {
      researched: [],
      learned: [],
      devices: [],
    },
  },
  world: {
    island: {
      seed: 0x51ad7e,
      cycle: 0,
      phase: 'docked',
      elapsed: 78,
      nodes: [],
    },
    underwater: {
      islandSeed: 0x51ad7e,
      islandCycle: 0,
      nodes: [],
    },
  },
};

const salvageSave = {
  ...seededSave,
  version: 11,
  player: {
    ...seededSave.player,
    inventory: { hook: 1, timber: 2, polymer: 2, rope: 1 },
    toolDurability: { hook: 1 },
    selectedTool: 'hook',
    navigation: { surface: 'raft', x: 0, z: 1.08 },
  },
  raft: {
    ...seededSave.raft,
    devices: [],
    navigation: {
      ...seededSave.raft.navigation,
      courseAngle: 0,
      heading: 0,
      devices: [],
    },
    planting: { birdClock: 0, birdVisit: 0, planters: [] },
    progression: { researched: [], learned: [], devices: [] },
  },
  world: {
    ...seededSave.world,
    island: { ...seededSave.world.island, phase: 'approaching', elapsed: 0 },
    drops: [{ loot: { fiber: 2, scrap: 1 }, x: 0, y: 0.1, z: -1.25 }],
  },
};

const islandSeededSave = {
  ...seededSave,
  player: {
    ...seededSave.player,
    selectedTool: 'axe',
    navigation: { surface: 'island', x: 0, z: -2 },
  },
};

const islandInteractionSave = {
  ...islandSeededSave,
  player: {
    ...islandSeededSave.player,
    navigation: { surface: 'island', x: 0.568, z: -2 },
  },
};

const underwaterSeededSave = {
  ...seededSave,
  player: {
    ...seededSave.player,
    inventory: {
      ...seededSave.player.inventory,
      purifierKit: 0,
      grillKit: 0,
      sailKit: 0,
      anchorKit: 0,
      planterKit: 0,
    },
    selectedTool: 'hook',
    navigation: { surface: 'water', x: -3.117, y: -2.3, z: 4.7 },
  },
};

const anchorInteractionSave = {
  ...seededSave,
  raft: {
    ...seededSave.raft,
    devices: seededSave.raft.devices.filter((device) => device.x !== 0 || device.z !== -1),
    navigation: {
      ...seededSave.raft.navigation,
      devices: [
        { id: 'interaction-sail', type: 'sail', x: 1, z: -1, rotation: 0, deployed: false },
        { id: 'interaction-anchor', type: 'anchor', x: 0, z: -1, rotation: 0, deployed: true },
      ],
    },
  },
};

const driftRiskSave = {
  ...islandSeededSave,
  player: {
    ...islandSeededSave.player,
    navigation: { surface: 'island', x: 0, z: -7 },
  },
  raft: {
    ...islandSeededSave.raft,
    navigation: {
      ...islandSeededSave.raft.navigation,
      devices: islandSeededSave.raft.navigation.devices.map((device) => ({ ...device, deployed: false })),
    },
  },
  world: {
    ...islandSeededSave.world,
    island: { ...islandSeededSave.world.island, elapsed: 77.85 },
  },
};

const plantingPlacementSave = {
  ...seededSave,
  player: {
    ...seededSave.player,
    inventory: {
      hook: 1,
      hammer: 1,
      palmSeed: 2,
      freshWaterCup: 1,
      planterKit: 1,
    },
  },
  raft: {
    ...seededSave.raft,
    navigation: {
      ...seededSave.raft.navigation,
      devices: [
        { id: 'planting-sail', type: 'sail', x: -1, z: -1, rotation: 0, deployed: false },
        { id: 'planting-anchor', type: 'anchor', x: -1, z: 1, rotation: Math.PI / 2, deployed: true },
      ],
    },
    planting: {
      birdClock: 0,
      birdVisit: 0,
      planters: [],
    },
  },
};

const plantingInteractionSave = {
  ...plantingPlacementSave,
  player: {
    ...plantingPlacementSave.player,
    navigation: { surface: 'raft', x: 1, z: 1.08 },
  },
  raft: {
    ...plantingPlacementSave.raft,
    planting: {
      birdClock: 0,
      birdVisit: 0,
      planters: [
        {
          id: 'interaction-planter',
          x: 1,
          z: -1,
          rotation: 0,
          phase: 'empty',
          growth: 0,
          water: 0,
          drySeconds: 0,
          birdDamage: 0,
        },
      ],
    },
  },
};

const plantingBirdSave = {
  ...plantingInteractionSave,
  raft: {
    ...plantingInteractionSave.raft,
    planting: {
      birdClock: 32.8,
      birdVisit: 0,
      birdPhase: 'feeding',
      birdElapsed: 0,
      birdTargetId: 'bird-planter',
      planters: [
        {
          id: 'bird-planter',
          x: 1,
          z: -1,
          rotation: 0,
          phase: 'mature',
          growth: 1,
          water: 0,
          drySeconds: 0,
          birdDamage: 0,
        },
      ],
    },
  },
};

const progressionPlacementSave = {
  ...seededSave,
  player: {
    ...seededSave.player,
    inventory: { hook: 1, hammer: 1, researchBenchKit: 1 },
  },
  raft: {
    ...seededSave.raft,
    devices: [],
    navigation: { ...seededSave.raft.navigation, devices: [] },
    planting: { birdClock: 0, birdVisit: 0, planters: [] },
    progression: { researched: [], learned: [], devices: [] },
  },
};

const progressionResearchSave = {
  ...progressionPlacementSave,
  player: {
    ...progressionPlacementSave.player,
    inventory: { hook: 1, hammer: 1, timber: 1, scrap: 1, dryBrick: 1 },
  },
  raft: {
    ...progressionPlacementSave.raft,
    progression: {
      researched: [],
      learned: [],
      devices: [
        { id: 'research-table', type: 'researchBench', x: 0, z: -1, rotation: 0, phase: 'idle', elapsed: 0, brickElapsed: [] },
      ],
    },
  },
};

const progressionSmeltingSave = {
  ...progressionPlacementSave,
  player: {
    ...progressionPlacementSave.player,
    inventory: { hook: 1, hammer: 1, timber: 4, wetBrick: 1 },
  },
  raft: {
    ...progressionPlacementSave.raft,
    progression: {
      researched: ['timber', 'scrap', 'dryBrick'],
      learned: ['smelterKit'],
      devices: [
        { id: 'smelting-table', type: 'researchBench', x: -1, z: -1, rotation: 0, phase: 'idle', elapsed: 0, brickElapsed: [] },
        { id: 'brick-rack', type: 'dryingBricks', x: 1, z: -1, rotation: 0, phase: 'idle', elapsed: 0, brickElapsed: [42, 25, 8] },
        { id: 'active-smelter', type: 'smelter', x: 0, z: -1, rotation: 0, phase: 'working', elapsed: 55, brickElapsed: [] },
      ],
    },
  },
};

const progressionReadySave = {
  ...progressionSmeltingSave,
  raft: {
    ...progressionSmeltingSave.raft,
    progression: {
      ...progressionSmeltingSave.raft.progression,
      devices: progressionSmeltingSave.raft.progression.devices.map((device) =>
        device.id === 'active-smelter' ? { ...device, phase: 'ready', elapsed: 58 } : device,
      ),
    },
  },
};

const navigationHelmPlacementSave = {
  ...progressionPlacementSave,
  player: {
    ...progressionPlacementSave.player,
    inventory: { hook: 1, hammer: 1, helmKit: 1 },
  },
};

const navigationRiggingSave = {
  ...progressionPlacementSave,
  player: {
    ...progressionPlacementSave.player,
    inventory: { hook: 1, hammer: 1, stormRigKit: 1 },
  },
  raft: {
    ...progressionPlacementSave.raft,
    navigation: {
      windClock: 40,
      weatherClock: 40,
      courseAngle: 0,
      heading: 0,
      routeMode: 'manual',
      sailStrain: 0,
      devices: [
        { id: 'rigging-sail', type: 'sail', x: 0, z: -1, rotation: 0, deployed: true, reinforced: false },
      ],
    },
  },
};

const navigationStormSave = {
  ...seededSave,
  raft: {
    ...seededSave.raft,
    navigation: {
      windClock: 20,
      weatherClock: 20,
      courseAngle: Math.PI / 5,
      heading: Math.PI / 7,
      routeMode: 'island',
      sailStrain: 0.38,
      devices: [
        { id: 'storm-sail', type: 'sail', x: 1, z: -1, rotation: 0, deployed: true, reinforced: true },
        { id: 'storm-helm', type: 'helm', x: 0, z: -1, rotation: 0, deployed: false, reinforced: false },
        { id: 'storm-anchor', type: 'anchor', x: -1, z: 1, rotation: Math.PI / 2, deployed: false, reinforced: false },
      ],
    },
  },
};

const narrowProgressionSave = {
  ...seededSave,
  raft: {
    ...seededSave.raft,
    navigation: {
      windClock: 143,
      weatherClock: 143,
      courseAngle: Math.PI / 5,
      heading: Math.PI / 7,
      routeMode: 'island',
      sailStrain: 0.68,
      devices: [
        { id: 'narrow-sail', type: 'sail', x: 0, z: -1, rotation: 0, deployed: true, reinforced: true },
        { id: 'narrow-helm', type: 'helm', x: 1, z: 1, rotation: 0, deployed: false, reinforced: false },
        { id: 'narrow-anchor', type: 'anchor', x: -1, z: 1, rotation: Math.PI / 2, deployed: false, reinforced: false },
      ],
    },
    planting: { birdClock: 0, birdVisit: 0, planters: [] },
    progression: {
      researched: ['timber', 'scrap', 'dryBrick'],
      learned: ['smelterKit'],
      devices: [
        { id: 'narrow-table', type: 'researchBench', x: -1, z: -1, rotation: 0, phase: 'idle', elapsed: 0, brickElapsed: [] },
        { id: 'narrow-rack', type: 'dryingBricks', x: 0, z: 0, rotation: 0, phase: 'idle', elapsed: 0, brickElapsed: [31, 14] },
        { id: 'narrow-smelter', type: 'smelter', x: 1, z: -1, rotation: 0, phase: 'working', elapsed: 24, brickElapsed: [] },
      ],
    },
  },
};

const advancedDeviceSave = {
  ...seededSave,
  version: 10,
  player: {
    ...seededSave.player,
    inventory: {
      hook: 1,
      hammer: 1,
      timber: 26,
      polymer: 14,
      rope: 6,
      scrap: 8,
      rawFish: 4,
      emptyCup: 1,
      glassPane: 4,
      hinge: 2,
      anchorBraceKit: 1,
    },
    navigation: { surface: 'raft', x: 0, z: 1.08 },
  },
  raft: {
    tiles: Array.from({ length: 15 }, (_, index) => ({
      x: (index % 5) - 2,
      z: Math.floor(index / 5) - 1,
      health: 100,
    })),
    devices: [
      {
        id: 'advanced-solar',
        type: 'solarPurifier',
        x: -1,
        z: -1,
        rotation: 0,
        phase: 'ready',
        elapsed: 26,
        waterQueue: [13, 20],
        freshWater: 2,
      },
      {
        id: 'advanced-grill',
        type: 'tripleGrill',
        x: 0,
        z: 0,
        rotation: Math.PI,
        grillSlots: [
          { phase: 'working', elapsed: 12 },
          { phase: 'ready', elapsed: 25 },
          { phase: 'burnt', elapsed: 56 },
        ],
        fuelSeconds: 74,
      },
      {
        id: 'advanced-locker',
        type: 'locker',
        x: 1,
        z: -1,
        rotation: 0,
        storage: { timber: 8, polymer: 6, rope: 3, cookedFish: 2 },
      },
    ],
    navigation: {
      windClock: 143,
      weatherClock: 143,
      courseAngle: 0,
      heading: 0,
      routeMode: 'manual',
      sailStrain: 0.18,
      anchorStrain: 0.18,
      devices: [
        { id: 'advanced-sail', type: 'sail', x: 2, z: -1, rotation: 0, deployed: false, reinforced: true },
        { id: 'advanced-anchor', type: 'anchor', x: -2, z: 1, rotation: Math.PI / 2, deployed: true, reinforced: true },
        { id: 'advanced-helm', type: 'helm', x: 2, z: 1, rotation: 0, deployed: false, reinforced: false },
      ],
    },
    planting: { birdClock: 0, birdVisit: 0, planters: [] },
    progression: {
      researched: ['timber', 'rope', 'scrap', 'dryBrick', 'metalIngot', 'glassPane', 'hinge'],
      learned: ['smelterKit', 'metalSpear', 'metalAxe', 'helmKit', 'stormRigKit', 'hinge', 'solarPurifierKit', 'tripleGrillKit', 'lockerKit', 'anchorBraceKit'],
      devices: [],
    },
  },
};

const advancedStorageSave = {
  ...advancedDeviceSave,
  player: {
    ...advancedDeviceSave.player,
    navigation: { surface: 'raft', x: 0, z: 1.3 },
  },
  raft: {
    ...advancedDeviceSave.raft,
    devices: [
      {
        id: 'advanced-storage-test',
        type: 'locker',
        x: 0,
        z: 0,
        rotation: 0,
        storage: { timber: 8, polymer: 6, rope: 3, cookedFish: 2, scrap: 10, fiber: 20, stone: 16 },
      },
    ],
  },
};

const signalNetworkSave = {
  ...seededSave,
  version: 10,
  player: {
    ...seededSave.player,
    inventory: {
      hook: 1,
      hammer: 1,
      spear: 1,
      timber: 18,
      polymer: 12,
      rope: 6,
      scrap: 8,
      metalIngot: 4,
      glassPane: 3,
      signalBoard: 2,
      brineCell: 2,
    },
    navigation: { surface: 'raft', x: 0, z: 1.28 },
  },
  raft: {
    tiles: Array.from({ length: 35 }, (_, index) => ({
      x: (index % 7) - 3,
      z: Math.floor(index / 7) - 2,
      health: 100,
    })),
    devices: [],
    navigation: {
      windClock: 58,
      weatherClock: 58,
      courseAngle: 0,
      heading: 0,
      routeMode: 'signal',
      sailStrain: 0,
      anchorStrain: 0,
      worldX: 72,
      worldZ: -114,
      receiverOn: true,
      receiverCharge: 248,
      activeSignal: 'tideRelay',
      signalOriginX: 0,
      signalOriginZ: 0,
      discoveredSignals: ['tideRelay', 'ironChoir'],
      visitedSignals: [],
      devices: [
        { id: 'signal-receiver', type: 'receiver', x: 0, z: 0, rotation: 0, deployed: false, reinforced: false },
        { id: 'signal-antenna', type: 'antenna', x: -2, z: 0, rotation: Math.PI / 2, deployed: false, reinforced: false },
        { id: 'signal-sail', type: 'sail', x: 2, z: -2, rotation: 0, deployed: true, reinforced: false },
        { id: 'signal-helm', type: 'helm', x: 2, z: 2, rotation: 0, deployed: false, reinforced: false },
      ],
    },
    planting: { birdClock: 0, birdVisit: 0, planters: [] },
    progression: {
      researched: ['timber', 'rope', 'scrap', 'dryBrick', 'metalIngot', 'glassPane', 'hinge', 'signalBoard'],
      learned: ['smelterKit', 'hinge', 'signalBoard', 'brineCell', 'receiverKit', 'antennaKit'],
      devices: [],
    },
  },
  world: {
    ...seededSave.world,
    island: {
      ...seededSave.world.island,
      phase: 'docked',
      elapsed: 12,
    },
  },
};

const failureSave = {
  ...seededSave,
  version: 12,
  player: {
    ...seededSave.player,
    inventory: {
      hook: 1,
      hammer: 1,
      timber: 7,
      polymer: 5,
      emergencyWater: 1,
      ration: 1,
      emptyCup: 1,
    },
    survival: { health: 0, thirst: 24, hunger: 37, oxygen: 100 },
    selectedTool: 'hook',
    playSeconds: 246,
    navigation: { surface: 'raft', x: 0.36, z: 0.72 },
    failure: {
      cause: 'shark',
      dropped: { timber: 3, polymer: 2, emergencyWater: 1 },
      occurredAt: 246,
      dropPending: true,
    },
  },
  world: {
    ...seededSave.world,
    drops: [],
  },
};

const survivalPressureSave = {
  ...seededSave,
  version: 13,
  player: {
    ...seededSave.player,
    inventory: { hook: 1, emergencyWater: 1, ration: 1 },
    survival: { health: 74, thirst: 14, hunger: 26, oxygen: 100 },
    selectedTool: 'hook',
    playSeconds: 960,
    crafting: { entries: [], nextSerial: 1 },
    failure: null,
    navigation: { surface: 'raft', x: 0, z: 1.08 },
  },
};

const durabilityBaseSave = {
  ...seededSave,
  version: 13,
  player: {
    ...seededSave.player,
    inventory: { hook: 1 },
    toolDurability: { hook: 24 },
    selectedTool: 'hook',
    crafting: { entries: [], nextSerial: 1 },
    failure: null,
    navigation: { surface: 'raft', x: 0, z: 1.08 },
  },
  raft: {
    ...seededSave.raft,
    devices: [],
    navigation: { ...seededSave.raft.navigation, devices: [] },
    planting: { birdClock: 0, birdVisit: 0, planters: [] },
    progression: { researched: [], learned: [], devices: [] },
  },
  world: {
    ...seededSave.world,
    island: { ...seededSave.world.island, dockVersion: 1, phase: 'approaching', elapsed: 0 },
    drops: [],
  },
};

const durabilityHammerSave = {
  ...durabilityBaseSave,
  player: {
    ...durabilityBaseSave.player,
    inventory: { hook: 1, hammer: 1, timber: 8, polymer: 5 },
    toolDurability: { hook: 24, hammer: 1 },
    selectedTool: 'hammer',
  },
};

const durabilityFishingSave = {
  ...durabilityBaseSave,
  player: {
    ...durabilityBaseSave.player,
    inventory: { hook: 1, fishingRod: 1 },
    toolDurability: { hook: 24, fishingRod: 1 },
    selectedTool: 'fishingRod',
  },
};

const durabilityAxeSave = {
  ...durabilityBaseSave,
  player: {
    ...durabilityBaseSave.player,
    inventory: { hook: 1, axe: 1 },
    toolDurability: { hook: 24, axe: 1 },
    selectedTool: 'axe',
    navigation: { surface: 'island', x: -1.1, z: -5.9 },
  },
  world: {
    ...durabilityBaseSave.world,
    island: { ...seededSave.world.island, dockVersion: 1, phase: 'docked', elapsed: 12 },
  },
};

const structureBuildSave = {
  ...seededSave,
  version: 15,
  player: {
    ...seededSave.player,
    inventory: { hook: 1, hammer: 1, timber: 48, polymer: 18, rope: 24, fiber: 24 },
    toolDurability: { hook: 24, hammer: 80 },
    selectedTool: 'hammer',
    crafting: { entries: [], nextSerial: 1 },
    failure: null,
    navigation: { surface: 'raft', x: 0, z: 1.08 },
  },
  raft: {
    tiles: Array.from({ length: 20 }, (_, index) => ({
      x: (index % 5) - 2,
      z: Math.floor(index / 5) - 1,
      health: 100,
    })),
    structures: [
      { id: 'showcase-pillar', type: 'pillar', x: -1, z: 0, level: 0, rotation: 0, health: 125 },
      { id: 'showcase-stairs', type: 'stairs', x: -1, z: 1, level: 0, rotation: 0, health: 100 },
      { id: 'showcase-left-floor', type: 'floor', x: -1, z: 0, level: 1, rotation: 0, health: 90 },
      { id: 'showcase-upper-wall', type: 'wall', x: -1, z: 0, level: 1, rotation: 0, health: 110 },
      { id: 'showcase-north-wall', type: 'wall', x: 0, z: 0, level: 0, rotation: 0, health: 110 },
      { id: 'showcase-west-wall', type: 'wall', x: 0, z: 0, level: 0, rotation: 3, health: 110 },
      { id: 'showcase-center-floor', type: 'floor', x: 0, z: 0, level: 1, rotation: 0, health: 90 },
      { id: 'showcase-door', type: 'door', x: 1, z: 0, level: 0, rotation: 0, health: 95, open: true },
      { id: 'showcase-roof-wall', type: 'wall', x: 1, z: 0, level: 0, rotation: 1, health: 110 },
      { id: 'showcase-roof', type: 'roof', x: 1, z: 0, level: 1, rotation: 0, health: 80 },
    ],
    devices: [],
    navigation: { ...seededSave.raft.navigation, courseAngle: 0, heading: 0, devices: [] },
    planting: { birdClock: 0, birdVisit: 0, planters: [] },
    progression: { researched: [], learned: [], devices: [] },
  },
  world: {
    ...seededSave.world,
    island: { ...seededSave.world.island, dockVersion: 1, phase: 'approaching', elapsed: 0 },
    drops: [],
  },
};

const structureVisualSave = {
  ...structureBuildSave,
  player: {
    ...structureBuildSave.player,
    inventory: { ...structureBuildSave.player.inventory, timber: 45, rope: 23 },
    toolDurability: { ...structureBuildSave.player.toolDurability, hammer: 79 },
    navigation: { surface: 'raft', x: 0.2, z: 2.9 },
  },
  raft: {
    ...structureBuildSave.raft,
    structures: [
      ...structureBuildSave.raft.structures.map((structure) =>
        structure.id === 'showcase-stairs' ? { ...structure, x: 1, z: 1 } : structure,
      ),
      { id: 'showcase-new-wall', type: 'wall', x: 1, z: -1, level: 0, rotation: 1, health: 110 },
    ],
  },
};

const structureTraversalSave = {
  ...structureBuildSave,
  player: {
    ...structureBuildSave.player,
    inventory: { hook: 1 },
    toolDurability: { hook: 24 },
    selectedTool: 'hook',
    navigation: { surface: 'raft', x: 0, z: 2.05 },
  },
  raft: {
    ...structureBuildSave.raft,
    tiles: Array.from({ length: 12 }, (_, index) => ({
      x: (index % 3) - 1,
      z: Math.floor(index / 3) - 1,
      health: 100,
    })),
    structures: [
      { id: 'traversal-stairs', type: 'stairs', x: 0, z: 1, level: 0, rotation: 0, health: 100 },
      { id: 'traversal-floor', type: 'floor', x: 0, z: 0, level: 1, rotation: 0, health: 90 },
      { id: 'traversal-upper-wall', type: 'wall', x: 0, z: 0, level: 1, rotation: 0, health: 110 },
    ],
  },
};

const structureFloorCeilingSave = {
  ...structureBuildSave,
  player: {
    ...structureBuildSave.player,
    inventory: { hook: 1 },
    toolDurability: { hook: 24 },
    selectedTool: 'hook',
    navigation: { surface: 'raft', x: 0, z: 0 },
  },
  raft: {
    ...structureBuildSave.raft,
    structures: [
      { id: 'ceiling-floor-north', type: 'wall', x: 0, z: 0, level: 0, rotation: 0, health: 110 },
      { id: 'ceiling-floor-west', type: 'wall', x: 0, z: 0, level: 0, rotation: 3, health: 110 },
      { id: 'ceiling-floor', type: 'floor', x: 0, z: 0, level: 1, rotation: 0, health: 90 },
    ],
  },
};

const structureRoofCeilingSave = {
  ...structureFloorCeilingSave,
  player: {
    ...structureFloorCeilingSave.player,
    navigation: { surface: 'raft', x: 1.44, z: 0 },
  },
  raft: {
    ...structureFloorCeilingSave.raft,
    structures: [
      { id: 'ceiling-roof-north', type: 'wall', x: 1, z: 0, level: 0, rotation: 0, health: 110 },
      { id: 'ceiling-roof-east', type: 'wall', x: 1, z: 0, level: 0, rotation: 1, health: 110 },
      { id: 'ceiling-roof', type: 'roof', x: 1, z: 0, level: 1, rotation: 0, health: 80 },
    ],
  },
};

const structureDamageSave = {
  ...structureBuildSave,
  player: {
    ...structureBuildSave.player,
    inventory: { hook: 1, hammer: 1, timber: 12, rope: 4 },
    toolDurability: { hook: 24, hammer: 80 },
    selectedTool: 'hammer',
    navigation: { surface: 'raft', x: 2.88, z: 1.45 },
  },
  raft: {
    ...structureBuildSave.raft,
    structures: [
      { id: 'damage-wall', type: 'wall', x: 2, z: 2, level: 0, rotation: 2, health: 75 },
    ],
  },
};

const collectionNetSave = {
  ...seededSave,
  version: 17,
  player: {
    ...seededSave.player,
    inventory: {
      hook: 1,
      hammer: 1,
      collectionNetKit: 1,
      timber: 2,
      polymer: 1,
      fiber: 1,
    },
    toolDurability: { hook: 24, hammer: 80 },
    selectedTool: 'hook',
    crafting: { entries: [], nextSerial: 1 },
    failure: null,
    navigation: { surface: 'raft', x: 0, z: 1.08 },
  },
  raft: {
    ...seededSave.raft,
    structures: [],
    collectionNets: [],
    devices: [],
    navigation: { ...seededSave.raft.navigation, courseAngle: 0, heading: 0, devices: [] },
    planting: { birdClock: 0, birdVisit: 0, planters: [] },
    progression: { researched: [], learned: [], devices: [] },
  },
  world: {
    ...seededSave.world,
    island: { ...seededSave.world.island, dockVersion: 1, phase: 'approaching', elapsed: 0 },
    drops: [],
  },
};

const perimeterDefenseSave = {
  ...collectionNetSave,
  player: {
    ...collectionNetSave.player,
    inventory: {
      hook: 1,
      hammer: 1,
      timber: 6,
      rope: 4,
      metalIngot: 2,
      scrap: 4,
    },
    toolDurability: { hook: 24, hammer: 80 },
    selectedTool: 'hammer',
  },
  raft: {
    ...collectionNetSave.raft,
    tiles: collectionNetSave.raft.tiles.map((tile) => ({ ...tile, health: 100, reinforced: false })),
    collectionNets: [],
  },
};

const perimeterDefenseVisualSave = {
  ...perimeterDefenseSave,
  player: {
    ...perimeterDefenseSave.player,
    selectedTool: 'hammer',
  },
  raft: {
    ...perimeterDefenseSave.raft,
    tiles: perimeterDefenseSave.raft.tiles.map((tile) => ({
      ...tile,
      reinforced: tile.z === -1,
    })),
    collectionNets: [{
      id: 'defense-visual-net',
      x: 0,
      z: -1,
      rotation: 0,
      health: 80,
      storage: { timber: 3, fiber: 2, polymer: 1 },
    }],
  },
};

await mkdir(outputDir, { recursive: true });

const browserRuntime = await launchDriftwakeChromium(chromium, {
  width: desktopWidth,
  height: desktopHeight,
});
const browser = browserRuntime.browser;

const errors = [];

function monitorPage(page, label) {
  page.on('console', (message) => {
    if (message.type() === 'warning') {
      console.warn(`${label} warning: ${message.text()}`);
      return;
    }
    if (message.type() !== 'error') return;
    const line = `${label} console: ${message.text()}`;
    errors.push(line);
    console.error(line);
  });
  page.on('pageerror', (error) => {
    const line = `${label} page: ${error.message}`;
    errors.push(line);
    console.error(line);
  });
}

async function openDesktopPage(label, options = {}) {
  const context = await browser.newContext({
    viewport: {
      width: options.width ?? desktopWidth,
      height: options.height ?? desktopHeight,
    },
    deviceScaleFactor: 1,
  });
  if (Number.isFinite(options.simulationTimeScale) && options.simulationTimeScale > 1) {
    await context.addInitScript((scale) => {
      const nativeNow = performance.now.bind(performance);
      const origin = nativeNow();
      Object.defineProperty(performance, 'now', {
        configurable: true,
        value: () => origin + (nativeNow() - origin) * scale,
      });
    }, options.simulationTimeScale);
  }
  if (captureQuality) {
    await context.addInitScript((quality) => {
      localStorage.setItem('driftwake.preferences.v2', JSON.stringify({
        version: 2,
        audioEnabled: false,
        muteOnFocusLoss: true,
        cameraMotionMode: 'balanced',
        quality,
        dynamicResolutionEnabled: true,
        audioMix: { master: 0, music: 0, ambience: 0, effects: 0, creatures: 0, ui: 0 },
      }));
    }, captureQuality);
  }
  if (options.seedSave) {
    await context.addInitScript((save) => {
      localStorage.setItem(`driftwake.save.v${save.version}`, JSON.stringify(save));
    }, options.perimeterDefenseVisualStart ? perimeterDefenseVisualSave : options.perimeterDefenseStart ? perimeterDefenseSave : options.collectionNetStart ? collectionNetSave : options.failureStart ? failureSave : options.survivalPressureStart ? survivalPressureSave : options.structureDamageStart ? structureDamageSave : options.structureFloorCeilingStart ? structureFloorCeilingSave : options.structureRoofCeilingStart ? structureRoofCeilingSave : options.structureTraversalStart ? structureTraversalSave : options.structureVisualStart ? structureVisualSave : options.structureBuildStart ? structureBuildSave : options.durabilityHammerStart ? durabilityHammerSave : options.durabilityFishingStart ? durabilityFishingSave : options.durabilityAxeStart ? durabilityAxeSave : options.salvageStart ? salvageSave : options.signalStart ? signalNetworkSave : options.advancedStorageStart ? advancedStorageSave : options.advancedStart ? advancedDeviceSave : options.navigationStormStart ? navigationStormSave : options.navigationRiggingStart ? navigationRiggingSave : options.navigationHelmPlacementStart ? navigationHelmPlacementSave : options.progressionReadyStart ? progressionReadySave : options.progressionSmeltingStart ? progressionSmeltingSave : options.progressionResearchStart ? progressionResearchSave : options.progressionPlacementStart ? progressionPlacementSave : options.plantingBirdStart ? plantingBirdSave : options.plantingPlacementStart ? plantingPlacementSave : options.plantingStart ? plantingInteractionSave : options.driftRiskStart ? driftRiskSave : options.anchorStart ? anchorInteractionSave : options.underwaterStart ? underwaterSeededSave : options.interactionStart ? islandInteractionSave : options.islandStart ? islandSeededSave : seededSave);
  }
  const page = await context.newPage();
  monitorPage(page, label);
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  try {
    await page.waitForSelector('.primary-command:not(:disabled)', { timeout: 45_000 });
  } catch (error) {
    const commandState = await page.locator('.primary-command').evaluate((element) => ({
      disabled: element.disabled,
      text: element.textContent?.trim() ?? '',
      connected: element.isConnected,
    })).catch(() => ({ disabled: true, text: 'missing', connected: false }));
    const canvasState = await page.locator('canvas').evaluate((canvas) => {
      const gl = canvas.getContext('webgl2');
      return { width: canvas.width, height: canvas.height, contextLost: gl?.isContextLost() ?? true };
    }).catch(() => ({ width: 0, height: 0, contextLost: true }));
    await page.screenshot({ path: new URL('diagnostic-desktop.png', outputDir).pathname, timeout: 5_000 }).catch(() => undefined);
    const bodyText = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 400);
    throw new Error(`Game did not become ready. Command: ${JSON.stringify(commandState)}. Canvas: ${JSON.stringify(canvasState)}. Visible text: ${bodyText}`, { cause: error });
  }
  await page.waitForTimeout(250);
  return { context, page };
}

async function enterGame(page) {
  await page.getByRole('button', { name: '开始漂流', exact: true }).click();
  const enter = page.getByRole('button', { name: '继续漂流', exact: true });
  await enter.waitFor({ timeout: 45_000 });
  await enter.click({ force: true });
  await waitForRuntime(page, () => {
    const canvas = document.querySelector('canvas');
    const mount = document.querySelector('.game-mount');
    return document.pointerLockElement === canvas
      && mount?.dataset.contextHealthy === 'true'
      && mount?.dataset.simulationActive === 'true';
  }, 20_000);
  await page.waitForTimeout(250);
}

async function ensurePointerLock(page) {
  const locked = await page.evaluate(() => document.pointerLockElement === document.querySelector('canvas'));
  if (!locked) {
    await page.locator('canvas').click({ position: { x: desktopWidth / 2, y: desktopHeight / 2 } });
  }
  await waitForRuntime(page, () => {
    const canvas = document.querySelector('canvas');
    const mount = document.querySelector('.game-mount');
    return document.pointerLockElement === canvas && mount?.dataset.simulationActive === 'true';
  }, 5_000);
}

async function assertHookVisualOwnership(page, label, expected = 'any') {
  const state = await page.evaluate(() => {
    const data = document.querySelector('.game-mount')?.dataset;
    return {
      state: data?.hookState ?? 'missing',
      heldVisible: data?.hookHeldVisible === 'true',
      handsVisible: data?.hookHandsVisible === 'true',
      projectileVisible: data?.hookProjectileVisible === 'true',
      ropeVisible: data?.hookRopeVisible === 'true',
      ropeTension: Number(data?.hookRopeTension ?? Number.NaN),
      ropeSag: Number(data?.hookRopeSag ?? Number.NaN),
    };
  });
  if (state.state === 'missing' || state.state === 'uninitialized') {
    throw new Error(`${label} hook diagnostics unavailable: ${JSON.stringify(state)}`);
  }
  if (state.heldVisible && (state.projectileVisible || state.ropeVisible)) {
    throw new Error(`${label} rendered both held and deployed hooks: ${JSON.stringify(state)}`);
  }
  if (!Number.isFinite(state.ropeTension) || state.ropeTension < 0 || state.ropeTension > 1) {
    throw new Error(`${label} reported invalid rope tension: ${JSON.stringify(state)}`);
  }
  if (!Number.isFinite(state.ropeSag) || state.ropeSag < 0 || state.ropeSag > 1.25) {
    throw new Error(`${label} reported invalid rope sag: ${JSON.stringify(state)}`);
  }
  if (expected === 'held' && (
    state.state !== 'idle'
    || !state.heldVisible
    || !state.handsVisible
    || state.projectileVisible
    || state.ropeVisible
  )) {
    throw new Error(`${label} did not retain a single idle held hook: ${JSON.stringify(state)}`);
  }
  if (expected === 'deployed' && (
    state.heldVisible
    || !state.handsVisible
    || !state.projectileVisible
    || !state.ropeVisible
    || state.ropeTension <= 0
  )) {
    throw new Error(`${label} did not transfer ownership to the deployed hook: ${JSON.stringify(state)}`);
  }
  console.log(`${label} hook ownership: ${JSON.stringify(state)}`);
  return state;
}

async function waitForRuntime(page, predicate, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await page.evaluate(predicate)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  if (await page.evaluate(predicate)) return;
  throw new Error(`runtime condition timed out after ${timeout}ms`);
}

async function installNoticeHistory(page) {
  await page.evaluate(() => {
    globalThis.__driftwakeCaptureNotices = [];
    const recordNotice = () => {
      const text = document.querySelector('.loot-notice.is-visible')?.textContent?.trim();
      if (text && globalThis.__driftwakeCaptureNotices.at(-1) !== text) {
        globalThis.__driftwakeCaptureNotices.push(text);
      }
    };
    new MutationObserver(recordNotice).observe(document.body, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    });
    recordNotice();
  });
}

async function captureCompositedPage(page, path) {
  const cdp = await page.context().newCDPSession(page);
  const screenshot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
    optimizeForSpeed: true,
  });
  await cdp.detach();
  await writeFile(path, Buffer.from(screenshot.data, 'base64'));
}

async function inspectCanvasPixels(page, label) {
  let compositedData = null;
  const result = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { contextLost: true, variation: 0, nonBlack: 0, width: 0, height: 0 };
    const gl = canvas.getContext('webgl2');
    if (!gl || gl.isContextLost()) return { contextLost: true, variation: 0, nonBlack: 0, width: canvas.width, height: canvas.height };
    const width = Math.min(24, canvas.width);
    const height = Math.min(24, canvas.height);
    const pixels = new Uint8Array(width * height * 4);
    let min = 255;
    let max = 0;
    let nonBlack = 0;
    for (const [anchorX, anchorY] of [[0.2, 0.2], [0.8, 0.2], [0.5, 0.5], [0.2, 0.8], [0.8, 0.8]]) {
      gl.readPixels(
        Math.max(0, Math.floor(canvas.width * anchorX - width / 2)),
        Math.max(0, Math.floor(canvas.height * anchorY - height / 2)),
        width,
        height,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels,
      );
      for (let index = 0; index < pixels.length; index += 4) {
        const luminance = pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722;
        min = Math.min(min, luminance);
        max = Math.max(max, luminance);
        if (luminance > 4) nonBlack += 1;
      }
    }
    return { contextLost: false, variation: Math.round(max - min), nonBlack, width: canvas.width, height: canvas.height };
  });
  console.log(`${label} canvas pixels: ${JSON.stringify(result)}`);
  try {
    assertFrameContent(result, label);
  } catch (error) {
    if (result.contextLost) throw error;
    const cdp = await page.context().newCDPSession(page);
    const screenshot = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: false,
      optimizeForSpeed: true,
    });
    await cdp.detach();
    compositedData = screenshot.data;
    const encoded = {
      contextLost: false,
      width: result.width,
      height: result.height,
      encodedBytes: Math.floor(Buffer.byteLength(screenshot.data, 'base64') * 0.75),
    };
    assertEncodedFrameContent(encoded, label);
    console.log(`${label} composited frame fallback: ${JSON.stringify(encoded)}`);
  }
  return compositedData;
}

async function captureTitle() {
  const { context, page } = await openDesktopPage('title');
  const buttonStyle = await page.locator('.primary-command').evaluate((element) => ({
    backgroundColor: getComputedStyle(element).backgroundColor,
    disabled: element.disabled,
  }));
  console.log(`Title command: ${JSON.stringify(buttonStyle)}`);
  const titleRuntimeState = await page.evaluate(() => ({
    canvasFound: document.querySelector('canvas') !== null,
    worldResources: performance.getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((name) => /DriftwakeGame(?:-[^/?]+)?\.(?:js|ts)(?:\?|$)/.test(name)),
  }));
  if (titleRuntimeState.canvasFound || titleRuntimeState.worldResources.length > 0) {
    throw new Error(`Title loaded world resources before player intent: ${JSON.stringify(titleRuntimeState)}`);
  }
  console.log(`Title runtime gate: ${JSON.stringify(titleRuntimeState)}`);
  await page.screenshot({ path: new URL('title-desktop.png', outputDir).pathname });
  await context.close();
}

async function captureGame() {
  const { context, page } = await openDesktopPage('game');
  await enterGame(page);
  await page.waitForTimeout(2200);
  const canvasState = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { width: 0, height: 0, contextLost: true };
    const gl = canvas.getContext('webgl2');
    return { width: canvas.width, height: canvas.height, contextLost: gl?.isContextLost() ?? true };
  });
  console.log(`Game canvas before capture: ${JSON.stringify(canvasState)}`);
  const compositedData = await inspectCanvasPixels(page, 'game');
  const outputPath = new URL('game-desktop.png', outputDir);
  if (compositedData) await writeFile(outputPath, Buffer.from(compositedData, 'base64'));
  else await captureCompositedPage(page, outputPath);
  await context.close();
}

async function capturePause() {
  const context = await browser.newContext({
    viewport: { width: desktopWidth, height: desktopHeight },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: false,
  });
  await context.addInitScript(() => {
    localStorage.setItem('driftwake.preferences.v2', JSON.stringify({
      version: 2,
      audioEnabled: false,
      muteOnFocusLoss: true,
      cameraMotionMode: 'balanced',
      quality: 'low',
      dynamicResolutionEnabled: true,
      audioMix: { master: 0, music: 0, ambience: 0, effects: 0, creatures: 0, ui: 0 },
    }));
  });
  const page = await context.newPage();
  monitorPage(page, 'pause');
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '开始漂流', exact: true }).click();
  await page.getByRole('button', { name: '继续漂流', exact: true }).waitFor({ timeout: 45_000 });
  await page.waitForTimeout(700);
  const state = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const prompt = document.querySelector('.focus-prompt__content');
    const canvasBox = canvas?.getBoundingClientRect();
    const promptBox = prompt?.getBoundingClientRect();
    return {
      titleHidden: document.querySelector('.title-screen')?.getAttribute('aria-hidden') === 'true',
      pointerLocked: Boolean(document.pointerLockElement),
      cameraY: Number(document.querySelector('.game-mount')?.dataset.cameraY),
      canvas: canvasBox ? { width: canvasBox.width, height: canvasBox.height } : null,
      prompt: promptBox ? {
        left: promptBox.left,
        top: promptBox.top,
        right: promptBox.right,
        bottom: promptBox.bottom,
      } : null,
      viewport: { width: innerWidth, height: innerHeight },
    };
  });
  if (!state.titleHidden || state.pointerLocked) throw new Error(`Pause transition failed: ${JSON.stringify(state)}`);
  if (!Number.isFinite(state.cameraY) || state.cameraY < 1) throw new Error(`Pause camera was not initialized: ${JSON.stringify(state)}`);
  if (!state.canvas || state.canvas.width < state.viewport.width - 1 || state.canvas.height < state.viewport.height - 1) {
    throw new Error(`Pause canvas does not cover the viewport: ${JSON.stringify(state)}`);
  }
  if (!state.prompt || state.prompt.left < 0 || state.prompt.top < 0 || state.prompt.right > state.viewport.width || state.prompt.bottom > state.viewport.height) {
    throw new Error(`Pause controls overflow the viewport: ${JSON.stringify(state)}`);
  }
  console.log(`Pause transition: ${JSON.stringify(state)}`);
  await page.locator('canvas').evaluate((canvas) => {
    Object.defineProperty(canvas, 'requestPointerLock', {
      configurable: true,
      value: () => Promise.reject(new DOMException('Pointer Lock unavailable', 'NotSupportedError')),
    });
  });
  await page.getByRole('button', { name: '继续漂流', exact: true }).click({ force: true });
  await page.waitForTimeout(400);
  const deniedState = await page.evaluate(() => ({
    promptVisible: Boolean(document.querySelector('.focus-prompt')),
    pointerLocked: Boolean(document.pointerLockElement),
    pointerLockDenied: document.querySelector('.game-mount')?.dataset.pointerLockDenied,
    status: document.querySelector('.focus-prompt__status')?.textContent?.trim() ?? '',
    cameraY: Number(document.querySelector('.game-mount')?.dataset.cameraY),
  }));
  if (
    !deniedState.promptVisible
    || deniedState.pointerLocked
    || deniedState.pointerLockDenied !== 'true'
    || !deniedState.status.includes('浏览器未开放视角锁定')
    || !Number.isFinite(deniedState.cameraY)
    || deniedState.cameraY < 1
  ) {
    throw new Error(`Rejected Pointer Lock corrupted the pause view: ${JSON.stringify(deniedState)}`);
  }
  console.log(`Pause rejection gate: ${JSON.stringify(deniedState)}`);
  await page.screenshot({ path: new URL('pause-desktop-mode.png', outputDir).pathname, timeout: 90_000 });
  await context.close();
}

async function capturePack() {
  const { context, page } = await openDesktopPage('pack', { seedSave: true });
  await enterGame(page);
  await page.waitForTimeout(500);
  await page.keyboard.press('KeyI');
  await page.getByRole('dialog', { name: '野外背包' }).waitFor();
  await page.getByRole('button', { name: /潮汐净水器套件/ }).click();
  await page.screenshot({ path: new URL('pack-desktop.png', outputDir).pathname });
  await context.close();
}

async function captureCrafting() {
  const { context, page } = await openDesktopPage('crafting', { seedSave: true });
  await enterGame(page);
  await page.waitForTimeout(500);
  await page.keyboard.press('KeyC');
  const dialog = page.getByRole('dialog', { name: '野外背包' });
  await dialog.waitFor();
  const ropeRecipe = dialog.locator('.recipe-row').filter({ hasText: '编织绳' });
  await ropeRecipe.getByRole('button', { name: '增加编织绳制作数量' }).click({ force: true });
  await ropeRecipe.getByRole('button', { name: '增加编织绳制作数量' }).click({ force: true });
  await ropeRecipe.getByRole('button', { name: '将3个编织绳加入制作队列' }).click({ force: true });
  await page.waitForFunction(() => {
    const mount = document.querySelector('.game-mount');
    const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
    return mount?.dataset.craftingQueueLength === '3'
      && saved?.version === 13
      && saved?.player?.inventory?.fiber === 8
      && saved?.player?.crafting?.entries?.length === 3;
  });
  const cancelButtons = dialog.getByRole('button', { name: '取消编织绳并返还材料' });
  await cancelButtons.nth(2).click({ force: true });
  await page.waitForFunction(() => {
    const mount = document.querySelector('.game-mount');
    const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
    return mount?.dataset.craftingQueueLength === '2'
      && saved?.player?.inventory?.fiber === 10
      && saved?.player?.crafting?.entries?.length === 2;
  });
  const queuedState = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
    const mount = document.querySelector('.game-mount');
    const dialog = document.querySelector('.field-pack');
    const catalog = document.querySelector('.crafting-catalog');
    const queue = document.querySelector('.crafting-queue');
    const dialogRect = dialog?.getBoundingClientRect();
    const catalogRect = catalog?.getBoundingClientRect();
    const queueRect = queue?.getBoundingClientRect();
    return {
      queueLength: Number(mount?.dataset.craftingQueueLength),
      active: mount?.dataset.craftingActive,
      fiber: saved?.player?.inventory?.fiber,
      savedQueueLength: saved?.player?.crafting?.entries?.length,
      queueText: document.querySelector('.crafting-queue')?.textContent?.replace(/\s+/g, ' ').trim(),
      layout: {
        viewport: { width: innerWidth, height: innerHeight },
        dialog: dialogRect ? { left: dialogRect.left, top: dialogRect.top, right: dialogRect.right, bottom: dialogRect.bottom } : null,
        catalog: catalogRect ? { left: catalogRect.left, top: catalogRect.top, right: catalogRect.right, bottom: catalogRect.bottom } : null,
        queue: queueRect ? { left: queueRect.left, top: queueRect.top, right: queueRect.right, bottom: queueRect.bottom } : null,
        recipeOverflow: [...document.querySelectorAll('.recipe-row')].some((row) => row.scrollWidth > row.clientWidth + 2),
        queueOverflow: queue ? queue.scrollWidth > queue.clientWidth + 2 : true,
      },
    };
  });
  const { layout } = queuedState;
  const panelsSeparated = layout.viewport.width > 640
    ? layout.catalog && layout.queue && layout.queue.left >= layout.catalog.right - 1
    : layout.catalog && layout.queue && layout.catalog.top >= layout.queue.bottom - 1;
  if (
    !layout.dialog
    || layout.dialog.left < 0
    || layout.dialog.top < 0
    || layout.dialog.right > layout.viewport.width
    || layout.dialog.bottom > layout.viewport.height
    || !panelsSeparated
    || layout.recipeOverflow
    || layout.queueOverflow
  ) {
    throw new Error(`Crafting layout gate failed: ${JSON.stringify(layout)}`);
  }
  console.log(`Crafting queued/cancelled state: ${JSON.stringify(queuedState)}`);
  if (process.env.CAPTURE_FAST !== '1') {
    await captureCompositedPage(page, new URL('crafting-desktop.png', outputDir).pathname);
    const advancedRecipe = page.locator('.recipe-row').filter({ hasText: '潮镜五联净水器' });
    await advancedRecipe.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    await captureCompositedPage(page, new URL('crafting-advanced-desktop.png', outputDir).pathname);
  }
  await dialog.getByRole('button', { name: '取消编织绳并返还材料' }).last().click({ force: true });
  await page.waitForFunction(() => {
    const mount = document.querySelector('.game-mount');
    const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
    return mount?.dataset.craftingQueueLength === '1'
      && saved?.player?.inventory?.fiber === 12
      && saved?.player?.crafting?.entries?.length === 1;
  });
  await dialog.getByRole('button', { name: '关闭背包' }).click({ force: true });
  const resume = page.getByRole('button', { name: '继续漂流', exact: true });
  await resume.waitFor({ timeout: 10_000 });
  await resume.click({ force: true });
  await waitForRuntime(page, () => (
    document.pointerLockElement === document.querySelector('canvas')
    && document.querySelector('.game-mount')?.dataset.simulationActive === 'true'
  ), 10_000);
  await waitForRuntime(page, () => (
    document.querySelector('.game-mount')?.dataset.craftingQueueLength === '0'
    && Number(document.querySelector('.game-mount')?.dataset.craftingCompletedCount) >= 1
  ), 60_000);
  const completedState = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
    const data = document.querySelector('.game-mount')?.dataset;
    return {
      queueLength: Number(data?.craftingQueueLength),
      completed: Number(data?.craftingCompletedCount),
      blocked: data?.craftingBlocked,
      fiber: saved?.player?.inventory?.fiber,
      rope: saved?.player?.inventory?.rope,
      savedQueueLength: saved?.player?.crafting?.entries?.length,
    };
  });
  if (
    completedState.queueLength !== 0
    || completedState.completed < 1
    || completedState.blocked !== 'none'
    || completedState.fiber !== 12
    || completedState.rope !== 6
    || completedState.savedQueueLength !== 0
  ) {
    throw new Error(`Crafting completion/save gate failed: ${JSON.stringify(completedState)}`);
  }
  console.log(`Crafting completion/save gate: ${JSON.stringify(completedState)}`);
  await context.close();
}

async function captureSurvivalPressure() {
  const { context, page } = await openDesktopPage('survival-pressure', { seedSave: true, survivalPressureStart: true });
  await installNoticeHistory(page);
  await enterGame(page);
  await waitForRuntime(page, () => {
    const data = document.querySelector('.game-mount')?.dataset;
    return data?.survivalThirstBand === 'critical' && data?.survivalHungerBand === 'low';
  }, 10_000);
  await page.waitForFunction(
    () => globalThis.__driftwakeCaptureNotices?.includes('严重缺水'),
    undefined,
    { timeout: 3_000 },
  );
  const pressureState = await page.evaluate(() => {
    const data = document.querySelector('.game-mount')?.dataset;
    const cluster = document.querySelector('.survival-cluster')?.getBoundingClientRect();
    const hotbar = document.querySelector('.hotbar')?.getBoundingClientRect();
    return {
      thirstBand: data?.survivalThirstBand,
      hungerBand: data?.survivalHungerBand,
      thirstRunway: Number(data?.thirstRunwaySeconds),
      hungerRunway: Number(data?.hungerRunwaySeconds),
      noticeHistory: globalThis.__driftwakeCaptureNotices ?? [],
      thirstCritical: Boolean(document.querySelector('.survival-gauge--thirst.is-critical')),
      hungerLow: Boolean(document.querySelector('.survival-gauge--hunger.is-low')),
      cluster: cluster ? { left: cluster.left, top: cluster.top, right: cluster.right, bottom: cluster.bottom } : null,
      hotbar: hotbar ? { left: hotbar.left, top: hotbar.top, right: hotbar.right, bottom: hotbar.bottom } : null,
      viewport: { width: innerWidth, height: innerHeight },
    };
  });
  if (
    !pressureState.thirstCritical
    || !pressureState.hungerLow
    || !pressureState.noticeHistory.includes('严重缺水')
    || pressureState.noticeHistory.includes('饱食偏低')
    || pressureState.thirstRunway < 850
    || pressureState.hungerRunway < 1600
    || !pressureState.cluster
    || !pressureState.hotbar
    || pressureState.cluster.right > pressureState.hotbar.left - 4
    || pressureState.cluster.left < 0
    || pressureState.cluster.bottom > pressureState.viewport.height
  ) {
    throw new Error(`Survival pressure HUD gate failed: ${JSON.stringify(pressureState)}`);
  }
  console.log(`Survival pressure HUD gate: ${JSON.stringify(pressureState)}`);
  if (process.env.CAPTURE_FAST !== '1') {
    await captureCompositedPage(page, new URL('survival-pressure-desktop.png', outputDir).pathname);
  }

  await page.keyboard.press('KeyI');
  const dialog = page.getByRole('dialog', { name: '野外背包' });
  await dialog.waitFor();
  await dialog.getByRole('button', { name: '密封淡水 1' }).click({ force: true });
  await dialog.getByRole('button', { name: '饮用' }).click({ force: true });
  await page.waitForFunction(() => document.querySelector('.field-pack__feedback')?.textContent?.includes('淡水 · 水分 +34'));
  await dialog.getByRole('button', { name: '海员口粮 1' }).click({ force: true });
  await dialog.getByRole('button', { name: '食用' }).click({ force: true });
  await page.waitForFunction(() => document.querySelector('.field-pack__feedback')?.textContent?.includes('口粮 · 水分 -2 · 饱食 +28'));

  const recoveryState = await page.evaluate(() => {
    const data = document.querySelector('.game-mount')?.dataset;
    const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
    const dialog = document.querySelector('.field-pack')?.getBoundingClientRect();
    const feedback = document.querySelector('.field-pack__feedback')?.getBoundingClientRect();
    return {
      thirstBand: data?.survivalThirstBand,
      hungerBand: data?.survivalHungerBand,
      survival: saved?.player?.survival,
      inventory: saved?.player?.inventory,
      feedbackText: document.querySelector('.field-pack__feedback')?.textContent?.trim(),
      feedbackVisible: document.querySelector('.field-pack__feedback')?.classList.contains('is-visible'),
      feedbackInDialog: Boolean(
        dialog && feedback
        && feedback.left >= dialog.left
        && feedback.right <= dialog.right
        && feedback.top >= dialog.top
        && feedback.bottom <= dialog.bottom
      ),
    };
  });
  if (
    recoveryState.thirstBand !== 'stable'
    || recoveryState.hungerBand !== 'stable'
    || recoveryState.survival?.thirst < 45
    || recoveryState.survival?.thirst > 49
    || recoveryState.survival?.hunger < 53
    || recoveryState.survival?.hunger > 55
    || recoveryState.inventory?.emergencyWater
    || recoveryState.inventory?.ration
    || !recoveryState.feedbackVisible
    || !recoveryState.feedbackInDialog
  ) {
    throw new Error(`Survival supply recovery/save gate failed: ${JSON.stringify(recoveryState)}`);
  }
  console.log(`Survival supply recovery/save gate: ${JSON.stringify(recoveryState)}`);
  await context.close();
}

async function captureToolDurability() {
  const durabilityPart = process.env.DURABILITY_PART ?? 'all';
  if (durabilityPart === 'all' || durabilityPart === 'hammer') {
  const hammerRun = await openDesktopPage('durability-hammer', { seedSave: true, durabilityHammerStart: true });
  await installNoticeHistory(hammerRun.page);
  await enterGame(hammerRun.page);
  console.log('Hammer durability runtime entered');
  await hammerRun.page.mouse.click(desktopWidth / 2, desktopHeight / 2);
  await hammerRun.page.waitForTimeout(450);
  const emptyHammerWear = Number(await hammerRun.page.locator('.game-mount').getAttribute('data-tool-wear-event-count'));
  if (emptyHammerWear !== 0) throw new Error(`Empty hammer action consumed durability: ${emptyHammerWear}`);
  await hammerRun.page.evaluate(() => {
    const movement = new MouseEvent('mousemove');
    Object.defineProperties(movement, {
      movementX: { value: 303 },
      movementY: { value: 409 },
    });
    document.dispatchEvent(movement);
  });
  await hammerRun.page.waitForFunction(
    () => document.querySelector('.interaction-prompt')?.textContent?.includes('修补受损筏格'),
    undefined,
    { timeout: 5_000 },
  ).catch(() => undefined);
  const hammerPrompt = await readInteractionPrompt(hammerRun.page);
  if (!hammerPrompt.includes('修补受损筏格')) {
    const buildDiagnostics = await hammerRun.page.evaluate(() => {
      const data = document.querySelector('.game-mount')?.dataset;
      return { mode: data?.buildMode, target: data?.buildTarget, hovered: data?.buildHovered };
    });
    await hammerRun.page.screenshot({ path: new URL('durability-hammer-diagnostic.png', outputDir).pathname, timeout: 5_000 }).catch(() => undefined);
    throw new Error(`Expected repair prompt for durability gate, received: ${hammerPrompt}; ${JSON.stringify(buildDiagnostics)}`);
  }
  await hammerRun.page.mouse.click(desktopWidth / 2, desktopHeight / 2);
  await waitForRuntime(
    hammerRun.page,
    () => document.querySelector('.game-mount')?.dataset.lastToolWear === 'repair:hammer:0',
    5_000,
  );
  const hammerState = await hammerRun.page.evaluate(() => {
    const mount = document.querySelector('.game-mount');
    const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
    return {
      wearEvents: Number(mount?.dataset.toolWearEventCount),
      lastWear: mount?.dataset.lastToolWear,
      durability: JSON.parse(mount?.dataset.toolDurability ?? '{}'),
      notices: globalThis.__driftwakeCaptureNotices ?? [],
      selectedTool: saved?.player?.selectedTool,
      inventory: saved?.player?.inventory,
      savedDurability: saved?.player?.toolDurability,
      repairedHealth: saved?.raft?.tiles?.find((tile) => tile.x === 1 && tile.z === -1)?.health,
    };
  });
  if (
    hammerState.wearEvents !== 1
    || hammerState.lastWear !== 'repair:hammer:0'
    || hammerState.durability.hammer !== undefined
    || hammerState.inventory?.hammer
    || hammerState.savedDurability?.hammer !== undefined
    || hammerState.selectedTool !== 'hook'
    || hammerState.repairedHealth !== 100
    || !hammerState.notices.some((notice) => notice.includes('建造锤损坏'))
  ) {
    throw new Error(`Hammer durability transaction failed: ${JSON.stringify(hammerState)}`);
  }
  console.log(`Hammer durability gate: ${JSON.stringify(hammerState)}`);
  if (process.env.CAPTURE_FAST !== '1') {
    await captureCompositedPage(hammerRun.page, new URL('durability-hammer-desktop.png', outputDir).pathname);
  }
  await hammerRun.context.close();
  if (durabilityPart === 'hammer') return;
  }

  if (durabilityPart === 'all' || durabilityPart === 'fishing') {
  const fishingViewport = { width: 240, height: 160 };
  const fishingRun = await openDesktopPage('durability-fishing', {
    seedSave: true,
    durabilityFishingStart: true,
    ...fishingViewport,
  });
  await installNoticeHistory(fishingRun.page);
  await enterGame(fishingRun.page);
  await fishingRun.page.evaluate(() => {
    document.querySelector('canvas')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));
  });
  try {
    await waitForRuntime(
      fishingRun.page,
      () => document.querySelector('.game-mount')?.dataset.fishingPhase === 'casting',
      5_000,
    );
  } catch (error) {
    const diagnostics = await fishingRun.page.evaluate(() => {
      const mount = document.querySelector('.game-mount');
      return {
        phase: mount?.dataset.fishingPhase,
        simulationActive: mount?.dataset.simulationActive,
        pointerLocked: document.pointerLockElement === document.querySelector('canvas'),
        activeTool: document.querySelector('.hotbar-slot.is-active')?.getAttribute('aria-label'),
      };
    });
    throw new Error(`Fishing cast did not start: ${JSON.stringify(diagnostics)}`, { cause: error });
  }
  try {
    await waitForRuntime(
      fishingRun.page,
      () => document.querySelector('.game-mount')?.dataset.fishingPhase === 'nibble',
      45_000,
    );
  } catch (error) {
    const diagnostics = await fishingRun.page.evaluate(() => {
      const data = document.querySelector('.game-mount')?.dataset;
      return {
        phase: data?.fishingPhase,
        tension: data?.fishingTension,
        progress: data?.fishingProgress,
        simulationTicks: data?.simulationTickCount,
      };
    });
    throw new Error(`Fishing bite did not arrive: ${JSON.stringify(diagnostics)}`, { cause: error });
  }
  await fishingRun.page.evaluate(() => {
    document.querySelector('canvas')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
  });
  let holdingReel = true;
  const fishingDeadline = Date.now() + 300_000;
  let nextFightLogAt = Date.now() + 15_000;
  let lastFight = null;
  while (Date.now() < fishingDeadline) {
    const fight = await fishingRun.page.evaluate(() => {
      const data = document.querySelector('.game-mount')?.dataset;
      return {
        phase: data?.fishingPhase,
        tension: Number(data?.fishingTension),
        progress: Number(data?.fishingProgress),
        wearEvents: Number(data?.toolWearEventCount),
      };
    });
    lastFight = fight;
    if (fight.wearEvents >= 1) break;
    if (fight.phase === 'lost' || fight.phase === 'idle') break;
    if (holdingReel && fight.tension >= 0.68) {
      await fishingRun.page.evaluate(() => {
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));
      });
      holdingReel = false;
    } else if (!holdingReel && fight.tension <= 0.42) {
      await fishingRun.page.evaluate(() => {
        document.querySelector('canvas')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
      });
      holdingReel = true;
    }
    if (Date.now() >= nextFightLogAt) {
      console.log(`Fishing fight checkpoint: ${JSON.stringify(fight)}`);
      nextFightLogAt += 15_000;
    }
    await fishingRun.page.waitForTimeout(80);
  }
  if (holdingReel) {
    await fishingRun.page.evaluate(() => {
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));
    });
  }
  if ((lastFight?.wearEvents ?? 0) < 1) {
    const notices = await fishingRun.page.evaluate(() => globalThis.__driftwakeCaptureNotices ?? []);
    throw new Error(`Fishing fight did not settle before deadline: ${JSON.stringify({ ...lastFight, notices })}`);
  }
  await waitForRuntime(
    fishingRun.page,
    () => document.querySelector('.game-mount')?.dataset.lastToolWear === 'fishing-catch:fishingRod:0',
    5_000,
  );
  const fishingState = await fishingRun.page.evaluate(() => {
    const mount = document.querySelector('.game-mount');
    const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
    return {
      phase: mount?.dataset.fishingPhase,
      wearEvents: Number(mount?.dataset.toolWearEventCount),
      lastWear: mount?.dataset.lastToolWear,
      notices: globalThis.__driftwakeCaptureNotices ?? [],
      inventory: saved?.player?.inventory,
      savedDurability: saved?.player?.toolDurability,
      selectedTool: saved?.player?.selectedTool,
    };
  });
  if (
    fishingState.phase !== 'idle'
    || fishingState.wearEvents !== 1
    || fishingState.inventory?.rawFish !== 1
    || fishingState.inventory?.fishingRod
    || fishingState.savedDurability?.fishingRod !== undefined
    || fishingState.selectedTool !== 'hook'
    || !fishingState.notices.some((notice) => notice.includes('钓竿损坏'))
  ) {
    throw new Error(`Fishing durability transaction failed: ${JSON.stringify(fishingState)}`);
  }
  console.log(`Fishing durability gate: ${JSON.stringify(fishingState)}`);
  await fishingRun.context.close();
  if (durabilityPart === 'fishing') return;
  }

  if (durabilityPart !== 'all' && durabilityPart !== 'axe') {
    throw new Error(`Unknown DURABILITY_PART: ${durabilityPart}`);
  }
  const axeViewport = { width: 640, height: 480 };
  const axeRun = await openDesktopPage('durability-axe', {
    seedSave: true,
    durabilityAxeStart: true,
    ...axeViewport,
  });
  await installNoticeHistory(axeRun.page);
  await enterGame(axeRun.page);
  await axeRun.page.waitForFunction(() => {
    const aim = JSON.parse(document.querySelector('.game-mount')?.dataset.axeAim ?? '{}');
    return Boolean(aim.closestPalm?.center);
  }, undefined, { timeout: 10_000 });
  await axeRun.page.evaluate(() => {
    const aim = JSON.parse(document.querySelector('.game-mount')?.dataset.axeAim ?? '{}');
    const [cameraX, cameraY, cameraZ] = aim.camera;
    const [forwardX, forwardY, forwardZ] = aim.forward;
    const [targetX, targetY, targetZ] = aim.closestPalm.center;
    const deltaX = targetX - cameraX;
    const deltaY = targetY - cameraY;
    const deltaZ = targetZ - cameraZ;
    const distance = Math.hypot(deltaX, deltaY, deltaZ);
    const desiredYaw = Math.atan2(-deltaX / distance, -deltaZ / distance);
    const desiredPitch = Math.asin(deltaY / distance);
    const currentYaw = Math.atan2(-forwardX, -forwardZ);
    const currentPitch = Math.asin(forwardY);
    const yawDelta = Math.atan2(Math.sin(currentYaw - desiredYaw), Math.cos(currentYaw - desiredYaw));
    const movement = new MouseEvent('mousemove');
    Object.defineProperties(movement, {
      movementX: { value: yawDelta / 0.00175 },
      movementY: { value: (currentPitch - desiredPitch) / 0.00155 },
    });
    document.dispatchEvent(movement);
  });
  await axeRun.page.waitForFunction(
    () => document.querySelector('.interaction-prompt')?.textContent?.includes('砍伐盐冠棕榈'),
    undefined,
    { timeout: 20_000 },
  ).catch(() => undefined);
  const axePrompt = await readInteractionPrompt(axeRun.page);
  if (!axePrompt.includes('砍伐盐冠棕榈')) {
    const aim = await axeRun.page.evaluate(() => JSON.parse(document.querySelector('.game-mount')?.dataset.axeAim ?? '{}'));
    await axeRun.page.screenshot({ path: new URL('durability-axe-diagnostic.png', outputDir).pathname, timeout: 5_000 }).catch(() => undefined);
    throw new Error(`Expected palm chopping prompt for durability gate, received: ${axePrompt}; ${JSON.stringify(aim)}`);
  }
  await axeRun.page.mouse.click(axeViewport.width / 2, axeViewport.height / 2);
  await waitForRuntime(
    axeRun.page,
    () => document.querySelector('.game-mount')?.dataset.lastToolWear === 'axe-hit:axe:0',
    5_000,
  );
  const axeState = await axeRun.page.evaluate(() => {
    const mount = document.querySelector('.game-mount');
    const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
    return {
      wearEvents: Number(mount?.dataset.toolWearEventCount),
      lastWear: mount?.dataset.lastToolWear,
      notices: globalThis.__driftwakeCaptureNotices ?? [],
      inventory: saved?.player?.inventory,
      savedDurability: saved?.player?.toolDurability,
      selectedTool: saved?.player?.selectedTool,
      damagedPalms: saved?.world?.island?.nodes?.filter((node) => node.id.startsWith('palm-') && node.health === 2).length,
    };
  });
  if (
    axeState.wearEvents !== 1
    || axeState.inventory?.axe
    || axeState.savedDurability?.axe !== undefined
    || axeState.selectedTool !== 'hook'
    || axeState.damagedPalms !== 1
    || !axeState.notices.some((notice) => notice.includes('石斧损坏'))
  ) {
    throw new Error(`Axe durability transaction failed: ${JSON.stringify(axeState)}`);
  }
  console.log(`Axe durability gate: ${JSON.stringify(axeState)}`);
  await axeRun.context.close();
}

async function captureBuildingStructures() {
  const buildingPart = process.env.BUILDING_PART ?? 'all';
  if (!['all', 'behavior', 'visual', 'traversal', 'ceiling', 'damage'].includes(buildingPart)) {
    throw new Error(`Unknown BUILDING_PART: ${buildingPart}`);
  }
  if (buildingPart === 'visual') {
    await captureBuildingStructureVisual();
    return;
  }
  if (buildingPart === 'traversal') {
    await captureBuildingTraversal();
    return;
  }
  if (buildingPart === 'ceiling') {
    await captureBuildingCeiling();
    return;
  }
  if (buildingPart === 'damage') {
    await captureBuildingDamageRepair();
    return;
  }
  const viewport = { width: 1024, height: 640 };
  const { context, page } = await openDesktopPage('building', {
    seedSave: true,
    structureBuildStart: true,
    ...viewport,
  });
  await installNoticeHistory(page);
  await enterGame(page);
  await waitForRuntime(page, () => {
    const data = document.querySelector('.game-mount')?.dataset;
    return data?.raftStructureCount === '10' && data?.buildPiece === 'foundation';
  }, 10_000);
  await page.keyboard.press('Digit1');
  await page.waitForFunction(() => {
    const aim = JSON.parse(document.querySelector('.game-mount')?.dataset.structureDoorAim ?? '{}');
    return Boolean(aim.closestDoor?.center);
  }, undefined, { timeout: 8_000 });
  const doorMovement = { x: 0, y: 0 };
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const correction = await page.evaluate(() => {
      const aim = JSON.parse(document.querySelector('.game-mount')?.dataset.structureDoorAim ?? '{}');
      const [cameraX, cameraY, cameraZ] = aim.camera;
      const [forwardX, forwardY, forwardZ] = aim.forward;
      const [targetX, targetY, targetZ] = aim.closestDoor.center;
      const deltaX = targetX - cameraX;
      const deltaY = targetY - cameraY;
      const deltaZ = targetZ - cameraZ;
      const distance = Math.hypot(deltaX, deltaY, deltaZ);
      const desiredYaw = Math.atan2(-deltaX / distance, -deltaZ / distance);
      const desiredPitch = Math.asin(deltaY / distance);
      const currentYaw = Math.atan2(-forwardX, -forwardZ);
      const currentPitch = Math.asin(forwardY);
      const movementX = Math.atan2(
        Math.sin(currentYaw - desiredYaw),
        Math.cos(currentYaw - desiredYaw),
      ) / 0.00175;
      const movementY = (currentPitch - desiredPitch) / 0.00155;
      const movement = new MouseEvent('mousemove');
      Object.defineProperties(movement, {
        movementX: { value: movementX },
        movementY: { value: movementY },
      });
      document.dispatchEvent(movement);
      return { x: movementX, y: movementY };
    });
    doorMovement.x += correction.x;
    doorMovement.y += correction.y;
    await page.waitForTimeout(280);
    if (await page.evaluate(() => document.querySelector('.game-mount')?.dataset.structureFocusedDoor === 'showcase-door')) break;
  }
  console.log(`Building door aim movement: ${JSON.stringify(doorMovement)}`);
  try {
    await waitForRuntime(
      page,
      () => document.querySelector('.game-mount')?.dataset.structureFocusedDoor === 'showcase-door',
      8_000,
    );
  } catch (error) {
    const diagnostics = await page.evaluate(() => {
      const data = document.querySelector('.game-mount')?.dataset;
      return {
        focusedDoor: data?.structureFocusedDoor,
        aim: JSON.parse(data?.structureDoorAim ?? '{}'),
        interaction: document.querySelector('.interaction-prompt')?.textContent,
        activeTool: document.querySelector('.hotbar-slot.is-active')?.getAttribute('aria-label'),
      };
    });
    throw new Error(`Building door focus failed: ${JSON.stringify(diagnostics)}`, { cause: error });
  }
  await page.keyboard.press('KeyE');
  await waitForRuntime(page, () => {
    const data = document.querySelector('.game-mount')?.dataset;
    const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
    return data?.structureOpenDoors === '0'
      && saved?.raft?.structures?.find((structure) => structure.id === 'showcase-door')?.open === false;
  }, 5_000);
  await page.evaluate((appliedMovement) => {
    const movement = new MouseEvent('mousemove');
    Object.defineProperties(movement, {
      movementX: { value: -appliedMovement.x },
      movementY: { value: -appliedMovement.y },
    });
    document.dispatchEvent(movement);
  }, doorMovement);
  await page.keyboard.press('Digit2');
  await page.evaluate(() => {
    document.querySelector('canvas')?.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: 120,
    }));
  });
  await waitForRuntime(page, () => document.querySelector('.game-mount')?.dataset.buildPiece === 'wall', 5_000);
  await page.keyboard.press('KeyR');
  await waitForRuntime(page, () => document.querySelector('.game-mount')?.dataset.buildRotation === '1', 5_000);
  const wallMovement = { x: 0, y: 0 };
  for (let iteration = 0; iteration < 5; iteration += 1) {
    const correction = await page.evaluate(([targetX, targetY, targetZ]) => {
      const aim = JSON.parse(document.querySelector('.game-mount')?.dataset.structureDoorAim ?? '{}');
      const [cameraX, cameraY, cameraZ] = aim.camera;
      const [forwardX, forwardY, forwardZ] = aim.forward;
      const deltaX = targetX - cameraX;
      const deltaY = targetY - cameraY;
      const deltaZ = targetZ - cameraZ;
      const distance = Math.hypot(deltaX, deltaY, deltaZ);
      const desiredYaw = Math.atan2(-deltaX / distance, -deltaZ / distance);
      const desiredPitch = Math.asin(deltaY / distance);
      const currentYaw = Math.atan2(-forwardX, -forwardZ);
      const currentPitch = Math.asin(forwardY);
      const movementX = Math.atan2(
        Math.sin(currentYaw - desiredYaw),
        Math.cos(currentYaw - desiredYaw),
      ) / 0.00175;
      const movementY = (currentPitch - desiredPitch) / 0.00155;
      const movement = new MouseEvent('mousemove');
      Object.defineProperties(movement, {
        movementX: { value: movementX },
        movementY: { value: movementY },
      });
      document.dispatchEvent(movement);
      return { x: movementX, y: movementY };
    }, [1.44, 0.08, -1.38]);
    wallMovement.x += correction.x;
    wallMovement.y += correction.y;
    await page.waitForTimeout(280);
    if (await page.evaluate(() => {
      const data = document.querySelector('.game-mount')?.dataset;
      return data?.buildMode === 'build'
        && data?.buildTarget === '1,-1'
        && data?.buildStructureTarget === 'wall:1,-1:0:1';
    })) break;
  }
  console.log(`Building wall aim movement: ${JSON.stringify(wallMovement)}`);
  await waitForRuntime(page, () => {
    const data = document.querySelector('.game-mount')?.dataset;
    return data?.buildMode === 'build'
      && data?.buildTarget === '1,-1'
      && data?.buildStructureTarget === 'wall:1,-1:0:1';
  }, 8_000);
  await page.mouse.click(viewport.width / 2, viewport.height / 2);
  await waitForRuntime(page, () => {
    const data = document.querySelector('.game-mount')?.dataset;
    return data?.raftStructureCount === '11' && data?.lastToolWear === 'build:hammer:79';
  }, 8_000);
  await page.waitForTimeout(450);
  await page.keyboard.press('KeyF');
  await waitForRuntime(page, () => {
    const data = document.querySelector('.game-mount')?.dataset;
    return data?.buildLevel === '1'
      && data?.buildMode === 'invalid'
      && data?.buildStructureTarget === 'wall:1,-1:1:1';
  }, 5_000);
  await page.mouse.click(viewport.width / 2, viewport.height / 2);
  await page.waitForTimeout(400);
  const state = await page.evaluate(() => {
    const mount = document.querySelector('.game-mount');
    const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
    const palette = document.querySelector('.build-palette');
    const paletteRect = palette?.getBoundingClientRect();
    return {
      piece: mount?.dataset.buildPiece,
      rotation: mount?.dataset.buildRotation,
      level: mount?.dataset.buildLevel,
      mode: mount?.dataset.buildMode,
      structureCount: Number(mount?.dataset.raftStructureCount),
      wear: mount?.dataset.lastToolWear,
      inventory: saved?.player?.inventory,
      durability: saved?.player?.toolDurability,
      savedStructures: saved?.raft?.structures,
      notices: globalThis.__driftwakeCaptureNotices ?? [],
      palette: paletteRect ? {
        left: paletteRect.left,
        right: paletteRect.right,
        top: paletteRect.top,
        bottom: paletteRect.bottom,
      } : null,
      activePieces: document.querySelectorAll('.build-palette__pieces > .is-active').length,
      doorOpen: saved?.raft?.structures?.find((structure) => structure.id === 'showcase-door')?.open,
    };
  });
  const placedWall = state.savedStructures?.find((structure) =>
    structure.type === 'wall'
      && structure.x === 1
      && structure.z === -1
      && structure.level === 0
      && structure.rotation === 1,
  );
  if (
    state.piece !== 'wall'
    || state.rotation !== '1'
    || state.level !== '1'
    || state.mode !== 'invalid'
    || state.structureCount !== 11
    || state.inventory?.timber !== 45
    || state.inventory?.rope !== 23
    || state.durability?.hammer !== 79
    || !placedWall
    || state.doorOpen !== false
    || state.savedStructures?.length !== 11
    || !state.notices.some((notice) => notice.includes('木墙已固定'))
    || !state.notices.some((notice) => notice.includes('板门已合拢'))
    || state.activePieces !== 1
    || !state.palette
    || state.palette.left < 0
    || state.palette.right > viewport.width
    || state.palette.top < 0
    || state.palette.bottom > viewport.height
  ) {
    throw new Error(`Building structure transaction failed: ${JSON.stringify(state)}`);
  }
  console.log(`Building structure gate: ${JSON.stringify({ ...state, savedStructures: state.savedStructures.length })}`);
  await context.close();
  if (process.env.CAPTURE_FAST === '1' || buildingPart === 'behavior') return;

  await captureBuildingStructureVisual();
  await captureBuildingTraversal();
  await captureBuildingCeiling();
  await captureBuildingDamageRepair();
}

async function captureBuildingStructureVisual() {
  const visual = await openDesktopPage('building-visual', {
    seedSave: true,
    structureVisualStart: true,
    width: 512,
    height: 320,
  });
  await enterGame(visual.page);
  await waitForRuntime(
    visual.page,
    () => document.querySelector('.game-mount')?.dataset.raftStructureCount === '11',
    10_000,
  );
  await visual.page.waitForTimeout(500);
  const layout = await visual.page.evaluate(() => {
    const box = (selector) => {
      const rect = document.querySelector(selector)?.getBoundingClientRect();
      return rect ? { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom } : null;
    };
    const overlaps = (a, b) => Boolean(a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);
    const palette = box('.build-palette');
    const prompt = box('.interaction-prompt.is-visible');
    const hotbar = box('.hotbar');
    return {
      palette,
      prompt,
      hotbar,
      palettePromptOverlap: overlaps(palette, prompt),
      paletteHotbarOverlap: overlaps(palette, hotbar),
      width: innerWidth,
      height: innerHeight,
    };
  });
  if (
    !layout.palette
    || !layout.hotbar
    || layout.palette.left < 0
    || layout.palette.right > layout.width
    || layout.palette.top < 0
    || layout.palette.bottom > layout.height
    || layout.palettePromptOverlap
    || layout.paletteHotbarOverlap
  ) {
    throw new Error(`Building visual layout failed: ${JSON.stringify(layout)}`);
  }
  console.log(`Building visual layout: ${JSON.stringify(layout)}`);
  await captureCompositedPage(
    visual.page,
    new URL('building-structures-desktop.png', outputDir).pathname,
  );
  await visual.context.close();
}

async function captureBuildingTraversal() {
  const traversal = await openDesktopPage('building-traversal', {
    seedSave: true,
    structureTraversalStart: true,
    width: 1024,
    height: 640,
  });
  let { context } = traversal;
  let { page } = traversal;
  await enterGame(page);
  await waitForRuntime(page, () => {
    const data = document.querySelector('.game-mount')?.dataset;
    return data?.raftStructureCount === '3'
      && Number(data?.playerRaftFootY) < 0.12
      && data?.playerRaftSurface === 'stairs';
  }, 10_000);

  await page.keyboard.down('KeyW');
  await waitForRuntime(page, () => {
    const data = document.querySelector('.game-mount')?.dataset;
    return Number(data?.playerRaftFootY) > 2.14
      && Number(data?.playerLocalZ) < 0.68
      && data?.playerRaftSurface === 'floor';
  }, 8_000);
  await page.keyboard.up('KeyW');
  await page.evaluate(() => window.dispatchEvent(new Event('beforeunload')));
  await waitForRuntime(page, () => {
    const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
    return saved?.player?.navigation?.surface === 'raft'
      && Math.abs((saved?.player?.navigation?.y ?? 0) - 2.18) < 0.02;
  }, 5_000);
  const upperBeforeReload = await page.evaluate(() => {
    const data = document.querySelector('.game-mount')?.dataset;
    const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
    return {
      footY: Number(data?.playerRaftFootY),
      surface: data?.playerRaftSurface,
      localZ: Number(data?.playerLocalZ),
      savedNavigation: saved?.player?.navigation,
    };
  });
  const upperSave = await page.evaluate(() => JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null'));

  await context.close();
  context = await browser.newContext({ viewport: { width: 1024, height: 640 }, deviceScaleFactor: 1 });
  await context.addInitScript((save) => {
    localStorage.setItem('driftwake.save.v17', JSON.stringify(save));
  }, upperSave);
  page = await context.newPage();
  monitorPage(page, 'building-traversal-restored');
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForSelector('.primary-command:not(:disabled)', { timeout: 45_000 });
  await page.getByRole('button', { name: '开始漂流', exact: true }).waitFor({ timeout: 45_000 });
  await enterGame(page);
  await waitForRuntime(page, () => {
    const data = document.querySelector('.game-mount')?.dataset;
    return Number(data?.playerRaftFootY) > 2.14 && data?.playerRaftSurface === 'floor';
  }, 10_000);

  const jumpBefore = Number(await page.locator('.game-mount').getAttribute('data-player-jump-count'));
  await page.keyboard.press('Space');
  await waitForRuntime(page, () => document.querySelector('.game-mount')?.dataset.playerAirborne === 'true', 5_000);
  await waitForRuntime(page, () => {
    const data = document.querySelector('.game-mount')?.dataset;
    return data?.playerAirborne === 'false'
      && Number(data?.playerRaftFootY) > 2.14
      && data?.playerRaftSurface === 'floor';
  }, 8_000);

  await page.keyboard.down('KeyS');
  try {
    await waitForRuntime(page, () => {
      const data = document.querySelector('.game-mount')?.dataset;
      return Number(data?.playerRaftFootY) < 0.08
        && Number(data?.playerLocalZ) > 1.98;
    }, 8_000);
  } catch (error) {
    const diagnostics = await page.evaluate(() => {
      const data = document.querySelector('.game-mount')?.dataset;
      return {
        footY: data?.playerRaftFootY,
        surface: data?.playerRaftSurface,
        localX: data?.playerLocalX,
        localZ: data?.playerLocalZ,
        airborne: data?.playerAirborne,
        simulationActive: data?.simulationActive,
        pointerLocked: Boolean(document.pointerLockElement),
      };
    });
    throw new Error(`Building stair descent failed: ${JSON.stringify(diagnostics)}`, { cause: error });
  } finally {
    await page.keyboard.up('KeyS');
  }
  await page.evaluate(() => window.dispatchEvent(new Event('beforeunload')));
  await page.waitForTimeout(250);
  const final = await page.evaluate(() => {
    const data = document.querySelector('.game-mount')?.dataset;
    const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
    return {
      contextHealthy: data?.contextHealthy,
      simulationActive: data?.simulationActive,
      airborne: data?.playerAirborne,
      footY: Number(data?.playerRaftFootY),
      surface: data?.playerRaftSurface,
      localZ: Number(data?.playerLocalZ),
      jumpCount: Number(data?.playerJumpCount),
      ceilingHits: Number(data?.playerCeilingHitCount),
      savedNavigation: saved?.player?.navigation,
    };
  });
  if (
    upperBeforeReload.footY < 2.14
    || upperBeforeReload.surface !== 'floor'
    || Math.abs((upperBeforeReload.savedNavigation?.y ?? 0) - 2.18) > 0.02
    || final.contextHealthy !== 'true'
    || final.simulationActive !== 'true'
    || final.airborne !== 'false'
    || final.footY > 0.08
    || !['stairs', 'foundation'].includes(final.surface)
    || final.localZ < 1.98
    || final.jumpCount !== jumpBefore + 1
    || final.ceilingHits !== 0
    || final.savedNavigation?.surface !== 'raft'
    || (final.savedNavigation?.y ?? 0) !== 0
  ) {
    throw new Error(`Building traversal failed: ${JSON.stringify({ upperBeforeReload, jumpBefore, final })}`);
  }
  console.log(`Building traversal gate: ${JSON.stringify({ upperBeforeReload, jumpBefore, final })}`);
  await context.close();
}

async function captureBuildingCeilingProbe(kind) {
  const isFloor = kind === 'floor';
  const run = await openDesktopPage(`building-ceiling-${kind}`, {
    seedSave: true,
    ...(isFloor ? { structureFloorCeilingStart: true } : { structureRoofCeilingStart: true }),
    width: 768,
    height: 480,
  });
  const { context, page } = run;
  await enterGame(page);
  await waitForRuntime(page, () => {
    const data = document.querySelector('.game-mount')?.dataset;
    return data?.raftStructureCount === '3'
      && data?.playerRaftSurface === 'foundation'
      && data?.playerCeilingHitCount === '0';
  }, 10_000);

  await page.keyboard.press('Space');
  if (isFloor) {
    await waitForRuntime(page, () => {
      const data = document.querySelector('.game-mount')?.dataset;
      return data?.playerCeilingHitCount === '1'
        && data?.playerCeilingSurface === 'floor'
        && data?.playerJumpState === 'hit-ceiling:floor';
    }, 8_000);
  } else {
    await waitForRuntime(page, () => {
      const data = document.querySelector('.game-mount')?.dataset;
      return data?.playerCeilingHitCount === '1'
        && data?.playerCeilingSurface === 'roof'
        && data?.playerJumpState === 'hit-ceiling:roof';
    }, 8_000);
  }
  const collision = await page.evaluate(() => {
    const data = document.querySelector('.game-mount')?.dataset;
    return {
      contextHealthy: data?.contextHealthy,
      simulationActive: data?.simulationActive,
      hitCount: Number(data?.playerCeilingHitCount),
      surface: data?.playerCeilingSurface,
      structureId: data?.playerCeilingStructureId,
      headY: Number(data?.playerCeilingHeadY),
      velocityY: Number(data?.playerCeilingVelocityY),
      jumpState: data?.playerJumpState,
    };
  });
  await waitForRuntime(page, () => {
    const data = document.querySelector('.game-mount')?.dataset;
    return data?.playerAirborne === 'false'
      && data?.playerRaftSurface === 'foundation'
      && data?.playerCeilingHitCount === '1';
  }, 8_000);
  if (
    collision.contextHealthy !== 'true'
    || collision.simulationActive !== 'true'
    || collision.hitCount !== 1
    || collision.surface !== kind
    || collision.structureId !== `ceiling-${kind}`
    || Math.abs(collision.velocityY) > 0.001
    || collision.headY <= 1.7
    || collision.headY >= 2.7
  ) {
    throw new Error(`Building ${kind} ceiling collision failed: ${JSON.stringify(collision)}`);
  }
  await context.close();
  return collision;
}

async function captureBuildingCeiling() {
  const floor = await captureBuildingCeilingProbe('floor');
  const roof = await captureBuildingCeilingProbe('roof');
  if (roof.headY <= floor.headY + 0.18) {
    throw new Error(`Building pitched ceiling heights failed: ${JSON.stringify({ floor, roof })}`);
  }
  console.log(`Building ceiling gate: ${JSON.stringify({ floor, roof })}`);
}

async function captureBuildingDamageRepair() {
  const viewport = { width: 768, height: 480 };
  const attack = await openDesktopPage('building-damage-attack', {
    seedSave: true,
    structureDamageStart: true,
    simulationTimeScale: 10,
    ...viewport,
  });
  let { context } = attack;
  let { page } = attack;
  await installNoticeHistory(page);
  await enterGame(page);
  await waitForRuntime(page, () => {
    const data = document.querySelector('.game-mount')?.dataset;
    const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
    return data?.raftStructureCount === '1'
      && saved?.raft?.structures?.find((structure) => structure.id === 'damage-wall')?.health === 75;
  }, 10_000);
  try {
    await waitForRuntime(page, () => {
      const data = document.querySelector('.game-mount')?.dataset;
      const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
      return Number(data?.sharkStructureDamageCount) >= 2
        && data?.sharkLastRaftTargetKind === 'structure'
        && data?.sharkLastRaftTargetId === 'damage-wall'
        && data?.raftCriticalStructureCount === '1'
        && saved?.raft?.structures?.find((structure) => structure.id === 'damage-wall')?.health === 7;
    }, 90_000);
  } catch (error) {
    const diagnostics = await page.evaluate(() => {
      const data = document.querySelector('.game-mount')?.dataset;
      const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
      return {
        simulationTicks: data?.simulationTickCount,
        simulationActive: data?.simulationActive,
        contextHealthy: data?.contextHealthy,
        sharkMode: document.querySelector('.shark-warning.is-visible')?.textContent?.replace(/\s+/g, ' ').trim(),
        targetKind: data?.sharkRaftTargetKind,
        targetId: data?.sharkRaftTargetId,
        lastTargetKind: data?.sharkLastRaftTargetKind,
        lastTargetId: data?.sharkLastRaftTargetId,
        lastTargetHealth: data?.sharkLastRaftTargetHealth,
        structureDamageEvents: data?.sharkStructureDamageCount,
        foundationDamageEvents: data?.sharkFoundationDamageCount,
        damaged: data?.raftDamagedStructureCount,
        critical: data?.raftCriticalStructureCount,
        savedHealth: saved?.raft?.structures?.find((structure) => structure.id === 'damage-wall')?.health,
        savedTileHealth: saved?.raft?.tiles?.find((tile) => tile.x === 2 && tile.z === 2)?.health,
        mutation: data?.lastRaftMutation,
        notices: globalThis.__driftwakeCaptureNotices ?? [],
      };
    });
    throw new Error(`Building shark damage timed out: ${JSON.stringify(diagnostics)}`, { cause: error });
  }
  const damagedState = await page.evaluate(() => {
    const data = document.querySelector('.game-mount')?.dataset;
    const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
    return {
      damageEvents: Number(data?.sharkStructureDamageCount),
      foundationEvents: Number(data?.sharkFoundationDamageCount),
      lastTargetKind: data?.sharkLastRaftTargetKind,
      lastTargetId: data?.sharkLastRaftTargetId,
      lastTargetHealth: Number(data?.sharkLastRaftTargetHealth),
      mutation: data?.lastRaftMutation,
      critical: Number(data?.raftCriticalStructureCount),
      health: saved?.raft?.structures?.find((structure) => structure.id === 'damage-wall')?.health,
      tileHealth: saved?.raft?.tiles?.find((tile) => tile.x === 2 && tile.z === 2)?.health,
      notices: globalThis.__driftwakeCaptureNotices ?? [],
    };
  });
  const damagedSave = await page.evaluate(() => JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null'));
  if (
    damagedState.damageEvents !== 2
    || damagedState.foundationEvents !== 0
    || damagedState.lastTargetKind !== 'structure'
    || damagedState.lastTargetId !== 'damage-wall'
    || damagedState.lastTargetHealth !== 7
    || damagedState.mutation !== 'structure:damage-wall:7:false'
    || damagedState.critical !== 1
    || damagedState.health !== 7
    || damagedState.tileHealth !== 100
    || !damagedState.notices.some((notice) => notice.includes('木墙受损'))
  ) {
    throw new Error(`Building structure damage failed: ${JSON.stringify(damagedState)}`);
  }

  await context.close();
  context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await context.addInitScript((save) => {
    localStorage.setItem('driftwake.save.v17', JSON.stringify(save));
  }, damagedSave);
  page = await context.newPage();
  monitorPage(page, 'building-damage-restored');
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForSelector('.primary-command:not(:disabled)', { timeout: 45_000 });
  await installNoticeHistory(page);
  await enterGame(page);
  await waitForRuntime(page, () => {
    const data = document.querySelector('.game-mount')?.dataset;
    const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
    return data?.raftCriticalStructureCount === '1'
      && saved?.raft?.structures?.find((structure) => structure.id === 'damage-wall')?.health === 7;
  }, 10_000);

  const repairAimMovement = { x: 0, y: 0 };
  for (let iteration = 0; iteration < 6; iteration += 1) {
    const correction = await page.evaluate(([targetX, targetY, targetZ]) => {
      const aim = JSON.parse(document.querySelector('.game-mount')?.dataset.structureDoorAim ?? '{}');
      const [cameraX, cameraY, cameraZ] = aim.camera;
      const [forwardX, forwardY, forwardZ] = aim.forward;
      const deltaX = targetX - cameraX;
      const deltaY = targetY - cameraY;
      const deltaZ = targetZ - cameraZ;
      const distance = Math.hypot(deltaX, deltaY, deltaZ);
      const desiredYaw = Math.atan2(-deltaX / distance, -deltaZ / distance);
      const desiredPitch = Math.asin(deltaY / distance);
      const currentYaw = Math.atan2(-forwardX, -forwardZ);
      const currentPitch = Math.asin(forwardY);
      const movementX = Math.atan2(
        Math.sin(currentYaw - desiredYaw),
        Math.cos(currentYaw - desiredYaw),
      ) / 0.00175;
      const movementY = (currentPitch - desiredPitch) / 0.00155;
      const movement = new MouseEvent('mousemove');
      Object.defineProperties(movement, {
        movementX: { value: movementX },
        movementY: { value: movementY },
      });
      document.dispatchEvent(movement);
      return { x: movementX, y: movementY };
    }, [2.88, 1.05, 3.45]);
    repairAimMovement.x += correction.x;
    repairAimMovement.y += correction.y;
    await page.waitForTimeout(280);
    if (await page.evaluate(() => {
      const data = document.querySelector('.game-mount')?.dataset;
      return data?.buildMode === 'repair'
        && data?.buildRepairTarget === 'damage-wall'
        && data?.buildRepairHealth === '7';
    })) break;
  }
  await waitForRuntime(page, () => {
    const data = document.querySelector('.game-mount')?.dataset;
    return data?.buildMode === 'repair'
      && data?.buildRepairTarget === 'damage-wall'
      && data?.buildRepairHealth === '7';
  }, 8_000);
  const repairUi = await page.evaluate(() => ({
    palette: document.querySelector('.build-palette')?.textContent?.replace(/\s+/g, ' ').trim(),
    prompt: document.querySelector('.interaction-prompt.is-visible')?.textContent?.replace(/\s+/g, ' ').trim(),
  }));
  if (!repairUi.palette?.includes('修补木墙') || !repairUi.palette.includes('7/110') || !repairUi.prompt?.includes('修补木墙')) {
    throw new Error(`Building repair UI failed: ${JSON.stringify(repairUi)}`);
  }
  await captureCompositedPage(
    page,
    new URL('building-structure-damage-desktop.png', outputDir).pathname,
  );

  await page.mouse.click(viewport.width / 2, viewport.height / 2);
  await waitForRuntime(page, () => {
    const data = document.querySelector('.game-mount')?.dataset;
    const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
    return data?.lastToolWear === 'repair:hammer:79'
      && data?.buildRepairHealth === '51'
      && saved?.raft?.structures?.find((structure) => structure.id === 'damage-wall')?.health === 51
      && saved?.player?.inventory?.timber === 11;
  }, 8_000);
  await page.waitForTimeout(450);
  await page.mouse.click(viewport.width / 2, viewport.height / 2);
  await waitForRuntime(page, () => {
    const data = document.querySelector('.game-mount')?.dataset;
    const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
    return data?.lastToolWear === 'repair:hammer:78'
      && data?.buildRepairHealth === '95'
      && saved?.raft?.structures?.find((structure) => structure.id === 'damage-wall')?.health === 95
      && saved?.player?.inventory?.timber === 10;
  }, 8_000);
  await page.waitForTimeout(450);
  await page.mouse.click(viewport.width / 2, viewport.height / 2);
  await waitForRuntime(page, () => {
    const data = document.querySelector('.game-mount')?.dataset;
    const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
    return data?.lastToolWear === 'repair:hammer:77'
      && data?.raftDamagedStructureCount === '0'
      && data?.buildRepairTarget === 'none'
      && saved?.raft?.structures?.find((structure) => structure.id === 'damage-wall')?.health === 110
      && saved?.player?.inventory?.timber === 9;
  }, 8_000);
  await captureCompositedPage(
    page,
    new URL('building-structure-repaired-desktop.png', outputDir).pathname,
  );
  const final = await page.evaluate(() => {
    const data = document.querySelector('.game-mount')?.dataset;
    const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
    return {
      contextHealthy: data?.contextHealthy,
      simulationActive: data?.simulationActive,
      repairTarget: data?.buildRepairTarget,
      damaged: Number(data?.raftDamagedStructureCount),
      critical: Number(data?.raftCriticalStructureCount),
      health: saved?.raft?.structures?.find((structure) => structure.id === 'damage-wall')?.health,
      timber: saved?.player?.inventory?.timber,
      hammer: saved?.player?.toolDurability?.hammer,
      wear: data?.lastToolWear,
      notices: globalThis.__driftwakeCaptureNotices ?? [],
    };
  });
  if (
    final.contextHealthy !== 'true'
    || final.simulationActive !== 'true'
    || final.repairTarget !== 'none'
    || final.damaged !== 0
    || final.critical !== 0
    || final.health !== 110
    || final.timber !== 9
    || final.hammer !== 77
    || final.wear !== 'repair:hammer:77'
    || !final.notices.some((notice) => notice.includes('木墙已完全修复'))
  ) {
    throw new Error(`Building structure repair failed: ${JSON.stringify(final)}`);
  }
  console.log(`Building damage/repair gate: ${JSON.stringify({ damagedState, repairAimMovement, repairUi, final })}`);
  await context.close();
}

async function captureSettings() {
  const { context, page } = await openDesktopPage('settings');
  await page.getByRole('button', { name: '设置' }).first().click();
  await page.getByRole('dialog', { name: '设置' }).waitFor();
  await page.screenshot({ path: new URL('settings-desktop.png', outputDir).pathname });
  await context.close();
}

async function captureDevices() {
  const { context, page } = await openDesktopPage('devices', { seedSave: true });
  await enterGame(page);
  await page.waitForTimeout(900);
  await page.screenshot({ path: new URL('devices-hud-desktop.png', outputDir).pathname });
  await context.close();
}

async function captureAdvancedDevices() {
  if (process.env.CAPTURE_FAST !== '1') {
    const { context: showcaseContext, page: showcasePage } = await openDesktopPage('advanced-devices', { seedSave: true, advancedStart: true });
    await enterGame(showcasePage);
    await showcasePage.waitForTimeout(1200);
    await inspectCanvasPixels(showcasePage, 'advanced-devices');
    await showcasePage.screenshot({ path: new URL('advanced-devices-desktop.png', outputDir).pathname });
    await showcaseContext.close();
  }

  const { context, page } = await openDesktopPage('advanced-storage', { seedSave: true, advancedStorageStart: true });
  await enterGame(page);
  await page.waitForTimeout(900);
  await ensurePointerLock(page);
  let storagePrompt = await aimDownToPrompt(page, '打开干舱储物柜', 70);
  if (!storagePrompt.includes('打开干舱储物柜')) {
    storagePrompt = await aimAroundToPrompt(page, '打开干舱储物柜');
  }
  if (!storagePrompt.includes('打开干舱储物柜')) {
    await page.screenshot({ path: new URL('advanced-focus-diagnostic.png', outputDir).pathname });
    throw new Error(`Advanced storage focus missing: ${storagePrompt}`);
  }
  console.log(`Advanced interaction prompt: ${storagePrompt}`);
  await page.keyboard.press('KeyE');
  const storageTimeline = await page.evaluate(async () => {
    const samples = [];
    let previous = '';
    for (let index = 0; index < 20; index += 1) {
      const mount = document.querySelector('.game-mount');
      const sample = {
        ms: index * 50,
        dialog: Boolean(document.querySelector('.field-pack')),
        focusPrompt: Boolean(document.querySelector('.focus-prompt')),
        contextHealthy: mount?.dataset.contextHealthy ?? null,
        presentationRate: mount?.dataset.presentationRate ?? null,
        pointerLocked: Boolean(document.pointerLockElement),
        activeElement: document.activeElement?.getAttribute('class') ?? document.activeElement?.tagName ?? null,
      };
      const signature = JSON.stringify({ ...sample, ms: 0 });
      if (signature !== previous) samples.push(sample);
      previous = signature;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return samples;
  });
  console.log(`Advanced storage timeline: ${JSON.stringify(storageTimeline)}`);
  const settledStorageSample = storageTimeline[storageTimeline.length - 1];
  if (
    storageTimeline.some((sample) => !sample.dialog || sample.focusPrompt || sample.contextHealthy !== 'true' || sample.pointerLocked)
    || settledStorageSample?.presentationRate !== 'paused-4fps'
  ) {
    throw new Error(`Advanced storage overlay was not stable: ${JSON.stringify(storageTimeline)}`);
  }
  console.log(`Advanced storage DOM: ${JSON.stringify(await page.evaluate(() => ({
    dialog: document.querySelector('.field-pack')?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 120) ?? null,
    prompt: document.querySelector('.interaction-prompt')?.textContent?.trim() ?? null,
    pointerLocked: Boolean(document.pointerLockElement),
  })))}`);
  const dialog = page.locator('.field-pack');
  await dialog.waitFor({ state: 'visible', timeout: 8_000 });
  const dialogSemantics = await dialog.evaluate((element) => ({
    role: element.getAttribute('role'),
    labelledBy: element.getAttribute('aria-labelledby'),
    heading: element.querySelector('#field-pack-heading')?.textContent?.trim() ?? null,
    modalCount: document.querySelectorAll('[role="dialog"][aria-modal="true"]').length,
  }));
  if (
    dialogSemantics.role !== 'dialog'
    || dialogSemantics.labelledBy !== 'field-pack-heading'
    || dialogSemantics.heading !== '干舱储物柜'
    || dialogSemantics.modalCount !== 1
  ) {
    throw new Error(`Advanced storage dialog semantics invalid: ${JSON.stringify(dialogSemantics)}`);
  }
  const layout = await dialog.evaluate((element) => {
    const panes = [...element.querySelectorAll('.storage-inventory')].map((pane) => {
      const rect = pane.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, scrollWidth: pane.scrollWidth, clientWidth: pane.clientWidth };
    });
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height },
      style: { display: style.display, visibility: style.visibility, opacity: style.opacity },
      panes,
    };
  });
  if (
    layout.rect.width < 600
    || layout.rect.height < 400
    || layout.style.display === 'none'
    || layout.style.visibility !== 'visible'
    || Number(layout.style.opacity) < 0.95
    || layout.panes.length !== 2
    || layout.panes.some((pane) => pane.scrollWidth > pane.clientWidth + 2)
  ) {
    throw new Error(`Advanced storage layout overflow: ${JSON.stringify(layout)}`);
  }
  const pointerCenter = async (locator, label) => {
    const point = await locator.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        width: rect.width,
        height: rect.height,
      };
    });
    if (point.width < 1 || point.height < 1) throw new Error(`${label} has no pointer target: ${JSON.stringify(point)}`);
    return point;
  };
  const clickWithPointer = async (locator, label) => {
    const point = await pointerCenter(locator, label);
    await page.mouse.click(point.x, point.y);
  };
  const dragWithPointer = async (source, target, label) => {
    const start = await pointerCenter(source, `${label} source`);
    const end = await pointerCenter(target, `${label} target`);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 12 });
    await page.mouse.up();
  };
  const packTimber = dialog.locator('button[aria-label^="随身背包：盐蚀漂木"]');
  if (await packTimber.count() !== 2) {
    throw new Error(`Advanced storage expected two timber stacks, got ${await packTimber.count()}`);
  }
  await clickWithPointer(packTimber.nth(1), 'partial timber stack');
  await clickWithPointer(dialog.locator('button[aria-label="转移半组"]'), 'half-stack preset');
  await page.waitForFunction(() => document.querySelector('output[aria-label="当前转移数量"]')?.textContent === '3');
  await clickWithPointer(
    dialog.locator('button[aria-label="向密封干舱转移 3 个盐蚀漂木"]'),
    'partial transfer commit',
  );
  await page.waitForFunction(() => Boolean(
    document.querySelector('button[aria-label="随身背包：盐蚀漂木，3 个"]')
    && document.querySelector('button[aria-label="密封干舱：盐蚀漂木，11 个"]'),
  ));

  await dragWithPointer(
    dialog.locator('button[aria-label="随身背包：盐蚀漂木，20 个"]'),
    dialog.locator('.inventory-grid--locker'),
    'full timber stack drag',
  );
  await page.waitForFunction(() => Boolean(
    document.querySelector('.field-pack__status')?.textContent?.includes('干舱 8/8')
    && document.querySelector('button[aria-label="密封干舱：盐蚀漂木，11 个"]'),
  ));

  await clickWithPointer(
    dialog.locator('button[aria-label="密封干舱：盐蚀漂木，11 个"]'),
    'storage timber remainder',
  );
  await clickWithPointer(dialog.locator('button[aria-label="转移一个"]'), 'single-item preset');
  await clickWithPointer(
    dialog.locator('button[aria-label="向随身背包转移 1 个盐蚀漂木"]'),
    'single-item return commit',
  );
  await page.waitForFunction(() => Boolean(
    document.querySelector('button[aria-label="随身背包：盐蚀漂木，4 个"]')
    && document.querySelector('button[aria-label="密封干舱：盐蚀漂木，10 个"]'),
  ));
  await clickWithPointer(
    dialog.locator('button[aria-label="随身背包：氧化废铁，8 个"]'),
    'capacity-limited scrap stack',
  );
  await page.waitForFunction(() => Boolean(
    document.querySelector('button[aria-label="向密封干舱转移 2 个氧化废铁"]:not(:disabled)')
    && document.querySelector('.storage-transfer-axis > small.is-limited')?.textContent?.trim() === '可容 2',
  ));
  await clickWithPointer(
    dialog.locator('button[aria-label="随身背包：银脊鱼，4 个"]'),
    'capacity-blocked fish stack',
  );
  await page.waitForFunction(() => Boolean(
    document.querySelector('button[aria-label="密封干舱已满"]:disabled')
    && document.querySelector('.storage-transfer-axis > small.is-limited')?.textContent?.trim() === '已满',
  ));
  const capacityState = await dialog.evaluate((element) => ({
    status: element.querySelector('.field-pack__status')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
    commit: element.querySelector('.storage-transfer-commit')?.getAttribute('aria-label') ?? null,
    disabled: element.querySelector('.storage-transfer-commit')?.hasAttribute('disabled') ?? null,
    capacity: element.querySelector('.storage-transfer-axis > small')?.textContent?.trim() ?? null,
  }));
  console.log(`Advanced storage capacity state: ${JSON.stringify(capacityState)}`);
  const transferState = await dialog.evaluate((element) => ({
    packTimber: [...element.querySelectorAll('button[aria-label^="随身背包：盐蚀漂木"]')]
      .map((node) => node.getAttribute('aria-label')),
    storageTimber: [...element.querySelectorAll('button[aria-label^="密封干舱：盐蚀漂木"]')]
      .map((node) => node.getAttribute('aria-label')),
    storageStatus: element.querySelector('.field-pack__status')?.textContent?.replace(/\s+/g, ' ').trim() ?? null,
  }));
  console.log(`Advanced storage transfer state: ${JSON.stringify(transferState)}`);
  console.log(`Advanced storage layout: ${JSON.stringify(layout)}`);
  if (process.env.CAPTURE_FAST !== '1') {
    await page.screenshot({ path: new URL('advanced-storage-desktop.png', outputDir).pathname });
  }

  await page.setViewportSize({ width: 640, height: 720 });
  await page.waitForTimeout(250);
  const narrowLayout = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
      bodyScrollWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });
  if (
    narrowLayout.rect.left < -2
    || narrowLayout.rect.right > narrowLayout.viewportWidth + 2
    || narrowLayout.bodyScrollWidth > narrowLayout.viewportWidth + 2
  ) {
    throw new Error(`Advanced storage narrow overflow: ${JSON.stringify(narrowLayout)}`);
  }
  console.log(`Advanced storage narrow layout: ${JSON.stringify(narrowLayout)}`);
  if (process.env.CAPTURE_FAST !== '1') {
    await page.screenshot({ path: new URL('advanced-storage-narrow.png', outputDir).pathname });
  }
  await context.close();
}

async function captureSignalNetwork() {
  const { context, page } = await openDesktopPage('signal-network', { seedSave: true, signalStart: true });
  await enterGame(page);
  await page.locator('.signal-readout.is-visible.is-online').waitFor({ timeout: 30_000 });
  await page.waitForFunction(() => Boolean(document.pointerLockElement), null, { timeout: 5_000 });
  await waitForRuntime(page, () => {
    const data = document.querySelector('.game-mount')?.dataset;
    const clearance = Number(data?.islandRaftClearance);
    return data?.sailAttachment === 'raft' && Number.isFinite(clearance) && clearance >= 0.15;
  }, 8_000);
  const attachment = await page.evaluate(() => {
    const data = document.querySelector('.game-mount')?.dataset;
    return {
      sailAttachment: data?.sailAttachment ?? 'missing',
      clearance: Number(data?.islandRaftClearance),
    };
  });
  console.log(`Signal sail attachment: ${JSON.stringify(attachment)}`);
  await assertHookVisualOwnership(page, 'signal-network', 'held');
  await page.evaluate(() => {
    const movement = new MouseEvent('mousemove');
    Object.defineProperties(movement, {
      movementX: { value: 0 },
      movementY: { value: 70 },
    });
    document.dispatchEvent(movement);
  });
  await page.waitForTimeout(900);
  await inspectCanvasPixels(page, 'signal-network');
  if (process.env.CAPTURE_FAST !== '1') {
    await captureCompositedPage(page, new URL('signal-network-desktop.png', outputDir).pathname);
  }

  await ensurePointerLock(page);
  let prompt = await aimDownToPrompt(page, '关闭潮听接收台', 46);
  if (!prompt.includes('关闭潮听接收台')) prompt = await aimAroundToPrompt(page, '关闭潮听接收台');
  if (!prompt.includes('关闭潮听接收台')) {
    if (process.env.CAPTURE_FAST !== '1') {
      await captureCompositedPage(page, new URL('signal-network-focus-diagnostic.png', outputDir).pathname);
    }
    throw new Error(`Signal receiver focus missing: ${prompt}`);
  }
  await page.keyboard.press('KeyR');
  await page.waitForFunction(() => document.querySelector('.signal-readout')?.textContent?.includes('41.82'), null, { timeout: 5_000 });
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => !document.querySelector('.signal-readout')?.classList.contains('is-online'), null, { timeout: 5_000 });
  await page.keyboard.press('KeyE');
  await page.locator('.signal-readout.is-online').waitFor({ timeout: 5_000 });

  await page.evaluate(() => {
    const movement = new MouseEvent('mousemove');
    Object.defineProperties(movement, {
      movementX: { value: -650 },
      movementY: { value: 0 },
    });
    document.dispatchEvent(movement);
  });
  await page.waitForTimeout(500);
  await inspectCanvasPixels(page, 'signal-array');
  if (process.env.CAPTURE_FAST !== '1') {
    await captureCompositedPage(page, new URL('signal-array-desktop.png', outputDir).pathname);
  }

  await page.setViewportSize({ width: 640, height: 720 });
  await page.waitForTimeout(300);
  const boxes = await page.evaluate(() => {
    const box = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    };
    return {
      signal: box('.signal-readout.is-visible'),
      island: box('.island-readout'),
      navigation: box('.navigation-readout'),
      weather: box('.weather-warning.is-visible'),
      devices: box('.device-rack.is-visible'),
      hotbar: box('.hotbar'),
      bodyWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });
  const overlaps = (a, b) => Boolean(a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);
  for (const [first, second] of [['signal', 'island'], ['signal', 'navigation'], ['signal', 'weather'], ['signal', 'devices'], ['signal', 'hotbar']]) {
    if (overlaps(boxes[first], boxes[second])) throw new Error(`Signal HUD overlap: ${first} intersects ${second}; ${JSON.stringify(boxes)}`);
  }
  if (boxes.bodyWidth > boxes.viewportWidth + 2) throw new Error(`Signal HUD narrow overflow: ${JSON.stringify(boxes)}`);
  console.log(`Signal network prompt: ${prompt}; narrow boxes: ${JSON.stringify(boxes)}`);
  await inspectCanvasPixels(page, 'signal-network-narrow');
  if (process.env.CAPTURE_FAST !== '1') {
    await captureCompositedPage(page, new URL('signal-network-narrow.png', outputDir).pathname);
  }
  await context.close();
}

async function readInteractionPrompt(page) {
  return page.evaluate(() => document.querySelector('.interaction-prompt')?.textContent?.trim() ?? '');
}

async function aimLocalPointToPrompt(page, target, expected, iterations = 6) {
  await page.waitForFunction(() => {
    const aim = JSON.parse(document.querySelector('.game-mount')?.dataset.collectionNetAim ?? '{}');
    return Array.isArray(aim.camera)
      && Array.isArray(aim.forward)
      && Math.hypot(...aim.forward) > 0.5;
  }, undefined, { timeout: 8_000 });
  let prompt = await readInteractionPrompt(page);
  for (let iteration = 0; iteration < iterations && !prompt.includes(expected); iteration += 1) {
    await page.evaluate(([targetX, targetY, targetZ]) => {
      const aim = JSON.parse(document.querySelector('.game-mount')?.dataset.collectionNetAim ?? '{}');
      const [cameraX, cameraY, cameraZ] = aim.camera;
      const [forwardX, forwardY, forwardZ] = aim.forward;
      const deltaX = targetX - cameraX;
      const deltaY = targetY - cameraY;
      const deltaZ = targetZ - cameraZ;
      const distance = Math.hypot(deltaX, deltaY, deltaZ);
      const desiredYaw = Math.atan2(-deltaX / distance, -deltaZ / distance);
      const desiredPitch = Math.asin(deltaY / distance);
      const currentYaw = Math.atan2(-forwardX, -forwardZ);
      const currentPitch = Math.asin(forwardY);
      const movement = new MouseEvent('mousemove');
      Object.defineProperties(movement, {
        movementX: {
          value: Math.atan2(
            Math.sin(currentYaw - desiredYaw),
            Math.cos(currentYaw - desiredYaw),
          ) / 0.00175,
        },
        movementY: { value: (currentPitch - desiredPitch) / 0.00155 },
      });
      document.dispatchEvent(movement);
    }, target);
    await page.waitForTimeout(280);
    prompt = await readInteractionPrompt(page);
  }
  return prompt;
}

async function aimCollectionNetToPrompt(page, id, expected) {
  await page.waitForFunction((targetId) => {
    const aim = JSON.parse(document.querySelector('.game-mount')?.dataset.collectionNetAim ?? '{}');
    return aim.firstNet?.id === targetId && Array.isArray(aim.firstNet.center);
  }, id, { timeout: 8_000 });
  const center = await page.evaluate(() => {
    const aim = JSON.parse(document.querySelector('.game-mount')?.dataset.collectionNetAim ?? '{}');
    return aim.firstNet.center;
  });
  return aimLocalPointToPrompt(page, center, expected);
}

async function aimDownToPrompt(page, expected, steps = 50) {
  let prompt = await readInteractionPrompt(page);
  for (let step = 0; step < steps && !prompt.includes(expected); step += 1) {
    await page.evaluate(() => {
      const movement = new MouseEvent('mousemove');
      Object.defineProperties(movement, {
        movementX: { value: 0 },
        movementY: { value: 8 },
      });
      document.dispatchEvent(movement);
    });
    await page.waitForTimeout(75);
    prompt = await readInteractionPrompt(page);
  }
  if (!prompt.includes(expected)) {
    await page.waitForFunction(
      (label) => document.querySelector('.interaction-prompt')?.textContent?.includes(label),
      expected,
      { timeout: 4_000 },
    ).catch(() => undefined);
    prompt = await readInteractionPrompt(page);
  }
  return prompt;
}

async function aimTowardDeckPrompt(page, expected, steps = 80) {
  let prompt = await readInteractionPrompt(page);
  for (let step = 0; step < steps && !prompt.includes(expected); step += 1) {
    await page.evaluate(() => {
      const movement = new MouseEvent('mousemove');
      Object.defineProperties(movement, {
        movementX: { value: 0 },
        movementY: { value: 7 },
      });
      document.dispatchEvent(movement);
    });
    await page.waitForTimeout(70);
    prompt = await readInteractionPrompt(page);
  }
  if (prompt.includes(expected)) return prompt;
  for (const [direction, yawSteps] of [[1, 34], [-1, 68]]) {
    for (let step = 0; step < yawSteps && !prompt.includes(expected); step += 1) {
      await page.evaluate((movementX) => {
        const movement = new MouseEvent('mousemove');
        Object.defineProperties(movement, {
          movementX: { value: movementX },
          movementY: { value: 0 },
        });
        document.dispatchEvent(movement);
      }, direction * 10);
      await page.waitForTimeout(70);
      prompt = await readInteractionPrompt(page);
    }
    if (prompt.includes(expected)) break;
  }
  return prompt;
}

async function aimAroundToPrompt(page, expected) {
  let prompt = await aimDownToPrompt(page, expected, 32);
  if (prompt.includes(expected)) return prompt;
  for (const [direction, steps] of [[1, 38], [-1, 76]]) {
    for (let step = 0; step < steps && !prompt.includes(expected); step += 1) {
      await page.evaluate((movementX) => {
        const movement = new MouseEvent('mousemove');
        Object.defineProperties(movement, {
          movementX: { value: movementX },
          movementY: { value: 0 },
        });
        document.dispatchEvent(movement);
      }, direction * 14);
      await page.waitForTimeout(70);
      prompt = await readInteractionPrompt(page);
    }
    if (prompt.includes(expected)) break;
  }
  return prompt;
}

async function capturePlantingPlacement() {
  const { context, page } = await openDesktopPage('planting-placement', { seedSave: true, plantingPlacementStart: true });
  await enterGame(page);
  await page.keyboard.press('KeyI');
  await page.getByRole('dialog', { name: '野外背包' }).waitFor();
  await page.getByRole('button', { name: /潮生作物盆套件/ }).click();
  await page.getByRole('button', { name: '安置到木筏' }).click();
  const placementPrompt = await aimDownToPrompt(page, '安置潮生作物盆');
  if (!placementPrompt.includes('安置潮生作物盆')) {
    await page.screenshot({ path: new URL('planting-placement-diagnostic.png', outputDir).pathname });
    throw new Error(`Expected planter placement prompt, received: ${placementPrompt}`);
  }
  await page.mouse.click(desktopWidth / 2, desktopHeight / 2);
  await page.waitForFunction(() => document.querySelector('.loot-notice')?.textContent?.includes('作物盆已固定'), null, { timeout: 4_000 });
  await page.locator('.device-status--planter').waitFor({ timeout: 4_000 });
  await inspectCanvasPixels(page, 'planting-placement');
  await page.screenshot({ path: new URL('planting-placement-desktop.png', outputDir).pathname });
  await context.close();
}

async function capturePlantingInteraction() {
  const { context, page } = await openDesktopPage('planting-interaction', { seedSave: true, plantingStart: true });
  await enterGame(page);
  await ensurePointerLock(page);
  await assertHookVisualOwnership(page, 'planting-interaction', 'held');
  let prompt = await aimDownToPrompt(page, '埋入盐冠棕榈种', 32);
  if (!prompt.includes('埋入盐冠棕榈种')) {
    await page.waitForFunction(
      () => document.querySelector('.interaction-prompt')?.textContent?.includes('埋入盐冠棕榈种'),
      null,
      { timeout: 4_000 },
    ).catch(() => undefined);
    prompt = await readInteractionPrompt(page);
  }
  if (!prompt.includes('埋入盐冠棕榈种')) {
    const diagnostic = await page.evaluate(() => ({
      prompt: document.querySelector('.interaction-prompt')?.textContent?.trim() ?? '',
      pointerLocked: Boolean(document.pointerLockElement),
      simulationActive: document.querySelector('.game-mount')?.dataset.simulationActive ?? 'missing',
      planter: document.querySelector('.device-status--planter')?.textContent?.trim() ?? 'missing',
    }));
    throw new Error(`Expected planting prompt, received: ${prompt}; ${JSON.stringify(diagnostic)}`);
  }
  await page.keyboard.press('KeyE');
  await page.locator('.interaction-prompt').filter({ hasText: '浇入一杯蒸馏淡水' }).waitFor({ timeout: 4_000 });
  await page.keyboard.press('KeyE');
  await page.locator('.interaction-prompt').filter({ hasText: '生长' }).waitFor({ timeout: 4_000 });
  await page.waitForFunction(
    () => document.querySelector('.device-status--planter')?.classList.contains('device-status--working'),
    null,
    { timeout: 4_000 },
  ).catch(async (error) => {
    const planterStatus = await page.locator('.device-status--planter').evaluate((element) => ({
      className: element.className,
      text: element.textContent?.trim() ?? '',
    })).catch(() => ({ className: 'missing', text: '' }));
    throw new Error(`Planter HUD did not enter working state: ${JSON.stringify(planterStatus)}`, { cause: error });
  });
  const emptyCupButton = page.getByRole('button', { name: /折边聚合杯/ });
  await page.keyboard.press('KeyI');
  await emptyCupButton.waitFor({ timeout: 4_000 });
  await page.keyboard.press('KeyI');
  await page.getByRole('button', { name: '继续漂流' }).click();
  await ensurePointerLock(page);
  await assertHookVisualOwnership(page, 'planting-interaction-resumed', 'held');
  await inspectCanvasPixels(page, 'planting-interaction');
  if (process.env.CAPTURE_FAST !== '1') {
    await captureCompositedPage(page, new URL('planting-interaction-desktop.png', outputDir).pathname);
  }
  await context.close();
}

async function capturePlantingBird() {
  const { context, page } = await openDesktopPage('planting-bird', { seedSave: true, plantingBirdStart: true });
  await enterGame(page);
  await ensurePointerLock(page);
  await assertHookVisualOwnership(page, 'planting-bird', 'held');
  const birdPrompt = await aimDownToPrompt(page, '驱赶盐翼盗鸟', 32);
  if (!birdPrompt.includes('驱赶盐翼盗鸟')) throw new Error(`Expected bird deterrence prompt, received: ${birdPrompt}`);
  await page.locator('.crop-warning.is-visible').waitFor({ timeout: 8_000 });
  await page.locator('.interaction-prompt').filter({ hasText: '驱赶盐翼盗鸟' }).waitFor({ timeout: 14_000 }).catch(async (error) => {
    await page.screenshot({ path: new URL('planting-bird-diagnostic.png', outputDir).pathname });
    const prompt = await readInteractionPrompt(page);
    const warning = await page.locator('.crop-warning').getAttribute('class');
    throw new Error(`Bird interaction prompt missing: prompt=${prompt}; warning=${warning}`, { cause: error });
  });
  await inspectCanvasPixels(page, 'planting-bird');
  if (process.env.CAPTURE_FAST !== '1') {
    await captureCompositedPage(page, new URL('planting-bird-desktop.png', outputDir).pathname);
  }
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => document.querySelector('.loot-notice')?.textContent?.includes('被惊飞'), null, { timeout: 4_000 });
  await page.waitForFunction(() => !document.querySelector('.crop-warning')?.classList.contains('is-visible'), null, { timeout: 4_000 });
  await context.close();
}

async function captureProgressionPlacement() {
  const { context, page } = await openDesktopPage('progression-placement', { seedSave: true, progressionPlacementStart: true });
  await enterGame(page);
  await page.keyboard.press('KeyI');
  await page.getByRole('dialog', { name: '野外背包' }).waitFor();
  await page.getByRole('button', { name: /盐迹研究台套件/ }).click();
  await page.getByRole('button', { name: '安置到木筏' }).click();
  const prompt = await aimDownToPrompt(page, '安置盐迹研究台');
  if (!prompt.includes('安置盐迹研究台')) {
    await page.screenshot({ path: new URL('progression-placement-diagnostic.png', outputDir).pathname });
    throw new Error(`Expected research table placement prompt, received: ${prompt}`);
  }
  await page.mouse.click(desktopWidth / 2, desktopHeight / 2);
  await page.waitForFunction(() => document.querySelector('.loot-notice')?.textContent?.includes('研究台已固定'), null, { timeout: 12_000 }).catch(async (error) => {
    const state = await page.evaluate(() => ({
      notice: document.querySelector('.loot-notice')?.textContent?.trim() ?? '',
      prompt: document.querySelector('.interaction-prompt')?.textContent?.trim() ?? '',
      progressionHud: document.querySelector('.device-status--progression')?.textContent?.trim() ?? '',
      save: localStorage.getItem('driftwake.save.v10'),
    }));
    await page.screenshot({ path: new URL('progression-placement-diagnostic.png', outputDir).pathname });
    throw new Error(`Research table placement did not complete: ${JSON.stringify(state).slice(0, 1600)}`, { cause: error });
  });
  await page.locator('.device-status--progression').waitFor({ timeout: 12_000 }).catch(async (error) => {
    const state = await page.evaluate(() => ({
      notice: document.querySelector('.loot-notice')?.textContent?.trim() ?? '',
      prompt: document.querySelector('.interaction-prompt')?.textContent?.trim() ?? '',
      rack: document.querySelector('.device-rack')?.textContent?.trim() ?? '',
      rackClass: document.querySelector('.device-rack')?.className ?? '',
      surface: document.querySelector('.island-readout')?.className ?? '',
    }));
    await page.screenshot({ path: new URL('progression-placement-diagnostic.png', outputDir).pathname });
    throw new Error(`Progression HUD did not appear after placement: ${JSON.stringify(state)}`, { cause: error });
  });
  await inspectCanvasPixels(page, 'progression-placement');
  await page.screenshot({ path: new URL('progression-placement-desktop.png', outputDir).pathname });
  await context.close();
}

async function captureProgressionResearch() {
  const { context, page } = await openDesktopPage('progression-research', { seedSave: true, progressionResearchStart: true });
  await enterGame(page);
  await ensurePointerLock(page);
  const prompt = await aimAroundToPrompt(page, '打开盐迹研究台');
  if (!prompt.includes('打开盐迹研究台')) {
    await page.screenshot({ path: new URL('progression-research-diagnostic.png', outputDir).pathname });
    throw new Error(`Expected research table prompt, received: ${prompt}`);
  }
  await page.keyboard.press('KeyE');
  await page.getByRole('dialog', { name: '盐迹研究台' }).waitFor({ timeout: 4_000 });
  for (const sample of ['盐蚀漂木', '氧化废铁', '盐壳耐火砖']) {
    await page.getByRole('button', { name: `研究${sample}` }).click();
  }
  const smelterProject = page.locator('.research-project').filter({ hasText: '回潮熔炉' });
  await smelterProject.waitFor({ state: 'visible' });
  if (!(await smelterProject.evaluate((element) => element.classList.contains('is-ready')))) {
    throw new Error('Smelter project did not become learnable after researching all samples');
  }
  await page.screenshot({ path: new URL('progression-research-desktop.png', outputDir).pathname });
  await smelterProject.getByRole('button', { name: '学习配方' }).click();
  await smelterProject.getByText('已学习').waitFor({ timeout: 4_000 });
  await page.getByRole('button', { name: '关闭背包' }).click();
  await page.keyboard.press('KeyC');
  const smelterRecipe = page.locator('.recipe-row').filter({ hasText: '回潮熔炉' });
  await smelterRecipe.waitFor({ state: 'visible' });
  if (await smelterRecipe.evaluate((element) => element.classList.contains('is-locked'))) {
    throw new Error('Learned smelter recipe remained locked in crafting');
  }
  await context.close();
}

async function captureProgressionSmelting() {
  const { context, page } = await openDesktopPage('progression-smelting', { seedSave: true, progressionSmeltingStart: true });
  await enterGame(page);
  await page.waitForTimeout(300);
  const prompt = await aimAroundToPrompt(page, '矿石熔炼中');
  if (!prompt.includes('矿石熔炼中')) {
    await page.screenshot({ path: new URL('progression-smelting-diagnostic.png', outputDir).pathname });
    throw new Error(`Expected active smelter prompt, received: ${prompt}`);
  }
  await page.locator('.device-status--progression').filter({ hasText: '熔炼中' }).waitFor({ timeout: 4_000 });
  await page.evaluate(() => {
    const movement = new MouseEvent('mousemove');
    Object.defineProperties(movement, {
      movementX: { value: 220 },
      movementY: { value: 120 },
    });
    document.dispatchEvent(movement);
  });
  await page.waitForTimeout(450);
  await inspectCanvasPixels(page, 'progression-smelting');
  await page.screenshot({ path: new URL('progression-smelting-desktop.png', outputDir).pathname });
  await context.close();
  const { context: readyContext, page: readyPage } = await openDesktopPage('progression-ready', { seedSave: true, progressionReadyStart: true });
  await enterGame(readyPage);
  await readyPage.waitForTimeout(300);
  const readyPrompt = await aimAroundToPrompt(readyPage, '收取潮铸金属锭');
  if (!readyPrompt.includes('收取潮铸金属锭')) {
    throw new Error(`Expected ready smelter prompt, received: ${readyPrompt}`);
  }
  await readyPage.keyboard.press('KeyE');
  await readyPage.waitForFunction(() => document.querySelector('.loot-notice')?.textContent?.includes('+1 金属锭'), null, { timeout: 8_000 });
  await readyPage.keyboard.press('KeyI');
  await readyPage.getByRole('button', { name: /潮铸金属锭/ }).waitFor({ timeout: 8_000 });
  await readyContext.close();
}

async function captureIsland() {
  const { context, page } = await openDesktopPage('island', { seedSave: true, islandStart: true });
  await enterGame(page);
  await page.waitForTimeout(1200);
  await inspectCanvasPixels(page, 'island');
  await page.screenshot({ path: new URL('island-desktop.png', outputDir).pathname });
  await context.close();
}

async function captureIslandInteraction() {
  const { context, page } = await openDesktopPage('island-interaction', { seedSave: true, interactionStart: true });
  await enterGame(page);
  await page.waitForTimeout(650);
  let prompt = '';
  for (let step = 0; step < 14 && !prompt.includes('拾取风干枝料'); step += 1) {
    await page.evaluate(() => {
      const movement = new MouseEvent('mousemove');
      Object.defineProperties(movement, {
        movementX: { value: 0 },
        movementY: { value: 24 },
      });
      document.dispatchEvent(movement);
    });
    await page.waitForTimeout(90);
    prompt = await readInteractionPrompt(page);
  }
  if (!prompt.includes('拾取风干枝料')) {
    await page.waitForFunction(
      () => document.querySelector('.interaction-prompt')?.textContent?.includes('拾取风干枝料'),
      null,
      { timeout: 20_000 },
    ).catch(() => undefined);
    prompt = await readInteractionPrompt(page);
  }
  console.log(`Island interaction prompt: ${prompt}`);
  if (!prompt.includes('拾取风干枝料')) {
    await page.screenshot({ path: new URL('island-interaction-diagnostic.png', outputDir).pathname });
    throw new Error(`Expected branch gathering prompt, received: ${prompt}`);
  }
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => document.querySelector('.loot-notice')?.textContent?.includes('+2 漂木'));
  await inspectCanvasPixels(page, 'island-interaction');
  await page.screenshot({ path: new URL('island-interaction-desktop.png', outputDir).pathname });
  await context.close();
}

async function captureUnderwater() {
  const { context, page } = await openDesktopPage('underwater', { seedSave: true, underwaterStart: true });
  await enterGame(page);
  await page.waitForTimeout(1500);
  await page.locator('.dive-readout.is-visible').waitFor();
  const oxygenLabel = await page.locator('.survival-gauge--oxygen').getAttribute('aria-label');
  const depthLabel = await page.locator('.dive-readout').getAttribute('aria-label');
  console.log(`Underwater HUD: ${oxygenLabel}; ${depthLabel}`);
  console.log(`Underwater FPS: ${(await page.locator('.fps-readout').textContent())?.trim() ?? '--'}`);
  await inspectCanvasPixels(page, 'underwater');
  await page.screenshot({ path: new URL('underwater-desktop.png', outputDir).pathname, timeout: 90_000 });
  await context.close();
}

async function captureUnderwaterInteraction() {
  const { context, page } = await openDesktopPage('underwater-interaction', { seedSave: true, underwaterStart: true });
  await enterGame(page);
  await page.waitForFunction(
    () => document.querySelector('.interaction-prompt')?.textContent?.includes('收割长叶海草'),
    null,
    { timeout: 20_000 },
  );
  const prompt = await readInteractionPrompt(page);
  console.log(`Underwater interaction prompt: ${prompt}`);
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => document.querySelector('.loot-notice')?.textContent?.includes('+2 海草'), null, { timeout: 15_000 });
  await inspectCanvasPixels(page, 'underwater-interaction');
  await page.screenshot({ path: new URL('underwater-interaction-desktop.png', outputDir).pathname, timeout: 90_000 });
  await context.close();
}

async function captureNarrow() {
  const context = await browser.newContext({ viewport: { width: 640, height: 720 }, deviceScaleFactor: 1 });
  await context.addInitScript((save) => {
    localStorage.setItem('driftwake.save.v10', JSON.stringify(save));
  }, narrowProgressionSave);
  const page = await context.newPage();
  monitorPage(page, 'narrow');
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('.primary-command:not(:disabled)', { timeout: 45_000 });
  await enterGame(page);
  await page.waitForTimeout(900);
  const narrowBoxes = await page.evaluate(() => {
    const box = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    };
    return {
      navigation: box('.navigation-readout'),
      hotbar: box('.hotbar'),
      devices: box('.device-rack.is-visible'),
      survival: box('.survival-cluster'),
      island: box('.island-readout'),
      weather: box('.weather-warning.is-visible'),
      actions: box('.hud-actions'),
    };
  });
  const overlaps = (a, b) => Boolean(a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);
  for (const [first, second] of [
    ['navigation', 'hotbar'],
    ['navigation', 'devices'],
    ['navigation', 'survival'],
    ['devices', 'hotbar'],
    ['devices', 'island'],
    ['devices', 'actions'],
    ['weather', 'navigation'],
    ['weather', 'devices'],
    ['weather', 'island'],
  ]) {
    if (overlaps(narrowBoxes[first], narrowBoxes[second])) {
      throw new Error(`Narrow HUD overlap: ${first} intersects ${second}; ${JSON.stringify(narrowBoxes)}`);
    }
  }
  console.log(`Narrow HUD boxes: ${JSON.stringify(narrowBoxes)}`);
  await inspectCanvasPixels(page, 'narrow');
  await page.screenshot({ path: new URL('game-narrow.png', outputDir).pathname });
  await context.close();
}

async function captureUnderwaterNarrow() {
  const context = await browser.newContext({ viewport: { width: 640, height: 720 }, deviceScaleFactor: 1 });
  await context.addInitScript((save) => {
    localStorage.setItem('driftwake.save.v10', JSON.stringify(save));
  }, underwaterSeededSave);
  const page = await context.newPage();
  monitorPage(page, 'underwater-narrow');
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('.primary-command:not(:disabled)', { timeout: 45_000 });
  await enterGame(page);
  await page.waitForTimeout(1200);
  await inspectCanvasPixels(page, 'underwater-narrow');
  await page.screenshot({ path: new URL('underwater-narrow.png', outputDir).pathname });
  await context.close();
}

async function captureNavigation() {
  const { context, page } = await openDesktopPage('navigation', { seedSave: true });
  await enterGame(page);
  await page.waitForTimeout(900);
  await page.locator('.interaction-prompt').filter({ hasText: '收起拾风帆' }).waitFor({ timeout: 8_000 });
  const courseBefore = await page.locator('.navigation-readout').getAttribute('aria-label');
  await page.keyboard.press('KeyR');
  await page.waitForFunction(
    (before) => document.querySelector('.navigation-readout')?.getAttribute('aria-label') !== before,
    courseBefore,
    { timeout: 4_000 },
  );
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => !document.querySelector('.navigation-readout')?.classList.contains('is-sailing'));
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => document.querySelector('.navigation-readout')?.classList.contains('is-sailing'));
  await inspectCanvasPixels(page, 'navigation');
  await page.screenshot({ path: new URL('navigation-desktop.png', outputDir).pathname });
  await context.close();
}

async function captureNavigationInteraction() {
  const { context, page } = await openDesktopPage('navigation-interaction', { seedSave: true, anchorStart: true });
  await enterGame(page);
  await ensurePointerLock(page);
  await page.waitForTimeout(350);
  let prompt = '';
  for (let step = 0; step < 18 && !prompt.includes('起锚恢复航行'); step += 1) {
    await page.evaluate(() => {
      const movement = new MouseEvent('mousemove');
      Object.defineProperties(movement, {
        movementX: { value: 0 },
        movementY: { value: 18 },
      });
      document.dispatchEvent(movement);
    });
    await page.waitForTimeout(80);
    prompt = await readInteractionPrompt(page);
  }
  console.log(`Navigation interaction prompt: ${prompt}`);
  if (!prompt.includes('起锚恢复航行')) {
    await page.screenshot({ path: new URL('navigation-interaction-diagnostic.png', outputDir).pathname });
    throw new Error(`Expected raised-anchor prompt, received: ${prompt}`);
  }
  await page.keyboard.press('KeyE');
  await page.locator('.interaction-prompt').filter({ hasText: '抛下潮石锚' }).waitFor({ timeout: 4_000 });
  if (await page.locator('.navigation-readout').evaluate((element) => element.classList.contains('is-anchored'))) {
    throw new Error('Anchor HUD remained active after raising the anchor');
  }
  await page.keyboard.press('KeyE');
  await page.locator('.interaction-prompt').filter({ hasText: '起锚恢复航行' }).waitFor({ timeout: 4_000 });
  await inspectCanvasPixels(page, 'navigation-interaction');
  await page.screenshot({ path: new URL('navigation-interaction-desktop.png', outputDir).pathname });
  await context.close();
}

async function captureNavigationHelmPlacement() {
  const { context, page } = await openDesktopPage('navigation-helm-placement', {
    seedSave: true,
    navigationHelmPlacementStart: true,
  });
  await enterGame(page);
  await page.keyboard.press('KeyI');
  await page.getByRole('dialog', { name: '野外背包' }).waitFor();
  await page.getByRole('button', { name: /定潮舵台套件/ }).click();
  await page.getByRole('button', { name: '安置到木筏' }).click();
  const prompt = await aimDownToPrompt(page, '安置定潮舵台');
  if (!prompt.includes('安置定潮舵台')) {
    await page.screenshot({ path: new URL('navigation-helm-placement-diagnostic.png', outputDir).pathname });
    throw new Error(`Expected helm placement prompt, received: ${prompt}`);
  }
  await page.mouse.click(desktopWidth / 2, desktopHeight / 2);
  await page.waitForFunction(() => document.querySelector('.loot-notice')?.textContent?.includes('定潮舵台已固定'), null, { timeout: 8_000 });
  await page.waitForFunction(() => document.querySelector('.navigation-readout')?.getAttribute('aria-label')?.includes('已安装舵台'), null, { timeout: 8_000 });
  await page.keyboard.down('KeyS');
  await page.waitForTimeout(180);
  await page.keyboard.up('KeyS');
  await page.evaluate(() => {
    const movement = new MouseEvent('mousemove');
    Object.defineProperties(movement, {
      movementX: { value: 170 },
      movementY: { value: 70 },
    });
    document.dispatchEvent(movement);
  });
  await page.waitForTimeout(350);
  await inspectCanvasPixels(page, 'navigation-helm-placement');
  await page.screenshot({ path: new URL('navigation-helm-placement-desktop.png', outputDir).pathname });
  await context.close();
}

async function captureNavigationRigging() {
  const { context, page } = await openDesktopPage('navigation-rigging', {
    seedSave: true,
    navigationRiggingStart: true,
  });
  await enterGame(page);
  await page.waitForFunction(
    () => document.querySelector('.interaction-prompt')?.textContent?.includes('加装横风抗扭索具'),
    null,
    { timeout: 2_500 },
  ).catch(() => undefined);
  let prompt = await readInteractionPrompt(page);
  if (!prompt.includes('加装横风抗扭索具')) {
    await ensurePointerLock(page);
    prompt = await aimAroundToPrompt(page, '加装横风抗扭索具');
  }
  if (!prompt.includes('加装横风抗扭索具')) {
    await page.screenshot({ path: new URL('navigation-rigging-diagnostic.png', outputDir).pathname });
    throw new Error(`Expected sail reinforcement prompt, received: ${prompt}`);
  }
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => document.querySelector('.loot-notice')?.textContent?.includes('抗风横撑'), null, { timeout: 8_000 });
  await page.locator('.navigation-readout.is-reinforced').waitFor({ timeout: 8_000 });
  await inspectCanvasPixels(page, 'navigation-rigging');
  await page.screenshot({ path: new URL('navigation-rigging-desktop.png', outputDir).pathname });
  await context.close();
}

async function captureNavigationStorm() {
  const { context, page } = await openDesktopPage('navigation-storm', {
    seedSave: true,
    navigationStormStart: true,
  });
  await enterGame(page);
  await page.waitForTimeout(450);
  const initialStormState = await page.evaluate(() => {
    const savedNavigation = JSON.parse(localStorage.getItem('driftwake.save.v10') ?? 'null')?.raft?.navigation ?? null;
    return {
      warningClass: document.querySelector('.weather-warning')?.className ?? 'missing',
      warningText: document.querySelector('.weather-warning')?.textContent?.trim() ?? '',
      navigationClass: document.querySelector('.navigation-readout')?.className ?? 'missing',
      navigationLabel: document.querySelector('.navigation-readout')?.getAttribute('aria-label') ?? '',
      savedNavigation,
    };
  });
  console.log(`Navigation storm initial state: ${JSON.stringify(initialStormState)}`);
  await page.locator('.weather-warning.is-visible').waitFor({ timeout: 8_000 }).catch(async (error) => {
    await page.screenshot({ path: new URL('navigation-storm-diagnostic.png', outputDir).pathname });
    throw new Error(`Storm warning did not become visible: ${JSON.stringify(initialStormState)}`, { cause: error });
  });
  await page.locator('.navigation-readout.is-storm').waitFor({ timeout: 8_000 });
  await page.waitForFunction(
    () => document.querySelector('.interaction-prompt')?.textContent?.includes('切换航线'),
    null,
    { timeout: 2_500 },
  ).catch(() => undefined);
  let prompt = await readInteractionPrompt(page);
  if (!prompt.includes('切换航线')) {
    await ensurePointerLock(page);
    prompt = await aimAroundToPrompt(page, '切换航线');
  }
  if (!prompt.includes('切换航线')) {
    await page.screenshot({ path: new URL('navigation-storm-diagnostic.png', outputDir).pathname });
    throw new Error(`Expected helm route prompt, received: ${prompt}`);
  }
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => document.querySelector('.loot-notice')?.textContent?.includes('顺风避险'), null, { timeout: 8_000 });
  await page.waitForFunction(() => document.querySelector('.navigation-readout')?.getAttribute('aria-label')?.includes('顺风避险'), null, { timeout: 8_000 });
  await page.keyboard.down('KeyS');
  await page.waitForTimeout(180);
  await page.keyboard.up('KeyS');
  await page.evaluate(() => {
    const movement = new MouseEvent('mousemove');
    Object.defineProperties(movement, {
      movementX: { value: 0 },
      movementY: { value: 180 },
    });
    document.dispatchEvent(movement);
  });
  await page.waitForTimeout(450);
  await inspectCanvasPixels(page, 'navigation-storm');
  await page.screenshot({ path: new URL('navigation-storm-desktop.png', outputDir).pathname });
  await context.close();
}

async function captureDriftRisk() {
  const { context, page } = await openDesktopPage('drift-risk', { seedSave: true, driftRiskStart: true });
  await enterGame(page);
  await page.locator('.island-readout.is-drift-risk').waitFor({ timeout: 8_000 });
  await page.locator('.island-readout--departing.is-ashore').waitFor({ timeout: 20_000 });
  await page.evaluate(() => {
    const movement = new MouseEvent('mousemove');
    Object.defineProperties(movement, {
      movementX: { value: -1780 },
      movementY: { value: 120 },
    });
    document.dispatchEvent(movement);
  });
  await page.waitForTimeout(900);
  if (await page.locator('.dive-readout').evaluate((element) => element.classList.contains('is-visible'))) {
    throw new Error('Player fell through the moving island instead of remaining in its expedition frame');
  }
  const status = (await page.locator('.island-readout strong').textContent())?.trim() ?? '';
  if (status !== '正在远离') throw new Error(`Expected island departure status, received: ${status}`);
  await inspectCanvasPixels(page, 'drift-risk');
  await page.screenshot({ path: new URL('drift-risk-desktop.png', outputDir).pathname });
  await context.close();
}

async function captureHook() {
  const { context, page } = await openDesktopPage('hook');
  await enterGame(page);
  await page.waitForTimeout(900);
  if (await page.getByRole('button', { name: '继续漂流' }).isVisible().catch(() => false)) {
    await page.getByRole('button', { name: '继续漂流' }).click();
  }
  await page.mouse.move(760, 430);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  await waitForRuntime(page,
    () => document.querySelector('.game-mount')?.dataset.hookProjectileVisible === 'true',
    10_000,
  ).catch(async (error) => {
    const state = await assertHookVisualOwnership(page, 'hook-cast-timeout');
    throw new Error(`Hook cast did not deploy: ${JSON.stringify(state)}`, { cause: error });
  });
  await assertHookVisualOwnership(page, 'hook-cast', 'deployed');
  await page.waitForTimeout(450);
  if (process.env.CAPTURE_FAST !== '1') {
    await captureCompositedPage(page, new URL('hook-desktop.png', outputDir).pathname);
  }
  await context.close();
}

async function captureSalvage() {
  const { context, page } = await openDesktopPage('salvage', { seedSave: true, salvageStart: true });
  await enterGame(page);
  await ensurePointerLock(page);
  const prompt = await aimDownToPrompt(page, '捡起散落物资', 60);
  if (!prompt.includes('捡起散落物资')) {
    const diagnostic = await page.evaluate(() => ({
      prompt: document.querySelector('.interaction-prompt')?.textContent?.trim() ?? '',
      salvageFocus: document.querySelector('.game-mount')?.dataset.salvageFocus ?? 'missing',
      worldDropCount: document.querySelector('.game-mount')?.dataset.worldDropCount ?? 'missing',
    }));
    await page.screenshot({ path: new URL('salvage-pickup-diagnostic.png', outputDir).pathname });
    throw new Error(`Near-pickup salvage prompt missing: ${JSON.stringify(diagnostic)}`);
  }
  if (process.env.CAPTURE_FAST !== '1') {
    await inspectCanvasPixels(page, 'salvage-pickup');
    await captureCompositedPage(page, new URL('salvage-pickup-desktop.png', outputDir).pathname);
  }
  await page.keyboard.press('KeyE');
  await page.waitForFunction(
    () => document.querySelector('.loot-notice')?.textContent?.includes('+2 纤维'),
    null,
    { timeout: 5_000 },
  );
  await page.waitForFunction(
    () => document.querySelector('.game-mount')?.dataset.worldDropCount === '0',
    null,
    { timeout: 5_000 },
  );

  await page.mouse.down();
  await page.waitForTimeout(180);
  await page.mouse.up();
  await page.waitForFunction(
    () => document.querySelector('.loot-notice')?.textContent?.includes('打捞钩断裂'),
    null,
    { timeout: 5_000 },
  );
  const brokenOwnership = await assertHookVisualOwnership(page, 'salvage-broken-hook');
  if (brokenOwnership.heldVisible) throw new Error('Broken hook remained visible in the player hand');

  await page.keyboard.press('KeyC');
  const craftingDialog = page.getByRole('dialog', { name: '野外背包' });
  await craftingDialog.waitFor();
  await craftingDialog.getByRole('button', { name: '将1个替代打捞钩加入制作队列' }).click({ force: true });
  await page.waitForFunction(
    () => document.querySelector('.game-mount')?.dataset.craftingQueueLength === '1',
    null,
    { timeout: 5_000 },
  );
  await craftingDialog.getByRole('button', { name: '关闭背包' }).click({ force: true });
  await page.getByRole('button', { name: '继续漂流' }).click({ force: true });
  await waitForRuntime(
    page,
    () => {
      const data = document.querySelector('.game-mount')?.dataset;
      return data?.craftingQueueLength === '0'
        && Number(data.craftingCompletedCount) >= 1
        && data.hookState === 'idle'
        && data.hookHeldVisible === 'true'
        && data.hookProjectileVisible === 'false';
    },
    90_000,
  );
  const repairedTitle = await page.getByRole('button', { name: /打捞钩，耐久 48/ }).getAttribute('title');
  if (repairedTitle !== '打捞钩 · 耐久 48/48') {
    throw new Error(`Replacement hook durability did not reset: ${repairedTitle}`);
  }
  const recraftedOwnership = await assertHookVisualOwnership(page, 'salvage-recrafted');
  if (recraftedOwnership.state === 'idle' && !recraftedOwnership.heldVisible) {
    throw new Error(`Recrafted idle hook was not visible: ${JSON.stringify(recraftedOwnership)}`);
  }
  await assertHookVisualOwnership(page, 'salvage-recovery', 'held');
  if (process.env.CAPTURE_FAST !== '1') {
    await inspectCanvasPixels(page, 'salvage-recovery');
    await captureCompositedPage(page, new URL('salvage-recovery-desktop.png', outputDir).pathname);
  }
  await context.close();
}

async function openCollectionNetColdPage(label, save, accelerated = false, options = {}) {
  const context = await browser.newContext({
    viewport: { width: options.width ?? desktopWidth, height: options.height ?? desktopHeight },
    deviceScaleFactor: 1,
  });
  if (accelerated) {
    await context.addInitScript((scale) => {
      const nativeNow = performance.now.bind(performance);
      const origin = nativeNow();
      Object.defineProperty(performance, 'now', {
        configurable: true,
        value: () => origin + (nativeNow() - origin) * scale,
      });
    }, options.simulationTimeScale ?? 4);
  }
  await context.addInitScript(({ currentSave, quality }) => {
    localStorage.setItem('driftwake.save.v17', JSON.stringify(currentSave));
    localStorage.setItem('driftwake.preferences.v2', JSON.stringify({
      version: 2,
      audioEnabled: false,
      muteOnFocusLoss: true,
      cameraMotionMode: 'balanced',
      quality: quality ?? 'low',
      dynamicResolutionEnabled: true,
      audioMix: { master: 0, music: 0, ambience: 0, effects: 0, creatures: 0, ui: 0 },
    }));
  }, { currentSave: save, quality: captureQuality });
  const page = await context.newPage();
  monitorPage(page, label);
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('.primary-command:not(:disabled)', { timeout: 45_000 });
  await enterGame(page);
  return { context, page };
}

async function captureCollectionNet() {
  const { context, page } = await openDesktopPage('collection-net-placement', {
    seedSave: true,
    collectionNetStart: true,
  });
  await enterGame(page);
  await page.keyboard.press('KeyI');
  const pack = page.getByRole('dialog', { name: '野外背包' });
  await pack.waitFor();
  await pack.getByRole('button', { name: /潮兜收集网套件/ }).click({ force: true });
  await pack.getByRole('button', { name: '安置到木筏' }).click({ force: true });
  const placementPrompt = await aimDownToPrompt(page, '固定潮兜收集网', 52);
  if (!placementPrompt.includes('固定潮兜收集网')) {
    const diagnostic = await page.evaluate(() => ({
      prompt: document.querySelector('.interaction-prompt')?.textContent?.trim() ?? '',
      placement: document.querySelector('.game-mount')?.dataset.collectionNetPlacement ?? 'missing',
      valid: document.querySelector('.game-mount')?.dataset.collectionNetPlacementValid ?? 'missing',
    }));
    await page.screenshot({ path: new URL('collection-net-placement-diagnostic.png', outputDir).pathname });
    throw new Error(`Collection-net placement focus failed: ${JSON.stringify(diagnostic)}`);
  }
  await page.mouse.click(desktopWidth / 2, desktopHeight / 2);
  await waitForRuntime(page, () => {
    const data = document.querySelector('.game-mount')?.dataset;
    const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
    return data?.collectionNetCount === '1'
      && saved?.version === 17
      && saved?.raft?.collectionNets?.length === 1
      && !saved?.player?.inventory?.collectionNetKit;
  }, 6_000);
  const placedSave = await page.evaluate(() => JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null'));
  await context.close();

  const { context: captureContext, page: capturePage } = await openCollectionNetColdPage(
    'collection-net-capture',
    placedSave,
    true,
  );

  try {
    await waitForRuntime(capturePage, () => {
      const data = document.querySelector('.game-mount')?.dataset;
      return Number(data?.collectionNetCaptures ?? 0) >= 1
        && Number(data?.collectionNetStored ?? 0) > 0;
    }, 65_000);
  } catch (error) {
    const diagnostic = await capturePage.evaluate(() => {
      const data = document.querySelector('.game-mount')?.dataset;
      const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
      return {
        mount: data?.collectionNetMount,
        nearestDrift: data?.collectionNetNearestDrift,
        captures: data?.collectionNetCaptures,
        stored: data?.collectionNetStored,
        simulationActive: data?.simulationActive,
        simulationTicks: data?.simulationTickCount,
        saveNet: saved?.raft?.collectionNets?.[0] ?? null,
      };
    });
    console.error(`Collection-net capture diagnostic: ${JSON.stringify(diagnostic)}`);
    await capturePage.screenshot({
      path: new URL('collection-net-capture-diagnostic.png', outputDir).pathname,
      timeout: 5_000,
    }).catch(() => undefined);
    if (Number(diagnostic.captures ?? 0) < 1 || Number(diagnostic.stored ?? 0) < 1) {
      throw new Error(`Collection-net passive capture timed out: ${JSON.stringify(diagnostic)}`, { cause: error });
    }
    console.warn('Collection-net capture completed on the timeout boundary; continuing with persisted state checks');
  }
  const captured = await capturePage.evaluate(() => {
    const data = document.querySelector('.game-mount')?.dataset;
    const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
    const storage = saved?.raft?.collectionNets?.[0]?.storage ?? {};
    return {
      count: Number(data?.collectionNetCount ?? 0),
      captures: Number(data?.collectionNetCaptures ?? 0),
      stored: Number(data?.collectionNetStored ?? 0),
      savedStored: Object.values(storage).reduce((total, amount) => total + Number(amount ?? 0), 0),
    };
  });
  if (captured.count !== 1 || captured.captures < 1 || captured.stored <= 0 || captured.savedStored !== captured.stored) {
    throw new Error(`Collection-net passive capture failed: ${JSON.stringify(captured)}`);
  }

  const collectPrompt = await aimAroundToPrompt(capturePage, '收取潮兜物资');
  if (!collectPrompt.includes('收取潮兜物资')) {
    await capturePage.screenshot({ path: new URL('collection-net-collect-diagnostic.png', outputDir).pathname });
    throw new Error(`Collection-net collect focus failed: ${collectPrompt}`);
  }
  await inspectCanvasPixels(capturePage, 'collection-net-loaded');
  if (process.env.CAPTURE_FAST !== '1') {
    await captureCompositedPage(capturePage, new URL('collection-net-loaded-desktop.png', outputDir).pathname);
  }
  await ensurePointerLock(capturePage);
  const resumedCollectPrompt = await aimAroundToPrompt(capturePage, '收取潮兜物资');
  if (!resumedCollectPrompt.includes('收取潮兜物资')) {
    throw new Error(`Collection-net focus was not restored after capture: ${resumedCollectPrompt}`);
  }
  await capturePage.keyboard.press('KeyE');
  await waitForRuntime(capturePage, () => {
    const data = document.querySelector('.game-mount')?.dataset;
    const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
    const storage = saved?.raft?.collectionNets?.[0]?.storage ?? {};
    return data?.collectionNetStored === '0'
      && Object.values(storage).every((amount) => Number(amount ?? 0) <= 0);
  }, 15_000);
  const finalSave = await capturePage.evaluate(() => JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null'));
  if (finalSave?.version !== 17 || finalSave?.raft?.collectionNets?.length !== 1) {
    throw new Error(`Collection-net v17 save missing after collection: ${JSON.stringify(finalSave?.raft?.collectionNets)}`);
  }
  await captureContext.close();

  const { context: reloadContext, page: reloadPage } = await openCollectionNetColdPage(
    'collection-net-cold-reload',
    finalSave,
  );
  await waitForRuntime(reloadPage, () => {
    const data = document.querySelector('.game-mount')?.dataset;
    const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
    return data?.collectionNetCount === '1'
      && data?.collectionNetStored === '0'
      && saved?.version === 17
      && saved?.raft?.collectionNets?.length === 1;
  }, 8_000);
  await inspectCanvasPixels(reloadPage, 'collection-net-cold-reload');
  await reloadPage.keyboard.press('Digit2');
  const dismantlePrompt = await aimAroundToPrompt(reloadPage, '右键拆除');
  if (!dismantlePrompt.includes('右键拆除')) {
    throw new Error(`Collection-net dismantle focus failed: ${dismantlePrompt}`);
  }
  await reloadPage.mouse.click(desktopWidth / 2, desktopHeight / 2, { button: 'right' });
  await waitForRuntime(reloadPage, () => {
    const data = document.querySelector('.game-mount')?.dataset;
    const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
    return data?.collectionNetCount === '0'
      && saved?.raft?.collectionNets?.length === 0
      && saved?.player?.inventory?.collectionNetKit === 1
      && saved?.player?.toolDurability?.hammer === 79;
  }, 15_000);
  console.log(`Collection net loop: ${JSON.stringify(captured)}; cold reload and dismantle: ok`);
  await reloadContext.close();
}

async function selectReinforcementPiece(page) {
  await page.keyboard.press('Digit2');
  await page.evaluate(() => {
    document.querySelector('canvas')?.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: 120,
    }));
  });
  await waitForRuntime(
    page,
    () => document.querySelector('.game-mount')?.dataset.buildPiece === 'reinforcement',
    5_000,
  );
}

async function verifyCollectionNetDestruction(destructionSave, viewport) {
  const destruction = await openCollectionNetColdPage('perimeter-defense-destruction', destructionSave, true, {
    ...viewport,
    simulationTimeScale: 10,
  });
  try {
    await waitForRuntime(destruction.page, () => {
      const data = document.querySelector('.game-mount')?.dataset;
      const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
      return data?.collectionNetCount === '0'
        && Number(data?.worldDropCount ?? 0) >= 1
        && Number(data?.sharkCollectionNetDamageCount ?? 0) >= 1
        && data?.sharkLastRaftTargetKind === 'collectionNet'
        && saved?.raft?.collectionNets?.length === 0
        && saved?.world?.drops?.some((drop) => drop.loot?.timber >= 2 && drop.loot?.fiber >= 1);
    }, 90_000);
  } catch (error) {
    const diagnostics = await destruction.page.evaluate(() => {
      const data = document.querySelector('.game-mount')?.dataset;
      const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
      return {
        simulationTicks: data?.simulationTickCount,
        simulationActive: data?.simulationActive,
        targetKind: data?.sharkRaftTargetKind,
        targetId: data?.sharkRaftTargetId,
        lastKind: data?.sharkLastRaftTargetKind,
        lastId: data?.sharkLastRaftTargetId,
        lastHealth: data?.sharkLastRaftTargetHealth,
        netDamageEvents: data?.sharkCollectionNetDamageCount,
        foundationDamageEvents: data?.sharkFoundationDamageCount,
        netHealth: data?.collectionNetFirstHealth,
        netCount: data?.collectionNetCount,
        worldDropCount: data?.worldDropCount,
        mutation: data?.lastRaftMutation,
        saveNets: saved?.raft?.collectionNets ?? null,
        saveDrops: saved?.world?.drops ?? null,
      };
    });
    throw new Error(`Collection-net destruction timed out: ${JSON.stringify(diagnostics)}`, { cause: error });
  }
  const result = await destruction.page.evaluate(() => {
    const data = document.querySelector('.game-mount')?.dataset;
    const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
    return {
      damageEvents: Number(data?.sharkCollectionNetDamageCount ?? 0),
      worldDrops: Number(data?.worldDropCount ?? 0),
      mutation: data?.lastRaftMutation,
      savedDrops: saved?.world?.drops ?? [],
    };
  });
  await destruction.context.close();
  return result;
}

async function capturePerimeterDestructionProbe() {
  const viewport = { width: 768, height: 480 };
  const destructionSave = {
    ...perimeterDefenseSave,
    player: { ...perimeterDefenseSave.player, selectedTool: 'hook' },
    raft: {
      ...perimeterDefenseSave.raft,
      collectionNets: [{
        id: 'defense-net',
        x: 0,
        z: 1,
        rotation: 2,
        health: 20,
        storage: { timber: 2, fiber: 1 },
      }],
    },
  };
  const result = await verifyCollectionNetDestruction(destructionSave, viewport);
  console.log(`Perimeter destruction probe: ${JSON.stringify(result)}`);
}

async function capturePerimeterDefenseVisual() {
  const viewport = { width: 1024, height: 640 };
  const visual = await openDesktopPage('perimeter-defense-visual', {
    seedSave: true,
    perimeterDefenseVisualStart: true,
    ...viewport,
  });
  await enterGame(visual.page);
  await selectReinforcementPiece(visual.page);
  const prompt = await aimCollectionNetToPrompt(
    visual.page,
    'defense-visual-net',
    '右键拆除',
  );
  if (!prompt.includes('右键拆除')) {
    throw new Error(`Perimeter defense visual focus failed: ${prompt}`);
  }
  await waitForRuntime(
    visual.page,
    () => document.querySelector('.game-mount')?.dataset.raftReinforcedTileCount === '3',
    8_000,
  );
  await captureCompositedPage(
    visual.page,
    new URL('perimeter-defense-visual-desktop.png', outputDir).pathname,
  );
  await inspectCanvasPixels(visual.page, 'perimeter-defense-visual');
  console.log('Perimeter defense visual: three armored foundations, loaded net and reinforcement HUD captured');
  await visual.context.close();
}

async function capturePerimeterDefense() {
  const viewport = { width: 768, height: 480 };
  const placement = await openDesktopPage('perimeter-defense-placement', {
    seedSave: true,
    perimeterDefenseStart: true,
    ...viewport,
  });
  await enterGame(placement.page);
  await selectReinforcementPiece(placement.page);
  const placementPrompt = await aimDownToPrompt(placement.page, '潮铸筏缘护甲', 70);
  if (!placementPrompt.includes('潮铸筏缘护甲')) {
    const diagnostics = await placement.page.evaluate(() => ({
      prompt: document.querySelector('.interaction-prompt')?.textContent?.trim() ?? '',
      build: { ...document.querySelector('.game-mount')?.dataset },
    }));
    await placement.page.screenshot({ path: new URL('perimeter-defense-placement-diagnostic.png', outputDir).pathname });
    throw new Error(`Perimeter reinforcement focus failed: ${JSON.stringify(diagnostics)}`);
  }
  await placement.page.mouse.click(viewport.width / 2, viewport.height / 2);
  await waitForRuntime(placement.page, () => {
    const data = document.querySelector('.game-mount')?.dataset;
    const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
    const host = saved?.raft?.tiles?.find((tile) => tile.x === 0 && tile.z === -1);
    return data?.raftReinforcedTileCount === '1'
      && host?.reinforced === true
      && saved?.player?.inventory?.metalIngot === 1
      && saved?.player?.inventory?.scrap === 2
      && saved?.player?.toolDurability?.hammer === 79;
  }, 10_000);
  if (process.env.CAPTURE_FAST !== '1') {
    await inspectCanvasPixels(placement.page, 'perimeter-defense-armored');
    await captureCompositedPage(
      placement.page,
      new URL('perimeter-defense-armored-desktop.png', outputDir).pathname,
    );
  }
  const installedSave = await placement.page.evaluate(
    () => JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null'),
  );
  console.log('Perimeter defense stage: reinforcement installed');
  await placement.context.close();

  const attackSave = {
    ...installedSave,
    raft: {
      ...installedSave.raft,
      tiles: installedSave.raft.tiles.map((tile) => ({
        ...tile,
        reinforced: tile.x === 0 && tile.z === 1,
      })),
      collectionNets: [{
        id: 'defense-net',
        x: 0,
        z: 1,
        rotation: 2,
        health: 52,
        storage: { timber: 2, fiber: 1 },
      }],
    },
  };
  const attack = await openCollectionNetColdPage('perimeter-defense-attack', attackSave, true, {
    ...viewport,
    simulationTimeScale: 10,
  });
  try {
    await waitForRuntime(attack.page, () => {
      const data = document.querySelector('.game-mount')?.dataset;
      const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
      return Number(data?.sharkCollectionNetDamageCount ?? 0) >= 2
        && data?.sharkLastRaftTargetKind === 'collectionNet'
        && data?.sharkLastRaftTargetId === 'defense-net'
        && data?.collectionNetFirstHealth === '22'
        && saved?.raft?.collectionNets?.[0]?.health === 22
        && saved?.raft?.tiles?.find((tile) => tile.x === 0 && tile.z === 1)?.reinforced === true;
    }, 90_000);
  } catch (error) {
    const diagnostics = await attack.page.evaluate(() => {
      const data = document.querySelector('.game-mount')?.dataset;
      const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
      return {
        simulationTicks: data?.simulationTickCount,
        simulationActive: data?.simulationActive,
        targetKind: data?.sharkRaftTargetKind,
        targetId: data?.sharkRaftTargetId,
        lastKind: data?.sharkLastRaftTargetKind,
        lastId: data?.sharkLastRaftTargetId,
        lastHealth: data?.sharkLastRaftTargetHealth,
        netDamageEvents: data?.sharkCollectionNetDamageCount,
        foundationDamageEvents: data?.sharkFoundationDamageCount,
        netHealth: data?.collectionNetFirstHealth,
        netCount: data?.collectionNetCount,
        reinforcedTiles: data?.raftReinforcedTileCount,
        mutation: data?.lastRaftMutation,
        saveNet: saved?.raft?.collectionNets?.[0] ?? null,
        host: saved?.raft?.tiles?.find((tile) => tile.x === 0 && tile.z === -1) ?? null,
      };
    });
    throw new Error(`Perimeter defense attack timed out: ${JSON.stringify(diagnostics)}`, { cause: error });
  }
  const damaged = await attack.page.evaluate(() => {
    const data = document.querySelector('.game-mount')?.dataset;
    const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
    return {
      damageEvents: Number(data?.sharkCollectionNetDamageCount ?? 0),
      health: Number(data?.collectionNetFirstHealth ?? 0),
      reinforcedTiles: Number(data?.raftReinforcedTileCount ?? 0),
      mutation: data?.lastRaftMutation,
      savedHealth: saved?.raft?.collectionNets?.[0]?.health,
    };
  });
  if (
    damaged.damageEvents !== 2
    || damaged.health !== 22
    || damaged.savedHealth !== 22
    || damaged.reinforcedTiles !== 1
    || damaged.mutation !== 'collectionNet:defense-net:22:false'
  ) {
    throw new Error(`Perimeter defense reduction failed: ${JSON.stringify(damaged)}`);
  }
  console.log(`Perimeter defense stage: armored attack ${JSON.stringify(damaged)}`);
  const damagedSave = await attack.page.evaluate(
    () => JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null'),
  );
  await attack.context.close();

  const repair = await openCollectionNetColdPage('perimeter-defense-repair', damagedSave, false, viewport);
  await waitForRuntime(repair.page, () => {
    const data = document.querySelector('.game-mount')?.dataset;
    const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
    return data?.collectionNetFirstHealth === '22'
      && saved?.raft?.collectionNets?.[0]?.health === 22
      && saved?.raft?.tiles?.find((tile) => tile.x === 0 && tile.z === 1)?.reinforced === true;
  }, 8_000);
  if (process.env.CAPTURE_FAST !== '1') {
    await inspectCanvasPixels(repair.page, 'perimeter-defense-damaged-net');
    await captureCompositedPage(
      repair.page,
      new URL('perimeter-defense-damaged-net-desktop.png', outputDir).pathname,
    );
  }
  await ensurePointerLock(repair.page);
  const repairPrompt = await aimCollectionNetToPrompt(repair.page, 'defense-net', '修补潮兜收集网');
  if (!repairPrompt.includes('修补潮兜收集网')) {
    throw new Error(`Damaged collection-net repair focus failed: ${repairPrompt}`);
  }
  await repair.page.keyboard.press('KeyE');
  await waitForRuntime(repair.page, () => {
    const data = document.querySelector('.game-mount')?.dataset;
    const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
    return data?.collectionNetFirstHealth === '58'
      && saved?.raft?.collectionNets?.[0]?.health === 58
      && saved?.player?.inventory?.timber === 5
      && saved?.player?.inventory?.rope === 3
      && saved?.player?.toolDurability?.hammer === 78;
  }, 12_000);
  const repairedSave = await repair.page.evaluate(
    () => JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null'),
  );
  console.log('Perimeter defense stage: collection net repaired');
  await repair.context.close();

  const reload = await openCollectionNetColdPage('perimeter-defense-cold-reload', repairedSave, false, viewport);
  await waitForRuntime(reload.page, () => {
    const data = document.querySelector('.game-mount')?.dataset;
    const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
    return data?.raftReinforcedTileCount === '1'
      && data?.collectionNetFirstHealth === '58'
      && saved?.raft?.tiles?.find((tile) => tile.x === 0 && tile.z === 1)?.reinforced === true;
  }, 8_000);
  await selectReinforcementPiece(reload.page);
  const dismantlePrompt = await aimLocalPointToPrompt(reload.page, [0, 0.16, 1.38], '此筏格已有护甲');
  if (!dismantlePrompt.includes('此筏格已有护甲')) {
    throw new Error(`Perimeter reinforcement dismantle focus failed: ${dismantlePrompt}`);
  }
  await reload.page.mouse.click(viewport.width / 2, viewport.height / 2, { button: 'right' });
  await waitForRuntime(reload.page, () => {
    const data = document.querySelector('.game-mount')?.dataset;
    const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
    const host = saved?.raft?.tiles?.find((tile) => tile.x === 0 && tile.z === 1);
    return data?.raftReinforcedTileCount === '0'
      && host?.reinforced === false
      && saved?.player?.inventory?.metalIngot === 2
      && saved?.player?.inventory?.scrap === 3
      && saved?.player?.toolDurability?.hammer === 77;
  }, 12_000);
  const unarmoredSave = await reload.page.evaluate(
    () => JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null'),
  );
  console.log('Perimeter defense stage: v17 reload and reinforcement dismantle');
  await reload.context.close();

  const destructionSave = {
    ...unarmoredSave,
    player: { ...unarmoredSave.player, selectedTool: 'hook' },
    raft: {
      ...unarmoredSave.raft,
      collectionNets: unarmoredSave.raft.collectionNets.map((net) => ({
        ...net,
        health: 20,
        storage: { timber: 2, fiber: 1 },
      })),
    },
  };
  const destruction = await verifyCollectionNetDestruction(destructionSave, viewport);
  console.log(`Perimeter defense loop: ${JSON.stringify(damaged)}; destruction ${JSON.stringify(destruction)}; repair, v17 reload and armor dismantle: ok`);
}

async function captureFailureRecovery() {
  const { context, page } = await openDesktopPage('failure', { seedSave: true, failureStart: true });
  await page.getByRole('button', { name: '开始漂流', exact: true }).click();
  await page.locator('.failure-screen.is-visible').waitFor({ timeout: 45_000 });
  await page.waitForFunction(
    () => document.querySelector('.game-mount')?.dataset.failureDropPending === 'false',
    null,
    { timeout: 8_000 },
  );
  const failed = await page.evaluate(() => {
    const mount = document.querySelector('.game-mount');
    const content = document.querySelector('.failure-screen__content')?.getBoundingClientRect();
    const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
    return {
      pointerLocked: Boolean(document.pointerLockElement),
      simulationActive: mount?.dataset.simulationActive,
      cause: mount?.dataset.failureCause,
      pending: mount?.dataset.failureDropPending,
      dropCount: mount?.dataset.failureDropCount,
      worldDropCount: mount?.dataset.worldDropCount,
      content: content ? { left: content.left, top: content.top, right: content.right, bottom: content.bottom } : null,
      viewport: { width: innerWidth, height: innerHeight },
      saved,
    };
  });
  const savedDrop = failed.saved?.world?.drops?.[0];
  if (
    failed.pointerLocked
    || failed.simulationActive !== 'false'
    || failed.cause !== 'shark'
    || failed.pending !== 'false'
    || failed.dropCount !== '6'
    || failed.worldDropCount !== '1'
    || failed.saved?.player?.failure?.dropPending !== false
    || savedDrop?.loot?.timber !== 3
    || savedDrop?.loot?.polymer !== 2
    || savedDrop?.loot?.emergencyWater !== 1
  ) {
    throw new Error(`Failure settlement gate failed: ${JSON.stringify(failed)}`);
  }
  if (
    !failed.content
    || failed.content.left < 0
    || failed.content.top < 0
    || failed.content.right > failed.viewport.width
    || failed.content.bottom > failed.viewport.height
  ) {
    throw new Error(`Failure controls overflow the viewport: ${JSON.stringify(failed)}`);
  }
  await page.getByText('工具、筏体设备与研究进度均已保留', { exact: true }).waitFor();
  await page.getByText('已生成可打捞标记', { exact: true }).waitFor();
  console.log(`Failure settlement: ${JSON.stringify({
    cause: failed.cause,
    dropCount: failed.dropCount,
    worldDropCount: failed.worldDropCount,
    savedDrop,
  })}`);
  if (process.env.CAPTURE_FAST !== '1') {
    await page.screenshot({ path: new URL('failure-desktop.png', outputDir).pathname, timeout: 90_000 });
  }

  const recoveryCommand = await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')]
      .find((candidate) => candidate.textContent?.trim() === '回到木筏');
    return {
      found: button instanceof HTMLButtonElement,
      disabled: button instanceof HTMLButtonElement ? button.disabled : true,
      contextHealthy: document.querySelector('.game-mount')?.dataset.contextHealthy ?? 'missing',
    };
  });
  if (!recoveryCommand.found || recoveryCommand.disabled || recoveryCommand.contextHealthy !== 'true') {
    throw new Error(`Recovery command unavailable before activation: ${JSON.stringify(recoveryCommand)}`);
  }
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')]
      .find((candidate) => candidate.textContent?.trim() === '回到木筏');
    if (!(button instanceof HTMLButtonElement)) throw new Error('Recovery command is missing');
    button.click();
  });
  try {
    await page.locator('.failure-screen').waitFor({ state: 'detached', timeout: 8_000 });
    await page.waitForFunction(() => {
      const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
      return saved?.player?.failure === null && saved?.player?.navigation?.surface === 'raft';
    }, null, { timeout: 8_000 });
  } catch (error) {
    const diagnostic = await page.evaluate(() => {
      const mount = document.querySelector('.game-mount');
      const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
      return {
        contextHealthy: mount?.dataset.contextHealthy,
        simulationActive: mount?.dataset.simulationActive,
        failureVisible: document.querySelector('.failure-screen')?.classList.contains('is-visible') ?? false,
        recoveryText: [...document.querySelectorAll('button')]
          .find((button) => button.textContent?.includes('木筏') || button.textContent?.includes('海况'))
          ?.textContent?.trim() ?? 'missing',
        savedFailure: saved?.player?.failure ?? 'missing',
        savedNavigation: saved?.player?.navigation ?? 'missing',
      };
    }).catch(() => ({ rendererExited: true }));
    throw new Error(`Recovery transition failed: ${JSON.stringify(diagnostic)}`, { cause: error });
  }
  const recovered = await page.evaluate(() => {
    const mount = document.querySelector('.game-mount');
    const saved = JSON.parse(localStorage.getItem('driftwake.save.v17') ?? 'null');
    return {
      failureCause: mount?.dataset.failureCause,
      worldDropCount: mount?.dataset.worldDropCount,
      survival: saved?.player?.survival,
      navigation: saved?.player?.navigation,
      dropped: saved?.world?.drops?.[0]?.loot,
    };
  });
  if (
    recovered.failureCause !== 'none'
    || recovered.worldDropCount !== '1'
    || recovered.survival?.health !== 62
    || recovered.survival?.thirst !== 44
    || recovered.survival?.hunger !== 48
    || recovered.navigation?.surface !== 'raft'
    || Math.abs(recovered.navigation?.x ?? 99) > 0.01
    || Math.abs((recovered.navigation?.z ?? 99) - 1.08) > 0.01
    || recovered.dropped?.timber !== 3
  ) {
    throw new Error(`Failure recovery gate failed: ${JSON.stringify(recovered)}`);
  }
  await page.getByRole('button', { name: '继续漂流', exact: true }).waitFor({ timeout: 8_000 });
  if (process.env.CAPTURE_FAST !== '1') {
    await page.screenshot({ path: new URL('failure-recovered-desktop.png', outputDir).pathname, timeout: 90_000 });
  }
  console.log(`Failure recovery: ${JSON.stringify(recovered)}`);
  await context.close();
}

async function captureMobile() {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  monitorPage(page, 'mobile');
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.screenshot({ path: new URL('capability-mobile.png', outputDir).pathname });
  await context.close();
}

try {
  if (captureOnly === 'all' || captureOnly === 'title') await captureTitle();
  if (captureOnly === 'all' || captureOnly === 'game') await captureGame();
  if (captureOnly === 'all' || captureOnly === 'pause') await capturePause();
  if (captureOnly === 'all' || captureOnly === 'hook') await captureHook();
  if (captureOnly === 'all' || captureOnly === 'salvage') await captureSalvage();
  if (captureOnly === 'all' || captureOnly === 'collection-net') await captureCollectionNet();
  if (captureOnly === 'all' || captureOnly === 'perimeter-defense') await capturePerimeterDefense();
  if (captureOnly === 'perimeter-destruction') await capturePerimeterDestructionProbe();
  if (captureOnly === 'perimeter-defense-visual') await capturePerimeterDefenseVisual();
  if (captureOnly === 'all' || captureOnly === 'failure') await captureFailureRecovery();
  if (captureOnly === 'all' || captureOnly === 'pack') await capturePack();
  if (captureOnly === 'all' || captureOnly === 'crafting') await captureCrafting();
  if (captureOnly === 'all' || captureOnly === 'survival') await captureSurvivalPressure();
  if (captureOnly === 'all' || captureOnly === 'durability') await captureToolDurability();
  if (captureOnly === 'all' || captureOnly === 'building') await captureBuildingStructures();
  if (captureOnly === 'all' || captureOnly === 'settings') await captureSettings();
  if (captureOnly === 'all' || captureOnly === 'devices') await captureDevices();
  if (captureOnly === 'all' || captureOnly === 'advanced') await captureAdvancedDevices();
  if (captureOnly === 'all' || captureOnly === 'signal') await captureSignalNetwork();
  if (captureOnly === 'all' || captureOnly === 'planting-placement') await capturePlantingPlacement();
  if (captureOnly === 'all' || captureOnly === 'planting-interaction') await capturePlantingInteraction();
  if (captureOnly === 'all' || captureOnly === 'planting-bird') await capturePlantingBird();
  if (captureOnly === 'all' || captureOnly === 'progression-placement') await captureProgressionPlacement();
  if (captureOnly === 'all' || captureOnly === 'progression-research') await captureProgressionResearch();
  if (captureOnly === 'all' || captureOnly === 'progression-smelting') await captureProgressionSmelting();
  if (captureOnly === 'all' || captureOnly === 'island') await captureIsland();
  if (captureOnly === 'all' || captureOnly === 'island-interaction') await captureIslandInteraction();
  if (captureOnly === 'all' || captureOnly === 'underwater') await captureUnderwater();
  if (captureOnly === 'all' || captureOnly === 'underwater-interaction') await captureUnderwaterInteraction();
  if (captureOnly === 'all' || captureOnly === 'narrow') await captureNarrow();
  if (captureOnly === 'all' || captureOnly === 'underwater-narrow') await captureUnderwaterNarrow();
  if (captureOnly === 'all' || captureOnly === 'navigation') await captureNavigation();
  if (captureOnly === 'all' || captureOnly === 'navigation-interaction') await captureNavigationInteraction();
  if (captureOnly === 'all' || captureOnly === 'navigation-helm-placement') await captureNavigationHelmPlacement();
  if (captureOnly === 'all' || captureOnly === 'navigation-rigging') await captureNavigationRigging();
  if (captureOnly === 'all' || captureOnly === 'navigation-storm') await captureNavigationStorm();
  if (captureOnly === 'all' || captureOnly === 'drift-risk') await captureDriftRisk();
  if (captureOnly === 'all' || captureOnly === 'mobile') await captureMobile();
} finally {
  await browser.close();
  browserRuntime.cleanup();
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Captured Driftwake at ${baseUrl}`);
}
