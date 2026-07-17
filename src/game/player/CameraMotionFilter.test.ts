import { describe, expect, it } from 'vitest';
import { Euler, Quaternion } from 'three';
import { CAMERA_MOTION_PROFILES } from '../domain/settings';
import { CameraMotionFilter } from './CameraMotionFilter';

function settle(filter: CameraMotionFilter, rotation: Quaternion, mode: keyof typeof CAMERA_MOTION_PROFILES): Quaternion {
  const output = new Quaternion();
  for (let index = 0; index < 120; index += 1) {
    filter.update(rotation, 1 / 60, CAMERA_MOTION_PROFILES[mode], output);
  }
  return output;
}

function extractYawTwist(rotation: Quaternion): Quaternion {
  const length = Math.hypot(rotation.y, rotation.w);
  if (length <= 1e-8) return new Quaternion();
  return new Quaternion(0, rotation.y / length, 0, rotation.w / length);
}

describe('CameraMotionFilter', () => {
  it('preserves yaw while attenuating pitch and roll by comfort profile', () => {
    const filter = new CameraMotionFilter();
    const raft = new Quaternion().setFromEuler(new Euler(0.24, 0.68, -0.18, 'YXZ'));
    const output = settle(filter, raft, 'comfort');
    const euler = new Euler().setFromQuaternion(output, 'YXZ');

    expect(extractYawTwist(output).angleTo(extractYawTwist(raft))).toBeLessThan(1e-7);
    expect(Math.abs(euler.x)).toBeLessThan(0.04);
    expect(Math.abs(euler.z)).toBeLessThan(0.04);
  });

  it('provides progressively stronger motion without exceeding per-step speed', () => {
    const raft = new Quaternion().setFromEuler(new Euler(0.42, 0.2, -0.34, 'YXZ'));
    const comfort = new CameraMotionFilter();
    const immersive = new CameraMotionFilter();
    settle(comfort, raft, 'comfort');
    settle(immersive, raft, 'immersive');

    expect(immersive.tiltRadians).toBeGreaterThan(comfort.tiltRadians * 4);
    expect(comfort.peakTiltStepRadians).toBeLessThanOrEqual(CAMERA_MOTION_PROFILES.comfort.maximumTiltSpeed / 60 + 1e-6);
    expect(immersive.peakTiltStepRadians).toBeLessThanOrEqual(CAMERA_MOTION_PROFILES.immersive.maximumTiltSpeed / 60 + 1e-6);
  });
});
