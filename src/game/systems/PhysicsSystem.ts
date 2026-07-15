import RAPIER from '@dimforge/rapier3d-compat';

export class PhysicsSystem {
  world: RAPIER.World | null = null;

  async initialize(): Promise<void> {
    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    const floorBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(2.2, 0.1, 2.2), floorBody);
  }

  step(delta: number): void {
    if (!this.world) return;
    this.world.timestep = Math.min(delta, 1 / 30);
    this.world.step();
  }

  dispose(): void {
    this.world?.free();
    this.world = null;
  }
}
