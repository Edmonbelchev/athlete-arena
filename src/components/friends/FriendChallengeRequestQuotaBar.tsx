import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Radius, Spacing } from '@/constants/theme';
import type { FriendChallengeRequestQuota } from '@/types/friends';
import { useTheme } from '@/hooks/use-theme';

interface FriendChallengeRequestQuotaBarProps {
  quota: FriendChallengeRequestQuota;
  onUpgrade?: () => void;
  /** Opens the shop's challenge slots; shown to free users near or at the limit. */
  onBuySlots?: () => void;
  showUpgradeButton?: boolean;
}

export function getFriendChallengeRequestRemaining(quota: FriendChallengeRequestQuota): number | null {
  if (quota.monthlyLimit === null) {
    return null;
  }

  return Math.max(quota.monthlyLimit - quota.usedCount, 0);
}

/**
 * Everything the user can send this month: what they've sent plus what's left of the free
 * monthly allowance plus bought slots (which never expire). Null for Premium (unlimited).
 */
export function getFriendChallengeRequestAllowance(quota: FriendChallengeRequestQuota): number | null {
  const remaining = getFriendChallengeRequestRemaining(quota);
  if (remaining === null) {
    return null;
  }
  return quota.usedCount + remaining + Math.max(quota.bonusSlots, 0);
}

export function FriendChallengeRequestQuotaBar({
  quota,
  onUpgrade,
  onBuySlots,
  showUpgradeButton = false,
}: FriendChallengeRequestQuotaBarProps) {
  const theme = useTheme();
  const remaining = getFriendChallengeRequestRemaining(quota);
  const atLimit = !quota.canCreate;
  const usingBonusSlots = !quota.isPremium && remaining === 0 && quota.bonusSlots > 0;
  const bonusLabel = `${quota.bonusSlots} bought slot${quota.bonusSlots === 1 ? '' : 's'}`;
  const allowance = getFriendChallengeRequestAllowance(quota);
  const progress = allowance && allowance > 0 ? Math.min(quota.usedCount / allowance, 1) : 1;

  return (
    <View
      style={StyleSheet.flatten([
        styles.container,
        {
          backgroundColor: atLimit ? `${theme.danger}12` : theme.backgroundElement,
          borderColor: atLimit ? theme.danger : theme.border,
        },
      ])}>
      <View style={styles.header}>
        <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>
          {quota.isPremium ? 'Challenge requests' : 'Monthly challenge requests'}
        </Text>
        <Text
          style={StyleSheet.flatten([
            styles.count,
            { color: quota.isPremium ? theme.primary : theme.textSecondary },
          ])}>
          {quota.isPremium
            ? 'Unlimited'
            : quota.monthlyLimit === null
              ? ''
              : `${quota.usedCount} / ${allowance}`}
        </Text>
      </View>

      {!quota.isPremium && quota.monthlyLimit !== null ? (
        <View style={StyleSheet.flatten([styles.track, { backgroundColor: theme.backgroundSelected }])}>
          <View
            style={StyleSheet.flatten([
              styles.fill,
              {
                backgroundColor: atLimit ? theme.danger : theme.primary,
                width: `${progress * 100}%`,
              },
            ])}
          />
        </View>
      ) : null}

      <Text style={StyleSheet.flatten([styles.meta, { color: theme.textSecondary }])}>
        {quota.isPremium
          ? 'Send as many friend challenges as you want.'
          : remaining === null
            ? ''
            : usingBonusSlots
              ? `${quota.monthlyLimit} free this month used - ${bonusLabel} left (they never expire).`
              : atLimit
                ? 'Limit reached for this month.'
                : `${remaining} free remaining this month${quota.bonusSlots > 0 ? ` + ${bonusLabel}` : ''}`}
      </Text>

      {!quota.isPremium && onBuySlots && (atLimit || usingBonusSlots) ? (
        <Pressable accessibilityRole="button" onPress={onBuySlots}>
          <Text style={StyleSheet.flatten([styles.upgradeLink, { color: theme.primary }])}>
            Buy challenge slots in the Shop
          </Text>
        </Pressable>
      ) : null}

      {showUpgradeButton && atLimit && onUpgrade ? (
        <PrimaryButton label="Upgrade for unlimited" onPress={onUpgrade} />
      ) : atLimit && onUpgrade && !showUpgradeButton ? (
        <Pressable accessibilityRole="button" onPress={onUpgrade}>
          <Text style={StyleSheet.flatten([styles.upgradeLink, { color: theme.primary }])}>
            Upgrade for unlimited
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  count: {
    fontSize: 14,
    fontWeight: '700',
  },
  track: {
    height: 8,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radius.sm,
  },
  meta: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  upgradeLink: {
    fontSize: 14,
    fontWeight: '700',
  },
});
