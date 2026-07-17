import { createSeededRandom, randomRange } from '../math/random';
import type { ItemBundle } from './items';

export type IslandPhase = 'approaching' | 'docked' | 'departing';
export type IslandEvent = 'none' | 'arrived' | 'departing' | 'renewed';
export type HarvestNodeType = 'palm' | 'branch' | 'stone' | 'fruit' | 'fiber';

export const ISLAND_APPROACH_SECONDS = 72;
export const ISLAND_DOCK_SECONDS = 78;
export const ISLAND_DEPART_SECONDS = 24;
export const ISLAND_RADIUS_X = 6.2;
export const ISLAND_RADIUS_Z = 6.35;
export const DEFAULT_ISLAND_DOCK_Z = -7;
export const ISLAND_DOCK_CLEARANCE = 0.18;
export const ISLAND_TERRAIN_HALF_DEPTH = ISLAND_RADIUS_Z * 1.11;
const DEFAULT_RAFT_TILE_DEPTH = 1.38;

export interface HarvestNodeDefinition {
  id: string;
  type: HarvestNodeType;
  x: number;
  z: number;
  rotation: number;
  maxHealth: number;
  output: ItemBundle;
  requiresAxe: boolean;
}

export interface SavedHarvestNode {
  id: string;
  health: number;
}

export interface SavedIslandState {
  seed: number;
  cycle: number;
  dockVersion: 0 | 1;
  phase: IslandPhase;
  elapsed: number;
  nodes: SavedHarvestNode[];
}

export interface IslandTransform {
  x: number;
  z: number;
  scale: number;
}

export interface IslandNavigationInput {
  approachRate: number;
  dockDriftRate: number;
  anchored: boolean;
}

const DEFAULT_NAVIGATION: IslandNavigationInput = {
  approachRate: 0.55,
  dockDriftRate: 1,
  anchored: false,
};

const NODE_LAYOUT: ReadonlyArray<{ type: HarvestNodeType; x: number; z: number }> = [
  { type: 'palm', x: -2.8, z: -1.3 },
  { type: 'palm', x: 2.3, z: -1.9 },
  { type: 'palm', x: -1.1, z: 1.5 },
  { type: 'palm', x: 2.7, z: 1.4 },
  { type: 'branch', x: -3.4, z: 1.9 },
  { type: 'branch', x: 0.4, z: 3.2 },
  { type: 'branch', x: 3.5, z: 0.1 },
  { type: 'stone', x: -3.7, z: -0.2 },
  { type: 'stone', x: -0.4, z: -2.8 },
  { type: 'stone', x: 1.3, z: 2.9 },
  { type: 'stone', x: 3.6, z: -2.2 },
  { type: 'fruit', x: -2.2, z: -2.5 },
  { type: 'fruit', x: 1.7, z: -0.5 },
  { type: 'fruit', x: 2.2, z: 2.2 },
  { type: 'fiber', x: -3.1, z: 0.7 },
  { type: 'fiber', x: -1.6, z: 2.8 },
  { type: 'fiber', x: 0.7, z: -3.1 },
  { type: 'fiber', x: 3.2, z: 1.2 },
];

function nodeProperties(type: HarvestNodeType): Pick<HarvestNodeDefinition, 'maxHealth' | 'output' | 'requiresAxe'> {
  if (type === 'palm') {
    return { maxHealth: 3, output: { timber: 4, fiber: 2, palmFruit: 1 }, requiresAxe: true };
  }
  if (type === 'branch') return { maxHealth: 1, output: { timber: 2 }, requiresAxe: false };
  if (type === 'stone') return { maxHealth: 1, output: { stone: 2 }, requiresAxe: false };
  if (type === 'fruit') return { maxHealth: 1, output: { palmFruit: 2, palmSeed: 1 }, requiresAxe: false };
  return { maxHealth: 1, output: { fiber: 2, palmSeed: 1 }, requiresAxe: false };
}

export function generateHarvestNodes(seed: number): HarvestNodeDefinition[] {
  const random = createSeededRandom((Math.floor(seed) ^ 0x7151a7) >>> 0);
  return NODE_LAYOUT.map((node, index) => ({
    id: `${node.type}-${index}`,
    type: node.type,
    x: node.x + randomRange(random, -0.28, 0.28),
    z: node.z + randomRange(random, -0.24, 0.24),
    rotation: randomRange(random, -Math.PI, Math.PI),
    ...nodeProperties(node.type),
  }));
}

export function sampleIslandHeight(seed: number, x: number, z: number): number | null {
  const radial = Math.sqrt((x / ISLAND_RADIUS_X) ** 2 + (z / ISLAND_RADIUS_Z) ** 2);
  if (radial > 1.08) return null;
  const phase = ((Math.floor(seed) >>> 0) % 2048) * 0.0067;
  const falloff = Math.max(0, 1 - radial);
  const broadNoise = Math.sin(x * 0.72 + phase) * 0.15 + Math.cos(z * 0.84 - phase * 0.7) * 0.12;
  const fineNoise = Math.sin(x * 1.93 + z * 1.37 + phase * 1.3) * 0.055;
  const westHill = Math.exp(-((x + 1.65) ** 2) / 5.4 - ((z + 0.85) ** 2) / 7.2) * 0.72;
  const eastHill = Math.exp(-((x - 2.1) ** 2) / 3.6 - ((z + 1.45) ** 2) / 4.4) * 0.48;
  const landingShelf = Math.exp(-(x * x) / 2.2) * Math.max(0, Math.min(1, (z - 2.4) / 2.8)) * 0.1;
  return -0.36 + falloff * 2.45 + (broadNoise + fineNoise) * Math.min(1, falloff * 3.8) + westHill + eastHill + landingShelf;
}

export function isIslandWalkable(seed: number, x: number, z: number): boolean {
  const height = sampleIslandHeight(seed, x, z);
  return height !== null && height >= -0.035;
}

export function createDefaultIslandState(seed = 0x51ad7e): SavedIslandState {
  return {
    seed: seed >>> 0,
    cycle: 0,
    dockVersion: 1,
    phase: 'approaching',
    elapsed: 0,
    nodes: generateHarvestNodes(seed).map((node) => ({ id: node.id, health: node.maxHealth })),
  };
}

export function raftFrontEdgeZForTiles(
  tiles: readonly { z: number }[],
  tileDepth = DEFAULT_RAFT_TILE_DEPTH,
): number {
  if (tiles.length === 0) return -tileDepth * 0.5;
  const frontRow = Math.min(...tiles.map((tile) => tile.z));
  return frontRow * tileDepth - tileDepth * 0.5;
}

export function islandDockZForRaft(tiles: readonly { z: number }[]): number {
  const clearDockZ = raftFrontEdgeZForTiles(tiles) - ISLAND_TERRAIN_HALF_DEPTH - ISLAND_DOCK_CLEARANCE;
  return Math.min(DEFAULT_ISLAND_DOCK_Z, clearDockZ);
}

export function islandTransform(
  state: SavedIslandState,
  dockZ = DEFAULT_ISLAND_DOCK_Z,
): IslandTransform {
  if (state.phase === 'docked') return { x: 0, z: dockZ, scale: 1 };
  if (state.phase === 'departing') {
    const t = Math.max(0, Math.min(1, state.elapsed / ISLAND_DEPART_SECONDS));
    const eased = t * t * (3 - 2 * t);
    return { x: eased * 24, z: dockZ + eased * 30, scale: 1 };
  }
  const t = Math.max(0, Math.min(1, state.elapsed / ISLAND_APPROACH_SECONDS));
  const eased = t * t * (3 - 2 * t);
  return {
    x: -26 * (1 - eased) + Math.sin(t * Math.PI) * 2.2,
    z: -88 * (1 - eased) + dockZ * eased,
    scale: 0.86 + eased * 0.14,
  };
}

function nextSeed(seed: number, cycle: number): number {
  return (Math.imul(seed ^ (cycle + 1), 1664525) + 1013904223) >>> 0;
}

export function advanceIslandState(
  current: SavedIslandState,
  seconds: number,
  navigation: IslandNavigationInput = DEFAULT_NAVIGATION,
): { state: SavedIslandState; event: IslandEvent } {
  const elapsedStep = Math.max(0, Math.min(Number.isFinite(seconds) ? seconds : 0, 300));
  if (elapsedStep <= 0) return { state: current, event: 'none' };
  if (current.phase === 'approaching') {
    const approachRate = Math.max(0, Math.min(2.5, navigation.approachRate));
    const elapsed = current.elapsed + elapsedStep * approachRate;
    if (elapsed < ISLAND_APPROACH_SECONDS) return { state: { ...current, elapsed }, event: 'none' };
    return { state: { ...current, phase: 'docked', elapsed: 0 }, event: 'arrived' };
  }
  if (current.phase === 'docked') {
    if (navigation.anchored) return { state: current, event: 'none' };
    const dockDriftRate = Math.max(0.2, Math.min(2.5, navigation.dockDriftRate));
    const elapsed = Math.min(ISLAND_DOCK_SECONDS, current.elapsed + elapsedStep * dockDriftRate);
    if (elapsed < ISLAND_DOCK_SECONDS) return { state: { ...current, elapsed }, event: 'none' };
    return { state: { ...current, phase: 'departing', elapsed: 0 }, event: 'departing' };
  }
  const elapsed = current.elapsed + elapsedStep;
  if (elapsed < ISLAND_DEPART_SECONDS) return { state: { ...current, elapsed }, event: 'none' };
  const cycle = current.cycle + 1;
  const seed = nextSeed(current.seed, cycle);
  return { state: { ...createDefaultIslandState(seed), cycle }, event: 'renewed' };
}

export function sanitizeIslandState(value: unknown): SavedIslandState {
  if (!value || typeof value !== 'object') return createDefaultIslandState();
  const candidate = value as Partial<SavedIslandState>;
  const seed = typeof candidate.seed === 'number' && Number.isFinite(candidate.seed) ? Math.floor(candidate.seed) >>> 0 : 0x51ad7e;
  const cycle = typeof candidate.cycle === 'number' && Number.isFinite(candidate.cycle) ? Math.max(0, Math.floor(candidate.cycle)) : 0;
  const dockVersion = candidate.dockVersion === 1 ? 1 : 0;
  const phase: IslandPhase =
    candidate.phase === 'docked' || candidate.phase === 'departing' ? candidate.phase : 'approaching';
  const phaseDuration =
    phase === 'approaching' ? ISLAND_APPROACH_SECONDS : phase === 'docked' ? ISLAND_DOCK_SECONDS : ISLAND_DEPART_SECONDS;
  const elapsed =
    typeof candidate.elapsed === 'number' && Number.isFinite(candidate.elapsed)
      ? Math.max(0, Math.min(phaseDuration, candidate.elapsed))
      : 0;
  const savedById = new Map(
    (Array.isArray(candidate.nodes) ? candidate.nodes : [])
      .filter((node): node is SavedHarvestNode => Boolean(node && typeof node.id === 'string'))
      .map((node) => [node.id, node.health]),
  );
  const nodes = generateHarvestNodes(seed).map((node) => {
    const health = savedById.get(node.id);
    return {
      id: node.id,
      health: typeof health === 'number' && Number.isFinite(health) ? Math.max(0, Math.min(node.maxHealth, Math.floor(health))) : node.maxHealth,
    };
  });
  return { seed, cycle, dockVersion, phase, elapsed, nodes };
}
