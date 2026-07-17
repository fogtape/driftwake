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
      interaction: null,
      interactionOwner: null,
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

  it('prevents an inactive system from clearing another system interaction', () => {
    const store = useGameStore.getState();
    store.setInteraction('拾取风干枝料', 'island');
    expect(useGameStore.getState()).toMatchObject({ interaction: '拾取风干枝料', interactionOwner: 'island' });
    store.setInteraction(null, 'navigation');
    expect(useGameStore.getState().interaction).toBe('拾取风干枝料');
    store.setInteraction(null, 'island');
    expect(useGameStore.getState()).toMatchObject({ interaction: null, interactionOwner: null });
    store.setInteraction('菜单操作', 'global');
    store.setInteraction(null);
    expect(useGameStore.getState().interaction).toBeNull();
  });

  it('selects the upgraded tool when crafting replaces the equipped base tier', () => {
    const inventory = { spear: 1, metalIngot: 2, rope: 1 } as const;
    useGameStore.setState((state) => ({
      inventory,
      inventorySlots: usedInventorySlots(inventory),
      selectedTool: 'spear',
      progression: { ...state.progression, learned: ['metalSpear'] },
    }));
    expect(useGameStore.getState().craft('metalSpear').ok).toBe(true);
    const state = useGameStore.getState();
    expect(state.selectedTool).toBe('metalSpear');
    expect(itemCount(state.inventory, 'spear')).toBe(0);
    expect(itemCount(state.inventory, 'metalSpear')).toBe(1);
  });
});
