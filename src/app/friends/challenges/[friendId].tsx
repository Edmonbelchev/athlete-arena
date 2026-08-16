import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FriendChallengesWithFriendContent } from '@/components/friends/FriendChallengesWithFriendContent';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function FriendChallengesWithFriendScreen() {
  const theme = useTheme();
  const { friendId, username, displayName } = useLocalSearchParams<{
    friendId: string;
    username?: string;
    displayName?: string;
  }>();

  const friendName = displayName?.trim() || username || 'Friend';

  return (
    <>
      <Stack.Screen
        options={{
          title: friendName,
          headerShown: true,
        }}
      />
      <SafeAreaView
        edges={['left', 'right', 'bottom']}
        style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}>
        <View style={styles.content}>
          {friendId ? (
            <FriendChallengesWithFriendContent
              friendId={friendId}
              friendName={friendName}
              friendUsername={username}
            />
          ) : null}
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
    paddingTop: Spacing.two,
  },
});
