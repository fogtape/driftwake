import { describe, expect, it } from 'vitest';
import {
  advanceDeviceState,
  collectDeviceOutput,
  collectSolarWater,
  collectTripleGrillOutput,
  createDeviceState,
  deviceOutput,
  deviceProgress,
  sanitizeSavedDevice,
  fuelTripleGrill,
  loadSolarPurifier,
  loadTripleGrill,
  startDeviceCycle,
  tripleGrillCounts,
} from './devices';
import { usedInventorySlots } from './items';

describe('survival devices', () => {
  it('purifies a cup on a deterministic timer and remains ready', () => {
    let purifier = startDeviceCycle(createDeviceState('purifier', 1, -1, 0, 'purifier-test'));
    purifier = advanceDeviceState(purifier, 9).device;
    expect(purifier.phase).toBe('working');
    expect(deviceProgress(purifier)).toBe(0.5);
    const completed = advanceDeviceState(purifier, 9);
    expect(completed.event).toBe('ready');
    expect(completed.device.phase).toBe('ready');
    expect(advanceDeviceState(completed.device, 120).device.phase).toBe('ready');
    expect(deviceOutput(completed.device)).toEqual({ freshWaterCup: 1 });
  });

  it('cooks fish, exposes a collection window, then burns it', () => {
    let grill = startDeviceCycle(createDeviceState('grill', 0, 0, 0, 'grill-test'));
    grill = advanceDeviceState(grill, 16).device;
    expect(grill.phase).toBe('ready');
    expect(deviceOutput(grill)).toEqual({ cookedFish: 1 });
    const burned = advanceDeviceState(grill, 24);
    expect(burned.event).toBe('burnt');
    expect(burned.device.phase).toBe('burnt');
    expect(deviceOutput(burned.device)).toEqual({ burntFish: 1 });
    expect(collectDeviceOutput(burned.device).phase).toBe('idle');
  });

  it('sanitizes coordinates, rotations and impossible purifier states', () => {
    expect(
      sanitizeSavedDevice({ type: 'grill', x: 1.8, z: -2.2, rotation: 1.4, phase: 'working', elapsed: 999 }),
    ).toMatchObject({ type: 'grill', x: 2, z: -2, rotation: Math.PI / 2, elapsed: 15.999 });
    expect(sanitizeSavedDevice({ type: 'purifier', phase: 'burnt' })).toBeNull();
  });

  it('purifies five independently loaded cups in parallel without a fuel state', () => {
    let purifier = createDeviceState('solarPurifier', 0, 0, 0, 'solar');
    for (let index = 0; index < 5; index += 1) purifier = loadSolarPurifier(purifier);
    expect(purifier.waterQueue).toHaveLength(5);
    purifier = advanceDeviceState(purifier, 26).device;
    expect(purifier).toMatchObject({ phase: 'ready', freshWater: 5, fuelSeconds: 0 });
    purifier = collectSolarWater(purifier);
    expect(purifier.freshWater).toBe(4);
  });

  it('tracks three grill slots against one shared fuel reserve and collects each result', () => {
    let grill = fuelTripleGrill(createDeviceState('tripleGrill', 0, 0, 0, 'triple'));
    for (let index = 0; index < 3; index += 1) grill = loadTripleGrill(grill);
    grill = advanceDeviceState(grill, 22).device;
    expect(tripleGrillCounts(grill)).toEqual({ working: 0, ready: 3, burnt: 0 });
    const collected = collectTripleGrillOutput(grill);
    expect(collected.output).toEqual({ cookedFish: 1 });
    expect(collected.device.grillSlots).toHaveLength(2);
  });

  it('bounds locker contents to eight real inventory stacks during sanitization', () => {
    const locker = sanitizeSavedDevice({
      id: 'locker',
      type: 'locker',
      storage: { timber: 40, polymer: 40, fiber: 40, scrap: 12, rope: 10, stone: 16 },
    });
    expect(locker?.type).toBe('locker');
    expect(usedInventorySlots(locker?.storage ?? {})).toBe(8);
    expect(locker?.storage.stone).toBeUndefined();
  });
});
