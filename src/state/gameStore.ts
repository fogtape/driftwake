import { create } from 'zustand';
import {
  INVENTORY_SLOT_CAPACITY,
  ITEM_DEFINITIONS,
  STARTING_INVENTORY,
  addItems,
  itemCount,
  preferredToolOrder,
  removeItems,
  salvageLoot,
  usedInventorySlots,
  type Inventory,
  type InventoryMutation,
  type ItemBundle,
  type ItemId,
  type SalvageKind,
  type ToolId,
} from '../game/domain/items';
import { RECIPES, craftRecipe, type CraftResult, type RecipeId } from '../game/domain/recipes';
import { INITIAL_SURVIVAL, advanceSurvival, consumeItem, type SurvivalState } from '../game/domain/survival';
import type { DeviceType } from '../game/domain/devices';
import type { IslandPhase } from '../game/domain/island';
import type { NavigationDeviceType, NavigationRouteMode, NavigationWeatherPhase, SignalArrayStatus } from '../game/domain/navigation';
import type { PlayerSurface } from '../game/domain/save';
import type { CameraMotionMode } from '../game/domain/settings';
import {
  applyToolWear,
  freshToolDurability,
  normalizeToolDurability,
  type ToolDurability,
} from '../game/domain/toolDurability';
import {
  addResearchSample,
  canLearnProject,
  createDefaultProgressionState,
  learnProject,
  RESEARCH_PROJECTS,
  type ProgressionDeviceType,
  type ProgressionKnowledge,
  type ResearchProjectId,
  type ResearchSampleId,
} from '../game/domain/progression';

export type GamePhase = 'title' | 'playing';
export type QualityPreset = 'low' | 'high';
export type OverlayPanel = 'pack' | 'crafting' | 'research' | 'storage' | null;
export type FishingPhase = 'idle' | 'casting' | 'waiting' | 'nibble' | 'hooked' | 'caught' | 'lost';
export type SharkMode = 'distant' | 'circling' | 'approaching' | 'attacking' | 'retreating';
export type PlacementType = DeviceType | NavigationDeviceType | ProgressionDeviceType | 'planter';
export type InteractionOwner = 'build' | 'device' | 'fishing' | 'island' | 'navigation' | 'planting' | 'progression' | 'salvage' | 'shark' | 'underwater' | 'global';

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

export interface StorageFeedback {
  deviceId: string;
  name: string;
  inventory: Inventory;
  slots: number;
  capacity: number;
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
  helmInstalled: boolean;
  sailReinforced: boolean;
  anchorReinforced: boolean;
  sailStrain: number;
  anchorStrain: number;
  routeMode: NavigationRouteMode;
  weatherPhase: NavigationWeatherPhase;
  stormIntensity: number;
  gust: number;
  driftRisk: boolean;
  receiverInstalled: boolean;
  antennaInstalled: boolean;
  signalArrayStatus: SignalArrayStatus;
  receiverOn: boolean;
  receiverCharge: number;
  activeSignalName: string | null;
  activeSignalFrequency: string | null;
  signalDistance: number | null;
  signalBearing: number | null;
  discoveredSignals: number;
  visitedSignals: number;
  worldX: number;
  worldZ: number;
}

export interface PlantingFeedback {
  placed: number;
  growing: number;
  dry: number;
  mature: number;
  withered: number;
  progress: number;
  water: number;
  birdActive: boolean;
  birdThreat: number;
}

export interface ProgressionFeedback extends ProgressionKnowledge {
  researchBenches: number;
  dryingRacks: number;
  wetBricks: number;
  dryBricks: number;
  smelters: number;
  working: number;
  ready: number;
  progress: number;
  learnable: number;
}

export type ResearchSampleResult = 'researched' | 'already-researched' | 'missing-sample';

export interface PlayerSaveSnapshot {
  inventory: Inventory;
  toolDurability: ToolDurability;
  survival: SurvivalState;
  selectedTool: ToolId;
  playSeconds: number;
}

interface GameState {
  phase: GamePhase;
  ready: boolean;
  loadingLabel: string;
  pointerLocked: boolean;
  pointerLockDenied: boolean;
  settingsOpen: boolean;
  overlayPanel: OverlayPanel;
  audioEnabled: boolean;
  audioMix: AudioMix;
  muteOnFocusLoss: boolean;
  cameraMotionMode: CameraMotionMode;
  quality: QualityPreset;
  dynamicResolutionEnabled: boolean;
  selectedTool: ToolId;
  hookCharge: number;
  inventory: Inventory;
  toolDurability: ToolDurability;
  inventorySlots: number;
  survival: SurvivalState;
  player: PlayerFeedback;
  fishing: FishingFeedback;
  shark: SharkFeedback;
  raft: RaftFeedback;
  devices: DeviceFeedbackMap;
  storage: StorageFeedback | null;
  navigation: NavigationFeedback;
  planting: PlantingFeedback;
  progression: ProgressionFeedback;
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
  setPointerLockDenied: (pointerLockDenied: boolean) => void;
  setSettingsOpen: (settingsOpen: boolean) => void;
  setOverlayPanel: (overlayPanel: OverlayPanel) => void;
  setAudioEnabled: (audioEnabled: boolean) => void;
  setAudioMix: (audioMix: Partial<AudioMix>) => void;
  setMuteOnFocusLoss: (muteOnFocusLoss: boolean) => void;
  setCameraMotionMode: (cameraMotionMode: CameraMotionMode) => void;
  setQuality: (quality: QualityPreset) => void;
  setDynamicResolutionEnabled: (dynamicResolutionEnabled: boolean) => void;
  setSelectedTool: (selectedTool: ToolId) => boolean;
  setHookCharge: (hookCharge: number) => void;
  addLoot: (kind: SalvageKind, roll?: number) => ItemBundle;
  addItemBundle: (bundle: ItemBundle) => ItemBundle;
  receiveItemBundle: (bundle: ItemBundle) => InventoryMutation;
  spendItems: (bundle: ItemBundle) => boolean;
  damageTool: (tool: ToolId, amount?: number) => { remaining: number; broken: boolean };
  craft: (recipeId: RecipeId) => CraftResult;
  useItem: (itemId: ItemId) => boolean;
  tickSurvival: (seconds: number, submerged?: boolean) => void;
  damagePlayer: (amount: number) => void;
  setPlayer: (feedback: PlayerFeedback) => void;
  setFishing: (feedback: Partial<FishingFeedback>) => void;
  setShark: (feedback: Partial<SharkFeedback>) => void;
  setRaft: (feedback: RaftFeedback) => void;
  setDevices: (feedback: DeviceFeedbackMap) => void;
  setStorage: (feedback: StorageFeedback | null) => void;
  setNavigation: (feedback: NavigationFeedback) => void;
  setPlanting: (feedback: PlantingFeedback) => void;
  setProgressionFeedback: (feedback: Omit<ProgressionFeedback, keyof ProgressionKnowledge>) => void;
  hydrateProgression: (knowledge: ProgressionKnowledge) => void;
  researchSample: (sample: ResearchSampleId) => ResearchSampleResult;
  learnResearchProject: (projectId: ResearchProjectId) => boolean;
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
    helmInstalled: false,
    sailReinforced: false,
    anchorReinforced: false,
    sailStrain: 0,
    anchorStrain: 0,
    routeMode: 'manual',
    weatherPhase: 'calm',
    stormIntensity: 0,
    gust: 0,
    driftRisk: false,
    receiverInstalled: false,
    antennaInstalled: false,
    signalArrayStatus: 'missing-receiver',
    receiverOn: false,
    receiverCharge: 0,
    activeSignalName: null,
    activeSignalFrequency: null,
    signalDistance: null,
    signalBearing: null,
    discoveredSignals: 0,
    visitedSignals: 0,
    worldX: 0,
    worldZ: 0,
  };
}

function defaultPlanting(): PlantingFeedback {
  return {
    placed: 0,
    growing: 0,
    dry: 0,
    mature: 0,
    withered: 0,
    progress: 0,
    water: 0,
    birdActive: false,
    birdThreat: 0,
  };
}

function defaultProgression(): ProgressionFeedback {
  const knowledge = createDefaultProgressionState();
  return {
    researched: knowledge.researched,
    learned: knowledge.learned,
    researchBenches: 0,
    dryingRacks: 0,
    wetBricks: 0,
    dryBricks: 0,
    smelters: 0,
    working: 0,
    ready: 0,
    progress: 0,
    learnable: 0,
  };
}

function countLearnableProjects(knowledge: ProgressionKnowledge): number {
  return (Object.keys(RESEARCH_PROJECTS) as ResearchProjectId[])
    .filter((projectId) => canLearnProject(knowledge, projectId)).length;
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
  pointerLockDenied: false,
  settingsOpen: false,
  overlayPanel: null,
  audioEnabled: true,
  audioMix: { master: 0.78, music: 0.2, ambience: 0.43, effects: 0.72, creatures: 0.78, ui: 0.56 },
  muteOnFocusLoss: true,
  cameraMotionMode: 'balanced',
  quality: 'high',
  dynamicResolutionEnabled: true,
  selectedTool: 'hook',
  hookCharge: 0,
  inventory: { ...STARTING_INVENTORY },
  toolDurability: normalizeToolDurability(STARTING_INVENTORY, null),
  inventorySlots: usedInventorySlots(STARTING_INVENTORY),
  survival: { ...INITIAL_SURVIVAL },
  player: defaultPlayer(),
  fishing: defaultFishing(),
  shark: defaultShark(),
  raft: { tiles: 9, damagedTiles: 0, averageIntegrity: 100 },
  devices: {
    purifier: { placed: 0, working: 0, ready: 0, burnt: 0, progress: 0 },
    grill: { placed: 0, working: 0, ready: 0, burnt: 0, progress: 0 },
    solarPurifier: { placed: 0, working: 0, ready: 0, burnt: 0, progress: 0 },
    tripleGrill: { placed: 0, working: 0, ready: 0, burnt: 0, progress: 0 },
    locker: { placed: 0, working: 0, ready: 0, burnt: 0, progress: 0 },
  },
  storage: null,
  navigation: defaultNavigation(),
  planting: defaultPlanting(),
  progression: defaultProgression(),
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
  setPointerLockDenied: (pointerLockDenied) => set({ pointerLockDenied }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setOverlayPanel: (overlayPanel) => set({ overlayPanel }),
  setAudioEnabled: (audioEnabled) => set({ audioEnabled }),
  setAudioMix: (audioMix) => set((state) => ({ audioMix: clampAudioMix(state.audioMix, audioMix) })),
  setMuteOnFocusLoss: (muteOnFocusLoss) => set({ muteOnFocusLoss }),
  setCameraMotionMode: (cameraMotionMode) => set({ cameraMotionMode }),
  setQuality: (quality) => set({ quality }),
  setDynamicResolutionEnabled: (dynamicResolutionEnabled) => set({ dynamicResolutionEnabled }),
  setSelectedTool: (selectedTool) => {
    if (itemCount(get().inventory, selectedTool) <= 0) return false;
    set({ selectedTool, interaction: null, interactionOwner: null });
    return true;
  },
  setHookCharge: (hookCharge) =>
    set((state) => (Math.abs(state.hookCharge - hookCharge) < 0.002 ? state : { hookCharge })),
  addLoot: (kind, roll = Math.random()) => {
    const state = get();
    const result = addItems(state.inventory, salvageLoot(kind, roll), INVENTORY_SLOT_CAPACITY);
    set({
      inventory: result.inventory,
      inventorySlots: usedInventorySlots(result.inventory),
      toolDurability: normalizeToolDurability(result.inventory, state.toolDurability),
    });
    return result.accepted;
  },
  addItemBundle: (bundle) => {
    const state = get();
    const result = addItems(state.inventory, bundle, INVENTORY_SLOT_CAPACITY);
    set({
      inventory: result.inventory,
      inventorySlots: usedInventorySlots(result.inventory),
      toolDurability: normalizeToolDurability(result.inventory, state.toolDurability),
    });
    return result.accepted;
  },
  receiveItemBundle: (bundle) => {
    const state = get();
    const result = addItems(state.inventory, bundle, INVENTORY_SLOT_CAPACITY);
    set({
      inventory: result.inventory,
      inventorySlots: usedInventorySlots(result.inventory),
      toolDurability: normalizeToolDurability(result.inventory, state.toolDurability),
    });
    return result;
  },
  spendItems: (bundle) => {
    const state = get();
    const result = removeItems(state.inventory, bundle);
    if (!result) return false;
    const selectedTool = itemCount(result, state.selectedTool) > 0
      ? state.selectedTool
      : preferredToolOrder(result).find((tool) => itemCount(result, tool) > 0) ?? 'hook';
    set({
      inventory: result,
      inventorySlots: usedInventorySlots(result),
      selectedTool,
      toolDurability: normalizeToolDurability(result, state.toolDurability),
    });
    return true;
  },
  damageTool: (tool, amount = 1) => {
    const state = get();
    if (itemCount(state.inventory, tool) <= 0) return { remaining: 0, broken: false };
    const worn = applyToolWear(state.toolDurability, tool, amount);
    if (!worn.broken) {
      set({ toolDurability: worn.durability });
      return { remaining: worn.remaining, broken: false };
    }
    const inventory = removeItems(state.inventory, { [tool]: 1 }) ?? state.inventory;
    const selectedTool = state.selectedTool === tool
      ? preferredToolOrder(inventory).find((candidate) => itemCount(inventory, candidate) > 0) ?? 'hook'
      : state.selectedTool;
    set({
      inventory,
      inventorySlots: usedInventorySlots(inventory),
      selectedTool,
      toolDurability: normalizeToolDurability(inventory, worn.durability),
    });
    return { remaining: 0, broken: true };
  },
  craft: (recipeId) => {
    const state = get();
    const result = craftRecipe(state.inventory, recipeId, state.progression.learned);
    if (result.ok) {
      const selectedTool =
        recipeId === 'metalSpear' && state.selectedTool === 'spear'
          ? 'metalSpear'
          : recipeId === 'metalAxe' && state.selectedTool === 'axe'
            ? 'metalAxe'
            : state.selectedTool;
      const outputId = Object.keys(RECIPES[recipeId].output)[0] as ItemId;
      const normalizedDurability = normalizeToolDurability(result.inventory, state.toolDurability);
      const toolDurability = ITEM_DEFINITIONS[outputId].category === 'tool'
        ? freshToolDurability(normalizedDurability, outputId as ToolId)
        : normalizedDurability;
      set({ inventory: result.inventory, inventorySlots: usedInventorySlots(result.inventory), selectedTool, toolDurability });
    }
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
  setStorage: (storage) => set({ storage }),
  setNavigation: (navigation) => set({ navigation }),
  setPlanting: (planting) => set({ planting }),
  setProgressionFeedback: (feedback) =>
    set((state) => ({ progression: { ...state.progression, ...feedback } })),
  hydrateProgression: (knowledge) =>
    set((state) => ({
      progression: {
        ...state.progression,
        researched: [...knowledge.researched],
        learned: [...knowledge.learned],
        learnable: countLearnableProjects(knowledge),
      },
    })),
  researchSample: (sample) => {
    const state = get();
    if (state.progression.researched.includes(sample)) return 'already-researched';
    const inventory = removeItems(state.inventory, { [sample]: 1 });
    if (!inventory) return 'missing-sample';
    const knowledge = addResearchSample(state.progression, sample);
    const progression = { ...state.progression, researched: knowledge.researched };
    set({
      inventory,
      inventorySlots: usedInventorySlots(inventory),
      progression: { ...progression, learnable: countLearnableProjects(progression) },
    });
    return 'researched';
  },
  learnResearchProject: (projectId) => {
    const state = get();
    const knowledge = learnProject(state.progression, projectId);
    if (knowledge === state.progression) return false;
    const progression = { ...state.progression, learned: knowledge.learned };
    set({ progression: { ...progression, learnable: countLearnableProjects(progression) } });
    return true;
  },
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
      toolDurability: snapshot.toolDurability,
      inventorySlots: usedInventorySlots(snapshot.inventory),
      survival: snapshot.survival,
      selectedTool: snapshot.selectedTool,
      playSeconds: snapshot.playSeconds,
      fishing: defaultFishing(),
      shark: defaultShark(),
      player: defaultPlayer(),
      navigation: defaultNavigation(),
      planting: defaultPlanting(),
      progression: defaultProgression(),
      storage: null,
      placementDevice: null,
      interaction: null,
      interactionOwner: null,
    }),
  getPlayerSnapshot: () => {
    const state = get();
    return {
      inventory: state.inventory,
      toolDurability: state.toolDurability,
      survival: state.survival,
      selectedTool: state.selectedTool,
      playSeconds: state.playSeconds,
    };
  },
}));

export type InventorySnapshot = Inventory;
