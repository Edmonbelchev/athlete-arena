import { describe, expect, it, jest } from '@jest/globals';
import React from 'react';

// Render react-native-svg as plain SVG markup so the real avatar component can be inspected.
jest.mock('react-native-svg', () => {
  const R = require('react');
  const make = (tag: string) => (props: Record<string, unknown>) => R.createElement(tag, props);
  const Svg = (props: Record<string, unknown>) => R.createElement('svg', props);
  return {
    __esModule: true,
    default: Svg,
    Svg,
    G: make('g'),
    Path: make('path'),
    Circle: make('circle'),
    Ellipse: make('ellipse'),
    Rect: make('rect'),
    Defs: make('defs'),
    ClipPath: make('clipPath'),
    LinearGradient: make('linearGradient'),
    Stop: make('stop'),
  };
});

import { AvatarPortrait } from '@/components/avatar/AvatarPortrait';
import { androidGlowColor, raceSkinColor } from '@/components/avatar/AvatarRaceParts';
import { isIncludedWithPremium } from '@/features/avatar/avatarWardrobe';
import {
  ANDROID_EYE_CHOICES,
  ANDROID_PLATING_CHOICES,
  DEFAULT_APPEARANCE,
  ELF_EAR_CHOICES,
  EYE_CHOICES,
  HAIR_CHOICES,
  ORC_EAR_CHOICES,
  SKIN_COLORS,
  TUSK_CHOICES,
  changeRace,
  choicesForBody,
  normalizeAppearance,
} from '@/features/avatar/avatarOptions';
import type { AvatarAccessoryStyles, AvatarAppearance, WearableStyle } from '@/types/avatar';

// react-dom ships without type definitions in this project; only this one function is needed.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderToStaticMarkup } = require('react-dom/server') as {
  renderToStaticMarkup: (element: React.ReactElement) => string;
};

const TUSK = '#F4EEDB';
const HUMAN_EAR = 'r="7.5"';

function render(
  race: WearableStyle | null,
  bodyType: 'male' | 'female' = 'male',
  overrides: Partial<AvatarAppearance> = {},
): string {
  const accessories: AvatarAccessoryStyles = race
    ? { race: { style: race, colors: { primary: '#000000', secondary: '#000000' } } }
    : {};
  return renderToStaticMarkup(
    React.createElement(AvatarPortrait, {
      appearance: { ...DEFAULT_APPEARANCE[bodyType], ...overrides },
      accessories,
      size: 100,
    }),
  );
}

describe('avatar races', () => {
  it('humans keep round ears and no tusks', () => {
    const svg = render(null);
    expect(svg).toContain(HUMAN_EAR);
    expect(svg).not.toContain(TUSK);
  });

  for (const bodyType of ['male', 'female'] as const) {
    it(`orc (${bodyType}): green skin, tusks, its own ears`, () => {
      const svg = render('race_orc', bodyType);
      const skinId = DEFAULT_APPEARANCE[bodyType].skinColor;
      const skinHex = SKIN_COLORS.find((choice) => choice.id === skinId)!.hex;
      expect(svg).toContain(raceSkinColor('orc', skinId, skinHex));
      expect(svg).not.toContain(skinHex);
      expect(svg).toContain(TUSK);
      expect(svg).not.toContain(HUMAN_EAR);
    });

    it(`elf (${bodyType}): blue skin, no tusks, its own ears`, () => {
      const svg = render('race_elf', bodyType);
      const skinId = DEFAULT_APPEARANCE[bodyType].skinColor;
      const skinHex = SKIN_COLORS.find((choice) => choice.id === skinId)!.hex;
      expect(svg).toContain(raceSkinColor('elf', skinId, skinHex));
      expect(svg).not.toContain(skinHex);
      expect(svg).not.toContain(TUSK);
      expect(svg).not.toContain(HUMAN_EAR);
    });
  }

  for (const race of ['elf', 'orc', 'android'] as const) {
    it(`every skin tone maps to its own ${race} shade, light to dark`, () => {
      const shades = SKIN_COLORS.map((choice) => raceSkinColor(race, choice.id, choice.hex));
      expect(new Set(shades).size).toBe(SKIN_COLORS.length);
      // Lighter tones stay lighter: relative luminance decreases down the palette.
      const luminance = (hex: string) => {
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      for (let i = 1; i < shades.length; i += 1) {
        expect(luminance(shades[i])).toBeLessThan(luminance(shades[i - 1]));
      }
    });
  }

  it('each ear style draws differently, and only for its own race', () => {
    for (const bodyType of ['male', 'female'] as const) {
      const elf = ELF_EAR_CHOICES.map(({ id }) => render('race_elf', bodyType, { elfEars: id }));
      const orc = ORC_EAR_CHOICES.map(({ id }) => render('race_orc', bodyType, { orcEars: id }));
      expect(new Set(elf).size).toBe(ELF_EAR_CHOICES.length);
      expect(new Set(orc).size).toBe(ORC_EAR_CHOICES.length);
    }
    // Orc ear choice doesn't affect elves, and the other way round.
    expect(render('race_elf', 'male', { orcEars: 'droopy' })).toBe(render('race_elf', 'male'));
    expect(render('race_orc', 'male', { elfEars: 'long' })).toBe(render('race_orc', 'male'));
  });

  it('tusk styles: none removes them, the rest differ; elves never get tusks', () => {
    expect(render('race_orc', 'male', { tusks: 'none' })).not.toContain(TUSK);
    const drawn = TUSK_CHOICES.filter(({ id }) => id !== 'none').map(({ id }) =>
      render('race_orc', 'male', { tusks: id }),
    );
    drawn.forEach((svg) => expect(svg).toContain(TUSK));
    expect(new Set(drawn).size).toBe(drawn.length);
    expect(render('race_elf', 'male', { tusks: 'large' })).not.toContain(TUSK);
  });

  it('race hairstyles are offered only with that race, for both body types', () => {
    for (const bodyType of ['male', 'female'] as const) {
      const human = choicesForBody(HAIR_CHOICES, bodyType, null).map(({ id }) => id);
      const elf = choicesForBody(HAIR_CHOICES, bodyType, 'elf').map(({ id }) => id);
      const orc = choicesForBody(HAIR_CHOICES, bodyType, 'orc').map(({ id }) => id);
      expect(human.some((id) => id.startsWith('elf_') || id.startsWith('orc_'))).toBe(false);
      expect(elf).toEqual(expect.arrayContaining(['elf_flowing', 'elf_crown_braid', 'elf_high_knot', ...human]));
      expect(elf.some((id) => id.startsWith('orc_'))).toBe(false);
      expect(orc).toEqual(expect.arrayContaining(['orc_topknot', 'orc_war_braids', 'orc_crest', ...human]));
      expect(orc.some((id) => id.startsWith('elf_'))).toBe(false);
    }
  });

  it('switching race drops the other race hairstyle but keeps everything else', () => {
    const orcLook: AvatarAppearance = { ...DEFAULT_APPEARANCE.male, hair: 'orc_crest', tusks: 'large' };
    expect(changeRace(orcLook, 'orc')).toEqual(orcLook);
    expect(changeRace(orcLook, 'elf')).toEqual({ ...orcLook, hair: DEFAULT_APPEARANCE.male.hair });
    expect(changeRace(orcLook, null).hair).toBe(DEFAULT_APPEARANCE.male.hair);
    // Loading (race unknown) keeps race hair and fills missing race options with defaults.
    const { elfEars, orcEars, tusks, androidEyes, ...stored } = orcLook;
    void elfEars;
    void orcEars;
    void tusks;
    void androidEyes;
    expect(normalizeAppearance(stored)).toEqual({ ...orcLook, tusks: 'classic' });
  });

  for (const bodyType of ['male', 'female'] as const) {
    it(`android (${bodyType}): metal skin, receptor ears glowing in the eye color`, () => {
      const svg = render('race_android', bodyType, { eyeColor: 'eye_green' });
      const skinId = DEFAULT_APPEARANCE[bodyType].skinColor;
      const skinHex = SKIN_COLORS.find((choice) => choice.id === skinId)!.hex;
      expect(svg).toContain(raceSkinColor('android', skinId, skinHex));
      expect(svg).not.toContain(skinHex);
      expect(svg).toContain(androidGlowColor('eye_green'));
      expect(svg).not.toContain(HUMAN_EAR);
      expect(svg).not.toContain(TUSK);
    });
  }

  it('android options each draw differently, and only for androids', () => {
    const variants = <T extends string>(race: WearableStyle, key: keyof AvatarAppearance, ids: T[]) =>
      ids.map((id) => render(race, 'male', { [key]: id }));
    for (const [race, key, choices] of [
      ['race_android', 'androidEyes', ANDROID_EYE_CHOICES],
      ['race_android', 'androidPlating', ANDROID_PLATING_CHOICES],
    ] as const) {
      const drawn = variants(race, key, choices.map(({ id }) => id));
      expect(new Set(drawn).size).toBe(choices.length);
    }
    expect(render('race_elf', 'male', { androidEyes: 'visor' })).toBe(render('race_elf', 'male'));
    expect(render(null, 'male', { androidPlating: 'circuit' })).toBe(render(null, 'male'));
  });

  it('Premium includes only the Android race; Elf and Orc are bought with coins', () => {
    expect(isIncludedWithPremium({ style: 'race_android' })).toBe(true);
    expect(isIncludedWithPremium({ style: 'race_elf' })).toBe(false);
    expect(isIncludedWithPremium({ style: 'race_orc' })).toBe(false);
    expect(isIncludedWithPremium({ style: 'cap' })).toBe(false);
  });

  it('android hairstyles stay with androids', () => {
    for (const bodyType of ['male', 'female'] as const) {
      const android = choicesForBody(HAIR_CHOICES, bodyType, 'android').map(({ id }) => id);
      const elf = choicesForBody(HAIR_CHOICES, bodyType, 'elf').map(({ id }) => id);
      expect(android).toEqual(expect.arrayContaining(['android_crest', 'android_cables', 'android_sleek']));
      expect(android.some((id) => id.startsWith('elf_') || id.startsWith('orc_'))).toBe(false);
      expect(elf.some((id) => id.startsWith('android_'))).toBe(false);
    }
    const look: AvatarAppearance = { ...DEFAULT_APPEARANCE.female, hair: 'android_cables', androidEyes: 'visor' };
    expect(changeRace(look, 'elf')).toEqual({ ...look, hair: DEFAULT_APPEARANCE.female.hair });
  });

  it('lashes are female-only; a male avatar with lashes falls back to the default eyes', () => {
    expect(choicesForBody(EYE_CHOICES, 'male').map(({ id }) => id)).not.toContain('lashes');
    expect(choicesForBody(EYE_CHOICES, 'female').map(({ id }) => id)).toContain('lashes');
    expect(normalizeAppearance({ ...DEFAULT_APPEARANCE.male, eyes: 'lashes' }).eyes).toBe(DEFAULT_APPEARANCE.male.eyes);
  });
});
