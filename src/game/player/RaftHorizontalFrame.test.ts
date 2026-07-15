import { describe, expect, it } from 'vitest';
import { Euler, Quaternion, Vector3 } from 'three';
import { RaftHorizontalFrame } from './RaftHorizontalFrame';

describe('RaftHorizontalFrame', () => {
  it('keeps depth from changing horizontal raft distance under pitch and roll', () => {
    const frame = new RaftHorizontalFrame();
    const rotation = new Quaternion().setFromEuler(new Euler(0.42, 0, -0.31, 'YXZ'));
    const origin = new Vector3(4, 1.2, -3);
    const above = new Vector3(5.5, 8, -0.6);
    const below = new Vector3(5.5, -6, -0.6);
    const aboveLocal = new Vector3();
    const belowLocal = new Vector3();

    frame.update(rotation);
    frame.worldToLocal(above, origin, aboveLocal);
    frame.worldToLocal(below, origin, belowLocal);

    expect(aboveLocal.x).toBeCloseTo(belowLocal.x, 8);
    expect(aboveLocal.z).toBeCloseTo(belowLocal.z, 8);
  });

  it('round-trips horizontal coordinates with raft yaw', () => {
    const frame = new RaftHorizontalFrame();
    const rotation = new Quaternion().setFromEuler(new Euler(0.18, Math.PI / 3, -0.12, 'YXZ'));
    const origin = new Vector3(-2, 0.4, 7);
    const local = new Vector3(1.8, 0, -2.4);
    const world = new Vector3(0, -0.7, 0);
    const recovered = new Vector3();

    frame.update(rotation);
    frame.localToWorld(local, origin, world.y, world);
    frame.worldToLocal(world, origin, recovered);

    expect(recovered.x).toBeCloseTo(local.x, 8);
    expect(recovered.z).toBeCloseTo(local.z, 8);
    expect(world.y).toBe(-0.7);
  });
});
