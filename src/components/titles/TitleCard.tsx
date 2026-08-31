import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { AppIcon } from '@/components/ui/AppIcon';
import { formatTitleRequirement } from '@/features/titles/titleUtils';
import { Radius, Spacing } from '@/constants/theme';
import type { TitleRecord } from '@/types/titles';
import { useTheme } from '@/hooks/use-theme';

interface TitleCardProps {
  title: TitleRecord;
  onEquip?: () => void;
  onUnequip?: () => void;
  isUpdating?: boolean;
}

function formatUnlockedDate(unlockedAt: string): string {
  return new Date(unlockedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function TitleCard({ title, onEquip, onUnequip, isUpdating = false }: TitleCardProps) {
  const theme = useTheme();
  const locked = !title.unlocked;

  return (
    <View
      style={StyleSheet.flatten([
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: title.equipped ? theme.primary : theme.border,
          opacity: locked ? 0.82 : 1,
        },
      ])}>
      <View style={styles.header}>
        <View
          style={StyleSheet.flatten([
            styles.iconWrap,
            { backgroundColor: theme.backgroundSelected },
          ])}>
          <AppIcon name={locked ? 'star' : 'medal'} size={22} color={theme.primary} />
        </View>

        <View style={styles.copy}>
          <Text style={StyleSheet.flatten([styles.name, { color: theme.text }])}>{title.name}</Text>
          <Text style={StyleSheet.flatten([styles.description, { color: theme.textSecondary }])}>
            {title.description}
          </Text>
        </View>
      </View>

      <Text style={StyleSheet.flatten([styles.requirement, { color: theme.textSecondary }])}>
        {formatTitleRequirement(title.requirementType, title.requirementMin)}
      </Text>

      {title.unlocked && title.unlockedAt ? (
        <Text style={StyleSheet.flatten([styles.unlockedAt, { color: theme.textSecondary }])}>
          Unlocked {formatUnlockedDate(title.unlockedAt)}
        </Text>
      ) : null}

      {title.unlocked ? (
        title.equipped ? (
          <PrimaryButton
            label="Remove title"
            variant="secondary"
            disabled={isUpdating}
            loading={isUpdating}
            onPress={onUnequip}
          />
        ) : (
          <PrimaryButton
            label="Equip title"
            disabled={isUpdating}
            loading={isUpdating}
            onPress={onEquip}
          />
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'flex-start',
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
    gap: Spacing.half,
  },
  name: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  requirement: {
    fontSize: 13,
    fontWeight: '600',
  },
  unlockedAt: {
    fontSize: 12,
    fontWeight: '600',
  },
});
