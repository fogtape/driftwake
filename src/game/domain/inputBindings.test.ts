import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INPUT_BINDINGS,
  assignInputBinding,
  formatInputCode,
  matchesInputAction,
  sanitizeInputBindings,
} from './inputBindings';

describe('input bindings', () => {
  it('keeps a complete unique default binding contract', () => {
    const bindings = sanitizeInputBindings({});
    expect(bindings).toEqual(DEFAULT_INPUT_BINDINGS);
    expect(new Set(Object.values(bindings)).size).toBe(Object.keys(bindings).length);
  });

  it('accepts a complete custom mapping and rejects malformed or conflicting persisted values', () => {
    const custom = { ...DEFAULT_INPUT_BINDINGS, interact: 'KeyG', buildCycle: 'KeyZ' };
    expect(sanitizeInputBindings(custom)).toEqual(custom);
    expect(sanitizeInputBindings({ ...custom, crafting: 'KeyG' })).toEqual(DEFAULT_INPUT_BINDINGS);
    expect(sanitizeInputBindings({ ...custom, jump: 'Escape' })).toEqual(DEFAULT_INPUT_BINDINGS);
  });

  it('reports an existing command instead of silently stealing a key', () => {
    expect(assignInputBinding({ ...DEFAULT_INPUT_BINDINGS }, 'interact', 'KeyR')).toEqual({
      ok: false,
      reason: 'conflict',
      conflict: 'alternate',
    });
    expect(assignInputBinding({ ...DEFAULT_INPUT_BINDINGS }, 'interact', 'KeyG')).toEqual({
      ok: true,
      bindings: { ...DEFAULT_INPUT_BINDINGS, interact: 'KeyG' },
    });
  });

  it('preserves the legacy inventory and right-control aliases only for untouched defaults', () => {
    expect(matchesInputAction('inventory', 'KeyI', { ...DEFAULT_INPUT_BINDINGS })).toBe(true);
    expect(matchesInputAction('dive', 'ControlRight', { ...DEFAULT_INPUT_BINDINGS })).toBe(true);
    const remapped = { ...DEFAULT_INPUT_BINDINGS, inventory: 'KeyB', dive: 'KeyX' };
    expect(matchesInputAction('inventory', 'KeyI', remapped)).toBe(false);
    expect(matchesInputAction('dive', 'ControlRight', remapped)).toBe(false);
  });

  it('formats physical keyboard codes for visible controls', () => {
    expect(formatInputCode('KeyW')).toBe('W');
    expect(formatInputCode('Digit4')).toBe('4');
    expect(formatInputCode('ControlLeft')).toBe('左 Ctrl');
  });
});
