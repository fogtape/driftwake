import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES, sanitizePreferences } from './preferences';

describe('preferences schema', () => {
  it('clamps mixer levels and accepts known quality values', () => {
    const preferences = sanitizePreferences({
      audioEnabled: false,
      quality: 'low',
      audioMix: { master: 4, music: -1, ambience: 0.6 },
    });
    expect(preferences.audioEnabled).toBe(false);
    expect(preferences.quality).toBe('low');
    expect(preferences.audioMix.master).toBe(1);
    expect(preferences.audioMix.music).toBe(0);
    expect(preferences.audioMix.ambience).toBe(0.6);
    expect(preferences.audioMix.effects).toBe(DEFAULT_PREFERENCES.audioMix.effects);
  });

  it('falls back safely for malformed input', () => {
    expect(sanitizePreferences('bad')).toEqual(DEFAULT_PREFERENCES);
  });
});
