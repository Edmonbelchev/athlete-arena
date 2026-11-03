import { Circle, G, Path, Rect } from 'react-native-svg';

import { Both } from '@/components/avatar/AvatarHeadParts';
import { EAR_X, EAR_Y, MIRROR_TRANSFORM } from '@/components/avatar/avatarGeometry';
import { mixColors, shadeColor } from '@/features/avatar/avatarColors';
import { SKIN_COLORS } from '@/features/avatar/avatarOptions';
import type {
  AvatarAndroidEyes,
  AvatarAndroidPlating,
  AvatarBodyType,
  AvatarElfEars,
  AvatarHeadShape,
  AvatarOrcEars,
  AvatarRace,
  AvatarTusks,
} from '@/types/avatar';

/**
 * Races (legendary shop items). A race only changes a few features - ears, skin tone (blue
 * elves, green orcs, metal androids), orc tusks and brow, android eyes and plating - so every
 * other customization (hair, face, beard, hats, glasses, earrings, tops, backgrounds) still
 * applies. Each race adapts to the avatar's body type.
 *
 * Paths describe the LEFT side (x < 100) and are mirrored with <Both>, like the rest of the
 * avatar art. Ear lobes stay at the human lobe (EAR_X - 1.5, EAR_Y + 7) so earrings still fit.
 */

const INK = '#2B1D16';
const TUSK = '#F4EEDB';

/**
 * Race skin palettes, one shade per human skin tone, light to dark: the tone the user picks
 * still decides how light or dark their elf or orc is.
 */
const RACE_SKIN: Record<AvatarRace, Record<string, string>> = {
  elf: {
    skin_1: '#D3E6F8',
    skin_2: '#B5D2F1',
    skin_3: '#90B6E4',
    skin_4: '#6D95CC',
    skin_5: '#4F74AC',
    skin_6: '#35507F',
  },
  orc: {
    skin_1: '#B7D59B',
    skin_2: '#9DC57F',
    skin_3: '#82AD60',
    skin_4: '#678F46',
    skin_5: '#4D6F34',
    skin_6: '#364F25',
  },
  // White ceramic, silver, steel, gunmetal, graphite.
  android: {
    skin_1: '#EEF1F5',
    skin_2: '#D3D9E1',
    skin_3: '#AFB8C4',
    skin_4: '#8691A0',
    skin_5: '#5F6978',
    skin_6: '#3E4652',
  },
};

/** Fallback hue for a tone that is not in the palette. */
const RACE_HUE: Record<AvatarRace, string> = {
  elf: '#5B86C5',
  orc: '#5E8A3C',
  android: '#8691A0',
};

/** Android glow (eyes, ear rings, circuits) for each eye color: amber, gold, cyan, mint, white. */
const ANDROID_GLOW: Record<string, string> = {
  eye_brown: '#FFB020',
  eye_hazel: '#FFD84A',
  eye_blue: '#3EE2FF',
  eye_green: '#4DFFA0',
  eye_gray: '#E8F1FF',
};

export function androidGlowColor(eyeColorId: string): string {
  return ANDROID_GLOW[eyeColorId] ?? ANDROID_GLOW.eye_blue;
}

/** Dark glass behind android optics. */
const LENS = '#0D1424';

/** The skin color to draw for a race: blue for elves, green for orcs, metal for androids, at the chosen lightness. */
export function raceSkinColor(race: AvatarRace | null, skinColorId: string, skinHex: string): string {
  if (!race) {
    return skinHex;
  }
  const palette = RACE_SKIN[race];
  if (palette[skinColorId]) {
    return palette[skinColorId];
  }
  // Unknown tone id: match it by hex, else keep its lightness and shift it to the race hue.
  const known = SKIN_COLORS.find((choice) => choice.hex.toLowerCase() === skinHex.toLowerCase());
  return known && palette[known.id] ? palette[known.id] : mixColors(skinHex, RACE_HUE[race], 0.7);
}

interface EarPath {
  outer: string;
  inner: string;
}

/** How far each elf ear style reaches out (x) and up (y) from the ear; female ears are a bit finer and longer. */
const ELF_EAR_SIZE: Record<AvatarElfEars, { male: [number, number]; female: [number, number] }> = {
  classic: { male: [13, 24], female: [15, 27] },
  long: { male: [17, 35], female: [18, 38] },
  short: { male: [9, 15], female: [10, 17] },
};

/** Swept-back elf ear ending in a point. */
function elfEarPath(earX: number, style: AvatarElfEars, female: boolean): EarPath {
  const [reach, rise] = ELF_EAR_SIZE[style][female ? 'female' : 'male'];
  const tipX = earX - reach;
  const tipY = EAR_Y - rise;
  const lobeX = earX - 1.5;
  const lobeY = EAR_Y + 8;
  return {
    outer:
      `M${earX + 4} ${EAR_Y - 7}` +
      ` C${earX - 1} ${EAR_Y - 11} ${tipX + 5} ${tipY + 8} ${tipX} ${tipY}` +
      ` C${tipX + 2} ${tipY + 10} ${earX - 9} ${EAR_Y - 4} ${earX - 7} ${EAR_Y + 3}` +
      ` Q${lobeX - 4} ${lobeY + 1} ${lobeX + 1} ${lobeY}` +
      ` Q${earX + 5} ${EAR_Y + 7} ${earX + 5} ${EAR_Y + 2} Z`,
    inner:
      `M${earX + 1} ${EAR_Y - 5}` +
      ` C${earX - 3} ${EAR_Y - 8} ${tipX + 6} ${tipY + 11} ${tipX + 3} ${tipY + 5}` +
      ` C${tipX + 6} ${tipY + 13} ${earX - 5} ${EAR_Y - 1} ${earX - 2} ${EAR_Y + 3} Z`,
  };
}

/** Outward orc ears: nicked (notch in the back edge), smooth pointed, or droopy (tip hanging down). */
function orcEarPath(earX: number, style: AvatarOrcEars, female: boolean): EarPath {
  const lobeX = earX - 1.5;
  const lobeY = EAR_Y + 8;

  if (style === 'droopy') {
    const tipX = earX - (female ? 13 : 15);
    const tipY = EAR_Y + 1;
    return {
      outer:
        `M${earX + 4} ${EAR_Y - 7}` +
        ` C${earX - 4} ${EAR_Y - 11} ${tipX + 1} ${tipY - 9} ${tipX} ${tipY}` +
        ` C${tipX + 4} ${tipY + 5} ${earX - 7} ${EAR_Y + 7} ${lobeX - 1} ${lobeY + 1}` +
        ` Q${lobeX + 3} ${lobeY + 1.5} ${earX + 5} ${EAR_Y + 3} Z`,
      inner:
        `M${earX + 1} ${EAR_Y - 5}` +
        ` C${earX - 4} ${EAR_Y - 8} ${tipX + 4} ${tipY - 6} ${tipX + 4} ${tipY - 0.5}` +
        ` C${tipX + 7} ${tipY + 2} ${earX - 5} ${EAR_Y + 4} ${earX - 1} ${EAR_Y + 3} Z`,
    };
  }

  const tipX = earX - (style === 'pointed' ? (female ? 14 : 16) : female ? 12 : 14);
  const tipY = EAR_Y - (style === 'pointed' ? (female ? 13 : 15) : female ? 11 : 12);
  const backEdge =
    style === 'nicked'
      ? ` L${tipX + 4} ${tipY + 6} L${tipX + 2} ${tipY + 8} C${tipX + 5} ${EAR_Y + 1}`
      : ` C${tipX + 3} ${tipY + 8}`;
  return {
    outer:
      `M${earX + 4} ${EAR_Y - 7}` +
      ` C${earX - 2} ${EAR_Y - 9} ${tipX + 4} ${tipY + 1} ${tipX} ${tipY}` +
      backEdge +
      ` ${earX - 8} ${EAR_Y + 5} ${lobeX - 2} ${lobeY}` +
      ` Q${lobeX + 2} ${lobeY + 1.5} ${earX + 5} ${EAR_Y + 3} Z`,
    inner:
      `M${earX + 1} ${EAR_Y - 5}` +
      ` C${earX - 3} ${EAR_Y - 6} ${tipX + 6} ${tipY + 3} ${tipX + 4} ${tipY + 3}` +
      ` C${tipX + 7} ${EAR_Y - 1} ${earX - 5} ${EAR_Y + 2} ${earX - 1} ${EAR_Y + 3} Z`,
  };
}

/**
 * Race ears at the side of the head, drawn over the hair so the tips show through long
 * hairstyles. Androids get round receptor discs.
 */
export function AvatarRaceEars({
  race,
  ears,
  shape,
  skin,
  bodyType,
  glow,
}: {
  race: AvatarRace;
  /** Ear style id for elves and orcs (AvatarElfEars or AvatarOrcEars). */
  ears: AvatarElfEars | AvatarOrcEars;
  shape: AvatarHeadShape;
  skin: string;
  bodyType: AvatarBodyType;
  /** Android glow color. */
  glow: string;
}) {
  const female = bodyType === 'female';
  const earX = EAR_X[shape];

  if (race === 'android') {
    return (
      <Both>
        <Circle cx={earX} cy={EAR_Y + 1} r={7.2} fill={shadeColor(skin, -0.12)} stroke={shadeColor(skin, -0.42)} strokeWidth={0.9} />
        <Circle cx={earX} cy={EAR_Y + 1} r={4} fill={LENS} stroke={glow} strokeWidth={1.3} />
        <Circle cx={earX} cy={EAR_Y + 1} r={1.3} fill={glow} />
      </Both>
    );
  }

  const ear =
    race === 'elf'
      ? elfEarPath(earX, isElfEars(ears) ? ears : 'classic', female)
      : orcEarPath(earX, isOrcEars(ears) ? ears : 'nicked', female);

  return (
    <Both>
      <Path d={ear.outer} fill={skin} stroke={shadeColor(skin, -0.3)} strokeWidth={0.9} strokeLinejoin="round" />
      <Path d={ear.inner} fill={shadeColor(skin, -0.14)} />
    </Both>
  );
}

function isElfEars(value: string): value is AvatarElfEars {
  return value in ELF_EAR_SIZE;
}

function isOrcEars(value: string): value is AvatarOrcEars {
  return value === 'nicked' || value === 'pointed' || value === 'droopy';
}

/** Android face plating, drawn on the head under the face. */
function AndroidPlating({ plating, skin, glow }: { plating: AvatarAndroidPlating; skin: string; glow: string }) {
  const seam = shadeColor(skin, -0.32);
  if (plating === 'seams') {
    return (
      <G stroke={seam} strokeWidth={0.9} fill="none" strokeLinecap="round">
        <Path d="M80 50 Q100 45 120 50" />
        <Both>
          <Path d="M73.5 63 Q75 80 78.5 90 Q82.5 99 90 103.5" />
          <Circle cx={76.5} cy={58} r={1.1} fill={seam} stroke="none" />
        </Both>
      </G>
    );
  }

  if (plating === 'circuit') {
    // Glowing traces on one side of the face only.
    return (
      <G stroke={glow} strokeWidth={0.9} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.9}>
        <Path d="M71.5 81 H77 L81 77.5 H85" />
        <Path d="M72.5 89 H79 L83 93" />
        <Path d="M92 46 V52 L95.5 55.5" />
        <G fill={glow} stroke="none">
          <Circle cx={85.6} cy={77.5} r={1.2} />
          <Circle cx={83.5} cy={93.5} r={1.2} />
          <Circle cx={95.8} cy={56} r={1.2} />
        </G>
      </G>
    );
  }

  if (plating === 'jaw') {
    return (
      <Both>
        <Path d="M71 84 Q75.5 99 87 104.5 Q93.5 107.2 100 107.4" stroke={seam} strokeWidth={1.1} fill="none" />
        <Circle cx={74} cy={88.5} r={1.1} fill={seam} />
        <Circle cx={84} cy={101} r={1.1} fill={seam} />
      </Both>
    );
  }

  return null;
}

/**
 * Drawn on the head, under the face: the orc's heavy brow ridge, the elf's high cheekbones,
 * android plating.
 */
export function AvatarRaceUnderFace({
  race,
  skin,
  plating = 'none',
  glow = '#3EE2FF',
}: {
  race: AvatarRace;
  skin: string;
  plating?: AvatarAndroidPlating;
  glow?: string;
}) {
  if (race === 'android') {
    return <AndroidPlating plating={plating} skin={skin} glow={glow} />;
  }

  if (race === 'orc') {
    return (
      <Both>
        <Path d="M77 66 Q88 58 99 64 Q88 62.5 78 69 Z" fill={shadeColor(skin, -0.18)} opacity={0.75} />
      </Both>
    );
  }

  return (
    <Both>
      <Path
        d="M76 85 Q80 80.5 86 81.5"
        stroke={shadeColor(skin, 0.3)}
        strokeWidth={1.6}
        strokeLinecap="round"
        fill="none"
        opacity={0.7}
      />
    </Both>
  );
}

/** One lower tusk on the left side; `chipped` cuts the tip off flat. */
function tuskPath(half: number, tipY: number, chipped = false): string {
  const base = 102.5;
  if (chipped) {
    const cutY = tipY + 5;
    return `M${92 - half} ${base} Q${91.4} ${cutY + 2} ${91.7} ${cutY} L${93.1} ${cutY - 0.9} L${94} ${cutY + 0.6} Q${94.4 + half * 0.3} ${cutY + 3} ${93.5 + half} ${base} Z`;
  }
  return `M${92 - half} ${base} Q${91.5} ${tipY + 3} ${93} ${tipY} Q${94.5 + half * 0.3} ${tipY + 4} ${93.5 + half} ${base} Z`;
}

/** Android eyes over the drawn eyes, glowing in `glow`. */
function AndroidEyes({ eyes, skin, glow }: { eyes: AvatarAndroidEyes; skin: string; glow: string }) {
  const rim = shadeColor(skin, -0.45);
  if (eyes === 'visor') {
    return (
      <G>
        <Rect x={74} y={68.5} width={52} height={11} rx={5.5} fill={LENS} stroke={rim} strokeWidth={0.9} />
        <Path d="M79.5 74 H120.5" stroke={glow} strokeWidth={2.2} strokeLinecap="round" />
        <Path d="M80 71 H95" stroke="#FFFFFF" strokeWidth={0.9} strokeLinecap="round" opacity={0.35} />
      </G>
    );
  }

  if (eyes === 'optic') {
    // One eye replaced by a lens, the other glowing.
    return (
      <G>
        <Circle cx={88} cy={74} r={6.2} fill={LENS} stroke={rim} strokeWidth={1} />
        <Circle cx={88} cy={74} r={3.8} fill="none" stroke={glow} strokeWidth={1.4} />
        <Circle cx={88} cy={74} r={1.6} fill={glow} />
        <Circle cx={112} cy={74} r={4.6} fill={glow} opacity={0.25} />
        <Circle cx={112} cy={74} r={2.5} fill={glow} />
      </G>
    );
  }

  return (
    <Both>
      <Circle cx={88} cy={74} r={5.4} fill={glow} opacity={0.28} />
      <Circle cx={88} cy={74} r={3} fill={glow} />
      <Circle cx={87} cy={73} r={1} fill="#FFFFFF" />
    </Both>
  );
}

/** Drawn over the face: the orc's lower tusks (smaller for female avatars), android eyes. */
export function AvatarRaceOverFace({
  race,
  bodyType,
  tusks,
  skin = '#AFB8C4',
  androidEyes = 'glow',
  glow = '#3EE2FF',
}: {
  race: AvatarRace;
  bodyType: AvatarBodyType;
  tusks: AvatarTusks;
  skin?: string;
  androidEyes?: AvatarAndroidEyes;
  glow?: string;
}) {
  if (race === 'android') {
    return <AndroidEyes eyes={androidEyes} skin={skin} glow={glow} />;
  }

  if (race !== 'orc' || tusks === 'none') {
    return null;
  }

  const female = bodyType === 'female';
  const large = tusks === 'large';
  const tipY = large ? (female ? 91.5 : 88.5) : female ? 95.5 : 93.5;
  const half = large ? (female ? 2 : 2.6) : female ? 1.5 : 1.9;
  const props = { fill: TUSK, stroke: INK, strokeWidth: 0.8, strokeLinejoin: 'round' as const };

  if (tusks === 'broken') {
    // One whole tusk, one snapped off: drawn per side instead of mirrored.
    return (
      <G>
        <Path d={tuskPath(half, tipY)} {...props} />
        <G transform={MIRROR_TRANSFORM}>
          <Path d={tuskPath(half, tipY, true)} {...props} />
        </G>
      </G>
    );
  }

  return (
    <Both>
      <Path d={tuskPath(half, tipY)} {...props} />
    </Both>
  );
}
