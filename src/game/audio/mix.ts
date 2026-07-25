import type { AudioMix } from '../../state/gameStore';

export type DecisionCuePriority = 'notice' | 'warning' | 'critical' | 'failure';

export interface DecisionDuckProfile {
  ambienceRatio: number;
  musicRatio: number;
  attackSeconds: number;
  holdSeconds: number;
  releaseSeconds: number;
}

export interface DecisionDuckTargets {
  ambience: number;
  music: number;
}

export const MASTERING_COMPRESSOR = {
  threshold: -10,
  knee: 5,
  ratio: 12,
  attack: 0.003,
  release: 0.2,
} as const;

export const DECISION_DUCK_PROFILES: Readonly<Record<DecisionCuePriority, DecisionDuckProfile>> = {
  notice: {
    ambienceRatio: 0.86,
    musicRatio: 0.68,
    attackSeconds: 0.025,
    holdSeconds: 0.2,
    releaseSeconds: 0.28,
  },
  warning: {
    ambienceRatio: 0.7,
    musicRatio: 0.48,
    attackSeconds: 0.02,
    holdSeconds: 0.42,
    releaseSeconds: 0.4,
  },
  critical: {
    ambienceRatio: 0.52,
    musicRatio: 0.3,
    attackSeconds: 0.012,
    holdSeconds: 0.65,
    releaseSeconds: 0.52,
  },
  failure: {
    ambienceRatio: 0.34,
    musicRatio: 0.16,
    attackSeconds: 0.015,
    holdSeconds: 1.1,
    releaseSeconds: 1.05,
  },
};

const DECISION_CUE_RANK: Readonly<Record<DecisionCuePriority, number>> = {
  notice: 0,
  warning: 1,
  critical: 2,
  failure: 3,
};

export function shouldScheduleDecisionCue(
  activePriority: DecisionCuePriority | null,
  activeReleaseAt: number,
  now: number,
  incomingPriority: DecisionCuePriority,
): boolean {
  return activePriority === null
    || now >= activeReleaseAt
    || DECISION_CUE_RANK[incomingPriority] >= DECISION_CUE_RANK[activePriority];
}

export function resolveDecisionDuckTargets(
  mix: AudioMix,
  priority: DecisionCuePriority,
): DecisionDuckTargets {
  const profile = DECISION_DUCK_PROFILES[priority];
  return {
    ambience: mix.ambience * profile.ambienceRatio,
    music: mix.music * profile.musicRatio,
  };
}

export function scheduleDecisionDuck(
  parameter: AudioParam,
  now: number,
  duckTarget: number,
  restoreTarget: number,
  profile: DecisionDuckProfile,
): number {
  const attackEnd = now + profile.attackSeconds;
  const holdEnd = attackEnd + profile.holdSeconds;
  const releaseEnd = holdEnd + profile.releaseSeconds;

  if (typeof parameter.cancelAndHoldAtTime === 'function') parameter.cancelAndHoldAtTime(now);
  else {
    const current = parameter.value;
    parameter.cancelScheduledValues(now);
    parameter.setValueAtTime(current, now);
  }
  parameter.linearRampToValueAtTime(duckTarget, attackEnd);
  parameter.setValueAtTime(duckTarget, holdEnd);
  parameter.linearRampToValueAtTime(restoreTarget, releaseEnd);
  return releaseEnd;
}
