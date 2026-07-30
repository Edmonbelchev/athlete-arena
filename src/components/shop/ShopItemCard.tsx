import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CoinBadge } from '@/components/shop/CoinBadge';
import { AppIcon } from '@/components/ui/AppIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Radius, Spacing } from '@/constants/theme';
import type { ShopItemRecord } from '@/types/shop';
import { useTheme } from '@/hooks/use-theme';

interface ShopItemCardProps {
  item: ShopItemRecord;
  coinBalance: number;
  isUpdating?: boolean;
  onPurchase: (itemId: string) => void;
  onEquip: (itemId: string) => void;
}

export function ShopItemCard({
  item,
  coinBalance,
  isUpdating = false,
  onPurchase,
  onEquip,
}: ShopItemCardProps) {
  const theme = useTheme();
  const canAfford = coinBalance >= item.priceCoins;

  return (
    <View
      style={StyleSheet.flatten([
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: item.equipped ? theme.primary : theme.border,
        },
      ])}>
      <View style={styles.header}>
        <View
          style={StyleSheet.flatten([
            styles.preview,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: item.itemType === 'frame' ? item.metadata.borderColor ?? theme.border : theme.border,
              borderWidth: item.itemType === 'frame' ? item.metadata.borderWidth ?? 3 : 1,
            },
          ])}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.image} contentFit="cover" />
          ) : item.metadata.emoji ? (
            <Text style={styles.emoji}>{item.metadata.emoji}</Text>
          ) : item.metadata.icon ? (
            <AppIcon
              name={item.metadata.icon}
              size={28}
              color={item.metadata.backgroundColor ?? theme.primary}
            />
          ) : (
            <AppIcon name="gift" size={28} color={theme.textSecondary} />
          )}
        </View>

        <View style={styles.copy}>
          <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>{item.title}</Text>
          <Text style={StyleSheet.flatten([styles.description, { color: theme.textSecondary }])}>
            {item.description}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        {item.owned ? (
          <>
            <Text style={StyleSheet.flatten([styles.ownedLabel, { color: theme.success }])}>
              {item.equipped ? 'Equipped' : 'Owned'}
            </Text>
            {!item.equipped ? (
              <PrimaryButton
                label="Equip"
                variant="secondary"
                loading={isUpdating}
                onPress={() => onEquip(item.id)}
              />
            ) : null}
          </>
        ) : (
          <>
            {item.priceCoins === 0 ? (
              <Text style={StyleSheet.flatten([styles.freeLabel, { color: theme.primary }])}>Free</Text>
            ) : (
              <CoinBadge amount={item.priceCoins} />
            )}
            <PrimaryButton
              label={item.priceCoins === 0 ? 'Claim' : 'Buy'}
              loading={isUpdating}
              disabled={!canAfford && item.priceCoins > 0}
              onPress={() => onPurchase(item.id)}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'center',
  },
  preview: {
    width: 64,
    height: 64,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  emoji: {
    fontSize: 32,
  },
  copy: {
    flex: 1,
    gap: Spacing.one,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  ownedLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  freeLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
});
