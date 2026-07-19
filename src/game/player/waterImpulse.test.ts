import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { addBoundedWaterImpulse, MAX_WATER_KNOCKBACK_SPEED } from './waterImpulse';

describe('water knockback accumulation', () => {
  it('preserves a single shark hit but caps repeated impulses', () => {
    const velocity = new Vector3();
    const direction = new Vector3(1, 0.12, 1).normalize();

    addBoundedWaterImpulse(velocity, direction, 2.65);
    expect(velocity.length()).toBeCloseTo(2.65, 6);

    for (let hit = 0; hit < 12; hit += 1) addBoundedWaterImpulse(velocity, direction, 2.65);
    expect(velocity.length()).toBeCloseTo(MAX_WATER_KNOCKBACK_SPEED, 6);
  });

  it('ignores invalid strength without contaminating movement', () => {
    const velocity = new Vector3(0.4, 0, -0.2);
    addBoundedWaterImpulse(velocity, new Vector3(1, 0, 0), Number.NaN);
    expect(velocity.toArray()).toEqual([0.4, 0, -0.2]);
  });
});
