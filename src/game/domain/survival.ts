import type { ItemId } from './items';

export interface SurvivalState {
  health: number;
  thirst: number;
  hunger: number;
}

export const INITIAL_SURVIVAL: SurvivalState = { health: 100, thirst: 82, hunger: 74 };

function clampStat(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function normalizeSurvival(value: Partial<SurvivalState> | null | undefined): SurvivalState {
  return {
    health: clampStat(Number.isFinite(value?.health) ? value!.health! : INITIAL_SURVIVAL.health),
    thirst: clampStat(Number.isFinite(value?.thirst) ? value!.thirst! : INITIAL_SURVIVAL.thirst),
    hunger: clampStat(Number.isFinite(value?.hunger) ? value!.hunger! : INITIAL_SURVIVAL.hunger),
  };
}

export function advanceSurvival(current: SurvivalState, seconds: number): SurvivalState {
  const elapsed = Math.max(0, Math.min(seconds, 60));
  const thirst = clampStat(current.thirst - elapsed * 0.052);
  const hunger = clampStat(current.hunger - elapsed * 0.032);
  const deprived = thirst <= 0 || hunger <= 0;
  const healthRecovery = thirst > 55 && hunger > 55 && current.health < 100 ? elapsed * 0.018 : 0;
  const healthDamage = deprived ? elapsed * (thirst <= 0 && hunger <= 0 ? 0.32 : 0.18) : 0;
  return {
    health: clampStat(current.health + healthRecovery - healthDamage),
    thirst,
    hunger,
  };
}

export interface ConsumableResult {
  survival: SurvivalState;
  usable: boolean;
  healthDelta: number;
  thirstDelta: number;
  hungerDelta: number;
}

const CONSUMABLE_EFFECTS: Partial<Record<ItemId, Omit<ConsumableResult, 'survival' | 'usable'>>> = {
  emergencyWater: { healthDelta: 0, thirstDelta: 34, hungerDelta: 0 },
  freshWaterCup: { healthDelta: 1, thirstDelta: 42, hungerDelta: 0 },
  ration: { healthDelta: 0, thirstDelta: -2, hungerDelta: 28 },
  rawFish: { healthDelta: -8, thirstDelta: -3, hungerDelta: 9 },
  cookedFish: { healthDelta: 3, thirstDelta: 0, hungerDelta: 36 },
  burntFish: { healthDelta: -3, thirstDelta: -4, hungerDelta: 12 },
};

export function consumeItem(current: SurvivalState, itemId: ItemId): ConsumableResult {
  const effect = CONSUMABLE_EFFECTS[itemId];
  if (!effect) {
    return { survival: current, usable: false, healthDelta: 0, thirstDelta: 0, hungerDelta: 0 };
  }
  return {
    usable: true,
    ...effect,
    survival: {
      health: clampStat(current.health + effect.healthDelta),
      thirst: clampStat(current.thirst + effect.thirstDelta),
      hunger: clampStat(current.hunger + effect.hungerDelta),
    },
  };
}
