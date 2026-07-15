import { describe, expect, it } from 'vitest';
import {
  createDefaultUnderwaterState,
  applyReefHit,
  generateReefNodes,
  isReefNavigable,
  sampleReefFloorHeight,
  sanitizeUnderwaterState,
} from './underwater';

describe('underwater reef domain', () => {
  it('generates deterministic and complete resource nodes', () => {
    const first = generateReefNodes(2026);
    expect(first).toEqual(generateReefNodes(2026));
    expect(first).toHaveLength(18);
    expect(new Set(first.map((node) => node.type))).toEqual(new Set(['sand', 'clay', 'metalOre', 'seaweed']));
    expect(first.filter((node) => node.requiresHook)).toHaveLength(12);
  });

  it('provides a shallow shelf, deep outer slope, and a finite reef boundary', () => {
    const shelf = sampleReefFloorHeight(3, 4, 0);
    const outer = sampleReefFloorHeight(3, 12, 0);
    expect(shelf).not.toBeNull();
    expect(outer).not.toBeNull();
    expect(outer!).toBeLessThan(shelf!);
    expect(sampleReefFloorHeight(3, 30, 30)).toBeNull();
    expect(isReefNavigable(3, 9, 0)).toBe(true);
  });

  it('keeps harvested node health only for the matching island cycle', () => {
    const state = createDefaultUnderwaterState(7, 2);
    state.nodes[0].health = 0;
    const restored = sanitizeUnderwaterState(state, 7, 2);
    expect(restored.nodes[0].health).toBe(0);
    const renewed = sanitizeUnderwaterState(restored, 8, 3);
    expect(renewed.islandSeed).toBe(8);
    expect(renewed.nodes.every((node) => node.health > 0)).toBe(true);
  });

  it('advances multi-hit mining deterministically without skipping the harvest edge', () => {
    const first = applyReefHit(3, 3);
    const second = applyReefHit(first.health, 3);
    const third = applyReefHit(second.health, 3);
    expect(first).toEqual({ health: 2, harvested: false, landedHits: 1 });
    expect(second).toEqual({ health: 1, harvested: false, landedHits: 2 });
    expect(third).toEqual({ health: 0, harvested: true, landedHits: 3 });
    expect(applyReefHit(0, 3)).toEqual({ health: 0, harvested: false, landedHits: 3 });
  });
});
