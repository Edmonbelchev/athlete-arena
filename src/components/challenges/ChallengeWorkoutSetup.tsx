import { useEffect } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

import { PoseGuidanceBanner } from '@/components/PoseGuidanceBanner';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import type { ExerciseType } from '@/constants/challenges';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface ChallengeWorkoutSetupProps {
  exerciseLabel: string;
  exerciseType: ExerciseType;
  targetReps: number;
  subtitle?: string;
  onStart: () => void;
  onCancel: () => void;
}

/** Keep setup in portrait so the pre-workout sheet stays scrollable and tappable. */
function useSetupPortraitLock(): void {
  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }, []);
}

export function ChallengeWorkoutSetup({
  exerciseLabel,
  exerciseType,
  targetReps,
  subtitle,
  onStart,
  onCancel,
}: ChallengeWorkoutSetupProps) {
  const theme = useTheme();

  useSetupPortraitLock();

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <Text style={StyleSheet.flatten([styles.eyebrow, { color: theme.textSecondary }])}>WORKOUT SETUP</Text>
        <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>{exerciseLabel}</Text>
        <Text style={StyleSheet.flatten([styles.target, { color: theme.text }])}>{targetReps} reps</Text>
        {subtitle ? (
          <Text style={StyleSheet.flatten([styles.subtitle, { color: theme.textSecondary }])}>{subtitle}</Text>
        ) : null}

        <PoseGuidanceBanner exerciseType={exerciseType} />

        <Text style={StyleSheet.flatten([styles.landscapeNote, { color: theme.primary }])}>
          Landscape + a prop works best. Hold still for a moment while tracking locks on.
        </Text>
      </ScrollView>

      <View style={StyleSheet.flatten([styles.footer, { borderTopColor: theme.border }])}>
        <PrimaryButton label="Start" onPress={onStart} />
        <PrimaryButton label="Cancel" variant="secondary" onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: Spacing.four,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: Spacing.two,
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    gap: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  target: {
    fontSize: 40,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  landscapeNote: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
});
