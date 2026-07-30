import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface HomeSectionProps {
  title: string;
  subtitle?: string;
  badge?: string | number;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}

export function HomeSection({ title, subtitle, badge, actionLabel, onAction, children }: HomeSectionProps) {
  const theme = useTheme();

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>{title}</Text>
          {subtitle ? (
            <Text style={StyleSheet.flatten([styles.subtitle, { color: theme.textSecondary }])}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {badge !== undefined ? (
          <View style={StyleSheet.flatten([styles.badge, { backgroundColor: theme.primary }])}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        ) : null}
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} hitSlop={8}>
            <Text style={StyleSheet.flatten([styles.action, { color: theme.primary }])}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  titleBlock: {
    flex: 1,
    gap: Spacing.half,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  badge: {
    minWidth: 24,
    height: 24,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  action: {
    fontSize: 13,
    fontWeight: '700',
  },
});
