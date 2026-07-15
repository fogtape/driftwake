import { create } from 'zustand';

export type GamePhase = 'title' | 'playing';
export type QualityPreset = 'low' | 'high';

export interface InventorySnapshot {
  timber: number;
  polymer: number;
  fiber: number;
  cache: number;
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
  quality: QualityPreset;
  hookCharge: number;
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
  setQuality: (quality: QualityPreset) => void;
  setHookCharge: (hookCharge: number) => void;
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
  quality: 'high',
  hookCharge: 0,
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
  setQuality: (quality) => set({ quality }),
  setHookCharge: (hookCharge) => set({ hookCharge }),
  addInventory: (kind, amount) =>
    set((state) => ({
      inventory: { ...state.inventory, [kind]: state.inventory[kind] + amount },
    })),
  setFps: (fps) => set({ fps }),
  showNotice: (notice) => set({ notice }),
}));
