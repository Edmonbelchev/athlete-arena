import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { GoalCard } from '@/components/goals/GoalCard';
import { HomeSection } from '@/components/home/HomeSection';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Spacing } from '@/constants/theme';
import type { UserGoal } from '@/types/goals';
import { useTheme } from '@/hooks/use-theme';

interface PersonalGoalsSectionProps {
  goals: UserGoal[];
  isLoading: boolean;
  error: string | null;
}

export function PersonalGoalsSection({ goals, isLoading, error }: PersonalGoalsSectionProps) {
  const theme = useTheme();
  const activeGoals = goals.filter((goal) => goal.status === 'active').slice(0, 3);

  return (
    <HomeSection
      title="Personal Goals"
      subtitle="Daily and weekly targets you set for yourself">
      {isLoading && goals.length === 0 ? (
        <ActivityIndicator color={theme.primary} />
      ) : null}

      {error ? (
        <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
      ) : null}

      {!isLoading && activeGoals.length === 0 ? (
        <Text style={[styles.empty, { color: theme.textSecondary }]}>
          Set a daily or weekly target for push-ups, squats, pull-ups, burpees, half burpees, jumping jacks, or jumping squats.
        </Text>
      ) : null}

      <View style={styles.list}>
        {activeGoals.map((goal) => (
          <GoalCard key={goal.id} goal={goal} compact />
        ))}
      </View>

      <PrimaryButton
        label={activeGoals.length > 0 ? 'Manage Goals' : 'Create a Goal'}
        variant="secondary"
        onPress={() => router.push('/profile/goals')}
      />
    </HomeSection>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.three,
  },
  empty: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
  },
});
