import type {
  Collider,
  KinematicCharacterController,
  RigidBody,
  World,
} from '@dimforge/rapier3d-compat';
import { RAFT_TILE_X, RAFT_TILE_Z, type RaftTileState } from './RaftSystem';

type RapierModule = typeof import('@dimforge/rapier3d-compat')['default'];

interface VectorLike {
  x: number;
  y: number;
  z: number;
}

interface RotationLike extends VectorLike {
  w: number;
}

const RAFT_HALF_THICKNESS = 0.12;
const SWIMMER_CAPSULE_HALF_HEIGHT = 0.44;
const SWIMMER_CAPSULE_RADIUS = 0.28;
const SWIMMER_HEAD_TO_CENTER = SWIMMER_CAPSULE_HALF_HEIGHT + SWIMMER_CAPSULE_RADIUS;
const COLLISION_EPSILON_SQUARED = 1e-8;

export class PhysicsSystem {
  world: World | null = null;
  private rapier: RapierModule | null = null;
  private raftBody: RigidBody | null = null;
  private readonly raftColliders: Collider[] = [];
  private swimmerBody: RigidBody | null = null;
  private swimmerCollider: Collider | null = null;
  private characterController: KinematicCharacterController | null = null;
  private readonly swimmerTranslation: VectorLike = { x: 0, y: 0, z: 0 };
  private readonly desiredMovement: VectorLike = { x: 0, y: 0, z: 0 };
  private syncedRaftRevision = -1;
  private swimmingCollisionCount = 0;

  get collisionCount(): number {
    return this.swimmingCollisionCount;
  }

  get raftColliderCount(): number {
    return this.raftColliders.length;
  }

  async initialize(): Promise<void> {
    const { default: RAPIER } = await import('@dimforge/rapier3d-compat');
    await RAPIER.init();
    this.rapier = RAPIER;
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.raftBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    this.swimmerBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    this.swimmerCollider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(SWIMMER_CAPSULE_HALF_HEIGHT, SWIMMER_CAPSULE_RADIUS),
      this.swimmerBody,
    );
    this.characterController = this.world.createCharacterController(0.015);
    this.characterController.setSlideEnabled(true);
    this.characterController.disableAutostep();
    this.characterController.disableSnapToGround();
  }

  syncRaft(
    position: VectorLike,
    rotation: RotationLike,
    tiles: readonly RaftTileState[],
    revision: number,
  ): void {
    if (!this.world || !this.raftBody) return;
    if (revision !== this.syncedRaftRevision) {
      this.rebuildRaftColliders(tiles);
      this.syncedRaftRevision = revision;
    }
    this.raftBody.setNextKinematicTranslation(position);
    this.raftBody.setNextKinematicRotation(rotation);
  }

  resolveSwimmingMovement(currentHead: VectorLike, desiredHead: VectorLike, target: VectorLike): boolean {
    if (!this.world || !this.swimmerBody || !this.swimmerCollider || !this.characterController) {
      copyVector(target, desiredHead);
      return false;
    }

    this.swimmerTranslation.x = currentHead.x;
    this.swimmerTranslation.y = currentHead.y - SWIMMER_HEAD_TO_CENTER;
    this.swimmerTranslation.z = currentHead.z;
    this.swimmerBody.setTranslation(this.swimmerTranslation, true);
    this.world.propagateModifiedBodyPositionsToColliders();

    this.desiredMovement.x = desiredHead.x - currentHead.x;
    this.desiredMovement.y = desiredHead.y - currentHead.y;
    this.desiredMovement.z = desiredHead.z - currentHead.z;
    this.characterController.computeColliderMovement(this.swimmerCollider, this.desiredMovement);
    const movement = this.characterController.computedMovement();
    target.x = currentHead.x + movement.x;
    target.y = currentHead.y + movement.y;
    target.z = currentHead.z + movement.z;

    const errorX = movement.x - this.desiredMovement.x;
    const errorY = movement.y - this.desiredMovement.y;
    const errorZ = movement.z - this.desiredMovement.z;
    const collided = this.characterController.numComputedCollisions() > 0
      || errorX * errorX + errorY * errorY + errorZ * errorZ > COLLISION_EPSILON_SQUARED;
    if (collided) this.swimmingCollisionCount += 1;
    return collided;
  }

  step(delta: number): void {
    if (!this.world || delta <= 0) return;
    this.world.timestep = Math.min(delta, 1 / 30);
    this.world.step();
  }

  dispose(): void {
    // World owns and releases its character controllers.
    this.world?.free();
    this.raftColliders.length = 0;
    this.raftBody = null;
    this.swimmerBody = null;
    this.swimmerCollider = null;
    this.characterController = null;
    this.world = null;
    this.rapier = null;
    this.syncedRaftRevision = -1;
    this.swimmingCollisionCount = 0;
  }

  private rebuildRaftColliders(tiles: readonly RaftTileState[]): void {
    if (!this.world || !this.raftBody || !this.rapier) return;
    for (const collider of this.raftColliders) this.world.removeCollider(collider, true);
    this.raftColliders.length = 0;

    for (const tile of tiles) {
      const descriptor = this.rapier.ColliderDesc.cuboid(
        RAFT_TILE_X * 0.5,
        RAFT_HALF_THICKNESS,
        RAFT_TILE_Z * 0.5,
      ).setTranslation(tile.x * RAFT_TILE_X, -RAFT_HALF_THICKNESS, tile.z * RAFT_TILE_Z);
      this.raftColliders.push(this.world.createCollider(descriptor, this.raftBody));
    }
  }
}

function copyVector(target: VectorLike, source: VectorLike): void {
  target.x = source.x;
  target.y = source.y;
  target.z = source.z;
}
