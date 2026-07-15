import { Euler, MathUtils, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import type { PlayerSurface, SavedPlayerNavigation } from '../domain/save';
import type { RaftSystem } from './RaftSystem';

const CAMERA_HEIGHT = 1.54;

export interface IslandNavigationProvider {
  sampleGroundHeight: (x: number, z: number) => number | null;
  resolveCollision: (position: Vector3, previous: Vector3) => void;
  onSurfaceChange?: (surface: PlayerSurface) => void;
}

export class PlayerController {
  readonly localPosition = new Vector3(0, CAMERA_HEIGHT, 1.08);
  private readonly keys = new Set<string>();
  private readonly lookEuler = new Euler(0, 0, 0, 'YXZ');
  private readonly lookQuaternion = new Quaternion();
  private readonly shakeQuaternion = new Quaternion();
  private readonly shakeEuler = new Euler(0, 0, 0, 'YXZ');
  private readonly shakeOffset = new Vector3();
  private readonly worldPosition = new Vector3();
  private readonly previousLocalPosition = new Vector3();
  private readonly islandPosition = new Vector3();
  private readonly previousIslandPosition = new Vector3();
  private readonly candidatePosition = new Vector3();
  private readonly candidateLocal = new Vector3();
  private collisionResolver: ((position: Vector3, previous: Vector3) => void) | null = null;
  private islandNavigation: IslandNavigationProvider | null = null;
  private surface: PlayerSurface;
  private moveCycle = 0;
  private stepDistance = 0;
  private shake = 0;
  private shakeTime = 0;
  private enabled = false;

  constructor(
    private readonly camera: PerspectiveCamera,
    private readonly raft: RaftSystem,
    navigation: SavedPlayerNavigation = { surface: 'raft', x: 0, z: 1.08 },
    private readonly onFootstep: (surface: PlayerSurface) => void = () => undefined,
  ) {
    this.surface = navigation.surface;
    if (navigation.surface === 'raft') {
      this.localPosition.x = navigation.x;
      this.localPosition.z = navigation.z;
    } else {
      this.islandPosition.set(navigation.x, 0, navigation.z);
    }
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('mousemove', this.onMouseMove);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.keys.clear();
  }

  update(delta: number): void {
    this.shakeTime += delta;
    this.previousLocalPosition.copy(this.localPosition);
    this.previousIslandPosition.copy(this.islandPosition);
    let inputX = 0;
    let inputZ = 0;
    if (this.enabled) {
      if (this.keys.has('KeyA')) inputX -= 1;
      if (this.keys.has('KeyD')) inputX += 1;
      if (this.keys.has('KeyW')) inputZ -= 1;
      if (this.keys.has('KeyS')) inputZ += 1;
    }

    const inputLength = Math.hypot(inputX, inputZ);
    if (inputLength > 0) {
      inputX /= inputLength;
      inputZ /= inputLength;
      const sine = Math.sin(this.lookEuler.y);
      const cosine = Math.cos(this.lookEuler.y);
      const worldX = inputX * cosine - inputZ * sine;
      const worldZ = inputX * sine + inputZ * cosine;
      const speed = this.surface === 'raft' ? 2.45 : 2.7;
      const movementX = worldX * speed * delta;
      const movementZ = worldZ * speed * delta;
      if (this.surface === 'raft') this.moveOnRaft(movementX, movementZ);
      else this.moveOnIsland(movementX, movementZ);
      this.moveCycle += delta * 8.4;
      this.stepDistance += Math.hypot(movementX, movementZ);
      if (this.stepDistance >= (this.surface === 'raft' ? 0.82 : 0.72)) {
        this.stepDistance = 0;
        this.onFootstep(this.surface);
      }
    } else {
      this.moveCycle = MathUtils.damp(this.moveCycle, 0, 4.5, delta);
    }

    this.lookQuaternion.setFromEuler(this.lookEuler);
    const headBob = inputLength > 0 ? Math.sin(this.moveCycle) * (this.surface === 'raft' ? 0.018 : 0.014) : 0;
    if (this.surface === 'raft') {
      this.raft.clampLocalPosition(this.localPosition);
      this.collisionResolver?.(this.localPosition, this.previousLocalPosition);
      this.localPosition.y = CAMERA_HEIGHT + headBob;
      this.raft.localPointToWorld(this.localPosition, this.worldPosition);
      this.camera.position.copy(this.worldPosition);
      this.camera.quaternion.copy(this.raft.group.quaternion).multiply(this.lookQuaternion);
    } else {
      const ground = this.islandNavigation?.sampleGroundHeight(this.islandPosition.x, this.islandPosition.z);
      if (ground === null || ground === undefined) {
        this.returnToRaftFallback();
        this.localPosition.y = CAMERA_HEIGHT + headBob;
        this.raft.localPointToWorld(this.localPosition, this.worldPosition);
        this.camera.position.copy(this.worldPosition);
        this.camera.quaternion.copy(this.raft.group.quaternion).multiply(this.lookQuaternion);
      } else {
        this.islandPosition.y = ground;
        this.camera.position.set(this.islandPosition.x, this.islandPosition.y + CAMERA_HEIGHT + headBob, this.islandPosition.z);
        this.camera.quaternion.copy(this.lookQuaternion);
      }
    }
    if (this.shake > 0.001) {
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
  }

  addCameraShake(strength: number): void {
    this.shake = Math.max(this.shake, MathUtils.clamp(strength, 0, 1));
  }

  setCollisionResolver(resolver: ((position: Vector3, previous: Vector3) => void) | null): void {
    this.collisionResolver = resolver;
  }

  setIslandNavigation(provider: IslandNavigationProvider | null): void {
    this.islandNavigation = provider;
    if (this.surface !== 'island') return;
    const ground = provider?.sampleGroundHeight(this.islandPosition.x, this.islandPosition.z);
    if (ground === null || ground === undefined) this.returnToRaftFallback();
    else this.islandPosition.y = ground;
  }

  isOnRaft(): boolean {
    return this.surface === 'raft';
  }

  getSurface(): PlayerSurface {
    return this.surface;
  }

  getWorldFootPosition(target = new Vector3()): Vector3 {
    if (this.surface === 'island') return target.copy(this.islandPosition);
    this.candidateLocal.copy(this.localPosition);
    this.candidateLocal.y = 0;
    return this.raft.localPointToWorld(this.candidateLocal, target);
  }

  getSavedNavigation(): SavedPlayerNavigation {
    return this.surface === 'island'
      ? { surface: 'island', x: this.islandPosition.x, z: this.islandPosition.z }
      : { surface: 'raft', x: this.localPosition.x, z: this.localPosition.z };
  }

  getForward(target = new Vector3()): Vector3 {
    return this.camera.getWorldDirection(target);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('mousemove', this.onMouseMove);
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
      this.surface = 'island';
      this.islandPosition.set(this.candidatePosition.x, ground, this.candidatePosition.z);
      this.islandNavigation?.onSurfaceChange?.('island');
      return;
    }
    this.localPosition.x = this.candidateLocal.x;
    this.localPosition.z = this.candidateLocal.z;
    this.raft.clampLocalPosition(this.localPosition);
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
    this.candidatePosition.y = this.raft.group.position.y;
    this.raft.worldPointToLocal(this.candidatePosition, this.candidateLocal);
    if (!this.raft.containsLocalPosition(this.candidateLocal)) return;
    this.surface = 'raft';
    this.localPosition.set(this.candidateLocal.x, CAMERA_HEIGHT, this.candidateLocal.z);
    this.raft.clampLocalPosition(this.localPosition);
    this.islandNavigation?.onSurfaceChange?.('raft');
  }

  private returnToRaftFallback(): void {
    this.surface = 'raft';
    this.localPosition.set(0, CAMERA_HEIGHT, 1.08);
    this.raft.clampLocalPosition(this.localPosition);
    this.islandNavigation?.onSurfaceChange?.('raft');
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    this.keys.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private readonly onMouseMove = (event: MouseEvent): void => {
    if (!this.enabled) return;
    this.lookEuler.y -= event.movementX * 0.00175;
    this.lookEuler.x -= event.movementY * 0.00155;
    this.lookEuler.x = MathUtils.clamp(this.lookEuler.x, -1.28, 1.28);
  };
}
