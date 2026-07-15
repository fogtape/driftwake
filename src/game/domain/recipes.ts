import {
  ITEM_DEFINITIONS,
  addItems,
  hasItems,
  itemCount,
  removeItems,
  type Inventory,
  type ItemBundle,
  type ItemId,
} from './items';

export type RecipeCategory = 'material' | 'tool';

export const RECIPES = {
  rope: {
    id: 'rope',
    name: '编织绳',
    category: 'material',
    output: { rope: 1 },
    cost: { fiber: 2 },
    description: '把晒干纤维绞紧，制成承力绳。',
  },
  hammer: {
    id: 'hammer',
    name: '建造锤',
    category: 'tool',
    output: { hammer: 1 },
    cost: { timber: 2, rope: 1 },
    description: '进入木筏结构建造与修补。',
  },
  spear: {
    id: 'spear',
    name: '木矛',
    category: 'tool',
    output: { spear: 1 },
    cost: { timber: 3, rope: 1 },
    description: '在鲨鱼贴近木筏时进行短促刺击。',
  },
  fishingRod: {
    id: 'fishingRod',
    name: '纤维钓竿',
    category: 'tool',
    output: { fishingRod: 1 },
    cost: { timber: 2, rope: 2, polymer: 1 },
    description: '抛出浮标，观察鱼讯并控制收线张力。',
  },
} as const satisfies Record<
  string,
  {
    id: string;
    name: string;
    category: RecipeCategory;
    output: ItemBundle;
    cost: ItemBundle;
    description: string;
  }
>;

export type RecipeId = keyof typeof RECIPES;

export interface CraftResult {
  ok: boolean;
  inventory: Inventory;
  reason: 'crafted' | 'missing-materials' | 'already-owned' | 'inventory-full';
  missing: ItemBundle;
}

export function missingForRecipe(inventory: Inventory, recipeId: RecipeId): ItemBundle {
  const missing: ItemBundle = {};
  for (const [id, amount] of Object.entries(RECIPES[recipeId].cost) as [ItemId, number][]) {
    const shortage = amount - itemCount(inventory, id);
    if (shortage > 0) missing[id] = shortage;
  }
  return missing;
}

export function craftRecipe(inventory: Inventory, recipeId: RecipeId): CraftResult {
  const recipe = RECIPES[recipeId];
  const outputId = Object.keys(recipe.output)[0] as ItemId;
  if (ITEM_DEFINITIONS[outputId].category === 'tool' && itemCount(inventory, outputId) > 0) {
    return { ok: false, inventory, reason: 'already-owned', missing: {} };
  }
  if (!hasItems(inventory, recipe.cost)) {
    return { ok: false, inventory, reason: 'missing-materials', missing: missingForRecipe(inventory, recipeId) };
  }
  const paid = removeItems(inventory, recipe.cost);
  if (!paid) return { ok: false, inventory, reason: 'missing-materials', missing: missingForRecipe(inventory, recipeId) };
  const result = addItems(paid, recipe.output);
  if (Object.keys(result.rejected).length > 0) {
    return { ok: false, inventory, reason: 'inventory-full', missing: {} };
  }
  return { ok: true, inventory: result.inventory, reason: 'crafted', missing: {} };
}
