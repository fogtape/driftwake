import { Quaternion, Vector3 } from 'three';

const AXIS_EPSILON = 1e-8;

export class RaftHorizontalFrame {
  private readonly right = new Vector3(1, 0, 0);
  private readonly forward = new Vector3(0, 0, 1);
  private readonly offset = new Vector3();

  update(rotation: Quaternion): void {
    this.right.set(1, 0, 0).applyQuaternion(rotation);
    this.right.y = 0;
    if (this.right.lengthSq() < AXIS_EPSILON) this.right.set(1, 0, 0);
    else this.right.normalize();

    this.forward.set(0, 0, 1).applyQuaternion(rotation);
    this.forward.y = 0;
    this.forward.addScaledVector(this.right, -this.forward.dot(this.right));
    if (this.forward.lengthSq() < AXIS_EPSILON) {
      this.forward.set(-this.right.z, 0, this.right.x);
    } else {
      this.forward.normalize();
    }
  }

  worldToLocal(point: Vector3, origin: Vector3, target: Vector3): Vector3 {
    this.offset.copy(point).sub(origin);
    this.offset.y = 0;
    return target.set(
      this.offset.dot(this.right),
      0,
      this.offset.dot(this.forward),
    );
  }

  localToWorld(
    point: Vector3,
    origin: Vector3,
    worldY: number,
    target: Vector3,
  ): Vector3 {
    target.copy(origin)
      .addScaledVector(this.right, point.x)
      .addScaledVector(this.forward, point.z);
    target.y = worldY;
    return target;
  }
}
