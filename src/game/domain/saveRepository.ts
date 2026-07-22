import {
  LEGACY_SAVE_KEYS,
  SAVE_KEY,
  SAVE_VERSION,
  loadSave,
  sanitizeSave,
  type DriftwakeSave,
} from './save';

export const SAVE_SLOT_IDS = ['slot-1', 'slot-2', 'slot-3'] as const;
export type SaveSlotId = (typeof SAVE_SLOT_IDS)[number];

export const ACTIVE_SAVE_SLOT_KEY = 'driftwake.save.active.v1';
export const ACTIVE_WORKING_SAVE_SLOT_KEY = 'driftwake.save.working-slot.v1';
export const SAVE_SLOT_STORAGE_PREFIX = 'driftwake.save.';

export type SaveLoadSource = 'primary' | 'working' | 'backup' | 'legacy' | 'empty';

export interface SaveSlotLoadResult {
  slot: SaveSlotId;
  save: DriftwakeSave | null;
  source: SaveLoadSource;
  recovered: boolean;
  corrupted: boolean;
}

export interface SaveSlotSummary {
  slot: SaveSlotId;
  save: DriftwakeSave | null;
  source: SaveLoadSource;
  status: 'empty' | 'ready' | 'recovered' | 'corrupt';
  savedAt: number | null;
  playSeconds: number;
  raftTiles: number;
  failure: boolean;
}

export type SaveStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function storageOrWindow(storage?: SaveStorage): SaveStorage {
  return storage ?? window.localStorage;
}

function isSaveSlotId(value: unknown): value is SaveSlotId {
  return typeof value === 'string' && (SAVE_SLOT_IDS as readonly string[]).includes(value);
}

export function saveSlotKey(slot: SaveSlotId): string {
  return `${SAVE_SLOT_STORAGE_PREFIX}${slot}.v${SAVE_VERSION}`;
}

export function saveSlotBackupKey(slot: SaveSlotId): string {
  return `${SAVE_SLOT_STORAGE_PREFIX}${slot}.backup.v${SAVE_VERSION}`;
}

function safeGet(storage: SaveStorage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage: SaveStorage, key: string, value: string): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemove(storage: SaveStorage, key: string): boolean {
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

interface ParsedRaw {
  raw: string | null;
  save: DriftwakeSave | null;
  normalized: string | null;
}

function parseRaw(raw: string | null): ParsedRaw {
  if (!raw) return { raw: null, save: null, normalized: null };
  try {
    const save = sanitizeSave(JSON.parse(raw));
    return { raw, save, normalized: save ? JSON.stringify(save) : null };
  } catch {
    return { raw, save: null, normalized: null };
  }
}

function legacySave(storage: SaveStorage): DriftwakeSave | null {
  for (const key of LEGACY_SAVE_KEYS) {
    const parsed = parseRaw(safeGet(storage, key));
    if (parsed.save) return parsed.save;
  }
  return null;
}

function workingBelongsTo(slot: SaveSlotId, storage: SaveStorage): boolean {
  if (getActiveSaveSlot(storage) !== slot) return false;
  const markedSlot = safeGet(storage, ACTIVE_WORKING_SAVE_SLOT_KEY);
  // Older v18 installations only have the single working key. It is safe to
  // adopt that key for the default first slot, but never for a later slot.
  return markedSlot === slot || (!markedSlot && slot === 'slot-1');
}

export function getActiveSaveSlot(storage?: SaveStorage): SaveSlotId {
  const value = safeGet(storageOrWindow(storage), ACTIVE_SAVE_SLOT_KEY);
  return isSaveSlotId(value) ? value : 'slot-1';
}

function readSlotInternal(
  slot: SaveSlotId,
  storage: SaveStorage,
  includeWorking: boolean,
  includeLegacy: boolean,
): SaveSlotLoadResult {
  const primary = parseRaw(safeGet(storage, saveSlotKey(slot)));
  const backup = parseRaw(safeGet(storage, saveSlotBackupKey(slot)));
  const working = includeWorking ? parseRaw(safeGet(storage, SAVE_KEY)) : parseRaw(null);
  const corrupted = Boolean(
    (primary.raw && !primary.save)
    || (backup.raw && !backup.save)
    || (working.raw && !working.save),
  );

  if (primary.save && working.save) {
    const useWorking = working.save.savedAt >= primary.save.savedAt && working.normalized !== primary.normalized;
    return {
      slot,
      save: useWorking ? working.save : primary.save,
      source: useWorking ? 'working' : 'primary',
      recovered: false,
      corrupted,
    };
  }
  if (primary.save) return { slot, save: primary.save, source: 'primary', recovered: false, corrupted };
  if (working.save && backup.save) {
    const useWorking = working.save.savedAt >= backup.save.savedAt;
    return {
      slot,
      save: useWorking ? working.save : backup.save,
      source: useWorking ? 'working' : 'backup',
      recovered: useWorking ? Boolean(primary.raw && !primary.save) : true,
      corrupted,
    };
  }
  if (working.save) {
    return {
      slot,
      save: working.save,
      source: 'working',
      recovered: Boolean(primary.raw && !primary.save),
      corrupted,
    };
  }
  if (backup.save) {
    return {
      slot,
      save: backup.save,
      source: 'backup',
      recovered: true,
      corrupted,
    };
  }
  if (includeLegacy) {
    const save = legacySave(storage);
    if (save) return { slot, save, source: 'legacy', recovered: false, corrupted };
  }
  return { slot, save: null, source: 'empty', recovered: false, corrupted };
}

export function loadSaveSlot(slot: SaveSlotId, storage?: SaveStorage): SaveSlotLoadResult {
  const target = storageOrWindow(storage);
  return readSlotInternal(slot, target, workingBelongsTo(slot, target), slot === 'slot-1');
}

export function readSaveSlotSummaries(storage?: SaveStorage): SaveSlotSummary[] {
  const target = storageOrWindow(storage);
  return SAVE_SLOT_IDS.map((slot) => {
    const result = loadSaveSlot(slot, target);
    return {
      slot,
      save: result.save,
      source: result.source,
      status: !result.save
        ? result.corrupted ? 'corrupt' : 'empty'
        : result.recovered ? 'recovered' : 'ready',
      savedAt: result.save?.savedAt ?? null,
      playSeconds: result.save?.player.playSeconds ?? 0,
      raftTiles: result.save?.raft.tiles.length ?? 0,
      failure: Boolean(result.save?.player.failure),
    };
  });
}

/** Materializes the old single-save key once, without overwriting a real slot. */
export function prepareSaveSlots(storage?: SaveStorage): void {
  const target = storageOrWindow(storage);
  const active = safeGet(target, ACTIVE_SAVE_SLOT_KEY);
  const primary = safeGet(target, saveSlotKey('slot-1'));
  const backup = safeGet(target, saveSlotBackupKey('slot-1'));
  const initialized = SAVE_SLOT_IDS.some((slot) => (
    safeGet(target, saveSlotKey(slot)) !== null || safeGet(target, saveSlotBackupKey(slot)) !== null
  ));
  if (!initialized && !primary && !backup && !isSaveSlotId(active)) {
    const legacy = loadSave(target);
    if (legacy) safeSet(target, saveSlotKey('slot-1'), JSON.stringify(legacy));
  }
  if (!isSaveSlotId(active)) safeSet(target, ACTIVE_SAVE_SLOT_KEY, 'slot-1');
}

export function activateSaveSlot(slot: SaveSlotId, storage?: SaveStorage): SaveSlotLoadResult {
  const target = storageOrWindow(storage);
  prepareSaveSlots(target);
  const result = readSlotInternal(slot, target, false, slot === 'slot-1');
  if (result.save) {
    if (!safeSet(target, SAVE_KEY, JSON.stringify(result.save)) || !safeSet(target, ACTIVE_WORKING_SAVE_SLOT_KEY, slot)) {
      return { ...result, corrupted: true };
    }
  } else if (!safeRemove(target, SAVE_KEY) || !safeRemove(target, ACTIVE_WORKING_SAVE_SLOT_KEY)) {
    return { ...result, corrupted: true };
  }
  if (!safeSet(target, ACTIVE_SAVE_SLOT_KEY, slot)) return { ...result, corrupted: true };
  return result;
}

export function writeSaveSlot(save: DriftwakeSave, slot: SaveSlotId, storage?: SaveStorage): boolean {
  const target = storageOrWindow(storage);
  const primary = parseRaw(safeGet(target, saveSlotKey(slot)));
  const working = workingBelongsTo(slot, target) ? parseRaw(safeGet(target, SAVE_KEY)) : parseRaw(null);
  const workingPreferred = Boolean(
    primary.save
    && working.save
    && working.save.savedAt >= primary.save.savedAt
    && working.normalized !== primary.normalized,
  );
  const previous = workingPreferred ? working.save : primary.save ?? working.save;
  const normalizedSave = sanitizeSave(save);
  if (!normalizedSave) return false;
  const latestSavedAt = Math.max(primary.save?.savedAt ?? 0, working.save?.savedAt ?? 0);
  if (normalizedSave.savedAt <= latestSavedAt) normalizedSave.savedAt = latestSavedAt + 1;
  const nextRaw = JSON.stringify(normalizedSave);
  if (previous && JSON.stringify(previous) !== nextRaw) {
    const backupKey = saveSlotBackupKey(slot);
    if (!safeSet(target, backupKey, JSON.stringify(previous))) return false;
    const verifiedBackup = parseRaw(safeGet(target, backupKey));
    if (!verifiedBackup.save) return false;
  }
  if (!safeSet(target, saveSlotKey(slot), nextRaw)) return false;
  const verified = parseRaw(safeGet(target, saveSlotKey(slot)));
  if (!verified.save || verified.normalized !== nextRaw) return false;
  if (getActiveSaveSlot(target) === slot) {
    safeSet(target, SAVE_KEY, nextRaw);
    safeSet(target, ACTIVE_WORKING_SAVE_SLOT_KEY, slot);
  }
  return true;
}

export function deleteSaveSlot(slot: SaveSlotId, storage?: SaveStorage): boolean {
  const target = storageOrWindow(storage);
  const keys = [saveSlotKey(slot), saveSlotBackupKey(slot)];
  const active = getActiveSaveSlot(target);
  if (slot === 'slot-1') keys.push(...LEGACY_SAVE_KEYS);
  if (active === slot) keys.push(SAVE_KEY, ACTIVE_WORKING_SAVE_SLOT_KEY);
  let ok = true;
  for (const key of keys) ok = safeRemove(target, key) && ok;
  return ok;
}
