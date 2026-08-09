import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthTextInput } from '@/components/ui/AuthTextInput';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { getAuthErrorMessage } from '@/features/auth/authErrors';
import { updatePassword } from '@/features/auth/authService';
import { isValidPassword } from '@/features/auth/validation';
import { useAuth } from '@/features/auth';
import { useTheme } from '@/hooks/use-theme';

export default function ResetPasswordScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session, isLoading, isConfigured } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>(
    {},
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && !session) {
      router.replace('/(auth)/forgot-password');
    }
  }, [isLoading, router, session]);

  function validateForm(): boolean {
    const nextErrors: { password?: string; confirmPassword?: string } = {};

    if (!password) {
      nextErrors.password = 'Password is required';
    } else if (!isValidPassword(password)) {
      nextErrors.password = 'Password must be at least 8 characters';
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = 'Confirm your password';
    } else if (password !== confirmPassword) {
      nextErrors.confirmPassword = 'Passwords do not match';
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit() {
    setFormError(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await updatePassword(password);
      router.replace('/(tabs)');
    } catch (error) {
      setFormError(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading || !session) {
    return null;
  }

  return (
    <SafeAreaView style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <View style={styles.container}>
            <BrandLogo size={88} style={styles.logo} />
            <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>
              Choose a new password
            </Text>
            <Text style={StyleSheet.flatten([styles.subtitle, { color: theme.textSecondary }])}>
              Enter a new password for your account.
            </Text>

            <AuthTextInput
              label="New password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="newPassword"
              autoComplete="new-password"
              error={fieldErrors.password}
            />

            <AuthTextInput
              label="Confirm password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              textContentType="newPassword"
              autoComplete="new-password"
              error={fieldErrors.confirmPassword}
            />

            {formError ? (
              <Text style={StyleSheet.flatten([styles.formError, { color: theme.danger }])}>
                {formError}
              </Text>
            ) : null}

            <PrimaryButton
              label="Update password"
              disabled={!isConfigured}
              loading={isSubmitting}
              onPress={() => void handleSubmit()}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  container: {
    padding: Spacing.four,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  logo: {
    marginBottom: Spacing.one,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: Spacing.two,
  },
  formError: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
