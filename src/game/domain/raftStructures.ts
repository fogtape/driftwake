import type { ItemBundle } from './items';

export const RAFT_STRUCTURE_LEVEL_HEIGHT = 2.18;
export const MAX_RAFT_STRUCTURES = 96;
export const MAX_RAFT_STRUCTURE_LEVEL = 2;

export type RaftRotation = 0 | 1 | 2 | 3;
export type RaftStructureType = 'floor' | 'wall' | 'door' | 'pillar' | 'stairs' | 'roof';
export type RaftBuildPiece = 'foundation' | RaftStructureType;
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
  maxHealth: number;
}

export interface RaftBuildPieceDefinition {
  name: string;
  shortName: string;
  cost: ItemBundle;
}

export const RAFT_STRUCTURE_DEFINITIONS: Record<RaftStructureType, RaftStructureDefinition> = {
  floor: {
    type: 'floor',
    name: '上层拼板地面',
    shortName: '上层地板',
    cost: { timber: 3, rope: 1 },
    refund: { timber: 2 },
    maxHealth: 90,
  },
  wall: {
    type: 'wall',
    name: '交错承力木墙',
    shortName: '木墙',
    cost: { timber: 3, rope: 1 },
    refund: { timber: 2 },
    maxHealth: 110,
  },
  door: {
    type: 'door',
    name: '绳铰板门',
    shortName: '板门',
    cost: { timber: 3, rope: 2 },
    refund: { timber: 2, rope: 1 },
    maxHealth: 95,
  },
  pillar: {
    type: 'pillar',
    name: '盐封承重柱',
    shortName: '承重柱',
    cost: { timber: 2, rope: 1 },
    refund: { timber: 1 },
    maxHealth: 125,
  },
  stairs: {
    type: 'stairs',
    name: '双梁登层梯',
    shortName: '楼梯',
    cost: { timber: 4, rope: 2 },
    refund: { timber: 2, rope: 1 },
    maxHealth: 100,
  },
  roof: {
    type: 'roof',
    name: '编叶斜顶',
    shortName: '斜顶',
    cost: { timber: 2, fiber: 3, rope: 1 },
    refund: { timber: 1, fiber: 2 },
    maxHealth: 80,
  },
};

export const RAFT_BUILD_PIECES: readonly RaftBuildPiece[] = [
  'foundation',
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
