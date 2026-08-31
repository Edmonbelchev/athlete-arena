import { StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface UserTitleBadgeProps {
  title: string | null | undefined;
  compact?: boolean;
}

export function UserTitleBadge({ title, compact = false }: UserTitleBadgeProps) {
  const theme = useTheme();

  if (!title) {
    return null;
  }

  return (
    <View
      style={StyleSheet.flatten([
        styles.badge,
        compact ? styles.badgeCompact : null,
        { backgroundColor: theme.backgroundSelected, borderColor: theme.primary },
      ])}>
      <Text
        style={StyleSheet.flatten([
          compact ? styles.textCompact : styles.text,
          { color: theme.primary },
        ])}
        numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    maxWidth: '100%',
  },
  badgeCompact: {
    paddingHorizontal: Spacing.one,
    paddingVertical: 2,
  },
  text: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  textCompact: {
    fontSize: 11,
    fontWeight: '700',
  },
});
