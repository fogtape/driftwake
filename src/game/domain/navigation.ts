import type { ItemId } from './items';

export type NavigationDeviceType = 'sail' | 'anchor' | 'helm' | 'receiver' | 'antenna';
export type NavigationRouteMode = 'manual' | 'island' | 'shelter' | 'signal';
export type NavigationWeatherPhase = 'calm' | 'building' | 'storm' | 'clearing';
export type SignalArrayStatus = 'ready' | 'missing-receiver' | 'missing-antenna' | 'too-close' | 'too-far';
export type SignalTargetId = 'tideRelay' | 'ironChoir' | 'stormNeedle';

export interface SignalTargetDefinition {
  id: SignalTargetId;
  name: string;
  frequency: string;
  offsetX: number;
  offsetZ: number;
  summary: string;
  unlock: string;
}

export const SIGNAL_TARGET_ORDER: readonly SignalTargetId[] = ['tideRelay', 'ironChoir', 'stormNeedle'];
export const SIGNAL_TARGETS: Record<SignalTargetId, SignalTargetDefinition> = {
  tideRelay: {
    id: 'tideRelay',
    name: '潮痕中继站',
    frequency: '73.14',
    offsetX: 72,
    offsetZ: -138,
    summary: '三联浮舱托起旧式转子，仍在向西南折射低频潮汐脉冲。',
    unlock: '抵达后解码铁歌漂流阵',
  },
  ironChoir: {
    id: 'ironChoir',
    name: '铁歌漂流阵',
    frequency: '41.82',
    offsetX: -236,
    offsetZ: -326,
    summary: '海风驱动五组谐振铜腔，用长周期金属回声记录洋流偏移。',
    unlock: '抵达后解码风针观测标',
  },
  stormNeedle: {
    id: 'stormNeedle',
    name: '风针观测标',
    frequency: '89.06',
    offsetX: 382,
    offsetZ: -74,
    summary: '高空风笼与电驻陶瓷沿塔身排列，持续记录飑线转折与雷暴电势。',
    unlock: '抵达后完成远海信号链',
  },
};

export const RECEIVER_CELL_SECONDS = 360;
export const SIGNAL_ARRAY_MIN_TILES = 2;
export const SIGNAL_ARRAY_MAX_TILES = 6;
export const SIGNAL_REACH_METERS = 18;
export const SIGNAL_DESTINATION_VISIBILITY_METERS = 360;

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
  anchorStrain: number;
  worldX: number;
  worldZ: number;
  receiverOn: boolean;
  receiverCharge: number;
  activeSignal: SignalTargetId;
  signalOriginX: number | null;
  signalOriginZ: number | null;
  discoveredSignals: SignalTargetId[];
  visitedSignals: SignalTargetId[];
  devices: SavedNavigationDevice[];
}

export interface SignalTelemetry {
  arrayStatus: SignalArrayStatus;
  online: boolean;
  targetId: SignalTargetId | null;
  targetName: string | null;
  frequency: string | null;
  distance: number | null;
  bearing: number | null;
  targetX: number | null;
  targetZ: number | null;
  discovered: number;
  visited: number;
}

export interface SignalChartTarget {
  id: SignalTargetId;
  name: string | null;
  frequency: string | null;
  summary: string | null;
  unlock: string | null;
  discovered: boolean;
  visited: boolean;
  active: boolean;
  worldX: number | null;
  worldZ: number | null;
  distance: number | null;
  bearing: number | null;
}

export interface SignalChartTelemetry {
  originX: number | null;
  originZ: number | null;
  raftX: number;
  raftZ: number;
  targets: SignalChartTarget[];
  complete: boolean;
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
  anchorReinforced: boolean;
  sailStrain: number;
  anchorStrain: number;
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
  kitItem: Extract<ItemId, 'sailKit' | 'anchorKit' | 'helmKit' | 'receiverKit' | 'antennaKit'>;
}

export const NAVIGATION_DEVICE_DEFINITIONS: Record<NavigationDeviceType, NavigationDeviceDefinition> = {
  sail: { type: 'sail', name: '拾风帆', kitItem: 'sailKit' },
  anchor: { type: 'anchor', name: '潮石锚', kitItem: 'anchorKit' },
  helm: { type: 'helm', name: '定潮舵台', kitItem: 'helmKit' },
  receiver: { type: 'receiver', name: '潮听接收台', kitItem: 'receiverKit' },
  antenna: { type: 'antenna', name: '双桅定向阵列', kitItem: 'antennaKit' },
};

export const BASE_CURRENT_APPROACH_RATE = 0.55;
export const MAX_SAIL_APPROACH_BONUS = 1.05;
export const COURSE_STEP = Math.PI / 8;
export const WEATHER_CYCLE_SECONDS = 210;
export const WEATHER_BUILD_START = 92;
export const WEATHER_STORM_START = 122;
export const WEATHER_CLEAR_START = 174;

const ROUTE_MODES: readonly NavigationRouteMode[] = ['manual', 'island', 'shelter', 'signal'];
const SIGNAL_TARGET_SET = new Set<string>(SIGNAL_TARGET_ORDER);

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

export function isSignalTargetId(value: unknown): value is SignalTargetId {
  return typeof value === 'string' && SIGNAL_TARGET_SET.has(value);
}

export function signalArrayStatus(state: Pick<SavedNavigationState, 'devices'>): SignalArrayStatus {
  const receiver = state.devices.find((device) => device.type === 'receiver');
  if (!receiver) return 'missing-receiver';
  const antenna = state.devices.find((device) => device.type === 'antenna');
  if (!antenna) return 'missing-antenna';
  const distance = Math.hypot(receiver.x - antenna.x, receiver.z - antenna.z);
  if (distance < SIGNAL_ARRAY_MIN_TILES) return 'too-close';
  if (distance > SIGNAL_ARRAY_MAX_TILES) return 'too-far';
  return 'ready';
}

export function signalWorldPosition(
  state: Pick<SavedNavigationState, 'signalOriginX' | 'signalOriginZ'>,
  targetId: SignalTargetId,
): { x: number; z: number } | null {
  if (state.signalOriginX === null || state.signalOriginZ === null) return null;
  const target = SIGNAL_TARGETS[targetId];
  return { x: state.signalOriginX + target.offsetX, z: state.signalOriginZ + target.offsetZ };
}

export function signalChartTelemetry(state: SavedNavigationState): SignalChartTelemetry {
  return {
    originX: state.signalOriginX,
    originZ: state.signalOriginZ,
    raftX: state.worldX,
    raftZ: state.worldZ,
    targets: SIGNAL_TARGET_ORDER.map((id) => {
      const definition = SIGNAL_TARGETS[id];
      const discovered = state.discoveredSignals.includes(id);
      const position = discovered ? signalWorldPosition(state, id) : null;
      const deltaX = position ? position.x - state.worldX : 0;
      const deltaZ = position ? position.z - state.worldZ : 0;
      return {
        id,
        name: discovered ? definition.name : null,
        frequency: discovered ? definition.frequency : null,
        summary: discovered ? definition.summary : null,
        unlock: discovered ? definition.unlock : null,
        discovered,
        visited: state.visitedSignals.includes(id),
        active: discovered && state.activeSignal === id,
        worldX: position?.x ?? null,
        worldZ: position?.z ?? null,
        distance: position ? Math.hypot(deltaX, deltaZ) : null,
        bearing: position ? bearingTo(deltaX, deltaZ) : null,
      };
    }),
    complete: SIGNAL_TARGET_ORDER.every((id) => state.visitedSignals.includes(id)),
  };
}

export function signalTelemetry(state: SavedNavigationState): SignalTelemetry {
  const arrayStatus = signalArrayStatus(state);
  const targetId = state.discoveredSignals.includes(state.activeSignal) ? state.activeSignal : null;
  const position = targetId ? signalWorldPosition(state, targetId) : null;
  const target = targetId ? SIGNAL_TARGETS[targetId] : null;
  const deltaX = position ? position.x - state.worldX : 0;
  const deltaZ = position ? position.z - state.worldZ : 0;
  return {
    arrayStatus,
    online: state.receiverOn && state.receiverCharge > 0 && arrayStatus === 'ready',
    targetId,
    targetName: target?.name ?? null,
    frequency: target?.frequency ?? null,
    distance: position ? Math.hypot(deltaX, deltaZ) : null,
    bearing: position ? bearingTo(deltaX, deltaZ) : null,
    targetX: position?.x ?? null,
    targetZ: position?.z ?? null,
    discovered: state.discoveredSignals.length,
    visited: state.visitedSignals.length,
  };
}

function initializeSignalOrigin(state: SavedNavigationState): SavedNavigationState {
  if (state.signalOriginX !== null && state.signalOriginZ !== null && state.discoveredSignals.length > 0) return state;
  return {
    ...state,
    activeSignal: 'tideRelay',
    signalOriginX: state.worldX,
    signalOriginZ: state.worldZ,
    discoveredSignals: state.discoveredSignals.length > 0 ? state.discoveredSignals : ['tideRelay'],
  };
}

export function installReceiverCell(state: SavedNavigationState): SavedNavigationState {
  if (!state.devices.some((device) => device.type === 'receiver') || state.receiverCharge > 0) return state;
  return { ...initializeSignalOrigin(state), receiverCharge: RECEIVER_CELL_SECONDS };
}

export function toggleReceiverPower(state: SavedNavigationState): SavedNavigationState {
  if (state.receiverOn) {
    return { ...state, receiverOn: false, routeMode: state.routeMode === 'signal' ? 'manual' : state.routeMode };
  }
  if (state.receiverCharge <= 0 || signalArrayStatus(state) !== 'ready') return state;
  return { ...initializeSignalOrigin(state), receiverOn: true };
}

export function cycleSignalTarget(state: SavedNavigationState, reverse = false): SavedNavigationState {
  if (state.discoveredSignals.length < 2) return state;
  const index = Math.max(0, state.discoveredSignals.indexOf(state.activeSignal));
  const direction = reverse ? -1 : 1;
  const next = (index + direction + state.discoveredSignals.length) % state.discoveredSignals.length;
  return { ...state, activeSignal: state.discoveredSignals[next] };
}

export function selectSignalTarget(state: SavedNavigationState, targetId: SignalTargetId): SavedNavigationState {
  if (!state.discoveredSignals.includes(targetId)) return state;
  if (state.activeSignal === targetId && state.routeMode === 'signal') return state;
  return { ...state, activeSignal: targetId, routeMode: 'signal' };
}

export function createDefaultNavigationState(): SavedNavigationState {
  return {
    windClock: 0,
    weatherClock: 0,
    courseAngle: 0,
    heading: 0,
    routeMode: 'manual',
    sailStrain: 0,
    anchorStrain: 0,
    worldX: 0,
    worldZ: 0,
    receiverOn: false,
    receiverCharge: 0,
    activeSignal: 'tideRelay',
    signalOriginX: null,
    signalOriginZ: null,
    discoveredSignals: [],
    visitedSignals: [],
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
  if (
    candidate.type !== 'sail' &&
    candidate.type !== 'anchor' &&
    candidate.type !== 'helm' &&
    candidate.type !== 'receiver' &&
    candidate.type !== 'antenna'
  ) return null;
  const x = typeof candidate.x === 'number' && Number.isFinite(candidate.x) ? Math.round(candidate.x) : 0;
  const z = typeof candidate.z === 'number' && Number.isFinite(candidate.z) ? Math.round(candidate.z) : 0;
  const fallbackId = `${candidate.type}-${x}-${z}`;
  return {
    id: typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id.slice(0, 80) : fallbackId,
    type: candidate.type,
    x,
    z,
    rotation: normalizeQuarterTurn(candidate.rotation ?? 0),
    deployed: (candidate.type === 'sail' || candidate.type === 'anchor') && candidate.deployed === true,
    reinforced: (candidate.type === 'sail' || candidate.type === 'anchor') && candidate.reinforced === true,
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
    if (!device || types.has(device.type) || ids.has(device.id) || devices.length >= 5) continue;
    types.add(device.type);
    ids.add(device.id);
    devices.push(device);
  }
  const requestedRoute = ROUTE_MODES.includes(candidate.routeMode as NavigationRouteMode)
    ? candidate.routeMode as NavigationRouteMode
    : 'manual';
  const finiteWorld = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(-1_000_000, Math.min(1_000_000, value)) : 0;
  const worldX = finiteWorld(candidate.worldX);
  const worldZ = finiteWorld(candidate.worldZ);
  const originX = typeof candidate.signalOriginX === 'number' && Number.isFinite(candidate.signalOriginX)
    ? finiteWorld(candidate.signalOriginX)
    : null;
  const originZ = typeof candidate.signalOriginZ === 'number' && Number.isFinite(candidate.signalOriginZ)
    ? finiteWorld(candidate.signalOriginZ)
    : null;
  const hasOrigin = originX !== null && originZ !== null;
  const rawDiscovered = new Set(
    hasOrigin && Array.isArray(candidate.discoveredSignals)
      ? candidate.discoveredSignals.filter(isSignalTargetId)
      : [],
  );
  const discoveredPrefix: SignalTargetId[] = [];
  for (const id of SIGNAL_TARGET_ORDER) {
    if (!rawDiscovered.has(id)) break;
    discoveredPrefix.push(id);
  }
  const rawVisited = new Set(
    Array.isArray(candidate.visitedSignals)
      ? candidate.visitedSignals.filter(isSignalTargetId)
      : [],
  );
  const visitedSignals: SignalTargetId[] = [];
  for (const id of discoveredPrefix) {
    if (!rawVisited.has(id)) break;
    visitedSignals.push(id);
  }
  const discoveredSignals = discoveredPrefix.slice(0, visitedSignals.length + 1);
  const activeSignal = isSignalTargetId(candidate.activeSignal) && discoveredSignals.includes(candidate.activeSignal)
    ? candidate.activeSignal
    : discoveredSignals[0] ?? 'tideRelay';
  const receiverCharge = typeof candidate.receiverCharge === 'number' && Number.isFinite(candidate.receiverCharge)
    ? Math.max(0, Math.min(RECEIVER_CELL_SECONDS, candidate.receiverCharge))
    : 0;
  const provisional: SavedNavigationState = {
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
    anchorStrain:
      typeof candidate.anchorStrain === 'number' && Number.isFinite(candidate.anchorStrain)
        ? Math.max(0, Math.min(1, candidate.anchorStrain))
        : 0,
    worldX,
    worldZ,
    receiverOn: false,
    receiverCharge,
    activeSignal,
    signalOriginX: hasOrigin ? originX : null,
    signalOriginZ: hasOrigin ? originZ : null,
    discoveredSignals,
    visitedSignals,
    devices,
  };
  const receiverOn = candidate.receiverOn === true && receiverCharge > 0 && signalArrayStatus(provisional) === 'ready';
  return {
    ...provisional,
    routeMode: provisional.routeMode === 'signal' && !receiverOn ? 'manual' : provisional.routeMode,
    receiverOn,
  };
}

export function navigationRouteCourse(
  state: SavedNavigationState,
  targetBearing = 0,
): number {
  if (state.routeMode === 'island' || state.routeMode === 'signal') return normalizeAngle(targetBearing);
  if (state.routeMode === 'shelter') {
    const wind = windAngleAt(state.windClock);
    return normalizeAngle(wind + shortestAngle(wind, targetBearing) * 0.42);
  }
  return normalizeAngle(state.courseAngle);
}

export function cycleNavigationRoute(mode: NavigationRouteMode, signalAvailable = false): NavigationRouteMode {
  const modes = signalAvailable ? ROUTE_MODES : ROUTE_MODES.filter((candidate) => candidate !== 'signal');
  const index = modes.indexOf(mode);
  return modes[(Math.max(0, index) + 1) % modes.length];
}

export function reinforceNavigationSail(state: SavedNavigationState): SavedNavigationState {
  if (!state.devices.some((device) => device.type === 'sail' && !device.reinforced)) return state;
  return {
    ...state,
    sailStrain: Math.min(state.sailStrain, 0.35),
    devices: state.devices.map((device) => device.type === 'sail' ? { ...device, reinforced: true } : device),
  };
}

export function reinforceNavigationAnchor(state: SavedNavigationState): SavedNavigationState {
  if (!state.devices.some((device) => device.type === 'anchor' && !device.reinforced)) return state;
  return {
    ...state,
    anchorStrain: Math.min(state.anchorStrain, 0.22),
    devices: state.devices.map((device) => device.type === 'anchor' ? { ...device, reinforced: true } : device),
  };
}

export function advanceNavigationState(
  state: SavedNavigationState,
  seconds: number,
  targetBearing = 0,
): SavedNavigationState {
  const delta = Math.max(0, Math.min(Number.isFinite(seconds) ? seconds : 0, 5));
  if (delta <= 0) return state;
  const arrayReady = signalArrayStatus(state) === 'ready';
  const receiverCharge = Math.max(0, state.receiverCharge - (state.receiverOn && arrayReady ? delta : 0));
  const receiverOn = state.receiverOn && arrayReady && receiverCharge > 0;
  const workingState: SavedNavigationState = {
    ...state,
    receiverCharge,
    receiverOn,
    routeMode: state.routeMode === 'signal' && !receiverOn ? 'manual' : state.routeMode,
  };
  const sailDeployed = workingState.devices.some((device) => device.type === 'sail' && device.deployed);
  const sailReinforced = workingState.devices.some((device) => device.type === 'sail' && device.reinforced);
  const anchor = workingState.devices.find((device) => device.type === 'anchor');
  const helmInstalled = workingState.devices.some((device) => device.type === 'helm');
  const weather = navigationWeatherAt(workingState.weatherClock);
  const effectiveCourse = navigationRouteCourse(workingState, targetBearing);
  const maxTurn = (helmInstalled ? 0.46 : sailDeployed ? 0.3 : 0.055) * delta;
  const turn = Math.max(-maxTurn, Math.min(maxTurn, shortestAngle(workingState.heading, effectiveCourse)));
  const routeStability = workingState.routeMode === 'shelter' ? 0.42 : 1;
  const helmStability = helmInstalled ? 0.28 : 1;
  const rigStability = sailReinforced ? 0.48 : 1;
  const stormDrift = weather.gust * weather.intensity * 0.19 * routeStability * helmStability * rigStability * delta;
  const strainGain = sailDeployed
    ? weather.intensity * delta * (sailReinforced ? 0.004 : 0.026) * (workingState.routeMode === 'shelter' ? 0.48 : 1)
    : 0;
  const recovery = sailDeployed ? 0 : delta * 0.018;
  let sailStrain = Math.max(0, Math.min(1, workingState.sailStrain + strainGain - recovery));
  const anchorLoadGain = anchor?.deployed && !anchor.reinforced
    ? weather.intensity * (0.48 + Math.abs(weather.gust) * 0.72) * delta * 0.034
    : 0;
  const anchorRecovery = anchorLoadGain > 0 ? 0 : delta * (anchor?.reinforced ? 0.09 : 0.034);
  let anchorStrain = Math.max(0, Math.min(1, workingState.anchorStrain + anchorLoadGain - anchorRecovery));
  let devices = workingState.devices;
  if (sailDeployed && !sailReinforced && sailStrain >= 1) {
    devices = workingState.devices.map((device) => device.type === 'sail' ? { ...device, deployed: false } : device);
    sailStrain = 0.74;
  }
  if (anchor?.deployed && !anchor.reinforced && anchorStrain >= 1) {
    devices = devices.map((device) => device.type === 'anchor' ? { ...device, deployed: false } : device);
    anchorStrain = 0.7;
  }
  const heading = normalizeAngle(workingState.heading + turn + stormDrift);
  let next: SavedNavigationState = {
    ...workingState,
    windClock: workingState.windClock + delta,
    weatherClock: workingState.weatherClock + delta,
    courseAngle: effectiveCourse,
    heading,
    sailStrain,
    anchorStrain,
    devices,
  };
  const movement = navigationMetrics(next, targetBearing).speedKnots * 0.514444 * delta;
  next = {
    ...next,
    worldX: next.worldX + Math.sin(heading) * movement,
    worldZ: next.worldZ - Math.cos(heading) * movement,
  };
  const telemetry = signalTelemetry(next);
  if (
    telemetry.online &&
    telemetry.targetId &&
    telemetry.distance !== null &&
    telemetry.distance <= SIGNAL_REACH_METERS &&
    !next.visitedSignals.includes(telemetry.targetId)
  ) {
    const visitedSignals = [...next.visitedSignals, telemetry.targetId];
    const targetIndex = SIGNAL_TARGET_ORDER.indexOf(telemetry.targetId);
    const unlocked = SIGNAL_TARGET_ORDER[targetIndex + 1];
    next = {
      ...next,
      visitedSignals,
      discoveredSignals: unlocked && !next.discoveredSignals.includes(unlocked)
        ? [...next.discoveredSignals, unlocked]
        : next.discoveredSignals,
    };
  }
  return next;
}

export function navigationMetrics(state: SavedNavigationState, targetBearing = 0): NavigationMetrics {
  const sailDeployed = state.devices.some((device) => device.type === 'sail' && device.deployed);
  const anchored = state.devices.some((device) => device.type === 'anchor' && device.deployed);
  const helmInstalled = state.devices.some((device) => device.type === 'helm');
  const sailReinforced = state.devices.some((device) => device.type === 'sail' && device.reinforced);
  const anchorReinforced = state.devices.some((device) => device.type === 'anchor' && device.reinforced);
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
    anchorReinforced,
    sailStrain: state.sailStrain,
    anchorStrain: state.anchorStrain,
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
