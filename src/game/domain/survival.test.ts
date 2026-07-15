import { describe, expect, it } from 'vitest';
import { advanceSurvival, consumeItem } from './survival';

describe('survival domain', () => {
  it('drains needs deterministically and only damages health after deprivation', () => {
    expect(advanceSurvival({ health: 80, thirst: 50, hunger: 50, oxygen: 100 }, 10)).toEqual({
      health: 80,
      thirst: 49.48,
      hunger: 49.68,
      oxygen: 100,
    });
    expect(advanceSurvival({ health: 80, thirst: 0, hunger: 10, oxygen: 100 }, 10).health).toBeCloseTo(78.2);
  });

  it('drains oxygen underwater, damages only after depletion, and recovers at the surface', () => {
    const drowning = advanceSurvival({ health: 100, thirst: 60, hunger: 60, oxygen: 5 }, 4, true);
    expect(drowning.oxygen).toBe(0);
    expect(drowning.health).toBeCloseTo(88.78, 1);
    const breathing = advanceSurvival({ ...drowning, oxygen: 20 }, 3, false);
    expect(breathing.oxygen).toBe(74);
    expect(breathing.health).toBeGreaterThan(drowning.health);
  });

  it('applies consumable tradeoffs and clamps values', () => {
    const water = consumeItem({ health: 98, thirst: 80, hunger: 70, oxygen: 64 }, 'emergencyWater');
    expect(water.survival.thirst).toBe(100);
    const rawFish = consumeItem(water.survival, 'rawFish');
    expect(rawFish.survival.health).toBe(90);
    expect(rawFish.survival.hunger).toBe(79);
    const freshWater = consumeItem({ health: 75, thirst: 20, hunger: 30, oxygen: 64 }, 'freshWaterCup');
    expect(freshWater.survival).toEqual({ health: 76, thirst: 62, hunger: 30, oxygen: 64 });
    const fruit = consumeItem({ health: 70, thirst: 40, hunger: 40, oxygen: 64 }, 'palmFruit');
    expect(fruit.survival).toEqual({ health: 71, thirst: 52, hunger: 58, oxygen: 64 });
  });
});
