import { StyleSheet, Text, View } from 'react-native';

import { DAILY_MISSION_REWARD_SUMMARY } from '@/constants/dailyMissionRewards';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function DailyMissionRewardInfo() {
  const theme = useTheme();

  return (
    <View
      style={StyleSheet.flatten([
        styles.card,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ])}>
      <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>Mission rewards</Text>
      <Text style={StyleSheet.flatten([styles.line, { color: theme.textSecondary }])}>
        {DAILY_MISSION_REWARD_SUMMARY}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  line: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
});
