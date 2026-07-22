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
  Quaternion,
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
import { ITEM_DEFINITIONS, itemCount, preferredToolOrder, type ItemId, type ToolId } from './domain/items';
import { TOOL_MAX_DURABILITY } from './domain/toolDurability';
import type { DeviceType } from './domain/devices';
import { SAVE_VERSION, createDefaultRaftTiles, type DriftwakeSave } from './domain/save';
import {
  getActiveSaveSlot,
  loadSaveSlot,
  writeSaveSlot,
  type SaveSlotId,
} from './domain/saveRepository';
import { createDefaultIslandState } from './domain/island';
import { createDefaultUnderwaterState } from './domain/underwater';
import { createDefaultNavigationState, type SignalTargetId } from './domain/navigation';
import { createDefaultPlantingState } from './domain/planting';
import { createDefaultProgressionState, type ProgressionDeviceType } from './domain/progression';
import { createDefaultSharkState } from './domain/shark';
import type { FailureRecord } from './domain/failure';
import type { CameraMotionMode } from './domain/settings';
import {
  structurePlacementKey,
  type RaftBuildCategory,
  type RaftBuildPiece,
} from './domain/raftStructures';
import { AudioSystem } from './systems/AudioSystem';
import { BuildSystem, type HammerAction } from './systems/BuildSystem';
import { CollectionNetSystem } from './systems/CollectionNetSystem';
import { DebrisField } from './systems/DebrisField';
import { DeviceSystem } from './systems/DeviceSystem';
import { FishingSystem } from './systems/FishingSystem';
import { HookSystem } from './systems/HookSystem';
import { IslandSystem } from './systems/IslandSystem';
import { OceanSystem } from './systems/OceanSystem';
import { PhysicsSystem } from './systems/PhysicsSystem';
import { PlayerController } from './systems/PlayerController';
import { RAFT_TILE_X, RAFT_TILE_Z, RaftSystem } from './systems/RaftSystem';
import { RaftStructureSystem } from './systems/RaftStructureSystem';
import { SalvageSystem } from './systems/SalvageSystem';
import { SharkSystem } from './systems/SharkSystem';
import { SpearSystem } from './systems/SpearSystem';
import { ResonanceForkSystem, type ResonancePulseSettlement } from './systems/ResonanceForkSystem';
import { SplashSystem } from './systems/SplashSystem';
import { StructureCollapseSystem } from './systems/StructureCollapseSystem';
import { UnderwaterSystem } from './systems/UnderwaterSystem';
import { NavigationSystem } from './systems/NavigationSystem';
import { PlantingSystem } from './systems/PlantingSystem';
import { ProgressionSystem } from './systems/ProgressionSystem';
import { StormSystem } from './systems/StormSystem';
import { FixedStepScheduler, isSimulationActive, shouldRenderPresentation } from './runtime/runtime';
import {
  createDynamicResolutionState,
  stepDynamicResolution,
  summarizeFrameTimes,
  type DynamicResolutionPolicy,
  type DynamicResolutionState,
} from './runtime/dynamicResolution';
import { sampleDayCycle, sampleEnvironmentLighting } from './environment/environment';
import { sampleWaveHeight } from './math/waves';
import { RECIPES } from './domain/recipes';
import {
  craftingOutputBlockReason,
  recipeCraftSeconds,
  type CraftingOutputBlockReason,
} from './domain/craftingQueue';
import {
  survivalBand,
  survivalNeedRunwaySeconds,
  type SurvivalBand,
  type SurvivalState,
} from './domain/survival';

const CRAFTING_TICK_SECONDS = 0.1;
type ToolWearAction = HammerAction | 'spear-hit' | 'resonance-pulse' | 'fishing-catch' | 'axe-hit';

const TOOL_BREAK_CONTEXT: Record<ToolWearAction, string> = {
  build: '本次扩建已完成',
  repair: '本次修补已完成',
  replace: '本次替换已完成',
  dismantle: '本次拆除已完成',
  'spear-hit': '本次刺击仍然命中',
  'resonance-pulse': '本次脉冲仍然完成',
  'fishing-catch': '渔获已收入背包',
  'axe-hit': '本次砍击仍然生效',
};
const SURVIVAL_BAND_SEVERITY: Record<SurvivalBand, number> = {
  stable: 0,
  low: 1,
  critical: 2,
  depleted: 3,
};

const DYNAMIC_RESOLUTION_POLICIES: Record<QualityPreset, DynamicResolutionPolicy> = {
  high: {
    minimumScale: 0.6,
    maximumScale: 1,
    decreaseStep: 0.1,
    increaseStep: 0.05,
    slowP95FrameMs: 20,
    healthyMedianFrameMs: 17.5,
    healthyP95FrameMs: 19,
    decreaseAfterSeconds: 1.5,
    increaseAfterSeconds: 7,
    cooldownSeconds: 2,
  },
  low: {
    minimumScale: 0.7,
    maximumScale: 1,
    decreaseStep: 0.1,
    increaseStep: 0.05,
    slowP95FrameMs: 36,
    healthyMedianFrameMs: 30,
    healthyP95FrameMs: 34,
    decreaseAfterSeconds: 1.5,
    increaseAfterSeconds: 6,
    cooldownSeconds: 2,
  },
};

export class DriftwakeGame {
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(67, 1, 0.045, 520);
  private readonly renderer: WebGLRenderer;
  private readonly clock = new Clock();
  private readonly fixedStep = new FixedStepScheduler();
  private readonly audio = new AudioSystem();
  private readonly physics = new PhysicsSystem();
  private textures: AssetTextures | null = null;
  private materials: MaterialLibrary | null = null;
  private ocean: OceanSystem | null = null;
  private raft: RaftSystem | null = null;
  private structures: RaftStructureSystem | null = null;
  private debris: DebrisField | null = null;
  private player: PlayerController | null = null;
  private hook: HookSystem | null = null;
  private collectionNets: CollectionNetSystem | null = null;
  private salvage: SalvageSystem | null = null;
  private build: BuildSystem | null = null;
  private devices: DeviceSystem | null = null;
  private fishing: FishingSystem | null = null;
  private shark: SharkSystem | null = null;
  private spear: SpearSystem | null = null;
  private resonanceFork: ResonanceForkSystem | null = null;
  private splashes: SplashSystem | null = null;
  private structureCollapses: StructureCollapseSystem | null = null;
  private island: IslandSystem | null = null;
  private underwater: UnderwaterSystem | null = null;
  private navigation: NavigationSystem | null = null;
  private planting: PlantingSystem | null = null;
  private progression: ProgressionSystem | null = null;
  private storm: StormSystem | null = null;
  private sky: Sky | null = null;
  private hemisphere: HemisphereLight | null = null;
  private ambient: AmbientLight | null = null;
  private directional: DirectionalLight | null = null;
  private readonly airBackground = new Color('#a9cfd2');
  private readonly nightBackground = new Color('#071323');
  private readonly stormBackground = new Color('#516f72');
  private readonly surfaceBackground = new Color();
  private readonly waterBackground = new Color('#0b5260');
  private readonly nightWaterBackground = new Color('#062d3a');
  private readonly dayKeyColor = new Color('#ffe1b1');
  private readonly nightKeyColor = new Color('#8bb8d4');
  private readonly sunPosition = new Vector3(0.56, 0.72, 0.4).normalize();
  private readonly keyLightPosition = new Vector3();
  private readonly environmentColor = new Color();
  private readonly audioPosition = new Vector3();
  private readonly audioForward = new Vector3();
  private readonly audioUp = new Vector3();
  private readonly audioQuaternion = new Quaternion();
  private readonly failureDropLocal = new Vector3();
  private readonly failureDropWorld = new Vector3();
  private readonly playerDiagnosticWorld = new Vector3();
  private environmentBlend = 0;
  private stormBlend = 0;
  private elapsed = 0;
  private frameTimingElapsed = 0;
  private readonly frameTimesMs: number[] = [];
  private dynamicResolutionState: DynamicResolutionState = createDynamicResolutionState();
  private qualityPreset: QualityPreset = 'high';
  private appliedPixelRatio = -1;
  private simulationActive = false;
  private currentStormIntensity = 0;
  private currentGust = 0;
  private currentLightning = 0;
  private simulationAccumulator = 0;
  private craftingAccumulator = 0;
  private craftingCompletedCount = 0;
  private toolWearEventCount = 0;
  private lastCraftingBlockReason: CraftingOutputBlockReason | null = null;
  private readonly lastSurvivalBands: Record<'thirst' | 'hunger', SurvivalBand> = {
    thirst: 'stable',
    hunger: 'stable',
  };
  private saveElapsed = 0;
  private simulationTickCount = 0;
  private unsubscribeStore: (() => void) | null = null;
  private noticeTimer: number | null = null;
  private windowFocused = document.hasFocus();
  private initialized = false;
  private contextLost = false;
  private disposed = false;
  private lastNativeFrameAt = performance.now();
  private lastPausedRenderCompletedAt = Number.NEGATIVE_INFINITY;
  private frameWatchdog: number | null = null;
  private pointerLockTimer: number | null = null;

  constructor(
    private readonly mount: HTMLElement,
    private readonly saveSlot: SaveSlotId = getActiveSaveSlot(),
  ) {
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
    this.mount.dataset.simulationActive = 'false';
    this.mount.dataset.contextHealthy = 'true';
    this.mount.dataset.saveSlot = this.saveSlot;
    this.mount.dataset.saveLoadSource = 'empty';
    this.mount.dataset.saveRecovered = 'false';
    this.mount.dataset.raftTileCount = '0';
    this.mount.dataset.hookState = 'uninitialized';
    this.mount.dataset.hookHeldVisible = 'false';
    this.mount.dataset.hookHandsVisible = 'false';
    this.mount.dataset.hookProjectileVisible = 'false';
    this.mount.dataset.hookRopeVisible = 'false';
    this.mount.dataset.hookRopeTension = '0';
    this.mount.dataset.hookRopeSag = '0';
    this.mount.dataset.salvageFocus = 'none';
    this.mount.dataset.worldDropCount = '0';
    this.mount.dataset.collectionNetCount = '0';
    this.mount.dataset.collectionNetStored = '0';
    this.mount.dataset.collectionNetFocused = 'none';
    this.mount.dataset.collectionNetPlacement = 'none';
    this.mount.dataset.collectionNetPlacementValid = 'false';
    this.mount.dataset.collectionNetCaptures = '0';
    this.mount.dataset.collectionNetDamageCount = '0';
    this.mount.dataset.collectionNetFirstHealth = '0';
    this.mount.dataset.collectionNetAim = '{}';
    this.mount.dataset.collectionNetMount = 'none';
    this.mount.dataset.collectionNetNearestDrift = 'none';
    this.mount.dataset.failureCause = 'none';
    this.mount.dataset.failureDropPending = 'false';
    this.mount.dataset.failureDropCount = '0';
    this.mount.dataset.sailAttachment = 'missing';
    this.mount.dataset.islandRaftClearance = '0';
    this.mount.dataset.craftingQueueLength = '0';
    this.mount.dataset.craftingActive = 'none';
    this.mount.dataset.craftingProgress = '0';
    this.mount.dataset.craftingBlocked = 'none';
    this.mount.dataset.craftingCompletedCount = '0';
    this.mount.dataset.survivalThirstBand = 'stable';
    this.mount.dataset.survivalHungerBand = 'stable';
    this.mount.dataset.thirstRunwaySeconds = '0';
    this.mount.dataset.hungerRunwaySeconds = '0';
    this.mount.dataset.toolDurability = '{}';
    this.mount.dataset.toolWearEventCount = '0';
    this.mount.dataset.lastToolWear = 'none';
    this.mount.dataset.fishingPhase = 'idle';
    this.mount.dataset.fishingTension = '0';
    this.mount.dataset.fishingProgress = '0';
    this.mount.dataset.fishingPull = '0';
    this.mount.dataset.fishingSpecies = 'none';
    this.mount.dataset.fishingSize = 'none';
    this.mount.dataset.fishingWeightKg = '0';
    this.mount.dataset.fishingPortions = '0';
    this.mount.dataset.fishingVisibleModels = '0';
    this.mount.dataset.fishingModelName = 'none';
    this.mount.dataset.fishingModelScale = '0';
    this.mount.dataset.fishingMaterialMaps = 'none';
    this.mount.dataset.fishingPhaseTime = '0';
    this.mount.dataset.cookingBasePhase = 'none';
    this.mount.dataset.cookingBaseFoodStage = 'none';
    this.mount.dataset.cookingBaseMaterialMaps = 'none';
    this.mount.dataset.cookingPurifierMaterialMaps = 'none';
    this.mount.dataset.cookingTriplePhases = 'none';
    this.mount.dataset.cookingTripleFoodStages = 'none';
    this.mount.dataset.cookingTripleFuelSeconds = '0';
    this.mount.dataset.cookingTripleMaterialMaps = 'none';
    this.mount.dataset.cookingRawFish = '0';
    this.mount.dataset.cookingCookedFish = '0';
    this.mount.dataset.cookingBurntFish = '0';
    this.mount.dataset.cookingTimber = '0';
    this.mount.dataset.buildMode = 'hidden';
    this.mount.dataset.buildTarget = 'none';
    this.mount.dataset.buildHovered = 'none';
    this.mount.dataset.axeAim = '{}';
    this.mount.dataset.resonancePhase = 'idle';
    this.mount.dataset.resonanceCharge = '0';
    this.mount.dataset.resonanceLocked = 'false';
    this.mount.dataset.resonancePulseCount = '0';
    this.mount.dataset.resonanceMissCount = '0';
    this.mount.dataset.resonanceCancelledCount = '0';
    this.audio.setMix(useGameStore.getState().audioMix);
    this.syncAudioFocusMuted();
    this.setQuality(useGameStore.getState().quality);
    this.setDynamicResolutionEnabled(useGameStore.getState().dynamicResolutionEnabled);
    this.resize();

    window.addEventListener('resize', this.resize);
    window.addEventListener('blur', this.onWindowBlur);
    window.addEventListener('focus', this.onWindowFocus);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('pointerlockerror', this.onPointerLockError);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('beforeunload', this.onBeforeUnload);
    window.addEventListener('pagehide', this.onPageHide);
    this.renderer.domElement.addEventListener('click', this.onCanvasClick);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored);
  }

  async initialize(): Promise<void> {
    const store = useGameStore.getState();
    try {
      store.resetSession();
      store.setLoadingLabel('正在调校光线');
      this.setupLightingAndSky();
      const loaded = loadSaveSlot(this.saveSlot);
      const save = loaded.save;
      this.mount.dataset.saveLoadSource = loaded.source;
      this.mount.dataset.saveRecovered = String(loaded.recovered);
      if (save) store.hydratePlayer(save.player);
      this.textures = await loadAssetTextures(this.renderer);
      if (this.disposed) return;

      store.setLoadingLabel('正在系紧木筏');
      this.materials = createMaterialLibrary(this.textures);
      this.ocean = new OceanSystem(this.textures.foam);
      this.ocean.setQuality(store.quality === 'high');
      this.storm = new StormSystem(
        this.scene,
        this.camera,
        this.textures.stormClouds,
        (strength) => this.audio.playThunder(strength),
      );
      this.storm.setQuality(store.quality === 'high');
      this.raft = new RaftSystem(this.materials, save?.raft.tiles ?? createDefaultRaftTiles());
      this.structures = new RaftStructureSystem(
        this.raft,
        this.materials,
        save?.raft.structures ?? [],
        (open) => {
          this.audio.playDoor(open);
          this.saveNow();
        },
      );
      this.scene.add(this.ocean.mesh, this.raft.group);

      store.setLoadingLabel('正在放流物资');
      this.debris = new DebrisField(this.scene, this.materials, 30, save?.world.drops ?? []);
      this.setQuality(store.quality);
      this.splashes = new SplashSystem(this.scene);
      this.structureCollapses = new StructureCollapseSystem(
        this.scene,
        this.raft,
        this.structures,
        this.materials,
        this.splashes,
        this.audio,
        (strength) => this.player?.addCameraShake(strength),
      );
      this.salvage = new SalvageSystem(
        this.scene,
        this.camera,
        this.debris,
        this.audio,
        this.splashes,
      );
      const islandState = save?.world.island ?? createDefaultIslandState();
      this.island = new IslandSystem(
        this.scene,
        this.camera,
        this.renderer,
        this.materials,
        this.raft,
        this.audio,
        this.splashes,
        islandState,
        (upgraded) => this.applyToolWear(upgraded ? 'metalAxe' : 'axe', 'axe-hit'),
      );
      this.player = new PlayerController(
        this.camera,
        this.raft,
        this.physics,
        save?.player.navigation,
        (surface) => this.audio.playFootstep(surface),
      );
      this.player.setRaftSurfaceSampler((position) => this.structures?.getWalkableSurfaces(position) ?? []);
      this.player.setRaftOverheadSampler((position) => this.structures?.getOverheadSurfaces(position) ?? []);
      this.player.setCeilingHitHandler(({ surface, position }) => {
        const fibrous = surface.type === 'roof';
        this.audio.playCeilingBump(fibrous);
        this.splashes?.spawnCeilingDust(position, fibrous);
      });
      this.setCameraMotionMode(useGameStore.getState().cameraMotionMode);
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
      this.collectionNets = new CollectionNetSystem(
        this.renderer,
        this.camera,
        this.materials,
        this.raft,
        this.debris,
        this.audio,
        this.splashes,
        save?.raft.collectionNets ?? [],
        () => this.saveNow(),
        (action) => this.applyToolWear('hammer', action),
        () => new Set(
          (this.structures?.getSavedStructures() ?? [])
            .filter((structure) => structure.level === 0 && (structure.type === 'wall' || structure.type === 'door'))
            .map(structurePlacementKey),
        ),
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
          (this.planting?.hasDeviceAt(coordinate) ?? false) ||
          (this.progression?.hasDeviceAt(coordinate) ?? false),
      );
      this.navigation = new NavigationSystem(
        this.renderer,
        this.camera,
        this.scene,
        this.materials,
        this.raft,
        this.player,
        this.island,
        this.audio,
        this.splashes,
        save?.raft.navigation ?? createDefaultNavigationState(),
        (coordinate) =>
          (this.devices?.hasDeviceAt(coordinate) ?? false) ||
          (this.planting?.hasDeviceAt(coordinate) ?? false) ||
          (this.progression?.hasDeviceAt(coordinate) ?? false),
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
        () => this.navigation?.getWeather() ?? { weatherPhase: 'calm', stormIntensity: 0 },
        (coordinate) =>
          (this.devices?.hasDeviceAt(coordinate) ?? false) ||
          (this.navigation?.hasDeviceAt(coordinate) ?? false) ||
          (this.progression?.hasDeviceAt(coordinate) ?? false),
      );
      this.progression = new ProgressionSystem(
        this.renderer,
        this.camera,
        this.materials,
        this.raft,
        this.player,
        this.audio,
        this.splashes,
        save?.raft.progression ?? createDefaultProgressionState(),
        (coordinate) =>
          (this.devices?.hasDeviceAt(coordinate) ?? false) ||
          (this.navigation?.hasDeviceAt(coordinate) ?? false) ||
          (this.planting?.hasDeviceAt(coordinate) ?? false),
      );
      this.island.setNavigationProvider(() =>
        this.navigation?.getIslandTravel() ?? { approachRate: 0.55, dockDriftRate: 1, anchored: false },
      );
      this.player.setCollisionResolver((position, previous, footHeight) => {
        this.structures?.resolvePlayerCollision(position, previous, footHeight);
        this.devices?.resolvePlayerCollision(position, previous, footHeight);
        this.navigation?.resolvePlayerCollision(position, previous, footHeight);
        this.planting?.resolvePlayerCollision(position, previous, footHeight);
        this.progression?.resolvePlayerCollision(position, previous, footHeight);
      });
      this.build = new BuildSystem(
        this.renderer,
        this.camera,
        this.materials,
        this.raft,
        this.structures,
        this.audio,
        this.splashes,
        (coordinate) =>
          (this.devices?.hasDeviceAt(coordinate) ?? false) ||
          (this.navigation?.hasDeviceAt(coordinate) ?? false) ||
          (this.planting?.hasDeviceAt(coordinate) ?? false) ||
          (this.progression?.hasDeviceAt(coordinate) ?? false),
        (coordinate) =>
          (this.devices?.dismantleAt(coordinate) ?? false) ||
          (this.navigation?.dismantleAt(coordinate) ?? false) ||
          (this.planting?.dismantleAt(coordinate) ?? false) ||
          (this.progression?.dismantleAt(coordinate) ?? false),
        (action) => this.applyToolWear('hammer', action),
        (coordinate) => this.collectionNets?.blocksFoundationAt(coordinate) ?? false,
        (candidate) => this.collectionNets?.blocksStructure(candidate) ?? false,
      );
      this.fishing = new FishingSystem(
        this.renderer,
        this.camera,
        this.scene,
        this.materials,
        this.audio,
        this.splashes,
        () => this.applyToolWear('fishingRod', 'fishing-catch'),
      );
      this.shark = new SharkSystem(
        this.scene,
        this.raft,
        this.structures,
        this.player,
        this.camera,
        this.materials,
        this.audio,
        this.splashes,
        (strength) => this.player?.addCameraShake(strength),
        (mutation) => {
          if (mutation.destroyed && mutation.removed.length > 0) {
            this.structureCollapses?.spawn(mutation.removed);
          }
          const cascadeCount = mutation.kind === 'structure' && mutation.destroyed
            ? Math.max(0, mutation.removed.length - 1)
            : mutation.removed.length;
          this.mount.dataset.raftStructureCascadeCount = String(cascadeCount);
          this.mount.dataset.lastRaftMutation = `${mutation.kind}:${mutation.targetId}:${mutation.health}:${mutation.destroyed}`;
          this.saveNow();
        },
        this.collectionNets,
        save?.world.shark ?? createDefaultSharkState(),
        (loot, position) => {
          const result = useGameStore.getState().receiveItemBundle(loot);
          const rejected = Object.values(result.rejected).some((amount) => (amount ?? 0) > 0);
          const worldDropped = rejected
            ? Boolean(this.debris?.spawnWorldDrop(result.rejected, position, true))
            : false;
          return { ...result, worldDropped };
        },
        () => this.saveNow(),
      );
      this.spear = new SpearSystem(
        this.renderer,
        this.camera,
        this.materials,
        this.audio,
        (damage, counterPrimed) => this.shark?.receiveSpearStrike(this.camera, damage, counterPrimed) ?? false,
        (upgraded) => this.applyToolWear(upgraded ? 'metalSpear' : 'spear', 'spear-hit'),
        () => this.shark?.isCounterWindowOpen() ?? false,
      );
      this.resonanceFork = new ResonanceForkSystem(
        this.renderer,
        this.camera,
        this.materials,
        this.audio,
        () => itemCount(useGameStore.getState().inventory, 'brineCell') > 0,
        () => this.shark?.canReceiveResonancePulse(this.camera) ?? false,
        () => this.settleResonancePulse(),
        (feedback) => useGameStore.getState().setResonanceFork(feedback),
        (message) => this.showTransientNotice(message),
      );
      store.setRaft(this.raft.getIntegrityStats());
      this.unsubscribeStore = useGameStore.subscribe((state, previous) => {
        if (
          state.selectedTool !== previous.selectedTool ||
          state.pointerLocked !== previous.pointerLocked ||
          state.overlayPanel !== previous.overlayPanel ||
          state.settingsOpen !== previous.settingsOpen ||
          state.phase !== previous.phase ||
          state.placementDevice !== previous.placementDevice ||
          state.inventory !== previous.inventory
        ) {
          if (state.selectedTool !== previous.selectedTool) this.audio.playEquip();
          this.syncEquipment();
        }
        if (state.crafting !== previous.crafting || state.inventory !== previous.inventory) {
          this.syncCraftingDiagnostics();
        }
        if (state.survival !== previous.survival || state.inventory !== previous.inventory) {
          this.syncSurvivalDiagnostics();
        }
        if (state.toolDurability !== previous.toolDurability || state.inventory !== previous.inventory) {
          this.syncToolDurabilityDiagnostics();
        }
        if (state.fishing !== previous.fishing) this.syncFishingDiagnostics();
        if (state.devices !== previous.devices || state.inventory !== previous.inventory) this.syncCookingDiagnostics();
        if (state.phase === 'failed' && previous.phase !== 'failed' && state.failure) {
          this.pauseInput();
          if (state.audioEnabled) {
            void this.audio.begin().then(() => this.audio.playFailure(state.failure!.cause)).catch(() => undefined);
          }
        }
        if (state.failure !== previous.failure) {
          this.syncFailureDiagnostics(state.failure);
          if (this.initialized && state.failure?.dropPending) this.settlePendingFailureDrop(state.failure);
        }
      });
      this.syncEquipment();
      this.syncCraftingDiagnostics();
      this.syncSurvivalDiagnostics();
      this.syncToolDurabilityDiagnostics();
      this.syncFishingDiagnostics();
      this.syncCookingDiagnostics();

      store.setLoadingLabel('正在建立物理世界');
      await this.physics.initialize();
      if (this.disposed) return;
      store.setLoadingLabel('正在预热渔获材质');
      await this.fishing.prewarmVisuals();
      if (this.disposed) return;
      this.mount.dataset.fishingVisualsPrewarmed = 'true';
      this.syncRaftPhysics();
      this.physics.step(1 / 60);

      this.raft.restoreSimulationPose();
      this.player.update(0);
      this.player.present(1);
      this.updateEnvironment(0, 0, 0);
      this.renderer.render(this.scene, this.camera);

      this.clock.start();
      this.lastNativeFrameAt = performance.now();
      this.renderer.setAnimationLoop(this.onAnimationFrame);
      this.frameWatchdog = window.setInterval(this.onFrameWatchdog, 1000 / 15);
      this.initialized = true;
      store.setReady(!this.contextLost);
      store.setLoadingLabel('海况稳定');
      this.syncFailureDiagnostics(useGameStore.getState().failure);
      this.settlePendingFailureDrop(useGameStore.getState().failure);
      this.saveNow();
      if (loaded.recovered) this.showTransientNotice('主航迹损坏 · 已从备份恢复');
    } catch (error) {
      console.error('Failed to initialize Driftwake', error);
      store.setLoadingLabel('初始化失败');
      throw error;
    }
  }

  begin(): void {
    if (!useGameStore.getState().ready || useGameStore.getState().phase === 'failed') return;
    this.devices?.closeStorage();
    useGameStore.getState().setOverlayPanel(null);
    useGameStore.getState().setSettingsOpen(false);
    this.audio.setMix(useGameStore.getState().audioMix);
    this.audio.setEnabled(useGameStore.getState().audioEnabled);
    this.syncAudioFocusMuted();
    void this.audio.begin();
    this.requestInputLock();
  }

  recoverFromFailure(): boolean {
    const store = useGameStore.getState();
    if (!store.ready || !store.failure || store.failure.dropPending || !this.player) return false;
    this.pauseInput();
    if (!store.recoverPlayer()) return false;
    this.player.respawnOnRaft();
    this.syncEquipment();
    if (store.audioEnabled) void this.audio.begin().then(() => this.audio.playRecovery()).catch(() => undefined);
    this.saveNow();
    return true;
  }

  pauseInput(): void {
    if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
    const store = useGameStore.getState();
    if (store.pointerLocked) store.setPointerLocked(false);
    this.player?.setEnabled(false);
    this.syncEquipment();
  }

  setAudioEnabled(enabled: boolean): void {
    this.audio.setEnabled(enabled);
    if (enabled) void this.audio.begin();
  }

  setAudioMix(mix: AudioMix): void {
    this.audio.setMix(mix);
  }

  setMuteOnFocusLoss(_enabled: boolean): void {
    this.syncAudioFocusMuted();
  }

  setCameraMotionMode(mode: CameraMotionMode): void {
    this.player?.setCameraMotionMode(mode);
    this.mount.dataset.cameraMotionMode = mode;
  }

  setDynamicResolutionEnabled(enabled: boolean): void {
    this.dynamicResolutionState = createDynamicResolutionState(1);
    this.mount.dataset.dynamicResolution = String(enabled);
    this.applyRenderScale();
  }

  setQuality(quality: QualityPreset): void {
    this.qualityPreset = quality;
    this.dynamicResolutionState = createDynamicResolutionState(1);
    const highQuality = quality === 'high';
    this.renderer.shadowMap.enabled = highQuality;
    this.ocean?.setQuality(highQuality);
    this.storm?.setQuality(highQuality);
    this.debris?.setQuality(highQuality);
    this.mount.dataset.quality = quality;
    this.mount.dataset.debrisCount = String(this.debris?.activeCount ?? 0);
    this.applyRenderScale();
  }

  playUi(success = true): void {
    if (success) this.audio.playUi();
    else this.audio.playDenied();
  }

  selectBuildPiece(piece: RaftBuildPiece): boolean {
    return this.build?.selectBuildPiece(piece) ?? false;
  }

  selectBuildCategory(category: RaftBuildCategory): boolean {
    return this.build?.selectBuildCategory(category) ?? false;
  }

  selectSignalTarget(targetId: SignalTargetId): boolean {
    const selected = this.navigation?.selectSignalTarget(targetId) ?? false;
    if (selected) this.saveNow();
    else this.audio.playDenied();
    return selected;
  }

  notifyCraftQueued(count: number, success: boolean): void {
    if (!success) {
      this.audio.playDenied();
      return;
    }
    this.audio.playCraftQueued(count);
    this.saveNow();
  }

  notifyCraftCancelled(success: boolean): void {
    if (!success) {
      this.audio.playDenied();
      return;
    }
    this.audio.playCraftCancel();
    this.saveNow();
  }

  playConsume(itemId: ItemId): void {
    if (itemId === 'emergencyWater' || itemId === 'freshWaterCup') this.audio.playDrink();
    else this.audio.playEat(itemId === 'rawFish' || itemId === 'sharkMeat' || itemId === 'cookedFish' || itemId === 'burntFish');
    this.saveNow();
  }

  transferStorage(itemId: ItemId, direction: 'to-storage' | 'to-pack', amount?: number): boolean {
    return this.devices?.transferStorage(itemId, direction, amount) ?? false;
  }

  closeStorage(): void {
    this.devices?.closeStorage();
  }

  playResearchSample(success: boolean): void {
    if (success) this.audio.playResearchSample();
    else this.audio.playDenied();
  }

  playResearchLearn(success: boolean): void {
    if (success) this.audio.playResearchLearn();
    else this.audio.playDenied();
  }

  dispose(): void {
    if (this.disposed) return;
    this.saveNow();
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    if (this.frameWatchdog !== null) window.clearInterval(this.frameWatchdog);
    this.frameWatchdog = null;
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('blur', this.onWindowBlur);
    window.removeEventListener('focus', this.onWindowFocus);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('pointerlockerror', this.onPointerLockError);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('beforeunload', this.onBeforeUnload);
    window.removeEventListener('pagehide', this.onPageHide);
    this.renderer.domElement.removeEventListener('click', this.onCanvasClick);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestored);
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
    this.salvage?.dispose();
    this.collectionNets?.dispose();
    this.build?.dispose();
    this.structures?.dispose();
    this.navigation?.dispose();
    this.planting?.dispose();
    this.progression?.dispose();
    this.devices?.dispose();
    this.fishing?.dispose(this.scene);
    this.spear?.dispose();
    this.resonanceFork?.dispose();
    this.shark?.dispose();
    this.structureCollapses?.dispose();
    this.underwater?.dispose();
    this.island?.dispose();
    this.splashes?.dispose();
    this.debris?.dispose(this.scene);
    this.ocean?.dispose();
    this.storm?.dispose();
    this.physics.dispose();
    this.audio.dispose();
    this.unsubscribeStore?.();
    this.unsubscribeStore = null;
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);
    this.clearPointerLockTimer();

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

  private readonly stepSimulation = (stepSeconds: number, simulationSeconds: number): void => {
    if (useGameStore.getState().phase !== 'playing') return;
    this.simulationTickCount += 1;
    this.elapsed = simulationSeconds;
    this.raft?.update(simulationSeconds, stepSeconds);
    this.syncRaftPhysics();
    this.physics.step(stepSeconds);
    this.player?.update(stepSeconds);
    this.camera.getWorldPosition(this.audioPosition);
    this.camera.getWorldDirection(this.audioForward);
    this.camera.getWorldQuaternion(this.audioQuaternion);
    this.audioUp.set(0, 1, 0).applyQuaternion(this.audioQuaternion);
    this.audio.setListenerPose(this.audioPosition, this.audioForward, this.audioUp);
    this.debris?.update(simulationSeconds, stepSeconds);
    this.hook?.update(simulationSeconds, stepSeconds);
    const hookVisual = this.hook?.getVisualState();
    if (hookVisual) {
      this.mount.dataset.hookState = hookVisual.state;
      this.mount.dataset.hookHeldVisible = String(hookVisual.heldVisible);
      this.mount.dataset.hookHandsVisible = String(hookVisual.handsVisible);
      this.mount.dataset.hookProjectileVisible = String(hookVisual.projectileVisible);
      this.mount.dataset.hookRopeVisible = String(hookVisual.ropeVisible);
      this.mount.dataset.hookRopeTension = hookVisual.ropeTension.toFixed(3);
      this.mount.dataset.hookRopeSag = hookVisual.ropeSag.toFixed(3);
    }
    this.build?.update(simulationSeconds, stepSeconds);
    const buildDiagnostics = this.build?.getDiagnostics();
    if (buildDiagnostics) {
      this.mount.dataset.buildMode = buildDiagnostics.mode;
      this.mount.dataset.buildTarget = buildDiagnostics.target
        ? `${buildDiagnostics.target.x},${buildDiagnostics.target.z}`
        : 'none';
      this.mount.dataset.buildHovered = buildDiagnostics.hovered
        ? `${buildDiagnostics.hovered.x},${buildDiagnostics.hovered.z}`
        : 'none';
      this.mount.dataset.buildPiece = buildDiagnostics.piece;
      this.mount.dataset.buildCategory = buildDiagnostics.category;
      this.mount.dataset.buildRotation = String(buildDiagnostics.rotation);
      this.mount.dataset.buildLevel = String(buildDiagnostics.level);
      this.mount.dataset.buildStructureTarget = buildDiagnostics.structureTarget ?? 'none';
      this.mount.dataset.buildHoveredStructure = buildDiagnostics.hoveredStructure ?? 'none';
      this.mount.dataset.buildRepairTarget = buildDiagnostics.repairTarget ?? 'none';
      this.mount.dataset.buildRepairHealth = String(buildDiagnostics.repairHealth);
      this.mount.dataset.buildReplacementTarget = buildDiagnostics.replacementTarget ?? 'none';
      this.mount.dataset.buildReplacementFrom = buildDiagnostics.replacementFrom ?? 'none';
      this.mount.dataset.buildReplacementCost = JSON.stringify(buildDiagnostics.replacementCost);
      this.mount.dataset.buildReplacementRefund = JSON.stringify(buildDiagnostics.replacementRefund);
      this.mount.dataset.raftStructureCount = String(buildDiagnostics.structureCount);
    }
    this.fishing?.update(simulationSeconds, stepSeconds);
    this.spear?.update(simulationSeconds, stepSeconds);
    this.structureCollapses?.update(simulationSeconds, stepSeconds);
    const collapseDiagnostics = this.structureCollapses?.getDiagnostics();
    if (collapseDiagnostics) {
      this.mount.dataset.structureCollapseActive = String(collapseDiagnostics.active);
      this.mount.dataset.structureCollapseBodies = String(collapseDiagnostics.activeBodies);
      this.mount.dataset.structureCollapseSpawned = String(collapseDiagnostics.spawned);
      this.mount.dataset.structureCollapseWaterImpacts = String(collapseDiagnostics.waterImpacts);
      this.mount.dataset.structureCollapseRetired = String(collapseDiagnostics.retired);
      this.mount.dataset.structureCollapseDiscarded = String(collapseDiagnostics.discarded);
      this.mount.dataset.structureCollapseLastId = collapseDiagnostics.lastStructureId ?? 'none';
      this.mount.dataset.structureCollapseLastType = collapseDiagnostics.lastStructureType ?? 'none';
    }
    this.devices?.update(simulationSeconds, stepSeconds);
    this.navigation?.update(simulationSeconds, stepSeconds);
    const navigationDiagnostics = this.navigation?.getDiagnostics();
    if (navigationDiagnostics) {
      this.mount.dataset.signalDestinationMaterialMaps = navigationDiagnostics.destinationMaterialMaps;
      this.mount.dataset.signalDestinations = JSON.stringify(navigationDiagnostics.destinations);
      this.mount.dataset.signalDestinationAudio = JSON.stringify(navigationDiagnostics.destinationAudio);
      this.mount.dataset.signalVisibleDestinations = navigationDiagnostics.destinations
        .filter((destination) => destination.visible)
        .map((destination) => destination.id)
        .join('|') || 'none';
    }
    this.planting?.update(simulationSeconds, stepSeconds);
    const plantingDiagnostics = this.planting?.getDiagnostics();
    if (plantingDiagnostics) {
      this.mount.dataset.plantingWeatherPhase = plantingDiagnostics.climate.phase;
      this.mount.dataset.plantingStormIntensity = plantingDiagnostics.climate.intensity.toFixed(3);
      this.mount.dataset.plantingClimateEffect = plantingDiagnostics.climate.effect;
      this.mount.dataset.plantingGrowthMultiplier = plantingDiagnostics.climate.growthMultiplier.toFixed(3);
      this.mount.dataset.plantingWaterUseMultiplier = plantingDiagnostics.climate.waterUseMultiplier.toFixed(3);
      this.mount.dataset.plantingRainfallPerSecond = plantingDiagnostics.climate.rainfallPerSecond.toFixed(4);
      this.mount.dataset.plantingStates = JSON.stringify(plantingDiagnostics.planters);
      this.mount.dataset.plantingCropMaterialMaps = plantingDiagnostics.cropMaterialMaps;
      this.mount.dataset.plantingBirdMaterialMaps = plantingDiagnostics.birdMaterialMaps;
      this.mount.dataset.plantingBirdPhase = plantingDiagnostics.birdPhase;
      this.mount.dataset.plantingBirdRaidAllowed = String(plantingDiagnostics.birdRaidAllowed);
      this.mount.dataset.plantingWeatherBirdDismissals = String(plantingDiagnostics.weatherBirdDismissals);
      this.mount.dataset.plantingWeatherRainRecoveries = String(plantingDiagnostics.weatherRainRecoveries);
    }
    this.progression?.update(simulationSeconds, stepSeconds);
    this.collectionNets?.update(simulationSeconds, stepSeconds);
    const collectionNetDiagnostics = this.collectionNets?.getDiagnostics();
    if (collectionNetDiagnostics) {
      this.mount.dataset.collectionNetCount = String(collectionNetDiagnostics.count);
      this.mount.dataset.collectionNetStored = String(collectionNetDiagnostics.stored);
      this.mount.dataset.collectionNetFocused = collectionNetDiagnostics.focused ?? 'none';
      this.mount.dataset.collectionNetPlacement = collectionNetDiagnostics.placement ?? 'none';
      this.mount.dataset.collectionNetPlacementValid = String(collectionNetDiagnostics.placementValid);
      this.mount.dataset.collectionNetCaptures = String(collectionNetDiagnostics.captures);
      this.mount.dataset.collectionNetDamageCount = String(collectionNetDiagnostics.damageEvents);
      this.mount.dataset.collectionNetFirstHealth = String(Math.round(collectionNetDiagnostics.firstHealth));
      this.mount.dataset.collectionNetMount = collectionNetDiagnostics.mount ?? 'none';
      this.mount.dataset.collectionNetNearestDrift = collectionNetDiagnostics.nearestDrift ?? 'none';
      if (this.simulationTickCount % 6 === 0) {
        this.mount.dataset.collectionNetAim = JSON.stringify(this.collectionNets?.getAimDiagnostics());
      }
    }
    this.structures?.updateDoorFocus(this.camera);
    const structureDiagnostics = this.structures?.getDiagnostics();
    if (structureDiagnostics) {
      this.mount.dataset.structureFocusedDoor = structureDiagnostics.focusedDoor ?? 'none';
      this.mount.dataset.structureOpenDoors = String(structureDiagnostics.openDoors);
      this.mount.dataset.raftStructureCount = String(structureDiagnostics.structures);
      this.mount.dataset.raftDamagedStructureCount = String(structureDiagnostics.damaged);
      this.mount.dataset.raftCriticalStructureCount = String(structureDiagnostics.critical);
      this.mount.dataset.raftStructureLowestHealth = structureDiagnostics.lowestHealthRatio.toFixed(3);
      if (this.simulationTickCount % 6 === 0) {
        this.mount.dataset.structureDoorAim = JSON.stringify(this.structures?.getDoorAimDiagnostics(this.camera));
      }
    }
    this.island?.update(simulationSeconds, stepSeconds);
    const selectedTool = useGameStore.getState().selectedTool;
    if (
      this.island
      && this.simulationTickCount % 6 === 0
      && (selectedTool === 'axe' || selectedTool === 'metalAxe')
    ) {
      this.mount.dataset.axeAim = JSON.stringify(this.island.getAxeAimDiagnostics());
    }
    this.underwater?.update(simulationSeconds, stepSeconds);
    this.salvage?.update(simulationSeconds);
    this.shark?.update(simulationSeconds, stepSeconds);
    this.resonanceFork?.update(simulationSeconds, stepSeconds);
    const resonanceDiagnostics = this.resonanceFork?.getDiagnostics();
    if (resonanceDiagnostics) {
      this.mount.dataset.resonancePhase = resonanceDiagnostics.phase;
      this.mount.dataset.resonanceCharge = resonanceDiagnostics.charge.toFixed(3);
      this.mount.dataset.resonanceLocked = String(resonanceDiagnostics.locked);
      this.mount.dataset.resonancePulseCount = String(resonanceDiagnostics.pulseEvents);
      this.mount.dataset.resonanceMissCount = String(resonanceDiagnostics.missEvents);
      this.mount.dataset.resonanceCancelledCount = String(resonanceDiagnostics.cancelledEvents);
      this.mount.dataset.resonancePulseVisual = resonanceDiagnostics.pulseVisual.toFixed(3);
      this.mount.dataset.resonanceEquipped = String(resonanceDiagnostics.equipped);
      this.mount.dataset.resonanceInputEnabled = String(resonanceDiagnostics.inputEnabled);
      this.mount.dataset.resonanceHeld = String(resonanceDiagnostics.held);
    }
    const sharkDiagnostics = this.shark?.getDiagnostics();
    if (sharkDiagnostics) {
      this.mount.dataset.sharkRaftTargetKind = sharkDiagnostics.targetKind;
      this.mount.dataset.sharkRaftTargetId = sharkDiagnostics.targetId ?? 'none';
      this.mount.dataset.sharkLastRaftTargetKind = sharkDiagnostics.lastRaftTargetKind;
      this.mount.dataset.sharkLastRaftTargetId = sharkDiagnostics.lastRaftTargetId ?? 'none';
      this.mount.dataset.sharkLastRaftTargetHealth = String(sharkDiagnostics.lastRaftTargetHealth);
      this.mount.dataset.sharkStructureDamageCount = String(sharkDiagnostics.structureDamageEvents);
      this.mount.dataset.sharkFoundationDamageCount = String(sharkDiagnostics.foundationDamageEvents);
      this.mount.dataset.sharkCollectionNetDamageCount = String(sharkDiagnostics.collectionNetDamageEvents);
      this.mount.dataset.sharkLifecycle = sharkDiagnostics.lifecycle;
      this.mount.dataset.sharkCarcassPhase = sharkDiagnostics.carcassPhase;
      this.mount.dataset.sharkCarcassFocused = String(sharkDiagnostics.carcassFocused);
      this.mount.dataset.sharkHarvestIndex = String(sharkDiagnostics.harvestIndex);
      this.mount.dataset.sharkHarvestProgress = sharkDiagnostics.harvestProgress.toFixed(3);
      this.mount.dataset.sharkHarvestEvents = String(sharkDiagnostics.harvestEvents);
      this.mount.dataset.sharkTotalHarvestEvents = String(sharkDiagnostics.totalHarvestEvents);
      this.mount.dataset.sharkDefeatCount = String(sharkDiagnostics.defeatEvents);
      this.mount.dataset.sharkHarvestedCarcassCount = String(sharkDiagnostics.harvestedCarcassEvents);
      this.mount.dataset.sharkExpiredCarcassCount = String(sharkDiagnostics.expiredCarcassEvents);
      this.mount.dataset.sharkRespawnCount = String(sharkDiagnostics.respawnEvents);
      this.mount.dataset.sharkCarcassSeconds = sharkDiagnostics.carcassSeconds.toFixed(2);
      this.mount.dataset.sharkCooldownSeconds = sharkDiagnostics.cooldownSeconds.toFixed(2);
      this.mount.dataset.sharkHealth = String(Math.round(sharkDiagnostics.health));
      this.mount.dataset.sharkMode = sharkDiagnostics.mode;
      this.mount.dataset.sharkAttackPhase = sharkDiagnostics.attackPhase;
      this.mount.dataset.sharkAttackProgress = sharkDiagnostics.attackProgress.toFixed(3);
      this.mount.dataset.sharkCounterWindow = String(sharkDiagnostics.counterWindow);
      this.mount.dataset.sharkSecondsToImpact = sharkDiagnostics.secondsToImpact.toFixed(3);
      this.mount.dataset.sharkTelegraphCount = String(sharkDiagnostics.telegraphEvents);
      this.mount.dataset.sharkBiteAttemptCount = String(sharkDiagnostics.biteAttempts);
      this.mount.dataset.sharkPlayerDamageCount = String(sharkDiagnostics.playerDamageEvents);
      this.mount.dataset.sharkMissedPlayerBiteCount = String(sharkDiagnostics.missedPlayerBites);
      this.mount.dataset.sharkTimedCounterCount = String(sharkDiagnostics.timedCounterEvents);
      this.mount.dataset.sharkResonancePulseCount = String(sharkDiagnostics.resonancePulseEvents);
      this.mount.dataset.sharkRecoverySeconds = sharkDiagnostics.recoverySeconds.toFixed(2);
      this.mount.dataset.sharkWorldPosition = JSON.stringify(sharkDiagnostics.worldPosition);
      this.mount.dataset.sharkAim = JSON.stringify(this.shark?.getAimDiagnostics());
      this.mount.dataset.raftReinforcedTileCount = String(this.raft?.reinforcedTileCount ?? 0);
    }
    this.mount.dataset.salvageFocus = this.salvage?.focusedKind ?? 'none';
    this.mount.dataset.worldDropCount = String(this.debris?.activeWorldDropCount ?? 0);
    this.splashes?.update(stepSeconds);

    const weather = this.navigation?.getWeather() ?? { weatherPhase: 'calm' as const, stormIntensity: 0, gust: 0 };
    this.currentStormIntensity = weather.stormIntensity;
    this.currentGust = weather.gust;
    const surfaceStorm = (this.player?.isSubmerged() ?? false) ? 0 : this.currentStormIntensity;
    this.currentLightning = this.storm?.update(simulationSeconds, surfaceStorm, this.currentGust) ?? 0;
    this.audio.setStormActivity(this.currentStormIntensity);
    this.audio.update(simulationSeconds);

    this.craftingAccumulator += stepSeconds;
    while (this.craftingAccumulator + 1e-9 >= CRAFTING_TICK_SECONDS) {
      const craftingResult = useGameStore.getState().tickCrafting(CRAFTING_TICK_SECONDS);
      this.craftingAccumulator -= CRAFTING_TICK_SECONDS;
      if (craftingResult.completed.length > 0) {
        this.craftingCompletedCount += craftingResult.completed.length;
        const firstName = RECIPES[craftingResult.completed[0].recipeId].name;
        this.audio.playCraftComplete(craftingResult.completed.length);
        this.showTransientNotice(
          craftingResult.completed.length === 1
            ? `${firstName} 已完成，收入背包`
            : `${firstName} 等 ${craftingResult.completed.length} 项已完成`,
        );
        this.saveNow();
      }
      if (craftingResult.blockedReason !== this.lastCraftingBlockReason) {
        this.lastCraftingBlockReason = craftingResult.blockedReason;
        if (craftingResult.blockedReason === 'inventory-full') {
          this.audio.playDenied();
          this.showTransientNotice('制作已完成，背包腾出空位后领取');
        } else if (craftingResult.blockedReason === 'already-owned') {
          this.audio.playDenied();
          this.showTransientNotice('制作已完成，同类工具占用产出位置');
        }
      }
      this.syncCraftingDiagnostics();
    }

    this.simulationAccumulator += stepSeconds;
    while (this.simulationAccumulator >= 1) {
      const store = useGameStore.getState();
      store.tickSurvival(1, this.player?.isSubmerged() ?? false);
      const next = useGameStore.getState();
      if (next.phase === 'playing') this.handleSurvivalPressure(next.survival);
      next.advancePlayTime(1);
      this.simulationAccumulator -= 1;
    }
  };

  private readonly update = (): void => {
    if (this.disposed) return;
    const frameDelta = this.clock.getDelta();
    const state = useGameStore.getState();
    const active = isSimulationActive({
      phase: state.phase,
      ready: state.ready,
      pointerLocked: state.pointerLocked,
      settingsOpen: state.settingsOpen,
      overlayOpen: state.overlayPanel !== null,
      documentVisible: document.visibilityState === 'visible',
      windowFocused: this.windowFocused,
      contextHealthy: !this.contextLost,
    });
    this.setSimulationActive(active);

    if (state.phase === 'playing') this.saveElapsed += frameDelta;
    if (state.phase === 'playing' && this.saveElapsed >= 12) {
      this.saveElapsed = 0;
      this.saveNow();
    }
    this.updateFrameTiming(frameDelta, active);

    if (!shouldRenderPresentation(active, performance.now(), this.lastPausedRenderCompletedAt)) {
      this.mount.dataset.presentationRate = 'paused-4fps';
      return;
    }

    let renderTime = this.fixedStep.simulationSeconds;
    let alpha = 0;
    if (active) {
      const fixed = this.fixedStep.advance(frameDelta, this.stepSimulation);
      renderTime = fixed.interpolatedSeconds;
      alpha = fixed.alpha;
    }
    this.raft?.present(alpha);
    this.player?.present(alpha);
    this.ocean?.update(renderTime);
    this.updateEnvironment(frameDelta, this.currentStormIntensity, this.currentLightning);
    this.renderer.render(this.scene, this.camera);
    this.mount.dataset.presentationRate = active ? 'native' : 'paused-4fps';
    this.lastPausedRenderCompletedAt = active ? Number.NEGATIVE_INFINITY : performance.now();
  };

  private readonly onAnimationFrame = (): void => {
    this.lastNativeFrameAt = performance.now();
    this.mount.dataset.frameDriver = 'native';
    this.update();
  };

  private readonly onFrameWatchdog = (): void => {
    if (
      this.disposed
      || this.contextLost
      || document.visibilityState !== 'visible'
      || performance.now() - this.lastNativeFrameAt < 120
    ) {
      return;
    }
    this.mount.dataset.frameDriver = 'fallback';
    this.update();
  };

  private setSimulationActive(active: boolean): void {
    if (active !== this.simulationActive) this.fixedStep.resetAccumulator();
    this.simulationActive = active;
    this.mount.dataset.simulationActive = String(active);
  }

  private updateFrameTiming(frameDelta: number, active: boolean): void {
    if (!active) {
      this.frameTimingElapsed = 0;
      this.frameTimesMs.length = 0;
      return;
    }
    this.frameTimingElapsed += frameDelta;
    this.frameTimesMs.push(frameDelta * 1000);
    if (this.frameTimingElapsed < 0.75) return;

    const summary = summarizeFrameTimes(this.frameTimesMs);
    const previousScale = this.dynamicResolutionState.scale;
    this.dynamicResolutionState = stepDynamicResolution(
      this.dynamicResolutionState,
      {
        medianFrameMs: summary.medianFrameMs,
        p95FrameMs: summary.p95FrameMs,
        elapsedSeconds: this.frameTimingElapsed,
        enabled: useGameStore.getState().dynamicResolutionEnabled,
      },
      DYNAMIC_RESOLUTION_POLICIES[this.qualityPreset],
    );
    if (Math.abs(previousScale - this.dynamicResolutionState.scale) >= 0.001) this.applyRenderScale();

    const info = this.renderer.info;
    const fps = summary.medianFrameMs > 0 ? Math.round(1000 / summary.medianFrameMs) : 0;
    useGameStore.getState().setFps(fps);
    this.mount.dataset.fps = String(fps);
    this.mount.dataset.frameP95Ms = summary.p95FrameMs.toFixed(2);
    this.mount.dataset.frameMaxMs = summary.maximumFrameMs.toFixed(2);
    this.mount.dataset.frameHitches = String(summary.hitchCount);
    this.mount.dataset.drawCalls = String(info.render.calls);
    this.mount.dataset.triangles = String(info.render.triangles);
    this.mount.dataset.geometries = String(info.memory.geometries);
    this.mount.dataset.textures = String(info.memory.textures);
    this.mount.dataset.droppedSimulationSeconds = this.fixedStep.totalDroppedSeconds.toFixed(3);
    this.mount.dataset.raftColliderCount = String(this.physics.raftColliderCount);
    this.mount.dataset.raftCollisionCount = String(this.physics.collisionCount);
    this.mount.dataset.raftTileCount = String(this.raft?.tileCount ?? 0);
    this.mount.dataset.sailAttachment = this.navigation?.getSailAttachmentState() ?? 'missing';
    this.mount.dataset.islandRaftClearance = (this.island?.getRaftClearance() ?? 0).toFixed(3);
    this.frameTimingElapsed = 0;
    this.frameTimesMs.length = 0;
  }

  private applyRenderScale(): void {
    const basePixelRatio = Math.min(
      window.devicePixelRatio,
      this.qualityPreset === 'high' ? 1.75 : 1,
    );
    const dynamicEnabled = useGameStore.getState().dynamicResolutionEnabled;
    const renderScale = dynamicEnabled ? this.dynamicResolutionState.scale : 1;
    const pixelRatio = Math.max(0.5, basePixelRatio * renderScale);
    if (Math.abs(pixelRatio - this.appliedPixelRatio) >= 0.001) {
      this.renderer.setPixelRatio(pixelRatio);
      this.appliedPixelRatio = pixelRatio;
      this.resize();
    }
    this.mount.dataset.renderScale = renderScale.toFixed(2);
    this.mount.dataset.pixelRatio = pixelRatio.toFixed(2);
  }

  private syncRaftPhysics(): void {
    if (!this.raft) return;
    this.physics.syncRaft(
      this.raft.group.position,
      this.raft.group.quaternion,
      this.raft.getTiles(),
      this.raft.currentRevision,
    );
  }

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
    if (locked) {
      this.clearPointerLockTimer();
      this.mount.dataset.pointerLockDenied = 'false';
      useGameStore.getState().setPointerLockDenied(false);
    }
    useGameStore.getState().setPointerLocked(locked);
    this.player?.setEnabled(locked && playing);
    this.syncEquipment();
  };

  private readonly onCanvasClick = (): void => {
    const state = useGameStore.getState();
    if (state.phase === 'playing' && !state.settingsOpen && document.pointerLockElement !== this.renderer.domElement) {
      void this.audio.begin();
      this.requestInputLock();
    }
  };

  private requestInputLock(): void {
    this.clearPointerLockTimer();
    this.mount.dataset.pointerLockDenied = 'false';
    useGameStore.getState().setPointerLockDenied(false);
    try {
      const request = this.renderer.domElement.requestPointerLock();
      this.pointerLockTimer = window.setTimeout(() => {
        if (document.pointerLockElement === this.renderer.domElement) this.clearPointerLockTimer();
        else this.markPointerLockDenied();
      }, 1200);
      void request?.catch(this.markPointerLockDenied);
    } catch {
      this.markPointerLockDenied();
    }
  }

  private readonly onPointerLockError = (): void => {
    this.markPointerLockDenied();
  };

  private readonly markPointerLockDenied = (): void => {
    this.clearPointerLockTimer();
    if (this.disposed) return;
    this.mount.dataset.pointerLockDenied = 'true';
    const store = useGameStore.getState();
    store.setPointerLockDenied(true);
    store.setPointerLocked(false);
    this.player?.setEnabled(false);
  };

  private clearPointerLockTimer(): void {
    if (this.pointerLockTimer !== null) window.clearTimeout(this.pointerLockTimer);
    this.pointerLockTimer = null;
  }

  private readonly onContextLost = (event: Event): void => {
    event.preventDefault();
    this.saveNow();
    this.contextLost = true;
    this.mount.dataset.contextHealthy = 'false';
    this.pauseInput();
    console.warn('[Driftwake] WebGL context lost', {
      elapsed: this.elapsed,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
    });
    const store = useGameStore.getState();
    store.setReady(false);
    store.setLoadingLabel('图形上下文恢复中');
    store.showNotice('图形上下文已暂停');
  };

  private readonly onContextRestored = (): void => {
    this.contextLost = false;
    this.mount.dataset.contextHealthy = 'true';
    this.clock.start();
    const store = useGameStore.getState();
    store.setReady(this.initialized);
    store.setLoadingLabel(this.initialized ? '海况恢复' : '正在唤醒海面');
    store.showNotice('图形上下文已恢复，点击继续');
  };

  private readonly onWindowBlur = (): void => {
    this.windowFocused = false;
    this.syncAudioFocusMuted();
    this.pauseInput();
  };

  private readonly onWindowFocus = (): void => {
    this.windowFocused = true;
    this.clock.start();
    this.syncAudioFocusMuted();
  };

  private readonly onVisibilityChange = (): void => {
    this.syncAudioFocusMuted();
    if (document.visibilityState !== 'visible') {
      this.saveNow();
      this.pauseInput();
    } else this.clock.start();
  };

  private syncAudioFocusMuted(): void {
    const state = useGameStore.getState();
    const focusMuted = state.muteOnFocusLoss
      && (!this.windowFocused || document.visibilityState !== 'visible');
    this.audio.setFocusMuted(focusMuted);
    this.mount.dataset.audioFocusMuted = String(focusMuted);
  }

  private syncEquipment(): void {
    const state = useGameStore.getState();
    const inputEnabled =
      state.phase === 'playing' && state.pointerLocked && !state.settingsOpen && state.overlayPanel === null;
    const equipmentVisible = state.phase === 'playing';
    const placingDevice = state.placementDevice !== null;
    const onRaft = this.player?.isOnRaft() ?? true;
    const surface = this.player?.getSurface() ?? 'raft';
    const inWater = surface === 'water';
    const onIsland = surface === 'island';
    const selectedToolAvailable = itemCount(state.inventory, state.selectedTool) > 0;
    const survivalDeviceTypes: readonly DeviceType[] = ['purifier', 'grill', 'solarPurifier', 'tripleGrill', 'locker'];
    const survivalDevicePlacement = survivalDeviceTypes.includes(state.placementDevice as DeviceType)
      ? state.placementDevice as DeviceType
      : null;
    const navigationPlacement =
      state.placementDevice === 'sail' ||
      state.placementDevice === 'anchor' ||
      state.placementDevice === 'helm' ||
      state.placementDevice === 'receiver' ||
      state.placementDevice === 'antenna'
        ? state.placementDevice
        : null;
    const plantingPlacement = state.placementDevice === 'planter' ? 'planter' : null;
    const collectionNetPlacement = state.placementDevice === 'collectionNet';
    const progressionPlacement =
      state.placementDevice === 'researchBench' ||
      state.placementDevice === 'dryingBricks' ||
      state.placementDevice === 'smelter'
        ? state.placementDevice as ProgressionDeviceType
        : null;
    this.devices?.setPlacementType(survivalDevicePlacement);
    this.devices?.setInputEnabled(inputEnabled && onRaft);
    this.navigation?.setPlacementType(navigationPlacement);
    this.navigation?.setInputEnabled(inputEnabled && onRaft);
    this.planting?.setPlacementType(plantingPlacement);
    this.planting?.setInputEnabled(inputEnabled && onRaft);
    this.progression?.setPlacementType(progressionPlacement);
    this.progression?.setInputEnabled(inputEnabled && onRaft);
    this.collectionNets?.setPlacementActive(collectionNetPlacement);
    this.collectionNets?.setInputEnabled(inputEnabled && onRaft);
    this.salvage?.setInputEnabled(inputEnabled && !placingDevice && (onRaft || (inWater && !(this.player?.isSubmerged() ?? false))));
    this.hook?.setEquipped(equipmentVisible && selectedToolAvailable && onRaft && !placingDevice && state.selectedTool === 'hook');
    this.hook?.setEnabled(selectedToolAvailable && inputEnabled && onRaft && !placingDevice && state.selectedTool === 'hook');
    this.underwater?.setHookEquipped(equipmentVisible && selectedToolAvailable && inWater && !placingDevice && state.selectedTool === 'hook');
    this.build?.setEquipped(equipmentVisible && selectedToolAvailable && onRaft && !placingDevice && state.selectedTool === 'hammer');
    this.build?.setInputEnabled(selectedToolAvailable && inputEnabled && onRaft && !placingDevice && state.selectedTool === 'hammer');
    this.structures?.setInputEnabled(inputEnabled && onRaft && !placingDevice && state.selectedTool !== 'hammer');
    this.fishing?.setEquipped(equipmentVisible && selectedToolAvailable && onRaft && !placingDevice && state.selectedTool === 'fishingRod');
    this.fishing?.setInputEnabled(selectedToolAvailable && inputEnabled && onRaft && !placingDevice && state.selectedTool === 'fishingRod');
    const spearEquipped = selectedToolAvailable && (state.selectedTool === 'spear' || state.selectedTool === 'metalSpear');
    const axeEquipped = selectedToolAvailable && (state.selectedTool === 'axe' || state.selectedTool === 'metalAxe');
    const resonanceEquipped = selectedToolAvailable && state.selectedTool === 'resonanceFork';
    this.spear?.setEquipped(equipmentVisible && (onRaft || inWater) && !placingDevice && spearEquipped, state.selectedTool === 'metalSpear');
    this.spear?.setInputEnabled(inputEnabled && (onRaft || inWater) && !placingDevice && spearEquipped);
    this.resonanceFork?.setEquipped(equipmentVisible && (onRaft || inWater) && !placingDevice && resonanceEquipped);
    this.resonanceFork?.setInputEnabled(inputEnabled && (onRaft || inWater) && !placingDevice && resonanceEquipped);
    this.shark?.setInputEnabled(inputEnabled && (onRaft || inWater) && !placingDevice);
    this.island?.setAxeEquipped(equipmentVisible && onIsland && !placingDevice && axeEquipped, state.selectedTool === 'metalAxe');
    this.island?.setInputEnabled(inputEnabled);
    this.underwater?.setInputEnabled(inputEnabled);
    this.player?.setEnabled(inputEnabled);
  }

  private syncFailureDiagnostics(failure: FailureRecord | null): void {
    this.mount.dataset.failureCause = failure?.cause ?? 'none';
    this.mount.dataset.failureDropPending = String(failure?.dropPending ?? false);
    this.mount.dataset.failureDropCount = String(
      failure ? Object.values(failure.dropped).reduce((total, amount) => total + (amount ?? 0), 0) : 0,
    );
  }

  private settlePendingFailureDrop(failure: FailureRecord | null): void {
    if (!failure?.dropPending || !this.raft || !this.debris) return;
    const tiles = this.raft.getTiles();
    if (tiles.length === 0) return;
    const rightmost = tiles.reduce((best, tile) => {
      if (tile.x !== best.x) return tile.x > best.x ? tile : best;
      return Math.abs(tile.z) < Math.abs(best.z) ? tile : best;
    });
    this.failureDropLocal.set(
      rightmost.x * RAFT_TILE_X + RAFT_TILE_X * 0.92,
      0,
      rightmost.z * RAFT_TILE_Z,
    );
    this.raft.localPointToWorld(this.failureDropLocal, this.failureDropWorld);
    this.failureDropWorld.y = sampleWaveHeight(
      this.failureDropWorld.x,
      this.failureDropWorld.z,
      this.fixedStep.simulationSeconds,
    ) + 0.09;
    if (!this.debris.spawnWorldDrop(failure.dropped, this.failureDropWorld, true)) return;
    useGameStore.getState().markFailureDropSpawned();
    this.mount.dataset.worldDropCount = String(this.debris.activeWorldDropCount);
    this.saveNow();
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
        structures: this.structures?.getSavedStructures() ?? [],
        collectionNets: this.collectionNets?.getSavedNets() ?? [],
        devices: this.devices?.getSavedDevices() ?? [],
        navigation: this.navigation?.getSavedState() ?? createDefaultNavigationState(),
        planting: this.planting?.getSavedState() ?? createDefaultPlantingState(),
        progression: this.progression?.getSavedState() ?? createDefaultProgressionState(),
      },
      world: {
        island: islandState,
        underwater:
          this.underwater?.getSavedState() ??
          createDefaultUnderwaterState(islandState.seed, islandState.cycle),
        drops: this.debris?.getSavedDrops() ?? [],
        shark: this.shark?.getSavedState() ?? createDefaultSharkState(),
      },
    };
    useGameStore.getState().setSaveStatus(writeSaveSlot(save, this.saveSlot) ? 'saved' : 'error');
  }

  private syncCraftingDiagnostics(): void {
    const state = useGameStore.getState();
    const active = state.crafting.entries[0] ?? null;
    const duration = active ? recipeCraftSeconds(active.recipeId) : 0;
    const blocked = active && active.elapsedSeconds >= duration - 1e-6
      ? craftingOutputBlockReason(state.inventory, active)
      : null;
    this.mount.dataset.craftingQueueLength = String(state.crafting.entries.length);
    this.mount.dataset.craftingActive = active?.recipeId ?? 'none';
    this.mount.dataset.craftingProgress = active && duration > 0
      ? Math.min(1, active.elapsedSeconds / duration).toFixed(3)
      : '0';
    this.mount.dataset.craftingBlocked = blocked ?? 'none';
    this.mount.dataset.craftingCompletedCount = String(this.craftingCompletedCount);
    if (!blocked) this.lastCraftingBlockReason = null;
  }

  private applyToolWear(tool: ToolId, action: ToolWearAction): { remaining: number; broken: boolean } {
    const store = useGameStore.getState();
    if (itemCount(store.inventory, tool) <= 0) return { remaining: 0, broken: false };
    const wear = store.damageTool(tool);
    this.toolWearEventCount += 1;
    this.mount.dataset.toolWearEventCount = String(this.toolWearEventCount);
    this.mount.dataset.lastToolWear = `${action}:${tool}:${wear.remaining}`;
    this.syncToolDurabilityDiagnostics();
    if (wear.broken) {
      this.audio.playToolBreak(tool);
      this.showTransientNotice(`${ITEM_DEFINITIONS[tool].shortName}损坏 · ${TOOL_BREAK_CONTEXT[action]}`);
    } else if (wear.remaining === Math.ceil(TOOL_MAX_DURABILITY[tool] * 0.2)) {
      this.showTransientNotice(`${ITEM_DEFINITIONS[tool].shortName} · 耐久仅剩 ${wear.remaining}`);
    }
    this.saveNow();
    return wear;
  }

  private settleResonancePulse(): ResonancePulseSettlement {
    const store = useGameStore.getState();
    if (itemCount(store.inventory, 'brineCell') <= 0) return 'no-cell';
    if (!this.shark?.canReceiveResonancePulse(this.camera)) return 'miss';
    if (!store.spendItems({ brineCell: 1 })) return 'no-cell';
    if (!this.shark.receiveResonancePulse(this.camera)) {
      store.addItemBundle({ brineCell: 1 });
      return 'miss';
    }
    this.applyToolWear('resonanceFork', 'resonance-pulse');
    return 'hit';
  }

  private syncToolDurabilityDiagnostics(): void {
    const state = useGameStore.getState();
    this.mount.dataset.toolDurability = JSON.stringify(state.toolDurability);
  }

  private syncFishingDiagnostics(): void {
    const fishing = useGameStore.getState().fishing;
    const diagnostics = this.fishing?.getDiagnostics();
    this.mount.dataset.fishingPhase = fishing.phase;
    this.mount.dataset.fishingTension = fishing.tension.toFixed(3);
    this.mount.dataset.fishingProgress = fishing.progress.toFixed(3);
    this.mount.dataset.fishingPull = fishing.pull.toFixed(3);
    this.mount.dataset.fishingSpecies = fishing.species ?? 'none';
    this.mount.dataset.fishingSize = fishing.size ?? 'none';
    this.mount.dataset.fishingWeightKg = fishing.weightKg.toFixed(2);
    this.mount.dataset.fishingPortions = String(fishing.portions);
    this.mount.dataset.fishingVisibleModels = String(diagnostics?.visibleModels ?? 0);
    this.mount.dataset.fishingModelName = diagnostics?.modelName ?? 'none';
    this.mount.dataset.fishingModelScale = (diagnostics?.modelScale ?? 0).toFixed(3);
    this.mount.dataset.fishingMaterialMaps = diagnostics?.materialMaps ?? 'none';
    this.mount.dataset.fishingPhaseTime = (diagnostics?.phaseTime ?? 0).toFixed(3);
  }

  private syncCookingDiagnostics(): void {
    const diagnostics = this.devices?.getCookingDiagnostics();
    const inventory = useGameStore.getState().inventory;
    this.mount.dataset.cookingBasePhase = diagnostics?.basePhase ?? 'none';
    this.mount.dataset.cookingBaseFoodStage = diagnostics?.baseFoodStage ?? 'none';
    this.mount.dataset.cookingBaseMaterialMaps = diagnostics?.baseMaterialMaps ?? 'none';
    this.mount.dataset.cookingPurifierMaterialMaps = diagnostics?.purifierMaterialMaps ?? 'none';
    this.mount.dataset.cookingTriplePhases = diagnostics?.triplePhases ?? 'none';
    this.mount.dataset.cookingTripleFoodStages = diagnostics?.tripleFoodStages ?? 'none';
    this.mount.dataset.cookingTripleFuelSeconds = (diagnostics?.tripleFuelSeconds ?? 0).toFixed(2);
    this.mount.dataset.cookingTripleMaterialMaps = diagnostics?.tripleMaterialMaps ?? 'none';
    this.mount.dataset.cookingRawFish = String(itemCount(inventory, 'rawFish'));
    this.mount.dataset.cookingCookedFish = String(itemCount(inventory, 'cookedFish'));
    this.mount.dataset.cookingBurntFish = String(itemCount(inventory, 'burntFish'));
    this.mount.dataset.cookingTimber = String(itemCount(inventory, 'timber'));
  }

  private syncSurvivalDiagnostics(): void {
    const state = useGameStore.getState();
    this.mount.dataset.survivalThirstBand = survivalBand('thirst', state.survival.thirst);
    this.mount.dataset.survivalHungerBand = survivalBand('hunger', state.survival.hunger);
    this.mount.dataset.thirstRunwaySeconds = String(Math.round(
      survivalNeedRunwaySeconds(state.survival, state.inventory, 'thirst'),
    ));
    this.mount.dataset.hungerRunwaySeconds = String(Math.round(
      survivalNeedRunwaySeconds(state.survival, state.inventory, 'hunger'),
    ));
  }

  private handleSurvivalPressure(survival: SurvivalState): void {
    let warning: { need: 'thirst' | 'hunger'; band: SurvivalBand } | null = null;
    for (const need of ['thirst', 'hunger'] as const) {
      const band = survivalBand(need, survival[need]);
      const previous = this.lastSurvivalBands[need];
      if (
        SURVIVAL_BAND_SEVERITY[band] > SURVIVAL_BAND_SEVERITY[previous]
        && band !== 'stable'
      ) {
        if (!warning || SURVIVAL_BAND_SEVERITY[band] > SURVIVAL_BAND_SEVERITY[warning.band]) {
          warning = { need, band };
        }
      }
      this.lastSurvivalBands[need] = band;
    }
    if (!warning) return;
    const critical = warning.band === 'critical' || warning.band === 'depleted';
    this.audio.playSurvivalWarning(warning.need, critical);
    this.showTransientNotice(
      warning.need === 'thirst'
        ? warning.band === 'depleted' ? '水分耗尽 · 生命正在下降' : critical ? '严重缺水' : '水分偏低'
        : warning.band === 'depleted' ? '饱食耗尽 · 生命正在下降' : critical ? '严重饥饿' : '饱食偏低',
    );
  }

  private readonly onBeforeUnload = (): void => {
    this.saveNow();
  };

  private readonly onPageHide = (): void => {
    this.saveNow();
  };

  private updateEnvironment(delta: number, stormIntensity: number, lightning: number): void {
    const day = sampleDayCycle(this.navigation?.getEnvironmentClock() ?? this.elapsed);
    const lighting = sampleEnvironmentLighting(day.daylight, stormIntensity);
    const target = this.player?.isSubmerged()
      ? MathUtils.clamp(0.62 + (this.player?.getDepth() ?? 0) * 0.1, 0, 1)
      : 0;
    const shouldRenderShadows = useGameStore.getState().quality === 'high' && target === 0;
    if (this.renderer.shadowMap.enabled !== shouldRenderShadows) this.renderer.shadowMap.enabled = shouldRenderShadows;
    if (target > 0 && this.environmentBlend < 0.78) this.environmentBlend = 0.78;
    this.environmentBlend = MathUtils.damp(this.environmentBlend, target, target > 0 ? 3.8 : 2.6, delta);
    this.stormBlend = MathUtils.damp(this.stormBlend, stormIntensity, stormIntensity > this.stormBlend ? 1.6 : 0.72, delta);
    this.surfaceBackground
      .lerpColors(this.nightBackground, this.airBackground, day.daylight)
      .lerp(this.stormBackground, this.stormBlend);
    this.environmentColor
      .copy(this.nightWaterBackground)
      .lerp(this.waterBackground, day.daylight)
      .lerp(this.surfaceBackground, 1 - this.environmentBlend);
    if (this.scene.background instanceof Color) this.scene.background.copy(this.environmentColor);
    if (this.scene.fog instanceof FogExp2) {
      this.scene.fog.color.copy(this.environmentColor);
      const airFog = MathUtils.lerp(0.0065, 0.0145, this.stormBlend);
      this.scene.fog.density = MathUtils.lerp(airFog, 0.072, this.environmentBlend);
    }
    const airExposure = lighting.exposure + lightning * 0.2;
    this.renderer.toneMappingExposure = MathUtils.lerp(airExposure, 0.79, this.environmentBlend);
    if (this.hemisphere) this.hemisphere.intensity = MathUtils.lerp(lighting.hemisphereIntensity + lightning * 0.65, 0.82, this.environmentBlend);
    if (this.ambient) this.ambient.intensity = MathUtils.lerp(lighting.ambientIntensity, 0.7, this.environmentBlend);
    if (this.directional) {
      this.directional.intensity = MathUtils.lerp(lighting.keyIntensity + lightning * 2.4, 0.58, this.environmentBlend);
      this.directional.color.lerpColors(this.nightKeyColor, this.dayKeyColor, day.daylight);
    }
    const horizontal = Math.sqrt(Math.max(0, 1 - day.sunElevation * day.sunElevation));
    this.sunPosition.set(
      Math.cos(day.sunAzimuth) * horizontal,
      day.sunElevation,
      Math.sin(day.sunAzimuth) * horizontal,
    ).normalize();
    if (this.sky) {
      const uniforms = this.sky.material.uniforms;
      uniforms.sunPosition.value.copy(this.sunPosition);
      uniforms.turbidity.value = MathUtils.lerp(6.8, 18, this.stormBlend);
      uniforms.rayleigh.value = MathUtils.lerp(2.25, 0.72, this.stormBlend);
      uniforms.mieCoefficient.value = MathUtils.lerp(0.006, 0.028, this.stormBlend);
    }
    if (this.directional) {
      this.keyLightPosition.copy(this.sunPosition);
      this.keyLightPosition.y = Math.max(0.24, this.keyLightPosition.y);
      this.directional.position.copy(this.keyLightPosition.normalize()).multiplyScalar(70);
    }
    if (this.sky) this.sky.visible = target === 0;
    this.ocean?.setUnderwater(this.environmentBlend);
    this.ocean?.setStorm(this.stormBlend);
    this.ocean?.setEnvironment(day);
    this.mount.dataset.daylight = day.daylight.toFixed(3);
    this.mount.dataset.dayProgress = day.progress.toFixed(3);
    this.mount.dataset.weather = this.navigation?.getWeather().weatherPhase ?? 'calm';
    this.player?.getWorldFootPosition(this.playerDiagnosticWorld);
    this.mount.dataset.playerSurface = this.player?.getSurface() ?? 'raft';
    this.mount.dataset.playerAirborne = String(this.player?.isAirborne() ?? false);
    this.mount.dataset.playerJumpCount = String(this.player?.jumpCount ?? 0);
    this.mount.dataset.playerInputEnabled = String(this.player?.inputEnabled ?? false);
    this.mount.dataset.playerKeyboardEventCount = String(this.player?.keyboardEventCount ?? 0);
    this.mount.dataset.playerJumpState = this.player?.jumpState ?? 'unavailable';
    this.mount.dataset.playerVerticalHeadY = (this.player?.verticalHeadY ?? 0).toFixed(3);
    this.mount.dataset.playerVerticalVelocityY = (this.player?.verticalVelocityY ?? 0).toFixed(3);
    this.mount.dataset.playerCeilingHitCount = String(this.player?.ceilingHitCount ?? 0);
    this.mount.dataset.playerCeilingSurface = this.player?.ceilingSurface ?? 'none';
    this.mount.dataset.playerCeilingStructureId = this.player?.ceilingStructureId ?? 'none';
    this.mount.dataset.playerCeilingHeadY = (this.player?.ceilingHeadY ?? 0).toFixed(3);
    this.mount.dataset.playerCeilingVelocityY = (this.player?.ceilingVelocityY ?? 0).toFixed(3);
    this.mount.dataset.playerRaftFootY = (this.player?.raftFootY ?? 0).toFixed(3);
    this.mount.dataset.playerRaftSurface = this.player?.raftWalkableSurface ?? 'none';
    this.mount.dataset.playerLocalX = (this.player?.localPosition.x ?? 0).toFixed(3);
    this.mount.dataset.playerLocalZ = (this.player?.localPosition.z ?? 0).toFixed(3);
    this.mount.dataset.playerWorldPosition = JSON.stringify({
      x: this.playerDiagnosticWorld.x,
      y: this.playerDiagnosticWorld.y,
      z: this.playerDiagnosticWorld.z,
    });
    this.mount.dataset.raftWorldPosition = JSON.stringify({
      x: this.raft?.group.position.x ?? 0,
      y: this.raft?.group.position.y ?? 0,
      z: this.raft?.group.position.z ?? 0,
    });
    this.mount.dataset.simulationTickCount = String(this.simulationTickCount);
    this.mount.dataset.cameraY = this.camera.position.y.toFixed(3);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    this.mount.dataset.lastKeyDown = event.code;
    this.player?.handleKeyDown(event);
    this.mount.dataset.playerKeyboardEventCount = String(this.player?.keyboardEventCount ?? 0);
    this.mount.dataset.playerJumpState = this.player?.jumpState ?? 'unavailable';
    const state = useGameStore.getState();
    if (state.phase !== 'playing') return;
    if (event.code === 'Tab' || event.code === 'KeyI' || event.code === 'KeyC') {
      event.preventDefault();
      const requested = event.code === 'KeyC' ? 'crafting' : 'pack';
      const nextPanel = state.overlayPanel === requested ? null : requested;
      if (state.overlayPanel === 'storage') this.devices?.closeStorage();
      if (nextPanel !== null) state.setPlacementDevice(null);
      state.setOverlayPanel(nextPanel);
      if (nextPanel !== null && document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
      this.audio.playUi();
      return;
    }
    const digit = /^Digit([1-6])$/.exec(event.code);
    if (digit && state.overlayPanel === null && !state.settingsOpen && state.placementDevice === null) {
      const tool = preferredToolOrder(state.inventory)[Number(digit[1]) - 1];
      if (!state.setSelectedTool(tool)) {
        this.audio.playDenied();
        this.showTransientNotice('需要先制作该工具');
      }
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.player?.handleKeyUp(event);
  };

  private showTransientNotice(message: string): void {
    useGameStore.getState().showNotice(message);
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => {
      if (useGameStore.getState().notice === message) useGameStore.getState().showNotice(null);
    }, 1500);
  }
}
