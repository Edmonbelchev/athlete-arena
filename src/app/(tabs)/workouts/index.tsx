import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HomeLinkBlock } from '@/components/home/HomeLinkBlock';
import { TabScreenHeader } from '@/components/sidebar/TabScreenHeader';
import { AppIcon } from '@/components/ui/AppIcon';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { usePremium } from '@/features/subscription/usePremium';
import { useTheme } from '@/hooks/use-theme';
import { getMyCustomWorkoutTemplates } from '@/services/customWorkoutService';
import { getWorkoutCatalog } from '@/services/workoutCatalogService';

export default function WorkoutsHubScreen() {
  const theme = useTheme();
  const { isPremium } = usePremium();
  const [officialCount, setOfficialCount] = useState(0);
  const [libraryCount, setLibraryCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async (options?: { silent?: boolean }) => {
    if (options?.silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const [catalog, templates] = await Promise.all([
        getWorkoutCatalog(),
        getMyCustomWorkoutTemplates(),
      ]);
      setOfficialCount(catalog.length);
      setLibraryCount(templates.length);
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
        <TabScreenHeader
          title="Workouts"
          subtitle="Official benchmarks and your personal library"
          rightSlot={
            <View style={[styles.headerBadge, { backgroundColor: `${theme.primary}18` }]}>
              <AppIcon name="dumbbell" size={22} color={theme.primary} weight="bold" />
            </View>
          }
        />

        {isLoading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <View style={styles.links}>
            <HomeLinkBlock
              title="Arena workouts"
              description={
                officialCount > 0
                  ? `${officialCount} Arena workout${officialCount === 1 ? '' : 's'} with leaderboards`
                  : 'Arena workouts with leaderboards for everyone'
              }
              icon="crown"
              accentColor={theme.streak}
              badge={officialCount > 0 ? officialCount : undefined}
              onPress={() => router.push('/(tabs)/workouts/official' as Href)}
            />

            <HomeLinkBlock
              title="My workouts"
              description={
                isPremium
                  ? libraryCount > 0
                    ? `${libraryCount} saved workout${libraryCount === 1 ? '' : 's'} · create and share`
                    : 'Build, save, and share custom workouts'
                  : 'Create and share custom workouts'
              }
              icon={isPremium ? 'bolt' : 'crown'}
              accentColor={theme.primary}
              badge={libraryCount > 0 ? libraryCount : undefined}
              onPress={() => router.push('/(tabs)/workouts/library' as Href)}
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
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: Spacing.six,
  },
  headerBadge: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  links: {
    gap: Spacing.three,
  },
  loadingBlock: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
});
