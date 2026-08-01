import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { Radius, Spacing } from '@/constants/theme';
import type { ThemePreference } from '@/features/theme/ThemePreferenceProvider';
import { useTheme } from '@/hooks/use-theme';

interface ThemeToggleProps {
  preference: ThemePreference;
  onChange: (preference: ThemePreference) => void;
}

export function ThemeToggle({ preference, onChange }: ThemeToggleProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Text style={StyleSheet.flatten([styles.label, { color: theme.textSecondary }])}>Theme</Text>
      <View style={StyleSheet.flatten([styles.track, { backgroundColor: theme.backgroundSelected }])}>
        <ToggleOption
          label="Light"
          icon="sun"
          active={preference === 'light'}
          onPress={() => onChange('light')}
        />
        <ToggleOption
          label="Dark"
          icon="moon"
          active={preference === 'dark'}
          onPress={() => onChange('dark')}
        />
      </View>
    </View>
  );
}

function ToggleOption({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: 'sun' | 'moon';
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={StyleSheet.flatten([
        styles.option,
        active && { backgroundColor: theme.backgroundElement },
      ])}>
      <AppIcon name={icon} size={16} color={theme.text} />
      <Text style={StyleSheet.flatten([styles.optionLabel, { color: theme.text }])}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  track: {
    flexDirection: 'row',
    borderRadius: Radius.lg,
    padding: Spacing.one,
    gap: Spacing.one,
  },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderRadius: Radius.md,
    paddingVertical: Spacing.two,
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
});
