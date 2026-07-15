import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AUDIO_MIX,
  getEffectiveMasterGain,
  setAudioMixChannel,
} from './audioMix';

describe('audio mix settings', () => {
  it('updates one channel immutably and clamps levels to the valid range', () => {
    const louder = setAudioMixChannel(DEFAULT_AUDIO_MIX, 'effects', 1.8);
    expect(louder.effects).toBe(1);
    expect(louder).not.toBe(DEFAULT_AUDIO_MIX);
    expect(DEFAULT_AUDIO_MIX.effects).toBe(0.85);

    expect(setAudioMixChannel(DEFAULT_AUDIO_MIX, 'music', -2).music).toBe(0);
    expect(setAudioMixChannel(DEFAULT_AUDIO_MIX, 'ui', Number.NaN).ui).toBe(DEFAULT_AUDIO_MIX.ui);
  });

  it('mutes the final output without destroying stored channel levels', () => {
    expect(getEffectiveMasterGain({ enabled: true, focusMuted: false, masterVolume: 0.75 })).toBeCloseTo(0.585);
    expect(getEffectiveMasterGain({ enabled: false, focusMuted: false, masterVolume: 0.75 })).toBe(0);
    expect(getEffectiveMasterGain({ enabled: true, focusMuted: true, masterVolume: 0.75 })).toBe(0);
  });
});
