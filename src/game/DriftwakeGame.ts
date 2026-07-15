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
import { DebrisField } from './systems/DebrisField';
import { HookSystem } from './systems/HookSystem';
import { OceanSystem } from './systems/OceanSystem';
import { PhysicsSystem } from './systems/PhysicsSystem';
import { PlayerController } from './systems/PlayerController';
import { RaftSystem } from './systems/RaftSystem';
import { SplashSystem } from './systems/SplashSystem';
import { sampleWaveHeight } from './math/waves';

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
  private splashes: SplashSystem | null = null;
  private island: Group | null = null;
  private elapsed = 0;
  private fpsElapsed = 0;
  private fpsFrames = 0;
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
    this.renderer.domElement.addEventListener('click', this.onCanvasClick);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
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
      this.player = new PlayerController(this.camera, this.raft);
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

  setQuality(quality: QualityPreset): void {
    const highQuality = quality === 'high';
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, highQuality ? 1.75 : 1.0));
    this.renderer.shadowMap.enabled = highQuality;
    this.ocean?.setQuality(highQuality);
    this.resize();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.renderer.domElement.removeEventListener('click', this.onCanvasClick);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.player?.dispose();
    this.hook?.dispose(this.scene);
    this.splashes?.dispose();
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
  }

  private readonly update = (): void => {
    if (this.disposed) return;
    const delta = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += delta;
    this.raft?.update(this.elapsed, delta);
    this.player?.update(delta);
    this.ocean?.update(this.elapsed);
    this.debris?.update(this.elapsed, delta);
    this.hook?.update(this.elapsed, delta);
    this.splashes?.update(delta);
    this.audio.update(this.elapsed);
    this.physics.step(delta);

    if (this.island) {
      this.island.position.y = -0.28 + sampleWaveHeight(-18, -78, this.elapsed) * 0.12;
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
    this.hook?.setEnabled(locked && playing);
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
}
