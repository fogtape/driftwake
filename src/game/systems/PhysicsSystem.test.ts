import { afterEach, describe, expect, it } from 'vitest';
import { PhysicsSystem } from './PhysicsSystem';

const identity = { x: 0, y: 0, z: 0, w: 1 };

function point(x: number, y: number, z: number) {
  return { x, y, z };
}

const systems: PhysicsSystem[] = [];

async function createPhysics(): Promise<PhysicsSystem> {
  const physics = new PhysicsSystem();
  systems.push(physics);
  await physics.initialize();
  physics.syncRaftPose(point(0, 0, 0), identity);
  physics.step(1 / 60);
  return physics;
}

afterEach(() => {
  for (const physics of systems.splice(0)) physics.dispose();
});

describe('PhysicsSystem moving raft collision', () => {
  it('blocks a surface swimmer from crossing through the raft side', async () => {
    const physics = await createPhysics();
    const resolved = point(0, 0, 0);

    const collided = physics.resolveSwimmingMovement(
      point(2.8, 0.42, 0),
      point(1.6, 0.42, 0),
      resolved,
    );

    expect(collided).toBe(true);
    expect(physics.collisionCount).toBe(1);
    expect(resolved.x).toBeGreaterThan(2.3);
    expect(resolved.y).toBeCloseTo(0.42, 2);
  });

  it('allows a deeply submerged swimmer to pass below the raft', async () => {
    const physics = await createPhysics();
    const resolved = point(0, 0, 0);

    const collided = physics.resolveSwimmingMovement(
      point(2.8, -1.05, 0),
      point(1.6, -1.05, 0),
      resolved,
    );

    expect(collided).toBe(false);
    expect(physics.collisionCount).toBe(0);
    expect(resolved.x).toBeCloseTo(1.6, 5);
    expect(resolved.y).toBeCloseTo(-1.05, 5);
    expect(resolved.z).toBeCloseTo(0, 5);
  });

  it('stops an underwater ascent at the underside instead of crossing the deck', async () => {
    const physics = await createPhysics();
    const resolved = point(0, 0, 0);

    const collided = physics.resolveSwimmingMovement(
      point(0, -0.55, 0),
      point(0, 0.42, 0),
      resolved,
    );

    expect(collided).toBe(true);
    expect(resolved.y).toBeLessThan(-0.1);
    expect(physics.collisionCount).toBe(1);
  });

  it('uses the configured raft extent instead of a duplicated collision constant', async () => {
    const physics = new PhysicsSystem();
    systems.push(physics);
    await physics.initialize(1);
    physics.syncRaftPose(point(0, 0, 0), identity);
    physics.step(1 / 60);
    const resolved = point(0, 0, 0);

    const collided = physics.resolveSwimmingMovement(
      point(1.5, 0.42, 0),
      point(0.7, 0.42, 0),
      resolved,
    );

    expect(collided).toBe(true);
    expect(resolved.x).toBeGreaterThan(1.25);
  });

  it('uses the latest moving-raft pose instead of a stale origin collider', async () => {
    const physics = await createPhysics();
    physics.syncRaftPose(point(5, 0.6, -3), identity);
    physics.step(1 / 60);
    physics.syncRaftPose(point(5, 0.6, -3), identity);
    physics.step(1 / 60);
    const resolved = point(0, 0, 0);

    const collided = physics.resolveSwimmingMovement(
      point(7.8, 1.02, -3),
      point(6.6, 1.02, -3),
      resolved,
    );

    expect(collided).toBe(true);
    expect(resolved.x).toBeGreaterThan(7.3);
    expect(resolved.z).toBeCloseTo(-3, 2);
  });
});
