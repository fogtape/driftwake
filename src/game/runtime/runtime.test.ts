import { describe, expect, it, vi } from 'vitest';
import { FixedStepScheduler, isSimulationActive } from './runtime';

describe('FixedStepScheduler', () => {
  it('turns variable frames into deterministic simulation steps and exposes interpolation', () => {
    const scheduler = new FixedStepScheduler({ stepSeconds: 0.01 });
    const step = vi.fn();

    expect(scheduler.advance(0.006, step).steps).toBe(0);
    const result = scheduler.advance(0.016, step);

    expect(step).toHaveBeenCalledTimes(2);
    expect(result.simulationSeconds).toBeCloseTo(0.02);
    expect(result.alpha).toBeCloseTo(0.2);
    expect(result.interpolatedSeconds).toBeCloseTo(0.022);
  });

  it('drops and records whole excess steps after the substep budget', () => {
    const scheduler = new FixedStepScheduler({ stepSeconds: 0.1, maxFrameSeconds: 1, maxSubSteps: 2 });
    const first = scheduler.advance(0.55, () => undefined);
    const second = scheduler.advance(0.25, () => undefined);

    expect(first.steps).toBe(2);
    expect(first.droppedSeconds).toBeCloseTo(0.3);
    expect(first.alpha).toBeCloseTo(0.5);
    expect(second.totalDroppedSeconds).toBeCloseTo(0.4);
  });

  it('reports wall time clipped by the maximum frame budget', () => {
    const scheduler = new FixedStepScheduler();
    const result = scheduler.advance(0.5, () => undefined);

    expect(result.steps).toBe(12);
    expect(result.droppedSeconds).toBeCloseTo(0.3);
    expect(result.totalDroppedSeconds).toBeCloseTo(0.3);
  });

  it('clears paused-frame remainder without resetting simulation time or telemetry', () => {
    const scheduler = new FixedStepScheduler({ stepSeconds: 0.01 });
    scheduler.advance(0.016, () => undefined);
    scheduler.resetAccumulator();
    const result = scheduler.advance(0.004, () => undefined);

    expect(result.steps).toBe(0);
    expect(result.simulationSeconds).toBeCloseTo(0.01);
    expect(result.alpha).toBeCloseTo(0.4);
  });

  it('rejects invalid scheduler configuration', () => {
    expect(() => new FixedStepScheduler({ stepSeconds: 0 })).toThrow(RangeError);
    expect(() => new FixedStepScheduler({ maxSubSteps: 1.5 })).toThrow(RangeError);
  });
});

describe('isSimulationActive', () => {
  const active = {
    phase: 'playing' as const,
    ready: true,
    pointerLocked: true,
    settingsOpen: false,
    overlayOpen: false,
    documentVisible: true,
    windowFocused: true,
    contextHealthy: true,
  };

  it('requires every runtime ownership gate', () => {
    expect(isSimulationActive(active)).toBe(true);
    for (const patch of [
      { phase: 'title' as const },
      { ready: false },
      { pointerLocked: false },
      { settingsOpen: true },
      { overlayOpen: true },
      { documentVisible: false },
      { windowFocused: false },
      { contextHealthy: false },
    ]) {
      expect(isSimulationActive({ ...active, ...patch })).toBe(false);
    }
  });
});
