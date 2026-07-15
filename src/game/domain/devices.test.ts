import { describe, expect, it } from 'vitest';
import {
  advanceDeviceState,
  collectDeviceOutput,
  createDeviceState,
  deviceOutput,
  deviceProgress,
  sanitizeSavedDevice,
  startDeviceCycle,
} from './devices';

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
});
