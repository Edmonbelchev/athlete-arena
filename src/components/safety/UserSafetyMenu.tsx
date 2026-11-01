import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface UserSafetyMenuProps {
  visible: boolean;
  username: string;
  onReport: () => void;
  onBlock: () => void;
  onClose: () => void;
}

/** Action sheet with the safety options for another user's profile. */
export function UserSafetyMenu({ visible, username, onReport, onBlock, onClose }: UserSafetyMenuProps) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={StyleSheet.flatten([styles.sheet, { backgroundColor: theme.backgroundElement, borderColor: theme.border }])}>
          <Text style={[styles.title, { color: theme.textSecondary }]}>@{username}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onReport}
            style={({ pressed }) => [styles.row, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}>
            <AppIcon name="flag" size={18} color={theme.danger} />
            <Text style={[styles.rowText, { color: theme.danger }]}>Report</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onBlock}
            style={({ pressed }) => [styles.row, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}>
            <AppIcon name="block" size={18} color={theme.danger} />
            <Text style={[styles.rowText, { color: theme.danger }]}>Block</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.row, styles.cancel, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}>
            <Text style={[styles.rowText, { color: theme.text }]}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', padding: Spacing.three },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15, 23, 42, 0.55)' },
  sheet: { borderWidth: 1, borderRadius: Radius.xl, paddingVertical: Spacing.two, overflow: 'hidden' },
  title: { fontSize: 13, fontWeight: '700', textAlign: 'center', paddingVertical: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cancel: { marginTop: Spacing.one },
  rowText: { fontSize: 17, fontWeight: '700' },
});
