import type { Vector3 } from 'three';

export const MAX_WATER_KNOCKBACK_SPEED = 3.2;

export function addBoundedWaterImpulse(
  velocity: Vector3,
  normalizedDirection: Vector3,
  strength: number,
): Vector3 {
  const boundedStrength = Number.isFinite(strength) ? Math.max(0, Math.min(5, strength)) : 0;
  if (boundedStrength <= 0) return velocity;
  return velocity
    .addScaledVector(normalizedDirection, boundedStrength)
    .clampLength(0, MAX_WATER_KNOCKBACK_SPEED);
}
