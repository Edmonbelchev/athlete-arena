import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { Radius, Spacing } from '@/constants/theme';
import { getAvatarInitials } from '@/features/profile/avatarInitials';
import { useTheme } from '@/hooks/use-theme';

import type { ShopAvatarDisplay, ShopFrameDisplay } from '@/types/shop';

interface ProfileAvatarProps {
  uri?: string | null;
  name: string;
  size?: number;
  shopAvatar?: ShopAvatarDisplay | null;
  frame?: ShopFrameDisplay | null;
}

export function ProfileAvatar({
  uri,
  name,
  size = 96,
  shopAvatar,
  frame,
}: ProfileAvatarProps) {
  const theme = useTheme();
  const radius = size >= 96 ? Radius.xl : size / 2;
  const initials = getAvatarInitials(name);
  const fontSize = Math.round(size * (initials.length > 1 ? 0.34 : 0.42));
  const frameWidth = frame?.borderWidth ?? 0;
  const outerSize = size + frameWidth * 2;

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

  if (!frame) {
    return avatarBody;
  }

  return (
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
  );
}

interface ProfileAvatarSelectorProps {
  avatars: Array<{
    id: string;
    title: string;
    imageUrl: string | null;
    icon?: ShopAvatarDisplay['icon'];
    backgroundColor?: string;
    owned: boolean;
    equipped: boolean;
  }>;
  displayName: string;
  isUpdating?: boolean;
  onSelect: (itemId: string) => void;
  onOpenShop?: () => void;
}

export function ProfileAvatarSelector({
  avatars,
  displayName,
  isUpdating = false,
  onSelect,
  onOpenShop,
}: ProfileAvatarSelectorProps) {
  const theme = useTheme();
  const ownedAvatars = avatars.filter((avatar) => avatar.owned);

  return (
    <View style={styles.selectorContainer}>
      <Text style={StyleSheet.flatten([styles.selectorTitle, { color: theme.textSecondary }])}>
        Choose your avatar
      </Text>

      <View style={styles.selectorGrid}>
        {ownedAvatars.map((avatar) => (
          <Pressable
            key={avatar.id}
            accessibilityRole="button"
            accessibilityLabel={`Select ${avatar.title} avatar`}
            disabled={isUpdating}
            onPress={() => onSelect(avatar.id)}
            style={StyleSheet.flatten([
              styles.selectorItem,
              {
                borderColor: avatar.equipped ? theme.primary : theme.border,
                backgroundColor: theme.backgroundElement,
              },
            ])}>
            <ProfileAvatar
              name={displayName}
              size={72}
              shopAvatar={{
                imageUrl: avatar.imageUrl,
                icon: avatar.icon,
                backgroundColor: avatar.backgroundColor,
              }}
            />
            <Text style={StyleSheet.flatten([styles.selectorLabel, { color: theme.text }])}>{avatar.title}</Text>
            {avatar.equipped ? (
              <Text style={StyleSheet.flatten([styles.equippedTag, { color: theme.primary }])}>Equipped</Text>
            ) : null}
          </Pressable>
        ))}
      </View>

      {isUpdating ? <ActivityIndicator color={theme.primary} /> : null}

      {onOpenShop ? (
        <Pressable onPress={onOpenShop}>
          <Text style={StyleSheet.flatten([styles.shopLink, { color: theme.primary }])}>
            Browse more avatars in the Shop
          </Text>
        </Pressable>
      ) : null}
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
  selectorContainer: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  selectorTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  selectorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
    alignSelf: 'stretch',
  },
  selectorItem: {
    width: 108,
    borderRadius: Radius.lg,
    borderWidth: 2,
    padding: Spacing.two,
    alignItems: 'center',
    gap: Spacing.one,
  },
  selectorLabel: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  equippedTag: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  shopLink: {
    fontSize: 14,
    fontWeight: '700',
  },
});
