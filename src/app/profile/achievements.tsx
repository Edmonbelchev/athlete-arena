import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
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

import { AchievementCard } from '@/components/achievements/AchievementCard';
import { AppIcon } from '@/components/ui/AppIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useAchievements } from '@/features/achievements/useAchievements';
import { leaveScreen } from '@/lib/navigation';
import type { AchievementFilter } from '@/types/achievements';
import { useTheme } from '@/hooks/use-theme';

const FILTERS: { id: AchievementFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unlocked', label: 'Unlocked' },
  { id: 'locked', label: 'Locked' },
];

export default function AchievementsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [filter, setFilter] = useState<AchievementFilter>('all');
  const { achievements, unlockedCount, totalCount, isLoading, isSyncing, error, refresh } =
    useAchievements();

  const headerOptions = {
    title: 'Achievements',
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

  const filteredAchievements = useMemo(() => {
    switch (filter) {
      case 'unlocked':
        return achievements.filter((achievement) => achievement.unlocked);
      case 'locked':
        return achievements.filter((achievement) => !achievement.unlocked);
      default:
        return achievements;
    }
  }, [achievements, filter]);

  if (isLoading && achievements.length === 0) {
    return (
      <>
        <Stack.Screen options={headerOptions} />
        <View style={StyleSheet.flatten([styles.loading, { backgroundColor: theme.background }])}>
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
        style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={isSyncing}
              onRefresh={() => void refresh()}
              tintColor={theme.primary}
            />
          }>
          <View
            style={StyleSheet.flatten([
              styles.summaryCard,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ])}>
            <Text style={StyleSheet.flatten([styles.summaryTitle, { color: theme.text }])}>
              {unlockedCount} / {totalCount} unlocked
            </Text>
            <Text style={StyleSheet.flatten([styles.summaryCopy, { color: theme.textSecondary }])}>
              Complete workouts, build streaks, win races, and grow your squad to earn badges and bonus XP.
            </Text>
          </View>

          <View style={styles.filters}>
            {FILTERS.map((item) => {
              const active = filter === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setFilter(item.id)}
                  style={StyleSheet.flatten([
                    styles.filterChip,
                    {
                      backgroundColor: active ? theme.primary : theme.backgroundElement,
                      borderColor: active ? theme.primary : theme.border,
                    },
                  ])}>
                  <Text
                    style={StyleSheet.flatten([
                      styles.filterLabel,
                      { color: active ? '#FFFFFF' : theme.textSecondary },
                    ])}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {error ? (
            <View style={styles.errorBlock}>
              <Text style={StyleSheet.flatten([styles.error, { color: theme.danger }])}>{error}</Text>
              <PrimaryButton label="Try Again" variant="secondary" onPress={() => void refresh()} />
            </View>
          ) : null}

          <View style={styles.list}>
            {filteredAchievements.map((achievement) => (
              <AchievementCard key={achievement.id} achievement={achievement} />
            ))}
          </View>

          {!error && filteredAchievements.length === 0 ? (
            <Text style={StyleSheet.flatten([styles.empty, { color: theme.textSecondary }])}>
              {filter === 'unlocked'
                ? 'No achievements unlocked yet. Complete a daily challenge to start.'
                : filter === 'locked'
                  ? 'You have unlocked everything available. Nice work!'
                  : 'No achievements are configured yet.'}
            </Text>
          ) : null}
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
  summaryCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  summaryTitle: {
    fontSize: 22,
    fontWeight: '900',
  },
  summaryCopy: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  filters: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  filterChip: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  list: {
    gap: Spacing.three,
  },
  errorBlock: {
    gap: Spacing.two,
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  empty: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: Spacing.two,
  },
  headerBack: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
});
