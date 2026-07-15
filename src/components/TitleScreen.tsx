import { Play, Settings, Waves } from 'lucide-react';

interface TitleScreenProps {
  visible: boolean;
  ready: boolean;
  loading: boolean;
  loadingLabel: string;
  onBegin: () => void;
  onSettings: () => void;
}

export function TitleScreen({ visible, ready, loading, loadingLabel, onBegin, onSettings }: TitleScreenProps) {
  return (
    <section
      className={`title-screen ${visible ? 'is-visible' : ''}`}
      aria-hidden={!visible}
      aria-busy={loading}
    >
      <div className="title-screen__art" />
      <div className="title-screen__shade" />
      <header className="title-screen__masthead">
        <div className="title-screen__mark" aria-hidden="true">
          <Waves size={24} strokeWidth={2.2} />
        </div>
        <span>远海航次 01</span>
      </header>

      <div className="title-screen__content">
        <p className="title-screen__eyebrow">原创海上生存</p>
        <h1>DRIFTWAKE</h1>
        <p className="title-screen__subtitle">漂痕</p>
        <div className="title-screen__actions">
          <button className="primary-command" type="button" onClick={onBegin} disabled={loading}>
            <Play size={20} fill="currentColor" />
            <span>{loading ? loadingLabel : ready ? '进入海面' : '开始漂流'}</span>
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
      </div>

      <footer className="title-screen__footer">
        <span>PRE-ALPHA</span>
        <span>BUILD 0.1.0</span>
      </footer>
    </section>
  );
}

