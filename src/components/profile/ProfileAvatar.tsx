import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { Radius } from '@/constants/theme';
import { getAvatarInitials } from '@/features/profile/avatarInitials';
import { useTheme } from '@/hooks/use-theme';

import type { ShopAvatarDisplay, ShopFrameDisplay } from '@/types/shop';

interface ProfileAvatarProps {
  uri?: string | null;
  name: string;
  size?: number;
  shopAvatar?: ShopAvatarDisplay | null;
  frame?: ShopFrameDisplay | null;
  /** Self-only premium indicator; do not pass on other users' avatars. */
  showPremiumCrown?: boolean;
}

export function ProfileAvatar({
  uri,
  name,
  size = 96,
  shopAvatar,
  frame,
  showPremiumCrown = false,
}: ProfileAvatarProps) {
  const theme = useTheme();
  const radius = size >= 96 ? Radius.xl : size / 2;
  const initials = getAvatarInitials(name);
  const fontSize = Math.round(size * (initials.length > 1 ? 0.34 : 0.42));
  const frameWidth = frame?.borderWidth ?? 0;
  const outerSize = size + frameWidth * 2;
  const crownBadgeSize = Math.max(20, Math.round(size * 0.3));
  const crownIconSize = Math.max(11, Math.round(crownBadgeSize * 0.58));

  const imageUri = shopAvatar?.imageUrl ?? uri ?? null;
  const icon = shopAvatar?.icon;
  const backgroundColor = shopAvatar?.backgroundColor ?? theme.primary;

  const avatarBody = imageUri ? (
    <Image
      source={{ uri: imageUri }}
      style={[
        styles.image,
        {
          width: size,
          height: size,
          borderRadius: radius,
        },
      ]}
      contentFit="cover"
      accessibilityLabel={`${name} profile photo`}
    />
  ) : icon ? (
    <View
      style={StyleSheet.flatten([
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor,
        },
      ])}>
      <AppIcon name={icon} size={Math.round(size * 0.42)} color="#FFFFFF" />
    </View>
  ) : (
    <View
      style={StyleSheet.flatten([
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: theme.primary,
        },
      ])}>
      <Text style={[styles.initial, { fontSize, letterSpacing: initials.length > 1 ? -0.5 : 0 }]}>
        {initials}
      </Text>
    </View>
  );

  const avatarContent = frame ? (
    <View
      style={StyleSheet.flatten([
        styles.frameWrap,
        {
          width: outerSize,
          height: outerSize,
          borderRadius: radius + frameWidth,
          borderColor: frame.borderColor,
          borderWidth: frameWidth,
        },
      ])}>
      {avatarBody}
    </View>
  ) : (
    avatarBody
  );

  if (!showPremiumCrown) {
    return avatarContent;
  }

  return (
    <View
      style={[
        styles.crownWrap,
        {
          width: frame ? outerSize : size,
          height: frame ? outerSize : size,
        },
      ]}
      accessibilityLabel={`${name} profile photo, premium member`}>
      {avatarContent}
      <View
        style={[
          styles.premiumCrownBadge,
          {
            width: crownBadgeSize,
            height: crownBadgeSize,
            borderRadius: crownBadgeSize / 2,
            backgroundColor: theme.streak,
            borderColor: theme.card,
          },
        ]}>
        <AppIcon name="crown" size={crownIconSize} color="#FFFFFF" weight="bold" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    borderWidth: 0,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  frameWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  crownWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumCrownBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
