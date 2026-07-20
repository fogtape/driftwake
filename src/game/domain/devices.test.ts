import { describe, expect, it } from 'vitest';
import {
  advanceDeviceState,
  collectDeviceOutput,
  collectSolarWater,
  collectTripleGrillOutput,
  createDeviceState,
  DEVICE_DEFINITIONS,
  deviceOutput,
  deviceProgress,
  sanitizeSavedDevice,
  fuelTripleGrill,
  loadSolarPurifier,
  loadTripleGrill,
  startDeviceCycle,
  TRIPLE_GRILL_FUEL_SECONDS,
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
    grill = advanceDeviceState(grill, 10).device;
    expect(grill.fuelSeconds).toBe(TRIPLE_GRILL_FUEL_SECONDS - 10);
    expect(grill.grillSlots.map((slot) => slot.elapsed)).toEqual([10, 10, 10]);
    grill = advanceDeviceState(grill, 12).device;
    expect(tripleGrillCounts(grill)).toEqual({ working: 0, ready: 3, burnt: 0 });
    const collected = collectTripleGrillOutput(grill);
    expect(collected.output).toEqual({ cookedFish: 1 });
    expect(collected.device.grillSlots).toHaveLength(2);
  });

  it('pauses every grill slot when shared fuel runs out and resumes from exact elapsed time', () => {
    let grill = fuelTripleGrill(createDeviceState('tripleGrill', 0, 0, 0, 'fuel-boundary'));
    grill = loadTripleGrill(loadTripleGrill(grill));
    grill = advanceDeviceState(grill, TRIPLE_GRILL_FUEL_SECONDS + 20).device;
    expect(grill.fuelSeconds).toBe(0);
    expect(grill.grillSlots.map((slot) => slot.elapsed)).toEqual([
      TRIPLE_GRILL_FUEL_SECONDS,
      TRIPLE_GRILL_FUEL_SECONDS,
    ]);
    const paused = advanceDeviceState(grill, 120).device;
    expect(paused.grillSlots).toEqual(grill.grillSlots);
    grill = fuelTripleGrill(paused);
    grill = advanceDeviceState(grill, 22).device;
    expect(tripleGrillCounts(grill)).toEqual({ working: 0, ready: 0, burnt: 2 });
    expect(grill.fuelSeconds).toBe(TRIPLE_GRILL_FUEL_SECONDS - 22);
  });

  it('preserves the complete base and triple grill ready windows at their exact boundaries', () => {
    const baseDefinition = DEVICE_DEFINITIONS.grill;
    let base = startDeviceCycle(createDeviceState('grill', 0, 0, 0, 'base-window'));
    base = advanceDeviceState(base, baseDefinition.duration + baseDefinition.readyWindow! - 0.001).device;
    expect(base.phase).toBe('ready');
    base = advanceDeviceState(base, 0.001).device;
    expect(base.phase).toBe('burnt');

    const tripleDefinition = DEVICE_DEFINITIONS.tripleGrill;
    let triple = fuelTripleGrill(createDeviceState('tripleGrill', 0, 0, 0, 'triple-window'), 2);
    triple = loadTripleGrill(triple);
    triple = advanceDeviceState(
      triple,
      tripleDefinition.duration + tripleDefinition.readyWindow! - 0.001,
    ).device;
    expect(triple.grillSlots[0]).toMatchObject({ phase: 'ready', elapsed: 55.999 });
    triple = advanceDeviceState(triple, 0.001).device;
    expect(triple.grillSlots[0]).toMatchObject({ phase: 'burnt', elapsed: 56 });
    const fuelAtBurn = triple.fuelSeconds;
    triple = advanceDeviceState(triple, 60).device;
    expect(triple.fuelSeconds).toBe(fuelAtBurn);
  });

  it('collects a ready slot before a burnt slot and reports the matching outputs', () => {
    const grill = {
      ...createDeviceState('tripleGrill', 0, 0, 0, 'mixed-output'),
      phase: 'burnt' as const,
      grillSlots: [
        { phase: 'burnt' as const, elapsed: 56 },
        { phase: 'ready' as const, elapsed: 31 },
      ],
    };
    const cooked = collectTripleGrillOutput(grill);
    expect(cooked.output).toEqual({ cookedFish: 1 });
    expect(cooked.device.grillSlots).toEqual([{ phase: 'burnt', elapsed: 56 }]);
    const burnt = collectTripleGrillOutput(cooked.device);
    expect(burnt.output).toEqual({ burntFish: 1 });
    expect(burnt.device.phase).toBe('idle');
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
