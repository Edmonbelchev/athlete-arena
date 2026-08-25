import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatExerciseLabel } from '@/constants/challenges';
import { getCustomWorkoutTypeLabel } from '@/constants/customWorkouts';
import { formatRaceTime } from '@/constants/friendChallenges';
import { Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth';
import { useTheme } from '@/hooks/use-theme';
import {
  didIWinFriendChallenge,
  formatFriendWorkoutScore,
  getFriendChallengeKindLabel,
  getFriendChallengeTitle,
  getMyRaceSeconds,
  getOpponentDisplayName,
  getOpponentRaceSeconds,
  type FriendChallenge,
} from '@/types/friends';

interface FriendChallengeHistoryCardProps {
  challenge: FriendChallenge;
}

function formatHistoryDate(isoDate: string | null): string {
  if (!isoDate) {
    return '';
  }

  return new Date(isoDate).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function FriendChallengeHistoryCard({ challenge }: FriendChallengeHistoryCardProps) {
  const theme = useTheme();
  const { session } = useAuth();
  const opponentName = getOpponentDisplayName(challenge);
  const myUserId = session?.user.id ?? '';
  const winResult = didIWinFriendChallenge(challenge, myUserId);
  const isWorkout = challenge.challengeKind === 'workout';
  const myRaceSeconds = getMyRaceSeconds(challenge);
  const opponentRaceSeconds = getOpponentRaceSeconds(challenge);

  const resultLabel =
    winResult === true ? 'You won' : winResult === false ? `${opponentName} won` : 'Challenge finished';

  const resultColor =
    winResult === true ? theme.success : winResult === false ? theme.danger : theme.textSecondary;

  const timeLabel = isWorkout
    ? formatFriendWorkoutScore(challenge)
    : myRaceSeconds !== null
      ? `You ${formatRaceTime(myRaceSeconds)}${
          opponentRaceSeconds !== null ? ` · ${opponentName} ${formatRaceTime(opponentRaceSeconds)}` : ''
        }`
      : `You ${challenge.completedReps}/${challenge.targetReps} · ${opponentName} ${challenge.opponentCompletedReps}/${challenge.targetReps}`;

  const metaLabel =
    isWorkout && challenge.workoutType
      ? getCustomWorkoutTypeLabel(challenge.workoutType)
      : `${challenge.targetReps} ${formatExerciseLabel(challenge.exerciseType ?? 'push_ups', true)}`;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push({
          pathname: '/challenge/friend/[participantId]',
          params: { participantId: challenge.participantId },
        })
      }
      style={({ pressed }) =>
        StyleSheet.flatten([
          styles.card,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
            opacity: pressed ? 0.9 : 1,
          },
        ])
      }>
      <View style={styles.headerRow}>
        <Text style={StyleSheet.flatten([styles.kind, { color: theme.textSecondary }])}>
          {getFriendChallengeKindLabel(challenge)}
        </Text>
        <Text style={StyleSheet.flatten([styles.date, { color: theme.textSecondary }])}>
          {formatHistoryDate(challenge.resolvedAt ?? challenge.completedAt ?? challenge.createdAt)}
        </Text>
      </View>

      <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>
        {getFriendChallengeTitle(challenge)}
      </Text>
      {!isWorkout ? (
        <Text style={StyleSheet.flatten([styles.meta, { color: theme.textSecondary }])}>{metaLabel}</Text>
      ) : null}

      <Text style={StyleSheet.flatten([styles.score, { color: theme.text }])}>{timeLabel}</Text>
      <Text style={StyleSheet.flatten([styles.result, { color: resultColor }])}>{resultLabel}</Text>
    </Pressable>
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
  kind: {
    fontSize: 12,
    fontWeight: '700',
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
  },
  meta: {
    fontSize: 13,
    fontWeight: '600',
  },
  score: {
    fontSize: 14,
    fontWeight: '600',
  },
  result: {
    fontSize: 13,
    fontWeight: '700',
  },
});
