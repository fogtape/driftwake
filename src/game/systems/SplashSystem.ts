import { BufferAttribute, BufferGeometry, Points, PointsMaterial, Scene, Vector3 } from 'three';
import { createSeededRandom, randomRange } from '../math/random';

interface Burst {
  points: Points<BufferGeometry, PointsMaterial>;
  velocities: Vector3[];
  age: number;
  duration: number;
}

export class SplashSystem {
  private readonly bursts: Burst[] = [];
  private readonly random = createSeededRandom(0x51a5a);

  constructor(private readonly scene: Scene) {}

  spawn(position: Vector3): void {
    this.spawnBurst(position, 0xe5ffff, 22, 0.85, 0.075, 0.65, 2.1);
  }

  spawnImpact(position: Vector3, color: number, count = 18): void {
    this.spawnBurst(position, color, count, 0.62, 0.055, 0.35, 1.35);
  }

  private spawnBurst(
    position: Vector3,
    color: number,
    count: number,
    duration: number,
    size: number,
    minLift: number,
    maxLift: number,
  ): void {
    const positions = new Float32Array(count * 3);
    const velocities: Vector3[] = [];
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = position.x;
      positions[index * 3 + 1] = position.y;
      positions[index * 3 + 2] = position.z;
      const angle = randomRange(this.random, 0, Math.PI * 2);
      const speed = randomRange(this.random, 0.45, 1.65);
      velocities.push(
        new Vector3(
          Math.cos(angle) * speed,
          randomRange(this.random, minLift, maxLift),
          Math.sin(angle) * speed,
        ),
      );
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    const material = new PointsMaterial({
      color,
      size,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const points = new Points(geometry, material);
    this.scene.add(points);
    this.bursts.push({ points, velocities, age: 0, duration });
  }

  update(delta: number): void {
    for (let burstIndex = this.bursts.length - 1; burstIndex >= 0; burstIndex -= 1) {
      const burst = this.bursts[burstIndex];
      burst.age += delta;
      const attribute = burst.points.geometry.getAttribute('position') as BufferAttribute;
      for (let index = 0; index < burst.velocities.length; index += 1) {
        const velocity = burst.velocities[index];
        velocity.y -= 4.5 * delta;
        attribute.setXYZ(
          index,
          attribute.getX(index) + velocity.x * delta,
          attribute.getY(index) + velocity.y * delta,
          attribute.getZ(index) + velocity.z * delta,
        );
      }
      attribute.needsUpdate = true;
      burst.points.material.opacity = Math.max(0, 1 - burst.age / burst.duration);
      if (burst.age >= burst.duration) {
        this.scene.remove(burst.points);
        burst.points.geometry.dispose();
        burst.points.material.dispose();
        this.bursts.splice(burstIndex, 1);
      }
    }
  }

  dispose(): void {
    for (const burst of this.bursts) {
      this.scene.remove(burst.points);
      burst.points.geometry.dispose();
      burst.points.material.dispose();
    }
    this.bursts.length = 0;
  }
}
