import { StyleSheet, Text, View } from 'react-native';

import { CoinRewardPreview } from '@/components/rewards/CoinRewardPreview';
import { COIN_EARN_SOURCES } from '@/constants/coins';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const MULTIPLIER_ELIGIBLE_SOURCES = new Set(['daily_challenge', 'friend_race_win']);

export function CoinEarnInfo() {
  const theme = useTheme();

  return (
    <View
      style={StyleSheet.flatten([
        styles.container,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ])}>
      <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>Earn coins</Text>
      {COIN_EARN_SOURCES.map((source) => (
        <View key={source.id} style={styles.row}>
          <Text style={StyleSheet.flatten([styles.label, { color: theme.textSecondary }])}>
            {source.label}
          </Text>
          <CoinRewardPreview
            amount={source.amount}
            appliesMultiplier={MULTIPLIER_ELIGIBLE_SOURCES.has(source.id)}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.two,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  label: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
