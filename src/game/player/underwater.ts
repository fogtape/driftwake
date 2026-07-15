const SURFACE_BLEND_ABOVE = 0.08;
const FULLY_SUBMERGED_DEPTH = 0.7;
const UNDERWATER_RESPONSE = 7.5;
const AIR_CUTOFF = 18000;
const WATER_CUTOFF = 720;

export function getUnderwaterTarget(cameraY: number, waterY: number): number {
  const depth = waterY + SURFACE_BLEND_ABOVE - cameraY;
  return clamp01(depth / (FULLY_SUBMERGED_DEPTH + SURFACE_BLEND_ABOVE));
}

export function smoothUnderwaterMix(current: number, target: number, deltaSeconds: number): number {
  const safeCurrent = clamp01(current);
  const safeTarget = clamp01(target);
  const delta = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
  const response = 1 - Math.exp(-UNDERWATER_RESPONSE * delta);
  return safeCurrent + (safeTarget - safeCurrent) * response;
}

export function getUnderwaterAudioCutoff(mix: number): number {
  const shapedMix = Math.pow(clamp01(mix), 0.62);
  return AIR_CUTOFF + (WATER_CUTOFF - AIR_CUTOFF) * shapedMix;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
