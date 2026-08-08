import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FriendChallengesScreenContent } from '@/components/friends/FriendChallengesScreenContent';
import { TabScreenHeader } from '@/components/sidebar/TabScreenHeader';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useFriendChallenges } from '@/features/friends/useFriendChallenges';
import { useTheme } from '@/hooks/use-theme';

export default function ChallengesTabScreen() {
  const theme = useTheme();
  const { refresh } = useFriendChallenges();

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return (
    <SafeAreaView
      edges={['left', 'right', 'bottom']}
      style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}>
      <View style={styles.header}>
        <TabScreenHeader title="Challenges" subtitle="Active friend speed races" />
      </View>
      <FriendChallengesScreenContent />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
});
