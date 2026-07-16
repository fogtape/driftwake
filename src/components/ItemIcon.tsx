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
  Gem,
  Leaf,
  Layers3,
  Package,
  Pickaxe,
  Recycle,
  Sailboat,
  Sprout,
  Shell,
  Citrus,
  Sword,
  TreePine,
  Waves,
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
  sand: Shell,
  clay: Layers3,
  metalOre: Gem,
  seaweed: Waves,
  emptyCup: CupSoda,
  purifierKit: GlassWater,
  grillKit: CookingPot,
  sailKit: Sailboat,
  anchorKit: Anchor,
  planterKit: Sprout,
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
