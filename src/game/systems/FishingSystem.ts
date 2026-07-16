import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Line,
  LineBasicMaterial,
  MathUtils,
  PerspectiveCamera,
  Scene,
  Vector3,
  type WebGLRenderer,
} from 'three';
import type { MaterialLibrary } from '../art/Materials';
import { createFishingBobber, createFishingRodModel, createSilverSpineFishModel } from '../art/ProceduralModels';
import { advanceFishFight } from '../domain/fishing';
import { createSeededRandom, randomRange } from '../math/random';
import { sampleWaveHeight } from '../math/waves';
import { useGameStore, type FishingPhase } from '../../state/gameStore';
import type { AudioSystem } from './AudioSystem';
import type { SplashSystem } from './SplashSystem';

const LINE_SEGMENTS = 9;

export class FishingSystem {
  private readonly viewModel: Group;
  private readonly bobber: Group;
  private readonly fish: Group;
  private readonly linePositions = new Float32Array(LINE_SEGMENTS * 3);
  private readonly lineGeometry = new BufferGeometry();
  private readonly line: Line<BufferGeometry, LineBasicMaterial>;
  private readonly hand = new Vector3();
  private readonly target = new Vector3();
  private readonly castOrigin = new Vector3();
  private readonly forward = new Vector3();
  private readonly random = createSeededRandom(0xf157c4);
  private phase: FishingPhase = 'idle';
  private phaseTime = 0;
  private biteAt = 0;
  private tension = 0;
  private progress = 0;
  private feedbackElapsed = 0;
  private reeling = false;
  private equipped = false;
  private inputEnabled = false;
  private noticeTimer: number | null = null;

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly camera: PerspectiveCamera,
    scene: Scene,
    materials: MaterialLibrary,
    private readonly audio: AudioSystem,
    private readonly splashes: SplashSystem,
  ) {
    this.viewModel = createFishingRodModel(materials);
    this.viewModel.name = 'first-person-fishing-rod';
    this.viewModel.scale.setScalar(0.68);
    this.viewModel.position.set(0.55, -0.66, -0.72);
    this.viewModel.rotation.set(-0.28, -0.26, -0.18);
    this.viewModel.visible = false;
    this.camera.add(this.viewModel);

    this.bobber = createFishingBobber(materials);
    this.bobber.visible = false;
    scene.add(this.bobber);
    this.fish = createSilverSpineFishModel(materials);
    this.fish.visible = false;
    scene.add(this.fish);

    this.lineGeometry.setAttribute('position', new BufferAttribute(this.linePositions, 3));
    this.line = new Line(
      this.lineGeometry,
      new LineBasicMaterial({ color: 0xcfd9cd, transparent: true, opacity: 0.76 }),
    );
    this.line.frustumCulled = false;
    this.line.visible = false;
    scene.add(this.line);

    this.renderer.domElement.addEventListener('mousedown', this.onPointerDown);
    document.addEventListener('mouseup', this.onPointerUp);
  }

  setEquipped(equipped: boolean): void {
    this.equipped = equipped;
    this.viewModel.visible = equipped;
    if (!equipped && this.phase !== 'idle') this.reset('lost');
  }

  setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
    if (!enabled) this.reeling = false;
  }

  update(time: number, delta: number): void {
    if (!this.equipped) return;
    this.phaseTime += delta;
    const activePulse = this.phase === 'hooked' ? Math.sin(time * 9.4) * this.tension * 0.025 : 0;
    this.viewModel.position.set(0.55 + activePulse, -0.66, -0.72 + activePulse * 1.5);
    this.viewModel.rotation.set(-0.28 - activePulse * 2.5, -0.26, -0.18 + activePulse);

    if (this.phase === 'casting') this.updateCast(time);
    else if (this.phase === 'waiting') this.updateWaiting(time);
    else if (this.phase === 'nibble') this.updateNibble(time);
    else if (this.phase === 'hooked') this.updateFight(time, delta);
    else if (this.phase === 'caught') this.updateCatch();
    else if (this.phase === 'lost' && this.phaseTime > 0.85) this.finishReset();

    if (this.line.visible) this.updateLine();
  }

  dispose(scene: Scene): void {
    this.renderer.domElement.removeEventListener('mousedown', this.onPointerDown);
    document.removeEventListener('mouseup', this.onPointerUp);
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);
    this.camera.remove(this.viewModel);
    scene.remove(this.bobber, this.fish, this.line);
    this.lineGeometry.dispose();
    this.line.material.dispose();
  }

  private cast(): void {
    this.phase = 'casting';
    this.phaseTime = 0;
    this.tension = 0;
    this.progress = 0;
    this.getHandWorldPosition(this.castOrigin);
    this.bobber.position.copy(this.castOrigin);
    this.camera.getWorldDirection(this.forward);
    this.forward.y = 0;
    if (this.forward.lengthSq() < 0.01) this.forward.set(0, 0, -1);
    this.forward.normalize();
    const distance = 8.5 + randomRange(this.random, 0.2, 2.2);
    this.target.copy(this.camera.position).addScaledVector(this.forward, distance);
    this.target.y = sampleWaveHeight(this.target.x, this.target.z, 0) + 0.08;
    this.bobber.visible = true;
    this.line.visible = true;
    this.fish.visible = false;
    this.audio.playFishingCast();
    useGameStore.getState().setFishing({ phase: 'casting', tension: 0, progress: 0 });
    useGameStore.getState().setInteraction('浮标飞行中', 'fishing');
  }

  private updateCast(time: number): void {
    const t = MathUtils.clamp(this.phaseTime / 0.72, 0, 1);
    this.bobber.position.lerpVectors(this.castOrigin, this.target, t);
    this.bobber.position.y += Math.sin(t * Math.PI) * 2.4;
    this.bobber.rotation.z += 0.16;
    if (t < 1) return;
    this.phase = 'waiting';
    this.phaseTime = 0;
    this.biteAt = randomRange(this.random, 3.8, 7.6);
    this.bobber.position.y = sampleWaveHeight(this.bobber.position.x, this.bobber.position.z, time) + 0.06;
    this.splashes.spawn(this.bobber.position);
    this.audio.playSplash();
    useGameStore.getState().setFishing({ phase: 'waiting' });
    useGameStore.getState().setInteraction('水面平静', 'fishing');
  }

  private updateWaiting(time: number): void {
    this.bobber.position.y = sampleWaveHeight(this.bobber.position.x, this.bobber.position.z, time) + 0.07;
    this.bobber.rotation.x = Math.sin(time * 1.7) * 0.08;
    this.bobber.rotation.z = Math.sin(time * 1.3) * 0.1;
    if (this.phaseTime < this.biteAt) return;
    this.phase = 'nibble';
    this.phaseTime = 0;
    this.audio.playNibble();
    this.splashes.spawn(this.bobber.position);
    useGameStore.getState().setFishing({ phase: 'nibble' });
    useGameStore.getState().setInteraction('鱼讯', 'fishing');
  }

  private updateNibble(time: number): void {
    const dip = Math.sin(this.phaseTime * 18) * 0.08 - Math.min(0.18, this.phaseTime * 0.12);
    this.bobber.position.y = sampleWaveHeight(this.bobber.position.x, this.bobber.position.z, time) + dip;
    if (this.phaseTime > 1.35) this.reset('lost', '鱼脱钩了');
  }

  private hookFish(): void {
    this.phase = 'hooked';
    this.phaseTime = 0;
    this.tension = 0.28;
    this.progress = 0.04;
    this.reeling = true;
    this.fish.visible = true;
    useGameStore.getState().setFishing({ phase: 'hooked', tension: this.tension, progress: this.progress });
    useGameStore.getState().setInteraction('鱼线受力', 'fishing');
  }

  private updateFight(time: number, delta: number): void {
    const pull = 0.48 + Math.sin(time * 2.7 + Math.sin(time * 0.63) * 2.1) * 0.22;
    const fight = advanceFishFight(
      { tension: this.tension, progress: this.progress },
      this.reeling && this.inputEnabled,
      pull,
      delta,
    );
    this.tension = fight.tension;
    this.progress = fight.progress;
    if (this.reeling && this.inputEnabled) {
      this.audio.playReel(this.tension);
    }
    const orbit = time * 2.4;
    this.fish.position.set(
      this.bobber.position.x + Math.cos(orbit) * (0.55 + pull * 0.25),
      this.bobber.position.y - 0.42 - pull * 0.14,
      this.bobber.position.z + Math.sin(orbit) * (0.55 + pull * 0.25),
    );
    this.fish.lookAt(this.bobber.position.x - Math.sin(orbit), this.fish.position.y, this.bobber.position.z + Math.cos(orbit));
    this.fish.rotation.z = Math.sin(time * 8.5) * 0.16;
    this.bobber.position.y = sampleWaveHeight(this.bobber.position.x, this.bobber.position.z, time) - this.tension * 0.08;
    this.feedbackElapsed -= delta;
    if (this.feedbackElapsed <= 0) {
      this.feedbackElapsed = 0.05;
      useGameStore.getState().setFishing({ tension: this.tension, progress: this.progress });
    }
    if (fight.outcome === 'broken') {
      this.audio.playLineBreak();
      this.reset('lost', '鱼线绷断');
    } else if (fight.outcome === 'caught') {
      this.catchFish();
    }
  }

  private catchFish(): void {
    this.phase = 'caught';
    this.phaseTime = 0;
    this.reeling = false;
    this.audio.playCatch();
    const accepted = useGameStore.getState().addItemBundle({ rawFish: 1 });
    this.showNotice(accepted.rawFish ? '+1 银脊鱼' : '背包已满，鱼滑回海里');
    useGameStore.getState().setFishing({ phase: 'caught', tension: 0, progress: 1 });
    useGameStore.getState().setInteraction(null, 'fishing');
  }

  private updateCatch(): void {
    this.getHandWorldPosition(this.hand);
    const t = MathUtils.clamp(this.phaseTime / 0.68, 0, 1);
    this.bobber.position.lerp(this.hand, 0.12 + t * 0.18);
    this.fish.position.lerp(this.hand, 0.1 + t * 0.15);
    this.fish.rotation.x += 0.15;
    if (t >= 1) this.finishReset();
  }

  private reset(phase: 'lost', notice?: string): void {
    this.phase = phase;
    this.phaseTime = 0;
    this.reeling = false;
    this.fish.visible = false;
    this.bobber.visible = false;
    this.line.visible = false;
    useGameStore.getState().setFishing({ phase, tension: 0, progress: 0 });
    useGameStore.getState().setInteraction(null, 'fishing');
    if (notice) this.showNotice(notice);
  }

  private finishReset(): void {
    this.phase = 'idle';
    this.phaseTime = 0;
    this.tension = 0;
    this.progress = 0;
    this.reeling = false;
    this.bobber.visible = false;
    this.fish.visible = false;
    this.line.visible = false;
    useGameStore.getState().setFishing({ phase: 'idle', tension: 0, progress: 0 });
    useGameStore.getState().setInteraction(null, 'fishing');
  }

  private updateLine(): void {
    this.getHandWorldPosition(this.hand);
    for (let index = 0; index < LINE_SEGMENTS; index += 1) {
      const t = index / (LINE_SEGMENTS - 1);
      const sag = Math.sin(t * Math.PI) * (this.phase === 'hooked' ? (1 - this.tension) * 0.42 : 0.62);
      this.linePositions[index * 3] = MathUtils.lerp(this.hand.x, this.bobber.position.x, t);
      this.linePositions[index * 3 + 1] = MathUtils.lerp(this.hand.y, this.bobber.position.y, t) - sag;
      this.linePositions[index * 3 + 2] = MathUtils.lerp(this.hand.z, this.bobber.position.z, t);
    }
    const attribute = this.lineGeometry.getAttribute('position') as BufferAttribute;
    attribute.needsUpdate = true;
    this.lineGeometry.computeBoundingSphere();
  }

  private getHandWorldPosition(target: Vector3): Vector3 {
    target.set(0.48, -0.34, -0.66);
    return this.camera.localToWorld(target);
  }

  private showNotice(message: string): void {
    useGameStore.getState().showNotice(message);
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => {
      if (useGameStore.getState().notice === message) useGameStore.getState().showNotice(null);
    }, 1500);
  }

  private readonly onPointerDown = (event: MouseEvent): void => {
    if (event.button !== 0 || !this.equipped || !this.inputEnabled) return;
    if (this.phase === 'idle') this.cast();
    else if (this.phase === 'nibble') this.hookFish();
    else if (this.phase === 'hooked') this.reeling = true;
  };

  private readonly onPointerUp = (event: MouseEvent): void => {
    if (event.button === 0) this.reeling = false;
  };
}
