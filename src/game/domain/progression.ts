import type { ItemId } from './items';
import type { RecipeId } from './recipes';

export const BRICK_DRY_SECONDS = 52;
export const SMELT_SECONDS = 58;
export const MAX_DRYING_BRICKS = 4;
export const MAX_PROGRESSION_DEVICES = 6;

export type ProgressionDeviceType = 'researchBench' | 'dryingBricks' | 'smelter';
export type ProgressionPhase = 'idle' | 'working' | 'ready';

export const RESEARCH_SAMPLE_IDS = ['timber', 'rope', 'scrap', 'dryBrick', 'metalIngot', 'glassPane', 'hinge', 'signalBoard'] as const satisfies readonly ItemId[];
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
  helmKit: {
    name: '定潮舵台',
    description: '差速舵索与磁针罗盘让木筏在阵风里保持选定航线。',
    requirements: ['timber', 'scrap', 'metalIngot'],
  },
  stormRigKit: {
    name: '横风抗扭索具',
    description: '以金属横撑和双股受力绳分散帆角载荷，延缓风暴过载。',
    requirements: ['rope', 'scrap', 'metalIngot'],
  },
  hinge: {
    name: '潮铸密封铰链',
    description: '把耐蚀合金分成咬合轴套，为密封柜盖与锚机棘轮提供可维护转轴。',
    requirements: ['scrap', 'metalIngot'],
  },
  solarPurifierKit: {
    name: '潮镜五联净水器',
    description: '五块盐蚀玻璃分路吸热，让多杯海水在同一轮日照中完成蒸馏。',
    requirements: ['timber', 'scrap', 'glassPane'],
  },
  tripleGrillKit: {
    name: '三槽烟鳍烤台',
    description: '蓄热炉膛与三组独立托架共享燃料，又分别记录每份渔获的火候。',
    requirements: ['timber', 'rope', 'metalIngot'],
  },
  lockerKit: {
    name: '干舱储物柜',
    description: '潮铸铰链压紧蜡封内衬，为筏上物资提供八个防飞沫堆叠格。',
    requirements: ['timber', 'scrap', 'hinge'],
  },
  anchorBraceKit: {
    name: '深锚锁链棘轮',
    description: '锁链与防回滑棘轮分散风暴冲击，避免锚索在峰值载荷中自行松脱。',
    requirements: ['rope', 'metalIngot', 'hinge'],
  },
  signalBoard: {
    name: '潮听信号板',
    description: '玻璃介质与潮铸导轨形成稳定谐振，让微弱窄带脉冲从海面噪声中浮现。',
    requirements: ['scrap', 'metalIngot', 'glassPane'],
  },
  brineCell: {
    name: '盐差电池',
    description: '密封盐水与异种金属电极形成可更换的低压电源，适合长时间扫描。',
    requirements: ['scrap', 'metalIngot', 'signalBoard'],
  },
  receiverKit: {
    name: '潮听接收台',
    description: '参考线圈、扫描屏与调谐鼓轮共同测出命名信号的相对方位和距离。',
    requirements: ['timber', 'glassPane', 'signalBoard'],
  },
  antennaKit: {
    name: '双桅定向阵列',
    description: '分离布置的双桅与接收台参考线圈形成相位差，足以判断远海信号方向。',
    requirements: ['rope', 'metalIngot', 'signalBoard'],
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
  smeltInput: 'metalOre' | 'sand' | null;
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
    smeltInput: null,
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

export function startSmelter(
  device: SavedProgressionDevice,
  input: 'metalOre' | 'sand' = 'metalOre',
): SavedProgressionDevice {
  if (device.type !== 'smelter' || device.phase !== 'idle') return device;
  return { ...device, phase: 'working', elapsed: 0, smeltInput: input };
}

export function collectSmelter(device: SavedProgressionDevice): SavedProgressionDevice {
  if (device.type !== 'smelter' || device.phase !== 'ready') return device;
  return { ...device, phase: 'idle', elapsed: 0, smeltInput: null };
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
      const smeltInput = type === 'smelter' && (device.smeltInput === 'metalOre' || device.smeltInput === 'sand')
        ? device.smeltInput
        : type === 'smelter' && phase !== 'idle'
          ? 'metalOre'
          : null;
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
        smeltInput,
      };
    })
    .filter((device): device is SavedProgressionDevice => device !== null)
    .slice(0, MAX_PROGRESSION_DEVICES);
  return { devices, researched, learned };
}

export function learnedRecipeIds(knowledge: ProgressionKnowledge): readonly RecipeId[] {
  return knowledge.learned;
}
