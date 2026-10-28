import { Circle, ClipPath, Defs, Ellipse, G, Path, Rect } from 'react-native-svg';

import { Both } from '@/components/avatar/AvatarHeadParts';
import { beardOutlinePath, hairOutlinePath, headPath } from '@/components/avatar/avatarGeometry';
import { mixColors, shadeColor } from '@/features/avatar/avatarColors';
import type { AvatarBodyType, AvatarFacialHair, AvatarHair, AvatarHeadShape } from '@/types/avatar';

/*
 * Hair and beards are built from the head outline so they fit every head shape:
 *
 *   cap    = region above a hairline, clipped to the head outline lifted by `outset`
 *   beard  = region below the cheeks, clipped to the head outline grown by `outset`
 *
 * Only volume that sticks out of the head (spikes, curls, buns, locks) is drawn
 * as free shapes; the portrait stretches those per head shape (headFitTransform).
 * Regions are drawn in canvas coordinates; anything outside the clip is ignored,
 * so they extend generously past the head.
 */

interface HairStyle {
  /** How far the hair rises above the crown (1 = flush with the skin); sides grow far less. */
  outset: number;
  /** Area covered by the cap. Omitted for no cap (bald). */
  cap?: string;
  /** Cap is short, shaved hair: hair color blended toward the skin. */
  shaved?: boolean;
  /** Details inside the cap (highlights, parting), clipped with it. */
  capDetail?: (color: string) => React.ReactNode;
  /** Second cap with its own outset, drawn over the first (e.g. longer hair on top of shaved sides). */
  overlay?: { outset: number; region: string; detail?: (color: string) => React.ReactNode };
  back?: (color: string) => React.ReactNode;
  front?: (color: string) => React.ReactNode;
}

const SLICKED_CAP = 'M20 0 H180 V72 H133 Q124 46 100 46 Q76 46 67 72 H20 Z';
const SHAVED_CAP = 'M20 0 H180 V70 H131 Q128 50 100 47 Q72 50 69 70 H20 Z';

function Shine({ color, d }: { color: string; d: string }) {
  return <Path d={d} stroke={shadeColor(color, 0.18)} strokeWidth={2.5} strokeLinecap="round" fill="none" />;
}

/** Body-specific variants of shared styles, e.g. the female short cut. */
type HairVariant = 'short_female';

const HAIR_STYLES: Record<AvatarHair | HairVariant, HairStyle> = {
  short_female: {
    outset: 1.1,
    // Swept fringe plus sides that run down the face edge, tucked behind the ears.
    cap: 'M20 0 H180 V94 H131 Q126 82 127 66 Q124 55 112 52 Q98 54 86 60 Q76 66 73 76 Q74 86 69 94 H20 Z',
    capDetail: (color) => (
      <>
        <G stroke={shadeColor(color, -0.28)} strokeWidth={1.3} strokeLinecap="round" fill="none">
          <Path d="M112 45 Q100 47 88 54" />
          <Path d="M122 47 Q112 50 102 52" />
        </G>
        <Shine color={color} d="M88 36 Q102 31 118 35" />
      </>
    ),
  },
  bald: { outset: 1 },
  buzz: { outset: 1.02, cap: SHAVED_CAP, shaved: true },
  short: {
    outset: 1.1,
    cap: 'M20 0 H180 V72 H131 Q131 58 124 53 Q114 50 106 53 L102 57 L98 53 L94 57 L90 53 Q82 50 76 53 Q69 58 69 72 H20 Z',
    capDetail: (color) => (
      <>
        <G stroke={shadeColor(color, -0.28)} strokeWidth={1.4} strokeLinecap="round" fill="none">
          <Path d="M84 42 Q87 38 92 37" />
          <Path d="M98 40 Q102 35 108 35" />
          <Path d="M112 43 Q116 39 120 40" />
          <Path d="M78 49 Q80 46 84 45" />
        </G>
        <Shine color={color} d="M90 30 Q102 27 114 30" />
      </>
    ),
  },
  side_part: {
    outset: 1.07,
    cap: 'M20 0 H180 V72 H133 Q132 57 122 53 Q104 51 86 53 Q74 55 67 72 H20 Z',
    overlay: {
      outset: 1.11,
      region: 'M84 0 H180 V66 H134 Q132 55 121 51 Q103 48 84 53 Z',
      detail: (color) => (
        <>
          <Path d="M84 30 L84 53" stroke={shadeColor(color, -0.35)} strokeWidth={1.6} strokeLinecap="round" />
          <Shine color={color} d="M92 36 Q108 31 124 38" />
        </>
      ),
    },
  },
  spiky: {
    outset: 1.05,
    cap: 'M20 0 H180 V70 H133 Q126 52 100 50 Q74 52 67 70 H20 Z',
    front: (color) => (
      <Path
        d="M70 46 Q66 38 72 34 L76 40 Q78 28 88 26 L90 34 Q96 20 106 22 L104 30 Q114 22 122 28 L118 34 Q130 34 131 44 L126 46 Z"
        fill={color}
      />
    ),
  },
  undercut: {
    outset: 1.01,
    cap: SHAVED_CAP,
    shaved: true,
    overlay: {
      outset: 1.12,
      region: 'M20 0 H180 V46 H134 Q124 40 112 44 Q98 50 86 50 Q76 50 68 54 L66 46 H20 Z',
      detail: (color) => <Shine color={color} d="M84 34 Q100 28 118 34" />,
    },
  },
  mohawk: {
    outset: 1.02,
    cap: SHAVED_CAP,
    shaved: true,
    front: (color) => <Path d="M91 48 L88 26 Q90 12 100 10 Q110 12 112 26 L109 48 Q100 44 91 48 Z" fill={color} />,
  },
  man_bun: {
    outset: 1.05,
    cap: SLICKED_CAP,
    back: (color) => <Circle cx={100} cy={28} r={10} fill={color} />,
    capDetail: (color) => <Shine color={color} d="M88 41 Q100 38 112 41" />,
  },
  curly: {
    outset: 1.08,
    cap: 'M20 0 H180 V72 H131 Q120 52 100 52 Q80 52 69 72 H20 Z',
    front: (color) => (
      <G fill={color}>
        <Circle cx={72} cy={57} r={11} />
        <Circle cx={80} cy={44} r={12} />
        <Circle cx={93} cy={36} r={12} />
        <Circle cx={107} cy={36} r={12} />
        <Circle cx={120} cy={44} r={12} />
        <Circle cx={128} cy={57} r={11} />
        <Circle cx={69} cy={68} r={7} />
        <Circle cx={131} cy={68} r={7} />
      </G>
    ),
  },
  afro: {
    outset: 1.06,
    cap: 'M20 0 H180 V74 H131 Q122 52 112 54 Q106 48 100 51 Q94 48 88 54 Q78 52 69 74 H20 Z',
    back: (color) => (
      <G fill={color}>
        <Circle cx={100} cy={58} r={36} />
        {Array.from({ length: 12 }, (_, index) => {
          const angle = (index * Math.PI) / 6;
          return <Circle key={index} cx={100 + Math.cos(angle) * 33} cy={58 + Math.sin(angle) * 33} r={13} />;
        })}
      </G>
    ),
  },
  dreads: {
    outset: 1.07,
    cap: 'M20 0 H180 V74 H134 Q128 52 100 50 Q72 52 66 74 H20 Z',
    capDetail: (color) => (
      <G stroke={shadeColor(color, -0.25)} strokeWidth={1.4} strokeLinecap="round" fill="none">
        {[78, 90, 100, 110, 122].map((x) => (
          <Path key={x} d={`M${x} ${x === 100 ? 34 : 38} Q${x + (x - 100) * 0.1} 44 ${x + (x - 100) * 0.15} 50`} />
        ))}
      </G>
    ),
    back: (color) => (
      <Both>
        <G stroke={color} strokeWidth={6.5} strokeLinecap="round" fill="none">
          {[
            { x: 66, bx: 54, end: 112 },
            { x: 72, bx: 61, end: 124 },
            { x: 78, bx: 68, end: 118 },
            { x: 84, bx: 76, end: 128 },
          ].map(({ x, bx, end }) => (
            <Path key={x} d={`M${x} 52 Q${bx - 2} 84 ${bx} ${end}`} />
          ))}
        </G>
      </Both>
    ),
    front: (color) => (
      <Both>
        <G stroke={shadeColor(color, -0.12)} strokeWidth={5} strokeLinecap="round" fill="none">
          <Path d="M68 58 Q62 80 63 102" />
        </G>
      </Both>
    ),
  },
  pixie: {
    outset: 1.07,
    cap: 'M20 0 H180 V78 H134 Q130 60 126 54 Q110 64 90 52 Q78 60 72 78 H20 Z',
    capDetail: (color) => <Shine color={color} d="M90 40 Q104 36 118 41" />,
  },
  bob: {
    outset: 1.08,
    cap: 'M20 0 H180 V84 H133 L133 62 Q116 57 100 59 Q84 57 67 62 L67 84 H20 Z',
    back: (color) => (
      <Path d="M62 70 Q60 30 100 30 Q140 30 138 70 L140 110 Q128 116 116 110 L84 110 Q72 116 60 110 Z" fill={color} />
    ),
    front: (color) => (
      <Both>
        <Path d="M64 66 Q62 92 66 110 L74 110 Q70 90 72 70 Z" fill={color} />
      </Both>
    ),
  },
  long: {
    outset: 1.07,
    cap: 'M20 0 H180 V80 H133 Q126 50 108 46 Q92 62 67 80 H20 Z',
    back: (color) => (
      <Path d="M64 66 Q60 26 100 26 Q140 26 136 66 L138 140 Q120 148 100 146 Q80 148 62 140 Z" fill={color} />
    ),
    front: (color) => (
      <Both>
        <Path d="M66 70 Q60 104 64 140 Q71 146 78 139 Q73 108 75 80 Z" fill={color} />
      </Both>
    ),
  },
  wavy: {
    outset: 1.07,
    cap: 'M20 0 H180 V84 H134 Q132 56 118 46 Q108 40 100 40 Q92 40 82 46 Q68 56 66 84 H20 Z',
    capDetail: (color) => (
      <Path d="M100 30 L100 40" stroke={shadeColor(color, -0.3)} strokeWidth={1.5} strokeLinecap="round" />
    ),
    back: (color) => (
      <Path
        d="M64 66 Q60 26 100 26 Q140 26 136 66 Q142 84 136 100 Q144 118 138 136 Q120 146 100 144 Q80 146 62 136 Q56 118 64 100 Q58 84 64 66 Z"
        fill={color}
      />
    ),
    front: (color) => (
      <Both>
        <Path d="M66 68 Q60 86 65 104 Q59 122 65 140 Q70 144 75 140 Q71 122 75 106 Q71 88 72 74 Z" fill={color} />
      </Both>
    ),
  },
  ponytail: {
    outset: 1.05,
    cap: SLICKED_CAP,
    back: (color) => (
      <>
        <Path d="M120 40 Q152 46 149 98 Q147 122 136 130 Q141 100 132 80 Q128 60 114 52 Z" fill={color} />
        <Circle cx={124} cy={46} r={4.5} fill={shadeColor(color, -0.3)} />
      </>
    ),
    capDetail: (color) => <Shine color={color} d="M88 41 Q100 38 112 41" />,
  },
  high_ponytail: {
    outset: 1.05,
    cap: SLICKED_CAP,
    back: (color) => (
      <>
        <Path d="M96 32 Q92 6 114 10 Q138 18 142 64 Q143 84 134 96 Q134 62 122 40 Q114 30 104 32 Z" fill={color} />
        <Circle cx={102} cy={31} r={4.5} fill={shadeColor(color, -0.3)} />
      </>
    ),
    capDetail: (color) => <Shine color={color} d="M88 41 Q100 38 112 41" />,
  },
  bun: {
    outset: 1.05,
    cap: SLICKED_CAP,
    back: (color) => (
      <>
        <Circle cx={100} cy={26} r={15} fill={color} />
        <Path d="M88 36 Q100 42 112 36" stroke={shadeColor(color, -0.3)} strokeWidth={2} fill="none" />
      </>
    ),
    capDetail: (color) => <Shine color={color} d="M88 41 Q100 38 112 41" />,
  },
  space_buns: {
    outset: 1.05,
    cap: SLICKED_CAP,
    back: (color) => (
      <Both>
        <Circle cx={74} cy={36} r={13} fill={color} />
        <Path d="M66 40 Q74 46 82 42" stroke={shadeColor(color, -0.3)} strokeWidth={1.6} fill="none" />
      </Both>
    ),
    capDetail: (color) => <Shine color={color} d="M88 41 Q100 38 112 41" />,
  },
  braids: {
    outset: 1.05,
    cap: SLICKED_CAP,
    capDetail: (color) => <Path d="M100 30 L100 46" stroke={shadeColor(color, -0.3)} strokeWidth={1.5} />,
    front: (color) => {
      const dark = shadeColor(color, -0.3);
      return (
        <>
          <Both>
            <G fill={color}>
              {[71, 82, 93, 104, 115].map((cy) => (
                <Ellipse key={cy} cx={66} cy={cy} rx={6.5} ry={7} />
              ))}
            </G>
            <G stroke={dark} strokeWidth={1.2} fill="none">
              {[76, 87, 98, 109].map((y) => (
                <Path key={y} d={`M61 ${y} Q66 ${y + 2.5} 71 ${y}`} />
              ))}
            </G>
            <Rect x={62} y={121} width={8} height={4} rx={2} fill={dark} />
          </Both>
        </>
      );
    },
  },
};

function hairStyleFor(hair: AvatarHair, bodyType: AvatarBodyType): HairStyle {
  if (hair === 'short' && bodyType === 'female') {
    return HAIR_STYLES.short_female;
  }
  return HAIR_STYLES[hair];
}

export function hairClipScale(hair: AvatarHair, bodyType: AvatarBodyType): number {
  return hairStyleFor(hair, bodyType).outset;
}

/** Hair drawn behind the head. */
export function AvatarHairBack({
  hair,
  bodyType,
  color,
}: {
  hair: AvatarHair;
  bodyType: AvatarBodyType;
  color: string;
}) {
  return <>{hairStyleFor(hair, bodyType).back?.(color) ?? null}</>;
}

/** Hair cap following the head outline; clipped by the portrait's hair clip. */
export function AvatarHairCap({
  hair,
  bodyType,
  headShape,
  color,
  skin,
  clipId,
}: {
  hair: AvatarHair;
  bodyType: AvatarBodyType;
  headShape: AvatarHeadShape;
  color: string;
  skin: string;
  clipId: string;
}) {
  const style = hairStyleFor(hair, bodyType);
  if (!style.cap) {
    return null;
  }

  const fill = style.shaved ? mixColors(color, skin, 0.35) : color;
  const overlay = style.overlay;
  const overlayClipId = `${clipId}overlay`;

  return (
    <>
      <G clipPath={`url(#${clipId})`}>
        <Path d={style.cap} fill={fill} />
        {style.capDetail?.(color)}
      </G>
      {overlay ? (
        <>
          <Defs>
            <ClipPath id={overlayClipId}>
              <Path d={hairOutlinePath(headShape, overlay.outset)} />
            </ClipPath>
          </Defs>
          <G clipPath={`url(#${overlayClipId})`}>
            <Path d={overlay.region} fill={color} />
            {overlay.detail?.(color)}
          </G>
        </>
      ) : null}
    </>
  );
}

/** Hair volume drawn over the head. */
export function AvatarHairFront({
  hair,
  bodyType,
  color,
}: {
  hair: AvatarHair;
  bodyType: AvatarBodyType;
  color: string;
}) {
  return <>{hairStyleFor(hair, bodyType).front?.(color) ?? null}</>;
}

// Facial hair ---------------------------------------------------------------

interface BeardStyle {
  /** How far the beard hangs below the chin (1 = flush with the skin); sides grow far less. */
  outset: number;
  /** Extra area added to the beard clip, e.g. a beard hanging below the chin. */
  drape?: string;
  /** Area covered below the cheeks; clipped by the portrait's beard clip. */
  region?: string;
  /** Draw the head outline as a band along the jaw instead of filling a region. */
  jawBand?: boolean;
  opacity?: number;
  mustache?: 'regular' | 'handlebar';
  /** Free shapes (not clipped). */
  extra?: (color: string) => React.ReactNode;
}

// Mustaches sit between the nose (bottom ~91) and the mouth (top ~94).
const MUSTACHE = 'M88 92 Q94 87.5 100 89.5 Q106 87.5 112 92 Q106 94.5 100 93 Q94 94.5 88 92 Z';
const HANDLEBAR =
  'M84 88 Q83 94 89 93.5 Q95 93 100 92 Q105 93 111 93.5 Q117 94 116 88 Q114 91 110 90.5 Q105 87.5 100 89.5 Q95 87.5 90 90.5 Q86 91 84 88 Z';

/** Opening around the mouth so lips stay on skin instead of sinking into the beard. */
const MOUTH_OPENING = 'M87 99.5 Q87 93 100 93 Q113 93 113 99.5 Q113 106 100 106 Q87 106 87 99.5 Z';
const BEARD_REGION = `M20 78 H60 Q72 94 84 93 Q100 89 116 93 Q128 94 140 78 H180 V180 H20 Z ${MOUTH_OPENING}`;

/** Lower part of the face (below the cheeks), used to keep jaw bands off the forehead. */
export const JAW_CLIP_RECT = { x: 20, y: 84, width: 160, height: 100 } as const;

const BEARD_STYLES: Record<AvatarFacialHair, BeardStyle> = {
  none: { outset: 1 },
  stubble: {
    outset: 1,
    opacity: 0.3,
    region: `M20 84 H64 Q76 94 86 93 Q100 90 114 93 Q124 94 136 84 H180 V180 H20 Z ${MOUTH_OPENING}`,
  },
  mustache: { outset: 1, mustache: 'regular' },
  handlebar: { outset: 1, mustache: 'handlebar' },
  goatee: {
    outset: 1.12,
    mustache: 'regular',
    region: 'M93 106 Q100 104.5 107 106 L107 111 Q100 118 93 111 Z',
  },
  soul_patch: {
    outset: 1,
    extra: (color) => <Path d="M97.5 105.5 L102.5 105.5 L100 110.5 Z" fill={color} />,
  },
  chinstrap: { outset: 1.03, jawBand: true },
  beard: { outset: 1.07, mustache: 'regular', region: BEARD_REGION },
  full_beard: {
    outset: 1.07,
    mustache: 'regular',
    region: BEARD_REGION,
    drape: 'M80 100 Q79 122 100 132 Q121 122 120 100 Z',
  },
};

export function beardClipPaths(facialHair: AvatarFacialHair, headShape: AvatarHeadShape): string[] {
  const style = BEARD_STYLES[facialHair];
  const outline = beardOutlinePath(headShape, style.outset);
  return style.drape ? [outline, style.drape] : [outline];
}

export function AvatarFacialHair({
  facialHair,
  headShape,
  color,
  clipId,
  jawClipId,
}: {
  facialHair: AvatarFacialHair;
  headShape: AvatarHeadShape;
  color: string;
  clipId: string;
  jawClipId: string;
}) {
  const style = BEARD_STYLES[facialHair];

  return (
    <>
      {style.extra?.(color)}
      {style.region ? (
        <Path
          d={style.region}
          fill={color}
          fillRule="evenodd"
          opacity={style.opacity}
          clipPath={`url(#${clipId})`}
        />
      ) : null}
      {style.jawBand ? (
        <G clipPath={`url(#${jawClipId})`}>
          <Path
            d={headPath(headShape)}
            stroke={color}
            strokeWidth={9}
            fill="none"
            clipPath={`url(#${clipId})`}
          />
        </G>
      ) : null}
      {style.mustache ? <Path d={style.mustache === 'handlebar' ? HANDLEBAR : MUSTACHE} fill={color} /> : null}
    </>
  );
}
