import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface OnboardingShellProps {
  stepIndex: number;
  stepCount: number;
  onSkip: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}

export function OnboardingShell({
  stepIndex,
  stepCount,
  onSkip,
  children,
  footer,
}: OnboardingShellProps) {
  const theme = useTheme();

  return (
    <View style={StyleSheet.flatten([styles.container, { backgroundColor: theme.background }])}>
      <View style={styles.topBar}>
        <View style={styles.dots}>
          {Array.from({ length: stepCount }, (_, index) => (
            <View
              key={index}
              style={StyleSheet.flatten([
                styles.dot,
                {
                  backgroundColor: index === stepIndex ? theme.primary : theme.backgroundSelected,
                  width: index === stepIndex ? 18 : 8,
                },
              ])}
            />
          ))}
        </View>

        <Pressable accessibilityRole="button" onPress={onSkip} hitSlop={8}>
          <Text style={StyleSheet.flatten([styles.skip, { color: theme.textSecondary }])}>Skip</Text>
        </Pressable>
      </View>

      <View style={styles.body}>{children}</View>
      <View style={styles.footer}>{footer}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  skip: {
    fontSize: 14,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    paddingHorizontal: Spacing.four,
  },
  footer: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
});
