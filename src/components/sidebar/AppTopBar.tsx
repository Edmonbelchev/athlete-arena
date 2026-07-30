import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SidebarToggleButton } from '@/components/sidebar/SidebarToggleButton';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useProfile } from '@/features/profile/useProfile';
import { useTheme } from '@/hooks/use-theme';

export function AppTopBar() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();

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

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          onPress={() => router.push('/(tabs)/profile')}
          style={styles.avatarButton}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
          ) : (
            <View style={StyleSheet.flatten([styles.avatarFallback, { backgroundColor: theme.primary }])}>
              <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </Pressable>
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
  avatarButton: {
    borderRadius: 20,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
});
