import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
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

import { TabScreenHeader } from '@/components/sidebar/TabScreenHeader';
import { AppIcon } from '@/components/ui/AppIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { CatalogWorkoutCard } from '@/components/workouts/CatalogWorkoutCard';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatUserError } from '@/lib/errors';
import { leaveScreen } from '@/lib/navigation';
import { getWorkoutCatalog } from '@/services/workoutCatalogService';
import type { CatalogWorkoutSummary } from '@/types/catalogWorkouts';

export default function OfficialWorkoutsScreen() {
  const theme = useTheme();
  const [workouts, setWorkouts] = useState<CatalogWorkoutSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    if (options?.silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    setError(null);

    try {
      setWorkouts(await getWorkoutCatalog());
    } catch (err) {
      setError(formatUserError(err, 'Failed to load official workouts'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={() => void refresh({ silent: true })} tintColor={theme.primary} />
        }>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => leaveScreen(router, '/(tabs)/workouts')}
          style={styles.backRow}>
          <AppIcon name="chevronBack" size={20} color={theme.textSecondary} />
          <Text style={[styles.backLabel, { color: theme.textSecondary }]}>Workouts</Text>
        </Pressable>

        <TabScreenHeader
          title="Arena workouts"
          subtitle="Arena benchmarks with leaderboards for everyone"
          rightSlot={
            <View style={[styles.headerBadge, { backgroundColor: `${theme.streak}18` }]}>
              <AppIcon name="crown" size={22} color={theme.streak} weight="bold" />
            </View>
          }
        />

        {error ? (
          <View style={[styles.messageCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Text style={[styles.messageTitle, { color: theme.text }]}>{error}</Text>
            <PrimaryButton label="Try again" onPress={() => void refresh()} />
          </View>
        ) : null}

        {isLoading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : workouts.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <AppIcon name="crown" size={28} color={theme.streak} weight="semibold" />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No official workouts yet</Text>
            <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
              Check back soon for new Arena benchmarks.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {workouts.map((workout) => (
              <CatalogWorkoutCard
                key={workout.catalogWorkoutId}
                workout={workout}
                onPress={() => router.push(`/workouts/catalog/${workout.catalogWorkoutId}` as Href)}
              />
            ))}
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
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: Spacing.six,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  backLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  headerBadge: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    gap: Spacing.three,
  },
  loadingBlock: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  messageCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  messageTitle: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    textAlign: 'center',
  },
});
