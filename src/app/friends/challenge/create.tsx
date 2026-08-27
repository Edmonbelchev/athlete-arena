import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FriendChallengeExercisePicker } from '@/components/friends/FriendChallengeExercisePicker';
import { FriendChallengeRequestQuotaBar } from '@/components/friends/FriendChallengeRequestQuotaBar';
import { FriendChallengeRewardInfo } from '@/components/friends/FriendChallengeRewardInfo';
import { FriendChallengeWorkoutPicker } from '@/components/friends/FriendChallengeWorkoutPicker';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { EmotePicker } from '@/components/shop/EmotePicker';
import { AuthTextInput } from '@/components/ui/AuthTextInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { WorkoutCircuitPreview } from '@/components/workouts/WorkoutCircuitPreview';
import { EXERCISE_LABELS, type ExerciseType } from '@/constants/challenges';

import {
    FRIEND_CHALLENGE_REP_MAX,
    FRIEND_CHALLENGE_REP_MIN,
    FRIEND_CHALLENGE_REP_PRESETS,
    FRIEND_CHALLENGE_TIME_PRESETS,
    formatRaceTimeLimit,
    getDefaultRepsForExercise,
    isFriendChallengeRequestLimitError,
} from '@/constants/friendChallenges';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import {
    formatFriendChallengeWorkoutMeta,
    getFriendChallengeWorkoutKey,
    parseFriendChallengeWorkoutKey,
    type FriendChallengeWorkoutOption,
} from '@/features/friends/friendChallengeWorkoutPicker';
import { useFriendChallengeRequestQuota } from '@/features/friends/useFriendChallengeRequestQuota';
import { useFriends } from '@/features/friends/useFriends';
import { usePremium } from '@/features/subscription/usePremium';
import { useShop } from '@/features/shop/ShopProvider';
import { getOwnedEmotes } from '@/features/shop/shopUtils';
import { parseStructureConfig } from '@/features/workouts/forTimeStructure';
import { useTheme } from '@/hooks/use-theme';
import { formatUserError } from '@/lib/errors';
import { getCustomWorkoutTemplateDetail } from '@/services/customWorkoutService';
import {
    createFriendCatalogWorkoutChallenge,
    createFriendChallenge,
    createFriendWorkoutChallenge,
} from '@/services/friendChallengeService';
import { getWorkoutCatalogDetail } from '@/services/workoutCatalogService';
import type { CustomWorkoutExercise, CustomWorkoutType, ForTimeStructureConfig } from '@/types/customWorkouts';
import type { FriendChallengeKind, FriendSummary } from '@/types/friends';

interface WorkoutChallengePreview {
  title: string;
  workoutType: CustomWorkoutType;
  exercises: CustomWorkoutExercise[];
  structureConfig: ForTimeStructureConfig | null;
}

export default function CreateFriendChallengeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const {
    friendId: initialFriendId,
    username: initialUsername,
    displayName: initialDisplayName,
  } = useLocalSearchParams<{
    friendId?: string;
    username?: string;
    displayName?: string;
  }>();
  const isFriendLocked = Boolean(initialFriendId);
  const { friends, isLoading: isFriendsLoading, refresh: refreshFriends } = useFriends();

  useEffect(() => {
    if (!isFriendLocked) {
      void refreshFriends({ loadFriends: true, loadRequests: false });
    }
  }, [isFriendLocked, refreshFriends]);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(initialFriendId ?? null);
  const [challengeKind, setChallengeKind] = useState<FriendChallengeKind>('exercise');
  const [selectedWorkoutKey, setSelectedWorkoutKey] = useState<string | null>(null);
  const [selectedWorkoutOption, setSelectedWorkoutOption] = useState<FriendChallengeWorkoutOption | null>(null);
  const [selectedWorkoutPreview, setSelectedWorkoutPreview] = useState<WorkoutChallengePreview | null>(null);
  const [isWorkoutPreviewLoading, setIsWorkoutPreviewLoading] = useState(false);
  const [exerciseType, setExerciseType] = useState<ExerciseType>('push_ups');
  const [targetReps, setTargetReps] = useState(getDefaultRepsForExercise('push_ups'));
  const [customReps, setCustomReps] = useState('');
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [selectedEmoteId, setSelectedEmoteId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { quota, refresh: refreshQuota } = useFriendChallengeRequestQuota();
  const { showPremiumPaywall, dismissPremiumPaywall } = usePremium();
  const { items } = useShop();

  useEffect(() => {
    return () => {
      dismissPremiumPaywall();
    };
  }, [dismissPremiumPaywall]);
  const ownedEmotes = useMemo(() => getOwnedEmotes(items), [items]);
  const selectedFriend = useMemo(
    () => friends.find((friend) => friend.friendId === selectedFriendId) ?? null,
    [friends, selectedFriendId],
  );
  const lockedFriend = useMemo((): FriendSummary | null => {
    if (!initialFriendId) {
      return null;
    }

    if (selectedFriend) {
      return selectedFriend;
    }

    return {
      friendshipId: '',
      friendId: initialFriendId,
      username: initialUsername ?? 'friend',
      displayName: initialDisplayName?.trim() || null,
      level: 0,
      currentStreak: 0,
      avatarUrl: null,
      avatar: null,
      frame: null,
    };
  }, [initialDisplayName, initialFriendId, initialUsername, selectedFriend]);
  const displayFriend = isFriendLocked ? lockedFriend : selectedFriend;
  const selectedUsername = displayFriend?.username ?? initialUsername;
  const selectedDisplayName = displayFriend?.displayName ?? displayFriend?.username ?? initialDisplayName;

  useEffect(() => {
    if (initialFriendId) {
      setSelectedFriendId(initialFriendId);
    }
  }, [initialFriendId]);

  useEffect(() => {
    if (challengeKind !== 'workout') {
      setSelectedWorkoutKey(null);
      setSelectedWorkoutOption(null);
    }
  }, [challengeKind]);

  const handleSelectWorkout = useCallback((option: FriendChallengeWorkoutOption) => {
    setSelectedWorkoutOption(option);
    setSelectedWorkoutKey(getFriendChallengeWorkoutKey(option));
  }, []);

  useEffect(() => {
    if (challengeKind !== 'workout' || !selectedWorkoutKey) {
      setSelectedWorkoutPreview(null);
      return;
    }

    const parsed = parseFriendChallengeWorkoutKey(selectedWorkoutKey);
    if (!parsed) {
      setSelectedWorkoutPreview(null);
      return;
    }

    let cancelled = false;

    async function loadPreview() {
      setIsWorkoutPreviewLoading(true);

      try {
        if (parsed!.source === 'arena') {
          const detail = await getWorkoutCatalogDetail(parsed!.id);
          if (cancelled) {
            return;
          }

          setSelectedWorkoutPreview({
            title: detail.title,
            workoutType: detail.workoutType,
            exercises: detail.exercises,
            structureConfig: detail.structureConfig,
          });
          return;
        }

        const detail = await getCustomWorkoutTemplateDetail(parsed!.id);
        if (cancelled) {
          return;
        }

        setSelectedWorkoutPreview({
          title: detail.title,
          workoutType: detail.workoutType,
          exercises: detail.exercises,
          structureConfig: parseStructureConfig(detail.structureConfig),
        });
      } catch (err) {
        if (!cancelled) {
          setSelectedWorkoutPreview(null);
          setError(formatUserError(err, 'Failed to load workout details'));
        }
      } finally {
        if (!cancelled) {
          setIsWorkoutPreviewLoading(false);
        }
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [challengeKind, selectedWorkoutKey]);

  function renderFriendRow(friend: FriendSummary, selected: boolean, onPress?: () => void) {
    const displayName = friend.displayName ?? friend.username;

    return (
      <Pressable
        key={friend.friendId}
        accessibilityRole={onPress ? 'button' : 'text'}
        accessibilityState={onPress ? { selected } : undefined}
        disabled={!onPress}
        onPress={onPress}
        style={StyleSheet.flatten([
          styles.friendRow,
          {
            backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement,
            borderColor: selected ? theme.primary : theme.border,
          },
        ])}>
        <ProfileAvatar
          uri={friend.avatarUrl}
          name={displayName}
          size={40}
          shopAvatar={friend.avatar}
          frame={friend.frame}
        />
        <View style={styles.friendInfo}>
          <Text style={StyleSheet.flatten([styles.friendName, { color: theme.text }])}>{displayName}</Text>
          <Text style={StyleSheet.flatten([styles.friendMeta, { color: theme.textSecondary }])}>
            @{friend.username}
          </Text>
        </View>
      </Pressable>
    );
  }

  const repPresets = FRIEND_CHALLENGE_REP_PRESETS[exerciseType];

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

  async function handleUpgradeForUnlimited() {
    const unlocked = await showPremiumPaywall({ context: 'challenge_requests' });
    if (unlocked) {
      await refreshQuota();
      setError(null);
    }
  }

  async function handleSubmit() {
    if (!selectedFriendId) {
      setError('Select a friend to challenge');
      return;
    }

    if (!quota.canCreate) {
      setError('You have reached your monthly challenge request limit.');
      return;
    }

    if (challengeKind === 'workout') {
      const parsed = selectedWorkoutKey ? parseFriendChallengeWorkoutKey(selectedWorkoutKey) : null;
      if (!parsed) {
        setError('Select a workout to challenge your friend with');
        return;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        const participantId =
          parsed.source === 'arena'
            ? await createFriendCatalogWorkoutChallenge(
                selectedFriendId,
                parsed.id,
                message.trim() || undefined,
                selectedEmoteId,
              )
            : await createFriendWorkoutChallenge(
                selectedFriendId,
                parsed.id,
                message.trim() || undefined,
                selectedEmoteId,
              );
        router.replace({
          pathname: '/challenge/friend/[participantId]',
          params: { participantId },
        });
        void refreshQuota();
      } catch (err) {
        if (isFriendChallengeRequestLimitError(err)) {
          setError(formatUserError(err, 'Failed to send challenge'));
          await refreshQuota();
          return;
        }
        setError(formatUserError(err, 'Failed to send challenge'));
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const participantId = await createFriendChallenge(
        selectedFriendId,
        exerciseType,
        targetReps,
        message.trim() || undefined,
        timeLimitSeconds,
        selectedEmoteId,
      );
      router.replace({
        pathname: '/challenge/friend/[participantId]',
        params: { participantId },
      });
      void refreshQuota();
    } catch (err) {
      if (isFriendChallengeRequestLimitError(err)) {
        setError(formatUserError(err, 'Failed to send challenge'));
        await refreshQuota();
        return;
      }
      setError(formatUserError(err, 'Failed to send challenge'));
    } finally {
      setIsSubmitting(false);
    }
  }

  const atRequestLimit = !quota.canCreate;
  const submitDisabled =
    !selectedFriendId ||
    atRequestLimit ||
    (challengeKind === 'workout' &&
      (!selectedWorkoutKey || !selectedWorkoutOption || isWorkoutPreviewLoading));

  return (
    <>
      <Stack.Screen
        options={{
          title: isFriendLocked && selectedDisplayName ? `Challenge ${selectedDisplayName}` : 'Challenge Friend',
          headerShown: true,
        }}
      />
      <SafeAreaView
        style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}
        edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={StyleSheet.flatten([styles.subtitle, { color: theme.textSecondary }])}>
            {isFriendLocked
              ? `Set up a speed race with ${selectedDisplayName ?? 'your friend'}`
              : `Create a custom challenge${selectedUsername ? ` for @${selectedUsername}` : ''}`}
          </Text>

          <FriendChallengeRequestQuotaBar
            quota={quota}
            showUpgradeButton={atRequestLimit}
            onUpgrade={() => void handleUpgradeForUnlimited()}
          />

          <Text style={StyleSheet.flatten([styles.label, { color: theme.textSecondary }])}>FRIEND</Text>
          {isFriendLocked ? (
            lockedFriend ? (
              renderFriendRow(lockedFriend, true)
            ) : (
              <ActivityIndicator color={theme.primary} />
            )
          ) : isFriendsLoading ? (
            <ActivityIndicator color={theme.primary} />
          ) : friends.length === 0 ? (
            <Text style={StyleSheet.flatten([styles.help, { color: theme.textSecondary }])}>
              Add a friend first before sending a challenge.
            </Text>
          ) : (
            <View style={styles.friendList}>
              {friends.map((friend) =>
                renderFriendRow(friend, selectedFriendId === friend.friendId, () =>
                  setSelectedFriendId(friend.friendId),
                ),
              )}
            </View>
          )}

          <Text style={StyleSheet.flatten([styles.label, { color: theme.textSecondary }])}>CHALLENGE TYPE</Text>
          <View style={styles.exerciseRow}>
            {(['exercise', 'workout'] as const).map((kind) => {
              const selected = challengeKind === kind;
              return (
                <Pressable
                  key={kind}
                  onPress={() => setChallengeKind(kind)}
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
                    {kind === 'exercise' ? 'Single exercise' : 'Full workout'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <FriendChallengeRewardInfo
            challengeKind={challengeKind}
            exerciseType={exerciseType}
            targetReps={targetReps}
          />

          {challengeKind === 'workout' ? (
            <>
              <FriendChallengeWorkoutPicker
                selectedWorkoutKey={selectedWorkoutKey}
                onSelectWorkout={handleSelectWorkout}
              />

              {isWorkoutPreviewLoading ? (
                <ActivityIndicator color={theme.primary} />
              ) : selectedWorkoutPreview ? (
                <WorkoutCircuitPreview
                  workoutType={selectedWorkoutPreview.workoutType}
                  exercises={selectedWorkoutPreview.exercises}
                  structureConfig={selectedWorkoutPreview.structureConfig}
                />
              ) : null}
            </>
          ) : (
            <>
          <FriendChallengeExercisePicker
            selectedExerciseType={exerciseType}
            onSelectExercise={handleExerciseChange}
          />

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
            Speed race - fastest to complete the reps wins. Your timer starts when you begin the attempt.
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
            </>
          )}

          <EmotePicker
            emotes={ownedEmotes}
            selectedEmoteId={selectedEmoteId}
            onSelect={setSelectedEmoteId}
          />

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
            {challengeKind === 'workout' ? (
              <>
                <Text style={StyleSheet.flatten([styles.summaryTitle, { color: theme.text }])}>
                  {selectedWorkoutOption?.title ?? 'Select a workout'}
                </Text>
                <Text style={StyleSheet.flatten([styles.summaryMeta, { color: theme.textSecondary }])}>
                  {selectedWorkoutOption
                    ? `${formatFriendChallengeWorkoutMeta(selectedWorkoutOption)} · head-to-head challenge`
                    : 'Choose a workout below'}
                </Text>
              </>
            ) : (
              <>
                <Text style={StyleSheet.flatten([styles.summaryTitle, { color: theme.text }])}>
                  {targetReps} {EXERCISE_LABELS[exerciseType]}
                </Text>
                <Text style={StyleSheet.flatten([styles.summaryMeta, { color: theme.textSecondary }])}>
                  {formatRaceTimeLimit(timeLimitSeconds)} · fastest finisher wins
                </Text>
              </>
            )}
          </View>

          {error ? (
            <Text style={StyleSheet.flatten([styles.error, { color: theme.danger }])}>{error}</Text>
          ) : null}

          <PrimaryButton
            label={atRequestLimit ? 'Monthly limit reached' : 'Send Challenge'}
            loading={isSubmitting}
            disabled={submitDisabled}
            onPress={() => void handleSubmit()}
          />
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
  friendList: {
    gap: Spacing.two,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  friendInfo: {
    flex: 1,
    gap: Spacing.half,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '700',
  },
  friendMeta: {
    fontSize: 13,
    fontWeight: '600',
  },
  templateRow: {
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  templateInfo: {
    gap: Spacing.half,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  exerciseRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  exerciseChip: {
    flexGrow: 1,
    flexBasis: '45%',
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
  error: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
