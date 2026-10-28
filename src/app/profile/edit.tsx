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

import { ProfileAvatar } from '@/components/profile/ProfileAvatar';
import { AuthTextInput } from '@/components/ui/AuthTextInput';
import { AppIcon } from '@/components/ui/AppIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { getProfileErrorMessage } from '@/features/profile/profileErrors';
import { useProfile } from '@/features/profile/useProfile';
import { leaveScreen } from '@/lib/navigation';
import { updateProfile } from '@/services/profileService';
import { PROFILE_BIO_MAX_LENGTH } from '@/types/profile';
import { useTheme } from '@/hooks/use-theme';

export default function EditProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { profile, isLoading, refresh } = useProfile();

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username);
      setDisplayName(profile.display_name ?? '');
      setBio(profile.bio ?? '');
    }
  }, [profile]);

  async function handleSave() {
    if (!profile?.id) {
      return;
    }

    setFormError(null);
    setIsSubmitting(true);

    try {
      await updateProfile(profile.id, {
        username,
        display_name: displayName,
        bio,
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

  const fallbackName = displayName.trim() || username || 'Athlete';

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
            <View style={styles.avatarBlock}>
              <ProfileAvatar uri={profile?.avatar_url} name={fallbackName} size={96} />
              <PrimaryButton
                label="Customize Avatar"
                variant="secondary"
                onPress={() => router.push('/avatar/edit')}
              />
            </View>

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

            <View style={styles.bioField}>
              <AuthTextInput
                label="About Me (optional)"
                value={bio}
                onChangeText={setBio}
                placeholder="Training for my first marathon, love leg day..."
                autoCapitalize="sentences"
                autoCorrect
                multiline
                maxLength={PROFILE_BIO_MAX_LENGTH}
                style={styles.bioInput}
              />
              <Text style={StyleSheet.flatten([styles.bioCounter, { color: theme.textSecondary }])}>
                {bio.length}/{PROFILE_BIO_MAX_LENGTH}
              </Text>
            </View>

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
  bioField: {
    gap: Spacing.one,
  },
  bioInput: {
    minHeight: 88,
    textAlignVertical: 'top',
    paddingTop: Spacing.three,
  },
  bioCounter: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
  },
  avatarBlock: {
    alignItems: 'center',
    gap: Spacing.three,
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
