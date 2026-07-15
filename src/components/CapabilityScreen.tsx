import { Monitor, Waves } from 'lucide-react';

export function CapabilityScreen() {
  return (
    <main className="capability-screen">
      <div className="capability-screen__art" />
      <div className="capability-screen__shade" />
      <div className="capability-screen__brand"><Waves size={22} /> DRIFTWAKE</div>
      <section className="capability-screen__message">
        <Monitor size={32} />
        <h1>桌面航次</h1>
        <p>当前构建需要键鼠与 WebGL2。</p>
      </section>
    </main>
  );
}

