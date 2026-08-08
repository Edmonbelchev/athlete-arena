import { Href, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AchievementBadges } from '@/components/sidebar/AchievementBadges';
import { DailyMotivationCard } from '@/components/sidebar/DailyMotivationCard';
import { CoinBadge } from '@/components/shop/CoinBadge';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { BetaBadge } from '@/components/ui/BetaBadge';
import { AppIcon } from '@/components/ui/AppIcon';
import { XPProgressBar } from '@/components/ui/XPProgressBar';
import { getNextAchievements, getRecentUnlockedAchievements } from '@/features/achievements/achievementUtils';
import { useAchievements } from '@/features/achievements/useAchievements';
import type { AppIconName } from '@/constants/icons';
import { Radius, Spacing } from '@/constants/theme';
import { getAuthErrorMessage } from '@/features/auth/authErrors';
import { useAuth } from '@/features/auth';
import { useProfile } from '@/features/profile/useProfile';
import { useShop } from '@/features/shop/ShopProvider';
import { useSidebar } from '@/features/sidebar/SidebarProvider';
import { xpProgressInCurrentLevel } from '@/features/xp/levelUtils';
import { useTheme } from '@/hooks/use-theme';

interface NavItem {
  label: string;
  icon: AppIconName;
  href: Href;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', icon: 'home', href: '/(tabs)' },
  { label: 'Profile', icon: 'profile', href: '/(tabs)/profile' },
  { label: 'Achievements', icon: 'medal', href: '/profile/achievements' },
  { label: 'History', icon: 'history', href: '/profile/history' },
  { label: 'Settings', icon: 'settings', href: '/profile/settings' },
  { label: 'Support', icon: 'support', href: '/profile/support' },
  { label: 'Friends', icon: 'friends', href: '/(tabs)/friends' },
  { label: 'Challenges', icon: 'target', href: '/(tabs)/challenges' },
];

export function AppSidebar() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { isOpen, close } = useSidebar();
  const { signOut } = useAuth();
  const { profile } = useProfile();
  const { summary, equippedAvatar, equippedFrame } = useShop();
  const { achievements } = useAchievements({ syncOnLoad: false });
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const sidebarWidth = Math.min(width * 0.86, 340);
  const displayName = profile?.display_name ?? profile?.username ?? 'Athlete';
  const totalXp = profile?.total_xp ?? 0;
  const xpProgress = xpProgressInCurrentLevel(totalXp);
  const unlockedAchievements = getRecentUnlockedAchievements(achievements);
  const upcomingAchievements = getNextAchievements(achievements);

  const navigate = useCallback(
    (href: Href) => {
      close();
      router.push(href);
    },
    [close],
  );

  async function handleLogout() {
    setLogoutError(null);
    setIsLoggingOut(true);

    try {
      close();
      await signOut();
    } catch (err) {
      setLogoutError(getAuthErrorMessage(err));
    } finally {
      setIsLoggingOut(false);
    }
  }

  useEffect(() => {
    if (!isOpen) {
      setLogoutError(null);
    }
  }, [isOpen]);

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.overlay}>
        <View
          style={StyleSheet.flatten([
            styles.panel,
            {
              width: sidebarWidth,
              backgroundColor: theme.background,
              paddingTop: insets.top + Spacing.three,
              paddingBottom: insets.bottom + Spacing.three,
            },
          ])}>
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            bounces={false}>
            <View style={styles.header}>
              <View style={styles.profileRow}>
                <ProfileAvatar
                  uri={profile?.avatar_url}
                  name={displayName}
                  size={48}
                  shopAvatar={equippedAvatar}
                  frame={equippedFrame}
                />

                <View style={styles.greetingBlock}>
                  <Text style={StyleSheet.flatten([styles.hello, { color: theme.text }])}>Hello,</Text>
                  <Text style={StyleSheet.flatten([styles.displayName, { color: theme.textSecondary }])}>
                    {displayName}
                  </Text>
                  <CoinBadge amount={summary.coinBalance} />
                  <BetaBadge showVersion />
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close menu"
                onPress={close}
                style={StyleSheet.flatten([styles.closeButton, { borderColor: theme.border }])}>
                <AppIcon name="close" size={16} color={theme.textSecondary} />
              </Pressable>
            </View>

            <View
              style={StyleSheet.flatten([
                styles.divider,
                { backgroundColor: theme.border },
              ])}
            />

            <XPProgressBar
              level={xpProgress.level}
              currentXp={xpProgress.currentLevelXp}
              targetXp={xpProgress.xpToNextLevel}
            />

            <AchievementBadges
              unlocked={unlockedAchievements}
              upcoming={upcomingAchievements}
              onViewAll={() => navigate('/profile/achievements')}
            />

            <DailyMotivationCard />

            <View style={styles.navList}>
              {NAV_ITEMS.map((item) => (
                <Pressable
                  key={item.label}
                  onPress={() => navigate(item.href)}
                  style={StyleSheet.flatten([
                    styles.navItem,
                    { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                  ])}>
                  <AppIcon name={item.icon} size={20} color={theme.text} />
                  <Text style={StyleSheet.flatten([styles.navLabel, { color: theme.text }])}>{item.label}</Text>
                </Pressable>
              ))}
            </View>

            {logoutError ? (
              <Text style={StyleSheet.flatten([styles.logoutError, { color: theme.danger }])}>
                {logoutError}
              </Text>
            ) : null}

            <Pressable
              disabled={isLoggingOut}
              onPress={() => void handleLogout()}
              style={StyleSheet.flatten([
                styles.logoutButton,
                { borderColor: theme.border, opacity: isLoggingOut ? 0.6 : 1 },
              ])}>
              <AppIcon name="logout" size={20} color={theme.danger} />
              <Text style={StyleSheet.flatten([styles.logoutLabel, { color: theme.danger }])}>
                {isLoggingOut ? 'Logging out…' : 'Log out'}
              </Text>
            </Pressable>
          </ScrollView>
        </View>

        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close menu" />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  panel: {
    height: '100%',
    borderTopRightRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
    overflow: 'hidden',
  },
  content: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  profileRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  greetingBlock: {
    flex: 1,
    gap: Spacing.one,
  },
  hello: {
    fontSize: 22,
    fontWeight: '800',
  },
  displayName: {
    fontSize: 15,
    fontWeight: '600',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
  },
  navList: {
    gap: Spacing.two,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  navLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    marginTop: Spacing.two,
    borderTopWidth: 1,
    paddingTop: Spacing.four,
  },
  logoutLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  logoutError: {
    fontSize: 13,
    fontWeight: '600',
  },
});
