import {
  Check,
  Gauge,
  Hammer,
  MonitorCog,
  Music2,
  Orbit,
  SlidersHorizontal,
  TriangleAlert,
  Volume2,
  VolumeX,
  Waves,
  X,
} from 'lucide-react';
import type { AudioMix, QualityPreset } from '../state/gameStore';
import type { CameraMotionMode } from '../game/domain/settings';

interface SettingsPanelProps {
  open: boolean;
  audioEnabled: boolean;
  audioMix: AudioMix;
  muteOnFocusLoss: boolean;
  cameraMotionMode: CameraMotionMode;
  quality: QualityPreset;
  dynamicResolutionEnabled: boolean;
  onAudioChange: (enabled: boolean) => void;
  onAudioMixChange: (mix: Partial<AudioMix>) => void;
  onMuteOnFocusLossChange: (enabled: boolean) => void;
  onCameraMotionModeChange: (mode: CameraMotionMode) => void;
  onQualityChange: (quality: QualityPreset) => void;
  onDynamicResolutionChange: (enabled: boolean) => void;
  onClose: () => void;
}

export function SettingsPanel({
  open,
  audioEnabled,
  audioMix,
  muteOnFocusLoss,
  cameraMotionMode,
  quality,
  dynamicResolutionEnabled,
  onAudioChange,
  onAudioMixChange,
  onMuteOnFocusLossChange,
  onCameraMotionModeChange,
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

        <div className="setting-row">
          <div className="setting-row__label">
            <VolumeX size={20} />
            <div><strong>失焦静音</strong><span>离开窗口时静音</span></div>
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

        <div className="setting-row setting-row--stacked">
          <div className="setting-row__label">
            <Orbit size={20} />
            <div><strong>镜头运动</strong><span>木筏倾斜与步行起伏</span></div>
          </div>
          <div className="segmented-control segmented-control--three" aria-label="镜头运动">
            {([
              ['comfort', '舒适'],
              ['balanced', '平衡'],
              ['immersive', '沉浸'],
            ] as const).map(([mode, label]) => (
              <button
                className={cameraMotionMode === mode ? 'is-selected' : ''}
                type="button"
                aria-pressed={cameraMotionMode === mode}
                onClick={() => onCameraMotionModeChange(mode)}
                key={mode}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="setting-row">
          <div className="setting-row__label">
            <Gauge size={20} />
            <div><strong>动态分辨率</strong><span>按帧时间调节内部比例</span></div>
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

        <div className="setting-row setting-row--stacked audio-mixer-setting">
          <div className="setting-row__label">
            <SlidersHorizontal size={20} />
            <div><strong>混音</strong><span>独立声音总线</span></div>
          </div>
          <div className="audio-mixer">
            {([
              ['master', '总音量', Volume2],
              ['music', '音乐', Music2],
              ['ambience', '海况', Waves],
              ['effects', '交互', Hammer],
              ['creatures', '危险', TriangleAlert],
              ['ui', '界面', Gauge],
            ] as const).map(([key, label, Icon]) => (
              <label className="mixer-channel" key={key}>
                <span><Icon size={15} /> {label}</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={Math.round(audioMix[key] * 100)}
                  onChange={(event) => onAudioMixChange({ [key]: Number(event.target.value) / 100 })}
                  aria-label={label}
                />
                <output>{Math.round(audioMix[key] * 100)}</output>
              </label>
            ))}
          </div>
        </div>

        <div className="setting-row setting-row--stacked">
          <div className="setting-row__label">
            <MonitorCog size={20} />
            <div><strong>画面质量</strong><span>渲染比例、阴影与海面细分</span></div>
          </div>
          <div className="segmented-control" aria-label="画面质量">
            <button className={quality === 'high' ? 'is-selected' : ''} type="button" aria-pressed={quality === 'high'} onClick={() => onQualityChange('high')}>
              <MonitorCog size={17} /> 高质量
            </button>
            <button className={quality === 'low' ? 'is-selected' : ''} type="button" aria-pressed={quality === 'low'} onClick={() => onQualityChange('low')}>
              <Gauge size={17} /> 性能
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
