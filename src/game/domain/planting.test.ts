import { describe, expect, it } from 'vitest';
import {
  PLANT_DRY_GRACE_SECONDS,
  PLANT_GROWTH_SECONDS,
  PLANT_WATER_SECONDS,
  advancePlanter,
  applyBirdDamage,
  birdRaidAllowedInClimate,
  createPlanterState,
  nextBirdVisitSeconds,
  planterHarvest,
  plantingClimateFromWeather,
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

  it('uses the navigation weather truth to trade wind, rain and growth', () => {
    const calm = plantingClimateFromWeather({ weatherPhase: 'calm', stormIntensity: 0 });
    const building = plantingClimateFromWeather({ weatherPhase: 'building', stormIntensity: 1 });
    const storm = plantingClimateFromWeather({ weatherPhase: 'storm', stormIntensity: 1 });
    expect(building).toMatchObject({ effect: 'wind', growthMultiplier: 0.9, waterUseMultiplier: 1.3 });
    expect(storm).toMatchObject({ effect: 'rain', growthMultiplier: 0.72, waterUseMultiplier: 0.55 });
    expect(storm.rainfallPerSecond).toBeGreaterThan(storm.waterUseMultiplier / PLANT_WATER_SECONDS);
    expect(birdRaidAllowedInClimate(calm)).toBe(true);
    expect(birdRaidAllowedInClimate(building)).toBe(true);
    expect(birdRaidAllowedInClimate(storm)).toBe(false);

    const planted = waterPlanter(sowPlanter(createPlanterState(0, 0)));
    const calmResult = advancePlanter(planted, 20, calm).planter;
    const windyResult = advancePlanter(planted, 20, building).planter;
    expect(windyResult.growth).toBeLessThan(calmResult.growth);
    expect(windyResult.water).toBeLessThan(calmResult.water);
  });

  it('lets sustained storm rain germinate seeds and rescue dry crops', () => {
    const storm = plantingClimateFromWeather({ weatherPhase: 'storm', stormIntensity: 1 });
    const sown = sowPlanter(createPlanterState(0, 0));
    const germinated = advancePlanter(sown, 8, storm);
    expect(germinated.event).toBe('rainwater');
    expect(germinated.planter.phase).toBe('growing');
    expect(germinated.planter.water).toBeGreaterThan(0.1);
    expect(germinated.planter.growth).toBeGreaterThan(0);

    const almostWithered = {
      ...waterPlanter(sown),
      phase: 'dry' as const,
      water: 0,
      growth: 0.42,
      drySeconds: PLANT_DRY_GRACE_SECONDS - 0.1,
    };
    const rescued = advancePlanter(almostWithered, 12, storm);
    expect(rescued.event).toBe('rainwater');
    expect(rescued.planter.phase).toBe('growing');
    expect(rescued.planter.drySeconds).toBe(0);
    expect(rescued.planter.water).toBeGreaterThan(0.17);
  });

  it('keeps constant-weather planting deterministic across coarse and fixed steps', () => {
    const climate = plantingClimateFromWeather({ weatherPhase: 'building', stormIntensity: 0.82 });
    const initial = waterPlanter(sowPlanter(createPlanterState(0, 0)));
    const coarse = advancePlanter(initial, 72, climate).planter;
    let stepped = initial;
    for (let index = 0; index < 72 * 60; index += 1) {
      stepped = advancePlanter(stepped, 1 / 60, climate).planter;
    }
    expect(stepped.phase).toBe(coarse.phase);
    expect(stepped.growth).toBeCloseTo(coarse.growth, 6);
    expect(stepped.water).toBeCloseTo(coarse.water, 6);
    expect(stepped.drySeconds).toBeCloseTo(coarse.drySeconds, 6);
  });
});
