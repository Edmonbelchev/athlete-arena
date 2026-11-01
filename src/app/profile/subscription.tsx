import { Stack, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/ui/AppIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { PREMIUM_BENEFIT_DETAILS } from '@/features/subscription/premiumPaywallContent';
import { usePremium } from '@/features/subscription/usePremium';
import { leaveScreen } from '@/lib/navigation';
import { useTheme } from '@/hooks/use-theme';
import { formatSubscriptionDate } from '@/types/subscription';

export default function SubscriptionScreen() {
  const theme = useTheme();
  const router = useRouter();
  const {
    isPremium,
    isLoading,
    error,
    subscription,
    managementUrl,
    refresh,
    showPremiumPaywall,
    restorePurchases,
  } = usePremium();
  const [actionLoading, setActionLoading] = useState<'upgrade' | 'restore' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  }, [refresh]);

  async function handleUpgrade() {
    setActionError(null);
    setActionLoading('upgrade');
    try {
      await showPremiumPaywall({ context: 'membership', skipIntro: true });
    } catch {
      setActionError('Could not open the subscription paywall.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRestore() {
    setActionError(null);
    setActionLoading('restore');
    try {
      const restored = await restorePurchases();
      if (!restored) {
        setActionError('No active subscription was found to restore.');
      }
    } catch {
      setActionError('Could not restore purchases.');
    } finally {
      setActionLoading(null);
    }
  }

  const showRestoreButton = Platform.OS !== 'web';

  async function handleManageSubscription() {
    if (managementUrl) {
      await Linking.openURL(managementUrl);
      return;
    }

    if (Platform.OS === 'ios') {
      await Linking.openURL('https://apps.apple.com/account/subscriptions');
    }
  }

  const renewalLabel = subscription?.willRenew ? 'Renews on' : 'Expires on';
  const renewalDate = formatSubscriptionDate(subscription?.expiresAt);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Membership',
          headerShown: true,
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => leaveScreen(router)}
              style={styles.headerBack}>
              <AppIcon name="chevronBack" size={22} color={theme.text} />
            </Pressable>
          ),
        }}
      />
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['bottom']}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={() => void handleRefresh()} tintColor={theme.primary} />
          }>
          {error ? (
            <View style={[styles.messageCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <Text style={[styles.messageText, { color: theme.danger }]}>{error}</Text>
            </View>
          ) : null}

          {isLoading && !subscription ? (
            <View style={styles.loadingBlock}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : (
            <View
              style={[
                styles.hero,
                {
                  backgroundColor: theme.card,
                  borderColor: isPremium ? theme.streak : theme.border,
                },
              ]}>
              {/* Soft glow behind the crown. */}
              <View
                style={[
                  styles.heroGlow,
                  { backgroundColor: isPremium ? `${theme.streak}22` : `${theme.primary}14` },
                ]}
              />
              <View
                style={[
                  styles.crownBadge,
                  {
                    backgroundColor: isPremium ? `${theme.streak}26` : theme.backgroundSelected,
                    borderColor: isPremium ? theme.streak : theme.border,
                  },
                ]}>
                <AppIcon name="crown" size={34} color={isPremium ? theme.streak : theme.textSecondary} weight="bold" />
              </View>

              <View style={[styles.planChip, { backgroundColor: isPremium ? theme.streak : theme.backgroundSelected }]}>
                <Text style={[styles.planChipText, { color: isPremium ? '#FFFFFF' : theme.textSecondary }]}>
                  {isPremium ? (subscription?.planLabel ?? 'Premium').toUpperCase() : 'FREE PLAN'}
                </Text>
              </View>

              <Text style={[styles.heroTitle, { color: theme.text }]}>
                {isPremium ? 'You\'re Premium' : 'Go Premium'}
              </Text>
              <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
                {isPremium
                  ? subscription?.expiresAt
                    ? `${subscription.willRenew ? 'Renews' : 'Active until'} ${renewalDate}`
                    : 'Everything below is unlocked.'
                  : 'Custom workouts, unlimited races and quest swaps, and the Elf and Orc avatar races.'}
              </Text>

              {!isPremium ? (
                Platform.OS !== 'web' ? (
                  <PrimaryButton
                    label={actionLoading === 'upgrade' ? 'Opening…' : 'Upgrade to Premium'}
                    loading={actionLoading === 'upgrade'}
                    onPress={() => void handleUpgrade()}
                    style={styles.heroButton}
                  />
                ) : (
                  <Text style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
                    Subscriptions are available in the iOS and Android apps.
                  </Text>
                )
              ) : null}
            </View>
          )}

          <View>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {isPremium ? 'Your perks' : 'What\'s included'}
            </Text>
            <View style={[styles.benefitsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {PREMIUM_BENEFIT_DETAILS.map((benefit, index) => (
                <View
                  key={benefit.title}
                  style={[
                    styles.benefitRow,
                    index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border } : null,
                  ]}>
                  <View style={[styles.benefitIcon, { backgroundColor: `${theme.primary}1F` }]}>
                    <AppIcon name={benefit.icon} size={18} color={theme.primary} weight="semibold" />
                  </View>
                  <View style={styles.benefitText}>
                    <Text style={[styles.benefitTitle, { color: theme.text }]}>{benefit.title}</Text>
                    <Text style={[styles.benefitDetail, { color: theme.textSecondary }]}>{benefit.detail}</Text>
                  </View>
                  {isPremium ? <AppIcon name="checkmark" size={16} color={theme.success} weight="bold" /> : null}
                </View>
              ))}
            </View>
            <Text style={[styles.benefitSoon, { color: theme.textSecondary }]}>More premium features coming soon</Text>
          </View>

          {isPremium && subscription ? (
            <View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Subscription</Text>
              <View style={[styles.detailCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <DetailRow label="Plan" value={subscription.planLabel} theme={theme} />
                <DetailRow label={renewalLabel} value={renewalDate} theme={theme} />
                <DetailRow
                  label="Status"
                  value={subscription.willRenew ? 'Auto-renewing' : 'Expires at period end'}
                  theme={theme}
                />
                <DetailRow
                  label="Source"
                  value={subscription.source === 'revenuecat' ? 'App Store' : 'Account grant'}
                  theme={theme}
                  last
                />
              </View>
            </View>
          ) : null}

          <View style={styles.actions}>
            {isPremium && Platform.OS !== 'web' ? (
              <PrimaryButton
                label="Manage subscription"
                variant="secondary"
                onPress={() => void handleManageSubscription()}
              />
            ) : null}
            {showRestoreButton ? (
              <Pressable
                accessibilityRole="button"
                disabled={actionLoading === 'restore'}
                onPress={() => void handleRestore()}
                style={styles.restoreLink}>
                {actionLoading === 'restore' ? (
                  <ActivityIndicator color={theme.textSecondary} />
                ) : (
                  <Text style={[styles.restoreText, { color: theme.textSecondary }]}>Restore purchases</Text>
                )}
              </Pressable>
            ) : null}
            {actionError ? (
              <Text style={[styles.inlineError, { color: theme.danger }]}>{actionError}</Text>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

function DetailRow({
  label,
  value,
  theme,
  last = false,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.detailRow,
        last ? null : { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
      ]}>
      <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  hero: {
    borderWidth: 1.5,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -120,
    width: 280,
    height: 280,
    borderRadius: 140,
  },
  crownBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  planChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.half + 1,
    borderRadius: 999,
  },
  planChipText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: Spacing.one,
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    textAlign: 'center',
  },
  heroButton: {
    alignSelf: 'stretch',
    marginTop: Spacing.two,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: Spacing.two,
    marginLeft: Spacing.one,
  },
  benefitsCard: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.three,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  benefitIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    flex: 1,
    gap: 2,
  },
  benefitTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  benefitDetail: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  benefitSoon: {
    fontSize: 13,
    fontWeight: '600',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  loadingBlock: {
    paddingVertical: Spacing.five,
    alignItems: 'center',
  },
  messageCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
  },
  messageText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  detailCard: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.three,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
    flexShrink: 1,
  },
  actions: {
    gap: Spacing.two,
  },
  restoreLink: {
    alignSelf: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  restoreText: {
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  inlineError: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerBack: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
});
