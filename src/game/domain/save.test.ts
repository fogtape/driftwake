import { describe, expect, it } from 'vitest';
import { SAVE_VERSION, createDefaultRaftTiles, sanitizeSave } from './save';

describe('save schema', () => {
  it('sanitizes inventory, selected tools, stats and duplicate raft tiles', () => {
    const save = sanitizeSave({
      version: SAVE_VERSION,
      savedAt: 12,
      player: {
        inventory: { hook: 1, timber: -4, hammer: 1.8, madeUp: 99 },
        survival: { health: 140, thirst: 34, hunger: -5 },
        selectedTool: 'hammer',
        playSeconds: 42.8,
      },
      raft: { tiles: [{ x: 0, z: 0, health: 75 }, { x: 0, z: 0, health: 20 }] },
    });
    expect(save?.player.inventory).toEqual({ hook: 1, hammer: 1 });
    expect(save?.player.survival).toEqual({ health: 100, thirst: 34, hunger: 0 });
    expect(save?.player.playSeconds).toBe(42);
    expect(save?.raft.tiles).toEqual([{ x: 0, z: 0, health: 75 }]);
  });

  it('rejects unsupported versions and provides a stable starting raft', () => {
    expect(sanitizeSave({ version: 9 })).toBeNull();
    expect(createDefaultRaftTiles()).toHaveLength(9);
  });

  it('restores the non-discardable starter hook in a damaged save', () => {
    const save = sanitizeSave({
      version: SAVE_VERSION,
      player: { inventory: { timber: 2 }, survival: {}, selectedTool: 'hook', playSeconds: 0 },
      raft: { tiles: [{ x: 0, z: 0, health: 100 }] },
    });
    expect(save?.player.inventory.hook).toBe(1);
    expect(save?.player.selectedTool).toBe('hook');
  });
});
