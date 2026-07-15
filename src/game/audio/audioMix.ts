export type AudioMixChannel = 'master' | 'music' | 'ambience' | 'effects' | 'ui';

export interface AudioMixSnapshot {
  master: number;
  music: number;
  ambience: number;
  effects: number;
  ui: number;
}

export const DEFAULT_AUDIO_MIX: Readonly<AudioMixSnapshot> = {
  master: 0.75,
  music: 0.35,
  ambience: 0.75,
  effects: 0.85,
  ui: 0.8,
};

export function setAudioMixChannel(
  mix: AudioMixSnapshot,
  channel: AudioMixChannel,
  value: number,
): AudioMixSnapshot {
  if (!Number.isFinite(value)) return mix;
  return { ...mix, [channel]: Math.min(1, Math.max(0, value)) };
}

export function shouldMuteAudioForFocus({
  enabled,
  windowFocused,
  documentVisible,
}: {
  enabled: boolean;
  windowFocused: boolean;
  documentVisible: boolean;
}): boolean {
  return enabled && (!windowFocused || !documentVisible);
}

export function getEffectiveMasterGain({
  enabled,
  focusMuted,
  masterVolume,
}: {
  enabled: boolean;
  focusMuted: boolean;
  masterVolume: number;
}): number {
  if (!enabled || focusMuted || !Number.isFinite(masterVolume)) return 0;
  return Math.min(1, Math.max(0, masterVolume)) * 0.78;
}
