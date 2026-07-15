import {
  Anchor,
  Axe,
  Droplet,
  Fish,
  Hammer,
  Heart,
  Leaf,
  MousePointer2,
  Package,
  Recycle,
  Settings,
  TreePine,
  Utensils,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { InventorySnapshot } from '../state/gameStore';

interface HudProps {
  visible: boolean;
  pointerLocked: boolean;
  audioEnabled: boolean;
  hookCharge: number;
  inventory: InventorySnapshot;
  survival: { health: number; thirst: number; hunger: number };
  notice: string | null;
  fps: number;
  onResume: () => void;
  onSettings: () => void;
  onToggleAudio: () => void;
}

interface GaugeProps {
  icon: React.ReactNode;
  value: number;
  tone: 'health' | 'thirst' | 'hunger';
  label: string;
}

function Gauge({ icon, value, tone, label }: GaugeProps) {
  return (
    <div className={`survival-gauge survival-gauge--${tone}`} aria-label={`${label} ${value}`}>
      <span className="survival-gauge__icon">{icon}</span>
      <span className="survival-gauge__track">
        <span className="survival-gauge__fill" style={{ width: `${value}%` }} />
      </span>
    </div>
  );
}

export function Hud({
  visible,
  pointerLocked,
  audioEnabled,
  hookCharge,
  inventory,
  survival,
  notice,
  fps,
  onResume,
  onSettings,
  onToggleAudio,
}: HudProps) {
  return (
    <section className={`hud ${visible ? 'is-visible' : ''}`} aria-hidden={!visible}>
      <div className="resource-strip">
        <div className="resource-readout" title="木料">
          <TreePine size={18} />
          <strong>{inventory.timber}</strong>
        </div>
        <div className="resource-readout" title="聚合片">
          <Recycle size={18} />
          <strong>{inventory.polymer}</strong>
        </div>
        <div className="resource-readout" title="纤维">
          <Leaf size={18} />
          <strong>{inventory.fiber}</strong>
        </div>
        <div className="resource-readout" title="补给箱">
          <Package size={18} />
          <strong>{inventory.cache}</strong>
        </div>
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

      <div className="survival-cluster">
        <Gauge icon={<Heart size={18} fill="currentColor" />} value={survival.health} tone="health" label="生命" />
        <Gauge icon={<Droplet size={18} fill="currentColor" />} value={survival.thirst} tone="thirst" label="口渴" />
        <Gauge icon={<Utensils size={18} />} value={survival.hunger} tone="hunger" label="饥饿" />
      </div>

      <div className="hotbar" aria-label="快捷栏">
        <div className="hotbar-slot is-active" title="打捞钩">
          <span className="hotbar-slot__number">1</span>
          <Anchor size={25} />
        </div>
        <div className="hotbar-slot" title="建造锤">
          <span className="hotbar-slot__number">2</span>
          <Hammer size={24} />
        </div>
        <div className="hotbar-slot is-locked" title="斧">
          <span className="hotbar-slot__number">3</span>
          <Axe size={23} />
        </div>
        <div className="hotbar-slot is-locked" title="钓竿">
          <span className="hotbar-slot__number">4</span>
          <Fish size={24} />
        </div>
        <div className="hotbar-slot is-empty"><span className="hotbar-slot__number">5</span></div>
        <div className="hotbar-slot is-empty"><span className="hotbar-slot__number">6</span></div>
      </div>

      <div className="crosshair" aria-hidden="true"><i /><i /><i /><i /></div>

      <div className={`hook-charge ${hookCharge > 0 ? 'is-active' : ''}`} aria-hidden={hookCharge <= 0}>
        <span style={{ transform: `scaleX(${hookCharge})` }} />
      </div>

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

