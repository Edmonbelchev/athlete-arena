import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AchievementBadgeTile, achievementGridStyles } from '@/components/achievements/AchievementBadgeTile';
import { HomeSection } from '@/components/home/HomeSection';
import { Radius, Spacing } from '@/constants/theme';
import { ACHIEVEMENT_PREVIEW_LIMIT, type AchievementRecord } from '@/types/achievements';
import { useTheme } from '@/hooks/use-theme';

interface ProfileAchievementSectionProps {
  achievements: AchievementRecord[];
  unlockedCount: number;
  isLoading?: boolean;
  error?: string | null;
  onViewAll: () => void;
}

export function ProfileAchievementSection({
  achievements,
  unlockedCount,
  isLoading = false,
  error = null,
  onViewAll,
}: ProfileAchievementSectionProps) {
  const theme = useTheme();
  const unlocked = achievements.slice(0, ACHIEVEMENT_PREVIEW_LIMIT);

  return (
    <HomeSection
      title="Achievements"
      subtitle={`${unlockedCount} unlocked`}
      badge={unlockedCount > 0 ? unlockedCount : undefined}
      actionLabel="View all"
      onAction={onViewAll}>
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
        ) : unlocked.length === 0 ? (
          <Text style={StyleSheet.flatten([styles.empty, { color: theme.textSecondary }])}>
            Complete challenges to earn your first badge.
          </Text>
        ) : (
          <View style={achievementGridStyles.grid}>
            {unlocked.map((achievement) => (
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
