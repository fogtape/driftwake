import { useEffect, useMemo, useState } from 'react';
import {
  Backpack,
  Check,
  ChevronRight,
  FlaskConical,
  Hammer,
  HeartPulse,
  MapPin,
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
import { RECIPES, missingForRecipe, type CraftResult, type RecipeId } from '../game/domain/recipes';
import type { DeviceType } from '../game/domain/devices';
import type { OverlayPanel, RaftFeedback } from '../state/gameStore';
import { ItemIcon } from './ItemIcon';

interface FieldPackPanelProps {
  panel: OverlayPanel;
  inventory: Inventory;
  inventorySlots: number;
  raft: RaftFeedback;
  saveStatus: 'idle' | 'saved' | 'error';
  onPanelChange: (panel: Exclude<OverlayPanel, null>) => void;
  onCraft: (recipeId: RecipeId) => CraftResult;
  onUse: (itemId: ItemId) => boolean;
  onPlace: (deviceType: DeviceType) => void;
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
const PLACEABLES: Partial<Record<ItemId, DeviceType>> = {
  purifierKit: 'purifier',
  grillKit: 'grill',
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
  saveStatus,
  onPanelChange,
  onCraft,
  onUse,
  onPlace,
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

  useEffect(() => {
    if (itemCount(inventory, selectedItem) <= 0 && itemIds[0]) setSelectedItem(itemIds[0]);
  }, [inventory, itemIds, selectedItem]);

  if (!panel) return null;
  const selectedDefinition = ITEM_DEFINITIONS[selectedItem];
  const emptySlots = Math.max(0, INVENTORY_SLOT_CAPACITY - stacks.length);

  return (
    <div className="modal-layer field-pack-layer" role="presentation">
      <section className="field-pack" role="dialog" aria-modal="true" aria-labelledby="field-pack-heading">
        <header className="field-pack__header">
          <div className="field-pack__identity">
            <Backpack size={22} />
            <div>
              <span>航次装备</span>
              <h2 id="field-pack-heading">野外背包</h2>
            </div>
          </div>
          <nav className="field-pack__tabs" aria-label="背包视图">
            <button className={panel === 'pack' ? 'is-active' : ''} type="button" onClick={() => onPanelChange('pack')}>
              <PackageOpen size={18} />
              物资
            </button>
            <button className={panel === 'crafting' ? 'is-active' : ''} type="button" onClick={() => onPanelChange('crafting')}>
              <Hammer size={18} />
              制作
            </button>
          </nav>
          <button className="icon-command icon-command--dark" type="button" onClick={onClose} aria-label="关闭背包" title="关闭">
            <X size={20} />
          </button>
        </header>

        <div className="field-pack__status">
          <span><PackageOpen size={15} /> {inventorySlots}/{INVENTORY_SLOT_CAPACITY}</span>
          <span><ShieldCheck size={15} /> 筏体 {raft.averageIntegrity}%</span>
          <span className={`save-indicator save-indicator--${saveStatus}`}>
            <Check size={14} /> {saveStatus === 'error' ? '存档异常' : saveStatus === 'saved' ? '航迹已记录' : '航迹记录中'}
          </span>
        </div>

        {panel === 'pack' ? (
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
        ) : (
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
                const canCraft = Object.keys(missing).length === 0 && !alreadyOwned;
                return (
                  <article className={`recipe-row ${canCraft ? 'is-ready' : ''}`} key={recipeId}>
                    <div className="recipe-row__icon" style={{ '--item-tone': ITEM_DEFINITIONS[outputId].tone } as React.CSSProperties}>
                      <ItemIcon itemId={outputId} size={29} />
                    </div>
                    <div className="recipe-row__copy">
                      <h3>{recipe.name}</h3>
                      <p>{recipe.description}</p>
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
                      {alreadyOwned ? <Check size={19} /> : <ChevronRight size={20} />}
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
