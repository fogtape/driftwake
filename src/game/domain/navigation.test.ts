import { describe, expect, it } from 'vitest';
import {
  COURSE_STEP,
  advanceNavigationState,
  bearingTo,
  cardinalLabel,
  createDefaultNavigationState,
  createNavigationDevice,
  navigationMetrics,
  normalizeAngle,
  sanitizeNavigationState,
  shortestAngle,
} from './navigation';

describe('raft navigation', () => {
  it('normalizes bearings and takes the shortest turn across the angle seam', () => {
    expect(normalizeAngle(Math.PI * 3)).toBeCloseTo(Math.PI);
    expect(shortestAngle(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2);
    expect(bearingTo(0, -10)).toBeCloseTo(0);
    expect(bearingTo(10, 0)).toBeCloseTo(Math.PI / 2);
    expect(cardinalLabel(-Math.PI / 8)).toBe('北');
    expect(cardinalLabel(-Math.PI / 4)).toBe('西北');
  });

  it('makes a deployed, well-trimmed sail materially accelerate the island approach', () => {
    const idle = createDefaultNavigationState();
    const sailing = {
      ...idle,
      courseAngle: 0,
      devices: [{ ...createNavigationDevice('sail', 0, 0, 0, 'sail-test'), deployed: true }],
    };
    expect(navigationMetrics(sailing, 0).approachRate).toBeGreaterThan(navigationMetrics(idle, 0).approachRate + 0.5);
    expect(navigationMetrics({ ...sailing, courseAngle: Math.PI }, 0).sailDrive).toBe(0);
  });

  it('holds position only with a deployed anchor and turns the raft toward its selected course', () => {
    let state = {
      ...createDefaultNavigationState(),
      courseAngle: COURSE_STEP * 2,
      devices: [
        { ...createNavigationDevice('sail', 0, 0, 0, 'sail-test'), deployed: true },
        { ...createNavigationDevice('anchor', 1, 0, 0, 'anchor-test'), deployed: true },
      ],
    };
    expect(navigationMetrics(state, 0)).toMatchObject({ anchored: true, approachRate: 0, dockDriftRate: 0 });
    state = advanceNavigationState(state, 1);
    expect(state.heading).toBeGreaterThan(0);
    expect(state.heading).toBeLessThan(state.courseAngle);
  });

  it('sanitizes duplicate equipment, invalid angles and unsafe clocks', () => {
    const state = sanitizeNavigationState({
      windClock: Infinity,
      courseAngle: 99,
      heading: Number.NaN,
      devices: [
        { id: 'first', type: 'sail', x: 1.8, z: -1.2, rotation: 1.4, deployed: true },
        { id: 'second', type: 'sail', x: 4, z: 4, deployed: false },
        { id: 'anchor', type: 'anchor', x: 0, z: 1, rotation: 0, deployed: true },
      ],
    });
    expect(state.windClock).toBe(0);
    expect(state.devices).toHaveLength(2);
    expect(state.devices[0]).toMatchObject({ id: 'first', x: 2, z: -1, rotation: Math.PI / 2, deployed: true });
    expect(Number.isFinite(state.courseAngle)).toBe(true);
    expect(Number.isFinite(state.heading)).toBe(true);
  });
});
