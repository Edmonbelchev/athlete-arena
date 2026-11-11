import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Modal, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { CelebrationConfetti } from '@/components/celebrations/CelebrationConfetti';
import { XpCoinRewardLabel } from '@/components/rewards/XpCoinRewardLabel';
import { AppIcon } from '@/components/ui/AppIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Radius, Spacing } from '@/constants/theme';
import type { WeeklyStreakCelebration } from '@/features/celebrations/celebrationQueue';
import { useTheme } from '@/hooks/use-theme';

const DAY_POP_INTERVAL_MS = 130;
const FIRST_DAY_DELAY_MS = 350;

function StreakDay({ index, color, trackColor }: { index: number; color: string; trackColor: string }) {
  const fill = useSharedValue(0);
  const scale = useSharedValue(0.6);

  useEffect(() => {
    const delay = FIRST_DAY_DELAY_MS + index * DAY_POP_INTERVAL_MS;
    fill.value = withDelay(delay, withTiming(1, { duration: 180 }));
    scale.value = withDelay(
      delay,
      withSequence(withTiming(1.25, { duration: 140 }), withSpring(1, { damping: 8, stiffness: 200 })),
    );
  }, [fill, index, scale]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.35 + fill.value * 0.65,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.day, style, { backgroundColor: color, borderColor: trackColor }]}>
      <Text style={styles.dayLabel}>{index + 1}</Text>
    </Animated.View>
  );
}

interface WeeklyStreakCelebrationModalProps {
  celebration: WeeklyStreakCelebration;
  onClose: () => void;
}

/** Weekly mission streak popup: the week's days light up one by one, then the reward. */
export function WeeklyStreakCelebrationModal({ celebration, onClose }: WeeklyStreakCelebrationModalProps) {
  const theme = useTheme();
  const days = Math.max(1, celebration.targetDays);
  const flamePulse = useSharedValue(1);
  const rewardDelay = FIRST_DAY_DELAY_MS + days * DAY_POP_INTERVAL_MS + 150;

  useEffect(() => {
    flamePulse.value = withDelay(
      rewardDelay,
      withRepeat(
        withSequence(
          withTiming(1.12, { duration: 650, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 650, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );

    if (Platform.OS === 'web') {
      return;
    }

    const timer = setTimeout(() => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }, rewardDelay);
    return () => clearTimeout(timer);
  }, [flamePulse, rewardDelay]);

  const flameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: flamePulse.value }],
  }));

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
      {...(Platform.OS === 'ios' ? { presentationStyle: 'overFullScreen' as const } : {})}>
      <View style={styles.backdrop}>
        <Animated.View
          entering={ZoomIn.springify().damping(14)}
          style={StyleSheet.flatten([
            styles.card,
            { backgroundColor: theme.backgroundElement, borderColor: theme.streak, shadowColor: theme.streak },
          ])}>
          <CelebrationConfetti startDelay={rewardDelay} />

          <Animated.View
            style={[styles.flame, flameStyle, { backgroundColor: theme.streak, borderColor: theme.backgroundElement }]}>
            <AppIcon name="flame" size={38} color="#FFFFFF" weight="bold" />
          </Animated.View>

          <Text style={StyleSheet.flatten([styles.eyebrow, { color: theme.streak }])}>WEEKLY STREAK</Text>
          <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>Streak complete!</Text>
          <Text style={StyleSheet.flatten([styles.copy, { color: theme.textSecondary }])}>
            {days} days of daily missions in a row.
          </Text>

          <View style={styles.dayRow}>
            {Array.from({ length: days }, (_, index) => (
              <StreakDay key={index} index={index} color={theme.streak} trackColor={theme.backgroundElement} />
            ))}
          </View>

          <Animated.View entering={FadeInUp.delay(rewardDelay).springify()} style={styles.reward}>
            <Text style={StyleSheet.flatten([styles.rewardLabel, { color: theme.textSecondary }])}>Streak bonus</Text>
            <XpCoinRewardLabel
              xp={celebration.rewardXp}
              coins={celebration.rewardCoins}
              style={StyleSheet.flatten([styles.rewardValue, { color: theme.xp }])}
            />
          </Animated.View>

          <View style={styles.actions}>
            <PrimaryButton label="Keep it going!" onPress={onClose} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.lg,
    borderWidth: 2,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    overflow: 'hidden',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  flame: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2.4,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'center',
  },
  copy: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  dayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
    marginVertical: Spacing.two,
  },
  day: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  reward: {
    alignItems: 'center',
    gap: Spacing.half,
  },
  rewardLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  rewardValue: {
    fontSize: 20,
    fontWeight: '900',
  },
  actions: {
    alignSelf: 'stretch',
    marginTop: Spacing.two,
  },
});
