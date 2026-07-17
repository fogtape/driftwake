export type ItemCategory = 'material' | 'tool' | 'food' | 'water' | 'container' | 'placeable';

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
  stone: {
    id: 'stone',
    name: '潮磨石',
    shortName: '石料',
    category: 'material',
    maxStack: 16,
    tone: '#a5a294',
    description: '浅滩反复冲刷出的致密石料，可用于压重、研磨和后续工具制作。',
  },
  palmSeed: {
    id: 'palmSeed',
    name: '盐冠棕榈种',
    shortName: '棕榈种',
    category: 'material',
    maxStack: 10,
    tone: '#8ea964',
    description: '包裹着耐盐外壳的种子，是后续筏上种植的基础。',
  },
  sand: {
    id: 'sand',
    name: '浅礁细砂',
    shortName: '细砂',
    category: 'material',
    maxStack: 20,
    tone: '#d9cda8',
    description: '从浅礁底层收集的洁净矿砂，可用于烧制玻璃和耐火材料。',
  },
  clay: {
    id: 'clay',
    name: '潮红黏土',
    shortName: '黏土',
    category: 'material',
    maxStack: 20,
    tone: '#b56f59',
    description: '沉积在礁石背流面的致密黏土，是制砖和熔炼设备的基础。',
  },
  metalOre: {
    id: 'metalOre',
    name: '盐壳金属矿',
    shortName: '金属矿',
    category: 'material',
    maxStack: 12,
    tone: '#789694',
    description: '附着于深色母岩的原生金属，需要熔炼后才能用于升级工具。',
  },
  wetBrick: {
    id: 'wetBrick',
    name: '潮红湿砖',
    shortName: '湿砖',
    category: 'material',
    maxStack: 8,
    tone: '#ad6655',
    description: '细砂、黏土和壳屑压制的耐火砖坯，需要在甲板通风处完全晾干。',
  },
  dryBrick: {
    id: 'dryBrick',
    name: '盐壳耐火砖',
    shortName: '干砖',
    category: 'material',
    maxStack: 8,
    tone: '#c78367',
    description: '晾干后形成稳定孔隙的耐火砖，是制作高温炉胆的核心材料。',
  },
  metalIngot: {
    id: 'metalIngot',
    name: '潮铸金属锭',
    shortName: '金属锭',
    category: 'material',
    maxStack: 8,
    tone: '#91b3ad',
    description: '冶炼后浇铸成形的耐蚀合金，能支撑更薄、更强韧的刃口与矛尖。',
  },
  glassPane: {
    id: 'glassPane',
    name: '潮镜玻璃板',
    shortName: '玻璃板',
    category: 'material',
    maxStack: 8,
    tone: '#8fd0cb',
    description: '浅礁细砂在熔炉中澄清后压成的耐盐玻璃，可聚集日照并封闭淡水回路。',
  },
  hinge: {
    id: 'hinge',
    name: '潮铸密封铰链',
    shortName: '铰链',
    category: 'material',
    maxStack: 8,
    tone: '#b7c5b8',
    description: '由金属锭冷锻成的耐蚀转轴，适合承受柜盖与锚机棘轮的反复载荷。',
  },
  signalBoard: {
    id: 'signalBoard',
    name: '潮听信号板',
    shortName: '信号板',
    category: 'material',
    maxStack: 8,
    tone: '#72b8ad',
    description: '把盐蚀玻璃、潮铸导轨与回收触点压成调谐板，可分离海面噪声中的窄带信号。',
  },
  brineCell: {
    id: 'brineCell',
    name: '盐差电池',
    shortName: '盐电池',
    category: 'material',
    maxStack: 4,
    tone: '#d5be68',
    description: '以金属电极和浓缩盐水形成电势差，为接收台提供约六分钟连续扫描电力。',
  },
  seaweed: {
    id: 'seaweed',
    name: '长叶海草',
    shortName: '海草',
    category: 'material',
    maxStack: 16,
    tone: '#5e9b72',
    description: '生长在潮流稳定处的韧性海草，可加工为黏合剂与潜水用品。',
  },
  emptyCup: {
    id: 'emptyCup',
    name: '折边聚合杯',
    shortName: '空杯',
    category: 'container',
    maxStack: 1,
    tone: '#7dc6c5',
    description: '用回收聚合片压制的耐热杯具，可在净水器中盛取海水。',
  },
  purifierKit: {
    id: 'purifierKit',
    name: '潮汐净水器套件',
    shortName: '净水器',
    category: 'placeable',
    maxStack: 2,
    tone: '#67c6cf',
    description: '织物蒸馏罩、回收槽与木架组成的套件，需要安置在完整筏格上。',
  },
  grillKit: {
    id: 'grillKit',
    name: '折铁烤架套件',
    shortName: '烤架',
    category: 'placeable',
    maxStack: 2,
    tone: '#e58a58',
    description: '由氧化金属和木支架拼成的低矮烤架，可烧制渔获。',
  },
  solarPurifierKit: {
    id: 'solarPurifierKit',
    name: '潮镜五联净水器套件',
    shortName: '五联净水器',
    category: 'placeable',
    maxStack: 1,
    tone: '#72cfc4',
    description: '盐蚀集热玻璃与五路冷凝槽组成的太阳能净水器，可同时处理五杯海水且无需燃料。',
  },
  tripleGrillKit: {
    id: 'tripleGrillKit',
    name: '三槽烟鳍烤台套件',
    shortName: '三槽烤台',
    category: 'placeable',
    maxStack: 1,
    tone: '#d98358',
    description: '带独立食物位、蓄热炉膛和燃料仓的宽体烤台，可并行处理三份小型渔获。',
  },
  lockerKit: {
    id: 'lockerKit',
    name: '干舱储物柜套件',
    shortName: '储物柜',
    category: 'placeable',
    maxStack: 2,
    tone: '#708f8d',
    description: '蜡封帆布内衬、潮铸铰链和木质骨架组成的八格干舱，能隔绝飞沫与盐雾。',
  },
  sailKit: {
    id: 'sailKit',
    name: '拾风帆套件',
    shortName: '拾风帆',
    category: 'placeable',
    maxStack: 1,
    tone: '#d8c99f',
    description: '盐蚀帆布、回收桅杆和受力绳索组成的航帆，可主动选择木筏航向。',
  },
  anchorKit: {
    id: 'anchorKit',
    name: '潮石锚套件',
    shortName: '潮石锚',
    category: 'placeable',
    maxStack: 1,
    tone: '#a87862',
    description: '石坠、锈铁锚爪和手摇绞盘组成的固定锚，能在浅滩抓牢海床。',
  },
  helmKit: {
    id: 'helmKit',
    name: '定潮舵台套件',
    shortName: '定潮舵台',
    category: 'placeable',
    maxStack: 1,
    tone: '#78aaa1',
    description: '以潮铸齿轮、回收舵轮和磁针罗盘组成的航向控制台，可保持航线并抵消阵风偏航。',
  },
  stormRigKit: {
    id: 'stormRigKit',
    name: '横风抗扭索具',
    shortName: '抗风索具',
    category: 'material',
    maxStack: 1,
    tone: '#c9a86f',
    description: '金属撑条、双股受力绳和弹性帆角组成的强化套件，可直接加装到已固定的拾风帆。',
  },
  anchorBraceKit: {
    id: 'anchorBraceKit',
    name: '深锚锁链棘轮套件',
    shortName: '锚机棘轮',
    category: 'material',
    maxStack: 1,
    tone: '#b59670',
    description: '双爪棘轮、潮铸护圈和短节锁链组成的现场升级件，可抑制风暴中的绞盘回滑。',
  },
  receiverKit: {
    id: 'receiverKit',
    name: '潮听接收台套件',
    shortName: '接收台',
    category: 'placeable',
    maxStack: 1,
    tone: '#69bbb0',
    description: '集成扫描屏、频段鼓轮、参考线圈和盐电池舱的海上接收台，可记录命名信号的方位与距离。',
  },
  antennaKit: {
    id: 'antennaKit',
    name: '双桅定向阵列套件',
    shortName: '双桅阵列',
    category: 'placeable',
    maxStack: 1,
    tone: '#9dc6ba',
    description: '两支交叉极化桅杆、盐瓷绝缘子和相位盒组成的定向阵列，需要与接收台保持合适间距。',
  },
  planterKit: {
    id: 'planterKit',
    name: '潮生作物盆套件',
    shortName: '作物盆',
    category: 'placeable',
    maxStack: 4,
    tone: '#86aa68',
    description: '以漂木、椰糠和排水铁件拼成的耐盐种植槽，可在木筏上培育盐冠棕榈。',
  },
  researchBenchKit: {
    id: 'researchBenchKit',
    name: '盐迹研究台套件',
    shortName: '研究台',
    category: 'placeable',
    maxStack: 1,
    tone: '#79a9a1',
    description: '带样本盘、记录板和机械比对尺的工作台，用实物样本推导新配方。',
  },
  smelterKit: {
    id: 'smelterKit',
    name: '回潮熔炉套件',
    shortName: '熔炉',
    category: 'placeable',
    maxStack: 1,
    tone: '#d0785d',
    description: '耐火砖胆、回收铁箍和导风炉口组成的单槽熔炉，可将矿石炼成金属锭。',
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
  metalSpear: {
    id: 'metalSpear',
    name: '潮铸穿浪矛',
    shortName: '金属矛',
    category: 'tool',
    maxStack: 1,
    tone: '#9cc9bf',
    description: '窄长合金矛尖与加固矛柄能把刺击力集中到更小的面积。',
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
  axe: {
    id: 'axe',
    name: '潮磨石斧',
    shortName: '石斧',
    category: 'tool',
    maxStack: 1,
    tone: '#b6b09c',
    description: '用潮磨石与废铁固定刃口，适合砍取岛上的纤维木。',
  },
  metalAxe: {
    id: 'metalAxe',
    name: '潮铸宽刃斧',
    shortName: '金属斧',
    category: 'tool',
    maxStack: 1,
    tone: '#a7c4bd',
    description: '一体铸造的宽刃能更深地切入潮湿木质，显著减少砍伐次数。',
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
  freshWaterCup: {
    id: 'freshWaterCup',
    name: '蒸馏淡水',
    shortName: '淡水杯',
    category: 'water',
    maxStack: 1,
    tone: '#59c7dd',
    description: '经过蒸馏冷凝的洁净淡水。饮用后会留下可重复使用的空杯。',
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
  palmFruit: {
    id: 'palmFruit',
    name: '盐冠潮果',
    shortName: '潮果',
    category: 'food',
    maxStack: 8,
    tone: '#b7cb69',
    description: '岛上棕榈结出的清甜果实，同时补充少量水分和饥饿。',
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
  burntFish: {
    id: 'burntFish',
    name: '焦黑银脊鱼',
    shortName: '焦鱼',
    category: 'food',
    maxStack: 8,
    tone: '#7f6254',
    description: '忘在火上的渔获。仍能勉强充饥，但焦苦表层会损伤生命。',
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
export type ToolId = Extract<ItemId, 'hook' | 'hammer' | 'spear' | 'metalSpear' | 'fishingRod' | 'axe' | 'metalAxe'>;
export type SalvageKind = 'timber' | 'polymer' | 'fiber' | 'cache';
export type Inventory = Partial<Record<ItemId, number>>;
export type ItemBundle = Partial<Record<ItemId, number>>;

export const INVENTORY_SLOT_CAPACITY = 20;
export const STARTING_INVENTORY: Inventory = {
  hook: 1,
  emergencyWater: 1,
  ration: 1,
};

export function preferredToolOrder(inventory: Inventory): readonly ToolId[] {
  return [
    'hook',
    'hammer',
    itemCount(inventory, 'metalSpear') > 0 ? 'metalSpear' : 'spear',
    'fishingRod',
    itemCount(inventory, 'metalAxe') > 0 ? 'metalAxe' : 'axe',
  ];
}

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
