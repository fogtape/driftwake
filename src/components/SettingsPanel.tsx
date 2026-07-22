import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  AudioWaveform,
  Check,
  Gauge,
  Hammer,
  Keyboard,
  MonitorCog,
  Music2,
  Orbit,
  Palette,
  RotateCcw,
  SlidersHorizontal,
  TriangleAlert,
  Volume2,
  VolumeX,
  Waves,
  X,
} from 'lucide-react';
import type { AudioMix, QualityPreset } from '../state/gameStore';
import {
  INPUT_ACTIONS,
  INPUT_ACTION_DEFINITIONS,
  INPUT_BINDING_GROUPS,
  formatInputCode,
  type InputAction,
  type InputBindingChange,
  type InputBindings,
} from '../game/domain/inputBindings';
import { COLOR_VISION_MODE_LABELS, COLOR_VISION_MODES, type CameraMotionMode, type ColorVisionMode } from '../game/domain/settings';

interface SettingsPanelProps {
  open: boolean;
  audioEnabled: boolean;
  audioMix: AudioMix;
  muteOnFocusLoss: boolean;
  cameraMotionMode: CameraMotionMode;
  quality: QualityPreset;
  dynamicResolutionEnabled: boolean;
  keyBindings: InputBindings;
  captionsEnabled: boolean;
  colorVisionMode: ColorVisionMode;
  reducedMotion: boolean;
  onAudioChange: (enabled: boolean) => void;
  onAudioMixChange: (mix: Partial<AudioMix>) => void;
  onMuteOnFocusLossChange: (enabled: boolean) => void;
  onCameraMotionModeChange: (mode: CameraMotionMode) => void;
  onQualityChange: (quality: QualityPreset) => void;
  onDynamicResolutionChange: (enabled: boolean) => void;
  onKeyBindingChange: (action: InputAction, code: string) => InputBindingChange;
  onKeyBindingsReset: () => void;
  onCaptionsEnabledChange: (enabled: boolean) => void;
  onColorVisionModeChange: (mode: ColorVisionMode) => void;
  onReducedMotionChange: (enabled: boolean) => void;
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
  keyBindings,
  captionsEnabled,
  colorVisionMode,
  reducedMotion,
  onAudioChange,
  onAudioMixChange,
  onMuteOnFocusLossChange,
  onCameraMotionModeChange,
  onQualityChange,
  onDynamicResolutionChange,
  onKeyBindingChange,
  onKeyBindingsReset,
  onCaptionsEnabledChange,
  onColorVisionModeChange,
  onReducedMotionChange,
  onClose,
}: SettingsPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [capturingAction, setCapturingAction] = useState<InputAction | null>(null);
  const [bindingStatus, setBindingStatus] = useState('');

  useEffect(() => {
    if (!open) {
      setCapturingAction(null);
      setBindingStatus('');
      return;
    }
    closeButtonRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!capturingAction) return;
    const onCapture = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.code === 'Escape') {
        setCapturingAction(null);
        setBindingStatus('键位修改已取消');
        return;
      }
      const result = onKeyBindingChange(capturingAction, event.code);
      if (result.ok) {
        setCapturingAction(null);
        setBindingStatus(`${INPUT_ACTION_DEFINITIONS[capturingAction].label}已更新为 ${formatInputCode(event.code)}`);
        return;
      }
      setBindingStatus(
        result.reason === 'conflict' && result.conflict
          ? `${formatInputCode(event.code)} 已分配给${INPUT_ACTION_DEFINITIONS[result.conflict].label}`
          : '该按键不能用于游戏操作',
      );
    };
    window.addEventListener('keydown', onCapture, true);
    return () => window.removeEventListener('keydown', onCapture, true);
  }, [capturingAction, onKeyBindingChange]);

  const onPanelKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && !capturingAction) {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), [href], select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;
  return (
    <div className="modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={panelRef} className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-heading" onKeyDown={onPanelKeyDown}>
        <header className="settings-panel__header">
          <div>
            <span>航行配置</span>
            <h2 id="settings-heading">设置</h2>
          </div>
          <button ref={closeButtonRef} className="icon-command icon-command--dark" type="button" onClick={onClose} aria-label="关闭设置" title="关闭">
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
            <Palette size={20} />
            <div><strong>色觉辅助</strong><span>调整界面语义色</span></div>
          </div>
          <select
            className="visual-mode-select"
            value={colorVisionMode}
            onChange={(event) => onColorVisionModeChange(event.target.value as ColorVisionMode)}
            aria-label="色觉辅助"
          >
            {COLOR_VISION_MODES.map((mode) => <option key={mode} value={mode}>{COLOR_VISION_MODE_LABELS[mode]}</option>)}
          </select>
        </div>

        <div className="setting-row">
          <div className="setting-row__label">
            <Orbit size={20} />
            <div><strong>减少动态</strong><span>压低镜头起伏与受击晃动</span></div>
          </div>
          <button
            className={`toggle ${reducedMotion ? 'is-on' : ''}`}
            type="button"
            onClick={() => onReducedMotionChange(!reducedMotion)}
            role="switch"
            aria-checked={reducedMotion}
            aria-label="减少动态"
          >
            <span>{reducedMotion && <Check size={14} />}</span>
          </button>
        </div>

        <div className="setting-row">
          <div className="setting-row__label">
            <AudioWaveform size={20} />
            <div><strong>声音字幕</strong><span>危险、信号与关键交互</span></div>
          </div>
          <button
            className={`toggle ${captionsEnabled ? 'is-on' : ''}`}
            type="button"
            onClick={() => onCaptionsEnabledChange(!captionsEnabled)}
            role="switch"
            aria-checked={captionsEnabled}
            aria-label="声音字幕"
          >
            <span>{captionsEnabled && <Check size={14} />}</span>
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

        <div className="setting-row setting-row--stacked keybinding-setting">
          <div className="setting-row__label">
            <Keyboard size={20} />
            <div><strong>键位</strong><span>动作按物理键位保存</span></div>
          </div>
          <div className="keybinding-groups">
            {INPUT_BINDING_GROUPS.map((group) => {
              const actions = INPUT_ACTIONS.filter((action) => INPUT_ACTION_DEFINITIONS[action].group === group.id);
              return (
                <section className="keybinding-group" key={group.id} aria-label={group.label}>
                  <h3>{group.label}</h3>
                  <div className="keybinding-grid">
                    {actions.map((action) => {
                      const capturing = capturingAction === action;
                      return (
                        <div className="keybinding-row" key={action}>
                          <span>{INPUT_ACTION_DEFINITIONS[action].label}</span>
                          <button
                            className={`keybinding-button ${capturing ? 'is-capturing' : ''}`}
                            type="button"
                            aria-pressed={capturing}
                            aria-label={`设置${INPUT_ACTION_DEFINITIONS[action].label}，当前为${formatInputCode(keyBindings[action])}`}
                            onClick={() => {
                              setCapturingAction(action);
                              setBindingStatus(`${INPUT_ACTION_DEFINITIONS[action].label}：按下一个按键`);
                            }}
                          >
                            <kbd>{capturing ? '按键…' : formatInputCode(keyBindings[action])}</kbd>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
          <div className="keybinding-footer">
            <output className="keybinding-status" aria-live="polite">{bindingStatus}</output>
            <button
              className="keybinding-reset"
              type="button"
              onClick={() => {
                onKeyBindingsReset();
                setCapturingAction(null);
                setBindingStatus('已恢复默认键位');
              }}
            >
              <RotateCcw size={15} /> 恢复默认
            </button>
          </div>
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
