import { StyleSheet, Text, View, type TextStyle } from 'react-native';

import { CoinMultiplierBadge } from '@/components/rewards/CoinMultiplierBadge';
import { formatCoinAmount, formatXpAndCoins } from '@/constants/coins';
import { Spacing } from '@/constants/theme';
import { useCoinMultiplier } from '@/features/spin/useCoinMultiplier';
import { useTheme } from '@/hooks/use-theme';

interface XpCoinRewardLabelProps {
  xp: number;
  coins: number;
  suffix?: string;
  style?: TextStyle;
  compact?: boolean;
}

export function XpCoinRewardLabel({
  xp,
  coins,
  suffix = '',
  style,
  compact = false,
}: XpCoinRewardLabelProps) {
  const theme = useTheme();
  const { isActive, applyToCoins } = useCoinMultiplier();
  const doubledCoins = applyToCoins(coins);
  const color = style?.color ?? theme.xp;

  if (coins <= 0 && xp <= 0) {
    return null;
  }

  if (coins <= 0) {
    return (
      <Text style={StyleSheet.flatten([styles.text, compact ? styles.textCompact : null, { color }, style])}>
        {`+${xp} XP${suffix}`}
      </Text>
    );
  }

  if (!isActive) {
    return (
      <Text style={StyleSheet.flatten([styles.text, compact ? styles.textCompact : null, { color }, style])}>
        {`${formatXpAndCoins(xp, coins)}${suffix}`}
      </Text>
    );
  }

  const xpPrefix = xp > 0 ? `+${xp} XP · ` : '';

  return (
    <View style={StyleSheet.flatten([styles.row, compact ? styles.rowCompact : null])}>
      <Text style={StyleSheet.flatten([styles.text, compact ? styles.textCompact : null, { color }, style])}>
        {`${xpPrefix}${formatCoinAmount(coins)} → `}
        <Text style={StyleSheet.flatten([styles.doubledAmount, { color: theme.accent }])}>
          {formatCoinAmount(doubledCoins)}
        </Text>
        {suffix}
      </Text>
      <CoinMultiplierBadge compact={compact} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  rowCompact: {
    gap: Spacing.one,
  },
  text: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  textCompact: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    textAlign: 'left',
  },
  doubledAmount: {
    fontWeight: '900',
  },
});
