import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AchievementBadgeTile, achievementGridStyles } from '@/components/achievements/AchievementBadgeTile';
import { HomeSection } from '@/components/home/HomeSection';
import { Radius, Spacing } from '@/constants/theme';
import { ACHIEVEMENT_PREVIEW_LIMIT, type FriendAchievementSummary } from '@/types/achievements';
import { useTheme } from '@/hooks/use-theme';

interface FriendAchievementSectionProps {
  achievements: FriendAchievementSummary[];
  isLoading?: boolean;
  error?: string | null;
  /** Opens the full list; the link only shows when there are more than the preview. */
  onViewAll?: () => void;
}

export function FriendAchievementSection({
  achievements,
  isLoading = false,
  error = null,
  onViewAll,
}: FriendAchievementSectionProps) {
  const theme = useTheme();
  const preview = achievements.slice(0, ACHIEVEMENT_PREVIEW_LIMIT);
  const hasMore = achievements.length > ACHIEVEMENT_PREVIEW_LIMIT;

  return (
    <HomeSection
      title="Achievements"
      subtitle="Badges earned in the arena"
      badge={achievements.length > 0 ? achievements.length : undefined}
      actionLabel={hasMore && onViewAll ? 'View all' : undefined}
      onAction={hasMore ? onViewAll : undefined}>
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
          <View style={achievementGridStyles.grid}>
            {preview.map((achievement) => (
              <AchievementBadgeTile key={achievement.id} achievement={achievement} />
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
});
