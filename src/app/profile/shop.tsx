import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoinBadge } from '@/components/shop/CoinBadge';
import { ShopItemCard } from '@/components/shop/ShopItemCard';
import { AppIcon } from '@/components/ui/AppIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useShop } from '@/features/shop/ShopProvider';
import { leaveScreen } from '@/lib/navigation';
import type { ShopCategoryFilter, ShopOwnershipFilter } from '@/types/shop';
import { useTheme } from '@/hooks/use-theme';

const CATEGORY_FILTERS: { id: ShopCategoryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'avatar', label: 'Avatars' },
  { id: 'frame', label: 'Frames' },
  { id: 'emote', label: 'Emotes' },
];

const OWNERSHIP_FILTERS: { id: ShopOwnershipFilter; label: string }[] = [
  { id: 'all', label: 'All items' },
  { id: 'owned', label: 'Owned' },
  { id: 'unowned', label: 'Unowned' },
];

export default function ShopScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [categoryFilter, setCategoryFilter] = useState<ShopCategoryFilter>('all');
  const [ownershipFilter, setOwnershipFilter] = useState<ShopOwnershipFilter>('all');
  const { items, summary, isLoading, isUpdating, error, refresh, purchaseItem, equipItem } = useShop();

  const headerOptions = {
    title: 'Shop',
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

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesCategory = categoryFilter === 'all' || item.itemType === categoryFilter;
      const matchesOwnership =
        ownershipFilter === 'all' ||
        (ownershipFilter === 'owned' ? item.owned : !item.owned);

      return matchesCategory && matchesOwnership;
    });
  }, [categoryFilter, ownershipFilter, items]);

  const emptyMessage = useMemo(() => {
    if (ownershipFilter === 'owned') {
      return 'You do not own any items in this view yet.';
    }

    if (ownershipFilter === 'unowned') {
      return 'You already own everything in this view.';
    }

    return 'No items in this category yet.';
  }, [ownershipFilter]);

  if (isLoading && items.length === 0) {
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
            <RefreshControl refreshing={isLoading} onRefresh={() => void refresh()} tintColor={theme.primary} />
          }>
          <View
            style={StyleSheet.flatten([
              styles.summaryCard,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ])}>
            <View style={styles.summaryTextBlock}>
              <Text style={StyleSheet.flatten([styles.summaryTitle, { color: theme.text }])}>Arena Shop</Text>
              <Text style={StyleSheet.flatten([styles.summaryCopy, { color: theme.textSecondary }])}>
                Spend coins on avatars, profile frames, and challenge emotes.
              </Text>
            </View>
            <CoinBadge amount={summary.coinBalance} large />
          </View>

          <View style={styles.filters}>
            {CATEGORY_FILTERS.map((item) => {
              const active = categoryFilter === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setCategoryFilter(item.id)}
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

          <View style={styles.filters}>
            {OWNERSHIP_FILTERS.map((item) => {
              const active = ownershipFilter === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setOwnershipFilter(item.id)}
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
            {filteredItems.map((item) => (
              <ShopItemCard
                key={item.id}
                item={item}
                coinBalance={summary.coinBalance}
                isUpdating={isUpdating}
                onPurchase={(itemId) => void purchaseItem(itemId)}
                onEquip={(itemId) => void equipItem(itemId)}
              />
            ))}
          </View>

          {!error && filteredItems.length === 0 ? (
            <Text style={StyleSheet.flatten([styles.empty, { color: theme.textSecondary }])}>{emptyMessage}</Text>
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  summaryTextBlock: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    gap: Spacing.one,
  },
  summaryTitle: {
    fontSize: 22,
    fontWeight: '900',
  },
  summaryCopy: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    flexShrink: 1,
    ...Platform.select({
      web: {
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
      },
      default: {},
    }),
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
