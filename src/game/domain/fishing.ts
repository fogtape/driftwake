export interface FishFightState {
  tension: number;
  progress: number;
}

export type FishSpeciesId = 'silverSpine' | 'amberFin' | 'sailtailRunner';
export type FishSizeId = 'small' | 'medium' | 'large';

export interface FishFightDifficulty {
  tensionMultiplier: number;
  progressMultiplier: number;
  recoveryMultiplier: number;
}

export interface FishSpeciesDefinition {
  id: FishSpeciesId;
  name: string;
  shortName: string;
  tone: string;
  description: string;
  basePull: number;
  pulseAmplitude: number;
  pulseFrequency: number;
  burstStrength: number;
  weightScale: number;
  difficulty: FishFightDifficulty;
}

export interface FishSizeDefinition {
  id: FishSizeId;
  label: string;
  scale: number;
  minimumWeightKg: number;
  maximumWeightKg: number;
  portions: number;
  pullMultiplier: number;
  difficulty: FishFightDifficulty;
}

export const FISH_SPECIES_DEFINITIONS: Record<FishSpeciesId, FishSpeciesDefinition> = {
  silverSpine: {
    id: 'silverSpine',
    name: '银脊鱼',
    shortName: '银脊',
    tone: '#8fc4c5',
    description: '贴着浪背稳定游动，拉力连续且容易预判。',
    basePull: 0.43,
    pulseAmplitude: 0.13,
    pulseFrequency: 2.35,
    burstStrength: 0.025,
    weightScale: 0.82,
    difficulty: { tensionMultiplier: 0.9, progressMultiplier: 1.08, recoveryMultiplier: 1.08 },
  },
  amberFin: {
    id: 'amberFin',
    name: '琥鳍鲷',
    shortName: '琥鳍',
    tone: '#d5a45f',
    description: '会突然横切鱼线，短促爆发之间留有明确回线窗口。',
    basePull: 0.5,
    pulseAmplitude: 0.2,
    pulseFrequency: 3.3,
    burstStrength: 0.17,
    weightScale: 1,
    difficulty: { tensionMultiplier: 1, progressMultiplier: 0.98, recoveryMultiplier: 1 },
  },
  sailtailRunner: {
    id: 'sailtailRunner',
    name: '旗尾梭',
    shortName: '旗尾',
    tone: '#6ba8c9',
    description: '长体巡游鱼会维持强劲冲程，需要更频繁地放线泄力。',
    basePull: 0.62,
    pulseAmplitude: 0.12,
    pulseFrequency: 1.72,
    burstStrength: 0.075,
    weightScale: 1.18,
    difficulty: { tensionMultiplier: 1.06, progressMultiplier: 0.94, recoveryMultiplier: 0.98 },
  },
};

export const FISH_SIZE_DEFINITIONS: Record<FishSizeId, FishSizeDefinition> = {
  small: {
    id: 'small',
    label: '小型',
    scale: 0.78,
    minimumWeightKg: 0.38,
    maximumWeightKg: 0.68,
    portions: 1,
    pullMultiplier: 0.84,
    difficulty: { tensionMultiplier: 0.86, progressMultiplier: 1.12, recoveryMultiplier: 1.1 },
  },
  medium: {
    id: 'medium',
    label: '中型',
    scale: 1,
    minimumWeightKg: 0.72,
    maximumWeightKg: 1.15,
    portions: 1,
    pullMultiplier: 1,
    difficulty: { tensionMultiplier: 1, progressMultiplier: 1, recoveryMultiplier: 1 },
  },
  large: {
    id: 'large',
    label: '大型',
    scale: 1.24,
    minimumWeightKg: 1.28,
    maximumWeightKg: 1.95,
    portions: 2,
    pullMultiplier: 1.16,
    difficulty: { tensionMultiplier: 1.1, progressMultiplier: 0.92, recoveryMultiplier: 0.94 },
  },
};

export const FISH_SPECIES_ORDER = ['silverSpine', 'amberFin', 'sailtailRunner'] as const;
export const FISH_SIZE_ORDER = ['small', 'medium', 'large'] as const;

export interface FishingCatch {
  species: FishSpeciesId;
  size: FishSizeId;
  weightKg: number;
  portions: number;
  modelScale: number;
  pullPhase: number;
  difficulty: FishFightDifficulty;
}

export interface FishFightResult extends FishFightState {
  outcome: 'fighting' | 'caught' | 'broken';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizedRoll(value: number): number {
  return Number.isFinite(value) ? clamp(value, 0, 0.999_999) : 0;
}

export function selectFishingCatch(
  speciesRoll: number,
  sizeRoll: number,
  weightRoll: number,
): FishingCatch {
  const speciesValue = normalizedRoll(speciesRoll);
  const sizeValue = normalizedRoll(sizeRoll);
  const weightValue = normalizedRoll(weightRoll);
  const species: FishSpeciesId = speciesValue < 0.5
    ? 'silverSpine'
    : speciesValue < 0.82
      ? 'amberFin'
      : 'sailtailRunner';
  const size: FishSizeId = sizeValue < 0.28
    ? 'small'
    : sizeValue < 0.82
      ? 'medium'
      : 'large';
  const speciesDefinition = FISH_SPECIES_DEFINITIONS[species];
  const sizeDefinition = FISH_SIZE_DEFINITIONS[size];
  const baseWeight = sizeDefinition.minimumWeightKg
    + (sizeDefinition.maximumWeightKg - sizeDefinition.minimumWeightKg) * weightValue;
  return {
    species,
    size,
    weightKg: Number((baseWeight * speciesDefinition.weightScale).toFixed(2)),
    portions: sizeDefinition.portions,
    modelScale: sizeDefinition.scale,
    pullPhase: weightValue * Math.PI * 2,
    difficulty: {
      tensionMultiplier: speciesDefinition.difficulty.tensionMultiplier
        * sizeDefinition.difficulty.tensionMultiplier,
      progressMultiplier: speciesDefinition.difficulty.progressMultiplier
        * sizeDefinition.difficulty.progressMultiplier,
      recoveryMultiplier: speciesDefinition.difficulty.recoveryMultiplier
        * sizeDefinition.difficulty.recoveryMultiplier,
    },
  };
}

export function sampleFishingPull(catchProfile: FishingCatch, time: number): number {
  const definition = FISH_SPECIES_DEFINITIONS[catchProfile.species];
  const size = FISH_SIZE_DEFINITIONS[catchProfile.size];
  const elapsed = Number.isFinite(time) ? time : 0;
  const primary = Math.sin(elapsed * definition.pulseFrequency + catchProfile.pullPhase);
  const secondary = Math.sin(elapsed * definition.pulseFrequency * 0.43 + catchProfile.pullPhase * 1.7);
  const burstWave = Math.max(
    0,
    Math.sin(elapsed * definition.pulseFrequency * 0.31 + catchProfile.pullPhase * 0.6),
  );
  const burst = Math.pow(burstWave, 6) * definition.burstStrength;
  return clamp(
    (definition.basePull + primary * definition.pulseAmplitude + secondary * 0.055 + burst)
      * size.pullMultiplier,
    0.12,
    0.96,
  );
}

export function advanceFishFight(
  current: FishFightState,
  reeling: boolean,
  pull: number,
  seconds: number,
  difficulty: FishFightDifficulty = {
    tensionMultiplier: 1,
    progressMultiplier: 1,
    recoveryMultiplier: 1,
  },
): FishFightResult {
  const delta = clamp(seconds, 0, 0.1);
  const fishPull = clamp(pull, 0, 1);
  const tensionMultiplier = clamp(difficulty.tensionMultiplier, 0.5, 1.6);
  const progressMultiplier = clamp(difficulty.progressMultiplier, 0.5, 1.6);
  const recoveryMultiplier = clamp(difficulty.recoveryMultiplier, 0.5, 1.6);
  let tension = current.tension;
  let progress = current.progress;
  if (reeling) {
    tension += delta * (0.34 + fishPull * 0.46) * tensionMultiplier;
    progress += delta * (0.125 + (1 - tension) * 0.04) * progressMultiplier;
  } else {
    tension -= delta * (0.3 - fishPull * 0.09) * recoveryMultiplier;
    progress -= delta * (0.01 + fishPull * 0.008);
  }
  tension = clamp(tension, 0.04, 1.08);
  progress = clamp(progress, 0, 1);
  return {
    tension,
    progress,
    outcome: tension >= 1 ? 'broken' : progress >= 1 ? 'caught' : 'fighting',
  };
}
