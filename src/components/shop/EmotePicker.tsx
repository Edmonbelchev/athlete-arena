import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import type { ShopItemRecord } from '@/types/shop';
import { useTheme } from '@/hooks/use-theme';

interface EmotePickerProps {
  emotes: ShopItemRecord[];
  selectedEmoteId: string | null;
  onSelect: (emoteId: string | null) => void;
}

export function EmotePicker({ emotes, selectedEmoteId, onSelect }: EmotePickerProps) {
  const theme = useTheme();

  if (emotes.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={StyleSheet.flatten([styles.label, { color: theme.textSecondary }])}>EMOTE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Pressable
          onPress={() => onSelect(null)}
          style={StyleSheet.flatten([
            styles.chip,
            {
              backgroundColor: selectedEmoteId === null ? theme.primary : theme.backgroundElement,
              borderColor: selectedEmoteId === null ? theme.primary : theme.border,
            },
          ])}>
          <Text
            style={StyleSheet.flatten([
              styles.chipText,
              { color: selectedEmoteId === null ? '#FFFFFF' : theme.textSecondary },
            ])}>
            None
          </Text>
        </Pressable>

        {emotes.map((emote) => {
          const selected = selectedEmoteId === emote.id;
          return (
            <Pressable
              key={emote.id}
              onPress={() => onSelect(emote.id)}
              style={StyleSheet.flatten([
                styles.chip,
                {
                  backgroundColor: selected ? theme.primary : theme.backgroundElement,
                  borderColor: selected ? theme.primary : theme.border,
                },
              ])}>
              <Text style={styles.emoji}>{emote.metadata.emoji ?? '✨'}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  row: {
    gap: Spacing.two,
    paddingRight: Spacing.two,
  },
  chip: {
    minWidth: 52,
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  emoji: {
    fontSize: 24,
  },
});
