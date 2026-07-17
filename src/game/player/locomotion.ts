export type VerticalMotionMode = 'grounded' | 'airborne';
export type VerticalMotionEvent = 'none' | 'jumped' | 'landed' | 'entered-water';

export interface VerticalMotionState {
  mode: VerticalMotionMode;
  headY: number;
  velocityY: number;
}

export interface VerticalMotionEnvironment {
  supportHeadY: number | null;
  waterHeadY: number;
}

export const PLAYER_GRAVITY = 9.81;
export const PLAYER_JUMP_SPEED = 4.6;

export function stepVerticalMotion(
  state: VerticalMotionState,
  jumpPressed: boolean,
  environment: VerticalMotionEnvironment,
  deltaSeconds: number,
): VerticalMotionEvent {
  const delta = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
  if (state.mode === 'grounded') {
    if (!jumpPressed) {
      if (environment.supportHeadY !== null) state.headY = environment.supportHeadY;
      state.velocityY = 0;
      return 'none';
    }
    state.mode = 'airborne';
    state.velocityY = PLAYER_JUMP_SPEED;
  }

  state.velocityY -= PLAYER_GRAVITY * delta;
  state.headY += state.velocityY * delta;

  if (
    state.velocityY <= 0
    && environment.supportHeadY !== null
    && state.headY <= environment.supportHeadY
  ) {
    state.mode = 'grounded';
    state.headY = environment.supportHeadY;
    state.velocityY = 0;
    return 'landed';
  }
  if (environment.supportHeadY === null && state.headY <= environment.waterHeadY) {
    state.mode = 'grounded';
    state.headY = environment.waterHeadY;
    state.velocityY = 0;
    return 'entered-water';
  }
  return jumpPressed ? 'jumped' : 'none';
}
