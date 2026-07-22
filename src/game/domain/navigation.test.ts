import { describe, expect, it } from 'vitest';
import {
  COURSE_STEP,
  advanceNavigationState,
  bearingTo,
  cardinalLabel,
  createDefaultNavigationState,
  createNavigationDevice,
  cycleNavigationRoute,
  cycleSignalTarget,
  installReceiverCell,
  navigationWeatherAt,
  navigationMetrics,
  normalizeAngle,
  reinforceNavigationSail,
  reinforceNavigationAnchor,
  sanitizeNavigationState,
  selectSignalTarget,
  signalArrayStatus,
  signalChartTelemetry,
  signalTelemetry,
  shortestAngle,
  toggleReceiverPower,
  type SignalTargetId,
} from './navigation';

describe('raft navigation', () => {
  it('normalizes bearings and takes the shortest turn across the angle seam', () => {
    expect(normalizeAngle(Math.PI * 3)).toBeCloseTo(Math.PI);
    expect(shortestAngle(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2);
    expect(bearingTo(0, -10)).toBeCloseTo(0);
    expect(bearingTo(10, 0)).toBeCloseTo(Math.PI / 2);
    expect(cardinalLabel(-Math.PI / 8)).toBe('北');
    expect(cardinalLabel(-Math.PI / 4)).toBe('西北');
  });

  it('makes a deployed, well-trimmed sail materially accelerate the island approach', () => {
    const idle = createDefaultNavigationState();
    const sailing = {
      ...idle,
      courseAngle: 0,
      devices: [{ ...createNavigationDevice('sail', 0, 0, 0, 'sail-test'), deployed: true }],
    };
    expect(navigationMetrics(sailing, 0).approachRate).toBeGreaterThan(navigationMetrics(idle, 0).approachRate + 0.5);
    expect(navigationMetrics({ ...sailing, courseAngle: Math.PI }, 0).sailDrive).toBe(0);
  });

  it('holds position only with a deployed anchor and turns the raft toward its selected course', () => {
    let state = {
      ...createDefaultNavigationState(),
      courseAngle: COURSE_STEP * 2,
      devices: [
        { ...createNavigationDevice('sail', 0, 0, 0, 'sail-test'), deployed: true },
        { ...createNavigationDevice('anchor', 1, 0, 0, 'anchor-test'), deployed: true },
      ],
    };
    expect(navigationMetrics(state, 0)).toMatchObject({ anchored: true, approachRate: 0, dockDriftRate: 0 });
    state = advanceNavigationState(state, 1);
    expect(state.heading).toBeGreaterThan(0);
    expect(state.heading).toBeLessThan(state.courseAngle);
  });

  it('sanitizes duplicate equipment, invalid angles and unsafe clocks', () => {
    const state = sanitizeNavigationState({
      windClock: Infinity,
      courseAngle: 99,
      heading: Number.NaN,
      devices: [
        { id: 'first', type: 'sail', x: 1.8, z: -1.2, rotation: 1.4, deployed: true },
        { id: 'second', type: 'sail', x: 4, z: 4, deployed: false },
        { id: 'anchor', type: 'anchor', x: 0, z: 1, rotation: 0, deployed: true },
        { id: 'helm', type: 'helm', x: -1, z: 0, rotation: 0 },
      ],
    });
    expect(state.windClock).toBe(0);
    expect(state.devices).toHaveLength(3);
    expect(state.devices[0]).toMatchObject({ id: 'first', x: 2, z: -1, rotation: Math.PI / 2, deployed: true });
    expect(Number.isFinite(state.courseAngle)).toBe(true);
    expect(Number.isFinite(state.heading)).toBe(true);
  });

  it('builds, peaks and clears a deterministic storm cycle', () => {
    expect(navigationWeatherAt(20)).toMatchObject({ phase: 'calm', intensity: 0 });
    expect(navigationWeatherAt(108).phase).toBe('building');
    expect(navigationWeatherAt(140)).toMatchObject({ phase: 'storm', intensity: 1 });
    expect(navigationWeatherAt(195).phase).toBe('clearing');
    expect(navigationWeatherAt(210)).toMatchObject({ phase: 'calm', intensity: 0 });
  });

  it('uses a helm and shelter route to resist gust drift', () => {
    const sail = { ...createNavigationDevice('sail', 0, 0, 0, 'sail'), deployed: true };
    const exposed = {
      ...createDefaultNavigationState(),
      weatherClock: 140,
      windClock: 140,
      devices: [sail],
    };
    const protectedState = {
      ...reinforceNavigationSail({
        ...exposed,
        routeMode: cycleNavigationRoute(cycleNavigationRoute('manual')),
        devices: [sail, createNavigationDevice('helm', 1, 0, 0, 'helm')],
      }),
    };
    const exposedNext = advanceNavigationState(exposed, 1, 0);
    const protectedNext = advanceNavigationState(protectedState, 1, 0);
    const exposedCalm = advanceNavigationState({ ...exposed, weatherClock: 20 }, 1, 0);
    const protectedCalm = advanceNavigationState({ ...protectedState, weatherClock: 20 }, 1, 0);
    expect(Math.abs(shortestAngle(protectedCalm.heading, protectedNext.heading))).toBeLessThan(
      Math.abs(shortestAngle(exposedCalm.heading, exposedNext.heading)),
    );
    expect(protectedNext.sailStrain).toBeLessThan(exposedNext.sailStrain);
  });

  it('auto-reefs an unreinforced sail after sustained storm overload', () => {
    let state = {
      ...createDefaultNavigationState(),
      weatherClock: 130,
      windClock: 130,
      sailStrain: 0.96,
      devices: [{ ...createNavigationDevice('sail', 0, 0, 0, 'sail'), deployed: true }],
    };
    state = advanceNavigationState(state, 3, 0);
    expect(state.devices[0]).toMatchObject({ deployed: false, reinforced: false });
    expect(state.sailStrain).toBeCloseTo(0.74);
  });

  it('lets an exposed anchor slip at peak load while a ratchet-reinforced anchor unloads', () => {
    const exposed = {
      ...createDefaultNavigationState(),
      weatherClock: 140,
      anchorStrain: 0.99,
      devices: [{ ...createNavigationDevice('anchor', 0, 0, 0, 'anchor'), deployed: true }],
    };
    const slipped = advanceNavigationState(exposed, 3, 0);
    expect(slipped.devices[0]).toMatchObject({ deployed: false, reinforced: false });
    expect(slipped.anchorStrain).toBeCloseTo(0.7);

    const reinforced = reinforceNavigationAnchor(exposed);
    const held = advanceNavigationState(reinforced, 3, 0);
    expect(held.devices[0]).toMatchObject({ deployed: true, reinforced: true });
    expect(held.anchorStrain).toBeLessThan(reinforced.anchorStrain);
  });

  it('requires a separated receiver array before loading and powering a signal scan', () => {
    const missing = createDefaultNavigationState();
    expect(signalArrayStatus(missing)).toBe('missing-receiver');
    const tooClose = {
      ...missing,
      devices: [
        createNavigationDevice('receiver', 0, 0, 0, 'receiver'),
        createNavigationDevice('antenna', 1, 0, 0, 'antenna'),
      ],
    };
    expect(signalArrayStatus(tooClose)).toBe('too-close');
    expect(toggleReceiverPower(tooClose)).toBe(tooClose);

    const ready = {
      ...tooClose,
      devices: [tooClose.devices[0], { ...tooClose.devices[1], x: 2 }],
    };
    const loaded = installReceiverCell(ready);
    expect(loaded).toMatchObject({ receiverCharge: 360, activeSignal: 'tideRelay', discoveredSignals: ['tideRelay'] });
    expect(signalArrayStatus(loaded)).toBe('ready');
    expect(toggleReceiverPower(loaded).receiverOn).toBe(true);
  });

  it('drains receiver power, records persistent world travel and unlocks chained signals on arrival', () => {
    const powered = toggleReceiverPower(installReceiverCell({
      ...createDefaultNavigationState(),
      devices: [
        createNavigationDevice('receiver', 0, 0, 0, 'receiver'),
        createNavigationDevice('antenna', 2, 0, 0, 'antenna'),
      ],
    }));
    const nearTarget = { ...powered, worldX: 72, worldZ: -138 };
    const advanced = advanceNavigationState(nearTarget, 2, 0);
    expect(advanced.receiverCharge).toBeCloseTo(358);
    expect(advanced.worldZ).toBeLessThan(nearTarget.worldZ);
    expect(advanced.visitedSignals).toEqual(['tideRelay']);
    expect(advanced.discoveredSignals).toEqual(['tideRelay', 'ironChoir']);
    expect(signalTelemetry(advanced)).toMatchObject({ online: true, targetName: '潮痕中继站' });
    expect(cycleSignalTarget(advanced).activeSignal).toBe('ironChoir');
    expect(cycleNavigationRoute('shelter', true)).toBe('signal');
  });

  it('builds a chart from the saved signal origin without revealing locked coordinates', () => {
    const state = {
      ...createDefaultNavigationState(),
      worldX: 80,
      worldZ: -120,
      signalOriginX: 8,
      signalOriginZ: 18,
      activeSignal: 'ironChoir' as const,
      discoveredSignals: ['tideRelay', 'ironChoir'] as SignalTargetId[],
      visitedSignals: ['tideRelay'] as SignalTargetId[],
    };
    const chart = signalChartTelemetry(state);
    expect(chart).toMatchObject({ originX: 8, originZ: 18, raftX: 80, raftZ: -120, complete: false });
    expect(chart.targets[0]).toMatchObject({ id: 'tideRelay', worldX: 80, worldZ: -120, visited: true });
    expect(chart.targets[1]).toMatchObject({ id: 'ironChoir', worldX: -228, worldZ: -308, active: true });
    expect(chart.targets[1].distance).toBeCloseTo(Math.hypot(308, 188));
    expect(chart.targets[2]).toMatchObject({
      id: 'stormNeedle',
      discovered: false,
      name: null,
      frequency: null,
      summary: null,
      unlock: null,
      worldX: null,
      worldZ: null,
      distance: null,
      bearing: null,
    });
    expect(selectSignalTarget(state, 'tideRelay')).toMatchObject({ activeSignal: 'tideRelay', routeMode: 'signal' });
    expect(selectSignalTarget({ ...state, routeMode: 'manual' }, 'ironChoir')).toMatchObject({ activeSignal: 'ironChoir', routeMode: 'signal' });
    expect(selectSignalTarget(state, 'stormNeedle')).toBe(state);
  });

  it('sanitizes forged signal state and drops signal steering when the array is invalid', () => {
    const state = sanitizeNavigationState({
      worldX: Infinity,
      worldZ: -42,
      receiverOn: true,
      receiverCharge: 999,
      routeMode: 'signal',
      activeSignal: 'not-real',
      discoveredSignals: ['tideRelay', 'not-real', 'tideRelay'],
      visitedSignals: ['ironChoir', 'tideRelay'],
      devices: [createNavigationDevice('helm', 0, 0, 0, 'helm')],
    });
    expect(state).toMatchObject({
      worldX: 0,
      worldZ: -42,
      receiverOn: false,
      receiverCharge: 360,
      routeMode: 'manual',
      activeSignal: 'tideRelay',
      discoveredSignals: [],
      visitedSignals: [],
    });

    const skipped = sanitizeNavigationState({
      signalOriginX: 4,
      signalOriginZ: -6,
      activeSignal: 'stormNeedle',
      discoveredSignals: ['tideRelay', 'stormNeedle', 'ironChoir'],
      visitedSignals: ['tideRelay', 'stormNeedle'],
      devices: [],
    });
    expect(skipped.discoveredSignals).toEqual(['tideRelay', 'ironChoir']);
    expect(skipped.visitedSignals).toEqual(['tideRelay']);
    expect(skipped.activeSignal).toBe('tideRelay');
  });
});
