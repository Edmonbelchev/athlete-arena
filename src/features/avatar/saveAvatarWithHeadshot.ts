import type { RefObject } from 'react';
import { PixelRatio, type View } from 'react-native';

import { saveMyAvatar, uploadAvatarHeadshot } from '@/services/avatarService';
import { updateProfile } from '@/services/profileService';
import type { AvatarAccessories, AvatarAppearance } from '@/types/avatar';

/** Exported profile picture size in physical pixels. */
const HEADSHOT_EXPORT_PX = 384;

/**
 * Saves the avatar, then captures `portraitRef` (a view showing the saved look)
 * as the profile picture and stores its URL on the profile.
 */
export async function saveAvatarWithHeadshot({
  userId,
  appearance,
  accessories,
  portraitRef,
}: {
  userId: string;
  appearance: AvatarAppearance;
  accessories: AvatarAccessories;
  portraitRef: RefObject<View | null>;
}): Promise<void> {
  const version = await saveMyAvatar(appearance, accessories);
  // Loaded on demand: the native module throws on import in dev builds made before it was added.
  const { captureRef } = await import('react-native-view-shot');
  const exportSize = HEADSHOT_EXPORT_PX / PixelRatio.get();
  const pngBase64 = await captureRef(portraitRef, {
    format: 'png',
    quality: 1,
    result: 'base64',
    width: exportSize,
    height: exportSize,
  });
  const avatarUrl = await uploadAvatarHeadshot(userId, pngBase64, version);
  await updateProfile(userId, { avatar_url: avatarUrl });
}
