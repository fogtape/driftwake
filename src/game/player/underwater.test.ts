import { describe, expect, it } from 'vitest';
import {
  getUnderwaterAudioCutoff,
  getUnderwaterTarget,
  smoothUnderwaterMix,
} from './underwater';

describe('underwater presentation', () => {
  it('keeps the surface view clear and increases the target continuously with depth', () => {
    expect(getUnderwaterTarget(1, 0)).toBe(0);
    expect(getUnderwaterTarget(0.05, 0)).toBeGreaterThan(0);
    expect(getUnderwaterTarget(-0.7, 0)).toBe(1);
  });

  it('smooths toward the target without overshooting', () => {
    const entering = smoothUnderwaterMix(0, 1, 1 / 60);
    const leaving = smoothUnderwaterMix(1, 0, 1 / 60);

    expect(entering).toBeGreaterThan(0);
    expect(entering).toBeLessThan(1);
    expect(leaving).toBeGreaterThan(0);
    expect(leaving).toBeLessThan(1);
    expect(smoothUnderwaterMix(0.4, 1, 0)).toBe(0.4);
  });

  it('maps the mix to a safe low-pass range', () => {
    expect(getUnderwaterAudioCutoff(0)).toBe(18000);
    expect(getUnderwaterAudioCutoff(1)).toBe(720);
    expect(getUnderwaterAudioCutoff(0.5)).toBeGreaterThan(720);
    expect(getUnderwaterAudioCutoff(0.5)).toBeLessThan(18000);
    expect(getUnderwaterAudioCutoff(20)).toBe(720);
  });
});
