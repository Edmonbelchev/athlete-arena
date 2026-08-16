import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { AppIcon } from '@/components/ui/AppIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Radius, Spacing } from '@/constants/theme';
import type { FriendWithActiveChallengesSummary } from '@/types/friends';
import { useTheme } from '@/hooks/use-theme';

interface FriendsWithActiveChallengesListProps {
  friends: FriendWithActiveChallengesSummary[];
}

export function FriendsWithActiveChallengesList({ friends }: FriendsWithActiveChallengesListProps) {
  const theme = useTheme();

  if (friends.length === 0) {
    return (
      <View
        style={StyleSheet.flatten([
          styles.emptyCard,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ])}>
        <View style={StyleSheet.flatten([styles.emptyIcon, { backgroundColor: theme.backgroundSelected }])}>
          <AppIcon name="swords" size={28} color={theme.primary} />
        </View>
        <Text style={StyleSheet.flatten([styles.emptyTitle, { color: theme.text }])}>No active races</Text>
        <Text style={StyleSheet.flatten([styles.emptyCopy, { color: theme.textSecondary }])}>
          Start a speed race from a friend&apos;s profile or accept an incoming challenge.
        </Text>
        <PrimaryButton label="Go to Friends" onPress={() => router.push('/(tabs)/friends')} />
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {friends.map((friend) => {
        const displayName = friend.displayName ?? friend.username;

        return (
          <Pressable
            key={friend.friendId}
            accessibilityRole="button"
            accessibilityLabel={`View challenges with ${displayName}`}
            onPress={() =>
              router.push({
                pathname: '/friends/challenges/[friendId]',
                params: {
                  friendId: friend.friendId,
                  username: friend.username,
                  displayName: friend.displayName ?? '',
                },
              })
            }
            style={({ pressed }) =>
              StyleSheet.flatten([
                styles.row,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                  opacity: pressed ? 0.88 : 1,
                },
              ])
            }>
            <ProfileAvatar name={displayName} size={48} />

            <View style={styles.copy}>
              <Text style={StyleSheet.flatten([styles.name, { color: theme.text }])}>{displayName}</Text>
              <Text style={StyleSheet.flatten([styles.meta, { color: theme.textSecondary }])}>
                @{friend.username} · {friend.activeCount} active {friend.activeCount === 1 ? 'race' : 'races'}
              </Text>
            </View>

            <View style={StyleSheet.flatten([styles.badge, { backgroundColor: theme.primary }])}>
              <Text style={styles.badgeText}>{friend.activeCount}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.two,
  },
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
    gap: Spacing.half,
  },
  name: {
    fontSize: 17,
    fontWeight: '800',
  },
  meta: {
    fontSize: 13,
    fontWeight: '600',
  },
  badge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.one,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  emptyCard: {
    alignItems: 'center',
    padding: Spacing.four,
    borderRadius: Radius.xl,
    borderWidth: 1,
    gap: Spacing.two,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  emptyCopy: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
});
