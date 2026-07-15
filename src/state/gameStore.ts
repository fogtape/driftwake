import { create } from 'zustand';
import {
  DEFAULT_AUDIO_MIX,
  setAudioMixChannel as updateAudioMixChannel,
  type AudioMixChannel,
  type AudioMixSnapshot,
} from '../game/audio/audioMix';
import type { WeatherKind } from '../game/environment/environment';
import type { PlayerLocomotionMode } from '../game/player/locomotion';

export type GamePhase = 'title' | 'playing';
export type QualityPreset = 'low' | 'high';

export interface InventorySnapshot {
  timber: number;
  polymer: number;
  fiber: number;
  cache: number;
}

export interface EnvironmentHudSnapshot {
  weather: WeatherKind;
  dayProgress: number;
  daylight: number;
  windDirectionX: number;
  windDirectionZ: number;
  windStrength: number;
  risk: number;
}

export interface RenderStatsSnapshot {
  renderScale: number;
  pixelRatio: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
}

interface SurvivalSnapshot {
  health: number;
  thirst: number;
  hunger: number;
}

interface GameState {
  phase: GamePhase;
  ready: boolean;
  loadingLabel: string;
  pointerLocked: boolean;
  settingsOpen: boolean;
  audioEnabled: boolean;
  audioMix: AudioMixSnapshot;
  muteOnFocusLoss: boolean;
  headBobEnabled: boolean;
  quality: QualityPreset;
  dynamicResolutionEnabled: boolean;
  hookCharge: number;
  playerMode: PlayerLocomotionMode;
  environmentHud: EnvironmentHudSnapshot;
  renderStats: RenderStatsSnapshot;
  inventory: InventorySnapshot;
  survival: SurvivalSnapshot;
  fps: number;
  notice: string | null;
  setPhase: (phase: GamePhase) => void;
  setReady: (ready: boolean) => void;
  setLoadingLabel: (loadingLabel: string) => void;
  setPointerLocked: (pointerLocked: boolean) => void;
  setSettingsOpen: (settingsOpen: boolean) => void;
  setAudioEnabled: (audioEnabled: boolean) => void;
  setAudioMixChannel: (channel: AudioMixChannel, value: number) => void;
  setMuteOnFocusLoss: (muteOnFocusLoss: boolean) => void;
  setHeadBobEnabled: (headBobEnabled: boolean) => void;
  setQuality: (quality: QualityPreset) => void;
  setDynamicResolutionEnabled: (dynamicResolutionEnabled: boolean) => void;
  setHookCharge: (hookCharge: number) => void;
  setPlayerMode: (playerMode: PlayerLocomotionMode) => void;
  setEnvironmentHud: (environmentHud: EnvironmentHudSnapshot) => void;
  setRenderStats: (renderStats: RenderStatsSnapshot) => void;
  addInventory: (kind: keyof InventorySnapshot, amount: number) => void;
  setFps: (fps: number) => void;
  showNotice: (notice: string | null) => void;
}

export const useGameStore = create<GameState>((set) => ({
  phase: 'title',
  ready: false,
  loadingLabel: '正在唤醒海面',
  pointerLocked: false,
  settingsOpen: false,
  audioEnabled: true,
  audioMix: { ...DEFAULT_AUDIO_MIX },
  muteOnFocusLoss: true,
  headBobEnabled: true,
  quality: 'high',
  dynamicResolutionEnabled: true,
  hookCharge: 0,
  playerMode: 'raft',
  environmentHud: {
    weather: 'calm',
    dayProgress: 0,
    daylight: 1,
    windDirectionX: 1,
    windDirectionZ: 0,
    windStrength: 0.2,
    risk: 0.08,
  },
  renderStats: {
    renderScale: 1,
    pixelRatio: 1,
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
  },
  inventory: { timber: 0, polymer: 0, fiber: 0, cache: 0 },
  survival: { health: 100, thirst: 82, hunger: 74 },
  fps: 0,
  notice: null,
  setPhase: (phase) => set({ phase }),
  setReady: (ready) => set({ ready }),
  setLoadingLabel: (loadingLabel) => set({ loadingLabel }),
  setPointerLocked: (pointerLocked) => set({ pointerLocked }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setAudioEnabled: (audioEnabled) => set({ audioEnabled }),
  setAudioMixChannel: (channel, value) => set((state) => ({
    audioMix: updateAudioMixChannel(state.audioMix, channel, value),
  })),
  setMuteOnFocusLoss: (muteOnFocusLoss) => set({ muteOnFocusLoss }),
  setHeadBobEnabled: (headBobEnabled) => set({ headBobEnabled }),
  setQuality: (quality) => set({ quality }),
  setDynamicResolutionEnabled: (dynamicResolutionEnabled) => set({ dynamicResolutionEnabled }),
  setHookCharge: (hookCharge) => set({ hookCharge }),
  setPlayerMode: (playerMode) => set({ playerMode }),
  setEnvironmentHud: (environmentHud) => set({ environmentHud }),
  setRenderStats: (renderStats) => set({ renderStats }),
  addInventory: (kind, amount) =>
    set((state) => ({
      inventory: { ...state.inventory, [kind]: state.inventory[kind] + amount },
    })),
  setFps: (fps) => set({ fps }),
  showNotice: (notice) => set({ notice }),
}));
