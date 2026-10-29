import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HeadToHead, PARTICIPANT_STATUS, type HeadToHeadPlayer } from '@/components/challenges/HeadToHead';
import { RewardTiles } from '@/components/rewards/RewardTiles';
import { AppIcon } from '@/components/ui/AppIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { formatExerciseLabel } from '@/constants/challenges';
import { formatWorkoutTimeLimit, getCustomWorkoutTypeLabel } from '@/constants/customWorkouts';
import { getDailyMissionQuestMeta } from '@/constants/dailyMissionQuest';
import { formatRaceTime } from '@/constants/friendChallenges';
import type { AppIconName } from '@/constants/icons';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth';
import { getSelectedHistoryEntry } from '@/features/history/historyEntryStore';
import { useTheme } from '@/hooks/use-theme';
import { formatUserError } from '@/lib/errors';
import { leaveScreen } from '@/lib/navigation';
import { getWorkoutSessionDetail, type WorkoutSessionDetail } from '@/services/workoutCatalogService';
import {
  isSoloWorkoutHistoryEntry,
  type ActivityHistoryEntry,
  type SoloWorkoutHistoryEntry,
} from '@/types/activityHistory';
import { formatWorkoutSessionScore } from '@/types/catalogWorkouts';
import {
  getHistoryEarnedRewards,
  getHistoryKindLabel,
  getHistoryOpponentName,
  getHistoryTitle,
  type ChallengeHistoryEntry,
} from '@/types/challengeHistory';

type Theme = ReturnType<typeof useTheme>;
type Tone = 'success' | 'danger' | 'muted' | 'primary';

function toneColor(theme: Theme, tone: Tone): string {
  switch (tone) {
    case 'success':
      return theme.success;
    case 'danger':
      return theme.danger;
    case 'primary':
      return theme.primary;
    default:
      return theme.textSecondary;
  }
}

function formatDetailDate(isoDate: string): string {
  return new Date(isoDate).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

interface Outcome {
  label: string;
  tone: Tone;
  icon: AppIconName;
}

function getChallengeOutcome(entry: ChallengeHistoryEntry, myUserId: string | undefined): Outcome {
  if (entry.kind === 'daily') {
    return entry.status === 'completed'
      ? { label: 'Quest cleared', tone: 'success', icon: 'target' }
      : { label: 'Not completed', tone: 'muted', icon: 'target' };
  }

  if (entry.status === 'expired') {
    return { label: 'Expired', tone: 'danger', icon: 'swords' };
  }

  if (entry.status === 'declined') {
    return { label: 'Declined', tone: 'danger', icon: 'swords' };
  }

  if (entry.winnerUserId && myUserId) {
    return entry.winnerUserId === myUserId
      ? { label: 'You won', tone: 'success', icon: 'crown' }
      : { label: 'You lost', tone: 'danger', icon: 'swords' };
  }

  if (entry.status === 'completed' && entry.opponentStatus === 'completed') {
    return { label: 'Tie', tone: 'muted', icon: 'swords' };
  }

  if (entry.status === 'completed') {
    const opponent = getHistoryOpponentName(entry);
    return opponent && entry.opponentStatus !== 'completed'
      ? { label: `Waiting for ${opponent}`, tone: 'primary', icon: 'medal' }
      : { label: 'Completed', tone: 'success', icon: 'medal' };
  }

  return { label: PARTICIPANT_STATUS[entry.status].label, tone: 'muted', icon: 'swords' };
}

function Hero({
  eyebrow,
  title,
  date,
  outcome,
  theme,
}: {
  eyebrow: string;
  title: string;
  date: string;
  outcome: Outcome;
  theme: Theme;
}) {
  const color = toneColor(theme, outcome.tone);

  return (
    <View style={styles.hero}>
      <View style={[styles.heroIcon, { backgroundColor: `${color}1F`, borderColor: `${color}55` }]}>
        <AppIcon name={outcome.icon} size={30} color={color} weight="bold" />
      </View>
      <Text style={[styles.eyebrow, { color: theme.textSecondary }]}>{eyebrow}</Text>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.date, { color: theme.textSecondary }]}>{date}</Text>
      <View style={[styles.outcomePill, { backgroundColor: `${color}1F` }]}>
        <Text style={[styles.outcomeText, { color }]}>{outcome.label}</Text>
      </View>
    </View>
  );
}

function InfoChips({ items, theme }: { items: string[]; theme: Theme }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <View style={styles.chipRow}>
      {items.map((item) => (
        <View key={item} style={[styles.infoChip, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <Text style={[styles.infoChipText, { color: theme.text }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function Section({ title, theme, children }: { title: string; theme: Theme; children: ReactNode }) {
  return (
    <View style={[styles.section, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{title}</Text>
      {children}
    </View>
  );
}

function StatTiles({ tiles, theme }: { tiles: Array<{ label: string; value: string }>; theme: Theme }) {
  return (
    <View style={styles.tileGrid}>
      {tiles.map((tile) => (
        <View key={tile.label} style={[styles.tile, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <Text style={[styles.tileValue, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>
            {tile.value}
          </Text>
          <Text style={[styles.tileLabel, { color: theme.textSecondary }]}>{tile.label}</Text>
        </View>
      ))}
    </View>
  );
}

function RewardsSection({
  xp,
  coins,
  note,
  emptyCopy,
  theme,
}: {
  xp: number;
  coins: number;
  note?: string | null;
  emptyCopy: string;
  theme: Theme;
}) {
  const hasRewards = xp > 0 || coins > 0;

  return (
    <Section title="REWARDS" theme={theme}>
      {hasRewards ? (
        <RewardTiles xp={xp} coins={coins} />
      ) : (
        <Text style={[styles.muted, { color: theme.textSecondary }]}>{emptyCopy}</Text>
      )}
      {note && hasRewards ? <Text style={[styles.note, { color: theme.textSecondary }]}>{note}</Text> : null}
    </Section>
  );
}

function getPlayer(entry: ChallengeHistoryEntry, side: 'mine' | 'theirs', isWinner: boolean): HeadToHeadPlayer {
  const mine = side === 'mine';
  const status = mine ? entry.status : entry.opponentStatus;
  const finished = status === 'completed';
  const raceSeconds = mine ? entry.raceSeconds : entry.opponentRaceSeconds;
  const name = mine ? 'You' : (getHistoryOpponentName(entry) ?? 'Opponent');
  const base = { name, status, isWinner };

  if (entry.friendChallengeKind === 'workout') {
    if (entry.workoutType === 'for_time') {
      return { ...base, score: finished ? formatRaceTime(raceSeconds) : '—', caption: 'finish time' };
    }

    const rounds = mine ? entry.completedRounds : entry.opponentCompletedRounds;
    return {
      ...base,
      score: finished && rounds !== null ? String(rounds) : '—',
      caption: entry.workoutType === 'emom' ? 'minutes' : 'rounds',
    };
  }

  const reps = mine ? entry.completedReps : entry.opponentCompletedReps;
  return {
    ...base,
    score: reps !== null && (finished || reps > 0) ? String(reps) : '—',
    caption: `of ${entry.targetReps} reps`,
    detail: finished && raceSeconds !== null ? formatRaceTime(raceSeconds) : null,
  };
}

function HeadToHeadSection({
  entry,
  myUserId,
  theme,
}: {
  entry: ChallengeHistoryEntry;
  myUserId: string | undefined;
  theme: Theme;
}) {
  const iWon = Boolean(entry.winnerUserId && myUserId && entry.winnerUserId === myUserId);
  const theyWon = Boolean(entry.winnerUserId && myUserId && entry.winnerUserId !== myUserId);

  return (
    <Section title="HEAD TO HEAD" theme={theme}>
      <HeadToHead me={getPlayer(entry, 'mine', iWon)} opponent={getPlayer(entry, 'theirs', theyWon)} />
    </Section>
  );
}

function useWorkoutSessionDetail(sessionId: string | null | undefined) {
  const [detail, setDetail] = useState<WorkoutSessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let cancelled = false;

    getWorkoutSessionDetail(sessionId)
      .then((result) => {
        if (!cancelled) {
          setDetail(result);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(formatUserError(err, 'Could not load the workout breakdown'));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return { detail, error };
}

const BREAKDOWN_ACCENTS = ['primary', 'streak', 'accent', 'xp'] as const;

function BreakdownSection({
  detail,
  error,
  theme,
}: {
  detail: WorkoutSessionDetail | null;
  error: string | null;
  theme: Theme;
}) {
  const totalReps = detail ? detail.exerciseBreakdown.reduce((sum, item) => sum + item.totalReps, 0) : 0;
  const showPerRound = detail?.workoutType === 'amrap' || detail?.workoutType === 'emom';

  return (
    <Section title="EXERCISE BREAKDOWN" theme={theme}>
      {detail ? (
        detail.exerciseBreakdown.length > 0 ? (
          <>
            {detail.exerciseBreakdown.map((item, index) => {
              const accent = theme[BREAKDOWN_ACCENTS[index % BREAKDOWN_ACCENTS.length]];

              return (
                <View key={`${item.exerciseType}-${index}`} style={styles.breakdownItem}>
                  <View style={[styles.breakdownStripe, { backgroundColor: accent }]} />
                  <View style={styles.breakdownCopy}>
                    <Text style={[styles.breakdownLabel, { color: theme.text }]}>
                      {formatExerciseLabel(item.exerciseType)}
                    </Text>
                    {showPerRound && item.targetReps > 0 ? (
                      <Text style={[styles.breakdownMeta, { color: theme.textSecondary }]}>
                        {item.targetReps} per {detail.workoutType === 'emom' ? 'minute' : 'round'}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.breakdownValue, { color: theme.text }]}>
                    {item.totalReps}
                    <Text style={[styles.breakdownUnit, { color: theme.textSecondary }]}> reps</Text>
                  </Text>
                </View>
              );
            })}
            <View style={[styles.breakdownTotal, { borderTopColor: theme.border }]}>
              <Text style={[styles.breakdownLabel, { color: theme.textSecondary }]}>Total</Text>
              <Text style={[styles.breakdownValue, { color: theme.primary }]}>
                {totalReps}
                <Text style={[styles.breakdownUnit, { color: theme.textSecondary }]}> reps</Text>
              </Text>
            </View>
          </>
        ) : (
          <Text style={[styles.muted, { color: theme.textSecondary }]}>No exercise breakdown saved.</Text>
        )
      ) : error ? (
        <Text style={[styles.muted, { color: theme.danger }]}>{error}</Text>
      ) : (
        <ActivityIndicator color={theme.primary} />
      )}
    </Section>
  );
}

function LinkedRunBreakdown({ sessionId, theme }: { sessionId: string; theme: Theme }) {
  const { detail, error } = useWorkoutSessionDetail(sessionId);
  return <BreakdownSection detail={detail} error={error} theme={theme} />;
}

function ChallengeDetail({ entry, theme }: { entry: ChallengeHistoryEntry; theme: Theme }) {
  const { session } = useAuth();
  const myUserId = session?.user.id;
  const outcome = getChallengeOutcome(entry, myUserId);
  const rewards = getHistoryEarnedRewards(entry);
  const sessionXp = entry.workoutSessionXp ?? 0;
  const isDaily = entry.kind === 'daily';
  const isWorkout = entry.friendChallengeKind === 'workout';
  const title =
    isDaily && entry.exerciseType ? getDailyMissionQuestMeta(entry.exerciseType).questTitle : getHistoryTitle(entry);

  const chips: string[] = [];
  if (entry.workoutType) {
    chips.push(getCustomWorkoutTypeLabel(entry.workoutType));
  }
  if (entry.exerciseType && !isWorkout) {
    chips.push(formatExerciseLabel(entry.exerciseType));
  }
  if (!isWorkout && entry.targetReps > 0) {
    chips.push(`${entry.targetReps} reps`);
  }

  return (
    <>
      <Hero
        eyebrow={isDaily ? 'Daily quest' : getHistoryKindLabel(entry)}
        title={title}
        date={formatDetailDate(entry.resultAt)}
        outcome={outcome}
        theme={theme}
      />
      <InfoChips items={chips} theme={theme} />

      {isDaily ? (
        <StatTiles
          tiles={[
            { label: 'Reps done', value: String(entry.completedReps) },
            { label: 'Target', value: String(entry.targetReps) },
          ]}
          theme={theme}
        />
      ) : entry.opponentUsername ? (
        <HeadToHeadSection entry={entry} myUserId={myUserId} theme={theme} />
      ) : null}

      {entry.workoutSessionId ? <LinkedRunBreakdown sessionId={entry.workoutSessionId} theme={theme} /> : null}

      <RewardsSection
        xp={rewards.xp}
        coins={rewards.coins}
        note={sessionXp > 0 ? `Includes +${sessionXp} XP for the workout run itself.` : null}
        emptyCopy={entry.status === 'completed' ? 'No rewards for this one.' : 'No rewards - it was not completed.'}
        theme={theme}
      />
    </>
  );
}

function SoloWorkoutDetail({ entry, theme }: { entry: SoloWorkoutHistoryEntry; theme: Theme }) {
  const { detail, error } = useWorkoutSessionDetail(entry.entryId);
  const xp = detail?.xpEarned ?? entry.xpEarned ?? 0;
  const coins = detail?.coinsEarned ?? entry.coinsEarned ?? 0;
  const durationSeconds = detail?.elapsedSeconds ?? entry.elapsedSeconds;
  const isForTime = entry.workoutType === 'for_time';

  const tiles: Array<{ label: string; value: string }> = [];
  if (!isForTime) {
    tiles.push({
      label: entry.workoutType === 'emom' ? 'Minutes' : 'Rounds',
      value: String(entry.completedRounds),
    });
  }
  tiles.push({ label: 'Total reps', value: String(entry.totalReps) });
  if (durationSeconds !== null) {
    tiles.push({ label: isForTime ? 'Finish time' : 'Duration', value: formatRaceTime(durationSeconds) });
  }

  const chips = [getCustomWorkoutTypeLabel(entry.workoutType)];
  if (!isForTime && entry.timeLimitSeconds > 0) {
    chips.push(`${formatWorkoutTimeLimit(entry.timeLimitSeconds)} cap`);
  }

  return (
    <>
      <Hero
        eyebrow="Solo workout"
        title={entry.workoutTitle}
        date={formatDetailDate(entry.resultAt)}
        outcome={{ label: formatWorkoutSessionScore(entry), tone: 'success', icon: 'dumbbell' }}
        theme={theme}
      />
      <InfoChips items={chips} theme={theme} />
      <StatTiles tiles={tiles} theme={theme} />
      <BreakdownSection detail={detail} error={error} theme={theme} />
      <RewardsSection
        xp={xp}
        coins={coins}
        note={coins > 0 ? 'Coins are the first workout of the day bonus.' : null}
        emptyCopy="No rewards for this run."
        theme={theme}
      />
    </>
  );
}

export default function HistoryEntryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { entryId } = useLocalSearchParams<{ entryId?: string }>();
  const [entry] = useState<ActivityHistoryEntry | null>(() => getSelectedHistoryEntry(entryId));

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {entry ? (
          isSoloWorkoutHistoryEntry(entry) ? (
            <SoloWorkoutDetail entry={entry} theme={theme} />
          ) : (
            <ChallengeDetail entry={entry} theme={theme} />
          )
        ) : (
          <View style={styles.missing}>
            <Text style={[styles.muted, { color: theme.textSecondary }]}>
              This activity is no longer open. Go back to History and tap it again.
            </Text>
            <PrimaryButton
              label="Back to History"
              variant="secondary"
              onPress={() => leaveScreen(router, '/profile/history')}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: Spacing.six,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingTop: Spacing.two,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
  },
  date: {
    fontSize: 13,
    fontWeight: '600',
  },
  outcomePill: {
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 999,
  },
  outcomeText: {
    fontSize: 15,
    fontWeight: '800',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  infoChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
  },
  infoChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  section: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  tileGrid: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  tile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    alignItems: 'center',
    gap: 2,
  },
  tileValue: {
    fontSize: 24,
    fontWeight: '900',
  },
  tileLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  /** Colour tab beside each exercise - tells rows apart without implying progress. */
  breakdownStripe: {
    width: 4,
    alignSelf: 'stretch',
    minHeight: 24,
    borderRadius: 2,
  },
  breakdownCopy: {
    flex: 1,
    gap: 1,
  },
  breakdownLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  breakdownMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
  breakdownValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  breakdownUnit: {
    fontSize: 12,
    fontWeight: '600',
  },
  breakdownTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
  },
  note: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  muted: {
    fontSize: 14,
    lineHeight: 20,
  },
  missing: {
    gap: Spacing.three,
    paddingVertical: Spacing.five,
  },
});
