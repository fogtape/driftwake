import RAPIER from '@dimforge/rapier3d-compat';

interface VectorLike {
  x: number;
  y: number;
  z: number;
}

interface RotationLike extends VectorLike {
  w: number;
}

const DEFAULT_RAFT_HALF_EXTENT = 2.08;
const RAFT_HALF_THICKNESS = 0.1;
const SWIMMER_CAPSULE_HALF_HEIGHT = 0.44;
const SWIMMER_CAPSULE_RADIUS = 0.28;
const SWIMMER_HEAD_TO_CENTER = SWIMMER_CAPSULE_HALF_HEIGHT + SWIMMER_CAPSULE_RADIUS;
const COLLISION_EPSILON_SQUARED = 1e-8;

export class PhysicsSystem {
  world: RAPIER.World | null = null;
  private readonly swimmerTranslation: VectorLike = { x: 0, y: 0, z: 0 };
  private readonly desiredSwimmingMovement: VectorLike = { x: 0, y: 0, z: 0 };
  private raftBody: RAPIER.RigidBody | null = null;
  private swimmerBody: RAPIER.RigidBody | null = null;
  private swimmerCollider: RAPIER.Collider | null = null;
  private characterController: RAPIER.KinematicCharacterController | null = null;
  private swimmingCollisionCount = 0;

  get collisionCount(): number {
    return this.swimmingCollisionCount;
  }

  async initialize(raftHalfExtent = DEFAULT_RAFT_HALF_EXTENT): Promise<void> {
    await RAPIER.init();
    this.swimmingCollisionCount = 0;
    const collisionHalfExtent = Number.isFinite(raftHalfExtent) && raftHalfExtent > 0
      ? raftHalfExtent
      : DEFAULT_RAFT_HALF_EXTENT;
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

    this.raftBody = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased(),
    );
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(
        collisionHalfExtent,
        RAFT_HALF_THICKNESS,
        collisionHalfExtent,
      ),
      this.raftBody,
    );

    this.swimmerBody = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased(),
    );
    this.swimmerCollider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(
        SWIMMER_CAPSULE_HALF_HEIGHT,
        SWIMMER_CAPSULE_RADIUS,
      ),
      this.swimmerBody,
    );
    this.characterController = this.world.createCharacterController(0.015);
    this.characterController.setSlideEnabled(true);
    this.characterController.disableAutostep();
    this.characterController.disableSnapToGround();
  }

  syncRaftPose(position: VectorLike, rotation: RotationLike): void {
    this.raftBody?.setNextKinematicTranslation(position);
    this.raftBody?.setNextKinematicRotation(rotation);
  }

  resolveSwimmingMovement(
    currentHead: VectorLike,
    desiredHead: VectorLike,
    target: VectorLike,
  ): boolean {
    if (!this.swimmerBody || !this.swimmerCollider || !this.characterController) {
      target.x = desiredHead.x;
      target.y = desiredHead.y;
      target.z = desiredHead.z;
      return false;
    }

    this.swimmerTranslation.x = currentHead.x;
    this.swimmerTranslation.y = currentHead.y - SWIMMER_HEAD_TO_CENTER;
    this.swimmerTranslation.z = currentHead.z;
    this.swimmerBody.setTranslation(this.swimmerTranslation, true);
    this.world?.propagateModifiedBodyPositionsToColliders();

    this.desiredSwimmingMovement.x = desiredHead.x - currentHead.x;
    this.desiredSwimmingMovement.y = desiredHead.y - currentHead.y;
    this.desiredSwimmingMovement.z = desiredHead.z - currentHead.z;
    this.characterController.computeColliderMovement(
      this.swimmerCollider,
      this.desiredSwimmingMovement,
    );
    const movement = this.characterController.computedMovement();
    target.x = currentHead.x + movement.x;
    target.y = currentHead.y + movement.y;
    target.z = currentHead.z + movement.z;

    const errorX = movement.x - this.desiredSwimmingMovement.x;
    const errorY = movement.y - this.desiredSwimmingMovement.y;
    const errorZ = movement.z - this.desiredSwimmingMovement.z;
    const collided = this.characterController.numComputedCollisions() > 0
      || errorX * errorX + errorY * errorY + errorZ * errorZ > COLLISION_EPSILON_SQUARED;
    if (collided) this.swimmingCollisionCount += 1;
    return collided;
  }

  step(delta: number): void {
    if (!this.world) return;
    this.world.timestep = Math.min(delta, 1 / 30);
    this.world.step();
  }

  dispose(): void {
    this.world?.free();
    this.characterController = null;
    this.swimmerCollider = null;
    this.swimmerBody = null;
    this.raftBody = null;
    this.swimmingCollisionCount = 0;
    this.world = null;
  }
}
