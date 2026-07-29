import { StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface StreakDisplayProps {
  streak: number;
  label?: string;
}

export function StreakDisplay({ streak, label = 'Day Streak' }: StreakDisplayProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <AppIcon name="flame" size={28} color={theme.streak} />
      <View>
        <Text style={[styles.count, { color: theme.streak }]}>{streak}</Text>
        <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  count: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 28,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
});
