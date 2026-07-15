export interface FishFightState {
  tension: number;
  progress: number;
}

export interface FishFightResult extends FishFightState {
  outcome: 'fighting' | 'caught' | 'broken';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function advanceFishFight(
  current: FishFightState,
  reeling: boolean,
  pull: number,
  seconds: number,
): FishFightResult {
  const delta = clamp(seconds, 0, 0.1);
  const fishPull = clamp(pull, 0, 1);
  let tension = current.tension;
  let progress = current.progress;
  if (reeling) {
    tension += delta * (0.34 + fishPull * 0.46);
    progress += delta * (0.125 + (1 - tension) * 0.04);
  } else {
    tension -= delta * (0.3 - fishPull * 0.09);
    progress -= delta * 0.022;
  }
  tension = clamp(tension, 0.04, 1.08);
  progress = clamp(progress, 0, 1);
  return {
    tension,
    progress,
    outcome: tension >= 1 ? 'broken' : progress >= 1 ? 'caught' : 'fighting',
  };
}
