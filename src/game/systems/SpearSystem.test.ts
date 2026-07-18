import { describe, expect, it, vi } from 'vitest';
import { resolveSpearImpact } from './SpearSystem';

describe('SpearSystem impact transaction', () => {
  it('does not wear a spear when the animated thrust misses', () => {
    const strikeTarget = vi.fn(() => false);
    const onSpearHit = vi.fn();

    expect(resolveSpearImpact(false, strikeTarget, onSpearHit)).toBe(false);
    expect(strikeTarget).toHaveBeenCalledWith(34);
    expect(onSpearHit).not.toHaveBeenCalled();
  });

  it.each([
    { upgraded: false, damage: 34 },
    { upgraded: true, damage: 52 },
  ])('wears the matching spear tier once after a $damage-point hit', ({ upgraded, damage }) => {
    const strikeTarget = vi.fn(() => true);
    const onSpearHit = vi.fn();

    expect(resolveSpearImpact(upgraded, strikeTarget, onSpearHit)).toBe(true);
    expect(strikeTarget).toHaveBeenCalledTimes(1);
    expect(strikeTarget).toHaveBeenCalledWith(damage);
    expect(onSpearHit).toHaveBeenCalledOnce();
    expect(onSpearHit).toHaveBeenCalledWith(upgraded);
  });
});
