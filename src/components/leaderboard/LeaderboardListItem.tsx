import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { AppIcon } from '@/components/ui/AppIcon';
import { Radius, Spacing } from '@/constants/theme';
import {
  getRankAccentColor,
  getRankIcon,
  type LeaderboardEntry,
} from '@/types/leaderboard';
import { useTheme } from '@/hooks/use-theme';

interface LeaderboardListItemProps {
  entry: LeaderboardEntry;
  onPress?: () => void;
}

export function LeaderboardListItem({ entry, onPress }: LeaderboardListItemProps) {
  const theme = useTheme();
  const displayName = entry.displayName ?? entry.username;
  const rankAccent = getRankAccentColor(entry.rank);
  const rankIcon = getRankIcon(entry.rank);

  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: entry.isCurrentUser ? theme.backgroundSelected : theme.backgroundElement,
          borderColor: entry.isCurrentUser ? theme.primary : theme.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      <View style={styles.rankColumn}>
        {rankIcon ? (
          <AppIcon name={rankIcon} size={18} color={rankAccent ?? theme.primary} />
        ) : null}
        <Text
          style={[
            styles.rank,
            { color: rankAccent ?? theme.textSecondary },
            entry.rank <= 3 ? styles.rankTop : null,
          ]}>
          #{entry.rank}
        </Text>
      </View>

      <ProfileAvatar
        uri={entry.avatarUrl}
        name={displayName}
        size={44}
        shopAvatar={entry.avatar}
        frame={entry.frame}
      />

      <View style={styles.info}>
        <Text style={[styles.name, { color: theme.text }]}>
          {displayName}
          {entry.isCurrentUser ? ' (You)' : ''}
        </Text>
        <Text style={[styles.meta, { color: theme.textSecondary }]}>
          @{entry.username} · Lvl {entry.level}
        </Text>
      </View>

      <View style={styles.xpBlock}>
        <Text style={[styles.xpValue, { color: theme.text }]}>{entry.xpAmount.toLocaleString()}</Text>
        <Text style={[styles.xpLabel, { color: theme.textSecondary }]}>XP</Text>
      </View>
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
    gap: Spacing.two,
  },
  rankColumn: {
    width: 44,
    alignItems: 'center',
    gap: Spacing.half,
  },
  rank: {
    fontSize: 13,
    fontWeight: '700',
  },
  rankTop: {
    fontSize: 14,
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
  xpBlock: {
    alignItems: 'flex-end',
    minWidth: 56,
  },
  xpValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  xpLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
