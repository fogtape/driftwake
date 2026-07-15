import { describe, expect, it } from 'vitest';
import { addItems, itemCount, salvageLoot, usedInventorySlots, type Inventory } from './items';
import { craftRecipe } from './recipes';

describe('inventory domain', () => {
  it('fills an existing stack before consuming a new slot', () => {
    const initial: Inventory = { timber: 19 };
    const result = addItems(initial, { timber: 4 }, 2);
    expect(itemCount(result.inventory, 'timber')).toBe(23);
    expect(usedInventorySlots(result.inventory)).toBe(2);
    expect(result.rejected).toEqual({});
  });

  it('returns overflow when slot capacity is exhausted', () => {
    const result = addItems({ timber: 20 }, { polymer: 3 }, 1);
    expect(result.inventory).toEqual({ timber: 20 });
    expect(result.rejected).toEqual({ polymer: 3 });
  });

  it('crafts tools by paying the exact recipe cost', () => {
    const result = craftRecipe({ timber: 4, rope: 2, fiber: 1 }, 'hammer');
    expect(result.ok).toBe(true);
    expect(result.inventory).toEqual({ timber: 2, rope: 1, fiber: 1, hammer: 1 });
  });

  it('expands a cache into useful loot instead of a cache counter', () => {
    expect(salvageLoot('cache', 0.2)).toEqual({ timber: 2, polymer: 1, fiber: 2, scrap: 1, emergencyWater: 1 });
  });
});
