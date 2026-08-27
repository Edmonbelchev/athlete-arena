import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface PickerFieldProps {
  label: string;
  value?: string;
  hint?: string;
  placeholder?: string;
  onPress: () => void;
  disabled?: boolean;
}

export function PickerField({
  label,
  value,
  hint,
  placeholder = 'Tap to choose',
  onPress,
  disabled = false,
}: PickerFieldProps) {
  const theme = useTheme();
  const hasValue = Boolean(value);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.field,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.border,
          opacity: disabled ? 0.6 : 1,
        },
      ]}>
      <View style={styles.content}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
        <Text
          style={[
            styles.value,
            { color: hasValue ? theme.text : theme.textSecondary },
          ]}>
          {hasValue ? value : placeholder}
        </Text>
        {hint ? <Text style={[styles.hint, { color: theme.textSecondary }]}>{hint}</Text> : null}
      </View>
      <Text style={[styles.chevron, { color: theme.textSecondary }]}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  content: {
    flex: 1,
    gap: Spacing.half,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  value: {
    fontSize: 16,
    fontWeight: '800',
  },
  hint: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  chevron: {
    fontSize: 24,
    fontWeight: '300',
    lineHeight: 24,
  },
});
