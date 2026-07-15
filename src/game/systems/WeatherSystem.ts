import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  MathUtils,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
} from 'three';
import type { EnvironmentSample } from '../environment/environment';
import { createSeededRandom, randomRange } from '../math/random';

const HIGH_QUALITY_DROP_COUNT = 900;
const LOW_QUALITY_DROP_COUNT = 420;
const RAIN_RADIUS = 18;
const RAIN_FLOOR = -8;
const RAIN_CEILING = 18;

export class WeatherSystem {
  private readonly geometry = new BufferGeometry();
  private readonly material = new PointsMaterial({
    color: new Color('#c8e4e7'),
    size: 0.055,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    sizeAttenuation: true,
  });
  private readonly rain: Points<BufferGeometry, PointsMaterial>;
  private readonly positions = new Float32Array(HIGH_QUALITY_DROP_COUNT * 3);
  private readonly random = createSeededRandom(0x7a1f4d2);
  private qualityDropCount = HIGH_QUALITY_DROP_COUNT;

  constructor(private readonly scene: Scene) {
    for (let index = 0; index < HIGH_QUALITY_DROP_COUNT; index += 1) {
      const offset = index * 3;
      this.positions[offset] = randomRange(this.random, -RAIN_RADIUS, RAIN_RADIUS);
      this.positions[offset + 1] = randomRange(this.random, RAIN_FLOOR, RAIN_CEILING);
      this.positions[offset + 2] = randomRange(this.random, -RAIN_RADIUS, RAIN_RADIUS);
    }
    const positionAttribute = new BufferAttribute(this.positions, 3);
    positionAttribute.setUsage(DynamicDrawUsage);
    this.geometry.setAttribute('position', positionAttribute);
    this.geometry.setDrawRange(0, 0);
    this.rain = new Points(this.geometry, this.material);
    this.rain.name = 'procedural-rain';
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.scene.add(this.rain);
  }

  update(deltaSeconds: number, camera: PerspectiveCamera, environment: EnvironmentSample): void {
    const intensity = environment.rainIntensity;
    this.rain.visible = intensity > 0.025;
    if (!this.rain.visible) {
      this.geometry.setDrawRange(0, 0);
      return;
    }

    const dropCount = Math.max(1, Math.floor(this.qualityDropCount * MathUtils.lerp(0.28, 1, intensity)));
    const fallDistance = (9.5 + environment.windStrength * 5.5) * deltaSeconds;
    const windX = environment.windDirectionX * environment.windStrength * deltaSeconds * 4.2;
    const windZ = environment.windDirectionZ * environment.windStrength * deltaSeconds * 4.2;
    for (let index = 0; index < dropCount; index += 1) {
      const offset = index * 3;
      this.positions[offset] += windX;
      this.positions[offset + 1] -= fallDistance;
      this.positions[offset + 2] += windZ;
      if (this.positions[offset + 1] < RAIN_FLOOR) {
        this.positions[offset + 1] += RAIN_CEILING - RAIN_FLOOR;
        this.positions[offset] = randomRange(this.random, -RAIN_RADIUS, RAIN_RADIUS);
        this.positions[offset + 2] = randomRange(this.random, -RAIN_RADIUS, RAIN_RADIUS);
      }
      if (this.positions[offset] > RAIN_RADIUS) this.positions[offset] -= RAIN_RADIUS * 2;
      if (this.positions[offset] < -RAIN_RADIUS) this.positions[offset] += RAIN_RADIUS * 2;
      if (this.positions[offset + 2] > RAIN_RADIUS) this.positions[offset + 2] -= RAIN_RADIUS * 2;
      if (this.positions[offset + 2] < -RAIN_RADIUS) this.positions[offset + 2] += RAIN_RADIUS * 2;
    }
    const positionAttribute = this.geometry.getAttribute('position') as BufferAttribute;
    positionAttribute.needsUpdate = true;
    this.geometry.setDrawRange(0, dropCount);
    this.rain.position.set(camera.position.x, camera.position.y, camera.position.z);
    this.material.opacity = MathUtils.lerp(0.18, 0.72, intensity);
    this.material.size = MathUtils.lerp(0.045, 0.07, intensity);
  }

  setQuality(highQuality: boolean): void {
    this.qualityDropCount = highQuality ? HIGH_QUALITY_DROP_COUNT : LOW_QUALITY_DROP_COUNT;
  }

  dispose(): void {
    this.scene.remove(this.rain);
    this.geometry.dispose();
    this.material.dispose();
  }
}
