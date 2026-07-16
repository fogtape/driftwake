import { createSeededRandom, randomRange } from '../math/random';
import type { AudioMix } from '../../state/gameStore';
import type { HarvestNodeType } from '../domain/island';
import type { PlayerSurface } from '../domain/save';
import type { ReefNodeType } from '../domain/underwater';

export class AudioSystem {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambience: GainNode | null = null;
  private effects: GainNode | null = null;
  private creatures: GainNode | null = null;
  private music: GainNode | null = null;
  private ui: GainNode | null = null;
  private worldFilter: BiquadFilterNode | null = null;
  private fireLoop: GainNode | null = null;
  private steamLoop: GainNode | null = null;
  private islandLoop: GainNode | null = null;
  private underwaterLoop: GainNode | null = null;
  private sailLoop: GainNode | null = null;
  private nextCreakAt = 4;
  private nextBirdAt = 6;
  private nextReelAt = 0;
  private readonly random = createSeededRandom(0xa0d10);
  private enabled = true;
  private deviceFireActivity = 0;
  private deviceSteamActivity = 0;
  private islandActivity = 0;
  private underwaterActivity = 0;
  private sailActivity = 0;
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
      this.worldFilter = this.context.createBiquadFilter();
      this.master.gain.value = this.enabled ? this.mix.master : 0;
      this.ambience.gain.value = this.mix.ambience;
      this.effects.gain.value = this.mix.effects;
      this.creatures.gain.value = this.mix.creatures;
      this.music.gain.value = this.mix.music;
      this.ui.gain.value = this.mix.ui;
      this.worldFilter.type = 'lowpass';
      this.worldFilter.frequency.value = 18000;
      this.worldFilter.Q.value = 0.2;
      this.ambience.connect(this.worldFilter);
      this.effects.connect(this.worldFilter);
      this.creatures.connect(this.worldFilter);
      this.music.connect(this.worldFilter);
      this.worldFilter.connect(this.master);
      this.ui.connect(this.master);
      this.master.connect(this.context.destination);
      this.startAmbientLayers();
      this.startDeviceLayers();
      this.startIslandLayer();
      this.startUnderwaterLayer();
      this.startNavigationLayer();
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
    if (!this.context) return;
    if (time >= this.nextCreakAt) {
      this.playCreak();
      this.nextCreakAt = time + randomRange(this.random, 4.8, 10.5);
    }
    if (this.islandActivity > 0.18 && time >= this.nextBirdAt) {
      this.playIslandBird();
      this.nextBirdAt = time + randomRange(this.random, 5.5, 12.5);
    }
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

  setDeviceActivity(fire: number, steam: number): void {
    this.deviceFireActivity = Math.max(0, Math.min(1, fire));
    this.deviceSteamActivity = Math.max(0, Math.min(1, steam));
    if (!this.context) return;
    const now = this.context.currentTime;
    this.fireLoop?.gain.setTargetAtTime(this.deviceFireActivity * 0.052, now, 0.18);
    this.steamLoop?.gain.setTargetAtTime(this.deviceSteamActivity * 0.035, now, 0.22);
  }

  setIslandActivity(activity: number): void {
    this.islandActivity = Math.max(0, Math.min(1, activity));
    if (!this.context) return;
    this.islandLoop?.gain.setTargetAtTime(this.islandActivity * 0.06, this.context.currentTime, 0.45);
  }

  setUnderwaterActivity(activity: number): void {
    this.underwaterActivity = Math.max(0, Math.min(1, activity));
    if (!this.context) return;
    const now = this.context.currentTime;
    this.underwaterLoop?.gain.setTargetAtTime(this.underwaterActivity * 0.085, now, 0.28);
    this.worldFilter?.frequency.setTargetAtTime(18000 - this.underwaterActivity * 16950, now, 0.16);
    if (this.worldFilter) this.worldFilter.Q.setTargetAtTime(0.2 + this.underwaterActivity * 0.72, now, 0.16);
  }

  setSailActivity(activity: number): void {
    this.sailActivity = Math.max(0, Math.min(1, activity));
    if (!this.context) return;
    this.sailLoop?.gain.setTargetAtTime(this.sailActivity * 0.07, this.context.currentTime, 0.35);
  }

  playSailToggle(deployed: boolean): void {
    this.noiseBurst(deployed ? 0.64 : 0.46, deployed ? 1850 : 1320, deployed ? 0.085 : 0.07, 'bandpass');
    this.noiseBurst(0.18, 3600, 0.035, 'highpass');
    this.playWoodKnock(0.045, 0.065);
    if (!this.context) return;
    const timer = window.setTimeout(() => {
      this.noiseBurst(0.12, deployed ? 2400 : 980, 0.045, 'bandpass');
      window.clearTimeout(timer);
    }, deployed ? 170 : 110);
  }

  playSailTrim(): void {
    this.noiseBurst(0.16, 2350, 0.055, 'bandpass');
    this.noiseBurst(0.09, 820, 0.032, 'lowpass');
    this.playWoodKnock(0.026, 0.045);
  }

  playAnchor(deployed: boolean): void {
    this.noiseBurst(deployed ? 0.82 : 0.62, deployed ? 410 : 620, deployed ? 0.13 : 0.09, 'lowpass');
    this.noiseBurst(0.46, 1680, 0.07, 'bandpass');
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(deployed ? 92 : 68, now);
    oscillator.frequency.exponentialRampToValueAtTime(deployed ? 48 : 124, now + 0.42);
    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.46);
    oscillator.connect(gain).connect(this.effects);
    oscillator.start(now);
    oscillator.stop(now + 0.47);
  }

  playFootstep(surface: PlayerSurface): void {
    if (surface === 'raft') {
      this.playWoodKnock(0.027, 0.065);
      this.noiseBurst(0.055, 1100, 0.012, 'bandpass');
      return;
    }
    if (surface === 'water') {
      this.noiseBurst(0.34, 620, 0.042, 'lowpass');
      this.noiseBurst(0.13, 2100, 0.018, 'bandpass');
      return;
    }
    this.noiseBurst(0.11, 330, 0.035, 'lowpass');
    this.noiseBurst(0.07, 1680, 0.018, 'bandpass');
  }

  playAxeSwing(): void {
    this.noiseBurst(0.17, 1280, 0.072, 'bandpass');
    this.noiseBurst(0.1, 2850, 0.028, 'highpass');
  }

  playChop(finalHit: boolean): void {
    this.playWoodKnock(finalHit ? 0.15 : 0.105, finalHit ? 0.18 : 0.13);
    this.noiseBurst(finalHit ? 0.19 : 0.11, 1850, finalHit ? 0.065 : 0.042, 'bandpass');
  }

  playTreeFall(): void {
    this.noiseBurst(0.72, 260, 0.105, 'lowpass');
    if (!this.context) return;
    const timer = window.setTimeout(() => {
      this.playWoodKnock(0.18, 0.22);
      this.noiseBurst(0.42, 520, 0.085, 'lowpass');
      window.clearTimeout(timer);
    }, 720);
  }

  playGather(type: HarvestNodeType): void {
    if (type === 'stone') {
      this.playWoodKnock(0.035, 0.055);
      this.noiseBurst(0.08, 980, 0.03, 'bandpass');
    } else if (type === 'branch') {
      this.playWoodKnock(0.055, 0.08);
      this.noiseBurst(0.08, 1650, 0.025, 'bandpass');
    } else {
      this.noiseBurst(0.12, 2150, 0.035, 'highpass');
      this.playCollect();
    }
  }

  playIslandArrival(): void {
    this.noiseBurst(0.78, 520, 0.09, 'lowpass');
    if (!this.context || !this.ambience) return;
    const now = this.context.currentTime;
    [164.81, 220].forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      const start = now + index * 0.12;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.025, start + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.82);
      oscillator.connect(gain).connect(this.ambience!);
      oscillator.start(start);
      oscillator.stop(start + 0.84);
    });
  }

  playWaterEntry(): void {
    this.noiseBurst(0.58, 720, 0.13, 'lowpass');
    this.noiseBurst(0.24, 2350, 0.055, 'bandpass');
  }

  playReefHookSwing(): void {
    this.noiseBurst(0.2, 840, 0.048, 'bandpass');
    this.noiseBurst(0.11, 260, 0.035, 'lowpass');
  }

  playReefStrike(type: ReefNodeType, finalHit: boolean): void {
    const lowFrequency = type === 'metalOre' ? 310 : type === 'clay' ? 190 : 245;
    const highFrequency = type === 'metalOre' ? 1760 : type === 'clay' ? 720 : 1050;
    this.noiseBurst(finalHit ? 0.34 : 0.22, lowFrequency, finalHit ? 0.11 : 0.072, 'lowpass');
    this.noiseBurst(finalHit ? 0.18 : 0.1, highFrequency, type === 'metalOre' ? 0.065 : 0.04, 'bandpass');
    if (!this.context || !this.effects || type !== 'metalOre') return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(finalHit ? 420 : 510, now);
    oscillator.frequency.exponentialRampToValueAtTime(185, now + 0.13);
    gain.gain.setValueAtTime(finalHit ? 0.055 : 0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    oscillator.connect(gain).connect(this.effects);
    oscillator.start(now);
    oscillator.stop(now + 0.16);
  }

  playReefGather(): void {
    this.noiseBurst(0.3, 460, 0.055, 'lowpass');
    this.noiseBurst(0.18, 1500, 0.032, 'bandpass');
    this.playCollect();
  }

  playBreathWarning(critical: boolean): void {
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    for (let index = 0; index < (critical ? 3 : 2); index += 1) {
      const start = now + index * 0.16;
      const oscillator = this.context.createOscillator();
      const filter = this.context.createBiquadFilter();
      const gain = this.context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(critical ? 118 : 92, start);
      oscillator.frequency.exponentialRampToValueAtTime(critical ? 74 : 58, start + 0.13);
      filter.type = 'lowpass';
      filter.frequency.value = 310;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(critical ? 0.085 : 0.052, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.15);
      oscillator.connect(filter).connect(gain).connect(this.effects);
      oscillator.start(start);
      oscillator.stop(start + 0.16);
    }
  }

  playPlayerBite(): void {
    this.noiseBurstTo(0.42, 220, 0.24, 'lowpass', this.creatures);
    this.noiseBurstTo(0.18, 1320, 0.11, 'bandpass', this.creatures);
  }

  playDevicePlace(): void {
    this.playWoodKnock(0.11, 0.12);
    this.noiseBurst(0.14, 1280, 0.075, 'bandpass');
    if (!this.context) return;
    const timer = window.setTimeout(() => {
      this.noiseBurst(0.1, 1820, 0.05, 'highpass');
      window.clearTimeout(timer);
    }, 82);
  }

  playIgnite(): void {
    this.noiseBurst(0.22, 2100, 0.055, 'highpass');
    this.noiseBurst(0.18, 420, 0.08, 'lowpass');
  }

  playDeviceReady(isPurifier: boolean): void {
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    const frequencies = isPurifier ? [430, 610] : [330, 495];
    frequencies.forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      const start = now + index * 0.1;
      gain.gain.setValueAtTime(0.035, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      oscillator.connect(gain).connect(this.effects!);
      oscillator.start(start);
      oscillator.stop(start + 0.19);
    });
    if (isPurifier) this.noiseBurst(0.3, 3200, 0.025, 'highpass');
  }

  playDeviceBurnt(): void {
    this.noiseBurst(0.28, 680, 0.06, 'bandpass');
    this.noiseBurst(0.18, 2400, 0.035, 'highpass');
  }

  playDeviceLost(): void {
    this.playWoodKnock(0.12, 0.16);
    this.noiseBurst(0.38, 720, 0.12, 'lowpass');
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
    this.worldFilter = null;
    this.fireLoop = null;
    this.steamLoop = null;
    this.islandLoop = null;
    this.underwaterLoop = null;
    this.sailLoop = null;
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

  private startNavigationLayer(): void {
    if (!this.context || !this.effects) return;
    const duration = 4;
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, duration * sampleRate, sampleRate);
    const channel = buffer.getChannelData(0);
    let brown = 0;
    for (let index = 0; index < channel.length; index += 1) {
      const white = this.random() * 2 - 1;
      brown = (brown + white * 0.035) / 1.035;
      const fabricPulse = 0.55 + Math.sin((index / sampleRate) * Math.PI * 0.84) * 0.28;
      const snap = this.random() > 0.9988 ? white * 0.42 : 0;
      channel[index] = (brown * 1.6 + white * 0.08 + snap) * fabricPulse;
    }
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    this.sailLoop = this.context.createGain();
    source.buffer = buffer;
    source.loop = true;
    filter.type = 'bandpass';
    filter.frequency.value = 1640;
    filter.Q.value = 0.55;
    this.sailLoop.gain.value = this.sailActivity * 0.07;
    source.connect(filter).connect(this.sailLoop).connect(this.effects);
    source.start(0, 0.7);
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

  private startDeviceLayers(): void {
    if (!this.context || !this.effects) return;
    const duration = 5;
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, duration * sampleRate, sampleRate);
    const channel = buffer.getChannelData(0);
    let brown = 0;
    for (let index = 0; index < channel.length; index += 1) {
      const white = this.random() * 2 - 1;
      brown = (brown + white * 0.05) / 1.05;
      const crackle = this.random() > 0.996 ? (this.random() * 2 - 1) * 0.9 : 0;
      channel[index] = brown * 0.62 + white * 0.19 + crackle;
    }

    const fireSource = this.context.createBufferSource();
    const fireFilter = this.context.createBiquadFilter();
    this.fireLoop = this.context.createGain();
    fireSource.buffer = buffer;
    fireSource.loop = true;
    fireFilter.type = 'bandpass';
    fireFilter.frequency.value = 760;
    fireFilter.Q.value = 0.42;
    this.fireLoop.gain.value = this.deviceFireActivity * 0.052;
    fireSource.connect(fireFilter).connect(this.fireLoop).connect(this.effects);
    fireSource.start();

    const steamSource = this.context.createBufferSource();
    const steamFilter = this.context.createBiquadFilter();
    this.steamLoop = this.context.createGain();
    steamSource.buffer = buffer;
    steamSource.loop = true;
    steamFilter.type = 'highpass';
    steamFilter.frequency.value = 2650;
    steamFilter.Q.value = 0.2;
    this.steamLoop.gain.value = this.deviceSteamActivity * 0.035;
    steamSource.connect(steamFilter).connect(this.steamLoop).connect(this.effects);
    steamSource.start(0, 1.7);
  }

  private startIslandLayer(): void {
    if (!this.context || !this.ambience) return;
    const duration = 7;
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, duration * sampleRate, sampleRate);
    const channel = buffer.getChannelData(0);
    let smooth = 0;
    for (let index = 0; index < channel.length; index += 1) {
      const white = this.random() * 2 - 1;
      smooth += (white - smooth) * 0.12;
      const frondPulse = 0.35 + Math.pow(Math.max(0, Math.sin((index / sampleRate) * 0.93)), 3) * 0.65;
      channel[index] = (white * 0.24 + smooth * 0.76) * frondPulse;
    }
    const source = this.context.createBufferSource();
    const highpass = this.context.createBiquadFilter();
    const lowpass = this.context.createBiquadFilter();
    this.islandLoop = this.context.createGain();
    source.buffer = buffer;
    source.loop = true;
    highpass.type = 'highpass';
    highpass.frequency.value = 720;
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 3800;
    this.islandLoop.gain.value = this.islandActivity * 0.06;
    source.connect(highpass).connect(lowpass).connect(this.islandLoop).connect(this.ambience);
    source.start(0, 2.3);
  }

  private startUnderwaterLayer(): void {
    if (!this.context || !this.ambience) return;
    const duration = 8;
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, duration * sampleRate, sampleRate);
    const channel = buffer.getChannelData(0);
    let slow = 0;
    for (let index = 0; index < channel.length; index += 1) {
      const white = this.random() * 2 - 1;
      slow += (white - slow) * 0.008;
      const pulse = 0.72 + Math.sin((index / sampleRate) * 0.47) * 0.18;
      channel[index] = (slow * 0.9 + white * 0.1) * pulse;
    }
    const source = this.context.createBufferSource();
    const lowpass = this.context.createBiquadFilter();
    const resonance = this.context.createBiquadFilter();
    this.underwaterLoop = this.context.createGain();
    source.buffer = buffer;
    source.loop = true;
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 460;
    resonance.type = 'peaking';
    resonance.frequency.value = 138;
    resonance.Q.value = 1.1;
    resonance.gain.value = 4.5;
    this.underwaterLoop.gain.value = this.underwaterActivity * 0.085;
    source.connect(lowpass).connect(resonance).connect(this.underwaterLoop).connect(this.ambience);
    source.start(0, 1.4);
  }

  private playIslandBird(): void {
    if (!this.context || !this.ambience) return;
    const now = this.context.currentTime;
    const base = randomRange(this.random, 1280, 1760);
    for (let index = 0; index < 2; index += 1) {
      const start = now + index * randomRange(this.random, 0.11, 0.18);
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(base * (1 + index * 0.08), start);
      oscillator.frequency.exponentialRampToValueAtTime(base * (1.34 + index * 0.06), start + 0.075);
      oscillator.frequency.exponentialRampToValueAtTime(base * 1.08, start + 0.14);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.014 * this.islandActivity, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.15);
      oscillator.connect(gain).connect(this.ambience);
      oscillator.start(start);
      oscillator.stop(start + 0.16);
    }
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
