import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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

import { WorkoutCircuitPreview } from '@/components/workouts/WorkoutCircuitPreview';
import { WorkoutHistoryPanel } from '@/components/workouts/WorkoutHistoryPanel';
import { WorkoutLeaderboardPanel } from '@/components/workouts/WorkoutLeaderboardPanel';
import { AppIcon } from '@/components/ui/AppIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import {
  formatWorkoutTimeLimit,
  getCustomWorkoutSessionPath,
  getCustomWorkoutTypeLabel,
} from '@/constants/customWorkouts';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { setPendingCustomWorkoutLaunch } from '@/features/workouts/customWorkoutLaunchStore';
import { cloneCustomWorkoutExercises } from '@/features/workouts/useAmrapWorkout';
import { useTheme } from '@/hooks/use-theme';
import { formatUserError } from '@/lib/errors';
import { leaveScreen } from '@/lib/navigation';
import {
  getCatalogWorkoutLeaderboard,
  getMyWorkoutSessions,
  getWorkoutCatalogDetail,
} from '@/services/workoutCatalogService';
import type { CatalogWorkoutDetail } from '@/types/catalogWorkouts';
import type { WorkoutLeaderboardEntry, WorkoutLeaderboardPeriod } from '@/types/catalogWorkouts';
import {
  formatWorkoutAmrapScore,
  formatWorkoutForTimeScore,
} from '@/types/catalogWorkouts';

export default function CatalogWorkoutScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [workout, setWorkout] = useState<CatalogWorkoutDetail | null>(null);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getMyWorkoutSessions>>>([]);
  const [leaderboard, setLeaderboard] = useState<WorkoutLeaderboardEntry[]>([]);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<WorkoutLeaderboardPeriod>('weekly');
  const [isLoading, setIsLoading] = useState(true);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);

  const loadLeaderboard = useCallback(
    async (catalogWorkoutId: string, period: WorkoutLeaderboardPeriod) => {
      setIsLeaderboardLoading(true);
      setLeaderboardError(null);

      try {
        const entries = await getCatalogWorkoutLeaderboard(catalogWorkoutId, period);
        setLeaderboard(entries);
      } catch (err) {
        setLeaderboard([]);
        setLeaderboardError(formatUserError(err, 'Failed to load leaderboard'));
      } finally {
        setIsLeaderboardLoading(false);
      }
    },
    [],
  );

  const loadWorkout = useCallback(async () => {
    if (!id) {
      setError('Workout not found');
      setIsLoading(false);
      return;
    }

    setError(null);

    try {
      const [detail, sessions] = await Promise.all([
        getWorkoutCatalogDetail(id),
        getMyWorkoutSessions({ catalogWorkoutId: id }),
      ]);
      setWorkout(detail);
      setHistory(sessions);
    } catch (err) {
      setWorkout(null);
      setError(formatUserError(err, 'Failed to load workout'));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setIsLoading(true);
    void loadWorkout();
  }, [loadWorkout]);

  useEffect(() => {
    if (!id || !workout?.leaderboardMetric) {
      return;
    }

    void loadLeaderboard(id, leaderboardPeriod);
  }, [id, leaderboardPeriod, loadLeaderboard, workout?.leaderboardMetric]);

  function handleStartWorkout() {
    if (!workout || (workout.workoutType !== 'amrap' && workout.workoutType !== 'for_time')) {
      return;
    }

    setPendingCustomWorkoutLaunch({
      workoutType: workout.workoutType,
      title: workout.title,
      templateId: null,
      catalogWorkoutId: workout.catalogWorkoutId,
      timeLimitSeconds: workout.timeLimitSeconds,
      exercises: cloneCustomWorkoutExercises(workout.exercises),
    });
    router.push(getCustomWorkoutSessionPath(workout.workoutType));
  }

  const bestScoreLabel =
    workout?.leaderboardMetric === 'fastest_time' && workout.myBestElapsedSeconds !== null
      ? formatWorkoutForTimeScore(workout.myBestElapsedSeconds)
      : workout?.leaderboardMetric === 'most_rounds' &&
          workout.myBestRounds !== null &&
          workout.myBestReps !== null
        ? formatWorkoutAmrapScore(workout.myBestRounds, workout.myBestReps)
        : null;

  return (
    <>
      <Stack.Screen
        options={{
          title: workout?.title ?? 'Arena Workout',
          headerShown: true,
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => leaveScreen(router, '/(tabs)/workouts/official')}
              style={styles.headerBack}>
              <AppIcon name="chevronBack" size={22} color={theme.text} />
            </Pressable>
          ),
        }}
      />
      <SafeAreaView
        style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}
        edges={['bottom']}>
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : error || !workout ? (
          <View style={styles.centered}>
            <Text style={[styles.error, { color: theme.danger }]}>{error ?? 'Workout not found'}</Text>
            <PrimaryButton label="Try Again" variant="secondary" onPress={() => void loadWorkout()} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={
              <RefreshControl refreshing={isLoading} onRefresh={() => void loadWorkout()} tintColor={theme.primary} />
            }>
            <View style={[styles.hero, { backgroundColor: `${theme.primary}12`, borderColor: theme.primary }]}>
              <Text style={[styles.kicker, { color: theme.primary }]}>Arena workout</Text>
              <Text style={[styles.title, { color: theme.text }]}>{workout.title}</Text>
              {workout.description ? (
                <Text style={[styles.description, { color: theme.textSecondary }]}>{workout.description}</Text>
              ) : null}
              <Text style={[styles.meta, { color: theme.textSecondary }]}>
                {getCustomWorkoutTypeLabel(workout.workoutType)}
                {workout.workoutType === 'amrap'
                  ? ` · ${formatWorkoutTimeLimit(workout.timeLimitSeconds)}`
                  : ' · finish the circuit'}
              </Text>
              {bestScoreLabel ? (
                <Text style={[styles.bestScore, { color: theme.text }]}>
                  Your best: {bestScoreLabel}
                </Text>
              ) : null}
            </View>

            <WorkoutCircuitPreview workoutType={workout.workoutType} exercises={workout.exercises} />

            {workout.workoutType === 'amrap' || workout.workoutType === 'for_time' ? (
              <PrimaryButton label="Start workout" onPress={handleStartWorkout} />
            ) : (
              <View style={[styles.comingSoon, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
                <Text style={[styles.comingSoonText, { color: theme.textSecondary }]}>
                  This workout type is coming soon in the app.
                </Text>
              </View>
            )}

            <WorkoutHistoryPanel sessions={history} />

            {workout.leaderboardMetric ? (
              <WorkoutLeaderboardPanel
                entries={leaderboard}
                period={leaderboardPeriod}
                metric={workout.leaderboardMetric}
                onPeriodChange={setLeaderboardPeriod}
                isLoading={isLeaderboardLoading}
                error={leaderboardError}
              />
            ) : null}
          </ScrollView>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerBack: {
    padding: Spacing.two,
    marginLeft: -Spacing.one,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: Spacing.six,
  },
  hero: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  meta: {
    fontSize: 13,
    fontWeight: '600',
  },
  bestScore: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: Spacing.one,
  },
  comingSoon: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
  },
  comingSoonText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
