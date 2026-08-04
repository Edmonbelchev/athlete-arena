import { Stack, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OnboardingCameraTry } from '@/components/onboarding/OnboardingCameraTry';
import { OnboardingShell } from '@/components/onboarding/OnboardingShell';
import { AppIcon } from '@/components/ui/AppIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { BetaBadge } from '@/components/ui/BetaBadge';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import {
  ONBOARDING_BENEFITS_INTRO,
  ONBOARDING_DONE,
  ONBOARDING_EXERCISE_BENEFITS,
  ONBOARDING_GENERAL_NOTE,
  ONBOARDING_HOW_IT_WORKS,
  ONBOARDING_STEP_COUNT,
  ONBOARDING_WELCOME,
} from '@/features/onboarding/onboardingContent';
import { useUserSettings } from '@/features/settings/UserSettingsProvider';
import { useTheme } from '@/hooks/use-theme';

export default function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { completeOnboarding, isSaving } = useUserSettings();
  const [stepIndex, setStepIndex] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);

  const finishOnboarding = useCallback(async () => {
    if (isFinishing) {
      return;
    }

    setIsFinishing(true);
    try {
      await completeOnboarding();
      router.replace('/(tabs)');
    } finally {
      setIsFinishing(false);
    }
  }, [completeOnboarding, isFinishing, router]);

  function handleNext() {
    if (stepIndex >= ONBOARDING_STEP_COUNT - 1) {
      void finishOnboarding();
      return;
    }

    setStepIndex((current) => current + 1);
  }

  function handleBack() {
    setStepIndex((current) => Math.max(0, current - 1));
  }

  const isLastStep = stepIndex === ONBOARDING_STEP_COUNT - 1;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView
        style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}
        edges={['top', 'left', 'right', 'bottom']}>
        <OnboardingShell
          stepIndex={stepIndex}
          stepCount={ONBOARDING_STEP_COUNT}
          onSkip={() => void finishOnboarding()}
          footer={
            stepIndex === 3 ? null : (
              <View style={styles.footerActions}>
                {stepIndex > 0 ? (
                  <PrimaryButton label="Back" variant="secondary" onPress={handleBack} />
                ) : null}
                <PrimaryButton
                  label={isLastStep ? 'Enter Athlete Arena' : 'Next'}
                  loading={isFinishing || isSaving}
                  onPress={handleNext}
                />
              </View>
            )
          }>
          {stepIndex === 0 ? (
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.hero}>
                <View
                  style={StyleSheet.flatten([
                    styles.heroIcon,
                    { backgroundColor: theme.backgroundSelected },
                  ])}>
                  <AppIcon name="dumbbell" size={36} color={theme.primary} />
                </View>
                <BetaBadge showVersion />
              </View>
              <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>
                {ONBOARDING_WELCOME.title}
              </Text>
              <Text style={StyleSheet.flatten([styles.body, { color: theme.textSecondary }])}>
                {ONBOARDING_WELCOME.description}
              </Text>
            </ScrollView>
          ) : null}

          {stepIndex === 1 ? (
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>How it works</Text>
              <Text style={StyleSheet.flatten([styles.body, { color: theme.textSecondary }])}>
                Four things to know before your first challenge.
              </Text>
              <View style={styles.featureList}>
                {ONBOARDING_HOW_IT_WORKS.map((feature) => (
                  <View
                    key={feature.title}
                    style={StyleSheet.flatten([
                      styles.featureCard,
                      { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                    ])}>
                    <View
                      style={StyleSheet.flatten([
                        styles.featureIcon,
                        { backgroundColor: theme.backgroundSelected },
                      ])}>
                      <AppIcon name={feature.icon} size={22} color={theme.primary} />
                    </View>
                    <View style={styles.featureCopy}>
                      <Text style={StyleSheet.flatten([styles.featureTitle, { color: theme.text }])}>
                        {feature.title}
                      </Text>
                      <Text style={StyleSheet.flatten([styles.featureDescription, { color: theme.textSecondary }])}>
                        {feature.description}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          ) : null}

          {stepIndex === 2 ? (
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>Why these exercises?</Text>
              <Text style={StyleSheet.flatten([styles.body, { color: theme.textSecondary }])}>
                {ONBOARDING_BENEFITS_INTRO}
              </Text>
              <View style={styles.featureList}>
                {ONBOARDING_EXERCISE_BENEFITS.map((benefit) => (
                  <View
                    key={benefit.exercise}
                    style={StyleSheet.flatten([
                      styles.benefitCard,
                      { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                    ])}>
                    <Text style={StyleSheet.flatten([styles.benefitExercise, { color: theme.text }])}>
                      {benefit.exercise}
                    </Text>
                    <Text style={StyleSheet.flatten([styles.benefitMuscles, { color: theme.primary }])}>
                      {benefit.muscles}
                    </Text>
                    <Text style={StyleSheet.flatten([styles.benefitNote, { color: theme.textSecondary }])}>
                      {benefit.note}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={StyleSheet.flatten([styles.disclaimer, { color: theme.textSecondary }])}>
                {ONBOARDING_GENERAL_NOTE}
              </Text>
            </ScrollView>
          ) : null}

          {stepIndex === 3 ? (
            <OnboardingCameraTry onContinue={() => setStepIndex(4)} />
          ) : null}

          {stepIndex === 4 ? (
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.hero}>
                <View
                  style={StyleSheet.flatten([
                    styles.heroIcon,
                    { backgroundColor: theme.backgroundSelected },
                  ])}>
                  <AppIcon name="rocket" size={36} color={theme.primary} />
                </View>
              </View>
              <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>{ONBOARDING_DONE.title}</Text>
              <Text style={StyleSheet.flatten([styles.body, { color: theme.textSecondary }])}>
                {ONBOARDING_DONE.description}
              </Text>
            </ScrollView>
          ) : null}
        </OnboardingShell>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  scrollContent: {
    gap: Spacing.four,
    paddingBottom: Spacing.four,
  },
  hero: {
    alignItems: 'flex-start',
    gap: Spacing.three,
    paddingTop: Spacing.two,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  featureList: {
    gap: Spacing.three,
  },
  featureCard: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureCopy: {
    flex: 1,
    gap: Spacing.one,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  featureDescription: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  benefitCard: {
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.one,
  },
  benefitExercise: {
    fontSize: 17,
    fontWeight: '800',
  },
  benefitMuscles: {
    fontSize: 14,
    fontWeight: '700',
  },
  benefitNote: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  footerActions: {
    gap: Spacing.two,
  },
});
