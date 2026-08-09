import { Modal, StyleSheet, Text, View } from 'react-native';

import { CoinBadge } from '@/components/shop/CoinBadge';
import { AppIcon } from '@/components/ui/AppIcon';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import {
  COIN_MULTIPLIER_VALUE,
  SPIN_RARITY_COLORS,
  SPIN_RARITY_LABELS,
} from '@/constants/spinWheel';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { SpinResult } from '@/types/spin';

interface SpinRewardModalProps {
  result: SpinResult | null;
  onClose: () => void;
}

export function SpinRewardModal({ result, onClose }: SpinRewardModalProps) {
  const theme = useTheme();

  if (!result) {
    return null;
  }

  const rarityColor = SPIN_RARITY_COLORS[result.rarity];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={StyleSheet.flatten([
            styles.card,
            { backgroundColor: theme.backgroundElement, borderColor: rarityColor },
          ])}>
          <View
            style={StyleSheet.flatten([styles.iconWrap, { backgroundColor: `${rarityColor}22` }])}>
            {result.multiplierGranted ? (
              <AppIcon name="bolt" size={34} color={rarityColor} weight="bold" />
            ) : (
              <CoinIcon size={34} />
            )}
          </View>

          <Text style={StyleSheet.flatten([styles.rarity, { color: rarityColor }])}>
            {SPIN_RARITY_LABELS[result.rarity]}
          </Text>

          <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>
            {result.multiplierGranted
              ? `${COIN_MULTIPLIER_VALUE}x Coins unlocked`
              : `You won ${result.coinsAwarded} coins`}
          </Text>

          <Text style={StyleSheet.flatten([styles.message, { color: theme.textSecondary }])}>
            {result.multiplierGranted
              ? 'Every coin you earn is doubled for the rest of the day. Complete challenges now to make the most of it.'
              : 'Coins have been added to your balance. Come back tomorrow for another spin.'}
          </Text>

          <View style={styles.balanceRow}>
            <Text style={StyleSheet.flatten([styles.balanceLabel, { color: theme.textSecondary }])}>
              Balance
            </Text>
            <CoinBadge amount={result.coinBalance} large />
          </View>

          <PrimaryButton label="Nice" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: MaxContentWidth,
    borderRadius: Radius.xl,
    borderWidth: 2,
    padding: Spacing.four,
    gap: Spacing.three,
    alignItems: 'center',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rarity: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  balanceLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
});
