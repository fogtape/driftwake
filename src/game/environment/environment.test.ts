import { describe, expect, it } from 'vitest';
import { DAY_LENGTH_SECONDS, sampleDayCycle, sampleEnvironmentLighting } from './environment';

describe('environment sampling', () => {
  it('loops a deterministic day with readable day and night endpoints', () => {
    const start = sampleDayCycle(0);
    const midnight = sampleDayCycle(DAY_LENGTH_SECONDS / 2);
    const loop = sampleDayCycle(DAY_LENGTH_SECONDS);

    expect(start.daylight).toBe(1);
    expect(midnight.daylight).toBe(0);
    expect(loop.progress).toBe(0);
    expect(loop.daylight).toBe(start.daylight);
  });

  it('keeps a nonzero cold key at night while reducing storm exposure', () => {
    const night = sampleEnvironmentLighting(0, 0);
    const storm = sampleEnvironmentLighting(1, 1);
    expect(night.keyIntensity).toBeGreaterThan(0.4);
    expect(storm.exposure).toBeLessThan(sampleEnvironmentLighting(1, 0).exposure);
  });
});
