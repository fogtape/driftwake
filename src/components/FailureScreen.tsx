import {
  HeartPulse,
  PackageSearch,
  RotateCcw,
  Settings,
  ShieldCheck,
  Waves,
} from 'lucide-react';
import { FAILURE_COPY, RECOVERY_SURVIVAL, type FailureRecord } from '../game/domain/failure';
import { ITEM_DEFINITIONS, type ItemId } from '../game/domain/items';
import { ItemIcon } from './ItemIcon';

interface FailureScreenProps {
  visible: boolean;
  ready: boolean;
  failure: FailureRecord | null;
  onRecover: () => void;
  onSettings: () => void;
}

export function FailureScreen({ visible, ready, failure, onRecover, onSettings }: FailureScreenProps) {
  if (!failure) return null;
  const copy = FAILURE_COPY[failure.cause];
  const dropped = (Object.keys(ITEM_DEFINITIONS) as ItemId[])
    .map((itemId) => ({ itemId, amount: failure.dropped[itemId] ?? 0 }))
    .filter(({ amount }) => amount > 0);
  const recovering = failure.dropPending || !ready;

  return (
    <section
      className={`failure-screen failure-screen--${failure.cause} ${visible ? 'is-visible' : ''}`}
      aria-hidden={!visible}
      role="dialog"
      aria-modal="true"
      aria-labelledby="failure-screen-heading"
    >
      <div className="failure-screen__wash" aria-hidden="true" />
      <header className="failure-screen__header">
        <span><Waves size={19} /> 航次 01 / 回收协议</span>
        <button type="button" onClick={onSettings} aria-label="设置" title="设置">
          <Settings size={20} />
        </button>
      </header>

      <div className="failure-screen__content">
        <div className="failure-screen__cause" aria-hidden="true"><HeartPulse size={29} /></div>
        <p className="failure-screen__eyebrow">航次中断</p>
        <h1 id="failure-screen-heading">{copy.title}</h1>
        <p className="failure-screen__detail">{copy.detail}</p>

        <div className="failure-screen__rule" />

        <section className="failure-screen__salvage" aria-labelledby="failure-salvage-heading">
          <header>
            <PackageSearch size={19} />
            <div>
              <h2 id="failure-salvage-heading">右舷散落</h2>
              <span>{failure.dropPending ? '正在锁定回收位置' : '已生成可打捞标记'}</span>
            </div>
          </header>
          <div className="failure-screen__loot">
            {dropped.length > 0 ? dropped.map(({ itemId, amount }) => (
              <div
                className="failure-loot"
                style={{ '--failure-item-tone': ITEM_DEFINITIONS[itemId].tone } as React.CSSProperties}
                key={itemId}
              >
                <ItemIcon itemId={itemId} size={22} strokeWidth={1.8} />
                <span>{ITEM_DEFINITIONS[itemId].shortName}</span>
                <strong>x{amount}</strong>
              </div>
            )) : <span className="failure-screen__no-loss">没有随身物资散落</span>}
          </div>
        </section>

        <div className="failure-screen__retained">
          <ShieldCheck size={18} />
          <span>工具、筏体设备与研究进度均已保留</span>
        </div>

        <div className="failure-screen__recovery">
          <span>恢复状态</span>
          <strong>生命 {RECOVERY_SURVIVAL.health}</strong>
          <strong>水分 {RECOVERY_SURVIVAL.thirst}</strong>
          <strong>饱食 {RECOVERY_SURVIVAL.hunger}</strong>
        </div>

        <button className="failure-screen__recover" type="button" onClick={onRecover} disabled={recovering}>
          <RotateCcw size={20} />
          <span>{recovering ? '正在确认海况' : '回到木筏'}</span>
        </button>
      </div>

      <footer className="failure-screen__footer">
        <span>航迹已记录</span>
        <i />
        <span>散落物资不会随恢复消失</span>
      </footer>
    </section>
  );
}
