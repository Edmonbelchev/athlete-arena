import type { AppIconName } from '@/constants/icons';

export type ShopItemType = 'avatar' | 'frame' | 'emote';
export type ShopSlot = ShopItemType;
export type ShopCategoryFilter = 'all' | ShopItemType;
export type ShopOwnershipFilter = 'all' | 'owned' | 'unowned';

export interface ShopItemMetadata {
  icon?: AppIconName;
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  emoji?: string;
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
}

export interface ShopSummary {
  coinBalance: number;
  inventory: string[];
  equipped: Partial<Record<ShopSlot, string>>;
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
