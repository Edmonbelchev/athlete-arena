import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { getDailyMotivationalQuote } from '@/constants/motivationalQuotes';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const MOTIVATION_IMAGE = require('@/assets/images/logo-glow.png');

export function DailyMotivationCard() {
  const theme = useTheme();
  const quote = getDailyMotivationalQuote();

  return (
    <View
      style={StyleSheet.flatten([
        styles.container,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ])}>
      <Image source={MOTIVATION_IMAGE} style={styles.image} contentFit="cover" />
      <View style={styles.quoteBlock}>
        <Text style={StyleSheet.flatten([styles.quoteLabel, { color: theme.textSecondary }])}>
          DAILY MOTIVATION
        </Text>
        <Text style={StyleSheet.flatten([styles.quoteText, { color: theme.text }])}>{quote.text}</Text>
        <Text style={StyleSheet.flatten([styles.quoteAuthor, { color: theme.textSecondary }])}>
          - {quote.author}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 120,
  },
  quoteBlock: {
    padding: Spacing.three,
    gap: Spacing.one,
  },
  quoteLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  quoteText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  quoteAuthor: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});
