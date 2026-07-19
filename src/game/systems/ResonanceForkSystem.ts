import {
  AdditiveBlending,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  TorusGeometry,
  type WebGLRenderer,
} from 'three';
import type { MaterialLibrary } from '../art/Materials';
import { createResonanceForkModel, type ResonanceForkVisuals } from '../art/ProceduralModels';
import {
  RESONANCE_COOLDOWN_SECONDS,
  resonanceChargeProgress,
  resolveResonanceDischarge,
  type ResonanceDischargeResult,
} from '../domain/resonanceFork';
import type { AudioSystem } from './AudioSystem';

const PULSE_VISUAL_SECONDS = 0.42;

export type ResonanceForkPhase = 'idle' | 'charging' | 'ready' | 'cooldown';
export type ResonancePulseSettlement = Exclude<ResonanceDischargeResult, 'cancelled'>;

export interface ResonanceForkFeedback {
  phase: ResonanceForkPhase;
  charge: number;
  locked: boolean;
  pulseEvents: number;
}

export interface ResonanceForkDiagnostics extends ResonanceForkFeedback {
  equipped: boolean;
  inputEnabled: boolean;
  held: boolean;
  missEvents: number;
  cancelledEvents: number;
  pulseVisual: number;
}

export class ResonanceForkSystem {
  private readonly viewModel: Group;
  private readonly visuals: ResonanceForkVisuals;
  private readonly pulseHalos: Mesh<TorusGeometry, MeshBasicMaterial>[] = [];
  private equipped = false;
  private inputEnabled = false;
  private held = false;
  private phase: ResonanceForkPhase = 'idle';
  private chargeElapsed = 0;
  private charge = 0;
  private chargeStage = -1;
  private cooldownRemaining = 0;
  private pulseVisualRemaining = 0;
  private pulseEvents = 0;
  private missEvents = 0;
  private cancelledEvents = 0;
  private lastFeedbackKey = '';

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly camera: PerspectiveCamera,
    materials: MaterialLibrary,
    private readonly audio: AudioSystem,
    private readonly hasCell: () => boolean,
    private readonly canTarget: () => boolean,
    private readonly settlePulse: () => ResonancePulseSettlement,
    private readonly onFeedback: (feedback: ResonanceForkFeedback) => void = () => undefined,
    private readonly onNotice: (message: string) => void = () => undefined,
  ) {
    this.viewModel = createResonanceForkModel(materials);
    this.viewModel.name = 'first-person-tide-resonance-fork';
    this.viewModel.scale.setScalar(0.72);
    this.viewModel.visible = false;
    this.visuals = this.viewModel.userData.resonanceVisuals as ResonanceForkVisuals;
    this.camera.add(this.viewModel);

    for (let index = 0; index < 3; index += 1) {
      const material = new MeshBasicMaterial({
        color: index === 2 ? 0xf0d36d : 0x62dfca,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
        blending: AdditiveBlending,
      });
      const halo = new Mesh(new TorusGeometry(0.17 + index * 0.04, 0.012, 7, 42), material);
      halo.name = `first-person-resonance-pulse-${index + 1}`;
      halo.position.set(0, 0, -1.15 - index * 0.12);
      halo.visible = false;
      halo.renderOrder = 12;
      this.camera.add(halo);
      this.pulseHalos.push(halo);
    }

    this.renderer.domElement.addEventListener('mousedown', this.onPointerDown);
    this.renderer.domElement.addEventListener('mouseup', this.onPointerUp);
    window.addEventListener('mouseup', this.onPointerUp);
    this.publishFeedback(true);
  }

  setEquipped(equipped: boolean): void {
    if (this.equipped === equipped) return;
    this.equipped = equipped;
    this.viewModel.visible = equipped;
    if (!equipped) this.cancelCharge(false);
    this.publishFeedback(true);
  }

  setInputEnabled(enabled: boolean): void {
    if (this.inputEnabled === enabled) return;
    this.inputEnabled = enabled;
    if (!enabled) this.cancelCharge(false);
    this.publishFeedback(true);
  }

  update(time: number, delta: number): void {
    const step = Math.max(0, Math.min(0.1, Number.isFinite(delta) ? delta : 0));
    if (this.cooldownRemaining > 0) {
      this.cooldownRemaining = Math.max(0, this.cooldownRemaining - step);
      if (this.cooldownRemaining === 0 && !this.held) this.phase = 'idle';
    }

    if (this.held && (this.phase === 'charging' || this.phase === 'ready')) {
      this.chargeElapsed += step;
      this.charge = resonanceChargeProgress(this.chargeElapsed);
      const stage = Math.min(3, Math.floor(this.charge * 4));
      if (stage > this.chargeStage && this.charge < 1) {
        this.chargeStage = stage;
        this.audio.playResonanceCharge(stage);
      }
      if (this.charge >= 1 && this.phase !== 'ready') {
        this.phase = 'ready';
        this.audio.playResonanceReady();
      }
    }

    this.pulseVisualRemaining = Math.max(0, this.pulseVisualRemaining - step);
    this.updatePresentation(time);
    this.publishFeedback();
  }

  getDiagnostics(): ResonanceForkDiagnostics {
    return {
      phase: this.phase,
      charge: this.charge,
      locked: this.currentLock(),
      pulseEvents: this.pulseEvents,
      equipped: this.equipped,
      inputEnabled: this.inputEnabled,
      held: this.held,
      missEvents: this.missEvents,
      cancelledEvents: this.cancelledEvents,
      pulseVisual: this.pulseVisualRemaining / PULSE_VISUAL_SECONDS,
    };
  }

  dispose(): void {
    this.renderer.domElement.removeEventListener('mousedown', this.onPointerDown);
    this.renderer.domElement.removeEventListener('mouseup', this.onPointerUp);
    window.removeEventListener('mouseup', this.onPointerUp);
    this.camera.remove(this.viewModel);
    for (const halo of this.pulseHalos) {
      this.camera.remove(halo);
      halo.geometry.dispose();
      halo.material.dispose();
    }
  }

  private currentLock(): boolean {
    return this.equipped && this.inputEnabled && this.hasCell() && this.canTarget();
  }

  private updatePresentation(time: number): void {
    const activeCharge = this.equipped ? this.charge : 0;
    const lock = this.currentLock();
    const pulseRatio = this.pulseVisualRemaining / PULSE_VISUAL_SECONDS;
    const recoil = pulseRatio > 0 ? Math.sin((1 - pulseRatio) * Math.PI) * 0.24 : 0;
    const breath = Math.sin(time * 1.45) * 0.008;
    this.viewModel.position.set(0.57 + breath, -0.78 - recoil * 0.1, -0.64 + recoil);
    this.viewModel.rotation.set(-0.92 - activeCharge * 0.08, -0.15, -0.24 + activeCharge * 0.05);
    this.visuals.triggerPivot.rotation.x = -activeCharge * 0.4;
    this.visuals.core.material.emissiveIntensity = 0.22 + activeCharge * (lock ? 3.1 : 2.05) + pulseRatio * 1.8;
    this.visuals.light.intensity = activeCharge * (lock ? 0.7 : 0.42) + pulseRatio * 1.1;
    this.visuals.light.color.setHex(lock ? 0x6cf4da : 0x83d6cf);

    this.visuals.tinePivots.forEach((tine, index) => {
      const direction = index === 0 ? -1 : 1;
      tine.rotation.z = direction * Math.sin(time * (18 + activeCharge * 26)) * activeCharge * 0.012;
    });
    this.visuals.chargeRings.forEach((ring, index) => {
      const threshold = (index + 1) / this.visuals.chargeRings.length;
      const energized = Math.max(0, Math.min(1, (activeCharge - threshold + 0.34) * 3));
      const shimmer = 0.82 + Math.sin(time * 7.5 + index * 1.7) * 0.18;
      ring.material.opacity = energized * shimmer * (lock ? 0.72 : 0.46);
      ring.scale.setScalar(1 + energized * 0.08 + Math.sin(time * 9 + index) * energized * 0.025);
    });

    const pulseProgress = 1 - pulseRatio;
    this.pulseHalos.forEach((halo, index) => {
      const localProgress = Math.max(0, Math.min(1, pulseProgress * 1.4 - index * 0.12));
      const visible = this.pulseVisualRemaining > 0 && localProgress > 0;
      halo.visible = visible;
      halo.position.z = -1.05 - localProgress * (2.4 + index * 0.42);
      const scale = 0.75 + localProgress * (2.8 + index * 0.24);
      halo.scale.setScalar(scale);
      halo.material.opacity = visible ? MathUtils.smoothstep(1 - localProgress, 0, 1) * 0.34 : 0;
    });
  }

  private cancelCharge(playSound: boolean): void {
    const hadCharge = this.held && this.charge > 0.04;
    this.held = false;
    this.chargeElapsed = 0;
    this.charge = 0;
    this.chargeStage = -1;
    if (this.cooldownRemaining <= 0) this.phase = 'idle';
    if (playSound && hadCharge) this.audio.playResonanceAbort();
  }

  private settle(result: ResonancePulseSettlement): void {
    if (result === 'hit') {
      this.pulseEvents += 1;
      this.pulseVisualRemaining = PULSE_VISUAL_SECONDS;
      this.audio.playResonancePulse(true);
    } else if (result === 'no-cell') {
      this.audio.playDenied();
      this.onNotice('震叉电池舱为空');
    } else {
      this.missEvents += 1;
      this.audio.playResonanceAbort();
      this.onNotice('未建立潮鸣锁定');
    }
    this.held = false;
    this.chargeElapsed = 0;
    this.charge = 0;
    this.chargeStage = -1;
    this.phase = 'cooldown';
    this.cooldownRemaining = result === 'hit' ? RESONANCE_COOLDOWN_SECONDS : 0.24;
    this.publishFeedback(true);
  }

  private publishFeedback(force = false): void {
    const feedback: ResonanceForkFeedback = {
      phase: this.phase,
      charge: Number(this.charge.toFixed(3)),
      locked: this.currentLock(),
      pulseEvents: this.pulseEvents,
    };
    const key = JSON.stringify(feedback);
    if (!force && key === this.lastFeedbackKey) return;
    this.lastFeedbackKey = key;
    this.onFeedback(feedback);
  }

  private readonly onPointerDown = (event: MouseEvent): void => {
    if (
      event.button !== 0
      || !this.equipped
      || !this.inputEnabled
      || this.held
      || this.cooldownRemaining > 0
    ) return;
    if (!this.hasCell()) {
      this.audio.playDenied();
      this.onNotice('震叉电池舱为空');
      return;
    }
    this.held = true;
    this.phase = 'charging';
    this.chargeElapsed = 0;
    this.charge = 0;
    this.chargeStage = 0;
    this.audio.playResonanceCharge(0);
    this.publishFeedback(true);
  };

  private readonly onPointerUp = (event: MouseEvent): void => {
    if (event.button !== 0 || !this.held) return;
    const intended = resolveResonanceDischarge(this.charge, this.hasCell(), this.canTarget());
    if (intended === 'cancelled') {
      this.cancelledEvents += 1;
      this.cancelCharge(true);
      this.cooldownRemaining = 0.14;
      this.phase = 'cooldown';
      this.publishFeedback(true);
      return;
    }
    if (intended !== 'hit') {
      this.settle(intended);
      return;
    }
    this.settle(this.settlePulse());
  };
}
