import type { ItemBundle } from './items';
import { SPEAR_THRUST_TO_IMPACT_SECONDS } from './combat';

export const SHARK_MAX_HEALTH = 100;
export const SHARK_SPEAR_REACH = 5.8;
// Covers the farthest legal spear strike plus the carcass's short settling drift.
export const SHARK_CARCASS_HARVEST_REACH = SHARK_SPEAR_REACH + 0.6;
export const SHARK_HARVEST_HOLD_SECONDS = 0.86;
export const SHARK_CARCASS_WINDOW_SECONDS = 52;
export const SHARK_SINK_SECONDS = 4.2;
export const SHARK_RESPAWN_SECONDS = 48;
export const SHARK_COUNTER_OPEN_PROGRESS = 0.22;
export const SHARK_COUNTER_CLOSE_LEAD_SECONDS = SPEAR_THRUST_TO_IMPACT_SECONDS + 0.06;
export const SHARK_COUNTER_IMPACT_GUARD_SECONDS = 0.025;

export interface SharkAttackRhythm {
  biteTimes: readonly number[];
  windupSeconds: number;
  impactSeconds: number;
  recoilSeconds: number;
  endSeconds: number;
}

export const RAFT_SHARK_ATTACK_RHYTHM = {
  biteTimes: [0.96, 2.72],
  windupSeconds: 0.96,
  impactSeconds: 0.16,
  recoilSeconds: 0.58,
  endSeconds: 3.55,
} as const satisfies SharkAttackRhythm;

export const WATER_SHARK_ATTACK_RHYTHM = {
  biteTimes: [0.88, 3.15],
  windupSeconds: 0.88,
  impactSeconds: 0.18,
  recoilSeconds: 0.64,
  endSeconds: 4.18,
} as const satisfies SharkAttackRhythm;

export type SharkAttackPhase = 'idle' | 'windup' | 'impact' | 'recovery' | 'complete';

export interface SharkAttackSample {
  phase: SharkAttackPhase;
  progress: number;
  lunge: number;
  nextBiteIndex: number;
  secondsToImpact: number;
  biteDue: boolean;
  counterWindow: boolean;
  counterStrikeWindow: boolean;
}

export const SHARK_HARVEST_STAGES = [
  { id: 'belly', label: '腹侧鲜肉', loot: { sharkMeat: 1 } },
  { id: 'flank', label: '背脊鲜肉', loot: { sharkMeat: 1 } },
  { id: 'hide', label: '韧皮与鲜肉', loot: { sharkMeat: 1, sharkHide: 1 } },
  { id: 'teeth', label: '深潮齿板', loot: { sharkTooth: 2 } },
] as const satisfies readonly { id: string; label: string; loot: ItemBundle }[];

export type SharkLifecycle = 'active' | 'carcass' | 'cooldown';

export interface SavedSharkState {
  lifecycle: SharkLifecycle;
  health: number;
  x: number;
  z: number;
  harvestIndex: number;
  remainingSeconds: number;
}

export function createDefaultSharkState(): SavedSharkState {
  return {
    lifecycle: 'active',
    health: SHARK_MAX_HEALTH,
    x: 0,
    z: 0,
    harvestIndex: 0,
    remainingSeconds: 0,
  };
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function smoothstep(value: number): number {
  const clamped = clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

export function sampleSharkAttack(
  rhythm: SharkAttackRhythm,
  elapsedSeconds: number,
  appliedBites: number,
): SharkAttackSample {
  const elapsed = Math.max(0, finite(elapsedSeconds));
  const applied = clamp(Math.floor(finite(appliedBites)), 0, rhythm.biteTimes.length);
  const nextBiteTime = rhythm.biteTimes[applied];
  const nextBiteIndex = nextBiteTime === undefined ? -1 : applied;
  const secondsToImpact = nextBiteTime === undefined ? 0 : Math.max(0, nextBiteTime - elapsed);
  const biteDue = nextBiteTime !== undefined && elapsed >= nextBiteTime;
  let lunge = 0;
  for (const biteTime of rhythm.biteTimes) {
    if (elapsed >= biteTime - rhythm.windupSeconds && elapsed <= biteTime) {
      const progress = (elapsed - (biteTime - rhythm.windupSeconds)) / rhythm.windupSeconds;
      lunge = Math.max(lunge, Math.pow(smoothstep(progress), 1.35));
    } else if (elapsed > biteTime && elapsed <= biteTime + rhythm.recoilSeconds) {
      const recoil = (elapsed - biteTime) / rhythm.recoilSeconds;
      lunge = Math.max(lunge, Math.pow(1 - smoothstep(recoil), 1.15));
    }
  }
  if (elapsed >= rhythm.endSeconds) {
    return {
      phase: 'complete',
      progress: 0,
      lunge: 0,
      nextBiteIndex,
      secondsToImpact,
      biteDue,
      counterWindow: false,
      counterStrikeWindow: false,
    };
  }
  if (biteDue) {
    return {
      phase: 'impact',
      progress: 1,
      lunge,
      nextBiteIndex,
      secondsToImpact: 0,
      biteDue: true,
      counterWindow: false,
      counterStrikeWindow: false,
    };
  }
  const lastBiteTime = applied > 0 ? rhythm.biteTimes[applied - 1] : undefined;
  if (lastBiteTime !== undefined && elapsed <= lastBiteTime + rhythm.impactSeconds) {
    return {
      phase: 'impact',
      progress: 1,
      lunge,
      nextBiteIndex,
      secondsToImpact,
      biteDue: false,
      counterWindow: false,
      counterStrikeWindow: false,
    };
  }
  if (nextBiteTime !== undefined && elapsed >= nextBiteTime - rhythm.windupSeconds) {
    const progress = clamp(
      (elapsed - (nextBiteTime - rhythm.windupSeconds)) / rhythm.windupSeconds,
      0,
      1,
    );
    return {
      phase: 'windup',
      progress,
      lunge,
      nextBiteIndex,
      secondsToImpact,
      biteDue: false,
      counterWindow:
        progress >= SHARK_COUNTER_OPEN_PROGRESS
        && secondsToImpact > SHARK_COUNTER_CLOSE_LEAD_SECONDS,
      counterStrikeWindow:
        progress >= SHARK_COUNTER_OPEN_PROGRESS
        && secondsToImpact > SHARK_COUNTER_IMPACT_GUARD_SECONDS,
    };
  }
  return {
    phase: 'recovery',
    progress: 0,
    lunge,
    nextBiteIndex,
    secondsToImpact,
    biteDue: false,
    counterWindow: false,
    counterStrikeWindow: false,
  };
}

export function sanitizeSharkState(value: unknown): SavedSharkState {
  if (!value || typeof value !== 'object') return createDefaultSharkState();
  const candidate = value as Partial<SavedSharkState>;
  if (candidate.lifecycle === 'carcass') {
    const harvestIndex = clamp(Math.floor(finite(candidate.harvestIndex)), 0, SHARK_HARVEST_STAGES.length);
    const remainingSeconds = clamp(finite(candidate.remainingSeconds), 0, SHARK_CARCASS_WINDOW_SECONDS);
    if (harvestIndex >= SHARK_HARVEST_STAGES.length || remainingSeconds <= 0) {
      return {
        ...createDefaultSharkState(),
        lifecycle: 'cooldown',
        health: 0,
        remainingSeconds: SHARK_RESPAWN_SECONDS,
      };
    }
    return {
      lifecycle: 'carcass',
      health: 0,
      x: clamp(finite(candidate.x), -48, 48),
      z: clamp(finite(candidate.z), -48, 48),
      harvestIndex,
      remainingSeconds,
    };
  }
  if (candidate.lifecycle === 'cooldown') {
    const remainingSeconds = clamp(finite(candidate.remainingSeconds), 0, SHARK_RESPAWN_SECONDS);
    return remainingSeconds <= 0
      ? createDefaultSharkState()
      : {
          ...createDefaultSharkState(),
          lifecycle: 'cooldown',
          health: 0,
          remainingSeconds,
        };
  }
  return {
    ...createDefaultSharkState(),
    health: clamp(finite(candidate.health, SHARK_MAX_HEALTH), 1, SHARK_MAX_HEALTH),
  };
}

export function sharkHarvestStage(index: number): (typeof SHARK_HARVEST_STAGES)[number] | null {
  return SHARK_HARVEST_STAGES[Math.floor(index)] ?? null;
}
