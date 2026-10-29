import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { AppIcon } from '@/components/ui/AppIcon';
import { formatExerciseLabel } from '@/constants/challenges';
import { getCustomWorkoutTypeLabel } from '@/constants/customWorkouts';
import { Radius, Spacing } from '@/constants/theme';
import { getChallengeFriendName } from '@/features/friends/friendChallengeGroups';
import { getFriendChallengeAction } from '@/features/friends/friendChallengeOverview';
import { useTheme } from '@/hooks/use-theme';
import { getFriendChallengeTitle, type FriendChallenge } from '@/types/friends';

const ACTION_COPY = {
  respond: { status: 'New challenge', button: 'Respond' },
  start: { status: 'Ready to race', button: 'Start' },
  continue: { status: 'Race in progress', button: 'Continue' },
} as const;

function getChallengeTag(challenge: FriendChallenge): string {
  if (challenge.challengeKind === 'workout') {
    return challenge.workoutType ? getCustomWorkoutTypeLabel(challenge.workoutType) : 'Workout';
  }

  return challenge.exerciseType ? formatExerciseLabel(challenge.exerciseType) : 'Speed race';
}

/** One active challenge with the next step for me, or a waiting note when it is the friend's turn. */
export function FriendChallengeActionRow({ challenge }: { challenge: FriendChallenge }) {
  const theme = useTheme();
  const friendName = getChallengeFriendName(challenge);
  const action = getFriendChallengeAction(challenge);
  const copy = action ? ACTION_COPY[action] : null;
  const accent = action === 'respond' ? theme.streak : theme.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${getFriendChallengeTitle(challenge)} with ${friendName}`}
      onPress={() =>
        router.push({
          pathname: '/challenge/friend/[participantId]',
          params: { participantId: challenge.participantId },
        })
      }
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.card,
          borderColor: action === 'respond' ? `${theme.streak}66` : theme.border,
          opacity: pressed ? 0.88 : 1,
        },
      ]}>
      <ProfileAvatar name={friendName} size={44} />

      <View style={styles.copy}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
          {getFriendChallengeTitle(challenge)}
        </Text>
        <Text style={[styles.meta, { color: theme.textSecondary }]} numberOfLines={1}>
          {getChallengeTag(challenge)} · vs {friendName}
        </Text>
        {copy ? (
          <Text style={[styles.status, { color: accent }]}>{copy.status}</Text>
        ) : (
          <View style={styles.waitingRow}>
            <AppIcon name="history" size={12} color={theme.textSecondary} />
            <Text style={[styles.status, { color: theme.textSecondary }]}>Waiting for {friendName}</Text>
          </View>
        )}
      </View>

      {copy ? (
        <View style={[styles.actionPill, { backgroundColor: accent }]}>
          <Text style={styles.actionText}>{copy.button}</Text>
        </View>
      ) : (
        <View style={[styles.donePill, { backgroundColor: `${theme.success}1F` }]}>
          <Text style={[styles.doneText, { color: theme.success }]}>Done</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  meta: {
    fontSize: 13,
    fontWeight: '600',
  },
  status: {
    fontSize: 12,
    fontWeight: '800',
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionPill: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  donePill: {
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
  },
  doneText: {
    fontSize: 13,
    fontWeight: '800',
  },
});
