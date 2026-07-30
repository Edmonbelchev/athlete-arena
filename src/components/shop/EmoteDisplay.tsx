import { StyleSheet, Text, View } from 'react-native';

import { Spacing } from '@/constants/theme';

interface EmoteDisplayProps {
  emoji: string | null | undefined;
  size?: 'sm' | 'lg';
}

export function EmoteDisplay({ emoji, size = 'lg' }: EmoteDisplayProps) {
  if (!emoji) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <Text style={size === 'lg' ? styles.emojiLarge : styles.emojiSmall}>{emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiLarge: {
    fontSize: 40,
  },
  emojiSmall: {
    fontSize: 24,
  },
});
