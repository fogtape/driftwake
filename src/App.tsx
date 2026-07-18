import { useEffect, useRef, useState } from 'react';
import { CapabilityScreen } from './components/CapabilityScreen';
import { FieldPackPanel } from './components/FieldPackPanel';
import { Hud } from './components/Hud';
import { SettingsPanel } from './components/SettingsPanel';
import { TitleScreen } from './components/TitleScreen';
import type { DriftwakeGame } from './game/DriftwakeGame';
import { ITEM_DEFINITIONS, type ItemId, type ToolId } from './game/domain/items';
import { RECIPES, type RecipeId } from './game/domain/recipes';
import { RESEARCH_PROJECTS, type ResearchProjectId, type ResearchSampleId } from './game/domain/progression';
import { loadPreferences, writePreferences } from './game/domain/preferences';
import type { CameraMotionMode } from './game/domain/settings';
import { useGameStore, type AudioMix, type OverlayPanel, type PlacementType, type QualityPreset } from './state/gameStore';

function detectUnsupportedDevice(): boolean {
  const narrow = window.innerWidth < 720;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const webgl2 = typeof WebGL2RenderingContext !== 'undefined';
  return !webgl2 || (narrow && coarse);
}

export function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<DriftwakeGame | null>(null);
  const initializingRef = useRef(false);
  const mountedRef = useRef(true);
  const [loadingGame, setLoadingGame] = useState(false);
  const [unsupported] = useState(detectUnsupportedDevice);
  const phase = useGameStore((state) => state.phase);
  const ready = useGameStore((state) => state.ready);
  const loadingLabel = useGameStore((state) => state.loadingLabel);
  const pointerLocked = useGameStore((state) => state.pointerLocked);
  const pointerLockDenied = useGameStore((state) => state.pointerLockDenied);
  const settingsOpen = useGameStore((state) => state.settingsOpen);
  const overlayPanel = useGameStore((state) => state.overlayPanel);
  const audioEnabled = useGameStore((state) => state.audioEnabled);
  const audioMix = useGameStore((state) => state.audioMix);
  const muteOnFocusLoss = useGameStore((state) => state.muteOnFocusLoss);
  const cameraMotionMode = useGameStore((state) => state.cameraMotionMode);
  const quality = useGameStore((state) => state.quality);
  const dynamicResolutionEnabled = useGameStore((state) => state.dynamicResolutionEnabled);
  const hookCharge = useGameStore((state) => state.hookCharge);
  const selectedTool = useGameStore((state) => state.selectedTool);
  const inventory = useGameStore((state) => state.inventory);
  const toolDurability = useGameStore((state) => state.toolDurability);
  const inventorySlots = useGameStore((state) => state.inventorySlots);
  const survival = useGameStore((state) => state.survival);
  const player = useGameStore((state) => state.player);
  const fishing = useGameStore((state) => state.fishing);
  const shark = useGameStore((state) => state.shark);
  const raft = useGameStore((state) => state.raft);
  const devices = useGameStore((state) => state.devices);
  const storage = useGameStore((state) => state.storage);
  const navigation = useGameStore((state) => state.navigation);
  const planting = useGameStore((state) => state.planting);
  const progression = useGameStore((state) => state.progression);
  const island = useGameStore((state) => state.island);
  const reef = useGameStore((state) => state.reef);
  const placementDevice = useGameStore((state) => state.placementDevice);
  const interaction = useGameStore((state) => state.interaction);
  const saveStatus = useGameStore((state) => state.saveStatus);
  const notice = useGameStore((state) => state.notice);
  const fps = useGameStore((state) => state.fps);

  useEffect(() => {
    mountedRef.current = true;
    if (unsupported) return () => {
      mountedRef.current = false;
    };
    const preferences = loadPreferences();
    const store = useGameStore.getState();
    store.setAudioEnabled(preferences.audioEnabled);
    store.setAudioMix(preferences.audioMix);
    store.setMuteOnFocusLoss(preferences.muteOnFocusLoss);
    store.setCameraMotionMode(preferences.cameraMotionMode);
    store.setQuality(preferences.quality);
    store.setDynamicResolutionEnabled(preferences.dynamicResolutionEnabled);
    const unsubscribePreferences = useGameStore.subscribe((state, previous) => {
      if (
        state.audioEnabled !== previous.audioEnabled ||
        state.audioMix !== previous.audioMix ||
        state.muteOnFocusLoss !== previous.muteOnFocusLoss ||
        state.cameraMotionMode !== previous.cameraMotionMode ||
        state.quality !== previous.quality ||
        state.dynamicResolutionEnabled !== previous.dynamicResolutionEnabled
      ) {
        writePreferences({
          version: 2,
          audioEnabled: state.audioEnabled,
          audioMix: state.audioMix,
          muteOnFocusLoss: state.muteOnFocusLoss,
          cameraMotionMode: state.cameraMotionMode,
          quality: state.quality,
          dynamicResolutionEnabled: state.dynamicResolutionEnabled,
        });
      }
    });
    return () => {
      mountedRef.current = false;
      initializingRef.current = false;
      unsubscribePreferences();
      gameRef.current?.dispose();
      gameRef.current = null;
    };
  }, [unsupported]);

  if (unsupported) return <CapabilityScreen />;

  const openSettings = () => {
    gameRef.current?.pauseInput();
    gameRef.current?.closeStorage();
    useGameStore.getState().setOverlayPanel(null);
    useGameStore.getState().setPlacementDevice(null);
    useGameStore.getState().setSettingsOpen(true);
    gameRef.current?.playUi();
  };
  const closeSettings = () => {
    useGameStore.getState().setSettingsOpen(false);
    gameRef.current?.playUi();
  };
  const begin = async () => {
    const store = useGameStore.getState();
    if (gameRef.current) {
      store.setPhase('playing');
      if (store.ready) gameRef.current.begin();
      else store.showNotice('图形上下文仍在恢复');
      return;
    }
    if (initializingRef.current || !mountRef.current) return;

    initializingRef.current = true;
    setLoadingGame(true);
    store.setLoadingLabel('正在唤醒海面');
    let game: DriftwakeGame | null = null;
    try {
      const { DriftwakeGame: Game } = await import('./game/DriftwakeGame');
      if (!mountedRef.current || !mountRef.current) return;
      game = new Game(mountRef.current);
      gameRef.current = game;
      await game.initialize();
      if (!mountedRef.current || gameRef.current !== game) return;
      if (!useGameStore.getState().ready) throw new Error('game initialization completed without becoming ready');
      useGameStore.getState().setPhase('playing');
    } catch (error) {
      console.error('Failed to load Driftwake game module', error);
      game?.dispose();
      if (gameRef.current === game) gameRef.current = null;
      const failedStore = useGameStore.getState();
      failedStore.setReady(false);
      failedStore.setLoadingLabel('加载失败，请重试');
      failedStore.showNotice('海面加载失败');
    } finally {
      initializingRef.current = false;
      if (mountedRef.current) setLoadingGame(false);
    }
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
  const changeMuteOnFocusLoss = (enabled: boolean) => {
    useGameStore.getState().setMuteOnFocusLoss(enabled);
    gameRef.current?.setMuteOnFocusLoss(enabled);
  };
  const changeCameraMotionMode = (mode: CameraMotionMode) => {
    useGameStore.getState().setCameraMotionMode(mode);
    gameRef.current?.setCameraMotionMode(mode);
  };
  const changeDynamicResolution = (enabled: boolean) => {
    useGameStore.getState().setDynamicResolutionEnabled(enabled);
    gameRef.current?.setDynamicResolutionEnabled(enabled);
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
    gameRef.current?.closeStorage();
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
    else if (result.reason === 'locked') showTransientNotice('需要先在研究台学习配方');
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
  const placeDevice = (deviceType: PlacementType) => {
    const store = useGameStore.getState();
    if (store.island.ashore) {
      gameRef.current?.playUi(false);
      showTransientNotice('返回木筏后才能安置设备');
      return;
    }
    store.setOverlayPanel(null);
    store.setPlacementDevice(deviceType);
    gameRef.current?.playUi();
    gameRef.current?.begin();
  };
  const researchSample = (sample: ResearchSampleId) => {
    const result = useGameStore.getState().researchSample(sample);
    const success = result === 'researched';
    gameRef.current?.playResearchSample(success);
    if (success) showTransientNotice(`${ITEM_DEFINITIONS[sample].shortName} 已建立材料档案`);
    else if (result === 'already-researched') showTransientNotice('该材料已经完成研究');
    else showTransientNotice('背包中缺少该样本');
    return result;
  };
  const learnProject = (projectId: ResearchProjectId) => {
    const learned = useGameStore.getState().learnResearchProject(projectId);
    gameRef.current?.playResearchLearn(learned);
    showTransientNotice(learned ? `${RESEARCH_PROJECTS[projectId].name} 已写入制作记录` : '研究样本尚未齐全');
    return learned;
  };

  return (
    <main className="app-shell">
      <div ref={mountRef} className="game-mount" />
      <TitleScreen
        visible={phase === 'title'}
        loading={loadingGame}
        loadingLabel={loadingLabel}
        onBegin={begin}
        onSettings={openSettings}
      />
      <div className={`underwater-veil ${player.submerged ? 'is-visible' : ''}`} aria-hidden="true" />
      <Hud
        visible={phase === 'playing'}
        ready={ready}
        pointerLocked={pointerLocked}
        pointerLockDenied={pointerLockDenied}
        audioEnabled={audioEnabled}
        selectedTool={selectedTool}
        hookCharge={hookCharge}
        inventory={inventory}
        toolDurability={toolDurability}
        survival={survival}
        player={player}
        fishing={fishing}
        shark={shark}
        raft={raft}
        progression={progression}
        devices={devices}
        navigation={navigation}
        planting={planting}
        island={island}
        reef={reef}
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
        toolDurability={toolDurability}
        inventorySlots={inventorySlots}
        raft={raft}
        progression={progression}
        storage={storage}
        saveStatus={saveStatus}
        onPanelChange={(panel) => {
          useGameStore.getState().setOverlayPanel(panel);
          gameRef.current?.playUi();
        }}
        onCraft={craft}
        onUse={useItem}
        onPlace={placeDevice}
        onResearch={researchSample}
        onLearn={learnProject}
        onStorageTransfer={(itemId, direction) => gameRef.current?.transferStorage(itemId, direction) ?? false}
        onClose={() => {
          gameRef.current?.closeStorage();
          useGameStore.getState().setOverlayPanel(null);
          gameRef.current?.playUi();
        }}
      />
      <SettingsPanel
        open={settingsOpen}
        audioEnabled={audioEnabled}
        audioMix={audioMix}
        muteOnFocusLoss={muteOnFocusLoss}
        cameraMotionMode={cameraMotionMode}
        quality={quality}
        dynamicResolutionEnabled={dynamicResolutionEnabled}
        onAudioChange={changeAudio}
        onAudioMixChange={changeAudioMix}
        onMuteOnFocusLossChange={changeMuteOnFocusLoss}
        onCameraMotionModeChange={changeCameraMotionMode}
        onQualityChange={changeQuality}
        onDynamicResolutionChange={changeDynamicResolution}
        onClose={closeSettings}
      />
    </main>
  );
}
