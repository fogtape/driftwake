import { describe, expect, it } from 'vitest';
import {
  ISLAND_APPROACH_SECONDS,
  ISLAND_DEPART_SECONDS,
  ISLAND_DOCK_SECONDS,
  advanceIslandState,
  createDefaultIslandState,
  generateHarvestNodes,
  isIslandWalkable,
  islandTransform,
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

  it('assigns axe-gated palm yields and loose shoreline supplies', () => {
    const nodes = generateHarvestNodes(77);
    const palm = nodes.find((node) => node.type === 'palm');
    const stone = nodes.find((node) => node.type === 'stone');
    expect(palm).toMatchObject({ maxHealth: 3, requiresAxe: true, output: { timber: 4, fiber: 2, palmFruit: 1 } });
    expect(stone).toMatchObject({ maxHealth: 1, requiresAxe: false, output: { stone: 2 } });
  });

  it('approaches, waits for an ashore player, departs, and renews', () => {
    let state = createDefaultIslandState(99);
    const start = islandTransform(state);
    expect(start.z).toBeLessThan(-80);
    let result = advanceIslandState(state, ISLAND_APPROACH_SECONDS, false);
    expect(result.event).toBe('arrived');
    state = result.state;
    expect(islandTransform(state)).toMatchObject({ x: 0, z: -7 });
    state = advanceIslandState(state, ISLAND_DOCK_SECONDS, true).state;
    expect(state.phase).toBe('docked');
    result = advanceIslandState(state, 1, false);
    expect(result.event).toBe('departing');
    result = advanceIslandState(result.state, ISLAND_DEPART_SECONDS, false);
    expect(result.event).toBe('renewed');
    expect(result.state.phase).toBe('approaching');
    expect(result.state.seed).not.toBe(99);
    expect(result.state.cycle).toBe(1);
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
    expect(state.elapsed).toBe(ISLAND_DOCK_SECONDS);
    expect(state.nodes).toHaveLength(18);
    expect(state.nodes.find((node) => node.id === 'palm-0')?.health).toBe(0);
  });
});
