import { createSeededRandom, randomRange } from '../math/random';
import type { ItemBundle } from './items';

export type ReefNodeType = 'sand' | 'clay' | 'metalOre' | 'seaweed';

export const WATER_SURFACE_Y = -0.12;
export const OPEN_WATER_FLOOR_Y = -7.2;
export const REEF_RADIUS_X = 14.2;
export const REEF_RADIUS_Z = 14.8;

export interface ReefNodeDefinition {
  id: string;
  type: ReefNodeType;
  x: number;
  z: number;
  rotation: number;
  maxHealth: number;
  output: ItemBundle;
  requiresHook: boolean;
}

export interface SavedReefNode {
  id: string;
  health: number;
}

export interface SavedUnderwaterState {
  islandSeed: number;
  islandCycle: number;
  nodes: SavedReefNode[];
}

export interface ReefHitResult {
  health: number;
  harvested: boolean;
  landedHits: number;
}

export function applyReefHit(currentHealth: number, maxHealth: number): ReefHitResult {
  const stableMax = Math.max(1, Math.floor(Number.isFinite(maxHealth) ? maxHealth : 1));
  const stableHealth = Math.max(0, Math.min(stableMax, Math.floor(Number.isFinite(currentHealth) ? currentHealth : stableMax)));
  const health = Math.max(0, stableHealth - 1);
  return { health, harvested: stableHealth > 0 && health === 0, landedHits: stableMax - health };
}

const NODE_LAYOUT: ReadonlyArray<{ type: ReefNodeType; x: number; z: number }> = [
  { type: 'sand', x: -7.2, z: -2.1 },
  { type: 'sand', x: 7.4, z: 1.5 },
  { type: 'sand', x: -4.2, z: 7.9 },
  { type: 'sand', x: 4.6, z: -8.1 },
  { type: 'clay', x: -8.3, z: 3.5 },
  { type: 'clay', x: 8.5, z: -3.2 },
  { type: 'clay', x: -1.2, z: -9.2 },
  { type: 'clay', x: 5.8, z: 7.4 },
  { type: 'metalOre', x: -9.8, z: -2.9 },
  { type: 'metalOre', x: 9.5, z: 3.1 },
  { type: 'metalOre', x: -5.9, z: -7.3 },
  { type: 'metalOre', x: 8.1, z: -6.1 },
  { type: 'seaweed', x: -7.6, z: 5.5 },
  { type: 'seaweed', x: 7.1, z: -6.2 },
  { type: 'seaweed', x: -2.8, z: 9.5 },
  { type: 'seaweed', x: 10.1, z: -0.7 },
  { type: 'seaweed', x: -10.3, z: 1.2 },
  { type: 'seaweed', x: 2.4, z: -10.1 },
];

function nodeProperties(type: ReefNodeType): Pick<ReefNodeDefinition, 'maxHealth' | 'output' | 'requiresHook'> {
  if (type === 'sand') return { maxHealth: 2, output: { sand: 2 }, requiresHook: true };
  if (type === 'clay') return { maxHealth: 2, output: { clay: 2 }, requiresHook: true };
  if (type === 'metalOre') return { maxHealth: 3, output: { metalOre: 1 }, requiresHook: true };
  return { maxHealth: 1, output: { seaweed: 2 }, requiresHook: false };
}

export function generateReefNodes(seed: number): ReefNodeDefinition[] {
  const random = createSeededRandom((Math.floor(seed) ^ 0x0ce4a11) >>> 0);
  return NODE_LAYOUT.map((node, index) => ({
    id: `${node.type}-${index}`,
    type: node.type,
    x: node.x + randomRange(random, -0.36, 0.36),
    z: node.z + randomRange(random, -0.34, 0.34),
    rotation: randomRange(random, -Math.PI, Math.PI),
    ...nodeProperties(node.type),
  }));
}

export function sampleReefFloorHeight(seed: number, x: number, z: number): number | null {
  const radial = Math.sqrt((x / REEF_RADIUS_X) ** 2 + (z / REEF_RADIUS_Z) ** 2);
  if (radial > 1.08) return null;
  const phase = ((Math.floor(seed) >>> 0) % 4096) * 0.0041;
  const outward = Math.max(0, (radial - 0.24) / 0.84);
  const shelf = -0.72 - Math.pow(outward, 1.18) * 5.18;
  const broad = Math.sin(x * 0.43 + phase) * 0.2 + Math.cos(z * 0.39 - phase * 0.8) * 0.16;
  const detail = Math.sin(x * 1.13 + z * 0.77 + phase * 1.4) * 0.08;
  const channel = -Math.exp(-((x - 2.2) ** 2) / 8.5 - ((z + 5.7) ** 2) / 15) * 0.42;
  return Math.min(-0.52, shelf + (broad + detail) * Math.min(1, radial * 2.7) + channel);
}

export function isReefNavigable(seed: number, x: number, z: number): boolean {
  const floor = sampleReefFloorHeight(seed, x, z);
  return floor !== null && floor <= WATER_SURFACE_Y - 0.4;
}

export function createDefaultUnderwaterState(islandSeed: number, islandCycle = 0): SavedUnderwaterState {
  return {
    islandSeed: islandSeed >>> 0,
    islandCycle: Math.max(0, Math.floor(islandCycle)),
    nodes: generateReefNodes(islandSeed).map((node) => ({ id: node.id, health: node.maxHealth })),
  };
}

export function sanitizeUnderwaterState(
  value: unknown,
  islandSeed: number,
  islandCycle: number,
): SavedUnderwaterState {
  const fallback = createDefaultUnderwaterState(islandSeed, islandCycle);
  if (!value || typeof value !== 'object') return fallback;
  const candidate = value as Partial<SavedUnderwaterState>;
  if (candidate.islandSeed !== (islandSeed >>> 0) || candidate.islandCycle !== Math.max(0, Math.floor(islandCycle))) {
    return fallback;
  }
  const savedById = new Map(
    (Array.isArray(candidate.nodes) ? candidate.nodes : [])
      .filter((node): node is SavedReefNode => Boolean(node && typeof node.id === 'string'))
      .map((node) => [node.id, node.health]),
  );
  return {
    islandSeed: islandSeed >>> 0,
    islandCycle: Math.max(0, Math.floor(islandCycle)),
    nodes: generateReefNodes(islandSeed).map((node) => {
      const health = savedById.get(node.id);
      return {
        id: node.id,
        health:
          typeof health === 'number' && Number.isFinite(health)
            ? Math.max(0, Math.min(node.maxHealth, Math.floor(health)))
            : node.maxHealth,
      };
    }),
  };
}
