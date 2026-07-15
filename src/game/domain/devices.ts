import type { ItemBundle, ItemId } from './items';

export type DeviceType = 'purifier' | 'grill';
export type DevicePhase = 'idle' | 'working' | 'ready' | 'burnt';
export type DeviceEvent = 'none' | 'ready' | 'burnt';
export const MAX_RAFT_DEVICES = 16;

export interface SavedDeviceState {
  id: string;
  type: DeviceType;
  x: number;
  z: number;
  rotation: number;
  phase: DevicePhase;
  elapsed: number;
}

export interface DeviceDefinition {
  type: DeviceType;
  name: string;
  kitItem: Extract<ItemId, 'purifierKit' | 'grillKit'>;
  input: ItemBundle;
  output: ItemBundle;
  burntOutput?: ItemBundle;
  duration: number;
  readyWindow?: number;
}

export const DEVICE_DEFINITIONS: Record<DeviceType, DeviceDefinition> = {
  purifier: {
    type: 'purifier',
    name: '潮汐净水器',
    kitItem: 'purifierKit',
    input: { emptyCup: 1, timber: 1 },
    output: { freshWaterCup: 1 },
    duration: 18,
  },
  grill: {
    type: 'grill',
    name: '折铁烤架',
    kitItem: 'grillKit',
    input: { rawFish: 1, timber: 1 },
    output: { cookedFish: 1 },
    burntOutput: { burntFish: 1 },
    duration: 16,
    readyWindow: 24,
  },
};

export function deviceKey(x: number, z: number): string {
  return `${Math.round(x)}:${Math.round(z)}`;
}

export function createDeviceState(
  type: DeviceType,
  x: number,
  z: number,
  rotation = 0,
  id = `${type}-${Date.now().toString(36)}`,
): SavedDeviceState {
  return {
    id,
    type,
    x: Math.round(x),
    z: Math.round(z),
    rotation: normalizeRotation(rotation),
    phase: 'idle',
    elapsed: 0,
  };
}

export function normalizeRotation(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const quarterTurns = Math.round(value / (Math.PI / 2));
  return ((quarterTurns % 4) + 4) % 4 * (Math.PI / 2);
}

export function startDeviceCycle(device: SavedDeviceState): SavedDeviceState {
  if (device.phase !== 'idle') return device;
  return { ...device, phase: 'working', elapsed: 0 };
}

export function collectDeviceOutput(device: SavedDeviceState): SavedDeviceState {
  if (device.phase !== 'ready' && device.phase !== 'burnt') return device;
  return { ...device, phase: 'idle', elapsed: 0 };
}

export function advanceDeviceState(
  device: SavedDeviceState,
  seconds: number,
): { device: SavedDeviceState; event: DeviceEvent } {
  if ((device.phase !== 'working' && device.phase !== 'ready') || seconds <= 0 || !Number.isFinite(seconds)) {
    return { device, event: 'none' };
  }
  const definition = DEVICE_DEFINITIONS[device.type];
  if (device.type === 'purifier' && device.phase === 'ready') return { device, event: 'none' };
  const elapsed = Math.max(0, device.elapsed + seconds);
  const burnAt = definition.duration + (definition.readyWindow ?? Number.POSITIVE_INFINITY);
  if (elapsed >= burnAt) {
    return { device: { ...device, phase: 'burnt', elapsed: burnAt }, event: 'burnt' };
  }
  if (elapsed >= definition.duration) {
    return {
      device: { ...device, phase: 'ready', elapsed },
      event: device.phase === 'working' ? 'ready' : 'none',
    };
  }
  return { device: { ...device, phase: 'working', elapsed }, event: 'none' };
}

export function deviceProgress(device: SavedDeviceState): number {
  if (device.phase === 'idle') return 0;
  return Math.max(0, Math.min(1, device.elapsed / DEVICE_DEFINITIONS[device.type].duration));
}

export function remainingDeviceSeconds(device: SavedDeviceState): number {
  if (device.phase !== 'working') return 0;
  return Math.max(0, Math.ceil(DEVICE_DEFINITIONS[device.type].duration - device.elapsed));
}

export function deviceOutput(device: SavedDeviceState): ItemBundle {
  const definition = DEVICE_DEFINITIONS[device.type];
  return device.phase === 'burnt' ? definition.burntOutput ?? {} : definition.output;
}

export function sanitizeSavedDevice(value: unknown): SavedDeviceState | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<SavedDeviceState>;
  if (candidate.type !== 'purifier' && candidate.type !== 'grill') return null;
  const phase: DevicePhase =
    candidate.phase === 'working' || candidate.phase === 'ready' || candidate.phase === 'burnt' ? candidate.phase : 'idle';
  if (candidate.type === 'purifier' && phase === 'burnt') return null;
  const definition = DEVICE_DEFINITIONS[candidate.type];
  const maxElapsed = definition.duration + (definition.readyWindow ?? 0);
  const rawElapsed = typeof candidate.elapsed === 'number' && Number.isFinite(candidate.elapsed) ? candidate.elapsed : 0;
  const elapsed =
    phase === 'idle'
      ? 0
      : phase === 'burnt'
        ? maxElapsed
        : phase === 'ready'
          ? Math.max(definition.duration, Math.min(maxElapsed, rawElapsed))
          : Math.max(0, Math.min(definition.duration - 0.001, rawElapsed));
  const x = typeof candidate.x === 'number' && Number.isFinite(candidate.x) ? Math.round(candidate.x) : 0;
  const z = typeof candidate.z === 'number' && Number.isFinite(candidate.z) ? Math.round(candidate.z) : 0;
  const fallbackId = `${candidate.type}-${x}-${z}`;
  return {
    id: typeof candidate.id === 'string' && candidate.id.trim().length > 0 ? candidate.id.slice(0, 80) : fallbackId,
    type: candidate.type,
    x,
    z,
    rotation: normalizeRotation(candidate.rotation ?? 0),
    phase,
    elapsed,
  };
}
