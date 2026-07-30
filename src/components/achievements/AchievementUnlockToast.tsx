import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, ZoomInRotate } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/ui/AppIcon';
import { Radius, Spacing } from '@/constants/theme';
import type { AchievementRecord } from '@/types/achievements';
import { useTheme } from '@/hooks/use-theme';

const TOP_BAR_HEIGHT = 60;
const AUTO_DISMISS_MS = 5000;

interface AchievementUnlockToastProps {
  achievement: AchievementRecord;
  onDismiss: () => void;
  onPress?: () => void;
}

export function AchievementUnlockToast({ achievement, onDismiss, onPress }: AchievementUnlockToastProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="box-none" style={[styles.overlay, { top: insets.top + TOP_BAR_HEIGHT + Spacing.two }]}>
      <Animated.View entering={FadeInUp.springify().damping(16)} exiting={FadeOutUp.duration(220)}>
        <Pressable
          onPress={onPress ?? onDismiss}
          style={StyleSheet.flatten([
            styles.card,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.primary,
              shadowColor: theme.primary,
            },
          ])}>
          <Animated.View entering={ZoomInRotate.springify().delay(120)} style={styles.iconColumn}>
            <View
              style={StyleSheet.flatten([
                styles.iconWrap,
                { backgroundColor: theme.backgroundSelected, borderColor: theme.primary },
              ])}>
              {achievement.imageUrl ? (
                <Image source={{ uri: achievement.imageUrl }} style={styles.image} contentFit="cover" />
              ) : (
                <AppIcon name={achievement.icon} size={28} color={theme.primary} />
              )}
            </View>
            <Text style={StyleSheet.flatten([styles.unlockedLabel, { color: theme.primary }])}>UNLOCKED</Text>
          </Animated.View>

          <View style={styles.copy}>
            <Text style={StyleSheet.flatten([styles.eyebrow, { color: theme.textSecondary }])}>
              Achievement earned
            </Text>
            <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>{achievement.title}</Text>
            <Text style={StyleSheet.flatten([styles.description, { color: theme.textSecondary }])}>
              {achievement.description}
            </Text>
            {achievement.xpReward > 0 ? (
              <Text style={StyleSheet.flatten([styles.xp, { color: theme.xp }])}>
                +{achievement.xpReward} XP
              </Text>
            ) : null}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss achievement notification"
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

export { AUTO_DISMISS_MS };

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    zIndex: 1100,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 2,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  iconColumn: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  unlockedLabel: {
    fontSize: 9,
    fontWeight: '900',
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
    fontSize: 17,
    fontWeight: '900',
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  xp: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: Spacing.half,
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
