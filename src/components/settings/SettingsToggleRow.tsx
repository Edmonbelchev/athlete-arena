import { StyleSheet, Switch, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface SettingsToggleRowProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

export function SettingsToggleRow({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
}: SettingsToggleRowProps) {
  const theme = useTheme();

  return (
    <View
      style={StyleSheet.flatten([
        styles.row,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ])}>
      <View style={styles.copy}>
        <Text style={StyleSheet.flatten([styles.label, { color: theme.text }])}>{label}</Text>
        {description ? (
          <Text style={StyleSheet.flatten([styles.description, { color: theme.textSecondary }])}>
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: theme.backgroundSelected, true: theme.primary }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  copy: {
    flex: 1,
    gap: Spacing.one,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
  },
});
