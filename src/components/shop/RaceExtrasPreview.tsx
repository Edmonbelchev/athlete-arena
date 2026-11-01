import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AvatarPortrait } from '@/components/avatar/AvatarPortrait';
import { Radius, Spacing } from '@/constants/theme';
import {
  ELF_EAR_CHOICES,
  HAIR_CHOICES,
  ORC_EAR_CHOICES,
  TUSK_CHOICES,
  type AvatarChoice,
} from '@/features/avatar/avatarOptions';
import { useTheme } from '@/hooks/use-theme';
import type { AvatarAccessoryStyles, AvatarAppearance, AvatarRace } from '@/types/avatar';

const TILE_SIZE = 64;

type RaceOptionKey = 'elfEars' | 'orcEars' | 'tusks' | 'hair';

interface RaceSection {
  key: RaceOptionKey;
  title: string;
  choices: AvatarChoice<string>[];
  crop: 'portrait' | 'face';
}

/** What a race unlocks in the avatar editor, in display order. */
export function raceSections(race: AvatarRace): RaceSection[] {
  const hair = HAIR_CHOICES.filter((choice) => choice.race === race);
  return race === 'elf'
    ? [
        { key: 'hair', title: 'Elf hairstyles', choices: hair, crop: 'portrait' },
        { key: 'elfEars', title: 'Ears', choices: ELF_EAR_CHOICES, crop: 'portrait' },
      ]
    : [
        { key: 'hair', title: 'Orc hairstyles', choices: hair, crop: 'portrait' },
        { key: 'orcEars', title: 'Ears', choices: ORC_EAR_CHOICES, crop: 'portrait' },
        { key: 'tusks', title: 'Tusks', choices: TUSK_CHOICES, crop: 'face' },
      ];
}

/**
 * Shop preview of a race's extra options (hairstyles, ears, tusks). Tapping a tile tries it on
 * in the fitting room; the choices themselves are made in the avatar editor after buying.
 */
export function RaceExtrasPreview({
  race,
  appearance,
  accessories,
  onTry,
}: {
  race: AvatarRace;
  /** The fitting-room look, including any option being tried. */
  appearance: AvatarAppearance;
  accessories: AvatarAccessoryStyles;
  onTry: (change: Partial<AvatarAppearance>) => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.root}>
      <Text style={StyleSheet.flatten([styles.intro, { color: theme.textSecondary }])}>
        Includes these extras. Tap one to try it on.
      </Text>
      {raceSections(race).map((section) => (
        <View key={section.key} style={styles.section}>
          <Text style={StyleSheet.flatten([styles.sectionTitle, { color: theme.text }])}>{section.title}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {section.choices.map((choice) => {
              const selected = appearance[section.key] === choice.id;
              return (
                <Pressable
                  key={choice.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${section.title}: ${choice.label}`}
                  accessibilityState={{ selected }}
                  onPress={() => onTry({ [section.key]: choice.id } as Partial<AvatarAppearance>)}
                  style={styles.tile}>
                  <View
                    style={StyleSheet.flatten([
                      styles.tilePreview,
                      {
                        backgroundColor: theme.backgroundSelected,
                        borderColor: selected ? theme.primary : 'transparent',
                      },
                    ])}>
                    <AvatarPortrait
                      appearance={{ ...appearance, [section.key]: choice.id }}
                      accessories={accessories}
                      size={TILE_SIZE - 6}
                      crop={section.crop}
                    />
                  </View>
                  <Text
                    numberOfLines={1}
                    style={StyleSheet.flatten([
                      styles.tileLabel,
                      { color: selected ? theme.primary : theme.textSecondary },
                    ])}>
                    {choice.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignSelf: 'stretch',
    gap: Spacing.two,
  },
  intro: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  section: {
    gap: Spacing.one,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  row: {
    gap: Spacing.two,
  },
  tile: {
    width: TILE_SIZE,
    alignItems: 'center',
    gap: 2,
  },
  tilePreview: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: Radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tileLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
});
