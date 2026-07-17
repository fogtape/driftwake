import type { ItemId } from './items';

export type NavigationDeviceType = 'sail' | 'anchor' | 'helm';
export type NavigationRouteMode = 'manual' | 'island' | 'shelter';
export type NavigationWeatherPhase = 'calm' | 'building' | 'storm' | 'clearing';

export interface SavedNavigationDevice {
  id: string;
  type: NavigationDeviceType;
  x: number;
  z: number;
  rotation: number;
  deployed: boolean;
  reinforced: boolean;
}

export interface SavedNavigationState {
  windClock: number;
  weatherClock: number;
  courseAngle: number;
  heading: number;
  routeMode: NavigationRouteMode;
  sailStrain: number;
  devices: SavedNavigationDevice[];
}

export interface NavigationMetrics {
  windAngle: number;
  effectiveCourse: number;
  windCapture: number;
  courseAlignment: number;
  sailDrive: number;
  approachRate: number;
  dockDriftRate: number;
  speedKnots: number;
  anchored: boolean;
  sailDeployed: boolean;
  helmInstalled: boolean;
  sailReinforced: boolean;
  sailStrain: number;
  routeMode: NavigationRouteMode;
  weatherPhase: NavigationWeatherPhase;
  stormIntensity: number;
  gust: number;
}

export interface NavigationWeather {
  phase: NavigationWeatherPhase;
  intensity: number;
  gust: number;
  gustAngle: number;
}

export interface NavigationDeviceDefinition {
  type: NavigationDeviceType;
  name: string;
  kitItem: Extract<ItemId, 'sailKit' | 'anchorKit' | 'helmKit'>;
}

export const NAVIGATION_DEVICE_DEFINITIONS: Record<NavigationDeviceType, NavigationDeviceDefinition> = {
  sail: { type: 'sail', name: '拾风帆', kitItem: 'sailKit' },
  anchor: { type: 'anchor', name: '潮石锚', kitItem: 'anchorKit' },
  helm: { type: 'helm', name: '定潮舵台', kitItem: 'helmKit' },
};

export const BASE_CURRENT_APPROACH_RATE = 0.55;
export const MAX_SAIL_APPROACH_BONUS = 1.05;
export const COURSE_STEP = Math.PI / 8;
export const WEATHER_CYCLE_SECONDS = 210;
export const WEATHER_BUILD_START = 92;
export const WEATHER_STORM_START = 122;
export const WEATHER_CLEAR_START = 174;

const ROUTE_MODES: readonly NavigationRouteMode[] = ['manual', 'island', 'shelter'];

export function normalizeAngle(value: number): number {
  if (!Number.isFinite(value)) return 0;
  let angle = value % (Math.PI * 2);
  if (angle <= -Math.PI) angle += Math.PI * 2;
  if (angle > Math.PI) angle -= Math.PI * 2;
  return angle;
}

export function shortestAngle(from: number, to: number): number {
  return normalizeAngle(to - from);
}

export function windAngleAt(clock: number): number {
  const stableClock = Math.max(0, Number.isFinite(clock) ? clock : 0);
  return normalizeAngle(
    0.92 + Math.sin(stableClock * 0.021) * 0.34 + Math.sin(stableClock * 0.007 + 1.1) * 0.18,
  );
}

function smoothUnit(value: number): number {
  const stable = Math.max(0, Math.min(1, value));
  return stable * stable * (3 - 2 * stable);
}

export function navigationWeatherAt(clock: number): NavigationWeather {
  const stableClock = Math.max(0, Number.isFinite(clock) ? clock : 0);
  const cycle = stableClock % WEATHER_CYCLE_SECONDS;
  let phase: NavigationWeatherPhase = 'calm';
  let intensity = 0;
  if (cycle >= WEATHER_BUILD_START && cycle < WEATHER_STORM_START) {
    phase = 'building';
    intensity = smoothUnit((cycle - WEATHER_BUILD_START) / (WEATHER_STORM_START - WEATHER_BUILD_START));
  } else if (cycle >= WEATHER_STORM_START && cycle < WEATHER_CLEAR_START) {
    phase = 'storm';
    intensity = 1;
  } else if (cycle >= WEATHER_CLEAR_START) {
    phase = 'clearing';
    intensity = 1 - smoothUnit((cycle - WEATHER_CLEAR_START) / (WEATHER_CYCLE_SECONDS - WEATHER_CLEAR_START));
  }
  const gust = Math.max(-1, Math.min(1, Math.sin(stableClock * 2.37) * 0.64 + Math.sin(stableClock * 0.71 + 1.8) * 0.36));
  return {
    phase,
    intensity,
    gust,
    gustAngle: normalizeAngle(windAngleAt(stableClock) + gust * (0.28 + intensity * 0.32)),
  };
}

export function bearingTo(x: number, z: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(z) || Math.hypot(x, z) < 0.001) return 0;
  return normalizeAngle(Math.atan2(x, -z));
}

export function cardinalLabel(angle: number): string {
  const labels = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
  const normalized = ((normalizeAngle(angle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const index = Math.floor(normalized / (Math.PI / 4) + 0.5 + 1e-9) % labels.length;
  return labels[index];
}

export function createDefaultNavigationState(): SavedNavigationState {
  return {
    windClock: 0,
    weatherClock: 0,
    courseAngle: 0,
    heading: 0,
    routeMode: 'manual',
    sailStrain: 0,
    devices: [],
  };
}

export function createNavigationDevice(
  type: NavigationDeviceType,
  x: number,
  z: number,
  rotation = 0,
  id = `${type}-${Date.now().toString(36)}`,
): SavedNavigationDevice {
  return {
    id,
    type,
    x: Math.round(Number.isFinite(x) ? x : 0),
    z: Math.round(Number.isFinite(z) ? z : 0),
    rotation: normalizeQuarterTurn(rotation),
    deployed: false,
    reinforced: false,
  };
}

export function sanitizeNavigationDevice(value: unknown): SavedNavigationDevice | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<SavedNavigationDevice>;
  if (candidate.type !== 'sail' && candidate.type !== 'anchor' && candidate.type !== 'helm') return null;
  const x = typeof candidate.x === 'number' && Number.isFinite(candidate.x) ? Math.round(candidate.x) : 0;
  const z = typeof candidate.z === 'number' && Number.isFinite(candidate.z) ? Math.round(candidate.z) : 0;
  const fallbackId = `${candidate.type}-${x}-${z}`;
  return {
    id: typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id.slice(0, 80) : fallbackId,
    type: candidate.type,
    x,
    z,
    rotation: normalizeQuarterTurn(candidate.rotation ?? 0),
    deployed: candidate.type !== 'helm' && candidate.deployed === true,
    reinforced: candidate.type === 'sail' && candidate.reinforced === true,
  };
}

export function sanitizeNavigationState(value: unknown): SavedNavigationState {
  const fallback = createDefaultNavigationState();
  if (!value || typeof value !== 'object') return fallback;
  const candidate = value as Partial<SavedNavigationState>;
  const devices: SavedNavigationDevice[] = [];
  const types = new Set<NavigationDeviceType>();
  const ids = new Set<string>();
  for (const rawDevice of Array.isArray(candidate.devices) ? candidate.devices : []) {
    const device = sanitizeNavigationDevice(rawDevice);
    if (!device || types.has(device.type) || ids.has(device.id) || devices.length >= 3) continue;
    types.add(device.type);
    ids.add(device.id);
    devices.push(device);
  }
  const requestedRoute = ROUTE_MODES.includes(candidate.routeMode as NavigationRouteMode)
    ? candidate.routeMode as NavigationRouteMode
    : 'manual';
  return {
    windClock:
      typeof candidate.windClock === 'number' && Number.isFinite(candidate.windClock)
        ? Math.max(0, Math.min(86400, candidate.windClock))
        : 0,
    weatherClock:
      typeof candidate.weatherClock === 'number' && Number.isFinite(candidate.weatherClock)
        ? Math.max(0, Math.min(86400, candidate.weatherClock))
        : 0,
    courseAngle: normalizeAngle(candidate.courseAngle ?? 0),
    heading: normalizeAngle(candidate.heading ?? candidate.courseAngle ?? 0),
    routeMode: devices.some((device) => device.type === 'helm') ? requestedRoute : 'manual',
    sailStrain:
      typeof candidate.sailStrain === 'number' && Number.isFinite(candidate.sailStrain)
        ? Math.max(0, Math.min(1, candidate.sailStrain))
        : 0,
    devices,
  };
}

export function navigationRouteCourse(
  state: SavedNavigationState,
  targetBearing = 0,
): number {
  if (state.routeMode === 'island') return normalizeAngle(targetBearing);
  if (state.routeMode === 'shelter') {
    const wind = windAngleAt(state.windClock);
    return normalizeAngle(wind + shortestAngle(wind, targetBearing) * 0.42);
  }
  return normalizeAngle(state.courseAngle);
}

export function cycleNavigationRoute(mode: NavigationRouteMode): NavigationRouteMode {
  const index = ROUTE_MODES.indexOf(mode);
  return ROUTE_MODES[(index + 1) % ROUTE_MODES.length];
}

export function reinforceNavigationSail(state: SavedNavigationState): SavedNavigationState {
  if (!state.devices.some((device) => device.type === 'sail' && !device.reinforced)) return state;
  return {
    ...state,
    sailStrain: Math.min(state.sailStrain, 0.35),
    devices: state.devices.map((device) => device.type === 'sail' ? { ...device, reinforced: true } : device),
  };
}

export function advanceNavigationState(
  state: SavedNavigationState,
  seconds: number,
  targetBearing = 0,
): SavedNavigationState {
  const delta = Math.max(0, Math.min(Number.isFinite(seconds) ? seconds : 0, 5));
  if (delta <= 0) return state;
  const sailDeployed = state.devices.some((device) => device.type === 'sail' && device.deployed);
  const sailReinforced = state.devices.some((device) => device.type === 'sail' && device.reinforced);
  const helmInstalled = state.devices.some((device) => device.type === 'helm');
  const weather = navigationWeatherAt(state.weatherClock);
  const effectiveCourse = navigationRouteCourse(state, targetBearing);
  const maxTurn = (helmInstalled ? 0.46 : sailDeployed ? 0.3 : 0.055) * delta;
  const turn = Math.max(-maxTurn, Math.min(maxTurn, shortestAngle(state.heading, effectiveCourse)));
  const routeStability = state.routeMode === 'shelter' ? 0.42 : 1;
  const helmStability = helmInstalled ? 0.28 : 1;
  const rigStability = sailReinforced ? 0.48 : 1;
  const stormDrift = weather.gust * weather.intensity * 0.19 * routeStability * helmStability * rigStability * delta;
  const strainGain = sailDeployed
    ? weather.intensity * delta * (sailReinforced ? 0.004 : 0.026) * (state.routeMode === 'shelter' ? 0.48 : 1)
    : 0;
  const recovery = sailDeployed ? 0 : delta * 0.018;
  let sailStrain = Math.max(0, Math.min(1, state.sailStrain + strainGain - recovery));
  let devices = state.devices;
  if (sailDeployed && !sailReinforced && sailStrain >= 1) {
    devices = state.devices.map((device) => device.type === 'sail' ? { ...device, deployed: false } : device);
    sailStrain = 0.74;
  }
  return {
    ...state,
    windClock: state.windClock + delta,
    weatherClock: state.weatherClock + delta,
    courseAngle: effectiveCourse,
    heading: normalizeAngle(state.heading + turn + stormDrift),
    sailStrain,
    devices,
  };
}

export function navigationMetrics(state: SavedNavigationState, targetBearing = 0): NavigationMetrics {
  const sailDeployed = state.devices.some((device) => device.type === 'sail' && device.deployed);
  const anchored = state.devices.some((device) => device.type === 'anchor' && device.deployed);
  const helmInstalled = state.devices.some((device) => device.type === 'helm');
  const sailReinforced = state.devices.some((device) => device.type === 'sail' && device.reinforced);
  const windAngle = windAngleAt(state.windClock);
  const effectiveCourse = navigationRouteCourse(state, targetBearing);
  const weather = navigationWeatherAt(state.weatherClock);
  const windAlignment = (Math.cos(shortestAngle(effectiveCourse, windAngle)) + 1) * 0.5;
  const windCapture = 0.18 + Math.pow(windAlignment, 0.72) * 0.82;
  const courseAlignment = Math.max(0, Math.cos(shortestAngle(effectiveCourse, targetBearing)));
  const weatherDrive = 1 - weather.intensity * (state.routeMode === 'shelter' ? 0.1 : sailReinforced ? 0.2 : 0.36);
  const sailDrive = sailDeployed ? windCapture * courseAlignment * weatherDrive : 0;
  return {
    windAngle,
    effectiveCourse,
    windCapture,
    courseAlignment,
    sailDrive,
    approachRate: anchored ? 0 : BASE_CURRENT_APPROACH_RATE + sailDrive * MAX_SAIL_APPROACH_BONUS,
    dockDriftRate: anchored ? 0 : 1 + sailDrive * 0.65 + weather.intensity * 0.24,
    speedKnots: anchored ? 0 : 0.42 + sailDrive * 1.68 + Math.max(0, weather.gust) * weather.intensity * 0.16,
    anchored,
    sailDeployed,
    helmInstalled,
    sailReinforced,
    sailStrain: state.sailStrain,
    routeMode: state.routeMode,
    weatherPhase: weather.phase,
    stormIntensity: weather.intensity,
    gust: weather.gust,
  };
}

function normalizeQuarterTurn(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const turns = Math.round(value / (Math.PI / 2));
  return ((turns % 4) + 4) % 4 * (Math.PI / 2);
}
