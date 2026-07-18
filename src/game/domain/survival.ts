import { itemCount, type Inventory, type ItemId } from './items';

export interface SurvivalState {
  health: number;
  thirst: number;
  hunger: number;
  oxygen: number;
}

export const INITIAL_SURVIVAL: SurvivalState = { health: 100, thirst: 82, hunger: 74, oxygen: 100 };

export const OXYGEN_DRAIN_PER_SECOND = 2.55;
export const OXYGEN_RECOVERY_PER_SECOND = 18;
export const DROWNING_DAMAGE_PER_SECOND = 5.5;
export const THIRST_DRAIN_PER_SECOND = 0.052;
export const HUNGER_DRAIN_PER_SECOND = 0.032;

export type SurvivalMetric = keyof SurvivalState;
export type SurvivalBand = 'stable' | 'low' | 'critical' | 'depleted';

export const SURVIVAL_THRESHOLDS: Record<SurvivalMetric, { low: number; critical: number }> = {
  health: { low: 40, critical: 20 },
  thirst: { low: 30, critical: 15 },
  hunger: { low: 30, critical: 15 },
  oxygen: { low: 50, critical: 28 },
};

export function survivalBand(metric: SurvivalMetric, value: number): SurvivalBand {
  const normalized = clampStat(Number.isFinite(value) ? value : 0);
  if (normalized <= 0) return 'depleted';
  if (normalized <= SURVIVAL_THRESHOLDS[metric].critical) return 'critical';
  if (normalized <= SURVIVAL_THRESHOLDS[metric].low) return 'low';
  return 'stable';
}

function clampStat(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function normalizeSurvival(value: Partial<SurvivalState> | null | undefined): SurvivalState {
  return {
    health: clampStat(Number.isFinite(value?.health) ? value!.health! : INITIAL_SURVIVAL.health),
    thirst: clampStat(Number.isFinite(value?.thirst) ? value!.thirst! : INITIAL_SURVIVAL.thirst),
    hunger: clampStat(Number.isFinite(value?.hunger) ? value!.hunger! : INITIAL_SURVIVAL.hunger),
    oxygen: clampStat(Number.isFinite(value?.oxygen) ? value!.oxygen! : INITIAL_SURVIVAL.oxygen),
  };
}

export function advanceSurvival(current: SurvivalState, seconds: number, submerged = false): SurvivalState {
  const elapsed = Math.max(0, Math.min(seconds, 60));
  const thirst = clampStat(current.thirst - elapsed * THIRST_DRAIN_PER_SECOND);
  const hunger = clampStat(current.hunger - elapsed * HUNGER_DRAIN_PER_SECOND);
  const oxygen = clampStat(
    submerged
      ? current.oxygen - elapsed * OXYGEN_DRAIN_PER_SECOND
      : current.oxygen + elapsed * OXYGEN_RECOVERY_PER_SECOND,
  );
  const deprived = thirst <= 0 || hunger <= 0;
  const drownedSeconds = submerged
    ? Math.max(0, elapsed - Math.max(0, current.oxygen) / OXYGEN_DRAIN_PER_SECOND)
    : 0;
  const healthRecovery =
    !submerged && thirst > 55 && hunger > 55 && current.health < 100 ? elapsed * 0.018 : 0;
  const healthDamage = deprived ? elapsed * (thirst <= 0 && hunger <= 0 ? 0.32 : 0.18) : 0;
  return {
    health: clampStat(current.health + healthRecovery - healthDamage - drownedSeconds * DROWNING_DAMAGE_PER_SECOND),
    thirst,
    hunger,
    oxygen,
  };
}

export interface ConsumableResult {
  survival: SurvivalState;
  usable: boolean;
  reason: 'consumed' | 'not-consumable' | 'not-needed';
  healthDelta: number;
  thirstDelta: number;
  hungerDelta: number;
}

export const CONSUMABLE_EFFECTS: Partial<
  Record<ItemId, Pick<ConsumableResult, 'healthDelta' | 'thirstDelta' | 'hungerDelta'>>
> = {
  emergencyWater: { healthDelta: 0, thirstDelta: 34, hungerDelta: 0 },
  freshWaterCup: { healthDelta: 1, thirstDelta: 42, hungerDelta: 0 },
  ration: { healthDelta: 0, thirstDelta: -2, hungerDelta: 28 },
  palmFruit: { healthDelta: 1, thirstDelta: 12, hungerDelta: 18 },
  rawFish: { healthDelta: -8, thirstDelta: -3, hungerDelta: 9 },
  cookedFish: { healthDelta: 3, thirstDelta: 0, hungerDelta: 36 },
  burntFish: { healthDelta: -3, thirstDelta: -4, hungerDelta: 12 },
};

export function canBenefitFromConsumable(current: SurvivalState, itemId: ItemId): boolean {
  const effect = CONSUMABLE_EFFECTS[itemId];
  if (!effect) return false;
  return (effect.healthDelta > 0 && current.health < 100)
    || (effect.thirstDelta > 0 && current.thirst < 100)
    || (effect.hungerDelta > 0 && current.hunger < 100);
}

export function survivalNeedRunwaySeconds(
  current: SurvivalState,
  inventory: Inventory,
  need: 'thirst' | 'hunger',
): number {
  const deltaKey = need === 'thirst' ? 'thirstDelta' : 'hungerDelta';
  const stored = (Object.entries(CONSUMABLE_EFFECTS) as [ItemId, NonNullable<(typeof CONSUMABLE_EFFECTS)[ItemId]>][])
    .reduce((total, [itemId, effect]) => total + itemCount(inventory, itemId) * Math.max(0, effect[deltaKey]), 0);
  const rate = need === 'thirst' ? THIRST_DRAIN_PER_SECOND : HUNGER_DRAIN_PER_SECOND;
  return (clampStat(current[need]) + stored) / rate;
}

export function consumeItem(current: SurvivalState, itemId: ItemId): ConsumableResult {
  const effect = CONSUMABLE_EFFECTS[itemId];
  if (!effect) {
    return {
      survival: current,
      usable: false,
      reason: 'not-consumable',
      healthDelta: 0,
      thirstDelta: 0,
      hungerDelta: 0,
    };
  }
  if (!canBenefitFromConsumable(current, itemId)) {
    return {
      survival: current,
      usable: false,
      reason: 'not-needed',
      healthDelta: 0,
      thirstDelta: 0,
      hungerDelta: 0,
    };
  }
  return {
    usable: true,
    reason: 'consumed',
    ...effect,
    survival: {
      health: clampStat(current.health + effect.healthDelta),
      thirst: clampStat(current.thirst + effect.thirstDelta),
      hunger: clampStat(current.hunger + effect.hungerDelta),
      oxygen: current.oxygen,
    },
  };
}
