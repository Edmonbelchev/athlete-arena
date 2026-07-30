import { StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { Radius, Spacing } from '@/constants/theme';
import type { AchievementRecord } from '@/types/achievements';
import { useTheme } from '@/hooks/use-theme';

interface AchievementBadgesProps {
  unlocked: AchievementRecord[];
  upcoming: AchievementRecord[];
  onViewAll?: () => void;
}

export function AchievementBadges({ unlocked, upcoming, onViewAll }: AchievementBadgesProps) {
  const theme = useTheme();

  if (unlocked.length === 0 && upcoming.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={StyleSheet.flatten([styles.title, { color: theme.textSecondary }])}>ACHIEVEMENTS</Text>
        {onViewAll ? (
          <Text
            onPress={onViewAll}
            style={StyleSheet.flatten([styles.viewAll, { color: theme.primary }])}>
            View all
          </Text>
        ) : null}
      </View>

      {unlocked.length > 0 ? (
        <View style={styles.badgeRow}>
          {unlocked.map((achievement) => (
            <View
              key={achievement.id}
              style={StyleSheet.flatten([
                styles.badge,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              ])}>
              <AppIcon name={achievement.icon} size={20} color={theme.primary} />
              <Text style={StyleSheet.flatten([styles.badgeLabel, { color: theme.text }])}>
                {achievement.title}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={StyleSheet.flatten([styles.empty, { color: theme.textSecondary }])}>
          Complete challenges to unlock badges.
        </Text>
      )}

      {upcoming.length > 0 ? (
        <View style={styles.upcomingBlock}>
          <Text style={StyleSheet.flatten([styles.upcomingTitle, { color: theme.textSecondary }])}>
            Up next
          </Text>
          {upcoming.map((achievement) => (
            <View key={achievement.id} style={styles.upcomingRow}>
              <AppIcon name={achievement.icon} size={14} color={theme.textSecondary} />
              <Text style={StyleSheet.flatten([styles.upcomingItem, { color: theme.textSecondary }])}>
                {achievement.description}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  viewAll: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  badge: {
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    minWidth: 72,
    gap: Spacing.one,
  },
  badgeLabel: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  empty: {
    fontSize: 13,
    lineHeight: 18,
  },
  upcomingBlock: {
    gap: Spacing.one,
  },
  upcomingTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  upcomingItem: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});
