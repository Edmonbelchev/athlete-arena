import type { AppIconName } from '@/constants/icons';
import type { WearableItem, WearableTier } from '@/types/avatar';

export type ShopItemType = 'avatar' | 'frame' | 'emote' | 'wearable' | 'challenge_slots';
/** Slots equipped through equip_shop_item (avatar cosmetics use the avatar editor instead). */
export type ShopSlot = 'avatar' | 'frame' | 'emote';
export type ShopCategoryFilter = 'all' | ShopItemType;
export type ShopOwnershipFilter = 'all' | 'owned' | 'unowned';

export interface ShopItemMetadata {
  icon?: AppIconName;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  emoji?: string;
  /** Price tier for emotes and frames (wearables carry it on `wearable`). */
  tier?: WearableTier;
}

export interface ShopItemRecord {
  id: string;
  itemType: ShopItemType;
  title: string;
  description: string;
  imageUrl: string | null;
  priceCoins: number;
  sortOrder: number;
  metadata: ShopItemMetadata;
  owned: boolean;
  equipped: boolean;
  /** Set for avatar cosmetics (item type 'wearable'). */
  wearable: WearableItem | null;
  /** Set for challenge slot packs: slots granted and coins saved versus buying singles. */
  slotPack: { slots: number; savings: number } | null;
}

export interface ShopSummary {
  coinBalance: number;
  inventory: string[];
  equipped: Partial<Record<ShopSlot, string>>;
  /** 2 while the daily spin wheel buff is active, otherwise 1. */
  coinMultiplier: number;
  coinMultiplierExpiresAt: string | null;
}

export interface ShopAvatarDisplay {
  imageUrl?: string | null;
  icon?: AppIconName;
  backgroundColor?: string;
}

export interface ShopFrameDisplay {
  borderColor: string;
  borderWidth: number;
}
