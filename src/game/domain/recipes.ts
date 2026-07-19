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

export type RecipeCategory = 'material' | 'tool' | 'survival';

export const RECIPES = {
  hook: {
    id: 'hook',
    name: '替代打捞钩',
    category: 'tool',
    output: { hook: 1 },
    cost: { timber: 2, polymer: 2, rope: 1 },
    description: '用漂木握柄、聚合钩爪和编织绳重新制作打捞工具；断钩后仍可近距离拾取漂流物筹集材料。',
  },
  rope: {
    id: 'rope',
    name: '编织绳',
    category: 'material',
    output: { rope: 1 },
    cost: { fiber: 2 },
    description: '把晒干纤维绞紧，制成承力绳。',
  },
  emptyCup: {
    id: 'emptyCup',
    name: '折边聚合杯',
    category: 'survival',
    output: { emptyCup: 1 },
    cost: { polymer: 2 },
    description: '压出耐热杯壁，作为净水循环中的可重复容器。',
  },
  collectionNetKit: {
    id: 'collectionNetKit',
    name: '潮兜收集网',
    category: 'survival',
    output: { collectionNetKit: 1 },
    cost: { timber: 3, fiber: 4, rope: 2, polymer: 1 },
    description: '固定在木筏外缘，被动截留漂流物；满载后需要手动收取。',
  },
  purifierKit: {
    id: 'purifierKit',
    name: '潮汐净水器',
    category: 'survival',
    output: { purifierKit: 1 },
    cost: { timber: 4, polymer: 2, rope: 1 },
    description: '将海水蒸馏并冷凝到杯具中，需要漂木持续供热。',
  },
  grillKit: {
    id: 'grillKit',
    name: '折铁烤架',
    category: 'survival',
    output: { grillKit: 1 },
    cost: { timber: 3, scrap: 2, rope: 1 },
    description: '把鱼烤熟后及时收取，放置过久会焦黑。',
  },
  hinge: {
    id: 'hinge',
    name: '潮铸密封铰链',
    category: 'material',
    output: { hinge: 1 },
    cost: { metalIngot: 1 },
    description: '将一份金属锭冷锻为耐盐转轴与双片铰座。',
    requiresResearch: true,
  },
  signalBoard: {
    id: 'signalBoard',
    name: '潮听信号板',
    category: 'material',
    output: { signalBoard: 1 },
    cost: { polymer: 2, scrap: 2, metalIngot: 1, glassPane: 1 },
    description: '在玻璃基板上压入潮铸导轨与回收触点，形成可重复调谐的信号核心。',
    requiresResearch: true,
  },
  brineCell: {
    id: 'brineCell',
    name: '盐差电池',
    category: 'survival',
    output: { brineCell: 1 },
    cost: { polymer: 3, scrap: 2, metalIngot: 1 },
    description: '密封浓缩盐水和异种金属电极，为接收设备提供持续电力。',
    requiresResearch: true,
  },
  solarPurifierKit: {
    id: 'solarPurifierKit',
    name: '潮镜五联净水器',
    category: 'survival',
    output: { solarPurifierKit: 1 },
    cost: { timber: 8, polymer: 6, glassPane: 4, rope: 2 },
    description: '以五路集热冷凝板同时处理海水，日照供热不再消耗漂木。',
    requiresResearch: true,
  },
  tripleGrillKit: {
    id: 'tripleGrillKit',
    name: '三槽烟鳍烤台',
    category: 'survival',
    output: { tripleGrillKit: 1 },
    cost: { timber: 6, metalIngot: 2, rope: 2, scrap: 4 },
    description: '宽体蓄热炉膛让三份渔获共享燃料并保持各自火候。',
    requiresResearch: true,
  },
  lockerKit: {
    id: 'lockerKit',
    name: '干舱储物柜',
    category: 'survival',
    output: { lockerKit: 1 },
    cost: { timber: 6, polymer: 4, scrap: 2, rope: 2, hinge: 1 },
    description: '制作带八个堆叠格的密封干舱，物资可在背包与柜内双向转移。',
    requiresResearch: true,
  },
  sailKit: {
    id: 'sailKit',
    name: '拾风帆',
    category: 'survival',
    output: { sailKit: 1 },
    cost: { timber: 6, fiber: 4, rope: 2, scrap: 1 },
    description: '展开后选择航向，借稳定风带加快岛屿接近。',
  },
  anchorKit: {
    id: 'anchorKit',
    name: '潮石锚',
    category: 'survival',
    output: { anchorKit: 1 },
    cost: { timber: 4, stone: 4, rope: 2, scrap: 1 },
    description: '靠近浅滩后抓牢海床，阻止无人看守的木筏继续漂离。',
  },
  helmKit: {
    id: 'helmKit',
    name: '定潮舵台',
    category: 'survival',
    output: { helmKit: 1 },
    cost: { timber: 5, scrap: 4, rope: 2, metalIngot: 3 },
    description: '用磁针、差速齿轮和舵索稳定木筏航向，并在四种航线策略间切换。',
    requiresResearch: true,
  },
  stormRigKit: {
    id: 'stormRigKit',
    name: '横风抗扭索具',
    category: 'survival',
    output: { stormRigKit: 1 },
    cost: { rope: 3, scrap: 2, polymer: 2, metalIngot: 2 },
    description: '为拾风帆增加横撑、泄压帆角和双股受力索，避免强阵风使帆具过载。',
    requiresResearch: true,
  },
  anchorBraceKit: {
    id: 'anchorBraceKit',
    name: '深锚锁链棘轮',
    category: 'survival',
    output: { anchorBraceKit: 1 },
    cost: { metalIngot: 2, hinge: 1, scrap: 3, rope: 2 },
    description: '为潮石锚加装防回滑棘轮与短节锁链，降低风暴锚泊时的绞盘载荷。',
    requiresResearch: true,
  },
  receiverKit: {
    id: 'receiverKit',
    name: '潮听接收台',
    category: 'survival',
    output: { receiverKit: 1 },
    cost: { timber: 8, polymer: 5, scrap: 4, hinge: 1, signalBoard: 2 },
    description: '搭建带扫描屏、频段鼓轮与电池舱的接收台，显示已解码海上信号。',
    requiresResearch: true,
  },
  antennaKit: {
    id: 'antennaKit',
    name: '双桅定向阵列',
    category: 'survival',
    output: { antennaKit: 1 },
    cost: { timber: 5, scrap: 4, rope: 2, metalIngot: 2, signalBoard: 1 },
    description: '把两支交叉极化桅杆接入相位盒，与接收台组成三点测向阵列。',
    requiresResearch: true,
  },
  planterKit: {
    id: 'planterKit',
    name: '潮生作物盆',
    category: 'survival',
    output: { planterKit: 1 },
    cost: { timber: 4, fiber: 3, rope: 1, stone: 2 },
    description: '搭建带排水层的培养槽，播种后需要持续供应蒸馏淡水。',
  },
  researchBenchKit: {
    id: 'researchBenchKit',
    name: '盐迹研究台',
    category: 'survival',
    output: { researchBenchKit: 1 },
    cost: { timber: 6, scrap: 2, rope: 1 },
    description: '用样本、草图和机械比对推导新设备与工具。',
  },
  wetBrick: {
    id: 'wetBrick',
    name: '潮红湿砖',
    category: 'material',
    output: { wetBrick: 1 },
    cost: { sand: 2, clay: 2 },
    description: '将浅礁细砂和潮红黏土压成耐火砖坯，需放在甲板晾干。',
  },
  smelterKit: {
    id: 'smelterKit',
    name: '回潮熔炉',
    category: 'survival',
    output: { smelterKit: 1 },
    cost: { timber: 4, dryBrick: 6, scrap: 3 },
    description: '以耐火砖胆和导风炉口聚集热量，每次熔炼一份矿石。',
    requiresResearch: true,
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
  metalSpear: {
    id: 'metalSpear',
    name: '潮铸穿浪矛',
    category: 'tool',
    output: { metalSpear: 1 },
    cost: { spear: 1, metalIngot: 2, rope: 1 },
    description: '替换木制矛尖并加固绑缚，让每次命中造成更深的创口。',
    requiresResearch: true,
  },
  resonanceFork: {
    id: 'resonanceFork',
    name: '潮鸣震叉',
    category: 'tool',
    output: { resonanceFork: 1 },
    cost: { metalIngot: 2, signalBoard: 1, hinge: 1, rope: 1 },
    description: '将调谐板、密封转轴和双股合金叉齿组成可蓄能的定向震叉，发射需另备盐差电池。',
    requiresResearch: true,
  },
  fishingRod: {
    id: 'fishingRod',
    name: '纤维钓竿',
    category: 'tool',
    output: { fishingRod: 1 },
    cost: { timber: 2, rope: 2, polymer: 1 },
    description: '抛出浮标，观察鱼讯并控制收线张力。',
  },
  axe: {
    id: 'axe',
    name: '潮磨石斧',
    category: 'tool',
    output: { axe: 1 },
    cost: { timber: 2, stone: 2, rope: 1, scrap: 1 },
    description: '把潮磨石刃固定到回收木柄上，用于砍取岛屿棕榈。',
  },
  metalAxe: {
    id: 'metalAxe',
    name: '潮铸宽刃斧',
    category: 'tool',
    output: { metalAxe: 1 },
    cost: { axe: 1, metalIngot: 2, scrap: 1 },
    description: '把石斧升级为一体宽刃，砍伐时每击造成双倍切入。',
    requiresResearch: true,
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
    requiresResearch?: boolean;
  }
>;

export type RecipeId = keyof typeof RECIPES;

export interface CraftResult {
  ok: boolean;
  inventory: Inventory;
  reason: 'crafted' | 'missing-materials' | 'already-owned' | 'inventory-full' | 'locked';
  missing: ItemBundle;
}

export function isRecipeUnlocked(recipeId: RecipeId, learned: readonly RecipeId[] = []): boolean {
  const recipe = RECIPES[recipeId];
  return !('requiresResearch' in recipe) || !recipe.requiresResearch || learned.includes(recipeId);
}

export function missingForRecipe(inventory: Inventory, recipeId: RecipeId): ItemBundle {
  const missing: ItemBundle = {};
  for (const [id, amount] of Object.entries(RECIPES[recipeId].cost) as [ItemId, number][]) {
    const shortage = amount - itemCount(inventory, id);
    if (shortage > 0) missing[id] = shortage;
  }
  return missing;
}

export function craftRecipe(inventory: Inventory, recipeId: RecipeId, learned: readonly RecipeId[] = []): CraftResult {
  const recipe = RECIPES[recipeId];
  if (!isRecipeUnlocked(recipeId, learned)) {
    return { ok: false, inventory, reason: 'locked', missing: {} };
  }
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
