import { describe, expect, it } from 'vitest';
import { advanceFishFight } from './fishing';

describe('fish fight model', () => {
  it('builds tension and progress while reeling', () => {
    const result = advanceFishFight({ tension: 0.3, progress: 0.1 }, true, 0.6, 0.1);
    expect(result.tension).toBeGreaterThan(0.3);
    expect(result.progress).toBeGreaterThan(0.1);
    expect(result.outcome).toBe('fighting');
  });

  it('allows line tension to recover while preserving most progress', () => {
    const result = advanceFishFight({ tension: 0.8, progress: 0.5 }, false, 0.4, 0.1);
    expect(result.tension).toBeLessThan(0.8);
    expect(result.progress).toBeGreaterThan(0.49);
  });

  it('reports a broken line at the upper tension limit', () => {
    const result = advanceFishFight({ tension: 0.98, progress: 0.6 }, true, 1, 0.1);
    expect(result.outcome).toBe('broken');
  });
});
