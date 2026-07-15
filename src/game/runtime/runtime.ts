export interface FixedStepOptions {
  stepSeconds?: number;
  maxFrameSeconds?: number;
  maxSubSteps?: number;
}

export interface FixedStepResult {
  steps: number;
  alpha: number;
  simulationSeconds: number;
  interpolatedSeconds: number;
  droppedSeconds: number;
}

export interface SimulationGateState {
  phase: 'title' | 'playing';
  pointerLocked: boolean;
  settingsOpen: boolean;
  documentVisible: boolean;
  windowFocused: boolean;
  contextHealthy: boolean;
}

export interface GameReadinessState {
  initialized: boolean;
  contextLost: boolean;
}

const DEFAULT_STEP_SECONDS = 1 / 60;
const DEFAULT_MAX_FRAME_SECONDS = 0.25;
const DEFAULT_MAX_SUB_STEPS = 8;

export class FixedStepScheduler {
  readonly stepSeconds: number;
  readonly maxFrameSeconds: number;
  readonly maxSubSteps: number;
  private accumulatorSeconds = 0;
  private elapsedSimulationSeconds = 0;

  constructor(options: FixedStepOptions = {}) {
    this.stepSeconds = requirePositiveFinite(options.stepSeconds ?? DEFAULT_STEP_SECONDS, 'stepSeconds');
    this.maxFrameSeconds = requirePositiveFinite(
      options.maxFrameSeconds ?? DEFAULT_MAX_FRAME_SECONDS,
      'maxFrameSeconds',
    );
    this.maxSubSteps = requirePositiveInteger(options.maxSubSteps ?? DEFAULT_MAX_SUB_STEPS, 'maxSubSteps');
  }

  advance(frameSeconds: number, onStep: (stepSeconds: number, simulationSeconds: number) => void): FixedStepResult {
    const safeFrameSeconds = Number.isFinite(frameSeconds) && frameSeconds > 0
      ? Math.min(frameSeconds, this.maxFrameSeconds)
      : 0;
    this.accumulatorSeconds += safeFrameSeconds;

    let steps = 0;
    const epsilon = this.stepSeconds * 1e-9;
    while (this.accumulatorSeconds + epsilon >= this.stepSeconds && steps < this.maxSubSteps) {
      this.accumulatorSeconds = Math.max(0, this.accumulatorSeconds - this.stepSeconds);
      this.elapsedSimulationSeconds += this.stepSeconds;
      steps += 1;
      onStep(this.stepSeconds, this.elapsedSimulationSeconds);
    }

    let droppedSeconds = 0;
    if (this.accumulatorSeconds + epsilon >= this.stepSeconds) {
      const droppedSteps = Math.floor((this.accumulatorSeconds + epsilon) / this.stepSeconds);
      droppedSeconds = droppedSteps * this.stepSeconds;
      this.accumulatorSeconds = Math.max(0, this.accumulatorSeconds - droppedSeconds);
    }

    const alpha = Math.min(1, this.accumulatorSeconds / this.stepSeconds);
    return {
      steps,
      alpha,
      simulationSeconds: this.elapsedSimulationSeconds,
      interpolatedSeconds: this.elapsedSimulationSeconds + this.accumulatorSeconds,
      droppedSeconds,
    };
  }

  resetAccumulator(): void {
    this.accumulatorSeconds = 0;
  }

  get simulationSeconds(): number {
    return this.elapsedSimulationSeconds;
  }
}

export function isGameReady(state: GameReadinessState): boolean {
  return state.initialized && !state.contextLost;
}

export function isSimulationActive(state: SimulationGateState): boolean {
  return state.phase === 'playing'
    && state.pointerLocked
    && !state.settingsOpen
    && state.documentVisible
    && state.windowFocused
    && state.contextHealthy;
}

function requirePositiveFinite(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${label} must be a positive finite number`);
  return value;
}

function requirePositiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) throw new RangeError(`${label} must be a positive integer`);
  return value;
}
