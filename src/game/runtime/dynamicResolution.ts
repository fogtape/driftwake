export interface DynamicResolutionPolicy {
  targetFps: number;
  minimumScale: number;
  maximumScale: number;
  decreaseStep: number;
  increaseStep: number;
  decreaseAfterSeconds: number;
  increaseAfterSeconds: number;
  cooldownSeconds: number;
}

export interface DynamicResolutionState {
  scale: number;
  lowFpsSeconds: number;
  highFpsSeconds: number;
  cooldownSeconds: number;
}

export interface DynamicResolutionSample {
  fps: number;
  elapsedSeconds: number;
  enabled: boolean;
}

function roundScale(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function createDynamicResolutionState(scale = 1): DynamicResolutionState {
  return {
    scale: Number.isFinite(scale) ? Math.min(1, Math.max(0, scale)) : 1,
    lowFpsSeconds: 0,
    highFpsSeconds: 0,
    cooldownSeconds: 0,
  };
}

export function stepDynamicResolution(
  state: DynamicResolutionState,
  sample: DynamicResolutionSample,
  policy: DynamicResolutionPolicy,
): DynamicResolutionState {
  if (!sample.enabled) return createDynamicResolutionState(policy.maximumScale);
  if (
    !Number.isFinite(sample.fps)
    || sample.fps <= 0
    || !Number.isFinite(sample.elapsedSeconds)
    || sample.elapsedSeconds <= 0
  ) return state;

  const elapsedSeconds = Math.min(5, sample.elapsedSeconds);
  const next: DynamicResolutionState = {
    scale: Math.min(policy.maximumScale, Math.max(policy.minimumScale, state.scale)),
    lowFpsSeconds: state.lowFpsSeconds,
    highFpsSeconds: state.highFpsSeconds,
    cooldownSeconds: Math.max(0, state.cooldownSeconds - elapsedSeconds),
  };
  const lowThreshold = policy.targetFps * 0.88;
  const highThreshold = policy.targetFps * 1.05;

  if (sample.fps < lowThreshold) {
    next.lowFpsSeconds += elapsedSeconds;
    next.highFpsSeconds = 0;
    if (next.lowFpsSeconds >= policy.decreaseAfterSeconds && next.cooldownSeconds <= 0) {
      next.scale = roundScale(Math.max(policy.minimumScale, next.scale - policy.decreaseStep));
      next.lowFpsSeconds = 0;
      next.cooldownSeconds = policy.cooldownSeconds;
    }
  } else if (sample.fps > highThreshold) {
    next.highFpsSeconds += elapsedSeconds;
    next.lowFpsSeconds = 0;
    if (next.highFpsSeconds >= policy.increaseAfterSeconds && next.cooldownSeconds <= 0) {
      next.scale = roundScale(Math.min(policy.maximumScale, next.scale + policy.increaseStep));
      next.highFpsSeconds = 0;
      next.cooldownSeconds = policy.cooldownSeconds;
    }
  } else {
    next.lowFpsSeconds = 0;
    next.highFpsSeconds = 0;
  }

  return next;
}
