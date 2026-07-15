import { afterEach, describe, expect, it } from 'vitest';
import { useGameStore } from './gameStore';

describe('player locomotion state', () => {
  afterEach(() => {
    useGameStore.getState().setPlayerMode('raft');
    useGameStore.getState().setHeadBobEnabled(true);
  });

  it('stores the head-bob comfort preference', () => {
    expect(useGameStore.getState().headBobEnabled).toBe(true);

    useGameStore.getState().setHeadBobEnabled(false);

    expect(useGameStore.getState().headBobEnabled).toBe(false);
  });

  it('starts attached to the raft and publishes locomotion transitions', () => {
    expect(useGameStore.getState().playerMode).toBe('raft');

    useGameStore.getState().setPlayerMode('airborne');
    expect(useGameStore.getState().playerMode).toBe('airborne');

    useGameStore.getState().setPlayerMode('swimming');
    expect(useGameStore.getState().playerMode).toBe('swimming');
  });
});

describe('environment HUD state', () => {
  it('publishes deterministic weather and wind snapshots for the HUD', () => {
    const snapshot = {
      weather: 'storm' as const,
      dayProgress: 0.75,
      daylight: 0.1,
      windDirectionX: -0.8,
      windDirectionZ: 0.2,
      windStrength: 1,
      risk: 1,
    };
    useGameStore.getState().setEnvironmentHud(snapshot);
    expect(useGameStore.getState().environmentHud).toEqual(snapshot);
  });
});

describe('render performance state', () => {
  it('enables adaptive resolution by default and publishes renderer counters', () => {
    expect(useGameStore.getState().dynamicResolutionEnabled).toBe(true);
    useGameStore.getState().setDynamicResolutionEnabled(false);
    expect(useGameStore.getState().dynamicResolutionEnabled).toBe(false);

    const snapshot = {
      renderScale: 0.75,
      pixelRatio: 1.25,
      drawCalls: 18,
      triangles: 12_400,
      geometries: 22,
      textures: 9,
    };
    useGameStore.getState().setRenderStats(snapshot);
    expect(useGameStore.getState().renderStats).toEqual(snapshot);

    useGameStore.getState().setDynamicResolutionEnabled(true);
  });
});

describe('audio preferences', () => {
  it('stores independent channel levels and the focus-mute policy', () => {
    expect(useGameStore.getState().muteOnFocusLoss).toBe(true);
    useGameStore.getState().setAudioMixChannel('effects', 0.4);
    expect(useGameStore.getState().audioMix.effects).toBe(0.4);
    expect(useGameStore.getState().audioMix.ambience).toBe(0.75);

    useGameStore.getState().setMuteOnFocusLoss(false);
    expect(useGameStore.getState().muteOnFocusLoss).toBe(false);

    useGameStore.getState().setAudioMixChannel('effects', 0.85);
    useGameStore.getState().setMuteOnFocusLoss(true);
  });
});
