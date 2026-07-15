import { describe, expect, it } from 'vitest';
import { advanceSurvival, consumeItem } from './survival';

describe('survival domain', () => {
  it('drains needs deterministically and only damages health after deprivation', () => {
    expect(advanceSurvival({ health: 80, thirst: 50, hunger: 50 }, 10)).toEqual({
      health: 80,
      thirst: 49.48,
      hunger: 49.68,
    });
    expect(advanceSurvival({ health: 80, thirst: 0, hunger: 10 }, 10).health).toBeCloseTo(78.2);
  });

  it('applies consumable tradeoffs and clamps values', () => {
    const water = consumeItem({ health: 98, thirst: 80, hunger: 70 }, 'emergencyWater');
    expect(water.survival.thirst).toBe(100);
    const rawFish = consumeItem(water.survival, 'rawFish');
    expect(rawFish.survival.health).toBe(90);
    expect(rawFish.survival.hunger).toBe(79);
    const freshWater = consumeItem({ health: 75, thirst: 20, hunger: 30 }, 'freshWaterCup');
    expect(freshWater.survival).toEqual({ health: 76, thirst: 62, hunger: 30 });
  });
});
