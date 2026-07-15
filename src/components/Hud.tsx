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
import type { EnvironmentHudSnapshot, InventorySnapshot, RenderStatsSnapshot } from '../state/gameStore';
import type { PlayerLocomotionMode } from '../game/player/locomotion';

interface HudProps {
  visible: boolean;
  pointerLocked: boolean;
  audioEnabled: boolean;
  playerMode: PlayerLocomotionMode;
  environmentHud: EnvironmentHudSnapshot;
  hookCharge: number;
  inventory: InventorySnapshot;
  survival: { health: number; thirst: number; hunger: number };
  notice: string | null;
  fps: number;
  renderStats: RenderStatsSnapshot;
  onResume: () => void;
  onSettings: () => void;
  onToggleAudio: () => void;
}

const WEATHER_LABELS: Record<EnvironmentHudSnapshot['weather'], string> = {
  calm: '晴静',
  breeze: '起风',
  rain: '阴雨',
  storm: '风暴',
};
const WIND_ARROWS = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'] as const;

function formatEnvironmentTime(dayProgress: number): string {
  const totalMinutes = Math.floor((dayProgress * 24 * 60 + 12 * 60) % (24 * 60));
  const hours = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const minutes = (totalMinutes % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function getWindArrow(x: number, z: number): string {
  const angle = Math.atan2(z, x);
  const normalized = (angle + Math.PI * 2) % (Math.PI * 2);
  const index = Math.round(normalized / (Math.PI * 2) * WIND_ARROWS.length) % WIND_ARROWS.length;
  return WIND_ARROWS[index];
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
  playerMode,
  environmentHud,
  hookCharge,
  inventory,
  survival,
  notice,
  fps,
  renderStats,
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

      <div
        className={`environment-readout environment-readout--${environmentHud.weather}`}
        data-risk={environmentHud.risk >= 0.75 ? 'high' : environmentHud.risk >= 0.45 ? 'medium' : 'low'}
        aria-label={`${WEATHER_LABELS[environmentHud.weather]}，${formatEnvironmentTime(environmentHud.dayProgress)}，风力 ${Math.round(environmentHud.windStrength * 6)} 级`}
      >
        <strong>{WEATHER_LABELS[environmentHud.weather]}</strong>
        <span>{formatEnvironmentTime(environmentHud.dayProgress)}</span>
        <span>{getWindArrow(environmentHud.windDirectionX, environmentHud.windDirectionZ)} {Math.round(environmentHud.windStrength * 6)} 级风</span>
      </div>

      <div className="hud-actions">
        <span
          className="fps-readout"
          data-fps={fps || ''}
          aria-label={`${fps} FPS，渲染比例 ${Math.round(renderStats.renderScale * 100)}%，${renderStats.drawCalls} 次绘制调用`}
          title={`DPR ${renderStats.pixelRatio.toFixed(2)} · ${renderStats.triangles.toLocaleString()} triangles · ${renderStats.geometries} geometries · ${renderStats.textures} textures`}
        >
          <strong>{fps || '--'}</strong>
          <small>{Math.round(renderStats.renderScale * 100)}% · {renderStats.drawCalls} DC</small>
        </span>
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

      <div
        className={`locomotion-hint ${playerMode === 'swimming' ? 'is-visible' : ''}`}
        aria-hidden={playerMode !== 'swimming'}
        aria-live="polite"
      >
        <strong>水中行动</strong>
        <span>WASD 游动 · C / CTRL 下潜 · SPACE 上浮或攀回木筏</span>
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

