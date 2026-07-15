import {
  ACESFilmicToneMapping,
  AmbientLight,
  Clock,
  Color,
  DirectionalLight,
  FogExp2,
  Group,
  HemisphereLight,
  PerspectiveCamera,
  PCFSoftShadowMap,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
  type Mesh,
  type Texture,
} from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { createDistantIsland } from './art/ProceduralModels';
import {
  createMaterialLibrary,
  disposeMaterialLibrary,
  loadAssetTextures,
  type AssetTextures,
  type MaterialLibrary,
} from './art/Materials';
import { useGameStore, type QualityPreset } from '../state/gameStore';
import { AudioSystem } from './systems/AudioSystem';
import type { AudioMixSnapshot } from './audio/audioMix';
import { DebrisField } from './systems/DebrisField';
import { HookSystem } from './systems/HookSystem';
import { OceanSystem } from './systems/OceanSystem';
import { PhysicsSystem } from './systems/PhysicsSystem';
import { PlayerController } from './systems/PlayerController';
import { RaftSystem } from './systems/RaftSystem';
import { SplashSystem } from './systems/SplashSystem';
import { WeatherSystem } from './systems/WeatherSystem';
import { sampleWaveHeight } from './math/waves';
import { createEnvironmentSample, parseEnvironmentOffset, sampleEnvironment } from './environment/environment';
import type { EnvironmentSample } from './environment/environment';
import { FixedStepScheduler, isGameReady, isSimulationActive } from './runtime/runtime';
import {
  createDynamicResolutionState,
  stepDynamicResolution,
  type DynamicResolutionPolicy,
  type DynamicResolutionState,
} from './runtime/dynamicResolution';
import { getUnderwaterTarget, smoothUnderwaterMix } from './player/underwater';
import type { PlayerLocomotionMode } from './player/locomotion';

function getLocalEnvironmentOffset(): number {
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') return 0;
  return parseEnvironmentOffset(new URLSearchParams(window.location.search).get('environmentOffset'));
}

const DYNAMIC_RESOLUTION_POLICIES: Record<QualityPreset, DynamicResolutionPolicy> = {
  high: {
    targetFps: 60,
    minimumScale: 0.55,
    maximumScale: 1,
    decreaseStep: 0.1,
    increaseStep: 0.05,
    decreaseAfterSeconds: 1.5,
    increaseAfterSeconds: 6,
    cooldownSeconds: 2,
  },
  low: {
    targetFps: 30,
    minimumScale: 0.7,
    maximumScale: 1,
    decreaseStep: 0.1,
    increaseStep: 0.05,
    decreaseAfterSeconds: 1.5,
    increaseAfterSeconds: 5,
    cooldownSeconds: 2,
  },
};

export class DriftwakeGame {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(67, 1, 0.045, 520);
  private readonly renderer: WebGLRenderer;
  private readonly clock = new Clock();
  private readonly fixedStep = new FixedStepScheduler();
  private readonly environment: EnvironmentSample = createEnvironmentSample();
  private readonly environmentTimeOffset = getLocalEnvironmentOffset();
  private readonly surfaceColor = new Color('#a9cfd2');
  private readonly daySurfaceColor = new Color('#a9cfd2');
  private readonly nightSurfaceColor = new Color('#071323');
  private readonly stormSurfaceColor = new Color('#526671');
  private readonly underwaterColor = new Color('#0a4652');
  private readonly sunPosition = new Vector3();
  private readonly splashPosition = new Vector3();
  private readonly audio = new AudioSystem();
  private readonly physics = new PhysicsSystem();
  private textures: AssetTextures | null = null;
  private materials: MaterialLibrary | null = null;
  private ocean: OceanSystem | null = null;
  private raft: RaftSystem | null = null;
  private debris: DebrisField | null = null;
  private player: PlayerController | null = null;
  private hook: HookSystem | null = null;
  private splashes: SplashSystem | null = null;
  private weather: WeatherSystem | null = null;
  private sky: Sky | null = null;
  private hemisphereLight: HemisphereLight | null = null;
  private ambientLight: AmbientLight | null = null;
  private sunLight: DirectionalLight | null = null;
  private island: Group | null = null;
  private elapsed = 0;
  private underwaterMix = 0;
  private presentedUnderwaterMix = -1;
  private environmentFogDensity = 0.0065;
  private environmentExposure = 1.08;
  private presentedEnvironmentSecond = -1;
  private fpsElapsed = 0;
  private fpsFrames = 0;
  private qualityPreset: QualityPreset = 'high';
  private dynamicResolutionState: DynamicResolutionState = createDynamicResolutionState();
  private appliedPixelRatio = -1;
  private simulationActive = false;
  private windowFocused = document.hasFocus();
  private initialized = false;
  private contextLost = false;
  private disposed = false;

  constructor(private readonly mount: HTMLElement) {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.domElement.className = 'game-canvas';
    this.renderer.domElement.setAttribute('aria-label', 'Driftwake 3D 游戏画面');
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.mount.appendChild(this.renderer.domElement);
    this.scene.add(this.camera);
    this.scene.background = this.surfaceColor.clone();
    this.scene.fog = new FogExp2(this.surfaceColor.getHex(), 0.0065);
    this.mount.style.setProperty('--underwater-mix', '0');
    this.mount.dataset.playerMode = 'raft';
    this.mount.dataset.simulationActive = 'false';
    const initialSettings = useGameStore.getState();
    this.audio.setMix(initialSettings.audioMix);
    this.setQuality(initialSettings.quality);
    this.setDynamicResolutionEnabled(initialSettings.dynamicResolutionEnabled);

    window.addEventListener('resize', this.resize);
    window.addEventListener('blur', this.onWindowBlur);
    window.addEventListener('focus', this.onWindowFocus);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    this.renderer.domElement.addEventListener('click', this.onCanvasClick);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored);
  }

  async initialize(): Promise<void> {
    const store = useGameStore.getState();
    try {
      store.setLoadingLabel('正在调校光线');
      this.setupLightingAndSky();
      this.textures = await loadAssetTextures(this.renderer);
      if (this.disposed) return;

      store.setLoadingLabel('正在系紧木筏');
      this.materials = createMaterialLibrary(this.textures);
      this.ocean = new OceanSystem(this.textures.foam);
      this.ocean.setQuality(store.quality === 'high');
      this.raft = new RaftSystem(this.materials);
      this.scene.add(this.ocean.mesh, this.raft.group);

      this.island = createDistantIsland(this.materials);
      this.island.position.set(-18, -0.28, -78);
      this.island.scale.setScalar(1.55);
      this.scene.add(this.island);

      store.setLoadingLabel('正在放流物资');
      this.debris = new DebrisField(this.scene, this.materials, store.quality === 'high' ? 30 : 18);
      this.splashes = new SplashSystem(this.scene);
      this.weather = new WeatherSystem(this.scene);
      this.weather.setQuality(store.quality === 'high');
      this.player = new PlayerController(
        this.camera,
        this.raft,
        this.onPlayerModeChange,
      );
      this.player.setHeadBobEnabled(store.headBobEnabled);
      this.hook = new HookSystem(
        this.renderer,
        this.camera,
        this.scene,
        this.materials,
        this.debris,
        this.audio,
        this.splashes,
      );

      store.setLoadingLabel('正在建立物理世界');
      await this.physics.initialize();
      if (this.disposed) return;

      this.clock.start();
      this.renderer.setAnimationLoop(this.update);
      this.initialized = true;
      store.setReady(isGameReady({ initialized: this.initialized, contextLost: this.contextLost }));
      store.setLoadingLabel(this.contextLost ? '图形上下文恢复中' : '海况稳定');
    } catch (error) {
      console.error('Failed to initialize Driftwake', error);
      store.setLoadingLabel('初始化失败');
      throw error;
    }
  }

  begin(): void {
    const state = useGameStore.getState();
    if (!state.ready) return;
    this.audio.setEnabled(state.audioEnabled);
    this.audio.setMix(state.audioMix);
    this.setAudioFocusMuted(state.muteOnFocusLoss && (!this.windowFocused || document.visibilityState !== 'visible'));
    void this.audio.begin();
    void this.renderer.domElement.requestPointerLock();
  }

  pauseInput(): void {
    if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
  }

  setAudioEnabled(enabled: boolean): void {
    this.audio.setEnabled(enabled);
    if (enabled) void this.audio.begin();
  }

  setAudioMix(mix: AudioMixSnapshot): void {
    this.audio.setMix(mix);
  }

  setMuteOnFocusLoss(enabled: boolean): void {
    const shouldMute = enabled && (!this.windowFocused || document.visibilityState !== 'visible');
    this.setAudioFocusMuted(shouldMute);
  }

  private setAudioFocusMuted(focusMuted: boolean): void {
    this.audio.setFocusMuted(focusMuted);
    this.mount.dataset.audioFocusMuted = String(focusMuted);
  }

  setHeadBobEnabled(enabled: boolean): void {
    this.player?.setHeadBobEnabled(enabled);
  }

  setQuality(quality: QualityPreset): void {
    this.qualityPreset = quality;
    this.dynamicResolutionState = createDynamicResolutionState();
    const highQuality = quality === 'high';
    this.renderer.shadowMap.enabled = highQuality;
    this.ocean?.setQuality(highQuality);
    this.weather?.setQuality(highQuality);
    this.applyRenderScale();
  }

  setDynamicResolutionEnabled(enabled: boolean): void {
    this.dynamicResolutionState = createDynamicResolutionState(1);
    this.mount.dataset.dynamicResolution = String(enabled);
    this.applyRenderScale();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('blur', this.onWindowBlur);
    window.removeEventListener('focus', this.onWindowFocus);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.renderer.domElement.removeEventListener('click', this.onCanvasClick);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.player?.dispose();
    this.hook?.dispose(this.scene);
    this.splashes?.dispose();
    this.weather?.dispose();
    this.debris?.dispose(this.scene);
    this.ocean?.dispose();
    this.physics.dispose();
    this.audio.dispose();

    const geometries = new Set<BufferGeometry>();
    const materials = new Set<Material>();
    const textures = new Set<Texture>();
    this.scene.traverse((object) => {
      const mesh = object as Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      const meshMaterials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const material of meshMaterials) {
        materials.add(material);
        for (const value of Object.values(material)) {
          if (value && typeof value === 'object' && 'isTexture' in value) textures.add(value as Texture);
        }
      }
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    textures.forEach((texture) => texture.dispose());
    if (this.materials) disposeMaterialLibrary(this.materials);
    this.mount.style.removeProperty('--underwater-mix');
    delete this.mount.dataset.playerMode;
    delete this.mount.dataset.simulationActive;
    delete this.mount.dataset.weather;
    delete this.mount.dataset.daylight;
    delete this.mount.dataset.environmentRisk;
    delete this.mount.dataset.dynamicResolution;
    delete this.mount.dataset.audioFocusMuted;
    delete this.mount.dataset.renderScale;
    delete this.mount.dataset.pixelRatio;
    delete this.mount.dataset.drawCalls;
    delete this.mount.dataset.triangles;
    delete this.mount.dataset.geometries;
    delete this.mount.dataset.textures;
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private setupLightingAndSky(): void {
    this.sky = new Sky();
    this.sky.scale.setScalar(450);
    const uniforms = this.sky.material.uniforms;
    uniforms.turbidity.value = 6.8;
    uniforms.rayleigh.value = 2.25;
    uniforms.mieCoefficient.value = 0.006;
    uniforms.mieDirectionalG.value = 0.82;
    this.sunPosition.set(0.56, 0.72, 0.4).normalize();
    uniforms.sunPosition.value.copy(this.sunPosition);
    this.scene.add(this.sky);

    this.hemisphereLight = new HemisphereLight(0xc7e9f0, 0x5f4937, 1.85);
    this.ambientLight = new AmbientLight(0x91b8bd, 0.36);
    this.sunLight = new DirectionalLight(0xffe1b1, 3.1);
    this.sunLight.position.copy(this.sunPosition).multiplyScalar(70);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1536, 1536);
    this.sunLight.shadow.camera.left = -12;
    this.sunLight.shadow.camera.right = 12;
    this.sunLight.shadow.camera.top = 12;
    this.sunLight.shadow.camera.bottom = -12;
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 130;
    this.sunLight.shadow.bias = -0.00018;
    this.scene.add(this.hemisphereLight, this.ambientLight, this.sunLight);
  }

  private readonly stepSimulation = (stepSeconds: number, simulationSeconds: number): void => {
    this.elapsed = simulationSeconds;
    sampleEnvironment(simulationSeconds + this.environmentTimeOffset, this.environment);
    this.raft?.update(simulationSeconds, stepSeconds, this.environment.waveScale);
    this.player?.update(simulationSeconds, stepSeconds, this.environment);
    this.debris?.update(simulationSeconds, stepSeconds, this.environment);
    this.hook?.update(simulationSeconds, stepSeconds, this.environment.waveScale);
    this.splashes?.update(stepSeconds);
    this.audio.setEnvironment(this.environment);
    this.audio.update(simulationSeconds);
    this.physics.step(stepSeconds);
  };

  private readonly update = (): void => {
    if (this.disposed) return;
    const frameDelta = Math.min(this.clock.getDelta(), 0.25);
    const state = useGameStore.getState();
    const active = isSimulationActive({
      phase: state.phase,
      pointerLocked: state.pointerLocked,
      settingsOpen: state.settingsOpen,
      documentVisible: document.visibilityState === 'visible',
      windowFocused: this.windowFocused,
      contextHealthy: !this.contextLost,
    });
    this.setSimulationActive(active);

    let renderTime = this.fixedStep.simulationSeconds;
    if (active) {
      renderTime = this.fixedStep.advance(frameDelta, this.stepSimulation).interpolatedSeconds;
    }
    this.ocean?.update(renderTime, this.environment);
    this.updateEnvironmentPresentation();
    this.weather?.update(frameDelta, this.camera, this.environment);

    if (this.island) {
      this.island.position.y = -0.28
        + sampleWaveHeight(-18, -78, renderTime, this.environment.waveScale) * 0.12;
    }
    this.updateUnderwaterPresentation(renderTime, frameDelta);

    this.fpsElapsed += frameDelta;
    this.fpsFrames += 1;
    if (this.fpsElapsed >= 0.75) {
      const measuredSeconds = this.fpsElapsed;
      const measuredFps = Math.round(this.fpsFrames / measuredSeconds);
      if (active) {
        const previousScale = this.dynamicResolutionState.scale;
        this.dynamicResolutionState = stepDynamicResolution(
          this.dynamicResolutionState,
          {
            fps: measuredFps,
            elapsedSeconds: measuredSeconds,
            enabled: state.dynamicResolutionEnabled,
          },
          DYNAMIC_RESOLUTION_POLICIES[this.qualityPreset],
        );
        if (Math.abs(previousScale - this.dynamicResolutionState.scale) >= 0.001) {
          this.applyRenderScale();
        }
      }
      this.publishRenderStats(measuredFps);
      this.fpsElapsed = 0;
      this.fpsFrames = 0;
    }
    this.renderer.render(this.scene, this.camera);
  };

  private updateEnvironmentPresentation(): void {
    const environment = this.environment;
    const cloudMix = environment.cloudCover * 0.72;
    this.surfaceColor
      .lerpColors(this.nightSurfaceColor, this.daySurfaceColor, environment.daylight)
      .lerp(this.stormSurfaceColor, cloudMix);
    this.environmentFogDensity = 0.0065 + (1 - environment.visibility) * 0.024;
    this.environmentExposure = Math.max(
      0.42,
      0.5 + environment.daylight * 0.58 - environment.cloudCover * 0.12,
    );

    const background = this.scene.background;
    if (background instanceof Color) background.copy(this.surfaceColor);
    const fog = this.scene.fog;
    if (fog instanceof FogExp2) {
      fog.color.copy(this.surfaceColor);
      fog.density = this.environmentFogDensity;
    }
    this.renderer.toneMappingExposure = this.environmentExposure;

    const horizontal = Math.sqrt(Math.max(0, 1 - environment.sunElevation * environment.sunElevation));
    this.sunPosition.set(
      Math.cos(environment.sunAzimuth) * horizontal,
      environment.sunElevation,
      Math.sin(environment.sunAzimuth) * horizontal,
    ).normalize();
    if (this.sky) {
      const uniforms = this.sky.material.uniforms;
      uniforms.sunPosition.value.copy(this.sunPosition);
      uniforms.turbidity.value = 6.8 + environment.cloudCover * 8;
      uniforms.rayleigh.value = 2.25 - environment.cloudCover * 0.72;
      uniforms.mieCoefficient.value = 0.006 + environment.cloudCover * 0.012;
    }
    if (this.hemisphereLight) {
      this.hemisphereLight.intensity = 0.2
        + environment.daylight * 1.65 * (1 - environment.cloudCover * 0.52);
    }
    if (this.ambientLight) {
      this.ambientLight.intensity = 0.12 + environment.daylight * 0.28;
    }
    if (this.sunLight) {
      this.sunLight.intensity = 3.1
        * environment.daylight
        * (1 - environment.cloudCover * 0.78);
      this.sunLight.position.copy(this.sunPosition).multiplyScalar(70);
    }

    const environmentSecond = Math.floor(this.elapsed);
    if (environmentSecond !== this.presentedEnvironmentSecond) {
      this.presentedEnvironmentSecond = environmentSecond;
      this.mount.dataset.weather = environment.weather;
      this.mount.dataset.daylight = environment.daylight.toFixed(3);
      this.mount.dataset.environmentRisk = environment.risk.toFixed(3);
      useGameStore.getState().setEnvironmentHud({
        weather: environment.weather,
        dayProgress: environment.dayProgress,
        daylight: environment.daylight,
        windDirectionX: environment.windDirectionX,
        windDirectionZ: environment.windDirectionZ,
        windStrength: environment.windStrength,
        risk: environment.risk,
      });
    }
  }

  private updateUnderwaterPresentation(renderTime: number, frameDelta: number): void {
    const waterY = sampleWaveHeight(
      this.camera.position.x,
      this.camera.position.z,
      renderTime,
      this.environment.waveScale,
    );
    const target = getUnderwaterTarget(this.camera.position.y, waterY);
    this.underwaterMix = smoothUnderwaterMix(this.underwaterMix, target, frameDelta);

    const background = this.scene.background;
    if (background instanceof Color) {
      background.lerpColors(this.surfaceColor, this.underwaterColor, this.underwaterMix);
    }
    const fog = this.scene.fog;
    if (fog instanceof FogExp2) {
      fog.color.lerpColors(this.surfaceColor, this.underwaterColor, this.underwaterMix);
      fog.density = this.environmentFogDensity
        + (0.072 - this.environmentFogDensity) * this.underwaterMix;
    }
    this.renderer.toneMappingExposure = this.environmentExposure - this.underwaterMix * 0.28;
    this.audio.setUnderwater(this.underwaterMix);

    if (Math.abs(this.underwaterMix - this.presentedUnderwaterMix) >= 0.008) {
      this.mount.style.setProperty('--underwater-mix', this.underwaterMix.toFixed(3));
      this.presentedUnderwaterMix = this.underwaterMix;
    }
  }

  private readonly onPlayerModeChange = (mode: PlayerLocomotionMode): void => {
    const previousMode = useGameStore.getState().playerMode;
    useGameStore.getState().setPlayerMode(mode);
    this.mount.dataset.playerMode = mode;
    const canUseHook = mode === 'raft'
      && document.pointerLockElement === this.renderer.domElement
      && useGameStore.getState().phase === 'playing';
    this.hook?.setEnabled(canUseHook);

    if (mode === 'swimming' && previousMode !== 'swimming') {
      const waterY = sampleWaveHeight(
        this.camera.position.x,
        this.camera.position.z,
        this.elapsed,
        this.environment.waveScale,
      );
      this.splashPosition.set(this.camera.position.x, waterY + 0.04, this.camera.position.z);
      this.splashes?.spawn(this.splashPosition);
      this.audio.playSplash();
    } else if (mode === 'raft' && previousMode === 'swimming') {
      this.audio.playUi();
    }
  };

  private applyRenderScale(): void {
    const basePixelRatio = Math.min(
      window.devicePixelRatio,
      this.qualityPreset === 'high' ? 1.75 : 1,
    );
    const adaptiveEnabled = useGameStore.getState().dynamicResolutionEnabled;
    const renderScale = adaptiveEnabled ? this.dynamicResolutionState.scale : 1;
    const pixelRatio = Math.max(0.5, basePixelRatio * renderScale);
    if (Math.abs(pixelRatio - this.appliedPixelRatio) >= 0.001) {
      this.renderer.setPixelRatio(pixelRatio);
      this.appliedPixelRatio = pixelRatio;
    }
    this.resize();
  }

  private publishRenderStats(fps: number): void {
    const info = this.renderer.info;
    const adaptiveEnabled = useGameStore.getState().dynamicResolutionEnabled;
    const renderScale = adaptiveEnabled ? this.dynamicResolutionState.scale : 1;
    const stats = {
      renderScale,
      pixelRatio: this.renderer.getPixelRatio(),
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
    };
    this.mount.dataset.renderScale = renderScale.toFixed(2);
    this.mount.dataset.pixelRatio = stats.pixelRatio.toFixed(2);
    this.mount.dataset.drawCalls = String(stats.drawCalls);
    this.mount.dataset.triangles = String(stats.triangles);
    this.mount.dataset.geometries = String(stats.geometries);
    this.mount.dataset.textures = String(stats.textures);
    const store = useGameStore.getState();
    store.setFps(fps);
    store.setRenderStats(stats);
  }

  private readonly resize = (): void => {
    const width = Math.max(1, this.mount.clientWidth);
    const height = Math.max(1, this.mount.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  private setSimulationActive(active: boolean): void {
    const changed = active !== this.simulationActive;
    this.simulationActive = active;
    this.mount.dataset.simulationActive = String(active);
    if (changed) this.fixedStep.resetAccumulator();
  }

  private readonly onPointerLockChange = (): void => {
    const locked = document.pointerLockElement === this.renderer.domElement;
    const playing = useGameStore.getState().phase === 'playing';
    useGameStore.getState().setPointerLocked(locked);
    this.player?.setEnabled(locked && playing);
    this.hook?.setEnabled(locked && playing && this.player?.mode === 'raft');
  };

  private readonly onCanvasClick = (): void => {
    const state = useGameStore.getState();
    if (state.phase === 'playing' && !state.settingsOpen && document.pointerLockElement !== this.renderer.domElement) {
      void this.audio.begin();
      void this.renderer.domElement.requestPointerLock();
    }
  };

  private readonly onWindowBlur = (): void => {
    this.windowFocused = false;
    if (useGameStore.getState().muteOnFocusLoss) this.setAudioFocusMuted(true);
    this.setSimulationActive(false);
    this.pauseInput();
  };

  private readonly onWindowFocus = (): void => {
    this.windowFocused = true;
    this.setAudioFocusMuted(false);
    this.clock.start();
    this.fixedStep.resetAccumulator();
    this.fpsElapsed = 0;
    this.fpsFrames = 0;
  };

  private readonly onVisibilityChange = (): void => {
    this.fixedStep.resetAccumulator();
    if (document.visibilityState !== 'visible') {
      if (useGameStore.getState().muteOnFocusLoss) this.setAudioFocusMuted(true);
      this.setSimulationActive(false);
      this.pauseInput();
      return;
    }
    this.setAudioFocusMuted(false);
    this.clock.start();
    this.fpsElapsed = 0;
    this.fpsFrames = 0;
  };

  private readonly onContextLost = (event: Event): void => {
    event.preventDefault();
    this.pauseInput();
    this.contextLost = true;
    this.setSimulationActive(false);
    console.warn('[Driftwake] WebGL context lost', {
      elapsed: this.elapsed,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
    });
    const store = useGameStore.getState();
    store.setReady(isGameReady({ initialized: this.initialized, contextLost: this.contextLost }));
    store.setLoadingLabel('图形上下文恢复中');
    store.showNotice('图形上下文已暂停');
  };

  private readonly onContextRestored = (): void => {
    this.contextLost = false;
    this.clock.start();
    this.fixedStep.resetAccumulator();
    const store = useGameStore.getState();
    const ready = isGameReady({ initialized: this.initialized, contextLost: this.contextLost });
    store.setReady(ready);
    if (ready) store.setLoadingLabel('海况恢复');
    store.showNotice('图形上下文已恢复');
  };
}
