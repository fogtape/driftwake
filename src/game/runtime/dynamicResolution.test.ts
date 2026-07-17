import { describe, expect, it } from 'vitest';
import {
  createDynamicResolutionState,
  stepDynamicResolution,
  summarizeFrameTimes,
  type DynamicResolutionPolicy,
} from './dynamicResolution';

const POLICY: DynamicResolutionPolicy = {
  minimumScale: 0.6,
  maximumScale: 1,
  decreaseStep: 0.1,
  increaseStep: 0.05,
  slowP95FrameMs: 20,
  healthyMedianFrameMs: 17.5,
  healthyP95FrameMs: 19,
  decreaseAfterSeconds: 1.5,
  increaseAfterSeconds: 6,
  cooldownSeconds: 2,
};

describe('dynamic resolution', () => {
  it('reduces scale only after sustained p95 pressure', () => {
    let state = createDynamicResolutionState();
    state = stepDynamicResolution(state, { medianFrameMs: 18, p95FrameMs: 24, elapsedSeconds: 0.75, enabled: true }, POLICY);
    expect(state.scale).toBe(1);
    state = stepDynamicResolution(state, { medianFrameMs: 18, p95FrameMs: 24, elapsedSeconds: 0.75, enabled: true }, POLICY);
    expect(state.scale).toBe(0.9);
  });

  it('can recover on a normal 60 Hz display', () => {
    let state = createDynamicResolutionState(0.8);
    for (let second = 0; second < 6; second += 1) {
      state = stepDynamicResolution(
        state,
        { medianFrameMs: 16.67, p95FrameMs: 17.4, elapsedSeconds: 1, enabled: true },
        POLICY,
      );
    }
    expect(state.scale).toBe(0.85);
  });

  it('restores native scale and clears pressure when disabled', () => {
    expect(stepDynamicResolution(
      { scale: 0.6, slowSeconds: 2, healthySeconds: 1, cooldownSeconds: 1 },
      { medianFrameMs: 40, p95FrameMs: 60, elapsedSeconds: 1, enabled: false },
      POLICY,
    )).toEqual(createDynamicResolutionState(1));
  });

  it('summarizes median, p95 and hitches without invalid values', () => {
    const summary = summarizeFrameTimes([16, 17, 18, 55, Number.NaN, -2]);
    expect(summary.medianFrameMs).toBe(17);
    expect(summary.p95FrameMs).toBe(55);
    expect(summary.maximumFrameMs).toBe(55);
    expect(summary.hitchCount).toBe(1);
    expect(summary.sampleCount).toBe(4);
  });
});
