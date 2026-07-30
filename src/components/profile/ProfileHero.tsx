import { StyleSheet, Text, View } from 'react-native';

import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { CoinBadge } from '@/components/shop/CoinBadge';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Radius, Spacing } from '@/constants/theme';
import type { ShopAvatarDisplay, ShopFrameDisplay } from '@/types/shop';
import { useTheme } from '@/hooks/use-theme';

interface ProfileHeroProps {
  displayName: string;
  username: string;
  level: number;
  coinBalance: number;
  avatarUrl?: string | null;
  shopAvatar?: ShopAvatarDisplay | null;
  frame?: ShopFrameDisplay | null;
  onEdit: () => void;
}

export function ProfileHero({
  displayName,
  username,
  level,
  coinBalance,
  avatarUrl,
  shopAvatar,
  frame,
  onEdit,
}: ProfileHeroProps) {
  const theme = useTheme();

  return (
    <View
      style={StyleSheet.flatten([
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.border },
      ])}>
      <ProfileAvatar
        uri={avatarUrl}
        name={displayName}
        size={104}
        shopAvatar={shopAvatar}
        frame={frame}
      />

      <View style={styles.identity}>
        <Text style={StyleSheet.flatten([styles.displayName, { color: theme.text }])}>{displayName}</Text>
        <Text style={StyleSheet.flatten([styles.username, { color: theme.textSecondary }])}>@{username}</Text>
      </View>

      <View style={styles.metaRow}>
        <View style={StyleSheet.flatten([styles.levelPill, { backgroundColor: theme.backgroundSelected }])}>
          <Text style={StyleSheet.flatten([styles.levelLabel, { color: theme.textSecondary }])}>Level</Text>
          <Text style={StyleSheet.flatten([styles.levelValue, { color: theme.primary }])}>{level}</Text>
        </View>
        <CoinBadge amount={coinBalance} large />
      </View>

      <PrimaryButton label="Edit Profile" variant="secondary" onPress={onEdit} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
    alignSelf: 'stretch',
  },
  identity: {
    alignItems: 'center',
    gap: Spacing.half,
  },
  displayName: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  username: {
    fontSize: 15,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  levelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  levelLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  levelValue: {
    fontSize: 18,
    fontWeight: '900',
  },
});
