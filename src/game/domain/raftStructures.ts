import type { ItemBundle } from './items';

export const RAFT_STRUCTURE_LEVEL_HEIGHT = 2.18;
export const RAFT_TILE_X = 1.44;
export const RAFT_TILE_Z = 1.38;
export const RAFT_MAX_STEP_UP = 0.36;
export const RAFT_MAX_STEP_DOWN = 0.42;
export const RAFT_FLOOR_UNDERSIDE_OFFSET = 0.115;
export const RAFT_ROOF_UNDERSIDE_OFFSET = 0.09;
export const MAX_RAFT_STRUCTURES = 96;
export const MAX_RAFT_STRUCTURE_LEVEL = 2;

export type RaftRotation = 0 | 1 | 2 | 3;
export type RaftStructureType = 'floor' | 'wall' | 'door' | 'pillar' | 'stairs' | 'roof';
export type RaftBuildPiece = 'foundation' | 'reinforcement' | RaftStructureType;
export type RaftStructureDamageStage = 'intact' | 'worn' | 'critical';
export type StructurePlacementReason =
  | 'valid'
  | 'occupied'
  | 'unsupported'
  | 'out-of-bounds'
  | 'invalid-level'
  | 'limit';

export interface FoundationCoordinate {
  x: number;
  z: number;
}

export interface SavedRaftStructure {
  id: string;
  type: RaftStructureType;
  x: number;
  z: number;
  level: number;
  rotation: RaftRotation;
  health: number;
  open?: boolean;
}

export interface RaftStructureDefinition {
  type: RaftStructureType;
  name: string;
  shortName: string;
  cost: ItemBundle;
  refund: ItemBundle;
  repairCost: ItemBundle;
  repairAmount: number;
  maxHealth: number;
}

export interface RaftBuildPieceDefinition {
  name: string;
  shortName: string;
  cost: ItemBundle;
}

export type RaftWalkableSurfaceType = 'foundation' | 'floor' | 'stairs' | 'roof';

export interface RaftWalkableSurface {
  height: number;
  type: RaftWalkableSurfaceType;
  structureId: string | null;
}

export type RaftOverheadSurfaceType = 'floor' | 'roof';

export interface RaftOverheadSurface {
  height: number;
  type: RaftOverheadSurfaceType;
  structureId: string;
}

export const RAFT_STRUCTURE_DEFINITIONS: Record<RaftStructureType, RaftStructureDefinition> = {
  floor: {
    type: 'floor',
    name: '上层拼板地面',
    shortName: '上层地板',
    cost: { timber: 3, rope: 1 },
    refund: { timber: 2 },
    repairCost: { timber: 1 },
    repairAmount: 36,
    maxHealth: 90,
  },
  wall: {
    type: 'wall',
    name: '交错承力木墙',
    shortName: '木墙',
    cost: { timber: 3, rope: 1 },
    refund: { timber: 2 },
    repairCost: { timber: 1 },
    repairAmount: 44,
    maxHealth: 110,
  },
  door: {
    type: 'door',
    name: '绳铰板门',
    shortName: '板门',
    cost: { timber: 3, rope: 2 },
    refund: { timber: 2, rope: 1 },
    repairCost: { timber: 1, rope: 1 },
    repairAmount: 38,
    maxHealth: 95,
  },
  pillar: {
    type: 'pillar',
    name: '盐封承重柱',
    shortName: '承重柱',
    cost: { timber: 2, rope: 1 },
    refund: { timber: 1 },
    repairCost: { timber: 1 },
    repairAmount: 50,
    maxHealth: 125,
  },
  stairs: {
    type: 'stairs',
    name: '双梁登层梯',
    shortName: '楼梯',
    cost: { timber: 4, rope: 2 },
    refund: { timber: 2, rope: 1 },
    repairCost: { timber: 1, rope: 1 },
    repairAmount: 40,
    maxHealth: 100,
  },
  roof: {
    type: 'roof',
    name: '编叶斜顶',
    shortName: '斜顶',
    cost: { timber: 2, fiber: 3, rope: 1 },
    refund: { timber: 1, fiber: 2 },
    repairCost: { fiber: 2 },
    repairAmount: 34,
    maxHealth: 80,
  },
};

export const RAFT_BUILD_PIECES: readonly RaftBuildPiece[] = [
  'foundation',
  'reinforcement',
  'wall',
  'door',
  'pillar',
  'stairs',
  'floor',
  'roof',
];

export const RAFT_BUILD_PIECE_DEFINITIONS: Record<RaftBuildPiece, RaftBuildPieceDefinition> = {
  foundation: {
    name: '基础漂木筏格',
    shortName: '基础筏格',
    cost: { timber: 2, polymer: 1 },
  },
  reinforcement: {
    name: '潮铸筏缘护甲',
    shortName: '筏缘护甲',
    cost: { metalIngot: 1, scrap: 2 },
  },
  floor: RAFT_STRUCTURE_DEFINITIONS.floor,
  wall: RAFT_STRUCTURE_DEFINITIONS.wall,
  door: RAFT_STRUCTURE_DEFINITIONS.door,
  pillar: RAFT_STRUCTURE_DEFINITIONS.pillar,
  stairs: RAFT_STRUCTURE_DEFINITIONS.stairs,
  roof: RAFT_STRUCTURE_DEFINITIONS.roof,
};

const STRUCTURE_TYPES = new Set<RaftStructureType>(['floor', 'wall', 'door', 'pillar', 'stairs', 'roof']);

function coordinateKey(x: number, z: number): string {
  return `${x}:${z}`;
}

function foundationKeys(foundations: readonly FoundationCoordinate[]): Set<string> {
  return new Set(foundations.map((foundation) => coordinateKey(foundation.x, foundation.z)));
}

export function raftStructureHealthRatio(
  structure: Pick<SavedRaftStructure, 'type' | 'health'>,
): number {
  const maximum = RAFT_STRUCTURE_DEFINITIONS[structure.type].maxHealth;
  return Math.max(0, Math.min(1, structure.health / maximum));
}

export function raftStructureDamageStage(
  structure: Pick<SavedRaftStructure, 'type' | 'health'>,
): RaftStructureDamageStage {
  const ratio = raftStructureHealthRatio(structure);
  if (ratio >= 0.78) return 'intact';
  if (ratio >= 0.5) return 'worn';
  return 'critical';
}

function structureAttackPoint(structure: SavedRaftStructure): FoundationCoordinate {
  let x = structure.x;
  let z = structure.z;
  if (structure.type === 'wall' || structure.type === 'door') {
    if (structure.rotation === 0) z -= 0.5;
    else if (structure.rotation === 1) x += 0.5;
    else if (structure.rotation === 2) z += 0.5;
    else x -= 0.5;
  }
  return { x, z };
}

export function selectSharkAttackStructure(
  structures: readonly SavedRaftStructure[],
  edgeFoundations: readonly FoundationCoordinate[],
  fromRaftX: number,
  fromRaftZ: number,
): SavedRaftStructure | null {
  const edges = foundationKeys(edgeFoundations);
  const length = Math.hypot(fromRaftX, fromRaftZ) || 1;
  const directionX = fromRaftX / length;
  const directionZ = fromRaftZ / length;
  let selected: SavedRaftStructure | null = null;
  let selectedScore = Number.NEGATIVE_INFINITY;
  for (const structure of structures) {
    if (!edges.has(coordinateKey(structure.x, structure.z))) continue;
    const maximumReachableLevel = structure.type === 'floor' || structure.type === 'roof' ? 1 : 0;
    if (structure.level > maximumReachableLevel) continue;
    const point = structureAttackPoint(structure);
    const surfacePenalty = structure.type === 'floor' || structure.type === 'roof' ? 0.12 : 0;
    const damagePreference = (1 - raftStructureHealthRatio(structure)) * 0.4;
    const score = point.x * directionX
      + point.z * directionZ
      - structure.level * 0.34
      - surfacePenalty
      + damagePreference;
    if (
      score > selectedScore + 1e-6
      || (Math.abs(score - selectedScore) <= 1e-6 && (!selected || structure.id.localeCompare(selected.id) < 0))
    ) {
      selected = structure;
      selectedScore = score;
    }
  }
  return selected ? { ...selected } : null;
}

function insideTile(
  pointX: number,
  pointZ: number,
  tileX: number,
  tileZ: number,
  margin = 0.04,
): boolean {
  return Math.abs(pointX - tileX * RAFT_TILE_X) <= RAFT_TILE_X * 0.5 + margin
    && Math.abs(pointZ - tileZ * RAFT_TILE_Z) <= RAFT_TILE_Z * 0.5 + margin;
}

function stairSurfaceHeight(
  structure: Pick<SavedRaftStructure, 'x' | 'z' | 'level' | 'rotation'>,
  pointX: number,
  pointZ: number,
): number | null {
  const dx = pointX - structure.x * RAFT_TILE_X;
  const dz = pointZ - structure.z * RAFT_TILE_Z;
  let run = 0;
  let cross = 0;
  let halfRun = RAFT_TILE_Z * 0.5;
  let halfCross = RAFT_TILE_X * 0.41;
  if (structure.rotation === 0) {
    run = -dz;
    cross = dx;
  } else if (structure.rotation === 1) {
    run = dx;
    cross = dz;
    halfRun = RAFT_TILE_X * 0.5;
    halfCross = RAFT_TILE_Z * 0.41;
  } else if (structure.rotation === 2) {
    run = dz;
    cross = dx;
  } else {
    run = -dx;
    cross = dz;
    halfRun = RAFT_TILE_X * 0.5;
    halfCross = RAFT_TILE_Z * 0.41;
  }
  if (Math.abs(cross) > halfCross + 0.04 || run < -halfRun - 0.04 || run > halfRun + 0.04) return null;
  const progress = Math.max(0, Math.min(1, (run + halfRun) / (halfRun * 2)));
  return structure.level * RAFT_STRUCTURE_LEVEL_HEIGHT + progress * RAFT_STRUCTURE_LEVEL_HEIGHT;
}

function roofSurfaceHeight(
  structure: Pick<SavedRaftStructure, 'x' | 'z' | 'level' | 'rotation'>,
  pointX: number,
  pointZ: number,
): number | null {
  const dx = pointX - structure.x * RAFT_TILE_X;
  const dz = pointZ - structure.z * RAFT_TILE_Z;
  const yaw = structure.rotation * Math.PI / 2;
  const cosine = Math.cos(yaw);
  const sine = Math.sin(yaw);
  const localX = dx * cosine - dz * sine;
  const localZ = dx * sine + dz * cosine;
  const halfX = RAFT_TILE_X * 0.5;
  const halfZ = RAFT_TILE_Z * 0.5;
  if (Math.abs(localX) > halfX + 0.04 || Math.abs(localZ) > halfZ + 0.04) return null;
  const ridge = 1 - Math.min(1, Math.abs(localX) / halfX);
  return structure.level * RAFT_STRUCTURE_LEVEL_HEIGHT + 0.08 + ridge * 0.23;
}

function insideStairOpening(
  structures: readonly SavedRaftStructure[],
  floor: Pick<SavedRaftStructure, 'x' | 'z' | 'level'>,
  pointX: number,
  pointZ: number,
): boolean {
  const centerX = floor.x * RAFT_TILE_X;
  const centerZ = floor.z * RAFT_TILE_Z;
  const dx = pointX - centerX;
  const dz = pointZ - centerZ;
  const openingDepth = 0.42;
  for (const structure of structures) {
    if (structure.type !== 'stairs' || structure.level + 1 !== floor.level) continue;
    const destination = stairDestination(structure);
    if (destination.x !== floor.x || destination.z !== floor.z) continue;
    if (structure.rotation === 0) {
      if (dz >= RAFT_TILE_Z * 0.5 - openingDepth && Math.abs(dx) <= RAFT_TILE_X * 0.41 + 0.04) return true;
    } else if (structure.rotation === 1) {
      if (dx <= -RAFT_TILE_X * 0.5 + openingDepth && Math.abs(dz) <= RAFT_TILE_Z * 0.41 + 0.04) return true;
    } else if (structure.rotation === 2) {
      if (dz <= -RAFT_TILE_Z * 0.5 + openingDepth && Math.abs(dx) <= RAFT_TILE_X * 0.41 + 0.04) return true;
    } else if (dx >= RAFT_TILE_X * 0.5 - openingDepth && Math.abs(dz) <= RAFT_TILE_Z * 0.41 + 0.04) {
      return true;
    }
  }
  return false;
}

export function sampleRaftOverheadSurfaces(
  structures: readonly SavedRaftStructure[],
  pointX: number,
  pointZ: number,
): RaftOverheadSurface[] {
  const surfaces: RaftOverheadSurface[] = [];
  for (const structure of structures) {
    if (structure.type === 'floor' && insideTile(pointX, pointZ, structure.x, structure.z)) {
      if (insideStairOpening(structures, structure, pointX, pointZ)) continue;
      surfaces.push({
        height: structure.level * RAFT_STRUCTURE_LEVEL_HEIGHT - RAFT_FLOOR_UNDERSIDE_OFFSET,
        type: 'floor',
        structureId: structure.id,
      });
    } else if (structure.type === 'roof') {
      const top = roofSurfaceHeight(structure, pointX, pointZ);
      if (top === null) continue;
      surfaces.push({
        height: top - RAFT_ROOF_UNDERSIDE_OFFSET,
        type: 'roof',
        structureId: structure.id,
      });
    }
  }
  return surfaces.sort((a, b) => a.height - b.height || a.type.localeCompare(b.type));
}

export function selectRaftOverheadSurface(
  surfaces: readonly RaftOverheadSurface[],
  currentHeadHeight: number,
): RaftOverheadSurface | null {
  const minimum = Number.isFinite(currentHeadHeight) ? currentHeadHeight - 0.04 : 0;
  let selected: RaftOverheadSurface | null = null;
  for (const surface of surfaces) {
    if (surface.height < minimum) continue;
    if (!selected || surface.height < selected.height) selected = surface;
  }
  return selected;
}

export function sampleRaftWalkableSurfaces(
  structures: readonly SavedRaftStructure[],
  foundations: readonly FoundationCoordinate[],
  pointX: number,
  pointZ: number,
): RaftWalkableSurface[] {
  const surfaces: RaftWalkableSurface[] = [];
  for (const foundation of foundations) {
    if (insideTile(pointX, pointZ, foundation.x, foundation.z)) {
      surfaces.push({ height: 0, type: 'foundation', structureId: null });
      break;
    }
  }
  for (const structure of structures) {
    if (structure.type === 'floor' && insideTile(pointX, pointZ, structure.x, structure.z)) {
      surfaces.push({
        height: structure.level * RAFT_STRUCTURE_LEVEL_HEIGHT,
        type: 'floor',
        structureId: structure.id,
      });
    } else if (structure.type === 'stairs') {
      const height = stairSurfaceHeight(structure, pointX, pointZ);
      if (height !== null) surfaces.push({ height, type: 'stairs', structureId: structure.id });
    } else if (structure.type === 'roof') {
      const height = roofSurfaceHeight(structure, pointX, pointZ);
      if (height !== null) surfaces.push({ height, type: 'roof', structureId: structure.id });
    }
  }
  return surfaces.sort((a, b) => a.height - b.height || a.type.localeCompare(b.type));
}

export function selectReachableRaftSurface(
  surfaces: readonly RaftWalkableSurface[],
  currentHeight: number,
  maxStepUp = RAFT_MAX_STEP_UP,
  maxStepDown = RAFT_MAX_STEP_DOWN,
): RaftWalkableSurface | null {
  const current = Number.isFinite(currentHeight) ? currentHeight : 0;
  let selected: RaftWalkableSurface | null = null;
  for (const surface of surfaces) {
    if (surface.height > current + maxStepUp || surface.height < current - maxStepDown) continue;
    if (!selected || surface.height > selected.height) selected = surface;
  }
  return selected;
}

export function selectRaftLandingSurface(
  surfaces: readonly RaftWalkableSurface[],
  maximumFootHeight: number,
): RaftWalkableSurface | null {
  const maximum = Number.isFinite(maximumFootHeight) ? maximumFootHeight : 0;
  let selected: RaftWalkableSurface | null = null;
  for (const surface of surfaces) {
    if (surface.height > maximum + 0.06) continue;
    if (!selected || surface.height > selected.height) selected = surface;
  }
  return selected;
}

export function sanitizeRaftFootHeight(
  surfaces: readonly RaftWalkableSurface[],
  requestedHeight: unknown,
): number {
  if (surfaces.length === 0) return 0;
  const requested = typeof requestedHeight === 'number' && Number.isFinite(requestedHeight)
    ? Math.max(0, Math.min(MAX_RAFT_STRUCTURE_LEVEL * RAFT_STRUCTURE_LEVEL_HEIGHT + 0.4, requestedHeight))
    : 0;
  return surfaces.reduce((closest, surface) => (
    Math.abs(surface.height - requested) < Math.abs(closest.height - requested) ? surface : closest
  )).height;
}

export function normalizeRaftRotation(value: number): RaftRotation {
  const normalized = ((Math.round(value) % 4) + 4) % 4;
  return normalized as RaftRotation;
}

export function structureEdgeKey(
  x: number,
  z: number,
  level: number,
  rotation: RaftRotation,
): string {
  if (rotation === 0) return `edge:h:${level}:${x}:${z}`;
  if (rotation === 1) return `edge:v:${level}:${x + 1}:${z}`;
  if (rotation === 2) return `edge:h:${level}:${x}:${z + 1}`;
  return `edge:v:${level}:${x}:${z}`;
}

export function structurePlacementKey(structure: Pick<SavedRaftStructure, 'type' | 'x' | 'z' | 'level' | 'rotation'>): string {
  if (structure.type === 'wall' || structure.type === 'door') {
    return structureEdgeKey(structure.x, structure.z, structure.level, structure.rotation);
  }
  if (structure.type === 'floor' || structure.type === 'roof') {
    return `surface:${structure.level}:${structure.x}:${structure.z}`;
  }
  return `cell:${structure.level}:${structure.x}:${structure.z}`;
}

export function stairDestination(
  structure: Pick<SavedRaftStructure, 'x' | 'z' | 'rotation'>,
): FoundationCoordinate {
  if (structure.rotation === 0) return { x: structure.x, z: structure.z - 1 };
  if (structure.rotation === 1) return { x: structure.x + 1, z: structure.z };
  if (structure.rotation === 2) return { x: structure.x, z: structure.z + 1 };
  return { x: structure.x - 1, z: structure.z };
}

function hasFloorSurface(
  structures: readonly SavedRaftStructure[],
  foundations: Set<string>,
  x: number,
  z: number,
  level: number,
): boolean {
  if (level === 0) return foundations.has(coordinateKey(x, z));
  return structures.some(
    (structure) => structure.type === 'floor' && structure.x === x && structure.z === z && structure.level === level,
  );
}

function verticalSupportCount(
  structures: readonly SavedRaftStructure[],
  x: number,
  z: number,
  level: number,
): number {
  const supportingLevel = level - 1;
  const edgeKeys = new Set([
    `edge:h:${supportingLevel}:${x}:${z}`,
    `edge:h:${supportingLevel}:${x}:${z + 1}`,
    `edge:v:${supportingLevel}:${x}:${z}`,
    `edge:v:${supportingLevel}:${x + 1}:${z}`,
  ]);
  let supports = 0;
  for (const structure of structures) {
    if (structure.level !== supportingLevel) continue;
    if ((structure.type === 'wall' || structure.type === 'door') && edgeKeys.has(structurePlacementKey(structure))) {
      supports += 1;
    } else if (structure.type === 'pillar' && structure.x === x && structure.z === z) {
      supports += 2;
    } else if (structure.type === 'stairs') {
      const destination = stairDestination(structure);
      if (destination.x === x && destination.z === z) supports += 2;
    }
  }
  return supports;
}

export function isRaftStructureSupported(
  structure: SavedRaftStructure,
  structures: readonly SavedRaftStructure[],
  foundations: readonly FoundationCoordinate[],
): boolean {
  const foundationSet = foundationKeys(foundations);
  if (structure.type === 'floor' || structure.type === 'roof') {
    return structure.level > 0 && verticalSupportCount(structures, structure.x, structure.z, structure.level) >= 2;
  }
  return hasFloorSurface(structures, foundationSet, structure.x, structure.z, structure.level);
}

export function canPlaceRaftStructure(
  structures: readonly SavedRaftStructure[],
  foundations: readonly FoundationCoordinate[],
  candidate: SavedRaftStructure,
): StructurePlacementReason {
  if (structures.length >= MAX_RAFT_STRUCTURES) return 'limit';
  if (Math.abs(candidate.x) > 8 || Math.abs(candidate.z) > 8) return 'out-of-bounds';
  const surfacePiece = candidate.type === 'floor' || candidate.type === 'roof';
  const validLevel = surfacePiece
    ? candidate.level >= 1 && candidate.level <= MAX_RAFT_STRUCTURE_LEVEL
    : candidate.level >= 0 && candidate.level < MAX_RAFT_STRUCTURE_LEVEL;
  if (!validLevel) return 'invalid-level';
  const key = structurePlacementKey(candidate);
  if (structures.some((structure) => structure.id === candidate.id || structurePlacementKey(structure) === key)) {
    return 'occupied';
  }
  const withCandidate = [...structures, candidate];
  return isRaftStructureSupported(candidate, withCandidate, foundations) ? 'valid' : 'unsupported';
}

export function canRemoveRaftStructure(
  structures: readonly SavedRaftStructure[],
  foundations: readonly FoundationCoordinate[],
  id: string,
): boolean {
  if (!structures.some((structure) => structure.id === id)) return false;
  const remaining = structures.filter((structure) => structure.id !== id);
  return remaining.every((structure) => isRaftStructureSupported(structure, remaining, foundations));
}

export function canRemoveFoundationUnderStructures(
  structures: readonly SavedRaftStructure[],
  foundations: readonly FoundationCoordinate[],
  coordinate: FoundationCoordinate,
): boolean {
  const remainingFoundations = foundations.filter(
    (foundation) => foundation.x !== coordinate.x || foundation.z !== coordinate.z,
  );
  return structures.every((structure) => isRaftStructureSupported(structure, structures, remainingFoundations));
}

export function pruneUnsupportedRaftStructures(
  structures: readonly SavedRaftStructure[],
  foundations: readonly FoundationCoordinate[],
): { kept: SavedRaftStructure[]; removed: SavedRaftStructure[] } {
  let kept = [...structures];
  const removed: SavedRaftStructure[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    const next: SavedRaftStructure[] = [];
    for (const structure of kept) {
      if (isRaftStructureSupported(structure, kept, foundations)) next.push(structure);
      else {
        removed.push(structure);
        changed = true;
      }
    }
    kept = next;
  }
  return { kept, removed };
}

export function sanitizeRaftStructures(
  value: unknown,
  foundations: readonly FoundationCoordinate[],
): SavedRaftStructure[] {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  const candidates: SavedRaftStructure[] = [];
  for (const entry of value.slice(0, MAX_RAFT_STRUCTURES * 2)) {
    if (!entry || typeof entry !== 'object') continue;
    const source = entry as Partial<Record<keyof SavedRaftStructure, unknown>>;
    if (typeof source.type !== 'string' || !STRUCTURE_TYPES.has(source.type as RaftStructureType)) continue;
    const type = source.type as RaftStructureType;
    const id = typeof source.id === 'string' && source.id.trim() ? source.id.slice(0, 64) : '';
    if (!id || ids.has(id)) continue;
    ids.add(id);
    const x = typeof source.x === 'number' && Number.isFinite(source.x) ? Math.round(source.x) : 0;
    const z = typeof source.z === 'number' && Number.isFinite(source.z) ? Math.round(source.z) : 0;
    const level = typeof source.level === 'number' && Number.isFinite(source.level) ? Math.round(source.level) : 0;
    const maximum = RAFT_STRUCTURE_DEFINITIONS[type].maxHealth;
    const health = typeof source.health === 'number' && Number.isFinite(source.health)
      ? Math.max(1, Math.min(maximum, Math.round(source.health)))
      : maximum;
    candidates.push({
      id,
      type,
      x,
      z,
      level,
      rotation: normalizeRaftRotation(typeof source.rotation === 'number' ? source.rotation : 0),
      health,
      ...(type === 'door' ? { open: source.open === true } : {}),
    });
  }

  const accepted: SavedRaftStructure[] = [];
  let pending = candidates;
  let changed = true;
  while (changed && pending.length > 0 && accepted.length < MAX_RAFT_STRUCTURES) {
    changed = false;
    const next: SavedRaftStructure[] = [];
    for (const candidate of pending) {
      if (canPlaceRaftStructure(accepted, foundations, candidate) === 'valid') {
        accepted.push(candidate);
        changed = true;
      } else {
        next.push(candidate);
      }
    }
    pending = next;
  }
  return accepted;
}
