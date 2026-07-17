import {
  BackSide,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PerspectiveCamera,
  Quaternion,
  Scene,
  SphereGeometry,
  Texture,
  Vector3,
} from 'three';
import { createSeededRandom, randomRange } from '../math/random';

const STREAK_COUNT = 420;
const CLOUD_BASE = new Color(0xd0d9d6);
const CLOUD_FLASH = new Color(0xe5efeb);
const RAIN_COLOR = new Color(0xa9bfbd);
const RAIN_AXIS = new Vector3(0, 0, 1);

export class StormSystem {
  private readonly cloudGeometry = new SphereGeometry(168, 40, 22);
  private readonly cloudMaterial: MeshBasicMaterial;
  private readonly cloudDome: Mesh;
  private readonly rainGeometry = new PlaneGeometry(1, 1);
  private readonly rainMaterial = new MeshBasicMaterial({
    color: new Color(0xc1d8d3),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
    side: DoubleSide,
  });
  private readonly rain = new InstancedMesh(this.rainGeometry, this.rainMaterial, STREAK_COUNT);
  private readonly offsets = new Float32Array(STREAK_COUNT * 5);
  private readonly rainMatrix = new Matrix4();
  private readonly rainPosition = new Vector3();
  private readonly rainScale = new Vector3();
  private readonly rainRotation = new Quaternion();
  private previousFlash = 0;

  constructor(
    private readonly scene: Scene,
    private readonly camera: PerspectiveCamera,
    private readonly cloudTexture: Texture,
    private readonly onThunder: (strength: number) => void,
  ) {
    this.cloudMaterial = new MeshBasicMaterial({
      color: CLOUD_BASE,
      map: this.cloudTexture,
      side: BackSide,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    });
    this.cloudDome = new Mesh(this.cloudGeometry, this.cloudMaterial);
    this.cloudDome.name = 'storm-cloud-dome';
    this.cloudDome.frustumCulled = false;
    this.cloudDome.renderOrder = -20;
    this.cloudDome.visible = false;
    this.cloudDome.rotation.z = -0.08;
    const random = createSeededRandom(0x57a2d4);
    const rainColor = new Color();
    for (let index = 0; index < STREAK_COUNT; index += 1) {
      const offset = index * 5;
      this.offsets[offset] = randomRange(random, -0.86, 0.86);
      this.offsets[offset + 1] = randomRange(random, -26, -2.6);
      this.offsets[offset + 2] = randomRange(random, 0, 28);
      this.offsets[offset + 3] = randomRange(random, 0.52, 1.3);
      this.offsets[offset + 4] = randomRange(random, 0.82, 1.24);
      const depthFade = 0.62 + (-this.offsets[offset + 1] / 26) * 0.24;
      rainColor.copy(RAIN_COLOR).multiplyScalar(depthFade * randomRange(random, 0.78, 1.04));
      this.rain.setColorAt(index, rainColor);
    }
    this.rain.instanceMatrix.setUsage(DynamicDrawUsage);
    if (this.rain.instanceColor) this.rain.instanceColor.needsUpdate = true;
    this.rain.name = 'storm-rain-field';
    this.rain.frustumCulled = false;
    this.rain.renderOrder = 20;
    this.rain.visible = false;
    this.scene.add(this.cloudDome);
    this.camera.add(this.rain);
  }

  setQuality(highQuality: boolean): void {
    this.rain.count = highQuality ? 330 : 160;
  }

  update(time: number, intensity: number, gust: number): number {
    const strength = Math.max(0, Math.min(1, intensity));
    this.cloudDome.visible = strength > 0.015;
    this.cloudDome.position.copy(this.camera.position);
    this.cloudDome.rotation.y = time * 0.0034 + gust * 0.025;
    this.cloudTexture.offset.x = (time * 0.0017 + gust * 0.008 + 1) % 1;
    this.cloudTexture.offset.y = (time * 0.00045 + 1) % 1;
    this.cloudMaterial.opacity = Math.min(0.96, strength * 1.03);
    this.rain.visible = strength > 0.025;
    this.rainMaterial.opacity = strength * 0.44;
    if (this.rain.visible) {
      for (let index = 0; index < this.rain.count; index += 1) {
        const source = index * 5;
        const fall = (time * (13 + this.offsets[source + 4] * 4.5) + this.offsets[source + 2]) % 28;
        const fallUnit = fall / 28;
        const z = this.offsets[source + 1];
        const depth = -z;
        const halfHeight = depth * 0.7;
        const y = halfHeight - fallUnit * halfHeight * 2;
        const slant = gust * (0.22 + strength * 0.34);
        const x = this.offsets[source] * depth * 1.04 + slant * fallUnit * depth * 0.28;
        const length = depth * (0.017 + this.offsets[source + 3] * 0.022) * (0.7 + strength * 0.3);
        this.rainPosition.set(x, y, z);
        this.rainScale.set(depth * 0.00105, length, 1);
        this.rainRotation.setFromAxisAngle(RAIN_AXIS, Math.atan(slant * 0.46));
        this.rainMatrix.compose(this.rainPosition, this.rainRotation, this.rainScale);
        this.rain.setMatrixAt(index, this.rainMatrix);
      }
      this.rain.instanceMatrix.needsUpdate = true;
    }

    const phase = time % 15.7;
    const first = Math.max(0, 1 - Math.abs(phase - 0.18) / 0.11);
    const second = Math.max(0, 1 - Math.abs(phase - 0.46) / 0.08) * 0.58;
    const flash = Math.max(first, second) * strength;
    this.cloudMaterial.color.copy(CLOUD_BASE).lerp(CLOUD_FLASH, flash * 0.72);
    if (flash > 0.72 && this.previousFlash <= 0.72) this.onThunder(strength);
    this.previousFlash = flash;
    return flash;
  }

  dispose(): void {
    this.scene.remove(this.cloudDome);
    this.camera.remove(this.rain);
    this.cloudGeometry.dispose();
    this.cloudMaterial.dispose();
    this.rainGeometry.dispose();
    this.rainMaterial.dispose();
  }
}
