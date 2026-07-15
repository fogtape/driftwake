import { describe, expect, it } from 'vitest';
import { SAVE_KEY, SAVE_VERSION, createDefaultRaftTiles, loadSave, sanitizeSave } from './save';

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
      raft: {
        tiles: [{ x: 0, z: 0, health: 75 }, { x: 0, z: 0, health: 20 }],
        devices: [
          { id: 'p', type: 'purifier', x: 0, z: 0, rotation: 1.4, phase: 'working', elapsed: 9 },
          { id: 'g', type: 'grill', x: 0, z: 0, rotation: 0, phase: 'ready', elapsed: 16 },
        ],
      },
    });
    expect(save?.player.inventory).toEqual({ hook: 1, hammer: 1 });
    expect(save?.player.survival).toEqual({ health: 100, thirst: 34, hunger: 0, oxygen: 100 });
    expect(save?.player.playSeconds).toBe(42);
    expect(save?.raft.tiles).toEqual([{ x: 0, z: 0, health: 75 }]);
    expect(save?.raft.devices).toEqual([
      { id: 'p', type: 'purifier', x: 0, z: 0, rotation: Math.PI / 2, phase: 'working', elapsed: 9 },
    ]);
  });

  it('rejects unsupported versions and provides a stable starting raft', () => {
    expect(sanitizeSave({ version: 9 })).toBeNull();
    expect(createDefaultRaftTiles()).toHaveLength(9);
  });

  it('restores the non-discardable starter hook in a damaged save', () => {
    const save = sanitizeSave({
      version: SAVE_VERSION,
      player: { inventory: { timber: 2 }, survival: {}, selectedTool: 'hook', playSeconds: 0 },
      raft: { tiles: [{ x: 0, z: 0, health: 100 }], devices: [] },
    });
    expect(save?.player.inventory.hook).toBe(1);
    expect(save?.player.selectedTool).toBe('hook');
  });

  it('migrates a v1 save and discovers it through the legacy storage key', () => {
    const legacy = JSON.stringify({
      version: 1,
      savedAt: 2,
      player: { inventory: { hook: 1, timber: 3 }, survival: {}, selectedTool: 'hook', playSeconds: 8 },
      raft: { tiles: [{ x: 0, z: 0, health: 100 }] },
    });
    const storage = {
      getItem: (key: string) => (key === 'driftwake.save.v1' ? legacy : null),
    };
    const save = loadSave(storage);
    expect(SAVE_KEY).toBe('driftwake.save.v4');
    expect(save?.version).toBe(4);
    expect(save?.raft.devices).toEqual([]);
    expect(save?.player.inventory.timber).toBe(3);
    expect(save?.world.island.phase).toBe('approaching');
    expect(save?.world.underwater.nodes).toHaveLength(18);
  });

  it('falls back to a legacy save when the current slot is corrupt', () => {
    const legacy = JSON.stringify({
      version: 1,
      player: { inventory: { hook: 1 }, survival: {}, selectedTool: 'hook', playSeconds: 0 },
      raft: { tiles: [{ x: 0, z: 0, health: 100 }] },
    });
    const save = loadSave({
      getItem: (key: string) => (key === SAVE_KEY ? '{broken' : key === 'driftwake.save.v1' ? legacy : null),
    });
    expect(save?.version).toBe(SAVE_VERSION);
    expect(save?.raft.tiles).toHaveLength(1);
  });

  it('keeps the runtime device cap stable during save sanitization', () => {
    const tiles = Array.from({ length: 17 }, (_, index) => ({ x: index % 5, z: Math.floor(index / 5), health: 100 }));
    const save = sanitizeSave({
      version: SAVE_VERSION,
      player: { inventory: { hook: 1 }, survival: {}, selectedTool: 'hook', playSeconds: 0 },
      raft: {
        tiles,
        devices: tiles.map((tile, index) => ({
          id: `device-${index}`,
          type: index % 2 === 0 ? 'purifier' : 'grill',
          x: tile.x,
          z: tile.z,
          rotation: 0,
          phase: 'idle',
          elapsed: 0,
        })),
      },
    });
    expect(save?.raft.devices).toHaveLength(16);
  });

  it('migrates v2 devices and validates docked island navigation', () => {
    const save = sanitizeSave({
      version: 2,
      player: { inventory: { hook: 1 }, survival: {}, selectedTool: 'hook', playSeconds: 4 },
      raft: {
        tiles: [{ x: 0, z: 0, health: 100 }],
        devices: [{ id: 'legacy-grill', type: 'grill', x: 0, z: 0, rotation: 0, phase: 'ready', elapsed: 18 }],
      },
    });
    expect(save?.version).toBe(SAVE_VERSION);
    expect(save?.raft.devices[0]?.id).toBe('legacy-grill');
    expect(save?.player.navigation).toEqual({ surface: 'raft', x: 0, z: 1.08 });
  });

  it('restores a valid island position only while the island is docked', () => {
    const save = sanitizeSave({
      version: SAVE_VERSION,
      player: {
        inventory: { hook: 1 },
        survival: {},
        selectedTool: 'hook',
        playSeconds: 4,
        navigation: { surface: 'island', x: 0, z: -7 },
      },
      raft: { tiles: [{ x: 0, z: 0, health: 100 }], devices: [] },
      world: { island: { seed: 9, cycle: 0, phase: 'docked', elapsed: 5, nodes: [] } },
    });
    expect(save?.player.navigation).toEqual({ surface: 'island', x: 0, z: -7 });
  });

  it('restores a bounded underwater position on the matching docked reef', () => {
    const save = sanitizeSave({
      version: SAVE_VERSION,
      player: {
        inventory: { hook: 1 },
        survival: { oxygen: 73 },
        selectedTool: 'hook',
        playSeconds: 8,
        navigation: { surface: 'water', x: 9, y: -99, z: -7 },
      },
      raft: { tiles: [{ x: 0, z: 0, health: 100 }], devices: [] },
      world: { island: { seed: 9, cycle: 0, phase: 'docked', elapsed: 5, nodes: [] } },
    });
    expect(save?.player.navigation.surface).toBe('water');
    expect(save?.player.navigation.y).toBeGreaterThan(-6);
    expect(save?.player.survival.oxygen).toBe(73);
  });
});
