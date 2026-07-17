import { Color, DoubleSide, Mesh, PlaneGeometry, ShaderMaterial, Vector3 } from 'three';
import type { Texture } from 'three';
import type { EnvironmentSample } from '../environment/environment';
import { oceanFragmentShader, oceanVertexShader } from '../shaders/ocean';

const OCEAN_EXTENT = 320;

export class OceanSystem {
  readonly mesh: Mesh<PlaneGeometry, ShaderMaterial>;
  private readonly material: ShaderMaterial;
  private readonly sunDirection = new Vector3();
  private readonly dayDeep = new Color('#063d52');
  private readonly nightDeep = new Color('#061522');
  private readonly stormDeep = new Color('#0c2a36');
  private readonly daySurface = new Color('#1b8790');
  private readonly nightSurface = new Color('#123246');
  private readonly stormSurface = new Color('#285868');
  private readonly daySky = new Color('#91cad2');
  private readonly nightSky = new Color('#07101f');
  private readonly stormSky = new Color('#334753');
  private readonly dayFog = new Color('#a9cfd2');
  private readonly nightFog = new Color('#0a1424');
  private readonly stormFog = new Color('#526671');

  constructor(foamMap: Texture) {
    const geometry = new PlaneGeometry(OCEAN_EXTENT, OCEAN_EXTENT, 150, 150);
    geometry.rotateX(-Math.PI / 2);

    this.material = new ShaderMaterial({
      vertexShader: oceanVertexShader,
      fragmentShader: oceanFragmentShader,
      side: DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uWaveScale: { value: 1 },
        uDaylight: { value: 1 },
        uFoamMap: { value: foamMap },
        uSunDirection: { value: new Vector3(0.56, 0.72, 0.4).normalize() },
        uDeepColor: { value: new Color('#063d52') },
        uSurfaceColor: { value: new Color('#1b8790') },
        uSkyColor: { value: new Color('#91cad2') },
        uFogColor: { value: new Color('#a9cfd2') },
      },
    });

    this.mesh = new Mesh(geometry, this.material);
    this.mesh.name = 'procedural-ocean';
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
  }

  update(time: number, environment: EnvironmentSample): void {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uWaveScale.value = environment.waveScale;
    this.material.uniforms.uDaylight.value = environment.daylight;
    const cloudMix = environment.cloudCover * 0.72;
    const horizontal = Math.sqrt(Math.max(0, 1 - environment.sunElevation * environment.sunElevation));
    this.sunDirection.set(
      Math.cos(environment.sunAzimuth) * horizontal,
      Math.max(0.18, environment.sunElevation),
      Math.sin(environment.sunAzimuth) * horizontal,
    ).normalize();
    this.material.uniforms.uSunDirection.value.copy(this.sunDirection);
    this.material.uniforms.uDeepColor.value
      .lerpColors(this.nightDeep, this.dayDeep, environment.daylight)
      .lerp(this.stormDeep, cloudMix);
    this.material.uniforms.uSurfaceColor.value
      .lerpColors(this.nightSurface, this.daySurface, environment.daylight)
      .lerp(this.stormSurface, cloudMix);
    this.material.uniforms.uSkyColor.value
      .lerpColors(this.nightSky, this.daySky, environment.daylight)
      .lerp(this.stormSky, cloudMix);
    this.material.uniforms.uFogColor.value
      .lerpColors(this.nightFog, this.dayFog, environment.daylight)
      .lerp(this.stormFog, cloudMix);
  }

  setQuality(highQuality: boolean): void {
    this.mesh.geometry.dispose();
    const segments = highQuality ? 150 : 84;
    const geometry = new PlaneGeometry(OCEAN_EXTENT, OCEAN_EXTENT, segments, segments);
    geometry.rotateX(-Math.PI / 2);
    this.mesh.geometry = geometry;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
