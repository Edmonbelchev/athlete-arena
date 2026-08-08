import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { BetaBadge } from '@/components/ui/BetaBadge';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function EarlyAccessNotice() {
  const theme = useTheme();

  return (
    <View
      style={StyleSheet.flatten([
        styles.card,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ])}>
      <View style={styles.header}>
        <BetaBadge compact />
        <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>Early access</Text>
      </View>
      <Text style={StyleSheet.flatten([styles.description, { color: theme.textSecondary }])}>
        Athlete Arena is still in active development. You may hit rough edges or missing features along the
        way — we would really appreciate any bugs, ideas, or feedback through the support form.
      </Text>
      <PrimaryButton
        label="Send feedback"
        variant="secondary"
        onPress={() => router.push('/profile/support/create')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
});
