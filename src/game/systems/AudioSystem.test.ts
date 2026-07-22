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
});
