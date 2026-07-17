export type WeatherKind = 'calm' | 'breeze' | 'rain' | 'storm';

export interface EnvironmentSample {
  weather: WeatherKind;
  dayProgress: number;
  daylight: number;
  sunElevation: number;
  sunAzimuth: number;
  windDirectionX: number;
  windDirectionZ: number;
  windStrength: number;
  waveScale: number;
  driftScale: number;
  visibility: number;
  cloudCover: number;
  rainIntensity: number;
  risk: number;
}

interface WeatherProfile {
  windStrength: number;
  waveScale: number;
  driftScale: number;
  visibility: number;
  cloudCover: number;
  rainIntensity: number;
  risk: number;
}

export const DAY_LENGTH_SECONDS = 720;
export const WEATHER_STAGE_SECONDS = 90;
const WEATHER_TRANSITION_SECONDS = 15;

export function parseEnvironmentOffset(value: string | null): number {
  if (value === null || value.trim() === '') return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(DAY_LENGTH_SECONDS, Math.max(0, parsed));
}

const WEATHER_SEQUENCE: readonly WeatherKind[] = ['calm', 'breeze', 'rain', 'storm'];
const WEATHER_PROFILES: Record<WeatherKind, WeatherProfile> = {
  calm: {
    windStrength: 0.2,
    waveScale: 0.78,
    driftScale: 0.82,
    visibility: 1,
    cloudCover: 0.08,
    rainIntensity: 0,
    risk: 0.08,
  },
  breeze: {
    windStrength: 0.5,
    waveScale: 1,
    driftScale: 1,
    visibility: 0.96,
    cloudCover: 0.25,
    rainIntensity: 0,
    risk: 0.25,
  },
  rain: {
    windStrength: 0.72,
    waveScale: 1.2,
    driftScale: 1.16,
    visibility: 0.7,
    cloudCover: 0.72,
    rainIntensity: 0.68,
    risk: 0.58,
  },
  storm: {
    windStrength: 1,
    waveScale: 1.48,
    driftScale: 1.4,
    visibility: 0.42,
    cloudCover: 1,
    rainIntensity: 1,
    risk: 1,
  },
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(value: number): number {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - 2 * clamped);
}

function lerp(from: number, to: number, mix: number): number {
  return from + (to - from) * mix;
}

export interface EnvironmentLighting {
  exposure: number;
  hemisphereIntensity: number;
  ambientIntensity: number;
  sunIntensity: number;
}

export function sampleEnvironmentLighting(environment: EnvironmentSample): EnvironmentLighting {
  const daylight = clamp01(environment.daylight);
  const cloudCover = clamp01(environment.cloudCover);

  return {
    exposure: Math.max(0.68, 0.72 + daylight * 0.38 - cloudCover * 0.04),
    hemisphereIntensity: 0.5 + daylight * 1.32 * (1 - cloudCover * 0.52),
    ambientIntensity: 0.28 + daylight * 0.12,
    sunIntensity: 3.1 * daylight * (1 - cloudCover * 0.78)
      + 0.48 * (1 - daylight) * (1 - cloudCover * 0.15),
  };
}

export function createEnvironmentSample(): EnvironmentSample {
  return {
    weather: 'calm',
    dayProgress: 0,
    daylight: 1,
    sunElevation: 1,
    sunAzimuth: 0,
    windDirectionX: 1,
    windDirectionZ: 0,
    windStrength: WEATHER_PROFILES.calm.windStrength,
    waveScale: WEATHER_PROFILES.calm.waveScale,
    driftScale: WEATHER_PROFILES.calm.driftScale,
    visibility: WEATHER_PROFILES.calm.visibility,
    cloudCover: WEATHER_PROFILES.calm.cloudCover,
    rainIntensity: 0,
    risk: WEATHER_PROFILES.calm.risk,
  };
}

export function sampleEnvironment(
  simulationSeconds: number,
  target: EnvironmentSample = createEnvironmentSample(),
): EnvironmentSample {
  const time = Number.isFinite(simulationSeconds) ? Math.max(0, simulationSeconds) : 0;
  const dayProgress = (time % DAY_LENGTH_SECONDS) / DAY_LENGTH_SECONDS;
  const solarAngle = dayProgress * Math.PI * 2 + Math.PI / 2;
  const sunElevation = Math.sin(solarAngle);
  const daylight = smoothstep((sunElevation + 0.12) / 0.34);

  const absoluteStage = Math.floor(time / WEATHER_STAGE_SECONDS);
  const stageIndex = absoluteStage % WEATHER_SEQUENCE.length;
  const stageTime = time % WEATHER_STAGE_SECONDS;
  const transitionStart = WEATHER_STAGE_SECONDS - WEATHER_TRANSITION_SECONDS;
  const transition = smoothstep((stageTime - transitionStart) / WEATHER_TRANSITION_SECONDS);
  const currentKind = WEATHER_SEQUENCE[stageIndex];
  const nextKind = WEATHER_SEQUENCE[(stageIndex + 1) % WEATHER_SEQUENCE.length];
  const current = WEATHER_PROFILES[currentKind];
  const next = WEATHER_PROFILES[nextKind];

  const windAngle = 0.38 + Math.sin(time / 165) * 0.58 + dayProgress * Math.PI * 0.32;
  target.weather = transition >= 0.5 ? nextKind : currentKind;
  target.dayProgress = dayProgress;
  target.daylight = daylight;
  target.sunElevation = sunElevation;
  target.sunAzimuth = dayProgress * Math.PI * 2 + 0.42;
  target.windDirectionX = Math.cos(windAngle);
  target.windDirectionZ = Math.sin(windAngle);
  target.windStrength = lerp(current.windStrength, next.windStrength, transition);
  target.waveScale = lerp(current.waveScale, next.waveScale, transition);
  target.driftScale = lerp(current.driftScale, next.driftScale, transition);
  target.visibility = lerp(current.visibility, next.visibility, transition);
  target.cloudCover = lerp(current.cloudCover, next.cloudCover, transition);
  target.rainIntensity = lerp(current.rainIntensity, next.rainIntensity, transition);
  target.risk = lerp(current.risk, next.risk, transition);
  return target;
}
