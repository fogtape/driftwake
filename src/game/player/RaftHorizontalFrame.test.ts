import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { RaftHorizontalFrame } from './RaftHorizontalFrame';

describe('RaftHorizontalFrame', () => {
  it('round-trips heading-relative positions without inheriting raft tilt', () => {
    const frame = new RaftHorizontalFrame();
    frame.update(Math.PI / 3);
    const origin = new Vector3(8, 3, -4);
    const local = new Vector3(1.4, 0, -2.2);
    const world = frame.localToWorld(local, origin, 0.2, new Vector3());
    const restored = frame.worldToLocal(world, origin, new Vector3());

    expect(restored.x).toBeCloseTo(local.x);
    expect(restored.z).toBeCloseTo(local.z);
    expect(world.y).toBe(0.2);
  });
});
