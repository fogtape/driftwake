export interface WaveSample {
  height: number;
  slopeX: number;
  slopeZ: number;
}

interface WaveComponent {
  directionX: number;
  directionZ: number;
  frequency: number;
  amplitude: number;
  speed: number;
  phase: number;
}

export const WAVE_COMPONENTS: readonly WaveComponent[] = [
  { directionX: 0.94, directionZ: 0.34, frequency: 0.38, amplitude: 0.26, speed: 0.92, phase: 0.0 },
  { directionX: -0.22, directionZ: 0.98, frequency: 0.71, amplitude: 0.12, speed: 1.34, phase: 1.7 },
  { directionX: 0.62, directionZ: -0.78, frequency: 1.18, amplitude: 0.055, speed: 1.82, phase: 4.1 },
] as const;

export function sampleWave(x: number, z: number, time: number, amplitudeScale = 1): WaveSample {
  let height = 0;
  let slopeX = 0;
  let slopeZ = 0;
  const scale = Number.isFinite(amplitudeScale) ? Math.max(0, amplitudeScale) : 1;

  for (const wave of WAVE_COMPONENTS) {
    const theta =
      (x * wave.directionX + z * wave.directionZ) * wave.frequency +
      time * wave.speed +
      wave.phase;
    const sinTheta = Math.sin(theta);
    const amplitude = wave.amplitude * scale;
    const derivative = Math.cos(theta) * amplitude * wave.frequency;
    height += sinTheta * amplitude;
    slopeX += derivative * wave.directionX;
    slopeZ += derivative * wave.directionZ;
  }

  return { height, slopeX, slopeZ };
}

export function sampleWaveHeight(x: number, z: number, time: number, amplitudeScale = 1): number {
  return sampleWave(x, z, time, amplitudeScale).height;
}

