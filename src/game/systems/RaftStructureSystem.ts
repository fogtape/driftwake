import {
  Box3,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DynamicDrawUsage,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Ray,
  Vector3,
  type PerspectiveCamera,
} from 'three';
import type { MaterialLibrary } from '../art/Materials';
import {
  createRaftStructureParts,
  type StructurePart,
  type StructurePartGeometry,
  type StructurePartMaterial,
} from '../art/RaftStructureParts';
import {
  MAX_RAFT_STRUCTURES,
  RAFT_STRUCTURE_DEFINITIONS,
  RAFT_STRUCTURE_LEVEL_HEIGHT,
  canPlaceRaftStructure,
  canReplaceRaftStructure,
  canRemoveFoundationUnderStructures,
  canRemoveRaftStructure,
  normalizeRaftRotation,
  pruneUnsupportedRaftStructures,
  raftStructureDamageStage,
  raftStructureHealthRatio,
  sampleRaftOverheadSurfaces,
  sampleRaftWalkableSurfaces,
  selectSharkAttackStructure,
  type FoundationCoordinate,
  type RaftStructureDamageStage,
  type RaftOverheadSurface,
  type RaftWalkableSurface,
  type RaftRotation,
  type RaftStructureType,
  type SavedRaftStructure,
  type StructurePlacementReason,
  type StructureReplacementReason,
} from '../domain/raftStructures';
import { useGameStore } from '../../state/gameStore';
import { RAFT_TILE_X, RAFT_TILE_Z, type GridCoordinate, type RaftSystem } from './RaftSystem';

const MAX_PARTS_PER_BUCKET = MAX_RAFT_STRUCTURES * 24;
const PLAYER_RADIUS = 0.24;
const PLAYER_BODY_HEIGHT = 1.54;
const WALL_HALF_THICKNESS = 0.075;

type BucketKey = `${StructurePartGeometry}:${StructurePartMaterial}`;

interface StructureBucket {
  mesh: InstancedMesh;
  count: number;
}

export interface StructurePlacementCandidate {
  type: RaftStructureType;
  x: number;
  z: number;
  level: number;
  rotation: RaftRotation;
}

export interface StructureRemovalResult {
  removed: SavedRaftStructure | null;
  blocked: boolean;
}

export interface StructureDamageResult {
  changed: boolean;
  destroyed: boolean;
  structure: SavedRaftStructure | null;
  removed: SavedRaftStructure[];
  damageTaken: number;
}

export interface StructureRepairResult {
  changed: boolean;
  structure: SavedRaftStructure | null;
  repaired: number;
}

export interface StructureReplacementResult {
  replaced: SavedRaftStructure | null;
  previous: SavedRaftStructure | null;
  reason: StructureReplacementReason;
}

function bucketKey(part: Pick<StructurePart, 'geometry' | 'material'>): BucketKey {
  return `${part.geometry}:${part.material}`;
}

function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export class RaftStructureSystem {
  readonly group = new Group();
  private readonly structures = new Map<string, SavedRaftStructure>();
  private readonly buckets = new Map<BucketKey, StructureBucket>();
  private readonly boxGeometry = new BoxGeometry(1, 1, 1);
  private readonly cylinderGeometry = new CylinderGeometry(0.5, 0.5, 1, 8);
  private readonly baseMatrix = new Matrix4();
  private readonly partMatrix = new Matrix4();
  private readonly worldMatrix = new Matrix4();
  private readonly partPosition = new Vector3();
  private readonly partScale = new Vector3();
  private readonly partQuaternion = new Quaternion();
  private readonly partEuler = new Euler();
  private readonly up = new Vector3(0, 1, 0);
  private readonly basePosition = new Vector3();
  private readonly baseQuaternion = new Quaternion();
  private readonly unitScale = new Vector3(1, 1, 1);
  private readonly healthyColor = new Color(0xffffff);
  private readonly wornColors: Record<StructurePartMaterial, Color> = {
    wood: new Color(0xd19a70),
    woodAlt: new Color(0xc88f68),
    darkWood: new Color(0xb77a60),
    rope: new Color(0xc29a67),
    metal: new Color(0xa99582),
    fiber: new Color(0xa7a568),
  };
  private readonly criticalColors: Record<StructurePartMaterial, Color> = {
    wood: new Color(0xc07a5c),
    woodAlt: new Color(0xb86f54),
    darkWood: new Color(0xa56350),
    rope: new Color(0xb48a5c),
    metal: new Color(0x9e9082),
    fiber: new Color(0x95965c),
  };
  private readonly instanceColor = new Color();
  private readonly bounds = new Box3();
  private readonly hit = new Vector3();
  private readonly localOrigin = new Vector3();
  private readonly localDirection = new Vector3();
  private readonly cameraForward = new Vector3();
  private readonly inverseRaftRotation = new Quaternion();
  private readonly ray = new Ray();
  private inputEnabled = false;
  private focusedDoorId: string | null = null;
  private nextSequence = 1;
  private revision = 0;

  constructor(
    private readonly raft: RaftSystem,
    materials: MaterialLibrary,
    savedStructures: readonly SavedRaftStructure[] = [],
    private readonly onDoorToggled: (open: boolean) => void = () => undefined,
  ) {
    this.group.name = 'raft-structures';
    this.createBuckets(materials);
    for (const structure of savedStructures.slice(0, MAX_RAFT_STRUCTURES)) {
      this.structures.set(structure.id, { ...structure });
      const suffix = Number.parseInt(structure.id.split('-').at(-1) ?? '', 36);
      if (Number.isFinite(suffix)) this.nextSequence = Math.max(this.nextSequence, suffix + 1);
    }
    this.raft.group.add(this.group);
    window.addEventListener('keydown', this.onKeyDown);
    this.rebuildInstances();
  }

  get count(): number {
    return this.structures.size;
  }

  get currentRevision(): number {
    return this.revision;
  }

  getSavedStructures(): SavedRaftStructure[] {
    return [...this.structures.values()].map((structure) => ({ ...structure }));
  }

  getWalkableSurfaces(position: Pick<Vector3, 'x' | 'z'>): RaftWalkableSurface[] {
    return sampleRaftWalkableSurfaces(
      [...this.structures.values()],
      this.raft.getTiles(),
      position.x,
      position.z,
    );
  }

  getOverheadSurfaces(position: Pick<Vector3, 'x' | 'z'>): RaftOverheadSurface[] {
    return sampleRaftOverheadSurfaces(
      [...this.structures.values()],
      position.x,
      position.z,
    );
  }

  getDiagnostics(): {
    focusedDoor: string | null;
    openDoors: number;
    structures: number;
    damaged: number;
    critical: number;
    lowestHealthRatio: number;
  } {
    const structures = [...this.structures.values()];
    return {
      focusedDoor: this.focusedDoorId,
      openDoors: structures.filter((structure) => structure.type === 'door' && structure.open).length,
      structures: structures.length,
      damaged: structures.filter((structure) => raftStructureDamageStage(structure) !== 'intact').length,
      critical: structures.filter((structure) => raftStructureDamageStage(structure) === 'critical').length,
      lowestHealthRatio: structures.reduce(
        (lowest, structure) => Math.min(lowest, raftStructureHealthRatio(structure)),
        1,
      ),
    };
  }

  getDoorAimDiagnostics(camera: PerspectiveCamera): {
    camera: [number, number, number];
    forward: [number, number, number];
    closestDoor: { id: string; center: [number, number, number]; distance: number } | null;
  } {
    camera.getWorldDirection(this.cameraForward);
    this.inverseRaftRotation.copy(this.raft.group.quaternion).invert();
    this.localOrigin.copy(camera.position).sub(this.raft.group.position).applyQuaternion(this.inverseRaftRotation);
    this.localDirection.copy(this.cameraForward).applyQuaternion(this.inverseRaftRotation).normalize();
    let closestDoor: { id: string; center: [number, number, number]; distance: number } | null = null;
    for (const structure of this.structures.values()) {
      if (structure.type !== 'door') continue;
      this.setBaseTransform(structure);
      this.hit.copy(this.basePosition);
      this.hit.y += RAFT_STRUCTURE_LEVEL_HEIGHT * 0.48;
      const distance = this.hit.distanceTo(this.localOrigin);
      if (!closestDoor || distance < closestDoor.distance) {
        closestDoor = {
          id: structure.id,
          center: [this.hit.x, this.hit.y, this.hit.z],
          distance,
        };
      }
    }
    return {
      camera: [this.localOrigin.x, this.localOrigin.y, this.localOrigin.z],
      forward: [this.localDirection.x, this.localDirection.y, this.localDirection.z],
      closestDoor,
    };
  }

  getStructure(id: string): SavedRaftStructure | null {
    const structure = this.structures.get(id);
    return structure ? { ...structure } : null;
  }

  findSharkTarget(
    edgeFoundations: readonly GridCoordinate[],
    fromRaftX: number,
    fromRaftZ: number,
  ): SavedRaftStructure | null {
    return selectSharkAttackStructure(
      [...this.structures.values()],
      edgeFoundations,
      fromRaftX,
      fromRaftZ,
    );
  }

  setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;
    if (!enabled) this.clearDoorFocus();
  }

  updateDoorFocus(camera: PerspectiveCamera): void {
    if (!this.inputEnabled) return;
    camera.getWorldDirection(this.cameraForward);
    this.inverseRaftRotation.copy(this.raft.group.quaternion).invert();
    this.localOrigin.copy(camera.position).sub(this.raft.group.position).applyQuaternion(this.inverseRaftRotation);
    this.localDirection.copy(this.cameraForward).applyQuaternion(this.inverseRaftRotation).normalize();
    this.ray.set(this.localOrigin, this.localDirection);
    const target = this.findRayTarget(this.ray, 3.35);
    const nextDoor = target?.type === 'door' ? target.id : null;
    if (nextDoor === this.focusedDoorId) {
      if (nextDoor) {
        const door = this.structures.get(nextDoor)!;
        const prompt = door.open ? '合上绳铰板门' : '开启绳铰板门';
        const state = useGameStore.getState();
        if (state.interaction !== prompt || state.interactionOwner !== 'build') state.setInteraction(prompt, 'build');
      }
      return;
    }
    this.focusedDoorId = nextDoor;
    if (!nextDoor) {
      useGameStore.getState().setInteraction(null, 'build');
      return;
    }
    const door = this.structures.get(nextDoor)!;
    useGameStore.getState().setInteraction(door.open ? '合上绳铰板门' : '开启绳铰板门', 'build');
  }

  createCandidate(candidate: StructurePlacementCandidate, id = 'preview'): SavedRaftStructure {
    const definition = RAFT_STRUCTURE_DEFINITIONS[candidate.type];
    return {
      id,
      type: candidate.type,
      x: Math.round(candidate.x),
      z: Math.round(candidate.z),
      level: Math.round(candidate.level),
      rotation: normalizeRaftRotation(candidate.rotation),
      health: definition.maxHealth,
      ...(candidate.type === 'door' ? { open: false } : {}),
    };
  }

  canPlace(candidate: StructurePlacementCandidate): StructurePlacementReason {
    return canPlaceRaftStructure(
      [...this.structures.values()],
      this.raft.getTiles(),
      this.createCandidate(candidate),
    );
  }

  place(candidate: StructurePlacementCandidate): SavedRaftStructure | null {
    const id = this.nextId();
    const structure = this.createCandidate(candidate, id);
    if (canPlaceRaftStructure([...this.structures.values()], this.raft.getTiles(), structure) !== 'valid') return null;
    this.structures.set(id, structure);
    this.rebuildInstances();
    return { ...structure };
  }

  canReplace(id: string, candidate: StructurePlacementCandidate): StructureReplacementReason {
    const replaced = this.structures.get(id);
    if (!replaced) return 'not-found';
    const next = this.createCandidate(candidate, id);
    return canReplaceRaftStructure(
      [...this.structures.values()],
      this.raft.getTiles(),
      id,
      next,
    );
  }

  replace(id: string, candidate: StructurePlacementCandidate): StructureReplacementResult {
    const previous = this.structures.get(id);
    if (!previous) return { replaced: null, previous: null, reason: 'not-found' };
    const next = this.createCandidate(candidate, id);
    const reason = canReplaceRaftStructure(
      [...this.structures.values()],
      this.raft.getTiles(),
      id,
      next,
    );
    if (reason !== 'valid') return { replaced: null, previous: { ...previous }, reason };
    this.structures.set(id, next);
    if (this.focusedDoorId === id) this.clearDoorFocus();
    this.rebuildInstances();
    return { replaced: { ...next }, previous: { ...previous }, reason };
  }

  remove(id: string): StructureRemovalResult {
    const structures = [...this.structures.values()];
    const structure = this.structures.get(id);
    if (!structure) return { removed: null, blocked: false };
    if (!canRemoveRaftStructure(structures, this.raft.getTiles(), id)) return { removed: null, blocked: true };
    this.structures.delete(id);
    if (this.focusedDoorId === id) this.clearDoorFocus();
    this.rebuildInstances();
    return { removed: { ...structure }, blocked: false };
  }

  damage(id: string, amount: number): StructureDamageResult {
    const structure = this.structures.get(id);
    const requested = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
    if (!structure || requested <= 0) {
      return {
        changed: false,
        destroyed: false,
        structure: structure ? { ...structure } : null,
        removed: [],
        damageTaken: 0,
      };
    }
    const damageTaken = Math.min(structure.health, requested);
    structure.health = Math.max(0, structure.health - requested);
    if (structure.health > 0) {
      this.rebuildInstances();
      return {
        changed: true,
        destroyed: false,
        structure: { ...structure },
        removed: [],
        damageTaken,
      };
    }

    const destroyed = { ...structure, health: 0 };
    this.structures.delete(id);
    const unsupported = pruneUnsupportedRaftStructures([...this.structures.values()], this.raft.getTiles());
    this.structures.clear();
    for (const kept of unsupported.kept) this.structures.set(kept.id, kept);
    const removed = [destroyed, ...unsupported.removed];
    if (this.focusedDoorId && removed.some((entry) => entry.id === this.focusedDoorId)) this.clearDoorFocus();
    this.rebuildInstances();
    return {
      changed: true,
      destroyed: true,
      structure: null,
      removed: removed.map((entry) => ({ ...entry })),
      damageTaken,
    };
  }

  repair(id: string, amount: number): StructureRepairResult {
    const structure = this.structures.get(id);
    const requested = Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0;
    if (!structure || requested <= 0) return { changed: false, structure: structure ? { ...structure } : null, repaired: 0 };
    const maximum = RAFT_STRUCTURE_DEFINITIONS[structure.type].maxHealth;
    if (structure.health >= maximum) return { changed: false, structure: { ...structure }, repaired: 0 };
    const before = structure.health;
    structure.health = Math.min(maximum, structure.health + requested);
    this.rebuildInstances();
    return { changed: true, structure: { ...structure }, repaired: structure.health - before };
  }

  canRemoveFoundation(coordinate: GridCoordinate): boolean {
    return canRemoveFoundationUnderStructures(
      [...this.structures.values()],
      this.raft.getTiles(),
      coordinate,
    );
  }

  handleFoundationLoss(): SavedRaftStructure[] {
    const result = pruneUnsupportedRaftStructures([...this.structures.values()], this.raft.getTiles());
    if (result.removed.length === 0) return [];
    this.structures.clear();
    for (const structure of result.kept) this.structures.set(structure.id, structure);
    if (this.focusedDoorId && !this.structures.has(this.focusedDoorId)) this.clearDoorFocus();
    this.rebuildInstances();
    return result.removed.map((structure) => ({ ...structure }));
  }

  findRayTarget(ray: Ray, maximumDistance: number): SavedRaftStructure | null {
    let closest: SavedRaftStructure | null = null;
    let closestDistance = maximumDistance;
    for (const structure of this.structures.values()) {
      this.getBounds(structure, this.bounds);
      const intersection = ray.intersectBox(this.bounds, this.hit);
      if (!intersection) continue;
      const distance = intersection.distanceTo(ray.origin);
      if (distance >= closestDistance) continue;
      closestDistance = distance;
      closest = structure;
    }
    return closest ? { ...closest } : null;
  }

  positionObject(object: Object3D, structure: Pick<SavedRaftStructure, 'type' | 'x' | 'z' | 'level' | 'rotation'>): void {
    this.setBaseTransform(structure);
    object.position.copy(this.basePosition);
    object.quaternion.copy(this.baseQuaternion);
  }

  getLocalImpactPosition(
    structure: Pick<SavedRaftStructure, 'type' | 'x' | 'z' | 'level' | 'rotation'>,
    target: Vector3,
  ): Vector3 {
    this.setBaseTransform(structure);
    target.copy(this.basePosition);
    if (structure.type === 'wall' || structure.type === 'door' || structure.type === 'pillar' || structure.type === 'stairs') {
      target.y += RAFT_STRUCTURE_LEVEL_HEIGHT * 0.48;
    } else {
      target.y += 0.12;
    }
    return target;
  }

  resolvePlayerCollision(position: Vector3, previous: Vector3, footHeight = 0): void {
    for (const structure of this.structures.values()) {
      const base = structure.level * RAFT_STRUCTURE_LEVEL_HEIGHT;
      if (footHeight >= base + RAFT_STRUCTURE_LEVEL_HEIGHT - 0.08 || footHeight + PLAYER_BODY_HEIGHT <= base + 0.08) {
        continue;
      }
      if (structure.type === 'wall' || (structure.type === 'door' && !structure.open)) {
        this.resolveWallCollision(structure, position, previous);
      } else if (structure.type === 'pillar') {
        const centerX = structure.x * RAFT_TILE_X;
        const centerZ = structure.z * RAFT_TILE_Z;
        const dx = position.x - centerX;
        const dz = position.z - centerZ;
        const minimum = PLAYER_RADIUS + 0.17;
        const distanceSquared = dx * dx + dz * dz;
        if (distanceSquared >= minimum * minimum) continue;
        if (distanceSquared < 1e-8) {
          position.x = previous.x;
          position.z = previous.z;
        } else {
          const scale = minimum / Math.sqrt(distanceSquared);
          position.x = centerX + dx * scale;
          position.z = centerZ + dz * scale;
        }
      }
    }
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    this.clearDoorFocus();
    this.raft.group.remove(this.group);
    this.boxGeometry.dispose();
    this.cylinderGeometry.dispose();
    this.buckets.clear();
    this.structures.clear();
  }

  private createBuckets(materials: MaterialLibrary): void {
    const materialMap: Record<StructurePartMaterial, MeshStandardMaterial> = {
      wood: materials.wood[0],
      woodAlt: materials.wood[1] ?? materials.wood[0],
      darkWood: materials.darkWood,
      rope: materials.rope,
      metal: materials.rustMetal,
      fiber: materials.wovenFiber,
    };
    const keys = new Set<BucketKey>();
    for (const type of Object.keys(RAFT_STRUCTURE_DEFINITIONS) as RaftStructureType[]) {
      for (const part of [...createRaftStructureParts(type, false), ...createRaftStructureParts(type, true)]) {
        keys.add(bucketKey(part));
      }
    }
    for (const key of keys) {
      const [geometryName, materialName] = key.split(':') as [StructurePartGeometry, StructurePartMaterial];
      const geometry = geometryName === 'box' ? this.boxGeometry : this.cylinderGeometry;
      const mesh = new InstancedMesh(geometry, materialMap[materialName], MAX_PARTS_PER_BUCKET);
      mesh.name = `raft-structure-${key}`;
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.count = 0;
      this.buckets.set(key, { mesh, count: 0 });
      this.group.add(mesh);
    }
  }

  private rebuildInstances(): void {
    for (const bucket of this.buckets.values()) bucket.count = 0;
    const structures = [...this.structures.values()].sort(
      (a, b) => a.level - b.level || a.z - b.z || a.x - b.x || a.id.localeCompare(b.id),
    );
    for (const structure of structures) {
      this.setBaseTransform(structure);
      this.baseMatrix.compose(this.basePosition, this.baseQuaternion, this.unitScale);
      const definition = RAFT_STRUCTURE_DEFINITIONS[structure.type];
      const healthRatio = Math.max(0, Math.min(1, structure.health / definition.maxHealth));
      const damageStage = raftStructureDamageStage(structure);
      const variation = ((hashText(structure.id) % 9) - 4) * 0.008;
      let partIndex = 0;
      for (const part of createRaftStructureParts(structure.type, structure.open === true)) {
        const bucket = this.buckets.get(bucketKey(part));
        if (!bucket || bucket.count >= MAX_PARTS_PER_BUCKET) continue;
        this.partPosition.fromArray(part.position);
        this.partScale.fromArray(part.scale);
        this.partEuler.set(
          part.rotation?.[0] ?? 0,
          part.rotation?.[1] ?? 0,
          part.rotation?.[2] ?? 0,
        );
        this.applyDamagePresentation(structure, part, partIndex, healthRatio, damageStage, variation);
        this.partQuaternion.setFromEuler(this.partEuler);
        this.partMatrix.compose(this.partPosition, this.partQuaternion, this.partScale);
        this.worldMatrix.multiplyMatrices(this.baseMatrix, this.partMatrix);
        bucket.mesh.setMatrixAt(bucket.count, this.worldMatrix);
        bucket.mesh.setColorAt(bucket.count, this.instanceColor);
        bucket.count += 1;
        partIndex += 1;
      }
    }
    for (const bucket of this.buckets.values()) {
      bucket.mesh.count = bucket.count;
      bucket.mesh.instanceMatrix.needsUpdate = true;
      if (bucket.mesh.instanceColor) bucket.mesh.instanceColor.needsUpdate = true;
      bucket.mesh.computeBoundingSphere();
    }
    this.revision += 1;
  }

  private applyDamagePresentation(
    structure: SavedRaftStructure,
    part: StructurePart,
    partIndex: number,
    healthRatio: number,
    stage: RaftStructureDamageStage,
    variation: number,
  ): void {
    if (stage === 'intact') {
      this.instanceColor.copy(this.healthyColor).offsetHSL(variation, 0, variation);
      return;
    }
    const target = stage === 'critical' ? this.criticalColors[part.material] : this.wornColors[part.material];
    const recovery = stage === 'critical'
      ? Math.max(0, Math.min(0.18, healthRatio * 0.34))
      : Math.max(0, Math.min(0.3, (healthRatio - 0.5) * 1.08));
    this.instanceColor.copy(target).lerp(this.healthyColor, recovery).offsetHSL(variation, 0, variation);

    const seed = hashText(`${structure.id}:${partIndex}`);
    const damage = 1 - healthRatio;
    const lateral = ((seed & 15) / 15 - 0.5) * damage;
    const depth = (((seed >>> 4) & 15) / 15 - 0.5) * damage;
    this.partPosition.x += lateral * 0.065;
    this.partPosition.z += depth * 0.055;
    this.partPosition.y -= damage * (structure.type === 'floor' || structure.type === 'roof' ? 0.045 : 0.018);
    this.partEuler.z += lateral * 0.085;
    this.partEuler.x += depth * 0.045;
    if (stage === 'critical' && seed % 13 === 0 && part.material !== 'metal') {
      this.partScale.y *= 0.76;
      this.partPosition.y -= 0.028;
    }
  }

  private setBaseTransform(structure: Pick<SavedRaftStructure, 'type' | 'x' | 'z' | 'level' | 'rotation'>): void {
    const yaw = (structure.type === 'stairs' ? -structure.rotation : structure.rotation) * Math.PI / 2;
    let x = structure.x * RAFT_TILE_X;
    let z = structure.z * RAFT_TILE_Z;
    if (structure.type === 'wall' || structure.type === 'door') {
      if (structure.rotation === 0) z -= RAFT_TILE_Z * 0.5;
      else if (structure.rotation === 1) x += RAFT_TILE_X * 0.5;
      else if (structure.rotation === 2) z += RAFT_TILE_Z * 0.5;
      else x -= RAFT_TILE_X * 0.5;
    }
    this.basePosition.set(x, structure.level * RAFT_STRUCTURE_LEVEL_HEIGHT, z);
    this.baseQuaternion.setFromAxisAngle(this.up, yaw);
  }

  private getBounds(structure: SavedRaftStructure, target: Box3): Box3 {
    this.setBaseTransform(structure);
    const y = this.basePosition.y;
    if (structure.type === 'wall' || structure.type === 'door') {
      const horizontal = structure.rotation % 2 === 0;
      const halfX = horizontal ? RAFT_TILE_X * 0.5 : 0.13;
      const halfZ = horizontal ? 0.13 : RAFT_TILE_Z * 0.5;
      return target.set(
        new Vector3(this.basePosition.x - halfX, y, this.basePosition.z - halfZ),
        new Vector3(this.basePosition.x + halfX, y + RAFT_STRUCTURE_LEVEL_HEIGHT, this.basePosition.z + halfZ),
      );
    }
    if (structure.type === 'pillar') {
      return target.set(
        new Vector3(this.basePosition.x - 0.28, y, this.basePosition.z - 0.28),
        new Vector3(this.basePosition.x + 0.28, y + RAFT_STRUCTURE_LEVEL_HEIGHT, this.basePosition.z + 0.28),
      );
    }
    if (structure.type === 'stairs') {
      const alongZ = structure.rotation % 2 === 0;
      const halfX = alongZ ? RAFT_TILE_X * 0.43 : RAFT_TILE_X * 0.54;
      const halfZ = alongZ ? RAFT_TILE_Z * 0.54 : RAFT_TILE_Z * 0.43;
      return target.set(
        new Vector3(this.basePosition.x - halfX, y, this.basePosition.z - halfZ),
        new Vector3(this.basePosition.x + halfX, y + RAFT_STRUCTURE_LEVEL_HEIGHT, this.basePosition.z + halfZ),
      );
    }
    const roofHeight = structure.type === 'roof' ? 0.48 : 0.18;
    return target.set(
      new Vector3(this.basePosition.x - RAFT_TILE_X * 0.5, y - 0.12, this.basePosition.z - RAFT_TILE_Z * 0.5),
      new Vector3(this.basePosition.x + RAFT_TILE_X * 0.5, y + roofHeight, this.basePosition.z + RAFT_TILE_Z * 0.5),
    );
  }

  private resolveWallCollision(structure: SavedRaftStructure, position: Vector3, previous: Vector3): void {
    this.setBaseTransform(structure);
    const clearance = WALL_HALF_THICKNESS + PLAYER_RADIUS;
    if (structure.rotation % 2 === 0) {
      if (Math.abs(position.x - this.basePosition.x) > RAFT_TILE_X * 0.5 + PLAYER_RADIUS) return;
      if (Math.abs(position.z - this.basePosition.z) >= clearance) return;
      const side = Math.sign(previous.z - this.basePosition.z) || Math.sign(position.z - this.basePosition.z) || 1;
      position.z = this.basePosition.z + side * clearance;
    } else {
      if (Math.abs(position.z - this.basePosition.z) > RAFT_TILE_Z * 0.5 + PLAYER_RADIUS) return;
      if (Math.abs(position.x - this.basePosition.x) >= clearance) return;
      const side = Math.sign(previous.x - this.basePosition.x) || Math.sign(position.x - this.basePosition.x) || 1;
      position.x = this.basePosition.x + side * clearance;
    }
  }

  private clearDoorFocus(): void {
    this.focusedDoorId = null;
    useGameStore.getState().setInteraction(null, 'build');
  }

  private toggleFocusedDoor(): void {
    if (!this.focusedDoorId) return;
    const door = this.structures.get(this.focusedDoorId);
    if (!door || door.type !== 'door') return;
    door.open = !door.open;
    this.rebuildInstances();
    useGameStore.getState().setInteraction(door.open ? '合上绳铰板门' : '开启绳铰板门', 'build');
    useGameStore.getState().showNotice(door.open ? '板门已开启' : '板门已合拢');
    this.onDoorToggled(door.open);
  }

  private nextId(): string {
    let id = '';
    do {
      id = `structure-${this.nextSequence.toString(36)}`;
      this.nextSequence += 1;
    } while (this.structures.has(id));
    return id;
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (
      !this.inputEnabled
      || event.repeat
      || event.code !== 'KeyE'
      || !this.focusedDoorId
      || useGameStore.getState().interactionOwner !== 'build'
    ) return;
    event.preventDefault();
    this.toggleFocusedDoor();
  };
}
