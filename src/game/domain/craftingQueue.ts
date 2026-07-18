import {
  INVENTORY_SLOT_CAPACITY,
  ITEM_DEFINITIONS,
  addItems,
  itemCount,
  normalizeInventory,
  removeItems,
  type Inventory,
  type ItemBundle,
  type ItemId,
  type ToolId,
} from './items';
import { RECIPES, isRecipeUnlocked, missingForRecipe, type RecipeId } from './recipes';
import { TOOL_MAX_DURABILITY, type ToolDurability } from './toolDurability';

export const MAX_CRAFTING_QUEUE = 8;

export const RECIPE_CRAFT_SECONDS = {
  hook: 2.4,
  rope: 0.9,
  emptyCup: 1.1,
  purifierKit: 3.6,
  grillKit: 3.2,
  hinge: 1.4,
  signalBoard: 2.8,
  brineCell: 2.4,
  solarPurifierKit: 4.8,
  tripleGrillKit: 4.6,
  lockerKit: 4.2,
  sailKit: 3.8,
  anchorKit: 3.6,
  helmKit: 4.5,
  stormRigKit: 3.2,
  anchorBraceKit: 3.2,
  receiverKit: 5,
  antennaKit: 4.4,
  planterKit: 3,
  researchBenchKit: 3.5,
  wetBrick: 1.5,
  smelterKit: 4.5,
  hammer: 1.8,
  spear: 2,
  metalSpear: 2.8,
  fishingRod: 2.2,
  axe: 2.3,
  metalAxe: 2.8,
} as const satisfies Record<RecipeId, number>;

export interface CraftingQueueEntry {
  id: string;
  recipeId: RecipeId;
  elapsedSeconds: number;
  consumedTool: ToolId | null;
  consumedToolDurability: number | null;
  selectOnComplete: boolean;
}

export interface CraftingQueueState {
  entries: CraftingQueueEntry[];
  nextSerial: number;
}

export type QueueCraftReason =
  | 'queued'
  | 'partial'
  | 'invalid-quantity'
  | 'queue-full'
  | 'missing-materials'
  | 'already-owned'
  | 'locked';

export interface QueueCraftResult {
  ok: boolean;
  inventory: Inventory;
  crafting: CraftingQueueState;
  requested: number;
  queued: number;
  reason: QueueCraftReason;
  missing: ItemBundle;
}

export type CraftingOutputBlockReason = 'inventory-full' | 'already-owned';

export interface AdvanceCraftingResult {
  inventory: Inventory;
  crafting: CraftingQueueState;
  completed: CraftingQueueEntry[];
  blockedReason: CraftingOutputBlockReason | null;
}

export type CancelCraftReason = 'cancelled' | 'not-found' | 'inventory-full' | 'tool-conflict';

export interface CancelCraftResult {
  ok: boolean;
  inventory: Inventory;
  crafting: CraftingQueueState;
  cancelled: CraftingQueueEntry | null;
  reason: CancelCraftReason;
}

export interface QueueCraftContext {
  learned?: readonly RecipeId[];
  selectedTool?: ToolId;
  toolDurability?: ToolDurability;
}

const RECIPE_IDS = new Set<RecipeId>(Object.keys(RECIPES) as RecipeId[]);

function cleanQuantity(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(99, Math.floor(value))) : 0;
}

export function createDefaultCraftingQueue(): CraftingQueueState {
  return { entries: [], nextSerial: 1 };
}

export function recipeCraftSeconds(recipeId: RecipeId): number {
  return RECIPE_CRAFT_SECONDS[recipeId];
}

export function recipeOutputItem(recipeId: RecipeId): ItemId {
  return Object.keys(RECIPES[recipeId].output)[0] as ItemId;
}

function consumedRecipeTool(recipeId: RecipeId): ToolId | null {
  return (Object.keys(RECIPES[recipeId].cost) as ItemId[]).find(
    (itemId): itemId is ToolId => ITEM_DEFINITIONS[itemId].category === 'tool',
  ) ?? null;
}

function hasQueuedToolOutput(crafting: CraftingQueueState, outputId: ItemId): boolean {
  return ITEM_DEFINITIONS[outputId].category === 'tool'
    && crafting.entries.some((entry) => recipeOutputItem(entry.recipeId) === outputId);
}

export function sanitizeCraftingQueue(value: unknown): CraftingQueueState {
  if (!value || typeof value !== 'object') return createDefaultCraftingQueue();
  const candidate = value as { entries?: unknown[]; nextSerial?: unknown };
  const entries: CraftingQueueEntry[] = [];
  const ids = new Set<string>();
  const toolOutputs = new Set<ItemId>();
  let generatedSerial = 1;

  for (const raw of Array.isArray(candidate.entries) ? candidate.entries.slice(0, MAX_CRAFTING_QUEUE) : []) {
    if (!raw || typeof raw !== 'object') continue;
    const entry = raw as Partial<CraftingQueueEntry>;
    if (typeof entry.recipeId !== 'string' || !RECIPE_IDS.has(entry.recipeId as RecipeId)) continue;
    const recipeId = entry.recipeId as RecipeId;
    const outputId = recipeOutputItem(recipeId);
    if (ITEM_DEFINITIONS[outputId].category === 'tool' && toolOutputs.has(outputId)) continue;

    let id = typeof entry.id === 'string' && /^[a-zA-Z0-9_-]{1,40}$/.test(entry.id) ? entry.id : '';
    while (!id || ids.has(id)) id = `craft-${generatedSerial++}`;
    ids.add(id);
    if (ITEM_DEFINITIONS[outputId].category === 'tool') toolOutputs.add(outputId);

    const consumedTool = consumedRecipeTool(recipeId);
    const maxDurability = consumedTool ? TOOL_MAX_DURABILITY[consumedTool] : 0;
    const rawDurability = entry.consumedToolDurability;
    const consumedToolDurability = consumedTool
      ? Math.max(1, Math.min(maxDurability, Number.isFinite(rawDurability) ? Math.floor(rawDurability!) : maxDurability))
      : null;
    const duration = recipeCraftSeconds(recipeId);
    entries.push({
      id,
      recipeId,
      elapsedSeconds: Math.max(0, Math.min(duration, Number.isFinite(entry.elapsedSeconds) ? entry.elapsedSeconds! : 0)),
      consumedTool,
      consumedToolDurability,
      selectOnComplete: consumedTool !== null && entry.selectOnComplete === true,
    });
  }

  const observedSerial = entries.reduce((maximum, entry) => {
    const match = /^craft-([0-9a-z]+)$/i.exec(entry.id);
    return match ? Math.max(maximum, Math.min(1_000_000, Number.parseInt(match[1], 36) + 1)) : maximum;
  }, 1);
  const candidateSerial = typeof candidate.nextSerial === 'number' && Number.isFinite(candidate.nextSerial)
    ? Math.max(1, Math.min(1_000_000, Math.floor(candidate.nextSerial)))
    : 1;
  return { entries, nextSerial: Math.max(candidateSerial, observedSerial, generatedSerial) };
}

export function maxQueueableCrafts(
  inventory: Inventory,
  crafting: CraftingQueueState,
  recipeId: RecipeId,
  learned: readonly RecipeId[] = [],
): number {
  const queue = sanitizeCraftingQueue(crafting);
  if (!isRecipeUnlocked(recipeId, learned)) return 0;
  const outputId = recipeOutputItem(recipeId);
  if (
    ITEM_DEFINITIONS[outputId].category === 'tool'
    && (itemCount(inventory, outputId) > 0 || hasQueuedToolOutput(queue, outputId))
  ) return 0;
  const queueSpace = Math.max(0, MAX_CRAFTING_QUEUE - queue.entries.length);
  if (queueSpace === 0) return 0;
  const materialLimit = (Object.entries(RECIPES[recipeId].cost) as [ItemId, number][]).reduce(
    (limit, [itemId, amount]) => Math.min(limit, Math.floor(itemCount(inventory, itemId) / amount)),
    Number.POSITIVE_INFINITY,
  );
  const available = Number.isFinite(materialLimit) ? materialLimit : queueSpace;
  return Math.max(0, Math.min(queueSpace, ITEM_DEFINITIONS[outputId].category === 'tool' ? 1 : available));
}

export function queueCraftItems(
  currentInventory: Inventory,
  currentCrafting: CraftingQueueState,
  recipeId: RecipeId,
  quantity: number,
  context: QueueCraftContext = {},
): QueueCraftResult {
  const inventory = normalizeInventory(currentInventory);
  const crafting = sanitizeCraftingQueue(currentCrafting);
  const requested = cleanQuantity(quantity);
  const learned = context.learned ?? [];
  if (requested === 0) {
    return { ok: false, inventory, crafting, requested, queued: 0, reason: 'invalid-quantity', missing: {} };
  }
  if (!isRecipeUnlocked(recipeId, learned)) {
    return { ok: false, inventory, crafting, requested, queued: 0, reason: 'locked', missing: {} };
  }

  const outputId = recipeOutputItem(recipeId);
  if (
    ITEM_DEFINITIONS[outputId].category === 'tool'
    && (itemCount(inventory, outputId) > 0 || hasQueuedToolOutput(crafting, outputId))
  ) {
    return { ok: false, inventory, crafting, requested, queued: 0, reason: 'already-owned', missing: {} };
  }
  if (crafting.entries.length >= MAX_CRAFTING_QUEUE) {
    return { ok: false, inventory, crafting, requested, queued: 0, reason: 'queue-full', missing: {} };
  }

  let nextInventory = inventory;
  const entries = [...crafting.entries];
  let nextSerial = crafting.nextSerial;
  let queued = 0;
  const targetQuantity = ITEM_DEFINITIONS[outputId].category === 'tool' ? 1 : requested;
  while (queued < targetQuantity && entries.length < MAX_CRAFTING_QUEUE) {
    const paid = removeItems(nextInventory, RECIPES[recipeId].cost);
    if (!paid) break;
    const consumedTool = consumedRecipeTool(recipeId);
    const usedIds = new Set(entries.map((entry) => entry.id));
    let id = `craft-${nextSerial.toString(36)}`;
    while (usedIds.has(id)) id = `craft-${(++nextSerial).toString(36)}`;
    nextSerial += 1;
    entries.push({
      id,
      recipeId,
      elapsedSeconds: 0,
      consumedTool,
      consumedToolDurability: consumedTool
        ? context.toolDurability?.[consumedTool] ?? TOOL_MAX_DURABILITY[consumedTool]
        : null,
      selectOnComplete: consumedTool !== null && context.selectedTool === consumedTool,
    });
    nextInventory = paid;
    queued += 1;
  }

  const nextCrafting = { entries, nextSerial };
  const missing = queued < targetQuantity ? missingForRecipe(nextInventory, recipeId) : {};
  const reason: QueueCraftReason = queued === targetQuantity
    ? 'queued'
    : queued > 0
      ? 'partial'
      : entries.length >= MAX_CRAFTING_QUEUE
        ? 'queue-full'
        : 'missing-materials';
  return { ok: queued > 0, inventory: nextInventory, crafting: nextCrafting, requested, queued, reason, missing };
}

export function craftingOutputBlockReason(
  inventory: Inventory,
  entry: CraftingQueueEntry,
  capacity = INVENTORY_SLOT_CAPACITY,
): CraftingOutputBlockReason | null {
  const outputId = recipeOutputItem(entry.recipeId);
  if (ITEM_DEFINITIONS[outputId].category === 'tool' && itemCount(inventory, outputId) > 0) return 'already-owned';
  const preview = addItems(inventory, RECIPES[entry.recipeId].output, capacity);
  return Object.keys(preview.rejected).length > 0 ? 'inventory-full' : null;
}

export function advanceCraftingQueue(
  currentInventory: Inventory,
  currentCrafting: CraftingQueueState,
  seconds: number,
  capacity = INVENTORY_SLOT_CAPACITY,
): AdvanceCraftingResult {
  let inventory = normalizeInventory(currentInventory);
  const sanitized = sanitizeCraftingQueue(currentCrafting);
  const entries = sanitized.entries.map((entry) => ({ ...entry }));
  const completed: CraftingQueueEntry[] = [];
  let blockedReason: CraftingOutputBlockReason | null = null;
  let remaining = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;

  while (entries.length > 0) {
    const entry = entries[0];
    const duration = recipeCraftSeconds(entry.recipeId);
    const needed = Math.max(0, duration - entry.elapsedSeconds);
    if (needed > remaining + 1e-9) {
      entry.elapsedSeconds += remaining;
      break;
    }
    entry.elapsedSeconds = duration;
    remaining = Math.max(0, remaining - needed);
    blockedReason = craftingOutputBlockReason(inventory, entry, capacity);
    if (blockedReason) break;
    const result = addItems(inventory, RECIPES[entry.recipeId].output, capacity);
    inventory = result.inventory;
    completed.push({ ...entry });
    entries.shift();
    if (remaining <= 1e-9) break;
  }

  return {
    inventory,
    crafting: { entries, nextSerial: sanitized.nextSerial },
    completed,
    blockedReason,
  };
}

export function cancelCraftingEntry(
  currentInventory: Inventory,
  currentCrafting: CraftingQueueState,
  entryId: string,
  capacity = INVENTORY_SLOT_CAPACITY,
): CancelCraftResult {
  const inventory = normalizeInventory(currentInventory);
  const crafting = sanitizeCraftingQueue(currentCrafting);
  const cancelled = crafting.entries.find((entry) => entry.id === entryId) ?? null;
  if (!cancelled) return { ok: false, inventory, crafting, cancelled: null, reason: 'not-found' };
  if (cancelled.consumedTool && itemCount(inventory, cancelled.consumedTool) > 0) {
    return { ok: false, inventory, crafting, cancelled, reason: 'tool-conflict' };
  }
  const refunded = addItems(inventory, RECIPES[cancelled.recipeId].cost, capacity);
  if (Object.keys(refunded.rejected).length > 0) {
    return { ok: false, inventory, crafting, cancelled, reason: 'inventory-full' };
  }
  return {
    ok: true,
    inventory: refunded.inventory,
    crafting: {
      entries: crafting.entries.filter((entry) => entry.id !== entryId),
      nextSerial: crafting.nextSerial,
    },
    cancelled,
    reason: 'cancelled',
  };
}

export function canCancelCraftingEntry(
  inventory: Inventory,
  crafting: CraftingQueueState,
  entryId: string,
  capacity = INVENTORY_SLOT_CAPACITY,
): boolean {
  return cancelCraftingEntry(inventory, crafting, entryId, capacity).ok;
}
