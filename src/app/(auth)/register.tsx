import { Link } from 'expo-router';
import { useState } from 'react';
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

import { AuthTextInput } from '@/components/ui/AuthTextInput';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { LegalAgreementNotice } from '@/components/legal/LegalLinks';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { SUPPORT_EMAIL } from '@/constants/app';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { getAuthErrorMessage } from '@/features/auth/authErrors';
import {
  EmailAlreadyRegisteredError,
  signUpWithEmail,
  UsernameTakenError,
} from '@/features/auth/authService';
import {
  isValidEmail,
  isValidPassword,
  isValidUsername,
  normalizeUsername,
} from '@/features/auth/validation';
import { useAuth } from '@/features/auth';
import { useTheme } from '@/hooks/use-theme';

export default function RegisterScreen() {
  const theme = useTheme();
  const { isConfigured } = useAuth();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateForm(): boolean {
    const nextErrors: {
      username?: string;
      email?: string;
      password?: string;
      confirmPassword?: string;
    } = {};
    const normalizedUsername = normalizeUsername(username);

    if (!normalizedUsername) {
      nextErrors.username = 'Username is required';
    } else if (!isValidUsername(normalizedUsername)) {
      nextErrors.username = 'Use 3–30 characters: lowercase letters, numbers, underscore';
    }

    if (!email.trim()) {
      nextErrors.email = 'Email is required';
    } else if (!isValidEmail(email)) {
      nextErrors.email = 'Enter a valid email address';
    }

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

  async function handleRegister() {
    setFormError(null);
    setSuccessMessage(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const { session } = await signUpWithEmail({
        email,
        password,
        username,
      });

      if (session) {
        return;
      }

      setSuccessMessage(
        `Account created. Check your inbox for a confirmation email from ${SUPPORT_EMAIL}, then sign in.`,
      );
    } catch (error) {
      if (error instanceof UsernameTakenError) {
        setFieldErrors((current) => ({
          ...current,
          username: getAuthErrorMessage(error),
        }));
        return;
      }

      if (error instanceof EmailAlreadyRegisteredError) {
        setFieldErrors((current) => ({
          ...current,
          email: getAuthErrorMessage(error),
        }));
        return;
      }

      setFormError(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
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
            <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>Create account</Text>
            <Text style={StyleSheet.flatten([styles.subtitle, { color: theme.textSecondary }])}>
              Join the daily challenge and start earning XP.
            </Text>

            <AuthTextInput
              label="Username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoComplete="username"
              error={fieldErrors.username}
            />

            <AuthTextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              error={fieldErrors.email}
            />

            <AuthTextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="newPassword"
              autoComplete="new-password"
              error={fieldErrors.password}
            />

            <AuthTextInput
              label="Confirm Password"
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

            {successMessage ? (
              <Text style={StyleSheet.flatten([styles.successMessage, { color: theme.success }])}>
                {successMessage}
              </Text>
            ) : null}

            <PrimaryButton
              label="Create Account"
              disabled={!isConfigured}
              loading={isSubmitting}
              onPress={() => void handleRegister()}
            />

            <LegalAgreementNotice />

            <Link href="/(auth)/login" asChild>
              <Pressable style={styles.linkPressable}>
                <Text style={StyleSheet.flatten([styles.link, { color: theme.primary }])}>
                  Already have an account? Sign in
                </Text>
              </Pressable>
            </Link>
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
  successMessage: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  linkPressable: {
    alignSelf: 'center',
    marginTop: Spacing.two,
  },
  link: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
  },
});
