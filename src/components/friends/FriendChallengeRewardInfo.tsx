import { StyleSheet, Text, View } from 'react-native';

import { formatCoinAmount } from '@/constants/coins';
import {
  FRIEND_CHALLENGE_PARTICIPATION_COINS,
  FRIEND_CHALLENGE_PARTICIPATION_XP,
  FRIEND_CHALLENGE_WINNER_BONUS_COINS,
  FRIEND_CHALLENGE_WINNER_BONUS_XP,
  FRIEND_CHALLENGE_WINNER_TOTAL_COINS,
  FRIEND_CHALLENGE_WINNER_TOTAL_XP,
} from '@/constants/friendChallengeRewards';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function FriendChallengeRewardInfo() {
  const theme = useTheme();

  return (
    <View
      style={StyleSheet.flatten([
        styles.card,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ])}>
      <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>Challenge rewards</Text>
      <Text style={StyleSheet.flatten([styles.line, { color: theme.textSecondary }])}>
        Finish the challenge: +{FRIEND_CHALLENGE_PARTICIPATION_XP} XP & {formatCoinAmount(FRIEND_CHALLENGE_PARTICIPATION_COINS)}
      </Text>
      <Text style={StyleSheet.flatten([styles.line, { color: theme.textSecondary }])}>
        Win the head-to-head: extra +{FRIEND_CHALLENGE_WINNER_BONUS_XP} XP & {formatCoinAmount(FRIEND_CHALLENGE_WINNER_BONUS_COINS)}
      </Text>
      <Text style={StyleSheet.flatten([styles.preview, { color: theme.xp }])}>
        Winner total: +{FRIEND_CHALLENGE_WINNER_TOTAL_XP} XP & {formatCoinAmount(FRIEND_CHALLENGE_WINNER_TOTAL_COINS)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  line: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
  preview: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
});
