import { describe, expect, it } from 'vitest';
import {
  ISLAND_APPROACH_SECONDS,
  ISLAND_DEPART_SECONDS,
  ISLAND_DOCK_SECONDS,
  ISLAND_DOCK_CLEARANCE,
  ISLAND_TERRAIN_HALF_DEPTH,
  advanceIslandState,
  createDefaultIslandState,
  generateHarvestNodes,
  isIslandWalkable,
  islandDockZForRaft,
  islandTransform,
  raftFrontEdgeZForTiles,
  sampleIslandHeight,
  sanitizeIslandState,
} from './island';

describe('island encounter', () => {
  it('generates a deterministic, complete resource layout', () => {
    const first = generateHarvestNodes(12345);
    const second = generateHarvestNodes(12345);
    expect(first).toEqual(second);
    expect(first).toHaveLength(18);
    expect(new Set(first.map((node) => node.id)).size).toBe(first.length);
    expect(new Set(first.map((node) => node.type))).toEqual(new Set(['palm', 'branch', 'stone', 'fruit', 'fiber']));
    expect(first.filter((node) => node.requiresAxe)).toHaveLength(4);
  });

  it('provides a walkable landing shelf and bounded terrain', () => {
    expect(sampleIslandHeight(1, 0, 0)).toBeGreaterThan(1.5);
    expect(isIslandWalkable(1, 0, 4.8)).toBe(true);
    expect(sampleIslandHeight(1, 12, 12)).toBeNull();
  });

  it('keeps the complete island mesh beyond dynamic raft foundations', () => {
    const compactRaft = Array.from({ length: 9 }, (_, index) => ({ z: Math.floor(index / 3) - 1 }));
    const deepRaft = Array.from({ length: 35 }, (_, index) => ({ z: Math.floor(index / 7) - 2 }));
    const compactDockZ = islandDockZForRaft(compactRaft);
    const deepDockZ = islandDockZForRaft(deepRaft);

    expect(deepDockZ).toBeLessThan(compactDockZ);
    expect(raftFrontEdgeZForTiles(deepRaft) - (deepDockZ + ISLAND_TERRAIN_HALF_DEPTH))
      .toBeCloseTo(ISLAND_DOCK_CLEARANCE);
    expect(islandTransform({ ...createDefaultIslandState(1), phase: 'docked' }, deepDockZ).z)
      .toBe(deepDockZ);
  });

  it('assigns axe-gated palm yields and loose shoreline supplies', () => {
    const nodes = generateHarvestNodes(77);
    const palm = nodes.find((node) => node.type === 'palm');
    const stone = nodes.find((node) => node.type === 'stone');
    expect(palm).toMatchObject({ maxHealth: 3, requiresAxe: true, output: { timber: 4, fiber: 2, palmFruit: 1 } });
    expect(stone).toMatchObject({ maxHealth: 1, requiresAxe: false, output: { stone: 2 } });
  });

  it('uses sail drive to approach, an anchor to hold, then departs and renews', () => {
    let state = createDefaultIslandState(99);
    const start = islandTransform(state);
    expect(start.z).toBeLessThan(-80);
    let result = advanceIslandState(state, ISLAND_APPROACH_SECONDS, {
      approachRate: 1,
      dockDriftRate: 1,
      anchored: false,
    });
    expect(result.event).toBe('arrived');
    state = result.state;
    expect(islandTransform(state)).toMatchObject({ x: 0, z: -7 });
    state = advanceIslandState(state, ISLAND_DOCK_SECONDS, {
      approachRate: 1,
      dockDriftRate: 1,
      anchored: true,
    }).state;
    expect(state.phase).toBe('docked');
    expect(state.elapsed).toBe(0);
    result = advanceIslandState(state, ISLAND_DOCK_SECONDS, {
      approachRate: 1,
      dockDriftRate: 1,
      anchored: false,
    });
    expect(result.event).toBe('departing');
    result = advanceIslandState(result.state, ISLAND_DEPART_SECONDS);
    expect(result.event).toBe('renewed');
    expect(result.state.phase).toBe('approaching');
    expect(result.state.seed).not.toBe(99);
    expect(result.state.cycle).toBe(1);
  });

  it('accelerates an unanchored departure while the sail remains deployed', () => {
    const docked = { ...createDefaultIslandState(7), phase: 'docked' as const, elapsed: 0 };
    const result = advanceIslandState(docked, ISLAND_DOCK_SECONDS / 1.65, {
      approachRate: 1,
      dockDriftRate: 1.65,
      anchored: false,
    });
    expect(result.event).toBe('departing');
  });

  it('sanitizes node health against the generated layout', () => {
    const state = sanitizeIslandState({
      seed: 7,
      cycle: -4,
      phase: 'docked',
      elapsed: 999,
      nodes: [{ id: 'palm-0', health: -2 }, { id: 'made-up', health: 99 }],
    });
    expect(state.cycle).toBe(0);
    expect(state.dockVersion).toBe(0);
    expect(state.elapsed).toBe(ISLAND_DOCK_SECONDS);
    expect(state.nodes).toHaveLength(18);
    expect(state.nodes.find((node) => node.id === 'palm-0')?.health).toBe(0);
  });
});
