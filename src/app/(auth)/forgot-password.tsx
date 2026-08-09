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
import { LegalLinksFooter } from '@/components/legal/LegalLinks';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { getAuthErrorMessage } from '@/features/auth/authErrors';
import { requestPasswordReset } from '@/features/auth/authService';
import { isValidEmail } from '@/features/auth/validation';
import { useAuth } from '@/features/auth';
import { useTheme } from '@/hooks/use-theme';

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const { isConfigured } = useAuth();

  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateForm(): boolean {
    if (!email.trim()) {
      setFieldError('Email is required');
      return false;
    }

    if (!isValidEmail(email)) {
      setFieldError('Enter a valid email address');
      return false;
    }

    setFieldError(undefined);
    return true;
  }

  async function handleSubmit() {
    setFormError(null);
    setSuccessMessage(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await requestPasswordReset(email);
      setSuccessMessage(
        'If an account exists for that email, we sent a link to reset your password.',
      );
    } catch (error) {
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
            <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>
              Reset password
            </Text>
            <Text style={StyleSheet.flatten([styles.subtitle, { color: theme.textSecondary }])}>
              Enter your email and we&apos;ll send you a link to choose a new password.
            </Text>

            <AuthTextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              error={fieldError}
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
              label="Send reset link"
              disabled={!isConfigured}
              loading={isSubmitting}
              onPress={() => void handleSubmit()}
            />

            <Link href="/(auth)/login" asChild>
              <Pressable style={styles.linkPressable}>
                <Text style={StyleSheet.flatten([styles.link, { color: theme.primary }])}>
                  Back to sign in
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
