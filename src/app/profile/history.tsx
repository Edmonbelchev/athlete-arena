import { Stack, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChallengeHistoryCard } from '@/components/ui/ChallengeHistoryCard';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useChallengeHistory } from '@/features/challenges/useChallengeHistory';
import { useTheme } from '@/hooks/use-theme';

export default function ChallengeHistoryScreen() {
  const theme = useTheme();
  const { entries, isLoading, error, refresh } = useChallengeHistory();

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Challenge History', headerShown: true }} />
      <SafeAreaView
        style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}
        edges={['bottom']}>
        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={StyleSheet.flatten([styles.subtitle, { color: theme.textSecondary }])}>
              Past daily and friend challenges with your results.
            </Text>

            {error ? (
              <View style={styles.errorBlock}>
                <Text style={StyleSheet.flatten([styles.error, { color: theme.danger }])}>{error}</Text>
                <PrimaryButton label="Try Again" variant="secondary" onPress={() => void refresh()} />
              </View>
            ) : null}

            {entries.length === 0 && !error ? (
              <Text style={StyleSheet.flatten([styles.empty, { color: theme.textSecondary }])}>
                No completed challenges yet. Finish a daily or friend challenge to see it here.
              </Text>
            ) : (
              entries.map((entry) => <ChallengeHistoryCard key={`${entry.kind}-${entry.entryId}`} entry={entry} />)
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  empty: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
  errorBlock: {
    gap: Spacing.two,
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
