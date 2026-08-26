import { StyleSheet, Text, View } from 'react-native';

import { CoinMultiplierBadge } from '@/components/rewards/CoinMultiplierBadge';
import { CoinBadge } from '@/components/shop/CoinBadge';
import { formatCoinAmount } from '@/constants/coins';
import { Spacing } from '@/constants/theme';
import { useCoinMultiplier } from '@/features/spin/useCoinMultiplier';
import { useTheme } from '@/hooks/use-theme';

interface CoinRewardPreviewProps {
  amount: number;
  appliesMultiplier?: boolean;
}

export function CoinRewardPreview({ amount, appliesMultiplier = true }: CoinRewardPreviewProps) {
  const theme = useTheme();
  const { isActive, applyToCoins } = useCoinMultiplier();
  const showDoubled = appliesMultiplier && isActive;
  const effectiveAmount = showDoubled ? applyToCoins(amount) : amount;

  return (
    <View style={styles.container}>
      <CoinBadge amount={effectiveAmount} />
      {showDoubled ? (
        <View style={styles.doubledRow}>
          <Text style={StyleSheet.flatten([styles.doubledText, { color: theme.textSecondary }])}>
            {formatCoinAmount(amount)} doubled
          </Text>
          <CoinMultiplierBadge compact />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
    gap: Spacing.one,
  },
  doubledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  doubledText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
