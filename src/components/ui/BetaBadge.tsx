import { DimensionValue, StyleSheet, Text, View } from 'react-native';

import { FitContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface BetaBadgeProps {
  showVersion?: boolean;
  compact?: boolean;
}

export function BetaBadge({ showVersion = false, compact = false }: BetaBadgeProps) {
  const theme = useTheme();

  return (
    <View
      style={StyleSheet.flatten([
        styles.badge,
        compact ? styles.badgeCompact : null,
        { backgroundColor: theme.backgroundSelected, borderColor: theme.border },
      ])}>
      <Text
        style={StyleSheet.flatten([
          styles.label,
          showVersion ? styles.versionLabel : null,
          { color: theme.primary },
        ])}>
        {showVersion ? 'BETA Version' : 'Beta'}
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
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  badgeCompact: {
    paddingHorizontal: Spacing.one + 2,
    paddingVertical: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  versionLabel: {
    textTransform: 'none',
    letterSpacing: 0.3,
  },
});
