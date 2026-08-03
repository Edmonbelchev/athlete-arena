import { Stack, useRouter } from 'expo-router';
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
import { AppIcon } from '@/components/ui/AppIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { formatUserError } from '@/lib/errors';
import { leaveScreen } from '@/lib/navigation';
import { createSupportTicket } from '@/services/supportService';
import {
  SUPPORT_TICKET_CATEGORY_LABELS,
  type SupportTicketCategory,
} from '@/types/support';
import { useTheme } from '@/hooks/use-theme';

const TICKET_CATEGORIES: SupportTicketCategory[] = ['bug_report', 'feedback'];

export default function CreateSupportTicketScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [category, setCategory] = useState<SupportTicketCategory>('bug_report');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);

    try {
      await createSupportTicket(category, subject, message);
      leaveScreen(router);
    } catch (err) {
      setError(formatUserError(err, 'Failed to submit support ticket'));
    } finally {
      setIsSubmitting(false);
    }
  }

  const canSubmit = subject.trim().length >= 3 && message.trim().length >= 10;

  return (
    <>
      <Stack.Screen
        options={{
          title: 'New Ticket',
          headerShown: true,
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
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
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={StyleSheet.flatten([styles.subtitle, { color: theme.textSecondary }])}>
              Tell us what happened or share your ideas. User reporting is not available during beta.
            </Text>

            <Text style={StyleSheet.flatten([styles.label, { color: theme.textSecondary }])}>CATEGORY</Text>
            <View style={styles.categoryRow}>
              {TICKET_CATEGORIES.map((option) => {
                const selected = category === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setCategory(option)}
                    style={StyleSheet.flatten([
                      styles.categoryChip,
                      {
                        backgroundColor: selected ? theme.primary : theme.backgroundElement,
                        borderColor: selected ? theme.primary : theme.border,
                      },
                    ])}>
                    <Text
                      style={StyleSheet.flatten([
                        styles.categoryLabel,
                        { color: selected ? '#FFFFFF' : theme.text },
                      ])}>
                      {SUPPORT_TICKET_CATEGORY_LABELS[option]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <AuthTextInput
              label="Subject"
              value={subject}
              onChangeText={setSubject}
              placeholder="Short summary"
              maxLength={120}
            />

            <AuthTextInput
              label="Message"
              value={message}
              onChangeText={setMessage}
              placeholder="Describe the bug or share your feedback..."
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              style={styles.messageInput}
            />

            {error ? (
              <Text style={StyleSheet.flatten([styles.error, { color: theme.danger }])}>{error}</Text>
            ) : null}

            <PrimaryButton
              label="Submit Ticket"
              loading={isSubmitting}
              disabled={!canSubmit}
              onPress={() => void handleSubmit()}
            />
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
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  categoryChip: {
    flexGrow: 1,
    flexBasis: '45%',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  messageInput: {
    minHeight: 140,
    paddingTop: Spacing.two,
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerBack: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
});
