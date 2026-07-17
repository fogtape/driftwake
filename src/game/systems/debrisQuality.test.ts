import { describe, expect, it } from 'vitest';
import { selectActiveDebris } from './debrisQuality';

describe('selectActiveDebris', () => {
  it('keeps latched debris alive while filling the remaining budget deterministically', () => {
    const active = selectActiveDebris([false, false, false, true, false], 2);
    expect(active).toEqual([true, false, false, true, false]);
  });

  it('allows active count to exceed budget only while interactions own those items', () => {
    const active = selectActiveDebris([true, true, true, false], 2);
    expect(active).toEqual([true, true, true, false]);
  });
});
