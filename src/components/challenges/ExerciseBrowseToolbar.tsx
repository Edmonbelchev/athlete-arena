import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface ExerciseBrowseToolbarProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  totalCount: number;
  visibleCount: number;
  searchPlaceholder?: string;
  variant?: 'card' | 'plain';
}

export function ExerciseBrowseToolbar({
  searchQuery,
  onSearchQueryChange,
  totalCount,
  visibleCount,
  searchPlaceholder = 'Search exercises',
  variant = 'plain',
}: ExerciseBrowseToolbarProps) {
  const theme = useTheme();
  const showCount = totalCount > visibleCount;

  const searchInput = (
    <TextInput
      value={searchQuery}
      onChangeText={onSearchQueryChange}
      placeholder={searchPlaceholder}
      placeholderTextColor={theme.textSecondary}
      autoCapitalize="none"
      autoCorrect={false}
      clearButtonMode="while-editing"
      style={[
        styles.searchInput,
        {
          backgroundColor: theme.backgroundSelected,
          borderColor: theme.border,
          color: theme.text,
        },
      ]}
    />
  );

  if (variant === 'plain') {
    return (
      <View style={styles.plainContainer}>
        {searchInput}
        {showCount ? (
          <Text style={[styles.resultsLabel, { color: theme.textSecondary }]}>
            Showing {visibleCount} of {totalCount}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>Browse</Text>
      {searchInput}
      {showCount ? (
        <Text style={[styles.resultsLabel, { color: theme.textSecondary }]}>
          Showing {visibleCount} of {totalCount}
          {totalCount === 1 ? ' exercise' : ' exercises'}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  plainContainer: {
    gap: Spacing.two,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
    fontWeight: '600',
  },
  resultsLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
