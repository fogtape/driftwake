import { describe, expect, it } from 'vitest';
import {
  DAY_LENGTH_SECONDS,
  WEATHER_STAGE_SECONDS,
  createEnvironmentSample,
  parseEnvironmentOffset,
  sampleEnvironment,
  sampleEnvironmentLighting,
} from './environment';

describe('sampleEnvironment', () => {
  it('is deterministic and can reuse a caller-owned output object', () => {
    const reusable = createEnvironmentSample();
    const first = sampleEnvironment(137.25, reusable);
    const second = sampleEnvironment(137.25, reusable);

    expect(first).toBe(reusable);
    expect(second).toBe(reusable);
    expect(second.weather).toBe('breeze');
    expect(Number.isFinite(second.windDirectionX)).toBe(true);
    expect(Number.isFinite(second.windDirectionZ)).toBe(true);
    expect(Math.hypot(second.windDirectionX, second.windDirectionZ)).toBeCloseTo(1, 6);
  });

  it('starts near daylight and reaches night halfway through the cycle', () => {
    const noon = sampleEnvironment(0);
    const midnight = sampleEnvironment(DAY_LENGTH_SECONDS / 2);

    expect(noon.daylight).toBeGreaterThan(0.95);
    expect(noon.sunElevation).toBeGreaterThan(0.9);
    expect(midnight.daylight).toBeLessThan(0.05);
    expect(midnight.sunElevation).toBeLessThan(-0.9);
  });

  it('cycles through calm, breeze, rain and storm with increasing pressure', () => {
    const calm = sampleEnvironment(WEATHER_STAGE_SECONDS * 0.5);
    const breeze = sampleEnvironment(WEATHER_STAGE_SECONDS * 1.5);
    const rain = sampleEnvironment(WEATHER_STAGE_SECONDS * 2.5);
    const storm = sampleEnvironment(WEATHER_STAGE_SECONDS * 3.5);

    expect([calm.weather, breeze.weather, rain.weather, storm.weather]).toEqual([
      'calm',
      'breeze',
      'rain',
      'storm',
    ]);
    expect(calm.waveScale).toBeLessThan(breeze.waveScale);
    expect(breeze.waveScale).toBeLessThan(rain.waveScale);
    expect(rain.waveScale).toBeLessThan(storm.waveScale);
    expect(storm.driftScale).toBeGreaterThan(calm.driftScale);
    expect(storm.rainIntensity).toBe(1);
    expect(storm.risk).toBe(1);
  });

  it('blends continuously into the next weather stage', () => {
    const beforeBoundary = sampleEnvironment(WEATHER_STAGE_SECONDS - 0.01);
    const afterBoundary = sampleEnvironment(WEATHER_STAGE_SECONDS + 0.01);

    expect(Math.abs(beforeBoundary.waveScale - afterBoundary.waveScale)).toBeLessThan(0.01);
    expect(Math.abs(beforeBoundary.windStrength - afterBoundary.windStrength)).toBeLessThan(0.01);
    expect(Math.abs(beforeBoundary.visibility - afterBoundary.visibility)).toBeLessThan(0.01);
  });

  it('keeps storm-night surfaces readable without flattening daylight contrast', () => {
    const stormNight = sampleEnvironment(WEATHER_STAGE_SECONDS * 3.5);
    const stormLighting = sampleEnvironmentLighting(stormNight);
    const daylightLighting = sampleEnvironmentLighting(sampleEnvironment(0));

    expect(stormNight.weather).toBe('storm');
    expect(stormNight.daylight).toBeLessThan(0.05);
    expect(stormLighting.exposure).toBeGreaterThanOrEqual(0.68);
    expect(stormLighting.hemisphereIntensity).toBeGreaterThanOrEqual(0.5);
    expect(stormLighting.ambientIntensity).toBeGreaterThanOrEqual(0.28);
    expect(stormLighting.sunIntensity).toBeGreaterThanOrEqual(0.4);
    expect(daylightLighting.exposure).toBeGreaterThan(1);
    expect(daylightLighting.hemisphereIntensity).toBeGreaterThan(1.7);
    expect(daylightLighting.sunIntensity).toBeGreaterThan(2.8);
  });

  it('sanitizes invalid and negative simulation time', () => {
    expect(sampleEnvironment(-10)).toEqual(sampleEnvironment(0));
    expect(sampleEnvironment(Number.NaN)).toEqual(sampleEnvironment(0));
  });

  it('sanitizes local validation offsets', () => {
    expect(parseEnvironmentOffset(null)).toBe(0);
    expect(parseEnvironmentOffset('not-a-number')).toBe(0);
    expect(parseEnvironmentOffset('-8')).toBe(0);
    expect(parseEnvironmentOffset('315')).toBe(315);
    expect(parseEnvironmentOffset('9999')).toBe(DAY_LENGTH_SECONDS);
  });
});
