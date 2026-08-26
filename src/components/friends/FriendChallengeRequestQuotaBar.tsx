import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Radius, Spacing } from '@/constants/theme';
import type { FriendChallengeRequestQuota } from '@/types/friends';
import { useTheme } from '@/hooks/use-theme';

interface FriendChallengeRequestQuotaBarProps {
  quota: FriendChallengeRequestQuota;
  onUpgrade?: () => void;
  showUpgradeButton?: boolean;
}

export function getFriendChallengeRequestRemaining(quota: FriendChallengeRequestQuota): number | null {
  if (quota.monthlyLimit === null) {
    return null;
  }

  return Math.max(quota.monthlyLimit - quota.usedCount, 0);
}

export function FriendChallengeRequestQuotaBar({
  quota,
  onUpgrade,
  showUpgradeButton = false,
}: FriendChallengeRequestQuotaBarProps) {
  const theme = useTheme();
  const remaining = getFriendChallengeRequestRemaining(quota);
  const atLimit = !quota.canCreate;
  const progress =
    quota.monthlyLimit && quota.monthlyLimit > 0
      ? Math.min(quota.usedCount / quota.monthlyLimit, 1)
      : 1;

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
              : `${quota.usedCount} / ${quota.monthlyLimit}`}
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
            : atLimit
              ? 'Limit reached for this month.'
              : `${remaining} remaining this month`}
      </Text>

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
