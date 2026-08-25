import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { formatExerciseLabel } from '@/constants/challenges';
import { formatCoinAmount } from '@/constants/coins';
import {
  FRIEND_CHALLENGE_PARTICIPATION_COINS,
  FRIEND_CHALLENGE_PARTICIPATION_XP,
  FRIEND_CHALLENGE_WINNER_TOTAL_COINS,
  FRIEND_CHALLENGE_WINNER_TOTAL_XP,
} from '@/constants/friendChallengeRewards';
import { getCustomWorkoutTypeLabel } from '@/constants/customWorkouts';
import { formatRaceTime, formatRaceTimeLimit } from '@/constants/friendChallenges';
import { Radius, Spacing } from '@/constants/theme';
import { useFriendChallengeRaceTimer } from '@/features/friends/useFriendChallengeRaceTimer';
import { useTheme } from '@/hooks/use-theme';
import {
  formatFriendWorkoutScore,
  getCreatorDisplayName,
  getFriendChallengeKindLabel,
  getFriendChallengeTitle,
  getMyRaceSeconds,
  getOpponentDisplayName,
  getOpponentRaceSeconds,
  hasFriendChallengeStarted,
  isFriendChallengeResolved,
  isFriendChallengeWaitingOnOpponent,
  type FriendChallenge,
} from '@/types/friends';

interface FriendChallengeCardProps {
  challenge: FriendChallenge;
  onAccept?: () => void;
  onDecline?: () => void;
  onStart?: () => void;
  loading?: boolean;
}

export function FriendChallengeCard({
  challenge,
  onAccept,
  onDecline,
  onStart,
  loading = false,
}: FriendChallengeCardProps) {
  const theme = useTheme();
  const opponentName = getOpponentDisplayName(challenge);
  const creatorName = getCreatorDisplayName(challenge);
  const isWorkout = challenge.challengeKind === 'workout';
  const isPendingInvite = challenge.status === 'pending';
  const isInProgress = challenge.status === 'in_progress';
  const isCompleted = challenge.status === 'completed';
  const waitingOnOpponent = isFriendChallengeWaitingOnOpponent(challenge);
  const isResolved = isFriendChallengeResolved(challenge);
  const label = challenge.isCreator ? `You vs ${opponentName}` : `${creatorName} challenged you`;
  const raceStarted = hasFriendChallengeStarted(challenge);
  const myRaceSeconds = getMyRaceSeconds(challenge);
  const opponentRaceSeconds = getOpponentRaceSeconds(challenge);

  const { elapsedSeconds, secondsRemaining, isExpired } = useFriendChallengeRaceTimer({
    startedAt: challenge.startedAt,
    completedAt: challenge.completedAt,
    maxSeconds: challenge.timeLimitSeconds,
    enabled: raceStarted && isInProgress && !isWorkout,
  });

  function renderTimerLabel() {
    if (isWorkout) {
      const typeLabel = challenge.workoutType ? getCustomWorkoutTypeLabel(challenge.workoutType) : 'Workout';
      const capLabel = challenge.workoutType === 'for_time' ? 'Fastest time wins' : formatRaceTimeLimit(challenge.timeLimitSeconds);
      return (
        <Text style={[styles.timer, { color: theme.textSecondary }]}>
          {typeLabel} · {capLabel}
        </Text>
      );
    }

    if (isCompleted && myRaceSeconds !== null) {
      return (
        <Text style={[styles.timer, { color: theme.primary }]}>
          Your time: {formatRaceTime(myRaceSeconds)}
          {opponentRaceSeconds !== null ? ` · ${opponentName}: ${formatRaceTime(opponentRaceSeconds)}` : ''}
        </Text>
      );
    }

    if (!raceStarted) {
      return (
        <Text style={[styles.timer, { color: theme.textSecondary }]}>
          Speed race · {formatRaceTimeLimit(challenge.timeLimitSeconds)}
        </Text>
      );
    }

    if (isExpired || secondsRemaining === 0) {
      return <Text style={[styles.timer, { color: theme.danger }]}>Time cap reached</Text>;
    }

    return (
      <Text style={[styles.timer, { color: theme.streak }]}>
        Racing: {formatRaceTime(elapsedSeconds)}
        {challenge.timeLimitSeconds ? ` · ${formatRaceTime(secondsRemaining)} left` : ''}
      </Text>
    );
  }

  function renderStatusLine() {
    if (waitingOnOpponent) {
      if (isWorkout) {
        return (
          <Text style={[styles.progress, { color: theme.textSecondary }]}>
            Finished · waiting for {opponentName}
          </Text>
        );
      }

      return (
        <Text style={[styles.progress, { color: theme.textSecondary }]}>
          Finished in {formatRaceTime(myRaceSeconds)} - waiting for {opponentName}
        </Text>
      );
    }

    if (isResolved && challenge.winnerUserId) {
      const myUserId = challenge.isCreator ? challenge.creatorId : challenge.opponentId;
      const won = challenge.winnerUserId === myUserId;
      return (
        <Text style={[styles.progress, { color: won ? theme.success : theme.danger }]}>
          {won ? 'You won the challenge' : `${opponentName} won the challenge`}
        </Text>
      );
    }

    if (isWorkout) {
      return (
        <Text style={[styles.progress, { color: theme.textSecondary }]}>
          {formatFriendWorkoutScore(challenge)}
        </Text>
      );
    }

    return (
      <Text style={[styles.progress, { color: theme.textSecondary }]}>
        You: {challenge.completedReps}/{challenge.targetReps} · {opponentName}:{' '}
        {challenge.opponentCompletedReps}/{challenge.targetReps}
      </Text>
    );
  }

  const title = getFriendChallengeTitle(challenge);
  const subtitle =
    isWorkout && challenge.workoutType
      ? getCustomWorkoutTypeLabel(challenge.workoutType)
      : `${challenge.targetReps} ${formatExerciseLabel(challenge.exerciseType ?? 'push_ups', true)}`;

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
        {getFriendChallengeKindLabel(challenge)}
      </Text>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {!isWorkout ? (
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
      ) : null}
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{label}</Text>
      {renderTimerLabel()}

      {challenge.message ? (
        <Text style={[styles.message, { color: theme.textSecondary }]}>&ldquo;{challenge.message}&rdquo;</Text>
      ) : null}

      {isPendingInvite ? (
        <View style={styles.actions}>
          <PrimaryButton label="Accept" onPress={onAccept} loading={loading} />
          <PrimaryButton label="Decline" variant="secondary" onPress={onDecline} disabled={loading} />
        </View>
      ) : isInProgress || isCompleted ? (
        <View style={styles.actions}>
          {renderStatusLine()}
          <Text style={[styles.reward, { color: theme.xp }]}>
            Finish +{FRIEND_CHALLENGE_PARTICIPATION_XP} XP & {formatCoinAmount(FRIEND_CHALLENGE_PARTICIPATION_COINS)} · Winner +{FRIEND_CHALLENGE_WINNER_TOTAL_XP} XP & {formatCoinAmount(FRIEND_CHALLENGE_WINNER_TOTAL_COINS)}
          </Text>
          <PrimaryButton
            label={
              waitingOnOpponent || (isCompleted && isResolved)
                ? 'VIEW RESULT'
                : isExpired
                  ? 'TIME EXPIRED'
                  : isWorkout
                    ? 'START WORKOUT'
                    : 'START RACE'
            }
            onPress={onStart}
            disabled={isExpired && !isCompleted}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.four,
    borderRadius: Radius.xl,
    borderWidth: 1,
    gap: Spacing.two,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  timer: {
    fontSize: 13,
    fontWeight: '700',
  },
  message: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  progress: {
    fontSize: 13,
    fontWeight: '600',
  },
  reward: {
    fontSize: 15,
    fontWeight: '700',
  },
  actions: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
});
