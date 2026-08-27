import { Stack, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActivityHistoryCard } from '@/components/history/ActivityHistoryCard';
import { ActivityHistoryFilterBar } from '@/components/history/ActivityHistoryFilterBar';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useActivityHistory } from '@/features/challenges/useActivityHistory';
import { useTheme } from '@/hooks/use-theme';
import { getActivityHistoryEmptyMessage } from '@/types/activityHistory';

export default function ChallengeHistoryScreen() {
  const theme = useTheme();
  const {
    filter,
    changeFilter,
    entries,
    hasMore,
    isLoading,
    isLoadingMore,
    error,
    refresh,
    loadMore,
  } = useActivityHistory();

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return (
    <>
      <Stack.Screen options={{ title: 'History', headerShown: true }} />
      <SafeAreaView
        style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}
        edges={['bottom']}>
        <View style={styles.page}>
          <View style={styles.header}>
            <Text style={StyleSheet.flatten([styles.subtitle, { color: theme.textSecondary }])}>
              Quests, friend races, and workout runs — filter and browse your past activity.
            </Text>
            <ActivityHistoryFilterBar filter={filter} onFilterChange={changeFilter} />
          </View>

          <ScrollView
            style={styles.listScroll}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={isLoading && entries.length > 0}
                onRefresh={() => void refresh()}
                tintColor={theme.primary}
              />
            }>
            {isLoading && entries.length === 0 ? (
              <View style={styles.loading}>
                <ActivityIndicator size="large" color={theme.primary} />
              </View>
            ) : null}

            {error ? (
              <View style={styles.errorBlock}>
                <Text style={StyleSheet.flatten([styles.error, { color: theme.danger }])}>{error}</Text>
                <PrimaryButton label="Try Again" variant="secondary" onPress={() => void refresh()} />
              </View>
            ) : null}

            {!isLoading && entries.length === 0 && !error ? (
              <Text style={StyleSheet.flatten([styles.empty, { color: theme.textSecondary }])}>
                {getActivityHistoryEmptyMessage(filter)}
              </Text>
            ) : null}

            {entries.map((entry) => (
              <ActivityHistoryCard key={`${entry.category}-${entry.entryId}`} entry={entry} />
            ))}

            {hasMore && entries.length > 0 ? (
              <PrimaryButton
                label={isLoadingMore ? 'Loading…' : 'Load more'}
                variant="secondary"
                loading={isLoadingMore}
                onPress={() => void loadMore()}
              />
            ) : null}
          </ScrollView>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  page: {
    flex: 1,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  listScroll: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
    flexGrow: 1,
  },
  loading: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  empty: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
  errorBlock: {
    gap: Spacing.two,
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
