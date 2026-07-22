import { useEffect, useRef, useState } from 'react';
import { CapabilityScreen } from './components/CapabilityScreen';
import { FieldPackPanel } from './components/FieldPackPanel';
import { FailureScreen } from './components/FailureScreen';
import { Hud } from './components/Hud';
import { SettingsPanel } from './components/SettingsPanel';
import { SeaChartPanel } from './components/SeaChartPanel';
import { TitleScreen } from './components/TitleScreen';
import type { DriftwakeGame } from './game/DriftwakeGame';
import { ITEM_DEFINITIONS, type ItemId, type ToolId } from './game/domain/items';
import { RECIPES, type RecipeId } from './game/domain/recipes';
import type { RaftBuildCategory, RaftBuildPiece } from './game/domain/raftStructures';
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
  const failure = useGameStore((state) => state.failure);
  const crafting = useGameStore((state) => state.crafting);
  const player = useGameStore((state) => state.player);
  const fishing = useGameStore((state) => state.fishing);
  const resonanceFork = useGameStore((state) => state.resonanceFork);
  const shark = useGameStore((state) => state.shark);
  const raft = useGameStore((state) => state.raft);
  const build = useGameStore((state) => state.build);
  const collectionNets = useGameStore((state) => state.collectionNets);
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
      if (store.failure) {
        store.setPhase('failed');
        return;
      }
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
      const initializedStore = useGameStore.getState();
      initializedStore.setPhase(initializedStore.failure ? 'failed' : 'playing');
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
  const selectBuildPiece = (piece: RaftBuildPiece) => {
    if (!gameRef.current?.selectBuildPiece(piece)) gameRef.current?.playUi(false);
  };
  const selectBuildCategory = (category: RaftBuildCategory) => {
    if (!gameRef.current?.selectBuildCategory(category)) gameRef.current?.playUi(false);
  };
  const openPack = (panel: Exclude<OverlayPanel, null>) => {
    gameRef.current?.pauseInput();
    gameRef.current?.closeStorage();
    useGameStore.getState().setPlacementDevice(null);
    useGameStore.getState().setOverlayPanel(panel);
    gameRef.current?.playUi();
  };
  const queueCraft = (recipeId: RecipeId, quantity: number) => {
    const result = useGameStore.getState().queueCraft(recipeId, quantity);
    gameRef.current?.notifyCraftQueued(result.queued, result.ok);
    if (result.reason === 'queued') showTransientNotice(`${RECIPES[recipeId].name} ×${result.queued} 已加入队列`);
    else if (result.reason === 'partial') showTransientNotice(`已备料 ${result.queued} 项，材料或队列容量不足`);
    else if (result.reason === 'queue-full') showTransientNotice('制作队列已满');
    else if (result.reason === 'already-owned') showTransientNotice('已持有或正在制作该工具');
    else if (result.reason === 'locked') showTransientNotice('需要先在研究台学习配方');
    else showTransientNotice('材料不足');
    return result;
  };
  const cancelCraft = (entryId: string) => {
    const result = useGameStore.getState().cancelCraft(entryId);
    gameRef.current?.notifyCraftCancelled(result.ok);
    if (result.ok && result.cancelled) {
      showTransientNotice(`${RECIPES[result.cancelled.recipeId].name} 已取消，材料已返还`);
    } else if (result.reason === 'inventory-full') {
      showTransientNotice('背包没有空间完整返还材料');
    } else if (result.reason === 'tool-conflict') {
      showTransientNotice('同类工具占位，暂时无法返还升级材料');
    }
    return result;
  };
  const useItem = (itemId: ItemId) => {
    const before = useGameStore.getState().survival;
    const used = useGameStore.getState().useItem(itemId);
    if (used) {
      const after = useGameStore.getState().survival;
      const changes = [
        ['生命', Math.round(after.health - before.health)],
        ['水分', Math.round(after.thirst - before.thirst)],
        ['饱食', Math.round(after.hunger - before.hunger)],
      ] as const;
      const summary = changes
        .filter(([, amount]) => amount !== 0)
        .map(([label, amount]) => `${label} ${amount > 0 ? '+' : ''}${amount}`)
        .join(' · ');
      gameRef.current?.playConsume(itemId);
      showTransientNotice(`${ITEM_DEFINITIONS[itemId].shortName} · ${summary}`);
    } else {
      gameRef.current?.playUi(false);
      showTransientNotice(
        ITEM_DEFINITIONS[itemId].category === 'water'
          ? '水分充足，暂时不需要饮用'
          : '状态充足，暂时不需要进食',
      );
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
  const recoverFromFailure = () => {
    const game = gameRef.current;
    if (!game) return;
    const recovered = game.recoverFromFailure();
    if (!recovered) {
      game.playUi(false);
      return;
    }
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
        overlayOpen={overlayPanel !== null}
        pointerLockDenied={pointerLockDenied}
        audioEnabled={audioEnabled}
        selectedTool={selectedTool}
        hookCharge={hookCharge}
        inventory={inventory}
        toolDurability={toolDurability}
        survival={survival}
        player={player}
        fishing={fishing}
        resonanceFork={resonanceFork}
        shark={shark}
        raft={raft}
        build={build}
        collectionNets={collectionNets}
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
        onSelectBuildPiece={selectBuildPiece}
        onSelectBuildCategory={selectBuildCategory}
        onOpenPack={() => openPack('pack')}
        onOpenChart={() => openPack('chart')}
      />
      <FailureScreen
        visible={phase === 'failed' && !settingsOpen}
        ready={ready}
        failure={failure}
        onRecover={recoverFromFailure}
        onSettings={openSettings}
      />
      <FieldPackPanel
        panel={overlayPanel}
        inventory={inventory}
        crafting={crafting}
        survival={survival}
        toolDurability={toolDurability}
        inventorySlots={inventorySlots}
        raft={raft}
        progression={progression}
        storage={storage}
        saveStatus={saveStatus}
        notice={notice}
        onPanelChange={(panel) => {
          useGameStore.getState().setOverlayPanel(panel);
          gameRef.current?.playUi();
        }}
        onQueueCraft={queueCraft}
        onCancelCraft={cancelCraft}
        onUse={useItem}
        onPlace={placeDevice}
        onResearch={researchSample}
        onLearn={learnProject}
        onStorageTransfer={(itemId, direction, amount) => gameRef.current?.transferStorage(itemId, direction, amount) ?? false}
        onClose={() => {
          gameRef.current?.closeStorage();
          useGameStore.getState().setOverlayPanel(null);
          gameRef.current?.playUi();
        }}
      />
      <SeaChartPanel
        open={overlayPanel === 'chart'}
        navigation={navigation}
        onSelect={(targetId) => gameRef.current?.selectSignalTarget(targetId) ?? false}
        onClose={() => {
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
