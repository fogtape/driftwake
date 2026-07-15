import { Euler, MathUtils, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import type { RaftSystem } from './RaftSystem';

const CAMERA_HEIGHT = 1.54;

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
  private collisionResolver: ((position: Vector3, previous: Vector3) => void) | null = null;
  private moveCycle = 0;
  private shake = 0;
  private shakeTime = 0;
  private enabled = false;

  constructor(
    private readonly camera: PerspectiveCamera,
    private readonly raft: RaftSystem,
  ) {
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
      const speed = 2.45;
      this.localPosition.x += worldX * speed * delta;
      this.localPosition.z += worldZ * speed * delta;
      this.moveCycle += delta * 8.4;
    } else {
      this.moveCycle = MathUtils.damp(this.moveCycle, 0, 4.5, delta);
    }

    this.raft.clampLocalPosition(this.localPosition);
    this.collisionResolver?.(this.localPosition, this.previousLocalPosition);
    const headBob = inputLength > 0 ? Math.sin(this.moveCycle) * 0.018 : 0;
    this.localPosition.y = CAMERA_HEIGHT + headBob;
    this.raft.localPointToWorld(this.localPosition, this.worldPosition);
    this.camera.position.copy(this.worldPosition);

    this.lookQuaternion.setFromEuler(this.lookEuler);
    this.camera.quaternion.copy(this.raft.group.quaternion).multiply(this.lookQuaternion);
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

  getForward(target = new Vector3()): Vector3 {
    return this.camera.getWorldDirection(target);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('mousemove', this.onMouseMove);
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
