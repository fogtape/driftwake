import { Check, Gauge, MonitorCog, Volume2, VolumeX, X } from 'lucide-react';
import type { QualityPreset } from '../state/gameStore';

interface SettingsPanelProps {
  open: boolean;
  audioEnabled: boolean;
  quality: QualityPreset;
  onAudioChange: (enabled: boolean) => void;
  onQualityChange: (quality: QualityPreset) => void;
  onClose: () => void;
}

export function SettingsPanel({
  open,
  audioEnabled,
  quality,
  onAudioChange,
  onQualityChange,
  onClose,
}: SettingsPanelProps) {
  if (!open) return null;
  return (
    <div className="modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-heading">
        <header className="settings-panel__header">
          <div>
            <span>航行配置</span>
            <h2 id="settings-heading">设置</h2>
          </div>
          <button className="icon-command icon-command--dark" type="button" onClick={onClose} aria-label="关闭设置" title="关闭">
            <X size={20} />
          </button>
        </header>

        <div className="setting-row">
          <div className="setting-row__label">
            {audioEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            <div><strong>声音</strong><span>环境、动作与界面</span></div>
          </div>
          <button className={`toggle ${audioEnabled ? 'is-on' : ''}`} type="button" onClick={() => onAudioChange(!audioEnabled)} role="switch" aria-checked={audioEnabled}>
            <span>{audioEnabled && <Check size={14} />}</span>
          </button>
        </div>

        <div className="setting-row setting-row--stacked">
          <div className="setting-row__label">
            <MonitorCog size={20} />
            <div><strong>画面质量</strong><span>渲染比例、阴影与海面细分</span></div>
          </div>
          <div className="segmented-control" aria-label="画面质量">
            <button className={quality === 'high' ? 'is-selected' : ''} type="button" onClick={() => onQualityChange('high')}>
              <MonitorCog size={17} /> 高质量
            </button>
            <button className={quality === 'low' ? 'is-selected' : ''} type="button" onClick={() => onQualityChange('low')}>
              <Gauge size={17} /> 性能
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

