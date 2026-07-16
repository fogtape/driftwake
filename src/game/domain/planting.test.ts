import { describe, expect, it } from 'vitest';
import {
  PLANT_DRY_GRACE_SECONDS,
  PLANT_GROWTH_SECONDS,
  PLANT_WATER_SECONDS,
  advancePlanter,
  applyBirdDamage,
  createPlanterState,
  nextBirdVisitSeconds,
  planterHarvest,
  resetPlanter,
  sanitizePlantingState,
  sowPlanter,
  waterPlanter,
} from './planting';

describe('raft planting domain', () => {
  it('requires a second watering and pauses growth before withering', () => {
    let planter = waterPlanter(sowPlanter(createPlanterState(1, -1, 0, 'crop')));
    planter = advancePlanter(planter, PLANT_WATER_SECONDS).planter;
    expect(planter.phase).toBe('dry');
    expect(planter.growth).toBeCloseTo(PLANT_WATER_SECONDS / PLANT_GROWTH_SECONDS, 4);

    planter = advancePlanter(planter, PLANT_DRY_GRACE_SECONDS - 1).planter;
    expect(planter.phase).toBe('dry');
    planter = waterPlanter(planter);
    planter = advancePlanter(planter, PLANT_GROWTH_SECONDS).planter;
    expect(planter.phase).toBe('mature');
  });

  it('withers only after the dry grace period and can be cleared', () => {
    let planter = waterPlanter(sowPlanter(createPlanterState(0, 0)));
    planter = advancePlanter(planter, PLANT_WATER_SECONDS).planter;
    const result = advancePlanter(planter, PLANT_DRY_GRACE_SECONDS);
    expect(result.event).toBe('withered');
    expect(resetPlanter(result.planter).phase).toBe('empty');
  });

  it('bird feeding reduces fruit yield without breaking the seed loop', () => {
    const mature = { ...createPlanterState(0, 0), phase: 'mature' as const, growth: 1 };
    const damaged = applyBirdDamage(mature, 11);
    expect(damaged.birdDamage).toBe(2);
    expect(planterHarvest(damaged)).toEqual({ palmFruit: 1, palmSeed: 1 });
  });

  it('sanitizes duplicates, bounds state and keeps bird visits deterministic', () => {
    const state = sanitizePlantingState({
      birdClock: -4,
      birdVisit: 2.8,
      birdPhase: 'feeding',
      birdElapsed: 4.5,
      birdTargetId: 'a',
      planters: [
        { id: 'a', x: 1.2, z: -1.1, rotation: 1.4, phase: 'growing', growth: 9, water: 8, birdDamage: 8 },
        { id: 'b', x: 1, z: -1, phase: 'mature' },
        { id: 'far', x: 99, z: 0, phase: 'empty' },
      ],
    });
    expect(state.planters).toHaveLength(1);
    expect(state.planters[0]).toMatchObject({ id: 'a', x: 1, z: -1, rotation: Math.PI / 2, growth: 1, water: 1, birdDamage: 2 });
    expect(state.birdClock).toBe(0);
    expect(state.birdVisit).toBe(2);
    expect(state).toMatchObject({ birdPhase: 'feeding', birdElapsed: 4.5, birdTargetId: 'a' });
    expect(nextBirdVisitSeconds(3)).toBe(nextBirdVisitSeconds(3));
    expect(nextBirdVisitSeconds(3)).not.toBe(nextBirdVisitSeconds(4));
  });

  it('drops an active bird phase when its target is missing', () => {
    expect(sanitizePlantingState({
      birdPhase: 'diving',
      birdElapsed: 1,
      birdTargetId: 'missing',
      planters: [],
    })).toMatchObject({ birdPhase: 'absent', birdElapsed: 0, birdTargetId: null });
  });
});
