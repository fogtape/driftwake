import {
  Anchor,
  CircleDashed,
  Cog,
  Droplet,
  Fish,
  Flame,
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
  hook: Anchor,
  hammer: Hammer,
  spear: Sword,
  fishingRod: Fish,
  emergencyWater: Droplet,
  ration: Package,
  rawFish: Fish,
  cookedFish: Flame,
};

interface ItemIconProps extends LucideProps {
  itemId: ItemId;
}

export function ItemIcon({ itemId, ...props }: ItemIconProps) {
  const Icon = ICONS[itemId];
  return <Icon {...props} />;
}
