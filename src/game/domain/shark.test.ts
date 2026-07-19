import { describe, expect, it } from 'vitest';
import {
  SHARK_CARCASS_WINDOW_SECONDS,
  SHARK_HARVEST_STAGES,
  SHARK_RESPAWN_SECONDS,
  createDefaultSharkState,
  sanitizeSharkState,
  sharkHarvestStage,
} from './shark';

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
});
