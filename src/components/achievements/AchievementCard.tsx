import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { formatAchievementRequirement, formatAchievementReward } from '@/features/achievements/achievementUtils';
import { Radius, Spacing } from '@/constants/theme';
import type { AchievementRecord } from '@/types/achievements';
import { useTheme } from '@/hooks/use-theme';

interface AchievementCardProps {
  achievement: AchievementRecord;
  linkedTitleName?: string | null;
}

function formatUnlockedDate(unlockedAt: string): string {
  return new Date(unlockedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function AchievementCard({ achievement, linkedTitleName }: AchievementCardProps) {
  const theme = useTheme();
  const locked = !achievement.unlocked;
  const rewardLabel = formatAchievementReward(achievement.xpReward, achievement.coinReward);

  return (
    <View
      style={StyleSheet.flatten([
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: achievement.unlocked ? theme.primary : theme.border,
          opacity: locked ? 0.82 : 1,
        },
      ])}>
      <View style={styles.header}>
        <View
          style={StyleSheet.flatten([
            styles.iconWrap,
            {
              backgroundColor: achievement.unlocked ? theme.backgroundSelected : theme.backgroundElement,
              borderColor: theme.border,
            },
          ])}>
          {achievement.imageUrl ? (
            <Image source={{ uri: achievement.imageUrl }} style={styles.image} contentFit="cover" />
          ) : (
            <AppIcon
              name={achievement.icon}
              size={28}
              color={achievement.unlocked ? theme.primary : theme.textSecondary}
            />
          )}
        </View>

        <View style={styles.copy}>
          <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>{achievement.title}</Text>
          <Text style={StyleSheet.flatten([styles.description, { color: theme.textSecondary }])}>
            {achievement.description}
          </Text>
          {linkedTitleName ? (
            <Text style={StyleSheet.flatten([styles.linkedTitle, { color: theme.primary }])}>
              Also unlocks title: {linkedTitleName}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.metaRow}>
        <Text style={StyleSheet.flatten([styles.requirement, { color: theme.textSecondary }])}>
          {formatAchievementRequirement(achievement.requirements)}
        </Text>
        {rewardLabel ? (
          <View style={StyleSheet.flatten([styles.xpBadge, { backgroundColor: theme.backgroundSelected }])}>
            <Text style={StyleSheet.flatten([styles.xpText, { color: theme.xp }])}>{rewardLabel}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        {achievement.unlocked ? (
          <Text style={StyleSheet.flatten([styles.unlocked, { color: theme.success }])}>
            Unlocked {achievement.unlockedAt ? formatUnlockedDate(achievement.unlockedAt) : ''}
          </Text>
        ) : (
          <Text style={StyleSheet.flatten([styles.locked, { color: theme.textSecondary }])}>Locked</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  iconWrap: {
    width: 56,
    height: 56,
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
  copy: {
    flex: 1,
    gap: Spacing.one,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  linkedTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  requirement: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  xpBadge: {
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  xpText: {
    fontSize: 11,
    fontWeight: '800',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unlocked: {
    fontSize: 12,
    fontWeight: '700',
  },
  locked: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
