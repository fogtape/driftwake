import { describe, expect, it } from 'vitest';
import {
  GRAVITY,
  JUMP_SPEED,
  SWIM_SURFACE_OFFSET,
  isInClimbBand,
  isWithinRaftBounds,
  stepPlayerVertical,
  type PlayerVerticalEnvironment,
  type PlayerVerticalInput,
  type PlayerVerticalState,
} from './locomotion';

const idleInput: PlayerVerticalInput = {
  jumpPressed: false,
  climbPressed: false,
  ascendHeld: false,
  diveHeld: false,
};

const raftEnvironment: PlayerVerticalEnvironment = {
  supportedByRaft: true,
  nearRaftEdge: false,
  deckHeadY: 1.6,
  waterY: 0,
};

function state(overrides: Partial<PlayerVerticalState> = {}): PlayerVerticalState {
  return { mode: 'raft', headY: 1.6, verticalVelocity: 0, ...overrides };
}

describe('raft bounds', () => {
  it('distinguishes a supported deck point from a point beyond the walkable edge', () => {
    expect(isWithinRaftBounds(1.7, -1.7, 2.08, 0.24)).toBe(true);
    expect(isWithinRaftBounds(1.9, 0, 2.08, 0.24)).toBe(false);
  });

  it('limits climbing to a band around the perimeter instead of the raft centre or open sea', () => {
    expect(isInClimbBand(1.8, 0.2, 2.08)).toBe(true);
    expect(isInClimbBand(0.2, 0.2, 2.08)).toBe(false);
    expect(isInClimbBand(3.3, 0.2, 2.08)).toBe(false);
  });
});

describe('stepPlayerVertical', () => {
  it('keeps a supported player attached to the moving deck height', () => {
    const player = state({ headY: 1.2 });

    stepPlayerVertical(player, idleInput, { ...raftEnvironment, deckHeadY: 1.72 }, 1 / 60);

    expect(player).toEqual({ mode: 'raft', headY: 1.72, verticalVelocity: 0 });
  });

  it('starts a jump with upward velocity and advances under gravity', () => {
    const player = state();

    stepPlayerVertical(player, { ...idleInput, jumpPressed: true }, raftEnvironment, 1 / 60);

    expect(player.mode).toBe('airborne');
    expect(player.verticalVelocity).toBeCloseTo(JUMP_SPEED - GRAVITY / 60);
    expect(player.headY).toBeGreaterThan(raftEnvironment.deckHeadY);
  });

  it('starts falling when the player walks beyond raft support', () => {
    const player = state();

    stepPlayerVertical(player, idleInput, { ...raftEnvironment, supportedByRaft: false }, 1 / 60);

    expect(player.mode).toBe('airborne');
    expect(player.verticalVelocity).toBeLessThan(0);
    expect(player.headY).toBeLessThan(raftEnvironment.deckHeadY);
  });

  it('lands on the deck only while descending over supported raft space', () => {
    const player = state({ mode: 'airborne', headY: 1.61, verticalVelocity: -1 });

    stepPlayerVertical(player, idleInput, raftEnvironment, 1 / 60);

    expect(player).toEqual({ mode: 'raft', headY: 1.6, verticalVelocity: 0 });
  });

  it('enters swimming when an unsupported airborne player reaches the surface', () => {
    const player = state({ mode: 'airborne', headY: SWIM_SURFACE_OFFSET + 0.01, verticalVelocity: -2 });

    stepPlayerVertical(player, idleInput, { ...raftEnvironment, supportedByRaft: false }, 1 / 60);

    expect(player.mode).toBe('swimming');
    expect(player.verticalVelocity).toBe(0);
    expect(player.headY).toBeCloseTo(SWIM_SURFACE_OFFSET);
  });

  it('moves a swimmer below or above the resting surface without teleporting', () => {
    const diving = state({ mode: 'swimming', headY: SWIM_SURFACE_OFFSET, verticalVelocity: 0 });
    const rising = state({ mode: 'swimming', headY: -0.4, verticalVelocity: 0 });

    stepPlayerVertical(diving, { ...idleInput, diveHeld: true }, raftEnvironment, 0.1);
    stepPlayerVertical(rising, { ...idleInput, ascendHeld: true }, raftEnvironment, 0.1);

    expect(diving.headY).toBeLessThan(SWIM_SURFACE_OFFSET);
    expect(diving.headY).toBeGreaterThan(-0.4);
    expect(rising.headY).toBeGreaterThan(-0.4);
    expect(rising.headY).toBeLessThanOrEqual(0.62);
  });

  it('climbs only when requested from the raft-edge reach band', () => {
    const near = state({ mode: 'swimming', headY: 0.3 });
    const far = state({ mode: 'swimming', headY: 0.3 });
    const climbInput = { ...idleInput, climbPressed: true };

    stepPlayerVertical(near, climbInput, { ...raftEnvironment, nearRaftEdge: true }, 1 / 60);
    stepPlayerVertical(far, climbInput, { ...raftEnvironment, nearRaftEdge: false }, 1 / 60);

    expect(near).toEqual({ mode: 'raft', headY: 1.6, verticalVelocity: 0 });
    expect(far.mode).toBe('swimming');
  });
});
