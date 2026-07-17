import { Color, DoubleSide, Mesh, PlaneGeometry, ShaderMaterial, Vector3 } from 'three';
import type { Texture } from 'three';
import type { DayCycleSample } from '../environment/environment';
import { oceanFragmentShader, oceanVertexShader } from '../shaders/ocean';

export class OceanSystem {
  readonly mesh: Mesh<PlaneGeometry, ShaderMaterial>;
  private readonly material: ShaderMaterial;
  private readonly dayDeep = new Color('#063d52');
  private readonly nightDeep = new Color('#061522');
  private readonly daySurface = new Color('#1b8790');
  private readonly nightSurface = new Color('#123246');
  private readonly daySky = new Color('#91cad2');
  private readonly nightSky = new Color('#07101f');
  private readonly dayFog = new Color('#a9cfd2');
  private readonly nightFog = new Color('#0a1424');
  private readonly sunDirection = new Vector3();

  constructor(foamMap: Texture) {
    const geometry = new PlaneGeometry(320, 320, 150, 150);
    geometry.rotateX(-Math.PI / 2);

    this.material = new ShaderMaterial({
      vertexShader: oceanVertexShader,
      fragmentShader: oceanFragmentShader,
      side: DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uFoamMap: { value: foamMap },
        uSunDirection: { value: new Vector3(0.56, 0.72, 0.4).normalize() },
        uDeepColor: { value: new Color('#063d52') },
        uSurfaceColor: { value: new Color('#1b8790') },
        uSkyColor: { value: new Color('#91cad2') },
        uFogColor: { value: new Color('#a9cfd2') },
        uUnderwater: { value: 0 },
        uStorm: { value: 0 },
        uDaylight: { value: 1 },
      },
    });

    this.mesh = new Mesh(geometry, this.material);
    this.mesh.name = 'procedural-ocean';
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
  }

  update(time: number): void {
    this.material.uniforms.uTime.value = time;
  }

  setQuality(highQuality: boolean): void {
    this.mesh.geometry.dispose();
    const segments = highQuality ? 150 : 84;
    const geometry = new PlaneGeometry(320, 320, segments, segments);
    geometry.rotateX(-Math.PI / 2);
    this.mesh.geometry = geometry;
  }

  setUnderwater(blend: number): void {
    this.material.uniforms.uUnderwater.value = Math.max(0, Math.min(1, blend));
  }

  setStorm(blend: number): void {
    this.material.uniforms.uStorm.value = Math.max(0, Math.min(1, blend));
  }

  setEnvironment(day: DayCycleSample): void {
    const daylight = Math.max(0, Math.min(1, day.daylight));
    const horizontal = Math.sqrt(Math.max(0, 1 - day.sunElevation * day.sunElevation));
    this.sunDirection.set(
      Math.cos(day.sunAzimuth) * horizontal,
      Math.max(0.18, day.sunElevation),
      Math.sin(day.sunAzimuth) * horizontal,
    ).normalize();
    this.material.uniforms.uSunDirection.value.copy(this.sunDirection);
    this.material.uniforms.uDaylight.value = daylight;
    this.material.uniforms.uDeepColor.value.lerpColors(this.nightDeep, this.dayDeep, daylight);
    this.material.uniforms.uSurfaceColor.value.lerpColors(this.nightSurface, this.daySurface, daylight);
    this.material.uniforms.uSkyColor.value.lerpColors(this.nightSky, this.daySky, daylight);
    this.material.uniforms.uFogColor.value.lerpColors(this.nightFog, this.dayFog, daylight);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
