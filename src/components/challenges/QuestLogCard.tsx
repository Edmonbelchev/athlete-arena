import { StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { EXERCISE_TYPES, formatExerciseLabel, type ExerciseType } from '@/constants/challenges';
import { getDailyMissionQuestMeta, getQuestAccentColor } from '@/constants/dailyMissionQuest';
import {
  DAILY_MISSION_COIN_REWARD,
  DAILY_MISSION_XP_REWARD,
} from '@/constants/dailyMissionRewards';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ChallengeHistoryEntry } from '@/types/challengeHistory';

interface QuestLogCardProps {
  entry: ChallengeHistoryEntry;
}

function formatQuestDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function QuestLogCard({ entry }: QuestLogCardProps) {
  const theme = useTheme();
  const quest = getDailyMissionQuestMeta(entry.exerciseType);
  const missionIndex = Math.max(EXERCISE_TYPES.indexOf(entry.exerciseType as ExerciseType), 0);
  const accentColor = theme[getQuestAccentColor(missionIndex)];
  const isCompleted = entry.status === 'completed';

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.headerRow}>
        <View style={[styles.questPill, { backgroundColor: `${accentColor}18`, borderColor: `${accentColor}44` }]}>
          <AppIcon name="target" size={12} color={accentColor} weight="semibold" />
          <Text style={[styles.questPillText, { color: accentColor }]}>Daily quest</Text>
        </View>
        <Text style={[styles.date, { color: theme.textSecondary }]}>{formatQuestDate(entry.resultAt)}</Text>
      </View>

      <Text style={[styles.title, { color: theme.text }]}>{quest.questTitle}</Text>
      <Text style={[styles.objective, { color: theme.textSecondary }]}>
        {entry.completedReps} / {entry.targetReps} {formatExerciseLabel(entry.exerciseType, true).toLowerCase()}
      </Text>

      <View style={styles.footerRow}>
        {isCompleted ? (
          <View style={styles.rewardRow}>
            <View style={[styles.rewardChip, { backgroundColor: `${theme.xp}14` }]}>
              <AppIcon name="star" size={12} color={theme.xp} weight="semibold" />
              <Text style={[styles.rewardText, { color: theme.xp }]}>{DAILY_MISSION_XP_REWARD} XP</Text>
            </View>
            <View style={[styles.rewardChip, { backgroundColor: `${theme.accent}14` }]}>
              <CoinIcon size={12} />
              <Text style={[styles.rewardText, { color: theme.accent }]}>{DAILY_MISSION_COIN_REWARD}</Text>
            </View>
          </View>
        ) : (
          <Text style={[styles.missed, { color: theme.textSecondary }]}>Not completed</Text>
        )}

        {isCompleted ? (
          <View style={[styles.statusChip, { backgroundColor: theme.backgroundSelected }]}>
            <AppIcon name="checkmark" size={14} color={accentColor} weight="bold" />
            <Text style={[styles.statusText, { color: theme.textSecondary }]}>Cleared</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.one,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  questPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  questPillText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  date: {
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  objective: {
    fontSize: 14,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  rewardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    flex: 1,
  },
  rewardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  rewardText: {
    fontSize: 12,
    fontWeight: '800',
  },
  missed: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
