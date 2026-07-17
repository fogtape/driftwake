import { Euler, MathUtils, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import type { PlayerSurface, SavedPlayerNavigation } from '../domain/save';
import { CAMERA_MOTION_PROFILES, type CameraMotionMode } from '../domain/settings';
import { CameraMotionFilter } from '../player/CameraMotionFilter';
import { OPEN_WATER_FLOOR_Y, WATER_SURFACE_Y } from '../domain/underwater';
import { RAFT_TILE_X, RAFT_TILE_Z, type RaftSystem } from './RaftSystem';
import type { PhysicsSystem } from './PhysicsSystem';
import { RaftHorizontalFrame } from '../player/RaftHorizontalFrame';
import {
  stepVerticalMotion,
  type VerticalMotionState,
} from '../player/locomotion';

const CAMERA_HEIGHT = 1.54;
const WATER_FLOOR_CLEARANCE = 0.68;
const SURFACE_BREATHING_DEPTH = 0.2;
const RAFT_CLIMB_VERTICAL_REACH = 0.62;
const RAFT_CLIMB_HORIZONTAL_REACH = 0.78;

export interface IslandNavigationProvider {
  sampleGroundHeight: (x: number, z: number) => number | null;
  sampleWaterFloorHeight?: (x: number, z: number) => number | null;
  resolveCollision: (position: Vector3, previous: Vector3) => void;
  resolveWaterCollision?: (position: Vector3, previous: Vector3) => void;
  onSurfaceChange?: (surface: PlayerSurface) => void;
}

export class PlayerController {
  readonly localPosition = new Vector3(0, CAMERA_HEIGHT, 1.08);
  private readonly keys = new Set<string>();
  private readonly lookEuler = new Euler(0, 0, 0, 'YXZ');
  private readonly lookQuaternion = new Quaternion();
  private readonly shakeQuaternion = new Quaternion();
  private readonly filteredRaftRotation = new Quaternion();
  private readonly cameraMotionFilter = new CameraMotionFilter();
  private readonly raftHorizontalFrame = new RaftHorizontalFrame();
  private readonly previousCameraPosition = new Vector3();
  private readonly simulationCameraPosition = new Vector3();
  private readonly previousCameraQuaternion = new Quaternion();
  private readonly simulationCameraQuaternion = new Quaternion();
  private readonly shakeEuler = new Euler(0, 0, 0, 'YXZ');
  private readonly shakeOffset = new Vector3();
  private readonly worldPosition = new Vector3();
  private readonly previousLocalPosition = new Vector3();
  private readonly islandPosition = new Vector3();
  private readonly previousIslandPosition = new Vector3();
  private readonly waterPosition = new Vector3();
  private readonly previousWaterPosition = new Vector3();
  private readonly waterVelocity = new Vector3();
  private readonly airbornePosition = new Vector3();
  private readonly candidatePosition = new Vector3();
  private readonly candidateLocal = new Vector3();
  private readonly moveForward = new Vector3();
  private readonly moveRight = new Vector3();
  private readonly moveVector = new Vector3();
  private readonly impulseDirection = new Vector3();
  private collisionResolver: ((position: Vector3, previous: Vector3) => void) | null = null;
  private islandNavigation: IslandNavigationProvider | null = null;
  private surface: PlayerSurface;
  private moveCycle = 0;
  private stepDistance = 0;
  private shake = 0;
  private shakeTime = 0;
  private enabled = false;
  private cameraMotionMode: CameraMotionMode = 'balanced';
  private cameraPoseInitialized = false;
  private readonly verticalMotion: VerticalMotionState = {
    mode: 'grounded',
    headY: CAMERA_HEIGHT,
    velocityY: 0,
  };
  private jumpQueued = false;
  private airborneLookIsWorldSpace = false;
  private completedJumpCount = 0;
  private receivedKeyboardEventCount = 0;
  private jumpDiagnostic = 'idle';

  constructor(
    private readonly camera: PerspectiveCamera,
    private readonly raft: RaftSystem,
    private readonly physics: PhysicsSystem,
    navigation: SavedPlayerNavigation = { surface: 'raft', x: 0, z: 1.08 },
    private readonly onFootstep: (surface: PlayerSurface) => void = () => undefined,
  ) {
    this.surface = navigation.surface;
    if (navigation.surface === 'raft') {
      this.localPosition.x = navigation.x;
      this.localPosition.z = navigation.z;
    } else if (navigation.surface === 'island') {
      this.islandPosition.set(navigation.x, 0, navigation.z);
    } else {
      this.waterPosition.set(navigation.x, navigation.y ?? WATER_SURFACE_Y, navigation.z);
    }
    document.addEventListener('mousemove', this.onMouseMove);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.keys.clear();
    if (!enabled) this.jumpQueued = false;
  }

  setCameraMotionMode(mode: CameraMotionMode): void {
    this.cameraMotionMode = mode;
    if (mode === 'comfort') this.moveCycle = 0;
  }

  update(delta: number): void {
    if (this.cameraPoseInitialized) {
      this.camera.position.copy(this.simulationCameraPosition);
      this.camera.quaternion.copy(this.simulationCameraQuaternion);
      this.previousCameraPosition.copy(this.simulationCameraPosition);
      this.previousCameraQuaternion.copy(this.simulationCameraQuaternion);
    }
    this.shakeTime += delta;
    this.previousLocalPosition.copy(this.localPosition);
    this.previousIslandPosition.copy(this.islandPosition);
    this.previousWaterPosition.copy(this.waterPosition);
    this.lookQuaternion.setFromEuler(this.lookEuler);

    let inputX = 0;
    let inputZ = 0;
    let inputY = 0;
    if (this.enabled) {
      if (this.keys.has('KeyA')) inputX -= 1;
      if (this.keys.has('KeyD')) inputX += 1;
      if (this.keys.has('KeyW')) inputZ -= 1;
      if (this.keys.has('KeyS')) inputZ += 1;
      if (this.surface === 'water') {
        if (this.keys.has('Space')) inputY += 1;
        if (this.keys.has('ControlLeft') || this.keys.has('ControlRight')) inputY -= 1;
      }
    }

    const hadJumpQueued = this.jumpQueued;
    const jumpRequested = this.enabled
      && this.jumpQueued
      && this.surface !== 'water'
      && this.verticalMotion.mode === 'grounded';
    this.jumpQueued = false;
    if (hadJumpQueued) {
      this.jumpDiagnostic = jumpRequested
        ? 'accepted'
        : `rejected:${this.enabled ? 'enabled' : 'disabled'}:${this.surface}:${this.verticalMotion.mode}`;
    }
    if (jumpRequested) this.beginAirborneFromCurrentSurface();
    if (jumpRequested || this.isAirborne()) {
      this.advanceAirborne(delta, inputX, inputZ, jumpRequested);
      this.finishCameraUpdate(delta);
      return;
    }

    this.moveRight.set(1, 0, 0).applyQuaternion(this.lookQuaternion);
    this.moveForward.set(0, 0, -1).applyQuaternion(this.lookQuaternion);
    if (this.surface !== 'water') this.moveForward.y = 0;
    this.moveRight.y = 0;
    this.moveRight.normalize();
    this.moveForward.normalize();
    this.moveVector.set(0, 0, 0).addScaledVector(this.moveRight, inputX).addScaledVector(this.moveForward, -inputZ);
    if (this.surface === 'water') this.moveVector.y += inputY;
    const movementActive = this.moveVector.lengthSq() > 0.001;
    let movedDistance = 0;
    if (movementActive) {
      this.moveVector.normalize();
      const speed = this.surface === 'water' ? 2.08 : this.surface === 'raft' ? 2.45 : 2.7;
      this.moveVector.multiplyScalar(speed * delta);
      movedDistance = this.moveVector.length();
      if (this.surface === 'raft') this.moveOnRaft(this.moveVector.x, this.moveVector.z);
      else if (this.surface === 'island') this.moveOnIsland(this.moveVector.x, this.moveVector.z);
      else this.moveOnWater(this.moveVector);
      this.moveCycle += delta * (this.surface === 'water' ? 4.6 : 8.4);
      this.stepDistance += movedDistance;
      const stride = this.surface === 'water' ? 1.08 : this.surface === 'raft' ? 0.82 : 0.72;
      if (this.stepDistance >= stride) {
        this.stepDistance = 0;
        this.onFootstep(this.surface);
      }
    } else {
      this.moveCycle = MathUtils.damp(this.moveCycle, 0, 4.5, delta);
    }

    if (this.isAirborne()) {
      this.advanceAirborne(delta, 0, 0, false);
      this.finishCameraUpdate(delta);
      return;
    }

    if (this.surface === 'water') {
      if (this.waterVelocity.lengthSq() > 0.0001) {
        this.previousWaterPosition.copy(this.waterPosition);
        this.moveVector.copy(this.waterVelocity).multiplyScalar(delta);
        this.moveOnWater(this.moveVector);
        this.waterVelocity.multiplyScalar(Math.exp(-delta * 2.8));
      }
      this.renderOnWater(movementActive);
    } else if (this.surface === 'raft') {
      const profile = CAMERA_MOTION_PROFILES[this.cameraMotionMode];
      const headBob = movementActive ? Math.sin(this.moveCycle) * 0.018 * profile.headBobScale : 0;
      this.raft.clampLocalPosition(this.localPosition);
      this.collisionResolver?.(this.localPosition, this.previousLocalPosition);
      this.localPosition.y = CAMERA_HEIGHT + headBob;
      this.raft.localPointToWorld(this.localPosition, this.worldPosition);
      this.camera.position.copy(this.worldPosition);
      this.cameraMotionFilter.update(this.raft.group.quaternion, delta, profile, this.filteredRaftRotation);
      this.camera.quaternion.copy(this.filteredRaftRotation).multiply(this.lookQuaternion);
    } else {
      const headBob = movementActive
        ? Math.sin(this.moveCycle) * 0.014 * CAMERA_MOTION_PROFILES[this.cameraMotionMode].headBobScale
        : 0;
      const ground = this.islandNavigation?.sampleGroundHeight(this.islandPosition.x, this.islandPosition.z);
      if (ground === null || ground === undefined) {
        this.waterPosition.set(this.islandPosition.x, WATER_SURFACE_Y, this.islandPosition.z);
        this.waterVelocity.set(0, 0, 0);
        this.setSurface('water');
        this.renderOnWater(false);
      } else {
        this.islandPosition.y = ground;
        this.camera.position.set(this.islandPosition.x, this.islandPosition.y + CAMERA_HEIGHT + headBob, this.islandPosition.z);
        this.camera.quaternion.copy(this.lookQuaternion);
      }
    }
    this.finishCameraUpdate(delta);
  }

  private finishCameraUpdate(delta: number): void {
    this.applyCameraShake(delta);
    this.simulationCameraPosition.copy(this.camera.position);
    this.simulationCameraQuaternion.copy(this.camera.quaternion);
    if (!this.cameraPoseInitialized) {
      this.previousCameraPosition.copy(this.simulationCameraPosition);
      this.previousCameraQuaternion.copy(this.simulationCameraQuaternion);
      this.cameraPoseInitialized = true;
    }
  }

  present(alpha: number): void {
    if (!this.cameraPoseInitialized) return;
    const mix = MathUtils.clamp(Number.isFinite(alpha) ? alpha : 0, 0, 1);
    this.camera.position.lerpVectors(this.previousCameraPosition, this.simulationCameraPosition, mix);
    this.camera.quaternion.slerpQuaternions(
      this.previousCameraQuaternion,
      this.simulationCameraQuaternion,
      mix,
    );
  }

  addCameraShake(strength: number): void {
    this.shake = Math.max(this.shake, MathUtils.clamp(strength, 0, 1));
  }

  applyWaterImpulse(origin: Vector3, strength: number): void {
    if (this.surface !== 'water') return;
    this.impulseDirection.copy(this.waterPosition).sub(origin);
    this.impulseDirection.y = Math.max(0.12, this.impulseDirection.y * 0.35);
    if (this.impulseDirection.lengthSq() < 0.01) this.impulseDirection.set(0, 0.18, 1);
    this.waterVelocity.addScaledVector(this.impulseDirection.normalize(), MathUtils.clamp(strength, 0, 5));
  }

  setCollisionResolver(resolver: ((position: Vector3, previous: Vector3) => void) | null): void {
    this.collisionResolver = resolver;
  }

  setIslandNavigation(provider: IslandNavigationProvider | null): void {
    this.islandNavigation = provider;
    if (this.surface === 'island') {
      const ground = provider?.sampleGroundHeight(this.islandPosition.x, this.islandPosition.z);
      if (ground === null || ground === undefined) this.returnToRaftFallback();
      else this.islandPosition.y = ground;
    } else if (this.surface === 'water') {
      const floor = provider?.sampleWaterFloorHeight?.(this.waterPosition.x, this.waterPosition.z);
      if (floor === null || floor === undefined) this.returnToRaftFallback();
      else this.waterPosition.y = MathUtils.clamp(this.waterPosition.y, floor + WATER_FLOOR_CLEARANCE, WATER_SURFACE_Y);
    }
  }

  isOnRaft(): boolean {
    return this.surface === 'raft' && this.verticalMotion.mode === 'grounded';
  }

  isAirborne(): boolean {
    return this.verticalMotion.mode === 'airborne';
  }

  get jumpCount(): number {
    return this.completedJumpCount;
  }

  get inputEnabled(): boolean {
    return this.enabled;
  }

  get keyboardEventCount(): number {
    return this.receivedKeyboardEventCount;
  }

  get jumpState(): string {
    return this.jumpDiagnostic;
  }

  get verticalHeadY(): number {
    return this.verticalMotion.headY;
  }

  get verticalVelocityY(): number {
    return this.verticalMotion.velocityY;
  }

  isSubmerged(): boolean {
    return this.surface === 'water' && this.getDepth() > SURFACE_BREATHING_DEPTH;
  }

  getDepth(): number {
    return this.surface === 'water' ? Math.max(0, WATER_SURFACE_Y - this.waterPosition.y) : 0;
  }

  getSurface(): PlayerSurface {
    return this.surface;
  }

  getWorldFootPosition(target = new Vector3()): Vector3 {
    if (this.verticalMotion.mode === 'airborne') {
      target.copy(this.airbornePosition);
      target.y -= CAMERA_HEIGHT;
      return target;
    }
    if (this.surface === 'island') return target.copy(this.islandPosition);
    if (this.surface === 'water') return target.copy(this.waterPosition);
    this.candidateLocal.copy(this.localPosition);
    this.candidateLocal.y = 0;
    return this.raft.localPointToWorld(this.candidateLocal, target);
  }

  getSavedNavigation(): SavedPlayerNavigation {
    if (this.surface === 'island') return { surface: 'island', x: this.islandPosition.x, z: this.islandPosition.z };
    if (this.surface === 'water') {
      return {
        surface: 'water',
        x: this.waterPosition.x,
        y: Number(this.waterPosition.y.toFixed(3)),
        z: this.waterPosition.z,
      };
    }
    return { surface: 'raft', x: this.localPosition.x, z: this.localPosition.z };
  }

  getForward(target = new Vector3()): Vector3 {
    return this.camera.getWorldDirection(target);
  }

  translateExpedition(deltaX: number, deltaZ: number): void {
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaZ) || this.surface === 'raft') return;
    if (this.surface === 'island') {
      this.islandPosition.x += deltaX;
      this.islandPosition.z += deltaZ;
    } else {
      this.waterPosition.x += deltaX;
      this.waterPosition.z += deltaZ;
    }
    if (this.verticalMotion.mode === 'airborne') {
      this.airbornePosition.x += deltaX;
      this.airbornePosition.z += deltaZ;
    }
    this.camera.position.x += deltaX;
    this.camera.position.z += deltaZ;
  }

  dispose(): void {
    document.removeEventListener('mousemove', this.onMouseMove);
  }

  handleKeyDown(event: KeyboardEvent): void {
    this.receivedKeyboardEventCount += 1;
    if (!this.enabled) return;
    this.keys.add(event.code);
    if (!event.repeat && event.code === 'Space' && this.surface !== 'water') {
      this.jumpQueued = true;
      this.jumpDiagnostic = 'queued';
    }
    if (event.code === 'Space') event.preventDefault();
  }

  handleKeyUp(event: KeyboardEvent): void {
    this.keys.delete(event.code);
  }

  private beginAirborneFromCurrentSurface(): void {
    this.completedJumpCount += 1;
    if (this.surface === 'raft') {
      this.candidateLocal.copy(this.localPosition);
      this.candidateLocal.y = CAMERA_HEIGHT;
      this.raft.localPointToWorld(this.candidateLocal, this.airbornePosition);
      this.lookEuler.y = normalizeYaw(this.lookEuler.y + this.raft.getHeading());
    } else {
      const ground = this.islandNavigation?.sampleGroundHeight(this.islandPosition.x, this.islandPosition.z)
        ?? this.islandPosition.y;
      this.airbornePosition.set(this.islandPosition.x, ground + CAMERA_HEIGHT, this.islandPosition.z);
    }
    this.airborneLookIsWorldSpace = true;
    this.verticalMotion.mode = 'grounded';
    this.verticalMotion.headY = this.airbornePosition.y;
    this.verticalMotion.velocityY = 0;
    this.moveCycle = 0;
    this.stepDistance = 0;
    this.islandNavigation?.onSurfaceChange?.(this.surface);
  }

  private beginAirborneAt(worldHeadPosition: Vector3): void {
    this.airbornePosition.copy(worldHeadPosition);
    if (this.surface === 'raft') this.lookEuler.y = normalizeYaw(this.lookEuler.y + this.raft.getHeading());
    this.airborneLookIsWorldSpace = true;
    this.verticalMotion.mode = 'airborne';
    this.verticalMotion.headY = worldHeadPosition.y;
    this.verticalMotion.velocityY = 0;
    this.moveCycle = 0;
    this.stepDistance = 0;
    this.islandNavigation?.onSurfaceChange?.(this.surface);
  }

  private advanceAirborne(delta: number, inputX: number, inputZ: number, jumpPressed: boolean): void {
    this.lookQuaternion.setFromEuler(this.lookEuler);
    this.moveRight.set(1, 0, 0).applyQuaternion(this.lookQuaternion);
    this.moveForward.set(0, 0, -1).applyQuaternion(this.lookQuaternion);
    this.moveRight.y = 0;
    this.moveForward.y = 0;
    this.moveVector.set(0, 0, 0)
      .addScaledVector(this.moveRight.normalize(), inputX)
      .addScaledVector(this.moveForward.normalize(), -inputZ);
    if (this.moveVector.lengthSq() > 0.001) {
      this.moveVector.normalize().multiplyScalar(2.35 * delta);
      this.airbornePosition.add(this.moveVector);
    }

    const supportHeadY = this.sampleAirborneSupport();
    const event = stepVerticalMotion(
      this.verticalMotion,
      jumpPressed,
      { supportHeadY, waterHeadY: WATER_SURFACE_Y },
      delta,
    );
    this.airbornePosition.y = this.verticalMotion.headY;

    if (event === 'landed') {
      if (this.raft.containsLocalPosition(this.candidateLocal, -0.08)) {
        this.finishAirborneOnSurface('raft');
        this.localPosition.set(this.candidateLocal.x, CAMERA_HEIGHT, this.candidateLocal.z);
        this.raft.clampLocalPosition(this.localPosition);
      } else {
        this.finishAirborneOnSurface('island');
        const ground = this.islandNavigation?.sampleGroundHeight(this.airbornePosition.x, this.airbornePosition.z) ?? 0;
        this.islandPosition.set(this.airbornePosition.x, ground, this.airbornePosition.z);
      }
    } else if (event === 'entered-water') {
      this.finishAirborneOnSurface('water');
      this.waterPosition.set(this.airbornePosition.x, WATER_SURFACE_Y, this.airbornePosition.z);
      this.waterVelocity.set(0, 0, 0);
    }

    if (this.verticalMotion.mode === 'airborne') {
      this.camera.position.copy(this.airbornePosition);
      this.camera.quaternion.copy(this.lookQuaternion);
    } else if (this.surface === 'raft') {
      this.candidateLocal.copy(this.localPosition);
      this.candidateLocal.y = CAMERA_HEIGHT;
      this.raft.localPointToWorld(this.candidateLocal, this.camera.position);
      const profile = CAMERA_MOTION_PROFILES[this.cameraMotionMode];
      this.cameraMotionFilter.update(this.raft.group.quaternion, delta, profile, this.filteredRaftRotation);
      this.lookQuaternion.setFromEuler(this.lookEuler);
      this.camera.quaternion.copy(this.filteredRaftRotation).multiply(this.lookQuaternion);
    } else if (this.surface === 'island') {
      this.camera.position.set(this.islandPosition.x, this.islandPosition.y + CAMERA_HEIGHT, this.islandPosition.z);
      this.camera.quaternion.copy(this.lookQuaternion);
    } else {
      this.renderOnWater(false);
    }
  }

  private sampleAirborneSupport(): number | null {
    this.raftHorizontalFrame.update(this.raft.getHeading());
    this.raftHorizontalFrame.worldToLocal(
      this.airbornePosition,
      this.raft.group.position,
      this.candidateLocal,
    );
    if (this.raft.containsLocalPosition(this.candidateLocal, -0.08)) {
      this.candidateLocal.y = CAMERA_HEIGHT;
      this.raft.localPointToWorld(this.candidateLocal, this.candidatePosition);
      return this.candidatePosition.y;
    }
    const ground = this.islandNavigation?.sampleGroundHeight(this.airbornePosition.x, this.airbornePosition.z);
    return ground === null || ground === undefined ? null : ground + CAMERA_HEIGHT;
  }

  private finishAirborneOnSurface(surface: PlayerSurface): void {
    if (surface === 'raft' && this.airborneLookIsWorldSpace) {
      this.lookEuler.y = normalizeYaw(this.lookEuler.y - this.raft.getHeading());
    }
    this.surface = surface;
    this.verticalMotion.mode = 'grounded';
    this.verticalMotion.velocityY = 0;
    this.airborneLookIsWorldSpace = false;
    this.stepDistance = 0;
    this.islandNavigation?.onSurfaceChange?.(surface);
  }

  private moveOnRaft(movementX: number, movementZ: number): void {
    this.candidateLocal.copy(this.localPosition);
    this.candidateLocal.x += movementX;
    this.candidateLocal.z += movementZ;
    if (this.raft.containsLocalPosition(this.candidateLocal)) {
      this.localPosition.x = this.candidateLocal.x;
      this.localPosition.z = this.candidateLocal.z;
      return;
    }
    this.candidateLocal.y = 0;
    this.raft.localPointToWorld(this.candidateLocal, this.candidatePosition);
    const ground = this.islandNavigation?.sampleGroundHeight(this.candidatePosition.x, this.candidatePosition.z);
    if (ground !== null && ground !== undefined && Math.abs(ground - this.candidatePosition.y) <= 0.52) {
      this.setSurface('island');
      this.islandPosition.set(this.candidatePosition.x, ground, this.candidatePosition.z);
      return;
    }
    this.candidateLocal.y = CAMERA_HEIGHT;
    this.raft.localPointToWorld(this.candidateLocal, this.candidatePosition);
    this.beginAirborneAt(this.candidatePosition);
  }

  private moveOnIsland(movementX: number, movementZ: number): void {
    this.candidatePosition.copy(this.islandPosition);
    this.candidatePosition.x += movementX;
    this.candidatePosition.z += movementZ;
    const ground = this.islandNavigation?.sampleGroundHeight(this.candidatePosition.x, this.candidatePosition.z);
    if (ground !== null && ground !== undefined && Math.abs(ground - this.islandPosition.y) <= 0.42) {
      this.candidatePosition.y = ground;
      this.islandNavigation?.resolveCollision(this.candidatePosition, this.previousIslandPosition);
      this.islandPosition.copy(this.candidatePosition);
      return;
    }
    const departingHeadY = this.islandPosition.y + CAMERA_HEIGHT;
    this.raftHorizontalFrame.update(this.raft.getHeading());
    this.raftHorizontalFrame.worldToLocal(this.candidatePosition, this.raft.group.position, this.candidateLocal);
    if (this.raft.containsLocalPosition(this.candidateLocal)) {
      this.setSurface('raft');
      this.localPosition.set(this.candidateLocal.x, CAMERA_HEIGHT, this.candidateLocal.z);
      this.raft.clampLocalPosition(this.localPosition);
      return;
    }
    this.candidatePosition.y = departingHeadY;
    this.beginAirborneAt(this.candidatePosition);
  }

  private moveOnWater(movement: Vector3): void {
    this.candidatePosition.copy(this.waterPosition).add(movement);
    const nearSurface = this.candidatePosition.y >= WATER_SURFACE_Y - 0.26;
    if (nearSurface) {
      const ground = this.islandNavigation?.sampleGroundHeight(this.candidatePosition.x, this.candidatePosition.z);
      if (ground !== null && ground !== undefined) {
        this.setSurface('island');
        this.islandPosition.set(this.candidatePosition.x, ground, this.candidatePosition.z);
        this.waterVelocity.set(0, 0, 0);
        return;
      }
      if (this.tryClimbToRaft(this.candidatePosition)) return;
    }
    this.physics.resolveSwimmingMovement(this.waterPosition, this.candidatePosition, this.candidatePosition);
    const floor =
      this.islandNavigation?.sampleWaterFloorHeight?.(this.candidatePosition.x, this.candidatePosition.z) ??
      OPEN_WATER_FLOOR_Y;
    this.candidatePosition.y = MathUtils.clamp(
      this.candidatePosition.y,
      floor + WATER_FLOOR_CLEARANCE,
      WATER_SURFACE_Y,
    );
    this.islandNavigation?.resolveWaterCollision?.(this.candidatePosition, this.previousWaterPosition);
    this.waterPosition.copy(this.candidatePosition);
  }

  private tryClimbToRaft(probe: Vector3): boolean {
    if (!this.enabled || !this.keys.has('Space') || this.waterPosition.y < WATER_SURFACE_Y - RAFT_CLIMB_VERTICAL_REACH) {
      return false;
    }
    this.raftHorizontalFrame.update(this.raft.getHeading());
    this.raftHorizontalFrame.worldToLocal(probe, this.raft.group.position, this.candidateLocal);
    const tile = this.raft.getClosestTile(this.candidateLocal);
    if (!tile) return false;
    const centerX = tile.x * RAFT_TILE_X;
    const centerZ = tile.z * RAFT_TILE_Z;
    const deltaX = Math.abs(this.candidateLocal.x - centerX);
    const deltaZ = Math.abs(this.candidateLocal.z - centerZ);
    if (
      deltaX > RAFT_TILE_X * 0.5 + RAFT_CLIMB_HORIZONTAL_REACH
      || deltaZ > RAFT_TILE_Z * 0.5 + RAFT_CLIMB_HORIZONTAL_REACH
    ) {
      return false;
    }
    this.setSurface('raft');
    this.localPosition.set(this.candidateLocal.x, CAMERA_HEIGHT, this.candidateLocal.z);
    this.raft.clampLocalPosition(this.localPosition);
    this.waterVelocity.set(0, 0, 0);
    this.verticalMotion.mode = 'grounded';
    this.verticalMotion.velocityY = 0;
    return true;
  }

  private renderOnWater(moving: boolean): void {
    const floor =
      this.islandNavigation?.sampleWaterFloorHeight?.(this.waterPosition.x, this.waterPosition.z) ?? OPEN_WATER_FLOOR_Y;
    this.waterPosition.y = MathUtils.clamp(this.waterPosition.y, floor + WATER_FLOOR_CLEARANCE, WATER_SURFACE_Y);
    const swimBob = moving ? Math.sin(this.moveCycle) * 0.018 : Math.sin(this.shakeTime * 1.35) * 0.008;
    const surfaceLift = 0.25 * (1 - MathUtils.smoothstep(this.getDepth(), 0.06, 0.34));
    this.camera.position.copy(this.waterPosition);
    this.camera.position.y += swimBob + surfaceLift;
    this.camera.quaternion.copy(this.lookQuaternion);
  }

  private applyCameraShake(delta: number): void {
    if (this.shake <= 0.001) return;
    this.shake = MathUtils.damp(this.shake, 0, 5.2, delta);
    this.shakeOffset
      .set(
        Math.sin(this.shakeTime * 31) * this.shake * 0.055,
        Math.sin(this.shakeTime * 43 + 0.8) * this.shake * 0.035,
        0,
      )
      .applyQuaternion(this.camera.quaternion);
    this.camera.position.add(this.shakeOffset);
    this.shakeEuler.set(
      Math.sin(this.shakeTime * 37) * this.shake * 0.012,
      Math.sin(this.shakeTime * 29) * this.shake * 0.018,
      Math.sin(this.shakeTime * 41) * this.shake * 0.014,
    );
    this.shakeQuaternion.setFromEuler(this.shakeEuler);
    this.camera.quaternion.multiply(this.shakeQuaternion);
  }

  private setSurface(surface: PlayerSurface): void {
    if (surface === this.surface) return;
    const wasOnRaft = this.surface === 'raft';
    const enteringRaft = surface === 'raft';
    if (wasOnRaft && !enteringRaft) {
      this.lookEuler.y = MathUtils.euclideanModulo(this.lookEuler.y + this.raft.getHeading() + Math.PI, Math.PI * 2) - Math.PI;
    } else if (!wasOnRaft && enteringRaft) {
      this.lookEuler.y = MathUtils.euclideanModulo(this.lookEuler.y - this.raft.getHeading() + Math.PI, Math.PI * 2) - Math.PI;
    }
    this.surface = surface;
    this.verticalMotion.mode = 'grounded';
    this.verticalMotion.velocityY = 0;
    this.airborneLookIsWorldSpace = false;
    this.stepDistance = 0;
    this.islandNavigation?.onSurfaceChange?.(surface);
  }

  private returnToRaftFallback(): void {
    this.setSurface('raft');
    this.localPosition.set(0, CAMERA_HEIGHT, 1.08);
    this.raft.clampLocalPosition(this.localPosition);
    this.waterVelocity.set(0, 0, 0);
    this.verticalMotion.mode = 'grounded';
    this.verticalMotion.velocityY = 0;
  }

  private readonly onMouseMove = (event: MouseEvent): void => {
    if (!this.enabled) return;
    this.lookEuler.y -= event.movementX * 0.00175;
    this.lookEuler.x -= event.movementY * 0.00155;
    this.lookEuler.x = MathUtils.clamp(this.lookEuler.x, -1.28, 1.28);
  };
}

function normalizeYaw(value: number): number {
  return MathUtils.euclideanModulo(value + Math.PI, Math.PI * 2) - Math.PI;
}
