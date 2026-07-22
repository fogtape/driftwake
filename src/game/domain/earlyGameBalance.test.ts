import { describe, expect, it } from 'vitest';
import {
  INVENTORY_SLOT_CAPACITY,
  STARTING_INVENTORY,
  addItems,
  itemCount,
  removeItems,
  salvageLoot,
  type Inventory,
  type ItemBundle,
  type ItemId,
} from './items';
import {
  advanceCraftingQueue,
  createDefaultCraftingQueue,
  queueCraftItems,
  type CraftingQueueState,
} from './craftingQueue';
import {
  advanceDeviceState,
  collectDeviceOutput,
  createDeviceState,
  deviceOutput,
  startDeviceCycle,
  type SavedDeviceState,
} from './devices';
import { INITIAL_SURVIVAL, advanceSurvival, consumeItem, type SurvivalState } from './survival';
import { RECIPES, type RecipeId } from './recipes';
import { generateHarvestNodes } from './island';
import { generateReefNodes } from './underwater';

const FIRST_BELT = [
  ['timber', 0.5],
  ['polymer', 0.5],
  ['fiber', 0.5],
  ['timber', 0.5],
  ['fiber', 0.5],
  ['timber', 0.5],
  ['polymer', 0.5],
  ['barrel', 0.2],
  ['timber', 0.5],
  ['fiber', 0.5],
  ['cache', 0.6],
] as const;

function mergeBundles(bundles: readonly ItemBundle[]): ItemBundle {
  return bundles.reduce<ItemBundle>((merged, bundle) => {
    for (const [itemId, amount] of Object.entries(bundle) as [ItemId, number][]) {
      merged[itemId] = (merged[itemId] ?? 0) + amount;
    }
    return merged;
  }, {});
}

function commitCraft(
  inventory: Inventory,
  crafting: CraftingQueueState,
  recipeId: Parameters<typeof queueCraftItems>[2],
): { inventory: Inventory; crafting: CraftingQueueState } {
  const result = queueCraftItems(inventory, crafting, recipeId, 1);
  expect(result.ok, `${recipeId} should be affordable`).toBe(true);
  return { inventory: result.inventory, crafting: result.crafting };
}

function drinkOrEat(inventory: Inventory, survival: SurvivalState, itemId: ItemId) {
  const consumed = consumeItem(survival, itemId);
  if (!consumed.usable) return { inventory, survival, consumed: false };
  const paid = removeItems(inventory, { [itemId]: 1 });
  if (!paid) return { inventory, survival, consumed: false };
  const returned = itemId === 'freshWaterCup'
    ? addItems(paid, { emptyCup: 1 }, INVENTORY_SLOT_CAPACITY).inventory
    : paid;
  return { inventory: returned, survival: consumed.survival, consumed: true };
}

function craftFirstUtilities(inventory: Inventory): { inventory: Inventory; completed: string[] } {
  let crafting = createDefaultCraftingQueue();
  ({ inventory, crafting } = commitCraft(inventory, crafting, 'rope'));
  const rope = advanceCraftingQueue(inventory, crafting, 0.9);
  inventory = rope.inventory;
  crafting = rope.crafting;
  ({ inventory, crafting } = commitCraft(inventory, crafting, 'emptyCup'));
  ({ inventory, crafting } = commitCraft(inventory, crafting, 'purifierKit'));
  const utilities = advanceCraftingQueue(inventory, crafting, 8);
  return {
    inventory: utilities.inventory,
    completed: [...rope.completed, ...utilities.completed].map((entry) => entry.recipeId),
  };
}

describe('early-game 60-minute balance contract', () => {
  it('makes the first deterministic debris belt sufficient for a cup, rope, purifier, and two cycles of fuel', () => {
    const belt = mergeBundles(FIRST_BELT.map(([kind, roll]) => salvageLoot(kind, roll)));
    const completed = craftFirstUtilities(addItems(STARTING_INVENTORY, belt).inventory);

    expect(completed.completed).toEqual(['rope', 'emptyCup', 'purifierKit']);
    expect(completed.inventory).toMatchObject({ timber: 2, polymer: 1, fiber: 4, emptyCup: 1, purifierKit: 1 });
  });

  it('keeps an attentive first-hour route stable while inactivity still produces meaningful pressure', () => {
    let survival = { ...INITIAL_SURVIVAL };
    let inventory = { ...STARTING_INVENTORY };
    let purifier: SavedDeviceState | null = null;
    let purifierCycles = 0;
    let waterConsumed = 0;
    let foodConsumed = 0;

    for (let second = 1; second <= 3600; second += 1) {
      survival = advanceSurvival(survival, 1);

      if (second === 180) {
        const belt = mergeBundles(FIRST_BELT.map(([kind, roll]) => salvageLoot(kind, roll)));
        inventory = addItems(inventory, belt).inventory;
        const completed = craftFirstUtilities(inventory);
        inventory = removeItems(completed.inventory, { purifierKit: 1 })!;
        purifier = createDeviceState('purifier', 0, 0, 0, 'balance-purifier');
      }

      if (second === 600) {
        inventory = addItems(inventory, salvageLoot('cache', 0.6)).inventory;
      }

      if (purifier?.phase === 'idle' && itemCount(inventory, 'emptyCup') > 0 && itemCount(inventory, 'timber') > 0) {
        inventory = removeItems(inventory, { emptyCup: 1, timber: 1 })!;
        purifier = startDeviceCycle(purifier);
        purifierCycles += 1;
      }
      if (purifier) {
        purifier = advanceDeviceState(purifier, 1).device;
        if (purifier.phase === 'ready') {
          inventory = addItems(inventory, deviceOutput(purifier)).inventory;
          purifier = collectDeviceOutput(purifier);
        }
      }

      if (survival.thirst <= 40) {
        const waterId = itemCount(inventory, 'freshWaterCup') > 0
          ? 'freshWaterCup'
          : itemCount(inventory, 'emergencyWater') > 0
            ? 'emergencyWater'
            : null;
        if (waterId) {
          const result = drinkOrEat(inventory, survival, waterId);
          inventory = result.inventory;
          survival = result.survival;
          if (result.consumed) waterConsumed += 1;
        }
      }
      if (survival.hunger <= 40 && itemCount(inventory, 'ration') > 0) {
        const result = drinkOrEat(inventory, survival, 'ration');
        inventory = result.inventory;
        survival = result.survival;
        if (result.consumed) foodConsumed += 1;
      }

      expect(survival.health, `survival failed at ${second}s`).toBeGreaterThan(0);
    }

    expect(purifierCycles).toBe(4);
    expect(waterConsumed).toBe(4);
    expect(foodConsumed).toBe(3);
    expect(survival).toMatchObject({ health: 100 });
    expect(survival.thirst).toBeGreaterThan(45);
    expect(survival.hunger).toBeGreaterThan(42);

    let unattended = { ...INITIAL_SURVIVAL };
    let failedAt = 0;
    for (let second = 1; second <= 3600; second += 1) {
      unattended = advanceSurvival(unattended, 1);
      if (unattended.health <= 0) {
        failedAt = second;
        break;
      }
    }
    expect(failedAt).toBeGreaterThanOrEqual(2100);
    expect(failedAt).toBeLessThanOrEqual(2160);
  });

  it('budgets the first signal array for three complete reef expeditions instead of one lucky dive', () => {
    const routeCrafts: Partial<Record<RecipeId, number>> = {
      wetBrick: 7,
      smelterKit: 1,
      hinge: 2,
      signalBoard: 4,
      brineCell: 1,
      receiverKit: 1,
      antennaKit: 1,
    };
    const craftingCosts = mergeBundles(
      (Object.entries(routeCrafts) as [RecipeId, number][]).map(([recipeId, count]) => (
        Object.fromEntries(
          (Object.entries(RECIPES[recipeId].cost) as [ItemId, number][])
            .map(([itemId, amount]) => [itemId, amount * count]),
        ) as ItemBundle
      )),
    );
    const sampleCosts: ItemBundle = {
      timber: 1,
      rope: 1,
      scrap: 1,
      dryBrick: 1,
      metalIngot: 1,
      glassPane: 1,
      hinge: 1,
      signalBoard: 1,
    };
    const metalCharges = (craftingCosts.metalIngot ?? 0) + (sampleCosts.metalIngot ?? 0);
    const glassCharges = (craftingCosts.glassPane ?? 0) + (sampleCosts.glassPane ?? 0);
    const rawBudget = {
      sand: (craftingCosts.sand ?? 0) + glassCharges,
      clay: craftingCosts.clay ?? 0,
      metalOre: metalCharges,
      timber: (craftingCosts.timber ?? 0) + (sampleCosts.timber ?? 0) + (metalCharges + glassCharges) * 2,
      scrap: (craftingCosts.scrap ?? 0) + (sampleCosts.scrap ?? 0),
      polymer: craftingCosts.polymer ?? 0,
      rope: (craftingCosts.rope ?? 0) + (sampleCosts.rope ?? 0),
    };
    expect(rawBudget).toEqual({ sand: 19, clay: 14, metalOre: 10, timber: 48, scrap: 22, polymer: 16, rope: 3 });

    const reefYield = mergeBundles(generateReefNodes(0x51ad7e).map((node) => node.output));
    const islandYield = mergeBundles(generateHarvestNodes(0x51ad7e).map((node) => node.output));
    expect(reefYield).toMatchObject({ sand: 8, clay: 8, metalOre: 4 });
    expect((reefYield.sand ?? 0) * 2).toBeLessThan(rawBudget.sand);
    expect((reefYield.metalOre ?? 0) * 2).toBeLessThan(rawBudget.metalOre);
    expect((reefYield.sand ?? 0) * 3).toBeGreaterThanOrEqual(rawBudget.sand);
    expect((reefYield.clay ?? 0) * 3).toBeGreaterThanOrEqual(rawBudget.clay);
    expect((reefYield.metalOre ?? 0) * 3).toBeGreaterThanOrEqual(rawBudget.metalOre);
    expect((islandYield.timber ?? 0) * 3).toBeGreaterThanOrEqual(rawBudget.timber);
  });
});
