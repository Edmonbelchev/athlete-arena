import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { CelebrationConfetti } from '@/components/celebrations/CelebrationConfetti';
import { AppIcon } from '@/components/ui/AppIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Radius, Spacing } from '@/constants/theme';
import { buildLevelUpSegments, type LevelUpCelebration } from '@/features/celebrations/celebrationQueue';
import { xpProgressInCurrentLevel } from '@/features/xp/levelUtils';
import { useTheme } from '@/hooks/use-theme';

/** Time to fill an empty bar to full; partial fills scale down (with a floor). */
const FULL_BAR_FILL_MS = 900;
const MIN_FILL_MS = 350;
const FIRST_FILL_DELAY_MS = 450;
const BETWEEN_LEVELS_MS = 260;

interface LevelUpCelebrationModalProps {
  celebration: LevelUpCelebration;
  onClose: () => void;
}

/**
 * Level-up popup: the XP bar fills the old level to full, the level number ticks up (once per
 * level gained), then the bar fills to the progress inside the new level.
 */
export function LevelUpCelebrationModal({ celebration, onClose }: LevelUpCelebrationModalProps) {
  const theme = useTheme();
  const segments = useMemo(
    () => buildLevelUpSegments(celebration.fromXp, celebration.toXp),
    [celebration.fromXp, celebration.toXp],
  );
  const finalProgress = useMemo(() => xpProgressInCurrentLevel(celebration.toXp), [celebration.toXp]);
  const xpGained = Math.max(0, Math.round(celebration.toXp - celebration.fromXp));

  const [segmentIndex, setSegmentIndex] = useState(0);
  const [displayLevel, setDisplayLevel] = useState(segments[0]?.level ?? finalProgress.level);
  const [finished, setFinished] = useState(false);
  const [burst, setBurst] = useState(0);
  const progress = useSharedValue(segments[0]?.fromProgress ?? 0);
  const levelScale = useSharedValue(1);
  const glow = useSharedValue(0);

  useEffect(() => {
    const segment = segments[segmentIndex];
    if (!segment) {
      return;
    }

    progress.value = segment.fromProgress;
    const fill = Math.max(0, segment.toProgress - segment.fromProgress);
    const duration = Math.max(MIN_FILL_MS, Math.round(FULL_BAR_FILL_MS * fill));
    const startDelay = segmentIndex === 0 ? FIRST_FILL_DELAY_MS : BETWEEN_LEVELS_MS;

    const startTimer = setTimeout(() => {
      progress.value = withTiming(segment.toProgress, { duration, easing: Easing.inOut(Easing.cubic) });
    }, startDelay);

    const doneTimer = setTimeout(() => {
      const next = segments[segmentIndex + 1];
      if (!next) {
        setFinished(true);
        return;
      }

      // Bar is full: tick the level up.
      setDisplayLevel(next.level);
      setBurst((value) => value + 1);
      levelScale.value = withSequence(
        withTiming(1.35, { duration: 140, easing: Easing.out(Easing.quad) }),
        withSpring(1, { damping: 9, stiffness: 180 }),
      );
      glow.value = withSequence(withTiming(1, { duration: 140 }), withTiming(0, { duration: 600 }));
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setSegmentIndex(segmentIndex + 1);
    }, startDelay + duration + 120);

    return () => {
      clearTimeout(startTimer);
      clearTimeout(doneTimer);
    };
  }, [glow, levelScale, progress, segmentIndex, segments]);

  const barFillStyle = useAnimatedStyle(() => ({
    width: `${Math.min(1, Math.max(0, progress.value)) * 100}%`,
  }));
  const levelStyle = useAnimatedStyle(() => ({
    transform: [{ scale: levelScale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value * 0.6,
    transform: [{ scale: 1 + glow.value * 0.25 }],
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
            { backgroundColor: theme.backgroundElement, borderColor: theme.xp, shadowColor: theme.xp },
          ])}>
          <CelebrationConfetti burstKey={burst} startDelay={burst === 0 ? 300 : 0} />

          <View style={styles.badgeStack}>
            <Animated.View style={[styles.badgeGlow, glowStyle, { backgroundColor: theme.xp }]} />
            <View style={StyleSheet.flatten([styles.badge, { backgroundColor: theme.xp, borderColor: theme.backgroundElement }])}>
              <AppIcon name="star" size={34} color="#FFFFFF" weight="bold" />
            </View>
          </View>

          <Text style={StyleSheet.flatten([styles.eyebrow, { color: theme.xp }])}>LEVEL UP!</Text>

          <Animated.View style={levelStyle}>
            <Text style={StyleSheet.flatten([styles.level, { color: theme.text }])}>Level {displayLevel}</Text>
          </Animated.View>

          <View style={styles.barBlock}>
            <View style={StyleSheet.flatten([styles.barTrack, { backgroundColor: theme.backgroundSelected }])}>
              <Animated.View style={[styles.barFill, barFillStyle, { backgroundColor: theme.xp }]} />
            </View>
            <View style={styles.barLabels}>
              <Text style={StyleSheet.flatten([styles.barLabel, { color: theme.textSecondary }])}>
                Lv {displayLevel}
              </Text>
              {finished ? (
                <Animated.Text
                  entering={FadeIn.duration(220)}
                  style={StyleSheet.flatten([styles.barLabel, { color: theme.textSecondary }])}>
                  {Math.max(0, Math.round(finalProgress.currentLevelXp))} / {finalProgress.xpToNextLevel} XP
                </Animated.Text>
              ) : null}
            </View>
          </View>

          {xpGained > 0 ? (
            <Text style={StyleSheet.flatten([styles.gain, { color: theme.xp }])}>+{xpGained} XP</Text>
          ) : null}

          <Text style={StyleSheet.flatten([styles.copy, { color: theme.textSecondary }])}>
            {finished
              ? `You reached level ${finalProgress.level}. Keep training to climb higher!`
              : 'Your hard work is paying off…'}
          </Text>

          <View style={styles.actions}>
            <PrimaryButton label={finished ? 'Awesome!' : 'Continue'} onPress={onClose} />
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
  badgeStack: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeGlow: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  badge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2.4,
  },
  level: {
    fontSize: 40,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  barBlock: {
    width: '100%',
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  barTrack: {
    width: '100%',
    height: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 8,
  },
  barLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  barLabel: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  gain: {
    fontSize: 20,
    fontWeight: '900',
  },
  copy: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  actions: {
    alignSelf: 'stretch',
    marginTop: Spacing.two,
  },
});
