import { useEffect, useRef, useState } from 'react';
import { PixelRatio, StyleSheet, View } from 'react-native';

import { AvatarPortrait } from '@/components/avatar/AvatarPortrait';
import { normalizeAccessories } from '@/features/avatar/avatarOptions';
import { toAccessoryStyles } from '@/features/avatar/avatarWardrobe';
import { useProfile } from '@/features/profile/useProfile';
import { getMyAvatar, getMyWardrobe, uploadAvatarHeadshot } from '@/services/avatarService';
import { updateProfile } from '@/services/profileService';
import type { AvatarAccessoryStyles, AvatarAppearance } from '@/types/avatar';

const EXPORT_PX = 384;
const RENDER_SIZE = 128;
/** Gives the SVG a moment to paint before it is captured. */
const CAPTURE_DELAY_MS = 300;

interface PendingHeadshot {
  appearance: AvatarAppearance;
  accessories: AvatarAccessoryStyles;
  version: number;
}

/**
 * Users who have an avatar but no profile picture yet (e.g. the default avatar
 * created for existing accounts) get their headshot rendered off-screen and
 * uploaded once, so friends and leaderboards show it too.
 */
export function AvatarHeadshotSync() {
  const { profile, refresh } = useProfile();
  const [pending, setPending] = useState<PendingHeadshot | null>(null);
  const attemptedFor = useRef<string | null>(null);
  const viewRef = useRef<View>(null);

  const userId = profile?.id;
  const needsHeadshot = Boolean(profile && !profile.avatar_url);

  useEffect(() => {
    if (!userId || !needsHeadshot || attemptedFor.current === userId) {
      return;
    }

    attemptedFor.current = userId;
    let cancelled = false;

    async function load(id: string) {
      try {
        const [avatar, wardrobe] = await Promise.all([getMyAvatar(id), getMyWardrobe()]);
        if (cancelled || !avatar) {
          return;
        }

        const accessories = normalizeAccessories(avatar.accessories, wardrobe, avatar.appearance.bodyType);
        setPending({
          appearance: avatar.appearance,
          accessories: toAccessoryStyles(accessories, wardrobe),
          version: avatar.version,
        });
      } catch {
        // Not critical: the profile keeps its initials until the next attempt.
      }
    }

    void load(userId);

    return () => {
      cancelled = true;
    };
  }, [needsHeadshot, userId]);

  useEffect(() => {
    if (!pending || !userId) {
      return;
    }

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const { captureRef } = await import('react-native-view-shot');
          const exportSize = EXPORT_PX / PixelRatio.get();
          const pngBase64 = await captureRef(viewRef, {
            format: 'png',
            quality: 1,
            result: 'base64',
            width: exportSize,
            height: exportSize,
          });
          const avatarUrl = await uploadAvatarHeadshot(userId, pngBase64, pending.version);
          await updateProfile(userId, { avatar_url: avatarUrl });
          await refresh();
        } catch {
          // Capture needs a dev build with react-native-view-shot; retried next launch.
        } finally {
          setPending(null);
        }
      })();
    }, CAPTURE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [pending, refresh, userId]);

  if (!pending) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.offscreen}>
      <View ref={viewRef} collapsable={false}>
        <AvatarPortrait
          appearance={pending.appearance}
          accessories={pending.accessories}
          size={RENDER_SIZE}
          showBackground
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  offscreen: {
    position: 'absolute',
    top: 0,
    left: -10000,
  },
});
