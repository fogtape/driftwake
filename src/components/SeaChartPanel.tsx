import {
  ArrowUp,
  Check,
  Crosshair,
  LockKeyhole,
  Map as MapIcon,
  Navigation,
  RadioTower,
  Sailboat,
  X,
} from 'lucide-react';
import {
  SIGNAL_TARGET_ORDER,
  SIGNAL_TARGETS,
  cardinalLabel,
  type SignalTargetId,
} from '../game/domain/navigation';
import type { NavigationFeedback } from '../state/gameStore';

interface SeaChartPanelProps {
  open: boolean;
  navigation: NavigationFeedback;
  onSelect: (targetId: SignalTargetId) => boolean;
  onClose: () => void;
}

const CHART_MIN_X = -300;
const CHART_MAX_X = 450;
const CHART_MIN_Z = -390;
const CHART_MAX_Z = 70;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function chartPoint(x: number, z: number): { x: number; y: number; clipped: boolean } {
  const rawX = (x - CHART_MIN_X) / (CHART_MAX_X - CHART_MIN_X) * 100;
  const rawY = (z - CHART_MIN_Z) / (CHART_MAX_Z - CHART_MIN_Z) * 100;
  return {
    x: clamp(rawX, 3, 97),
    y: clamp(rawY, 3, 97),
    clipped: rawX < 3 || rawX > 97 || rawY < 3 || rawY > 97,
  };
}

function signedCoordinate(value: number): string {
  return `${value >= 0 ? '+' : ''}${Math.round(value)}`;
}

export function SeaChartPanel({ open, navigation, onSelect, onClose }: SeaChartPanelProps) {
  if (!open) return null;
  const originX = navigation.signalOriginX ?? navigation.worldX;
  const originZ = navigation.signalOriginZ ?? navigation.worldZ;
  const chartOrigin = chartPoint(0, 0);
  const raft = chartPoint(navigation.worldX - originX, navigation.worldZ - originZ);
  const discovered = new Set(navigation.discoveredSignalIds);
  const visited = new Set(navigation.visitedSignalIds);
  const activeId = navigation.activeSignalId;
  const activeDefinition = activeId ? SIGNAL_TARGETS[activeId] : null;
  const activePoint = navigation.routeMode === 'signal' && activeId && discovered.has(activeId)
    ? chartPoint(activeDefinition!.offsetX, activeDefinition!.offsetZ)
    : null;
  const discoveredPoints = SIGNAL_TARGET_ORDER
    .filter((id) => discovered.has(id))
    .map((id) => chartPoint(SIGNAL_TARGETS[id].offsetX, SIGNAL_TARGETS[id].offsetZ));
  const tracePoints = [chartPoint(0, 0), ...discoveredPoints].map((point) => `${point.x},${point.y}`).join(' ');
  const routeLabel = navigation.routeMode === 'signal'
    ? '追踪信号'
    : navigation.routeMode === 'island'
      ? '追踪浅滩'
      : navigation.routeMode === 'shelter'
        ? '顺风避险'
        : '自由航向';

  return (
    <div className="modal-layer sea-chart-layer" role="presentation">
      <section className="sea-chart" role="dialog" aria-modal="true" aria-labelledby="sea-chart-heading">
        <header className="sea-chart__header">
          <div className="sea-chart__identity">
            <MapIcon size={22} />
            <div>
              <span>远海测绘</span>
              <h2 id="sea-chart-heading">潮痕航海图</h2>
            </div>
          </div>
          <div className="sea-chart__progress" aria-label={`信号链 ${navigation.visitedSignals}/${SIGNAL_TARGET_ORDER.length}`}>
            {SIGNAL_TARGET_ORDER.map((id, index) => (
              <i
                className={`${visited.has(id) ? 'is-visited' : discovered.has(id) ? 'is-discovered' : ''}`}
                key={id}
              ><b>{String(index + 1).padStart(2, '0')}</b></i>
            ))}
          </div>
          <div className="sea-chart__status">
            <span>{routeLabel}</span>
            <strong>{activeDefinition?.name ?? '未建立信号原点'}</strong>
          </div>
          <button className="icon-command icon-command--dark" type="button" onClick={onClose} aria-label="关闭航海图" title="关闭">
            <X size={20} />
          </button>
        </header>

        <div className="sea-chart__body">
          <section className="sea-chart__plot" aria-label="持续世界信号坐标图">
            <svg className="sea-chart__lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              {Array.from({ length: 9 }, (_, index) => {
                const value = (index + 1) * 10;
                return <g key={value}><path d={`M ${value} 0 V 100`} /><path d={`M 0 ${value} H 100`} /></g>;
              })}
              <circle cx={chartOrigin.x} cy={chartOrigin.y} r="12" />
              <circle cx={chartOrigin.x} cy={chartOrigin.y} r="24" />
              <circle cx={chartOrigin.x} cy={chartOrigin.y} r="36" />
              {tracePoints && <polyline className="sea-chart__trace" points={tracePoints} />}
              {activePoint && (
                <line
                  className="sea-chart__route"
                  x1={raft.x}
                  y1={raft.y}
                  x2={activePoint.x}
                  y2={activePoint.y}
                />
              )}
            </svg>
            <div className="sea-chart__north" aria-label="北"><ArrowUp size={16} /><span>N</span></div>
            <div
              className="sea-chart__origin"
              style={{ '--chart-x': `${chartOrigin.x}%`, '--chart-y': `${chartOrigin.y}%` } as React.CSSProperties}
              aria-label="信号原点"
            ><span /></div>
            {SIGNAL_TARGET_ORDER.map((id, index) => {
              if (!discovered.has(id)) return null;
              const target = SIGNAL_TARGETS[id];
              const point = chartPoint(target.offsetX, target.offsetZ);
              const isActive = navigation.routeMode === 'signal' && activeId === id;
              const isVisited = visited.has(id);
              return (
                <div
                  className="sea-chart__marker-anchor"
                  style={{ '--chart-x': `${point.x}%`, '--chart-y': `${point.y}%` } as React.CSSProperties}
                  key={id}
                >
                  <button
                    className={`sea-chart__marker ${isActive ? 'is-active' : ''} ${isVisited ? 'is-visited' : ''}`}
                    type="button"
                    disabled={isActive}
                    onClick={() => onSelect(id)}
                    aria-label={`${isActive ? '当前目标' : '标定'} ${target.name}${isVisited ? ' 已访问' : ''}`}
                    title={target.name}
                  >
                    {isVisited ? <Check size={14} /> : <RadioTower size={14} />}
                  </button>
                  <b>{String(index + 1).padStart(2, '0')}</b>
                </div>
              );
            })}
            <div
              className={`sea-chart__raft ${raft.clipped ? 'is-clipped' : ''}`}
              style={{ '--chart-x': `${raft.x}%`, '--chart-y': `${raft.y}%` } as React.CSSProperties}
              aria-label={`木筏位置 东西 ${signedCoordinate(navigation.worldX - originX)} 南北 ${signedCoordinate(navigation.worldZ - originZ)}`}
            >
              <Sailboat size={17} style={{ transform: `rotate(${navigation.heading}rad)` }} />
            </div>
            <div className="sea-chart__coordinates">
              <span>X {signedCoordinate(navigation.worldX - originX)}</span>
              <span>Z {signedCoordinate(navigation.worldZ - originZ)}</span>
              <strong>{cardinalLabel(navigation.heading)}</strong>
            </div>
            <div className="sea-chart__scale"><i /><span>100 m</span></div>
          </section>

          <section className="sea-chart__ledger" aria-labelledby="sea-chart-ledger-heading">
            <header>
              <RadioTower size={18} />
              <div><span>命名频段</span><h3 id="sea-chart-ledger-heading">信号链</h3></div>
              <strong>{navigation.visitedSignals}/{SIGNAL_TARGET_ORDER.length}</strong>
            </header>
            <ol>
              {SIGNAL_TARGET_ORDER.map((id, index) => {
                const target = SIGNAL_TARGETS[id];
                const isDiscovered = discovered.has(id);
                const isVisited = visited.has(id);
                const isActive = navigation.routeMode === 'signal' && activeId === id;
                const targetWorldX = originX + target.offsetX;
                const targetWorldZ = originZ + target.offsetZ;
                const distance = Math.hypot(targetWorldX - navigation.worldX, targetWorldZ - navigation.worldZ);
                return (
                  <li className={`${isDiscovered ? 'is-discovered' : 'is-locked'} ${isVisited ? 'is-visited' : ''} ${isActive ? 'is-active' : ''}`} key={id}>
                    <span className="sea-chart__ledger-index">{String(index + 1).padStart(2, '0')}</span>
                    <div className="sea-chart__ledger-copy">
                      <span>{isDiscovered ? `${target.frequency} MHz` : '--.-- MHz'}</span>
                      <h3>{isDiscovered ? target.name : '未解码目的地'}</h3>
                      <p>{isDiscovered ? target.summary : '前一频段尚未抵达，坐标保持封锁。'}</p>
                      <small>{isVisited ? target.unlock : isDiscovered ? `${Math.round(distance)} m · ${target.unlock}` : '等待信号链解锁'}</small>
                    </div>
                    <button
                      type="button"
                      disabled={!isDiscovered || isActive}
                      onClick={() => onSelect(id)}
                      aria-label={isActive ? `${target.name}已标定` : isDiscovered ? `标定${target.name}` : '目的地尚未解码'}
                      title={isActive ? '当前目标' : isDiscovered ? '标定目标' : '尚未解码'}
                    >
                      {!isDiscovered ? <LockKeyhole size={17} /> : isActive ? <Navigation size={17} /> : <Crosshair size={17} />}
                    </button>
                  </li>
                );
              })}
            </ol>
            <footer>
              <span>{navigation.receiverOn ? '阵列在线' : '阵列待机'}</span>
              <i><b style={{ width: `${Math.max(0, Math.min(100, navigation.receiverCharge / 3.6))}%` }} /></i>
              <strong>{Math.round(navigation.receiverCharge / 3.6)}%</strong>
            </footer>
          </section>
        </div>
      </section>
    </div>
  );
}
