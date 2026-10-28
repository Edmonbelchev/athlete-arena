import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AchievementBadgeTile } from '@/components/achievements/AchievementBadgeTile';
import { AppIcon } from '@/components/ui/AppIcon';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useFriendAchievements } from '@/features/friends/useFriendAchievements';
import { useFriendProfile } from '@/features/friends/useFriendProfile';
import { useTheme } from '@/hooks/use-theme';
import { leaveScreen } from '@/lib/navigation';

/** All achievements another user has unlocked (their profile shows the first few). */
export default function UserAchievementsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { achievements, isLoading, error, refresh } = useFriendAchievements(userId);
  const { profile } = useFriendProfile(userId);

  const name = profile?.displayName ?? profile?.username;
  const headerOptions = {
    title: name ? `${name}'s Achievements` : 'Achievements',
    headerShown: true,
    headerBackVisible: false,
    headerLeft: () => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => leaveScreen(router, `/friends/${userId}`)}
        style={styles.headerBack}>
        <AppIcon name="chevronBack" size={22} color={theme.text} />
      </Pressable>
    ),
  } as const;

  if (isLoading && achievements.length === 0) {
    return (
      <>
        <Stack.Screen options={headerOptions} />
        <View style={StyleSheet.flatten([styles.centered, { backgroundColor: theme.background }])}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={headerOptions} />
      <SafeAreaView
        edges={['bottom']}
        style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}>
        <FlatList
          data={achievements}
          keyExtractor={(achievement) => achievement.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.content}
          initialNumToRender={12}
          renderItem={({ item }) => <AchievementBadgeTile achievement={item} />}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={() => void refresh()} tintColor={theme.primary} />
          }
          ListHeaderComponent={
            achievements.length > 0 ? (
              <Text style={StyleSheet.flatten([styles.summary, { color: theme.textSecondary }])}>
                {achievements.length} unlocked
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <Text
              style={StyleSheet.flatten([styles.empty, { color: error ? theme.danger : theme.textSecondary }])}>
              {error ?? 'No achievements unlocked yet.'}
            </Text>
          }
        />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBack: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  row: {
    justifyContent: 'space-between',
  },
  summary: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: Spacing.one,
  },
  empty: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
});
