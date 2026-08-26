import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/ui/AppIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import {
  getPremiumPaywallContent,
  PREMIUM_BENEFITS,
  type PremiumPaywallContext,
} from '@/features/subscription/premiumPaywallContent';
import { customerHasPremiumEntitlement, isRevenueCatConfigured } from '@/services/revenueCatService';
import { useTheme } from '@/hooks/use-theme';

type PaywallStep = 'intro' | 'paywall';

export interface PremiumPaywallModalProps {
  visible: boolean;
  context: PremiumPaywallContext;
  initialStep?: PaywallStep;
  restoreLoading?: boolean;
  onRestore: () => void;
  onClose: (unlocked: boolean) => void;
}

export function PremiumPaywallModal({
  visible,
  context,
  initialStep = 'intro',
  restoreLoading = false,
  onRestore,
  onClose,
}: PremiumPaywallModalProps) {
  const theme = useTheme();
  const [step, setStep] = useState<PaywallStep>(initialStep);
  const content = getPremiumPaywallContent(context);
  const canPurchase = Platform.OS !== 'web' && isRevenueCatConfigured();

  useEffect(() => {
    if (visible) {
      setStep(initialStep);
    }
  }, [initialStep, visible]);

  function handleClose(unlocked = false) {
    onClose(unlocked);
  }

  function handlePurchaseSuccess() {
    handleClose(true);
  }

  function handleContinue() {
    if (!canPurchase) {
      handleClose(false);
      return;
    }

    setStep('paywall');
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={step === 'paywall' ? 'fullScreen' : 'pageSheet'}
      onRequestClose={() => handleClose(false)}>
      {step === 'intro' ? (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
          <ScrollView contentContainerStyle={styles.introContent} keyboardShouldPersistTaps="handled">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={() => handleClose(false)}
              style={styles.closeButton}>
              <AppIcon name="close" size={22} color={theme.textSecondary} />
            </Pressable>

            <View style={[styles.heroBadge, { backgroundColor: `${theme.streak}18`, borderColor: theme.streak }]}>
              <AppIcon name="crown" size={32} color={theme.streak} weight="bold" />
            </View>

            <Text style={[styles.title, { color: theme.text }]}>{content.title}</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{content.subtitle}</Text>

            <View style={[styles.benefitsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.benefitsTitle, { color: theme.text }]}>What&apos;s included</Text>
              {PREMIUM_BENEFITS.map((benefit) => (
                <View key={benefit} style={styles.benefitRow}>
                  <AppIcon name="checkmark" size={16} color={theme.success} weight="bold" />
                  <Text style={[styles.benefitText, { color: theme.text }]}>{benefit}</Text>
                </View>
              ))}
              <Text style={[styles.benefitSoon, { color: theme.textSecondary }]}>
                More premium features coming soon
              </Text>
            </View>

            {!canPurchase ? (
              <Text style={[styles.platformNote, { color: theme.textSecondary }]}>
                Subscriptions are available in the iOS and Android apps.
              </Text>
            ) : null}

            <PrimaryButton
              label={canPurchase ? content.ctaLabel : 'Got it'}
              onPress={() => (canPurchase ? handleContinue() : handleClose(false))}
            />

            {canPurchase ? (
              <PrimaryButton label="Not now" variant="secondary" onPress={() => handleClose(false)} />
            ) : null}

            {canPurchase ? (
              <Pressable
                accessibilityRole="button"
                onPress={onRestore}
                disabled={restoreLoading}
                style={styles.restoreButton}>
                {restoreLoading ? (
                  <ActivityIndicator color={theme.primary} />
                ) : (
                  <Text style={[styles.restoreText, { color: theme.primary }]}>Restore purchases</Text>
                )}
              </Pressable>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      ) : (
        <View style={[styles.paywallShell, { backgroundColor: theme.background }]}>
          <SafeAreaView edges={['top']} style={styles.paywallHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close paywall"
              onPress={() => handleClose(false)}
              style={styles.paywallClose}>
              <AppIcon name="close" size={22} color={theme.text} />
            </Pressable>
          </SafeAreaView>

          {canPurchase ? (
            <RevenueCatUI.Paywall
              style={styles.paywallView}
              options={{ displayCloseButton: false }}
              onPurchaseCompleted={({ customerInfo }) => {
                if (customerHasPremiumEntitlement(customerInfo)) {
                  handlePurchaseSuccess();
                }
              }}
              onRestoreCompleted={({ customerInfo }) => {
                if (customerHasPremiumEntitlement(customerInfo)) {
                  handlePurchaseSuccess();
                }
              }}
              onDismiss={() => handleClose(false)}
            />
          ) : (
            <View style={styles.unavailableBlock}>
              <Text style={[styles.platformNote, { color: theme.textSecondary }]}>
                Subscriptions are available in the iOS and Android apps.
              </Text>
              <PrimaryButton label="Close" variant="secondary" onPress={() => handleClose(false)} />
            </View>
          )}
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  introContent: {
    padding: Spacing.four,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  closeButton: {
    alignSelf: 'flex-end',
    padding: Spacing.one,
  },
  heroBadge: {
    width: 72,
    height: 72,
    borderRadius: Radius.xl,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
  benefitsCard: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  benefitText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  benefitSoon: {
    fontSize: 14,
    fontWeight: '600',
    fontStyle: 'italic',
    marginTop: Spacing.one,
  },
  platformNote: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  restoreButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: Spacing.one,
  },
  restoreText: {
    fontSize: 14,
    fontWeight: '700',
  },
  paywallShell: {
    flex: 1,
  },
  paywallHeader: {
    paddingHorizontal: Spacing.two,
    paddingBottom: Spacing.one,
  },
  paywallClose: {
    alignSelf: 'flex-start',
    padding: Spacing.two,
  },
  paywallView: {
    flex: 1,
  },
  unavailableBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
});
