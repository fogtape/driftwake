import { useEffect, useMemo, useState } from 'react';
import {
  Backpack,
  Check,
  ChevronRight,
  FlaskConical,
  Hammer,
  HeartPulse,
  LockKeyhole,
  MapPin,
  Microscope,
  MoveLeft,
  MoveRight,
  PackageOpen,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  INVENTORY_SLOT_CAPACITY,
  ITEM_DEFINITIONS,
  itemCount,
  type Inventory,
  type ItemId,
} from '../game/domain/items';
import { RECIPES, isRecipeUnlocked, missingForRecipe, type CraftResult, type RecipeId } from '../game/domain/recipes';
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
  inventorySlots: number;
  raft: RaftFeedback;
  progression: ProgressionFeedback;
  storage: StorageFeedback | null;
  saveStatus: 'idle' | 'saved' | 'error';
  onPanelChange: (panel: Exclude<OverlayPanel, null>) => void;
  onCraft: (recipeId: RecipeId) => CraftResult;
  onUse: (itemId: ItemId) => boolean;
  onPlace: (deviceType: PlacementType) => void;
  onResearch: (sample: ResearchSampleId) => ResearchSampleResult;
  onLearn: (projectId: ResearchProjectId) => boolean;
  onStorageTransfer: (itemId: ItemId, direction: 'to-storage' | 'to-pack') => boolean;
  onClose: () => void;
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
  inventorySlots,
  raft,
  progression,
  storage,
  saveStatus,
  onPanelChange,
  onCraft,
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
  const stacks = useMemo(
    () =>
      itemIds.flatMap((itemId) => {
        const maxStack = ITEM_DEFINITIONS[itemId].maxStack;
        const count = itemCount(inventory, itemId);
        return Array.from({ length: Math.ceil(count / maxStack) }, (_, index) => ({
          itemId,
          count: Math.min(maxStack, count - index * maxStack),
          stackIndex: index,
        }));
      }),
    [inventory, itemIds],
  );
  const [selectedItem, setSelectedItem] = useState<ItemId>('hook');
  const storageItemIds = useMemo(
    () => storage ? (Object.keys(ITEM_DEFINITIONS) as ItemId[]).filter((id) => itemCount(storage.inventory, id) > 0) : [],
    [storage],
  );
  const storageStacks = useMemo(
    () => storageItemIds.flatMap((itemId) => {
      const maxStack = ITEM_DEFINITIONS[itemId].maxStack;
      const count = storage ? itemCount(storage.inventory, itemId) : 0;
      return Array.from({ length: Math.ceil(count / maxStack) }, (_, index) => ({
        itemId,
        count: Math.min(maxStack, count - index * maxStack),
        stackIndex: index,
      }));
    }),
    [storage, storageItemIds],
  );

  useEffect(() => {
    if (itemCount(inventory, selectedItem) <= 0 && itemIds[0]) setSelectedItem(itemIds[0]);
  }, [inventory, itemIds, selectedItem]);

  if (!panel || (panel === 'storage' && !storage)) return null;
  const selectedDefinition = ITEM_DEFINITIONS[selectedItem];
  const emptySlots = Math.max(0, INVENTORY_SLOT_CAPACITY - stacks.length);

  return (
    <div className="modal-layer field-pack-layer" role="presentation">
      <section className="field-pack" role="dialog" aria-modal="true" aria-labelledby="field-pack-heading">
        <header className="field-pack__header">
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
            <section className="storage-inventory" aria-labelledby="storage-pack-heading">
              <div className="crafting-heading">
                <div><Backpack size={20} /><span id="storage-pack-heading">随身背包</span></div>
                <small>{inventorySlots}/{INVENTORY_SLOT_CAPACITY}</small>
              </div>
              <div className="inventory-grid inventory-grid--storage" aria-label="可存入的背包物品">
                {stacks.map(({ itemId, count, stackIndex }) => {
                  const definition = ITEM_DEFINITIONS[itemId];
                  return (
                    <button
                      key={`pack-${itemId}-${stackIndex}`}
                      className="inventory-slot storage-transfer-slot"
                      type="button"
                      disabled={itemId === 'hook'}
                      onClick={() => onStorageTransfer(itemId, 'to-storage')}
                      style={{ '--item-tone': definition.tone } as React.CSSProperties}
                      aria-label={`将${definition.name}移入干舱`}
                      title={itemId === 'hook' ? '打捞钩保留在随身工具位' : '移入干舱'}
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

            <div className="storage-transfer-axis" aria-hidden="true"><MoveRight size={18} /><MoveLeft size={18} /></div>

            <section className="storage-inventory" aria-labelledby="storage-hold-heading">
              <div className="crafting-heading">
                <div><PackageOpen size={20} /><span id="storage-hold-heading">密封干舱</span></div>
                <small>{storage.slots}/{storage.capacity}</small>
              </div>
              <div className="inventory-grid inventory-grid--storage inventory-grid--locker" aria-label="干舱物品">
                {storageStacks.map(({ itemId, count, stackIndex }) => {
                  const definition = ITEM_DEFINITIONS[itemId];
                  return (
                    <button
                      key={`hold-${itemId}-${stackIndex}`}
                      className="inventory-slot storage-transfer-slot"
                      type="button"
                      onClick={() => onStorageTransfer(itemId, 'to-pack')}
                      style={{ '--item-tone': definition.tone } as React.CSSProperties}
                      aria-label={`将${definition.name}移回背包`}
                      title="移回背包"
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
            <div className="crafting-heading">
              <div><FlaskConical size={20} /><span>便携制作</span></div>
            </div>
            <div className="recipe-list">
              {(Object.keys(RECIPES) as RecipeId[]).map((recipeId) => {
                const recipe = RECIPES[recipeId];
                const outputId = Object.keys(recipe.output)[0] as ItemId;
                const missing = missingForRecipe(inventory, recipeId);
                const alreadyOwned = ITEM_DEFINITIONS[outputId].category === 'tool' && itemCount(inventory, outputId) > 0;
                const unlocked = isRecipeUnlocked(recipeId, progression.learned);
                const canCraft = unlocked && Object.keys(missing).length === 0 && !alreadyOwned;
                return (
                  <article className={`recipe-row ${canCraft ? 'is-ready' : ''} ${unlocked ? '' : 'is-locked'}`} key={recipeId}>
                    <div className="recipe-row__icon" style={{ '--item-tone': ITEM_DEFINITIONS[outputId].tone } as React.CSSProperties}>
                      <ItemIcon itemId={outputId} size={29} />
                    </div>
                    <div className="recipe-row__copy">
                      <h3>{recipe.name}</h3>
                      <p>{unlocked ? recipe.description : '需要在盐迹研究台完成材料推演。'}</p>
                      <div className="recipe-costs">
                        {(Object.entries(recipe.cost) as [ItemId, number][]).map(([itemId, amount]) => {
                          const enough = itemCount(inventory, itemId) >= amount;
                          return (
                            <span className={enough ? 'is-met' : 'is-missing'} key={itemId}>
                              <ItemIcon itemId={itemId} size={14} />
                              {itemCount(inventory, itemId)}/{amount}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <button className="recipe-command" type="button" disabled={!canCraft} onClick={() => onCraft(recipeId)} aria-label={`制作${recipe.name}`}>
                      {!unlocked ? <LockKeyhole size={18} /> : alreadyOwned ? <Check size={19} /> : <ChevronRight size={20} />}
                    </button>
                  </article>
                );
              })}
            </div>
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
