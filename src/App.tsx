import { useEffect, useRef, useState } from 'react';
import { CapabilityScreen } from './components/CapabilityScreen';
import { Hud } from './components/Hud';
import { SettingsPanel } from './components/SettingsPanel';
import { TitleScreen } from './components/TitleScreen';
import { DriftwakeGame } from './game/DriftwakeGame';
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
  const [unsupported] = useState(detectUnsupportedDevice);
  const phase = useGameStore((state) => state.phase);
  const ready = useGameStore((state) => state.ready);
  const loadingLabel = useGameStore((state) => state.loadingLabel);
  const pointerLocked = useGameStore((state) => state.pointerLocked);
  const settingsOpen = useGameStore((state) => state.settingsOpen);
  const audioEnabled = useGameStore((state) => state.audioEnabled);
  const quality = useGameStore((state) => state.quality);
  const hookCharge = useGameStore((state) => state.hookCharge);
  const inventory = useGameStore((state) => state.inventory);
  const survival = useGameStore((state) => state.survival);
  const notice = useGameStore((state) => state.notice);
  const fps = useGameStore((state) => state.fps);

  useEffect(() => {
    if (unsupported || !mountRef.current) return;
    const game = new DriftwakeGame(mountRef.current);
    gameRef.current = game;
    void game.initialize();
    return () => {
      game.dispose();
      gameRef.current = null;
    };
  }, [unsupported]);

  if (unsupported) return <CapabilityScreen />;

  const openSettings = () => {
    gameRef.current?.pauseInput();
    useGameStore.getState().setSettingsOpen(true);
  };
  const closeSettings = () => useGameStore.getState().setSettingsOpen(false);
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
        hookCharge={hookCharge}
        inventory={inventory}
        survival={survival}
        notice={notice}
        fps={fps}
        onResume={() => gameRef.current?.begin()}
        onSettings={openSettings}
        onToggleAudio={() => changeAudio(!audioEnabled)}
      />
      <SettingsPanel
        open={settingsOpen}
        audioEnabled={audioEnabled}
        quality={quality}
        onAudioChange={changeAudio}
        onQualityChange={changeQuality}
        onClose={closeSettings}
      />
    </main>
  );
}
