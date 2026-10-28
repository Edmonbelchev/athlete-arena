import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { Radius, Spacing } from '@/constants/theme';
import type { AvatarColorChoice } from '@/features/avatar/avatarOptions';
import { useTheme } from '@/hooks/use-theme';

const TILE_SIZE = 76;

export function EditorSection({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <Text style={StyleSheet.flatten([styles.sectionTitle, { color: theme.textSecondary }])}>{title}</Text>
      {children}
    </View>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={StyleSheet.flatten([styles.segmented, { backgroundColor: theme.backgroundSelected }])}>
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.id)}
            style={StyleSheet.flatten([
              styles.segment,
              selected ? styles.segmentSelected : null,
              selected ? { backgroundColor: theme.card } : null,
            ])}>
            <Text
              style={StyleSheet.flatten([
                styles.segmentLabel,
                { color: selected ? theme.text : theme.textSecondary },
              ])}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Grid of visual options. Each tile shows `renderPreview(id)`, typically the
 * user's own avatar with that option applied.
 */
export function OptionTiles<T extends string | undefined>({
  options,
  value,
  onChange,
  renderPreview,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  renderPreview: (id: T, size: number) => React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={styles.grid}>
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <Pressable
            key={option.id ?? 'none'}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.id)}
            style={styles.tile}>
            <View
              style={StyleSheet.flatten([
                styles.tilePreview,
                {
                  backgroundColor: theme.backgroundSelected,
                  borderColor: selected ? theme.primary : 'transparent',
                },
              ])}>
              <View style={styles.tileClip}>{renderPreview(option.id, TILE_SIZE - 6)}</View>
              {selected ? (
                <View style={StyleSheet.flatten([styles.badge, { backgroundColor: theme.card }])}>
                  <AppIcon name="checkmark" size={18} color={theme.primary} weight="bold" />
                </View>
              ) : null}
            </View>
            <Text
              numberOfLines={1}
              style={StyleSheet.flatten([
                styles.tileLabel,
                { color: selected ? theme.primary : theme.textSecondary },
              ])}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ColorSwatches({
  colors,
  value,
  onChange,
}: {
  colors: AvatarColorChoice[];
  value: string;
  onChange: (value: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.swatches}>
      {colors.map((color) => {
        const selected = color.id === value;
        return (
          <Pressable
            key={color.id}
            accessibilityRole="button"
            accessibilityLabel={color.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(color.id)}
            style={StyleSheet.flatten([
              styles.swatchRing,
              { borderColor: selected ? theme.primary : 'transparent' },
            ])}>
            <View style={StyleSheet.flatten([styles.swatch, { backgroundColor: color.hex, borderColor: theme.border }])} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: Radius.lg,
    padding: Spacing.one,
    alignSelf: 'stretch',
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radius.md,
  },
  segmentSelected: {
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  segmentLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  tile: {
    width: TILE_SIZE,
    alignItems: 'center',
    gap: Spacing.one,
  },
  tilePreview: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: Radius.lg,
    borderWidth: 3,
  },
  tileClip: {
    flex: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -9,
    right: -9,
    borderRadius: 12,
  },
  tileLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  swatchRing: {
    borderWidth: 3,
    borderRadius: 26,
    padding: 3,
  },
  swatch: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
