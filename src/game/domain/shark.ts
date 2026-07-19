import type { ItemBundle } from './items';

export const SHARK_MAX_HEALTH = 100;
export const SHARK_SPEAR_REACH = 5.8;
// Covers the farthest legal spear strike plus the carcass's short settling drift.
export const SHARK_CARCASS_HARVEST_REACH = SHARK_SPEAR_REACH + 0.6;
export const SHARK_HARVEST_HOLD_SECONDS = 0.86;
export const SHARK_CARCASS_WINDOW_SECONDS = 52;
export const SHARK_SINK_SECONDS = 4.2;
export const SHARK_RESPAWN_SECONDS = 48;

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
