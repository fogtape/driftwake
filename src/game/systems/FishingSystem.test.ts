import { describe, expect, it, vi } from 'vitest';
import { resolveFishingRodWear } from './FishingSystem';

describe('FishingSystem catch transaction', () => {
  it('wears the rod exactly once when a fish enters the backpack', () => {
    const onFishRetrieved = vi.fn(() => ({ broken: true }));

    expect(resolveFishingRodWear({ rawFish: 1 }, onFishRetrieved)).toEqual({ broken: true });
    expect(onFishRetrieved).toHaveBeenCalledOnce();
  });

  it('does not wear the rod when a full backpack rejects the fish', () => {
    const onFishRetrieved = vi.fn(() => ({ broken: true }));

    expect(resolveFishingRodWear({}, onFishRetrieved)).toEqual({ broken: false });
    expect(onFishRetrieved).not.toHaveBeenCalled();
  });
});
