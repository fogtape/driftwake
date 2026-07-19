import {
  ITEM_DEFINITIONS,
  normalizeInventory,
  type ItemBundle,
  type ItemId,
} from './items';
import {
  structureEdgeKey,
  type FoundationCoordinate,
  type RaftRotation,
  type SavedRaftStructure,
} from './raftStructures';

export const MAX_COLLECTION_NETS = 12;
export const COLLECTION_NET_CAPACITY = 12;
export const COLLECTION_NET_MAX_HEALTH = 80;

export type CollectionNetRotation = RaftRotation;

export interface SavedCollectionNet {
  id: string;
  x: number;
  z: number;
  rotation: CollectionNetRotation;
  health: number;
  storage: ItemBundle;
}

export type CollectionNetPlacementReason =
  | 'valid'
  | 'missing-host'
  | 'not-edge'
  | 'occupied'
  | 'out-of-bounds'
  | 'limit';

export interface CollectionNetPlacementResult {
  valid: boolean;
  reason: CollectionNetPlacementReason;
}

export interface CollectionNetCaptureResult {
  net: SavedCollectionNet;
  accepted: ItemBundle;
  rejected: ItemBundle;
}

function coordinateKey(x: number, z: number): string {
  return `${x}:${z}`;
}

function finiteInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null;
}

function sanitizeRotation(value: unknown): CollectionNetRotation | null {
  const rotation = finiteInteger(value);
  return rotation !== null && rotation >= 0 && rotation <= 3 ? rotation as CollectionNetRotation : null;
}

export function collectionNetEdgeKey(
  net: Pick<SavedCollectionNet, 'x' | 'z' | 'rotation'>,
): string {
  return `${net.x}:${net.z}:${net.rotation}`;
}

export function collectionNetStructureEdgeKey(
  net: Pick<SavedCollectionNet, 'x' | 'z' | 'rotation'>,
): string {
  return structureEdgeKey(net.x, net.z, 0, net.rotation);
}

export function collectionNetOutsideCoordinate(
  net: Pick<SavedCollectionNet, 'x' | 'z' | 'rotation'>,
): FoundationCoordinate {
  if (net.rotation === 0) return { x: net.x, z: net.z - 1 };
  if (net.rotation === 1) return { x: net.x + 1, z: net.z };
  if (net.rotation === 2) return { x: net.x, z: net.z + 1 };
  return { x: net.x - 1, z: net.z };
}

export function collectionNetStoredUnits(storage: ItemBundle): number {
  return (Object.values(normalizeInventory(storage)) as number[]).reduce((total, count) => total + count, 0);
}

export function collectionNetBlocksFoundationAt(
  nets: readonly Pick<SavedCollectionNet, 'x' | 'z' | 'rotation'>[],
  coordinate: FoundationCoordinate,
): boolean {
  return nets.some((net) => {
    const outside = collectionNetOutsideCoordinate(net);
    return outside.x === coordinate.x && outside.z === coordinate.z;
  });
}

export function collectionNetBlocksStructure(
  nets: readonly Pick<SavedCollectionNet, 'x' | 'z' | 'rotation'>[],
  structure: Pick<SavedRaftStructure, 'type' | 'x' | 'z' | 'level' | 'rotation'>,
): boolean {
  if (structure.level !== 0 || (structure.type !== 'wall' && structure.type !== 'door')) return false;
  const edge = structureEdgeKey(structure.x, structure.z, structure.level, structure.rotation);
  return nets.some((net) => collectionNetStructureEdgeKey(net) === edge);
}

export function canPlaceCollectionNet(
  nets: readonly Pick<SavedCollectionNet, 'x' | 'z' | 'rotation'>[],
  foundations: readonly FoundationCoordinate[],
  candidate: Pick<SavedCollectionNet, 'x' | 'z' | 'rotation'>,
  occupiedStructureEdges: ReadonlySet<string> = new Set(),
): CollectionNetPlacementResult {
  if (Math.abs(candidate.x) > 12 || Math.abs(candidate.z) > 12) {
    return { valid: false, reason: 'out-of-bounds' };
  }
  if (nets.length >= MAX_COLLECTION_NETS) return { valid: false, reason: 'limit' };

  const foundationsByCoordinate = new Set(
    foundations.map((foundation) => coordinateKey(foundation.x, foundation.z)),
  );
  if (!foundationsByCoordinate.has(coordinateKey(candidate.x, candidate.z))) {
    return { valid: false, reason: 'missing-host' };
  }
  const outside = collectionNetOutsideCoordinate(candidate);
  if (foundationsByCoordinate.has(coordinateKey(outside.x, outside.z))) {
    return { valid: false, reason: 'not-edge' };
  }
  if (nets.some((net) => collectionNetEdgeKey(net) === collectionNetEdgeKey(candidate))) {
    return { valid: false, reason: 'occupied' };
  }
  if (occupiedStructureEdges.has(collectionNetStructureEdgeKey(candidate))) {
    return { valid: false, reason: 'occupied' };
  }
  return { valid: true, reason: 'valid' };
}

export function captureIntoCollectionNet(
  net: SavedCollectionNet,
  incoming: ItemBundle,
): CollectionNetCaptureResult {
  const storage = normalizeInventory(net.storage);
  const accepted: ItemBundle = {};
  const rejected: ItemBundle = {};
  let freeUnits = Math.max(0, COLLECTION_NET_CAPACITY - collectionNetStoredUnits(storage));

  for (const itemId of Object.keys(ITEM_DEFINITIONS) as ItemId[]) {
    const rawAmount = incoming[itemId] ?? 0;
    const requested = Number.isFinite(rawAmount) ? Math.max(0, Math.floor(rawAmount)) : 0;
    if (requested === 0) continue;
    const amount = Math.min(freeUnits, requested);
    if (amount > 0) {
      storage[itemId] = (storage[itemId] ?? 0) + amount;
      accepted[itemId] = amount;
      freeUnits -= amount;
    }
    if (amount < requested) rejected[itemId] = requested - amount;
  }

  return {
    net: { ...net, storage },
    accepted,
    rejected,
  };
}

export function sanitizeCollectionNets(
  value: unknown,
  foundations: readonly FoundationCoordinate[],
  occupiedStructureEdges: ReadonlySet<string> = new Set(),
): SavedCollectionNet[] {
  if (!Array.isArray(value)) return [];
  const nets: SavedCollectionNet[] = [];
  const ids = new Set<string>();

  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || nets.length >= MAX_COLLECTION_NETS) continue;
    const candidate = raw as Partial<SavedCollectionNet>;
    const x = finiteInteger(candidate.x);
    const z = finiteInteger(candidate.z);
    const rotation = sanitizeRotation(candidate.rotation);
    if (x === null || z === null || rotation === null) continue;
    const id = typeof candidate.id === 'string' && candidate.id.trim().length > 0
      ? candidate.id.slice(0, 64)
      : `net-${x}-${z}-${rotation}`;
    if (ids.has(id)) continue;

    const placement = canPlaceCollectionNet(nets, foundations, { x, z, rotation }, occupiedStructureEdges);
    if (!placement.valid) continue;
    const rawHealth = typeof candidate.health === 'number' && Number.isFinite(candidate.health)
      ? Math.floor(candidate.health)
      : COLLECTION_NET_MAX_HEALTH;
    if (rawHealth <= 0) continue;

    const normalized = normalizeInventory(candidate.storage ?? {});
    const storage = captureIntoCollectionNet(
      { id, x, z, rotation, health: Math.min(COLLECTION_NET_MAX_HEALTH, rawHealth), storage: {} },
      normalized,
    ).net.storage;
    nets.push({
      id,
      x,
      z,
      rotation,
      health: Math.min(COLLECTION_NET_MAX_HEALTH, rawHealth),
      storage,
    });
    ids.add(id);
  }
  return nets;
}
