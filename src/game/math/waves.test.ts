import { describe, expect, it } from 'vitest';
import { sampleWave, sampleWaveHeight } from './waves';

describe('sampleWave', () => {
  it('is deterministic for a fixed world position and time', () => {
    expect(sampleWaveHeight(12.5, -4.25, 9.75)).toBe(sampleWaveHeight(12.5, -4.25, 9.75));
  });

  it('stays inside the configured combined amplitude', () => {
    for (let index = 0; index < 200; index += 1) {
      const height = sampleWaveHeight(index * 0.71, index * -0.43, index * 0.09);
      expect(Math.abs(height)).toBeLessThanOrEqual(0.436);
    }
  });

  it('returns finite surface slopes', () => {
    const sample = sampleWave(-31.2, 18.4, 4.2);
    expect(Number.isFinite(sample.slopeX)).toBe(true);
    expect(Number.isFinite(sample.slopeZ)).toBe(true);
  });

  it('scales height and slopes together for changing sea states', () => {
    const base = sampleWave(4.2, -8.1, 12.5, 1);
    const storm = sampleWave(4.2, -8.1, 12.5, 1.5);

    expect(storm.height).toBeCloseTo(base.height * 1.5);
    expect(storm.slopeX).toBeCloseTo(base.slopeX * 1.5);
    expect(storm.slopeZ).toBeCloseTo(base.slopeZ * 1.5);
    expect(sampleWaveHeight(4.2, -8.1, 12.5, 1.5)).toBeCloseTo(storm.height);
  });
});

