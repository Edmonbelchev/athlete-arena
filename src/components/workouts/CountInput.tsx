import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface CountInputProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Shown after the number, e.g. "s" for hold seconds. */
  suffix?: string;
  disabled?: boolean;
  accessibilityLabel: string;
}

/**
 * Number field that sits between a stepper's - and + buttons, for typing large counts directly.
 * The typed value is applied (clamped to min..max) when editing ends; an empty field restores it.
 */
export function CountInput({ value, min, max, onChange, suffix, disabled, accessibilityLabel }: CountInputProps) {
  const theme = useTheme();
  const [draft, setDraft] = useState(String(value));

  // Follow changes from the - / + buttons and presets.
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function commit() {
    const parsed = Number.parseInt(draft, 10);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    const next = Math.min(max, Math.max(min, parsed));
    setDraft(String(next));
    if (next !== value) {
      onChange(next);
    }
  }

  return (
    <View style={StyleSheet.flatten([styles.field, { backgroundColor: theme.backgroundSelected, borderColor: theme.border }])}>
      <TextInput
        value={draft}
        onChangeText={(text) => setDraft(text.replace(/[^0-9]/g, ''))}
        onBlur={commit}
        onSubmitEditing={commit}
        editable={!disabled}
        keyboardType="number-pad"
        returnKeyType="done"
        selectTextOnFocus
        maxLength={String(max).length}
        accessibilityLabel={accessibilityLabel}
        style={StyleSheet.flatten([styles.input, { color: theme.text }])}
      />
      {suffix ? <Text style={StyleSheet.flatten([styles.suffix, { color: theme.textSecondary }])}>{suffix}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    // Fixed width: a TextInput otherwise grows to fill the row and pushes the + button out.
    width: 84,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  input: {
    flexShrink: 1,
    minWidth: 0,
    padding: 0,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '900',
  },
  suffix: {
    fontSize: 14,
    fontWeight: '800',
  },
});
