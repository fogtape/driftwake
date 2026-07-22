import { describe, expect, it } from 'vitest';
import { SAVE_KEY, sanitizeSave, type DriftwakeSave } from './save';
import {
  ACTIVE_SAVE_SLOT_KEY,
  ACTIVE_WORKING_SAVE_SLOT_KEY,
  activateSaveSlot,
  deleteSaveSlot,
  getActiveSaveSlot,
  loadSaveSlot,
  prepareSaveSlots,
  readSaveSlotSummaries,
  saveSlotBackupKey,
  saveSlotKey,
  writeSaveSlot,
  type SaveStorage,
} from './saveRepository';

class MemoryStorage implements SaveStorage {
  readonly values = new Map<string, string>();
  readonly failingWrites = new Set<string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failingWrites.has(key)) throw new Error(`write blocked: ${key}`);
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function saved(savedAt: number, playSeconds: number, timber: number): DriftwakeSave {
  const save = sanitizeSave({
    version: 18,
    savedAt,
    player: {
      inventory: { hook: 1, timber },
      survival: {},
      selectedTool: 'hook',
      playSeconds,
    },
    raft: { tiles: [{ x: 0, z: 0, health: 100 }] },
  });
  if (!save) throw new Error('test save did not sanitize');
  return save;
}

describe('save slot repository', () => {
  it('materializes the old single save into slot one exactly once', () => {
    const storage = new MemoryStorage();
    storage.setItem('driftwake.save.v1', JSON.stringify({
      version: 1,
      savedAt: 12,
      player: { inventory: { hook: 1, timber: 3 }, survival: {}, selectedTool: 'hook', playSeconds: 8 },
      raft: { tiles: [{ x: 0, z: 0, health: 100 }] },
    }));

    prepareSaveSlots(storage);

    expect(getActiveSaveSlot(storage)).toBe('slot-1');
    expect(storage.getItem(saveSlotKey('slot-1'))).not.toBeNull();
    expect(loadSaveSlot('slot-1', storage)).toMatchObject({ source: 'primary', recovered: false });
    expect(loadSaveSlot('slot-1', storage).save?.player.inventory.timber).toBe(3);
  });

  it('keeps three slots isolated while mirroring only the active working save', () => {
    const storage = new MemoryStorage();
    prepareSaveSlots(storage);
    expect(writeSaveSlot(saved(10, 40, 2), 'slot-1', storage)).toBe(true);
    expect(activateSaveSlot('slot-2', storage).save).toBeNull();
    expect(storage.getItem(SAVE_KEY)).toBeNull();
    expect(writeSaveSlot(saved(20, 90, 7), 'slot-2', storage)).toBe(true);

    expect(loadSaveSlot('slot-1', storage).save?.player.inventory.timber).toBe(2);
    expect(loadSaveSlot('slot-2', storage).save?.player.inventory.timber).toBe(7);
    expect(readSaveSlotSummaries(storage).map(({ status, playSeconds }) => ({ status, playSeconds }))).toEqual([
      { status: 'ready', playSeconds: 40 },
      { status: 'ready', playSeconds: 90 },
      { status: 'empty', playSeconds: 0 },
    ]);
    expect(storage.getItem(ACTIVE_WORKING_SAVE_SLOT_KEY)).toBe('slot-2');
  });

  it('rotates the last valid primary and recovers when both primary and working copies are corrupt', () => {
    const storage = new MemoryStorage();
    prepareSaveSlots(storage);
    expect(writeSaveSlot(saved(10, 40, 2), 'slot-1', storage)).toBe(true);
    expect(writeSaveSlot(saved(20, 80, 5), 'slot-1', storage)).toBe(true);
    expect(JSON.parse(storage.getItem(saveSlotBackupKey('slot-1')) ?? '{}').player.playSeconds).toBe(40);

    storage.setItem(saveSlotKey('slot-1'), '{broken-primary');
    storage.setItem(SAVE_KEY, '{broken-working');
    const recovered = loadSaveSlot('slot-1', storage);

    expect(recovered).toMatchObject({ source: 'backup', recovered: true, corrupted: true });
    expect(recovered.save?.player.playSeconds).toBe(40);
    expect(readSaveSlotSummaries(storage)[0].status).toBe('recovered');
  });

  it('accepts a newer compatible working copy used by browser diagnostics', () => {
    const storage = new MemoryStorage();
    prepareSaveSlots(storage);
    const primary = saved(20, 80, 5);
    expect(writeSaveSlot(primary, 'slot-1', storage)).toBe(true);
    storage.setItem(SAVE_KEY, JSON.stringify({ ...primary, player: { ...primary.player, playSeconds: 81 } }));

    const result = loadSaveSlot('slot-1', storage);
    expect(result).toMatchObject({ source: 'working', recovered: false, corrupted: false });
    expect(result.save?.player.playSeconds).toBe(81);
  });

  it('does not let an unmarked legacy working copy leak into a later active slot', () => {
    const storage = new MemoryStorage();
    storage.setItem(ACTIVE_SAVE_SLOT_KEY, 'slot-2');
    storage.setItem(SAVE_KEY, JSON.stringify(saved(20, 80, 5)));

    expect(loadSaveSlot('slot-2', storage)).toMatchObject({ source: 'empty', save: null });
    expect(readSaveSlotSummaries(storage)[1]).toMatchObject({ status: 'empty', playSeconds: 0 });
  });

  it('prefers a newer same-slot backup over an older working copy after primary corruption', () => {
    const storage = new MemoryStorage();
    prepareSaveSlots(storage);
    storage.setItem(saveSlotKey('slot-1'), '{broken-primary');
    storage.setItem(SAVE_KEY, JSON.stringify(saved(10, 40, 2)));
    storage.setItem(saveSlotBackupKey('slot-1'), JSON.stringify(saved(20, 80, 5)));

    const recovered = loadSaveSlot('slot-1', storage);

    expect(recovered).toMatchObject({ source: 'backup', recovered: true, corrupted: true });
    expect(recovered.save?.player.playSeconds).toBe(80);
  });

  it('uses the newest active working copy for backup and advances same-millisecond writes', () => {
    const storage = new MemoryStorage();
    prepareSaveSlots(storage);
    expect(writeSaveSlot(saved(20, 80, 5), 'slot-1', storage)).toBe(true);
    storage.setItem(SAVE_KEY, JSON.stringify(saved(21, 81, 6)));

    expect(writeSaveSlot(saved(21, 82, 7), 'slot-1', storage)).toBe(true);

    const primary = JSON.parse(storage.getItem(saveSlotKey('slot-1')) ?? '{}');
    const backup = JSON.parse(storage.getItem(saveSlotBackupKey('slot-1')) ?? '{}');
    expect(primary.savedAt).toBe(22);
    expect(primary.player.playSeconds).toBe(82);
    expect(backup).toMatchObject({ savedAt: 21, player: { playSeconds: 81 } });
  });

  it('leaves a recoverable copy when the next primary write fails', () => {
    const storage = new MemoryStorage();
    prepareSaveSlots(storage);
    expect(writeSaveSlot(saved(10, 40, 2), 'slot-1', storage)).toBe(true);
    expect(writeSaveSlot(saved(20, 80, 5), 'slot-1', storage)).toBe(true);
    storage.failingWrites.add(saveSlotKey('slot-1'));

    expect(writeSaveSlot(saved(30, 120, 9), 'slot-1', storage)).toBe(false);
    expect(loadSaveSlot('slot-1', storage).save?.player.playSeconds).toBe(80);
    expect(JSON.parse(storage.getItem(saveSlotBackupKey('slot-1')) ?? '{}').player.playSeconds).toBe(80);
  });

  it('does not clone an active slot two working copy into an empty slot one', () => {
    const storage = new MemoryStorage();
    const second = saved(20, 90, 7);
    storage.setItem(ACTIVE_SAVE_SLOT_KEY, 'slot-2');
    storage.setItem(saveSlotKey('slot-2'), JSON.stringify(second));
    storage.setItem(SAVE_KEY, JSON.stringify(second));

    prepareSaveSlots(storage);

    expect(storage.getItem(saveSlotKey('slot-1'))).toBeNull();
    expect(loadSaveSlot('slot-1', storage).save).toBeNull();
    expect(loadSaveSlot('slot-2', storage).save?.player.playSeconds).toBe(90);
  });

  it('deletes only the requested slot and its compatibility keys', () => {
    const storage = new MemoryStorage();
    prepareSaveSlots(storage);
    expect(writeSaveSlot(saved(10, 40, 2), 'slot-1', storage)).toBe(true);
    activateSaveSlot('slot-2', storage);
    expect(writeSaveSlot(saved(20, 90, 7), 'slot-2', storage)).toBe(true);

    expect(deleteSaveSlot('slot-1', storage)).toBe(true);

    expect(loadSaveSlot('slot-1', storage).save).toBeNull();
    expect(loadSaveSlot('slot-2', storage).save?.player.playSeconds).toBe(90);
    expect(JSON.parse(storage.getItem(SAVE_KEY) ?? '{}').player.playSeconds).toBe(90);
  });
});
