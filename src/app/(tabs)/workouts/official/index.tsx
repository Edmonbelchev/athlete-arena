import { router, useFocusEffect, type Href } from 'expo-router';
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

import { HomeLinkBlock } from '@/components/home/HomeLinkBlock';
import { TabScreenHeader } from '@/components/sidebar/TabScreenHeader';
import { AppIcon } from '@/components/ui/AppIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import {
  AVAILABLE_CUSTOM_WORKOUT_TYPES,
  getCustomWorkoutTypeDefinition,
} from '@/constants/customWorkouts';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import {
  getOfficialWorkoutCategoryIcon,
} from '@/features/workouts/officialWorkoutCategories';
import { useOfficialWorkoutCatalog } from '@/features/workouts/useOfficialWorkoutCatalog';
import { countWorkoutsByType } from '@/features/workouts/workoutBrowseList';
import { useTheme } from '@/hooks/use-theme';
import { leaveScreen } from '@/lib/navigation';

export default function OfficialWorkoutsHubScreen() {
  const theme = useTheme();
  const { workouts, isLoading, isRefreshing, error, refresh } = useOfficialWorkoutCatalog();

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
          subtitle="Pick a workout format, then browse Arena benchmarks"
          rightSlot={
            <View style={[styles.headerBadge, { backgroundColor: `${theme.streak}18` }]}>
              <AppIcon name="medal" size={22} color={theme.streak} weight="bold" />
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
        ) : (
          <View style={styles.categories}>
            {AVAILABLE_CUSTOM_WORKOUT_TYPES.map((category) => {
              const count = countWorkoutsByType(workouts, category.type);
              const icon = getOfficialWorkoutCategoryIcon(category.type);
              const accentColor =
                category.type === 'amrap'
                  ? theme.streak
                  : category.type === 'for_time'
                    ? theme.primary
                    : theme.text;

              return (
                <HomeLinkBlock
                  key={category.type}
                  title={getCustomWorkoutTypeDefinition(category.type).label}
                  description={category.description}
                  icon={icon}
                  accentColor={accentColor}
                  badge={count > 0 ? count : undefined}
                  onPress={() =>
                    router.push(`/(tabs)/workouts/official/${category.type}` as Href)
                  }
                />
              );
            })}
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
  categories: {
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
});
