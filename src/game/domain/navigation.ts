import type { ItemId } from './items';

export type NavigationDeviceType = 'sail' | 'anchor';

export interface SavedNavigationDevice {
  id: string;
  type: NavigationDeviceType;
  x: number;
  z: number;
  rotation: number;
  deployed: boolean;
}

export interface SavedNavigationState {
  windClock: number;
  courseAngle: number;
  heading: number;
  devices: SavedNavigationDevice[];
}

export interface NavigationMetrics {
  windAngle: number;
  windCapture: number;
  courseAlignment: number;
  sailDrive: number;
  approachRate: number;
  dockDriftRate: number;
  speedKnots: number;
  anchored: boolean;
  sailDeployed: boolean;
}

export interface NavigationDeviceDefinition {
  type: NavigationDeviceType;
  name: string;
  kitItem: Extract<ItemId, 'sailKit' | 'anchorKit'>;
}

export const NAVIGATION_DEVICE_DEFINITIONS: Record<NavigationDeviceType, NavigationDeviceDefinition> = {
  sail: { type: 'sail', name: '拾风帆', kitItem: 'sailKit' },
  anchor: { type: 'anchor', name: '潮石锚', kitItem: 'anchorKit' },
};

export const BASE_CURRENT_APPROACH_RATE = 0.55;
export const MAX_SAIL_APPROACH_BONUS = 1.05;
export const COURSE_STEP = Math.PI / 8;

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
  return { windClock: 0, courseAngle: 0, heading: 0, devices: [] };
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
  };
}

export function sanitizeNavigationDevice(value: unknown): SavedNavigationDevice | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<SavedNavigationDevice>;
  if (candidate.type !== 'sail' && candidate.type !== 'anchor') return null;
  const x = typeof candidate.x === 'number' && Number.isFinite(candidate.x) ? Math.round(candidate.x) : 0;
  const z = typeof candidate.z === 'number' && Number.isFinite(candidate.z) ? Math.round(candidate.z) : 0;
  const fallbackId = `${candidate.type}-${x}-${z}`;
  return {
    id: typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id.slice(0, 80) : fallbackId,
    type: candidate.type,
    x,
    z,
    rotation: normalizeQuarterTurn(candidate.rotation ?? 0),
    deployed: candidate.deployed === true,
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
    if (!device || types.has(device.type) || ids.has(device.id) || devices.length >= 2) continue;
    types.add(device.type);
    ids.add(device.id);
    devices.push(device);
  }
  return {
    windClock:
      typeof candidate.windClock === 'number' && Number.isFinite(candidate.windClock)
        ? Math.max(0, Math.min(86400, candidate.windClock))
        : 0,
    courseAngle: normalizeAngle(candidate.courseAngle ?? 0),
    heading: normalizeAngle(candidate.heading ?? candidate.courseAngle ?? 0),
    devices,
  };
}

export function advanceNavigationState(state: SavedNavigationState, seconds: number): SavedNavigationState {
  const delta = Math.max(0, Math.min(Number.isFinite(seconds) ? seconds : 0, 5));
  if (delta <= 0) return state;
  const sailDeployed = state.devices.some((device) => device.type === 'sail' && device.deployed);
  const maxTurn = (sailDeployed ? 0.3 : 0.055) * delta;
  const turn = Math.max(-maxTurn, Math.min(maxTurn, shortestAngle(state.heading, state.courseAngle)));
  return {
    ...state,
    windClock: state.windClock + delta,
    heading: normalizeAngle(state.heading + turn),
  };
}

export function navigationMetrics(state: SavedNavigationState, targetBearing = 0): NavigationMetrics {
  const sailDeployed = state.devices.some((device) => device.type === 'sail' && device.deployed);
  const anchored = state.devices.some((device) => device.type === 'anchor' && device.deployed);
  const windAngle = windAngleAt(state.windClock);
  const windAlignment = (Math.cos(shortestAngle(state.courseAngle, windAngle)) + 1) * 0.5;
  const windCapture = 0.18 + Math.pow(windAlignment, 0.72) * 0.82;
  const courseAlignment = Math.max(0, Math.cos(shortestAngle(state.courseAngle, targetBearing)));
  const sailDrive = sailDeployed ? windCapture * courseAlignment : 0;
  return {
    windAngle,
    windCapture,
    courseAlignment,
    sailDrive,
    approachRate: anchored ? 0 : BASE_CURRENT_APPROACH_RATE + sailDrive * MAX_SAIL_APPROACH_BONUS,
    dockDriftRate: anchored ? 0 : 1 + sailDrive * 0.65,
    speedKnots: anchored ? 0 : 0.42 + sailDrive * 1.68,
    anchored,
    sailDeployed,
  };
}

function normalizeQuarterTurn(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const turns = Math.round(value / (Math.PI / 2));
  return ((turns % 4) + 4) % 4 * (Math.PI / 2);
}
