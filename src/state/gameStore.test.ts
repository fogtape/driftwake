import { beforeEach, describe, expect, it } from 'vitest';
import { itemCount, usedInventorySlots, type ToolId } from '../game/domain/items';
import { TOOL_MAX_DURABILITY, normalizeToolDurability } from '../game/domain/toolDurability';
import { createDefaultCraftingQueue } from '../game/domain/craftingQueue';
import { DEFAULT_INPUT_BINDINGS } from '../game/domain/inputBindings';
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
      crafting: createDefaultCraftingQueue(),
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

  it('resets gameplay between save slots without changing user preferences', () => {
    useGameStore.setState({
      audioEnabled: false,
      quality: 'low',
      dynamicResolutionEnabled: false,
      keyBindings: { ...DEFAULT_INPUT_BINDINGS, interact: 'KeyG' },
      captionsEnabled: true,
      colorVisionMode: 'highContrast',
      reducedMotion: true,
      playSeconds: 999,
      failure: { cause: 'shark', dropped: { timber: 1 }, occurredAt: 998, dropPending: false },
    });

    useGameStore.getState().resetSession();

    const state = useGameStore.getState();
    expect(state).toMatchObject({
      phase: 'title',
      ready: false,
      audioEnabled: false,
      quality: 'low',
      dynamicResolutionEnabled: false,
      keyBindings: { ...DEFAULT_INPUT_BINDINGS, interact: 'KeyG' },
      captionsEnabled: true,
      colorVisionMode: 'highContrast',
      reducedMotion: true,
      playSeconds: 0,
      failure: null,
      selectedTool: 'hook',
      saveStatus: 'idle',
    });
    expect(itemCount(state.inventory, 'hook')).toBe(1);
  });

  it('commits a structure replacement exchange as one inventory update', () => {
    const inventory = { timber: 4, rope: 3 } as const;
    useGameStore.setState({ inventory, inventorySlots: usedInventorySlots(inventory) });
    expect(useGameStore.getState().exchangeItemBundles({ timber: 1, rope: 2 }, { fiber: 2 })).toMatchObject({
      ok: true,
      reason: 'exchanged',
      inventory: { timber: 3, rope: 1, fiber: 2 },
    });
    expect(useGameStore.getState().inventory).toEqual({ timber: 3, rope: 1, fiber: 2 });
  });

  it('does not consume a supply when all of its positive effects are full', () => {
    const inventory = { emergencyWater: 1 } as const;
    useGameStore.setState({
      inventory,
      inventorySlots: usedInventorySlots(inventory),
      survival: { health: 100, thirst: 100, hunger: 100, oxygen: 100 },
    });
    expect(useGameStore.getState().useItem('emergencyWater')).toBe(false);
    expect(useGameStore.getState().inventory).toEqual(inventory);
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

  it('selects the upgraded tool when queued crafting replaces the equipped base tier', () => {
    const inventory = { spear: 1, metalIngot: 2, rope: 1 } as const;
    useGameStore.setState((state) => ({
      inventory,
      inventorySlots: usedInventorySlots(inventory),
      selectedTool: 'spear',
      progression: { ...state.progression, learned: ['metalSpear'] },
    }));
    expect(useGameStore.getState().queueCraft('metalSpear', 1).ok).toBe(true);
    expect(useGameStore.getState().tickCrafting(2.8).completed).toHaveLength(1);
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

  it.each<ToolId>(['hammer', 'spear', 'metalSpear', 'fishingRod', 'axe', 'metalAxe', 'resonanceFork'])(
    'atomically removes a broken %s and selects an owned fallback',
    (tool) => {
      const inventory = { hook: 1, [tool]: 1 };
      useGameStore.setState({
        inventory,
        inventorySlots: usedInventorySlots(inventory),
        selectedTool: tool,
        toolDurability: { hook: 24, [tool]: 1 },
      });

      expect(useGameStore.getState().damageTool(tool)).toEqual({ remaining: 0, broken: true });
      const state = useGameStore.getState();
      expect(itemCount(state.inventory, tool)).toBe(0);
      expect(state.toolDurability[tool]).toBeUndefined();
      expect(state.selectedTool).toBe('hook');
      expect(state.toolDurability.hook).toBe(24);
    },
  );

  it('completes a full-durability replacement hook after loss', () => {
    const inventory = { timber: 2, polymer: 2, rope: 1 } as const;
    useGameStore.setState({
      inventory,
      inventorySlots: usedInventorySlots(inventory),
      selectedTool: 'hook',
      toolDurability: {},
    });
    expect(useGameStore.getState().queueCraft('hook', 1).ok).toBe(true);
    expect(useGameStore.getState().tickCrafting(2.4).completed).toHaveLength(1);
    const state = useGameStore.getState();
    expect(itemCount(state.inventory, 'hook')).toBe(1);
    expect(state.toolDurability.hook).toBe(TOOL_MAX_DURABILITY.hook);
  });

  it('commits queued materials and completes one portable craft at a time', () => {
    const inventory = { fiber: 4 } as const;
    useGameStore.setState({
      inventory,
      inventorySlots: usedInventorySlots(inventory),
      crafting: createDefaultCraftingQueue(),
    });
    const queued = useGameStore.getState().queueCraft('rope', 2);
    expect(queued).toMatchObject({ ok: true, queued: 2, inventory: {} });
    expect(useGameStore.getState().crafting.entries).toHaveLength(2);

    const first = useGameStore.getState().tickCrafting(0.9);
    expect(first.completed).toHaveLength(1);
    expect(itemCount(useGameStore.getState().inventory, 'rope')).toBe(1);
    expect(useGameStore.getState().crafting.entries).toHaveLength(1);
  });

  it('restores an upgraded tool and its wear when a committed craft is cancelled', () => {
    const inventory = { hook: 1, spear: 1, metalIngot: 2, rope: 1 } as const;
    useGameStore.setState((state) => ({
      inventory,
      inventorySlots: usedInventorySlots(inventory),
      selectedTool: 'spear',
      toolDurability: { hook: 20, spear: 5 },
      crafting: createDefaultCraftingQueue(),
      progression: { ...state.progression, learned: ['metalSpear'] },
    }));
    const queued = useGameStore.getState().queueCraft('metalSpear', 1);
    expect(queued.ok).toBe(true);
    expect(useGameStore.getState()).toMatchObject({ selectedTool: 'hook' });
    expect(itemCount(useGameStore.getState().inventory, 'spear')).toBe(0);

    const cancelled = useGameStore.getState().cancelCraft(queued.crafting.entries[0].id);
    expect(cancelled.ok).toBe(true);
    const state = useGameStore.getState();
    expect(state.selectedTool).toBe('spear');
    expect(itemCount(state.inventory, 'spear')).toBe(1);
    expect(state.toolDurability.spear).toBe(5);
  });

  it('selects a completed upgrade with fresh durability', () => {
    const inventory = { hook: 1, spear: 1, metalIngot: 2, rope: 1 } as const;
    useGameStore.setState((state) => ({
      inventory,
      inventorySlots: usedInventorySlots(inventory),
      selectedTool: 'spear',
      toolDurability: { hook: 20, spear: 5 },
      crafting: createDefaultCraftingQueue(),
      progression: { ...state.progression, learned: ['metalSpear'] },
    }));
    expect(useGameStore.getState().queueCraft('metalSpear', 1).ok).toBe(true);
    expect(useGameStore.getState().tickCrafting(2.8).completed).toHaveLength(1);
    const state = useGameStore.getState();
    expect(state.selectedTool).toBe('metalSpear');
    expect(itemCount(state.inventory, 'metalSpear')).toBe(1);
    expect(state.toolDurability.metalSpear).toBe(TOOL_MAX_DURABILITY.metalSpear);
  });
});
