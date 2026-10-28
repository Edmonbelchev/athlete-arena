import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { Radius, Spacing } from '@/constants/theme';
import type { WearableTier } from '@/types/avatar';
import type { ShopItemRecord } from '@/types/shop';
import { useTheme } from '@/hooks/use-theme';

export const TIER_LABELS: Record<WearableTier, string> = {
  basic: 'Basic',
  rare: 'Rare',
  legendary: 'Legendary',
};

export const TIER_COLORS: Record<WearableTier, string> = {
  basic: '#64748B',
  rare: '#3B82F6',
  legendary: '#F59E0B',
};

export const WEARABLE_TILE_PREVIEW = 92;

export function getItemTier(item: ShopItemRecord): WearableTier {
  return item.wearable?.tier ?? item.metadata.tier ?? 'basic';
}

interface ShopTileProps {
  item: ShopItemRecord;
  /** What the item looks like: the user's avatar wearing it, a framed avatar, or an emote. */
  preview: React.ReactNode;
  selected: boolean;
  canAfford: boolean;
  onPress: () => void;
}

/** Compact grid tile for any shop item; tapping it previews the item in the fitting room. */
export function WearableShopCard({ item, preview, selected, canAfford, onPress }: ShopTileProps) {
  const theme = useTheme();
  const tier = getItemTier(item);
  const tierColor = TIER_COLORS[tier];
  const status = item.equipped ? 'Equipped' : item.owned ? 'Owned' : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${status ?? `${item.priceCoins} coins`}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) =>
        StyleSheet.flatten([
          styles.card,
          {
            backgroundColor: theme.card,
            borderColor: selected ? theme.primary : tier === 'legendary' ? tierColor : theme.border,
            borderWidth: selected ? 2.5 : 1,
            opacity: pressed ? 0.85 : 1,
          },
        ])
      }>
      <View style={StyleSheet.flatten([styles.preview, { backgroundColor: theme.backgroundSelected }])}>
        {preview}
        <View style={StyleSheet.flatten([styles.tierBar, { backgroundColor: tierColor }])} />
        {item.owned ? (
          <View style={StyleSheet.flatten([styles.ownedBadge, { backgroundColor: theme.card }])}>
            <AppIcon name="checkmark" size={16} color={theme.success} weight="bold" />
          </View>
        ) : null}
      </View>
      <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])} numberOfLines={1}>
        {item.title}
      </Text>
      {status ? (
        <Text style={StyleSheet.flatten([styles.owned, { color: theme.success }])}>{status}</Text>
      ) : (
        <View style={styles.priceRow}>
          <CoinIcon size={13} />
          <Text
            style={StyleSheet.flatten([
              styles.price,
              { color: canAfford ? theme.text : theme.textSecondary },
            ])}>
            {item.priceCoins.toLocaleString()}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: Radius.lg,
    padding: Spacing.one + 2,
    gap: Spacing.one,
  },
  preview: {
    aspectRatio: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
  },
  ownedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    borderRadius: 10,
  },
  title: {
    fontSize: 12,
    fontWeight: '800',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  price: {
    fontSize: 12,
    fontWeight: '800',
  },
  owned: {
    fontSize: 12,
    fontWeight: '800',
  },
});
