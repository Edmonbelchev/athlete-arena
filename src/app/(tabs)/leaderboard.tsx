import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LeaderboardScreenContent } from '@/components/leaderboard/LeaderboardScreenContent';
import { useTheme } from '@/hooks/use-theme';

export default function LeaderboardTabScreen() {
  const theme = useTheme();

  return (
    <SafeAreaView
      edges={['left', 'right', 'bottom']}
      style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}>
      <LeaderboardScreenContent />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
});
