import { StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import type { AppIconName } from '@/constants/icons';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface ComingSoonBlockProps {
  title: string;
  description: string;
  icon: AppIconName;
  accentColor?: string;
}

export function ComingSoonBlock({ title, description, icon, accentColor }: ComingSoonBlockProps) {
  const theme = useTheme();
  const iconColor = accentColor ?? theme.primary;

  return (
    <View
      style={StyleSheet.flatten([
        styles.card,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ])}>
      <View style={StyleSheet.flatten([styles.iconWrap, { backgroundColor: theme.backgroundSelected }])}>
        <AppIcon name={icon} size={22} color={iconColor} />
      </View>

      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>{title}</Text>
          <View style={StyleSheet.flatten([styles.pill, { backgroundColor: theme.backgroundSelected }])}>
            <Text style={StyleSheet.flatten([styles.pillText, { color: theme.textSecondary }])}>
              Coming soon
            </Text>
          </View>
        </View>
        <Text style={StyleSheet.flatten([styles.description, { color: theme.textSecondary }])}>
          {description}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
    opacity: 0.92,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: Spacing.one,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
  },
  pill: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.sm,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
});
