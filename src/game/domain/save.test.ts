import { describe, expect, it } from 'vitest';
import { SAVE_KEY, SAVE_VERSION, createDefaultRaftTiles, loadSave, sanitizeSave } from './save';
import { createDefaultNavigationState } from './navigation';
import { islandDockZForRaft, islandTransform, sanitizeIslandState } from './island';
import { TOOL_MAX_DURABILITY } from './toolDurability';

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
    expect(save?.player.toolDurability).toEqual({
      hook: TOOL_MAX_DURABILITY.hook,
      hammer: TOOL_MAX_DURABILITY.hammer,
    });
    expect(save?.player.survival).toEqual({ health: 100, thirst: 34, hunger: 0, oxygen: 100 });
    expect(save?.player.playSeconds).toBe(42);
    expect(save?.raft.tiles).toEqual([{ x: 0, z: 0, health: 75, reinforced: false }]);
    expect(save?.raft.structures).toEqual([]);
    expect(save?.raft.devices).toMatchObject([
      { id: 'p', type: 'purifier', x: 0, z: 0, rotation: Math.PI / 2, phase: 'working', elapsed: 9 },
    ]);
  });

  it('rejects unsupported versions and provides a stable starting raft', () => {
    expect(sanitizeSave({ version: SAVE_VERSION + 1 })).toBeNull();
    expect(createDefaultRaftTiles()).toHaveLength(9);
  });

  it('keeps a broken hook absent so the replacement recipe remains meaningful', () => {
    const save = sanitizeSave({
      version: SAVE_VERSION,
      player: { inventory: { timber: 2 }, survival: {}, selectedTool: 'hook', playSeconds: 0 },
      raft: { tiles: [{ x: 0, z: 0, health: 100 }], devices: [] },
    });
    expect(save?.player.inventory.hook).toBeUndefined();
    expect(save?.player.toolDurability.hook).toBeUndefined();
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
    expect(SAVE_KEY).toBe('driftwake.save.v18');
    expect(save?.version).toBe(SAVE_VERSION);
    expect(save?.raft.devices).toEqual([]);
    expect(save?.player.inventory.timber).toBe(3);
    expect(save?.world.island.phase).toBe('approaching');
    expect(save?.world.underwater.nodes).toHaveLength(18);
    expect(save?.raft.navigation.devices).toEqual([]);
    expect(save?.raft.planting.planters).toEqual([]);
    expect(save?.raft.progression.devices).toEqual([]);
    expect(save?.raft.collectionNets).toEqual([]);
  });

  it('migrates v15 saves to an empty collection-net set', () => {
    const save = sanitizeSave({
      version: 15,
      player: { inventory: { hook: 1 }, survival: {}, selectedTool: 'hook', playSeconds: 12 },
      raft: {
        tiles: [{ x: 0, z: 0, health: 100 }],
        collectionNets: [{ id: 'ignored', x: 0, z: 0, rotation: 0, health: 80, storage: { timber: 2 } }],
      },
    });
    expect(save?.version).toBe(SAVE_VERSION);
    expect(save?.raft.collectionNets).toEqual([]);
  });

  it('migrates v16 foundations without armor and preserves valid v17 reinforcement', () => {
    const legacy = sanitizeSave({
      version: 16,
      player: { inventory: { hook: 1 }, survival: {}, selectedTool: 'hook', playSeconds: 12 },
      raft: { tiles: [{ x: 0, z: 0, health: 100, reinforced: true }] },
    });
    const current = sanitizeSave({
      version: SAVE_VERSION,
      player: { inventory: { hook: 1 }, survival: {}, selectedTool: 'hook', playSeconds: 12 },
      raft: { tiles: [{ x: 0, z: 0, health: 100, reinforced: true }] },
    });
    expect(legacy?.raft.tiles[0]?.reinforced).toBe(false);
    expect(current?.raft.tiles[0]?.reinforced).toBe(true);
  });

  it('migrates v17 to a healthy shark and sanitizes the current carcass window', () => {
    const legacy = sanitizeSave({
      version: 17,
      player: { inventory: { hook: 1 }, survival: {}, selectedTool: 'hook', playSeconds: 12 },
      raft: { tiles: [{ x: 0, z: 0, health: 100 }] },
      world: { shark: { lifecycle: 'carcass', health: 0, harvestIndex: 2, remainingSeconds: 20 } },
    });
    const current = sanitizeSave({
      version: SAVE_VERSION,
      player: { inventory: { hook: 1 }, survival: {}, selectedTool: 'hook', playSeconds: 12 },
      raft: { tiles: [{ x: 0, z: 0, health: 100 }] },
      world: {
        shark: {
          lifecycle: 'carcass',
          health: 99,
          x: 4.5,
          z: -2.25,
          harvestIndex: 2,
          remainingSeconds: 20,
        },
      },
    });
    expect(legacy?.world.shark).toMatchObject({ lifecycle: 'active', health: 100, harvestIndex: 0 });
    expect(current?.world.shark).toEqual({
      lifecycle: 'carcass',
      health: 0,
      x: 4.5,
      z: -2.25,
      harvestIndex: 2,
      remainingSeconds: 20,
    });
  });

  it('sanitizes v16 collection nets against dynamic raft edges', () => {
    const save = sanitizeSave({
      version: SAVE_VERSION,
      player: { inventory: { hook: 1 }, survival: {}, selectedTool: 'hook', playSeconds: 12 },
      raft: {
        tiles: [{ x: 0, z: 0, health: 100 }, { x: 1, z: 0, health: 100 }],
        collectionNets: [
          { id: 'edge', x: 0, z: 0, rotation: 0, health: 54, storage: { timber: 2 } },
          { id: 'interior', x: 0, z: 0, rotation: 1, health: 80, storage: {} },
        ],
      },
    });
    expect(save?.raft.collectionNets).toEqual([
      { id: 'edge', x: 0, z: 0, rotation: 0, health: 54, storage: { timber: 2 } },
    ]);
  });

  it('keeps base walls authoritative over conflicting v16 collection-net edges', () => {
    const save = sanitizeSave({
      version: SAVE_VERSION,
      player: { inventory: { hook: 1 }, survival: {}, selectedTool: 'hook', playSeconds: 12 },
      raft: {
        tiles: [{ x: 0, z: 0, health: 100 }],
        structures: [
          { id: 'north-wall', type: 'wall', x: 0, z: 0, level: 0, rotation: 0, health: 110 },
        ],
        collectionNets: [
          { id: 'blocked', x: 0, z: 0, rotation: 0, health: 80, storage: { timber: 1 } },
          { id: 'east-edge', x: 0, z: 0, rotation: 1, health: 80, storage: { polymer: 1 } },
        ],
      },
    });
    expect(save?.raft.structures.map((structure) => structure.id)).toEqual(['north-wall']);
    expect(save?.raft.collectionNets.map((net) => net.id)).toEqual(['east-edge']);
  });

  it('migrates v13 saves to an empty structure set', () => {
    const save = sanitizeSave({
      version: 13,
      player: { inventory: { hook: 1 }, survival: {}, selectedTool: 'hook', playSeconds: 12 },
      raft: { tiles: [{ x: 0, z: 0, health: 100 }], structures: [{ id: 'ignored', type: 'pillar', x: 0, z: 0 }] },
    });
    expect(save?.version).toBe(SAVE_VERSION);
    expect(save?.raft.structures).toEqual([]);
  });

  it('sanitizes v15 support chains, player height and device occupancy', () => {
    const save = sanitizeSave({
      version: SAVE_VERSION,
      player: {
        inventory: { hook: 1 },
        survival: {},
        selectedTool: 'hook',
        playSeconds: 12,
        navigation: { surface: 'raft', x: 0, y: 2.35, z: 0 },
      },
      raft: {
        tiles: [
          { x: 0, z: 0, health: 100 },
          { x: 1, z: 0, health: 100 },
        ],
        structures: [
          { id: 'upper-wall', type: 'wall', x: 0, z: 0, level: 1, rotation: 0, health: 110 },
          { id: 'upper-floor', type: 'floor', x: 0, z: 0, level: 1, rotation: 0, health: 90 },
          { id: 'base-pillar', type: 'pillar', x: 0, z: 0, level: 0, rotation: 0, health: 125 },
        ],
        devices: [
          { id: 'blocked', type: 'grill', x: 0, z: 0, rotation: 0, phase: 'idle', elapsed: 0 },
          { id: 'kept', type: 'purifier', x: 1, z: 0, rotation: 0, phase: 'idle', elapsed: 0 },
        ],
      },
    });
    expect(save?.raft.structures.map((structure) => structure.id)).toEqual([
      'base-pillar',
      'upper-floor',
      'upper-wall',
    ]);
    expect(save?.raft.devices.map((device) => device.id)).toEqual(['kept']);
    expect(save?.player.navigation).toEqual({ surface: 'raft', x: 0, y: 2.18, z: 0 });
  });

  it('keeps v14 raft players on the base layer during the v15 migration', () => {
    const save = sanitizeSave({
      version: 14,
      player: {
        inventory: { hook: 1 },
        survival: {},
        selectedTool: 'hook',
        playSeconds: 12,
        navigation: { surface: 'raft', x: 0, y: 2.18, z: 0 },
      },
      raft: {
        tiles: [{ x: 0, z: 0, health: 100 }],
        structures: [
          { id: 'pillar', type: 'pillar', x: 0, z: 0, level: 0, rotation: 0, health: 125 },
          { id: 'floor', type: 'floor', x: 0, z: 0, level: 1, rotation: 0, health: 90 },
        ],
      },
    });
    expect(save?.player.navigation).toEqual({ surface: 'raft', x: 0, z: 0 });
    expect(save?.raft.structures).toHaveLength(2);
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

  it('restores a valid island position while the expedition island still exists', () => {
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
    expect(save?.player.navigation).toEqual({
      surface: 'island',
      x: 0,
      z: islandDockZForRaft([{ z: 0 }]),
    });
    expect(save?.world.island.dockVersion).toBe(1);

    const departingIsland = sanitizeIslandState({ seed: 9, cycle: 0, phase: 'departing', elapsed: 5, nodes: [] });
    const transform = islandTransform(departingIsland);
    const departing = sanitizeSave({
      version: SAVE_VERSION,
      player: {
        inventory: { hook: 1 },
        survival: {},
        selectedTool: 'hook',
        playSeconds: 5,
        navigation: { surface: 'island', x: transform.x, z: transform.z },
      },
      raft: { tiles: [{ x: 0, z: 0, health: 100 }], devices: [] },
      world: { island: departingIsland },
    });
    expect(departing?.player.navigation.surface).toBe('island');
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

  it('restores navigation equipment, rejects occupied tiles, and retracts deep-water anchors', () => {
    const save = sanitizeSave({
      version: SAVE_VERSION,
      player: { inventory: { hook: 1 }, survival: {}, selectedTool: 'hook', playSeconds: 8 },
      raft: {
        tiles: [
          { x: 0, z: 0, health: 100 },
          { x: 1, z: 0, health: 100 },
          { x: -1, z: 0, health: 100 },
        ],
        devices: [{ id: 'grill', type: 'grill', x: -1, z: 0, rotation: 0, phase: 'idle', elapsed: 0 }],
        navigation: {
          windClock: 22,
          courseAngle: 0.5,
          heading: 0.25,
          devices: [
            { id: 'sail', type: 'sail', x: 0, z: 0, rotation: 0, deployed: true },
            { id: 'anchor', type: 'anchor', x: 1, z: 0, rotation: 0, deployed: true },
          ],
        },
      },
      world: { island: { seed: 9, cycle: 0, phase: 'approaching', elapsed: 5, nodes: [] } },
    });
    expect(save?.raft.navigation.devices).toHaveLength(2);
    expect(save?.raft.navigation.devices.find((device) => device.type === 'anchor')?.deployed).toBe(false);
    expect(save?.raft.navigation.devices.find((device) => device.type === 'sail')?.deployed).toBe(true);
  });

  it('migrates v4 reef progress and grants a fresh unanchored docking window', () => {
    const save = sanitizeSave({
      version: 4,
      player: { inventory: { hook: 1 }, survival: {}, selectedTool: 'hook', playSeconds: 8 },
      raft: { tiles: [{ x: 0, z: 0, health: 100 }], devices: [] },
      world: {
        island: { seed: 9, cycle: 0, phase: 'docked', elapsed: 77, nodes: [] },
        underwater: { islandSeed: 9, islandCycle: 0, nodes: [{ id: 'sand-0', health: 0 }] },
      },
    });
    expect(save?.world.island.elapsed).toBe(18);
    expect(save?.raft.navigation).toEqual(createDefaultNavigationState());
    expect(save?.world.underwater.nodes.find((node) => node.id === 'sand-0')?.health).toBe(0);
  });

  it('migrates v5 navigation and sanitizes v6 planter occupancy', () => {
    const v5 = sanitizeSave({
      version: 5,
      player: { inventory: { hook: 1 }, survival: {}, selectedTool: 'hook', playSeconds: 9 },
      raft: {
        tiles: [{ x: 0, z: 0, health: 100 }],
        devices: [],
        navigation: {
          windClock: 8,
          courseAngle: 1.2,
          heading: 0.8,
          devices: [{ id: 'legacy-sail', type: 'sail', x: 0, z: 0, rotation: 0, deployed: true }],
        },
      },
    });
    expect(v5?.raft.navigation.devices[0]?.id).toBe('legacy-sail');
    expect(v5?.raft.planting.planters).toEqual([]);

    const v6 = sanitizeSave({
      version: 6,
      player: { inventory: { hook: 1 }, survival: {}, selectedTool: 'hook', playSeconds: 10 },
      raft: {
        tiles: [{ x: 0, z: 0, health: 100 }, { x: 1, z: 0, health: 100 }],
        devices: [{ id: 'grill', type: 'grill', x: 0, z: 0, rotation: 0, phase: 'idle', elapsed: 0 }],
        navigation: createDefaultNavigationState(),
        planting: {
          birdClock: 14,
          birdVisit: 3,
          planters: [
            { id: 'blocked', x: 0, z: 0, rotation: 0, phase: 'mature', growth: 1 },
            { id: 'crop', x: 1, z: 0, rotation: 0, phase: 'growing', growth: 0.4, water: 0.6 },
          ],
        },
      },
    });
    expect(v6?.raft.planting.planters).toHaveLength(1);
    expect(v6?.raft.planting.planters[0]).toMatchObject({ id: 'crop', growth: 0.4, water: 0.6 });
    expect(v6?.raft.planting.birdVisit).toBe(3);
    expect(v6?.raft.progression).toEqual({ devices: [], researched: [], learned: [] });
  });

  it('restores v7 research knowledge and rejects progression devices on occupied tiles', () => {
    const save = sanitizeSave({
      version: 7,
      player: { inventory: { hook: 1 }, survival: {}, selectedTool: 'hook', playSeconds: 12 },
      raft: {
        tiles: [{ x: 0, z: 0, health: 100 }, { x: 1, z: 0, health: 100 }],
        devices: [{ id: 'grill', type: 'grill', x: 0, z: 0, rotation: 0, phase: 'idle', elapsed: 0 }],
        progression: {
          researched: ['timber', 'scrap', 'dryBrick'],
          learned: ['smelterKit'],
          devices: [
            { id: 'blocked', type: 'researchBench', x: 0, z: 0, rotation: 0 },
            { id: 'forge', type: 'smelter', x: 1, z: 0, rotation: 0, phase: 'working', elapsed: 22 },
          ],
        },
      },
    });
    expect(save?.raft.progression.researched).toEqual(['timber', 'scrap', 'dryBrick']);
    expect(save?.raft.progression.learned).toEqual(['smelterKit']);
    expect(save?.raft.progression.devices).toHaveLength(1);
    expect(save?.raft.progression.devices[0]).toMatchObject({ id: 'forge', phase: 'working', elapsed: 22 });
    expect(save?.raft.navigation).toEqual(createDefaultNavigationState());
  });

  it('restores v8 helm, reinforced sail, route and storm state', () => {
    const save = sanitizeSave({
      version: 8,
      player: { inventory: { hook: 1 }, survival: {}, selectedTool: 'hook', playSeconds: 20 },
      raft: {
        tiles: [
          { x: 0, z: 0, health: 100 },
          { x: 1, z: 0, health: 100 },
          { x: -1, z: 0, health: 100 },
        ],
        navigation: {
          windClock: 140,
          weatherClock: 145,
          courseAngle: 0.4,
          heading: 0.2,
          routeMode: 'island',
          sailStrain: 0.38,
          devices: [
            { id: 'sail', type: 'sail', x: 0, z: 0, rotation: 0, deployed: true, reinforced: true },
            { id: 'helm', type: 'helm', x: 1, z: 0, rotation: 0, deployed: false },
            { id: 'anchor', type: 'anchor', x: -1, z: 0, rotation: 0, deployed: false },
          ],
        },
      },
    });
    expect(save?.raft.navigation).toMatchObject({
      weatherClock: 145,
      routeMode: 'island',
      sailStrain: 0.38,
    });
    expect(save?.raft.navigation.devices).toHaveLength(3);
    expect(save?.raft.navigation.devices.find((device) => device.type === 'sail')).toMatchObject({ reinforced: true });
  });

  it('restores v9 advanced device queues, bounded storage and reinforced anchor load', () => {
    const save = sanitizeSave({
      version: 9,
      player: { inventory: { hook: 1 }, survival: {}, selectedTool: 'hook', playSeconds: 24 },
      raft: {
        tiles: [
          { x: 0, z: 0, health: 100 },
          { x: 1, z: 0, health: 100 },
          { x: -1, z: 0, health: 100 },
        ],
        devices: [
          {
            id: 'solar',
            type: 'solarPurifier',
            x: 0,
            z: 0,
            waterQueue: [4, 999],
            freshWater: 1,
          },
          {
            id: 'locker',
            type: 'locker',
            x: 1,
            z: 0,
            storage: { timber: 40, polymer: 40, fiber: 40, scrap: 12, rope: 10, stone: 16, sand: 20, clay: 20, metalOre: 12 },
          },
        ],
        navigation: {
          ...createDefaultNavigationState(),
          anchorStrain: 0.76,
          devices: [{ id: 'anchor', type: 'anchor', x: -1, z: 0, rotation: 0, deployed: true, reinforced: true }],
        },
      },
      world: { island: { seed: 9, cycle: 0, phase: 'docked', elapsed: 5, nodes: [] } },
    });
    const solar = save?.raft.devices.find((device) => device.type === 'solarPurifier');
    const locker = save?.raft.devices.find((device) => device.type === 'locker');
    expect(solar).toMatchObject({ freshWater: 2, waterQueue: [4], phase: 'ready' });
    expect(locker?.storage).toEqual({ timber: 40, polymer: 40, fiber: 40, scrap: 12, rope: 10 });
    expect(save?.raft.navigation).toMatchObject({ anchorStrain: 0.76 });
    expect(save?.raft.navigation.devices[0]).toMatchObject({ type: 'anchor', reinforced: true, deployed: true });
  });

  it('restores v10 world coordinates, receiver power and a valid separated signal array', () => {
    const save = sanitizeSave({
      version: 10,
      player: { inventory: { hook: 1, brineCell: 2 }, survival: {}, selectedTool: 'hook', playSeconds: 28 },
      raft: {
        tiles: [
          { x: 0, z: 0, health: 100 },
          { x: 1, z: 0, health: 100 },
          { x: 2, z: 0, health: 100 },
        ],
        devices: [],
        navigation: {
          ...createDefaultNavigationState(),
          worldX: 123.5,
          worldZ: -88.25,
          receiverOn: true,
          receiverCharge: 999,
          routeMode: 'signal',
          activeSignal: 'ironChoir',
          signalOriginX: 100,
          signalOriginZ: -50,
          discoveredSignals: ['tideRelay', 'ironChoir', 'not-real'],
          visitedSignals: ['tideRelay', 'not-real'],
          devices: [
            { id: 'receiver', type: 'receiver', x: 0, z: 0, rotation: 0 },
            { id: 'helm', type: 'helm', x: 1, z: 0, rotation: 0 },
            { id: 'antenna', type: 'antenna', x: 2, z: 0, rotation: 0 },
          ],
        },
      },
    });
    expect(save?.version).toBe(SAVE_VERSION);
    expect(save?.raft.navigation).toMatchObject({
      worldX: 123.5,
      worldZ: -88.25,
      receiverOn: true,
      receiverCharge: 360,
      routeMode: 'signal',
      activeSignal: 'ironChoir',
      discoveredSignals: ['tideRelay', 'ironChoir'],
      visitedSignals: ['tideRelay'],
    });
    expect(save?.raft.navigation.devices).toHaveLength(3);
  });

  it('restores v11 hook durability and bounded world salvage drops', () => {
    const save = sanitizeSave({
      version: 11,
      player: {
        inventory: { hook: 1, hammer: 1 },
        toolDurability: { hook: 7, hammer: 999, spear: 12 },
        survival: {},
        selectedTool: 'hook',
        playSeconds: 31,
      },
      raft: { tiles: [{ x: 0, z: 0, health: 100 }], devices: [] },
      world: {
        drops: [
          { loot: { timber: 2, polymer: 1, madeUp: 50 }, x: 999, y: -99, z: -999 },
          { loot: {}, x: 0, y: 0, z: 0 },
        ],
      },
    });
    expect(save?.player.toolDurability).toEqual({ hook: 7, hammer: TOOL_MAX_DURABILITY.hammer });
    expect(save?.world.drops).toEqual([
      { loot: { timber: 2, polymer: 1 }, x: 36, y: -4, z: -120 },
    ]);
    expect(save?.player.failure).toBeNull();
  });

  it('restores a v12 failure once and sanitizes its recoverable loot', () => {
    const save = sanitizeSave({
      version: 12,
      player: {
        inventory: { hook: 1, ration: 1 },
        survival: { health: 0, thirst: 9, hunger: 20, oxygen: 100 },
        selectedTool: 'hook',
        playSeconds: 44,
        failure: {
          cause: 'shark',
          dropped: { timber: 2.9, polymer: 1, madeUp: 20 },
          occurredAt: 43.8,
          dropPending: true,
        },
      },
      raft: { tiles: [{ x: 0, z: 0, health: 100 }], devices: [] },
    });
    expect(save?.player.failure).toEqual({
      cause: 'shark',
      dropped: { timber: 2, polymer: 1 },
      occurredAt: 43,
      dropPending: true,
    });
    expect(save?.player.crafting).toEqual({ entries: [], nextSerial: 1 });
  });

  it('restores a bounded v13 crafting queue without refunding committed materials', () => {
    const save = sanitizeSave({
      version: 13,
      player: {
        inventory: { hook: 1, timber: 3 },
        survival: {},
        selectedTool: 'hook',
        playSeconds: 52,
        crafting: {
          entries: [
            { id: 'rope-job', recipeId: 'rope', elapsedSeconds: 0.45 },
            {
              id: 'spear-upgrade',
              recipeId: 'metalSpear',
              elapsedSeconds: 99,
              consumedToolDurability: 6,
              selectOnComplete: true,
            },
            { id: 'invalid', recipeId: 'madeUp', elapsedSeconds: 1 },
          ],
          nextSerial: 9,
        },
      },
      raft: { tiles: [{ x: 0, z: 0, health: 100 }], devices: [] },
    });
    expect(save?.player.inventory).toEqual({ hook: 1, timber: 3 });
    expect(save?.player.crafting).toEqual({
      entries: [
        {
          id: 'rope-job',
          recipeId: 'rope',
          elapsedSeconds: 0.45,
          consumedTool: null,
          consumedToolDurability: null,
          selectOnComplete: false,
        },
        {
          id: 'spear-upgrade',
          recipeId: 'metalSpear',
          elapsedSeconds: 2.8,
          consumedTool: 'spear',
          consumedToolDurability: 6,
          selectOnComplete: true,
        },
      ],
      nextSerial: 9,
    });
  });
});
