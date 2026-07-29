import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileAvatarUpload } from '@/components/profile/ProfileAvatarUpload';
import { AuthTextInput } from '@/components/ui/AuthTextInput';
import { AppIcon } from '@/components/ui/AppIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth';
import { getProfileErrorMessage } from '@/features/profile/profileErrors';
import { useProfile } from '@/features/profile/useProfile';
import { leaveScreen } from '@/lib/navigation';
import { updateProfile } from '@/services/profileService';
import { useTheme } from '@/hooks/use-theme';

export default function EditProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const { profile, isLoading, refresh } = useProfile();

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username);
      setDisplayName(profile.display_name ?? '');
      setAvatarUrl(profile.avatar_url);
    }
  }, [profile]);

  async function handleSave() {
    if (!session?.user.id) {
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    try {
      await updateProfile(session.user.id, {
        username,
        display_name: displayName,
      });
      await refresh();
      leaveScreen(router);
    } catch (err) {
      setFormError(getProfileErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading && !profile) {
    return (
      <View style={StyleSheet.flatten([styles.loading, { backgroundColor: theme.background }])}>
        <Text style={StyleSheet.flatten([styles.loadingText, { color: theme.textSecondary }])}>
          Loading profile...
        </Text>
      </View>
    );
  }

  const fallbackName = displayName.trim() || username || 'Challenger';

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Edit Profile',
          headerShown: true,
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back to profile"
              onPress={() => leaveScreen(router)}
              style={styles.headerBack}>
              <AppIcon name="chevronBack" size={22} color={theme.text} />
            </Pressable>
          ),
        }}
      />
      <SafeAreaView
        style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}
        edges={['bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled">
            {session?.user.id ? (
              <ProfileAvatarUpload
                userId={session.user.id}
                avatarUrl={avatarUrl}
                displayName={fallbackName}
                onAvatarChange={(nextUrl) => {
                  setAvatarUrl(nextUrl);
                  void refresh();
                }}
              />
            ) : null}

            <Text style={StyleSheet.flatten([styles.subtitle, { color: theme.textSecondary }])}>
              Update how you appear in the app. Usernames must be unique.
            </Text>

            <AuthTextInput
              label="Username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoComplete="username"
            />

            <AuthTextInput
              label="Display Name"
              value={displayName}
              onChangeText={setDisplayName}
              autoComplete="name"
            />

            {formError ? (
              <Text style={StyleSheet.flatten([styles.formError, { color: theme.danger }])}>
                {formError}
              </Text>
            ) : null}

            <PrimaryButton
              label="Save Changes"
              loading={isSubmitting}
              onPress={() => void handleSave()}
            />
            <PrimaryButton label="Cancel" variant="secondary" onPress={() => leaveScreen(router)} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '600',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing.two,
  },
  formError: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerBack: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
});
