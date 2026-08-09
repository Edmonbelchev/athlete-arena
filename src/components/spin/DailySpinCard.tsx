import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import {
  COIN_MULTIPLIER_VALUE,
  formatTimeRemaining,
} from '@/constants/spinWheel';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface DailySpinCardProps {
  canSpin: boolean;
  multiplierActive: boolean;
  multiplierExpiresAt: string | null;
  nextSpinAt: string | null;
  onPress: () => void;
}

export function DailySpinCard({
  canSpin,
  multiplierActive,
  multiplierExpiresAt,
  nextSpinAt,
  onPress,
}: DailySpinCardProps) {
  const theme = useTheme();
  const accentColor = canSpin ? theme.success : theme.textSecondary;
  const multiplierRemaining = formatTimeRemaining(multiplierExpiresAt);
  const nextSpinRemaining = formatTimeRemaining(nextSpinAt);

  const description = canSpin
    ? 'Your free spin is ready. Win coins or double your earnings for the day.'
    : multiplierActive
      ? `${COIN_MULTIPLIER_VALUE}x coins active${multiplierRemaining ? ` for ${multiplierRemaining}` : ''}.`
      : nextSpinRemaining
        ? `Already spun today. Next spin in ${nextSpinRemaining}.`
        : 'Already spun today. Come back tomorrow.';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open the daily spin wheel"
      onPress={onPress}
      style={({ pressed }) =>
        StyleSheet.flatten([
          styles.card,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: canSpin ? theme.success : theme.border,
            opacity: pressed ? 0.85 : 1,
          },
        ])
      }>
      <View
        style={StyleSheet.flatten([styles.iconWrap, { backgroundColor: theme.backgroundSelected }])}>
        <AppIcon name="crown" size={24} color={accentColor} weight="semibold" />
      </View>

      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>Daily Spin</Text>
          {canSpin ? (
            <View style={StyleSheet.flatten([styles.badge, { backgroundColor: theme.success }])}>
              <Text style={styles.badgeText}>READY</Text>
            </View>
          ) : null}
          {multiplierActive ? (
            <View style={StyleSheet.flatten([styles.badge, { backgroundColor: theme.accent }])}>
              <Text style={styles.badgeText}>{COIN_MULTIPLIER_VALUE}X</Text>
            </View>
          ) : null}
        </View>
        <Text style={StyleSheet.flatten([styles.description, { color: theme.textSecondary }])}>
          {description}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: Spacing.one,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.sm,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    color: '#FFFFFF',
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
});
