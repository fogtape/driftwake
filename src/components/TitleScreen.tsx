import {
  ArchiveRestore,
  CircleAlert,
  Clock3,
  Layers3,
  Play,
  Plus,
  Save,
  Settings,
  Trash2,
  Waves,
} from 'lucide-react';
import type { SaveSlotId, SaveSlotSummary } from '../game/domain/saveRepository';

interface TitleScreenProps {
  visible: boolean;
  loading: boolean;
  loadingLabel: string;
  slots: readonly SaveSlotSummary[];
  activeSlot: SaveSlotId;
  onBegin: () => void;
  onSelectSlot: (slot: SaveSlotId) => void;
  onDeleteSlot: (slot: SaveSlotId) => void;
  onSettings: () => void;
}

function formatPlayTime(seconds: number): string {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  if (minutes < 1) return '刚刚启航';
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours} 小时 ${remainder} 分` : `${hours} 小时`;
}

const SLOT_STATUS = {
  empty: { label: '空航迹', icon: Plus },
  ready: { label: '航迹稳定', icon: Save },
  recovered: { label: '备份可恢复', icon: ArchiveRestore },
  corrupt: { label: '航迹损坏', icon: CircleAlert },
} as const;

export function TitleScreen({
  visible,
  loading,
  loadingLabel,
  slots,
  activeSlot,
  onBegin,
  onSelectSlot,
  onDeleteSlot,
  onSettings,
}: TitleScreenProps) {
  const loadFailed = !loading && loadingLabel.includes('失败');
  const selected = slots.find((slot) => slot.slot === activeSlot) ?? slots[0];
  const commandLabel = selected?.status === 'corrupt'
    ? '重建航次'
    : selected?.status === 'recovered'
      ? '恢复航次'
      : selected?.save
        ? '继续航次'
        : '开始新航次';
  return (
    <section className={`title-screen ${visible ? 'is-visible' : ''}`} aria-hidden={!visible} aria-busy={loading}>
      <div className="title-screen__art" />
      <div className="title-screen__shade" />
      <header className="title-screen__masthead">
        <div className="title-screen__mark" aria-hidden="true">
          <Waves size={24} strokeWidth={2.2} />
        </div>
        <span>远海航次 {String(slots.findIndex((slot) => slot.slot === activeSlot) + 1).padStart(2, '0')}</span>
      </header>

      <div className="title-screen__content">
        <p className="title-screen__eyebrow">原创海上生存</p>
        <h1>DRIFTWAKE</h1>
        <p className="title-screen__subtitle">漂痕</p>
        <div className="title-save-slots" role="radiogroup" aria-label="远海航次">
          {slots.map((slot, index) => {
            const active = slot.slot === activeSlot;
            const status = SLOT_STATUS[slot.status];
            const StatusIcon = status.icon;
            return (
              <article className={`title-save-slot title-save-slot--${slot.status} ${active ? 'is-active' : ''}`} key={slot.slot}>
                <button
                  className="title-save-slot__select"
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={`航次 ${index + 1}，${status.label}`}
                  disabled={loading}
                  onClick={() => onSelectSlot(slot.slot)}
                >
                  <span className="title-save-slot__number">{String(index + 1).padStart(2, '0')}</span>
                  <span className="title-save-slot__status"><StatusIcon size={14} />{status.label}</span>
                  {slot.save ? (
                    <small>
                      <span><Clock3 size={12} />{formatPlayTime(slot.playSeconds)}</span>
                      <span><Layers3 size={12} />{slot.raftTiles} 格</span>
                      {slot.failure && <b>待救援</b>}
                    </small>
                  ) : (
                    <small>{slot.status === 'corrupt' ? '可重新启航' : '等待首次启航'}</small>
                  )}
                </button>
                {slot.status !== 'empty' && (
                  <button
                    className="title-save-slot__delete"
                    type="button"
                    disabled={loading}
                    onClick={() => onDeleteSlot(slot.slot)}
                    aria-label={`删除航次 ${index + 1}`}
                    title="删除航次"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </article>
            );
          })}
        </div>
        <div className="title-screen__actions">
          <button className="primary-command" type="button" onClick={onBegin} disabled={loading}>
            <Play size={20} fill="currentColor" />
            <span>{loading ? loadingLabel : commandLabel}</span>
          </button>
          <button className="icon-command" type="button" onClick={onSettings} aria-label="设置" title="设置">
            <Settings size={21} />
          </button>
        </div>
        {loading && (
          <div className="loading-tide" aria-label={loadingLabel}>
            <i />
            <i />
            <i />
          </div>
        )}
        {loadFailed && <p className="title-screen__error" role="alert">{loadingLabel}</p>}
      </div>

      <footer className="title-screen__footer">
        <span>SAVE CORE v18</span>
        <span>BUILD 0.21.0</span>
      </footer>
    </section>
  );
}
