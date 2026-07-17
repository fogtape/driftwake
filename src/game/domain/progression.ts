import type { ItemId } from './items';
import type { RecipeId } from './recipes';

export const BRICK_DRY_SECONDS = 52;
export const SMELT_SECONDS = 58;
export const MAX_DRYING_BRICKS = 4;
export const MAX_PROGRESSION_DEVICES = 6;

export type ProgressionDeviceType = 'researchBench' | 'dryingBricks' | 'smelter';
export type ProgressionPhase = 'idle' | 'working' | 'ready';

export const RESEARCH_SAMPLE_IDS = ['timber', 'rope', 'scrap', 'dryBrick', 'metalIngot'] as const satisfies readonly ItemId[];
export type ResearchSampleId = (typeof RESEARCH_SAMPLE_IDS)[number];

export const RESEARCH_PROJECTS = {
  smelterKit: {
    name: '回潮熔炉',
    description: '导风炉口与耐火砖胆形成稳定高温区。',
    requirements: ['timber', 'scrap', 'dryBrick'],
  },
  metalSpear: {
    name: '潮铸穿浪矛',
    description: '窄长金属矛尖集中穿透力，更快驱离深潮鲨。',
    requirements: ['timber', 'rope', 'metalIngot'],
  },
  metalAxe: {
    name: '潮铸宽刃斧',
    description: '一体宽刃能在每次挥砍时造成双倍切入。',
    requirements: ['timber', 'scrap', 'metalIngot'],
  },
} as const satisfies Record<
  string,
  { name: string; description: string; requirements: readonly ResearchSampleId[] }
>;

export type ResearchProjectId = keyof typeof RESEARCH_PROJECTS;

export interface ProgressionKnowledge {
  researched: ResearchSampleId[];
  learned: ResearchProjectId[];
}

export interface SavedProgressionDevice {
  id: string;
  type: ProgressionDeviceType;
  x: number;
  z: number;
  rotation: number;
  phase: ProgressionPhase;
  elapsed: number;
  brickElapsed: number[];
}

export interface SavedProgressionState extends ProgressionKnowledge {
  devices: SavedProgressionDevice[];
}

export interface ProgressionAdvanceResult {
  device: SavedProgressionDevice;
  event: 'brick-dry' | 'smelter-ready' | null;
}

const SAMPLE_SET = new Set<string>(RESEARCH_SAMPLE_IDS);
const PROJECT_SET = new Set<string>(Object.keys(RESEARCH_PROJECTS));
const DEVICE_TYPES = new Set<ProgressionDeviceType>(['researchBench', 'dryingBricks', 'smelter']);

function finite(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function boundedInteger(value: unknown): number {
  return Math.max(-12, Math.min(12, Math.floor(finite(value))));
}

function quantizedRotation(value: unknown): number {
  return Math.round(finite(value) / (Math.PI / 2)) * (Math.PI / 2);
}

export function createDefaultProgressionState(): SavedProgressionState {
  return { devices: [], researched: [], learned: [] };
}

export function isResearchSampleId(value: unknown): value is ResearchSampleId {
  return typeof value === 'string' && SAMPLE_SET.has(value);
}

export function isResearchProjectId(value: unknown): value is ResearchProjectId {
  return typeof value === 'string' && PROJECT_SET.has(value);
}

export function canLearnProject(knowledge: ProgressionKnowledge, projectId: ResearchProjectId): boolean {
  if (knowledge.learned.includes(projectId)) return false;
  return RESEARCH_PROJECTS[projectId].requirements.every((sample) => knowledge.researched.includes(sample));
}

export function addResearchSample(knowledge: ProgressionKnowledge, sample: ResearchSampleId): ProgressionKnowledge {
  if (knowledge.researched.includes(sample)) return knowledge;
  return { ...knowledge, researched: [...knowledge.researched, sample] };
}

export function learnProject(knowledge: ProgressionKnowledge, projectId: ResearchProjectId): ProgressionKnowledge {
  if (!canLearnProject(knowledge, projectId)) return knowledge;
  return { ...knowledge, learned: [...knowledge.learned, projectId] };
}

export function createProgressionDevice(
  type: ProgressionDeviceType,
  x: number,
  z: number,
  rotation: number,
  id: string,
): SavedProgressionDevice {
  return {
    id,
    type,
    x: boundedInteger(x),
    z: boundedInteger(z),
    rotation: quantizedRotation(rotation),
    phase: 'idle',
    elapsed: 0,
    brickElapsed: type === 'dryingBricks' ? [0] : [],
  };
}

export function addWetBrick(device: SavedProgressionDevice): SavedProgressionDevice {
  if (device.type !== 'dryingBricks' || device.brickElapsed.length >= MAX_DRYING_BRICKS) return device;
  return { ...device, brickElapsed: [...device.brickElapsed, 0] };
}

export function collectDryBricks(device: SavedProgressionDevice): { device: SavedProgressionDevice; count: number } {
  if (device.type !== 'dryingBricks') return { device, count: 0 };
  const wet = device.brickElapsed.filter((elapsed) => elapsed < BRICK_DRY_SECONDS);
  return {
    device: { ...device, brickElapsed: wet },
    count: device.brickElapsed.length - wet.length,
  };
}

export function startSmelter(device: SavedProgressionDevice): SavedProgressionDevice {
  if (device.type !== 'smelter' || device.phase !== 'idle') return device;
  return { ...device, phase: 'working', elapsed: 0 };
}

export function collectSmelter(device: SavedProgressionDevice): SavedProgressionDevice {
  if (device.type !== 'smelter' || device.phase !== 'ready') return device;
  return { ...device, phase: 'idle', elapsed: 0 };
}

export function advanceProgressionDevice(device: SavedProgressionDevice, delta: number): ProgressionAdvanceResult {
  const seconds = Math.max(0, finite(delta));
  if (seconds === 0) return { device, event: null };
  if (device.type === 'dryingBricks') {
    let dried = false;
    const brickElapsed = device.brickElapsed.map((elapsed) => {
      const next = Math.min(BRICK_DRY_SECONDS, elapsed + seconds);
      if (elapsed < BRICK_DRY_SECONDS && next >= BRICK_DRY_SECONDS) dried = true;
      return next;
    });
    return { device: { ...device, brickElapsed }, event: dried ? 'brick-dry' : null };
  }
  if (device.type === 'smelter' && device.phase === 'working') {
    const elapsed = Math.min(SMELT_SECONDS, device.elapsed + seconds);
    return {
      device: { ...device, elapsed, phase: elapsed >= SMELT_SECONDS ? 'ready' : 'working' },
      event: elapsed >= SMELT_SECONDS && device.elapsed < SMELT_SECONDS ? 'smelter-ready' : null,
    };
  }
  return { device, event: null };
}

export function progressionDeviceProgress(device: SavedProgressionDevice): number {
  if (device.type === 'dryingBricks') {
    if (device.brickElapsed.length === 0) return 0;
    return Math.max(...device.brickElapsed) / BRICK_DRY_SECONDS;
  }
  if (device.type === 'smelter') return device.phase === 'ready' ? 1 : device.elapsed / SMELT_SECONDS;
  return 0;
}

export function progressionPlacementItem(type: ProgressionDeviceType): ItemId {
  if (type === 'researchBench') return 'researchBenchKit';
  if (type === 'smelter') return 'smelterKit';
  return 'wetBrick';
}

export function sanitizeProgressionState(value: unknown): SavedProgressionState {
  if (!value || typeof value !== 'object') return createDefaultProgressionState();
  const candidate = value as Partial<SavedProgressionState>;
  const researched = Array.isArray(candidate.researched)
    ? [...new Set(candidate.researched.filter(isResearchSampleId))]
    : [];
  const rawLearned = Array.isArray(candidate.learned)
    ? [...new Set(candidate.learned.filter(isResearchProjectId))]
    : [];
  const learned = rawLearned.filter((projectId) =>
    RESEARCH_PROJECTS[projectId].requirements.every((sample) => researched.includes(sample)),
  );
  const ids = new Set<string>();
  const typeCounts: Record<ProgressionDeviceType, number> = { researchBench: 0, dryingBricks: 0, smelter: 0 };
  const typeLimits: Record<ProgressionDeviceType, number> = { researchBench: 1, dryingBricks: 3, smelter: 2 };
  const devices = (Array.isArray(candidate.devices) ? candidate.devices : [])
    .map((raw): SavedProgressionDevice | null => {
      if (!raw || typeof raw !== 'object') return null;
      const device = raw as Partial<SavedProgressionDevice>;
      if (typeof device.id !== 'string' || device.id.trim().length === 0 || !DEVICE_TYPES.has(device.type as ProgressionDeviceType)) return null;
      const id = device.id.trim();
      const type = device.type as ProgressionDeviceType;
      if (ids.has(id) || typeCounts[type] >= typeLimits[type]) return null;
      let phase: ProgressionPhase =
        type === 'smelter' && (device.phase === 'working' || device.phase === 'ready') ? device.phase : 'idle';
      let elapsed = phase === 'ready'
        ? SMELT_SECONDS
        : phase === 'working'
          ? Math.max(0, Math.min(SMELT_SECONDS, finite(device.elapsed)))
          : 0;
      if (phase === 'working' && elapsed >= SMELT_SECONDS) {
        phase = 'ready';
        elapsed = SMELT_SECONDS;
      }
      const brickElapsed = type === 'dryingBricks' && Array.isArray(device.brickElapsed)
        ? device.brickElapsed
          .slice(0, MAX_DRYING_BRICKS)
          .map((seconds) => Math.max(0, Math.min(BRICK_DRY_SECONDS, finite(seconds))))
        : [];
      if (type === 'dryingBricks' && brickElapsed.length === 0) return null;
      ids.add(id);
      typeCounts[type] += 1;
      return {
        id,
        type,
        x: boundedInteger(device.x),
        z: boundedInteger(device.z),
        rotation: quantizedRotation(device.rotation),
        phase,
        elapsed,
        brickElapsed,
      };
    })
    .filter((device): device is SavedProgressionDevice => device !== null)
    .slice(0, MAX_PROGRESSION_DEVICES);
  return { devices, researched, learned };
}

export function learnedRecipeIds(knowledge: ProgressionKnowledge): readonly RecipeId[] {
  return knowledge.learned;
}
