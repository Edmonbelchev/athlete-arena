import type {
  AccessorySlot,
  AvatarAccessories,
  AvatarAppearance,
  AvatarBodyType,
  AvatarBrows,
  AvatarElfEars,
  AvatarEyes,
  AvatarFacialHair,
  AvatarHair,
  AvatarHeadShape,
  AvatarMouth,
  AvatarNose,
  AvatarOrcEars,
  AvatarRace,
  AvatarTusks,
  WearableItem,
} from '@/types/avatar';

export interface AvatarChoice<T extends string> {
  id: T;
  label: string;
  /** Limits the option to one body type; omitted means available to both. */
  bodyType?: AvatarBodyType;
  /** Limits the option to avatars wearing this race; omitted means available to everyone. */
  race?: AvatarRace;
}

export interface AvatarColorChoice {
  id: string;
  label: string;
  hex: string;
}

export const BODY_TYPE_CHOICES: AvatarChoice<AvatarBodyType>[] = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
];

export const HEAD_SHAPE_CHOICES: AvatarChoice<AvatarHeadShape>[] = [
  { id: 'oval', label: 'Oval' },
  { id: 'round', label: 'Round' },
  { id: 'square', label: 'Square' },
  { id: 'long', label: 'Long' },
];

export const EYE_CHOICES: AvatarChoice<AvatarEyes>[] = [
  { id: 'round', label: 'Round' },
  { id: 'almond', label: 'Almond' },
  { id: 'big', label: 'Big' },
  { id: 'narrow', label: 'Narrow' },
  { id: 'lashes', label: 'Lashes', bodyType: 'female' },
  { id: 'happy', label: 'Happy' },
  { id: 'sleepy', label: 'Sleepy' },
  { id: 'wink', label: 'Wink' },
  { id: 'determined', label: 'Focused' },
];

export const BROW_CHOICES: AvatarChoice<AvatarBrows>[] = [
  { id: 'straight', label: 'Straight' },
  { id: 'arched', label: 'Arched' },
  { id: 'thin', label: 'Thin' },
  { id: 'thick', label: 'Thick' },
  { id: 'bushy', label: 'Bushy' },
  { id: 'raised', label: 'Raised' },
  { id: 'determined', label: 'Focused' },
];

export const NOSE_CHOICES: AvatarChoice<AvatarNose>[] = [
  { id: 'button', label: 'Button' },
  { id: 'small', label: 'Small' },
  { id: 'soft', label: 'Soft' },
  { id: 'pointed', label: 'Pointed' },
];

export const MOUTH_CHOICES: AvatarChoice<AvatarMouth>[] = [
  { id: 'smile', label: 'Smile' },
  { id: 'grin', label: 'Grin' },
  { id: 'laugh', label: 'Laugh' },
  { id: 'smirk', label: 'Smirk' },
  { id: 'tongue', label: 'Tongue' },
  { id: 'lips', label: 'Lips', bodyType: 'female' },
  { id: 'neutral', label: 'Neutral' },
  { id: 'serious', label: 'Serious' },
];

export const HAIR_CHOICES: AvatarChoice<AvatarHair>[] = [
  { id: 'buzz', label: 'Buzz' },
  { id: 'short', label: 'Short' },
  { id: 'side_part', label: 'Side part' },
  { id: 'spiky', label: 'Spiky' },
  { id: 'curly', label: 'Curly' },
  { id: 'afro', label: 'Afro' },
  { id: 'dreads', label: 'Dreads' },
  { id: 'bald', label: 'Bald', bodyType: 'male' },
  { id: 'short_spiky', label: 'Short spiky', bodyType: 'male' },
  { id: 'undercut', label: 'Undercut', bodyType: 'male' },
  { id: 'mohawk', label: 'Mohawk', bodyType: 'male' },
  { id: 'man_bun', label: 'Man bun', bodyType: 'male' },
  { id: 'pixie', label: 'Pixie', bodyType: 'female' },
  { id: 'bob', label: 'Bob', bodyType: 'female' },
  { id: 'long', label: 'Long', bodyType: 'female' },
  { id: 'wavy', label: 'Wavy', bodyType: 'female' },
  { id: 'ponytail', label: 'Ponytail', bodyType: 'female' },
  { id: 'high_ponytail', label: 'High ponytail', bodyType: 'female' },
  { id: 'bun', label: 'Bun', bodyType: 'female' },
  { id: 'space_buns', label: 'Space buns', bodyType: 'female' },
  { id: 'braids', label: 'Braids', bodyType: 'female' },
  { id: 'elf_flowing', label: 'Flowing', race: 'elf' },
  { id: 'elf_crown_braid', label: 'Crown braid', race: 'elf' },
  { id: 'elf_high_knot', label: 'High knot', race: 'elf' },
  { id: 'orc_topknot', label: 'Topknot', race: 'orc' },
  { id: 'orc_war_braids', label: 'War braids', race: 'orc' },
  { id: 'orc_crest', label: 'Crest', race: 'orc' },
];

export const ELF_EAR_CHOICES: AvatarChoice<AvatarElfEars>[] = [
  { id: 'classic', label: 'Classic' },
  { id: 'long', label: 'Long' },
  { id: 'short', label: 'Short' },
];

export const ORC_EAR_CHOICES: AvatarChoice<AvatarOrcEars>[] = [
  { id: 'nicked', label: 'Nicked' },
  { id: 'pointed', label: 'Pointed' },
  { id: 'droopy', label: 'Droopy' },
];

export const TUSK_CHOICES: AvatarChoice<AvatarTusks>[] = [
  { id: 'classic', label: 'Classic' },
  { id: 'large', label: 'Large' },
  { id: 'broken', label: 'Broken' },
  { id: 'none', label: 'None' },
];

export const FACIAL_HAIR_CHOICES: AvatarChoice<AvatarFacialHair>[] = [
  { id: 'none', label: 'None' },
  { id: 'stubble', label: 'Stubble', bodyType: 'male' },
  { id: 'mustache', label: 'Mustache', bodyType: 'male' },
  { id: 'handlebar', label: 'Handlebar', bodyType: 'male' },
  { id: 'goatee', label: 'Goatee', bodyType: 'male' },
  { id: 'soul_patch', label: 'Soul patch', bodyType: 'male' },
  { id: 'chinstrap', label: 'Chinstrap', bodyType: 'male' },
  { id: 'beard', label: 'Beard', bodyType: 'male' },
  { id: 'full_beard', label: 'Full beard', bodyType: 'male' },
];

export const SKIN_COLORS: AvatarColorChoice[] = [
  { id: 'skin_1', label: 'Porcelain', hex: '#FCE3D0' },
  { id: 'skin_2', label: 'Light', hex: '#F3C9A8' },
  { id: 'skin_3', label: 'Medium', hex: '#DDA67E' },
  { id: 'skin_4', label: 'Tan', hex: '#BE8259' },
  { id: 'skin_5', label: 'Brown', hex: '#8F5B3B' },
  { id: 'skin_6', label: 'Deep', hex: '#5E3A26' },
];

export const HAIR_COLORS: AvatarColorChoice[] = [
  { id: 'hair_black', label: 'Black', hex: '#1F1A17' },
  { id: 'hair_dark_brown', label: 'Dark brown', hex: '#4A2E1F' },
  { id: 'hair_brown', label: 'Brown', hex: '#7A4B2A' },
  { id: 'hair_auburn', label: 'Auburn', hex: '#A8432A' },
  { id: 'hair_blonde', label: 'Blonde', hex: '#E2BC6E' },
  { id: 'hair_platinum', label: 'Platinum', hex: '#EDE6D6' },
  { id: 'hair_gray', label: 'Gray', hex: '#9CA3AF' },
  { id: 'hair_blue', label: 'Electric blue', hex: '#3B82F6' },
  { id: 'hair_pink', label: 'Pink', hex: '#EC4899' },
];

export const EYE_COLORS: AvatarColorChoice[] = [
  { id: 'eye_brown', label: 'Brown', hex: '#4B2E1E' },
  { id: 'eye_hazel', label: 'Hazel', hex: '#7C5A2E' },
  { id: 'eye_blue', label: 'Blue', hex: '#2E6FBF' },
  { id: 'eye_green', label: 'Green', hex: '#3E8E5A' },
  { id: 'eye_gray', label: 'Gray', hex: '#6B7280' },
];

export const BACKGROUND_COLORS: AvatarColorChoice[] = [
  { id: 'bg_indigo', label: 'Indigo', hex: '#6366F1' },
  { id: 'bg_sky', label: 'Sky', hex: '#0EA5E9' },
  { id: 'bg_emerald', label: 'Emerald', hex: '#10B981' },
  { id: 'bg_amber', label: 'Amber', hex: '#F59E0B' },
  { id: 'bg_orange', label: 'Orange', hex: '#F97316' },
  { id: 'bg_rose', label: 'Rose', hex: '#F43F5E' },
  { id: 'bg_violet', label: 'Violet', hex: '#8B5CF6' },
  { id: 'bg_slate', label: 'Slate', hex: '#475569' },
];

export const ACCESSORY_SLOTS: { slot: AccessorySlot; label: string; required: boolean }[] = [
  { slot: 'top', label: 'Top', required: true },
  { slot: 'headwear', label: 'Headwear', required: false },
  { slot: 'glasses', label: 'Glasses', required: false },
  { slot: 'earrings', label: 'Earrings', required: false },
  { slot: 'background', label: 'Background', required: false },
  { slot: 'race', label: 'Race', required: false },
];

/** Starting looks for new accounts; keep in sync with create_default_avatar (migration 128). */
export const DEFAULT_APPEARANCE: Record<AvatarBodyType, AvatarAppearance> = {
  male: {
    bodyType: 'male',
    headShape: 'oval',
    skinColor: 'skin_3',
    eyes: 'almond',
    eyeColor: 'eye_brown',
    brows: 'straight',
    nose: 'button',
    mouth: 'grin',
    hair: 'short_spiky',
    hairColor: 'hair_black',
    facialHair: 'goatee',
    background: 'bg_indigo',
    elfEars: 'classic',
    orcEars: 'nicked',
    tusks: 'classic',
  },
  female: {
    bodyType: 'female',
    headShape: 'oval',
    skinColor: 'skin_3',
    eyes: 'wink',
    eyeColor: 'eye_brown',
    brows: 'straight',
    nose: 'button',
    mouth: 'smirk',
    hair: 'space_buns',
    hairColor: 'hair_black',
    facialHair: 'none',
    background: 'bg_indigo',
    elfEars: 'classic',
    orcEars: 'nicked',
    tusks: 'classic',
  },
};

/**
 * Options available to a body type. Race-only options are included only for that race;
 * pass `'any'` to allow every race's options (used when loading, before the race is known).
 */
export function choicesForBody<T extends string>(
  choices: AvatarChoice<T>[],
  bodyType: AvatarBodyType,
  race: AvatarRace | null | 'any' = null
): AvatarChoice<T>[] {
  return choices.filter(
    (choice) =>
      (!choice.bodyType || choice.bodyType === bodyType) &&
      (!choice.race || race === 'any' || choice.race === race)
  );
}

function pickChoice<T extends string>(
  choices: AvatarChoice<T>[],
  value: unknown,
  bodyType: AvatarBodyType,
  fallback: T,
  race: AvatarRace | null | 'any' = 'any'
): T {
  const allowed = choicesForBody(choices, bodyType, race);
  return allowed.find((choice) => choice.id === value)?.id ?? fallback;
}

function pickColor(colors: AvatarColorChoice[], value: unknown, fallback: string): string {
  return colors.some((color) => color.id === value) ? (value as string) : fallback;
}

export function resolveColor(colors: AvatarColorChoice[], id: string): string {
  return (colors.find((color) => color.id === id) ?? colors[0]).hex;
}

/**
 * Coerces stored or partial data into a valid appearance for its body type. With a race,
 * race-only options of other races (e.g. orc hair after switching to elf) fall back to defaults;
 * without one (`'any'`, the default) they are kept, since the race is stored separately.
 */
export function normalizeAppearance(value: unknown, race: AvatarRace | null | 'any' = 'any'): AvatarAppearance {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const bodyType: AvatarBodyType = record.bodyType === 'female' ? 'female' : 'male';
  const defaults = DEFAULT_APPEARANCE[bodyType];

  return {
    bodyType,
    headShape: pickChoice(HEAD_SHAPE_CHOICES, record.headShape, bodyType, defaults.headShape),
    skinColor: pickColor(SKIN_COLORS, record.skinColor, defaults.skinColor),
    eyes: pickChoice(EYE_CHOICES, record.eyes, bodyType, defaults.eyes),
    eyeColor: pickColor(EYE_COLORS, record.eyeColor, defaults.eyeColor),
    brows: pickChoice(BROW_CHOICES, record.brows, bodyType, defaults.brows),
    nose: pickChoice(NOSE_CHOICES, record.nose, bodyType, defaults.nose),
    mouth: pickChoice(MOUTH_CHOICES, record.mouth, bodyType, defaults.mouth),
    hair: pickChoice(HAIR_CHOICES, record.hair, bodyType, defaults.hair, race),
    hairColor: pickColor(HAIR_COLORS, record.hairColor, defaults.hairColor),
    facialHair: pickChoice(FACIAL_HAIR_CHOICES, record.facialHair, bodyType, defaults.facialHair),
    background: pickColor(BACKGROUND_COLORS, record.background, defaults.background),
    elfEars: pickChoice(ELF_EAR_CHOICES, record.elfEars, bodyType, defaults.elfEars),
    orcEars: pickChoice(ORC_EAR_CHOICES, record.orcEars, bodyType, defaults.orcEars),
    tusks: pickChoice(TUSK_CHOICES, record.tusks, bodyType, defaults.tusks),
  };
}

/** Switches body type, keeping every choice that still fits. */
export function changeBodyType(
  appearance: AvatarAppearance,
  bodyType: AvatarBodyType
): AvatarAppearance {
  return normalizeAppearance({ ...appearance, bodyType });
}

/** Switches race (or back to human), dropping options that belong to another race. */
export function changeRace(appearance: AvatarAppearance, race: AvatarRace | null): AvatarAppearance {
  return normalizeAppearance(appearance, race);
}

export function wearableFitsBody(item: WearableItem, bodyType: AvatarBodyType): boolean {
  return item.bodyType === 'unisex' || item.bodyType === bodyType;
}

/**
 * Drops equipped items that aren't owned, are in the wrong slot, or don't fit
 * the body type, then fills required slots (the top) with the first fitting owned item.
 */
export function normalizeAccessories(
  accessories: AvatarAccessories,
  wardrobe: WearableItem[],
  bodyType: AvatarBodyType
): AvatarAccessories {
  const fitting = wardrobe.filter((item) => item.owned && wearableFitsBody(item, bodyType));
  const next: AvatarAccessories = {};

  for (const { slot, required } of ACCESSORY_SLOTS) {
    const item =
      fitting.find((entry) => entry.id === accessories[slot] && entry.slot === slot) ??
      (required ? fitting.find((entry) => entry.slot === slot) : undefined);
    if (item) {
      next[slot] = item.id;
    }
  }

  return next;
}

function randomOf<T>(values: T[]): T {
  return values[Math.floor(Math.random() * values.length)];
}

export function randomizeAppearance(bodyType: AvatarBodyType, race: AvatarRace | null = null): AvatarAppearance {
  return {
    bodyType,
    headShape: randomOf(choicesForBody(HEAD_SHAPE_CHOICES, bodyType)).id,
    skinColor: randomOf(SKIN_COLORS).id,
    eyes: randomOf(choicesForBody(EYE_CHOICES, bodyType)).id,
    eyeColor: randomOf(EYE_COLORS).id,
    brows: randomOf(choicesForBody(BROW_CHOICES, bodyType)).id,
    nose: randomOf(choicesForBody(NOSE_CHOICES, bodyType)).id,
    mouth: randomOf(choicesForBody(MOUTH_CHOICES, bodyType)).id,
    hair: randomOf(choicesForBody(HAIR_CHOICES, bodyType, race)).id,
    hairColor: randomOf(HAIR_COLORS.slice(0, 7)).id,
    facialHair: randomOf(choicesForBody(FACIAL_HAIR_CHOICES, bodyType)).id,
    background: randomOf(BACKGROUND_COLORS).id,
    elfEars: randomOf(ELF_EAR_CHOICES).id,
    orcEars: randomOf(ORC_EAR_CHOICES).id,
    tusks: randomOf(TUSK_CHOICES).id,
  };
}
