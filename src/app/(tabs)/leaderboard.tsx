import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LeaderboardScreenContent } from '@/components/leaderboard/LeaderboardScreenContent';
import { TabScreenHeader } from '@/components/sidebar/TabScreenHeader';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function LeaderboardTabScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView
      edges={['left', 'right', 'bottom']}
      style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}>
      <View style={styles.header}>
        <TabScreenHeader title="Leaderboard" subtitle="Compete for the top spot" />
      </View>
      <LeaderboardScreenContent />
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
    marginBottom: Spacing.two,
  },
});
