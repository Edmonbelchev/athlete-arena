import { StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import type { WorkoutSessionReward } from '@/types/titles';
import { useTheme } from '@/hooks/use-theme';

interface WorkoutSessionRewardCardProps {
  reward: WorkoutSessionReward;
}

export function WorkoutSessionRewardCard({ reward }: WorkoutSessionRewardCardProps) {
  const theme = useTheme();

  if (reward.xp <= 0 && reward.coins <= 0) {
    return null;
  }

  const parts: string[] = [];
  if (reward.xp > 0) {
    parts.push(`+${reward.xp} XP`);
  }
  if (reward.coins > 0) {
    parts.push(`+${reward.coins.toLocaleString()} coins`);
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.primary }]}>
      <Text style={[styles.title, { color: theme.text }]}>Workout reward</Text>
      <Text style={[styles.copy, { color: theme.textSecondary }]}>{parts.join(' · ')}</Text>
      {reward.coins > 0 ? (
        <Text style={[styles.note, { color: theme.textSecondary }]}>
          Includes first workout of the day coin bonus.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  copy: {
    fontSize: 15,
    fontWeight: '700',
  },
  note: {
    fontSize: 12,
    lineHeight: 16,
  },
});
