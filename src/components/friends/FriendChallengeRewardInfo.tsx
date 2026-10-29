import { StyleSheet, Text, View } from 'react-native';

import { formatExerciseAmount, type ExerciseType } from '@/constants/challenges';
import { formatCoinAmount } from '@/constants/coins';
import {
  calculateFriendChallengeCoins,
  calculateFriendChallengeXp,
  formatFriendChallengeRewardRule,
  FRIEND_CHALLENGE_EXPIRY_DAYS,
  FRIEND_CHALLENGE_NO_SHOW_BONUS_COINS,
  FRIEND_CHALLENGE_NO_SHOW_BONUS_XP,
  FRIEND_CHALLENGE_PARTICIPATION_COINS,
  FRIEND_CHALLENGE_PARTICIPATION_XP,
  FRIEND_CHALLENGE_WINNER_BONUS_COINS,
  FRIEND_CHALLENGE_WINNER_BONUS_XP,
  getFriendChallengeReward,
  WORKOUT_FULL_REWARD_REPS,
} from '@/constants/friendChallengeRewards';
import { Radius, Spacing } from '@/constants/theme';
import type { FriendChallengeKind } from '@/types/friends';
import { useTheme } from '@/hooks/use-theme';

interface FriendChallengeRewardInfoProps {
  challengeKind: FriendChallengeKind;
  exerciseType: ExerciseType;
  targetReps: number;
}

export function FriendChallengeRewardInfo({
  challengeKind,
  exerciseType,
  targetReps,
}: FriendChallengeRewardInfoProps) {
  const theme = useTheme();

  if (challengeKind === 'workout') {
    return (
      <View
        style={StyleSheet.flatten([
          styles.card,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ])}>
        <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>Challenge rewards</Text>
        <Text style={StyleSheet.flatten([styles.line, { color: theme.textSecondary }])}>
          Finish the challenge: up to +{FRIEND_CHALLENGE_PARTICIPATION_XP} XP &{' '}
          {formatCoinAmount(FRIEND_CHALLENGE_PARTICIPATION_COINS)}
        </Text>
        <Text style={StyleSheet.flatten([styles.line, { color: theme.textSecondary }])}>
          Win the head-to-head: extra up to +{FRIEND_CHALLENGE_WINNER_BONUS_XP} XP &{' '}
          {formatCoinAmount(FRIEND_CHALLENGE_WINNER_BONUS_COINS)}
        </Text>
        <Text style={StyleSheet.flatten([styles.line, { color: theme.textSecondary }])}>
          Friend doesn&apos;t finish in {FRIEND_CHALLENGE_EXPIRY_DAYS} days: extra up to +{FRIEND_CHALLENGE_NO_SHOW_BONUS_XP} XP &{' '}
          {formatCoinAmount(FRIEND_CHALLENGE_NO_SHOW_BONUS_COINS)}
        </Text>
        <Text style={StyleSheet.flatten([styles.preview, { color: theme.xp }])}>
          Full rewards at {WORKOUT_FULL_REWARD_REPS}+ reps done · fewer reps pay less
        </Text>
      </View>
    );
  }

  const finish = getFriendChallengeReward('exercise', 'finish', targetReps, exerciseType);
  const win = getFriendChallengeReward('exercise', 'win', targetReps, exerciseType);
  const noShow = getFriendChallengeReward('exercise', 'noShow', targetReps, exerciseType);

  return (
    <View
      style={StyleSheet.flatten([
        styles.card,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ])}>
      <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>Race rewards</Text>
      <Text style={StyleSheet.flatten([styles.line, { color: theme.textSecondary }])}>
        {formatFriendChallengeRewardRule(exerciseType)}
      </Text>
      <Text style={StyleSheet.flatten([styles.line, { color: theme.textSecondary }])}>
        Finish: +{finish.xp} XP & {formatCoinAmount(finish.coins)} · Win: extra +{win.xp} XP &{' '}
        {formatCoinAmount(win.coins)}
      </Text>
      <Text style={StyleSheet.flatten([styles.line, { color: theme.textSecondary }])}>
        Friend doesn&apos;t finish in {FRIEND_CHALLENGE_EXPIRY_DAYS} days: extra +{noShow.xp} XP &{' '}
        {formatCoinAmount(noShow.coins)}
      </Text>
      <Text style={StyleSheet.flatten([styles.preview, { color: theme.xp }])}>
        At {formatExerciseAmount(exerciseType, targetReps)}: Winner +{calculateFriendChallengeXp(exerciseType, targetReps)} XP &{' '}
        {formatCoinAmount(calculateFriendChallengeCoins(exerciseType, targetReps))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  line: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  preview: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
});
