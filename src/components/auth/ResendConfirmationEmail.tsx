import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Spacing } from '@/constants/theme';
import { getAuthErrorMessage } from '@/features/auth/authErrors';
import { resendSignUpConfirmation } from '@/features/auth/authService';
import { isValidEmail } from '@/features/auth/validation';
import { useTheme } from '@/hooks/use-theme';

interface ResendConfirmationEmailProps {
  email: string;
}

export function ResendConfirmationEmail({ email }: ResendConfirmationEmailProps) {
  const theme = useTheme();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const trimmedEmail = email.trim();
  const canResend = isValidEmail(trimmedEmail) && status !== 'loading';

  async function handleResend() {
    if (!canResend) {
      return;
    }

    setStatus('loading');
    setMessage(null);

    try {
      await resendSignUpConfirmation(trimmedEmail);
      setStatus('success');
      setMessage('Confirmation email sent. Check your inbox.');
    } catch (error) {
      setStatus('error');
      setMessage(getAuthErrorMessage(error));
    }
  }

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => void handleResend()}
        disabled={!canResend}
        style={({ pressed }) => [
          styles.button,
          pressed && canResend ? styles.buttonPressed : null,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Resend confirmation email">
        {status === 'loading' ? (
          <ActivityIndicator size="small" color={theme.primary} />
        ) : (
          <Text style={StyleSheet.flatten([styles.buttonText, { color: theme.primary }])}>
            Resend confirmation email
          </Text>
        )}
      </Pressable>

      {message ? (
        <Text
          style={StyleSheet.flatten([
            styles.message,
            { color: status === 'success' ? theme.success : theme.danger },
          ])}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
    alignItems: 'center',
  },
  button: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
});
