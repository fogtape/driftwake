import { itemCount, normalizeInventory, preferredToolOrder, type Inventory, type ItemBundle, type ToolId } from './items';
import { normalizeToolDurability, type ToolDurability } from './toolDurability';
import { INITIAL_SURVIVAL, normalizeSurvival, type SurvivalState } from './survival';
import { MAX_RAFT_DEVICES, deviceKey, sanitizeSavedDevice, type SavedDeviceState } from './devices';
import {
  createDefaultIslandState,
  islandDockZForRaft,
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
import { sanitizeFailureRecord, type FailureRecord } from './failure';
import {
  createDefaultCraftingQueue,
  sanitizeCraftingQueue,
  type CraftingQueueState,
} from './craftingQueue';
import {
  sampleRaftWalkableSurfaces,
  sanitizeRaftFootHeight,
  sanitizeRaftStructures,
  structurePlacementKey,
  type FoundationCoordinate,
  type SavedRaftStructure,
} from './raftStructures';
import { sanitizeCollectionNets, type SavedCollectionNet } from './collectionNets';

export const SAVE_VERSION = 16;
export const SAVE_KEY = 'driftwake.save.v16';
export const LEGACY_SAVE_KEYS = ['driftwake.save.v15', 'driftwake.save.v14', 'driftwake.save.v13', 'driftwake.save.v12', 'driftwake.save.v11', 'driftwake.save.v10', 'driftwake.save.v9', 'driftwake.save.v8', 'driftwake.save.v7', 'driftwake.save.v6', 'driftwake.save.v5', 'driftwake.save.v4', 'driftwake.save.v3', 'driftwake.save.v2', 'driftwake.save.v1'] as const;

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

export interface SavedWorldDrop {
  loot: ItemBundle;
  x: number;
  y: number;
  z: number;
}

export interface DriftwakeSave {
  version: typeof SAVE_VERSION;
  savedAt: number;
  player: {
    inventory: Inventory;
    toolDurability: ToolDurability;
    survival: SurvivalState;
    selectedTool: ToolId;
    playSeconds: number;
    navigation: SavedPlayerNavigation;
    failure: FailureRecord | null;
    crafting: CraftingQueueState;
  };
  raft: {
    tiles: SavedRaftTile[];
    structures: SavedRaftStructure[];
    collectionNets: SavedCollectionNet[];
    devices: SavedDeviceState[];
    navigation: SavedNavigationState;
    planting: SavedPlantingState;
    progression: SavedProgressionState;
  };
  world: {
    island: SavedIslandState;
    underwater: SavedUnderwaterState;
    drops: SavedWorldDrop[];
  };
}

const TOOL_IDS = new Set<ToolId>(['hook', 'hammer', 'spear', 'metalSpear', 'fishingRod', 'axe', 'metalAxe']);

function finiteInteger(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
}

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function sanitizeNavigation(
  value: unknown,
  island: SavedIslandState,
  dockZ: number,
  legacyDockLayout: boolean,
  version: number,
  structures: readonly SavedRaftStructure[],
  foundations: readonly FoundationCoordinate[],
): SavedPlayerNavigation {
  if (!value || typeof value !== 'object') return { surface: 'raft', x: 0, z: 1.08 };
  const candidate = value as Partial<SavedPlayerNavigation>;
  const x = finiteNumber(candidate.x);
  const z = finiteNumber(candidate.z, 1.08);
  const transform = islandTransform(island, dockZ);
  const sourceTransform = legacyDockLayout ? islandTransform(island) : transform;
  const localX = x - sourceTransform.x;
  const localZ = z - sourceTransform.z;
  const relocatedX = x + transform.x - sourceTransform.x;
  const relocatedZ = z + transform.z - sourceTransform.z;
  if (candidate.surface === 'island' && island.phase !== 'approaching') {
    if (isIslandWalkable(island.seed, localX, localZ)) {
      return { surface: 'island', x: relocatedX, z: relocatedZ };
    }
  }
  if (candidate.surface === 'water' && island.phase !== 'approaching') {
    const floor = sampleReefFloorHeight(island.seed, localX, localZ);
    if (floor !== null && isReefNavigable(island.seed, localX, localZ)) {
      return {
        surface: 'water',
        x: relocatedX,
        y: Math.max(floor + 0.72, Math.min(WATER_SURFACE_Y, finiteNumber(candidate.y, WATER_SURFACE_Y))),
        z: relocatedZ,
      };
    }
  }
  const raftX = Math.max(-12, Math.min(12, x));
  const raftZ = Math.max(-12, Math.min(12, z));
  const footHeight = version >= 15
    ? sanitizeRaftFootHeight(sampleRaftWalkableSurfaces(structures, foundations, raftX, raftZ), candidate.y)
    : 0;
  return {
    surface: 'raft',
    x: raftX,
    ...(footHeight > 0.01 ? { y: Number(footHeight.toFixed(3)) } : {}),
    z: raftZ,
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
      structures?: SavedRaftStructure[];
      collectionNets?: SavedCollectionNet[];
      devices?: SavedDeviceState[];
      navigation?: SavedNavigationState;
      planting?: SavedPlantingState;
      progression?: SavedProgressionState;
    };
    world?: { island?: SavedIslandState; underwater?: SavedUnderwaterState; drops?: SavedWorldDrop[] };
  };
  const version = candidate.version;
  if (
    typeof version !== 'number' ||
    !Number.isInteger(version) ||
    version < 1 ||
    version > SAVE_VERSION ||
    !candidate.player ||
    !candidate.raft
  ) return null;
  let island = version >= 3 ? sanitizeIslandState(candidate.world?.island) : createDefaultIslandState();
  if (version < 5 && island.phase === 'docked') {
    island = { ...island, elapsed: Math.min(18, island.elapsed) };
  }
  const legacyDockLayout = island.dockVersion === 0;
  const underwater =
    version >= 4
      ? sanitizeUnderwaterState(candidate.world?.underwater, island.seed, island.cycle)
      : createDefaultUnderwaterState(island.seed, island.cycle);
  const inventory = normalizeInventory(candidate.player.inventory ?? {});
  const toolDurability = normalizeToolDurability(inventory, candidate.player.toolDurability);
  const crafting = version >= 13
    ? sanitizeCraftingQueue(candidate.player.crafting)
    : createDefaultCraftingQueue();
  const selectedCandidate = candidate.player.selectedTool;
  const selectedTool: ToolId =
    selectedCandidate !== undefined && TOOL_IDS.has(selectedCandidate) && (inventory[selectedCandidate] ?? 0) > 0
      ? selectedCandidate
      : preferredToolOrder(inventory).find((tool) => itemCount(inventory, tool) > 0) ?? 'hook';
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
  const structures = version >= 14
    ? sanitizeRaftStructures(candidate.raft.structures, stableTiles)
    : [];
  const occupiedStructureEdges = new Set(
    structures
      .filter((structure) => structure.level === 0 && (structure.type === 'wall' || structure.type === 'door'))
      .map(structurePlacementKey),
  );
  const collectionNets = version >= 16
    ? sanitizeCollectionNets(candidate.raft.collectionNets, stableTiles, occupiedStructureEdges)
    : [];
  const tileKeys = new Set(stableTiles.map((tile) => deviceKey(tile.x, tile.z)));
  const occupied = new Set(
    structures
      .filter((structure) => structure.level === 0 && (structure.type === 'pillar' || structure.type === 'stairs'))
      .map((structure) => deviceKey(structure.x, structure.z)),
  );
  const deviceIds = new Set<string>();
  const rawDevices = version >= 2 && Array.isArray(candidate.raft.devices) ? candidate.raft.devices : [];
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
    version >= 5
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
  const rawPlanting = version >= 6
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
  const rawProgression = version >= 7
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
  const drops = version >= 11 && Array.isArray(candidate.world?.drops)
    ? candidate.world.drops
      .slice(0, 8)
      .map((drop) => ({
        loot: normalizeInventory(drop?.loot ?? {}),
        x: Math.max(-36, Math.min(36, finiteNumber(drop?.x))),
        y: Math.max(-4, Math.min(4, finiteNumber(drop?.y))),
        z: Math.max(-120, Math.min(24, finiteNumber(drop?.z))),
      }))
      .filter((drop) => Object.keys(drop.loot).length > 0)
    : [];

  return {
    version: SAVE_VERSION,
    savedAt: typeof candidate.savedAt === 'number' && Number.isFinite(candidate.savedAt) ? candidate.savedAt : Date.now(),
    player: {
      inventory,
      toolDurability,
      survival: normalizeSurvival(candidate.player.survival ?? INITIAL_SURVIVAL),
      selectedTool,
      playSeconds: Math.max(0, finiteInteger(candidate.player.playSeconds)),
      navigation: sanitizeNavigation(
        candidate.player.navigation,
        island,
        islandDockZForRaft(stableTiles),
        legacyDockLayout,
        version,
        structures,
        stableTiles,
      ),
      failure: version >= 12 ? sanitizeFailureRecord(candidate.player.failure) : null,
      crafting,
    },
    raft: { tiles: stableTiles, structures, collectionNets, devices, navigation, planting, progression },
    world: { island: { ...island, dockVersion: 1 }, underwater, drops },
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
