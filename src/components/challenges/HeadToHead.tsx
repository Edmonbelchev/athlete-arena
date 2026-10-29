import { StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ChallengeStatus } from '@/types/friends';

type Tone = 'success' | 'danger' | 'muted' | 'primary';

export const PARTICIPANT_STATUS: Record<ChallengeStatus, { label: string; tone: Tone }> = {
  completed: { label: 'Finished', tone: 'success' },
  in_progress: { label: 'In progress', tone: 'primary' },
  pending: { label: 'Not started', tone: 'muted' },
  expired: { label: 'Expired', tone: 'danger' },
  declined: { label: 'Declined', tone: 'danger' },
};

export interface HeadToHeadPlayer {
  name: string;
  /** Big score - time, rounds, or reps; "—" when there is none yet. */
  score: string;
  caption: string;
  detail?: string | null;
  status?: ChallengeStatus | null;
  isWinner?: boolean;
}

function PlayerCard({ player }: { player: HeadToHeadPlayer }) {
  const theme = useTheme();
  const statusMeta = player.status ? PARTICIPANT_STATUS[player.status] : null;
  const statusColor = !statusMeta
    ? theme.textSecondary
    : statusMeta.tone === 'success'
      ? theme.success
      : statusMeta.tone === 'danger'
        ? theme.danger
        : statusMeta.tone === 'primary'
          ? theme.primary
          : theme.textSecondary;

  return (
    <View
      style={[
        styles.playerCard,
        {
          backgroundColor: player.isWinner ? `${theme.success}12` : theme.background,
          borderColor: player.isWinner ? theme.success : theme.border,
        },
      ]}>
      <View style={styles.nameRow}>
        {player.isWinner ? <AppIcon name="crown" size={14} color={theme.success} weight="bold" /> : null}
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {player.name}
        </Text>
      </View>
      <Text
        style={[styles.score, { color: player.isWinner ? theme.success : theme.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit>
        {player.score}
      </Text>
      <Text style={[styles.caption, { color: theme.textSecondary }]}>{player.caption}</Text>
      {player.detail ? <Text style={[styles.detail, { color: theme.text }]}>{player.detail}</Text> : null}
      {statusMeta ? (
        <View style={[styles.statusPill, { backgroundColor: `${statusColor}1F` }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusMeta.label}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Two player score cards side by side with a VS badge; the winner gets a crown. */
export function HeadToHead({ me, opponent }: { me: HeadToHeadPlayer; opponent: HeadToHeadPlayer }) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <PlayerCard player={me} />
      <View style={[styles.versusBadge, { backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}>
        <Text style={[styles.versusText, { color: theme.textSecondary }]}>VS</Text>
      </View>
      <PlayerCard player={opponent} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    alignSelf: 'stretch',
  },
  versusBadge: {
    alignSelf: 'center',
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: -Spacing.two,
    zIndex: 1,
  },
  versusText: {
    fontSize: 11,
    fontWeight: '900',
  },
  playerCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    alignItems: 'center',
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
  },
  name: {
    fontSize: 14,
    fontWeight: '800',
    flexShrink: 1,
  },
  score: {
    fontSize: 32,
    fontWeight: '900',
    marginTop: Spacing.one,
  },
  caption: {
    fontSize: 12,
    fontWeight: '600',
  },
  detail: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusPill: {
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
});
