import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

const COIN_IMAGE = require('@/assets/images/ui-elements/coin.png');

interface CoinIconProps {
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function CoinIcon({ size = 16, style }: CoinIconProps) {
  return (
    <View style={StyleSheet.flatten([styles.container, { width: size, height: size }, style])}>
      <Image
        source={COIN_IMAGE}
        style={{ width: size, height: size }}
        contentFit="contain"
        accessibilityLabel="Coins"
      />
    </View>
  );
}

export { COIN_IMAGE };

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
