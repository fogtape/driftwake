import { Color, Mesh, PlaneGeometry, ShaderMaterial, Vector3 } from 'three';
import type { Texture } from 'three';
import { oceanFragmentShader, oceanVertexShader } from '../shaders/ocean';

export class OceanSystem {
  readonly mesh: Mesh<PlaneGeometry, ShaderMaterial>;
  private readonly material: ShaderMaterial;

  constructor(foamMap: Texture) {
    const geometry = new PlaneGeometry(320, 320, 150, 150);
    geometry.rotateX(-Math.PI / 2);

    this.material = new ShaderMaterial({
      vertexShader: oceanVertexShader,
      fragmentShader: oceanFragmentShader,
      uniforms: {
        uTime: { value: 0 },
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

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

