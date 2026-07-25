import { describe, expect, it, vi } from 'vitest';
import type { AudioMix } from '../../state/gameStore';
import {
  DECISION_DUCK_PROFILES,
  MASTERING_COMPRESSOR,
  resolveDecisionDuckTargets,
  scheduleDecisionDuck,
  shouldScheduleDecisionCue,
} from './mix';

const MIX: AudioMix = {
  master: 0.78,
  music: 0.2,
  ambience: 0.43,
  effects: 0.72,
  creatures: 0.78,
  ui: 0.56,
};

describe('audio mix policy', () => {
  it('reserves progressively more room for decision-critical cues', () => {
    const notice = resolveDecisionDuckTargets(MIX, 'notice');
    const warning = resolveDecisionDuckTargets(MIX, 'warning');
    const critical = resolveDecisionDuckTargets(MIX, 'critical');
    const failure = resolveDecisionDuckTargets(MIX, 'failure');

    expect(notice.ambience).toBeLessThan(MIX.ambience);
    expect(warning.ambience).toBeLessThan(notice.ambience);
    expect(critical.ambience).toBeLessThan(warning.ambience);
    expect(failure.ambience).toBeLessThan(critical.ambience);
    expect(notice.music).toBeLessThan(MIX.music);
    expect(warning.music).toBeLessThan(notice.music);
    expect(critical.music).toBeLessThan(warning.music);
    expect(failure.music).toBeLessThan(critical.music);
  });

  it('schedules an attack, hold and exact restoration without timers', () => {
    const calls: Array<[string, number, number?]> = [];
    const parameter = {
      value: MIX.ambience,
      cancelAndHoldAtTime: vi.fn((time: number) => calls.push(['hold-current', time])),
      cancelScheduledValues: vi.fn(),
      setValueAtTime: vi.fn((value: number, time: number) => calls.push(['set', value, time])),
      linearRampToValueAtTime: vi.fn((value: number, time: number) => calls.push(['ramp', value, time])),
    } as unknown as AudioParam;
    const profile = DECISION_DUCK_PROFILES.critical;
    const target = resolveDecisionDuckTargets(MIX, 'critical').ambience;

    const releaseEnd = scheduleDecisionDuck(parameter, 10, target, MIX.ambience, profile);

    expect(calls).toEqual([
      ['hold-current', 10],
      ['ramp', target, 10 + profile.attackSeconds],
      ['set', target, 10 + profile.attackSeconds + profile.holdSeconds],
      ['ramp', MIX.ambience, releaseEnd],
    ]);
    expect(releaseEnd).toBe(10 + profile.attackSeconds + profile.holdSeconds + profile.releaseSeconds);
  });

  it('keeps the mastering compressor fast and below clipping range', () => {
    expect(MASTERING_COMPRESSOR.threshold).toBeLessThanOrEqual(-8);
    expect(MASTERING_COMPRESSOR.ratio).toBeGreaterThanOrEqual(10);
    expect(MASTERING_COMPRESSOR.attack).toBeLessThanOrEqual(0.005);
    expect(MASTERING_COMPRESSOR.release).toBeGreaterThanOrEqual(0.15);
  });

  it('never lets a weaker overlapping cue lift an active critical mix', () => {
    expect(shouldScheduleDecisionCue('critical', 12, 10, 'notice')).toBe(false);
    expect(shouldScheduleDecisionCue('failure', 12, 10, 'critical')).toBe(false);
    expect(shouldScheduleDecisionCue('warning', 12, 10, 'critical')).toBe(true);
    expect(shouldScheduleDecisionCue('critical', 12, 10, 'critical')).toBe(true);
    expect(shouldScheduleDecisionCue('critical', 9, 10, 'notice')).toBe(true);
  });
});
