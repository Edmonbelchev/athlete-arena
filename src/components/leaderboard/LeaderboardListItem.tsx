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
  xpLabel?: string;
  onPress?: () => void;
}

export function LeaderboardListItem({ entry, xpLabel = 'XP', onPress }: LeaderboardListItemProps) {
  const theme = useTheme();
  const displayName = entry.displayName ?? entry.username;
  const rankAccent = getRankAccentColor(entry.rank);
  const rankIcon = getRankIcon(entry.rank);
  const isTopTen = entry.rank <= 10;

  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: entry.isCurrentUser ? `${theme.primary}12` : theme.backgroundElement,
          borderColor: entry.isCurrentUser ? theme.primary : theme.border,
          opacity: pressed ? 0.88 : 1,
        },
        entry.isCurrentUser ? styles.rowCurrentUser : null,
      ]}>
      <View
        style={[
          styles.rankBadge,
          {
            backgroundColor: rankAccent ? `${rankAccent}18` : theme.backgroundSelected,
            borderColor: rankAccent ? `${rankAccent}44` : theme.border,
          },
        ]}>
        {rankIcon ? (
          <AppIcon name={rankIcon} size={14} color={rankAccent ?? theme.primary} weight="bold" />
        ) : (
          <Text style={[styles.rank, { color: rankAccent ?? theme.textSecondary }]}>
            {entry.rank}
          </Text>
        )}
      </View>

      <ProfileAvatar
        uri={entry.avatarUrl}
        name={displayName}
        size={46}
        shopAvatar={entry.avatar}
        frame={entry.frame}
      />

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {displayName}
          </Text>
          {entry.isCurrentUser ? (
            <View style={[styles.youChip, { backgroundColor: theme.primary }]}>
              <Text style={styles.youChipText}>YOU</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.meta, { color: theme.textSecondary }]}>
          @{entry.username} · Lvl {entry.level}
        </Text>
      </View>

      <View style={[styles.xpBlock, { backgroundColor: isTopTen ? `${theme.xp}14` : theme.backgroundSelected }]}>
        <AppIcon name="bolt" size={13} color={theme.xp} weight="bold" />
        <Text style={[styles.xpValue, { color: theme.text }]}>{entry.xpAmount.toLocaleString()}</Text>
        <Text style={[styles.xpLabel, { color: theme.textSecondary }]}>{xpLabel}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.two,
  },
  rowCurrentUser: {
    borderWidth: 1.5,
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rank: {
    fontSize: 14,
    fontWeight: '900',
  },
  info: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  name: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  youChip: {
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  youChipText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  meta: {
    fontSize: 12,
    fontWeight: '500',
  },
  xpBlock: {
    alignItems: 'center',
    minWidth: 72,
    borderRadius: Radius.md,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    gap: 1,
  },
  xpValue: {
    fontSize: 15,
    fontWeight: '900',
  },
  xpLabel: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
