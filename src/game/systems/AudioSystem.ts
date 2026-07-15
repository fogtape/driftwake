import { createSeededRandom, randomRange } from '../math/random';

export class AudioSystem {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambience: GainNode | null = null;
  private effects: GainNode | null = null;
  private nextCreakAt = 4;
  private readonly random = createSeededRandom(0xa0d10);
  private enabled = true;

  async begin(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext({ latencyHint: 'interactive' });
      this.master = this.context.createGain();
      this.ambience = this.context.createGain();
      this.effects = this.context.createGain();
      this.master.gain.value = this.enabled ? 0.78 : 0;
      this.ambience.gain.value = 0.43;
      this.effects.gain.value = 0.72;
      this.ambience.connect(this.master);
      this.effects.connect(this.master);
      this.master.connect(this.context.destination);
      this.startAmbientLayers();
    }
    if (this.context.state !== 'running') await this.context.resume();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!this.context || !this.master) return;
    this.master.gain.setTargetAtTime(enabled ? 0.78 : 0, this.context.currentTime, 0.06);
  }

  update(time: number): void {
    if (!this.context || time < this.nextCreakAt) return;
    this.playCreak();
    this.nextCreakAt = time + randomRange(this.random, 4.8, 10.5);
  }

  playUi(): void {
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(520, now);
    oscillator.frequency.exponentialRampToValueAtTime(680, now + 0.055);
    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    oscillator.connect(gain).connect(this.effects);
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

  dispose(): void {
    void this.context?.close();
    this.context = null;
    this.master = null;
    this.ambience = null;
    this.effects = null;
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
    if (!this.context || !this.effects) return;
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

