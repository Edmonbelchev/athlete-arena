import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { Radius, Spacing } from '@/constants/theme';
import type { FriendSummary } from '@/types/friends';
import { useTheme } from '@/hooks/use-theme';

interface FriendListItemProps {
  friend: FriendSummary;
  onPress?: () => void;
  onChallenge?: () => void;
}

export function FriendListItem({ friend, onPress, onChallenge }: FriendListItemProps) {
  const theme = useTheme();
  const displayName = friend.displayName ?? friend.username;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      <ProfileAvatar
        uri={friend.avatarUrl}
        name={displayName}
        size={44}
        shopAvatar={friend.avatar}
        frame={friend.frame}
      />

      <View style={styles.info}>
        <Text style={[styles.name, { color: theme.text }]}>{displayName}</Text>
        <Text style={[styles.meta, { color: theme.textSecondary }]}>
          @{friend.username} · Lvl {friend.level} · {friend.currentStreak} day streak
        </Text>
      </View>

      {onChallenge ? (
        <Pressable
          onPress={onChallenge}
          style={[styles.challengeButton, { backgroundColor: theme.backgroundSelected }]}>
          <Text style={[styles.challengeLabel, { color: theme.primary }]}>Challenge</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.three,
  },
  info: {
    flex: 1,
    gap: Spacing.half,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
  },
  meta: {
    fontSize: 12,
    fontWeight: '500',
  },
  challengeButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.sm,
  },
  challengeLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
});
