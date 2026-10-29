import { StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { formatExerciseLabel } from '@/constants/challenges';
import { getDailyMissionQuestMeta, getQuestAccentColor } from '@/constants/dailyMissionQuest';
import { DAILY_MISSION_COIN_REWARD } from '@/constants/dailyMissionRewards';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { DailyChallengeHome } from '@/types';
import type { WorkoutSessionReward } from '@/types/titles';

interface WorkoutRewardsSummaryProps {
  sessionReward: WorkoutSessionReward | null;
  /** Daily quests this workout completed. */
  completedQuests?: DailyChallengeHome[];
}

function RewardAmounts({ xp, coins }: { xp: number; coins: number }) {
  const theme = useTheme();

  return (
    <View style={styles.amounts}>
      {xp > 0 ? (
        <View style={[styles.chip, { backgroundColor: `${theme.xp}14` }]}>
          <AppIcon name="star" size={12} color={theme.xp} weight="semibold" />
          <Text style={[styles.chipText, { color: theme.xp }]}>+{xp} XP</Text>
        </View>
      ) : null}
      {coins > 0 ? (
        <View style={[styles.chip, { backgroundColor: `${theme.accent}14` }]}>
          <CoinIcon size={12} />
          <Text style={[styles.chipText, { color: theme.accent }]}>+{coins.toLocaleString()}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Everything the finished workout paid: the workout itself plus any daily quests it cleared. */
export function WorkoutRewardsSummary({ sessionReward, completedQuests = [] }: WorkoutRewardsSummaryProps) {
  const theme = useTheme();
  const workoutXp = sessionReward?.xp ?? 0;
  const workoutCoins = sessionReward?.coins ?? 0;
  const hasWorkoutReward = workoutXp > 0 || workoutCoins > 0;

  if (!hasWorkoutReward && completedQuests.length === 0) {
    return null;
  }

  const totalXp = workoutXp + completedQuests.reduce((sum, quest) => sum + quest.xpReward, 0);
  const totalCoins = workoutCoins + completedQuests.length * DAILY_MISSION_COIN_REWARD;

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.primary }]}>
      <Text style={[styles.title, { color: theme.text }]}>Rewards earned</Text>

      {hasWorkoutReward ? (
        <View style={styles.row}>
          <View style={styles.rowCopy}>
            <Text style={[styles.rowTitle, { color: theme.text }]}>Workout</Text>
            {workoutCoins > 0 ? (
              <Text style={[styles.rowMeta, { color: theme.textSecondary }]}>
                Includes first workout of the day bonus
              </Text>
            ) : null}
          </View>
          <RewardAmounts xp={workoutXp} coins={workoutCoins} />
        </View>
      ) : null}

      {completedQuests.map((quest) => {
        const accentColor = theme[getQuestAccentColor(quest.missionIndex)];

        return (
          <View key={`${quest.challengeDate}-${quest.missionIndex}`} style={styles.row}>
            <View style={styles.rowCopy}>
              <View style={styles.questTitleRow}>
                <AppIcon name="target" size={14} color={accentColor} weight="semibold" />
                <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
                  {getDailyMissionQuestMeta(quest.exerciseType).questTitle}
                </Text>
              </View>
              <Text style={[styles.rowMeta, { color: theme.textSecondary }]}>
                Quest cleared · {quest.targetReps} {formatExerciseLabel(quest.exerciseType, true).toLowerCase()}
              </Text>
            </View>
            <RewardAmounts xp={quest.xpReward} coins={DAILY_MISSION_COIN_REWARD} />
          </View>
        );
      })}

      {completedQuests.length > 0 && hasWorkoutReward ? (
        <View style={[styles.row, styles.totalRow, { borderTopColor: theme.border }]}>
          <Text style={[styles.rowTitle, { color: theme.text }]}>Total</Text>
          <RewardAmounts xp={totalXp} coins={totalCoins} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  questTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  rowMeta: {
    fontSize: 12,
    lineHeight: 16,
  },
  totalRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
  },
  amounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: Spacing.one,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: Radius.sm,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
