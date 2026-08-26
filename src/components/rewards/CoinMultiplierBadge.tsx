import { StyleSheet, Text, View } from 'react-native';

import { COIN_MULTIPLIER_VALUE } from '@/constants/spinWheel';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface CoinMultiplierBadgeProps {
  compact?: boolean;
}

export function CoinMultiplierBadge({ compact = false }: CoinMultiplierBadgeProps) {
  const theme = useTheme();

  return (
    <View
      style={StyleSheet.flatten([
        styles.badge,
        compact ? styles.badgeCompact : null,
        { backgroundColor: theme.accent },
      ])}>
      <Text style={StyleSheet.flatten([styles.label, compact ? styles.labelCompact : null])}>
        {COIN_MULTIPLIER_VALUE}x
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.sm,
  },
  badgeCompact: {
    paddingHorizontal: Spacing.one + 2,
    paddingVertical: 2,
  },
  label: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
    color: '#FFFFFF',
  },
  labelCompact: {
    fontSize: 10,
  },
});
