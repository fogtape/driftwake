import {
  Anchor,
  Axe,
  CircleDashed,
  Cog,
  CookingPot,
  CupSoda,
  Droplet,
  Fish,
  Flame,
  FlameKindling,
  GlassWater,
  Hammer,
  Leaf,
  Package,
  Pickaxe,
  Recycle,
  Sprout,
  Citrus,
  Sword,
  TreePine,
  type LucideProps,
} from 'lucide-react';
import type { ItemId } from '../game/domain/items';

const ICONS: Record<ItemId, React.ComponentType<LucideProps>> = {
  timber: TreePine,
  polymer: Recycle,
  fiber: Leaf,
  scrap: Cog,
  rope: CircleDashed,
  stone: Pickaxe,
  palmSeed: Sprout,
  emptyCup: CupSoda,
  purifierKit: GlassWater,
  grillKit: CookingPot,
  hook: Anchor,
  hammer: Hammer,
  spear: Sword,
  fishingRod: Fish,
  axe: Axe,
  emergencyWater: Droplet,
  freshWaterCup: GlassWater,
  ration: Package,
  palmFruit: Citrus,
  rawFish: Fish,
  cookedFish: Flame,
  burntFish: FlameKindling,
};

interface ItemIconProps extends LucideProps {
  itemId: ItemId;
}

export function ItemIcon({ itemId, ...props }: ItemIconProps) {
  const Icon = ICONS[itemId];
  return <Icon {...props} />;
}
