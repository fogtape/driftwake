export interface DynamicResolutionPolicy {
  minimumScale: number;
  maximumScale: number;
  decreaseStep: number;
  increaseStep: number;
  slowP95FrameMs: number;
  healthyMedianFrameMs: number;
  healthyP95FrameMs: number;
  decreaseAfterSeconds: number;
  increaseAfterSeconds: number;
  cooldownSeconds: number;
}

export interface DynamicResolutionState {
  scale: number;
  slowSeconds: number;
  healthySeconds: number;
  cooldownSeconds: number;
}

export interface FrameTimingSample {
  medianFrameMs: number;
  p95FrameMs: number;
  elapsedSeconds: number;
  enabled: boolean;
}

export interface FrameTimingSummary {
  medianFrameMs: number;
  p95FrameMs: number;
  maximumFrameMs: number;
  hitchCount: number;
  sampleCount: number;
}

function roundScale(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function createDynamicResolutionState(scale = 1): DynamicResolutionState {
  return {
    scale: Number.isFinite(scale) ? Math.min(1, Math.max(0, scale)) : 1,
    slowSeconds: 0,
    healthySeconds: 0,
    cooldownSeconds: 0,
  };
}

export function stepDynamicResolution(
  state: DynamicResolutionState,
  sample: FrameTimingSample,
  policy: DynamicResolutionPolicy,
): DynamicResolutionState {
  if (!sample.enabled) return createDynamicResolutionState(policy.maximumScale);
  if (
    !Number.isFinite(sample.medianFrameMs)
    || !Number.isFinite(sample.p95FrameMs)
    || !Number.isFinite(sample.elapsedSeconds)
    || sample.medianFrameMs <= 0
    || sample.p95FrameMs <= 0
    || sample.elapsedSeconds <= 0
  ) return state;

  const elapsed = Math.min(5, sample.elapsedSeconds);
  const next: DynamicResolutionState = {
    scale: Math.min(policy.maximumScale, Math.max(policy.minimumScale, state.scale)),
    slowSeconds: state.slowSeconds,
    healthySeconds: state.healthySeconds,
    cooldownSeconds: Math.max(0, state.cooldownSeconds - elapsed),
  };

  if (sample.p95FrameMs > policy.slowP95FrameMs) {
    next.slowSeconds += elapsed;
    next.healthySeconds = 0;
    if (next.slowSeconds >= policy.decreaseAfterSeconds && next.cooldownSeconds <= 0) {
      next.scale = roundScale(Math.max(policy.minimumScale, next.scale - policy.decreaseStep));
      next.slowSeconds = 0;
      next.cooldownSeconds = policy.cooldownSeconds;
    }
  } else if (
    sample.medianFrameMs <= policy.healthyMedianFrameMs
    && sample.p95FrameMs <= policy.healthyP95FrameMs
  ) {
    next.healthySeconds += elapsed;
    next.slowSeconds = 0;
    if (next.healthySeconds >= policy.increaseAfterSeconds && next.cooldownSeconds <= 0) {
      next.scale = roundScale(Math.min(policy.maximumScale, next.scale + policy.increaseStep));
      next.healthySeconds = 0;
      next.cooldownSeconds = policy.cooldownSeconds;
    }
  } else {
    next.slowSeconds = 0;
    next.healthySeconds = 0;
  }

  return next;
}

export function summarizeFrameTimes(frameTimesMs: readonly number[], hitchThresholdMs = 50): FrameTimingSummary {
  const values = frameTimesMs.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (values.length === 0) {
    return { medianFrameMs: 0, p95FrameMs: 0, maximumFrameMs: 0, hitchCount: 0, sampleCount: 0 };
  }
  const percentile = (ratio: number) => values[Math.min(values.length - 1, Math.ceil(values.length * ratio) - 1)];
  return {
    medianFrameMs: percentile(0.5),
    p95FrameMs: percentile(0.95),
    maximumFrameMs: values[values.length - 1],
    hitchCount: values.filter((value) => value >= hitchThresholdMs).length,
    sampleCount: values.length,
  };
}
