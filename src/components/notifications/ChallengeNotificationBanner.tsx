import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/ui/AppIcon';
import { Spacing } from '@/constants/theme';
import { useNotifications } from '@/features/notifications/NotificationProvider';
import { useTheme } from '@/hooks/use-theme';

const TOP_BAR_HEIGHT = 60;

export function ChallengeNotificationBanner() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { bannerNotification, dismissBanner, openNotification } = useNotifications();

  if (!bannerNotification) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={[styles.overlay, { top: insets.top + TOP_BAR_HEIGHT + Spacing.two }]}>
      <Pressable
        onPress={() => {
          openNotification(bannerNotification);
        }}
        style={StyleSheet.flatten([
          styles.banner,
          { backgroundColor: theme.backgroundElement, borderColor: theme.primary },
        ])}>
        <View style={StyleSheet.flatten([styles.iconWrap, { backgroundColor: theme.backgroundSelected }])}>
          <AppIcon name="bell" size={20} color={theme.primary} />
        </View>

        <View style={styles.copy}>
          <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>
            {bannerNotification.title}
          </Text>
          <Text style={StyleSheet.flatten([styles.message, { color: theme.textSecondary }])}>
            {bannerNotification.message}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
          onPress={dismissBanner}
          hitSlop={8}
          style={StyleSheet.flatten([styles.dismissButton, { borderColor: theme.border }])}>
          <AppIcon name="close" size={14} color={theme.textSecondary} />
        </Pressable>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    zIndex: 1000,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: Spacing.one,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
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
