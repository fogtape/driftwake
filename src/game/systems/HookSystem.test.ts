import { describe, expect, it } from 'vitest';
import { shouldBeginHookCast, shouldShowHeldHook, type HookState } from './HookSystem';

describe('HookSystem visual ownership', () => {
  it('requires pointer lock and a completed resume gesture before casting', () => {
    const base = {
      button: 0,
      enabled: true,
      equipped: true,
      state: 'idle' as const,
      now: 1_000,
      armedAt: 1_140,
    };
    expect(shouldBeginHookCast({ ...base, pointerLocked: false })).toBe(false);
    expect(shouldBeginHookCast({ ...base, pointerLocked: true })).toBe(false);
    expect(shouldBeginHookCast({ ...base, pointerLocked: true, now: 1_141 })).toBe(true);
  });

  it('shows the first-person hook only while it is held locally', () => {
    expect(shouldShowHeldHook('idle', true)).toBe(true);
    expect(shouldShowHeldHook('charging', true)).toBe(true);
  });

  it.each<HookState>(['flying', 'latched', 'retracting'])(
    'hides the first-person hook while the projectile is %s',
    (state) => {
      expect(shouldShowHeldHook(state, true)).toBe(false);
    },
  );

  it.each<HookState>(['idle', 'charging', 'flying', 'latched', 'retracting'])(
    'keeps an unequipped hook hidden in the %s state',
    (state) => {
      expect(shouldShowHeldHook(state, false)).toBe(false);
    },
  );
});
