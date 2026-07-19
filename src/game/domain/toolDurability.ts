import { itemCount, type Inventory, type ToolId } from './items';

export type ToolDurability = Partial<Record<ToolId, number>>;

export const TOOL_MAX_DURABILITY: Record<ToolId, number> = {
  hook: 48,
  hammer: 80,
  spear: 45,
  metalSpear: 90,
  resonanceFork: 32,
  fishingRod: 55,
  axe: 60,
  metalAxe: 120,
};

export interface ToolWearResult {
  durability: ToolDurability;
  remaining: number;
  broken: boolean;
}

function durabilityValue(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(fallback, Math.floor(value)));
}

export function normalizeToolDurability(inventory: Inventory, value: unknown): ToolDurability {
  const source = value && typeof value === 'object' ? value as Partial<Record<ToolId, unknown>> : {};
  const durability: ToolDurability = {};
  for (const tool of Object.keys(TOOL_MAX_DURABILITY) as ToolId[]) {
    if (itemCount(inventory, tool) <= 0) continue;
    durability[tool] = Math.max(1, durabilityValue(source[tool], TOOL_MAX_DURABILITY[tool]));
  }
  return durability;
}

export function freshToolDurability(current: ToolDurability, tool: ToolId): ToolDurability {
  return { ...current, [tool]: TOOL_MAX_DURABILITY[tool] };
}

export function applyToolWear(current: ToolDurability, tool: ToolId, amount = 1): ToolWearResult {
  const maximum = TOOL_MAX_DURABILITY[tool];
  const previous = durabilityValue(current[tool], maximum);
  const wear = Math.max(0, Number.isFinite(amount) ? Math.ceil(amount) : 0);
  const remaining = Math.max(0, previous - wear);
  const durability = { ...current };
  if (remaining > 0) durability[tool] = remaining;
  else delete durability[tool];
  return { durability, remaining, broken: previous > 0 && remaining === 0 };
}

export function toolDurabilityRatio(durability: ToolDurability, tool: ToolId): number {
  return Math.max(0, Math.min(1, (durability[tool] ?? 0) / TOOL_MAX_DURABILITY[tool]));
}
