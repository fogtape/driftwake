import { describe, expect, it } from 'vitest';
import { Euler, Quaternion } from 'three';
import { CameraMotionFilter } from './CameraMotionFilter';

const MAX_STEP_RADIANS = 0.7 / 60;

function extractYawTwist(rotation: Quaternion, target = new Quaternion()): Quaternion {
  const length = Math.hypot(rotation.y, rotation.w);
  if (length <= 1e-8) return target.identity();
  return target.set(0, rotation.y / length, 0, rotation.w / length);
}

function stepForSeconds(
  filter: CameraMotionFilter,
  raftRotation: Quaternion,
  seconds: number,
  motionEnabled: boolean,
): Quaternion {
  const output = new Quaternion();
  const steps = Math.round(seconds * 60);
  for (let index = 0; index < steps; index += 1) {
    filter.update(raftRotation, 1 / 60, motionEnabled, output);
  }
  return output;
}

describe('CameraMotionFilter', () => {
  it('attenuates raft pitch and roll before applying them to the camera', () => {
    const filter = new CameraMotionFilter();
    const raftRotation = new Quaternion().setFromEuler(new Euler(0.24, 0, -0.18, 'YXZ'));

    const output = stepForSeconds(filter, raftRotation, 2, true);
    const cameraEuler = new Euler().setFromQuaternion(output, 'YXZ');

    expect(cameraEuler.x).toBeGreaterThan(0.05);
    expect(cameraEuler.x).toBeLessThan(0.12);
    expect(cameraEuler.z).toBeLessThan(-0.035);
    expect(cameraEuler.z).toBeGreaterThan(-0.1);
  });

  it('smoothly levels raft pitch and roll when camera motion is disabled', () => {
    const filter = new CameraMotionFilter();
    const raftRotation = new Quaternion().setFromEuler(new Euler(0.24, 0, -0.18, 'YXZ'));

    stepForSeconds(filter, raftRotation, 1, true);
    const output = stepForSeconds(filter, raftRotation, 1, false);
    const cameraEuler = new Euler().setFromQuaternion(output, 'YXZ');

    expect(Math.abs(cameraEuler.x)).toBeLessThan(0.001);
    expect(Math.abs(cameraEuler.z)).toBeLessThan(0.001);
  });

  it('preserves the exact Y-axis twist under a compound raft pose', () => {
    const filter = new CameraMotionFilter();
    const raftRotation = new Quaternion().setFromEuler(new Euler(0.24, 0.68, -0.18, 'YXZ'));
    const expectedYaw = extractYawTwist(raftRotation);
    const output = new Quaternion();

    filter.update(raftRotation, 1 / 60, true, output);
    const outputYaw = extractYawTwist(output);

    expect(outputYaw.angleTo(expectedYaw)).toBeLessThan(1e-7);
  });

  it('caps camera tilt change per fixed step under an abrupt compound pose change', () => {
    const filter = new CameraMotionFilter();
    const raftRotation = new Quaternion().setFromEuler(new Euler(0.9, 0.42, -0.72, 'YXZ'));
    const output = new Quaternion();

    filter.update(raftRotation, 1 / 60, true, output);

    expect(filter.tiltRadians).toBeGreaterThan(0);
    expect(filter.tiltRadians).toBeLessThanOrEqual(MAX_STEP_RADIANS + 1e-6);
    expect(filter.peakTiltStepRadians).toBeLessThanOrEqual(MAX_STEP_RADIANS + 1e-6);
  });

  it('cannot snap tilt off or back on in a single fixed step', () => {
    const filter = new CameraMotionFilter();
    const raftRotation = new Quaternion().setFromEuler(new Euler(0.9, 0.42, -0.72, 'YXZ'));
    const output = new Quaternion();

    stepForSeconds(filter, raftRotation, 2, true);
    const enabledTilt = filter.tiltRadians;
    filter.update(raftRotation, 1 / 60, false, output);
    const firstDisabledTilt = filter.tiltRadians;

    expect(firstDisabledTilt).toBeGreaterThan(0);
    expect(enabledTilt - firstDisabledTilt).toBeGreaterThan(0);
    expect(enabledTilt - firstDisabledTilt).toBeLessThanOrEqual(MAX_STEP_RADIANS + 1e-6);

    stepForSeconds(filter, raftRotation, 2, false);
    const leveledTilt = filter.tiltRadians;
    expect(leveledTilt).toBeLessThan(0.001);
    filter.update(raftRotation, 1 / 60, true, output);
    const firstRestoredTilt = filter.tiltRadians;

    expect(firstRestoredTilt - leveledTilt).toBeGreaterThan(0);
    expect(firstRestoredTilt - leveledTilt).toBeLessThanOrEqual(MAX_STEP_RADIANS + 1e-6);
    expect(filter.peakTiltStepRadians).toBeLessThanOrEqual(MAX_STEP_RADIANS + 1e-6);
  });

  it('publishes the filtered raft tilt magnitude for diagnostics', () => {
    const filter = new CameraMotionFilter();
    const raftRotation = new Quaternion().setFromEuler(new Euler(0.24, 0, -0.18, 'YXZ'));

    stepForSeconds(filter, raftRotation, 2, true);

    expect(filter.tiltRadians).toBeGreaterThan(0.05);
    expect(filter.tiltRadians).toBeLessThan(0.13);
  });
});
