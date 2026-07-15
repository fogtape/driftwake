import type { AudioMix, QualityPreset } from '../../state/gameStore';

export const PREFERENCES_KEY = 'driftwake.preferences.v1';

export interface GamePreferences {
  version: 1;
  audioEnabled: boolean;
  quality: QualityPreset;
  audioMix: AudioMix;
}

export const DEFAULT_PREFERENCES: GamePreferences = {
  version: 1,
  audioEnabled: true,
  quality: 'high',
  audioMix: { master: 0.78, music: 0.2, ambience: 0.43, effects: 0.72, creatures: 0.78, ui: 0.56 },
};

function normalizedLevel(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}

export function sanitizePreferences(value: unknown): GamePreferences {
  if (!value || typeof value !== 'object') return structuredClone(DEFAULT_PREFERENCES);
  const candidate = value as Partial<GamePreferences>;
  const mix = candidate.audioMix as Partial<AudioMix> | undefined;
  return {
    version: 1,
    audioEnabled: typeof candidate.audioEnabled === 'boolean' ? candidate.audioEnabled : DEFAULT_PREFERENCES.audioEnabled,
    quality: candidate.quality === 'low' || candidate.quality === 'high' ? candidate.quality : DEFAULT_PREFERENCES.quality,
    audioMix: {
      master: normalizedLevel(mix?.master, DEFAULT_PREFERENCES.audioMix.master),
      music: normalizedLevel(mix?.music, DEFAULT_PREFERENCES.audioMix.music),
      ambience: normalizedLevel(mix?.ambience, DEFAULT_PREFERENCES.audioMix.ambience),
      effects: normalizedLevel(mix?.effects, DEFAULT_PREFERENCES.audioMix.effects),
      creatures: normalizedLevel(mix?.creatures, DEFAULT_PREFERENCES.audioMix.creatures),
      ui: normalizedLevel(mix?.ui, DEFAULT_PREFERENCES.audioMix.ui),
    },
  };
}

export function loadPreferences(storage: Pick<Storage, 'getItem'> = window.localStorage): GamePreferences {
  try {
    const raw = storage.getItem(PREFERENCES_KEY);
    return raw ? sanitizePreferences(JSON.parse(raw)) : structuredClone(DEFAULT_PREFERENCES);
  } catch {
    return structuredClone(DEFAULT_PREFERENCES);
  }
}

export function writePreferences(
  preferences: GamePreferences,
  storage: Pick<Storage, 'setItem'> = window.localStorage,
): boolean {
  try {
    storage.setItem(PREFERENCES_KEY, JSON.stringify(sanitizePreferences(preferences)));
    return true;
  } catch {
    return false;
  }
}
