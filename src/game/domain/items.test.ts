import { describe, expect, it } from 'vitest';
import {
  addItems,
  exchangeInventoryBundles,
  inventoryStacks,
  itemCount,
  preferredToolOrder,
  salvageLoot,
  stackTransferAmount,
  transferInventoryItem,
  usedInventorySlots,
  type Inventory,
} from './items';
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

  it('exchanges bundles atomically and keeps the old inventory on refund overflow', () => {
    expect(exchangeInventoryBundles({ timber: 4, rope: 3 }, { timber: 1, rope: 2 }, { fiber: 2 })).toEqual({
      ok: true,
      inventory: { timber: 3, rope: 1, fiber: 2 },
      reason: 'exchanged',
    });
    const full = { timber: 20, rope: 10 };
    expect(exchangeInventoryBundles(full, { timber: 2, rope: 1 }, { fiber: 2 }, 2)).toEqual({
      ok: false,
      inventory: full,
      reason: 'target-full',
    });
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

  it('gives sealed barrels a smaller supply roll than full caches', () => {
    expect(salvageLoot('barrel', 0.5)).toEqual({ polymer: 2, fiber: 1, ration: 1 });
  });

  it('projects aggregate counts into stable visual stacks', () => {
    expect(inventoryStacks({ timber: 26, rope: 12 })).toEqual([
      { itemId: 'timber', count: 20, stackIndex: 0 },
      { itemId: 'timber', count: 6, stackIndex: 1 },
      { itemId: 'rope', count: 10, stackIndex: 0 },
      { itemId: 'rope', count: 2, stackIndex: 1 },
    ]);
  });

  it('resolves one, half and full stack transfer presets', () => {
    expect(stackTransferAmount(7, 'one')).toBe(1);
    expect(stackTransferAmount(7, 'half')).toBe(4);
    expect(stackTransferAmount(7, 'all')).toBe(7);
    expect(stackTransferAmount(Number.NaN, 'half')).toBe(0);
  });

  it('moves an exact partial stack without mutating either input', () => {
    const source: Inventory = { timber: 26, hook: 1 };
    const target: Inventory = { timber: 8 };
    const result = transferInventoryItem(source, target, 'timber', 6, 8);
    expect(result).toMatchObject({ requested: 6, attempted: 6, moved: 6, reason: 'moved' });
    expect(result.source).toEqual({ timber: 20, hook: 1 });
    expect(result.target).toEqual({ timber: 14 });
    expect(source).toEqual({ timber: 26, hook: 1 });
    expect(target).toEqual({ timber: 8 });
  });

  it('previews a capacity-limited transfer with the same result used for commit', () => {
    const result = transferInventoryItem({ timber: 8 }, { timber: 18 }, 'timber', 6, 1);
    expect(result).toMatchObject({ requested: 6, attempted: 6, moved: 2, reason: 'partial' });
    expect(result.source).toEqual({ timber: 6 });
    expect(result.target).toEqual({ timber: 20 });
  });

  it('leaves both containers unchanged when the target has no compatible space', () => {
    const result = transferInventoryItem({ polymer: 4 }, { timber: 20 }, 'polymer', 4, 1);
    expect(result).toMatchObject({ moved: 0, reason: 'target-full' });
    expect(result.source).toEqual({ polymer: 4 });
    expect(result.target).toEqual({ timber: 20 });
  });
});
