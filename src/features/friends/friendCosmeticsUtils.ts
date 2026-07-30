import type { AppIconName } from '@/constants/icons';
import { APP_ICONS } from '@/constants/icons';
import type { ShopAvatarDisplay, ShopFrameDisplay } from '@/types/shop';

export interface PublicCosmeticsRpcRow {
  avatar_url?: string | null;
  avatar_icon?: string | null;
  avatar_background?: string | null;
  frame_border_color?: string | null;
  frame_border_width?: number | null;
}

function isAppIconName(value: string): value is AppIconName {
  return value in APP_ICONS;
}

export function mapPublicCosmetics(row: PublicCosmeticsRpcRow): {
  avatar: ShopAvatarDisplay | null;
  frame: ShopFrameDisplay | null;
} {
  const avatar: ShopAvatarDisplay = {};

  if (row.avatar_url) {
    avatar.imageUrl = row.avatar_url;
  }

  if (row.avatar_icon && isAppIconName(row.avatar_icon)) {
    avatar.icon = row.avatar_icon;
  }

  if (row.avatar_background) {
    avatar.backgroundColor = row.avatar_background;
  }

  const hasAvatar = Boolean(avatar.imageUrl || avatar.icon);

  let frame: ShopFrameDisplay | null = null;
  if (row.frame_border_color) {
    frame = {
      borderColor: row.frame_border_color,
      borderWidth: row.frame_border_width ?? 3,
    };
  }

  return {
    avatar: hasAvatar ? avatar : row.avatar_url ? { imageUrl: row.avatar_url } : null,
    frame,
  };
}
