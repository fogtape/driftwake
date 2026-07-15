import { beforeEach, describe, expect, it } from 'vitest';
import { itemCount, usedInventorySlots } from '../game/domain/items';
import { useGameStore } from './gameStore';

describe('game store item use', () => {
  beforeEach(() => {
    const inventory = { freshWaterCup: 1 } as const;
    useGameStore.setState({
      inventory,
      inventorySlots: usedInventorySlots(inventory),
      survival: { health: 70, thirst: 20, hunger: 60, oxygen: 100 },
    });
  });

  it('returns the reusable cup after drinking distilled water', () => {
    expect(useGameStore.getState().useItem('freshWaterCup')).toBe(true);
    const state = useGameStore.getState();
    expect(state.survival).toEqual({ health: 71, thirst: 62, hunger: 60, oxygen: 100 });
    expect(itemCount(state.inventory, 'freshWaterCup')).toBe(0);
    expect(itemCount(state.inventory, 'emptyCup')).toBe(1);
    expect(state.inventorySlots).toBe(1);
  });

  it('applies underwater oxygen loss and direct creature damage independently', () => {
    useGameStore.getState().tickSurvival(2, true);
    expect(useGameStore.getState().survival.oxygen).toBeCloseTo(94.9);
    useGameStore.getState().damagePlayer(18);
    expect(useGameStore.getState().survival.health).toBe(52);
  });
});
