import { Pressable, StyleSheet } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { Spacing } from '@/constants/theme';
import { useSidebar } from '@/features/sidebar/SidebarProvider';
import { useTheme } from '@/hooks/use-theme';

interface SidebarToggleButtonProps {
  accessibilityLabel?: string;
}

export function SidebarToggleButton({
  accessibilityLabel = 'Open menu',
}: SidebarToggleButtonProps) {
  const theme = useTheme();
  const { open } = useSidebar();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={open}
      style={StyleSheet.flatten([
        styles.button,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ])}>
      <AppIcon name="menu" size={22} color={theme.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
