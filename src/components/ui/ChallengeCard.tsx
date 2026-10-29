import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

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
  /** Coins the next swap costs; 0 while the free swap of the day is unused. */
  rerollCoinCost?: number;
  canAffordReroll?: boolean;
  rerollLoading?: boolean;
  onStart?: () => void;
  onReroll?: () => void;
  /** Coins paid for the swap that just replaced this quest; shows a "-50" coin burst. */
  swapCharge?: number;
}

type MissionStatusKey = 'tracking' | 'active' | 'ready' | 'cleared';

const ACTION_BUTTON_HEIGHT = 52;
const REROLL_ROW_HEIGHT = 40;
const PROGRESS_PERCENT = (progress: number) => Math.round(Math.min(Math.max(progress, 0), 1) * 100);

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
  rerollCoinCost = 0,
  canAffordReroll = true,
  rerollLoading = false,
  onStart,
  onReroll,
  swapCharge = 0,
}: ChallengeCardProps) {
  const theme = useTheme();
  const swap = useQuestSwapAnimation(exerciseType, swapCharge);
  const quest = getDailyMissionQuestMeta(exerciseType);
  const accentColor = theme[getQuestAccentColor(missionIndex)];
  const missionStatus = resolveMissionStatus(status, completedReps, targetReps);
  const isCompleted = missionStatus === 'cleared';
  const isReady = missionStatus === 'ready';
  const displayReps = Math.min(completedReps, targetReps);
  const progress = targetReps > 0 ? Math.min(displayReps / targetReps, 1) : 0;
  const progressPercent = PROGRESS_PERCENT(progress);
  const exerciseLabel = formatExerciseLabel(exerciseType, true);
  const actionLabel = getQuestActionLabel(missionStatus);
  const questBadgeLabel = missionLabel ?? `Quest ${missionIndex + 1}`;

  const borderColor = isReady ? accentColor : isCompleted ? `${accentColor}55` : theme.border;
  const borderWidth = isReady ? 2 : 1;

  return (
    <Animated.View
      style={[
        swap.cardStyle,
        styles.card,
        {
          backgroundColor: isCompleted ? theme.card : `${accentColor}0C`,
          borderColor,
          borderWidth,
          opacity: isCompleted ? 0.96 : 1,
          shadowColor: isReady ? accentColor : '#0F172A',
          shadowOpacity: isReady ? 0.22 : Platform.OS === 'ios' ? 0.08 : 0,
        },
      ]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.swapFlash, { backgroundColor: accentColor }, swap.flashStyle]}
      />
      <View style={[styles.accentRail, { backgroundColor: accentColor }]} />
      <View style={[styles.accentGlow, { backgroundColor: `${accentColor}16` }]} />

      <View style={styles.inner}>
        <View style={styles.headerRow}>
          <View style={[styles.questPill, { backgroundColor: `${accentColor}20`, borderColor: `${accentColor}44` }]}>
            <AppIcon name="target" size={11} color={accentColor} weight="semibold" />
            <Text style={[styles.questPillText, { color: accentColor }]}>{questBadgeLabel}</Text>
          </View>

          {isRerolled ? (
            <View style={[styles.statusBadge, { backgroundColor: `${accentColor}22` }]}>
              <AppIcon name="swap" size={14} color={accentColor} weight="semibold" />
            </View>
          ) : isCompleted ? (
            <View style={[styles.statusBadge, { backgroundColor: `${accentColor}22` }]}>
              <AppIcon name="checkmark" size={16} color={accentColor} weight="bold" />
            </View>
          ) : null}
        </View>

        <View style={styles.contentBlock}>
          <Text style={[styles.questTitle, { color: theme.text }]}>{quest.questTitle}</Text>
          <Text style={[styles.questObjective, { color: theme.textSecondary }]}>
            {quest.objectiveVerb} {targetReps} {exerciseLabel.toLowerCase()}
          </Text>

          <View style={styles.rewardRow}>
            <View style={[styles.rewardChip, { backgroundColor: `${theme.xp}18` }]}>
              <AppIcon name="star" size={12} color={theme.xp} weight="semibold" />
              <Text style={[styles.rewardText, { color: theme.xp }]}>{DAILY_MISSION_XP_REWARD} XP</Text>
            </View>
            <View style={[styles.rewardChip, { backgroundColor: `${theme.accent}18` }]}>
              <CoinIcon size={12} />
              <Text style={[styles.rewardText, { color: theme.accent }]}>{DAILY_MISSION_COIN_REWARD}</Text>
            </View>
          </View>
        </View>

        <View style={styles.progressBlock}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>Progress</Text>
            <Text style={[styles.progressValue, { color: isCompleted ? theme.textSecondary : theme.text }]}>
              {displayReps}/{targetReps}
              <Text style={[styles.progressPercent, { color: theme.textSecondary }]}> · {progressPercent}%</Text>
            </Text>
          </View>

          <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: isCompleted ? theme.textSecondary : accentColor,
                  width: `${progress > 0 ? Math.max(progressPercent, 4) : 0}%`,
                },
              ]}
            />
          </View>
        </View>

        <View style={styles.actions}>
          {isCompleted ? (
            <View
              style={[
                styles.clearedBanner,
                {
                  backgroundColor: `${accentColor}16`,
                  borderColor: `${accentColor}40`,
                },
              ]}>
              <AppIcon name="checkmark" size={18} color={accentColor} weight="bold" />
              <Text style={[styles.clearedLabel, { color: accentColor }]}>Quest cleared</Text>
            </View>
          ) : actionLabel ? (
            <PrimaryButton
              label={actionLabel}
              loading={loading}
              onPress={onStart}
              style={[
                styles.actionButton,
                isReady ? { backgroundColor: accentColor } : null,
              ]}
            />
          ) : (
            <View style={styles.actionButtonPlaceholder} />
          )}

          <View style={styles.rerollRow}>
            {!isCompleted && canReroll && onReroll ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  rerollCoinCost > 0
                    ? `Swap this quest for ${rerollCoinCost} coins`
                    : 'Swap this quest for another exercise'
                }
                disabled={rerollLoading || loading || !canAffordReroll}
                onPress={onReroll}
                style={({ pressed }) => [
                  styles.swapPill,
                  {
                    backgroundColor: theme.backgroundSelected,
                    borderColor: theme.border,
                    opacity: pressed || rerollLoading || loading || !canAffordReroll ? 0.65 : 1,
                  },
                ]}>
                <AppIcon name="swap" size={14} color={theme.textSecondary} weight="semibold" />
                <Text style={[styles.rerollLink, { color: theme.textSecondary }]}>
                  {rerollLoading ? 'Swapping…' : rerollCoinCost > 0 && !canAffordReroll ? 'Need' : 'Swap quest'}
                </Text>
                {!rerollLoading && rerollCoinCost > 0 ? (
                  <View style={[styles.rerollBadge, { backgroundColor: `${theme.accent}1F` }]}>
                    <CoinIcon size={12} />
                    <Text style={[styles.rerollBadgeText, { color: theme.accent }]}>{rerollCoinCost}</Text>
                  </View>
                ) : null}
                {!rerollLoading && rerollCoinCost > 0 && !canAffordReroll ? (
                  <Text style={[styles.rerollLink, { color: theme.textSecondary }]}>to swap again</Text>
                ) : null}
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
      {swap.charge > 0 ? (
        <Animated.View pointerEvents="none" style={[styles.chargeBurst, swap.burstStyle]}>
          <View style={[styles.chargeChip, { backgroundColor: theme.card, borderColor: `${theme.accent}66` }]}>
            <CoinIcon size={16} />
            <Text style={[styles.chargeText, { color: theme.accent }]}>-{swap.charge}</Text>
          </View>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

/**
 * Plays when the quest on this card is swapped for another exercise: the card flips over to
 * the new quest with a flash of its accent color, and a paid swap floats the coins spent.
 */
function useQuestSwapAnimation(exerciseType: ExerciseType, swapCharge: number) {
  const previousExercise = useRef(exerciseType);
  const chargeRef = useRef(0);
  const flip = useSharedValue(1);
  const flash = useSharedValue(0);
  const burstY = useSharedValue(0);
  const burstOpacity = useSharedValue(0);

  if (previousExercise.current !== exerciseType) {
    // Read during render so the burst label is ready on the same frame the new quest appears.
    chargeRef.current = swapCharge;
  }

  useEffect(() => {
    if (previousExercise.current === exerciseType) {
      return;
    }
    previousExercise.current = exerciseType;

    flip.value = withSequence(
      withTiming(0.04, { duration: 160, easing: Easing.in(Easing.quad) }),
      withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) }),
    );
    flash.value = withSequence(withDelay(140, withTiming(0.28, { duration: 120 })), withTiming(0, { duration: 420 }));

    if (chargeRef.current > 0) {
      burstY.value = 0;
      burstOpacity.value = 0;
      burstY.value = withDelay(200, withTiming(-70, { duration: 1100, easing: Easing.out(Easing.cubic) }));
      burstOpacity.value = withSequence(
        withDelay(200, withTiming(1, { duration: 160 })),
        withDelay(650, withTiming(0, { duration: 300 })),
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [burstOpacity, burstY, exerciseType, flash, flip]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: flip.value }],
  }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const burstStyle = useAnimatedStyle(() => ({
    opacity: burstOpacity.value,
    transform: [{ translateY: burstY.value }, { scale: 0.9 + burstOpacity.value * 0.2 }],
  }));

  return { cardStyle, flashStyle, burstStyle, charge: chargeRef.current };
}

const styles = StyleSheet.create({
  swapFlash: {
    ...StyleSheet.absoluteFill,
    borderRadius: Radius.xl,
    zIndex: 2,
  },
  chargeBurst: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Spacing.six,
    alignItems: 'center',
    zIndex: 3,
  },
  chargeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  chargeText: {
    fontSize: 18,
    fontWeight: '900',
  },
  card: {
    flex: 1,
    minHeight: 310,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    position: 'relative',
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 3,
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
    top: -40,
    right: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    zIndex: 0,
  },
  inner: {
    flex: 1,
    padding: Spacing.four,
    paddingLeft: Spacing.four + 4,
    gap: Spacing.three,
    justifyContent: 'space-between',
    zIndex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  questPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  questPillText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statusBadge: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentBlock: {
    gap: Spacing.one,
  },
  questTitle: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  questObjective: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  rewardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.half,
  },
  rewardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.two,
    paddingVertical: 5,
    borderRadius: Radius.sm,
  },
  rewardText: {
    fontSize: 12,
    fontWeight: '800',
  },
  progressBlock: {
    gap: Spacing.two,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  progressValue: {
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  progressPercent: {
    fontWeight: '700',
  },
  progressTrack: {
    height: 12,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.lg,
    minWidth: 0,
  },
  actions: {
    minHeight: ACTION_BUTTON_HEIGHT + Spacing.two + REROLL_ROW_HEIGHT,
    gap: Spacing.two,
    alignSelf: 'stretch',
  },
  actionButton: {
    width: '100%',
  },
  actionButtonPlaceholder: {
    width: '100%',
    minHeight: ACTION_BUTTON_HEIGHT,
  },
  clearedBanner: {
    width: '100%',
    minHeight: ACTION_BUTTON_HEIGHT,
    borderRadius: Radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  clearedLabel: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  rerollRow: {
    minHeight: REROLL_ROW_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  swapPill: {
    width: '100%',
    minHeight: REROLL_ROW_HEIGHT,
    borderRadius: Radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  rerollLink: {
    fontSize: 13,
    fontWeight: '700',
  },
  rerollBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  rerollBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
});
