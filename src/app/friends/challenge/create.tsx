import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { FriendChallengeRewardInfo } from '@/components/friends/FriendChallengeRewardInfo';
import { EmotePicker } from '@/components/shop/EmotePicker';
import { AuthTextInput } from '@/components/ui/AuthTextInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import {
    EXERCISE_LABELS,
    EXERCISE_TYPES,
    type ExerciseType,
} from '@/constants/challenges';

import {
    FRIEND_CHALLENGE_REP_MAX,
    FRIEND_CHALLENGE_REP_MIN,
    FRIEND_CHALLENGE_REP_PRESETS,
    FRIEND_CHALLENGE_TIME_PRESETS,
    formatRaceTimeLimit,
    getDefaultRepsForExercise,
} from '@/constants/friendChallenges';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useFriends } from '@/features/friends/useFriends';
import { useShop } from '@/features/shop/ShopProvider';
import { getOwnedEmotes } from '@/features/shop/shopUtils';
import { useTheme } from '@/hooks/use-theme';
import { formatUserError } from '@/lib/errors';
import { createFriendChallenge } from '@/services/friendChallengeService';
import type { FriendSummary } from '@/types/friends';

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
  const [exerciseType, setExerciseType] = useState<ExerciseType>('push_ups');
  const [targetReps, setTargetReps] = useState(getDefaultRepsForExercise('push_ups'));
  const [customReps, setCustomReps] = useState('');
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [selectedEmoteId, setSelectedEmoteId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { items } = useShop();
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

  async function handleSubmit() {
    if (!selectedFriendId) {
      setError('Select a friend to challenge');
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
    } catch (err) {
      setError(formatUserError(err, 'Failed to send challenge'));
    } finally {
      setIsSubmitting(false);
    }
  }

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

          <FriendChallengeRewardInfo exerciseType={exerciseType} targetReps={targetReps} />

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
            <Text style={StyleSheet.flatten([styles.summaryTitle, { color: theme.text }])}>
              {targetReps} {EXERCISE_LABELS[exerciseType]}
            </Text>
            <Text style={StyleSheet.flatten([styles.summaryMeta, { color: theme.textSecondary }])}>
              {formatRaceTimeLimit(timeLimitSeconds)} · fastest finisher wins
            </Text>
          </View>

          {error ? (
            <Text style={StyleSheet.flatten([styles.error, { color: theme.danger }])}>{error}</Text>
          ) : null}

          <PrimaryButton
            label="Send Challenge"
            loading={isSubmitting}
            disabled={!selectedFriendId}
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
