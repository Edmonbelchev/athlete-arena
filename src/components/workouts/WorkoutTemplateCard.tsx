import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import {
  formatWorkoutTimeLimit,
  getCustomWorkoutTypeDefinition,
} from '@/constants/customWorkouts';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CustomWorkoutTemplateSummary } from '@/types/customWorkouts';
import { getWorkoutSharerDisplayName } from '@/types/customWorkouts';

interface WorkoutTemplateCardProps {
  template: CustomWorkoutTemplateSummary;
  loading?: boolean;
  removing?: boolean;
  locked?: boolean;
  onStart: () => void;
  onEdit?: () => void;
  onView?: () => void;
  onRemove?: () => void;
  onDelete?: () => void;
}

function formatListDate(isoDate: string | null): string | null {
  if (!isoDate) {
    return null;
  }

  const timestamp = new Date(isoDate).getTime();
  if (Number.isNaN(timestamp)) {
    return null;
  }

  const diffDays = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) {
    return 'Today';
  }

  if (diffDays === 1) {
    return 'Yesterday';
  }

  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  if (diffDays < 30) {
    return `${Math.floor(diffDays / 7)}w ago`;
  }

  return new Date(isoDate).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function WorkoutTemplateCard({
  template,
  loading = false,
  removing = false,
  locked = false,
  onStart,
  onEdit,
  onView,
  onRemove,
  onDelete,
}: WorkoutTemplateCardProps) {
  const theme = useTheme();
  const typeDefinition = getCustomWorkoutTypeDefinition(template.workoutType);
  const isShared = !template.isOwner;
  const sharerName = isShared ? getWorkoutSharerDisplayName(template) : null;
  const listDate = formatListDate(isShared ? template.sharedAt : template.createdAt);
  const isBusy = loading || removing;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.backgroundElement,
          borderColor: theme.border,
          opacity: locked ? 0.82 : 1,
        },
      ]}>
      <View style={styles.headerRow}>
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: locked ? `${theme.streak}18` : `${theme.primary}18` },
          ]}>
          {locked ? (
            <AppIcon name="crown" size={20} color={theme.streak} weight="semibold" />
          ) : (
            <AppIcon name="dumbbell" size={20} color={theme.primary} weight="semibold" />
          )}
        </View>

        <View style={styles.copy}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
              {template.title}
            </Text>
            <View style={[styles.typePill, { backgroundColor: theme.backgroundSelected }]}>
              <Text style={[styles.typePillText, { color: theme.textSecondary }]}>
                {typeDefinition.shortLabel}
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <MetaChip
              label={
                template.workoutType === 'for_time'
                  ? typeDefinition.shortLabel
                  : formatWorkoutTimeLimit(template.timeLimitSeconds)
              }
              themeText={theme.textSecondary}
            />
            <MetaChip
              label={`${template.exerciseCount} exercise${template.exerciseCount === 1 ? '' : 's'}`}
              themeText={theme.textSecondary}
            />
            {listDate ? <MetaChip label={listDate} themeText={theme.textSecondary} /> : null}
          </View>

          {isShared ? (
            <View style={[styles.sharedBadge, { backgroundColor: `${theme.primary}14` }]}>
              <AppIcon name="friends" size={13} color={theme.primary} weight="semibold" />
              <Text style={[styles.sharedBadgeText, { color: theme.primary }]} numberOfLines={1}>
                From {sharerName}
              </Text>
            </View>
          ) : (
            <Text style={[styles.ownerLabel, { color: theme.textSecondary }]}>
              {locked ? 'Premium required to start' : 'Your template'}
            </Text>
          )}
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      <View style={styles.actions}>
        <PrimaryButton
          label={locked ? 'Upgrade to start' : 'Start'}
          onPress={onStart}
          loading={loading}
          disabled={isBusy && !loading}
        />

        {isShared ? (
          <>
            <PrimaryButton
              label="View"
              variant="secondary"
              onPress={onView ?? onStart}
              disabled={isBusy}
            />
            {onRemove ? (
              <Pressable
                accessibilityRole="button"
                onPress={onRemove}
                disabled={isBusy}
                style={[styles.textActionButton, { borderColor: theme.border }]}>
                <Text style={[styles.deleteLabel, { color: theme.danger }]}>
                  {removing ? 'Removing...' : 'Remove from list'}
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <>
            {onEdit ? (
              <PrimaryButton label="Edit / share" variant="secondary" onPress={onEdit} disabled={isBusy} />
            ) : null}
            {onDelete ? (
              <Pressable
                accessibilityRole="button"
                onPress={onDelete}
                disabled={isBusy}
                style={[styles.textActionButton, { borderColor: theme.border }]}>
                <Text style={[styles.deleteLabel, { color: theme.danger }]}>
                  {removing ? 'Deleting...' : 'Delete workout'}
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

function MetaChip({ label, themeText }: { label: string; themeText: string }) {
  return (
    <View style={styles.metaChip}>
      <Text style={[styles.metaChipText, { color: themeText }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
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
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
  },
  typePill: {
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
  },
  typePillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  metaChip: {
    paddingVertical: 2,
  },
  metaChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sharedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.one,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    maxWidth: '100%',
  },
  sharedBadgeText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  ownerLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  actions: {
    gap: Spacing.two,
  },
  textActionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    minHeight: 48,
  },
  deleteLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
});
