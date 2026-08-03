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

import { ComingSoonBlock } from '@/components/home/ComingSoonBlock';
import { CoinBadge } from '@/components/shop/CoinBadge';
import { CoinEarnInfo } from '@/components/rewards/CoinEarnInfo';
import { ShopItemCard } from '@/components/shop/ShopItemCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useShop } from '@/features/shop/ShopProvider';
import type { ShopOwnershipFilter } from '@/types/shop';
import { useTheme } from '@/hooks/use-theme';

const OWNERSHIP_FILTERS: { id: ShopOwnershipFilter; label: string }[] = [
  { id: 'all', label: 'All emotes' },
  { id: 'owned', label: 'Owned' },
  { id: 'unowned', label: 'Unowned' },
];

interface ShopScreenContentProps {
  showHeader?: boolean;
}

export function ShopScreenContent({ showHeader = true }: ShopScreenContentProps) {
  const theme = useTheme();
  const [ownershipFilter, setOwnershipFilter] = useState<ShopOwnershipFilter>('all');
  const { items, summary, isLoading, isUpdating, error, refresh, purchaseItem, equipItem } = useShop();

  const shopEmotes = useMemo(
    () => items.filter((item) => item.itemType === 'emote' && item.id !== 'emote_trophy'),
    [items],
  );

  const filteredItems = useMemo(() => {
    return shopEmotes.filter((item) => {
      if (ownershipFilter === 'owned') {
        return item.owned;
      }

      if (ownershipFilter === 'unowned') {
        return !item.owned;
      }

      return true;
    });
  }, [ownershipFilter, shopEmotes]);

  const emptyMessage = useMemo(() => {
    if (ownershipFilter === 'owned') {
      return 'You do not own any emotes yet.';
    }

    if (ownershipFilter === 'unowned') {
      return 'You already own every emote in the shop.';
    }

    return 'No emotes available right now.';
  }, [ownershipFilter]);

  if (isLoading && shopEmotes.length === 0) {
    return (
      <View style={StyleSheet.flatten([styles.loading, { backgroundColor: theme.background }])}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={() => void refresh()} tintColor={theme.primary} />
      }>
      {showHeader ? (
        <View
          style={StyleSheet.flatten([
            styles.summaryCard,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ])}>
          <View style={styles.summaryTextBlock}>
            <Text style={StyleSheet.flatten([styles.summaryTitle, { color: theme.text }])}>Emote Shop</Text>
            <Text style={StyleSheet.flatten([styles.summaryCopy, { color: theme.textSecondary }])}>
              Spend coins on challenge emotes to celebrate wins and hype up friend races.
            </Text>
          </View>
          <CoinBadge amount={summary.coinBalance} large />
        </View>
      ) : null}

      <CoinEarnInfo />

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

      <ComingSoonBlock
        title="More cosmetics"
        description="Avatar styles, profile frames, and other arena cosmetics are coming soon."
        icon="profile"
      />
      <ComingSoonBlock
        title="More emotes"
        description="New celebration emotes and seasonal items will land in the shop over time."
        icon="gift"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 240,
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
});
