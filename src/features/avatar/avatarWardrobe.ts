import type {
  AccessorySlot,
  AvatarAccessories,
  AvatarAccessoryStyles,
  WearableBodyType,
  WearableItem,
  WearablePattern,
  WearableStyle,
  WearableTier,
} from '@/types/avatar';

export interface WardrobeRpcRow {
  id: string;
  title: string;
  description: string;
  price_coins: number;
  sort_order: number;
  metadata: unknown;
  owned: boolean;
}

const SLOTS: AccessorySlot[] = ['top', 'headwear', 'glasses', 'earrings'];
const STYLES: WearableStyle[] = [
  'tee',
  'hoodie',
  'headband',
  'cap',
  'cap_back',
  'bucket',
  'visor',
  'beanie',
  'crown',
  'round_glasses',
  'square_glasses',
  'sunglasses',
  'aviators',
  'studs',
  'hoops',
  'drops',
];
const PATTERNS: WearablePattern[] = ['stripe', 'star', 'camo'];
const TIERS: WearableTier[] = ['basic', 'rare', 'legendary'];
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

export function mapWearableItem(row: WardrobeRpcRow): WearableItem | null {
  const metadata =
    row.metadata && typeof row.metadata === 'object' ? (row.metadata as Record<string, unknown>) : {};
  const colors =
    metadata.colors && typeof metadata.colors === 'object'
      ? (metadata.colors as Record<string, unknown>)
      : {};
  const bodyType = metadata.bodyType;

  if (!isOneOf(SLOTS, metadata.slot) || !isOneOf(STYLES, metadata.style)) {
    return null;
  }

  if (bodyType !== 'male' && bodyType !== 'female' && bodyType !== 'unisex') {
    return null;
  }

  const primary = typeof colors.primary === 'string' && HEX_COLOR.test(colors.primary) ? colors.primary : '#64748B';
  const secondary =
    typeof colors.secondary === 'string' && HEX_COLOR.test(colors.secondary) ? colors.secondary : primary;

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    priceCoins: row.price_coins,
    sortOrder: row.sort_order,
    slot: metadata.slot,
    bodyType: bodyType as WearableBodyType,
    style: metadata.style,
    colors: { primary, secondary },
    pattern: isOneOf(PATTERNS, metadata.pattern) ? metadata.pattern : undefined,
    tier: isOneOf(TIERS, metadata.tier) ? metadata.tier : undefined,
    starter: metadata.starter === true,
    owned: row.owned,
  };
}

export function parseAccessories(value: unknown): AvatarAccessories {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const record = value as Record<string, unknown>;
  const accessories: AvatarAccessories = {};
  for (const slot of SLOTS) {
    if (typeof record[slot] === 'string') {
      accessories[slot] = record[slot] as string;
    }
  }
  return accessories;
}

/** Resolves equipped item ids to the styles and colors the renderer needs. */
export function toAccessoryStyles(
  accessories: AvatarAccessories,
  wardrobe: WearableItem[]
): AvatarAccessoryStyles {
  const styles: AvatarAccessoryStyles = {};

  for (const slot of SLOTS) {
    const item = wardrobe.find((entry) => entry.id === accessories[slot]);
    if (item) {
      styles[slot] = { style: item.style, colors: item.colors, pattern: item.pattern };
    }
  }

  return styles;
}
