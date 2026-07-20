import {
  addItems,
  normalizeInventory,
  type Inventory,
  type ItemBundle,
  type ItemId,
} from './items';

export type DeviceType = 'purifier' | 'grill' | 'solarPurifier' | 'tripleGrill' | 'locker';
export type DevicePhase = 'idle' | 'working' | 'ready' | 'burnt';
export type DeviceEvent = 'none' | 'ready' | 'burnt';
export type GrillSlotPhase = 'working' | 'ready' | 'burnt';

export const MAX_RAFT_DEVICES = 16;
export const SOLAR_PURIFIER_CAPACITY = 5;
export const TRIPLE_GRILL_CAPACITY = 3;
export const TRIPLE_GRILL_FUEL_SECONDS = 34;
export const TRIPLE_GRILL_MAX_FUEL_SECONDS = TRIPLE_GRILL_FUEL_SECONDS * 4;
export const LOCKER_SLOT_CAPACITY = 8;

export interface GrillSlotState {
  phase: GrillSlotPhase;
  elapsed: number;
}

export interface SavedDeviceState {
  id: string;
  type: DeviceType;
  x: number;
  z: number;
  rotation: number;
  phase: DevicePhase;
  elapsed: number;
  waterQueue: number[];
  freshWater: number;
  grillSlots: GrillSlotState[];
  fuelSeconds: number;
  storage: Inventory;
}

export interface DeviceDefinition {
  type: DeviceType;
  kind: 'cycle' | 'solar' | 'multi-grill' | 'storage';
  name: string;
  kitItem: Extract<ItemId, 'purifierKit' | 'grillKit' | 'solarPurifierKit' | 'tripleGrillKit' | 'lockerKit'>;
  input: ItemBundle;
  output: ItemBundle;
  burntOutput?: ItemBundle;
  duration: number;
  readyWindow?: number;
}

export const DEVICE_DEFINITIONS: Record<DeviceType, DeviceDefinition> = {
  purifier: {
    type: 'purifier',
    kind: 'cycle',
    name: '潮汐净水器',
    kitItem: 'purifierKit',
    input: { emptyCup: 1, timber: 1 },
    output: { freshWaterCup: 1 },
    duration: 18,
  },
  grill: {
    type: 'grill',
    kind: 'cycle',
    name: '折铁烤架',
    kitItem: 'grillKit',
    input: { rawFish: 1, timber: 1 },
    output: { cookedFish: 1 },
    burntOutput: { burntFish: 1 },
    duration: 16,
    readyWindow: 24,
  },
  solarPurifier: {
    type: 'solarPurifier',
    kind: 'solar',
    name: '潮镜五联净水器',
    kitItem: 'solarPurifierKit',
    input: { emptyCup: 1 },
    output: { freshWaterCup: 1 },
    duration: 26,
  },
  tripleGrill: {
    type: 'tripleGrill',
    kind: 'multi-grill',
    name: '三槽烟鳍烤台',
    kitItem: 'tripleGrillKit',
    input: { rawFish: 1 },
    output: { cookedFish: 1 },
    burntOutput: { burntFish: 1 },
    duration: 22,
    readyWindow: 34,
  },
  locker: {
    type: 'locker',
    kind: 'storage',
    name: '干舱储物柜',
    kitItem: 'lockerKit',
    input: {},
    output: {},
    duration: 1,
  },
};

const DEVICE_TYPES = new Set<DeviceType>(['purifier', 'grill', 'solarPurifier', 'tripleGrill', 'locker']);

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
    waterQueue: [],
    freshWater: 0,
    grillSlots: [],
    fuelSeconds: 0,
    storage: {},
  };
}

export function normalizeRotation(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const quarterTurns = Math.round(value / (Math.PI / 2));
  return ((quarterTurns % 4) + 4) % 4 * (Math.PI / 2);
}

export function startDeviceCycle(device: SavedDeviceState): SavedDeviceState {
  if (DEVICE_DEFINITIONS[device.type].kind !== 'cycle' || device.phase !== 'idle') return device;
  return { ...device, phase: 'working', elapsed: 0 };
}

export function collectDeviceOutput(device: SavedDeviceState): SavedDeviceState {
  if (DEVICE_DEFINITIONS[device.type].kind !== 'cycle') return device;
  if (device.phase !== 'ready' && device.phase !== 'burnt') return device;
  return { ...device, phase: 'idle', elapsed: 0 };
}

export function loadSolarPurifier(device: SavedDeviceState): SavedDeviceState {
  if (device.type !== 'solarPurifier' || device.waterQueue.length + device.freshWater >= SOLAR_PURIFIER_CAPACITY) {
    return device;
  }
  const waterQueue = [...device.waterQueue, 0];
  return { ...device, waterQueue, phase: device.freshWater > 0 ? 'ready' : 'working', elapsed: 0 };
}

export function collectSolarWater(device: SavedDeviceState): SavedDeviceState {
  if (device.type !== 'solarPurifier' || device.freshWater <= 0) return device;
  const freshWater = device.freshWater - 1;
  return {
    ...device,
    freshWater,
    phase: freshWater > 0 ? 'ready' : device.waterQueue.length > 0 ? 'working' : 'idle',
    elapsed: freshWater > 0 ? DEVICE_DEFINITIONS.solarPurifier.duration : Math.max(0, ...device.waterQueue),
  };
}

export function loadTripleGrill(device: SavedDeviceState): SavedDeviceState {
  if (device.type !== 'tripleGrill' || device.grillSlots.length >= TRIPLE_GRILL_CAPACITY) return device;
  const grillSlots = [...device.grillSlots, { phase: 'working' as const, elapsed: 0 }];
  return { ...device, grillSlots, phase: aggregateGrillPhase(grillSlots), elapsed: 0 };
}

export function fuelTripleGrill(device: SavedDeviceState, timber = 1): SavedDeviceState {
  if (device.type !== 'tripleGrill' || timber <= 0) return device;
  return {
    ...device,
    fuelSeconds: Math.min(TRIPLE_GRILL_MAX_FUEL_SECONDS, device.fuelSeconds + Math.floor(timber) * TRIPLE_GRILL_FUEL_SECONDS),
  };
}

export function collectTripleGrillOutput(
  device: SavedDeviceState,
): { device: SavedDeviceState; output: ItemBundle } {
  if (device.type !== 'tripleGrill') return { device, output: {} };
  const index = device.grillSlots.findIndex((slot) => slot.phase === 'ready');
  const fallbackIndex = index >= 0 ? index : device.grillSlots.findIndex((slot) => slot.phase === 'burnt');
  if (fallbackIndex < 0) return { device, output: {} };
  const slot = device.grillSlots[fallbackIndex];
  const grillSlots = device.grillSlots.filter((_, slotIndex) => slotIndex !== fallbackIndex);
  return {
    device: {
      ...device,
      grillSlots,
      phase: aggregateGrillPhase(grillSlots),
      elapsed: grillSlots.length > 0 ? Math.max(...grillSlots.map((candidate) => candidate.elapsed)) : 0,
    },
    output: slot.phase === 'burnt' ? { burntFish: 1 } : { cookedFish: 1 },
  };
}

export function tripleGrillCounts(device: SavedDeviceState): { working: number; ready: number; burnt: number } {
  if (device.type !== 'tripleGrill') return { working: 0, ready: 0, burnt: 0 };
  return device.grillSlots.reduce(
    (counts, slot) => ({ ...counts, [slot.phase]: counts[slot.phase] + 1 }),
    { working: 0, ready: 0, burnt: 0 },
  );
}

export function advanceDeviceState(
  device: SavedDeviceState,
  seconds: number,
): { device: SavedDeviceState; event: DeviceEvent } {
  if (seconds <= 0 || !Number.isFinite(seconds)) return { device, event: 'none' };
  if (device.type === 'solarPurifier') return advanceSolarPurifier(device, seconds);
  if (device.type === 'tripleGrill') return advanceTripleGrill(device, seconds);
  if (device.type === 'locker' || (device.phase !== 'working' && device.phase !== 'ready')) {
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

function advanceSolarPurifier(
  device: SavedDeviceState,
  seconds: number,
): { device: SavedDeviceState; event: DeviceEvent } {
  if (device.waterQueue.length === 0) return { device, event: 'none' };
  const duration = DEVICE_DEFINITIONS.solarPurifier.duration;
  const advanced = device.waterQueue.map((elapsed) => elapsed + seconds);
  const completed = advanced.filter((elapsed) => elapsed >= duration).length;
  const waterQueue = advanced.filter((elapsed) => elapsed < duration);
  const freshWater = Math.min(SOLAR_PURIFIER_CAPACITY, device.freshWater + completed);
  return {
    device: {
      ...device,
      waterQueue,
      freshWater,
      phase: freshWater > 0 ? 'ready' : waterQueue.length > 0 ? 'working' : 'idle',
      elapsed: freshWater > 0 ? duration : Math.max(0, ...waterQueue),
    },
    event: completed > 0 ? 'ready' : 'none',
  };
}

function advanceTripleGrill(
  device: SavedDeviceState,
  seconds: number,
): { device: SavedDeviceState; event: DeviceEvent } {
  if (device.grillSlots.length === 0 || device.fuelSeconds <= 0) return { device, event: 'none' };
  const definition = DEVICE_DEFINITIONS.tripleGrill;
  const burnAt = definition.duration + (definition.readyWindow ?? 0);
  const activeSlots = device.grillSlots.filter((slot) => slot.phase !== 'burnt');
  if (activeSlots.length === 0) return { device, event: 'none' };
  const usefulSeconds = Math.max(...activeSlots.map((slot) => Math.max(0, burnAt - slot.elapsed)));
  const activeSeconds = Math.min(seconds, device.fuelSeconds, usefulSeconds);
  let becameReady = false;
  let becameBurnt = false;
  const grillSlots = device.grillSlots.map((slot): GrillSlotState => {
    if (slot.phase === 'burnt') return slot;
    const elapsed = Math.min(burnAt, slot.elapsed + activeSeconds);
    if (elapsed >= burnAt) {
      becameBurnt = true;
      return { phase: 'burnt', elapsed };
    }
    if (elapsed >= definition.duration) {
      if (slot.phase === 'working') becameReady = true;
      return { phase: 'ready', elapsed };
    }
    return { phase: 'working', elapsed };
  });
  return {
    device: {
      ...device,
      grillSlots,
      fuelSeconds: Math.max(0, device.fuelSeconds - activeSeconds),
      phase: aggregateGrillPhase(grillSlots),
      elapsed: Math.max(0, ...grillSlots.map((slot) => slot.elapsed)),
    },
    event: becameBurnt ? 'burnt' : becameReady ? 'ready' : 'none',
  };
}

function aggregateGrillPhase(slots: readonly GrillSlotState[]): DevicePhase {
  if (slots.some((slot) => slot.phase === 'burnt')) return 'burnt';
  if (slots.some((slot) => slot.phase === 'ready')) return 'ready';
  if (slots.some((slot) => slot.phase === 'working')) return 'working';
  return 'idle';
}

export function deviceProgress(device: SavedDeviceState): number {
  if (device.type === 'locker' || device.phase === 'idle') return 0;
  const definition = DEVICE_DEFINITIONS[device.type];
  if (device.type === 'solarPurifier') {
    if (device.freshWater > 0) return 1;
    return Math.max(0, ...device.waterQueue) / definition.duration;
  }
  if (device.type === 'tripleGrill') {
    if (device.grillSlots.some((slot) => slot.phase !== 'working')) return 1;
    return Math.max(0, ...device.grillSlots.map((slot) => slot.elapsed)) / definition.duration;
  }
  return Math.max(0, Math.min(1, device.elapsed / definition.duration));
}

export function remainingDeviceSeconds(device: SavedDeviceState): number {
  const duration = DEVICE_DEFINITIONS[device.type].duration;
  if (device.type === 'solarPurifier') {
    if (device.waterQueue.length === 0) return 0;
    return Math.max(0, Math.ceil(duration - Math.max(...device.waterQueue)));
  }
  if (device.type === 'tripleGrill') {
    const working = device.grillSlots.filter((slot) => slot.phase === 'working');
    if (working.length === 0) return 0;
    return Math.max(0, Math.ceil(duration - Math.max(...working.map((slot) => slot.elapsed))));
  }
  if (device.phase !== 'working') return 0;
  return Math.max(0, Math.ceil(duration - device.elapsed));
}

export function deviceOutput(device: SavedDeviceState): ItemBundle {
  if (device.type === 'solarPurifier') return device.freshWater > 0 ? { freshWaterCup: device.freshWater } : {};
  if (device.type === 'tripleGrill') {
    const counts = tripleGrillCounts(device);
    return {
      ...(counts.ready > 0 ? { cookedFish: counts.ready } : {}),
      ...(counts.burnt > 0 ? { burntFish: counts.burnt } : {}),
    };
  }
  const definition = DEVICE_DEFINITIONS[device.type];
  return device.phase === 'burnt' ? definition.burntOutput ?? {} : definition.output;
}

export function sanitizeSavedDevice(value: unknown): SavedDeviceState | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<SavedDeviceState>;
  if (!DEVICE_TYPES.has(candidate.type as DeviceType)) return null;
  const type = candidate.type as DeviceType;
  const x = typeof candidate.x === 'number' && Number.isFinite(candidate.x) ? Math.round(candidate.x) : 0;
  const z = typeof candidate.z === 'number' && Number.isFinite(candidate.z) ? Math.round(candidate.z) : 0;
  const base = createDeviceState(
    type,
    x,
    z,
    candidate.rotation ?? 0,
    typeof candidate.id === 'string' && candidate.id.trim().length > 0 ? candidate.id.slice(0, 80) : `${type}-${x}-${z}`,
  );

  if (type === 'solarPurifier') {
    const duration = DEVICE_DEFINITIONS.solarPurifier.duration;
    const rawQueue = Array.isArray(candidate.waterQueue)
      ? candidate.waterQueue.slice(0, SOLAR_PURIFIER_CAPACITY).map((elapsed) => finiteClamp(elapsed, 0, duration))
      : [];
    const completed = rawQueue.filter((elapsed) => elapsed >= duration).length;
    const waterQueue = rawQueue.filter((elapsed) => elapsed < duration);
    const freshWater = Math.min(
      SOLAR_PURIFIER_CAPACITY - waterQueue.length,
      Math.max(0, Math.floor(finiteClamp(candidate.freshWater, 0, SOLAR_PURIFIER_CAPACITY))) + completed,
    );
    return {
      ...base,
      waterQueue,
      freshWater,
      phase: freshWater > 0 ? 'ready' : waterQueue.length > 0 ? 'working' : 'idle',
      elapsed: freshWater > 0 ? duration : Math.max(0, ...waterQueue),
    };
  }

  if (type === 'tripleGrill') {
    const definition = DEVICE_DEFINITIONS.tripleGrill;
    const burnAt = definition.duration + (definition.readyWindow ?? 0);
    const grillSlots = (Array.isArray(candidate.grillSlots) ? candidate.grillSlots : [])
      .slice(0, TRIPLE_GRILL_CAPACITY)
      .flatMap((raw): GrillSlotState[] => {
        if (!raw || typeof raw !== 'object') return [];
        const slot = raw as Partial<GrillSlotState>;
        const elapsed = finiteClamp(slot.elapsed, 0, burnAt);
        const phase: GrillSlotPhase =
          elapsed >= burnAt || slot.phase === 'burnt'
            ? 'burnt'
            : elapsed >= definition.duration || slot.phase === 'ready'
              ? 'ready'
              : 'working';
        return [{ phase, elapsed: phase === 'burnt' ? burnAt : phase === 'ready' ? Math.max(definition.duration, elapsed) : Math.min(definition.duration - 0.001, elapsed) }];
      });
    return {
      ...base,
      grillSlots,
      fuelSeconds: finiteClamp(candidate.fuelSeconds, 0, TRIPLE_GRILL_MAX_FUEL_SECONDS),
      phase: aggregateGrillPhase(grillSlots),
      elapsed: Math.max(0, ...grillSlots.map((slot) => slot.elapsed)),
    };
  }

  if (type === 'locker') {
    const normalized = normalizeInventory(candidate.storage ?? {});
    return { ...base, storage: addItems({}, normalized, LOCKER_SLOT_CAPACITY).inventory };
  }

  const requestedPhase: DevicePhase =
    candidate.phase === 'working' || candidate.phase === 'ready' || candidate.phase === 'burnt' ? candidate.phase : 'idle';
  if (type === 'purifier' && requestedPhase === 'burnt') return null;
  const definition = DEVICE_DEFINITIONS[type];
  const maxElapsed = definition.duration + (definition.readyWindow ?? 0);
  const rawElapsed = finiteClamp(candidate.elapsed, 0, maxElapsed);
  const elapsed =
    requestedPhase === 'idle'
      ? 0
      : requestedPhase === 'burnt'
        ? maxElapsed
        : requestedPhase === 'ready'
          ? Math.max(definition.duration, rawElapsed)
          : Math.min(definition.duration - 0.001, rawElapsed);
  return { ...base, phase: requestedPhase, elapsed };
}

function finiteClamp(value: unknown, minimum: number, maximum: number): number {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : minimum;
  return Math.max(minimum, Math.min(maximum, number));
}
