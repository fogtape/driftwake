import { Vector3 } from 'three';

export class RaftHorizontalFrame {
  private heading = 0;
  private cosine = 1;
  private sine = 0;

  update(heading: number): void {
    this.heading = Number.isFinite(heading) ? heading : this.heading;
    this.cosine = Math.cos(this.heading);
    this.sine = Math.sin(this.heading);
  }

  worldToLocal(point: Vector3, origin: Vector3, target: Vector3): Vector3 {
    const offsetX = point.x - origin.x;
    const offsetZ = point.z - origin.z;
    return target.set(
      offsetX * this.cosine - offsetZ * this.sine,
      0,
      offsetX * this.sine + offsetZ * this.cosine,
    );
  }

  localToWorld(point: Vector3, origin: Vector3, worldY: number, target: Vector3): Vector3 {
    return target.set(
      origin.x + point.x * this.cosine + point.z * this.sine,
      worldY,
      origin.z - point.x * this.sine + point.z * this.cosine,
    );
  }
}
