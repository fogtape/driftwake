import {
  ITEM_DEFINITIONS,
  itemCount,
  normalizeInventory,
  type Inventory,
  type ItemBundle,
  type ItemId,
} from './items';
import type { SurvivalState } from './survival';

export type FailureCause = 'drowning' | 'dehydration' | 'starvation' | 'shark' | 'injury';

export interface FailureRecord {
  cause: FailureCause;
  dropped: ItemBundle;
  occurredAt: number;
  dropPending: boolean;
}

export interface FailureInventoryResolution {
  retained: Inventory;
  dropped: ItemBundle;
}

export const RECOVERY_SURVIVAL: SurvivalState = {
  health: 62,
  thirst: 44,
  hunger: 48,
  oxygen: 100,
};

export const FAILURE_COPY: Record<FailureCause, { title: string; detail: string }> = {
  drowning: { title: '深水夺走了呼吸', detail: '你被潮流送回木筏，装备还在，部分补给落在右舷。' },
  dehydration: { title: '脱水压垮了身体', detail: '你在甲板上醒来，装备还在，部分补给散落到右舷水面。' },
  starvation: { title: '饥饿耗尽了体力', detail: '你在甲板上醒来，装备还在，部分补给散落到右舷水面。' },
  shark: { title: '深潮鲨撕开了防线', detail: '你被拖回木筏，工具没有丢失，松散补给落在右舷。' },
  injury: { title: '伤势中断了航程', detail: '你被带回木筏，工具没有丢失，松散补给落在右舷。' },
};

const FAILURE_CAUSES = new Set<FailureCause>(['drowning', 'dehydration', 'starvation', 'shark', 'injury']);
const PROTECTED_MINIMUM: Partial<Record<ItemId, number>> = {
  emergencyWater: 1,
  ration: 1,
  emptyCup: 1,
};

function hasBundleItems(bundle: ItemBundle): boolean {
  return Object.values(bundle).some((amount) => (amount ?? 0) > 0);
}

export function detectFailureCause(
  survival: SurvivalState,
  submerged: boolean,
  directCause: FailureCause = 'injury',
): FailureCause | null {
  if (survival.health > 0) return null;
  if (directCause === 'shark') return 'shark';
  if (submerged && survival.oxygen <= 0) return 'drowning';
  if (survival.thirst <= 0) return 'dehydration';
  if (survival.hunger <= 0) return 'starvation';
  return directCause;
}

export function partitionInventoryForFailure(inventory: Inventory): FailureInventoryResolution {
  const normalized = normalizeInventory(inventory);
  const retained: Inventory = {};
  const dropped: ItemBundle = {};
  for (const id of Object.keys(ITEM_DEFINITIONS) as ItemId[]) {
    const count = itemCount(normalized, id);
    if (count <= 0) continue;
    if (ITEM_DEFINITIONS[id].category === 'tool') {
      retained[id] = count;
      continue;
    }
    const protectedCount = Math.min(count, PROTECTED_MINIMUM[id] ?? 0);
    const exposed = count - protectedCount;
    const dropCount = exposed > 0 ? Math.max(1, Math.floor(exposed * 0.35)) : 0;
    const retainedCount = count - dropCount;
    if (retainedCount > 0) retained[id] = retainedCount;
    if (dropCount > 0) dropped[id] = dropCount;
  }
  return { retained, dropped };
}

export function createFailureRecord(cause: FailureCause, dropped: ItemBundle, occurredAt: number): FailureRecord {
  const normalizedDropped = normalizeInventory(dropped);
  return {
    cause,
    dropped: normalizedDropped,
    occurredAt: Math.max(0, Math.floor(Number.isFinite(occurredAt) ? occurredAt : 0)),
    dropPending: hasBundleItems(normalizedDropped),
  };
}

export function sanitizeFailureRecord(value: unknown): FailureRecord | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<FailureRecord>;
  if (!candidate.cause || !FAILURE_CAUSES.has(candidate.cause)) return null;
  const dropped = normalizeInventory(candidate.dropped ?? {});
  return {
    cause: candidate.cause,
    dropped,
    occurredAt: Math.max(0, Math.floor(Number.isFinite(candidate.occurredAt) ? candidate.occurredAt! : 0)),
    dropPending: hasBundleItems(dropped) && candidate.dropPending === true,
  };
}
