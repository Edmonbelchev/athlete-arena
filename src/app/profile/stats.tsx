import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HomeSection } from '@/components/home/HomeSection';
import { AppIcon } from '@/components/ui/AppIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useUserStats } from '@/features/stats/useUserStats';
import { useTheme } from '@/hooks/use-theme';
import { leaveScreen } from '@/lib/navigation';

/** Gold / silver / bronze-ish accents for the top three exercises. */
const RANK_COLORS = ['xp', 'primary', 'streak'] as const;

function formatCount(value: number): string {
  return value.toLocaleString();
}

export default function StatsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { movementStats, isLoading, error, refresh } = useUserStats();

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const headerOptions = {
    title: 'Stats',
    headerShown: true,
    headerBackVisible: false,
    headerLeft: () => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => leaveScreen(router, '/(tabs)/profile')}
        style={styles.headerBack}>
        <AppIcon name="chevronBack" size={22} color={theme.text} />
      </Pressable>
    ),
  } as const;

  const hasRepStats =
    movementStats.totalPushUps > 0 ||
    movementStats.totalSquats > 0 ||
    movementStats.totalPullUps > 0 ||
    movementStats.totalDips > 0 ||
    movementStats.totalBurpees > 0 ||
    movementStats.totalHalfBurpees > 0 ||
    movementStats.totalJumpingJacks > 0 ||
    movementStats.totalJumpingSquats > 0 ||
    movementStats.totalLunges > 0;

  const exercises = [
    { label: 'Push-ups', value: movementStats.totalPushUps },
    { label: 'Squats', value: movementStats.totalSquats },
    { label: 'Pull-ups', value: movementStats.totalPullUps },
    { label: 'Burpees', value: movementStats.totalBurpees },
    { label: 'Half Burpees', value: movementStats.totalHalfBurpees },
    { label: 'Jumping Jacks', value: movementStats.totalJumpingJacks },
    { label: 'Jumping Squats', value: movementStats.totalJumpingSquats },
    { label: 'Lunges', value: movementStats.totalLunges },
    { label: 'Dips', value: movementStats.totalDips, hideWhenEmpty: true },
  ];
  const doneExercises = exercises.filter((exercise) => exercise.value > 0).sort((a, b) => b.value - a.value);
  const untriedExercises = exercises.filter((exercise) => exercise.value === 0 && !exercise.hideWhenEmpty);
  const totalReps = doneExercises.reduce((sum, exercise) => sum + exercise.value, 0);
  const favourite = doneExercises[0] ?? null;

  const hasActivityStats =
    movementStats.dailyMissionsCompleted > 0 || movementStats.friendRacesCompleted > 0;

  if (isLoading && !hasRepStats && !hasActivityStats) {
    return (
      <>
        <Stack.Screen options={headerOptions} />
        <View style={[styles.loading, { backgroundColor: theme.background }]}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={headerOptions} />
      <SafeAreaView
        edges={['bottom']}
        style={[styles.safeArea, { backgroundColor: theme.background }]}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={() => void refresh({ bypassCache: true })}
              tintColor={theme.primary}
            />
          }>
          <View style={[styles.hero, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <View style={[styles.heroIcon, { backgroundColor: `${theme.primary}1F` }]}>
              <AppIcon name="bolt" size={26} color={theme.primary} weight="bold" />
            </View>
            <Text style={[styles.heroValue, { color: theme.text }]}>{formatCount(totalReps)}</Text>
            <Text style={[styles.heroLabel, { color: theme.textSecondary }]}>LIFETIME REPS</Text>
            <Text style={[styles.heroCopy, { color: theme.textSecondary }]}>
              From daily missions, friend races, and workouts
            </Text>
            {favourite ? (
              <View style={[styles.favouritePill, { backgroundColor: `${theme.xp}1A` }]}>
                <AppIcon name="crown" size={14} color={theme.xp} weight="semibold" />
                <Text style={[styles.favouriteText, { color: theme.xp }]}>Favourite: {favourite.label}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.tileRow}>
            <View style={[styles.tile, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <AppIcon name="target" size={18} color={theme.streak} weight="semibold" />
              <Text style={[styles.tileValue, { color: theme.text }]}>
                {formatCount(movementStats.dailyMissionsCompleted)}
              </Text>
              <Text style={[styles.tileLabel, { color: theme.textSecondary }]} numberOfLines={1}>Missions</Text>
            </View>
            <View style={[styles.tile, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <AppIcon name="swords" size={18} color={theme.accent} weight="semibold" />
              <Text style={[styles.tileValue, { color: theme.text }]}>
                {formatCount(movementStats.friendRacesCompleted)}
              </Text>
              <Text style={[styles.tileLabel, { color: theme.textSecondary }]} numberOfLines={1}>Races</Text>
            </View>
            <View style={[styles.tile, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <AppIcon name="dumbbell" size={18} color={theme.xp} weight="semibold" />
              <Text style={[styles.tileValue, { color: theme.text }]}>
                {doneExercises.length}
              </Text>
              <Text style={[styles.tileLabel, { color: theme.textSecondary }]} numberOfLines={1}>Exercises</Text>
            </View>
          </View>

          {error ? (
            <View style={styles.errorBlock}>
              <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
              <PrimaryButton label="Try Again" variant="secondary" onPress={() => void refresh()} />
            </View>
          ) : null}

          <HomeSection title="By exercise" subtitle="Your most-trained moves first">
            {doneExercises.length > 0 ? (
              <View style={[styles.listCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                {doneExercises.map((exercise, index) => {
                  const rankColor = RANK_COLORS[index] ? theme[RANK_COLORS[index]] : theme.textSecondary;
                  const share = totalReps > 0 ? Math.round((exercise.value / totalReps) * 100) : 0;

                  return (
                    <View
                      key={exercise.label}
                      style={[styles.exerciseRow, index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                      <View style={[styles.rank, { backgroundColor: `${rankColor}1F` }]}>
                        <Text style={[styles.rankText, { color: rankColor }]}>{index + 1}</Text>
                      </View>
                      <View style={styles.exerciseCopy}>
                        <Text style={[styles.exerciseName, { color: theme.text }]}>{exercise.label}</Text>
                        <Text style={[styles.exerciseShare, { color: theme.textSecondary }]}>
                          {share > 0 ? `${share}% of your reps` : 'Less than 1% of your reps'}
                        </Text>
                      </View>
                      <Text style={[styles.exerciseValue, { color: theme.text }]}>{formatCount(exercise.value)}</Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={[styles.emptyCopy, { color: theme.textSecondary }]}>
                No reps yet - finish a mission, race, or workout to start your totals.
              </Text>
            )}

            {untriedExercises.length > 0 ? (
              <View style={styles.untried}>
                <Text style={[styles.untriedLabel, { color: theme.textSecondary }]}>NOT TRIED YET</Text>
                <View style={styles.chipRow}>
                  {untriedExercises.map((exercise) => (
                    <View
                      key={exercise.label}
                      style={[styles.chip, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                      <Text style={[styles.chipText, { color: theme.textSecondary }]}>{exercise.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </HomeSection>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: Spacing.six,
  },
  headerBack: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  hero: {
    alignItems: 'center',
    padding: Spacing.four,
    borderRadius: Radius.xl,
    borderWidth: 1,
    gap: 2,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  heroValue: {
    fontSize: 44,
    fontWeight: '900',
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  heroCopy: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: Spacing.one,
    textAlign: 'center',
  },
  tileRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: 4,
  },
  tileValue: {
    fontSize: 18,
    fontWeight: '900',
  },
  tileLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  favouritePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: 999,
  },
  favouriteText: {
    fontSize: 13,
    fontWeight: '800',
  },
  listCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  rank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 14,
    fontWeight: '900',
  },
  exerciseCopy: {
    flex: 1,
    gap: 2,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '800',
  },
  exerciseShare: {
    fontSize: 12,
    fontWeight: '600',
  },
  exerciseValue: {
    fontSize: 20,
    fontWeight: '900',
  },
  emptyCopy: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  untried: {
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  untriedLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  errorBlock: {
    gap: Spacing.two,
    alignItems: 'center',
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
