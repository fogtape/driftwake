import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES, LEGACY_PREFERENCES_KEY, PREFERENCES_KEY, loadPreferences, sanitizePreferences } from './preferences';

describe('preferences schema', () => {
  it('clamps mixer levels and accepts known quality values', () => {
    const preferences = sanitizePreferences({
      audioEnabled: false,
      muteOnFocusLoss: false,
      cameraMotionMode: 'comfort',
      quality: 'low',
      dynamicResolutionEnabled: false,
      audioMix: { master: 4, music: -1, ambience: 0.6 },
    });
    expect(preferences.audioEnabled).toBe(false);
    expect(preferences.muteOnFocusLoss).toBe(false);
    expect(preferences.cameraMotionMode).toBe('comfort');
    expect(preferences.quality).toBe('low');
    expect(preferences.dynamicResolutionEnabled).toBe(false);
    expect(preferences.audioMix.master).toBe(1);
    expect(preferences.audioMix.music).toBe(0);
    expect(preferences.audioMix.ambience).toBe(0.6);
    expect(preferences.audioMix.effects).toBe(DEFAULT_PREFERENCES.audioMix.effects);
  });

  it('falls back safely for malformed input', () => {
    expect(sanitizePreferences('bad')).toEqual(DEFAULT_PREFERENCES);
  });

  it('migrates the legacy preference key with new comfort defaults', () => {
    const storage = {
      getItem: (key: string) => key === LEGACY_PREFERENCES_KEY
        ? JSON.stringify({ version: 1, audioEnabled: false, quality: 'low', audioMix: { master: 0.4 } })
        : null,
    };
    const preferences = loadPreferences(storage);
    expect(storage.getItem(PREFERENCES_KEY)).toBeNull();
    expect(preferences.audioEnabled).toBe(false);
    expect(preferences.cameraMotionMode).toBe('balanced');
    expect(preferences.dynamicResolutionEnabled).toBe(true);
  });
});
