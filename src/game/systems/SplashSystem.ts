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

  spawnStructureDamage(position: Vector3, healthRatio: number, destroyed: boolean, fibrous = false): void {
    const severity = 1 - Math.max(0, Math.min(1, healthRatio));
    this.spawnBurst(
      position,
      fibrous ? 0x9b9a5f : 0x9b6249,
      Math.round(14 + severity * 18 + (destroyed ? 12 : 0)),
      destroyed ? 0.92 : 0.68,
      destroyed ? 0.07 : 0.055,
      0.28,
      destroyed ? 2.05 : 1.35,
    );
    this.spawnBurst(
      position,
      fibrous ? 0x5f603d : 0x5f3c34,
      Math.round(7 + severity * 10),
      0.74,
      0.038,
      0.18,
      0.92,
    );
  }

  spawnStructureWaterImpact(position: Vector3, fibrous = false, strength = 1): void {
    const normalized = Math.max(0.35, Math.min(1, strength));
    this.spawnBurst(
      position,
      0xe8ffff,
      Math.round(24 + normalized * 24),
      1.05,
      0.065 + normalized * 0.026,
      0.72,
      2.35 + normalized * 0.75,
    );
    this.spawnBurst(
      position,
      0x7fc8ca,
      Math.round(12 + normalized * 12),
      0.82,
      0.045,
      0.34,
      1.45,
    );
    this.spawnBurst(
      position,
      fibrous ? 0xb5aa68 : 0x9a684f,
      Math.round(7 + normalized * 7),
      0.96,
      fibrous ? 0.042 : 0.05,
      0.28,
      1.22,
    );
  }

  spawnRepair(position: Vector3, fibrous = false): void {
    this.spawnBurst(position, 0xefc35c, 11, 0.48, 0.045, 0.22, 0.86);
    this.spawnBurst(position, fibrous ? 0xaeb275 : 0xd3a372, 7, 0.54, 0.035, 0.16, 0.64);
  }

  spawnReplacement(position: Vector3, fibrous = false): void {
    this.spawnBurst(position, fibrous ? 0x77734c : 0x775044, 10, 0.46, 0.04, 0.12, 0.72);
    this.spawnBurst(position, fibrous ? 0xc4c17c : 0x72c8d4, 16, 0.68, 0.048, 0.24, 1.2);
  }

  spawnSharkDefeat(position: Vector3): void {
    this.spawnBurst(position, 0xc55350, 24, 0.82, 0.062, 0.24, 1.48);
    this.spawnBurst(position, 0x8fcfd0, 30, 1.02, 0.055, 0.52, 2.18);
  }

  spawnSharkTelegraph(position: Vector3, playerTarget = false): void {
    this.spawnBurst(position, 0x8edbd5, playerTarget ? 30 : 24, 0.86, 0.05, 0.12, playerTarget ? 1.35 : 1.05);
    this.spawnBurst(position, 0xe7ffff, playerTarget ? 16 : 12, 0.62, 0.035, 0.28, playerTarget ? 1.75 : 1.42);
  }

  spawnSharkCounter(position: Vector3): void {
    this.spawnBurst(position, 0x75dfcd, 24, 0.7, 0.052, 0.22, 1.42);
    this.spawnBurst(position, 0xc55b55, 16, 0.58, 0.046, 0.12, 0.9);
  }

  spawnSharkMiss(position: Vector3): void {
    this.spawnBurst(position, 0xdffcff, 28, 0.78, 0.048, 0.18, 1.58);
    this.spawnBurst(position, 0x65bfc0, 18, 0.86, 0.042, 0.08, 1.02);
  }

  spawnSharkHarvest(position: Vector3, completed = false): void {
    this.spawnBurst(position, 0xb95f5b, completed ? 22 : 14, 0.62, 0.05, 0.16, 0.92);
    this.spawnBurst(position, 0x789695, completed ? 13 : 8, 0.74, 0.038, 0.22, 1.12);
  }

  spawnCeilingDust(position: Vector3, fibrous = false): void {
    this.spawnBurst(position, fibrous ? 0xb6b27a : 0xc89868, fibrous ? 8 : 10, 0.48, 0.035, -0.42, 0.06);
    this.spawnBurst(position, fibrous ? 0x66623d : 0x684536, 5, 0.36, 0.026, -0.28, 0.02);
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
