import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Scene,
  Vector3,
  type MeshStandardMaterial,
} from 'three';
import type { MaterialLibrary } from '../art/Materials';
import {
  createRaftStructureParts,
  type StructurePart,
  type StructurePartGeometry,
  type StructurePartMaterial,
} from '../art/RaftStructureParts';
import { RAFT_STRUCTURE_DEFINITIONS, type SavedRaftStructure } from '../domain/raftStructures';
import { sampleWaveHeight } from '../math/waves';
import type { AudioSystem } from './AudioSystem';
import type { RaftSystem } from './RaftSystem';
import type { RaftStructureSystem } from './RaftStructureSystem';
import type { SplashSystem } from './SplashSystem';

const MAX_ACTIVE_COLLAPSES = 10;
const GRAVITY = 5.7;
const MINIMUM_WATER_DROP = 0.26;

type BucketKey = `${StructurePartGeometry}:${StructurePartMaterial}`;

interface CollapseBody {
  group: Group;
  velocity: Vector3;
  angularVelocity: Vector3;
  initialY: number;
  contactDepth: number;
  age: number;
  lifetime: number;
  splashed: boolean;
}

interface ActiveCollapse {
  id: string;
  type: SavedRaftStructure['type'];
  fibrous: boolean;
  delay: number;
  bodies: CollapseBody[];
  waterFeedbackPlayed: boolean;
}

export interface StructureCollapseDiagnostics {
  active: number;
  activeBodies: number;
  spawned: number;
  waterImpacts: number;
  retired: number;
  discarded: number;
  lastStructureId: string | null;
  lastStructureType: SavedRaftStructure['type'] | null;
}

function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function bucketKey(part: Pick<StructurePart, 'geometry' | 'material'>): BucketKey {
  return `${part.geometry}:${part.material}`;
}

function partChunk(structure: SavedRaftStructure, part: StructurePart, index: number): 0 | 1 {
  if (structure.type === 'pillar') return index % 2 === 0 ? 0 : 1;
  if (structure.type === 'stairs' && Math.abs(part.position[0]) < 0.2) return index % 2 === 0 ? 0 : 1;
  return part.position[0] < 0 ? 0 : 1;
}

function partWeight(part: StructurePart): number {
  return Math.max(0.0001, part.scale[0] * part.scale[1] * part.scale[2]);
}

function chunkPivot(parts: readonly StructurePart[], target: Vector3): Vector3 {
  target.set(0, 0, 0);
  let totalWeight = 0;
  for (const part of parts) {
    const weight = partWeight(part);
    target.x += part.position[0] * weight;
    target.y += part.position[1] * weight;
    target.z += part.position[2] * weight;
    totalWeight += weight;
  }
  return totalWeight > 0 ? target.divideScalar(totalWeight) : target;
}

function chunkContactDepth(parts: readonly StructurePart[], pivot: Vector3): number {
  let minimum = 0;
  for (const part of parts) {
    const bottom = part.position[1] - part.scale[1] * 0.5;
    minimum = Math.min(minimum, bottom - pivot.y);
  }
  return Math.max(0.08, Math.min(0.78, -minimum));
}

export class StructureCollapseSystem {
  private readonly active: ActiveCollapse[] = [];
  private readonly boxGeometry = new BoxGeometry(1, 1, 1);
  private readonly cylinderGeometry = new CylinderGeometry(0.5, 0.5, 1, 8);
  private readonly materialMap: Record<StructurePartMaterial, MeshStandardMaterial>;
  private readonly baseObject = new Group();
  private readonly localPosition = new Vector3();
  private readonly pivot = new Vector3();
  private readonly outward = new Vector3();
  private readonly tangent = new Vector3();
  private readonly worldQuaternion = new Quaternion();
  private readonly partPosition = new Vector3();
  private readonly partScale = new Vector3();
  private readonly partEuler = new Euler();
  private readonly partQuaternion = new Quaternion();
  private readonly partMatrix = new Matrix4();
  private readonly rotationStep = new Quaternion();
  private readonly impactPosition = new Vector3();
  private readonly intactTint = new Color(0xffffff);
  private readonly destroyedTint = new Color(0xc88568);
  private spawned = 0;
  private waterImpacts = 0;
  private retired = 0;
  private discarded = 0;
  private lastStructureId: string | null = null;
  private lastStructureType: SavedRaftStructure['type'] | null = null;

  constructor(
    private readonly scene: Scene,
    private readonly raft: RaftSystem,
    private readonly structures: RaftStructureSystem,
    materials: MaterialLibrary,
    private readonly splashes: SplashSystem,
    private readonly audio: AudioSystem,
    private readonly onWaterImpact: (strength: number) => void = () => undefined,
  ) {
    this.materialMap = {
      wood: materials.wood[0],
      woodAlt: materials.wood[1] ?? materials.wood[0],
      darkWood: materials.darkWood,
      rope: materials.rope,
      metal: materials.rustMetal,
      fiber: materials.wovenFiber,
    };
  }

  spawn(removed: readonly SavedRaftStructure[]): number {
    const selected = removed.slice(0, MAX_ACTIVE_COLLAPSES);
    let created = 0;
    this.discarded += Math.max(0, removed.length - selected.length);
    for (let index = 0; index < selected.length; index += 1) {
      while (this.active.length >= MAX_ACTIVE_COLLAPSES) this.retireAt(0);
      const structure = selected[index];
      const collapse = this.createCollapse(structure, Math.min(0.16, index * 0.035));
      if (!collapse) {
        this.discarded += 1;
        continue;
      }
      this.active.push(collapse);
      this.spawned += 1;
      created += 1;
      this.lastStructureId = structure.id;
      this.lastStructureType = structure.type;
    }
    return created;
  }

  update(time: number, delta: number): void {
    const step = Number.isFinite(delta) ? Math.max(0, Math.min(0.05, delta)) : 0;
    if (step <= 0) return;
    for (let collapseIndex = this.active.length - 1; collapseIndex >= 0; collapseIndex -= 1) {
      const collapse = this.active[collapseIndex];
      collapse.delay -= step;
      if (collapse.delay > 0) continue;
      let livingBodies = 0;
      for (const body of collapse.bodies) {
        if (!body.group.visible) continue;
        body.age += step;
        const waveHeight = sampleWaveHeight(body.group.position.x, body.group.position.z, time);
        if (body.splashed) {
          const drag = Math.exp(-1.45 * step);
          body.velocity.x *= drag;
          body.velocity.z *= drag;
          body.velocity.y += (-0.48 - body.velocity.y) * (1 - Math.exp(-1.8 * step));
          body.angularVelocity.multiplyScalar(Math.exp(-1.2 * step));
        } else {
          body.velocity.y -= GRAVITY * step;
        }
        body.group.position.addScaledVector(body.velocity, step);
        this.partEuler.set(
          body.angularVelocity.x * step,
          body.angularVelocity.y * step,
          body.angularVelocity.z * step,
        );
        this.rotationStep.setFromEuler(this.partEuler);
        body.group.quaternion.multiply(this.rotationStep).normalize();

        const dropped = body.initialY - body.group.position.y;
        if (
          !body.splashed
          && body.age >= 0.12
          && dropped >= MINIMUM_WATER_DROP
          && body.group.position.y - body.contactDepth <= waveHeight
        ) {
          body.splashed = true;
          body.group.position.y = Math.max(body.group.position.y, waveHeight + body.contactDepth * 0.34);
          body.velocity.x *= 0.56;
          body.velocity.z *= 0.56;
          body.velocity.y = Math.max(0.1, Math.abs(body.velocity.y) * 0.13);
          body.angularVelocity.multiplyScalar(0.52);
          if (!collapse.waterFeedbackPlayed) {
            collapse.waterFeedbackPlayed = true;
            this.impactPosition.set(body.group.position.x, waveHeight + 0.035, body.group.position.z);
            const strength = Math.min(1, 0.45 + collapse.bodies.length * 0.2);
            this.splashes.spawnStructureWaterImpact(this.impactPosition, collapse.fibrous, strength);
            this.audio.playStructureSplash(this.impactPosition, collapse.fibrous, strength);
            this.onWaterImpact(0.08 + strength * 0.12);
            this.waterImpacts += 1;
          }
        }

        const remaining = body.lifetime - body.age;
        const scale = remaining < 0.9 ? Math.max(0.68, 0.68 + remaining * 0.36) : 1;
        body.group.scale.setScalar(scale);
        if (body.age >= body.lifetime || body.group.position.y < waveHeight - 2.65) {
          body.group.visible = false;
          this.scene.remove(body.group);
        } else {
          livingBodies += 1;
        }
      }
      if (livingBodies === 0) this.retireAt(collapseIndex);
    }
  }

  getDiagnostics(): StructureCollapseDiagnostics {
    return {
      active: this.active.length,
      activeBodies: this.active.reduce(
        (total, collapse) => total + collapse.bodies.filter((body) => body.group.visible).length,
        0,
      ),
      spawned: this.spawned,
      waterImpacts: this.waterImpacts,
      retired: this.retired,
      discarded: this.discarded,
      lastStructureId: this.lastStructureId,
      lastStructureType: this.lastStructureType,
    };
  }

  dispose(): void {
    while (this.active.length > 0) this.retireAt(this.active.length - 1);
    this.boxGeometry.dispose();
    this.cylinderGeometry.dispose();
  }

  private createCollapse(structure: SavedRaftStructure, delay: number): ActiveCollapse | null {
    const parts = createRaftStructureParts(structure.type, structure.open === true);
    const chunks = [
      parts.filter((part, index) => partChunk(structure, part, index) === 0),
      parts.filter((part, index) => partChunk(structure, part, index) === 1),
    ].filter((chunk) => chunk.length > 0);
    this.structures.positionObject(this.baseObject, structure);
    this.worldQuaternion.multiplyQuaternions(this.raft.group.quaternion, this.baseObject.quaternion);

    this.outward.set(this.baseObject.position.x, 0, this.baseObject.position.z);
    const seed = hashText(structure.id);
    if (this.outward.lengthSq() < 0.08) {
      const angle = (seed / 0xffffffff) * Math.PI * 2;
      this.outward.set(Math.cos(angle), 0, Math.sin(angle));
    } else {
      this.outward.normalize();
    }
    this.outward.applyQuaternion(this.raft.group.quaternion);
    this.outward.y = 0;
    this.outward.normalize();
    this.tangent.set(-this.outward.z, 0, this.outward.x);

    const bodies = chunks.map((chunk, chunkIndex) => {
      chunkPivot(chunk, this.pivot);
      const body = this.createBody(structure, chunk, this.pivot, seed, chunkIndex);
      return body;
    });
    if (bodies.length === 0) return null;
    return {
      id: structure.id,
      type: structure.type,
      fibrous: structure.type === 'roof',
      delay,
      bodies,
      waterFeedbackPlayed: false,
    };
  }

  private createBody(
    structure: SavedRaftStructure,
    parts: readonly StructurePart[],
    pivot: Vector3,
    seed: number,
    chunkIndex: number,
  ): CollapseBody {
    const group = new Group();
    group.name = `structure-collapse-${structure.id}-${chunkIndex + 1}`;
    const buckets = new Map<BucketKey, StructurePart[]>();
    for (const part of parts) {
      const key = bucketKey(part);
      const entries = buckets.get(key) ?? [];
      entries.push(part);
      buckets.set(key, entries);
    }
    const healthRatio = Math.max(
      0,
      Math.min(1, structure.health / RAFT_STRUCTURE_DEFINITIONS[structure.type].maxHealth),
    );
    const tint = this.destroyedTint.clone().lerp(this.intactTint, healthRatio * 0.72);
    for (const [key, bucketParts] of buckets) {
      const [geometryName, materialName] = key.split(':') as [StructurePartGeometry, StructurePartMaterial];
      const geometry = geometryName === 'box' ? this.boxGeometry : this.cylinderGeometry;
      const mesh = new InstancedMesh(geometry, this.materialMap[materialName], bucketParts.length);
      mesh.name = `${group.name}-${key}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      bucketParts.forEach((part, partIndex) => {
        this.partPosition.set(
          part.position[0] - pivot.x,
          part.position[1] - pivot.y,
          part.position[2] - pivot.z,
        );
        this.partScale.fromArray(part.scale);
        this.partEuler.set(
          part.rotation?.[0] ?? 0,
          part.rotation?.[1] ?? 0,
          part.rotation?.[2] ?? 0,
        );
        this.partQuaternion.setFromEuler(this.partEuler);
        this.partMatrix.compose(this.partPosition, this.partQuaternion, this.partScale);
        mesh.setMatrixAt(partIndex, this.partMatrix);
        mesh.setColorAt(partIndex, tint);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      group.add(mesh);
    }

    this.localPosition.copy(pivot).applyQuaternion(this.baseObject.quaternion).add(this.baseObject.position);
    this.raft.localPointToWorld(this.localPosition, group.position);
    group.quaternion.copy(this.worldQuaternion);
    this.scene.add(group);

    const variation = ((seed >>> (chunkIndex * 5)) & 31) / 31;
    const side = chunkIndex === 0 ? -1 : 1;
    const velocity = this.outward.clone().multiplyScalar(0.46 + variation * 0.34);
    velocity.addScaledVector(this.tangent, side * (0.18 + variation * 0.16));
    velocity.y = 0.12 + variation * 0.22 + structure.level * 0.05;
    const angularVelocity = new Vector3(
      side * (1.15 + variation * 0.9),
      (variation - 0.5) * 1.5,
      -side * (0.85 + (1 - variation) * 0.75),
    );
    return {
      group,
      velocity,
      angularVelocity,
      initialY: group.position.y,
      contactDepth: chunkContactDepth(parts, pivot),
      age: 0,
      lifetime: 4.15 + variation * 0.8,
      splashed: false,
    };
  }

  private retireAt(index: number): void {
    const [collapse] = this.active.splice(index, 1);
    if (!collapse) return;
    for (const body of collapse.bodies) this.scene.remove(body.group);
    this.retired += 1;
  }
}
