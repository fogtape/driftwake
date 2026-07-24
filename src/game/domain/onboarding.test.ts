import { describe, expect, it } from 'vitest';
import { getVoyageObjective } from './onboarding';

const base = {
  inventory: { hook: 1 },
  survival: { thirst: 82, hunger: 74 },
  raftTiles: 9,
  purifier: { placed: 0, working: 0, ready: 0, progress: 0 },
} as const;

describe('voyage onboarding objectives', () => {
  it('starts from the purifier material loop with proportional resource progress', () => {
    const initial = getVoyageObjective(base);
    expect(initial).toMatchObject({
      id: 'craft-purifier',
      chapter: '漂流起步',
      tone: 'salvage',
      progress: 0,
    });

    const supplied = getVoyageObjective({
      ...base,
      inventory: { hook: 1, timber: 4, polymer: 2, rope: 1 },
    });
    expect(supplied).toMatchObject({ id: 'craft-purifier', progress: 1 });
    expect(supplied?.detail).toContain('漂木 4/4');
    expect(supplied?.detail).toContain('聚合片 2/2');
    expect(supplied?.detail).toContain('绳索 1/1');
  });

  it('moves through placement, cup preparation, active condensation, and collection without stored tutorial state', () => {
    expect(getVoyageObjective({
      ...base,
      inventory: { hook: 1, purifierKit: 1 },
    })).toMatchObject({ id: 'place-purifier', tone: 'water', progress: 1 });

    expect(getVoyageObjective({
      ...base,
      purifier: { placed: 1, working: 0, ready: 0, progress: 0 },
    })).toMatchObject({ id: 'craft-cup', tone: 'salvage' });

    expect(getVoyageObjective({
      ...base,
      inventory: { hook: 1, emptyCup: 1, timber: 1 },
      purifier: { placed: 1, working: 1, ready: 0, progress: 0.42 },
    })).toMatchObject({ id: 'wait-water', tone: 'water', progress: 0.42 });

    expect(getVoyageObjective({
      ...base,
      purifier: { placed: 1, working: 0, ready: 1, progress: 1 },
    })).toMatchObject({ id: 'collect-water', tone: 'water', progress: 1 });
  });

  it('prioritizes immediate consumable supplies before growth and hides after the first raft extension', () => {
    expect(getVoyageObjective({
      ...base,
      inventory: { hook: 1, emergencyWater: 1 },
      survival: { thirst: 28, hunger: 74 },
    })).toMatchObject({ id: 'restore-water', tone: 'water' });

    expect(getVoyageObjective({
      ...base,
      inventory: { hook: 1, ration: 1 },
      survival: { thirst: 82, hunger: 22 },
    })).toMatchObject({ id: 'restore-food', tone: 'food' });

    expect(getVoyageObjective({
      ...base,
      inventory: { hook: 1, freshWaterCup: 1, hammer: 1 },
      raftTiles: 10,
      purifier: { placed: 1, working: 0, ready: 0, progress: 0 },
    })).toBeNull();
  });
});
