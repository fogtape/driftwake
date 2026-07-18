import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRightLeft,
  Backpack,
  Check,
  FlaskConical,
  Hammer,
  HeartPulse,
  Layers3,
  ListChecks,
  ListPlus,
  LockKeyhole,
  MapPin,
  Microscope,
  Minus,
  MoveLeft,
  MoveRight,
  PackageOpen,
  Plus,
  Scissors,
  ShieldCheck,
  Timer,
  X,
} from 'lucide-react';
import {
  INVENTORY_SLOT_CAPACITY,
  ITEM_DEFINITIONS,
  inventoryStacks,
  itemCount,
  stackTransferAmount,
  transferInventoryItem,
  type Inventory,
  type InventoryStack,
  type ItemId,
  type ToolId,
} from '../game/domain/items';
import { RECIPES, isRecipeUnlocked, type RecipeId } from '../game/domain/recipes';
import {
  MAX_CRAFTING_QUEUE,
  canCancelCraftingEntry,
  craftingOutputBlockReason,
  maxQueueableCrafts,
  recipeCraftSeconds,
  recipeOutputItem,
  type CancelCraftResult,
  type CraftingQueueState,
  type QueueCraftResult,
} from '../game/domain/craftingQueue';
import { TOOL_MAX_DURABILITY, toolDurabilityRatio, type ToolDurability } from '../game/domain/toolDurability';
import {
  RESEARCH_PROJECTS,
  RESEARCH_SAMPLE_IDS,
  canLearnProject,
  type ResearchProjectId,
  type ResearchSampleId,
} from '../game/domain/progression';
import type {
  OverlayPanel,
  PlacementType,
  ProgressionFeedback,
  RaftFeedback,
  ResearchSampleResult,
  StorageFeedback,
} from '../state/gameStore';
import { ItemIcon } from './ItemIcon';

interface FieldPackPanelProps {
  panel: OverlayPanel;
  inventory: Inventory;
  crafting: CraftingQueueState;
  toolDurability: ToolDurability;
  inventorySlots: number;
  raft: RaftFeedback;
  progression: ProgressionFeedback;
  storage: StorageFeedback | null;
  saveStatus: 'idle' | 'saved' | 'error';
  onPanelChange: (panel: Exclude<OverlayPanel, null>) => void;
  onQueueCraft: (recipeId: RecipeId, quantity: number) => QueueCraftResult;
  onCancelCraft: (entryId: string) => CancelCraftResult;
  onUse: (itemId: ItemId) => boolean;
  onPlace: (deviceType: PlacementType) => void;
  onResearch: (sample: ResearchSampleId) => ResearchSampleResult;
  onLearn: (projectId: ResearchProjectId) => boolean;
  onStorageTransfer: (itemId: ItemId, direction: 'to-storage' | 'to-pack', amount: number) => boolean;
  onClose: () => void;
}

type StorageSide = 'pack' | 'storage';

interface StorageStackSelection {
  side: StorageSide;
  itemId: ItemId;
  stackIndex: number;
}

interface DraggedStorageStack extends StorageStackSelection {
  amount: number;
}

function selectionKey(selection: StorageStackSelection): string {
  return `${selection.side}-${selection.itemId}-${selection.stackIndex}`;
}

const CONSUMABLES = new Set<ItemId>([
  'emergencyWater',
  'freshWaterCup',
  'ration',
  'palmFruit',
  'rawFish',
  'cookedFish',
  'burntFish',
]);
const PLACEABLES: Partial<Record<ItemId, PlacementType>> = {
  purifierKit: 'purifier',
  grillKit: 'grill',
  solarPurifierKit: 'solarPurifier',
  tripleGrillKit: 'tripleGrill',
  lockerKit: 'locker',
  sailKit: 'sail',
  anchorKit: 'anchor',
  helmKit: 'helm',
  planterKit: 'planter',
  researchBenchKit: 'researchBench',
  smelterKit: 'smelter',
  wetBrick: 'dryingBricks',
  receiverKit: 'receiver',
  antennaKit: 'antenna',
};

function categoryLabel(category: (typeof ITEM_DEFINITIONS)[ItemId]['category']): string {
  if (category === 'tool') return '工具';
  if (category === 'material') return '材料';
  if (category === 'container') return '容器';
  if (category === 'placeable') return '筏上设备';
  return '补给';
}

export function FieldPackPanel({
  panel,
  inventory,
  crafting,
  toolDurability,
  inventorySlots,
  raft,
  progression,
  storage,
  saveStatus,
  onPanelChange,
  onQueueCraft,
  onCancelCraft,
  onUse,
  onPlace,
  onResearch,
  onLearn,
  onStorageTransfer,
  onClose,
}: FieldPackPanelProps) {
  const itemIds = useMemo(
    () => (Object.keys(ITEM_DEFINITIONS) as ItemId[]).filter((id) => itemCount(inventory, id) > 0),
    [inventory],
  );
  const stacks = useMemo(() => inventoryStacks(inventory), [inventory]);
  const [selectedItem, setSelectedItem] = useState<ItemId>('hook');
  const [craftQuantities, setCraftQuantities] = useState<Partial<Record<RecipeId, number>>>({});
  const storageStacks = useMemo(
    () => storage ? inventoryStacks(storage.inventory) : [],
    [storage],
  );
  const [transferSelection, setTransferSelection] = useState<StorageStackSelection | null>(null);
  const [transferAmount, setTransferAmount] = useState(1);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<StorageSide | null>(null);
  const draggedStackRef = useRef<DraggedStorageStack | null>(null);

  const selectedTransferStack = transferSelection
    ? (transferSelection.side === 'pack' ? stacks : storageStacks).find(
      (stack) => stack.itemId === transferSelection.itemId && stack.stackIndex === transferSelection.stackIndex,
    ) ?? null
    : null;

  useEffect(() => {
    if (itemCount(inventory, selectedItem) <= 0 && itemIds[0]) setSelectedItem(itemIds[0]);
  }, [inventory, itemIds, selectedItem]);

  useEffect(() => {
    setTransferSelection(null);
    setTransferAmount(1);
    setDraggingKey(null);
    setDropTarget(null);
    draggedStackRef.current = null;
  }, [panel, storage?.deviceId]);

  useEffect(() => {
    if (!transferSelection) return;
    if (!selectedTransferStack) {
      setTransferSelection(null);
      setTransferAmount(1);
      return;
    }
    setTransferAmount((current) => Math.max(1, Math.min(selectedTransferStack.count, current)));
  }, [selectedTransferStack, transferSelection]);

  const transferPreview = useMemo(() => {
    if (!storage || !transferSelection || !selectedTransferStack) return null;
    const source = transferSelection.side === 'pack' ? inventory : storage.inventory;
    const target = transferSelection.side === 'pack' ? storage.inventory : inventory;
    const capacity = transferSelection.side === 'pack' ? storage.capacity : INVENTORY_SLOT_CAPACITY;
    return transferInventoryItem(
      source,
      target,
      transferSelection.itemId,
      Math.min(transferAmount, selectedTransferStack.count),
      capacity,
    );
  }, [inventory, selectedTransferStack, storage, transferAmount, transferSelection]);

  if (!panel || (panel === 'storage' && !storage)) return null;

  const previewStorageTransfer = (payload: DraggedStorageStack) => {
    if (!storage) return null;
    const source = payload.side === 'pack' ? inventory : storage.inventory;
    const target = payload.side === 'pack' ? storage.inventory : inventory;
    const capacity = payload.side === 'pack' ? storage.capacity : INVENTORY_SLOT_CAPACITY;
    return transferInventoryItem(source, target, payload.itemId, payload.amount, capacity);
  };

  const commitStorageTransfer = (payload: DraggedStorageStack): boolean => {
    const preview = previewStorageTransfer(payload);
    if (!preview || preview.moved <= 0 || (payload.side === 'pack' && payload.itemId === 'hook')) return false;
    return onStorageTransfer(
      payload.itemId,
      payload.side === 'pack' ? 'to-storage' : 'to-pack',
      payload.amount,
    );
  };

  const selectStorageStack = (side: StorageSide, stack: InventoryStack, amount = stack.count) => {
    if (side === 'pack' && stack.itemId === 'hook') return;
    setTransferSelection({ side, itemId: stack.itemId, stackIndex: stack.stackIndex });
    setTransferAmount(Math.max(1, Math.min(stack.count, amount)));
  };

  const handleStorageDragStart = (
    event: React.DragEvent<HTMLButtonElement>,
    side: StorageSide,
    stack: InventoryStack,
  ) => {
    const selection = { side, itemId: stack.itemId, stackIndex: stack.stackIndex };
    const selectedAmount = transferSelection && selectionKey(transferSelection) === selectionKey(selection)
      ? transferAmount
      : stack.count;
    const amount = event.shiftKey
      ? stackTransferAmount(stack.count, 'half')
      : Math.max(1, Math.min(stack.count, selectedAmount));
    const payload = { ...selection, amount };
    draggedStackRef.current = payload;
    setDraggingKey(selectionKey(selection));
    setTransferSelection(selection);
    setTransferAmount(amount);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', selectionKey(selection));
  };

  const handleStorageDragOver = (event: React.DragEvent<HTMLElement>, target: StorageSide) => {
    const payload = draggedStackRef.current;
    if (!payload || payload.side === target || previewStorageTransfer(payload)?.moved === 0) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropTarget(target);
  };

  const handleStorageDragLeave = (event: React.DragEvent<HTMLElement>, target: StorageSide) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDropTarget((current) => current === target ? null : current);
  };

  const finishStorageDrag = () => {
    draggedStackRef.current = null;
    setDraggingKey(null);
    setDropTarget(null);
  };

  const handleStorageDrop = (event: React.DragEvent<HTMLElement>, target: StorageSide) => {
    const payload = draggedStackRef.current;
    if (!payload || payload.side === target) return;
    event.preventDefault();
    commitStorageTransfer(payload);
    finishStorageDrag();
  };

  const selectedDefinition = ITEM_DEFINITIONS[selectedItem];
  const selectedTool = selectedDefinition.category === 'tool' ? selectedItem as ToolId : null;
  const selectedDurability = selectedTool
    ? toolDurability[selectedTool] ?? TOOL_MAX_DURABILITY[selectedTool]
    : 0;
  const selectedDurabilityRatio = selectedTool
    ? toolDurabilityRatio({ [selectedTool]: selectedDurability }, selectedTool)
    : 0;
  const emptySlots = Math.max(0, INVENTORY_SLOT_CAPACITY - stacks.length);
  const resolvedTransferAmount = selectedTransferStack
    ? Math.max(1, Math.min(selectedTransferStack.count, transferAmount))
    : 1;
  const transferDefinition = transferSelection ? ITEM_DEFINITIONS[transferSelection.itemId] : null;
  const transferTargetLabel = transferSelection?.side === 'pack' ? '密封干舱' : '随身背包';
  const transferMoved = transferPreview?.moved ?? 0;

  return (
    <div className="modal-layer field-pack-layer" role="presentation">
      <section className="field-pack" role="dialog" aria-modal="true" aria-labelledby="field-pack-heading">
        <header className={`field-pack__header ${panel === 'research' || panel === 'storage' ? 'field-pack__header--single' : ''}`}>
          <div className="field-pack__identity">
            {panel === 'research' ? <Microscope size={22} /> : panel === 'storage' ? <PackageOpen size={22} /> : <Backpack size={22} />}
            <div>
              <span>{panel === 'research' ? '材料推演' : panel === 'storage' ? '干舱清单' : '航次装备'}</span>
              <h2 id="field-pack-heading">{panel === 'research' ? '盐迹研究台' : panel === 'storage' ? storage?.name : '野外背包'}</h2>
            </div>
          </div>
          {panel !== 'research' && panel !== 'storage' && <nav className="field-pack__tabs" aria-label="背包视图">
            <button className={panel === 'pack' ? 'is-active' : ''} type="button" onClick={() => onPanelChange('pack')}>
              <PackageOpen size={18} />
              物资
            </button>
            <button className={panel === 'crafting' ? 'is-active' : ''} type="button" onClick={() => onPanelChange('crafting')}>
              <Hammer size={18} />
              制作
            </button>
          </nav>}
          <button className="icon-command icon-command--dark" type="button" onClick={onClose} aria-label="关闭背包" title="关闭">
            <X size={20} />
          </button>
        </header>

        <div className="field-pack__status">
          <span><PackageOpen size={15} /> {inventorySlots}/{INVENTORY_SLOT_CAPACITY}</span>
          {panel === 'storage' && storage && <span><ShieldCheck size={15} /> 干舱 {storage.slots}/{storage.capacity}</span>}
          <span><ShieldCheck size={15} /> 筏体 {raft.averageIntegrity}%</span>
          <span className={`save-indicator save-indicator--${saveStatus}`}>
            <Check size={14} /> {saveStatus === 'error' ? '存档异常' : saveStatus === 'saved' ? '航迹已记录' : '航迹记录中'}
          </span>
        </div>

        {panel === 'storage' && storage ? (
          <div className="field-pack__body field-pack__body--storage">
            <section
              className={`storage-inventory ${dropTarget === 'pack' ? 'is-drop-target' : ''}`}
              aria-labelledby="storage-pack-heading"
              onDragOver={(event) => handleStorageDragOver(event, 'pack')}
              onDragLeave={(event) => handleStorageDragLeave(event, 'pack')}
              onDrop={(event) => handleStorageDrop(event, 'pack')}
            >
              <div className="crafting-heading">
                <div><Backpack size={20} /><span id="storage-pack-heading">随身背包</span></div>
                <small>{inventorySlots}/{INVENTORY_SLOT_CAPACITY}</small>
              </div>
              <div className="inventory-grid inventory-grid--storage" aria-label="可存入的背包物品">
                {stacks.map(({ itemId, count, stackIndex }) => {
                  const definition = ITEM_DEFINITIONS[itemId];
                  const selection = { side: 'pack' as const, itemId, stackIndex };
                  const key = selectionKey(selection);
                  const selected = transferSelection ? selectionKey(transferSelection) === key : false;
                  return (
                    <button
                      key={`pack-${itemId}-${stackIndex}`}
                      className={`inventory-slot storage-transfer-slot ${selected ? 'is-selected' : ''} ${draggingKey === key ? 'is-dragging' : ''}`}
                      type="button"
                      disabled={itemId === 'hook'}
                      draggable={itemId !== 'hook'}
                      onClick={() => selectStorageStack('pack', { itemId, count, stackIndex })}
                      onDoubleClick={() => commitStorageTransfer({ ...selection, amount: count })}
                      onDragStart={(event) => handleStorageDragStart(event, 'pack', { itemId, count, stackIndex })}
                      onDragEnd={finishStorageDrag}
                      style={{ '--item-tone': definition.tone } as React.CSSProperties}
                      aria-label={`随身背包：${definition.name}，${count} 个`}
                      aria-pressed={selected}
                      title={itemId === 'hook' ? '打捞钩保留在随身工具位' : definition.name}
                    >
                      <ItemIcon itemId={itemId} size={27} strokeWidth={1.8} />
                      <strong>{count}</strong>
                      <MoveRight className="storage-transfer-slot__direction" size={13} />
                    </button>
                  );
                })}
                {Array.from({ length: emptySlots }, (_, index) => (
                  <span className="inventory-slot inventory-slot--empty" key={`pack-empty-${index}`} />
                ))}
              </div>
            </section>

            <div className={`storage-transfer-axis ${transferSelection ? 'has-selection' : ''}`} aria-label="物资转移控制">
              {transferSelection && selectedTransferStack && transferDefinition ? (
                <>
                  <div
                    className="storage-transfer-axis__item"
                    style={{ '--item-tone': transferDefinition.tone } as React.CSSProperties}
                  >
                    <ItemIcon itemId={transferSelection.itemId} size={23} strokeWidth={1.8} />
                    <span>{transferDefinition.shortName}</span>
                  </div>
                  <div className="storage-transfer-stepper" role="group" aria-label="转移数量">
                    <button
                      type="button"
                      onClick={() => setTransferAmount((amount) => Math.max(1, amount - 1))}
                      disabled={resolvedTransferAmount <= 1}
                      aria-label="减少转移数量"
                      title="减少"
                    >
                      <Minus size={14} />
                    </button>
                    <output aria-label="当前转移数量" aria-live="polite">{resolvedTransferAmount}</output>
                    <button
                      type="button"
                      onClick={() => setTransferAmount((amount) => Math.min(selectedTransferStack.count, amount + 1))}
                      disabled={resolvedTransferAmount >= selectedTransferStack.count}
                      aria-label="增加转移数量"
                      title="增加"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <div className="storage-transfer-presets" role="group" aria-label="数量预设">
                    <button
                      type="button"
                      onClick={() => setTransferAmount(stackTransferAmount(selectedTransferStack.count, 'one'))}
                      aria-label="转移一个"
                      title="一个"
                    >1</button>
                    <button
                      type="button"
                      onClick={() => setTransferAmount(stackTransferAmount(selectedTransferStack.count, 'half'))}
                      aria-label="转移半组"
                      title="半组"
                    ><Scissors size={13} /></button>
                    <button
                      type="button"
                      onClick={() => setTransferAmount(stackTransferAmount(selectedTransferStack.count, 'all'))}
                      aria-label="转移整组"
                      title="整组"
                    ><Layers3 size={13} /></button>
                  </div>
                  <button
                    className={`storage-transfer-commit ${transferMoved < resolvedTransferAmount ? 'is-limited' : ''}`}
                    type="button"
                    disabled={transferMoved <= 0}
                    onClick={() => commitStorageTransfer({ ...transferSelection, amount: resolvedTransferAmount })}
                    aria-label={transferMoved > 0
                      ? `向${transferTargetLabel}转移 ${transferMoved} 个${transferDefinition.name}`
                      : `${transferTargetLabel}已满`}
                    title={transferMoved > 0 ? `转移到${transferTargetLabel}` : `${transferTargetLabel}已满`}
                  >
                    {transferSelection.side === 'pack' ? <MoveRight size={18} /> : <MoveLeft size={18} />}
                  </button>
                  <small className={transferMoved < resolvedTransferAmount ? 'is-limited' : ''} aria-live="polite">
                    {transferMoved <= 0 ? '已满' : transferMoved < resolvedTransferAmount ? `可容 ${transferMoved}` : transferTargetLabel}
                  </small>
                </>
              ) : (
                <ArrowRightLeft className="storage-transfer-axis__idle" size={20} aria-hidden="true" />
              )}
            </div>

            <section
              className={`storage-inventory ${dropTarget === 'storage' ? 'is-drop-target' : ''}`}
              aria-labelledby="storage-hold-heading"
              onDragOver={(event) => handleStorageDragOver(event, 'storage')}
              onDragLeave={(event) => handleStorageDragLeave(event, 'storage')}
              onDrop={(event) => handleStorageDrop(event, 'storage')}
            >
              <div className="crafting-heading">
                <div><PackageOpen size={20} /><span id="storage-hold-heading">密封干舱</span></div>
                <small>{storage.slots}/{storage.capacity}</small>
              </div>
              <div className="inventory-grid inventory-grid--storage inventory-grid--locker" aria-label="干舱物品">
                {storageStacks.map(({ itemId, count, stackIndex }) => {
                  const definition = ITEM_DEFINITIONS[itemId];
                  const selection = { side: 'storage' as const, itemId, stackIndex };
                  const key = selectionKey(selection);
                  const selected = transferSelection ? selectionKey(transferSelection) === key : false;
                  return (
                    <button
                      key={`hold-${itemId}-${stackIndex}`}
                      className={`inventory-slot storage-transfer-slot ${selected ? 'is-selected' : ''} ${draggingKey === key ? 'is-dragging' : ''}`}
                      type="button"
                      draggable
                      onClick={() => selectStorageStack('storage', { itemId, count, stackIndex })}
                      onDoubleClick={() => commitStorageTransfer({ ...selection, amount: count })}
                      onDragStart={(event) => handleStorageDragStart(event, 'storage', { itemId, count, stackIndex })}
                      onDragEnd={finishStorageDrag}
                      style={{ '--item-tone': definition.tone } as React.CSSProperties}
                      aria-label={`密封干舱：${definition.name}，${count} 个`}
                      aria-pressed={selected}
                      title={definition.name}
                    >
                      <ItemIcon itemId={itemId} size={27} strokeWidth={1.8} />
                      <strong>{count}</strong>
                      <MoveLeft className="storage-transfer-slot__direction" size={13} />
                    </button>
                  );
                })}
                {Array.from({ length: Math.max(0, storage.capacity - storageStacks.length) }, (_, index) => (
                  <span className="inventory-slot inventory-slot--empty" key={`hold-empty-${index}`} />
                ))}
              </div>
            </section>
          </div>
        ) : panel === 'pack' ? (
          <div className="field-pack__body field-pack__body--inventory">
            <div className="inventory-grid" aria-label="背包物品">
              {stacks.map(({ itemId, count, stackIndex }) => {
                const definition = ITEM_DEFINITIONS[itemId];
                return (
                  <button
                    key={`${itemId}-${stackIndex}`}
                    className={`inventory-slot ${selectedItem === itemId ? 'is-selected' : ''}`}
                    type="button"
                    onClick={() => setSelectedItem(itemId)}
                    style={{ '--item-tone': definition.tone } as React.CSSProperties}
                    aria-label={`${definition.name} ${count}`}
                  >
                    <ItemIcon itemId={itemId} size={27} strokeWidth={1.8} />
                    <strong>{count}</strong>
                  </button>
                );
              })}
              {Array.from({ length: emptySlots }, (_, index) => (
                <span className="inventory-slot inventory-slot--empty" key={`empty-${index}`} />
              ))}
            </div>

            <aside className="item-detail">
              <div className="item-detail__icon" style={{ '--item-tone': selectedDefinition.tone } as React.CSSProperties}>
                <ItemIcon itemId={selectedItem} size={40} strokeWidth={1.6} />
              </div>
              <span>{categoryLabel(selectedDefinition.category)}</span>
              <h3>{selectedDefinition.name}</h3>
              <p>{selectedDefinition.description}</p>
              <dl>
                <div><dt>持有</dt><dd>{itemCount(inventory, selectedItem)}</dd></div>
                <div><dt>堆叠</dt><dd>{selectedDefinition.maxStack}</dd></div>
                {selectedTool && (
                  <div className={`item-detail__durability ${selectedDurabilityRatio <= 0.2 ? 'is-worn' : ''}`}>
                    <dt>耐久</dt>
                    <dd>
                      <i><b style={{ transform: `scaleX(${selectedDurabilityRatio})` }} /></i>
                      <span>{selectedDurability}/{TOOL_MAX_DURABILITY[selectedTool]}</span>
                    </dd>
                  </div>
                )}
              </dl>
              {CONSUMABLES.has(selectedItem) && (
                <button className="panel-command" type="button" onClick={() => onUse(selectedItem)}>
                  <HeartPulse size={18} />
                  {selectedDefinition.category === 'water' ? '饮用' : '食用'}
                </button>
              )}
              {PLACEABLES[selectedItem] && (
                <button className="panel-command" type="button" onClick={() => onPlace(PLACEABLES[selectedItem]!)}>
                  <MapPin size={18} />
                  安置到木筏
                </button>
              )}
            </aside>
          </div>
        ) : panel === 'crafting' ? (
          <div className="field-pack__body field-pack__body--crafting">
            <section className="crafting-catalog" aria-labelledby="crafting-catalog-heading">
              <div className="crafting-heading">
                <div><FlaskConical size={20} /><span id="crafting-catalog-heading">便携制作</span></div>
                <small>工位就绪</small>
              </div>
              <div className="recipe-list">
                {(Object.keys(RECIPES) as RecipeId[]).map((recipeId) => {
                  const recipe = RECIPES[recipeId];
                  const outputId = recipeOutputItem(recipeId);
                  const unlocked = isRecipeUnlocked(recipeId, progression.learned);
                  const queuedOutput = crafting.entries.some((entry) => recipeOutputItem(entry.recipeId) === outputId);
                  const alreadyOwned = ITEM_DEFINITIONS[outputId].category === 'tool'
                    && (itemCount(inventory, outputId) > 0 || queuedOutput);
                  const maxCrafts = maxQueueableCrafts(inventory, crafting, recipeId, progression.learned);
                  const quantity = Math.min(
                    Math.max(1, craftQuantities[recipeId] ?? 1),
                    Math.max(1, maxCrafts),
                  );
                  const canQueue = maxCrafts > 0;
                  return (
                    <article className={`recipe-row ${canQueue ? 'is-ready' : ''} ${unlocked ? '' : 'is-locked'}`} key={recipeId}>
                      <div className="recipe-row__icon" style={{ '--item-tone': ITEM_DEFINITIONS[outputId].tone } as React.CSSProperties}>
                        <ItemIcon itemId={outputId} size={29} />
                      </div>
                      <div className="recipe-row__copy">
                        <div className="recipe-row__title">
                          <h3>{recipe.name}</h3>
                          <span><Timer size={13} />{(recipeCraftSeconds(recipeId) * quantity).toFixed(1)}s</span>
                        </div>
                        <p>{unlocked ? recipe.description : '需要在盐迹研究台完成材料推演。'}</p>
                        <div className="recipe-costs">
                          {(Object.entries(recipe.cost) as [ItemId, number][]).map(([itemId, amount]) => {
                            const total = amount * quantity;
                            const enough = itemCount(inventory, itemId) >= total;
                            return (
                              <span className={enough ? 'is-met' : 'is-missing'} key={itemId}>
                                <ItemIcon itemId={itemId} size={14} />
                                {itemCount(inventory, itemId)}/{total}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <div className="recipe-row__actions">
                        <div className="recipe-quantity" role="group" aria-label={`${recipe.name}制作数量`}>
                          <button
                            type="button"
                            disabled={!canQueue || quantity <= 1}
                            onClick={() => setCraftQuantities((current) => ({ ...current, [recipeId]: quantity - 1 }))}
                            aria-label={`减少${recipe.name}制作数量`}
                            title="减少"
                          ><Minus size={13} /></button>
                          <output aria-label={`${recipe.name}当前制作数量`}>{quantity}</output>
                          <button
                            type="button"
                            disabled={!canQueue || quantity >= maxCrafts}
                            onClick={() => setCraftQuantities((current) => ({ ...current, [recipeId]: quantity + 1 }))}
                            aria-label={`增加${recipe.name}制作数量`}
                            title="增加"
                          ><Plus size={13} /></button>
                        </div>
                        <button
                          className="recipe-command"
                          type="button"
                          disabled={!canQueue}
                          onClick={() => onQueueCraft(recipeId, quantity)}
                          aria-label={`将${quantity}个${recipe.name}加入制作队列`}
                          title="加入制作队列"
                        >
                          {!unlocked ? <LockKeyhole size={18} /> : alreadyOwned ? <Check size={19} /> : <ListPlus size={19} />}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <aside className="crafting-queue" aria-labelledby="crafting-queue-heading">
              <div className="crafting-heading crafting-queue__heading">
                <div><ListChecks size={20} /><span id="crafting-queue-heading">制作队列</span></div>
                <small>{crafting.entries.length}/{MAX_CRAFTING_QUEUE}</small>
              </div>
              {crafting.entries.length === 0 ? (
                <div className="crafting-queue__empty">
                  <ListChecks size={28} />
                  <strong>暂无排队项目</strong>
                  <span>工位空闲</span>
                </div>
              ) : (
                <ol className="crafting-queue__list">
                  {crafting.entries.map((entry, index) => {
                    const recipe = RECIPES[entry.recipeId];
                    const outputId = recipeOutputItem(entry.recipeId);
                    const duration = recipeCraftSeconds(entry.recipeId);
                    const progress = Math.min(1, entry.elapsedSeconds / duration);
                    const blocked = index === 0 && progress >= 1
                      ? craftingOutputBlockReason(inventory, entry)
                      : null;
                    const cancellable = canCancelCraftingEntry(inventory, crafting, entry.id);
                    const status = blocked === 'inventory-full'
                      ? '等待背包空位'
                      : blocked === 'already-owned'
                        ? '同类工具占位'
                        : index > 0
                          ? '已备料 · 排队'
                          : progress > 0
                            ? '制作中'
                            : '已备料';
                    return (
                      <li className={`crafting-queue__entry ${index === 0 ? 'is-active' : ''} ${blocked ? 'is-blocked' : ''}`} key={entry.id}>
                        <span className="crafting-queue__index">{String(index + 1).padStart(2, '0')}</span>
                        <div className="crafting-queue__icon" style={{ '--item-tone': ITEM_DEFINITIONS[outputId].tone } as React.CSSProperties}>
                          <ItemIcon itemId={outputId} size={23} />
                        </div>
                        <div className="crafting-queue__copy">
                          <strong>{recipe.name}</strong>
                          <span className={blocked ? 'is-blocked' : ''}>{status}</span>
                        </div>
                        <button
                          type="button"
                          disabled={!cancellable}
                          onClick={() => onCancelCraft(entry.id)}
                          aria-label={`取消${recipe.name}并返还材料`}
                          title={cancellable ? '取消并返还材料' : '背包需能完整容纳返还材料'}
                        ><X size={15} /></button>
                        <div
                          className="crafting-queue__progress"
                          role="progressbar"
                          aria-label={`${recipe.name}制作进度`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.round(progress * 100)}
                        ><i style={{ transform: `scaleX(${progress})` }} /></div>
                        <small>{index === 0 ? `${Math.max(0, duration - entry.elapsedSeconds).toFixed(1)}s` : `${duration.toFixed(1)}s`}</small>
                      </li>
                    );
                  })}
                </ol>
              )}
            </aside>
          </div>
        ) : (
          <div className="field-pack__body field-pack__body--research">
            <section className="research-samples" aria-labelledby="research-samples-heading">
              <div className="crafting-heading">
                <div><Microscope size={20} /><span id="research-samples-heading">材料样本</span></div>
                <small>{progression.researched.length}/{RESEARCH_SAMPLE_IDS.length} 已建档</small>
              </div>
              <div className="research-sample-list">
                {RESEARCH_SAMPLE_IDS.map((sample) => {
                  const definition = ITEM_DEFINITIONS[sample];
                  const researched = progression.researched.includes(sample);
                  const available = itemCount(inventory, sample) > 0;
                  return (
                    <article className={`research-sample ${researched ? 'is-complete' : available ? 'is-ready' : ''}`} key={sample}>
                      <div className="research-sample__icon" style={{ '--item-tone': definition.tone } as React.CSSProperties}>
                        <ItemIcon itemId={sample} size={24} />
                      </div>
                      <div>
                        <h3>{definition.shortName}</h3>
                        <span>{researched ? '已建档' : `持有 ${itemCount(inventory, sample)}`}</span>
                      </div>
                      <button
                        type="button"
                        disabled={researched || !available}
                        onClick={() => onResearch(sample)}
                        aria-label={`研究${definition.name}`}
                      >
                        {researched ? <Check size={17} /> : <Microscope size={17} />}
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
            <section className="research-projects" aria-labelledby="research-projects-heading">
              <div className="crafting-heading">
                <div><FlaskConical size={20} /><span id="research-projects-heading">可推演项目</span></div>
                <small>{progression.learned.length}/{Object.keys(RESEARCH_PROJECTS).length} 已学习</small>
              </div>
              <div className="research-project-list">
                {(Object.keys(RESEARCH_PROJECTS) as ResearchProjectId[]).map((projectId) => {
                  const project = RESEARCH_PROJECTS[projectId];
                  const learned = progression.learned.includes(projectId);
                  const ready = canLearnProject(progression, projectId);
                  return (
                    <article className={`research-project ${learned ? 'is-complete' : ready ? 'is-ready' : ''}`} key={projectId}>
                      <header>
                        <div className="research-project__icon">
                          <ItemIcon itemId={projectId} size={28} />
                        </div>
                        <div><span>{learned ? '已学习' : ready ? '可推演' : '缺少样本'}</span><h3>{project.name}</h3></div>
                      </header>
                      <p>{project.description}</p>
                      <div className="recipe-costs">
                        {project.requirements.map((sample) => {
                          const met = progression.researched.includes(sample);
                          return <span className={met ? 'is-met' : 'is-missing'} key={sample}><ItemIcon itemId={sample} size={14} />{ITEM_DEFINITIONS[sample].shortName}</span>;
                        })}
                      </div>
                      <button className="panel-command" type="button" disabled={!ready} onClick={() => onLearn(projectId)}>
                        {learned ? <Check size={18} /> : ready ? <FlaskConical size={18} /> : <LockKeyhole size={18} />}
                        {learned ? '已写入制作记录' : '学习配方'}
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
