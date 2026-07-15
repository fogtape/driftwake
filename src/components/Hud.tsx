import {
  CookingPot,
  Droplet,
  GlassWater,
  Heart,
  MousePointer2,
  PackageOpen,
  Settings,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  Utensils,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ITEM_DEFINITIONS, TOOL_ORDER, itemCount, type Inventory, type ToolId } from '../game/domain/items';
import type { DeviceFeedbackMap, FishingFeedback, RaftFeedback, SharkFeedback } from '../state/gameStore';
import type { DeviceType } from '../game/domain/devices';
import { ItemIcon } from './ItemIcon';

interface HudProps {
  visible: boolean;
  pointerLocked: boolean;
  audioEnabled: boolean;
  selectedTool: ToolId;
  hookCharge: number;
  inventory: Inventory;
  survival: { health: number; thirst: number; hunger: number };
  fishing: FishingFeedback;
  shark: SharkFeedback;
  raft: RaftFeedback;
  devices: DeviceFeedbackMap;
  placementDevice: DeviceType | null;
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
  tone: 'health' | 'thirst' | 'hunger';
  label: string;
}

function Gauge({ icon, value, tone, label }: GaugeProps) {
  const rounded = Math.round(value);
  return (
    <div className={`survival-gauge survival-gauge--${tone}`} aria-label={`${label} ${rounded}`}>
      <span className="survival-gauge__icon">{icon}</span>
      <span className="survival-gauge__track">
        <span className="survival-gauge__fill" style={{ width: `${rounded}%` }} />
      </span>
    </div>
  );
}

export function Hud({
  visible,
  pointerLocked,
  audioEnabled,
  selectedTool,
  hookCharge,
  inventory,
  survival,
  fishing,
  shark,
  raft,
  devices,
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
  const placedDeviceTypes = (['purifier', 'grill'] as const).filter((type) => devices[type].placed > 0);
  return (
    <section className={`hud ${visible ? 'is-visible' : ''}`} aria-hidden={!visible}>
      <div className="resource-strip">
        {(['timber', 'polymer', 'fiber', 'scrap'] as const).map((itemId) => (
          <div className="resource-readout" title={ITEM_DEFINITIONS[itemId].name} key={itemId}>
            <ItemIcon itemId={itemId} size={18} />
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

      <div className="hud-actions">
        <span className="fps-readout" aria-label={`${fps} FPS`}>{fps || '--'}</span>
        <button className="hud-icon" type="button" onClick={onToggleAudio} aria-label={audioEnabled ? '关闭声音' : '开启声音'} title={audioEnabled ? '关闭声音' : '开启声音'}>
          {audioEnabled ? <Volume2 size={19} /> : <VolumeX size={19} />}
        </button>
        <button className="hud-icon" type="button" onClick={onSettings} aria-label="设置" title="设置">
          <Settings size={19} />
        </button>
      </div>

      <div className={`shark-warning ${sharkAlert ? 'is-visible' : ''}`} aria-live="polite">
        <TriangleAlert size={18} />
        <div>
          <span>{shark.mode === 'attacking' ? '结构遭到撕咬' : '深潮鲨正在逼近'}</span>
          <i><b style={{ width: `${Math.round(shark.threat * 100)}%` }} /></i>
        </div>
      </div>

      <div className="survival-cluster">
        <Gauge icon={<Heart size={18} fill="currentColor" />} value={survival.health} tone="health" label="生命" />
        <Gauge icon={<Droplet size={18} fill="currentColor" />} value={survival.thirst} tone="thirst" label="口渴" />
        <Gauge icon={<Utensils size={18} />} value={survival.hunger} tone="hunger" label="饥饿" />
      </div>

      <div className="hotbar" aria-label="快捷工具">
        {TOOL_ORDER.map((tool) => {
          const unlocked = itemCount(inventory, tool) > 0;
          return (
            <button
              className={`hotbar-slot ${selectedTool === tool ? 'is-active' : ''} ${unlocked ? '' : 'is-locked'}`}
              type="button"
              title={unlocked ? ITEM_DEFINITIONS[tool].name : '尚未制作'}
              aria-label={ITEM_DEFINITIONS[tool].name}
              disabled={!unlocked}
              onClick={() => onSelectTool(tool)}
              key={tool}
            >
              <ItemIcon itemId={tool} size={25} />
            </button>
          );
        })}
      </div>

      <div className={`crosshair ${fishing.phase === 'nibble' ? 'is-nibble' : ''} ${sharkAlert && selectedTool === 'spear' ? 'is-danger' : ''}`} aria-hidden="true">
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

      <div className={`device-rack ${placedDeviceTypes.length > 0 ? 'is-visible' : ''}`} aria-label="筏上设备状态">
        {placedDeviceTypes.map((type) => {
          const status = devices[type];
          const label =
            status.burnt > 0 ? '焦黑' : status.ready > 0 ? '可收取' : status.working > 0 ? '运行中' : '待机';
          const phase = status.burnt > 0 ? 'burnt' : status.ready > 0 ? 'ready' : status.working > 0 ? 'working' : 'idle';
          return (
            <div className={`device-status device-status--${type} device-status--${phase}`} key={type}>
              {type === 'purifier' ? <GlassWater size={18} /> : <CookingPot size={18} />}
              <div>
                <span>{type === 'purifier' ? '净水器' : '烤架'}</span>
                <i><b style={{ width: `${status.progress * 100}%` }} /></i>
              </div>
              <strong>{label}</strong>
            </div>
          );
        })}
      </div>

      <div className={`interaction-prompt ${interaction ? 'is-visible' : ''} ${placementDevice ? 'is-placement' : ''}`}>{interaction}</div>
      <div className={`loot-notice ${notice ? 'is-visible' : ''}`} aria-live="polite">{notice}</div>

      {!pointerLocked && visible && (
        <div className="focus-prompt">
          <button type="button" onClick={onResume}>
            <MousePointer2 size={21} />
            <span>继续漂流</span>
          </button>
        </div>
      )}
    </section>
  );
}
