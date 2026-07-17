import { normalizeInventory, type Inventory, type ToolId } from './items';
import { INITIAL_SURVIVAL, normalizeSurvival, type SurvivalState } from './survival';
import { MAX_RAFT_DEVICES, deviceKey, sanitizeSavedDevice, type SavedDeviceState } from './devices';
import {
  createDefaultIslandState,
  islandTransform,
  isIslandWalkable,
  sanitizeIslandState,
  type SavedIslandState,
} from './island';
import {
  WATER_SURFACE_Y,
  createDefaultUnderwaterState,
  isReefNavigable,
  sampleReefFloorHeight,
  sanitizeUnderwaterState,
  type SavedUnderwaterState,
} from './underwater';
import {
  createDefaultNavigationState,
  sanitizeNavigationState,
  type SavedNavigationState,
} from './navigation';
import {
  createDefaultPlantingState,
  sanitizePlantingState,
  type SavedPlantingState,
} from './planting';
import {
  createDefaultProgressionState,
  sanitizeProgressionState,
  type SavedProgressionState,
} from './progression';

export const SAVE_VERSION = 10;
export const SAVE_KEY = 'driftwake.save.v10';
export const LEGACY_SAVE_KEYS = ['driftwake.save.v9', 'driftwake.save.v8', 'driftwake.save.v7', 'driftwake.save.v6', 'driftwake.save.v5', 'driftwake.save.v4', 'driftwake.save.v3', 'driftwake.save.v2', 'driftwake.save.v1'] as const;

export type PlayerSurface = 'raft' | 'island' | 'water';

export interface SavedPlayerNavigation {
  surface: PlayerSurface;
  x: number;
  y?: number;
  z: number;
}

export interface SavedRaftTile {
  x: number;
  z: number;
  health: number;
}

export interface DriftwakeSave {
  version: typeof SAVE_VERSION;
  savedAt: number;
  player: {
    inventory: Inventory;
    survival: SurvivalState;
    selectedTool: ToolId;
    playSeconds: number;
    navigation: SavedPlayerNavigation;
  };
  raft: {
    tiles: SavedRaftTile[];
    devices: SavedDeviceState[];
    navigation: SavedNavigationState;
    planting: SavedPlantingState;
    progression: SavedProgressionState;
  };
  world: {
    island: SavedIslandState;
    underwater: SavedUnderwaterState;
  };
}

const TOOL_IDS = new Set<ToolId>(['hook', 'hammer', 'spear', 'metalSpear', 'fishingRod', 'axe', 'metalAxe']);

function finiteInteger(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
}

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function sanitizeNavigation(value: unknown, island: SavedIslandState): SavedPlayerNavigation {
  if (!value || typeof value !== 'object') return { surface: 'raft', x: 0, z: 1.08 };
  const candidate = value as Partial<SavedPlayerNavigation>;
  const x = finiteNumber(candidate.x);
  const z = finiteNumber(candidate.z, 1.08);
  if (candidate.surface === 'island' && island.phase !== 'approaching') {
    const transform = islandTransform(island);
    if (isIslandWalkable(island.seed, x - transform.x, z - transform.z)) {
      return { surface: 'island', x, z };
    }
  }
  if (candidate.surface === 'water' && island.phase !== 'approaching') {
    const transform = islandTransform(island);
    const localX = x - transform.x;
    const localZ = z - transform.z;
    const floor = sampleReefFloorHeight(island.seed, localX, localZ);
    if (floor !== null && isReefNavigable(island.seed, localX, localZ)) {
      return {
        surface: 'water',
        x,
        y: Math.max(floor + 0.72, Math.min(WATER_SURFACE_Y, finiteNumber(candidate.y, WATER_SURFACE_Y))),
        z,
      };
    }
  }
  return {
    surface: 'raft',
    x: Math.max(-12, Math.min(12, x)),
    z: Math.max(-12, Math.min(12, z)),
  };
}

export function createDefaultRaftTiles(): SavedRaftTile[] {
  const tiles: SavedRaftTile[] = [];
  for (let x = -1; x <= 1; x += 1) {
    for (let z = -1; z <= 1; z += 1) tiles.push({ x, z, health: 100 });
  }
  return tiles;
}

export function sanitizeSave(value: unknown): DriftwakeSave | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as {
    version?: number;
    savedAt?: number;
    player?: Partial<DriftwakeSave['player']>;
    raft?: {
      tiles?: SavedRaftTile[];
      devices?: SavedDeviceState[];
      navigation?: SavedNavigationState;
      planting?: SavedPlantingState;
      progression?: SavedProgressionState;
    };
    world?: { island?: SavedIslandState; underwater?: SavedUnderwaterState };
  };
  if (
    (candidate.version !== 1 && candidate.version !== 2 && candidate.version !== 3 && candidate.version !== 4 && candidate.version !== 5 && candidate.version !== 6 && candidate.version !== 7 && candidate.version !== 8 && candidate.version !== 9 && candidate.version !== SAVE_VERSION) ||
    !candidate.player ||
    !candidate.raft
  ) return null;
  let island = candidate.version >= 3 ? sanitizeIslandState(candidate.world?.island) : createDefaultIslandState();
  if (candidate.version < 5 && island.phase === 'docked') {
    island = { ...island, elapsed: Math.min(18, island.elapsed) };
  }
  const underwater =
    candidate.version >= 4
      ? sanitizeUnderwaterState(candidate.world?.underwater, island.seed, island.cycle)
      : createDefaultUnderwaterState(island.seed, island.cycle);
  const inventory = normalizeInventory(candidate.player.inventory ?? {});
  inventory.hook = 1;
  const selectedCandidate = candidate.player.selectedTool;
  const selectedTool: ToolId =
    selectedCandidate !== undefined && TOOL_IDS.has(selectedCandidate) && (inventory[selectedCandidate] ?? 0) > 0
      ? selectedCandidate
      : 'hook';
  const rawTiles = Array.isArray(candidate.raft.tiles) ? candidate.raft.tiles : [];
  const seen = new Set<string>();
  const tiles = rawTiles
    .map((tile) => ({
      x: finiteInteger(tile?.x),
      z: finiteInteger(tile?.z),
      health: Math.max(1, Math.min(100, finiteInteger(tile?.health, 100))),
    }))
    .filter((tile) => {
      const key = `${tile.x}:${tile.z}`;
      if (Math.abs(tile.x) > 12 || Math.abs(tile.z) > 12 || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const stableTiles = tiles.length > 0 ? tiles : createDefaultRaftTiles();
  const tileKeys = new Set(stableTiles.map((tile) => deviceKey(tile.x, tile.z)));
  const occupied = new Set<string>();
  const deviceIds = new Set<string>();
  const rawDevices = candidate.version >= 2 && Array.isArray(candidate.raft.devices) ? candidate.raft.devices : [];
  const devices = rawDevices
    .map(sanitizeSavedDevice)
    .filter((device): device is SavedDeviceState => {
      if (!device || Math.abs(device.x) > 12 || Math.abs(device.z) > 12) return false;
      const key = deviceKey(device.x, device.z);
      if (!tileKeys.has(key) || occupied.has(key) || deviceIds.has(device.id) || occupied.size >= MAX_RAFT_DEVICES) return false;
      occupied.add(key);
      deviceIds.add(device.id);
      return true;
    });
  const rawNavigation =
    candidate.version >= 5
      ? sanitizeNavigationState(candidate.raft.navigation)
      : createDefaultNavigationState();
  const navigationDevices = rawNavigation.devices.filter((device) => {
      if (Math.abs(device.x) > 12 || Math.abs(device.z) > 12) return false;
      const key = deviceKey(device.x, device.z);
      if (!tileKeys.has(key) || occupied.has(key)) return false;
      occupied.add(key);
      if (device.type === 'anchor' && island.phase !== 'docked') device.deployed = false;
      return true;
    });
  const navigation = {
    ...rawNavigation,
    routeMode: navigationDevices.some((device) => device.type === 'helm') ? rawNavigation.routeMode : 'manual' as const,
    devices: navigationDevices,
  };
  const rawPlanting = candidate.version >= 6
    ? sanitizePlantingState(candidate.raft.planting)
    : createDefaultPlantingState();
  const plantingPlanters = rawPlanting.planters.filter((planter) => {
    const key = deviceKey(planter.x, planter.z);
    if (!tileKeys.has(key) || occupied.has(key)) return false;
    occupied.add(key);
    return true;
  });
  const plantingBirdTargetValid = rawPlanting.birdTargetId !== null && plantingPlanters.some(
    (planter) => planter.id === rawPlanting.birdTargetId,
  );
  const planting = {
    ...rawPlanting,
    planters: plantingPlanters,
    birdPhase: plantingBirdTargetValid ? rawPlanting.birdPhase : 'absent' as const,
    birdElapsed: plantingBirdTargetValid ? rawPlanting.birdElapsed : 0,
    birdTargetId: plantingBirdTargetValid ? rawPlanting.birdTargetId : null,
  };
  const rawProgression = candidate.version >= 7
    ? sanitizeProgressionState(candidate.raft.progression)
    : createDefaultProgressionState();
  const progression = {
    ...rawProgression,
    devices: rawProgression.devices.filter((device) => {
      const key = deviceKey(device.x, device.z);
      if (!tileKeys.has(key) || occupied.has(key)) return false;
      occupied.add(key);
      return true;
    }),
  };

  return {
    version: SAVE_VERSION,
    savedAt: typeof candidate.savedAt === 'number' && Number.isFinite(candidate.savedAt) ? candidate.savedAt : Date.now(),
    player: {
      inventory,
      survival: normalizeSurvival(candidate.player.survival ?? INITIAL_SURVIVAL),
      selectedTool,
      playSeconds: Math.max(0, finiteInteger(candidate.player.playSeconds)),
      navigation: sanitizeNavigation(candidate.player.navigation, island),
    },
    raft: { tiles: stableTiles, devices, navigation, planting, progression },
    world: { island, underwater },
  };
}

export function loadSave(storage: Pick<Storage, 'getItem'> = window.localStorage): DriftwakeSave | null {
  for (const key of [SAVE_KEY, ...LEGACY_SAVE_KEYS]) {
    try {
      const raw = storage.getItem(key);
      if (!raw) continue;
      const save = sanitizeSave(JSON.parse(raw));
      if (save) return save;
    } catch {
      continue;
    }
  }
  return null;
}

export function writeSave(save: DriftwakeSave, storage: Pick<Storage, 'setItem'> = window.localStorage): boolean {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}
