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
  canRemoveFoundationUnderStructures,
  canRemoveRaftStructure,
  normalizeRaftRotation,
  pruneUnsupportedRaftStructures,
  type FoundationCoordinate,
  type RaftRotation,
  type RaftStructureType,
  type SavedRaftStructure,
  type StructurePlacementReason,
} from '../domain/raftStructures';
import { useGameStore } from '../../state/gameStore';
import { RAFT_TILE_X, RAFT_TILE_Z, type GridCoordinate, type RaftSystem } from './RaftSystem';

const MAX_PARTS_PER_BUCKET = MAX_RAFT_STRUCTURES * 24;
const PLAYER_RADIUS = 0.24;
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
  private readonly damagedColor = new Color(0xc76b57);
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

  getDiagnostics(): { focusedDoor: string | null; openDoors: number; structures: number } {
    return {
      focusedDoor: this.focusedDoorId,
      openDoors: [...this.structures.values()].filter((structure) => structure.type === 'door' && structure.open).length,
      structures: this.structures.size,
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

  resolvePlayerCollision(position: Vector3, previous: Vector3): void {
    for (const structure of this.structures.values()) {
      if (structure.level !== 0) continue;
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
      const variation = ((hashText(structure.id) % 9) - 4) * 0.008;
      this.instanceColor.copy(this.damagedColor).lerp(this.healthyColor, healthRatio).offsetHSL(variation, 0, variation);
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
        this.partQuaternion.setFromEuler(this.partEuler);
        this.partMatrix.compose(this.partPosition, this.partQuaternion, this.partScale);
        this.worldMatrix.multiplyMatrices(this.baseMatrix, this.partMatrix);
        bucket.mesh.setMatrixAt(bucket.count, this.worldMatrix);
        bucket.mesh.setColorAt(bucket.count, this.instanceColor);
        bucket.count += 1;
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

  private setBaseTransform(structure: Pick<SavedRaftStructure, 'type' | 'x' | 'z' | 'level' | 'rotation'>): void {
    const yaw = structure.rotation * Math.PI / 2;
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
      return target.set(
        new Vector3(this.basePosition.x - 0.62, y, this.basePosition.z - 0.66),
        new Vector3(this.basePosition.x + 0.62, y + RAFT_STRUCTURE_LEVEL_HEIGHT, this.basePosition.z + 0.66),
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
