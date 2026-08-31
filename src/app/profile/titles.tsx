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

import { TitleCard } from '@/components/titles/TitleCard';
import { AppIcon } from '@/components/ui/AppIcon';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTitles } from '@/features/titles/useTitles';
import { leaveScreen } from '@/lib/navigation';
import { useTheme } from '@/hooks/use-theme';

type TitleFilter = 'all' | 'unlocked' | 'locked';

const FILTERS: { id: TitleFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unlocked', label: 'Earned' },
  { id: 'locked', label: 'Locked' },
];

export default function TitlesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [filter, setFilter] = useState<TitleFilter>('all');
  const { titles, unlockedCount, totalCount, isLoading, isUpdating, error, refresh, equipTitle } =
    useTitles();

  const headerOptions = {
    title: 'Titles',
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

  const filteredTitles = useMemo(() => {
    switch (filter) {
      case 'unlocked':
        return titles.filter((title) => title.unlocked);
      case 'locked':
        return titles.filter((title) => !title.unlocked);
      default:
        return titles;
    }
  }, [filter, titles]);

  if (isLoading && titles.length === 0) {
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
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => void refresh()} />}>
          <View style={styles.summaryCard}>
            <Text style={StyleSheet.flatten([styles.summaryTitle, { color: theme.text }])}>
              Earned titles
            </Text>
            <Text style={StyleSheet.flatten([styles.summaryValue, { color: theme.primary }])}>
              {unlockedCount}/{totalCount}
            </Text>
            <Text style={StyleSheet.flatten([styles.summaryCopy, { color: theme.textSecondary }])}>
              Equip an earned title to show it next to your name across the arena.
            </Text>
          </View>

          <View style={styles.filters}>
            {FILTERS.map((item) => {
              const active = item.id === filter;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
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
                      { color: active ? '#FFFFFF' : theme.text },
                    ])}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {error ? (
            <Text style={StyleSheet.flatten([styles.error, { color: theme.danger }])}>{error}</Text>
          ) : null}

          <View style={styles.list}>
            {filteredTitles.map((title) => (
              <TitleCard
                key={title.id}
                title={title}
                isUpdating={isUpdating}
                onEquip={() => void equipTitle(title.id)}
                onUnequip={() => void equipTitle(null)}
              />
            ))}
          </View>

          {filteredTitles.length === 0 ? (
            <Text style={StyleSheet.flatten([styles.empty, { color: theme.textSecondary }])}>
              {filter === 'unlocked'
                ? 'No titles earned yet. Complete workouts and win challenges to unlock your first title.'
                : filter === 'locked'
                  ? 'You have unlocked every title currently available.'
                  : 'No titles are configured yet.'}
            </Text>
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
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  headerBack: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  summaryCard: {
    gap: Spacing.one,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  summaryCopy: {
    fontSize: 14,
    lineHeight: 20,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  list: {
    gap: Spacing.three,
  },
  empty: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  error: {
    fontSize: 14,
    lineHeight: 20,
  },
});
