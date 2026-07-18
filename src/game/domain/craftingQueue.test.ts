import { describe, expect, it } from 'vitest';
import { ITEM_DEFINITIONS, itemCount, usedInventorySlots, type Inventory, type ItemId } from './items';
import {
  MAX_CRAFTING_QUEUE,
  RECIPE_CRAFT_SECONDS,
  advanceCraftingQueue,
  cancelCraftingEntry,
  createDefaultCraftingQueue,
  maxQueueableCrafts,
  queueCraftItems,
  sanitizeCraftingQueue,
} from './craftingQueue';
import { RECIPES, type RecipeId } from './recipes';

describe('crafting queue domain', () => {
  it('defines a positive designer duration for every recipe', () => {
    expect(Object.keys(RECIPE_CRAFT_SECONDS).sort()).toEqual(Object.keys(RECIPES).sort());
    expect(Object.values(RECIPE_CRAFT_SECONDS).every((seconds) => seconds > 0)).toBe(true);
  });

  it('commits materials one item at a time and creates stable queue ids', () => {
    const result = queueCraftItems({ fiber: 6 }, createDefaultCraftingQueue(), 'rope', 3);
    expect(result).toMatchObject({ ok: true, queued: 3, requested: 3, reason: 'queued', inventory: {} });
    expect(result.crafting.entries.map(({ id, recipeId }) => ({ id, recipeId }))).toEqual([
      { id: 'craft-1', recipeId: 'rope' },
      { id: 'craft-2', recipeId: 'rope' },
      { id: 'craft-3', recipeId: 'rope' },
    ]);
  });

  it('queues only the quantity covered by materials and remaining queue capacity', () => {
    const materials = queueCraftItems({ fiber: 6 }, createDefaultCraftingQueue(), 'rope', 4);
    expect(materials).toMatchObject({ ok: true, queued: 3, reason: 'partial', missing: { fiber: 2 } });
    expect(maxQueueableCrafts({ fiber: 40 }, materials.crafting, 'rope')).toBe(5);

    const full = queueCraftItems({ fiber: 40 }, materials.crafting, 'rope', 8);
    expect(full).toMatchObject({ ok: true, queued: 5, reason: 'partial' });
    expect(full.crafting.entries).toHaveLength(MAX_CRAFTING_QUEUE);
  });

  it('enforces research and unique tool ownership across queued entries', () => {
    expect(queueCraftItems({ metalIngot: 1 }, createDefaultCraftingQueue(), 'hinge', 1).reason).toBe('locked');
    const queued = queueCraftItems({ timber: 4, rope: 2 }, createDefaultCraftingQueue(), 'hammer', 1);
    expect(queued.ok).toBe(true);
    expect(queueCraftItems(queued.inventory, queued.crafting, 'hammer', 1).reason).toBe('already-owned');
    expect(queueCraftItems({ hammer: 1, timber: 2, rope: 1 }, createDefaultCraftingQueue(), 'hammer', 1).reason)
      .toBe('already-owned');
  });

  it('advances only the queue head and carries surplus time into the next item', () => {
    const queued = queueCraftItems({ fiber: 4 }, createDefaultCraftingQueue(), 'rope', 2);
    const result = advanceCraftingQueue(queued.inventory, queued.crafting, 1.1);
    expect(result.completed).toHaveLength(1);
    expect(itemCount(result.inventory, 'rope')).toBe(1);
    expect(result.crafting.entries).toHaveLength(1);
    expect(result.crafting.entries[0].elapsedSeconds).toBeCloseTo(0.2);
  });

  it('holds a completed output at the boundary until inventory space exists', () => {
    const fullInventory = (Object.keys(ITEM_DEFINITIONS) as ItemId[])
      .filter((itemId) => itemId !== 'rope')
      .slice(0, 20)
      .reduce<Inventory>((inventory, itemId) => ({ ...inventory, [itemId]: 1 }), {});
    expect(usedInventorySlots(fullInventory)).toBe(20);
    const crafting = sanitizeCraftingQueue({
      entries: [{ id: 'craft-1', recipeId: 'rope', elapsedSeconds: 0 }],
      nextSerial: 2,
    });
    const blocked = advanceCraftingQueue(fullInventory, crafting, 1);
    expect(blocked).toMatchObject({ completed: [], blockedReason: 'inventory-full' });
    expect(blocked.crafting.entries[0].elapsedSeconds).toBe(RECIPE_CRAFT_SECONDS.rope);

    const freed = { ...fullInventory };
    delete freed[Object.keys(freed)[0] as ItemId];
    const completed = advanceCraftingQueue(freed, blocked.crafting, 0);
    expect(completed.completed).toHaveLength(1);
    expect(itemCount(completed.inventory, 'rope')).toBe(1);
  });

  it('refunds committed materials but refuses cancellation that would overflow', () => {
    const queued = queueCraftItems({ fiber: 2 }, createDefaultCraftingQueue(), 'rope', 1);
    const cancelled = cancelCraftingEntry(queued.inventory, queued.crafting, 'craft-1');
    expect(cancelled).toMatchObject({ ok: true, reason: 'cancelled', inventory: { fiber: 2 } });
    expect(cancelled.crafting.entries).toEqual([]);

    const fullInventory = (Object.keys(ITEM_DEFINITIONS) as ItemId[])
      .filter((itemId) => itemId !== 'fiber')
      .slice(0, 20)
      .reduce<Inventory>((inventory, itemId) => ({ ...inventory, [itemId]: 1 }), {});
    const refused = cancelCraftingEntry(fullInventory, queued.crafting, 'craft-1');
    expect(refused).toMatchObject({ ok: false, reason: 'inventory-full' });
    expect(refused.crafting.entries).toHaveLength(1);
  });

  it('sanitizes invalid entries, duplicate tool outputs and upgrade durability', () => {
    const crafting = sanitizeCraftingQueue({
      entries: [
        { id: 'upgrade', recipeId: 'metalSpear', elapsedSeconds: 99, consumedToolDurability: 7, selectOnComplete: true },
        { id: 'duplicate', recipeId: 'metalSpear', elapsedSeconds: 0 },
        { id: 'invalid', recipeId: 'madeUp', elapsedSeconds: 2 },
      ],
      nextSerial: -4,
    });
    expect(crafting.entries).toEqual([{
      id: 'upgrade',
      recipeId: 'metalSpear',
      elapsedSeconds: RECIPE_CRAFT_SECONDS.metalSpear,
      consumedTool: 'spear',
      consumedToolDurability: 7,
      selectOnComplete: true,
    }]);
    expect(crafting.nextSerial).toBe(1);
  });
});
