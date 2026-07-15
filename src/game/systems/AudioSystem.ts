import type { AudioMixSnapshot } from '../audio/audioMix';
import { DEFAULT_AUDIO_MIX, getEffectiveMasterGain } from '../audio/audioMix';
import type { EnvironmentSample } from '../environment/environment';
import { createSeededRandom, randomRange } from '../math/random';
import { getUnderwaterAudioCutoff } from '../player/underwater';

function clampLevel(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
}

export class AudioSystem {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private outputFilter: BiquadFilterNode | null = null;
  private ambience: GainNode | null = null;
  private effects: GainNode | null = null;
  private ui: GainNode | null = null;
  private music: GainNode | null = null;
  private oceanGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private rainGain: GainNode | null = null;
  private nextCreakAt = 4;
  private underwaterMix = 0;
  private appliedUnderwaterMix = -1;
  private environmentWindStrength = 0.2;
  private environmentWaveScale = 0.78;
  private environmentRainIntensity = 0;
  private appliedWindStrength = -1;
  private appliedWaveScale = -1;
  private appliedRainIntensity = -1;
  private readonly random = createSeededRandom(0xa0d10);
  private enabled = true;
  private focusMuted = false;
  private mix: AudioMixSnapshot = { ...DEFAULT_AUDIO_MIX };

  async begin(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext({ latencyHint: 'interactive' });
      this.master = this.context.createGain();
      this.outputFilter = this.context.createBiquadFilter();
      this.ambience = this.context.createGain();
      this.effects = this.context.createGain();
      this.ui = this.context.createGain();
      this.music = this.context.createGain();
      this.outputFilter.type = 'lowpass';
      this.outputFilter.frequency.value = getUnderwaterAudioCutoff(this.underwaterMix);
      this.outputFilter.Q.value = 0.55;
      this.appliedUnderwaterMix = this.underwaterMix;
      this.ambience.connect(this.master);
      this.effects.connect(this.master);
      this.ui.connect(this.master);
      this.music.connect(this.master);
      this.master.connect(this.outputFilter).connect(this.context.destination);
      this.applyBusMix(true);
      this.applyMasterGain(true);
      this.startAmbientLayers();
      this.startMusicLayer();
      this.applyEnvironmentMix();
    }
    if (this.context.state !== 'running') await this.context.resume();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.applyMasterGain();
  }

  setFocusMuted(focusMuted: boolean): void {
    this.focusMuted = focusMuted;
    this.applyMasterGain();
  }

  setMix(mix: AudioMixSnapshot): void {
    this.mix = {
      master: clampLevel(mix.master, this.mix.master),
      music: clampLevel(mix.music, this.mix.music),
      ambience: clampLevel(mix.ambience, this.mix.ambience),
      effects: clampLevel(mix.effects, this.mix.effects),
      ui: clampLevel(mix.ui, this.mix.ui),
    };
    this.applyBusMix();
    this.applyMasterGain();
  }

  setUnderwater(mix: number): void {
    this.underwaterMix = Number.isFinite(mix) ? Math.min(1, Math.max(0, mix)) : 0;
    if (!this.context || !this.outputFilter) return;
    if (Math.abs(this.underwaterMix - this.appliedUnderwaterMix) < 0.008) return;
    const now = this.context.currentTime;
    this.outputFilter.frequency.cancelScheduledValues(now);
    this.outputFilter.frequency.setTargetAtTime(
      getUnderwaterAudioCutoff(this.underwaterMix),
      now,
      0.08,
    );
    this.appliedUnderwaterMix = this.underwaterMix;
  }

  setEnvironment(environment: EnvironmentSample): void {
    this.environmentWindStrength = Math.min(1, Math.max(0, environment.windStrength));
    this.environmentWaveScale = Math.min(1.6, Math.max(0.6, environment.waveScale));
    this.environmentRainIntensity = Math.min(1, Math.max(0, environment.rainIntensity));
    this.applyEnvironmentMix();
  }

  update(time: number): void {
    if (!this.context || !this.enabled || this.focusMuted || time < this.nextCreakAt) return;
    this.playCreak();
    this.nextCreakAt = time + randomRange(this.random, 4.8, 10.5);
  }

  playUi(): void {
    if (!this.context || !this.ui || !this.enabled || this.focusMuted) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(randomRange(this.random, 500, 540), now);
    oscillator.frequency.exponentialRampToValueAtTime(randomRange(this.random, 660, 710), now + 0.055);
    gain.gain.setValueAtTime(randomRange(this.random, 0.03, 0.038), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    oscillator.connect(gain).connect(this.ui);
    oscillator.start(now);
    oscillator.stop(now + 0.09);
  }

  playCast(charge: number): void {
    if (!this.context || !this.effects || !this.enabled || this.focusMuted) return;
    const safeCharge = Math.min(1, Math.max(0, charge));
    const now = this.context.currentTime;
    this.noiseBurst(
      randomRange(this.random, 0.15, 0.19),
      (620 + safeCharge * 520) * randomRange(this.random, 0.94, 1.06),
      randomRange(this.random, 0.095, 0.12),
      'bandpass',
    );
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime((180 + safeCharge * 90) * randomRange(this.random, 0.96, 1.04), now);
    oscillator.frequency.exponentialRampToValueAtTime(randomRange(this.random, 68, 76), now + 0.16);
    gain.gain.setValueAtTime(randomRange(this.random, 0.04, 0.05), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    oscillator.connect(gain).connect(this.effects);
    oscillator.start(now);
    oscillator.stop(now + 0.19);
  }

  playSplash(): void {
    this.noiseBurst(
      randomRange(this.random, 0.38, 0.46),
      randomRange(this.random, 880, 1080),
      randomRange(this.random, 0.16, 0.2),
      'lowpass',
    );
    this.noiseBurst(
      randomRange(this.random, 0.12, 0.16),
      randomRange(this.random, 2200, 2700),
      randomRange(this.random, 0.065, 0.09),
      'bandpass',
    );
  }

  playCollect(): void {
    if (!this.context || !this.effects || !this.enabled || this.focusMuted) return;
    const now = this.context.currentTime;
    const pitchScale = randomRange(this.random, 0.94, 1.06);
    [0, randomRange(this.random, 0.048, 0.064)].forEach((offset, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime((index === 0 ? 340 : 510) * pitchScale, now + offset);
      gain.gain.setValueAtTime(randomRange(this.random, 0.048, 0.06), now + offset);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.12);
      oscillator.connect(gain).connect(this.effects!);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.13);
    });
  }

  dispose(): void {
    void this.context?.close();
    this.context = null;
    this.master = null;
    this.outputFilter = null;
    this.appliedUnderwaterMix = -1;
    this.appliedWindStrength = -1;
    this.appliedWaveScale = -1;
    this.appliedRainIntensity = -1;
    this.ambience = null;
    this.effects = null;
    this.ui = null;
    this.music = null;
    this.oceanGain = null;
    this.windGain = null;
    this.windFilter = null;
    this.rainGain = null;
  }

  private applyMasterGain(immediate = false): void {
    if (!this.context || !this.master) return;
    const value = getEffectiveMasterGain({
      enabled: this.enabled,
      focusMuted: this.focusMuted,
      masterVolume: this.mix.master,
    });
    if (immediate) {
      this.master.gain.value = value;
    } else {
      this.master.gain.setTargetAtTime(value, this.context.currentTime, 0.06);
    }
  }

  private applyBusMix(immediate = false): void {
    if (!this.context || !this.ambience || !this.effects || !this.ui || !this.music) return;
    const now = this.context.currentTime;
    const values: Array<[GainNode, number]> = [
      [this.ambience, this.mix.ambience * 0.62],
      [this.effects, this.mix.effects * 0.84],
      [this.ui, this.mix.ui * 0.7],
      [this.music, this.mix.music * 0.38],
    ];
    for (const [node, value] of values) {
      if (immediate) node.gain.value = value;
      else node.gain.setTargetAtTime(value, now, 0.08);
    }
  }

  private applyEnvironmentMix(): void {
    if (
      !this.context
      || !this.oceanGain
      || !this.windGain
      || !this.windFilter
      || !this.rainGain
    ) return;
    const unchanged = Math.abs(this.environmentWindStrength - this.appliedWindStrength) < 0.008
      && Math.abs(this.environmentWaveScale - this.appliedWaveScale) < 0.008
      && Math.abs(this.environmentRainIntensity - this.appliedRainIntensity) < 0.008;
    if (unchanged) return;
    const now = this.context.currentTime;
    this.oceanGain.gain.setTargetAtTime(0.19 + this.environmentWaveScale * 0.15, now, 0.45);
    this.windGain.gain.setTargetAtTime(0.025 + this.environmentWindStrength * 0.16, now, 0.4);
    this.windFilter.frequency.setTargetAtTime(
      1650 + this.environmentWindStrength * 1750,
      now,
      0.5,
    );
    this.rainGain.gain.setTargetAtTime(this.environmentRainIntensity * 0.22, now, 0.35);
    this.appliedWindStrength = this.environmentWindStrength;
    this.appliedWaveScale = this.environmentWaveScale;
    this.appliedRainIntensity = this.environmentRainIntensity;
  }

  private startAmbientLayers(): void {
    if (!this.context || !this.ambience) return;
    const duration = 12;
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, duration * sampleRate, sampleRate);
    const channel = buffer.getChannelData(0);
    let brown = 0;
    for (let index = 0; index < channel.length; index += 1) {
      const white = this.random() * 2 - 1;
      brown = (brown + white * 0.025) / 1.025;
      const swell = 0.62 + Math.sin((index / sampleRate) * Math.PI * 0.42) * 0.24;
      channel[index] = brown * 2.8 * swell + white * 0.035;
    }

    const oceanSource = this.context.createBufferSource();
    const oceanFilter = this.context.createBiquadFilter();
    this.oceanGain = this.context.createGain();
    oceanSource.buffer = buffer;
    oceanSource.loop = true;
    oceanFilter.type = 'lowpass';
    oceanFilter.frequency.value = 760;
    oceanFilter.Q.value = 0.45;
    this.oceanGain.gain.value = 0.34;
    oceanSource.connect(oceanFilter).connect(this.oceanGain).connect(this.ambience);
    oceanSource.start();

    const windSource = this.context.createBufferSource();
    this.windFilter = this.context.createBiquadFilter();
    this.windGain = this.context.createGain();
    windSource.buffer = buffer;
    windSource.loop = true;
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 2150;
    this.windFilter.Q.value = 0.62;
    this.windGain.gain.value = 0.075;
    windSource.connect(this.windFilter).connect(this.windGain).connect(this.ambience);
    windSource.start(0, 3.4);

    const rainSource = this.context.createBufferSource();
    const rainFilter = this.context.createBiquadFilter();
    this.rainGain = this.context.createGain();
    rainSource.buffer = buffer;
    rainSource.loop = true;
    rainFilter.type = 'highpass';
    rainFilter.frequency.value = 2850;
    rainFilter.Q.value = 0.38;
    this.rainGain.gain.value = 0;
    rainSource.connect(rainFilter).connect(this.rainGain).connect(this.ambience);
    rainSource.start(0, 7.1);

    const lfo = this.context.createOscillator();
    const lfoGain = this.context.createGain();
    lfo.frequency.value = 0.083;
    lfoGain.gain.value = 0.035;
    lfo.connect(lfoGain).connect(this.windGain.gain);
    lfo.start();
  }

  private startMusicLayer(): void {
    if (!this.context || !this.music) return;
    const filter = this.context.createBiquadFilter();
    const layerGain = this.context.createGain();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    filter.Q.value = 0.3;
    layerGain.gain.value = 0.026;
    filter.connect(layerGain).connect(this.music);
    for (const frequency of [110, 165]) {
      const oscillator = this.context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      oscillator.detune.value = randomRange(this.random, -4, 4);
      oscillator.connect(filter);
      oscillator.start();
    }
    const lfo = this.context.createOscillator();
    const lfoGain = this.context.createGain();
    lfo.frequency.value = 0.038;
    lfoGain.gain.value = 0.008;
    lfo.connect(lfoGain).connect(layerGain.gain);
    lfo.start();
  }

  private playCreak(): void {
    if (!this.context || !this.ambience) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(randomRange(this.random, 72, 105), now);
    oscillator.frequency.exponentialRampToValueAtTime(randomRange(this.random, 38, 55), now + 0.36);
    filter.type = 'bandpass';
    filter.frequency.value = randomRange(this.random, 430, 530);
    filter.Q.value = 3.4;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(randomRange(this.random, 0.02, 0.028), now + 0.045);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    oscillator.connect(filter).connect(gain).connect(this.ambience);
    oscillator.start(now);
    oscillator.stop(now + 0.44);
  }

  private noiseBurst(duration: number, frequency: number, volume: number, type: BiquadFilterType): void {
    if (!this.context || !this.effects || !this.enabled || this.focusMuted) return;
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, Math.ceil(sampleRate * duration), sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      const envelope = Math.pow(1 - index / data.length, 1.7);
      data[index] = (this.random() * 2 - 1) * envelope;
    }
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = type === 'bandpass' ? 0.8 : 0.35;
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(filter).connect(gain).connect(this.effects);
    source.start();
  }
}
