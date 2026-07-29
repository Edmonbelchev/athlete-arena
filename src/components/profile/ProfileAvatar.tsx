import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface ProfileAvatarProps {
  uri?: string | null;
  name: string;
  size?: number;
}

export function ProfileAvatar({ uri, name, size = 96 }: ProfileAvatarProps) {
  const theme = useTheme();
  const radius = size >= 96 ? Radius.xl : size / 2;
  const fontSize = Math.round(size * 0.42);

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[
          styles.image,
          {
            width: size,
            height: size,
            borderRadius: radius,
            borderColor: theme.border,
          },
        ]}
        contentFit="cover"
        accessibilityLabel={`${name} profile photo`}
      />
    );
  }

  return (
    <View
      style={StyleSheet.flatten([
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: theme.primary,
        },
      ])}>
      <Text style={[styles.initial, { fontSize }]}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    borderWidth: 1,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
