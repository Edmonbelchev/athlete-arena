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
  scoreLabel?: string;
  scoreDisplays?: Record<string, { value: string; subLabel?: string }>;
  onPress?: (entry: LeaderboardEntry) => void;
}

interface PodiumSlot {
  place: 1 | 2 | 3;
  entry: LeaderboardEntry | undefined;
  pedestalHeight: number;
  accentColor: string;
}

const PODIUM_LAYOUT: Array<Omit<PodiumSlot, 'entry'>> = [
  { place: 2, pedestalHeight: 88, accentColor: '#94A3B8' },
  { place: 1, pedestalHeight: 116, accentColor: '#F59E0B' },
  { place: 3, pedestalHeight: 68, accentColor: '#D97706' },
];

export function LeaderboardPodium({ entries, period, scoreLabel, scoreDisplays, onPress }: LeaderboardPodiumProps) {
  const theme = useTheme();
  const xpLabel = scoreLabel ?? getLeaderboardXpLabel(period);

  const slots: PodiumSlot[] = PODIUM_LAYOUT.map((slot) => ({
    ...slot,
    entry: entries.find((candidate) => candidate.rank === slot.place),
  }));

  if (slots.every((slot) => !slot.entry)) {
    return null;
  }

  return (
    <View
      style={[
        styles.stageCard,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.border,
        },
      ]}>
      <View style={styles.stageHeader}>
        <AppIcon name="crown" size={16} color={theme.accent} weight="bold" />
        <Text style={[styles.stageTitle, { color: theme.text }]}>Top 3</Text>
      </View>

      <View style={styles.ambientOrbs} pointerEvents="none">
        <View style={[styles.orb, styles.orbLeft, { backgroundColor: `${theme.primary}18` }]} />
        <View style={[styles.orb, styles.orbRight, { backgroundColor: `${theme.accent}16` }]} />
      </View>

      <View style={styles.container}>
        {slots.map((slot) => {
          const { entry, place, pedestalHeight, accentColor } = slot;

          if (!entry) {
            return <View key={place} style={styles.slot} />;
          }

          const displayName = entry.displayName ?? entry.username;
          const avatarSize = place === 1 ? 72 : 58;
          const customScore = scoreDisplays?.[entry.userId];

          return (
            <Pressable
              key={place}
              disabled={!onPress}
              onPress={() => onPress?.(entry)}
              style={({ pressed }) => [
                styles.slot,
                place === 1 ? styles.slotWinner : null,
                { opacity: pressed ? 0.88 : 1 },
              ]}>
              <View style={styles.avatarWrap}>
                <View
                  style={[
                    styles.avatarRing,
                    {
                      borderColor: accentColor,
                      width: avatarSize + 8,
                      height: avatarSize + 8,
                    },
                  ]}>
                  <ProfileAvatar
                    uri={entry.avatarUrl}
                    name={displayName}
                    size={avatarSize}
                    shopAvatar={entry.avatar}
                    frame={entry.frame}
                  />
                </View>
                <View
                  style={[
                    styles.rankBadge,
                    {
                      backgroundColor: accentColor,
                      borderColor: theme.backgroundElement,
                    },
                  ]}>
                  {place === 1 ? (
                    <AppIcon name="crown" size={12} color="#FFFFFF" weight="bold" />
                  ) : (
                    <Text style={styles.rankBadgeText}>{place}</Text>
                  )}
                </View>
              </View>

              <Text numberOfLines={1} style={[styles.name, { color: theme.text }]}>
                {displayName}
              </Text>
              {entry.isCurrentUser ? (
                <View style={[styles.youPill, { backgroundColor: `${theme.primary}22` }]}>
                  <Text style={[styles.youPillText, { color: theme.primary }]}>YOU</Text>
                </View>
              ) : (
                <Text style={[styles.level, { color: theme.textSecondary }]}>
                  Lvl {entry.level}
                </Text>
              )}

              <View style={[styles.xpPill, { backgroundColor: `${accentColor}18` }]}>
                {customScore ? (
                  <Text style={[styles.xpValue, { color: accentColor }]}>{customScore.value}</Text>
                ) : (
                  <>
                    <AppIcon name="bolt" size={12} color={accentColor} weight="bold" />
                    <Text style={[styles.xpValue, { color: accentColor }]}>
                      {entry.xpAmount.toLocaleString()}
                    </Text>
                  </>
                )}
              </View>
              <Text style={[styles.xpLabel, { color: theme.textSecondary }]}>
                {customScore?.subLabel ?? xpLabel}
              </Text>

              <View style={styles.pedestalStack}>
                <View
                  style={[
                    styles.pedestalFace,
                    {
                      height: pedestalHeight,
                      backgroundColor: `${accentColor}28`,
                      borderColor: `${accentColor}66`,
                    },
                  ]}>
                  <View style={[styles.pedestalHighlight, { backgroundColor: `${accentColor}35` }]} />
                  <Text style={[styles.pedestalRank, { color: accentColor }]}>#{place}</Text>
                </View>
                <View
                  style={[
                    styles.pedestalBase,
                    { backgroundColor: `${accentColor}40`, borderColor: `${accentColor}55` },
                  ]}
                />
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.stageFloor, { backgroundColor: `${theme.primary}12` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  stageCard: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.two,
    overflow: 'hidden',
    gap: Spacing.two,
  },
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  stageTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  ambientOrbs: {
    ...StyleSheet.absoluteFillObject,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbLeft: {
    width: 120,
    height: 120,
    top: 24,
    left: -28,
  },
  orbRight: {
    width: 96,
    height: 96,
    top: 48,
    right: -16,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingTop: Spacing.one,
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.half,
    maxWidth: 118,
  },
  slotWinner: {
    marginBottom: Spacing.one,
  },
  avatarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.half,
  },
  avatarRing: {
    borderWidth: 2,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    minWidth: 26,
    height: 26,
    borderRadius: 13,
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
  youPill: {
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.one,
    paddingVertical: 2,
  },
  youPillText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  level: {
    fontSize: 11,
    fontWeight: '600',
  },
  xpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.one,
    paddingVertical: 3,
    marginTop: Spacing.half,
  },
  xpValue: {
    fontSize: 13,
    fontWeight: '900',
  },
  xpLabel: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pedestalStack: {
    width: '100%',
    marginTop: Spacing.one,
    alignItems: 'center',
  },
  pedestalFace: {
    width: '100%',
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pedestalHighlight: {
    position: 'absolute',
    top: 0,
    left: 8,
    right: 8,
    height: 4,
    borderRadius: 2,
  },
  pedestalRank: {
    fontSize: 24,
    fontWeight: '900',
    opacity: 0.9,
  },
  pedestalBase: {
    width: '108%',
    height: 8,
    borderBottomLeftRadius: Radius.sm,
    borderBottomRightRadius: Radius.sm,
    borderWidth: 1,
    borderTopWidth: 0,
  },
  stageFloor: {
    height: 6,
    borderRadius: Radius.sm,
    marginTop: Spacing.half,
  },
});
