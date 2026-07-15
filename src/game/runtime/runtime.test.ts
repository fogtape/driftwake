import { describe, expect, it, vi } from 'vitest';
import { FixedStepScheduler, isGameReady, isSimulationActive } from './runtime';

describe('FixedStepScheduler', () => {
  it('converts a variable render frame into deterministic fixed simulation steps', () => {
    const scheduler = new FixedStepScheduler({ stepSeconds: 1 / 60 });
    const onStep = vi.fn();

    const result = scheduler.advance(1 / 30, onStep);

    expect(onStep).toHaveBeenCalledTimes(2);
    expect(onStep).toHaveBeenNthCalledWith(1, 1 / 60, 1 / 60);
    expect(onStep).toHaveBeenNthCalledWith(2, 1 / 60, 2 / 60);
    expect(result.steps).toBe(2);
    expect(result.alpha).toBeCloseTo(0);
  });

  it('carries a partial frame into the next render frame', () => {
    const scheduler = new FixedStepScheduler({ stepSeconds: 0.01 });
    const onStep = vi.fn();

    expect(scheduler.advance(0.006, onStep).steps).toBe(0);
    const result = scheduler.advance(0.006, onStep);

    expect(onStep).toHaveBeenCalledOnce();
    expect(result.steps).toBe(1);
    expect(result.alpha).toBeCloseTo(0.2);
    expect(result.simulationSeconds).toBeCloseTo(0.01);
  });

  it('drops excess backlog after the substep budget instead of spiralling', () => {
    const scheduler = new FixedStepScheduler({
      stepSeconds: 0.1,
      maxFrameSeconds: 1,
      maxSubSteps: 2,
    });
    const onStep = vi.fn();

    const result = scheduler.advance(0.55, onStep);

    expect(onStep).toHaveBeenCalledTimes(2);
    expect(result.steps).toBe(2);
    expect(result.droppedSeconds).toBeCloseTo(0.3);
    expect(result.alpha).toBeCloseTo(0.5);
    expect(result.simulationSeconds).toBeCloseTo(0.2);
  });

  it('ignores invalid frame deltas and can clear paused-frame remainder', () => {
    const scheduler = new FixedStepScheduler({ stepSeconds: 0.01 });
    const onStep = vi.fn();

    scheduler.advance(Number.NaN, onStep);
    scheduler.advance(-1, onStep);
    scheduler.advance(0.006, onStep);
    scheduler.resetAccumulator();
    const result = scheduler.advance(0.004, onStep);

    expect(onStep).not.toHaveBeenCalled();
    expect(result.alpha).toBeCloseTo(0.4);
    expect(result.simulationSeconds).toBe(0);
  });
});

describe('isGameReady', () => {
  it('becomes ready only after initialization with a healthy graphics context', () => {
    expect(isGameReady({ initialized: true, contextLost: false })).toBe(true);
    expect(isGameReady({ initialized: false, contextLost: false })).toBe(false);
    expect(isGameReady({ initialized: true, contextLost: true })).toBe(false);
  });
});

describe('isSimulationActive', () => {
  const activeState = {
    phase: 'playing' as const,
    pointerLocked: true,
    settingsOpen: false,
    documentVisible: true,
    windowFocused: true,
    contextHealthy: true,
  };

  it('runs only while active play owns pointer input in a visible document', () => {
    expect(isSimulationActive(activeState)).toBe(true);
  });

  it.each([
    { phase: 'title' as const },
    { pointerLocked: false },
    { settingsOpen: true },
    { documentVisible: false },
    { windowFocused: false },
    { contextHealthy: false },
  ])('pauses when runtime gate changes: %o', (override) => {
    expect(isSimulationActive({ ...activeState, ...override })).toBe(false);
  });
});
