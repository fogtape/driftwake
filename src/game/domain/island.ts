import { createSeededRandom, randomRange } from '../math/random';
import type { ItemBundle } from './items';

export type IslandPhase = 'approaching' | 'docked' | 'departing';
export type IslandEvent = 'none' | 'arrived' | 'departing' | 'renewed';
export type HarvestNodeType = 'palm' | 'branch' | 'stone' | 'fruit' | 'fiber';

export const ISLAND_APPROACH_SECONDS = 72;
export const ISLAND_DOCK_SECONDS = 240;
export const ISLAND_DEPART_SECONDS = 24;
export const ISLAND_RADIUS_X = 6.2;
export const ISLAND_RADIUS_Z = 6.35;

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
  phase: IslandPhase;
  elapsed: number;
  nodes: SavedHarvestNode[];
}

export interface IslandTransform {
  x: number;
  z: number;
  scale: number;
}

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
    phase: 'approaching',
    elapsed: 0,
    nodes: generateHarvestNodes(seed).map((node) => ({ id: node.id, health: node.maxHealth })),
  };
}

export function islandTransform(state: SavedIslandState): IslandTransform {
  if (state.phase === 'docked') return { x: 0, z: -7, scale: 1 };
  if (state.phase === 'departing') {
    const t = Math.max(0, Math.min(1, state.elapsed / ISLAND_DEPART_SECONDS));
    const eased = t * t * (3 - 2 * t);
    return { x: eased * 24, z: -7 + eased * 30, scale: 1 };
  }
  const t = Math.max(0, Math.min(1, state.elapsed / ISLAND_APPROACH_SECONDS));
  const eased = t * t * (3 - 2 * t);
  return {
    x: -26 * (1 - eased) + Math.sin(t * Math.PI) * 2.2,
    z: -88 * (1 - eased) - 7 * eased,
    scale: 0.86 + eased * 0.14,
  };
}

function nextSeed(seed: number, cycle: number): number {
  return (Math.imul(seed ^ (cycle + 1), 1664525) + 1013904223) >>> 0;
}

export function advanceIslandState(
  current: SavedIslandState,
  seconds: number,
  playerOnIsland: boolean,
): { state: SavedIslandState; event: IslandEvent } {
  const elapsedStep = Math.max(0, Math.min(Number.isFinite(seconds) ? seconds : 0, 300));
  if (elapsedStep <= 0) return { state: current, event: 'none' };
  if (current.phase === 'approaching') {
    const elapsed = current.elapsed + elapsedStep;
    if (elapsed < ISLAND_APPROACH_SECONDS) return { state: { ...current, elapsed }, event: 'none' };
    return { state: { ...current, phase: 'docked', elapsed: 0 }, event: 'arrived' };
  }
  if (current.phase === 'docked') {
    const elapsed = Math.min(ISLAND_DOCK_SECONDS, current.elapsed + elapsedStep);
    if (elapsed < ISLAND_DOCK_SECONDS || playerOnIsland) {
      return { state: { ...current, elapsed }, event: 'none' };
    }
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
  return { seed, cycle, phase, elapsed, nodes };
}
