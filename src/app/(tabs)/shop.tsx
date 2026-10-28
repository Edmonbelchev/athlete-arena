import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ShopScreenContent, type ShopSection } from '@/components/shop/ShopScreenContent';
import { TabScreenHeader } from '@/components/sidebar/TabScreenHeader';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const SECTIONS: ShopSection[] = ['outfits', 'slots', 'emotes'];

export default function ShopTabScreen() {
  const theme = useTheme();
  const { section } = useLocalSearchParams<{ section?: string }>();
  const initialSection = SECTIONS.find((entry) => entry === section) ?? 'outfits';

  return (
    <SafeAreaView
      edges={['left', 'right', 'bottom']}
      style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}>
      <View style={styles.header}>
        <TabScreenHeader title="Shop" subtitle="Outfits, challenge slots and emotes" />
      </View>
      {/* Keyed so links like ?section=slots open the right section even if the tab is already mounted. */}
      <ShopScreenContent key={initialSection} initialSection={initialSection} />
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
