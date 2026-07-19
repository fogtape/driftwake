export const RESONANCE_CHARGE_SECONDS = 1.25;
export const RESONANCE_COOLDOWN_SECONDS = 0.52;
export const RESONANCE_REACH = 7.4;
export const RESONANCE_MIN_REACH = 0.4;
export const RESONANCE_AIM_DOT = 0.56;
export const RESONANCE_DAMAGE = 8;

export type ResonanceDischargeResult = 'cancelled' | 'no-cell' | 'miss' | 'hit';

export interface ResonanceTargetSample {
  active: boolean;
  visible: boolean;
  mode: string;
  distance: number;
  alignment: number;
}

export function resonanceChargeProgress(elapsedSeconds: number): number {
  if (!Number.isFinite(elapsedSeconds)) return 0;
  return Math.max(0, Math.min(1, elapsedSeconds / RESONANCE_CHARGE_SECONDS));
}

export function isResonanceTarget(sample: ResonanceTargetSample): boolean {
  return sample.active
    && sample.visible
    && (sample.mode === 'approaching' || sample.mode === 'attacking')
    && Number.isFinite(sample.distance)
    && sample.distance >= RESONANCE_MIN_REACH
    && sample.distance <= RESONANCE_REACH
    && Number.isFinite(sample.alignment)
    && sample.alignment >= RESONANCE_AIM_DOT;
}

export function resolveResonanceDischarge(
  charge: number,
  hasCell: boolean,
  targetLocked: boolean,
): ResonanceDischargeResult {
  if (!Number.isFinite(charge) || charge < 1) return 'cancelled';
  if (!hasCell) return 'no-cell';
  return targetLocked ? 'hit' : 'miss';
}
