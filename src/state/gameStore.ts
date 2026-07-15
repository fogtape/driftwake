import { create } from 'zustand';
import {
  INVENTORY_SLOT_CAPACITY,
  STARTING_INVENTORY,
  addItems,
  itemCount,
  removeItems,
  salvageLoot,
  usedInventorySlots,
  type Inventory,
  type ItemBundle,
  type ItemId,
  type SalvageKind,
  type ToolId,
} from '../game/domain/items';
import { craftRecipe, type CraftResult, type RecipeId } from '../game/domain/recipes';
import { INITIAL_SURVIVAL, advanceSurvival, consumeItem, type SurvivalState } from '../game/domain/survival';

export type GamePhase = 'title' | 'playing';
export type QualityPreset = 'low' | 'high';
export type OverlayPanel = 'pack' | 'crafting' | null;
export type FishingPhase = 'idle' | 'casting' | 'waiting' | 'nibble' | 'hooked' | 'caught' | 'lost';
export type SharkMode = 'distant' | 'circling' | 'approaching' | 'attacking' | 'retreating';

export interface AudioMix {
  master: number;
  music: number;
  ambience: number;
  effects: number;
  creatures: number;
  ui: number;
}

export interface FishingFeedback {
  phase: FishingPhase;
  tension: number;
  progress: number;
}

export interface SharkFeedback {
  mode: SharkMode;
  threat: number;
  health: number;
  visible: boolean;
}

export interface RaftFeedback {
  tiles: number;
  damagedTiles: number;
  averageIntegrity: number;
}

export interface PlayerSaveSnapshot {
  inventory: Inventory;
  survival: SurvivalState;
  selectedTool: ToolId;
  playSeconds: number;
}

interface GameState {
  phase: GamePhase;
  ready: boolean;
  loadingLabel: string;
  pointerLocked: boolean;
  settingsOpen: boolean;
  overlayPanel: OverlayPanel;
  audioEnabled: boolean;
  audioMix: AudioMix;
  quality: QualityPreset;
  selectedTool: ToolId;
  hookCharge: number;
  inventory: Inventory;
  inventorySlots: number;
  survival: SurvivalState;
  fishing: FishingFeedback;
  shark: SharkFeedback;
  raft: RaftFeedback;
  interaction: string | null;
  fps: number;
  notice: string | null;
  playSeconds: number;
  saveStatus: 'idle' | 'saved' | 'error';
  setPhase: (phase: GamePhase) => void;
  setReady: (ready: boolean) => void;
  setLoadingLabel: (loadingLabel: string) => void;
  setPointerLocked: (pointerLocked: boolean) => void;
  setSettingsOpen: (settingsOpen: boolean) => void;
  setOverlayPanel: (overlayPanel: OverlayPanel) => void;
  setAudioEnabled: (audioEnabled: boolean) => void;
  setAudioMix: (audioMix: Partial<AudioMix>) => void;
  setQuality: (quality: QualityPreset) => void;
  setSelectedTool: (selectedTool: ToolId) => boolean;
  setHookCharge: (hookCharge: number) => void;
  addLoot: (kind: SalvageKind, roll?: number) => ItemBundle;
  addItemBundle: (bundle: ItemBundle) => ItemBundle;
  spendItems: (bundle: ItemBundle) => boolean;
  craft: (recipeId: RecipeId) => CraftResult;
  useItem: (itemId: ItemId) => boolean;
  tickSurvival: (seconds: number) => void;
  setFishing: (feedback: Partial<FishingFeedback>) => void;
  setShark: (feedback: Partial<SharkFeedback>) => void;
  setRaft: (feedback: RaftFeedback) => void;
  setInteraction: (interaction: string | null) => void;
  setFps: (fps: number) => void;
  showNotice: (notice: string | null) => void;
  advancePlayTime: (seconds: number) => void;
  setSaveStatus: (saveStatus: 'idle' | 'saved' | 'error') => void;
  hydratePlayer: (snapshot: PlayerSaveSnapshot) => void;
  getPlayerSnapshot: () => PlayerSaveSnapshot;
}

function defaultFishing(): FishingFeedback {
  return { phase: 'idle', tension: 0, progress: 0 };
}

function defaultShark(): SharkFeedback {
  return { mode: 'distant', threat: 0, health: 100, visible: false };
}

function clampAudioMix(current: AudioMix, patch: Partial<AudioMix>): AudioMix {
  const merged = { ...current, ...patch };
  const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return {
    master: clamp(merged.master),
    music: clamp(merged.music),
    ambience: clamp(merged.ambience),
    effects: clamp(merged.effects),
    creatures: clamp(merged.creatures),
    ui: clamp(merged.ui),
  };
}

export const useGameStore = create<GameState>((set, get) => ({
  phase: 'title',
  ready: false,
  loadingLabel: '正在唤醒海面',
  pointerLocked: false,
  settingsOpen: false,
  overlayPanel: null,
  audioEnabled: true,
  audioMix: { master: 0.78, music: 0.2, ambience: 0.43, effects: 0.72, creatures: 0.78, ui: 0.56 },
  quality: 'high',
  selectedTool: 'hook',
  hookCharge: 0,
  inventory: { ...STARTING_INVENTORY },
  inventorySlots: usedInventorySlots(STARTING_INVENTORY),
  survival: { ...INITIAL_SURVIVAL },
  fishing: defaultFishing(),
  shark: defaultShark(),
  raft: { tiles: 9, damagedTiles: 0, averageIntegrity: 100 },
  interaction: null,
  fps: 0,
  notice: null,
  playSeconds: 0,
  saveStatus: 'idle',
  setPhase: (phase) => set({ phase }),
  setReady: (ready) => set({ ready }),
  setLoadingLabel: (loadingLabel) => set({ loadingLabel }),
  setPointerLocked: (pointerLocked) => set({ pointerLocked }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setOverlayPanel: (overlayPanel) => set({ overlayPanel }),
  setAudioEnabled: (audioEnabled) => set({ audioEnabled }),
  setAudioMix: (audioMix) => set((state) => ({ audioMix: clampAudioMix(state.audioMix, audioMix) })),
  setQuality: (quality) => set({ quality }),
  setSelectedTool: (selectedTool) => {
    if (itemCount(get().inventory, selectedTool) <= 0) return false;
    set({ selectedTool, interaction: null });
    return true;
  },
  setHookCharge: (hookCharge) =>
    set((state) => (Math.abs(state.hookCharge - hookCharge) < 0.002 ? state : { hookCharge })),
  addLoot: (kind, roll = Math.random()) => {
    const result = addItems(get().inventory, salvageLoot(kind, roll), INVENTORY_SLOT_CAPACITY);
    set({ inventory: result.inventory, inventorySlots: usedInventorySlots(result.inventory) });
    return result.accepted;
  },
  addItemBundle: (bundle) => {
    const result = addItems(get().inventory, bundle, INVENTORY_SLOT_CAPACITY);
    set({ inventory: result.inventory, inventorySlots: usedInventorySlots(result.inventory) });
    return result.accepted;
  },
  spendItems: (bundle) => {
    const result = removeItems(get().inventory, bundle);
    if (!result) return false;
    set({ inventory: result, inventorySlots: usedInventorySlots(result) });
    return true;
  },
  craft: (recipeId) => {
    const result = craftRecipe(get().inventory, recipeId);
    if (result.ok) set({ inventory: result.inventory, inventorySlots: usedInventorySlots(result.inventory) });
    return result;
  },
  useItem: (itemId) => {
    if (itemCount(get().inventory, itemId) <= 0) return false;
    const consumed = consumeItem(get().survival, itemId);
    if (!consumed.usable) return false;
    const inventory = removeItems(get().inventory, { [itemId]: 1 });
    if (!inventory) return false;
    set({ survival: consumed.survival, inventory, inventorySlots: usedInventorySlots(inventory) });
    return true;
  },
  tickSurvival: (seconds) => set((state) => ({ survival: advanceSurvival(state.survival, seconds) })),
  setFishing: (feedback) =>
    set((state) => {
      const fishing = { ...state.fishing, ...feedback };
      return fishing.phase === state.fishing.phase &&
        fishing.tension === state.fishing.tension &&
        fishing.progress === state.fishing.progress
        ? state
        : { fishing };
    }),
  setShark: (feedback) =>
    set((state) => {
      const shark = { ...state.shark, ...feedback };
      return shark.mode === state.shark.mode &&
        shark.threat === state.shark.threat &&
        shark.health === state.shark.health &&
        shark.visible === state.shark.visible
        ? state
        : { shark };
    }),
  setRaft: (raft) => set({ raft }),
  setInteraction: (interaction) => set((state) => (state.interaction === interaction ? state : { interaction })),
  setFps: (fps) => set({ fps }),
  showNotice: (notice) => set({ notice }),
  advancePlayTime: (seconds) => set((state) => ({ playSeconds: state.playSeconds + Math.max(0, seconds) })),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  hydratePlayer: (snapshot) =>
    set({
      inventory: snapshot.inventory,
      inventorySlots: usedInventorySlots(snapshot.inventory),
      survival: snapshot.survival,
      selectedTool: snapshot.selectedTool,
      playSeconds: snapshot.playSeconds,
      fishing: defaultFishing(),
      shark: defaultShark(),
    }),
  getPlayerSnapshot: () => {
    const state = get();
    return {
      inventory: state.inventory,
      survival: state.survival,
      selectedTool: state.selectedTool,
      playSeconds: state.playSeconds,
    };
  },
}));

export type InventorySnapshot = Inventory;
