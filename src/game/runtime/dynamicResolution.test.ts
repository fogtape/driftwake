import { describe, expect, it } from 'vitest';
import {
  createDynamicResolutionState,
  stepDynamicResolution,
  type DynamicResolutionPolicy,
} from './dynamicResolution';

const POLICY: DynamicResolutionPolicy = {
  targetFps: 60,
  minimumScale: 0.55,
  maximumScale: 1,
  decreaseStep: 0.1,
  increaseStep: 0.05,
  decreaseAfterSeconds: 1.5,
  increaseAfterSeconds: 5,
  cooldownSeconds: 2,
};

describe('dynamic resolution controller', () => {
  it('reduces scale only after sustained low frame rate', () => {
    let state = createDynamicResolutionState();
    state = stepDynamicResolution(state, { fps: 40, elapsedSeconds: 0.75, enabled: true }, POLICY);
    expect(state.scale).toBe(1);

    state = stepDynamicResolution(state, { fps: 40, elapsedSeconds: 0.75, enabled: true }, POLICY);
    expect(state.scale).toBe(0.9);
    expect(state.cooldownSeconds).toBe(2);
  });

  it('recovers slowly after sustained headroom and never exceeds policy bounds', () => {
    let state = { ...createDynamicResolutionState(0.9), cooldownSeconds: 0 };
    for (let second = 0; second < 5; second += 1) {
      state = stepDynamicResolution(state, { fps: 67, elapsedSeconds: 1, enabled: true }, POLICY);
    }
    expect(state.scale).toBe(0.95);

    for (let second = 0; second < 40; second += 1) {
      state = stepDynamicResolution(state, { fps: 90, elapsedSeconds: 1, enabled: true }, POLICY);
    }
    expect(state.scale).toBe(1);
  });

  it('clamps repeated low-FPS pressure to the minimum scale', () => {
    let state = createDynamicResolutionState();
    for (let second = 0; second < 40; second += 1) {
      state = stepDynamicResolution(state, { fps: 8, elapsedSeconds: 1, enabled: true }, POLICY);
    }
    expect(state.scale).toBe(POLICY.minimumScale);
  });

  it('restores full scale and clears pressure when disabled', () => {
    const state = stepDynamicResolution(
      { scale: 0.6, lowFpsSeconds: 2, highFpsSeconds: 1, cooldownSeconds: 1 },
      { fps: 12, elapsedSeconds: 1, enabled: false },
      POLICY,
    );
    expect(state).toEqual(createDynamicResolutionState(1));
  });

  it('ignores invalid samples without poisoning controller state', () => {
    const initial = createDynamicResolutionState(0.8);
    expect(stepDynamicResolution(
      initial,
      { fps: Number.NaN, elapsedSeconds: 1, enabled: true },
      POLICY,
    )).toEqual(initial);
  });
});
