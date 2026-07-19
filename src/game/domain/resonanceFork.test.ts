import { describe, expect, it } from 'vitest';
import {
  RESONANCE_AIM_DOT,
  RESONANCE_CHARGE_SECONDS,
  RESONANCE_REACH,
  isResonanceTarget,
  resonanceChargeProgress,
  resolveResonanceDischarge,
} from './resonanceFork';

describe('resonance fork combat transaction', () => {
  it('requires the full continuous charge window', () => {
    expect(resonanceChargeProgress(-1)).toBe(0);
    expect(resonanceChargeProgress(RESONANCE_CHARGE_SECONDS / 2)).toBe(0.5);
    expect(resonanceChargeProgress(RESONANCE_CHARGE_SECONDS + 8)).toBe(1);
    expect(resonanceChargeProgress(Number.NaN)).toBe(0);
  });

  it('locks only an active approaching threat inside its cone and medium range', () => {
    const target = {
      active: true,
      visible: true,
      mode: 'approaching',
      distance: RESONANCE_REACH,
      alignment: RESONANCE_AIM_DOT,
    };
    expect(isResonanceTarget(target)).toBe(true);
    expect(isResonanceTarget({ ...target, mode: 'circling' })).toBe(false);
    expect(isResonanceTarget({ ...target, distance: RESONANCE_REACH + 0.01 })).toBe(false);
    expect(isResonanceTarget({ ...target, alignment: RESONANCE_AIM_DOT - 0.01 })).toBe(false);
    expect(isResonanceTarget({ ...target, active: false })).toBe(false);
  });

  it('spends resources only for a full charged lock', () => {
    expect(resolveResonanceDischarge(0.99, true, true)).toBe('cancelled');
    expect(resolveResonanceDischarge(1, false, true)).toBe('no-cell');
    expect(resolveResonanceDischarge(1, true, false)).toBe('miss');
    expect(resolveResonanceDischarge(1, true, true)).toBe('hit');
  });
});
