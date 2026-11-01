import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { REPORT_REASONS } from '@/services/safetyService';
import type { UserReportReason } from '@/types/database';

interface ReportUserModalProps {
  visible: boolean;
  username: string;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (report: { reason: UserReportReason; details: string; alsoBlock: boolean }) => void;
}

/** Report a user for review, optionally blocking them at the same time. */
export function ReportUserModal({ visible, username, isSubmitting, error, onClose, onSubmit }: ReportUserModalProps) {
  const theme = useTheme();
  const [reason, setReason] = useState<UserReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(true);

  useEffect(() => {
    if (!visible) {
      setReason(null);
      setDetails('');
      setAlsoBlock(true);
    }
  }, [visible]);

  function handleClose() {
    if (!isSubmitting) {
      onClose();
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={handleClose} accessibilityLabel="Close" />
        <View style={StyleSheet.flatten([styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }])}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={[styles.title, { color: theme.text }]}>Report @{username}</Text>
            <Text style={[styles.body, { color: theme.textSecondary }]}>
              Reports are confidential - @{username} won&apos;t know you reported them. We review every
              report within 24 hours.
            </Text>

            <Text style={[styles.label, { color: theme.textSecondary }]}>What&apos;s wrong?</Text>
            <View style={styles.reasons}>
              {REPORT_REASONS.map((option) => {
                const selected = reason === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => setReason(option.value)}
                    style={StyleSheet.flatten([
                      styles.reason,
                      {
                        borderColor: selected ? theme.primary : theme.border,
                        backgroundColor: selected ? `${theme.primary}1A` : theme.background,
                      },
                    ])}>
                    <View style={[styles.radio, { borderColor: selected ? theme.primary : theme.textSecondary }]}>
                      {selected ? <View style={[styles.radioDot, { backgroundColor: theme.primary }]} /> : null}
                    </View>
                    <Text style={[styles.reasonText, { color: theme.text }]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.label, { color: theme.textSecondary }]}>Details (optional)</Text>
            <TextInput
              value={details}
              onChangeText={setDetails}
              placeholder="Anything that helps us review this..."
              placeholderTextColor={theme.textSecondary}
              multiline
              maxLength={1000}
              textAlignVertical="top"
              editable={!isSubmitting}
              style={StyleSheet.flatten([
                styles.input,
                { color: theme.text, backgroundColor: theme.background, borderColor: theme.border },
              ])}
            />

            <View style={styles.blockRow}>
              <View style={styles.blockCopy}>
                <Text style={[styles.blockTitle, { color: theme.text }]}>Also block @{username}</Text>
                <Text style={[styles.blockHint, { color: theme.textSecondary }]}>
                  You won&apos;t see each other on leaderboards, in search, or in challenges.
                </Text>
              </View>
              <Switch value={alsoBlock} onValueChange={setAlsoBlock} disabled={isSubmitting} />
            </View>

            {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

            <View style={styles.actions}>
              <PrimaryButton label="Cancel" variant="secondary" disabled={isSubmitting} onPress={handleClose} style={styles.action} />
              <PrimaryButton
                label="Report"
                variant="danger"
                loading={isSubmitting}
                disabled={!reason}
                onPress={() => reason && onSubmit({ reason, details, alsoBlock })}
                style={styles.action}
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: Spacing.four },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15, 23, 42, 0.55)' },
  card: { borderWidth: 1, borderRadius: Radius.xl, maxHeight: '90%', overflow: 'hidden' },
  content: { padding: Spacing.four, gap: Spacing.three },
  title: { fontSize: 22, fontWeight: '800' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '500' },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  reasons: { gap: Spacing.two },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  reasonText: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  input: { minHeight: 80, borderWidth: 1, borderRadius: Radius.md, padding: Spacing.three, fontSize: 15 },
  blockRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  blockCopy: { flex: 1, gap: 2 },
  blockTitle: { fontSize: 15, fontWeight: '700' },
  blockHint: { fontSize: 13, lineHeight: 18 },
  error: { fontSize: 14, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: Spacing.two },
  action: { flex: 1 },
});
