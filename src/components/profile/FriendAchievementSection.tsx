import { Image } from 'expo-image';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { HomeSection } from '@/components/home/HomeSection';
import { AppIcon } from '@/components/ui/AppIcon';
import { Radius, Spacing } from '@/constants/theme';
import type { FriendAchievementSummary } from '@/types/achievements';
import { useTheme } from '@/hooks/use-theme';

interface FriendAchievementSectionProps {
  achievements: FriendAchievementSummary[];
  isLoading?: boolean;
  error?: string | null;
}

function formatUnlockedDate(unlockedAt: string): string {
  return new Date(unlockedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function FriendAchievementSection({
  achievements,
  isLoading = false,
  error = null,
}: FriendAchievementSectionProps) {
  const theme = useTheme();

  return (
    <HomeSection
      title="Achievements"
      subtitle="Badges earned in the arena"
      badge={achievements.length > 0 ? achievements.length : undefined}>
      <View
        style={StyleSheet.flatten([
          styles.card,
          { backgroundColor: theme.card, borderColor: theme.border },
        ])}>
        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.primary} />
          </View>
        ) : error ? (
          <Text style={StyleSheet.flatten([styles.empty, { color: theme.danger }])}>{error}</Text>
        ) : achievements.length === 0 ? (
          <Text style={StyleSheet.flatten([styles.empty, { color: theme.textSecondary }])}>
            No achievements unlocked yet.
          </Text>
        ) : (
          <View style={styles.grid}>
            {achievements.map((achievement) => (
              <View
                key={achievement.id}
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
                <Text
                  style={StyleSheet.flatten([styles.description, { color: theme.textSecondary }])}
                  numberOfLines={2}>
                  {achievement.description}
                </Text>
                <Text style={StyleSheet.flatten([styles.date, { color: theme.textSecondary }])}>
                  {formatUnlockedDate(achievement.unlockedAt)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </HomeSection>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.three,
  },
  loading: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
  },
  empty: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: Spacing.two,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tile: {
    width: '48%',
    flexGrow: 1,
    minWidth: 140,
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
