import { describe, expect, it } from 'vitest';
import {
  SHARK_CARCASS_WINDOW_SECONDS,
  SHARK_COUNTER_CLOSE_LEAD_SECONDS,
  SHARK_HARVEST_STAGES,
  SHARK_RESPAWN_SECONDS,
  RAFT_SHARK_ATTACK_RHYTHM,
  WATER_SHARK_ATTACK_RHYTHM,
  createDefaultSharkState,
  sampleSharkAttack,
  sanitizeSharkState,
  sharkHarvestStage,
} from './shark';
import { SPEAR_THRUST_TO_IMPACT_SECONDS } from './combat';

describe('shark lifecycle domain', () => {
  it('keeps the four harvest stages deterministic and finite', () => {
    expect(SHARK_HARVEST_STAGES.map((stage) => stage.loot)).toEqual([
      { sharkMeat: 1 },
      { sharkMeat: 1 },
      { sharkMeat: 1, sharkHide: 1 },
      { sharkTooth: 2 },
    ]);
    expect(sharkHarvestStage(3)?.label).toBe('深潮齿板');
    expect(sharkHarvestStage(4)).toBeNull();
  });

  it('sanitizes active, carcass and cooldown state without reviving completed carcasses', () => {
    expect(sanitizeSharkState(null)).toEqual(createDefaultSharkState());
    expect(sanitizeSharkState({ lifecycle: 'active', health: 37 })).toMatchObject({
      lifecycle: 'active',
      health: 37,
    });
    expect(sanitizeSharkState({
      lifecycle: 'carcass',
      x: 999,
      z: -999,
      harvestIndex: 2.8,
      remainingSeconds: 999,
    })).toEqual({
      lifecycle: 'carcass',
      health: 0,
      x: 48,
      z: -48,
      harvestIndex: 2,
      remainingSeconds: SHARK_CARCASS_WINDOW_SECONDS,
    });
    expect(sanitizeSharkState({
      lifecycle: 'carcass',
      harvestIndex: SHARK_HARVEST_STAGES.length,
      remainingSeconds: 12,
    })).toMatchObject({
      lifecycle: 'cooldown',
      health: 0,
      remainingSeconds: SHARK_RESPAWN_SECONDS,
    });
    expect(sanitizeSharkState({ lifecycle: 'cooldown', remainingSeconds: 0 })).toEqual(createDefaultSharkState());
  });

  it('telegraphs both raft bites before impact and finishes in recovery order', () => {
    const opening = sampleSharkAttack(RAFT_SHARK_ATTACK_RHYTHM, 0.4, 0);
    expect(opening).toMatchObject({
      phase: 'windup',
      nextBiteIndex: 0,
      biteDue: false,
      counterWindow: true,
    });
    expect(opening.secondsToImpact).toBeCloseTo(0.56, 6);
    expect(opening.progress).toBeGreaterThan(0.4);

    expect(sampleSharkAttack(RAFT_SHARK_ATTACK_RHYTHM, 0.96, 0)).toMatchObject({
      phase: 'impact',
      biteDue: true,
      nextBiteIndex: 0,
    });
    expect(sampleSharkAttack(RAFT_SHARK_ATTACK_RHYTHM, 1.4, 1).phase).toBe('recovery');
    expect(sampleSharkAttack(RAFT_SHARK_ATTACK_RHYTHM, 2.2, 1)).toMatchObject({
      phase: 'windup',
      nextBiteIndex: 1,
      biteDue: false,
    });
    expect(sampleSharkAttack(RAFT_SHARK_ATTACK_RHYTHM, 3.6, 2).phase).toBe('complete');
  });

  it('closes the counter prompt early enough for the spear thrust to resolve fairly', () => {
    expect(SHARK_COUNTER_CLOSE_LEAD_SECONDS).toBeGreaterThan(SPEAR_THRUST_TO_IMPACT_SECONDS);
    const safeInput = RAFT_SHARK_ATTACK_RHYTHM.biteTimes[0] - SHARK_COUNTER_CLOSE_LEAD_SECONDS - 0.01;
    const lateInput = RAFT_SHARK_ATTACK_RHYTHM.biteTimes[0] - SHARK_COUNTER_CLOSE_LEAD_SECONDS + 0.01;
    expect(sampleSharkAttack(RAFT_SHARK_ATTACK_RHYTHM, safeInput, 0).counterWindow).toBe(true);
    expect(sampleSharkAttack(RAFT_SHARK_ATTACK_RHYTHM, lateInput, 0).counterWindow).toBe(false);
    const resolvedStrike = sampleSharkAttack(
      RAFT_SHARK_ATTACK_RHYTHM,
      safeInput + SPEAR_THRUST_TO_IMPACT_SECONDS,
      0,
    );
    expect(resolvedStrike.counterWindow).toBe(false);
    expect(resolvedStrike.counterStrikeWindow).toBe(true);
  });

  it('limits a water pass to two readable impacts', () => {
    expect(WATER_SHARK_ATTACK_RHYTHM.biteTimes).toHaveLength(2);
    expect(sampleSharkAttack(WATER_SHARK_ATTACK_RHYTHM, 0.32, 0)).toMatchObject({
      phase: 'windup',
      nextBiteIndex: 0,
      counterWindow: true,
    });
    expect(sampleSharkAttack(WATER_SHARK_ATTACK_RHYTHM, 0.88, 0).biteDue).toBe(true);
    expect(sampleSharkAttack(WATER_SHARK_ATTACK_RHYTHM, 2, 1).phase).toBe('recovery');
    expect(sampleSharkAttack(WATER_SHARK_ATTACK_RHYTHM, 2.6, 1)).toMatchObject({
      phase: 'windup',
      nextBiteIndex: 1,
    });
    expect(sampleSharkAttack(WATER_SHARK_ATTACK_RHYTHM, 4.2, 2).phase).toBe('complete');
  });
});
