import { describe, expect, it } from 'vitest';
import { PLAYER_GRAVITY, PLAYER_JUMP_SPEED, stepVerticalMotion, type VerticalMotionState } from './locomotion';

describe('stepVerticalMotion', () => {
  it('jumps, falls and lands only over a support surface', () => {
    const state: VerticalMotionState = { mode: 'grounded', headY: 1.6, velocityY: 0 };
    expect(stepVerticalMotion(state, true, { supportHeadY: 1.6, waterHeadY: 0.25 }, 1 / 60)).toBe('jumped');
    expect(state.velocityY).toBeCloseTo(PLAYER_JUMP_SPEED - PLAYER_GRAVITY / 60);
    expect(state.headY).toBeGreaterThan(1.6);

    state.headY = 1.61;
    state.velocityY = -1;
    expect(stepVerticalMotion(state, false, { supportHeadY: 1.6, waterHeadY: 0.25 }, 1 / 60)).toBe('landed');
    expect(state).toEqual({ mode: 'grounded', headY: 1.6, velocityY: 0 });
  });

  it('enters water when falling without support', () => {
    const state: VerticalMotionState = { mode: 'airborne', headY: 0.26, velocityY: -2 };
    expect(stepVerticalMotion(state, false, { supportHeadY: null, waterHeadY: 0.25 }, 1 / 60)).toBe('entered-water');
    expect(state.headY).toBe(0.25);
  });

  it('clips upward velocity at an overhead surface and falls on the next step', () => {
    const state: VerticalMotionState = { mode: 'grounded', headY: 1.54, velocityY: 0 };
    const environment = { supportHeadY: 1.54, ceilingHeadY: 1.72, waterHeadY: 0.25 };
    expect(stepVerticalMotion(state, true, environment, 1 / 20)).toBe('hit-ceiling');
    expect(state).toEqual({ mode: 'airborne', headY: 1.72, velocityY: 0 });

    expect(stepVerticalMotion(state, false, environment, 1 / 60)).toBe('none');
    expect(state.headY).toBeLessThan(1.72);
    expect(state.velocityY).toBeLessThan(0);
  });

  it('does not pull a descending player back to a ceiling', () => {
    const state: VerticalMotionState = { mode: 'airborne', headY: 1.71, velocityY: -0.5 };
    expect(stepVerticalMotion(
      state,
      false,
      { supportHeadY: 1.54, ceilingHeadY: 1.72, waterHeadY: 0.25 },
      1 / 60,
    )).toBe('none');
    expect(state.headY).toBeLessThan(1.71);
  });
});
