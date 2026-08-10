import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import type { AppIconName } from '@/constants/icons';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface HomeLinkBlockProps {
  title: string;
  description: string;
  icon: AppIconName;
  accentColor?: string;
  badge?: number;
  onPress: () => void;
}

export function HomeLinkBlock({
  title,
  description,
  icon,
  accentColor,
  badge,
  onPress,
}: HomeLinkBlockProps) {
  const theme = useTheme();
  const iconColor = accentColor ?? theme.primary;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
          opacity: pressed ? 0.88 : 1,
        },
      ]}>
      <View style={[styles.iconWrap, { backgroundColor: theme.backgroundSelected }]}>
        <AppIcon name={icon} size={22} color={iconColor} />
      </View>

      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          {badge !== undefined && badge > 0 ? (
            <View style={[styles.badge, { backgroundColor: theme.primary }]}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.description, { color: theme.textSecondary }]}>{description}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
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
    gap: Spacing.two,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  badge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: Spacing.one,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
});
