import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FriendChallengesCarousel } from '@/components/home/FriendChallengesCarousel';
import { AppIcon } from '@/components/ui/AppIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Radius, Spacing } from '@/constants/theme';
import type { FriendChallengeGroup } from '@/features/friends/friendChallengeGroups';
import { useTheme } from '@/hooks/use-theme';

interface FriendChallengesByFriendProps {
  groups: FriendChallengeGroup[];
  busyChallengeId: string | null;
  onAccept: (participantId: string) => void;
  onDecline: (participantId: string) => void;
}

export function FriendChallengesByFriend({
  groups,
  busyChallengeId,
  onAccept,
  onDecline,
}: FriendChallengesByFriendProps) {
  const theme = useTheme();

  if (groups.length === 0) {
    return (
      <View
        style={StyleSheet.flatten([
          styles.emptyCard,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ])}>
        <View style={StyleSheet.flatten([styles.emptyIcon, { backgroundColor: theme.backgroundSelected }])}>
          <AppIcon name="friends" size={28} color={theme.primary} />
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
      {groups.map((group) => (
        <View key={group.friendId} style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleBlock}>
              <Text style={StyleSheet.flatten([styles.sectionTitle, { color: theme.text }])}>
                {group.friendName}
              </Text>
              <Text style={StyleSheet.flatten([styles.sectionMeta, { color: theme.textSecondary }])}>
                @{group.friendUsername} · {group.challenges.length}{' '}
                {group.challenges.length === 1 ? 'race' : 'races'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View ${group.friendName}'s profile`}
              onPress={() =>
                router.push({
                  pathname: '/friends/[userId]',
                  params: { userId: group.friendId, username: group.friendUsername },
                })
              }
              style={StyleSheet.flatten([
                styles.profileLink,
                { borderColor: theme.border, backgroundColor: theme.backgroundElement },
              ])}>
              <Text style={StyleSheet.flatten([styles.profileLinkText, { color: theme.primary }])}>Profile</Text>
            </Pressable>
          </View>

          <FriendChallengesCarousel
            challenges={group.challenges}
            busyChallengeId={busyChallengeId}
            onAccept={onAccept}
            onDecline={onDecline}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.five,
  },
  section: {
    gap: Spacing.three,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  sectionTitleBlock: {
    flex: 1,
    gap: Spacing.half,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  sectionMeta: {
    fontSize: 13,
    fontWeight: '600',
  },
  profileLink: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  profileLinkText: {
    fontSize: 13,
    fontWeight: '700',
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
