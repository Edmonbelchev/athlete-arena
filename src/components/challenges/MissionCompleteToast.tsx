import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/ui/AppIcon';
import { formatExerciseLabel } from '@/constants/challenges';
import { formatXpAndCoins } from '@/constants/coins';
import { Spacing } from '@/constants/theme';
import type { DailyMissionCompletePayload } from '@/features/challenges/dailyMissionCelebration';
import { useTheme } from '@/hooks/use-theme';

const TOP_BAR_HEIGHT = 60;
export const MISSION_COMPLETE_AUTO_DISMISS_MS = 5500;

interface MissionCompleteToastProps {
  mission: DailyMissionCompletePayload;
  onDismiss: () => void;
  onPress?: () => void;
}

export function MissionCompleteToast({ mission, onDismiss, onPress }: MissionCompleteToastProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const exerciseLabel = formatExerciseLabel(mission.exerciseType, true);
  const rewardLabel = formatXpAndCoins(mission.xp ?? 0, mission.coins ?? 0);

  return (
    <View pointerEvents="box-none" style={styles.passThroughLayer}>
      <Animated.View
        entering={FadeInUp.springify().damping(16)}
        exiting={FadeOutUp.duration(220)}
        pointerEvents="box-none"
        style={[styles.overlay, { top: insets.top + TOP_BAR_HEIGHT + Spacing.two }]}>
        <Pressable
          onPress={onPress ?? onDismiss}
          style={StyleSheet.flatten([
            styles.banner,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
              shadowColor: theme.text,
            },
          ])}>
          <View
            style={StyleSheet.flatten([
              styles.iconWrap,
              { backgroundColor: theme.backgroundSelected, borderColor: theme.border },
            ])}>
            <AppIcon name="target" size={18} color={theme.primary} />
          </View>

          <View style={styles.copy}>
            <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>Quest complete</Text>
            <Text style={StyleSheet.flatten([styles.subtitle, { color: theme.textSecondary }])}>
              {mission.targetReps} {exerciseLabel} · {rewardLabel}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss quest notification"
            onPress={onDismiss}
            hitSlop={8}
            style={StyleSheet.flatten([styles.dismissButton, { borderColor: theme.border }])}>
            <AppIcon name="close" size={14} color={theme.textSecondary} />
          </Pressable>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  passThroughLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
  },
  overlay: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: 14,
    borderWidth: 1,
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  dismissButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
