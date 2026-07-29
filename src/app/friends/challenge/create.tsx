import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthTextInput } from '@/components/ui/AuthTextInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import {
  EXERCISE_TYPES,
  EXERCISE_LABELS,
  type ExerciseType,
} from '@/constants/challenges';
import {
  calculateFriendChallengeXp,
  FRIEND_CHALLENGE_REP_MAX,
  FRIEND_CHALLENGE_REP_MIN,
  FRIEND_CHALLENGE_REP_PRESETS,
  FRIEND_CHALLENGE_TIME_PRESETS,
  formatRaceTimeLimit,
  getDefaultRepsForExercise,
} from '@/constants/friendChallenges';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { createFriendChallenge } from '@/services/friendChallengeService';
import { formatUserError } from '@/lib/errors';
import { useTheme } from '@/hooks/use-theme';

export default function CreateFriendChallengeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { friendId, username } = useLocalSearchParams<{ friendId: string; username?: string }>();
  const [exerciseType, setExerciseType] = useState<ExerciseType>('push_ups');
  const [targetReps, setTargetReps] = useState(getDefaultRepsForExercise('push_ups'));
  const [customReps, setCustomReps] = useState('');
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const repPresets = FRIEND_CHALLENGE_REP_PRESETS[exerciseType];
  const xpReward = useMemo(() => calculateFriendChallengeXp(targetReps), [targetReps]);

  function handleExerciseChange(next: ExerciseType) {
    setExerciseType(next);
    setTargetReps(getDefaultRepsForExercise(next));
    setCustomReps('');
  }

  function handleCustomRepsChange(value: string) {
    setCustomReps(value);
    const parsed = Number.parseInt(value, 10);
    if (!Number.isNaN(parsed)) {
      setTargetReps(Math.min(FRIEND_CHALLENGE_REP_MAX, Math.max(FRIEND_CHALLENGE_REP_MIN, parsed)));
    }
  }

  async function handleSubmit() {
    if (!friendId) {
      setError('Friend not found');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await createFriendChallenge(
        friendId,
        exerciseType,
        targetReps,
        message.trim() || undefined,
        timeLimitSeconds,
      );
      router.replace('/(tabs)/friends');
    } catch (err) {
      setError(formatUserError(err, 'Failed to send challenge'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Challenge Friend', headerShown: true }} />
      <SafeAreaView
        style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}
        edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={StyleSheet.flatten([styles.subtitle, { color: theme.textSecondary }])}>
            Create a custom challenge{username ? ` for @${username}` : ''}
          </Text>

          <Text style={StyleSheet.flatten([styles.label, { color: theme.textSecondary }])}>EXERCISE</Text>
          <View style={styles.exerciseRow}>
            {EXERCISE_TYPES.map((type) => {
              const selected = exerciseType === type;
              return (
                <Pressable
                  key={type}
                  onPress={() => handleExerciseChange(type)}
                  style={StyleSheet.flatten([
                    styles.exerciseChip,
                    {
                      backgroundColor: selected ? theme.primary : theme.backgroundElement,
                      borderColor: selected ? theme.primary : theme.border,
                    },
                  ])}>
                  <Text
                    style={StyleSheet.flatten([
                      styles.exerciseChipText,
                      { color: selected ? '#FFFFFF' : theme.text },
                    ])}>
                    {EXERCISE_LABELS[type]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={StyleSheet.flatten([styles.label, { color: theme.textSecondary }])}>TARGET REPS</Text>
          <View style={styles.repRow}>
            {repPresets.map((reps) => {
              const selected = targetReps === reps && customReps === '';
              return (
                <Pressable
                  key={reps}
                  onPress={() => {
                    setTargetReps(reps);
                    setCustomReps('');
                  }}
                  style={StyleSheet.flatten([
                    styles.repChip,
                    {
                      backgroundColor: selected ? theme.primary : theme.backgroundElement,
                      borderColor: selected ? theme.primary : theme.border,
                    },
                  ])}>
                  <Text
                    style={StyleSheet.flatten([
                      styles.repChipText,
                      { color: selected ? '#FFFFFF' : theme.text },
                    ])}>
                    {reps}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <AuthTextInput
            label={`Custom reps (${FRIEND_CHALLENGE_REP_MIN}-${FRIEND_CHALLENGE_REP_MAX})`}
            value={customReps}
            onChangeText={handleCustomRepsChange}
            keyboardType="number-pad"
            placeholder="Or enter a custom amount"
          />

          <Text style={StyleSheet.flatten([styles.label, { color: theme.textSecondary }])}>
            TIME CAP (OPTIONAL)
          </Text>
          <Text style={StyleSheet.flatten([styles.help, { color: theme.textSecondary }])}>
            Speed race — fastest to complete the reps wins. Your timer starts when you begin the attempt.
          </Text>
          <View style={styles.repRow}>
            {FRIEND_CHALLENGE_TIME_PRESETS.map((preset) => {
              const selected = timeLimitSeconds === preset.seconds;
              return (
                <Pressable
                  key={preset.label}
                  onPress={() => setTimeLimitSeconds(preset.seconds)}
                  style={StyleSheet.flatten([
                    styles.repChip,
                    {
                      backgroundColor: selected ? theme.primary : theme.backgroundElement,
                      borderColor: selected ? theme.primary : theme.border,
                    },
                  ])}>
                  <Text
                    style={StyleSheet.flatten([
                      styles.repChipText,
                      { color: selected ? '#FFFFFF' : theme.text },
                    ])}>
                    {preset.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <AuthTextInput
            label="Message (optional)"
            value={message}
            onChangeText={setMessage}
            placeholder="Go easy on me!"
          />

          <View
            style={StyleSheet.flatten([
              styles.summary,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ])}>
            <Text style={StyleSheet.flatten([styles.summaryTitle, { color: theme.text }])}>
              {targetReps} {EXERCISE_LABELS[exerciseType]}
            </Text>
            <Text style={StyleSheet.flatten([styles.summaryMeta, { color: theme.textSecondary }])}>
              {formatRaceTimeLimit(timeLimitSeconds)} · fastest finisher wins
            </Text>
            <Text style={StyleSheet.flatten([styles.summaryXp, { color: theme.xp }])}>
              Winner +{xpReward} XP · Runner-up +{Math.max(1, Math.floor(xpReward * 0.25))} XP
            </Text>
          </View>

          {error ? (
            <Text style={StyleSheet.flatten([styles.error, { color: theme.danger }])}>{error}</Text>
          ) : null}

          <PrimaryButton label="Send Challenge" loading={isSubmitting} onPress={() => void handleSubmit()} />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  help: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: -Spacing.one,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  exerciseRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  exerciseChip: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  exerciseChipText: {
    fontSize: 15,
    fontWeight: '700',
  },
  repRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  repChip: {
    minWidth: 52,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  repChipText: {
    fontSize: 15,
    fontWeight: '700',
  },
  summary: {
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.one,
  },
  summaryTitle: {
    fontSize: 22,
    fontWeight: '900',
  },
  summaryMeta: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryXp: {
    fontSize: 15,
    fontWeight: '700',
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
