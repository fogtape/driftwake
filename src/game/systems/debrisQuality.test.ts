import { describe, expect, it } from 'vitest';
import { selectActiveDebris } from './debrisQuality';

describe('selectActiveDebris', () => {
  it('keeps the requested number of unlatched debris active', () => {
    const active = selectActiveDebris(Array.from({ length: 30 }, () => false), 18);
    expect(active.filter(Boolean)).toHaveLength(18);
    expect(active.slice(0, 18).every(Boolean)).toBe(true);
    expect(active.slice(18).some(Boolean)).toBe(false);
  });

  it('preserves latched debris while filling the remaining quality budget', () => {
    const latched = Array.from({ length: 30 }, () => false);
    latched[25] = true;
    const active = selectActiveDebris(latched, 18);
    expect(active.filter(Boolean)).toHaveLength(18);
    expect(active[25]).toBe(true);
    expect(active.slice(0, 17).every(Boolean)).toBe(true);
    expect(active[17]).toBe(false);
  });

  it('clamps an oversized high-quality budget to the available items', () => {
    expect(selectActiveDebris([false, false, false], 30)).toEqual([true, true, true]);
  });
});
