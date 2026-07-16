import {
  ACESFilmicToneMapping,
  AmbientLight,
  Clock,
  Color,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  MathUtils,
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
import {
  createMaterialLibrary,
  disposeMaterialLibrary,
  loadAssetTextures,
  type AssetTextures,
  type MaterialLibrary,
} from './art/Materials';
import { useGameStore, type AudioMix, type QualityPreset } from '../state/gameStore';
import { TOOL_ORDER } from './domain/items';
import { SAVE_VERSION, createDefaultRaftTiles, loadSave, writeSave, type DriftwakeSave } from './domain/save';
import { createDefaultIslandState } from './domain/island';
import { createDefaultUnderwaterState } from './domain/underwater';
import { createDefaultNavigationState } from './domain/navigation';
import { createDefaultPlantingState } from './domain/planting';
import { AudioSystem } from './systems/AudioSystem';
import { BuildSystem } from './systems/BuildSystem';
import { DebrisField } from './systems/DebrisField';
import { DeviceSystem } from './systems/DeviceSystem';
import { FishingSystem } from './systems/FishingSystem';
import { HookSystem } from './systems/HookSystem';
import { IslandSystem } from './systems/IslandSystem';
import { OceanSystem } from './systems/OceanSystem';
import { PhysicsSystem } from './systems/PhysicsSystem';
import { PlayerController } from './systems/PlayerController';
import { RaftSystem } from './systems/RaftSystem';
import { SharkSystem } from './systems/SharkSystem';
import { SpearSystem } from './systems/SpearSystem';
import { SplashSystem } from './systems/SplashSystem';
import { UnderwaterSystem } from './systems/UnderwaterSystem';
import { NavigationSystem } from './systems/NavigationSystem';
import { PlantingSystem } from './systems/PlantingSystem';

export class DriftwakeGame {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(67, 1, 0.045, 520);
  private readonly renderer: WebGLRenderer;
  private readonly clock = new Clock();
  private readonly audio = new AudioSystem();
  private readonly physics = new PhysicsSystem();
  private textures: AssetTextures | null = null;
  private materials: MaterialLibrary | null = null;
  private ocean: OceanSystem | null = null;
  private raft: RaftSystem | null = null;
  private debris: DebrisField | null = null;
  private player: PlayerController | null = null;
  private hook: HookSystem | null = null;
  private build: BuildSystem | null = null;
  private devices: DeviceSystem | null = null;
  private fishing: FishingSystem | null = null;
  private shark: SharkSystem | null = null;
  private spear: SpearSystem | null = null;
  private splashes: SplashSystem | null = null;
  private island: IslandSystem | null = null;
  private underwater: UnderwaterSystem | null = null;
  private navigation: NavigationSystem | null = null;
  private planting: PlantingSystem | null = null;
  private sky: Sky | null = null;
  private hemisphere: HemisphereLight | null = null;
  private ambient: AmbientLight | null = null;
  private directional: DirectionalLight | null = null;
  private readonly airBackground = new Color('#a9cfd2');
  private readonly waterBackground = new Color('#0b5260');
  private readonly environmentColor = new Color();
  private environmentBlend = 0;
  private elapsed = 0;
  private fpsElapsed = 0;
  private fpsFrames = 0;
  private simulationAccumulator = 0;
  private saveElapsed = 0;
  private unsubscribeStore: (() => void) | null = null;
  private noticeTimer: number | null = null;
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
    this.scene.background = new Color('#a9cfd2');
    this.scene.fog = new FogExp2(0xa9cfd2, 0.0065);
    this.setQuality(useGameStore.getState().quality);
    this.resize();

    window.addEventListener('resize', this.resize);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('beforeunload', this.onBeforeUnload);
    this.renderer.domElement.addEventListener('click', this.onCanvasClick);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
  }

  async initialize(): Promise<void> {
    const store = useGameStore.getState();
    try {
      store.setLoadingLabel('正在调校光线');
      this.setupLightingAndSky();
      const save = loadSave();
      if (save) store.hydratePlayer(save.player);
      this.textures = await loadAssetTextures(this.renderer);
      if (this.disposed) return;

      store.setLoadingLabel('正在系紧木筏');
      this.materials = createMaterialLibrary(this.textures);
      this.ocean = new OceanSystem(this.textures.foam);
      this.ocean.setQuality(store.quality === 'high');
      this.raft = new RaftSystem(this.materials, save?.raft.tiles ?? createDefaultRaftTiles());
      this.scene.add(this.ocean.mesh, this.raft.group);

      store.setLoadingLabel('正在放流物资');
      this.debris = new DebrisField(this.scene, this.materials, store.quality === 'high' ? 30 : 18);
      this.splashes = new SplashSystem(this.scene);
      const islandState = save?.world.island ?? createDefaultIslandState();
      this.island = new IslandSystem(
        this.scene,
        this.camera,
        this.renderer,
        this.materials,
        this.audio,
        this.splashes,
        islandState,
      );
      this.player = new PlayerController(
        this.camera,
        this.raft,
        save?.player.navigation,
        (surface) => this.audio.playFootstep(surface),
      );
      this.island.setPlayer(this.player);
      this.underwater = new UnderwaterSystem(
        this.scene,
        this.camera,
        this.renderer,
        this.materials,
        this.audio,
        this.splashes,
        this.island,
        this.player,
        save?.world.underwater ?? createDefaultUnderwaterState(islandState.seed, islandState.cycle),
      );
      this.player.setIslandNavigation({
        sampleGroundHeight: (x, z) => this.island?.sampleGroundHeight(x, z) ?? null,
        sampleWaterFloorHeight: (x, z) => this.underwater?.sampleWaterFloorHeight(x, z) ?? null,
        resolveCollision: (position, previous) => this.island?.resolvePlayerCollision(position, previous),
        resolveWaterCollision: (position, previous) => this.underwater?.resolvePlayerCollision(position, previous),
        onSurfaceChange: (surface) => {
          this.island?.onPlayerSurfaceChange(surface);
          this.underwater?.onPlayerSurfaceChange(surface);
          this.syncEquipment();
        },
      });
      this.hook = new HookSystem(
        this.renderer,
        this.camera,
        this.scene,
        this.materials,
        this.debris,
        this.audio,
        this.splashes,
      );
      this.devices = new DeviceSystem(
        this.renderer,
        this.camera,
        this.materials,
        this.raft,
        this.player,
        this.audio,
        this.splashes,
        save?.raft.devices ?? [],
        (coordinate) =>
          (this.navigation?.hasDeviceAt(coordinate) ?? false) ||
          (this.planting?.hasDeviceAt(coordinate) ?? false),
      );
      this.navigation = new NavigationSystem(
        this.renderer,
        this.camera,
        this.materials,
        this.raft,
        this.player,
        this.island,
        this.audio,
        this.splashes,
        save?.raft.navigation ?? createDefaultNavigationState(),
        (coordinate) =>
          (this.devices?.hasDeviceAt(coordinate) ?? false) ||
          (this.planting?.hasDeviceAt(coordinate) ?? false),
      );
      this.planting = new PlantingSystem(
        this.renderer,
        this.camera,
        this.materials,
        this.raft,
        this.player,
        this.audio,
        this.splashes,
        save?.raft.planting ?? createDefaultPlantingState(),
        (coordinate) =>
          (this.devices?.hasDeviceAt(coordinate) ?? false) ||
          (this.navigation?.hasDeviceAt(coordinate) ?? false),
      );
      this.island.setNavigationProvider(() =>
        this.navigation?.getIslandTravel() ?? { approachRate: 0.55, dockDriftRate: 1, anchored: false },
      );
      this.player.setCollisionResolver((position, previous) => {
        this.devices?.resolvePlayerCollision(position, previous);
        this.navigation?.resolvePlayerCollision(position, previous);
        this.planting?.resolvePlayerCollision(position, previous);
      });
      this.build = new BuildSystem(
        this.renderer,
        this.camera,
        this.materials,
        this.raft,
        this.audio,
        this.splashes,
        (coordinate) =>
          (this.devices?.hasDeviceAt(coordinate) ?? false) ||
          (this.navigation?.hasDeviceAt(coordinate) ?? false) ||
          (this.planting?.hasDeviceAt(coordinate) ?? false),
        (coordinate) =>
          (this.devices?.dismantleAt(coordinate) ?? false) ||
          (this.navigation?.dismantleAt(coordinate) ?? false) ||
          (this.planting?.dismantleAt(coordinate) ?? false),
      );
      this.fishing = new FishingSystem(
        this.renderer,
        this.camera,
        this.scene,
        this.materials,
        this.audio,
        this.splashes,
      );
      this.shark = new SharkSystem(
        this.scene,
        this.raft,
        this.player,
        this.materials,
        this.audio,
        this.splashes,
        (strength) => this.player?.addCameraShake(strength),
      );
      this.spear = new SpearSystem(
        this.renderer,
        this.camera,
        this.materials,
        this.audio,
        () => this.shark?.receiveSpearStrike(this.camera) ?? false,
      );
      store.setRaft(this.raft.getIntegrityStats());
      this.unsubscribeStore = useGameStore.subscribe((state, previous) => {
        if (
          state.selectedTool !== previous.selectedTool ||
          state.pointerLocked !== previous.pointerLocked ||
          state.overlayPanel !== previous.overlayPanel ||
          state.settingsOpen !== previous.settingsOpen ||
          state.phase !== previous.phase ||
          state.placementDevice !== previous.placementDevice
        ) {
          if (state.selectedTool !== previous.selectedTool) this.audio.playEquip();
          this.syncEquipment();
        }
      });
      this.syncEquipment();

      store.setLoadingLabel('正在建立物理世界');
      await this.physics.initialize();
      if (this.disposed) return;

      this.clock.start();
      this.renderer.setAnimationLoop(this.update);
      store.setReady(true);
      store.setLoadingLabel('海况稳定');
    } catch (error) {
      console.error('Failed to initialize Driftwake', error);
      store.setLoadingLabel('初始化失败');
      throw error;
    }
  }

  begin(): void {
    if (!useGameStore.getState().ready) return;
    useGameStore.getState().setOverlayPanel(null);
    useGameStore.getState().setSettingsOpen(false);
    this.audio.setMix(useGameStore.getState().audioMix);
    this.audio.setEnabled(useGameStore.getState().audioEnabled);
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

  setAudioMix(mix: AudioMix): void {
    this.audio.setMix(mix);
  }

  setQuality(quality: QualityPreset): void {
    const highQuality = quality === 'high';
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, highQuality ? 1.75 : 1.0));
    this.renderer.shadowMap.enabled = highQuality;
    this.ocean?.setQuality(highQuality);
    this.resize();
  }

  playUi(success = true): void {
    if (success) this.audio.playUi();
    else this.audio.playDenied();
  }

  playConsume(): void {
    this.audio.playCollect();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('beforeunload', this.onBeforeUnload);
    this.renderer.domElement.removeEventListener('click', this.onCanvasClick);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
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
    this.player?.dispose();
    this.hook?.dispose(this.scene);
    this.build?.dispose();
    this.navigation?.dispose();
    this.planting?.dispose();
    this.devices?.dispose();
    this.fishing?.dispose(this.scene);
    this.spear?.dispose();
    this.shark?.dispose();
    this.underwater?.dispose();
    this.island?.dispose();
    this.splashes?.dispose();
    this.debris?.dispose(this.scene);
    this.ocean?.dispose();
    this.physics.dispose();
    this.audio.dispose();
    this.unsubscribeStore?.();
    this.unsubscribeStore = null;
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);

    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    textures.forEach((texture) => texture.dispose());
    if (this.materials) disposeMaterialLibrary(this.materials);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private setupLightingAndSky(): void {
    const sky = new Sky();
    sky.scale.setScalar(450);
    const uniforms = sky.material.uniforms;
    uniforms.turbidity.value = 6.8;
    uniforms.rayleigh.value = 2.25;
    uniforms.mieCoefficient.value = 0.006;
    uniforms.mieDirectionalG.value = 0.82;
    const sun = new Vector3(0.56, 0.72, 0.4).normalize();
    uniforms.sunPosition.value.copy(sun);
    this.scene.add(sky);
    this.sky = sky;

    const hemisphere = new HemisphereLight(0xc7e9f0, 0x5f4937, 1.85);
    const ambient = new AmbientLight(0x91b8bd, 0.36);
    const directional = new DirectionalLight(0xffe1b1, 3.1);
    directional.position.copy(sun).multiplyScalar(70);
    directional.castShadow = true;
    directional.shadow.mapSize.set(1536, 1536);
    directional.shadow.camera.left = -12;
    directional.shadow.camera.right = 12;
    directional.shadow.camera.top = 12;
    directional.shadow.camera.bottom = -12;
    directional.shadow.camera.near = 1;
    directional.shadow.camera.far = 130;
    directional.shadow.bias = -0.00018;
    this.scene.add(hemisphere, ambient, directional);
    this.hemisphere = hemisphere;
    this.ambient = ambient;
    this.directional = directional;
  }

  private readonly update = (): void => {
    if (this.disposed) return;
    const delta = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += delta;
    const state = useGameStore.getState();
    if (state.phase === 'title') return;
    const simulationActive =
      state.phase === 'playing' && state.pointerLocked && !state.settingsOpen && state.overlayPanel === null;
    const simulationDelta = simulationActive ? delta : 0;
    this.raft?.update(this.elapsed, delta);
    this.player?.update(simulationDelta);
    this.ocean?.update(this.elapsed);
    this.debris?.update(this.elapsed, delta);
    this.hook?.update(this.elapsed, simulationDelta);
    this.build?.update(this.elapsed, simulationDelta);
    this.fishing?.update(this.elapsed, simulationDelta);
    this.spear?.update(this.elapsed, simulationDelta);
    if (simulationActive) this.shark?.update(this.elapsed, simulationDelta);
    this.devices?.update(this.elapsed, simulationDelta);
    this.navigation?.update(this.elapsed, simulationDelta);
    this.planting?.update(this.elapsed, simulationDelta);
    this.island?.update(this.elapsed, simulationDelta);
    this.underwater?.update(this.elapsed, simulationDelta);
    this.splashes?.update(delta);
    this.audio.update(this.elapsed);
    this.physics.step(simulationDelta);
    this.updateEnvironment(delta);

    if (simulationActive) {
      this.simulationAccumulator += simulationDelta;
      while (this.simulationAccumulator >= 1) {
        useGameStore.getState().tickSurvival(1, this.player?.isSubmerged() ?? false);
        useGameStore.getState().advancePlayTime(1);
        this.simulationAccumulator -= 1;
      }
    }
    this.saveElapsed += delta;
    if (this.saveElapsed >= 12) {
      this.saveElapsed = 0;
      this.saveNow();
    }

    this.fpsElapsed += delta;
    this.fpsFrames += 1;
    if (this.fpsElapsed >= 0.75) {
      useGameStore.getState().setFps(Math.round(this.fpsFrames / this.fpsElapsed));
      this.fpsElapsed = 0;
      this.fpsFrames = 0;
    }
    this.renderer.render(this.scene, this.camera);
  };

  private readonly resize = (): void => {
    const width = Math.max(1, this.mount.clientWidth);
    const height = Math.max(1, this.mount.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  private readonly onPointerLockChange = (): void => {
    const locked = document.pointerLockElement === this.renderer.domElement;
    const playing = useGameStore.getState().phase === 'playing';
    useGameStore.getState().setPointerLocked(locked);
    this.player?.setEnabled(locked && playing);
    this.syncEquipment();
  };

  private readonly onCanvasClick = (): void => {
    const state = useGameStore.getState();
    if (state.phase === 'playing' && !state.settingsOpen && document.pointerLockElement !== this.renderer.domElement) {
      void this.audio.begin();
      void this.renderer.domElement.requestPointerLock();
    }
  };

  private readonly onContextLost = (event: Event): void => {
    event.preventDefault();
    console.warn('[Driftwake] WebGL context lost', {
      elapsed: this.elapsed,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
    });
    useGameStore.getState().showNotice('图形上下文已暂停');
  };

  private syncEquipment(): void {
    const state = useGameStore.getState();
    const inputEnabled =
      state.phase === 'playing' && state.pointerLocked && !state.settingsOpen && state.overlayPanel === null;
    const placingDevice = state.placementDevice !== null;
    const onRaft = this.player?.isOnRaft() ?? true;
    const surface = this.player?.getSurface() ?? 'raft';
    const inWater = surface === 'water';
    const onIsland = surface === 'island';
    const survivalDevicePlacement =
      state.placementDevice === 'purifier' || state.placementDevice === 'grill' ? state.placementDevice : null;
    const navigationPlacement =
      state.placementDevice === 'sail' || state.placementDevice === 'anchor' ? state.placementDevice : null;
    const plantingPlacement = state.placementDevice === 'planter' ? 'planter' : null;
    this.devices?.setPlacementType(survivalDevicePlacement);
    this.devices?.setInputEnabled(inputEnabled && onRaft);
    this.navigation?.setPlacementType(navigationPlacement);
    this.navigation?.setInputEnabled(inputEnabled && onRaft);
    this.planting?.setPlacementType(plantingPlacement);
    this.planting?.setInputEnabled(inputEnabled && onRaft);
    this.hook?.setEquipped(onRaft && !placingDevice && state.selectedTool === 'hook');
    this.hook?.setEnabled(inputEnabled && onRaft && !placingDevice && state.selectedTool === 'hook');
    this.underwater?.setHookEquipped(inWater && !placingDevice && state.selectedTool === 'hook');
    this.build?.setEquipped(onRaft && !placingDevice && state.selectedTool === 'hammer');
    this.build?.setInputEnabled(inputEnabled && onRaft && !placingDevice && state.selectedTool === 'hammer');
    this.fishing?.setEquipped(onRaft && !placingDevice && state.selectedTool === 'fishingRod');
    this.fishing?.setInputEnabled(inputEnabled && onRaft && !placingDevice && state.selectedTool === 'fishingRod');
    this.spear?.setEquipped((onRaft || inWater) && !placingDevice && state.selectedTool === 'spear');
    this.spear?.setInputEnabled(inputEnabled && (onRaft || inWater) && !placingDevice && state.selectedTool === 'spear');
    this.island?.setAxeEquipped(onIsland && !placingDevice && state.selectedTool === 'axe');
    this.island?.setInputEnabled(inputEnabled);
    this.underwater?.setInputEnabled(inputEnabled);
    this.player?.setEnabled(inputEnabled);
  }

  private saveNow(): void {
    if (!this.raft || !useGameStore.getState().ready) return;
    const islandState = this.island?.getSavedState() ?? createDefaultIslandState();
    const save: DriftwakeSave = {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      player: {
        ...useGameStore.getState().getPlayerSnapshot(),
        navigation: this.player?.getSavedNavigation() ?? { surface: 'raft', x: 0, z: 1.08 },
      },
      raft: {
        tiles: this.raft.getSavedTiles(),
        devices: this.devices?.getSavedDevices() ?? [],
        navigation: this.navigation?.getSavedState() ?? createDefaultNavigationState(),
        planting: this.planting?.getSavedState() ?? createDefaultPlantingState(),
      },
      world: {
        island: islandState,
        underwater:
          this.underwater?.getSavedState() ??
          createDefaultUnderwaterState(islandState.seed, islandState.cycle),
      },
    };
    useGameStore.getState().setSaveStatus(writeSave(save) ? 'saved' : 'error');
  }

  private readonly onBeforeUnload = (): void => {
    this.saveNow();
  };

  private updateEnvironment(delta: number): void {
    const target = this.player?.isSubmerged()
      ? MathUtils.clamp(0.62 + (this.player?.getDepth() ?? 0) * 0.1, 0, 1)
      : 0;
    const shouldRenderShadows = useGameStore.getState().quality === 'high' && target === 0;
    if (this.renderer.shadowMap.enabled !== shouldRenderShadows) this.renderer.shadowMap.enabled = shouldRenderShadows;
    if (target > 0 && this.environmentBlend < 0.78) this.environmentBlend = 0.78;
    this.environmentBlend = MathUtils.damp(this.environmentBlend, target, target > 0 ? 3.8 : 2.6, delta);
    this.environmentColor.copy(this.airBackground).lerp(this.waterBackground, this.environmentBlend);
    if (this.scene.background instanceof Color) this.scene.background.copy(this.environmentColor);
    if (this.scene.fog instanceof FogExp2) {
      this.scene.fog.color.copy(this.environmentColor);
      this.scene.fog.density = MathUtils.lerp(0.0065, 0.072, this.environmentBlend);
    }
    this.renderer.toneMappingExposure = MathUtils.lerp(1.08, 0.79, this.environmentBlend);
    if (this.hemisphere) this.hemisphere.intensity = MathUtils.lerp(1.85, 0.82, this.environmentBlend);
    if (this.ambient) this.ambient.intensity = MathUtils.lerp(0.36, 0.7, this.environmentBlend);
    if (this.directional) this.directional.intensity = MathUtils.lerp(3.1, 0.58, this.environmentBlend);
    if (this.sky) this.sky.visible = target === 0;
    this.ocean?.setUnderwater(this.environmentBlend);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const state = useGameStore.getState();
    if (state.phase !== 'playing') return;
    if (event.code === 'Tab' || event.code === 'KeyI' || event.code === 'KeyC') {
      event.preventDefault();
      const requested = event.code === 'KeyC' ? 'crafting' : 'pack';
      const nextPanel = state.overlayPanel === requested ? null : requested;
      if (nextPanel !== null) state.setPlacementDevice(null);
      state.setOverlayPanel(nextPanel);
      if (nextPanel !== null && document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
      this.audio.playUi();
      return;
    }
    const digit = /^Digit([1-5])$/.exec(event.code);
    if (digit && state.overlayPanel === null && !state.settingsOpen && state.placementDevice === null) {
      const tool = TOOL_ORDER[Number(digit[1]) - 1];
      if (!state.setSelectedTool(tool)) {
        this.audio.playDenied();
        this.showTransientNotice('需要先制作该工具');
      }
    }
  };

  private showTransientNotice(message: string): void {
    useGameStore.getState().showNotice(message);
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => {
      if (useGameStore.getState().notice === message) useGameStore.getState().showNotice(null);
    }, 1500);
  }
}
