export const DAY_LENGTH_SECONDS = 720;

export interface DayCycleSample {
  progress: number;
  daylight: number;
  sunElevation: number;
  sunAzimuth: number;
}

export interface EnvironmentLighting {
  exposure: number;
  hemisphereIntensity: number;
  ambientIntensity: number;
  keyIntensity: number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(value: number): number {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - 2 * clamped);
}

export function sampleDayCycle(worldSeconds: number): DayCycleSample {
  const seconds = Number.isFinite(worldSeconds) ? Math.max(0, worldSeconds) : 0;
  const progress = (seconds % DAY_LENGTH_SECONDS) / DAY_LENGTH_SECONDS;
  const solarAngle = progress * Math.PI * 2 + 0.8;
  const sunElevation = Math.sin(solarAngle);
  return {
    progress,
    daylight: smoothstep((sunElevation + 0.12) / 0.34),
    sunElevation,
    sunAzimuth: progress * Math.PI * 2 + 0.62,
  };
}

export function sampleEnvironmentLighting(daylightValue: number, stormValue: number): EnvironmentLighting {
  const daylight = clamp01(daylightValue);
  const storm = clamp01(stormValue);
  return {
    exposure: Math.max(0.68, 0.72 + daylight * 0.38 - storm * 0.08),
    hemisphereIntensity: 0.52 + daylight * 1.3 * (1 - storm * 0.52),
    ambientIntensity: 0.3 + daylight * 0.1 + storm * 0.08,
    keyIntensity: 3.1 * daylight * (1 - storm * 0.8) + 0.46 * (1 - daylight),
  };
}
