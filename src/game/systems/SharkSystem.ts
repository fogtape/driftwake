import { Group, MathUtils, PerspectiveCamera, Scene, Vector3 } from 'three';
import type { MaterialLibrary } from '../art/Materials';
import { createSharkModel } from '../art/ProceduralModels';
import { createSeededRandom, randomRange } from '../math/random';
import { sampleWaveHeight } from '../math/waves';
import { useGameStore, type SharkMode } from '../../state/gameStore';
import { COLLECTION_NET_MAX_HEALTH, collectionNetOutsideCoordinate } from '../domain/collectionNets';
import {
  RAFT_STRUCTURE_DEFINITIONS,
  raftStructureDamageStage,
  raftStructureHealthRatio,
  type SavedRaftStructure,
} from '../domain/raftStructures';
import type { AudioSystem } from './AudioSystem';
import type { CollectionNetSystem } from './CollectionNetSystem';
import type { GridCoordinate, RaftSystem } from './RaftSystem';
import type { RaftStructureSystem } from './RaftStructureSystem';
import type { SplashSystem } from './SplashSystem';
import type { PlayerController } from './PlayerController';

export interface SharkRaftMutation {
  kind: 'foundation' | 'structure' | 'collectionNet';
  targetId: string;
  health: number;
  destroyed: boolean;
  removed: SavedRaftStructure[];
}

export interface SharkDiagnostics {
  targetKind: 'none' | 'foundation' | 'structure' | 'collectionNet' | 'player';
  targetId: string | null;
  lastRaftTargetKind: 'none' | 'foundation' | 'structure' | 'collectionNet';
  lastRaftTargetId: string | null;
  lastRaftTargetHealth: number;
  structureDamageEvents: number;
  foundationDamageEvents: number;
  collectionNetDamageEvents: number;
}

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
  private readonly cascadeWorld = new Vector3();
  private mode: SharkMode = 'distant';
  private totalTime = 0;
  private phaseTime = 0;
  private circleAngle = 1.2;
  private nextAttackAt = 34;
  private targetTile: GridCoordinate | null = null;
  private targetStructureId: string | null = null;
  private targetCollectionNetId: string | null = null;
  private biteIndex = 0;
  private hitsDuringAttack = 0;
  private health = 100;
  private defeated = false;
  private targetingPlayer = false;
  private nextPlayerBiteAt = 0;
  private feedbackTimer = 0;
  private noticeTimer: number | null = null;
  private lastRaftTargetKind: SharkDiagnostics['lastRaftTargetKind'] = 'none';
  private lastRaftTargetId: string | null = null;
  private lastRaftTargetHealth = 0;
  private structureDamageEvents = 0;
  private foundationDamageEvents = 0;
  private collectionNetDamageEvents = 0;

  constructor(
    private readonly scene: Scene,
    private readonly raft: RaftSystem,
    private readonly structures: RaftStructureSystem,
    private readonly player: PlayerController,
    materials: MaterialLibrary,
    private readonly audio: AudioSystem,
    private readonly splashes: SplashSystem,
    private readonly onImpact: (strength: number) => void,
    private readonly onRaftMutation: (mutation: SharkRaftMutation) => void = () => undefined,
    private readonly collectionNets: CollectionNetSystem | null = null,
  ) {
    this.model = createSharkModel(materials);
    this.model.position.set(12, -0.8, 8);
    const exposedWeakPoint = this.structures.findSharkTarget(
      this.raft.getEdgeTiles(),
      this.model.position.x - this.raft.group.position.x,
      this.model.position.z - this.raft.group.position.z,
    );
    const exposedWeakNet = this.collectionNets?.findSharkTarget(
      this.model.position.x - this.raft.group.position.x,
      this.model.position.z - this.raft.group.position.z,
    ) ?? null;
    if (
      (exposedWeakPoint && raftStructureDamageStage(exposedWeakPoint) !== 'intact')
      || (exposedWeakNet && exposedWeakNet.health < COLLECTION_NET_MAX_HEALTH * 0.72)
    ) this.nextAttackAt = 6.5;
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

  getDiagnostics(): SharkDiagnostics {
    return {
      targetKind: this.targetingPlayer
        ? 'player'
        : this.targetCollectionNetId
          ? 'collectionNet'
          : this.targetStructureId
            ? 'structure'
            : this.targetTile ? 'foundation' : 'none',
      targetId: this.targetCollectionNetId
        ?? this.targetStructureId
        ?? (this.targetTile ? `${this.targetTile.x},${this.targetTile.z}` : null),
      lastRaftTargetKind: this.lastRaftTargetKind,
      lastRaftTargetId: this.lastRaftTargetId,
      lastRaftTargetHealth: this.lastRaftTargetHealth,
      structureDamageEvents: this.structureDamageEvents,
      foundationDamageEvents: this.foundationDamageEvents,
      collectionNetDamageEvents: this.collectionNetDamageEvents,
    };
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
    const exposedStructure = this.structures.findSharkTarget(edges, fromRaftX, fromRaftZ);
    const exposedNet = this.collectionNets?.findSharkTarget(fromRaftX, fromRaftZ) ?? null;
    const chooseNet = Boolean(exposedNet && (
      exposedNet.health < 0.72 * COLLECTION_NET_MAX_HEALTH
      || this.random() < 0.68
    ));
    const chooseStructure = !chooseNet && exposedStructure && (
      raftStructureDamageStage(exposedStructure) !== 'intact'
      || this.random() < 0.72
    );
    let targetCoordinate: GridCoordinate;
    if (chooseNet && exposedNet) {
      this.targetCollectionNetId = exposedNet.id;
      this.targetStructureId = null;
      targetCoordinate = { x: exposedNet.x, z: exposedNet.z };
    } else if (chooseStructure && exposedStructure) {
      this.targetCollectionNetId = null;
      this.targetStructureId = exposedStructure.id;
      targetCoordinate = { x: exposedStructure.x, z: exposedStructure.z };
    } else {
      this.targetCollectionNetId = null;
      this.targetStructureId = null;
      let best = edges[0];
      let bestScore = Number.NEGATIVE_INFINITY;
      for (const tile of edges) {
        const score = tile.x * fromRaftX + tile.z * fromRaftZ + this.random() * 0.35;
        if (score > bestScore) {
          best = tile;
          bestScore = score;
        }
      }
      targetCoordinate = { x: best.x, z: best.z };
    }
    this.targetTile = targetCoordinate;
    this.targetingPlayer = false;
    if (!this.updateRaftTargetWorld()) return;
    if (chooseNet && exposedNet) {
      const outside = collectionNetOutsideCoordinate(exposedNet);
      this.outward.set(outside.x - exposedNet.x, 0, outside.z - exposedNet.z);
    } else {
      this.outward.set(targetCoordinate.x, 0, targetCoordinate.z);
    }
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
    const definition = exposedStructure && chooseStructure
      ? RAFT_STRUCTURE_DEFINITIONS[exposedStructure.type]
      : null;
    this.showNotice(
      chooseNet
        ? '潮兜收集网下方传来急促水声'
        : definition ? `${definition.shortName}附近传来急促水声` : '木筏外沿传来急促水声',
    );
  }

  private updateApproach(time: number, delta: number): void {
    if (!this.updateRaftTargetWorld()) {
      this.beginRetreat();
      return;
    }
    this.approachWorld.copy(this.targetWorld).addScaledVector(this.outward, 2.5);
    this.approachWorld.y = this.model.position.y;
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
    this.updateSpearInteraction(
      this.targetCollectionNetId
        ? '鲨鱼逼近潮兜收集网'
        : this.targetStructureId ? '鲨鱼逼近暴露结构' : '鲨鱼进入刺击距离',
    );
  }

  private updateAttack(time: number): void {
    if (!this.updateRaftTargetWorld()) {
      this.beginRetreat();
      return;
    }
    const biteCycle = this.phaseTime % 1.55;
    const lunge = Math.pow(Math.sin(Math.min(1, biteCycle / 0.8) * Math.PI), 1.6) * 0.78;
    this.model.position.copy(this.approachWorld).lerp(this.targetWorld, lunge);
    const surfaceY = sampleWaveHeight(this.model.position.x, this.model.position.z, time);
    const strikeY = Math.min(this.targetWorld.y - 0.22, surfaceY + 0.58);
    this.model.position.y = MathUtils.lerp(surfaceY - 0.58, strikeY, lunge);
    this.lookTarget.copy(this.targetWorld);
    this.lookTarget.y = Math.min(this.targetWorld.y, surfaceY + 0.64);
    this.model.lookAt(this.lookTarget);

    const biteThresholds = [0.68, 2.23];
    if (this.biteIndex < biteThresholds.length && this.phaseTime >= biteThresholds[this.biteIndex]) {
      this.performBite();
      this.biteIndex += 1;
    }
    if (this.phaseTime > 3.35) this.beginRetreat();
    this.updateSpearInteraction(
      this.targetCollectionNetId
        ? '鲨鱼正在撕咬潮兜收集网'
        : this.targetStructureId ? '鲨鱼正在撕咬暴露结构' : '鲨鱼正在撕咬筏格',
    );
  }

  private performBite(): void {
    if (!this.targetTile) return;
    const reinforced = this.raft.getTile(this.targetTile)?.reinforced === true;
    const biteDamage = Math.max(1, Math.round(this.raft.sharkDamageForTile(this.targetTile, 34)));
    const protectionLabel = reinforced ? ' · 筏缘护甲吸收冲击' : '';
    if (this.targetCollectionNetId) {
      const targetId = this.targetCollectionNetId;
      const result = this.collectionNets?.damageByShark(targetId, biteDamage);
      if (!result?.changed) {
        this.beginRetreat();
        return;
      }
      const healthRatio = result.health / COLLECTION_NET_MAX_HEALTH;
      this.audio.playSharkBite();
      this.audio.playStructureDamage(this.targetWorld, 1 - healthRatio, result.destroyed);
      this.splashes.spawnImpact(this.targetWorld, 0x6d806c, result.destroyed ? 26 : 18);
      this.splashes.spawnStructureDamage(this.targetWorld, healthRatio, result.destroyed);
      this.onImpact(result.destroyed ? 0.34 : reinforced ? 0.14 : 0.22);
      this.collectionNetDamageEvents += 1;
      this.lastRaftTargetKind = 'collectionNet';
      this.lastRaftTargetId = targetId;
      this.lastRaftTargetHealth = result.health;
      this.onRaftMutation({
        kind: 'collectionNet',
        targetId,
        health: result.health,
        destroyed: result.destroyed,
        removed: [],
      });
      this.showNotice(
        result.destroyed
          ? '潮兜收集网被撕碎，网中物资落海'
          : `潮兜收集网受损 · ${Math.round(result.health)}/${COLLECTION_NET_MAX_HEALTH}${protectionLabel}`,
      );
      if (result.destroyed) this.beginRetreat();
      return;
    }
    if (this.targetStructureId) {
      const target = this.structures.getStructure(this.targetStructureId);
      if (!target) {
        this.beginRetreat();
        return;
      }
      this.structures.getLocalImpactPosition(target, this.targetWorld);
      this.raft.localPointToWorld(this.targetWorld, this.targetWorld);
      const result = this.structures.damage(target.id, biteDamage);
      if (!result.changed) return;
      const definition = RAFT_STRUCTURE_DEFINITIONS[target.type];
      const health = result.structure?.health ?? 0;
      const healthRatio = result.structure ? raftStructureHealthRatio(result.structure) : 0;
      this.audio.playSharkBite();
      this.audio.playStructureDamage(
        this.targetWorld,
        1 - healthRatio,
        result.destroyed,
        target.type === 'roof',
      );
      this.splashes.spawnImpact(this.targetWorld, 0x7d5443, 18);
      this.splashes.spawnStructureDamage(this.targetWorld, healthRatio, result.destroyed, target.type === 'roof');
      for (const removed of result.removed.slice(1)) {
        this.structures.getLocalImpactPosition(removed, this.cascadeWorld);
        this.raft.localPointToWorld(this.cascadeWorld, this.cascadeWorld);
        this.splashes.spawnStructureDamage(this.cascadeWorld, 0, true, removed.type === 'roof');
      }
      this.onImpact(result.destroyed ? 0.38 : reinforced ? 0.15 : 0.24);
      this.structureDamageEvents += 1;
      this.lastRaftTargetKind = 'structure';
      this.lastRaftTargetId = target.id;
      this.lastRaftTargetHealth = health;
      this.onRaftMutation({
        kind: 'structure',
        targetId: target.id,
        health,
        destroyed: result.destroyed,
        removed: result.removed,
      });
      this.showNotice(
        result.destroyed
          ? `${definition.shortName}被撕碎${result.removed.length > 1 ? ` · ${result.removed.length - 1}件失去支撑` : ''}`
          : `${definition.shortName}受损 · ${Math.round(health)}/${definition.maxHealth}${protectionLabel}`,
      );
      if (result.destroyed) this.beginRetreat();
      return;
    }

    const result = this.raft.damageTile(this.targetTile, biteDamage);
    if (!result.changed) return;
    this.audio.playSharkBite();
    this.audio.playStructureDamage(this.targetWorld, result.destroyed ? 1 : 1 - (result.tile?.health ?? 0) / 100, result.destroyed);
    this.splashes.spawn(this.targetWorld);
    this.splashes.spawnStructureDamage(this.targetWorld, (result.tile?.health ?? 0) / 100, result.destroyed);
    this.onImpact(reinforced ? 0.13 : 0.2);
    useGameStore.getState().setRaft(this.raft.getIntegrityStats());
    const removed = result.destroyed ? this.structures.handleFoundationLoss() : [];
    for (const structure of removed) {
      this.structures.getLocalImpactPosition(structure, this.cascadeWorld);
      this.raft.localPointToWorld(this.cascadeWorld, this.cascadeWorld);
      this.splashes.spawnStructureDamage(this.cascadeWorld, 0, true, structure.type === 'roof');
    }
    this.foundationDamageEvents += 1;
    this.lastRaftTargetKind = 'foundation';
    const targetId = `${this.targetTile.x},${this.targetTile.z}`;
    this.lastRaftTargetId = targetId;
    this.lastRaftTargetHealth = result.tile?.health ?? 0;
    this.onRaftMutation({
      kind: 'foundation',
      targetId,
      health: this.lastRaftTargetHealth,
      destroyed: result.destroyed,
      removed,
    });
    this.showNotice(
      result.destroyed
        ? `外围筏格被撕碎${removed.length > 0 ? ` · ${removed.length}件结构失去支撑` : ''}`
        : `木筏结构受损${protectionLabel}`,
    );
    if (result.destroyed) {
      this.beginRetreat();
    }
  }

  private updateRaftTargetWorld(): boolean {
    if (!this.targetTile || !this.raft.hasTile(this.targetTile)) return false;
    if (this.targetCollectionNetId) {
      if (!this.collectionNets?.getLocalImpactPosition(this.targetCollectionNetId, this.targetWorld)) return false;
    } else if (this.targetStructureId) {
      const structure = this.structures.getStructure(this.targetStructureId);
      if (!structure) return false;
      this.structures.getLocalImpactPosition(structure, this.targetWorld);
    } else {
      this.raft.gridToLocal(this.targetTile, this.targetWorld);
    }
    this.raft.localPointToWorld(this.targetWorld, this.targetWorld);
    return true;
  }

  private beginPlayerApproach(): void {
    this.targetingPlayer = true;
    this.targetTile = null;
    this.targetStructureId = null;
    this.targetCollectionNetId = null;
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
    this.targetTile = null;
    this.targetStructureId = null;
    this.targetCollectionNetId = null;
    this.targetingPlayer = false;
    this.setMode('retreating');
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
      target: this.targetingPlayer
        ? 'player'
        : this.targetCollectionNetId ? 'collectionNet' : this.targetStructureId ? 'structure' : 'raft',
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
