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
      await showPremiumPaywall();
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
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Premium unlocks custom workout create, edit, and share today. More features are on the way.
          </Text>

          <View style={[styles.benefitsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.benefitsTitle, { color: theme.text }]}>What&apos;s included</Text>
            <Text style={[styles.benefit, { color: theme.text }]}>Create custom workouts</Text>
            <Text style={[styles.benefit, { color: theme.text }]}>Edit saved templates</Text>
            <Text style={[styles.benefit, { color: theme.text }]}>Share workouts with friends</Text>
            <Text style={[styles.benefitSoon, { color: theme.textSecondary }]}>
              More premium features coming soon
            </Text>
          </View>

          {isLoading && !subscription ? (
            <View style={styles.loadingBlock}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : null}

          {error ? (
            <View style={[styles.messageCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              <Text style={[styles.messageText, { color: theme.danger }]}>{error}</Text>
            </View>
          ) : null}

          {isPremium && subscription ? (
            <View style={[styles.statusCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={[styles.statusBadge, { backgroundColor: `${theme.streak}18` }]}>
                <AppIcon name="crown" size={28} color={theme.streak} weight="bold" />
              </View>

              <Text style={[styles.statusTitle, { color: theme.text }]}>Premium active</Text>
              <Text style={[styles.planLabel, { color: theme.textSecondary }]}>
                {subscription.planLabel} plan
              </Text>

              <View style={[styles.detailCard, { backgroundColor: theme.backgroundSelected }]}>
                <DetailRow label="Billing" value={subscription.planLabel} theme={theme} />
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
                />
              </View>

              {Platform.OS !== 'web' ? (
                <PrimaryButton
                  label="Manage subscription"
                  variant="secondary"
                  onPress={() => void handleManageSubscription()}
                />
              ) : null}

              {showRestoreButton ? (
                <PrimaryButton
                  label={actionLoading === 'restore' ? 'Restoring…' : 'Restore purchases'}
                  variant="secondary"
                  loading={actionLoading === 'restore'}
                  onPress={() => void handleRestore()}
                />
              ) : null}
            </View>
          ) : (
            <View style={[styles.statusCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={[styles.statusBadge, { backgroundColor: theme.backgroundSelected }]}>
                <AppIcon name="crown" size={28} color={theme.textSecondary} weight="semibold" />
              </View>

              <Text style={[styles.statusTitle, { color: theme.text }]}>Free plan</Text>
              <Text style={[styles.planLabel, { color: theme.textSecondary }]}>
                Upgrade to unlock everything above.
              </Text>

              {Platform.OS !== 'web' ? (
                <>
                  <PrimaryButton
                    label={actionLoading === 'upgrade' ? 'Opening…' : 'Upgrade to Premium'}
                    loading={actionLoading === 'upgrade'}
                    onPress={() => void handleUpgrade()}
                  />
                  {showRestoreButton ? (
                    <PrimaryButton
                      label={actionLoading === 'restore' ? 'Restoring…' : 'Restore purchases'}
                      variant="secondary"
                      loading={actionLoading === 'restore'}
                      onPress={() => void handleRestore()}
                    />
                  ) : null}
                </>
              ) : (
                <Text style={[styles.planLabel, { color: theme.textSecondary }]}>
                  Subscriptions are available in the iOS and Android apps.
                </Text>
              )}
            </View>
          )}

          {actionError ? (
            <Text style={[styles.inlineError, { color: theme.danger }]}>{actionError}</Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

function DetailRow({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={styles.detailRow}>
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
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
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
    marginBottom: Spacing.one,
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
  statusCard: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
  },
  statusBadge: {
    width: 64,
    height: 64,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  planLabel: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
  detailCard: {
    alignSelf: 'stretch',
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
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
  benefit: {
    fontSize: 15,
    fontWeight: '700',
  },
  benefitSoon: {
    fontSize: 14,
    fontWeight: '600',
    fontStyle: 'italic',
    marginTop: Spacing.one,
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
