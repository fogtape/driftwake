import type { ItemBundle, ItemId } from './items';
import { normalizeRotation } from './devices';
import type { NavigationWeatherPhase } from './navigation';

export type PlanterPhase = 'empty' | 'sown' | 'growing' | 'dry' | 'mature' | 'withered';
export type PlanterEvent = 'none' | 'dry' | 'rainwater' | 'mature' | 'withered';
export type CropBirdPhase = 'absent' | 'circling' | 'diving' | 'feeding' | 'fleeing';
export type PlantingClimateEffect = 'steady' | 'wind' | 'rain' | 'drizzle';

export interface PlantingWeatherInput {
  weatherPhase: NavigationWeatherPhase;
  stormIntensity: number;
}

export interface PlantingClimate {
  phase: NavigationWeatherPhase;
  intensity: number;
  effect: PlantingClimateEffect;
  label: string;
  growthMultiplier: number;
  waterUseMultiplier: number;
  rainfallPerSecond: number;
  dryTimeMultiplier: number;
}

export interface SavedPlanterState {
  id: string;
  x: number;
  z: number;
  rotation: number;
  phase: PlanterPhase;
  growth: number;
  water: number;
  drySeconds: number;
  birdDamage: number;
}

export interface SavedPlantingState {
  planters: SavedPlanterState[];
  birdClock: number;
  birdVisit: number;
  birdPhase: CropBirdPhase;
  birdElapsed: number;
  birdTargetId: string | null;
}

export const MAX_PLANTERS = 4;
export const PLANT_GROWTH_SECONDS = 104;
export const PLANT_WATER_SECONDS = 61;
export const PLANT_DRY_GRACE_SECONDS = 36;
export const PLANT_MAX_BIRD_DAMAGE = 2;
export const PLANT_BIRD_DAMAGE_PER_SECOND = 0.19;

export const DEFAULT_PLANTING_CLIMATE: PlantingClimate = {
  phase: 'calm',
  intensity: 0,
  effect: 'steady',
  label: '海况平稳',
  growthMultiplier: 1,
  waterUseMultiplier: 1,
  rainfallPerSecond: 0,
  dryTimeMultiplier: 1,
};

export const PLANTER_DEFINITION = {
  name: '潮生作物盆',
  kitItem: 'planterKit' as Extract<ItemId, 'planterKit'>,
  seedItem: 'palmSeed' as Extract<ItemId, 'palmSeed'>,
  waterItem: 'freshWaterCup' as Extract<ItemId, 'freshWaterCup'>,
  harvest: { palmFruit: 3, palmSeed: 1 } satisfies ItemBundle,
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function plantingClimateFromWeather(
  weather: PlantingWeatherInput = { weatherPhase: 'calm', stormIntensity: 0 },
): PlantingClimate {
  const intensity = clamp01(weather.stormIntensity);
  if (weather.weatherPhase === 'building') {
    return {
      phase: 'building',
      intensity,
      effect: intensity > 0.08 ? 'wind' : 'steady',
      label: intensity > 0.55 ? '强风耗水' : '风起蒸腾',
      growthMultiplier: 1 - intensity * 0.1,
      waterUseMultiplier: 1 + intensity * 0.3,
      rainfallPerSecond: 0,
      dryTimeMultiplier: 1 + intensity * 0.25,
    };
  }
  if (weather.weatherPhase === 'storm') {
    return {
      phase: 'storm',
      intensity,
      effect: 'rain',
      label: '风暴雨养',
      growthMultiplier: 0.72,
      waterUseMultiplier: 0.55,
      rainfallPerSecond: 0.024 * intensity,
      dryTimeMultiplier: 0,
    };
  }
  if (weather.weatherPhase === 'clearing') {
    return {
      phase: 'clearing',
      intensity,
      effect: intensity > 0.08 ? 'drizzle' : 'steady',
      label: intensity > 0.45 ? '余雨润土' : '海况转稳',
      growthMultiplier: 0.82 + (1 - intensity) * 0.18,
      waterUseMultiplier: 0.7 + (1 - intensity) * 0.3,
      rainfallPerSecond: 0.021 * intensity,
      dryTimeMultiplier: 0.4 + (1 - intensity) * 0.6,
    };
  }
  return DEFAULT_PLANTING_CLIMATE;
}

export function birdRaidAllowedInClimate(climate: PlantingClimate): boolean {
  return climate.effect !== 'rain' || climate.intensity < 0.55;
}

export function createPlanterState(
  x: number,
  z: number,
  rotation = 0,
  id = `planter-${Date.now().toString(36)}`,
): SavedPlanterState {
  return {
    id,
    x: Math.round(x),
    z: Math.round(z),
    rotation: normalizeRotation(rotation),
    phase: 'empty',
    growth: 0,
    water: 0,
    drySeconds: 0,
    birdDamage: 0,
  };
}

export function sowPlanter(planter: SavedPlanterState): SavedPlanterState {
  if (planter.phase !== 'empty') return planter;
  return { ...planter, phase: 'sown', growth: 0, water: 0, drySeconds: 0, birdDamage: 0 };
}

export function waterPlanter(planter: SavedPlanterState): SavedPlanterState {
  if (planter.phase !== 'sown' && planter.phase !== 'growing' && planter.phase !== 'dry') return planter;
  return { ...planter, phase: 'growing', water: 1, drySeconds: 0 };
}

export function advancePlanter(
  planter: SavedPlanterState,
  seconds: number,
  climate: PlantingClimate = DEFAULT_PLANTING_CLIMATE,
): { planter: SavedPlanterState; event: PlanterEvent } {
  if (seconds <= 0 || !Number.isFinite(seconds)) {
    return { planter, event: 'none' };
  }

  const rainfall = Math.max(0, finite(climate.rainfallPerSecond));
  const waterUse = Math.max(0, finite(climate.waterUseMultiplier, 1)) / PLANT_WATER_SECONDS;
  const netWater = rainfall - waterUse;
  let active = planter;
  let revivedByRain = false;

  if ((planter.phase === 'sown' || planter.phase === 'dry') && netWater > 0.000001) {
    active = { ...planter, phase: 'growing', water: 0, drySeconds: 0 };
    revivedByRain = true;
  } else if (planter.phase === 'dry') {
    const dryRate = Math.max(0, finite(climate.dryTimeMultiplier, 1));
    const drySeconds = planter.drySeconds + seconds * dryRate;
    if (drySeconds >= PLANT_DRY_GRACE_SECONDS) {
      return {
        planter: { ...planter, phase: 'withered', water: 0, drySeconds: PLANT_DRY_GRACE_SECONDS },
        event: 'withered',
      };
    }
    return { planter: { ...planter, drySeconds }, event: 'none' };
  }

  if (active.phase !== 'growing') return { planter, event: 'none' };

  const growthRate = Math.max(0, finite(climate.growthMultiplier, 1)) / PLANT_GROWTH_SECONDS;
  const timeToMature = growthRate > 0 ? (1 - active.growth) / growthRate : Number.POSITIVE_INFINITY;
  const timeToDry = netWater < 0 ? active.water / -netWater : Number.POSITIVE_INFINITY;
  if (timeToMature <= seconds && timeToMature <= timeToDry) {
    const water = clamp01(active.water + netWater * timeToMature);
    return {
      planter: { ...active, phase: 'mature', growth: 1, water, drySeconds: 0 },
      event: 'mature',
    };
  }

  if (timeToDry <= seconds) {
    const growth = clamp01(active.growth + timeToDry * growthRate);
    const remainingDrySeconds = seconds - timeToDry;
    const dryRate = Math.max(0, finite(climate.dryTimeMultiplier, 1));
    const drySeconds = remainingDrySeconds * dryRate;
    if (drySeconds >= PLANT_DRY_GRACE_SECONDS) {
      return {
        planter: { ...active, phase: 'withered', growth, water: 0, drySeconds: PLANT_DRY_GRACE_SECONDS },
        event: 'withered',
      };
    }
    return {
      planter: { ...active, phase: 'dry', growth, water: 0, drySeconds },
      event: 'dry',
    };
  }

  const growth = clamp01(active.growth + seconds * growthRate);
  const water = clamp01(active.water + seconds * netWater);
  return {
    planter: { ...active, growth, water, drySeconds: 0 },
    event: revivedByRain ? 'rainwater' : 'none',
  };
}

export function applyBirdDamage(planter: SavedPlanterState, seconds: number): SavedPlanterState {
  if (
    seconds <= 0 ||
    !Number.isFinite(seconds) ||
    (planter.phase !== 'growing' && planter.phase !== 'dry' && planter.phase !== 'mature') ||
    planter.growth < 0.45
  ) return planter;
  return {
    ...planter,
    birdDamage: Math.min(PLANT_MAX_BIRD_DAMAGE, planter.birdDamage + seconds * PLANT_BIRD_DAMAGE_PER_SECOND),
  };
}

export function planterHarvest(planter: SavedPlanterState): ItemBundle {
  if (planter.phase !== 'mature') return {};
  const fruit = Math.max(1, 3 - Math.floor(planter.birdDamage + 0.001));
  return { palmFruit: fruit, palmSeed: 1 };
}

export function resetPlanter(planter: SavedPlanterState): SavedPlanterState {
  if (planter.phase !== 'mature' && planter.phase !== 'withered') return planter;
  return { ...planter, phase: 'empty', growth: 0, water: 0, drySeconds: 0, birdDamage: 0 };
}

export function planterProgress(planter: SavedPlanterState): number {
  return planter.phase === 'mature' ? 1 : planter.phase === 'empty' || planter.phase === 'withered' ? 0 : clamp01(planter.growth);
}

export function nextBirdVisitSeconds(visit: number): number {
  const stableVisit = Math.max(0, Math.floor(Number.isFinite(visit) ? visit : 0));
  return 28 + ((stableVisit * 17 + 5) % 13);
}

export function createDefaultPlantingState(): SavedPlantingState {
  return {
    planters: [],
    birdClock: 0,
    birdVisit: 0,
    birdPhase: 'absent',
    birdElapsed: 0,
    birdTargetId: null,
  };
}

export function sanitizePlanterState(value: unknown): SavedPlanterState | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<SavedPlanterState>;
  const x = Math.round(finite(candidate.x));
  const z = Math.round(finite(candidate.z));
  const validPhases = new Set<PlanterPhase>(['empty', 'sown', 'growing', 'dry', 'mature', 'withered']);
  const phase = candidate.phase && validPhases.has(candidate.phase) ? candidate.phase : 'empty';
  const growth = phase === 'mature' ? 1 : phase === 'empty' ? 0 : clamp01(finite(candidate.growth));
  const water = phase === 'growing' ? clamp01(finite(candidate.water)) : 0;
  const drySeconds = phase === 'dry' ? Math.max(0, Math.min(PLANT_DRY_GRACE_SECONDS, finite(candidate.drySeconds))) : 0;
  const birdDamage = phase === 'empty' || phase === 'withered'
    ? 0
    : Math.max(0, Math.min(PLANT_MAX_BIRD_DAMAGE, finite(candidate.birdDamage)));
  return {
    id: typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id.slice(0, 80) : `planter-${x}-${z}`,
    x,
    z,
    rotation: normalizeRotation(finite(candidate.rotation)),
    phase,
    growth,
    water,
    drySeconds,
    birdDamage,
  };
}

export function sanitizePlantingState(value: unknown): SavedPlantingState {
  if (!value || typeof value !== 'object') return createDefaultPlantingState();
  const candidate = value as Partial<SavedPlantingState>;
  const ids = new Set<string>();
  const coordinates = new Set<string>();
  const planters: SavedPlanterState[] = [];
  for (const raw of Array.isArray(candidate.planters) ? candidate.planters : []) {
    const planter = sanitizePlanterState(raw);
    if (!planter || Math.abs(planter.x) > 12 || Math.abs(planter.z) > 12) continue;
    const coordinate = `${planter.x}:${planter.z}`;
    if (ids.has(planter.id) || coordinates.has(coordinate) || planters.length >= MAX_PLANTERS) continue;
    ids.add(planter.id);
    coordinates.add(coordinate);
    planters.push(planter);
  }
  const validBirdPhases = new Set<CropBirdPhase>(['absent', 'circling', 'diving', 'feeding', 'fleeing']);
  const requestedBirdPhase = candidate.birdPhase && validBirdPhases.has(candidate.birdPhase)
    ? candidate.birdPhase
    : 'absent';
  const requestedTargetId = typeof candidate.birdTargetId === 'string' ? candidate.birdTargetId.slice(0, 80) : null;
  const birdTargetId = requestedTargetId && planters.some(
    (planter) =>
      planter.id === requestedTargetId &&
      planter.growth >= 0.45 &&
      (planter.phase === 'growing' || planter.phase === 'dry' || planter.phase === 'mature'),
  )
    ? requestedTargetId
    : null;
  const birdPhase = requestedBirdPhase !== 'absent' && birdTargetId ? requestedBirdPhase : 'absent';
  return {
    planters,
    birdClock: Math.max(0, Math.min(3600, finite(candidate.birdClock))),
    birdVisit: Math.max(0, Math.min(100000, Math.floor(finite(candidate.birdVisit)))),
    birdPhase,
    birdElapsed: birdPhase === 'absent' ? 0 : Math.max(0, Math.min(60, finite(candidate.birdElapsed))),
    birdTargetId: birdPhase === 'absent' ? null : birdTargetId,
  };
}
