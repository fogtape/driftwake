import { normalizeInventory, type Inventory, type ToolId } from './items';
import { INITIAL_SURVIVAL, normalizeSurvival, type SurvivalState } from './survival';
import { MAX_RAFT_DEVICES, deviceKey, sanitizeSavedDevice, type SavedDeviceState } from './devices';

export const SAVE_VERSION = 2;
export const SAVE_KEY = 'driftwake.save.v2';
export const LEGACY_SAVE_KEYS = ['driftwake.save.v1'] as const;

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
  };
  raft: {
    tiles: SavedRaftTile[];
    devices: SavedDeviceState[];
  };
}

const TOOL_IDS = new Set<ToolId>(['hook', 'hammer', 'spear', 'fishingRod']);

function finiteInteger(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
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
    player?: DriftwakeSave['player'];
    raft?: { tiles?: SavedRaftTile[]; devices?: SavedDeviceState[] };
  };
  if ((candidate.version !== 1 && candidate.version !== SAVE_VERSION) || !candidate.player || !candidate.raft) return null;
  const inventory = normalizeInventory(candidate.player.inventory ?? {});
  inventory.hook = 1;
  const selectedCandidate = candidate.player.selectedTool;
  const selectedTool = TOOL_IDS.has(selectedCandidate) && (inventory[selectedCandidate] ?? 0) > 0 ? selectedCandidate : 'hook';
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
  const rawDevices = candidate.version === SAVE_VERSION && Array.isArray(candidate.raft.devices) ? candidate.raft.devices : [];
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

  return {
    version: SAVE_VERSION,
    savedAt: typeof candidate.savedAt === 'number' && Number.isFinite(candidate.savedAt) ? candidate.savedAt : Date.now(),
    player: {
      inventory,
      survival: normalizeSurvival(candidate.player.survival ?? INITIAL_SURVIVAL),
      selectedTool,
      playSeconds: Math.max(0, finiteInteger(candidate.player.playSeconds)),
    },
    raft: { tiles: stableTiles, devices },
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
