import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, ZoomInRotate } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/ui/AppIcon';
import { formatExerciseLabel } from '@/constants/challenges';
import { formatXpAndCoins } from '@/constants/coins';
import { Radius, Spacing } from '@/constants/theme';
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
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
      {...(Platform.OS === 'ios' ? { presentationStyle: 'overFullScreen' as const } : {})}>
      <View pointerEvents="box-none" style={styles.modalRoot}>
        <View
          pointerEvents="box-none"
          style={[styles.overlay, { top: insets.top + TOP_BAR_HEIGHT + Spacing.two }]}>
          <Animated.View
            entering={FadeInUp.springify().damping(16)}
            exiting={FadeOutUp.duration(220)}
            style={styles.toastLayer}>
            <Pressable
              onPress={onPress ?? onDismiss}
              style={StyleSheet.flatten([
                styles.card,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.success,
                  shadowColor: theme.success,
                },
              ])}>
              <Animated.View entering={ZoomInRotate.springify().delay(120)} style={styles.iconColumn}>
                <View
                  style={StyleSheet.flatten([
                    styles.iconWrap,
                    { backgroundColor: theme.backgroundSelected, borderColor: theme.success },
                  ])}>
                  <AppIcon name="target" size={28} color={theme.success} />
                </View>
                <Text style={StyleSheet.flatten([styles.completeLabel, { color: theme.success }])}>
                  COMPLETE
                </Text>
              </Animated.View>

              <View style={styles.copy}>
                <Text style={StyleSheet.flatten([styles.eyebrow, { color: theme.textSecondary }])}>
                  Daily mission
                </Text>
                <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>
                  {mission.targetReps} {exerciseLabel}
                </Text>
                <Text style={StyleSheet.flatten([styles.description, { color: theme.textSecondary }])}>
                  Mission {mission.missionIndex + 1} finished — rewards added to your account.
                </Text>
                <Text style={StyleSheet.flatten([styles.reward, { color: theme.xp }])}>{rewardLabel}</Text>
              </View>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    zIndex: 100,
  },
  toastLayer: {
    width: '100%',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  iconColumn: {
    alignItems: 'center',
    gap: Spacing.one,
    minWidth: 72,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  copy: {
    flex: 1,
    gap: Spacing.half,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  reward: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: Spacing.half,
  },
});
