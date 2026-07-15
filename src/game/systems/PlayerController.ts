import { Euler, MathUtils, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import type { EnvironmentSample } from '../environment/environment';
import { sampleWaveHeight } from '../math/waves';
import { RaftHorizontalFrame } from '../player/RaftHorizontalFrame';
import {
  isInClimbBand,
  isWithinRaftBounds,
  pushOutsideRaftFootprint,
  stepPlayerVertical,
  type PlayerLocomotionMode,
  type PlayerVerticalEnvironment,
  type PlayerVerticalInput,
  type PlayerVerticalState,
} from '../player/locomotion';
import type { RaftSystem } from './RaftSystem';

const CAMERA_HEIGHT = 1.54;
const RAFT_WALK_SPEED = 2.45;
const AIR_CONTROL_SPEED = 2.15;
const SWIM_SPEED = 1.65;
const RAFT_SUPPORT_INSET = 0.2;
const RAFT_CLIMB_INSET = 0.38;
const UNDER_RAFT_CLEARANCE = 0.38;
const CLIMB_VERTICAL_REACH = 1.65;

export class PlayerController {
  readonly localPosition = new Vector3(0, CAMERA_HEIGHT, 1.08);
  private readonly keys = new Set<string>();
  private readonly lookEuler = new Euler(0, 0, 0, 'YXZ');
  private readonly lookQuaternion = new Quaternion();
  private readonly raftHorizontalFrame = new RaftHorizontalFrame();
  private readonly worldPosition = new Vector3();
  private readonly cameraPosition = new Vector3();
  private readonly raftLocalProbe = new Vector3();
  private readonly deckProbeLocal = new Vector3();
  private readonly deckHeadWorld = new Vector3();
  private readonly verticalState: PlayerVerticalState = {
    mode: 'raft',
    headY: CAMERA_HEIGHT,
    verticalVelocity: 0,
  };
  private readonly verticalInput: PlayerVerticalInput = {
    jumpPressed: false,
    climbPressed: false,
    ascendHeld: false,
    diveHeld: false,
  };
  private readonly verticalEnvironment: PlayerVerticalEnvironment = {
    supportedByRaft: true,
    nearRaftEdge: false,
    deckHeadY: CAMERA_HEIGHT,
    waterY: 0,
  };
  private moveCycle = 0;
  private jumpQueued = false;
  private interactQueued = false;
  private headBobEnabled = true;
  private enabled = false;

  constructor(
    private readonly camera: PerspectiveCamera,
    private readonly raft: RaftSystem,
    private readonly onModeChange: (mode: PlayerLocomotionMode) => void = () => undefined,
  ) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('mousemove', this.onMouseMove);
  }

  get mode(): PlayerLocomotionMode {
    return this.verticalState.mode;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.keys.clear();
      this.jumpQueued = false;
      this.interactQueued = false;
    }
  }

  setHeadBobEnabled(enabled: boolean): void {
    this.headBobEnabled = enabled;
    if (!enabled) this.moveCycle = 0;
  }

  update(time: number, delta: number, environment: EnvironmentSample): void {
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
      const movementX = inputX * cosine - inputZ * sine;
      const movementZ = inputX * sine + inputZ * cosine;
      const speed = this.verticalState.mode === 'raft'
        ? RAFT_WALK_SPEED
        : this.verticalState.mode === 'swimming'
          ? SWIM_SPEED
          : AIR_CONTROL_SPEED;
      if (this.verticalState.mode === 'raft') {
        this.localPosition.x += movementX * speed * delta;
        this.localPosition.z += movementZ * speed * delta;
      } else {
        this.worldPosition.x += movementX * speed * delta;
        this.worldPosition.z += movementZ * speed * delta;
      }
      this.moveCycle += delta * (this.verticalState.mode === 'swimming' ? 4.6 : 8.4);
    } else {
      this.moveCycle = MathUtils.damp(this.moveCycle, 0, 4.5, delta);
    }

    if (this.verticalState.mode === 'swimming') {
      const windDrift = environment.windStrength * 0.18 * delta;
      this.worldPosition.x += environment.windDirectionX * windDrift;
      this.worldPosition.z += environment.windDirectionZ * windDrift;
    }

    if (this.verticalState.mode === 'raft') {
      this.localPosition.y = CAMERA_HEIGHT;
      this.raft.localPointToWorld(this.localPosition, this.worldPosition);
    } else {
      this.worldPosition.y = this.verticalState.headY;
    }

    this.raftHorizontalFrame.update(this.raft.group.quaternion);
    this.raftHorizontalFrame.worldToLocal(
      this.worldPosition,
      this.raft.group.position,
      this.raftLocalProbe,
    );
    if (
      this.verticalState.mode === 'swimming'
      && pushOutsideRaftFootprint(
        this.raftLocalProbe,
        this.raft.halfExtent,
        UNDER_RAFT_CLEARANCE,
      )
    ) {
      this.raftHorizontalFrame.localToWorld(
        this.raftLocalProbe,
        this.raft.group.position,
        this.worldPosition.y,
        this.worldPosition,
      );
    }
    this.deckProbeLocal.set(this.raftLocalProbe.x, CAMERA_HEIGHT, this.raftLocalProbe.z);
    this.raft.localPointToWorld(this.deckProbeLocal, this.deckHeadWorld);

    this.verticalEnvironment.supportedByRaft = isWithinRaftBounds(
      this.raftLocalProbe.x,
      this.raftLocalProbe.z,
      this.raft.halfExtent,
      RAFT_SUPPORT_INSET,
    );
    this.verticalEnvironment.nearRaftEdge = isInClimbBand(
      this.raftLocalProbe.x,
      this.raftLocalProbe.z,
      this.raft.halfExtent,
    ) && Math.abs(this.worldPosition.y - this.deckHeadWorld.y) <= CLIMB_VERTICAL_REACH;
    this.verticalEnvironment.deckHeadY = this.deckHeadWorld.y;
    this.verticalEnvironment.waterY = sampleWaveHeight(
      this.worldPosition.x,
      this.worldPosition.z,
      time,
      environment.waveScale,
    );

    this.verticalState.headY = this.worldPosition.y;
    this.verticalInput.jumpPressed = this.enabled && this.jumpQueued;
    this.verticalInput.climbPressed = this.enabled && (this.keys.has('Space') || this.interactQueued);
    this.verticalInput.ascendHeld = this.enabled && this.keys.has('Space');
    this.verticalInput.diveHeld = this.enabled
      && (this.keys.has('KeyC') || this.keys.has('ControlLeft') || this.keys.has('ControlRight'));

    const previousMode = this.verticalState.mode;
    stepPlayerVertical(
      this.verticalState,
      this.verticalInput,
      this.verticalEnvironment,
      delta,
    );
    this.jumpQueued = false;
    this.interactQueued = false;

    if (this.verticalState.mode !== previousMode) {
      this.moveCycle = 0;
      this.onModeChange(this.verticalState.mode);
    }

    if (this.verticalState.mode === 'raft') {
      if (previousMode !== 'raft') {
        const safeLimit = this.raft.halfExtent - RAFT_CLIMB_INSET;
        this.localPosition.x = MathUtils.clamp(this.raftLocalProbe.x, -safeLimit, safeLimit);
        this.localPosition.z = MathUtils.clamp(this.raftLocalProbe.z, -safeLimit, safeLimit);
      }
      this.localPosition.y = CAMERA_HEIGHT;
      this.raft.localPointToWorld(this.localPosition, this.worldPosition);
      this.verticalState.headY = this.worldPosition.y;
    } else {
      this.worldPosition.y = this.verticalState.headY;
    }

    this.lookQuaternion.setFromEuler(this.lookEuler);
    if (this.verticalState.mode === 'raft') {
      const headBob = inputLength > 0 && this.enabled && this.headBobEnabled
        ? Math.sin(this.moveCycle) * 0.018
        : 0;
      this.localPosition.y = CAMERA_HEIGHT + headBob;
      this.raft.localPointToWorld(this.localPosition, this.cameraPosition);
      this.camera.position.copy(this.cameraPosition);
      this.camera.quaternion.copy(this.raft.group.quaternion).multiply(this.lookQuaternion);
      this.localPosition.y = CAMERA_HEIGHT;
    } else {
      this.camera.position.copy(this.worldPosition);
      this.camera.quaternion.copy(this.lookQuaternion);
    }
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
    if (!this.enabled) return;
    this.keys.add(event.code);
    if (!event.repeat && event.code === 'Space') this.jumpQueued = true;
    if (!event.repeat && event.code === 'KeyE') this.interactQueued = true;
    if (event.code === 'Space' || event.code === 'KeyC') event.preventDefault();
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
