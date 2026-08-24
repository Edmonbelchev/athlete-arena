import { Stack, useFocusEffect } from 'expo-router';
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

import { QuestLogCard } from '@/components/challenges/QuestLogCard';
import { AppIcon } from '@/components/ui/AppIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useQuestLog, type QuestLogTab } from '@/features/challenges/useQuestLog';
import { useTheme } from '@/hooks/use-theme';

const QUEST_LOG_TABS: Array<{ id: QuestLogTab; label: string; icon: 'checkmark' | 'target' }> = [
  { id: 'completed', label: 'Completed', icon: 'checkmark' },
  { id: 'incomplete', label: 'Not completed', icon: 'target' },
];

export default function QuestLogScreen() {
  const theme = useTheme();
  const { tab, changeTab, entries, hasMore, isLoading, isLoadingMore, error, refresh, loadMore } =
    useQuestLog();

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const emptyMessage =
    tab === 'completed'
      ? 'No completed quests yet. Clear a daily quest to see it here.'
      : 'No missed quests yet. Past days you did not finish will show up here.';

  return (
    <>
      <Stack.Screen options={{ title: 'Quest Log', headerShown: true }} />
      <SafeAreaView
        style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}
        edges={['bottom']}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={isLoading && entries.length > 0} onRefresh={() => void refresh()} tintColor={theme.primary} />
          }>
          <Text style={StyleSheet.flatten([styles.subtitle, { color: theme.textSecondary }])}>
            Browse cleared quests and past days you did not finish.
          </Text>

          <View style={styles.segmentRow}>
            {QUEST_LOG_TABS.map((item) => {
              const isActive = item.id === tab;

              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  onPress={() => changeTab(item.id)}
                  style={[
                    styles.segmentButton,
                    {
                      backgroundColor: isActive ? theme.primary : theme.backgroundSelected,
                      borderColor: isActive ? theme.primary : 'transparent',
                    },
                  ]}>
                  <AppIcon
                    name={item.icon}
                    size={14}
                    color={isActive ? '#FFFFFF' : theme.textSecondary}
                    weight="semibold"
                  />
                  <Text style={[styles.segmentLabel, { color: isActive ? '#FFFFFF' : theme.text }]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

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
            <Text style={StyleSheet.flatten([styles.empty, { color: theme.textSecondary }])}>{emptyMessage}</Text>
          ) : null}

          {entries.map((entry) => (
            <QuestLogCard key={entry.entryId} entry={entry} />
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
      </SafeAreaView>
    </>
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
    flexGrow: 1,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  segmentCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: '700',
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
