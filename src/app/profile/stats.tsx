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
import { GoalHistoryCard } from '@/components/stats/GoalHistoryCard';
import { AppIcon } from '@/components/ui/AppIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { StatCard } from '@/components/ui/StatCard';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useUserStats } from '@/features/stats/useUserStats';
import { useTheme } from '@/hooks/use-theme';
import { leaveScreen } from '@/lib/navigation';

function formatCount(value: number): string {
  return value.toLocaleString();
}

function formatDistance(value: number, unit: string): string {
  if (value <= 0) {
    return `0 ${unit}`;
  }

  return `${value.toLocaleString(undefined, {
    maximumFractionDigits: 1,
  })} ${unit}`;
}

export default function StatsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { movementStats, goalHistory, isLoading, error, refresh } = useUserStats();

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
    movementStats.totalHalfBurpees > 0;

  const hasOtherStats =
    movementStats.totalSteps > 0 ||
    movementStats.totalRunKm > 0 ||
    movementStats.totalRunMi > 0;

  if (isLoading && goalHistory.length === 0 && !hasRepStats && !hasOtherStats) {
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
            <RefreshControl refreshing={isLoading} onRefresh={() => void refresh()} tintColor={theme.primary} />
          }>
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}>
            <Text style={[styles.summaryTitle, { color: theme.text }]}>Lifetime movement</Text>
            <Text style={[styles.summaryCopy, { color: theme.textSecondary }]}>
              Totals from daily missions, friend races, and manually logged goals.
            </Text>
          </View>

          {error ? (
            <View style={styles.errorBlock}>
              <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
              <PrimaryButton label="Try Again" variant="secondary" onPress={() => void refresh()} />
            </View>
          ) : null}

          <HomeSection title="Rep totals" subtitle="All tracked rep exercises">
            <View style={styles.statsGrid}>
              <StatCard label="Push-ups" value={formatCount(movementStats.totalPushUps)} accentColor={theme.primary} />
              <StatCard label="Squats" value={formatCount(movementStats.totalSquats)} accentColor={theme.primary} />
              <StatCard label="Pull-ups" value={formatCount(movementStats.totalPullUps)} accentColor={theme.primary} />
              <StatCard label="Burpees" value={formatCount(movementStats.totalBurpees)} accentColor={theme.primary} />
              <StatCard label="Half Burpees" value={formatCount(movementStats.totalHalfBurpees)} accentColor={theme.primary} />
              {movementStats.totalDips > 0 ? (
                <StatCard label="Dips" value={formatCount(movementStats.totalDips)} accentColor={theme.primary} />
              ) : null}
            </View>
          </HomeSection>

          <HomeSection title="Other activities" subtitle="From personal goals">
            <View style={styles.statsGrid}>
              <StatCard label="Steps" value={formatCount(movementStats.totalSteps)} accentColor={theme.streak} />
              <StatCard
                label="Running"
                value={formatDistance(movementStats.totalRunKm, 'km')}
                accentColor={theme.streak}
              />
            </View>
          </HomeSection>

          <HomeSection title="Activity summary" subtitle="Challenges and completed goals">
            <View style={styles.statsGrid}>
              <StatCard
                label="Daily missions"
                value={formatCount(movementStats.dailyMissionsCompleted)}
              />
              <StatCard
                label="Friend races"
                value={formatCount(movementStats.friendRacesCompleted)}
              />
              <StatCard
                label="Goals completed"
                value={formatCount(movementStats.goalsCompleted)}
                accentColor={theme.success}
              />
              <StatCard
                label="Daily goals hit"
                value={formatCount(movementStats.goalsCompletedDaily)}
              />
              <StatCard
                label="Weekly goals hit"
                value={formatCount(movementStats.goalsCompletedWeekly)}
              />
            </View>
          </HomeSection>

          <HomeSection title="Completed goals" subtitle="Your personal target history">
            {goalHistory.length === 0 ? (
              <Text style={[styles.empty, { color: theme.textSecondary }]}>
                No completed goals yet. Finish a daily or weekly target to see it here.
              </Text>
            ) : (
              <View style={styles.historyList}>
                {goalHistory.map((entry) => (
                  <GoalHistoryCard key={entry.id} entry={entry} />
                ))}
              </View>
            )}
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
    gap: Spacing.five,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: Spacing.six,
  },
  headerBack: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  summaryCard: {
    padding: Spacing.four,
    borderRadius: 12,
    borderWidth: 1,
    gap: Spacing.two,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  summaryCopy: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  historyList: {
    gap: Spacing.three,
  },
  empty: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
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
