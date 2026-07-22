import { describe, expect, it } from 'vitest';
import { AudioSystem } from './AudioSystem';

describe('signal destination audio state', () => {
  it('clamps proximity and pan while preserving the selected sound identity', () => {
    const audio = new AudioSystem();

    audio.setSignalDestinationActivity('ironChoir', 1.8, -1.6, true);

    expect(audio.getSignalDestinationAudioDiagnostics()).toEqual({
      targetId: 'ironChoir',
      proximity: 1,
      pan: -1,
      emphasized: true,
      layersReady: false,
      layerCount: 0,
    });
  });

  it('clears the near-field layer when no destination is audible', () => {
    const audio = new AudioSystem();
    audio.setSignalDestinationActivity('stormNeedle', 0.72, 0.34, false);

    audio.setSignalDestinationActivity(null, -0.2, 0, false);

    expect(audio.getSignalDestinationAudioDiagnostics()).toEqual({
      targetId: null,
      proximity: 0,
      pan: 0,
      emphasized: false,
      layersReady: false,
      layerCount: 0,
    });
  });

  it('emits decision-relevant captions even before the browser audio graph begins', () => {
    const audio = new AudioSystem();
    const captions: string[] = [];
    audio.setCaptionSink((caption) => captions.push(caption));

    audio.playThunder(0.9);
    audio.playSharkWarning();
    audio.playSharkWindup(true, false);
    audio.playLineBreak();
    audio.playSignalArrival();
    audio.playCropBirdWarning();
    audio.playCropBirdPeck();

    expect(captions).toEqual([
      '近处雷鸣',
      '水下搅动，鲨鱼接近',
      '鲨鱼正向你蓄势',
      '钓线断裂',
      '接收台捕获到新信号',
      '鸟翼逼近作物',
      '鸟翼正在啄食作物',
    ]);
  });
});
