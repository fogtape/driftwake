import { describe, expect, it } from 'vitest';
import { addItems, itemCount, preferredToolOrder, salvageLoot, usedInventorySlots, type Inventory } from './items';
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

  it('crafts the island axe without consuming unrelated supplies', () => {
    const result = craftRecipe({ timber: 3, stone: 2, rope: 1, scrap: 1, fiber: 4 }, 'axe');
    expect(result.ok).toBe(true);
    expect(result.inventory).toEqual({ timber: 1, fiber: 4, axe: 1 });
  });

  it('keeps researched recipes locked until their project is learned', () => {
    const inventory = { timber: 4, dryBrick: 6, scrap: 3 } as const;
    const locked = craftRecipe(inventory, 'smelterKit');
    expect(locked).toMatchObject({ ok: false, reason: 'locked', inventory });
    const learned = craftRecipe(inventory, 'smelterKit', ['smelterKit']);
    expect(learned).toMatchObject({ ok: true, reason: 'crafted', inventory: { smelterKit: 1 } });
  });

  it('upgrades a basic spear instead of leaving duplicate tool tiers', () => {
    const result = craftRecipe({ spear: 1, metalIngot: 2, rope: 1, timber: 3 }, 'metalSpear', ['metalSpear']);
    expect(result.ok).toBe(true);
    expect(result.inventory).toEqual({ timber: 3, metalSpear: 1 });
  });

  it('keeps upgraded tools in the same stable hotbar slots', () => {
    expect(preferredToolOrder({ metalSpear: 1, metalAxe: 1 })).toEqual([
      'hook',
      'hammer',
      'metalSpear',
      'fishingRod',
      'metalAxe',
    ]);
  });

  it('expands a cache into useful loot instead of a cache counter', () => {
    expect(salvageLoot('cache', 0.2)).toEqual({ timber: 2, polymer: 1, fiber: 2, scrap: 1, emergencyWater: 1 });
  });
});
