import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthTextInput } from '@/components/ui/AuthTextInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { searchUsersByUsername, sendFriendRequest } from '@/services/friendsService';
import { formatUserError } from '@/lib/errors';
import type { UserSearchResult } from '@/types/friends';
import { useTheme } from '@/hooks/use-theme';

export default function AddFriendScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSending, setIsSending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setIsSearching(true);
      setError(null);
      try {
        const users = await searchUsersByUsername(trimmed);
        setResults(users);
      } catch (err) {
        setResults([]);
        setError(formatUserError(err, 'Search failed'));
      } finally {
        setIsSearching(false);
      }
    }, 350);

    return () => clearTimeout(timeout);
  }, [query]);

  async function handleSendRequest(username: string) {
    setIsSending(username);
    setError(null);
    setSuccess(null);
    try {
      await sendFriendRequest(username);
      setSuccess(`Friend request sent to @${username}`);
      setResults((current) => current.filter((user) => user.username !== username));
    } catch (err) {
      setError(formatUserError(err, 'Failed to send request'));
    } finally {
      setIsSending(null);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Add Friend', headerShown: true }} />
      <SafeAreaView
        style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}
        edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={StyleSheet.flatten([styles.help, { color: theme.textSecondary }])}>
            Search by username to send a friend request.
          </Text>

          <AuthTextInput
            label="Username"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="e.g. jane_doe"
          />

          {isSearching ? <ActivityIndicator color={theme.primary} /> : null}
          {error ? (
            <Text style={StyleSheet.flatten([styles.error, { color: theme.danger }])}>{error}</Text>
          ) : null}
          {success ? (
            <Text style={StyleSheet.flatten([styles.success, { color: theme.success }])}>{success}</Text>
          ) : null}

          <View style={styles.results}>
            {results.map((user) => (
              <View
                key={user.id}
                style={StyleSheet.flatten([
                  styles.resultRow,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                ])}>
                <View style={styles.resultInfo}>
                  <Text style={StyleSheet.flatten([styles.resultName, { color: theme.text }])}>
                    {user.displayName ?? user.username}
                  </Text>
                  <Text style={StyleSheet.flatten([styles.resultMeta, { color: theme.textSecondary }])}>
                    @{user.username}
                  </Text>
                </View>
                <PrimaryButton
                  label="Add"
                  loading={isSending === user.username}
                  onPress={() => void handleSendRequest(user.username)}
                />
              </View>
            ))}
          </View>

          <Pressable onPress={() => router.back()}>
            <Text style={StyleSheet.flatten([styles.backLink, { color: theme.primary }])}>Back to friends</Text>
          </Pressable>
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
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  help: {
    fontSize: 14,
    lineHeight: 20,
  },
  results: {
    gap: Spacing.two,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  resultInfo: {
    flex: 1,
    gap: Spacing.half,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '700',
  },
  resultMeta: {
    fontSize: 13,
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
  },
  success: {
    fontSize: 14,
    fontWeight: '600',
  },
  backLink: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: Spacing.two,
  },
});
