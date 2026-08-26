import { StyleSheet, Text, View } from 'react-native';

import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Radius, Spacing } from '@/constants/theme';
import type { FriendPublicProfile } from '@/types/friends';
import { useTheme } from '@/hooks/use-theme';

interface FriendProfileHeroProps {
  profile: FriendPublicProfile;
  isFriend: boolean;
  isSelf?: boolean;
  onChallenge: () => void;
  onViewHistory?: () => void;
  onAddFriend?: () => void;
  isAddingFriend?: boolean;
}

export function FriendProfileHero({
  profile,
  isFriend,
  isSelf = false,
  onChallenge,
  onViewHistory,
  onAddFriend,
  isAddingFriend = false,
}: FriendProfileHeroProps) {
  const theme = useTheme();
  const displayName = profile.displayName ?? profile.username;

  return (
    <View
      style={StyleSheet.flatten([
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border },
      ])}>
      <ProfileAvatar
        uri={profile.avatarUrl}
        name={displayName}
        size={104}
        shopAvatar={profile.avatar}
        frame={profile.frame}
      />

      <View style={styles.identity}>
        <Text style={StyleSheet.flatten([styles.displayName, { color: theme.text }])}>{displayName}</Text>
        <Text style={StyleSheet.flatten([styles.username, { color: theme.textSecondary }])}>
          @{profile.username}
        </Text>
      </View>

      <View style={StyleSheet.flatten([styles.levelPill, { backgroundColor: theme.backgroundSelected }])}>
        <Text style={StyleSheet.flatten([styles.levelLabel, { color: theme.textSecondary }])}>Level</Text>
        <Text style={StyleSheet.flatten([styles.levelValue, { color: theme.primary }])}>{profile.level}</Text>
      </View>

      {!isSelf ? (
        <View style={styles.actions}>
          <PrimaryButton
            label={isFriend ? 'Challenge Friend' : 'Add Friend'}
            loading={isAddingFriend}
            onPress={isFriend ? onChallenge : onAddFriend}
          />
          {isFriend && onViewHistory ? (
            <PrimaryButton label="Race History" variant="secondary" onPress={onViewHistory} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  identity: {
    alignItems: 'center',
    gap: Spacing.half,
  },
  displayName: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  username: {
    fontSize: 15,
    fontWeight: '600',
  },
  levelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  levelLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  levelValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  actions: {
    alignSelf: 'stretch',
    gap: Spacing.two,
  },
});
