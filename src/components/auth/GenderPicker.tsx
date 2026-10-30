import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AvatarBodyType } from '@/types/avatar';

const OPTIONS: { id: AvatarBodyType; label: string }[] = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
];

interface GenderPickerProps {
  value: AvatarBodyType | null;
  onChange: (value: AvatarBodyType) => void;
  error?: string;
}

/** Sign-up choice that sets the starting avatar; it can be changed later in the avatar editor. */
export function GenderPicker({ value, onChange, error }: GenderPickerProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Text style={StyleSheet.flatten([styles.label, { color: theme.textSecondary }])}>Gender</Text>
      <View style={styles.row}>
        {OPTIONS.map((option) => {
          const selected = value === option.id;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
              onPress={() => onChange(option.id)}
              style={({ pressed }) =>
                StyleSheet.flatten([
                  styles.option,
                  {
                    backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement,
                    borderColor: selected ? theme.primary : error ? theme.danger : theme.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ])
              }>
              <Text style={StyleSheet.flatten([styles.optionLabel, { color: selected ? theme.primary : theme.text }])}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={StyleSheet.flatten([styles.error, { color: theme.danger }])}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  option: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: Radius.md,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '800',
  },
  error: {
    fontSize: 13,
    fontWeight: '500',
  },
});
