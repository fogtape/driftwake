import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PhysicsSystem } from './PhysicsSystem';
import type { RaftTileState } from './RaftSystem';

const identity = { x: 0, y: 0, z: 0, w: 1 };
const origin = { x: 0, y: 0, z: 0 };
const tile = (x: number, z: number): RaftTileState => ({ x, z, health: 100, reinforced: false });

describe('PhysicsSystem dynamic raft collision', () => {
  let physics: PhysicsSystem;

  beforeEach(async () => {
    physics = new PhysicsSystem();
    await physics.initialize();
  });

  afterEach(() => physics.dispose());

  it('rebuilds one collider per dynamic raft tile revision', () => {
    physics.syncRaft(origin, identity, [tile(0, 0)], 1);
    expect(physics.raftColliderCount).toBe(1);
    physics.syncRaft(origin, identity, [tile(0, 0), tile(1, 0), tile(1, 1)], 2);
    expect(physics.raftColliderCount).toBe(3);
  });

  it('blocks a surface swimmer at the raft side but permits a deep pass below it', () => {
    physics.syncRaft(origin, identity, [tile(0, 0)], 1);
    physics.step(1 / 60);

    const surfaceTarget = { x: 0, y: 0, z: 0 };
    const surfaceCollision = physics.resolveSwimmingMovement(
      { x: -1.4, y: 0.34, z: 0 },
      { x: 1.4, y: 0.34, z: 0 },
      surfaceTarget,
    );
    expect(surfaceCollision).toBe(true);
    expect(surfaceTarget.x).toBeLessThan(-0.7);

    const deepTarget = { x: 0, y: 0, z: 0 };
    const deepCollision = physics.resolveSwimmingMovement(
      { x: -1.4, y: -1.25, z: 0 },
      { x: 1.4, y: -1.25, z: 0 },
      deepTarget,
    );
    expect(deepCollision).toBe(false);
    expect(deepTarget.x).toBeCloseTo(1.4);
  });

  it('can be disposed repeatedly without double-freeing Rapier resources', () => {
    physics.dispose();
    expect(() => physics.dispose()).not.toThrow();
    expect(physics.world).toBeNull();
    expect(physics.raftColliderCount).toBe(0);
  });
});
