import { describe, expect, it } from 'vitest';
import {
  TOOL_MAX_DURABILITY,
  applyToolWear,
  freshToolDurability,
  normalizeToolDurability,
  toolDurabilityRatio,
} from './toolDurability';

describe('tool durability', () => {
  it('initializes only owned tools and clamps corrupt values', () => {
    expect(normalizeToolDurability(
      { hook: 1, hammer: 1 },
      { hook: 999, hammer: -4, spear: 20 },
    )).toEqual({ hook: 48, hammer: 1 });
  });

  it('wears a tool to breakage without leaving a zero entry', () => {
    const worn = applyToolWear({ hook: 2 }, 'hook');
    expect(worn).toMatchObject({ remaining: 1, broken: false, durability: { hook: 1 } });
    const broken = applyToolWear(worn.durability, 'hook');
    expect(broken).toEqual({ durability: {}, remaining: 0, broken: true });
  });

  it('restores full durability when a replacement is crafted', () => {
    const fresh = freshToolDurability({}, 'hook');
    expect(fresh.hook).toBe(TOOL_MAX_DURABILITY.hook);
    expect(toolDurabilityRatio(fresh, 'hook')).toBe(1);
  });
});
