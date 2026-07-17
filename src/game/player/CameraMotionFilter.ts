import { Quaternion } from 'three';

const TILT_SCALE = 0.4;
const RESPONSE_PER_SECOND = 6;
const MAX_ANGULAR_SPEED = 0.7;
const ANGLE_EPSILON = 1e-8;

export class CameraMotionFilter {
  private readonly currentTilt = new Quaternion();
  private readonly raftTilt = new Quaternion();
  private readonly targetTilt = new Quaternion();
  private readonly inverseYaw = new Quaternion();
  private readonly yawRotation = new Quaternion();
  private peakTiltStep = 0;

  get tiltRadians(): number {
    return 2 * Math.acos(Math.min(1, Math.abs(this.currentTilt.w)));
  }

  get peakTiltStepRadians(): number {
    return this.peakTiltStep;
  }

  update(
    raftRotation: Quaternion,
    deltaSeconds: number,
    motionEnabled: boolean,
    target: Quaternion,
  ): Quaternion {
    const twistLength = Math.hypot(raftRotation.y, raftRotation.w);
    if (twistLength > ANGLE_EPSILON) {
      this.yawRotation.set(
        0,
        raftRotation.y / twistLength,
        0,
        raftRotation.w / twistLength,
      );
    } else {
      this.yawRotation.identity();
    }

    this.inverseYaw.copy(this.yawRotation).invert();
    this.raftTilt.copy(this.inverseYaw).multiply(raftRotation).normalize();
    this.targetTilt.identity().slerp(this.raftTilt, motionEnabled ? TILT_SCALE : 0);

    if (Number.isFinite(deltaSeconds) && deltaSeconds > 0) {
      const angle = this.currentTilt.angleTo(this.targetTilt);
      if (angle > ANGLE_EPSILON) {
        const responseAlpha = 1 - Math.exp(-RESPONSE_PER_SECOND * deltaSeconds);
        const speedAlpha = Math.min(1, (MAX_ANGULAR_SPEED * deltaSeconds) / angle);
        const alpha = Math.min(responseAlpha, speedAlpha);
        this.currentTilt.slerp(this.targetTilt, alpha);
        this.peakTiltStep = Math.max(this.peakTiltStep, angle * alpha);
      }
    }

    return target.copy(this.yawRotation).multiply(this.currentTilt);
  }
}
