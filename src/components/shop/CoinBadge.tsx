import { DimensionValue, StyleSheet, Text, View } from 'react-native';

import { CoinIcon } from '@/components/ui/CoinIcon';
import { FitContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface CoinBadgeProps {
  amount: number;
  large?: boolean;
}

export function CoinBadge({ amount, large = false }: CoinBadgeProps) {
  const theme = useTheme();

  return (
    <View
      style={StyleSheet.flatten([
        styles.badge,
        large ? styles.badgeLarge : null,
        { backgroundColor: theme.backgroundSelected, borderColor: theme.border },
      ])}>
      <CoinIcon size={large ? 20 : 16} />
      <Text style={StyleSheet.flatten([styles.amount, large ? styles.amountLarge : null, { color: theme.accent }])}>
        {amount.toLocaleString()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: FitContentWidth as DimensionValue,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  badgeLarge: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  amount: {
    fontSize: 13,
    fontWeight: '800',
  },
  amountLarge: {
    fontSize: 18,
  },
});
