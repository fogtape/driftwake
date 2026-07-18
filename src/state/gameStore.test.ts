import { beforeEach, describe, expect, it } from 'vitest';
import { itemCount, usedInventorySlots } from '../game/domain/items';
import { TOOL_MAX_DURABILITY, normalizeToolDurability } from '../game/domain/toolDurability';
import { useGameStore } from './gameStore';

describe('game store item use', () => {
  beforeEach(() => {
    const inventory = { freshWaterCup: 1 } as const;
    useGameStore.setState({
      phase: 'playing',
      failure: null,
      inventory,
      toolDurability: normalizeToolDurability(inventory, null),
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

  it('settles a shark failure once and only recovers after the world drop exists', () => {
    const inventory = { hook: 1, hammer: 1, timber: 10, emergencyWater: 2, ration: 1 } as const;
    useGameStore.setState({
      inventory,
      inventorySlots: usedInventorySlots(inventory),
      toolDurability: normalizeToolDurability(inventory, null),
      selectedTool: 'hook',
      survival: { health: 12, thirst: 40, hunger: 50, oxygen: 100 },
      playSeconds: 91,
    });

    useGameStore.getState().damagePlayer(20, 'shark');
    let state = useGameStore.getState();
    expect(state.phase).toBe('failed');
    expect(state.failure).toEqual({
      cause: 'shark',
      dropped: { timber: 3, emergencyWater: 1 },
      occurredAt: 91,
      dropPending: true,
    });
    expect(state.inventory).toEqual({ hook: 1, hammer: 1, timber: 7, emergencyWater: 1, ration: 1 });
    expect(state.recoverPlayer()).toBe(false);

    state.markFailureDropSpawned();
    expect(useGameStore.getState().failure?.dropPending).toBe(false);
    expect(useGameStore.getState().recoverPlayer()).toBe(true);
    state = useGameStore.getState();
    expect(state).toMatchObject({
      phase: 'playing',
      failure: null,
      survival: { health: 62, thirst: 44, hunger: 48, oxygen: 100 },
      player: { surface: 'raft', depth: 0, submerged: false },
    });
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
    expect(state.toolDurability.metalSpear).toBe(TOOL_MAX_DURABILITY.metalSpear);
  });

  it('removes a broken hook and selects the next owned tool', () => {
    const inventory = { hook: 1, hammer: 1 } as const;
    useGameStore.setState({
      inventory,
      inventorySlots: usedInventorySlots(inventory),
      selectedTool: 'hook',
      toolDurability: { hook: 1, hammer: 24 },
    });
    expect(useGameStore.getState().damageTool('hook')).toEqual({ remaining: 0, broken: true });
    const state = useGameStore.getState();
    expect(itemCount(state.inventory, 'hook')).toBe(0);
    expect(state.toolDurability.hook).toBeUndefined();
    expect(state.selectedTool).toBe('hammer');
  });

  it('crafts a full-durability replacement hook after loss', () => {
    const inventory = { timber: 2, polymer: 2, rope: 1 } as const;
    useGameStore.setState({
      inventory,
      inventorySlots: usedInventorySlots(inventory),
      selectedTool: 'hook',
      toolDurability: {},
    });
    expect(useGameStore.getState().craft('hook').ok).toBe(true);
    const state = useGameStore.getState();
    expect(itemCount(state.inventory, 'hook')).toBe(1);
    expect(state.toolDurability.hook).toBe(TOOL_MAX_DURABILITY.hook);
  });
});
