import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface DeleteAccountModalProps {
  visible: boolean;
  isDeleting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export function DeleteAccountModal({
  visible,
  isDeleting,
  error,
  onClose,
  onConfirm,
}: DeleteAccountModalProps) {
  const theme = useTheme();
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!visible) {
      setReason('');
    }
  }, [visible]);

  function handleClose() {
    if (isDeleting) {
      return;
    }

    setReason('');
    onClose();
  }

  function handleConfirm() {
    onConfirm(reason.trim());
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View
          style={StyleSheet.flatten([
            styles.card,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ])}>
          <Text style={[styles.title, { color: theme.text }]}>Delete account?</Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>
            This permanently removes your profile, progress, friends, and challenge history. This
            cannot be undone.
          </Text>

          <Text style={[styles.label, { color: theme.textSecondary }]}>
            Reason for leaving (optional)
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Tell us why you're leaving..."
            placeholderTextColor={theme.textSecondary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            editable={!isDeleting}
            style={StyleSheet.flatten([
              styles.input,
              {
                color: theme.text,
                backgroundColor: theme.background,
                borderColor: theme.border,
              },
            ])}
          />

          {error ? (
            <Text style={[styles.error, { color: theme.danger }]}>{error}</Text>
          ) : null}

          <View style={styles.actions}>
            <PrimaryButton
              label="Cancel"
              variant="secondary"
              disabled={isDeleting}
              onPress={handleClose}
              style={styles.actionButton}
            />
            <PrimaryButton
              label="Delete"
              variant="danger"
              loading={isDeleting}
              onPress={handleConfirm}
              style={styles.actionButton}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 112,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 15,
    lineHeight: 22,
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionButton: {
    flex: 1,
  },
});
