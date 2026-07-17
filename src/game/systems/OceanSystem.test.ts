import { DoubleSide, Texture } from 'three';
import { describe, expect, it } from 'vitest';
import { sampleEnvironment, WEATHER_STAGE_SECONDS } from '../environment/environment';
import { OceanSystem } from './OceanSystem';

describe('OceanSystem underwater surface', () => {
  it('renders both sides of the displaced ocean plane', () => {
    const ocean = new OceanSystem(new Texture());

    expect(ocean.mesh.material.side).toBe(DoubleSide);

    ocean.dispose();
  });

  it('keeps an above-surface cool-light direction for readable storm-night waves', () => {
    const ocean = new OceanSystem(new Texture());
    const stormNight = sampleEnvironment(WEATHER_STAGE_SECONDS * 3.5);

    ocean.update(WEATHER_STAGE_SECONDS * 3.5, stormNight);

    expect(ocean.mesh.material.uniforms.uDaylight).toBeDefined();
    expect(ocean.mesh.material.uniforms.uDaylight.value).toBeLessThan(0.05);
    expect(ocean.mesh.material.uniforms.uSunDirection.value.y).toBeGreaterThan(0);
    expect(ocean.mesh.material.fragmentShader).toContain('nightSheen');
    expect(ocean.mesh.material.fragmentShader).toContain('nightWaveLift');

    ocean.dispose();
  });

  it('flips the lighting normal for the underwater-facing side', () => {
    const ocean = new OceanSystem(new Texture());

    expect(ocean.mesh.material.fragmentShader).toContain('gl_FrontFacing');

    ocean.dispose();
  });
});
