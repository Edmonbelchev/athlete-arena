import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { DEFAULT_APPEARANCE, normalizeAccessories } from '@/features/avatar/avatarOptions';
import { useProfile } from '@/features/profile/useProfile';
import { getMyAvatar, getMyWardrobe } from '@/services/avatarService';
import type { AvatarAccessories, AvatarAppearance, WearableItem } from '@/types/avatar';

/**
 * The signed-in user's avatar and owned wearables, e.g. for "try it on" previews.
 * Must be used inside a screen: it reloads each time the screen is focused.
 */
export function useMyAvatar() {
  const { profile } = useProfile();
  const [appearance, setAppearance] = useState<AvatarAppearance>(DEFAULT_APPEARANCE.male);
  const [accessories, setAccessories] = useState<AvatarAccessories>({});
  const [wardrobe, setWardrobe] = useState<WearableItem[]>([]);

  const userId = profile?.id;

  const refresh = useCallback(async () => {
    if (!userId) {
      return;
    }

    try {
      const [avatar, items] = await Promise.all([getMyAvatar(userId), getMyWardrobe()]);
      const nextAppearance = avatar?.appearance ?? DEFAULT_APPEARANCE.male;
      setAppearance(nextAppearance);
      setWardrobe(items);
      setAccessories(normalizeAccessories(avatar?.accessories ?? {}, items, nextAppearance.bodyType));
    } catch {
      // Previews fall back to the default avatar.
    }
  }, [userId]);

  // Reload whenever the screen regains focus, e.g. returning from the avatar editor.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return { appearance, accessories, wardrobe, refresh };
}
