import { Check, Gauge, MonitorCog, Volume2, VolumeX, Waves, X } from 'lucide-react';
import type { AudioMixChannel, AudioMixSnapshot } from '../game/audio/audioMix';
import type { QualityPreset } from '../state/gameStore';

interface SettingsPanelProps {
  open: boolean;
  audioEnabled: boolean;
  audioMix: AudioMixSnapshot;
  muteOnFocusLoss: boolean;
  headBobEnabled: boolean;
  quality: QualityPreset;
  dynamicResolutionEnabled: boolean;
  onAudioChange: (enabled: boolean) => void;
  onAudioMixChange: (channel: AudioMixChannel, value: number) => void;
  onMuteOnFocusLossChange: (enabled: boolean) => void;
  onHeadBobChange: (enabled: boolean) => void;
  onQualityChange: (quality: QualityPreset) => void;
  onDynamicResolutionChange: (enabled: boolean) => void;
  onClose: () => void;
}

const AUDIO_CHANNELS: ReadonlyArray<{ channel: AudioMixChannel; label: string }> = [
  { channel: 'master', label: '主音量' },
  { channel: 'music', label: '音乐' },
  { channel: 'ambience', label: '环境' },
  { channel: 'effects', label: '音效' },
  { channel: 'ui', label: '界面' },
];

export function SettingsPanel({
  open,
  audioEnabled,
  audioMix,
  muteOnFocusLoss,
  headBobEnabled,
  quality,
  dynamicResolutionEnabled,
  onAudioChange,
  onAudioMixChange,
  onMuteOnFocusLossChange,
  onHeadBobChange,
  onQualityChange,
  onDynamicResolutionChange,
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

        <div className="audio-mixer" aria-label="音频分组音量">
          {AUDIO_CHANNELS.map(({ channel, label }) => {
            const percent = Math.round(audioMix[channel] * 100);
            return (
              <label className="setting-slider" key={channel}>
                <span><strong>{label}</strong><output>{percent}%</output></span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={percent}
                  aria-label={`${label}音量`}
                  onChange={(event) => onAudioMixChange(channel, Number(event.currentTarget.value) / 100)}
                />
              </label>
            );
          })}
        </div>

        <div className="setting-row">
          <div className="setting-row__label">
            <VolumeX size={20} />
            <div><strong>失焦静音</strong><span>切换窗口或标签页时平滑静音</span></div>
          </div>
          <button
            className={`toggle ${muteOnFocusLoss ? 'is-on' : ''}`}
            type="button"
            onClick={() => onMuteOnFocusLossChange(!muteOnFocusLoss)}
            role="switch"
            aria-checked={muteOnFocusLoss}
            aria-label="失焦静音"
          >
            <span>{muteOnFocusLoss && <Check size={14} />}</span>
          </button>
        </div>

        <div className="setting-row">
          <div className="setting-row__label">
            <Waves size={20} />
            <div><strong>镜头摇晃</strong><span>关闭后移除步行头部起伏</span></div>
          </div>
          <button className={`toggle ${headBobEnabled ? 'is-on' : ''}`} type="button" onClick={() => onHeadBobChange(!headBobEnabled)} role="switch" aria-checked={headBobEnabled} aria-label="镜头摇晃">
            <span>{headBobEnabled && <Check size={14} />}</span>
          </button>
        </div>

        <div className="setting-row">
          <div className="setting-row__label">
            <Gauge size={20} />
            <div><strong>动态分辨率</strong><span>低帧时自动降低内部渲染比例</span></div>
          </div>
          <button
            className={`toggle ${dynamicResolutionEnabled ? 'is-on' : ''}`}
            type="button"
            onClick={() => onDynamicResolutionChange(!dynamicResolutionEnabled)}
            role="switch"
            aria-checked={dynamicResolutionEnabled}
            aria-label="动态分辨率"
          >
            <span>{dynamicResolutionEnabled && <Check size={14} />}</span>
          </button>
        </div>

        <div className="setting-row setting-row--stacked">
          <div className="setting-row__label">
            <MonitorCog size={20} />
            <div><strong>画面质量</strong><span>渲染比例、阴影与海面细分</span></div>
          </div>
          <div className="segmented-control" aria-label="画面质量">
            <button
              className={quality === 'high' ? 'is-selected' : ''}
              type="button"
              aria-pressed={quality === 'high'}
              onClick={() => onQualityChange('high')}
            >
              <MonitorCog size={17} /> 高质量
            </button>
            <button
              className={quality === 'low' ? 'is-selected' : ''}
              type="button"
              aria-pressed={quality === 'low'}
              onClick={() => onQualityChange('low')}
            >
              <Gauge size={17} /> 性能
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

