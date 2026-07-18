import { describe, expect, it } from 'vitest';
import {
  RECOVERY_SURVIVAL,
  createFailureRecord,
  detectFailureCause,
  partitionInventoryForFailure,
  sanitizeFailureRecord,
} from './failure';

describe('failure and recovery domain', () => {
  it('keeps every tool and minimum supplies while moving deterministic losses into recovery loot', () => {
    const result = partitionInventoryForFailure({
      hook: 1,
      hammer: 1,
      timber: 10,
      fiber: 2,
      emergencyWater: 2,
      ration: 1,
      emptyCup: 1,
      metalIngot: 1,
    });
    expect(result.retained).toEqual({
      timber: 7,
      fiber: 1,
      emptyCup: 1,
      hook: 1,
      hammer: 1,
      emergencyWater: 1,
      ration: 1,
    });
    expect(result.dropped).toEqual({ timber: 3, fiber: 1, metalIngot: 1, emergencyWater: 1 });
  });

  it('identifies the strongest failure cause without reporting healthy states', () => {
    expect(detectFailureCause({ health: 1, thirst: 0, hunger: 0, oxygen: 0 }, true)).toBeNull();
    expect(detectFailureCause({ health: 0, thirst: 20, hunger: 20, oxygen: 0 }, true)).toBe('drowning');
    expect(detectFailureCause({ health: 0, thirst: 0, hunger: 20, oxygen: 100 }, false)).toBe('dehydration');
    expect(detectFailureCause({ health: 0, thirst: 20, hunger: 0, oxygen: 100 }, false)).toBe('starvation');
    expect(detectFailureCause({ health: 0, thirst: 0, hunger: 0, oxygen: 0 }, true, 'shark')).toBe('shark');
  });

  it('normalizes persisted failure records and only leaves real loot pending', () => {
    expect(createFailureRecord('injury', {}, 12.8)).toEqual({
      cause: 'injury',
      dropped: {},
      occurredAt: 12,
      dropPending: false,
    });
    expect(sanitizeFailureRecord({
      cause: 'shark',
      dropped: { timber: 2.8, madeUp: 9 },
      occurredAt: 31.9,
      dropPending: true,
    })).toEqual({ cause: 'shark', dropped: { timber: 2 }, occurredAt: 31, dropPending: true });
    expect(sanitizeFailureRecord({ cause: 'storm', dropped: { timber: 2 } })).toBeNull();
    expect(RECOVERY_SURVIVAL).toEqual({ health: 62, thirst: 44, hunger: 48, oxygen: 100 });
  });
});
