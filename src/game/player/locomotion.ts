export type PlayerLocomotionMode = 'raft' | 'airborne' | 'swimming';

export interface PlayerVerticalState {
  mode: PlayerLocomotionMode;
  headY: number;
  verticalVelocity: number;
}

export interface PlayerVerticalInput {
  jumpPressed: boolean;
  climbPressed: boolean;
  ascendHeld: boolean;
  diveHeld: boolean;
}

export interface PlayerVerticalEnvironment {
  supportedByRaft: boolean;
  nearRaftEdge: boolean;
  deckHeadY: number;
  waterY: number;
}

export interface HorizontalPosition {
  x: number;
  z: number;
}

export const GRAVITY = 9.81;
export const JUMP_SPEED = 4.6;
export const SWIM_SURFACE_OFFSET = 0.42;
export const SWIM_ASCEND_OFFSET = 0.62;
export const SWIM_DIVE_OFFSET = -0.72;
export const SWIM_VERTICAL_SPEED = 2.1;

const CLIMB_INNER_BAND = 0.62;
const CLIMB_OUTER_REACH = 0.95;

export function isWithinRaftBounds(
  localX: number,
  localZ: number,
  halfExtent: number,
  inset = 0,
): boolean {
  const limit = Math.max(0, halfExtent - inset);
  return Math.abs(localX) <= limit && Math.abs(localZ) <= limit;
}

export function isInClimbBand(localX: number, localZ: number, halfExtent: number): boolean {
  const absoluteX = Math.abs(localX);
  const absoluteZ = Math.abs(localZ);
  const outerLimit = halfExtent + CLIMB_OUTER_REACH;
  const edgeDistance = Math.max(absoluteX, absoluteZ);
  return absoluteX <= outerLimit
    && absoluteZ <= outerLimit
    && edgeDistance >= halfExtent - CLIMB_INNER_BAND
    && edgeDistance <= outerLimit;
}

export function pushOutsideRaftFootprint(
  position: HorizontalPosition,
  halfExtent: number,
  clearance: number,
): boolean {
  const limit = Math.max(0, halfExtent + clearance);
  const absoluteX = Math.abs(position.x);
  const absoluteZ = Math.abs(position.z);
  if (absoluteX > limit || absoluteZ > limit) return false;

  const distanceToXEdge = limit - absoluteX;
  const distanceToZEdge = limit - absoluteZ;
  if (distanceToXEdge < distanceToZEdge) {
    position.x = (position.x < 0 ? -1 : 1) * limit;
  } else {
    position.z = (position.z < 0 ? -1 : 1) * limit;
  }
  return true;
}

export function stepPlayerVertical(
  state: PlayerVerticalState,
  input: PlayerVerticalInput,
  environment: PlayerVerticalEnvironment,
  deltaSeconds: number,
): void {
  const delta = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;

  if (state.mode === 'raft') {
    state.headY = environment.deckHeadY;
    state.verticalVelocity = 0;
    if (input.jumpPressed) {
      state.mode = 'airborne';
      state.verticalVelocity = JUMP_SPEED;
    } else if (!environment.supportedByRaft) {
      state.mode = 'airborne';
    } else {
      return;
    }
  }

  if (state.mode === 'airborne') {
    state.verticalVelocity -= GRAVITY * delta;
    state.headY += state.verticalVelocity * delta;

    if (
      state.verticalVelocity <= 0
      && environment.supportedByRaft
      && state.headY <= environment.deckHeadY
    ) {
      state.mode = 'raft';
      state.headY = environment.deckHeadY;
      state.verticalVelocity = 0;
      return;
    }

    if (!environment.supportedByRaft && state.headY <= environment.waterY + SWIM_SURFACE_OFFSET) {
      state.mode = 'swimming';
      state.headY = environment.waterY + SWIM_SURFACE_OFFSET;
      state.verticalVelocity = 0;
    }
    return;
  }

  if (input.climbPressed && environment.nearRaftEdge) {
    state.mode = 'raft';
    state.headY = environment.deckHeadY;
    state.verticalVelocity = 0;
    return;
  }

  const targetOffset = input.diveHeld
    ? SWIM_DIVE_OFFSET
    : input.ascendHeld
      ? SWIM_ASCEND_OFFSET
      : SWIM_SURFACE_OFFSET;
  state.headY = moveTowards(
    state.headY,
    environment.waterY + targetOffset,
    SWIM_VERTICAL_SPEED * delta,
  );
  state.verticalVelocity = 0;
}

function moveTowards(current: number, target: number, maxDelta: number): number {
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + Math.sign(target - current) * maxDelta;
}
