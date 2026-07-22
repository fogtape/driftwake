import { createSeededRandom, randomRange } from '../math/random';
import type { AudioMix } from '../../state/gameStore';
import type { HarvestNodeType } from '../domain/island';
import type { PlayerSurface } from '../domain/save';
import type { ReefNodeType } from '../domain/underwater';
import type { DebrisKind } from '../art/ProceduralModels';
import type { FailureCause } from '../domain/failure';
import type { ToolId } from '../domain/items';
import type { SignalTargetId } from '../domain/navigation';

export interface AudioPosition {
  x: number;
  y: number;
  z: number;
}

export interface SignalDestinationAudioDiagnostics {
  targetId: SignalTargetId | null;
  proximity: number;
  pan: number;
  emphasized: boolean;
  layersReady: boolean;
  layerCount: number;
}

const SIGNAL_DESTINATION_GAINS: Record<SignalTargetId, number> = {
  tideRelay: 0.034,
  ironChoir: 0.03,
  stormNeedle: 0.032,
};

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
  private receiverLoop: GainNode | null = null;
  private stormLoop: GainNode | null = null;
  private readonly signalDestinationLoops: Partial<Record<SignalTargetId, GainNode>> = {};
  private readonly signalDestinationPanners: Partial<Record<SignalTargetId, StereoPannerNode>> = {};
  private nextCreakAt = 4;
  private nextBirdAt = 6;
  private nextReelAt = 0;
  private nextHookRopeAt = 0;
  private readonly spatialDisconnectTimers = new Set<number>();
  private readonly random = createSeededRandom(0xa0d10);
  private enabled = true;
  private focusMuted = false;
  private deviceFireActivity = 0;
  private deviceSteamActivity = 0;
  private progressionForgeActivity = 0;
  private islandActivity = 0;
  private underwaterActivity = 0;
  private sailActivity = 0;
  private receiverActivity = 0;
  private stormActivity = 0;
  private signalDestinationAudio: Omit<SignalDestinationAudioDiagnostics, 'layersReady' | 'layerCount'> = {
    targetId: null,
    proximity: 0,
    pan: 0,
    emphasized: false,
  };
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
      this.master.gain.value = this.effectiveMasterGain();
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
      this.startSignalDestinationLayers();
      this.startStormLayer();
    }
    if (this.context.state !== 'running') await this.context.resume();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.applyMasterGain(0.06);
  }

  setFocusMuted(focusMuted: boolean): void {
    this.focusMuted = focusMuted;
    this.applyMasterGain(0.06);
  }

  setMix(mix: AudioMix): void {
    this.mix = { ...mix };
    if (!this.context) return;
    const now = this.context.currentTime;
    this.master?.gain.setTargetAtTime(this.effectiveMasterGain(), now, 0.05);
    this.music?.gain.setTargetAtTime(mix.music, now, 0.08);
    this.ambience?.gain.setTargetAtTime(mix.ambience, now, 0.08);
    this.effects?.gain.setTargetAtTime(mix.effects, now, 0.05);
    this.creatures?.gain.setTargetAtTime(mix.creatures, now, 0.05);
    this.ui?.gain.setTargetAtTime(mix.ui, now, 0.04);
  }

  update(time: number): void {
    if (!this.context || this.focusMuted || !this.enabled) return;
    if (time >= this.nextCreakAt) {
      this.playCreak();
      this.nextCreakAt = time + randomRange(this.random, 4.8, 10.5);
    }
    if (this.islandActivity > 0.18 && time >= this.nextBirdAt) {
      this.playIslandBird();
      this.nextBirdAt = time + randomRange(this.random, 5.5, 12.5);
    }
  }

  setListenerPose(position: AudioPosition, forward: AudioPosition, up?: AudioPosition): void {
    if (!this.context) return;
    const listener = this.context.listener;
    const now = this.context.currentTime;
    if (listener.positionX && listener.forwardX) {
      listener.positionX.setValueAtTime(position.x, now);
      listener.positionY.setValueAtTime(position.y, now);
      listener.positionZ.setValueAtTime(position.z, now);
      listener.forwardX.setValueAtTime(forward.x, now);
      listener.forwardY.setValueAtTime(forward.y, now);
      listener.forwardZ.setValueAtTime(forward.z, now);
      listener.upX.setValueAtTime(up?.x ?? 0, now);
      listener.upY.setValueAtTime(up?.y ?? 1, now);
      listener.upZ.setValueAtTime(up?.z ?? 0, now);
      return;
    }
    const legacyListener = listener as AudioListener & {
      setPosition?: (x: number, y: number, z: number) => void;
      setOrientation?: (x: number, y: number, z: number, upX: number, upY: number, upZ: number) => void;
    };
    legacyListener.setPosition?.(position.x, position.y, position.z);
    legacyListener.setOrientation?.(forward.x, forward.y, forward.z, up?.x ?? 0, up?.y ?? 1, up?.z ?? 0);
  }

  private effectiveMasterGain(): number {
    return this.enabled && !this.focusMuted ? this.mix.master : 0;
  }

  private applyMasterGain(timeConstant: number): void {
    if (!this.context || !this.master) return;
    this.master.gain.setTargetAtTime(this.effectiveMasterGain(), this.context.currentTime, timeConstant);
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

  playCraftQueued(count = 1): void {
    if (!this.context || !this.ui) return;
    const now = this.context.currentTime;
    const strength = Math.min(1, Math.max(1, count) / 4);
    this.noiseBurst(0.055, 1320, 0.018 + strength * 0.012, 'bandpass');
    [330, 440].forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      const start = now + index * 0.045;
      oscillator.type = index === 0 ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.12, start + 0.08);
      gain.gain.setValueAtTime(0.025 + strength * 0.008, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.11);
      oscillator.connect(gain).connect(this.ui!);
      oscillator.start(start);
      oscillator.stop(start + 0.12);
    });
  }

  playCraftComplete(count = 1): void {
    if (!this.context || !this.effects || !this.ui) return;
    const now = this.context.currentTime;
    this.playWoodKnock(0.052 + Math.min(0.025, Math.max(0, count - 1) * 0.006), 0.075);
    this.noiseBurst(0.1, 2380, 0.028, 'bandpass');
    [392, 523.25, 659.25].forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      const start = now + 0.025 + index * 0.055;
      oscillator.type = index === 2 ? 'sine' : 'triangle';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.03 - index * 0.003, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      oscillator.connect(gain).connect(this.ui!);
      oscillator.start(start);
      oscillator.stop(start + 0.19);
    });
  }

  playCraftCancel(): void {
    if (!this.context || !this.ui) return;
    const now = this.context.currentTime;
    this.noiseBurst(0.07, 760, 0.018, 'lowpass');
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(310, now);
    oscillator.frequency.exponentialRampToValueAtTime(155, now + 0.12);
    gain.gain.setValueAtTime(0.027, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    oscillator.connect(gain).connect(this.ui);
    oscillator.start(now);
    oscillator.stop(now + 0.15);
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

  playSplash(position?: AudioPosition): void {
    const spatialTarget = position ? this.createSpatialTarget(position) : null;
    const target = spatialTarget ?? this.effects;
    this.noiseBurstTo(0.42, 980, 0.18, 'lowpass', target);
    this.noiseBurstTo(0.14, 2400, 0.08, 'bandpass', target);
    if (spatialTarget) this.releaseSpatialTarget(spatialTarget, 540);
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

  playSalvagePickup(kind: DebrisKind, position?: AudioPosition): void {
    const spatialTarget = position ? this.createSpatialTarget(position) : null;
    const target = spatialTarget ?? this.effects;
    if (kind === 'cache' || kind === 'barrel' || kind === 'timber') {
      const heavy = kind === 'cache';
      this.playWoodKnockTo(heavy ? 0.09 : kind === 'barrel' ? 0.065 : 0.045, heavy ? 0.12 : 0.085, target);
      this.noiseBurstTo(heavy ? 0.16 : 0.1, heavy ? 1480 : 1180, heavy ? 0.045 : 0.032, 'bandpass', target);
    } else if (kind === 'polymer') {
      this.noiseBurstTo(0.11, 2250, 0.05, 'bandpass', target);
      this.noiseBurstTo(0.055, 4800, 0.024, 'highpass', target);
    } else {
      this.noiseBurstTo(0.18, 3100, 0.042, 'highpass', target);
      this.noiseBurstTo(0.09, 840, 0.024, 'bandpass', target);
    }
    if (spatialTarget) this.releaseSpatialTarget(spatialTarget, 360);
    this.playCollect();
  }

  playHookRope(tension: number): void {
    if (!this.context || !this.effects || this.context.currentTime < this.nextHookRopeAt) return;
    const normalized = Math.max(0, Math.min(1, tension));
    const now = this.context.currentTime;
    this.nextHookRopeAt = now + 0.14 - normalized * 0.035;
    const oscillator = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    oscillator.type = normalized > 0.82 ? 'sawtooth' : 'triangle';
    oscillator.frequency.setValueAtTime(72 + normalized * 64, now);
    oscillator.frequency.exponentialRampToValueAtTime(48 + normalized * 34, now + 0.06);
    filter.type = 'bandpass';
    filter.frequency.value = 460 + normalized * 620;
    filter.Q.value = 1.1;
    gain.gain.setValueAtTime(0.007 + normalized * 0.015, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);
    oscillator.connect(filter).connect(gain).connect(this.effects);
    oscillator.start(now);
    oscillator.stop(now + 0.07);
  }

  playHookBreak(): void {
    this.noiseBurst(0.16, 3350, 0.095, 'highpass');
    this.noiseBurst(0.09, 620, 0.065, 'bandpass');
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(220, now);
    oscillator.frequency.exponentialRampToValueAtTime(68, now + 0.12);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
    oscillator.connect(gain).connect(this.effects);
    oscillator.start(now);
    oscillator.stop(now + 0.14);
  }

  playToolBreak(tool: ToolId): void {
    if (tool === 'fishingRod') {
      this.playLineBreak();
      this.playWoodKnock(0.11, 0.16);
      return;
    }
    const metal = tool === 'metalSpear' || tool === 'metalAxe';
    this.noiseBurst(metal ? 0.2 : 0.16, metal ? 2850 : 1900, metal ? 0.075 : 0.062, 'highpass');
    this.playWoodKnock(metal ? 0.075 : 0.15, metal ? 0.1 : 0.18);
    if (!metal || !this.context || !this.effects) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(680, now);
    oscillator.frequency.exponentialRampToValueAtTime(118, now + 0.19);
    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.21);
    oscillator.connect(gain).connect(this.effects);
    oscillator.start(now);
    oscillator.stop(now + 0.22);
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

  playRepair(position?: AudioPosition, fibrous = false): void {
    const spatialTarget = position ? this.createSpatialTarget(position) : null;
    const target = spatialTarget ?? this.effects;
    this.playWoodKnockTo(fibrous ? 0.062 : 0.085, 0.1, target);
    this.noiseBurstTo(0.075, fibrous ? 1960 : 1450, fibrous ? 0.028 : 0.035, 'bandpass', target);
    if (fibrous) this.noiseBurstTo(0.052, 3180, 0.018, 'highpass', target);
    if (spatialTarget) this.releaseSpatialTarget(spatialTarget, 360);
  }

  playReplace(position?: AudioPosition, fibrous = false): void {
    const spatialTarget = position ? this.createSpatialTarget(position) : null;
    const target = spatialTarget ?? this.effects;
    this.noiseBurstTo(0.085, fibrous ? 2260 : 1120, 0.042, 'bandpass', target);
    this.playWoodKnockTo(fibrous ? 0.06 : 0.082, 0.075, target);
    const delay = window.setTimeout(() => {
      this.noiseBurstTo(0.055, fibrous ? 3120 : 1740, 0.025, 'highpass', target);
      this.playWoodKnockTo(fibrous ? 0.08 : 0.11, 0.12, target);
      window.clearTimeout(delay);
    }, 78);
    if (spatialTarget) this.releaseSpatialTarget(spatialTarget, 420);
  }

  playCeilingBump(fibrous = false): void {
    this.playWoodKnock(fibrous ? 0.038 : 0.055, fibrous ? 0.065 : 0.085);
    this.noiseBurst(fibrous ? 0.075 : 0.052, fibrous ? 2450 : 980, fibrous ? 0.035 : 0.045, fibrous ? 'highpass' : 'lowpass');
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(fibrous ? 122 : 96, now);
    oscillator.frequency.exponentialRampToValueAtTime(fibrous ? 76 : 54, now + 0.09);
    gain.gain.setValueAtTime(fibrous ? 0.012 : 0.018, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    oscillator.connect(gain).connect(this.effects);
    oscillator.start(now);
    oscillator.stop(now + 0.11);
  }

  playStructureDamage(position: AudioPosition, severity: number, destroyed: boolean, fibrous = false): void {
    const normalized = Math.max(0, Math.min(1, severity));
    const spatialTarget = this.createSpatialTarget(position);
    const target = spatialTarget ?? this.effects;
    this.playWoodKnockTo(0.08 + normalized * 0.055 + (destroyed ? 0.045 : 0), destroyed ? 0.2 : 0.13, target);
    this.noiseBurstTo(
      destroyed ? 0.28 : 0.16,
      fibrous ? 1680 : 820,
      0.04 + normalized * 0.04,
      fibrous ? 'bandpass' : 'lowpass',
      target,
    );
    this.noiseBurstTo(0.1, destroyed ? 2480 : 1840, destroyed ? 0.055 : 0.032, 'bandpass', target);
    if (this.context && target && destroyed) {
      const now = this.context.currentTime;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(fibrous ? 126 : 98, now);
      oscillator.frequency.exponentialRampToValueAtTime(42, now + 0.24);
      gain.gain.setValueAtTime(0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
      oscillator.connect(gain).connect(target);
      oscillator.start(now);
      oscillator.stop(now + 0.27);
    }
    if (spatialTarget) this.releaseSpatialTarget(spatialTarget, destroyed ? 620 : 440);
  }

  playStructureSplash(position: AudioPosition, fibrous = false, strength = 1): void {
    const normalized = Math.max(0.35, Math.min(1, strength));
    const spatialTarget = this.createSpatialTarget(position);
    const target = spatialTarget ?? this.effects;
    this.noiseBurstTo(0.56, 760, 0.13 + normalized * 0.07, 'lowpass', target);
    this.noiseBurstTo(0.24, fibrous ? 2260 : 1540, 0.045 + normalized * 0.025, 'bandpass', target);
    this.playWoodKnockTo(0.055 + normalized * 0.055, fibrous ? 0.12 : 0.17, target);
    if (this.context && target) {
      const now = this.context.currentTime;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(fibrous ? 86 : 72, now);
      oscillator.frequency.exponentialRampToValueAtTime(34, now + 0.34);
      gain.gain.setValueAtTime(0.026 + normalized * 0.028, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
      oscillator.connect(gain).connect(target);
      oscillator.start(now);
      oscillator.stop(now + 0.39);
    }
    if (spatialTarget) this.releaseSpatialTarget(spatialTarget, 760);
  }

  playDoor(open: boolean): void {
    this.playWoodKnock(open ? 0.052 : 0.085, open ? 0.085 : 0.11);
    this.noiseBurst(0.16, open ? 1180 : 860, 0.032, 'bandpass');
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(open ? 138 : 104, now);
    oscillator.frequency.exponentialRampToValueAtTime(open ? 82 : 68, now + 0.16);
    gain.gain.setValueAtTime(0.018, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    oscillator.connect(gain).connect(this.effects);
    oscillator.start(now);
    oscillator.stop(now + 0.19);
  }

  setDeviceActivity(fire: number, steam: number): void {
    this.deviceFireActivity = Math.max(0, Math.min(1, fire));
    this.deviceSteamActivity = Math.max(0, Math.min(1, steam));
    if (!this.context) return;
    const now = this.context.currentTime;
    this.fireLoop?.gain.setTargetAtTime(Math.min(1, this.deviceFireActivity + this.progressionForgeActivity) * 0.052, now, 0.18);
    this.steamLoop?.gain.setTargetAtTime(this.deviceSteamActivity * 0.035, now, 0.22);
  }

  setProgressionForgeActivity(activity: number): void {
    this.progressionForgeActivity = Math.max(0, Math.min(1, activity));
    if (!this.context) return;
    this.fireLoop?.gain.setTargetAtTime(
      Math.min(1, this.deviceFireActivity + this.progressionForgeActivity) * 0.052,
      this.context.currentTime,
      0.2,
    );
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

  setReceiverActivity(activity: number): void {
    this.receiverActivity = Math.max(0, Math.min(1, activity));
    if (!this.context) return;
    this.receiverLoop?.gain.setTargetAtTime(this.receiverActivity * 0.026, this.context.currentTime, 0.22);
  }

  setSignalDestinationActivity(
    targetId: SignalTargetId | null,
    proximity: number,
    pan: number,
    emphasized: boolean,
  ): void {
    this.signalDestinationAudio = {
      targetId,
      proximity: Math.max(0, Math.min(1, proximity)),
      pan: Math.max(-1, Math.min(1, pan)),
      emphasized,
    };
    this.applySignalDestinationMix();
  }

  getSignalDestinationAudioDiagnostics(): SignalDestinationAudioDiagnostics {
    const layerCount = Object.keys(this.signalDestinationLoops).length;
    return {
      ...this.signalDestinationAudio,
      layersReady: Boolean(this.context) && layerCount === 3,
      layerCount,
    };
  }

  setStormActivity(activity: number): void {
    this.stormActivity = Math.max(0, Math.min(1, activity));
    if (!this.context) return;
    this.stormLoop?.gain.setTargetAtTime(this.stormActivity * 0.13, this.context.currentTime, 0.28);
  }

  playThunder(strength = 1): void {
    const level = Math.max(0, Math.min(1, strength));
    this.noiseBurstTo(1.1, 190, 0.2 * level, 'lowpass', this.ambience);
    this.noiseBurstTo(0.52, 720, 0.08 * level, 'bandpass', this.ambience);
    if (!this.context || !this.ambience) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(58, now);
    oscillator.frequency.exponentialRampToValueAtTime(31, now + 0.9);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.09 * level, now + 0.045);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);
    oscillator.connect(gain).connect(this.ambience);
    oscillator.start(now);
    oscillator.stop(now + 1.05);
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

  playSailReinforce(): void {
    this.noiseBurst(0.24, 920, 0.08, 'bandpass');
    this.noiseBurst(0.16, 3150, 0.052, 'highpass');
    this.playWoodKnock(0.055, 0.07);
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    [610, 470, 760].forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      const start = now + index * 0.075;
      oscillator.type = 'triangle';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.036, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
      oscillator.connect(gain).connect(this.effects!);
      oscillator.start(start);
      oscillator.stop(start + 0.13);
    });
  }

  playSailOverload(): void {
    this.noiseBurst(0.62, 1580, 0.14, 'bandpass');
    this.noiseBurst(0.28, 3700, 0.09, 'highpass');
    this.playWoodKnock(0.09, 0.12);
  }

  playHelmRoute(): void {
    this.noiseBurst(0.11, 1850, 0.036, 'bandpass');
    this.noiseBurst(0.08, 680, 0.045, 'lowpass');
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    [392, 523.25].forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      const start = now + index * 0.07;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.026, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);
      oscillator.connect(gain).connect(this.effects!);
      oscillator.start(start);
      oscillator.stop(start + 0.15);
    });
  }

  playReceiverCell(): void {
    this.playWoodKnock(0.035, 0.055);
    this.noiseBurst(0.1, 820, 0.036, 'bandpass');
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    [74, 112].forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      const start = now + index * 0.055;
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.35, start + 0.16);
      gain.gain.setValueAtTime(0.038 - index * 0.008, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      oscillator.connect(gain).connect(this.effects!);
      oscillator.start(start);
      oscillator.stop(start + 0.19);
    });
  }

  playReceiverPower(enabled: boolean): void {
    this.noiseBurst(0.08, enabled ? 2200 : 980, 0.034, 'bandpass');
    this.noiseBurst(0.025, 5200, 0.018, 'highpass');
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = enabled ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(enabled ? 146 : 218, now);
    oscillator.frequency.exponentialRampToValueAtTime(enabled ? 438 : 82, now + 0.24);
    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
    oscillator.connect(gain).connect(this.effects);
    oscillator.start(now);
    oscillator.stop(now + 0.27);
  }

  playReceiverTune(): void {
    this.noiseBurst(0.16, 2650, 0.035, 'bandpass');
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(240, now);
    oscillator.frequency.exponentialRampToValueAtTime(960, now + 0.1);
    oscillator.frequency.exponentialRampToValueAtTime(520, now + 0.22);
    filter.type = 'bandpass';
    filter.frequency.value = 1180;
    filter.Q.value = 2.4;
    gain.gain.setValueAtTime(0.018, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    oscillator.connect(filter).connect(gain).connect(this.effects);
    oscillator.start(now);
    oscillator.stop(now + 0.25);
  }

  playSignalPing(strength: number): void {
    const level = Math.max(0.08, Math.min(1, strength));
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    [0, 0.055].forEach((offset, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = (index ? 928 : 696) + level * 120;
      gain.gain.setValueAtTime((0.009 + level * 0.021) / (index + 1), now + offset);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.12);
      oscillator.connect(gain).connect(this.effects!);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.13);
    });
  }

  playSignalArrival(): void {
    this.noiseBurst(0.38, 3200, 0.045, 'bandpass');
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    [293.66, 440, 659.25, 880].forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      const start = now + index * 0.085;
      oscillator.type = index % 2 ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.038, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
      oscillator.connect(gain).connect(this.effects!);
      oscillator.start(start);
      oscillator.stop(start + 0.33);
    });
  }

  playArrayDiagnostic(success: boolean): void {
    this.noiseBurst(0.06, success ? 3100 : 720, 0.022, 'bandpass');
    if (!this.context || !this.ui) return;
    const now = this.context.currentTime;
    const frequencies = success ? [523.25, 783.99] : [196, 146.83];
    frequencies.forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      const start = now + index * 0.07;
      oscillator.type = success ? 'sine' : 'square';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(success ? 0.022 : 0.014, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
      oscillator.connect(gain).connect(this.ui!);
      oscillator.start(start);
      oscillator.stop(start + 0.13);
    });
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

  playSurvivalWarning(need: 'thirst' | 'hunger', critical: boolean): void {
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    if (need === 'thirst') {
      this.noiseBurst(critical ? 0.22 : 0.14, critical ? 1850 : 2350, critical ? 0.052 : 0.032, 'highpass');
      [0, critical ? 0.16 : 0.2].forEach((offset, index) => {
        const oscillator = this.context!.createOscillator();
        const gain = this.context!.createGain();
        const start = now + offset;
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(critical ? 168 : 205, start);
        oscillator.frequency.exponentialRampToValueAtTime(critical ? 76 : 108, start + 0.13);
        gain.gain.setValueAtTime((critical ? 0.047 : 0.027) / (index + 1), start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.15);
        oscillator.connect(gain).connect(this.effects!);
        oscillator.start(start);
        oscillator.stop(start + 0.16);
      });
      return;
    }
    this.noiseBurst(critical ? 0.52 : 0.34, critical ? 180 : 230, critical ? 0.085 : 0.05, 'lowpass');
    const oscillator = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(critical ? 62 : 74, now);
    oscillator.frequency.exponentialRampToValueAtTime(critical ? 38 : 46, now + 0.42);
    filter.type = 'lowpass';
    filter.frequency.value = 260;
    gain.gain.setValueAtTime(critical ? 0.055 : 0.034, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.46);
    oscillator.connect(filter).connect(gain).connect(this.effects);
    oscillator.start(now);
    oscillator.stop(now + 0.47);
  }

  playDrink(): void {
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    this.noiseBurst(0.38, 780, 0.052, 'lowpass');
    this.noiseBurst(0.16, 2100, 0.025, 'bandpass');
    [0, 0.085, 0.17].forEach((offset, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      const start = now + offset;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(190 - index * 18, start);
      oscillator.frequency.exponentialRampToValueAtTime(112 - index * 9, start + 0.1);
      gain.gain.setValueAtTime(0.025 - index * 0.004, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
      oscillator.connect(gain).connect(this.effects!);
      oscillator.start(start);
      oscillator.stop(start + 0.13);
    });
  }

  playEat(wet = false): void {
    this.noiseBurst(wet ? 0.26 : 0.13, wet ? 620 : 2450, wet ? 0.065 : 0.048, wet ? 'lowpass' : 'highpass');
    this.noiseBurst(0.1, wet ? 1280 : 980, 0.038, 'bandpass');
    this.playWoodKnock(wet ? 0.025 : 0.04, 0.055);
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

  playCollectionNetPlace(): void {
    this.playWoodKnock(0.085, 0.105);
    this.noiseBurst(0.2, 1760, 0.06, 'bandpass');
    this.noiseBurst(0.11, 3820, 0.035, 'highpass');
    if (!this.context) return;
    const timer = window.setTimeout(() => {
      this.playWoodKnock(0.045, 0.065);
      this.noiseBurst(0.08, 2380, 0.028, 'bandpass');
      window.clearTimeout(timer);
    }, 76);
  }

  playCollectionNetCatch(kind: DebrisKind, position?: AudioPosition): void {
    const spatialTarget = position ? this.createSpatialTarget(position) : null;
    const target = spatialTarget ?? this.effects;
    const heavy = kind === 'barrel' || kind === 'cache' || kind === 'timber';
    this.noiseBurstTo(0.18, heavy ? 820 : 1640, heavy ? 0.065 : 0.045, heavy ? 'lowpass' : 'bandpass', target);
    this.noiseBurstTo(0.14, 2920, 0.038, 'highpass', target);
    if (heavy) this.playWoodKnockTo(kind === 'cache' ? 0.065 : 0.04, 0.075, target);
    if (spatialTarget) this.releaseSpatialTarget(spatialTarget, 390);
  }

  playCollectionNetCollect(): void {
    this.noiseBurst(0.14, 2480, 0.045, 'bandpass');
    this.noiseBurst(0.08, 4300, 0.025, 'highpass');
    this.playCollect();
  }

  playCollectionNetLost(position?: AudioPosition): void {
    const spatialTarget = position ? this.createSpatialTarget(position) : null;
    const target = spatialTarget ?? this.effects;
    this.noiseBurstTo(0.32, 680, 0.1, 'lowpass', target);
    this.noiseBurstTo(0.24, 3260, 0.075, 'highpass', target);
    this.playWoodKnockTo(0.09, 0.13, target);
    if (spatialTarget) this.releaseSpatialTarget(spatialTarget, 520);
  }

  playIgnite(): void {
    this.noiseBurst(0.22, 2100, 0.055, 'highpass');
    this.noiseBurst(0.18, 420, 0.08, 'lowpass');
  }

  playWaterCharge(): void {
    this.noiseBurst(0.34, 760, 0.16, 'lowpass');
    this.noiseBurst(0.12, 2550, 0.055, 'bandpass');
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    [820, 1120].forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      const start = now + 0.08 + index * 0.038;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.018, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.1);
      oscillator.connect(gain).connect(this.effects!);
      oscillator.start(start);
      oscillator.stop(start + 0.11);
    });
  }

  playGrillSlot(): void {
    this.noiseBurst(0.18, 1750, 0.085, 'bandpass');
    this.noiseBurst(0.11, 4300, 0.12, 'highpass');
    this.playWoodKnock(0.025, 0.035);
  }

  playStorageOpen(open = true): void {
    this.playWoodKnock(open ? 0.055 : 0.075, open ? 0.07 : 0.09);
    this.noiseBurst(open ? 0.14 : 0.1, open ? 1180 : 840, 0.055, 'bandpass');
    this.noiseBurst(0.08, 3150, 0.075, 'highpass');
  }

  playStorageTransfer(toStorage: boolean): void {
    this.noiseBurst(0.13, toStorage ? 980 : 1320, 0.065, 'bandpass');
    this.noiseBurst(0.08, 3600, 0.052, 'highpass');
    this.playWoodKnock(0.024, 0.035);
  }

  playAnchorReinforce(): void {
    this.noiseBurst(0.24, 720, 0.09, 'bandpass');
    this.noiseBurst(0.13, 3280, 0.06, 'highpass');
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    [186, 148, 220].forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      const start = now + index * 0.07;
      oscillator.type = 'square';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.018, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.075);
      oscillator.connect(gain).connect(this.effects!);
      oscillator.start(start);
      oscillator.stop(start + 0.085);
    });
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

  playResearchOpen(): void {
    this.playWoodKnock(0.045, 0.07);
    this.noiseBurst(0.16, 2350, 0.035, 'highpass');
  }

  playResearchSample(): void {
    this.noiseBurst(0.12, 2850, 0.045, 'highpass');
    this.noiseBurst(0.08, 760, 0.04, 'bandpass');
    if (!this.context || !this.ui) return;
    const now = this.context.currentTime;
    [330, 440].forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      const start = now + index * 0.075;
      oscillator.type = 'triangle';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.025, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      oscillator.connect(gain).connect(this.ui!);
      oscillator.start(start);
      oscillator.stop(start + 0.17);
    });
  }

  playResearchLearn(): void {
    if (!this.context || !this.ui) return;
    const now = this.context.currentTime;
    [392, 523.25, 659.25, 783.99].forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      const start = now + index * 0.065;
      oscillator.type = index % 2 ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.028, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      oscillator.connect(gain).connect(this.ui!);
      oscillator.start(start);
      oscillator.stop(start + 0.23);
    });
  }

  playBrickPlace(): void {
    this.noiseBurst(0.16, 310, 0.1, 'lowpass');
    this.noiseBurst(0.08, 1120, 0.035, 'bandpass');
  }

  playBrickDry(): void {
    this.noiseBurst(0.22, 1850, 0.045, 'bandpass');
    this.noiseBurst(0.1, 3900, 0.024, 'highpass');
  }

  playBrickCollect(): void {
    this.noiseBurst(0.13, 720, 0.07, 'bandpass');
    this.noiseBurst(0.08, 1460, 0.035, 'highpass');
    this.playCollect();
  }

  playSmelterLoad(): void {
    this.noiseBurst(0.2, 430, 0.11, 'lowpass');
    this.noiseBurst(0.13, 1760, 0.065, 'bandpass');
    if (!this.context) return;
    const timer = window.setTimeout(() => {
      this.playIgnite();
      window.clearTimeout(timer);
    }, 105);
  }

  playSmelterReady(): void {
    this.noiseBurst(0.18, 2800, 0.042, 'highpass');
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    [246.94, 369.99, 493.88].forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      const start = now + index * 0.09;
      oscillator.type = 'triangle';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.038, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
      oscillator.connect(gain).connect(this.effects!);
      oscillator.start(start);
      oscillator.stop(start + 0.29);
    });
  }

  playSmelterCollect(glass = false): void {
    this.noiseBurst(0.15, 530, 0.085, 'bandpass');
    this.noiseBurst(glass ? 0.13 : 0.09, glass ? 3900 : 2500, glass ? 0.075 : 0.05, 'highpass');
    this.playCollect();
  }

  playPlantSeed(): void {
    this.noiseBurst(0.16, 420, 0.07, 'lowpass');
    this.noiseBurst(0.11, 1850, 0.045, 'bandpass');
    this.playWoodKnock(0.025, 0.04);
  }

  playPlantWater(): void {
    this.noiseBurst(0.42, 860, 0.18, 'lowpass');
    this.noiseBurst(0.16, 2380, 0.11, 'bandpass');
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(310, now);
    oscillator.frequency.exponentialRampToValueAtTime(118, now + 0.28);
    gain.gain.setValueAtTime(0.026, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    oscillator.connect(gain).connect(this.effects);
    oscillator.start(now);
    oscillator.stop(now + 0.31);
  }

  playPlantReady(): void {
    this.noiseBurst(0.18, 2600, 0.08, 'highpass');
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    [392, 523.25, 659.25].forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      const start = now + index * 0.075;
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.028, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
      oscillator.connect(gain).connect(this.effects!);
      oscillator.start(start);
      oscillator.stop(start + 0.21);
    });
  }

  playPlantWither(): void {
    this.noiseBurst(0.24, 1180, 0.12, 'bandpass');
    this.noiseBurst(0.1, 3100, 0.065, 'highpass');
  }

  playPlantHarvest(): void {
    this.noiseBurst(0.2, 2200, 0.055, 'highpass');
    this.noiseBurst(0.14, 620, 0.06, 'lowpass');
    this.playCollect();
  }

  playCropBirdWarning(): void {
    if (!this.context || !this.creatures) return;
    const now = this.context.currentTime;
    [1480, 1920, 1650].forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      const start = now + index * 0.09;
      oscillator.type = index === 1 ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.72, start + 0.08);
      gain.gain.setValueAtTime(0.048, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.11);
      oscillator.connect(gain).connect(this.creatures!);
      oscillator.start(start);
      oscillator.stop(start + 0.12);
    });
  }

  playCropBirdPeck(): void {
    this.noiseBurstTo(0.075, 1780, 0.024, 'bandpass', this.creatures);
    this.playWoodKnock(0.018, 0.024);
  }

  playCropBirdScare(): void {
    this.noiseBurstTo(0.32, 1750, 0.1, 'bandpass', this.creatures);
    if (!this.context || !this.creatures) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(1760, now);
    oscillator.frequency.exponentialRampToValueAtTime(740, now + 0.22);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    oscillator.connect(gain).connect(this.creatures);
    oscillator.start(now);
    oscillator.stop(now + 0.25);
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

  playNibble(sizeScale = 1): void {
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    const weightPitch = Math.max(0.76, Math.min(1.12, 1.08 - (sizeScale - 0.78) * 0.34));
    [0, 0.12, 0.22].forEach((offset, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = (590 + index * 85) * weightPitch;
      gain.gain.setValueAtTime((0.028 + index * 0.006) * (0.9 + sizeScale * 0.1), now + offset);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.065);
      oscillator.connect(gain).connect(this.effects!);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.07);
    });
  }

  playReel(tension: number, fishPull = 0.5): void {
    if (!this.context || !this.effects || this.context.currentTime < this.nextReelAt) return;
    const now = this.context.currentTime;
    this.nextReelAt = now + 0.095 - Math.min(0.035, tension * 0.03);
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = 78 + tension * 54 + Math.max(0, Math.min(1, fishPull)) * 24;
    gain.gain.setValueAtTime(0.016 + tension * 0.015 + fishPull * 0.006, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
    oscillator.connect(gain).connect(this.effects);
    oscillator.start(now);
    oscillator.stop(now + 0.05);
  }

  playCatch(sizeScale = 1): void {
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    const weightPitch = Math.max(0.78, Math.min(1.08, 1.05 - (sizeScale - 0.78) * 0.3));
    [320, 480, 710].forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      const start = now + index * 0.065;
      oscillator.type = 'triangle';
      oscillator.frequency.value = frequency * weightPitch;
      gain.gain.setValueAtTime(0.036 + sizeScale * 0.006, start);
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

  playResonanceCharge(stage: number): void {
    if (!this.context || !this.effects) return;
    const step = Math.max(0, Math.min(3, Math.floor(stage)));
    const now = this.context.currentTime;
    const base = [164, 219, 293, 392][step];
    [1, 1.505].forEach((ratio, index) => {
      const oscillator = this.context!.createOscillator();
      const filter = this.context!.createBiquadFilter();
      const gain = this.context!.createGain();
      oscillator.type = index === 0 ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(base * ratio, now);
      oscillator.frequency.exponentialRampToValueAtTime(base * ratio * 1.08, now + 0.16);
      filter.type = 'bandpass';
      filter.frequency.value = base * ratio * 2.1;
      filter.Q.value = 1.8;
      gain.gain.setValueAtTime(index === 0 ? 0.036 : 0.018, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      oscillator.connect(filter).connect(gain).connect(this.effects!);
      oscillator.start(now);
      oscillator.stop(now + 0.19);
    });
    this.noiseBurstTo(0.055, 1280 + step * 360, 0.022, 'bandpass', this.effects);
  }

  playResonanceReady(): void {
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    [438, 444].forEach((frequency) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.031, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
      oscillator.connect(gain).connect(this.effects!);
      oscillator.start(now);
      oscillator.stop(now + 0.31);
    });
  }

  playResonanceAbort(): void {
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(224, now);
    oscillator.frequency.exponentialRampToValueAtTime(92, now + 0.14);
    gain.gain.setValueAtTime(0.025, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    oscillator.connect(gain).connect(this.effects);
    oscillator.start(now);
    oscillator.stop(now + 0.16);
  }

  playResonancePulse(hit: boolean): void {
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const sub = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    const subGain = this.context.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(hit ? 420 : 310, now);
    oscillator.frequency.exponentialRampToValueAtTime(hit ? 58 : 92, now + 0.42);
    sub.type = 'sine';
    sub.frequency.setValueAtTime(hit ? 82 : 116, now);
    sub.frequency.exponentialRampToValueAtTime(41, now + 0.46);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(920, now);
    filter.frequency.exponentialRampToValueAtTime(185, now + 0.4);
    filter.Q.value = 0.82;
    gain.gain.setValueAtTime(hit ? 0.075 : 0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.44);
    subGain.gain.setValueAtTime(hit ? 0.07 : 0.035, now);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);
    oscillator.connect(filter).connect(gain).connect(this.effects);
    sub.connect(subGain).connect(this.effects);
    oscillator.start(now);
    sub.start(now);
    oscillator.stop(now + 0.45);
    sub.stop(now + 0.49);
    this.noiseBurstTo(0.3, hit ? 520 : 760, hit ? 0.1 : 0.055, 'lowpass', this.effects);
    if (hit) this.noiseBurstTo(0.24, 360, 0.095, 'lowpass', this.creatures);
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

  playSharkWindup(playerTarget: boolean, secondBite: boolean): void {
    if (!this.context || !this.creatures) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(secondBite ? 48 : 42, now);
    oscillator.frequency.exponentialRampToValueAtTime(playerTarget ? 104 : 86, now + 0.68);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(playerTarget ? 190 : 250, now);
    filter.frequency.exponentialRampToValueAtTime(playerTarget ? 420 : 520, now + 0.68);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(playerTarget ? 0.06 : 0.048, now + 0.16);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.72);
    oscillator.connect(filter).connect(gain).connect(this.creatures);
    oscillator.start(now);
    oscillator.stop(now + 0.74);
    this.noiseBurstTo(playerTarget ? 0.2 : 0.14, playerTarget ? 280 : 360, 0.18, 'lowpass', this.creatures);
  }

  playSharkCounter(): void {
    this.noiseBurstTo(0.32, 430, 0.16, 'lowpass', this.creatures);
    this.noiseBurstTo(0.12, 2350, 0.065, 'bandpass', this.effects);
    if (!this.context || !this.creatures) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(172, now);
    oscillator.frequency.exponentialRampToValueAtTime(46, now + 0.34);
    gain.gain.setValueAtTime(0.075, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
    oscillator.connect(gain).connect(this.creatures);
    oscillator.start(now);
    oscillator.stop(now + 0.38);
  }

  playSharkMiss(): void {
    this.noiseBurstTo(0.28, 510, 0.22, 'lowpass', this.creatures);
    this.noiseBurstTo(0.12, 1580, 0.09, 'bandpass', this.effects);
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

  playSharkDefeat(): void {
    this.noiseBurstTo(0.42, 260, 0.24, 'lowpass', this.creatures);
    this.noiseBurstTo(0.13, 1180, 0.11, 'bandpass', this.creatures);
    if (!this.context || !this.creatures) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(84, now);
    oscillator.frequency.exponentialRampToValueAtTime(31, now + 0.7);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.74);
    oscillator.connect(gain).connect(this.creatures);
    oscillator.start(now);
    oscillator.stop(now + 0.76);
  }

  playSharkCarcassSurface(): void {
    this.noiseBurstTo(0.34, 210, 0.18, 'lowpass', this.creatures);
    this.noiseBurstTo(0.09, 1450, 0.12, 'bandpass', this.creatures);
  }

  playSharkHarvest(completed: boolean, bundled: boolean): void {
    this.noiseBurstTo(completed ? 0.26 : 0.19, 520, completed ? 0.18 : 0.12, 'lowpass', this.creatures);
    this.noiseBurstTo(0.08, 1760, 0.055, 'bandpass', this.effects);
    if (bundled) this.noiseBurstTo(0.07, 980, 0.08, 'bandpass', this.effects);
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(completed ? 148 : 184, now);
    oscillator.frequency.exponentialRampToValueAtTime(completed ? 92 : 128, now + 0.16);
    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    oscillator.connect(gain).connect(this.effects);
    oscillator.start(now);
    oscillator.stop(now + 0.2);
  }

  playSharkCarcassSink(harvested: boolean): void {
    this.noiseBurstTo(harvested ? 0.24 : 0.3, 190, 0.28, 'lowpass', this.creatures);
    this.noiseBurstTo(0.07, harvested ? 880 : 620, 0.14, 'bandpass', this.creatures);
  }

  playFailure(cause: FailureCause): void {
    if (!this.context || !this.effects) return;
    const target = cause === 'shark' ? this.creatures ?? this.effects : this.effects;
    const underwater = cause === 'drowning';
    this.noiseBurstTo(underwater ? 1.15 : 0.72, underwater ? 210 : 430, underwater ? 0.075 : 0.055, 'lowpass', target);
    if (cause === 'dehydration' || cause === 'starvation') {
      this.noiseBurstTo(0.46, cause === 'dehydration' ? 1120 : 690, 0.028, 'bandpass', this.effects);
    }
    const now = this.context.currentTime;
    [0, 0.2].forEach((offset, index) => {
      const oscillator = this.context!.createOscillator();
      const filter = this.context!.createBiquadFilter();
      const gain = this.context!.createGain();
      oscillator.type = index === 0 ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(index === 0 ? 112 : 226, now + offset);
      oscillator.frequency.exponentialRampToValueAtTime(index === 0 ? 39 : 84, now + 1.08 + offset);
      filter.type = 'lowpass';
      filter.frequency.value = underwater ? 280 : 520;
      gain.gain.setValueAtTime(index === 0 ? 0.07 : 0.025, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.12 + offset);
      oscillator.connect(filter).connect(gain).connect(target);
      oscillator.start(now + offset);
      oscillator.stop(now + 1.15 + offset);
    });
  }

  playRecovery(): void {
    if (!this.context || !this.effects) return;
    const now = this.context.currentTime;
    [196, 294, 440].forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      const start = now + index * 0.11;
      oscillator.type = index === 2 ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.08, start + 0.3);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.034, start + 0.035);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.44);
      oscillator.connect(gain).connect(this.effects!);
      oscillator.start(start);
      oscillator.stop(start + 0.46);
    });
  }

  dispose(): void {
    this.spatialDisconnectTimers.forEach((timer) => window.clearTimeout(timer));
    this.spatialDisconnectTimers.clear();
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
    this.receiverLoop = null;
    this.stormLoop = null;
    Object.keys(this.signalDestinationLoops).forEach((key) => {
      delete this.signalDestinationLoops[key as SignalTargetId];
      delete this.signalDestinationPanners[key as SignalTargetId];
    });
    this.signalDestinationAudio = { targetId: null, proximity: 0, pan: 0, emphasized: false };
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

    const receiverSource = this.context.createBufferSource();
    const receiverFilter = this.context.createBiquadFilter();
    const receiverNotch = this.context.createBiquadFilter();
    this.receiverLoop = this.context.createGain();
    receiverSource.buffer = buffer;
    receiverSource.loop = true;
    receiverFilter.type = 'bandpass';
    receiverFilter.frequency.value = 2460;
    receiverFilter.Q.value = 1.6;
    receiverNotch.type = 'notch';
    receiverNotch.frequency.value = 1120;
    receiverNotch.Q.value = 2.1;
    this.receiverLoop.gain.value = this.receiverActivity * 0.026;
    receiverSource.connect(receiverFilter).connect(receiverNotch).connect(this.receiverLoop).connect(this.effects);
    receiverSource.start(0, 2.2);
  }

  private startSignalDestinationLayers(): void {
    if (!this.context || !this.effects) return;

    const createBus = (targetId: SignalTargetId): GainNode => {
      const input = this.context!.createGain();
      const output = this.context!.createGain();
      output.gain.value = 0;
      if (typeof this.context!.createStereoPanner === 'function') {
        const panner = this.context!.createStereoPanner();
        panner.pan.value = 0;
        input.connect(panner).connect(output);
        this.signalDestinationPanners[targetId] = panner;
      } else {
        input.connect(output);
      }
      output.connect(this.effects!);
      this.signalDestinationLoops[targetId] = output;
      return input;
    };

    const tideBus = createBus('tideRelay');
    const tideTone = this.context.createOscillator();
    const tideHarmonic = this.context.createOscillator();
    const tideFilter = this.context.createBiquadFilter();
    const tideMix = this.context.createGain();
    const tideLfo = this.context.createOscillator();
    const tideLfoDepth = this.context.createGain();
    tideTone.type = 'sine';
    tideTone.frequency.value = 73.14;
    tideHarmonic.type = 'triangle';
    tideHarmonic.frequency.value = 146.28;
    tideFilter.type = 'lowpass';
    tideFilter.frequency.value = 420;
    tideFilter.Q.value = 1.2;
    tideMix.gain.value = 0.56;
    tideLfo.type = 'sine';
    tideLfo.frequency.value = 0.37;
    tideLfoDepth.gain.value = 0.19;
    tideTone.connect(tideFilter);
    tideHarmonic.connect(tideFilter);
    tideFilter.connect(tideMix).connect(tideBus);
    tideLfo.connect(tideLfoDepth).connect(tideMix.gain);
    tideTone.start();
    tideHarmonic.start(this.context.currentTime + 0.31);
    tideLfo.start(this.context.currentTime + 0.7);

    const choirBus = createBus('ironChoir');
    const choirFilter = this.context.createBiquadFilter();
    const choirMix = this.context.createGain();
    const choirLfo = this.context.createOscillator();
    const choirDetune = this.context.createGain();
    choirFilter.type = 'bandpass';
    choirFilter.frequency.value = 760;
    choirFilter.Q.value = 0.72;
    choirMix.gain.value = 0.32;
    choirLfo.type = 'sine';
    choirLfo.frequency.value = 0.16;
    choirDetune.gain.value = 7;
    choirLfo.connect(choirDetune);
    [164.81, 246.94, 329.63, 494.88].forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      const voice = this.context!.createGain();
      oscillator.type = index % 2 === 0 ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      voice.gain.value = 0.2 / (index + 1);
      choirDetune.connect(oscillator.detune);
      oscillator.connect(voice).connect(choirFilter);
      oscillator.start(this.context!.currentTime + index * 0.19);
    });
    choirFilter.connect(choirMix).connect(choirBus);
    choirLfo.start();

    const stormBus = createBus('stormNeedle');
    const stormDuration = 5;
    const sampleRate = this.context.sampleRate;
    const stormBuffer = this.context.createBuffer(1, stormDuration * sampleRate, sampleRate);
    const stormChannel = stormBuffer.getChannelData(0);
    let charge = 0;
    for (let index = 0; index < stormChannel.length; index += 1) {
      const white = this.random() * 2 - 1;
      charge += (white - charge) * 0.18;
      const corona = this.random() > 0.993 ? white * 0.7 : 0;
      stormChannel[index] = charge * 0.24 + white * 0.08 + corona;
    }
    const stormSource = this.context.createBufferSource();
    const stormFilter = this.context.createBiquadFilter();
    const stormTone = this.context.createOscillator();
    const stormToneGain = this.context.createGain();
    const stormMix = this.context.createGain();
    const stormLfo = this.context.createOscillator();
    const stormLfoDepth = this.context.createGain();
    stormSource.buffer = stormBuffer;
    stormSource.loop = true;
    stormFilter.type = 'bandpass';
    stormFilter.frequency.value = 2480;
    stormFilter.Q.value = 2.7;
    stormTone.type = 'sine';
    stormTone.frequency.value = 712.48;
    stormToneGain.gain.value = 0.09;
    stormMix.gain.value = 0.62;
    stormLfo.type = 'sine';
    stormLfo.frequency.value = 0.23;
    stormLfoDepth.gain.value = 0.17;
    stormSource.connect(stormFilter).connect(stormMix);
    stormTone.connect(stormToneGain).connect(stormMix);
    stormMix.connect(stormBus);
    stormLfo.connect(stormLfoDepth).connect(stormMix.gain);
    stormSource.start(0, 1.3);
    stormTone.start();
    stormLfo.start(this.context.currentTime + 0.45);

    this.applySignalDestinationMix();
  }

  private applySignalDestinationMix(): void {
    if (!this.context) return;
    const now = this.context.currentTime;
    const { targetId, proximity, pan, emphasized } = this.signalDestinationAudio;
    (Object.keys(SIGNAL_DESTINATION_GAINS) as SignalTargetId[]).forEach((id) => {
      const activity = id === targetId ? proximity * (emphasized ? 1 : 0.76) : 0;
      this.signalDestinationLoops[id]?.gain.setTargetAtTime(activity * SIGNAL_DESTINATION_GAINS[id], now, 0.24);
      this.signalDestinationPanners[id]?.pan.setTargetAtTime(id === targetId ? pan : 0, now, 0.18);
    });
  }

  private startStormLayer(): void {
    if (!this.context || !this.ambience) return;
    const duration = 6;
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, duration * sampleRate, sampleRate);
    const channel = buffer.getChannelData(0);
    let wash = 0;
    for (let index = 0; index < channel.length; index += 1) {
      const white = this.random() * 2 - 1;
      wash += (white - wash) * 0.075;
      const rain = this.random() > 0.94 ? white * 0.34 : white * 0.08;
      channel[index] = wash * 0.72 + rain;
    }
    const source = this.context.createBufferSource();
    const highpass = this.context.createBiquadFilter();
    const lowpass = this.context.createBiquadFilter();
    const windLowpass = this.context.createBiquadFilter();
    const windGain = this.context.createGain();
    const gustLfo = this.context.createOscillator();
    const gustDepth = this.context.createGain();
    this.stormLoop = this.context.createGain();
    source.buffer = buffer;
    source.loop = true;
    highpass.type = 'highpass';
    highpass.frequency.value = 420;
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 4300;
    windLowpass.type = 'lowpass';
    windLowpass.frequency.value = 285;
    windGain.gain.value = 0.42;
    gustLfo.type = 'sine';
    gustLfo.frequency.value = 0.17;
    gustDepth.gain.value = 0.14;
    this.stormLoop.gain.value = this.stormActivity * 0.13;
    source.connect(windLowpass).connect(windGain).connect(this.stormLoop);
    source.connect(highpass).connect(lowpass).connect(this.stormLoop).connect(this.ambience);
    gustLfo.connect(gustDepth).connect(windGain.gain);
    source.start(0, 1.1);
    gustLfo.start();
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
    this.fireLoop.gain.value = Math.min(1, this.deviceFireActivity + this.progressionForgeActivity) * 0.052;
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
    this.playWoodKnockTo(volume, duration, this.effects);
  }

  private playWoodKnockTo(volume: number, duration: number, target: AudioNode | null): void {
    if (!this.context || !target) return;
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
    oscillator.connect(filter).connect(gain).connect(target);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.01);
    this.noiseBurstTo(duration * 0.65, 740, volume * 0.35, 'bandpass', target);
  }

  private noiseBurstTo(
    duration: number,
    frequency: number,
    volume: number,
    type: BiquadFilterType,
    target: AudioNode | null,
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

  private createSpatialTarget(position: AudioPosition): PannerNode | null {
    if (!this.context || !this.effects) return null;
    const panner = this.context.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1.6;
    panner.maxDistance = 42;
    panner.rolloffFactor = 1.35;
    panner.coneInnerAngle = 360;
    const now = this.context.currentTime;
    if (panner.positionX) {
      panner.positionX.setValueAtTime(position.x, now);
      panner.positionY.setValueAtTime(position.y, now);
      panner.positionZ.setValueAtTime(position.z, now);
    } else {
      const legacyPanner = panner as PannerNode & { setPosition?: (x: number, y: number, z: number) => void };
      legacyPanner.setPosition?.(position.x, position.y, position.z);
    }
    panner.connect(this.effects);
    return panner;
  }

  private releaseSpatialTarget(target: PannerNode, afterMs: number): void {
    const timer = window.setTimeout(() => {
      target.disconnect();
      this.spatialDisconnectTimers.delete(timer);
    }, afterMs);
    this.spatialDisconnectTimers.add(timer);
  }
}
