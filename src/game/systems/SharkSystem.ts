import { Group, MathUtils, PerspectiveCamera, Scene, Vector3 } from 'three';
import type { MaterialLibrary } from '../art/Materials';
import { createSharkModel } from '../art/ProceduralModels';
import { createSeededRandom, randomRange } from '../math/random';
import { sampleWaveHeight } from '../math/waves';
import { useGameStore, type SharkMode } from '../../state/gameStore';
import type { AudioSystem } from './AudioSystem';
import type { GridCoordinate, RaftSystem } from './RaftSystem';
import type { SplashSystem } from './SplashSystem';
import type { PlayerController } from './PlayerController';

export class SharkSystem {
  readonly model: Group;
  private readonly tailPivot: Group;
  private readonly random = createSeededRandom(0x5a4c19);
  private readonly targetWorld = new Vector3();
  private readonly approachWorld = new Vector3();
  private readonly outward = new Vector3();
  private readonly lookTarget = new Vector3();
  private readonly strikeVector = new Vector3();
  private readonly cameraForward = new Vector3();
  private readonly playerWorld = new Vector3();
  private readonly pursuitDirection = new Vector3();
  private mode: SharkMode = 'distant';
  private totalTime = 0;
  private phaseTime = 0;
  private circleAngle = 1.2;
  private nextAttackAt = 34;
  private targetTile: GridCoordinate | null = null;
  private biteIndex = 0;
  private hitsDuringAttack = 0;
  private health = 100;
  private defeated = false;
  private targetingPlayer = false;
  private nextPlayerBiteAt = 0;
  private feedbackTimer = 0;
  private noticeTimer: number | null = null;

  constructor(
    private readonly scene: Scene,
    private readonly raft: RaftSystem,
    private readonly player: PlayerController,
    materials: MaterialLibrary,
    private readonly audio: AudioSystem,
    private readonly splashes: SplashSystem,
    private readonly onImpact: (strength: number) => void,
  ) {
    this.model = createSharkModel(materials);
    this.model.position.set(12, -0.8, 8);
    this.tailPivot = this.model.userData.tailPivot as Group;
    this.scene.add(this.model);
  }

  update(time: number, delta: number): void {
    this.totalTime += delta;
    this.phaseTime += delta;
    this.feedbackTimer -= delta;
    this.tailPivot.rotation.y = Math.sin(time * (this.mode === 'attacking' ? 9.5 : 5.2)) * (this.mode === 'attacking' ? 0.42 : 0.26);
    this.model.rotation.z = Math.sin(time * 1.4) * 0.035;

    const playerInWater = this.player.getSurface() === 'water';
    if (playerInWater && !this.defeated && this.mode !== 'retreating') {
      if (!this.targetingPlayer) this.beginPlayerApproach();
      this.updatePlayerHunt(time, delta);
    } else {
      if (!playerInWater && this.targetingPlayer) this.beginRetreat();
      if (this.mode === 'distant') this.updateDistant(time, delta);
      else if (this.mode === 'circling') this.updateCircling(time, delta);
      else if (this.mode === 'approaching') this.updateApproach(time, delta);
      else if (this.mode === 'attacking') this.updateAttack(time);
      else this.updateRetreat(time, delta);
    }

    if (this.feedbackTimer <= 0) {
      this.feedbackTimer = 0.12;
      this.publishFeedback();
    }
  }

  canStrike(camera: PerspectiveCamera): boolean {
    if ((this.mode !== 'approaching' && this.mode !== 'attacking') || this.defeated || !this.model.visible) return false;
    this.strikeVector.copy(this.model.position).sub(camera.position);
    const distance = this.strikeVector.length();
    if (distance > 5.8 || distance < 0.25) return false;
    this.strikeVector.divideScalar(distance);
    camera.getWorldDirection(this.cameraForward);
    return this.cameraForward.dot(this.strikeVector) > 0.69;
  }

  receiveSpearStrike(camera: PerspectiveCamera, damage = 34): boolean {
    if (!this.canStrike(camera)) return false;
    this.health = Math.max(0, this.health - Math.max(1, damage));
    this.hitsDuringAttack += 1;
    this.audio.playSpearHit();
    this.splashes.spawnImpact(this.model.position, 0xb74f45, 16);
    this.showNotice(this.health <= 0 ? '深潮鲨失去力气' : '刺击命中');
    if (this.health <= 0) {
      this.defeated = true;
      this.beginRetreat();
    } else if (this.hitsDuringAttack >= 2) {
      this.beginRetreat();
    }
    this.publishFeedback();
    return true;
  }

  dispose(): void {
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);
    this.scene.remove(this.model);
  }

  private updateDistant(time: number, delta: number): void {
    this.circleAngle += delta * 0.055;
    this.setCirclePosition(time, 17.5);
    if (this.phaseTime > 6.5) this.setMode('circling');
  }

  private updateCircling(time: number, delta: number): void {
    this.circleAngle += delta * (0.11 + Math.sin(time * 0.17) * 0.015);
    this.setCirclePosition(time, 10.8 + Math.sin(time * 0.21) * 0.8);
    if (this.totalTime >= this.nextAttackAt) this.beginApproach();
  }

  private setCirclePosition(time: number, radius: number): void {
    const x = this.raft.group.position.x + Math.cos(this.circleAngle) * radius;
    const z = this.raft.group.position.z + Math.sin(this.circleAngle) * radius;
    const y = sampleWaveHeight(x, z, time) - 0.76;
    this.model.position.set(x, y, z);
    const tangentX = -Math.sin(this.circleAngle);
    const tangentZ = Math.cos(this.circleAngle);
    this.lookTarget.set(x + tangentX, y, z + tangentZ);
    this.model.lookAt(this.lookTarget);
  }

  private beginApproach(): void {
    const edges = this.raft.getEdgeTiles();
    if (edges.length === 0) return;
    const fromRaftX = this.model.position.x - this.raft.group.position.x;
    const fromRaftZ = this.model.position.z - this.raft.group.position.z;
    let best = edges[0];
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const tile of edges) {
      const score = tile.x * fromRaftX + tile.z * fromRaftZ + this.random() * 0.35;
      if (score > bestScore) {
        best = tile;
        bestScore = score;
      }
    }
    this.targetTile = { x: best.x, z: best.z };
    this.targetingPlayer = false;
    this.raft.gridToLocal(this.targetTile, this.targetWorld);
    this.raft.localPointToWorld(this.targetWorld, this.targetWorld);
    this.outward.set(best.x, 0, best.z);
    if (this.outward.lengthSq() < 0.2) {
      this.outward.set(fromRaftX, 0, fromRaftZ);
    }
    this.outward.normalize();
    this.approachWorld.copy(this.targetWorld).addScaledVector(this.outward, 2.5);
    this.approachWorld.y = this.model.position.y;
    this.biteIndex = 0;
    this.hitsDuringAttack = 0;
    this.audio.playSharkWarning();
    this.setMode('approaching');
    this.showNotice('木筏外沿传来急促水声');
  }

  private updateApproach(time: number, delta: number): void {
    this.raft.gridToLocal(this.targetTile ?? { x: 0, z: 0 }, this.targetWorld);
    this.raft.localPointToWorld(this.targetWorld, this.targetWorld);
    this.approachWorld.copy(this.targetWorld).addScaledVector(this.outward, 2.5);
    const blend = 1 - Math.exp(-delta * 0.9);
    this.model.position.x = MathUtils.lerp(this.model.position.x, this.approachWorld.x, blend);
    this.model.position.z = MathUtils.lerp(this.model.position.z, this.approachWorld.z, blend);
    this.model.position.y = sampleWaveHeight(this.model.position.x, this.model.position.z, time) - 0.68;
    this.lookTarget.copy(this.targetWorld);
    this.lookTarget.y = this.model.position.y;
    this.model.lookAt(this.lookTarget);
    if (this.model.position.distanceTo(this.approachWorld) < 0.42 || this.phaseTime > 5.2) {
      this.setMode('attacking');
    }
    this.updateSpearInteraction('鲨鱼进入刺击距离');
  }

  private updateAttack(time: number): void {
    if (!this.targetTile || !this.raft.hasTile(this.targetTile)) {
      this.beginRetreat();
      return;
    }
    this.raft.gridToLocal(this.targetTile, this.targetWorld);
    this.raft.localPointToWorld(this.targetWorld, this.targetWorld);
    const biteCycle = this.phaseTime % 1.55;
    const lunge = Math.pow(Math.sin(Math.min(1, biteCycle / 0.8) * Math.PI), 1.6) * 0.78;
    this.model.position.copy(this.approachWorld).lerp(this.targetWorld, lunge);
    this.model.position.y = sampleWaveHeight(this.model.position.x, this.model.position.z, time) - 0.58 + lunge * 0.12;
    this.lookTarget.copy(this.targetWorld);
    this.lookTarget.y = this.model.position.y;
    this.model.lookAt(this.lookTarget);

    const biteThresholds = [0.68, 2.23];
    if (this.biteIndex < biteThresholds.length && this.phaseTime >= biteThresholds[this.biteIndex]) {
      this.performBite();
      this.biteIndex += 1;
    }
    if (this.phaseTime > 3.35) this.beginRetreat();
    this.updateSpearInteraction('鲨鱼正在撕咬筏格');
  }

  private performBite(): void {
    if (!this.targetTile) return;
    const result = this.raft.damageTile(this.targetTile, 34);
    if (!result.changed) return;
    this.audio.playSharkBite();
    this.splashes.spawn(this.targetWorld);
    this.splashes.spawnImpact(this.targetWorld, 0x8d5742, 24);
    this.onImpact(0.2);
    useGameStore.getState().setRaft(this.raft.getIntegrityStats());
    this.showNotice(result.destroyed ? '外围筏格被撕碎' : '木筏结构受损');
    if (result.destroyed) this.beginRetreat();
  }

  private beginPlayerApproach(): void {
    this.targetingPlayer = true;
    this.targetTile = null;
    this.hitsDuringAttack = 0;
    this.nextPlayerBiteAt = 0;
    this.audio.playSharkWarning();
    this.setMode('approaching');
    this.showNotice('水下传来快速逼近的摆尾声');
  }

  private updatePlayerHunt(time: number, delta: number): void {
    this.player.getWorldFootPosition(this.playerWorld);
    this.playerWorld.y -= 0.12;
    this.pursuitDirection.copy(this.playerWorld).sub(this.model.position);
    const distance = this.pursuitDirection.length();
    if (distance > 0.001) this.pursuitDirection.divideScalar(distance);

    if (this.mode === 'approaching') {
      const speed = MathUtils.clamp(2.45 + distance * 0.11, 2.7, 4.15);
      this.model.position.addScaledVector(this.pursuitDirection, Math.min(distance, speed * delta));
      this.model.position.y += Math.sin(time * 3.1) * delta * 0.05;
      this.model.lookAt(this.playerWorld);
      if (distance < 2.65) {
        this.nextPlayerBiteAt = 0.48;
        this.setMode('attacking');
      }
      this.updateSpearInteraction('鲨鱼正从水下逼近');
      return;
    }

    if (this.mode !== 'attacking') {
      this.setMode('approaching');
      return;
    }
    const lunge = 0.75 + Math.pow(Math.max(0, Math.sin(this.phaseTime * 2.8)), 2) * 1.7;
    const speed = 3.05 + lunge;
    this.model.position.addScaledVector(this.pursuitDirection, Math.min(distance, speed * delta));
    this.model.position.y += Math.sin(time * 4.2) * delta * 0.08;
    this.model.lookAt(this.playerWorld);
    if (this.phaseTime >= this.nextPlayerBiteAt) {
      if (distance <= 1.42) {
        this.performPlayerBite();
        this.nextPlayerBiteAt += 2.18;
      } else {
        this.nextPlayerBiteAt += 0.18;
      }
    }
    if (distance > 5.4) this.setMode('approaching');
    else if (this.phaseTime > 5.15) this.beginRetreat();
    this.updateSpearInteraction('鲨鱼进入扑咬距离');
  }

  private performPlayerBite(): void {
    const store = useGameStore.getState();
    store.damagePlayer(18, 'shark');
    this.audio.playPlayerBite();
    this.splashes.spawnImpact(this.playerWorld, 0xb74f45, 28);
    this.player.applyWaterImpulse(this.model.position, 2.65);
    this.onImpact(0.58);
    this.showNotice(useGameStore.getState().survival.health <= 18 ? '伤势已经十分危险' : '深潮鲨撕开了防线');
  }

  private beginRetreat(): void {
    this.setMode('retreating');
    this.targetTile = null;
    this.targetingPlayer = false;
    useGameStore.getState().setInteraction(null, 'shark');
  }

  private updateRetreat(time: number, delta: number): void {
    this.outward.copy(this.model.position).sub(this.raft.group.position);
    this.outward.y = 0;
    if (this.outward.lengthSq() < 0.1) this.outward.set(1, 0, 0);
    this.outward.normalize();
    this.model.position.addScaledVector(this.outward, delta * (this.defeated ? 2.7 : 2.15));
    const surface = sampleWaveHeight(this.model.position.x, this.model.position.z, time);
    this.model.position.y = surface - 0.75 - (this.defeated ? Math.min(3.8, this.phaseTime * 0.7) : 0);
    this.lookTarget.copy(this.model.position).add(this.outward);
    this.model.lookAt(this.lookTarget);
    if (this.defeated && this.phaseTime > 5) this.model.visible = false;
    if (this.defeated && this.phaseTime > 95) {
      this.defeated = false;
      this.health = 100;
      this.model.visible = true;
      this.circleAngle += Math.PI * 0.72;
      this.nextAttackAt = this.totalTime + randomRange(this.random, 52, 75);
      this.setMode('distant');
    } else if (!this.defeated && this.phaseTime > 6.2) {
      this.nextAttackAt = this.totalTime + randomRange(this.random, 48, 70);
      this.setMode('circling');
    }
  }

  private setMode(mode: SharkMode): void {
    this.mode = mode;
    this.phaseTime = 0;
    this.publishFeedback();
  }

  private publishFeedback(): void {
    const threat =
      this.mode === 'attacking'
        ? 1
        : this.mode === 'approaching'
          ? MathUtils.clamp(0.46 + this.phaseTime * 0.1, 0, 0.92)
          : this.mode === 'circling'
            ? 0.2
            : 0;
    useGameStore.getState().setShark({
      mode: this.mode,
      threat,
      health: this.health,
      visible: this.model.visible && this.mode !== 'distant',
      target: this.targetingPlayer ? 'player' : 'raft',
    });
  }

  private showNotice(message: string): void {
    useGameStore.getState().showNotice(message);
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => {
      if (useGameStore.getState().notice === message) useGameStore.getState().showNotice(null);
    }, 1700);
  }

  private updateSpearInteraction(message: string): void {
    const store = useGameStore.getState();
    if (store.selectedTool === 'spear' || store.selectedTool === 'metalSpear') store.setInteraction(message, 'shark');
    else if (store.interaction?.startsWith('鲨鱼')) store.setInteraction(null, 'shark');
  }
}
