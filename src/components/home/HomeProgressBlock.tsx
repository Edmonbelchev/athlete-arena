import { StyleSheet, View } from 'react-native';

import { WeeklyMissionStreakTracker } from '@/components/home/WeeklyMissionStreakTracker';
import { StreakDisplay } from '@/components/ui/StreakDisplay';
import { XPProgressBar } from '@/components/ui/XPProgressBar';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { WeeklyMissionStreakStatus } from '@/types/weeklyStreak';

interface HomeProgressBlockProps {
  level: number;
  currentXp: number;
  targetXp: number;
  streak: number;
  weeklyStreak?: WeeklyMissionStreakStatus;
}

export function HomeProgressBlock({
  level,
  currentXp,
  targetXp,
  streak,
  weeklyStreak,
}: HomeProgressBlockProps) {
  const theme = useTheme();

  return (
    <View
      style={StyleSheet.flatten([
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border },
      ])}>
      <View style={styles.row}>
        <View style={styles.xpBlock}>
          <XPProgressBar level={level} currentXp={currentXp} targetXp={targetXp} />
        </View>
        <View style={styles.streakBlock}>
          <StreakDisplay streak={streak} />
        </View>
      </View>
      {weeklyStreak ? <WeeklyMissionStreakTracker status={weeklyStreak} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    borderRadius: Radius.xl,
    borderWidth: 1,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.three,
  },
  xpBlock: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  streakBlock: {
    flexShrink: 0,
  },
});
