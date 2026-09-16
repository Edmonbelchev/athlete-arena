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
import { StatCard } from '@/components/ui/StatCard';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useUserStats } from '@/features/stats/useUserStats';
import { useTheme } from '@/hooks/use-theme';
import { leaveScreen } from '@/lib/navigation';

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
    movementStats.totalJumpingSquats > 0;

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
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}>
            <Text style={[styles.summaryTitle, { color: theme.text }]}>Lifetime movement</Text>
            <Text style={[styles.summaryCopy, { color: theme.textSecondary }]}>
              Totals from daily missions, friend races, and custom workouts.
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
              <StatCard label="Jumping Jacks" value={formatCount(movementStats.totalJumpingJacks)} accentColor={theme.primary} />
              <StatCard label="Jumping Squats" value={formatCount(movementStats.totalJumpingSquats)} accentColor={theme.primary} />
              {movementStats.totalDips > 0 ? (
                <StatCard label="Dips" value={formatCount(movementStats.totalDips)} accentColor={theme.primary} />
              ) : null}
            </View>
          </HomeSection>

          <HomeSection title="Activity summary" subtitle="Completed challenges">
            <View style={styles.statsGrid}>
              <StatCard
                label="Daily missions"
                value={formatCount(movementStats.dailyMissionsCompleted)}
              />
              <StatCard
                label="Friend races"
                value={formatCount(movementStats.friendRacesCompleted)}
              />
            </View>
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
