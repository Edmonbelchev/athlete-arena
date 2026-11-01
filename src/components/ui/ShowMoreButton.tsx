import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import type { PagedList } from '@/hooks/use-paged-list';
import { useTheme } from '@/hooks/use-theme';

/** "Show more (N)" / "Show less" under a paged list; renders nothing when everything fits. */
export function ShowMoreButton({ list }: { list: Pick<PagedList<unknown>, 'hasMore' | 'remainingCount' | 'canCollapse' | 'showMore' | 'collapse'> }) {
  const theme = useTheme();

  if (!list.hasMore && !list.canCollapse) {
    return null;
  }

  const buttonStyle = [styles.button, { backgroundColor: theme.backgroundElement, borderColor: theme.border }];

  return (
    <View style={styles.row}>
      {list.hasMore ? (
        <Pressable
          accessibilityRole="button"
          onPress={list.showMore}
          style={({ pressed }) => [...buttonStyle, styles.grow, { opacity: pressed ? 0.85 : 1 }]}>
          <Text style={[styles.label, { color: theme.primary }]}>Show more ({list.remainingCount})</Text>
        </Pressable>
      ) : null}
      {list.canCollapse ? (
        <Pressable
          accessibilityRole="button"
          onPress={list.collapse}
          style={({ pressed }) => [...buttonStyle, !list.hasMore && styles.grow, { opacity: pressed ? 0.85 : 1 }]}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Show less</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  grow: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
  },
});
