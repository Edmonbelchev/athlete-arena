import { StyleSheet, Text, View, Pressable } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { formatExerciseLabel, type ExerciseType } from '@/constants/challenges';
import {
  DAILY_MISSION_COIN_REWARD,
  DAILY_MISSION_XP_REWARD,
} from '@/constants/dailyMissionRewards';
import {
  getDailyMissionQuestMeta,
  getQuestAccentColor,
  getQuestActionLabel,
} from '@/constants/dailyMissionQuest';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ChallengeStatus } from '@/types';

import { PrimaryButton } from './PrimaryButton';

interface ChallengeCardProps {
  exerciseType: ExerciseType;
  targetReps: number;
  status: ChallengeStatus;
  completedReps?: number;
  loading?: boolean;
  missionIndex?: number;
  missionLabel?: string;
  isRerolled?: boolean;
  canReroll?: boolean;
  rerollLoading?: boolean;
  onStart?: () => void;
  onReroll?: () => void;
}

type MissionStatusKey = 'tracking' | 'active' | 'ready' | 'cleared';

function resolveMissionStatus(
  status: ChallengeStatus,
  completedReps: number,
  targetReps: number,
): MissionStatusKey {
  if (status === 'completed') {
    return 'cleared';
  }

  if (completedReps >= targetReps) {
    return 'ready';
  }

  if (completedReps > 0 || status === 'in_progress') {
    return 'active';
  }

  return 'tracking';
}

function MissionStatusBadge({
  missionStatus,
  accentColor,
}: {
  missionStatus: MissionStatusKey;
  accentColor: string;
}) {
  const theme = useTheme();

  const config = {
    tracking: { label: 'TRACKING', background: theme.backgroundSelected, text: accentColor },
    active: { label: 'IN PROGRESS', background: theme.backgroundSelected, text: accentColor },
    ready: { label: 'READY', background: theme.success, text: '#FFFFFF' },
    cleared: { label: 'CLEARED', background: theme.success, text: '#FFFFFF' },
  }[missionStatus];

  return (
    <View style={[styles.statusBadge, { backgroundColor: config.background }]}>
      <Text style={[styles.statusBadgeText, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

function RewardChip({
  icon,
  label,
  color,
  backgroundColor,
}: {
  icon: 'xp' | 'coin';
  label: string;
  color: string;
  backgroundColor: string;
}) {
  return (
    <View style={[styles.rewardChip, { backgroundColor, borderColor: color }]}>
      {icon === 'coin' ? <CoinIcon size={14} /> : <AppIcon name="star" size={14} color={color} weight="semibold" />}
      <Text style={[styles.rewardChipText, { color }]}>{label}</Text>
    </View>
  );
}

export function ChallengeCard({
  exerciseType,
  targetReps,
  status,
  completedReps = 0,
  loading = false,
  missionIndex = 0,
  missionLabel,
  isRerolled = false,
  canReroll = false,
  rerollLoading = false,
  onStart,
  onReroll,
}: ChallengeCardProps) {
  const theme = useTheme();
  const quest = getDailyMissionQuestMeta(exerciseType);
  const accentColor = theme[getQuestAccentColor(missionIndex)];
  const missionStatus = resolveMissionStatus(status, completedReps, targetReps);
  const isCompleted = missionStatus === 'cleared';
  const displayReps = Math.min(completedReps, targetReps);
  const progress = targetReps > 0 ? Math.min(displayReps / targetReps, 1) : 0;
  const progressPercent = Math.round(progress * 100);
  const exerciseLabel = formatExerciseLabel(exerciseType, true);
  const actionLabel = getQuestActionLabel(missionStatus);

  const borderColor =
    missionStatus === 'ready'
      ? theme.success
      : missionStatus === 'cleared'
        ? theme.success
        : theme.border;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor,
          borderWidth: missionStatus === 'ready' ? 2 : 1,
        },
      ]}>
      <View style={[styles.accentRail, { backgroundColor: accentColor }]} />
      <View style={[styles.accentGlow, { backgroundColor: `${accentColor}18` }]} />

      <View style={styles.inner}>
        <View style={styles.headerRow}>
          <View
            accessibilityLabel={
              isRerolled ? `${missionLabel ?? 'Daily quest'}, swapped exercise` : undefined
            }
            style={[styles.missionPill, { backgroundColor: `${accentColor}22`, borderColor: accentColor }]}>
            <Text style={[styles.missionPillText, { color: accentColor }]}>
              {missionLabel ?? 'DAILY QUEST'}
            </Text>
            {isRerolled ? (
              <AppIcon name="swap" size={11} color={accentColor} weight="semibold" />
            ) : null}
          </View>
          <MissionStatusBadge missionStatus={missionStatus} accentColor={accentColor} />
        </View>

        <View style={styles.questCopy}>
          <Text style={[styles.questTitle, { color: theme.text }]}>{quest.questTitle}</Text>
          <Text style={[styles.questObjective, { color: theme.textSecondary }]}>
            {quest.objectiveVerb} {targetReps} {exerciseLabel.toLowerCase()}
          </Text>
        </View>

        <View style={styles.progressBlock}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>Quest progress</Text>
            <Text style={[styles.progressValue, { color: isCompleted ? theme.success : theme.text }]}>
              {displayReps} / {targetReps}
              {!isCompleted ? (
                <Text style={[styles.progressPercent, { color: accentColor }]}> · {progressPercent}%</Text>
              ) : null}
            </Text>
          </View>

          <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: isCompleted ? theme.success : accentColor,
                  width: `${Math.max(progress * 100, 0)}%`,
                },
              ]}
            />
          </View>

          {!isCompleted ? (
            <Text style={[styles.progressHint, { color: theme.textSecondary }]}>
              {missionStatus === 'tracking'
                ? 'Progress counts automatically from workouts, races, and challenges'
                : missionStatus === 'ready'
                  ? 'Target reached — claim your reward or keep training'
                  : 'Keep training anywhere in the app, or tap below to finish in a workout'}
            </Text>
          ) : null}
        </View>

        <View style={styles.rewardsRow}>
          <Text style={[styles.rewardsLabel, { color: theme.textSecondary }]}>Rewards</Text>
          <View style={styles.rewardChips}>
            <RewardChip
              icon="xp"
              label={`${DAILY_MISSION_XP_REWARD} XP`}
              color={theme.xp}
              backgroundColor={`${theme.xp}14`}
            />
            <RewardChip
              icon="coin"
              label={`${DAILY_MISSION_COIN_REWARD}`}
              color={theme.accent}
              backgroundColor={`${theme.accent}14`}
            />
          </View>
        </View>

        {isCompleted ? (
          <View style={[styles.clearedBanner, { backgroundColor: `${theme.success}18`, borderColor: theme.success }]}>
            <Text style={[styles.clearedText, { color: theme.success }]}>
              Quest cleared · {DAILY_MISSION_XP_REWARD} XP and {DAILY_MISSION_COIN_REWARD} coins collected
            </Text>
          </View>
        ) : (
          <>
            {canReroll && onReroll ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Swap this quest for another exercise"
                disabled={rerollLoading || loading}
                onPress={onReroll}
                style={({ pressed }) => [
                  styles.rerollButton,
                  {
                    backgroundColor: theme.backgroundSelected,
                    borderColor: theme.border,
                    opacity: pressed || rerollLoading || loading ? 0.7 : 1,
                  },
                ]}>
                <Text style={[styles.rerollButtonText, { color: theme.textSecondary }]}>
                  {rerollLoading ? 'Swapping quest…' : 'Swap quest (once per day)'}
                </Text>
              </Pressable>
            ) : null}
            {actionLabel ? (
              <PrimaryButton label={actionLabel} loading={loading} onPress={onStart} />
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    overflow: 'hidden',
    position: 'relative',
  },
  accentRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
    zIndex: 2,
  },
  accentGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 72,
  },
  inner: {
    padding: Spacing.four,
    paddingLeft: Spacing.four + 4,
    gap: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  missionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  missionPillText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  statusBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radius.sm,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  questCopy: {
    gap: Spacing.half,
  },
  questTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  questObjective: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  progressBlock: {
    gap: Spacing.one,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  progressValue: {
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: '800',
  },
  progressTrack: {
    height: 10,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.sm,
  },
  progressHint: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  rewardsRow: {
    gap: Spacing.one,
  },
  rewardsLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  rewardChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  rewardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  rewardChipText: {
    fontSize: 13,
    fontWeight: '800',
  },
  clearedBanner: {
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  clearedText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  rerollButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  rerollButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
