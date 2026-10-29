import {
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
  ActivityIndicator,
} from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface PrimaryButtonProps extends PressableProps {
  label: string;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  /** Smaller button for overlays (e.g. landscape workout controls). */
  size?: 'default' | 'compact';
}

export function PrimaryButton({
  label,
  loading = false,
  variant = 'primary',
  size = 'default',
  disabled,
  style,
  ...props
}: PrimaryButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const backgroundColor =
    variant === 'primary'
      ? theme.primary
      : variant === 'danger'
        ? theme.danger
        : theme.backgroundSelected;

  const textColor = variant === 'secondary' ? theme.text : '#FFFFFF';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={(state: PressableStateCallbackType): StyleProp<ViewStyle> => [
        styles.button,
        size === 'compact' ? styles.buttonCompact : null,
        { backgroundColor, opacity: isDisabled ? 0.5 : state.pressed ? 0.85 : 1 },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...props}>
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.label, size === 'compact' ? styles.labelCompact : null, { color: textColor }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  buttonCompact: {
    minHeight: 38,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
  },
  labelCompact: {
    fontSize: 15,
  },
});
