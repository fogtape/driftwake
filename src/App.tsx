import { useEffect, useRef, useState } from 'react';
import { CapabilityScreen } from './components/CapabilityScreen';
import { Hud } from './components/Hud';
import { SettingsPanel } from './components/SettingsPanel';
import { TitleScreen } from './components/TitleScreen';
import type { DriftwakeGame } from './game/DriftwakeGame';
import type { AudioMixChannel } from './game/audio/audioMix';
import { useGameStore, type QualityPreset } from './state/gameStore';

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
  const settingsOpen = useGameStore((state) => state.settingsOpen);
  const audioEnabled = useGameStore((state) => state.audioEnabled);
  const audioMix = useGameStore((state) => state.audioMix);
  const muteOnFocusLoss = useGameStore((state) => state.muteOnFocusLoss);
  const headBobEnabled = useGameStore((state) => state.headBobEnabled);
  const quality = useGameStore((state) => state.quality);
  const dynamicResolutionEnabled = useGameStore((state) => state.dynamicResolutionEnabled);
  const playerMode = useGameStore((state) => state.playerMode);
  const environmentHud = useGameStore((state) => state.environmentHud);
  const hookCharge = useGameStore((state) => state.hookCharge);
  const inventory = useGameStore((state) => state.inventory);
  const survival = useGameStore((state) => state.survival);
  const notice = useGameStore((state) => state.notice);
  const fps = useGameStore((state) => state.fps);
  const renderStats = useGameStore((state) => state.renderStats);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      initializingRef.current = false;
      gameRef.current?.dispose();
      gameRef.current = null;
    };
  }, []);

  if (unsupported) return <CapabilityScreen />;

  const openSettings = () => {
    gameRef.current?.pauseInput();
    useGameStore.getState().setSettingsOpen(true);
  };
  const closeSettings = () => useGameStore.getState().setSettingsOpen(false);
  const begin = async () => {
    const store = useGameStore.getState();
    if (gameRef.current && store.ready) {
      store.setPhase('playing');
      gameRef.current.begin();
      return;
    }
    if (initializingRef.current || !mountRef.current) return;

    initializingRef.current = true;
    setLoadingGame(true);
    store.setLoadingLabel('正在唤醒海面');
    let game: DriftwakeGame | null = null;
    try {
      const { DriftwakeGame: GameRuntime } = await import('./game/DriftwakeGame');
      if (!mountedRef.current || !mountRef.current) return;
      game = new GameRuntime(mountRef.current);
      gameRef.current = game;
      await game.initialize();
      if (!mountedRef.current || gameRef.current !== game) return;
      if (!useGameStore.getState().ready) throw new Error('game initialization completed without becoming ready');
    } catch (error) {
      console.error('Failed to load Driftwake runtime', error);
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
  const changeAudioMix = (channel: AudioMixChannel, value: number) => {
    const store = useGameStore.getState();
    store.setAudioMixChannel(channel, value);
    gameRef.current?.setAudioMix(useGameStore.getState().audioMix);
  };
  const changeMuteOnFocusLoss = (enabled: boolean) => {
    useGameStore.getState().setMuteOnFocusLoss(enabled);
    gameRef.current?.setMuteOnFocusLoss(enabled);
  };
  const changeHeadBob = (enabled: boolean) => {
    useGameStore.getState().setHeadBobEnabled(enabled);
    gameRef.current?.setHeadBobEnabled(enabled);
  };
  const changeQuality = (preset: QualityPreset) => {
    useGameStore.getState().setQuality(preset);
    gameRef.current?.setQuality(preset);
  };
  const changeDynamicResolution = (enabled: boolean) => {
    useGameStore.getState().setDynamicResolutionEnabled(enabled);
    gameRef.current?.setDynamicResolutionEnabled(enabled);
  };

  return (
    <main className="app-shell">
      <div ref={mountRef} className="game-mount" />
      <TitleScreen
        visible={phase === 'title'}
        ready={ready}
        loading={loadingGame}
        loadingLabel={loadingLabel}
        onBegin={begin}
        onSettings={openSettings}
      />
      <Hud
        visible={phase === 'playing'}
        pointerLocked={pointerLocked}
        audioEnabled={audioEnabled}
        playerMode={playerMode}
        environmentHud={environmentHud}
        hookCharge={hookCharge}
        inventory={inventory}
        survival={survival}
        notice={notice}
        fps={fps}
        renderStats={renderStats}
        onResume={() => gameRef.current?.begin()}
        onSettings={openSettings}
        onToggleAudio={() => changeAudio(!audioEnabled)}
      />
      <SettingsPanel
        open={settingsOpen}
        audioEnabled={audioEnabled}
        audioMix={audioMix}
        muteOnFocusLoss={muteOnFocusLoss}
        headBobEnabled={headBobEnabled}
        quality={quality}
        dynamicResolutionEnabled={dynamicResolutionEnabled}
        onAudioChange={changeAudio}
        onAudioMixChange={changeAudioMix}
        onMuteOnFocusLossChange={changeMuteOnFocusLoss}
        onHeadBobChange={changeHeadBob}
        onQualityChange={changeQuality}
        onDynamicResolutionChange={changeDynamicResolution}
        onClose={closeSettings}
      />
    </main>
  );
}
