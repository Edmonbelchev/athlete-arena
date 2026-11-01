import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/ui/AppIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatUserError } from '@/lib/errors';
import { leaveScreen } from '@/lib/navigation';
import { getBlockedUsers, unblockUser, type BlockedUser } from '@/services/safetyService';

/** People the user blocked, with a way to unblock them. */
export default function BlockedUsersScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setUsers(await getBlockedUsers());
    } catch (err) {
      setError(formatUserError(err, 'Could not load blocked users'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleUnblock(userId: string) {
    setUnblockingId(userId);
    setError(null);
    try {
      await unblockUser(userId);
      setUsers((current) => current.filter((user) => user.userId !== userId));
    } catch (err) {
      setError(formatUserError(err, 'Could not unblock this user'));
    } finally {
      setUnblockingId(null);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Blocked users',
          headerShown: true,
          headerBackVisible: false,
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => leaveScreen(router, '/profile/settings')}
              style={styles.headerBack}>
              <AppIcon name="chevronBack" size={22} color={theme.text} />
            </Pressable>
          ),
        }}
      />
      <SafeAreaView edges={['bottom']} style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => void load()} tintColor={theme.primary} />}>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Blocked users can&apos;t see you on leaderboards or in search, send you friend requests, or challenge
            you - and you won&apos;t see them.
          </Text>

          {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}

          {isLoading && users.length === 0 ? (
            <ActivityIndicator color={theme.primary} />
          ) : users.length === 0 ? (
            <Text style={[styles.empty, { color: theme.textSecondary }]}>You haven&apos;t blocked anyone.</Text>
          ) : (
            <View style={[styles.list, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
              {users.map((user, index) => (
                <View
                  key={user.userId}
                  style={[styles.row, index > 0 && { borderTopColor: theme.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                  <View style={styles.rowCopy}>
                    <Text style={[styles.name, { color: theme.text }]}>{user.displayName ?? user.username}</Text>
                    <Text style={[styles.username, { color: theme.textSecondary }]}>@{user.username}</Text>
                  </View>
                  <PrimaryButton
                    label="Unblock"
                    variant="secondary"
                    size="compact"
                    loading={unblockingId === user.userId}
                    onPress={() => void handleUnblock(user.userId)}
                  />
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  subtitle: { fontSize: 15, lineHeight: 22 },
  error: { fontSize: 14, fontWeight: '600' },
  empty: { fontSize: 15, textAlign: 'center', marginTop: Spacing.four },
  list: { borderWidth: 1, borderRadius: Radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three },
  rowCopy: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '700' },
  username: { fontSize: 13 },
  headerBack: { padding: Spacing.one },
});
