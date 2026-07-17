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
});
