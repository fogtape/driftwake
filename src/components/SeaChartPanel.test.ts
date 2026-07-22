import { describe, expect, it } from 'vitest';
import { chartPoint } from './SeaChartPanel';

describe('sea chart projection', () => {
  it('keeps north (-Z) above south and east (+X) to the right', () => {
    const north = chartPoint(0, -390);
    const south = chartPoint(0, 70);
    const west = chartPoint(-300, 0);
    const east = chartPoint(450, 0);

    expect(north.y).toBeLessThan(south.y);
    expect(west.x).toBeLessThan(east.x);
  });

  it('clamps off-chart positions while retaining an edge warning', () => {
    expect(chartPoint(-1_000, -1_000)).toEqual({ x: 3, y: 3, clipped: true });
    expect(chartPoint(0, 0).clipped).toBe(false);
  });
});
