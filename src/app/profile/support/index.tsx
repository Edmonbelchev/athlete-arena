import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SupportTicketCard } from '@/components/support/SupportTicketCard';
import { AppIcon } from '@/components/ui/AppIcon';
import { BetaBadge } from '@/components/ui/BetaBadge';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { APP_VERSION_LABEL } from '@/constants/app';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatUserError } from '@/lib/errors';
import { leaveScreen } from '@/lib/navigation';
import { getMySupportTickets } from '@/services/supportService';
import type { SupportTicket } from '@/types/support';

export default function SupportScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTickets = useCallback(async () => {
    setError(null);

    try {
      const nextTickets = await getMySupportTickets();
      setTickets(nextTickets);
    } catch (err) {
      setError(formatUserError(err, 'Failed to load support tickets'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      void loadTickets();
    }, [loadTickets]),
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Support',
          headerShown: true,
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => leaveScreen(router)}
              style={styles.headerBack}>
              <AppIcon name="chevronBack" size={22} color={theme.text} />
            </Pressable>
          ),
        }}
      />
      <SafeAreaView
        style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}
        edges={['bottom']}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={() => void loadTickets()} tintColor={theme.primary} />
          }>
          <View style={styles.introRow}>
            <BetaBadge showVersion />
          </View>

          <Text style={StyleSheet.flatten([styles.subtitle, { color: theme.textSecondary }])}>
            Athlete Arena is in beta ({APP_VERSION_LABEL}). Report bugs or share feedback - we read every ticket.
          </Text>

          <PrimaryButton label="New Support Ticket" onPress={() => router.push('/profile/support/create')} />

          {error ? (
            <View style={styles.errorBlock}>
              <Text style={StyleSheet.flatten([styles.error, { color: theme.danger }])}>{error}</Text>
              <PrimaryButton label="Try Again" variant="secondary" onPress={() => void loadTickets()} />
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={StyleSheet.flatten([styles.sectionTitle, { color: theme.textSecondary }])}>
              YOUR TICKETS
            </Text>

            {isLoading && tickets.length === 0 ? (
              <ActivityIndicator color={theme.primary} />
            ) : tickets.length === 0 ? (
              <View
                style={StyleSheet.flatten([
                  styles.emptyCard,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                ])}>
                <Text style={StyleSheet.flatten([styles.emptyTitle, { color: theme.text }])}>No tickets yet</Text>
                <Text style={StyleSheet.flatten([styles.emptyCopy, { color: theme.textSecondary }])}>
                  Found a bug or have an idea? Submit a ticket and we&apos;ll take a look.
                </Text>
              </View>
            ) : (
              tickets.map((ticket) => <SupportTicketCard key={ticket.id} ticket={ticket} />)
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  introRow: {
    alignItems: 'flex-start',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  section: {
    gap: Spacing.three,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  emptyCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  emptyCopy: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  errorBlock: {
    gap: Spacing.two,
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerBack: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
});
