import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  DynamicDrawUsage,
  Euler,
  Group,
  InstancedMesh,
  MathUtils,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { SavedRaftTile } from '../domain/save';
import type { MaterialLibrary } from '../art/Materials';
import { sampleWave } from '../math/waves';

export const RAFT_TILE_X = 1.44;
export const RAFT_TILE_Z = 1.38;
export const RAFT_TILE_MAX_HEALTH = 100;
const MAX_TILES = 81;

export interface RaftTileState extends SavedRaftTile {
  health: number;
}

export interface GridCoordinate {
  x: number;
  z: number;
}

export interface RaftMutation {
  changed: boolean;
  destroyed: boolean;
  tile: RaftTileState | null;
}

function tileKey(x: number, z: number): string {
  return `${x}:${z}`;
}

function tileVariant(x: number, z: number): number {
  return Math.abs((x * 92821 + z * 68917 + 41) | 0);
}

export class RaftSystem {
  readonly group = new Group();
  private readonly tiles = new Map<string, RaftTileState>();
  private readonly targetQuaternion = new Quaternion();
  private readonly targetEuler = new Euler();
  private readonly plankMeshes: InstancedMesh[];
  private readonly beams: InstancedMesh;
  private readonly nails: InstancedMesh;
  private readonly matrix = new Matrix4();
  private readonly position = new Vector3();
  private readonly rotation = new Quaternion();
  private readonly scale = new Vector3(1, 1, 1);
  private readonly euler = new Euler();
  private readonly healthyColor = new Color(0xffffff);
  private readonly damagedColor = new Color(0xc7745d);
  private readonly tempColor = new Color();
  private revision = 0;

  constructor(materials: MaterialLibrary, savedTiles: readonly SavedRaftTile[]) {
    this.group.name = 'player-raft';
    const plankGeometry = new RoundedBoxGeometry(1.36, 0.16, 0.42, 3, 0.035);
    const beamGeometry = new BoxGeometry(1.45, 0.1, 0.085);
    const nailGeometry = new CylinderGeometry(0.025, 0.03, 0.02, 7);
    this.plankMeshes = materials.wood.map(
      (material) => new InstancedMesh(plankGeometry, material, MAX_TILES * 3),
    );
    this.beams = new InstancedMesh(beamGeometry, materials.darkWood, MAX_TILES * 2);
    this.nails = new InstancedMesh(nailGeometry, materials.rustMetal, MAX_TILES * 4);
    for (const mesh of [...this.plankMeshes, this.beams, this.nails]) {
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }
    for (const tile of savedTiles.slice(0, MAX_TILES)) {
      const x = Math.round(tile.x);
      const z = Math.round(tile.z);
      this.tiles.set(tileKey(x, z), {
        x,
        z,
        health: MathUtils.clamp(tile.health, 1, RAFT_TILE_MAX_HEALTH),
      });
    }
    this.rebuildInstances();
  }

  get tileCount(): number {
    return this.tiles.size;
  }

  get currentRevision(): number {
    return this.revision;
  }

  update(time: number, delta: number): void {
    const wave = sampleWave(this.group.position.x, this.group.position.z, time);
    const targetY = wave.height + 0.08;
    this.group.position.y = MathUtils.damp(this.group.position.y, targetY, 5.8, delta);

    this.targetEuler.set(wave.slopeZ * 0.33, 0, -wave.slopeX * 0.32, 'YXZ');
    this.targetQuaternion.setFromEuler(this.targetEuler);
    this.group.quaternion.slerp(this.targetQuaternion, 1 - Math.exp(-delta * 3.4));
    this.group.updateMatrixWorld();
  }

  localPointToWorld(point: Vector3, target = new Vector3()): Vector3 {
    return target.copy(point).applyQuaternion(this.group.quaternion).add(this.group.position);
  }

  worldPointToLocal(point: Vector3, target = new Vector3()): Vector3 {
    return target.copy(point).sub(this.group.position).applyQuaternion(this.group.quaternion.clone().invert());
  }

  gridToLocal(coordinate: GridCoordinate, target = new Vector3()): Vector3 {
    return target.set(coordinate.x * RAFT_TILE_X, 0, coordinate.z * RAFT_TILE_Z);
  }

  localToGrid(point: Vector3): GridCoordinate {
    return { x: Math.round(point.x / RAFT_TILE_X), z: Math.round(point.z / RAFT_TILE_Z) };
  }

  hasTile(coordinate: GridCoordinate): boolean {
    return this.tiles.has(tileKey(coordinate.x, coordinate.z));
  }

  getTile(coordinate: GridCoordinate): RaftTileState | null {
    return this.tiles.get(tileKey(coordinate.x, coordinate.z)) ?? null;
  }

  getTiles(): RaftTileState[] {
    return [...this.tiles.values()].map((tile) => ({ ...tile }));
  }

  getSavedTiles(): SavedRaftTile[] {
    return this.getTiles().map(({ x, z, health }) => ({ x, z, health: Math.round(health) }));
  }

  canAddTile(coordinate: GridCoordinate): boolean {
    if (this.tiles.size >= MAX_TILES || this.hasTile(coordinate)) return false;
    if (Math.abs(coordinate.x) > 8 || Math.abs(coordinate.z) > 8) return false;
    return [
      [coordinate.x + 1, coordinate.z],
      [coordinate.x - 1, coordinate.z],
      [coordinate.x, coordinate.z + 1],
      [coordinate.x, coordinate.z - 1],
    ].some(([x, z]) => this.tiles.has(tileKey(x, z)));
  }

  addTile(coordinate: GridCoordinate): boolean {
    if (!this.canAddTile(coordinate)) return false;
    this.tiles.set(tileKey(coordinate.x, coordinate.z), {
      x: coordinate.x,
      z: coordinate.z,
      health: RAFT_TILE_MAX_HEALTH,
    });
    this.rebuildInstances();
    return true;
  }

  canRemoveTile(coordinate: GridCoordinate): boolean {
    const keyToRemove = tileKey(coordinate.x, coordinate.z);
    if (!this.tiles.has(keyToRemove) || this.tiles.size <= 1) return false;
    const remainingKeys = [...this.tiles.keys()].filter((key) => key !== keyToRemove);
    const visited = new Set<string>();
    const queue = [remainingKeys[0]];
    while (queue.length > 0) {
      const key = queue.shift()!;
      if (visited.has(key)) continue;
      visited.add(key);
      const [x, z] = key.split(':').map(Number);
      for (const [neighborX, neighborZ] of [
        [x + 1, z],
        [x - 1, z],
        [x, z + 1],
        [x, z - 1],
      ]) {
        const neighborKey = tileKey(neighborX, neighborZ);
        if (neighborKey !== keyToRemove && this.tiles.has(neighborKey) && !visited.has(neighborKey)) {
          queue.push(neighborKey);
        }
      }
    }
    return visited.size === remainingKeys.length;
  }

  removeTile(coordinate: GridCoordinate): boolean {
    if (!this.canRemoveTile(coordinate)) return false;
    this.tiles.delete(tileKey(coordinate.x, coordinate.z));
    this.rebuildInstances();
    return true;
  }

  damageTile(coordinate: GridCoordinate, amount: number): RaftMutation {
    const tile = this.getTile(coordinate);
    if (!tile || amount <= 0) return { changed: false, destroyed: false, tile };
    tile.health = Math.max(this.tiles.size === 1 ? 1 : 0, tile.health - amount);
    const destroyed = tile.health <= 0;
    if (destroyed) this.tiles.delete(tileKey(tile.x, tile.z));
    this.rebuildInstances();
    return { changed: true, destroyed, tile: destroyed ? null : { ...tile } };
  }

  repairTile(coordinate: GridCoordinate, amount: number): RaftMutation {
    const tile = this.getTile(coordinate);
    if (!tile || tile.health >= RAFT_TILE_MAX_HEALTH || amount <= 0) {
      return { changed: false, destroyed: false, tile };
    }
    tile.health = Math.min(RAFT_TILE_MAX_HEALTH, tile.health + amount);
    this.rebuildInstances();
    return { changed: true, destroyed: false, tile: { ...tile } };
  }

  getEdgeTiles(): RaftTileState[] {
    return [...this.tiles.values()].filter((tile) =>
      [
        [tile.x + 1, tile.z],
        [tile.x - 1, tile.z],
        [tile.x, tile.z + 1],
        [tile.x, tile.z - 1],
      ].some(([x, z]) => !this.tiles.has(tileKey(x, z))),
    );
  }

  getClosestTile(point: Vector3): RaftTileState | null {
    let closest: RaftTileState | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (const tile of this.tiles.values()) {
      const distance = Math.hypot(point.x - tile.x * RAFT_TILE_X, point.z - tile.z * RAFT_TILE_Z);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = tile;
      }
    }
    return closest ? { ...closest } : null;
  }

  clampLocalPosition(position: Vector3): void {
    const coordinate = this.localToGrid(position);
    const candidate = this.getTile(coordinate) ?? this.getClosestTile(position);
    if (!candidate) return;
    const centerX = candidate.x * RAFT_TILE_X;
    const centerZ = candidate.z * RAFT_TILE_Z;
    position.x = MathUtils.clamp(position.x, centerX - RAFT_TILE_X * 0.52, centerX + RAFT_TILE_X * 0.52);
    position.z = MathUtils.clamp(position.z, centerZ - RAFT_TILE_Z * 0.52, centerZ + RAFT_TILE_Z * 0.52);
  }

  getIntegrityStats(): { tiles: number; damagedTiles: number; averageIntegrity: number } {
    if (this.tiles.size === 0) return { tiles: 0, damagedTiles: 0, averageIntegrity: 0 };
    let total = 0;
    let damagedTiles = 0;
    for (const tile of this.tiles.values()) {
      total += tile.health;
      if (tile.health < RAFT_TILE_MAX_HEALTH) damagedTiles += 1;
    }
    return {
      tiles: this.tiles.size,
      damagedTiles,
      averageIntegrity: Math.round(total / this.tiles.size),
    };
  }

  private rebuildInstances(): void {
    const plankCounts = this.plankMeshes.map(() => 0);
    let beamCount = 0;
    let nailCount = 0;

    const orderedTiles = [...this.tiles.values()].sort((a, b) => a.z - b.z || a.x - b.x);
    for (const tile of orderedTiles) {
      const variant = tileVariant(tile.x, tile.z);
      const materialIndex = variant % this.plankMeshes.length;
      const tileRotation = Math.sin(variant * 2.41) * 0.012;
      const healthRatio = tile.health / RAFT_TILE_MAX_HEALTH;
      this.tempColor.copy(this.damagedColor).lerp(this.healthyColor, healthRatio);

      for (let index = 0; index < 3; index += 1) {
        this.position.set(
          tile.x * RAFT_TILE_X,
          Math.sin(index * 2.1 + variant) * 0.014,
          tile.z * RAFT_TILE_Z + (index - 1) * 0.45,
        );
        this.euler.set(0, tileRotation + Math.sin(index * 3.7 + variant) * 0.018, 0);
        this.rotation.setFromEuler(this.euler);
        this.matrix.compose(this.position, this.rotation, this.scale);
        const indexInMesh = plankCounts[materialIndex];
        this.plankMeshes[materialIndex].setMatrixAt(indexInMesh, this.matrix);
        this.plankMeshes[materialIndex].setColorAt(indexInMesh, this.tempColor);
        plankCounts[materialIndex] += 1;
      }

      for (const offsetZ of [-0.46, 0.46]) {
        this.position.set(tile.x * RAFT_TILE_X, -0.12, tile.z * RAFT_TILE_Z + offsetZ);
        this.euler.set(0, tileRotation, 0);
        this.rotation.setFromEuler(this.euler);
        this.matrix.compose(this.position, this.rotation, this.scale);
        this.beams.setMatrixAt(beamCount, this.matrix);
        this.beams.setColorAt(beamCount, this.tempColor);
        beamCount += 1;
      }

      for (const offsetX of [-0.52, 0.52]) {
        for (const offsetZ of [-0.46, 0.46]) {
          this.position.set(tile.x * RAFT_TILE_X + offsetX, 0.09, tile.z * RAFT_TILE_Z + offsetZ);
          this.euler.set(0, tileRotation, 0);
          this.rotation.setFromEuler(this.euler);
          this.matrix.compose(this.position, this.rotation, this.scale);
          this.nails.setMatrixAt(nailCount, this.matrix);
          nailCount += 1;
        }
      }
    }

    this.plankMeshes.forEach((mesh, index) => {
      mesh.count = plankCounts[index];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    });
    this.beams.count = beamCount;
    this.beams.instanceMatrix.needsUpdate = true;
    if (this.beams.instanceColor) this.beams.instanceColor.needsUpdate = true;
    this.beams.computeBoundingSphere();
    this.nails.count = nailCount;
    this.nails.instanceMatrix.needsUpdate = true;
    this.nails.computeBoundingSphere();
    this.revision += 1;
  }
}
