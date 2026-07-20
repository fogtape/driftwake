import { describe, expect, it } from 'vitest';
import {
  FISH_SIZE_DEFINITIONS,
  FISH_SIZE_ORDER,
  FISH_SPECIES_DEFINITIONS,
  FISH_SPECIES_ORDER,
  advanceFishFight,
  sampleFishingPull,
  selectFishingCatch,
} from './fishing';

describe('fish fight model', () => {
  it('builds tension and progress while reeling', () => {
    const result = advanceFishFight({ tension: 0.3, progress: 0.1 }, true, 0.6, 0.1);
    expect(result.tension).toBeGreaterThan(0.3);
    expect(result.progress).toBeGreaterThan(0.1);
    expect(result.outcome).toBe('fighting');
  });

  it('allows line tension to recover while preserving most progress', () => {
    const result = advanceFishFight({ tension: 0.8, progress: 0.5 }, false, 0.4, 0.1);
    expect(result.tension).toBeLessThan(0.8);
    expect(result.progress).toBeGreaterThan(0.49);
  });

  it('reports a broken line at the upper tension limit', () => {
    const result = advanceFishFight({ tension: 0.98, progress: 0.6 }, true, 1, 0.1);
    expect(result.outcome).toBe('broken');
  });

  it('selects all three original species and size boundaries deterministically', () => {
    expect(selectFishingCatch(0, 0, 0)).toMatchObject({
      species: 'silverSpine',
      size: 'small',
      portions: 1,
    });
    expect(selectFishingCatch(0.5, 0.28, 0.5)).toMatchObject({
      species: 'amberFin',
      size: 'medium',
      portions: 1,
    });
    expect(selectFishingCatch(0.82, 0.82, 0.999)).toMatchObject({
      species: 'sailtailRunner',
      size: 'large',
      portions: 2,
    });
  });

  it('keeps generated weights and pull samples finite and inside their contracts', () => {
    const catchProfile = selectFishingCatch(0.91, 0.9, 0.63);
    const size = FISH_SIZE_DEFINITIONS[catchProfile.size];
    const species = FISH_SPECIES_DEFINITIONS[catchProfile.species];
    expect(catchProfile.weightKg).toBeGreaterThanOrEqual(size.minimumWeightKg * species.weightScale);
    expect(catchProfile.weightKg).toBeLessThanOrEqual(size.maximumWeightKg * species.weightScale);
    for (let index = 0; index < 240; index += 1) {
      const pull = sampleFishingPull(catchProfile, index / 60);
      expect(Number.isFinite(pull)).toBe(true);
      expect(pull).toBeGreaterThanOrEqual(0.12);
      expect(pull).toBeLessThanOrEqual(0.96);
    }
  });

  it('makes a large sailtail build tension faster and reel slower than a small silver-spine', () => {
    const easy = selectFishingCatch(0.1, 0.1, 0.4);
    const hard = selectFishingCatch(0.9, 0.9, 0.4);
    const state = { tension: 0.35, progress: 0.2 };
    const easyResult = advanceFishFight(state, true, 0.62, 0.1, easy.difficulty);
    const hardResult = advanceFishFight(state, true, 0.62, 0.1, hard.difficulty);
    expect(hardResult.tension).toBeGreaterThan(easyResult.tension);
    expect(hardResult.progress).toBeLessThan(easyResult.progress);
    const easyRecovery = advanceFishFight(easyResult, false, 0.62, 0.1, easy.difficulty);
    const hardRecovery = advanceFishFight(hardResult, false, 0.62, 0.1, hard.difficulty);
    expect(easyResult.tension - easyRecovery.tension).toBeGreaterThan(
      hardResult.tension - hardRecovery.tension,
    );
  });

  it('keeps every species and size catchable with deliberate tension release', () => {
    const durations = new Map<string, number>();
    for (const [speciesIndex, species] of FISH_SPECIES_ORDER.entries()) {
      for (const [sizeIndex, size] of FISH_SIZE_ORDER.entries()) {
        const speciesRoll = [0.1, 0.6, 0.9][speciesIndex];
        const sizeRoll = [0.1, 0.5, 0.9][sizeIndex];
        const catchProfile = selectFishingCatch(speciesRoll, sizeRoll, 0.47);
        expect(catchProfile).toMatchObject({ species, size });
        let state = { tension: 0.28, progress: 0.04 };
        let reeling = true;
        let outcome: 'fighting' | 'caught' | 'broken' = 'fighting';
        let tick = 0;
        for (; tick < 120 * 60 && outcome === 'fighting'; tick += 1) {
          if (reeling && state.tension >= 0.62) reeling = false;
          else if (!reeling && state.tension <= 0.34) reeling = true;
          const result = advanceFishFight(
            state,
            reeling,
            sampleFishingPull(catchProfile, tick / 60),
            1 / 60,
            catchProfile.difficulty,
          );
          state = result;
          outcome = result.outcome;
        }
        expect(outcome, `${species}/${size} after ${(tick / 60).toFixed(1)}s`).toBe('caught');
        durations.set(`${species}/${size}`, tick / 60);
      }
    }
    expect(durations.get('sailtailRunner/large')).toBeGreaterThan(
      durations.get('silverSpine/small') ?? 0,
    );
  });
});
