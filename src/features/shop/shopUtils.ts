import type { AppIconName } from '@/constants/icons';
import { APP_ICONS } from '@/constants/icons';
import type {
  ShopAvatarDisplay,
  ShopFrameDisplay,
  ShopItemMetadata,
  ShopItemRecord,
  ShopItemType,
  ShopSlot,
  ShopSummary,
} from '@/types/shop';

interface ShopCatalogRpcRow {
  id: string;
  item_type: string;
  title: string;
  description: string;
  image_url: string | null;
  price_coins: number;
  sort_order: number;
  metadata: unknown;
  owned: boolean;
  equipped: boolean;
}

interface ShopSummaryRpc {
  coin_balance: number;
  inventory: string[];
  equipped: Partial<Record<ShopSlot, string>>;
  coin_multiplier?: number;
  coin_multiplier_expires_at?: string | null;
}

function isShopItemType(value: string): value is ShopItemType {
  return value === 'avatar' || value === 'frame' || value === 'emote';
}

function isAppIconName(value: string): value is AppIconName {
  return value in APP_ICONS;
}

export function parseShopItemMetadata(value: unknown): ShopItemMetadata {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const record = value as Record<string, unknown>;
  const metadata: ShopItemMetadata = {};

  if (typeof record.icon === 'string' && isAppIconName(record.icon)) {
    metadata.icon = record.icon;
  }

  if (typeof record.backgroundColor === 'string') {
    metadata.backgroundColor = record.backgroundColor;
  }

  if (typeof record.borderColor === 'string') {
    metadata.borderColor = record.borderColor;
  }

  if (typeof record.borderWidth === 'number') {
    metadata.borderWidth = record.borderWidth;
  }

  if (typeof record.emoji === 'string') {
    metadata.emoji = record.emoji;
  }

  return metadata;
}

export function mapShopItem(row: ShopCatalogRpcRow): ShopItemRecord | null {
  if (!isShopItemType(row.item_type)) {
    return null;
  }

  return {
    id: row.id,
    itemType: row.item_type,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    priceCoins: row.price_coins,
    sortOrder: row.sort_order,
    metadata: parseShopItemMetadata(row.metadata),
    owned: row.owned,
    equipped: row.equipped,
  };
}

export function mapShopSummary(value: unknown): ShopSummary {
  const record = (value ?? {}) as ShopSummaryRpc;

  return {
    coinBalance: typeof record.coin_balance === 'number' ? record.coin_balance : 0,
    inventory: Array.isArray(record.inventory) ? record.inventory.filter((item) => typeof item === 'string') : [],
    equipped: record.equipped ?? {},
    coinMultiplier: typeof record.coin_multiplier === 'number' ? record.coin_multiplier : 1,
    coinMultiplierExpiresAt:
      typeof record.coin_multiplier_expires_at === 'string' ? record.coin_multiplier_expires_at : null,
  };
}

export function getEquippedItem(
  items: ShopItemRecord[],
  equipped: Partial<Record<ShopSlot, string>>,
  slot: ShopSlot,
): ShopItemRecord | null {
  const itemId = equipped[slot];
  if (!itemId) {
    return null;
  }

  return items.find((item) => item.id === itemId) ?? null;
}

export function resolveShopAvatar(item: ShopItemRecord | null): ShopAvatarDisplay | null {
  if (!item || item.itemType !== 'avatar') {
    return null;
  }

  return {
    imageUrl: item.imageUrl,
    icon: item.metadata.icon,
    backgroundColor: item.metadata.backgroundColor,
  };
}

export function resolveShopFrame(item: ShopItemRecord | null): ShopFrameDisplay | null {
  if (!item || item.itemType !== 'frame') {
    return null;
  }

  return {
    borderColor: item.metadata.borderColor ?? '#F59E0B',
    borderWidth: item.metadata.borderWidth ?? 3,
  };
}

export function resolveShopEmote(item: ShopItemRecord | null): string | null {
  if (!item || item.itemType !== 'emote') {
    return null;
  }

  return item.metadata.emoji ?? null;
}

export function getOwnedEmotes(items: ShopItemRecord[]): ShopItemRecord[] {
  return items.filter(
    (item) => item.itemType === 'emote' && item.owned && item.id !== 'emote_trophy',
  );
}
