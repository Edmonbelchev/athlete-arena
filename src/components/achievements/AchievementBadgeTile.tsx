import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import type { AppIconName } from '@/constants/icons';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface AchievementBadgeTileProps {
  achievement: {
    title: string;
    description: string;
    imageUrl: string | null;
    icon: AppIconName;
    unlockedAt: string | null;
  };
}

function formatUnlockedDate(unlockedAt: string): string {
  return new Date(unlockedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Unlocked achievement badge, laid out two per row (see `achievementGridStyles`). */
export function AchievementBadgeTile({ achievement }: AchievementBadgeTileProps) {
  const theme = useTheme();

  return (
    <View
      style={StyleSheet.flatten([
        styles.tile,
        { backgroundColor: theme.backgroundElement, borderColor: theme.primary },
      ])}>
      <View
        style={StyleSheet.flatten([
          styles.iconWrap,
          { backgroundColor: theme.backgroundSelected, borderColor: theme.border },
        ])}>
        {achievement.imageUrl ? (
          <Image source={{ uri: achievement.imageUrl }} style={styles.image} contentFit="cover" />
        ) : (
          <AppIcon name={achievement.icon} size={24} color={theme.primary} />
        )}
      </View>
      <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])} numberOfLines={2}>
        {achievement.title}
      </Text>
      <Text style={StyleSheet.flatten([styles.description, { color: theme.textSecondary }])} numberOfLines={2}>
        {achievement.description}
      </Text>
      {achievement.unlockedAt ? (
        <Text style={StyleSheet.flatten([styles.date, { color: theme.textSecondary }])}>
          {formatUnlockedDate(achievement.unlockedAt)}
        </Text>
      ) : null}
    </View>
  );
}

export const achievementGridStyles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.two,
  },
});

const styles = StyleSheet.create({
  tile: {
    width: '48.5%',
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.two,
    gap: Spacing.one,
    alignItems: 'center',
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  description: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  date: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
