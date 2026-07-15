import { useEffect, useRef, useState } from 'react';
import { CapabilityScreen } from './components/CapabilityScreen';
import { FieldPackPanel } from './components/FieldPackPanel';
import { Hud } from './components/Hud';
import { SettingsPanel } from './components/SettingsPanel';
import { TitleScreen } from './components/TitleScreen';
import type { DriftwakeGame } from './game/DriftwakeGame';
import { ITEM_DEFINITIONS, type ItemId, type ToolId } from './game/domain/items';
import { RECIPES, type RecipeId } from './game/domain/recipes';
import { loadPreferences, writePreferences } from './game/domain/preferences';
import type { DeviceType } from './game/domain/devices';
import { useGameStore, type AudioMix, type OverlayPanel, type QualityPreset } from './state/gameStore';

function detectUnsupportedDevice(): boolean {
  const narrow = window.innerWidth < 720;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const webgl2 = typeof WebGL2RenderingContext !== 'undefined';
  return !webgl2 || (narrow && coarse);
}

export function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<DriftwakeGame | null>(null);
  const [unsupported] = useState(detectUnsupportedDevice);
  const phase = useGameStore((state) => state.phase);
  const ready = useGameStore((state) => state.ready);
  const loadingLabel = useGameStore((state) => state.loadingLabel);
  const pointerLocked = useGameStore((state) => state.pointerLocked);
  const settingsOpen = useGameStore((state) => state.settingsOpen);
  const overlayPanel = useGameStore((state) => state.overlayPanel);
  const audioEnabled = useGameStore((state) => state.audioEnabled);
  const audioMix = useGameStore((state) => state.audioMix);
  const quality = useGameStore((state) => state.quality);
  const hookCharge = useGameStore((state) => state.hookCharge);
  const selectedTool = useGameStore((state) => state.selectedTool);
  const inventory = useGameStore((state) => state.inventory);
  const inventorySlots = useGameStore((state) => state.inventorySlots);
  const survival = useGameStore((state) => state.survival);
  const fishing = useGameStore((state) => state.fishing);
  const shark = useGameStore((state) => state.shark);
  const raft = useGameStore((state) => state.raft);
  const devices = useGameStore((state) => state.devices);
  const placementDevice = useGameStore((state) => state.placementDevice);
  const interaction = useGameStore((state) => state.interaction);
  const saveStatus = useGameStore((state) => state.saveStatus);
  const notice = useGameStore((state) => state.notice);
  const fps = useGameStore((state) => state.fps);

  useEffect(() => {
    if (unsupported || !mountRef.current) return;
    let active = true;
    const preferences = loadPreferences();
    const store = useGameStore.getState();
    store.setAudioEnabled(preferences.audioEnabled);
    store.setAudioMix(preferences.audioMix);
    store.setQuality(preferences.quality);
    void import('./game/DriftwakeGame')
      .then(({ DriftwakeGame: Game }) => {
        if (!active || !mountRef.current) return;
        const game = new Game(mountRef.current);
        gameRef.current = game;
        void game.initialize().catch(() => undefined);
      })
      .catch((error) => {
        console.error('Failed to load Driftwake game module', error);
        useGameStore.getState().setLoadingLabel('游戏模块加载失败');
      });
    const unsubscribePreferences = useGameStore.subscribe((state, previous) => {
      if (
        state.audioEnabled !== previous.audioEnabled ||
        state.audioMix !== previous.audioMix ||
        state.quality !== previous.quality
      ) {
        writePreferences({
          version: 1,
          audioEnabled: state.audioEnabled,
          audioMix: state.audioMix,
          quality: state.quality,
        });
      }
    });
    return () => {
      active = false;
      unsubscribePreferences();
      gameRef.current?.dispose();
      gameRef.current = null;
    };
  }, [unsupported]);

  if (unsupported) return <CapabilityScreen />;

  const openSettings = () => {
    gameRef.current?.pauseInput();
    useGameStore.getState().setOverlayPanel(null);
    useGameStore.getState().setPlacementDevice(null);
    useGameStore.getState().setSettingsOpen(true);
    gameRef.current?.playUi();
  };
  const closeSettings = () => {
    useGameStore.getState().setSettingsOpen(false);
    gameRef.current?.playUi();
  };
  const begin = () => {
    useGameStore.getState().setPhase('playing');
    gameRef.current?.begin();
  };
  const changeAudio = (enabled: boolean) => {
    useGameStore.getState().setAudioEnabled(enabled);
    gameRef.current?.setAudioEnabled(enabled);
  };
  const changeQuality = (preset: QualityPreset) => {
    useGameStore.getState().setQuality(preset);
    gameRef.current?.setQuality(preset);
  };
  const changeAudioMix = (mix: Partial<AudioMix>) => {
    useGameStore.getState().setAudioMix(mix);
    gameRef.current?.setAudioMix(useGameStore.getState().audioMix);
  };
  const showTransientNotice = (message: string) => {
    useGameStore.getState().showNotice(message);
    window.setTimeout(() => {
      if (useGameStore.getState().notice === message) useGameStore.getState().showNotice(null);
    }, 1500);
  };
  const selectTool = (tool: ToolId) => {
    const selected = useGameStore.getState().setSelectedTool(tool);
    gameRef.current?.playUi(selected);
    if (!selected) showTransientNotice('需要先制作该工具');
  };
  const openPack = (panel: Exclude<OverlayPanel, null>) => {
    gameRef.current?.pauseInput();
    useGameStore.getState().setPlacementDevice(null);
    useGameStore.getState().setOverlayPanel(panel);
    gameRef.current?.playUi();
  };
  const craft = (recipeId: RecipeId) => {
    const result = useGameStore.getState().craft(recipeId);
    gameRef.current?.playUi(result.ok);
    if (result.ok) showTransientNotice(`${RECIPES[recipeId].name} 已制作`);
    else if (result.reason === 'inventory-full') showTransientNotice('背包没有空位');
    else if (result.reason === 'already-owned') showTransientNotice('已经持有该工具');
    else showTransientNotice('材料不足');
    return result;
  };
  const useItem = (itemId: ItemId) => {
    const used = useGameStore.getState().useItem(itemId);
    gameRef.current?.playUi(used);
    if (used) {
      gameRef.current?.playConsume();
      showTransientNotice(`${ITEM_DEFINITIONS[itemId].shortName} 已使用`);
    }
    return used;
  };
  const placeDevice = (deviceType: DeviceType) => {
    const store = useGameStore.getState();
    store.setOverlayPanel(null);
    store.setPlacementDevice(deviceType);
    gameRef.current?.playUi();
    gameRef.current?.begin();
  };

  return (
    <main className="app-shell">
      <div ref={mountRef} className="game-mount" />
      <TitleScreen
        visible={phase === 'title'}
        ready={ready}
        loadingLabel={loadingLabel}
        onBegin={begin}
        onSettings={openSettings}
      />
      <Hud
        visible={phase === 'playing'}
        pointerLocked={pointerLocked}
        audioEnabled={audioEnabled}
        selectedTool={selectedTool}
        hookCharge={hookCharge}
        inventory={inventory}
        survival={survival}
        fishing={fishing}
        shark={shark}
        raft={raft}
        devices={devices}
        placementDevice={placementDevice}
        interaction={interaction}
        notice={notice}
        fps={fps}
        onResume={() => gameRef.current?.begin()}
        onSettings={openSettings}
        onToggleAudio={() => changeAudio(!audioEnabled)}
        onSelectTool={selectTool}
        onOpenPack={() => openPack('pack')}
      />
      <FieldPackPanel
        panel={overlayPanel}
        inventory={inventory}
        inventorySlots={inventorySlots}
        raft={raft}
        saveStatus={saveStatus}
        onPanelChange={(panel) => {
          useGameStore.getState().setOverlayPanel(panel);
          gameRef.current?.playUi();
        }}
        onCraft={craft}
        onUse={useItem}
        onPlace={placeDevice}
        onClose={() => {
          useGameStore.getState().setOverlayPanel(null);
          gameRef.current?.playUi();
        }}
      />
      <SettingsPanel
        open={settingsOpen}
        audioEnabled={audioEnabled}
        audioMix={audioMix}
        quality={quality}
        onAudioChange={changeAudio}
        onAudioMixChange={changeAudioMix}
        onQualityChange={changeQuality}
        onClose={closeSettings}
      />
    </main>
  );
}
