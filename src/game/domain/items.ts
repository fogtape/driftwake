export type ItemCategory = 'material' | 'tool' | 'food' | 'water';

export const ITEM_DEFINITIONS = {
  timber: {
    id: 'timber',
    name: '盐蚀漂木',
    shortName: '漂木',
    category: 'material',
    maxStack: 20,
    tone: '#d8ae70',
    description: '仍有韧性的回收木料，是扩建与修补木筏的基础。',
  },
  polymer: {
    id: 'polymer',
    name: '聚合片',
    shortName: '聚合片',
    category: 'material',
    maxStack: 20,
    tone: '#66b6bf',
    description: '被海水磨圆的轻质材料，可用于固定结构和制作容器。',
  },
  fiber: {
    id: 'fiber',
    name: '棕榈纤维',
    shortName: '纤维',
    category: 'material',
    maxStack: 20,
    tone: '#80ad71',
    description: '晒干后依旧结实的长纤维，适合编绳与扎结。',
  },
  scrap: {
    id: 'scrap',
    name: '氧化废铁',
    shortName: '废铁',
    category: 'material',
    maxStack: 12,
    tone: '#b78571',
    description: '来自补给箱的稀有金属，可强化工具与研究设备。',
  },
  rope: {
    id: 'rope',
    name: '编织绳',
    shortName: '绳索',
    category: 'material',
    maxStack: 10,
    tone: '#c9aa73',
    description: '由长纤维绞成的承力绳，许多工具的关键部件。',
  },
  hook: {
    id: 'hook',
    name: '打捞钩',
    shortName: '打捞钩',
    category: 'tool',
    maxStack: 1,
    tone: '#d8ddd9',
    description: '回收漂流物的主要工具，蓄力会增加投掷距离。',
  },
  hammer: {
    id: 'hammer',
    name: '建造锤',
    shortName: '建造锤',
    category: 'tool',
    maxStack: 1,
    tone: '#efc35c',
    description: '扩建、修补和维护木筏结构。',
  },
  spear: {
    id: 'spear',
    name: '木矛',
    shortName: '木矛',
    category: 'tool',
    maxStack: 1,
    tone: '#e18162',
    description: '近距离驱赶海中威胁，出手时机比挥舞速度更重要。',
  },
  fishingRod: {
    id: 'fishingRod',
    name: '纤维钓竿',
    shortName: '钓竿',
    category: 'tool',
    maxStack: 1,
    tone: '#75b9c3',
    description: '在漂流物稀少时，提供稳定但需要专注的食物来源。',
  },
  emergencyWater: {
    id: 'emergencyWater',
    name: '密封淡水',
    shortName: '淡水',
    category: 'water',
    maxStack: 5,
    tone: '#4db3cc',
    description: '补给箱中幸存的淡水袋，能够恢复 34 点口渴。',
  },
  ration: {
    id: 'ration',
    name: '海员口粮',
    shortName: '口粮',
    category: 'food',
    maxStack: 5,
    tone: '#e5b85e',
    description: '高能量压缩口粮，能够恢复 28 点饥饿。',
  },
  rawFish: {
    id: 'rawFish',
    name: '银脊鱼',
    shortName: '生鱼',
    category: 'food',
    maxStack: 8,
    tone: '#84bac1',
    description: '刚钓起的小型海鱼。生食只能少量充饥，并会损失生命。',
  },
  cookedFish: {
    id: 'cookedFish',
    name: '烤银脊鱼',
    shortName: '烤鱼',
    category: 'food',
    maxStack: 8,
    tone: '#df9b61',
    description: '火候恰好的鱼肉，能够恢复 36 点饥饿。',
  },
} as const satisfies Record<
  string,
  {
    id: string;
    name: string;
    shortName: string;
    category: ItemCategory;
    maxStack: number;
    tone: string;
    description: string;
  }
>;

export type ItemId = keyof typeof ITEM_DEFINITIONS;
export type ToolId = Extract<ItemId, 'hook' | 'hammer' | 'spear' | 'fishingRod'>;
export type SalvageKind = 'timber' | 'polymer' | 'fiber' | 'cache';
export type Inventory = Partial<Record<ItemId, number>>;
export type ItemBundle = Partial<Record<ItemId, number>>;

export const INVENTORY_SLOT_CAPACITY = 20;
export const TOOL_ORDER: readonly ToolId[] = ['hook', 'hammer', 'spear', 'fishingRod'];
export const STARTING_INVENTORY: Inventory = {
  hook: 1,
  emergencyWater: 1,
  ration: 1,
};

export interface InventoryMutation {
  inventory: Inventory;
  accepted: ItemBundle;
  rejected: ItemBundle;
}

function cleanCount(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value ?? 0)) : 0;
}

export function normalizeInventory(inventory: Inventory): Inventory {
  const normalized: Inventory = {};
  for (const id of Object.keys(ITEM_DEFINITIONS) as ItemId[]) {
    const count = cleanCount(inventory[id]);
    if (count > 0) normalized[id] = count;
  }
  return normalized;
}

export function itemCount(inventory: Inventory, id: ItemId): number {
  return cleanCount(inventory[id]);
}

export function usedInventorySlots(inventory: Inventory): number {
  return (Object.keys(ITEM_DEFINITIONS) as ItemId[]).reduce((slots, id) => {
    const count = itemCount(inventory, id);
    return slots + Math.ceil(count / ITEM_DEFINITIONS[id].maxStack);
  }, 0);
}

export function hasItems(inventory: Inventory, cost: ItemBundle): boolean {
  return (Object.entries(cost) as [ItemId, number][]).every(([id, amount]) => itemCount(inventory, id) >= amount);
}

export function addItems(
  current: Inventory,
  bundle: ItemBundle,
  capacity = INVENTORY_SLOT_CAPACITY,
): InventoryMutation {
  const inventory = normalizeInventory(current);
  const accepted: ItemBundle = {};
  const rejected: ItemBundle = {};

  for (const [id, rawAmount] of Object.entries(bundle) as [ItemId, number][]) {
    let remaining = cleanCount(rawAmount);
    if (remaining === 0 || !(id in ITEM_DEFINITIONS)) continue;
    const maxStack = ITEM_DEFINITIONS[id].maxStack;
    let count = itemCount(inventory, id);
    const openInLastStack = count > 0 && count % maxStack !== 0 ? maxStack - (count % maxStack) : 0;
    const fillExisting = Math.min(remaining, openInLastStack);
    count += fillExisting;
    remaining -= fillExisting;

    const freeSlots = Math.max(0, capacity - usedInventorySlots({ ...inventory, [id]: count }));
    const fromNewStacks = Math.min(remaining, freeSlots * maxStack);
    count += fromNewStacks;
    remaining -= fromNewStacks;

    if (count > 0) inventory[id] = count;
    const acceptedAmount = cleanCount(rawAmount) - remaining;
    if (acceptedAmount > 0) accepted[id] = acceptedAmount;
    if (remaining > 0) rejected[id] = remaining;
  }

  return { inventory, accepted, rejected };
}

export function removeItems(current: Inventory, bundle: ItemBundle): Inventory | null {
  if (!hasItems(current, bundle)) return null;
  const inventory = normalizeInventory(current);
  for (const [id, amount] of Object.entries(bundle) as [ItemId, number][]) {
    const next = itemCount(inventory, id) - cleanCount(amount);
    if (next > 0) inventory[id] = next;
    else delete inventory[id];
  }
  return inventory;
}

export function salvageLoot(kind: SalvageKind, roll = 0.5): ItemBundle {
  if (kind !== 'cache') return { [kind]: 1 };
  const loot: ItemBundle = { timber: 2, polymer: 1, fiber: 2, scrap: 1 };
  if (roll < 0.45) loot.emergencyWater = 1;
  else if (roll < 0.9) loot.ration = 1;
  else loot.scrap = 2;
  return loot;
}

export function bundleLabel(bundle: ItemBundle): string {
  return (Object.entries(bundle) as [ItemId, number][])
    .filter(([, amount]) => amount > 0)
    .map(([id, amount]) => `+${amount} ${ITEM_DEFINITIONS[id].shortName}`)
    .join('  ');
}
