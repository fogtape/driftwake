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
import type { DeviceType } from '../game/domain/devices';
import type { IslandPhase } from '../game/domain/island';
import type { NavigationDeviceType } from '../game/domain/navigation';
import type { PlayerSurface } from '../game/domain/save';

export type GamePhase = 'title' | 'playing';
export type QualityPreset = 'low' | 'high';
export type OverlayPanel = 'pack' | 'crafting' | null;
export type FishingPhase = 'idle' | 'casting' | 'waiting' | 'nibble' | 'hooked' | 'caught' | 'lost';
export type SharkMode = 'distant' | 'circling' | 'approaching' | 'attacking' | 'retreating';
export type PlacementType = DeviceType | NavigationDeviceType;
export type InteractionOwner = 'build' | 'device' | 'fishing' | 'island' | 'navigation' | 'shark' | 'underwater' | 'global';

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
  target: 'raft' | 'player';
}

export interface PlayerFeedback {
  surface: PlayerSurface;
  depth: number;
  submerged: boolean;
}

export interface RaftFeedback {
  tiles: number;
  damagedTiles: number;
  averageIntegrity: number;
}

export interface DeviceFeedback {
  placed: number;
  working: number;
  ready: number;
  burnt: number;
  progress: number;
}

export type DeviceFeedbackMap = Record<DeviceType, DeviceFeedback>;

export interface IslandFeedback {
  phase: IslandPhase;
  distance: number;
  remaining: number;
  ashore: boolean;
  harvested: number;
  total: number;
}

export interface ReefFeedback {
  harvested: number;
  total: number;
}

export interface NavigationFeedback {
  windAngle: number;
  courseAngle: number;
  heading: number;
  windCapture: number;
  courseAlignment: number;
  speedKnots: number;
  sailInstalled: boolean;
  sailDeployed: boolean;
  anchorInstalled: boolean;
  anchored: boolean;
  driftRisk: boolean;
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
  player: PlayerFeedback;
  fishing: FishingFeedback;
  shark: SharkFeedback;
  raft: RaftFeedback;
  devices: DeviceFeedbackMap;
  navigation: NavigationFeedback;
  placementDevice: PlacementType | null;
  island: IslandFeedback;
  reef: ReefFeedback;
  interaction: string | null;
  interactionOwner: InteractionOwner | null;
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
  tickSurvival: (seconds: number, submerged?: boolean) => void;
  damagePlayer: (amount: number) => void;
  setPlayer: (feedback: PlayerFeedback) => void;
  setFishing: (feedback: Partial<FishingFeedback>) => void;
  setShark: (feedback: Partial<SharkFeedback>) => void;
  setRaft: (feedback: RaftFeedback) => void;
  setDevices: (feedback: DeviceFeedbackMap) => void;
  setNavigation: (feedback: NavigationFeedback) => void;
  setPlacementDevice: (device: PlacementType | null) => void;
  setIsland: (feedback: IslandFeedback) => void;
  setReef: (feedback: ReefFeedback) => void;
  setInteraction: (interaction: string | null, owner?: InteractionOwner) => void;
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
  return { mode: 'distant', threat: 0, health: 100, visible: false, target: 'raft' };
}

function defaultPlayer(): PlayerFeedback {
  return { surface: 'raft', depth: 0, submerged: false };
}

function defaultNavigation(): NavigationFeedback {
  return {
    windAngle: 0.92,
    courseAngle: 0,
    heading: 0,
    windCapture: 0,
    courseAlignment: 1,
    speedKnots: 0.42,
    sailInstalled: false,
    sailDeployed: false,
    anchorInstalled: false,
    anchored: false,
    driftRisk: false,
  };
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
  player: defaultPlayer(),
  fishing: defaultFishing(),
  shark: defaultShark(),
  raft: { tiles: 9, damagedTiles: 0, averageIntegrity: 100 },
  devices: {
    purifier: { placed: 0, working: 0, ready: 0, burnt: 0, progress: 0 },
    grill: { placed: 0, working: 0, ready: 0, burnt: 0, progress: 0 },
  },
  navigation: defaultNavigation(),
  placementDevice: null,
  island: { phase: 'approaching', distance: 80, remaining: 72, ashore: false, harvested: 0, total: 18 },
  reef: { harvested: 0, total: 18 },
  interaction: null,
  interactionOwner: null,
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
    set({ selectedTool, interaction: null, interactionOwner: null });
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
    const paidInventory = removeItems(get().inventory, { [itemId]: 1 });
    if (!paidInventory) return false;
    const inventory =
      itemId === 'freshWaterCup' ? addItems(paidInventory, { emptyCup: 1 }, INVENTORY_SLOT_CAPACITY).inventory : paidInventory;
    set({ survival: consumed.survival, inventory, inventorySlots: usedInventorySlots(inventory) });
    return true;
  },
  tickSurvival: (seconds, submerged = false) =>
    set((state) => ({ survival: advanceSurvival(state.survival, seconds, submerged) })),
  damagePlayer: (amount) =>
    set((state) => ({
      survival: {
        ...state.survival,
        health: Math.max(0, state.survival.health - Math.max(0, Number.isFinite(amount) ? amount : 0)),
      },
    })),
  setPlayer: (player) =>
    set((state) =>
      state.player.surface === player.surface &&
      state.player.submerged === player.submerged &&
      Math.abs(state.player.depth - player.depth) < 0.025
        ? state
        : { player },
    ),
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
        shark.visible === state.shark.visible &&
        shark.target === state.shark.target
        ? state
        : { shark };
    }),
  setRaft: (raft) => set({ raft }),
  setDevices: (devices) => set({ devices }),
  setNavigation: (navigation) => set({ navigation }),
  setPlacementDevice: (placementDevice) => set({ placementDevice, interaction: null, interactionOwner: null }),
  setIsland: (island) => set({ island }),
  setReef: (reef) => set({ reef }),
  setInteraction: (interaction, owner) =>
    set((state) => {
      if (interaction === null) {
        if (owner && state.interactionOwner !== owner) return state;
        if (state.interaction === null && state.interactionOwner === null) return state;
        return { interaction: null, interactionOwner: null };
      }
      const interactionOwner = owner ?? 'global';
      if (state.interaction === interaction && state.interactionOwner === interactionOwner) return state;
      return { interaction, interactionOwner };
    }),
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
      player: defaultPlayer(),
      navigation: defaultNavigation(),
      placementDevice: null,
      interaction: null,
      interactionOwner: null,
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
