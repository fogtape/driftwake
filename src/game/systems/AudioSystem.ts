import { createSeededRandom, randomRange } from '../math/random';
import type { AudioMix } from '../../state/gameStore';

export class AudioSystem {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambience: GainNode | null = null;
  private effects: GainNode | null = null;
  private creatures: GainNode | null = null;
  private music: GainNode | null = null;
  private ui: GainNode | null = null;
  private nextCreakAt = 4;
  private nextReelAt = 0;
  private readonly random = createSeededRandom(0xa0d10);
  private enabled = true;
  private mix: AudioMix = {
    master: 0.78,
    music: 0.2,
    ambience: 0.43,
    effects: 0.72,
    creatures: 0.78,
    ui: 0.56,
  };

  async begin(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext({ latencyHint: 'interactive' });
      this.master = this.context.createGain();
      this.ambience = this.context.createGain();
      this.effects = this.context.createGain();
      this.creatures = this.context.createGain();
      this.music = this.context.createGain();
      this.ui = this.context.createGain();
      this.master.gain.value = this.enabled ? this.mix.master : 0;
      this.ambience.gain.value = this.mix.ambience;
      this.effects.gain.value = this.mix.effects;
      this.creatures.gain.value = this.mix.creatures;
      this.music.gain.value = this.mix.music;
      this.ui.gain.value = this.mix.ui;
      this.ambience.connect(this.master);
      this.effects.connect(this.master);
      this.creatures.connect(this.master);
      this.music.connect(this.master);
      this.ui.connect(this.master);
      this.master.connect(this.context.destination);
      this.startAmbientLayers();
    }
    if (this.context.state !== 'running') await this.context.resume();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!this.context || !this.master) return;
    this.master.gain.setTargetAtTime(enabled ? this.mix.master : 0, this.context.currentTime, 0.06);
  }

  setMix(mix: AudioMix): void {
    this.mix = { ...mix };
    if (!this.context) return;
    const now = this.context.currentTime;
    this.master?.gain.setTargetAtTime(this.enabled ? mix.master : 0, now, 0.05);
    this.music?.gain.setTargetAtTime(mix.music, now, 0.08);
    this.ambience?.gain.setTargetAtTime(mix.ambience, now, 0.08);
    this.effects?.gain.setTargetAtTime(mix.effects, now, 0.05);
    this.creatures?.gain.setTargetAtTime(mix.creatures, now, 0.05);
    this.ui?.gain.setTargetAtTime(mix.ui, now, 0.04);
  }

  update(time: number): void {
    if (!this.context || time < this.nextCreakAt) return;
    this.playCreak();
    this.nextCreakAt = time + randomRange(this.random, 4.8, 10.5);
  }

  playUi(): void {
    if (!this.context || !this.ui) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(520, now);
    oscillator.frequency.exponentialRampToValueAtTime(680, now + 0.055);
    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    oscillator.connect(gain).connect(this.ui);
    oscillator.start(now);
    oscillator.stop(now + 0.09);
  }

  playCast(charge: number): void {
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    this.noiseBurst(0.17, 620 + charge * 520, 0.11, 'bandpass');
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(180 + charge * 90, now);
    oscillator.frequency.exponentialRampToValueAtTime(72, now + 0.16);
    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    oscillator.connect(gain).connect(this.effects);
    oscillator.start(now);
    oscillator.stop(now + 0.19);
  }

  playSplash(): void {
    this.noiseBurst(0.42, 980, 0.18, 'lowpass');
    this.noiseBurst(0.14, 2400, 0.08, 'bandpass');
  }

  playCollect(): void {
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    [0, 0.055].forEach((offset, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(index === 0 ? 340 : 510, now + offset);
      gain.gain.setValueAtTime(0.055, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.12);
      oscillator.connect(gain).connect(this.effects!);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.13);
    });
  }

  playEquip(): void {
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(210, now);
    oscillator.frequency.exponentialRampToValueAtTime(145, now + 0.07);
    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);
    oscillator.connect(gain).connect(this.effects);
    oscillator.start(now);
    oscillator.stop(now + 0.09);
  }

  playBuild(): void {
    this.playWoodKnock(0.12, 0.13);
    if (!this.context) return;
    const delay = window.setTimeout(() => {
      this.playWoodKnock(0.08, 0.09);
      window.clearTimeout(delay);
    }, 72);
  }

  playRepair(): void {
    this.playWoodKnock(0.085, 0.1);
    this.noiseBurst(0.075, 1450, 0.035, 'bandpass');
  }

  playDenied(): void {
    if (!this.context || !this.ui) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(132, now);
    oscillator.frequency.setValueAtTime(105, now + 0.07);
    gain.gain.setValueAtTime(0.022, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    oscillator.connect(gain).connect(this.ui);
    oscillator.start(now);
    oscillator.stop(now + 0.15);
  }

  playFishingCast(): void {
    this.noiseBurst(0.21, 1700, 0.07, 'bandpass');
    this.noiseBurst(0.11, 420, 0.045, 'lowpass');
  }

  playNibble(): void {
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    [0, 0.12, 0.22].forEach((offset, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 590 + index * 85;
      gain.gain.setValueAtTime(0.028 + index * 0.006, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.065);
      oscillator.connect(gain).connect(this.effects!);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.07);
    });
  }

  playReel(tension: number): void {
    if (!this.context || !this.effects || this.context.currentTime < this.nextReelAt) return;
    const now = this.context.currentTime;
    this.nextReelAt = now + 0.095 - Math.min(0.035, tension * 0.03);
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = 86 + tension * 58;
    gain.gain.setValueAtTime(0.018 + tension * 0.016, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
    oscillator.connect(gain).connect(this.effects);
    oscillator.start(now);
    oscillator.stop(now + 0.05);
  }

  playCatch(): void {
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    [320, 480, 710].forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      const start = now + index * 0.065;
      oscillator.type = 'triangle';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.04, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);
      oscillator.connect(gain).connect(this.effects!);
      oscillator.start(start);
      oscillator.stop(start + 0.15);
    });
  }

  playLineBreak(): void {
    this.noiseBurst(0.18, 2600, 0.08, 'highpass');
    this.noiseBurst(0.09, 520, 0.055, 'bandpass');
  }

  playSpearSwing(): void {
    this.noiseBurst(0.14, 1350, 0.06, 'bandpass');
  }

  playSpearHit(): void {
    this.noiseBurstTo(0.22, 480, 0.13, 'lowpass', this.creatures);
    this.noiseBurst(0.08, 2100, 0.06, 'bandpass');
  }

  playSharkWarning(): void {
    if (!this.context || !this.creatures) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(58, now);
    oscillator.frequency.exponentialRampToValueAtTime(37, now + 0.72);
    filter.type = 'lowpass';
    filter.frequency.value = 240;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.055, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.78);
    oscillator.connect(filter).connect(gain).connect(this.creatures);
    oscillator.start(now);
    oscillator.stop(now + 0.8);
  }

  playSharkBite(): void {
    this.noiseBurstTo(0.34, 310, 0.2, 'lowpass', this.creatures);
    this.noiseBurstTo(0.12, 1850, 0.11, 'bandpass', this.creatures);
    if (!this.context || !this.creatures) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(92, now);
    oscillator.frequency.exponentialRampToValueAtTime(44, now + 0.22);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    oscillator.connect(gain).connect(this.creatures);
    oscillator.start(now);
    oscillator.stop(now + 0.25);
  }

  dispose(): void {
    void this.context?.close();
    this.context = null;
    this.master = null;
    this.ambience = null;
    this.effects = null;
    this.creatures = null;
    this.music = null;
    this.ui = null;
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
    const oceanGain = this.context.createGain();
    oceanSource.buffer = buffer;
    oceanSource.loop = true;
    oceanFilter.type = 'lowpass';
    oceanFilter.frequency.value = 760;
    oceanFilter.Q.value = 0.45;
    oceanGain.gain.value = 0.34;
    oceanSource.connect(oceanFilter).connect(oceanGain).connect(this.ambience);
    oceanSource.start();

    const windSource = this.context.createBufferSource();
    const windFilter = this.context.createBiquadFilter();
    const windGain = this.context.createGain();
    windSource.buffer = buffer;
    windSource.loop = true;
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 2150;
    windFilter.Q.value = 0.62;
    windGain.gain.value = 0.075;
    windSource.connect(windFilter).connect(windGain).connect(this.ambience);
    windSource.start(0, 3.4);

    const lfo = this.context.createOscillator();
    const lfoGain = this.context.createGain();
    lfo.frequency.value = 0.083;
    lfoGain.gain.value = 0.035;
    lfo.connect(lfoGain).connect(windGain.gain);
    lfo.start();
    this.startMusicLayer();
  }

  private startMusicLayer(): void {
    if (!this.context || !this.music) return;
    const chord = [55, 82.41, 110];
    chord.forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      const filter = this.context!.createBiquadFilter();
      const gain = this.context!.createGain();
      const lfo = this.context!.createOscillator();
      const lfoGain = this.context!.createGain();
      oscillator.type = index === 0 ? 'sine' : 'triangle';
      oscillator.frequency.value = frequency;
      filter.type = 'lowpass';
      filter.frequency.value = 310 + index * 90;
      gain.gain.value = index === 0 ? 0.045 : 0.018;
      lfo.frequency.value = 0.027 + index * 0.011;
      lfoGain.gain.value = index === 0 ? 0.012 : 0.007;
      lfo.connect(lfoGain).connect(gain.gain);
      oscillator.connect(filter).connect(gain).connect(this.music!);
      oscillator.start(this.context!.currentTime + index * 0.7);
      lfo.start(this.context!.currentTime + index * 1.1);
    });
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
    filter.frequency.value = 480;
    filter.Q.value = 3.4;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.024, now + 0.045);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    oscillator.connect(filter).connect(gain).connect(this.ambience);
    oscillator.start(now);
    oscillator.stop(now + 0.44);
  }

  private noiseBurst(duration: number, frequency: number, volume: number, type: BiquadFilterType): void {
    this.noiseBurstTo(duration, frequency, volume, type, this.effects);
  }

  private playWoodKnock(volume: number, duration: number): void {
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(178, now);
    oscillator.frequency.exponentialRampToValueAtTime(72, now + duration);
    filter.type = 'bandpass';
    filter.frequency.value = 360;
    filter.Q.value = 0.75;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(filter).connect(gain).connect(this.effects);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.01);
    this.noiseBurst(duration * 0.65, 740, volume * 0.35, 'bandpass');
  }

  private noiseBurstTo(
    duration: number,
    frequency: number,
    volume: number,
    type: BiquadFilterType,
    target: GainNode | null,
  ): void {
    if (!this.context || !target) return;
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
    source.connect(filter).connect(gain).connect(target);
    source.start();
  }
}
