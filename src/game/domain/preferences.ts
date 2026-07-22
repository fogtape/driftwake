import type { AudioMix, QualityPreset } from '../../state/gameStore';
import {
  DEFAULT_INPUT_BINDINGS,
  sanitizeInputBindings,
  type InputBindings,
} from './inputBindings';
import { COLOR_VISION_MODES, type CameraMotionMode, type ColorVisionMode } from './settings';

export const PREFERENCES_KEY = 'driftwake.preferences.v3';
export const LEGACY_PREFERENCES_KEY = 'driftwake.preferences.v2';
export const OLDER_PREFERENCES_KEY = 'driftwake.preferences.v1';

export interface GamePreferences {
  version: 3;
  audioEnabled: boolean;
  muteOnFocusLoss: boolean;
  cameraMotionMode: CameraMotionMode;
  quality: QualityPreset;
  dynamicResolutionEnabled: boolean;
  keyBindings: InputBindings;
  captionsEnabled: boolean;
  colorVisionMode: ColorVisionMode;
  reducedMotion: boolean;
  audioMix: AudioMix;
}

export const DEFAULT_PREFERENCES: GamePreferences = {
  version: 3,
  audioEnabled: true,
  muteOnFocusLoss: true,
  cameraMotionMode: 'balanced',
  quality: 'high',
  dynamicResolutionEnabled: true,
  keyBindings: { ...DEFAULT_INPUT_BINDINGS },
  captionsEnabled: false,
  colorVisionMode: 'standard',
  reducedMotion: false,
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
    version: 3,
    audioEnabled: typeof candidate.audioEnabled === 'boolean' ? candidate.audioEnabled : DEFAULT_PREFERENCES.audioEnabled,
    muteOnFocusLoss:
      typeof candidate.muteOnFocusLoss === 'boolean'
        ? candidate.muteOnFocusLoss
        : DEFAULT_PREFERENCES.muteOnFocusLoss,
    cameraMotionMode:
      candidate.cameraMotionMode === 'comfort'
      || candidate.cameraMotionMode === 'balanced'
      || candidate.cameraMotionMode === 'immersive'
        ? candidate.cameraMotionMode
        : DEFAULT_PREFERENCES.cameraMotionMode,
    quality: candidate.quality === 'low' || candidate.quality === 'high' ? candidate.quality : DEFAULT_PREFERENCES.quality,
    dynamicResolutionEnabled:
      typeof candidate.dynamicResolutionEnabled === 'boolean'
        ? candidate.dynamicResolutionEnabled
        : DEFAULT_PREFERENCES.dynamicResolutionEnabled,
    keyBindings: sanitizeInputBindings(candidate.keyBindings),
    captionsEnabled:
      typeof candidate.captionsEnabled === 'boolean'
        ? candidate.captionsEnabled
        : DEFAULT_PREFERENCES.captionsEnabled,
    colorVisionMode:
      typeof candidate.colorVisionMode === 'string'
      && (COLOR_VISION_MODES as readonly string[]).includes(candidate.colorVisionMode)
        ? candidate.colorVisionMode as ColorVisionMode
        : DEFAULT_PREFERENCES.colorVisionMode,
    reducedMotion:
      typeof candidate.reducedMotion === 'boolean'
        ? candidate.reducedMotion
        : DEFAULT_PREFERENCES.reducedMotion,
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
  for (const key of [PREFERENCES_KEY, LEGACY_PREFERENCES_KEY, OLDER_PREFERENCES_KEY]) {
    try {
      const raw = storage.getItem(key);
      if (raw) return sanitizePreferences(JSON.parse(raw));
    } catch {
      continue;
    }
  }
  return structuredClone(DEFAULT_PREFERENCES);
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
