import {
  Anchor,
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
  Recycle,
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
  emptyCup: CupSoda,
  purifierKit: GlassWater,
  grillKit: CookingPot,
  hook: Anchor,
  hammer: Hammer,
  spear: Sword,
  fishingRod: Fish,
  emergencyWater: Droplet,
  freshWaterCup: GlassWater,
  ration: Package,
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
