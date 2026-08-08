import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

const BRAND_LOGO = require('@/assets/images/logo.png');

interface BrandLogoProps {
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function BrandLogo({ size = 80, style }: BrandLogoProps) {
  return (
    <View style={StyleSheet.flatten([styles.container, style])}>
      <Image
        source={BRAND_LOGO}
        style={{ width: size, height: size }}
        contentFit="contain"
        accessibilityLabel="Athlete Arena"
      />
    </View>
  );
}

export { BRAND_LOGO };

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
