import {
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  TorusGeometry,
  Vector3,
} from 'three';
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
import { bundleLabel, type InventoryMutation, type ItemBundle } from '../domain/items';
import {
  RAFT_SHARK_ATTACK_RHYTHM,
  SHARK_CARCASS_WINDOW_SECONDS,
  SHARK_CARCASS_HARVEST_REACH,
  SHARK_HARVEST_HOLD_SECONDS,
  SHARK_HARVEST_STAGES,
  SHARK_MAX_HEALTH,
  SHARK_RESPAWN_SECONDS,
  SHARK_SPEAR_REACH,
  SHARK_SINK_SECONDS,
  WATER_SHARK_ATTACK_RHYTHM,
  createDefaultSharkState,
  sampleSharkAttack,
  sharkHarvestStage,
  type SavedSharkState,
  type SharkAttackPhase,
  type SharkAttackSample,
  type SharkLifecycle,
} from '../domain/shark';
import { RESONANCE_DAMAGE, isResonanceTarget } from '../domain/resonanceFork';

const SHARK_CARCASS_FOCUS_RADIUS = 1.38;
const SHARK_CARCASS_HOLD_REACH = SHARK_CARCASS_HARVEST_REACH + 0.9;
const SHARK_CARCASS_HOLD_RADIUS = 2.35;

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
  lifecycle: SharkLifecycle;
  carcassPhase: 'none' | 'settling' | 'available' | 'sinking' | 'cooldown';
  carcassFocused: boolean;
  harvestIndex: number;
  harvestProgress: number;
  harvestEvents: number;
  carcassSeconds: number;
  cooldownSeconds: number;
  health: number;
  mode: SharkMode;
  attackPhase: SharkAttackPhase;
  attackProgress: number;
  counterWindow: boolean;
  secondsToImpact: number;
  telegraphEvents: number;
  biteAttempts: number;
  playerDamageEvents: number;
  missedPlayerBites: number;
  timedCounterEvents: number;
  resonancePulseEvents: number;
  recoverySeconds: number;
  worldPosition: { x: number; y: number; z: number };
}

export interface SharkHarvestSettlement extends InventoryMutation {
  worldDropped: boolean;
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
  private readonly carcassVector = new Vector3();
  private readonly cameraWorld = new Vector3();
  private readonly carcassFocusRing = new Mesh(
    new TorusGeometry(1.02, 0.035, 7, 42),
    new MeshBasicMaterial({
      color: 0x78d3c7,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    }),
  );
  private readonly harvestMarks: Mesh[];
  private mode: SharkMode = 'distant';
  private totalTime = 0;
  private phaseTime = 0;
  private circleAngle = 1.2;
  private nextAttackAt = 34;
  private targetTile: GridCoordinate | null = null;
  private targetStructureId: string | null = null;
  private targetCollectionNetId: string | null = null;
  private biteIndex = 0;
  private telegraphIndex = -1;
  private hitsDuringAttack = 0;
  private health = SHARK_MAX_HEALTH;
  private lifecycle: SharkLifecycle = 'active';
  private carcassPhase: SharkDiagnostics['carcassPhase'] = 'none';
  private carcassRemaining = 0;
  private cooldownRemaining = 0;
  private harvestIndex = 0;
  private harvestProgress = 0;
  private harvestEvents = 0;
  private carcassFocused = false;
  private harvestHeld = false;
  private inputEnabled = false;
  private lastCarcassPrompt: string | null = null;
  private targetingPlayer = false;
  private attackPhase: SharkAttackPhase = 'idle';
  private attackProgress = 0;
  private counterWindow = false;
  private counterStrikeWindow = false;
  private secondsToImpact = 0;
  private telegraphEvents = 0;
  private biteAttempts = 0;
  private playerDamageEvents = 0;
  private missedPlayerBites = 0;
  private timedCounterEvents = 0;
  private resonancePulseEvents = 0;
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
    private readonly camera: PerspectiveCamera,
    materials: MaterialLibrary,
    private readonly audio: AudioSystem,
    private readonly splashes: SplashSystem,
    private readonly onImpact: (strength: number) => void,
    private readonly onRaftMutation: (mutation: SharkRaftMutation) => void = () => undefined,
    private readonly collectionNets: CollectionNetSystem | null = null,
    savedState: SavedSharkState = createDefaultSharkState(),
    private readonly onHarvest: (loot: ItemBundle, position: Vector3) => SharkHarvestSettlement = (loot) => ({
      inventory: {},
      accepted: {},
      rejected: { ...loot },
      worldDropped: false,
    }),
    private readonly onStateChange: () => void = () => undefined,
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
    this.harvestMarks = this.model.userData.harvestMarks as Mesh[];
    this.carcassFocusRing.name = 'shark-carcass-focus-ring';
    this.carcassFocusRing.rotation.x = Math.PI / 2;
    this.carcassFocusRing.visible = false;
    this.carcassFocusRing.renderOrder = 5;
    this.restoreState(savedState);
    this.scene.add(this.model, this.carcassFocusRing);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  update(time: number, delta: number): void {
    this.totalTime += delta;
    this.phaseTime += delta;
    this.feedbackTimer -= delta;
    if (this.lifecycle !== 'active') {
      this.updateDefeated(time, delta);
      if (this.feedbackTimer <= 0) {
        this.feedbackTimer = 0.08;
        this.publishFeedback();
      }
      return;
    }
    const tailSpeed = this.mode === 'attacking' ? (this.attackPhase === 'windup' ? 12.8 : 9.5) : 5.2;
    const tailRange = this.mode === 'attacking' ? (this.attackPhase === 'windup' ? 0.54 : 0.42) : 0.26;
    this.tailPivot.rotation.y = Math.sin(time * tailSpeed) * tailRange;
    this.model.rotation.z = Math.sin(time * 1.4) * 0.035;

    const playerInWater = this.player.getSurface() === 'water';
    if (playerInWater && this.mode !== 'retreating') {
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
    if ((this.mode !== 'approaching' && this.mode !== 'attacking') || this.lifecycle !== 'active' || !this.model.visible) return false;
    camera.getWorldPosition(this.cameraWorld);
    this.strikeVector.copy(this.model.position).sub(this.cameraWorld);
    const distance = this.strikeVector.length();
    if (distance > SHARK_SPEAR_REACH || distance < 0.25) return false;
    this.strikeVector.divideScalar(distance);
    camera.getWorldDirection(this.cameraForward);
    return this.cameraForward.dot(this.strikeVector) > 0.69;
  }

  isCounterWindowOpen(): boolean {
    return this.lifecycle === 'active' && this.mode === 'attacking' && this.counterWindow;
  }

  receiveSpearStrike(camera: PerspectiveCamera, damage = 34, counterPrimed = false): boolean {
    if (!this.canStrike(camera)) return false;
    const timedCounter = counterPrimed && this.counterStrikeWindow;
    this.health = Math.max(0, this.health - Math.max(1, damage));
    this.hitsDuringAttack += 1;
    this.audio.playSpearHit();
    this.splashes.spawnImpact(this.model.position, 0xb74f45, 16);
    this.showNotice(
      this.health <= 0
        ? '深潮鲨失去力气'
        : timedCounter ? '抢在扑咬前逼退深潮鲨' : '刺击命中',
    );
    if (this.health <= 0) {
      this.beginDefeat();
    } else if (timedCounter) {
      this.timedCounterEvents += 1;
      this.audio.playSharkCounter();
      this.splashes.spawnSharkCounter(this.model.position);
      this.beginRetreat();
    } else if (this.hitsDuringAttack >= 2) {
      this.beginRetreat();
    }
    this.publishFeedback();
    return true;
  }

  canReceiveResonancePulse(camera: PerspectiveCamera): boolean {
    camera.getWorldPosition(this.cameraWorld);
    this.strikeVector.copy(this.model.position).sub(this.cameraWorld);
    const distance = this.strikeVector.length();
    if (distance > 0) this.strikeVector.divideScalar(distance);
    camera.getWorldDirection(this.cameraForward);
    return isResonanceTarget({
      active: this.lifecycle === 'active',
      visible: this.model.visible,
      mode: this.mode,
      distance,
      alignment: distance > 0 ? this.cameraForward.dot(this.strikeVector) : -1,
    });
  }

  receiveResonancePulse(camera: PerspectiveCamera, damage = RESONANCE_DAMAGE): boolean {
    if (!this.canReceiveResonancePulse(camera)) return false;
    this.health = Math.max(0, this.health - Math.max(0, damage));
    this.resonancePulseEvents += 1;
    this.splashes.spawnResonancePulse(this.model.position);
    this.showNotice(this.health <= 0 ? '潮鸣脉冲压低了鲨鳃' : '潮鸣脉冲迫使深潮鲨潜退');
    if (this.health <= 0) this.beginDefeat();
    else this.beginRetreat();
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
      lifecycle: this.lifecycle,
      carcassPhase: this.carcassPhase,
      carcassFocused: this.carcassFocused,
      harvestIndex: this.harvestIndex,
      harvestProgress: this.harvestProgress,
      harvestEvents: this.harvestEvents,
      carcassSeconds: this.carcassRemaining,
      cooldownSeconds: this.cooldownRemaining,
      health: this.health,
      mode: this.mode,
      attackPhase: this.attackPhase,
      attackProgress: this.attackProgress,
      counterWindow: this.counterWindow,
      secondsToImpact: this.secondsToImpact,
      telegraphEvents: this.telegraphEvents,
      biteAttempts: this.biteAttempts,
      playerDamageEvents: this.playerDamageEvents,
      missedPlayerBites: this.missedPlayerBites,
      timedCounterEvents: this.timedCounterEvents,
      resonancePulseEvents: this.resonancePulseEvents,
      recoverySeconds: this.lifecycle === 'active' && this.mode === 'retreating'
        ? Math.max(0, 6.2 - this.phaseTime)
        : 0,
      worldPosition: {
        x: this.model.position.x,
        y: this.model.position.y,
        z: this.model.position.z,
      },
    };
  }

  getSavedState(): SavedSharkState {
    if (this.lifecycle === 'carcass') {
      return {
        lifecycle: 'carcass',
        health: 0,
        x: Number(this.model.position.x.toFixed(3)),
        z: Number(this.model.position.z.toFixed(3)),
        harvestIndex: this.harvestIndex,
        remainingSeconds: Number(this.carcassRemaining.toFixed(3)),
      };
    }
    if (this.lifecycle === 'cooldown') {
      return {
        ...createDefaultSharkState(),
        lifecycle: 'cooldown',
        health: 0,
        remainingSeconds: Number(this.cooldownRemaining.toFixed(3)),
      };
    }
    return { ...createDefaultSharkState(), health: this.health };
  }

  getAimDiagnostics(): {
    camera: [number, number, number];
    forward: [number, number, number];
    target: [number, number, number];
  } {
    this.camera.getWorldPosition(this.cameraWorld);
    this.camera.getWorldDirection(this.cameraForward);
    return {
      camera: [this.cameraWorld.x, this.cameraWorld.y, this.cameraWorld.z],
      forward: [this.cameraForward.x, this.cameraForward.y, this.cameraForward.z],
      target: [this.model.position.x, this.model.position.y, this.model.position.z],
    };
  }

  setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
    if (enabled) return;
    this.harvestHeld = false;
    this.harvestProgress = 0;
    this.carcassFocused = false;
    this.carcassFocusRing.visible = false;
    this.clearCarcassPrompt();
  }

  dispose(): void {
    if (this.noticeTimer !== null) window.clearTimeout(this.noticeTimer);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.clearCarcassPrompt();
    this.scene.remove(this.model, this.carcassFocusRing);
    this.carcassFocusRing.geometry.dispose();
    this.carcassFocusRing.material.dispose();
  }

  private restoreState(savedState: SavedSharkState): void {
    this.health = savedState.health;
    if (savedState.lifecycle === 'active') {
      if (this.health < SHARK_MAX_HEALTH) {
        this.mode = 'circling';
        this.nextAttackAt = 0.8;
      }
      return;
    }
    this.health = 0;
    this.targetTile = null;
    this.targetStructureId = null;
    this.targetCollectionNetId = null;
    this.targetingPlayer = false;
    if (savedState.lifecycle === 'carcass') {
      this.lifecycle = 'carcass';
      this.carcassPhase = 'available';
      this.carcassRemaining = savedState.remainingSeconds;
      this.harvestIndex = savedState.harvestIndex;
      this.mode = 'carcass';
      this.model.position.set(savedState.x, 0, savedState.z);
      this.model.rotation.z = Math.PI * 0.48;
      this.updateHarvestMarks();
      return;
    }
    this.lifecycle = 'cooldown';
    this.carcassPhase = 'cooldown';
    this.cooldownRemaining = savedState.remainingSeconds;
    this.mode = 'retreating';
    this.model.visible = false;
  }

  private beginDefeat(): void {
    this.lifecycle = 'carcass';
    this.carcassPhase = 'settling';
    this.carcassRemaining = SHARK_CARCASS_WINDOW_SECONDS;
    this.harvestIndex = 0;
    this.harvestProgress = 0;
    this.harvestEvents = 0;
    this.harvestHeld = false;
    this.targetTile = null;
    this.targetStructureId = null;
    this.targetCollectionNetId = null;
    this.targetingPlayer = false;
    this.clearAttackWindow('complete');
    this.outward.copy(this.model.position).sub(this.raft.group.position);
    this.outward.y = 0;
    if (this.outward.lengthSq() < 0.1) this.outward.set(1, 0, 0);
    this.outward.normalize();
    this.setMode('retreating');
    this.audio.playSharkDefeat();
    this.splashes.spawnSharkDefeat(this.model.position);
    this.onImpact(0.24);
    this.clearCarcassPrompt();
    useGameStore.getState().setInteraction(null, 'shark');
    this.onStateChange();
  }

  private updateDefeated(time: number, delta: number): void {
    this.tailPivot.rotation.y = Math.sin(time * 2.4) * (this.carcassPhase === 'settling' ? 0.1 : 0.035);
    if (this.carcassPhase === 'settling') {
      this.model.position.addScaledVector(this.outward, delta * MathUtils.lerp(0.58, 0.08, Math.min(1, this.phaseTime / 1.55)));
      const surface = sampleWaveHeight(this.model.position.x, this.model.position.z, time);
      this.model.position.y = surface - 0.5 - Math.sin(Math.min(1, this.phaseTime / 1.55) * Math.PI) * 0.22;
      this.lookTarget.copy(this.model.position).add(this.outward);
      this.lookTarget.y = this.model.position.y;
      this.model.lookAt(this.lookTarget);
      const settle = MathUtils.smoothstep(this.phaseTime, 0, 1.55);
      this.model.rotation.z = MathUtils.lerp(0, Math.PI * 0.48, settle);
      if (this.phaseTime >= 1.55) {
        this.carcassPhase = 'available';
        this.setMode('carcass');
        this.audio.playSharkCarcassSurface();
        this.splashes.spawn(this.model.position);
        this.showNotice('深潮鲨浮在水面，战利品会随浪流失');
        this.onStateChange();
      }
      return;
    }
    if (this.carcassPhase === 'available') {
      this.carcassRemaining = Math.max(0, this.carcassRemaining - delta);
      this.model.position.addScaledVector(this.outward, delta * 0.035);
      this.model.position.y = sampleWaveHeight(this.model.position.x, this.model.position.z, time) - 0.24;
      this.lookTarget.copy(this.model.position).add(this.outward);
      this.lookTarget.y = this.model.position.y;
      this.model.lookAt(this.lookTarget);
      this.model.rotation.z = Math.PI * 0.48 + Math.sin(time * 1.15) * 0.045;
      this.updateCarcassInteraction(time, delta);
      if (this.carcassPhase === 'available' && this.carcassRemaining <= 0) this.beginCarcassSinking(false);
      return;
    }
    if (this.carcassPhase === 'sinking') {
      const surface = sampleWaveHeight(this.model.position.x, this.model.position.z, time);
      this.model.position.addScaledVector(this.outward, delta * 0.025);
      this.model.position.y = surface - 0.24 - Math.min(4.6, this.phaseTime * 0.92);
      this.model.rotation.z = Math.PI * 0.48 + this.phaseTime * 0.08;
      if (this.phaseTime >= SHARK_SINK_SECONDS) {
        this.carcassPhase = 'cooldown';
        this.phaseTime = 0;
        this.model.visible = false;
        this.onStateChange();
      }
      return;
    }
    this.cooldownRemaining = Math.max(0, this.cooldownRemaining - delta);
    if (this.cooldownRemaining > 0) return;
    this.lifecycle = 'active';
    this.carcassPhase = 'none';
    this.health = SHARK_MAX_HEALTH;
    this.harvestIndex = 0;
    this.harvestProgress = 0;
    this.model.visible = true;
    this.model.rotation.set(0, 0, 0);
    this.updateHarvestMarks();
    this.circleAngle += Math.PI * 0.72;
    this.nextAttackAt = this.totalTime + randomRange(this.random, 52, 75);
    this.setMode('distant');
    this.onStateChange();
  }

  private updateCarcassInteraction(time: number, delta: number): void {
    if (!this.inputEnabled) {
      this.cancelCarcassInteraction();
      return;
    }
    this.camera.getWorldPosition(this.cameraWorld);
    this.carcassVector.copy(this.model.position).sub(this.cameraWorld);
    const distanceSquared = this.carcassVector.lengthSq();
    this.camera.getWorldDirection(this.cameraForward);
    const along = this.carcassVector.dot(this.cameraForward);
    const perpendicularSquared = Math.max(0, distanceSquared - along * along);
    const focusAcquired = along > 0.18
      && distanceSquared <= SHARK_CARCASS_HARVEST_REACH * SHARK_CARCASS_HARVEST_REACH
      && perpendicularSquared <= SHARK_CARCASS_FOCUS_RADIUS * SHARK_CARCASS_FOCUS_RADIUS;
    const heldFocusRetained = along > 0.05
      && distanceSquared <= SHARK_CARCASS_HOLD_REACH * SHARK_CARCASS_HOLD_REACH
      && perpendicularSquared <= SHARK_CARCASS_HOLD_RADIUS * SHARK_CARCASS_HOLD_RADIUS;
    this.carcassFocused = this.harvestHeld ? heldFocusRetained : focusAcquired;
    if (!this.carcassFocused) {
      this.cancelCarcassInteraction();
      return;
    }
    const stage = sharkHarvestStage(this.harvestIndex);
    if (!stage) {
      this.beginCarcassSinking(true);
      return;
    }
    this.carcassFocusRing.visible = true;
    this.carcassFocusRing.position.copy(this.model.position);
    this.carcassFocusRing.position.y = sampleWaveHeight(this.model.position.x, this.model.position.z, time) + 0.035;
    this.carcassFocusRing.scale.setScalar(0.96 + Math.sin(time * 4.2) * 0.055);
    if (this.harvestHeld) {
      this.harvestProgress = Math.min(SHARK_HARVEST_HOLD_SECONDS, this.harvestProgress + delta);
    } else {
      this.harvestProgress = 0;
    }
    const progress = Math.round((this.harvestProgress / SHARK_HARVEST_HOLD_SECONDS) * 100);
    this.setCarcassPrompt(
      this.harvestHeld
        ? `正在割取${stage.label} · ${progress}%`
        : `按住 E 割取${stage.label} · ${this.harvestIndex + 1}/${SHARK_HARVEST_STAGES.length}`,
    );
    if (this.harvestProgress >= SHARK_HARVEST_HOLD_SECONDS) this.completeHarvestStage();
  }

  private completeHarvestStage(): void {
    const stage = sharkHarvestStage(this.harvestIndex);
    if (!stage) return;
    const settlement = this.onHarvest({ ...stage.loot }, this.model.position.clone());
    const acceptedLabel = bundleLabel(settlement.accepted);
    const rejected = Object.values(settlement.rejected).some((amount) => (amount ?? 0) > 0);
    if (rejected && !settlement.worldDropped) {
      this.audio.playDenied();
      this.showNotice('战利品暂时无法系成漂浮包');
      this.harvestHeld = false;
      this.harvestProgress = 0;
      return;
    }
    this.harvestIndex += 1;
    this.harvestEvents += 1;
    this.harvestProgress = 0;
    this.audio.playSharkHarvest(this.harvestIndex >= SHARK_HARVEST_STAGES.length, rejected);
    this.splashes.spawnSharkHarvest(this.model.position, this.harvestIndex >= SHARK_HARVEST_STAGES.length);
    this.onImpact(0.07);
    this.updateHarvestMarks();
    this.showNotice(
      acceptedLabel
        ? rejected ? `${acceptedLabel} · 余料已系成漂浮包` : acceptedLabel
        : `${stage.label}已系成漂浮包`,
    );
    if (this.harvestIndex >= SHARK_HARVEST_STAGES.length) this.beginCarcassSinking(true);
    else this.onStateChange();
  }

  private beginCarcassSinking(harvested: boolean): void {
    this.lifecycle = 'cooldown';
    this.carcassPhase = 'sinking';
    this.cooldownRemaining = SHARK_RESPAWN_SECONDS;
    this.harvestHeld = false;
    this.harvestProgress = 0;
    this.carcassFocused = false;
    this.carcassFocusRing.visible = false;
    this.clearCarcassPrompt();
    this.setMode('retreating');
    this.audio.playSharkCarcassSink(harvested);
    this.showNotice(harvested ? '鲨体已取尽，正在沉入深水' : '鲨体随浪流失，正在沉入深水');
    this.onStateChange();
  }

  private updateHarvestMarks(): void {
    for (let index = 0; index < this.harvestMarks.length; index += 1) {
      this.harvestMarks[index].visible = this.harvestIndex > index && this.lifecycle !== 'active';
    }
  }

  private cancelCarcassInteraction(): void {
    this.carcassFocused = false;
    this.harvestHeld = false;
    this.harvestProgress = 0;
    this.carcassFocusRing.visible = false;
    this.clearCarcassPrompt();
  }

  private setCarcassPrompt(prompt: string): void {
    this.lastCarcassPrompt = prompt;
    useGameStore.getState().setInteraction(prompt, 'shark');
  }

  private clearCarcassPrompt(): void {
    const store = useGameStore.getState();
    if (this.lastCarcassPrompt && store.interaction === this.lastCarcassPrompt) store.setInteraction(null, 'shark');
    this.lastCarcassPrompt = null;
  }

  private clearAttackWindow(phase: SharkAttackPhase = 'idle'): void {
    this.attackPhase = phase;
    this.attackProgress = 0;
    this.counterWindow = false;
    this.counterStrikeWindow = false;
    this.secondsToImpact = 0;
  }

  private applyAttackSample(sample: SharkAttackSample, playerTarget: boolean): void {
    const counterChanged = this.counterWindow !== sample.counterWindow;
    this.attackPhase = sample.phase;
    this.attackProgress = sample.progress;
    this.counterWindow = sample.counterWindow;
    this.counterStrikeWindow = sample.counterStrikeWindow;
    this.secondsToImpact = sample.secondsToImpact;
    if (counterChanged) this.publishFeedback();
    if (sample.phase !== 'windup' || sample.nextBiteIndex === this.telegraphIndex) return;
    this.telegraphIndex = sample.nextBiteIndex;
    this.telegraphEvents += 1;
    this.audio.playSharkWindup(playerTarget, sample.nextBiteIndex > 0);
    this.splashes.spawnSharkTelegraph(this.model.position, playerTarget);
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
    this.telegraphIndex = -1;
    this.hitsDuringAttack = 0;
    this.clearAttackWindow();
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
    const sample = sampleSharkAttack(RAFT_SHARK_ATTACK_RHYTHM, this.phaseTime, this.biteIndex);
    this.applyAttackSample(sample, false);
    const lunge = sample.lunge * 0.82;
    this.model.position.copy(this.approachWorld).lerp(this.targetWorld, lunge);
    const surfaceY = sampleWaveHeight(this.model.position.x, this.model.position.z, time);
    const strikeY = Math.min(this.targetWorld.y - 0.22, surfaceY + 0.58);
    this.model.position.y = MathUtils.lerp(surfaceY - 0.58, strikeY, lunge);
    this.lookTarget.copy(this.targetWorld);
    this.lookTarget.y = Math.min(this.targetWorld.y, surfaceY + 0.64);
    this.model.lookAt(this.lookTarget);
    if (sample.phase === 'windup') {
      this.model.rotateZ(Math.sin(this.phaseTime * 10.5) * 0.1 * (1 - sample.progress * 0.42));
    }

    if (sample.biteDue) {
      this.biteAttempts += 1;
      this.performBite();
      this.biteIndex += 1;
      if (this.mode === 'retreating') return;
    }
    if (sample.phase === 'complete') {
      this.beginRetreat();
      return;
    }
    this.updateSpearInteraction(
      sample.phase === 'windup'
        ? '鲨鱼正在蓄势扑咬'
        : sample.phase === 'recovery'
          ? '鲨鱼正在回摆，尚未再次发力'
          : this.targetCollectionNetId
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
    this.biteIndex = 0;
    this.telegraphIndex = -1;
    this.hitsDuringAttack = 0;
    this.clearAttackWindow();
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
        this.biteIndex = 0;
        this.telegraphIndex = -1;
        this.clearAttackWindow();
        this.setMode('attacking');
      }
      this.updateSpearInteraction('鲨鱼正从水下逼近');
      return;
    }

    if (this.mode !== 'attacking') {
      this.setMode('approaching');
      return;
    }
    const sample = sampleSharkAttack(WATER_SHARK_ATTACK_RHYTHM, this.phaseTime, this.biteIndex);
    this.applyAttackSample(sample, true);
    const speed = sample.phase === 'impact'
      ? 4.8
      : sample.phase === 'windup'
        ? 1.7 + sample.lunge * 3.4
        : 1.8 + sample.lunge * 2.2;
    this.model.position.addScaledVector(this.pursuitDirection, Math.min(distance, speed * delta));
    this.model.position.y += Math.sin(time * 4.2) * delta * 0.08;
    this.model.lookAt(this.playerWorld);
    if (sample.phase === 'windup') {
      this.model.rotateZ(Math.sin(this.phaseTime * 11.8) * 0.12 * (1 - sample.progress * 0.38));
    }
    if (sample.biteDue) {
      this.biteAttempts += 1;
      if (distance <= 1.55) {
        this.performPlayerBite();
      } else {
        this.missedPlayerBites += 1;
        this.audio.playSharkMiss();
        this.splashes.spawnSharkMiss(this.model.position);
        this.showNotice('深潮鲨的扑咬从身侧掠过');
      }
      this.biteIndex += 1;
    }
    if (sample.phase === 'complete') {
      this.beginRetreat();
      return;
    }
    this.updateSpearInteraction(
      sample.phase === 'windup'
        ? '鲨鱼翻身蓄势扑咬'
        : sample.phase === 'recovery' ? '鲨鱼扑咬后正在回摆' : '鲨鱼进入扑咬距离',
    );
  }

  private performPlayerBite(): void {
    const store = useGameStore.getState();
    store.damagePlayer(18, 'shark');
    this.playerDamageEvents += 1;
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
    this.telegraphIndex = -1;
    this.clearAttackWindow('recovery');
    this.setMode('retreating');
    useGameStore.getState().setInteraction(null, 'shark');
  }

  private updateRetreat(time: number, delta: number): void {
    this.outward.copy(this.model.position).sub(this.raft.group.position);
    this.outward.y = 0;
    if (this.outward.lengthSq() < 0.1) this.outward.set(1, 0, 0);
    this.outward.normalize();
    this.model.position.addScaledVector(this.outward, delta * 2.15);
    const surface = sampleWaveHeight(this.model.position.x, this.model.position.z, time);
    this.model.position.y = surface - 0.75;
    this.lookTarget.copy(this.model.position).add(this.outward);
    this.model.lookAt(this.lookTarget);
    if (this.phaseTime > 6.2) {
      this.nextAttackAt = this.totalTime + randomRange(this.random, 48, 70);
      this.clearAttackWindow();
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
        ? this.attackPhase === 'windup'
          ? MathUtils.clamp(0.42 + this.attackProgress * 0.58, 0, 1)
          : this.attackPhase === 'impact'
            ? 1
            : 0.38
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
      target: this.lifecycle === 'carcass'
        ? 'carcass'
        : this.targetingPlayer
        ? 'player'
        : this.targetCollectionNetId ? 'collectionNet' : this.targetStructureId ? 'structure' : 'raft',
      harvestProgress: this.harvestProgress / SHARK_HARVEST_HOLD_SECONDS,
      harvested: this.harvestIndex,
      harvestTotal: SHARK_HARVEST_STAGES.length,
      carcassSeconds: Math.ceil(this.carcassRemaining),
      attackPhase: this.attackPhase,
      attackProgress: this.attackProgress,
      counterWindow: this.counterWindow,
      secondsToImpact: this.secondsToImpact,
      recoverySeconds: this.lifecycle === 'active' && this.mode === 'retreating'
        ? Math.max(0, 6.2 - this.phaseTime)
        : 0,
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

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (
      event.code !== 'KeyE'
      || event.repeat
      || !this.inputEnabled
      || this.carcassPhase !== 'available'
      || !this.carcassFocused
      || useGameStore.getState().interactionOwner !== 'shark'
    ) return;
    event.preventDefault();
    this.harvestHeld = true;
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (event.code !== 'KeyE') return;
    this.harvestHeld = false;
    this.harvestProgress = 0;
  };
}
