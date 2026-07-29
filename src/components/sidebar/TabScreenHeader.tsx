import { StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface TabScreenHeaderProps {
  title?: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
}

export function TabScreenHeader({ title, subtitle, rightSlot }: TabScreenHeaderProps) {
  const theme = useTheme();

  if (!title && !subtitle && !rightSlot) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.textBlock}>
        {subtitle ? (
          <Text style={StyleSheet.flatten([styles.subtitle, { color: theme.textSecondary }])}>
            {subtitle}
          </Text>
        ) : null}
        {title ? (
          <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>{title}</Text>
        ) : null}
      </View>

      {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  textBlock: {
    flex: 1,
    gap: Spacing.one,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
  },
  rightSlot: {
    alignItems: 'flex-end',
  },
});
