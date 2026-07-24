import { ITEM_DEFINITIONS, itemCount, type Inventory, type ItemBundle, type ItemId } from './items';
import { RECIPES } from './recipes';
import { RAFT_BUILD_PIECE_DEFINITIONS } from './raftStructures';

export type VoyageObjectiveTone = 'salvage' | 'water' | 'food' | 'build';

export interface VoyageObjective {
  id: string;
  chapter: string;
  title: string;
  detail: string;
  progress: number;
  tone: VoyageObjectiveTone;
}

export interface VoyageObjectiveInput {
  inventory: Inventory;
  survival: { thirst: number; hunger: number };
  raftTiles: number;
  purifier: { placed: number; working: number; ready: number; progress: number };
}

interface CostProgress {
  progress: number;
  detail: string;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function costProgress(inventory: Inventory, cost: ItemBundle): CostProgress {
  const entries = Object.entries(cost) as [ItemId, number][];
  let secured = 0;
  let required = 0;
  const detail = entries.map(([itemId, amount]) => {
    const needed = Math.max(0, Math.floor(amount));
    const owned = Math.min(needed, itemCount(inventory, itemId));
    secured += owned;
    required += needed;
    return `${ITEM_DEFINITIONS[itemId].shortName} ${owned}/${needed}`;
  }).join(' · ');
  return { progress: required > 0 ? secured / required : 1, detail };
}

function itemSupply(inventory: Inventory, itemIds: readonly ItemId[]): number {
  return itemIds.reduce((total, itemId) => total + itemCount(inventory, itemId), 0);
}

export function getVoyageObjective(input: VoyageObjectiveInput): VoyageObjective | null {
  const freshWater = itemSupply(input.inventory, ['freshWaterCup', 'emergencyWater']);
  const brewedWater = itemCount(input.inventory, 'freshWaterCup');
  const food = itemSupply(input.inventory, ['ration', 'cookedFish', 'rawFish', 'burntFish', 'palmFruit']);

  if (input.survival.thirst <= 30 && freshWater > 0) {
    return {
      id: 'restore-water',
      chapter: '潮水余量',
      title: '先留住一口淡水',
      detail: `可用淡水 ${freshWater}`,
      progress: 1,
      tone: 'water',
    };
  }
  if (input.survival.hunger <= 24 && food > 0) {
    return {
      id: 'restore-food',
      chapter: '潮水余量',
      title: '先留住一份食物',
      detail: `可用食物 ${food}`,
      progress: 1,
      tone: 'food',
    };
  }

  if (input.purifier.placed <= 0) {
    if (itemCount(input.inventory, 'purifierKit') > 0) {
      return {
        id: 'place-purifier',
        chapter: '漂流起步',
        title: '让淡水循环留在筏上',
        detail: '潮汐净水器已经装配完成',
        progress: 1,
        tone: 'water',
      };
    }
    const materials = costProgress(input.inventory, RECIPES.purifierKit.cost);
    return {
      id: 'craft-purifier',
      chapter: '漂流起步',
      title: '凑齐潮汐净水器',
      detail: materials.detail,
      progress: materials.progress,
      tone: 'salvage',
    };
  }

  if (input.purifier.ready > 0) {
    return {
      id: 'collect-water',
      chapter: '潮汐循环',
      title: '淡水已经凝结',
      detail: '冷凝杯正在等候回收',
      progress: 1,
      tone: 'water',
    };
  }
  if (input.purifier.working > 0) {
    return {
      id: 'wait-water',
      chapter: '潮汐循环',
      title: '淡水正在穿过冷凝沟',
      detail: `冷凝进度 ${Math.round(clamp01(input.purifier.progress) * 100)}%`,
      progress: clamp01(input.purifier.progress),
      tone: 'water',
    };
  }
  if (brewedWater <= 0) {
    if (itemCount(input.inventory, 'emptyCup') <= 0) {
      const materials = costProgress(input.inventory, RECIPES.emptyCup.cost);
      return {
        id: 'craft-cup',
        chapter: '潮汐循环',
        title: '给淡水留出容器',
        detail: materials.detail,
        progress: materials.progress,
        tone: 'salvage',
      };
    }
    if (itemCount(input.inventory, 'timber') <= 0) {
      return {
        id: 'fuel-purifier',
        chapter: '潮汐循环',
        title: '为蒸馏留下一段漂木',
        detail: '漂木 0/1',
        progress: 0,
        tone: 'salvage',
      };
    }
    return {
      id: 'start-purifier',
      chapter: '潮汐循环',
      title: '让第一杯淡水开始凝结',
      detail: '容器与燃料已经备好',
      progress: 1,
      tone: 'water',
    };
  }

  if (input.raftTiles <= 9) {
    if (itemCount(input.inventory, 'hammer') <= 0) {
      const materials = costProgress(input.inventory, RECIPES.hammer.cost);
      return {
        id: 'craft-hammer',
        chapter: '筏缘生长',
        title: '做一把能改变潮流的锤子',
        detail: materials.detail,
        progress: materials.progress,
        tone: 'build',
      };
    }
    const materials = costProgress(input.inventory, RAFT_BUILD_PIECE_DEFINITIONS.foundation.cost);
    return {
      id: 'expand-raft',
      chapter: '筏缘生长',
      title: '在筏缘添出一块立足处',
      detail: materials.detail,
      progress: materials.progress,
      tone: 'build',
    };
  }

  return null;
}
