import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotificationBellButton } from '@/components/notifications/NotificationBellButton';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { SidebarToggleButton } from '@/components/sidebar/SidebarToggleButton';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useProfile } from '@/features/profile/useProfile';
import { useShop } from '@/features/shop/ShopProvider';
import { useTheme } from '@/hooks/use-theme';

export function AppTopBar() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const { equippedAvatar, equippedFrame } = useShop();

  const displayName = profile?.display_name ?? profile?.username ?? 'Athlete';

  return (
    <View
      style={StyleSheet.flatten([
        styles.container,
        {
          backgroundColor: theme.background,
          borderBottomColor: theme.border,
          paddingTop: insets.top + Spacing.two,
        },
      ])}>
      <View style={styles.inner}>
        <SidebarToggleButton />

        <View style={styles.trailing}>
          <NotificationBellButton />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            onPress={() => router.push('/(tabs)/profile')}
            style={styles.avatarButton}>
            <ProfileAvatar
              uri={profile?.avatar_url}
              name={displayName}
              size={40}
              shopAvatar={equippedAvatar}
              frame={equippedFrame}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  avatarButton: {
    borderRadius: 20,
  },
});
