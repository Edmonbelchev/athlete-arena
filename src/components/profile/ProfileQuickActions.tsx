import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HomeSection } from '@/components/home/HomeSection';
import { AppIcon } from '@/components/ui/AppIcon';
import type { AppIconName } from '@/constants/icons';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface ProfileAction {
  id: string;
  label: string;
  icon: AppIconName;
  onPress: () => void;
}

interface ProfileQuickActionsProps {
  actions: ProfileAction[];
}

export function ProfileQuickActions({ actions }: ProfileQuickActionsProps) {
  const theme = useTheme();

  return (
    <HomeSection title="Quick Actions" subtitle="Manage your arena profile">
      <View style={styles.grid}>
        {actions.map((action) => (
          <Pressable
            key={action.id}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={action.onPress}
            style={({ pressed }) =>
              StyleSheet.flatten([
                styles.tile,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ])
            }>
            <View
              style={StyleSheet.flatten([
                styles.iconWrap,
                { backgroundColor: theme.backgroundSelected },
              ])}>
              <AppIcon name={action.icon} size={22} color={theme.primary} />
            </View>
            <Text style={StyleSheet.flatten([styles.label, { color: theme.text }])}>{action.label}</Text>
          </Pressable>
        ))}
      </View>
    </HomeSection>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tile: {
    width: '48%',
    flexGrow: 1,
    minWidth: 140,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
    alignItems: 'center',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
