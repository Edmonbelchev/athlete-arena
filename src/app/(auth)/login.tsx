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
import { ResendConfirmationEmail } from '@/components/auth/ResendConfirmationEmail';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { LegalLinksFooter } from '@/components/legal/LegalLinks';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { getAuthErrorMessage, isEmailNotConfirmedError } from '@/features/auth/authErrors';
import { signInWithEmail } from '@/features/auth/authService';
import { isValidEmail } from '@/features/auth/validation';
import { useAuth } from '@/features/auth';
import { useTheme } from '@/hooks/use-theme';

export default function LoginScreen() {
  const theme = useTheme();
  const { isConfigured } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateForm(): boolean {
    const nextErrors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      nextErrors.email = 'Email is required';
    } else if (!isValidEmail(email)) {
      nextErrors.email = 'Enter a valid email address';
    }

    if (!password) {
      nextErrors.password = 'Password is required';
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSignIn() {
    setFormError(null);
    setNeedsEmailConfirmation(false);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await signInWithEmail(email, password);
    } catch (error) {
      setNeedsEmailConfirmation(isEmailNotConfirmedError(error));
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
            <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>Welcome back</Text>
            <Text style={StyleSheet.flatten([styles.subtitle, { color: theme.textSecondary }])}>
              Sign in to continue your streak and complete today&apos;s challenge.
            </Text>

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
              textContentType="password"
              autoComplete="password"
              error={fieldErrors.password}
            />

            {formError ? (
              <Text style={StyleSheet.flatten([styles.formError, { color: theme.danger }])}>
                {formError}
              </Text>
            ) : null}

            {needsEmailConfirmation ? <ResendConfirmationEmail email={email} /> : null}

            <PrimaryButton
              label="Sign In"
              disabled={!isConfigured}
              loading={isSubmitting}
              onPress={() => void handleSignIn()}
            />

            <Link href="/(auth)/register" asChild>
              <Pressable style={styles.linkPressable}>
                <Text style={StyleSheet.flatten([styles.link, { color: theme.primary }])}>
                  Don&apos;t have an account? Register
                </Text>
              </Pressable>
            </Link>

            <LegalLinksFooter />
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
