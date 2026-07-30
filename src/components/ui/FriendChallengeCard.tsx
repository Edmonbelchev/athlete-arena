import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { formatExerciseLabel } from '@/constants/challenges';
import {
  FRIEND_CHALLENGE_WIN_COIN_REWARD,
  formatCoinAmount,
} from '@/constants/coins';
import { formatRaceTime, formatRaceTimeLimit } from '@/constants/friendChallenges';
import { Radius, Spacing } from '@/constants/theme';
import { useFriendChallengeRaceTimer } from '@/features/friends/useFriendChallengeRaceTimer';
import {
  getCreatorDisplayName,
  getMyRaceSeconds,
  getOpponentDisplayName,
  getOpponentRaceSeconds,
  hasFriendChallengeStarted,
  isFriendChallengeResolved,
  isFriendChallengeWaitingOnOpponent,
  type FriendChallenge,
} from '@/types/friends';
import { useTheme } from '@/hooks/use-theme';

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
    enabled: raceStarted && isInProgress,
  });

  function renderTimerLabel() {
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
      return (
        <Text style={[styles.progress, { color: theme.textSecondary }]}>
          Finished in {formatRaceTime(myRaceSeconds)} — waiting for {opponentName}
        </Text>
      );
    }

    if (isResolved && challenge.winnerUserId) {
      const myUserId = challenge.isCreator ? challenge.creatorId : challenge.opponentId;
      const won = challenge.winnerUserId === myUserId;
      return (
        <Text style={[styles.progress, { color: won ? theme.success : theme.danger }]}>
          {won ? 'You won the race' : `${opponentName} won the race`}
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

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>SPEED RACE</Text>
      <Text style={[styles.title, { color: theme.text }]}>
        {challenge.targetReps} {formatExerciseLabel(challenge.exerciseType, true)}
      </Text>
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
            Winner +{challenge.xpReward} XP & {formatCoinAmount(FRIEND_CHALLENGE_WIN_COIN_REWARD)} · Runner-up
            +{Math.max(1, Math.floor(challenge.xpReward * 0.25))} XP
          </Text>
          <PrimaryButton
            label={
              waitingOnOpponent || (isCompleted && isResolved)
                ? 'VIEW RESULT'
                : isExpired
                  ? 'TIME EXPIRED'
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
