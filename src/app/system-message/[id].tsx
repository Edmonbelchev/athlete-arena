import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/ui/AppIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useNotifications } from '@/features/notifications/NotificationProvider';
import { systemMessageNotificationId } from '@/features/notifications/types';
import { useTheme } from '@/hooks/use-theme';
import { formatUserError } from '@/lib/errors';
import { leaveScreen } from '@/lib/navigation';
import {
  fetchSystemMessage,
  type SystemMessage,
} from '@/services/systemMessageService';

function formatPublishedDate(isoDate: string): string {
  return new Date(isoDate).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function SystemMessageScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { markAsRead, refreshInbox } = useNotifications();
  const [message, setMessage] = useState<SystemMessage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMessage = useCallback(async () => {
    if (!id) {
      setError('Message not found');
      setIsLoading(false);
      return;
    }

    setError(null);

    try {
      const nextMessage = await fetchSystemMessage(id);
      if (!nextMessage) {
        setMessage(null);
        setError('This announcement is no longer available.');
        return;
      }

      setMessage(nextMessage);
      markAsRead(systemMessageNotificationId(nextMessage.id));
      void refreshInbox();
    } catch (err) {
      setError(formatUserError(err, 'Failed to load announcement'));
    } finally {
      setIsLoading(false);
    }
  }, [id, markAsRead, refreshInbox]);

  useEffect(() => {
    setIsLoading(true);
    void loadMessage();
  }, [loadMessage]);

  return (
    <>
      <Stack.Screen
        options={{
          title: 'System Message',
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
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={StyleSheet.flatten([styles.error, { color: theme.danger }])}>{error}</Text>
            <PrimaryButton label="Try Again" variant="secondary" onPress={() => void loadMessage()} />
          </View>
        ) : message ? (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View
              style={StyleSheet.flatten([
                styles.hero,
                { backgroundColor: `${theme.primary}14`, borderColor: theme.primary },
              ])}>
              <View
                style={StyleSheet.flatten([
                  styles.iconWrap,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.primary },
                ])}>
                <AppIcon name="announcement" size={22} color={theme.primary} weight="semibold" />
              </View>
              <View style={styles.heroCopy}>
                <Text style={StyleSheet.flatten([styles.kicker, { color: theme.primary }])}>
                  System message
                </Text>
                <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>
                  {message.title}
                </Text>
                <Text style={StyleSheet.flatten([styles.date, { color: theme.textSecondary }])}>
                  {formatPublishedDate(message.publishedAt)}
                </Text>
              </View>
            </View>

            <View
              style={StyleSheet.flatten([
                styles.bodyCard,
                { backgroundColor: theme.card, borderColor: theme.border },
              ])}>
              <Text style={StyleSheet.flatten([styles.body, { color: theme.text }])}>{message.body}</Text>
            </View>
          </ScrollView>
        ) : null}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerBack: {
    padding: Spacing.two,
    marginLeft: -Spacing.one,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: Spacing.six,
  },
  hero: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Radius.xl,
    borderWidth: 1,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  date: {
    fontSize: 13,
    fontWeight: '600',
  },
  bodyCard: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.four,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
});
