import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { Spacing } from '@/constants/theme';

export function ModalCloseButton() {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.back()}
      style={styles.button}
      accessibilityRole="button"
      accessibilityLabel="Close">
      <AppIcon name="close" size={18} weight="semibold" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
    marginRight: Spacing.one,
  },
});
