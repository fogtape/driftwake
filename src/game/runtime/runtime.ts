export interface FixedStepOptions {
  stepSeconds?: number;
  maxFrameSeconds?: number;
  maxSubSteps?: number;
}

export interface FixedStepResult {
  steps: number;
  alpha: number;
  frameSeconds: number;
  simulationSeconds: number;
  interpolatedSeconds: number;
  droppedSeconds: number;
  totalDroppedSeconds: number;
}

export interface SimulationGateState {
  phase: 'title' | 'playing';
  ready: boolean;
  pointerLocked: boolean;
  settingsOpen: boolean;
  overlayOpen: boolean;
  documentVisible: boolean;
  windowFocused: boolean;
  contextHealthy: boolean;
}

const DEFAULT_STEP_SECONDS = 1 / 60;
const DEFAULT_MAX_FRAME_SECONDS = 0.2;
const DEFAULT_MAX_SUB_STEPS = 12;

export class FixedStepScheduler {
  readonly stepSeconds: number;
  readonly maxFrameSeconds: number;
  readonly maxSubSteps: number;
  private accumulatorSeconds = 0;
  private elapsedSimulationSeconds = 0;
  private droppedSimulationSeconds = 0;

  constructor(options: FixedStepOptions = {}) {
    this.stepSeconds = requirePositiveFinite(options.stepSeconds ?? DEFAULT_STEP_SECONDS, 'stepSeconds');
    this.maxFrameSeconds = requirePositiveFinite(options.maxFrameSeconds ?? DEFAULT_MAX_FRAME_SECONDS, 'maxFrameSeconds');
    this.maxSubSteps = requirePositiveInteger(options.maxSubSteps ?? DEFAULT_MAX_SUB_STEPS, 'maxSubSteps');
  }

  advance(frameSeconds: number, onStep: (stepSeconds: number, simulationSeconds: number) => void): FixedStepResult {
    const validFrameSeconds = Number.isFinite(frameSeconds) && frameSeconds > 0 ? frameSeconds : 0;
    const safeFrameSeconds = validFrameSeconds > 0
      ? Math.min(validFrameSeconds, this.maxFrameSeconds)
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

    let droppedSeconds = Math.max(0, validFrameSeconds - safeFrameSeconds);
    if (this.accumulatorSeconds + epsilon >= this.stepSeconds) {
      const droppedSteps = Math.floor((this.accumulatorSeconds + epsilon) / this.stepSeconds);
      const droppedAccumulatorSeconds = droppedSteps * this.stepSeconds;
      droppedSeconds += droppedAccumulatorSeconds;
      this.accumulatorSeconds = Math.max(0, this.accumulatorSeconds - droppedAccumulatorSeconds);
    }
    this.droppedSimulationSeconds += droppedSeconds;

    return {
      steps,
      alpha: Math.min(1, this.accumulatorSeconds / this.stepSeconds),
      frameSeconds: safeFrameSeconds,
      simulationSeconds: this.elapsedSimulationSeconds,
      interpolatedSeconds: this.elapsedSimulationSeconds + this.accumulatorSeconds,
      droppedSeconds,
      totalDroppedSeconds: this.droppedSimulationSeconds,
    };
  }

  resetAccumulator(): void {
    this.accumulatorSeconds = 0;
  }

  get simulationSeconds(): number {
    return this.elapsedSimulationSeconds;
  }

  get totalDroppedSeconds(): number {
    return this.droppedSimulationSeconds;
  }
}

export function isSimulationActive(state: SimulationGateState): boolean {
  return state.phase === 'playing'
    && state.ready
    && state.pointerLocked
    && !state.settingsOpen
    && !state.overlayOpen
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
