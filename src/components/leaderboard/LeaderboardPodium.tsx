import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { AppIcon } from '@/components/ui/AppIcon';
import { Radius, Spacing } from '@/constants/theme';
import {
  getLeaderboardXpLabel,
  type LeaderboardEntry,
  type LeaderboardPeriod,
} from '@/types/leaderboard';
import { useTheme } from '@/hooks/use-theme';

interface LeaderboardPodiumProps {
  entries: LeaderboardEntry[];
  period: LeaderboardPeriod;
  onPress?: (entry: LeaderboardEntry) => void;
}

interface PodiumSlot {
  place: 1 | 2 | 3;
  entry: LeaderboardEntry | undefined;
  pedestalHeight: number;
  accentColor: string;
}

const PODIUM_LAYOUT: Array<Omit<PodiumSlot, 'entry'>> = [
  { place: 2, pedestalHeight: 72, accentColor: '#94A3B8' },
  { place: 1, pedestalHeight: 96, accentColor: '#F59E0B' },
  { place: 3, pedestalHeight: 56, accentColor: '#D97706' },
];

export function LeaderboardPodium({ entries, period, onPress }: LeaderboardPodiumProps) {
  const theme = useTheme();
  const xpLabel = getLeaderboardXpLabel(period);

  const slots: PodiumSlot[] = PODIUM_LAYOUT.map((slot) => ({
    ...slot,
    entry: entries.find((candidate) => candidate.rank === slot.place),
  }));

  if (slots.every((slot) => !slot.entry)) {
    return null;
  }

  return (
    <View style={styles.container}>
      {slots.map((slot) => {
        const { entry, place, pedestalHeight, accentColor } = slot;

        if (!entry) {
          return <View key={place} style={styles.slot} />;
        }

        const displayName = entry.displayName ?? entry.username;

        return (
          <Pressable
            key={place}
            disabled={!onPress}
            onPress={() => onPress?.(entry)}
            style={({ pressed }) => [
              styles.slot,
              { opacity: pressed ? 0.85 : 1 },
            ]}>
            <View style={styles.avatarWrap}>
              <View
                style={StyleSheet.flatten([
                  styles.avatarGlow,
                  { backgroundColor: `${accentColor}22` },
                ])}
              />
              <ProfileAvatar
                uri={entry.avatarUrl}
                name={displayName}
                size={place === 1 ? 64 : 56}
                shopAvatar={entry.avatar}
                frame={entry.frame}
              />
              <View
                style={StyleSheet.flatten([
                  styles.rankBadge,
                  {
                    backgroundColor: accentColor,
                    borderColor: theme.backgroundElement,
                  },
                ])}>
                {place === 1 ? (
                  <AppIcon name="crown" size={12} color="#FFFFFF" weight="bold" />
                ) : (
                  <Text style={styles.rankBadgeText}>{place}</Text>
                )}
              </View>
            </View>

            <Text
              numberOfLines={1}
              style={StyleSheet.flatten([styles.name, { color: theme.text }])}>
              {displayName}
              {entry.isCurrentUser ? ' (You)' : ''}
            </Text>

            <Text style={StyleSheet.flatten([styles.xpValue, { color: accentColor }])}>
              {entry.xpAmount.toLocaleString()}
            </Text>
            <Text style={StyleSheet.flatten([styles.xpLabel, { color: theme.textSecondary }])}>
              {xpLabel}
            </Text>

            <View
              style={StyleSheet.flatten([
                styles.pedestal,
                {
                  height: pedestalHeight,
                  backgroundColor: `${accentColor}20`,
                  borderColor: `${accentColor}55`,
                },
              ])}>
              <Text style={StyleSheet.flatten([styles.pedestalRank, { color: accentColor }])}>
                #{place}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
    maxWidth: 112,
  },
  avatarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  avatarGlow: {
    position: 'absolute',
    width: 78,
    height: 78,
    borderRadius: 39,
  },
  rankBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  rankBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  name: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    width: '100%',
  },
  xpValue: {
    fontSize: 14,
    fontWeight: '900',
  },
  xpLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pedestal: {
    width: '100%',
    marginTop: Spacing.one,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pedestalRank: {
    fontSize: 22,
    fontWeight: '900',
    opacity: 0.85,
  },
});
