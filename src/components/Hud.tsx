import {
  Anchor,
  Anvil,
  Bird,
  BrickWall,
  ChartNoAxesGantt,
  Compass,
  Columns3,
  CloudLightning,
  CookingPot,
  Droplet,
  DoorOpen,
  GlassWater,
  Heart,
  Layers3,
  Mountain,
  MousePointer2,
  Navigation,
  PackageOpen,
  PanelTop,
  RadioTower,
  Sailboat,
  ShipWheel,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sprout,
  Square,
  TriangleAlert,
  Utensils,
  Volume2,
  VolumeX,
  Waves,
  Wind,
  RotateCw,
} from 'lucide-react';
import { ITEM_DEFINITIONS, itemCount, preferredToolOrder, type Inventory, type ToolId } from '../game/domain/items';
import { TOOL_MAX_DURABILITY, toolDurabilityRatio, type ToolDurability } from '../game/domain/toolDurability';
import { survivalBand } from '../game/domain/survival';
import { ISLAND_APPROACH_SECONDS, ISLAND_DEPART_SECONDS, ISLAND_DOCK_SECONDS } from '../game/domain/island';
import { cardinalLabel } from '../game/domain/navigation';
import {
  RAFT_BUILD_PIECES,
  RAFT_BUILD_PIECE_DEFINITIONS,
  RAFT_STRUCTURE_DEFINITIONS,
  type RaftBuildPiece,
} from '../game/domain/raftStructures';
import type {
  BuildFeedback,
  DeviceFeedbackMap,
  FishingFeedback,
  IslandFeedback,
  NavigationFeedback,
  PlantingFeedback,
  ProgressionFeedback,
  PlayerFeedback,
  RaftFeedback,
  ReefFeedback,
  SharkFeedback,
  PlacementType,
} from '../state/gameStore';
import { ItemIcon } from './ItemIcon';

interface HudProps {
  visible: boolean;
  ready: boolean;
  pointerLocked: boolean;
  overlayOpen: boolean;
  pointerLockDenied: boolean;
  audioEnabled: boolean;
  selectedTool: ToolId;
  hookCharge: number;
  inventory: Inventory;
  toolDurability: ToolDurability;
  survival: { health: number; thirst: number; hunger: number; oxygen: number };
  player: PlayerFeedback;
  fishing: FishingFeedback;
  shark: SharkFeedback;
  raft: RaftFeedback;
  build: BuildFeedback;
  devices: DeviceFeedbackMap;
  navigation: NavigationFeedback;
  planting: PlantingFeedback;
  progression: ProgressionFeedback;
  island: IslandFeedback;
  reef: ReefFeedback;
  placementDevice: PlacementType | null;
  interaction: string | null;
  notice: string | null;
  fps: number;
  onResume: () => void;
  onSettings: () => void;
  onToggleAudio: () => void;
  onSelectTool: (tool: ToolId) => void;
  onOpenPack: () => void;
}

interface GaugeProps {
  icon: React.ReactNode;
  value: number;
  tone: 'health' | 'thirst' | 'hunger' | 'oxygen';
  label: string;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

function BuildPieceIcon({ piece, size = 18 }: { piece: RaftBuildPiece; size?: number }) {
  if (piece === 'foundation') return <Square size={size} />;
  if (piece === 'wall') return <BrickWall size={size} />;
  if (piece === 'door') return <DoorOpen size={size} />;
  if (piece === 'pillar') return <Columns3 size={size} />;
  if (piece === 'stairs') return <ChartNoAxesGantt size={size} />;
  if (piece === 'floor') return <Layers3 size={size} />;
  return <PanelTop size={size} />;
}

function Gauge({ icon, value, tone, label }: GaugeProps) {
  const rounded = Math.round(value);
  const band = survivalBand(tone, value);
  return (
    <div
      className={`survival-gauge survival-gauge--${tone} is-${band}`}
      aria-label={`${label} ${rounded}${band === 'critical' || band === 'depleted' ? ' 危险' : band === 'low' ? ' 偏低' : ''}`}
    >
      <span className="survival-gauge__icon">{icon}</span>
      <span className="survival-gauge__track">
        <span className="survival-gauge__fill" style={{ width: `${rounded}%` }} />
      </span>
      <strong aria-hidden="true">{rounded}</strong>
    </div>
  );
}

export function Hud({
  visible,
  ready,
  pointerLocked,
  overlayOpen,
  pointerLockDenied,
  audioEnabled,
  selectedTool,
  hookCharge,
  inventory,
  toolDurability,
  survival,
  player,
  fishing,
  shark,
  raft,
  build,
  devices,
  navigation,
  planting,
  progression,
  island,
  reef,
  placementDevice,
  interaction,
  notice,
  fps,
  onResume,
  onSettings,
  onToggleAudio,
  onSelectTool,
  onOpenPack,
}: HudProps) {
  const sharkAlert = shark.mode === 'approaching' || shark.mode === 'attacking';
  const fishingActive = fishing.phase === 'hooked';
  const structureRepair = build.repairTarget;
  const structureRepairDefinition = structureRepair
    ? RAFT_STRUCTURE_DEFINITIONS[structureRepair.type]
    : null;
  const displayedBuildCost = structureRepairDefinition?.repairCost
    ?? RAFT_BUILD_PIECE_DEFINITIONS[build.piece].cost;
  const placedDeviceTypes = island.ashore
    ? []
    : (['purifier', 'grill', 'solarPurifier', 'tripleGrill', 'locker'] as const)
      .filter((type) => devices[type].placed > 0);
  const planterVisible = !island.ashore && planting.placed > 0;
  const progressionVisible = !island.ashore && (
    progression.researchBenches > 0 || progression.dryingRacks > 0 || progression.smelters > 0
  );
  const reefExpedition = player.surface === 'water' && island.phase === 'docked';
  const stormAlert = player.surface !== 'water' && (
    navigation.stormIntensity > 0.58 || navigation.sailStrain > 0.62 || navigation.anchorStrain > 0.62
  );
  const routeLabel = navigation.routeMode === 'manual'
    ? '自由航向'
    : navigation.routeMode === 'island'
      ? '追踪浅滩'
      : navigation.routeMode === 'shelter'
        ? '顺风避险'
        : '追踪信号';
  const signalVisible = player.surface === 'raft' && (navigation.receiverInstalled || navigation.antennaInstalled);
  const signalCharge = clampPercent(navigation.receiverCharge / 3.6);
  const signalStatus = navigation.receiverOn && navigation.activeSignalName
    ? navigation.activeSignalName
    : navigation.signalArrayStatus === 'missing-receiver'
      ? '等待接收台'
      : navigation.signalArrayStatus === 'missing-antenna'
        ? '等待定向阵列'
        : navigation.signalArrayStatus === 'too-close'
          ? '相位串扰'
          : navigation.signalArrayStatus === 'too-far'
            ? '馈线损耗'
            : navigation.receiverCharge <= 0
              ? '电池耗尽'
              : '阵列待机';
  const weatherLabel = navigation.anchorStrain > 0.78 && navigation.anchored
    ? '锚机接近回滑载荷'
    : navigation.sailStrain > 0.78
      ? '帆具接近过载'
    : navigation.weatherPhase === 'storm'
      ? '强风暴横穿航线'
      : navigation.weatherPhase === 'building'
        ? '积云正在压近'
        : '风暴正在远离';
  const resourceItems = reefExpedition
    ? (['sand', 'clay', 'metalOre', 'seaweed', 'scrap'] as const)
    : (['timber', 'polymer', 'fiber', 'scrap', 'stone'] as const);
  const islandProgress = reefExpedition
    ? reef.total > 0
      ? reef.harvested / reef.total
      : 0
    : island.phase === 'approaching'
      ? 1 - island.remaining / ISLAND_APPROACH_SECONDS
      : island.phase === 'docked'
        ? navigation.anchored && !island.ashore
          ? 1
          : island.ashore
          ? island.total > 0
            ? island.harvested / island.total
            : 0
          : island.remaining / ISLAND_DOCK_SECONDS
        : island.remaining / ISLAND_DEPART_SECONDS;
  const islandMetric = reefExpedition
    ? `${reef.harvested}/${reef.total}`
    : island.phase === 'approaching'
      ? `${island.distance} m`
      : island.phase === 'docked'
        ? navigation.anchored
          ? island.ashore
            ? `${island.harvested}/${island.total}`
            : '已锚泊'
          : `${Math.floor(island.remaining / 60)}:${String(island.remaining % 60).padStart(2, '0')}`
        : '离流';
  const islandStatus = reefExpedition
    ? '浅礁采集'
    : island.phase === 'approaching'
      ? '正在接近'
      : island.phase === 'docked'
        ? navigation.anchored
          ? island.ashore
            ? '锚泊采集'
            : '锚泊稳固'
          : island.ashore
            ? '木筏离流'
            : '短暂靠近'
        : '正在远离';
  return (
    <section className={`hud ${visible ? 'is-visible' : ''}`} aria-hidden={!visible}>
      <div className="resource-strip">
        {resourceItems.map((itemId) => (
          <div className="resource-readout" title={ITEM_DEFINITIONS[itemId].name} key={itemId}>
            <ItemIcon itemId={itemId} size={18} style={{ color: ITEM_DEFINITIONS[itemId].tone }} />
            <strong>{itemCount(inventory, itemId)}</strong>
          </div>
        ))}
        <button className="resource-pack-button" type="button" onClick={onOpenPack} aria-label="打开背包" title="背包">
          <PackageOpen size={18} />
        </button>
      </div>

      <div className="raft-readout" aria-label={`木筏完整度 ${raft.averageIntegrity}%`}>
        {raft.damagedTiles > 0 ? <ShieldAlert size={17} /> : <ShieldCheck size={17} />}
        <span>{raft.averageIntegrity}%</span>
        <i><b style={{ width: `${raft.averageIntegrity}%` }} /></i>
      </div>

      <div
        className={`island-readout island-readout--${island.phase} ${island.ashore ? 'is-ashore' : ''} ${navigation.driftRisk ? 'is-drift-risk' : ''}`}
        aria-label={`盐冠浅滩 ${islandStatus} ${islandMetric}`}
      >
        {reefExpedition ? <Waves size={19} /> : <Mountain size={19} />}
        <div>
          <span>盐冠浅滩</span>
          <strong>{islandStatus}</strong>
          <i><b style={{ width: `${clampPercent(islandProgress * 100)}%` }} /></i>
        </div>
        <em>{islandMetric}</em>
      </div>

      <div
        className={`navigation-readout ${navigation.sailDeployed ? 'is-sailing' : ''} ${navigation.sailReinforced ? 'is-reinforced' : ''} ${navigation.anchorReinforced ? 'is-anchor-reinforced' : ''} ${navigation.anchored ? 'is-anchored' : ''} ${navigation.stormIntensity > 0.3 ? 'is-storm' : ''} ${navigation.driftRisk ? 'is-drift-risk' : ''}`}
        aria-label={`${routeLabel} 航向${cardinalLabel(navigation.courseAngle)} 风力利用${Math.round(navigation.windCapture * 100)}% 航速${navigation.speedKnots.toFixed(1)}节${navigation.helmInstalled ? ' 已安装舵台' : ''}${navigation.sailReinforced ? ' 帆具已强化' : ''}${navigation.anchorReinforced ? ' 锚机已强化' : ''}${navigation.anchored ? ' 已锚泊' : ''}`}
      >
        <Compass size={18} style={{ transform: `rotate(${navigation.heading}rad)` }} />
        <div className="navigation-readout__course">
          <span>{routeLabel}</span>
          <strong>{cardinalLabel(navigation.courseAngle)}</strong>
        </div>
        <div className="navigation-readout__wind">
          {navigation.stormIntensity > 0.3
            ? <CloudLightning size={16} />
            : <Wind size={16} style={{ transform: `rotate(${navigation.windAngle - navigation.heading}rad)` }} />}
          <i><b style={{ width: `${clampPercent(navigation.windCapture * 100)}%` }} /></i>
        </div>
        <em>{navigation.speedKnots.toFixed(1)} kn</em>
        <Sailboat className={navigation.sailInstalled ? 'is-installed' : ''} size={16} />
        <ShipWheel className={navigation.helmInstalled ? 'is-installed' : ''} size={16} />
        <Anchor className={`${navigation.anchorInstalled ? 'is-installed' : ''} ${navigation.anchorReinforced ? 'is-reinforced' : ''}`} size={16} />
      </div>

      <div
        className={`signal-readout ${signalVisible ? 'is-visible' : ''} ${navigation.receiverOn ? 'is-online' : ''} ${navigation.signalArrayStatus !== 'ready' ? 'is-fault' : ''}`}
        aria-label={`${signalStatus}${navigation.activeSignalFrequency ? ` 频率${navigation.activeSignalFrequency}` : ''}${navigation.signalDistance !== null ? ` 距离${Math.round(navigation.signalDistance)}米` : ''} 电量${Math.round(signalCharge)}%`}
      >
        <RadioTower size={19} />
        <div>
          <span>{navigation.activeSignalFrequency ? `${navigation.activeSignalFrequency} MHz` : '潮听链路'}</span>
          <strong>{signalStatus}</strong>
          <i><b style={{ width: `${signalCharge}%` }} /></i>
        </div>
        <em>
          {navigation.signalBearing !== null && (
            <Navigation size={13} style={{ transform: `rotate(${navigation.signalBearing - navigation.heading}rad)` }} />
          )}
          {navigation.receiverOn && navigation.signalDistance !== null
            ? `${Math.round(navigation.signalDistance)} m`
            : `${navigation.visitedSignals}/${Math.max(1, navigation.discoveredSignals)}`}
        </em>
      </div>

      <div className={`weather-warning ${stormAlert ? 'is-visible' : ''} ${signalVisible ? 'has-signal' : ''}`} aria-live="polite">
        <CloudLightning size={18} />
        <div>
          <span>{weatherLabel}</span>
          <i><b style={{ width: `${Math.round(Math.max(navigation.stormIntensity, navigation.sailStrain, navigation.anchorStrain) * 100)}%` }} /></i>
        </div>
      </div>

      <div className={`dive-readout ${player.surface === 'water' ? 'is-visible' : ''}`} aria-label={`潜深 ${player.depth.toFixed(1)} 米`}>
        <Waves size={17} />
        <span>{player.submerged ? '潜深' : '水面'}</span>
        <strong>{player.depth.toFixed(1)} m</strong>
      </div>

      <div className="hud-actions">
        <span className="fps-readout" aria-label={`${fps} FPS`}>{fps || '--'}</span>
        <button className="hud-icon" type="button" onClick={onToggleAudio} aria-label={audioEnabled ? '关闭声音' : '开启声音'} title={audioEnabled ? '关闭声音' : '开启声音'}>
          {audioEnabled ? <Volume2 size={19} /> : <VolumeX size={19} />}
        </button>
        <button className="hud-icon" type="button" onClick={onSettings} aria-label="设置" title="设置">
          <Settings size={19} />
        </button>
      </div>

      <div className={`shark-warning ${stormAlert ? 'has-weather-alert' : ''} ${sharkAlert ? 'is-visible' : ''}`} aria-live="polite">
        <TriangleAlert size={18} />
        <div>
          <span>{shark.target === 'player'
            ? (shark.mode === 'attacking' ? '深潮鲨正在扑咬' : '深潮鲨锁定了你')
            : shark.target === 'structure'
              ? (shark.mode === 'attacking' ? '暴露结构遭到撕咬' : '脆弱结构已被锁定')
              : shark.mode === 'attacking' ? '筏体遭到撕咬' : '深潮鲨正在逼近'}</span>
          <i><b style={{ width: `${Math.round(shark.threat * 100)}%` }} /></i>
        </div>
      </div>

      <div className={`crop-warning ${planting.birdActive ? 'is-visible' : ''} ${stormAlert ? 'has-weather-alert' : ''} ${sharkAlert ? 'has-shark-alert' : ''} ${stormAlert && sharkAlert ? 'has-weather-and-shark' : ''}`} aria-live="polite">
        <Bird size={18} />
        <div>
          <span>{planting.birdThreat > 0.8 ? '盐翼盗鸟正在啄食作物' : '盐翼盗鸟正在逼近'}</span>
          <i><b style={{ width: `${Math.round(planting.birdThreat * 100)}%` }} /></i>
        </div>
      </div>

      <div className="survival-cluster">
        <Gauge icon={<Heart size={18} fill="currentColor" />} value={survival.health} tone="health" label="生命" />
        <Gauge icon={<Droplet size={18} fill="currentColor" />} value={survival.thirst} tone="thirst" label="口渴" />
        <Gauge icon={<Utensils size={18} />} value={survival.hunger} tone="hunger" label="饥饿" />
        {player.surface === 'water' && (
          <Gauge icon={<Waves size={18} />} value={survival.oxygen} tone="oxygen" label="氧气" />
        )}
      </div>

      <div className="hotbar" aria-label="快捷工具">
        {preferredToolOrder(inventory).map((tool) => {
          const unlocked = itemCount(inventory, tool) > 0;
          const remainingDurability = toolDurability[tool] ?? TOOL_MAX_DURABILITY[tool];
          const durabilityRatio = unlocked
            ? toolDurabilityRatio({ [tool]: remainingDurability }, tool)
            : 0;
          return (
            <button
              className={`hotbar-slot ${selectedTool === tool ? 'is-active' : ''} ${unlocked ? '' : 'is-locked'} ${durabilityRatio <= 0.2 && unlocked ? 'is-worn' : ''}`}
              type="button"
              title={unlocked ? `${ITEM_DEFINITIONS[tool].name} · 耐久 ${remainingDurability}/${TOOL_MAX_DURABILITY[tool]}` : '尚未制作'}
              aria-label={unlocked ? `${ITEM_DEFINITIONS[tool].name}，耐久 ${remainingDurability}` : `${ITEM_DEFINITIONS[tool].name}，尚未制作`}
              disabled={!unlocked}
              onClick={() => onSelectTool(tool)}
              key={tool}
            >
              <ItemIcon itemId={tool} size={25} />
              {unlocked && (
                <span className="hotbar-slot__durability" aria-hidden="true">
                  <i style={{ transform: `scaleX(${durabilityRatio})` }} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div
        className={`build-palette ${selectedTool === 'hammer' && !placementDevice ? 'is-visible' : ''} is-${build.mode} ${build.valid ? 'is-valid' : 'is-invalid'}`}
        aria-label={structureRepair && structureRepairDefinition
          ? `修补${structureRepairDefinition.name}，完整度 ${structureRepair.health}/${structureRepair.maxHealth}`
          : `${RAFT_BUILD_PIECE_DEFINITIONS[build.piece].name}，${build.level + 1}层，朝向${['北', '东', '南', '西'][build.rotation]}，筏上结构 ${build.structures} 件`}
      >
        <div className="build-palette__pieces" aria-hidden="true">
          {RAFT_BUILD_PIECES.map((piece) => (
            <span className={piece === build.piece ? 'is-active' : ''} key={piece}>
              <BuildPieceIcon piece={piece} size={17} />
            </span>
          ))}
        </div>
        <div className="build-palette__meta">
          <strong>{structureRepairDefinition ? `修补${structureRepairDefinition.shortName}` : RAFT_BUILD_PIECE_DEFINITIONS[build.piece].shortName}</strong>
          <span>
            {structureRepair
              ? <><ShieldAlert size={12} />{structureRepair.health}/{structureRepair.maxHealth}</>
              : <><RotateCw size={12} />{['北', '东', '南', '西'][build.rotation]}<small>{build.level + 1}层</small></>}
          </span>
          <div aria-label={structureRepair ? '修补成本' : '建造成本'}>
            {(Object.entries(displayedBuildCost) as [keyof Inventory, number][]).map(([itemId, amount]) => (
              <i className={itemCount(inventory, itemId) < amount ? 'is-missing' : ''} key={itemId}>
                <ItemIcon itemId={itemId} size={12} />
                <b>{amount}</b>
              </i>
            ))}
          </div>
          <em>{structureRepair ? `${Math.round((structureRepair.health / structureRepair.maxHealth) * 100)}%` : build.structures}</em>
        </div>
      </div>

      <div className={`crosshair ${fishing.phase === 'nibble' ? 'is-nibble' : ''} ${sharkAlert && (selectedTool === 'spear' || selectedTool === 'metalSpear') ? 'is-danger' : ''}`} aria-hidden="true">
        <i /><i /><i /><i />
      </div>

      <div className={`hook-charge ${hookCharge > 0 ? 'is-active' : ''}`} aria-hidden={hookCharge <= 0}>
        <span style={{ transform: `scaleX(${hookCharge})` }} />
      </div>

      <div className={`fishing-fight ${fishingActive ? 'is-visible' : ''}`} aria-hidden={!fishingActive}>
        <div className="fishing-fight__row">
          <span>线张力</span>
          <i className="fishing-fight__tension"><b style={{ width: `${fishing.tension * 100}%` }} /></i>
        </div>
        <div className="fishing-fight__row">
          <span>收线</span>
          <i className="fishing-fight__progress"><b style={{ width: `${fishing.progress * 100}%` }} /></i>
        </div>
      </div>

      <div
        className={`device-rack ${placedDeviceTypes.length > 0 || planterVisible || progressionVisible ? 'is-visible' : ''} ${sharkAlert || planting.birdActive ? 'has-threat' : ''} ${sharkAlert && planting.birdActive ? 'has-two-threats' : ''}`}
        aria-label="筏上设备状态"
      >
        {placedDeviceTypes.map((type) => {
          const status = devices[type];
          const label =
            type === 'locker'
              ? '已密封'
              : status.burnt > 0
                ? `${status.burnt} 份焦黑`
                : status.ready > 0
                  ? `${status.ready} 份可取`
                  : status.working > 0
                    ? `${status.working} 份运行`
                    : '待机';
          const phase = type === 'locker' ? 'idle' : status.burnt > 0 ? 'burnt' : status.ready > 0 ? 'ready' : status.working > 0 ? 'working' : 'idle';
          const name = type === 'purifier'
            ? '净水器'
            : type === 'grill'
              ? '烤架'
              : type === 'solarPurifier'
                ? '五联净水'
                : type === 'tripleGrill'
                  ? '三槽烤台'
                  : '干舱储物';
          return (
            <div className={`device-status device-status--${type} device-status--${phase}`} key={type}>
              {type === 'purifier' || type === 'solarPurifier'
                ? <GlassWater size={18} />
                : type === 'locker'
                  ? <PackageOpen size={18} />
                  : <CookingPot size={18} />}
              <div>
                <span>{name}</span>
                <i><b style={{ width: `${status.progress * 100}%` }} /></i>
              </div>
              <strong>{label}</strong>
            </div>
          );
        })}
        {planterVisible && (() => {
          const phase = planting.birdActive
            ? 'threatened'
            : planting.withered > 0
              ? 'withered'
              : planting.dry > 0
                ? 'dry'
                : planting.mature > 0
                  ? 'ready'
                  : planting.growing > 0
                    ? 'working'
                    : 'idle';
          const label = planting.birdActive
            ? '受袭'
            : planting.withered > 0
              ? '枯萎'
              : planting.dry > 0
                ? '缺水'
                : planting.mature > 0
                  ? '可收获'
                  : planting.growing > 0
                    ? '生长中'
                    : '待播种';
          return (
            <div className={`device-status device-status--planter device-status--${phase}`}>
              <Sprout size={18} />
              <div>
                <span>作物盆</span>
                <i><b style={{ width: `${planting.progress * 100}%` }} /></i>
              </div>
              <strong>{label}</strong>
            </div>
          );
        })()}
        {progressionVisible && (() => {
          const phase = progression.ready > 0
            ? 'ready'
            : progression.working > 0
              ? 'working'
              : progression.dryBricks > 0
                ? 'ready'
                : progression.wetBricks > 0
                  ? 'working'
              : progression.learnable > 0
                ? 'research'
                : 'idle';
          const label = progression.ready > 0
            ? '金属锭可收取'
            : progression.working > 0
                ? '熔炼中'
              : progression.dryBricks > 0
                ? `${progression.dryBricks} 块干砖`
                : progression.wetBricks > 0
                  ? '晾干中'
                  : progression.learnable > 0
                    ? `${progression.learnable} 项可学习`
                    : '待研究';
          return (
            <div className={`device-status device-status--progression device-status--${phase}`}>
              <Anvil size={18} />
              <div>
                <span>研究·冶炼</span>
                <i><b style={{ width: `${progression.progress * 100}%` }} /></i>
              </div>
              <strong>{label}</strong>
            </div>
          );
        })()}
      </div>

      <div className={`interaction-prompt ${interaction ? 'is-visible' : ''} ${placementDevice ? 'is-placement' : ''}`}>{interaction}</div>
      <div className={`loot-notice ${notice ? 'is-visible' : ''}`} aria-live="polite">{notice}</div>

      {!pointerLocked && visible && !overlayOpen && (
        <div className="focus-prompt" role="dialog" aria-modal="true" aria-labelledby="focus-prompt-heading">
          <div className="focus-prompt__content">
            <span className="focus-prompt__mark" aria-hidden="true"><ShipWheel size={25} /></span>
            <p>航程暂停</p>
            <h2 id="focus-prompt-heading">DRIFTWAKE</h2>
            <div className={`focus-prompt__status ${!ready || pointerLockDenied ? 'is-denied' : ''}`}>
              {!ready || pointerLockDenied ? <TriangleAlert size={14} /> : <i />}
              <span>{!ready ? '图形海况恢复中' : pointerLockDenied ? '浏览器未开放视角锁定' : '海面已就绪'}</span>
            </div>
            <div className="focus-prompt__actions">
              <button className="focus-prompt__resume" type="button" onClick={onResume} disabled={!ready}>
                <MousePointer2 size={20} />
                <span>{!ready ? '等待恢复' : pointerLockDenied ? '重试继续' : '继续漂流'}</span>
              </button>
              <button className="focus-prompt__settings" type="button" onClick={onSettings} aria-label="设置" title="设置">
                <Settings size={20} />
              </button>
            </div>
          </div>
          <span className="focus-prompt__voyage">VOYAGE 01 / OPEN WATER</span>
        </div>
      )}
    </section>
  );
}
