import { StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface XPProgressBarProps {
  currentXp: number;
  targetXp: number;
  level: number;
}

export function XPProgressBar({ currentXp, targetXp, level }: XPProgressBarProps) {
  const theme = useTheme();
  const progress = targetXp > 0 ? Math.min(currentXp / targetXp, 1) : 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.level, { color: theme.text }]}>Level {level}</Text>
        <Text style={[styles.xpText, { color: theme.textSecondary }]}>
          {currentXp.toLocaleString()} / {targetXp.toLocaleString()} XP
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
        <View
          style={[
            styles.fill,
            {
              backgroundColor: theme.xp,
              width: `${progress * 100}%`,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.one,
  },
  level: {
    fontSize: 16,
    fontWeight: '700',
  },
  xpText: {
    fontSize: 14,
    fontWeight: '600',
  },
  track: {
    height: 10,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radius.sm,
  },
});
