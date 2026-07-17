import { describe, expect, it } from 'vitest';
import { shouldShowHeldHook, type HookState } from './HookSystem';

describe('HookSystem visual ownership', () => {
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
