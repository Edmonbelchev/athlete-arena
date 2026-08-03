import { StyleSheet, Text, View } from 'react-native';

import { APP_VERSION_LABEL } from '@/constants/app';
import { Radius, Spacing } from '@/constants/theme';
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
      <Text style={StyleSheet.flatten([styles.label, { color: theme.primary }])}>Beta</Text>
      {showVersion ? (
        <Text style={StyleSheet.flatten([styles.version, { color: theme.textSecondary }])}>
          {APP_VERSION_LABEL}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
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
  version: {
    fontSize: 10,
    fontWeight: '600',
  },
});
