import { Circle, ClipPath, Defs, Ellipse, G, Path, Rect } from 'react-native-svg';

import { EAR_X, EAR_Y, EYE_X, EYE_Y, MIRROR_TRANSFORM, headPath } from '@/components/avatar/avatarGeometry';
import { contrastOutline, shadeColor } from '@/features/avatar/avatarColors';
import type {
  AvatarAccessoryStyles,
  AvatarBodyType,
  AvatarBrows,
  AvatarEyes,
  AvatarHeadShape,
  AvatarMouth,
  AvatarNose,
} from '@/types/avatar';

const INK = '#2B1D16';
const LIP = '#7A2E2E';
const TONGUE = '#E8737A';

/** Renders a left-side element and its mirrored right-side twin. */
export function Both({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <G transform={MIRROR_TRANSFORM}>{children}</G>
    </>
  );
}

function Mirrored({ children }: { children: React.ReactNode }) {
  return <G transform={MIRROR_TRANSFORM}>{children}</G>;
}

// Neck and shoulders ---------------------------------------------------------

export function AvatarNeck({ skin }: { skin: string }) {
  return (
    <>
      <Path
        d="M88 96 L112 96 L113 110 Q126 116 160 124 L160 140 L40 140 L40 124 Q74 116 87 110 Z"
        fill={shadeColor(skin, -0.08)}
      />
      <Path d="M88 104 Q100 116 112 104 L112 112 Q100 120 88 112 Z" fill={shadeColor(skin, -0.18)} opacity={0.3} />
    </>
  );
}

// Top (tee / hoodie) --------------------------------------------------------

/** Neckline shared by every top: dips below the neck at the center. */
const TOP_BODY = 'M36 142 L36 124 Q72 115 86 110 Q100 122 114 110 Q128 115 164 124 L164 142 Z';

/** Drawn when no top is equipped, so the shoulders are never bare. */
const DEFAULT_TOP: NonNullable<AvatarAccessoryStyles['top']> = {
  style: 'tee',
  colors: { primary: '#3B82F6', secondary: '#1D4ED8' },
};

export function AvatarTop({
  accessories,
  background,
  clipId,
}: {
  accessories: AvatarAccessoryStyles;
  /** Portrait background, so tops in a similar color get an outline instead of vanishing. */
  background: string;
  /** Unique id for clipping patterns to the shirt. */
  clipId: string;
}) {
  const { style, colors, pattern } = accessories.top ?? DEFAULT_TOP;
  const { primary, secondary } = colors;
  const seam = shadeColor(primary, -0.12);
  const outline = contrastOutline(primary, background);
  const body = <Path d={TOP_BODY} fill={primary} stroke={outline} strokeWidth={outline ? 2.5 : 0} />;
  const seams = (
    <>
      <Path d="M64 120 Q66 128 66 142" stroke={seam} strokeWidth={1.2} fill="none" />
      <Path d="M136 120 Q134 128 134 142" stroke={seam} strokeWidth={1.2} fill="none" />
    </>
  );

  // Chest details sit low in the visible strip, below the hood or collar.
  const detail =
    pattern === 'camo' ? (
      <>
        <Defs>
          <ClipPath id={clipId}>
            <Path d={TOP_BODY} />
          </ClipPath>
        </Defs>
        <G clipPath={`url(#${clipId})`}>
          <G fill={secondary}>
            <Path d="M40 122 Q50 114 60 120 Q66 128 56 132 Q44 134 40 122 Z" />
            <Path d="M78 128 Q88 120 96 128 Q98 138 86 138 Q76 136 78 128 Z" />
            <Path d="M118 118 Q130 112 138 120 Q140 130 128 130 Q116 128 118 118 Z" />
            <Path d="M146 130 Q156 124 164 132 L164 142 L148 142 Q140 138 146 130 Z" />
          </G>
          <G fill={shadeColor(primary, -0.35)}>
            <Path d="M58 126 Q66 120 74 126 Q76 134 66 136 Q56 134 58 126 Z" />
            <Path d="M100 124 Q110 118 116 126 Q118 134 108 136 Q98 134 100 124 Z" />
            <Path d="M132 128 Q140 124 146 130 Q146 138 138 138 Q130 136 132 128 Z" />
            <Path d="M36 134 Q44 130 50 136 L50 142 L36 142 Z" />
          </G>
        </G>
      </>
    ) : pattern === 'stripe' ? (
      <Path d="M36 129 Q72 122 100 124 Q128 122 164 129 L164 134 Q128 127 100 129 Q72 127 36 134 Z" fill={secondary} />
    ) : pattern === 'star' ? (
      <Path
        d="M120 124 L121.8 128 L126 128.4 L122.8 131.2 L123.8 135.4 L120 133.2 L116.2 135.4 L117.2 131.2 L114 128.4 L118.2 128 Z"
        fill="#FFFFFF"
        opacity={0.95}
      />
    ) : null;

  if (style === 'hoodie') {
    return (
      <>
        {body}
        {/* Hood lying around the neck */}
        <Path
          d="M73 119 Q73 102 87 98 L88 109 Q100 125 112 109 L113 98 Q127 102 127 119 Q114 126 100 126 Q86 126 73 119 Z"
          fill={secondary}
        />
        <Path d="M88 109 Q100 125 112 109" stroke={shadeColor(secondary, -0.2)} strokeWidth={1.5} fill="none" />
        <G stroke="#F8FAFC" strokeWidth={1.6} strokeLinecap="round">
          <Path d="M95 123 L94 134" />
          <Path d="M105 123 L106 134" />
        </G>
        {seams}
        {detail}
      </>
    );
  }

  return (
    <>
      {body}
      <Path
        d="M86 110 Q100 122 114 110"
        stroke={secondary}
        strokeWidth={3.5}
        strokeLinecap="round"
        fill="none"
      />
      {seams}
      {detail}
    </>
  );
}

// Glasses -------------------------------------------------------------------

export function AvatarGlasses({ accessories }: { accessories: AvatarAccessoryStyles }) {
  const glasses = accessories.glasses;
  if (!glasses) {
    return null;
  }

  const { primary: frame, secondary: lens } = glasses.colors;
  const arm = <Path d="M79 72 L69 70" stroke={frame} strokeWidth={2} strokeLinecap="round" />;

  switch (glasses.style) {
    case 'sunglasses':
      return (
        <>
          <Both>
            <Path d="M78 68 L98 68 L97 77 Q96 81 91 81 L84 81 Q79 81 78 76 Z" fill={lens} stroke={frame} strokeWidth={2} />
            <Path d="M82 71 L86 70" stroke="#FFFFFF" strokeWidth={1.4} strokeLinecap="round" opacity={0.7} />
            {arm}
          </Both>
          <Path d="M97 70 L103 70" stroke={frame} strokeWidth={2.4} />
        </>
      );
    case 'aviators':
      return (
        <>
          <Both>
            <Path
              d="M79 69 Q88 66 97 69 Q98 78 91 82 Q81 81 79 69 Z"
              fill={lens}
              fillOpacity={0.75}
              stroke={frame}
              strokeWidth={1.4}
            />
            {arm}
          </Both>
          <Path d="M97 69 Q100 67 103 69" stroke={frame} strokeWidth={1.4} fill="none" />
          <Path d="M96 72 L104 72" stroke={frame} strokeWidth={1.2} />
        </>
      );
    case 'square_glasses':
      return (
        <>
          <Both>
            <Rect x={79} y={67.5} width={18} height={13} rx={3} fill={lens} fillOpacity={0.18} stroke={frame} strokeWidth={2.2} />
            {arm}
          </Both>
          <Path d="M97 72 Q100 70 103 72" stroke={frame} strokeWidth={2} fill="none" />
        </>
      );
    default:
      return (
        <>
          <Both>
            <Circle cx={EYE_X} cy={EYE_Y} r={8.5} fill={lens} fillOpacity={0.15} stroke={frame} strokeWidth={2} />
            {arm}
          </Both>
          <Path d="M96.5 72.5 Q100 69.5 103.5 72.5" stroke={frame} strokeWidth={2} fill="none" />
        </>
      );
  }
}

// Head ----------------------------------------------------------------------

export function AvatarHeadShapePart({ shape, skin }: { shape: AvatarHeadShape; skin: string }) {
  const earX = EAR_X[shape];

  return (
    <>
      <Both>
        <Circle cx={earX} cy={EAR_Y} r={7.5} fill={skin} />
        <Circle cx={earX + 1} cy={EAR_Y} r={3.5} fill={shadeColor(skin, -0.12)} />
      </Both>
      <Path d={headPath(shape)} fill={skin} />
      <Both>
        <Circle cx={80} cy={88} r={5} fill="#F87171" opacity={0.18} />
      </Both>
    </>
  );
}

// Eyes ----------------------------------------------------------------------

type EyeSide = 'left' | 'right';

function Iris({ eyeColor, r = 3.4 }: { eyeColor: string; r?: number }) {
  const x = EYE_X;
  const y = EYE_Y;
  return (
    <>
      <Circle cx={x} cy={y} r={r} fill={eyeColor} />
      <Circle cx={x} cy={y} r={r * 0.47} fill="#111111" />
      <Circle cx={x + r * 0.35} cy={y - r * 0.35} r={r * 0.27} fill="#FFFFFF" />
    </>
  );
}

function ClosedEye() {
  const x = EYE_X;
  const y = EYE_Y;
  return (
    <Path
      d={`M${x - 5} ${y + 1} Q${x} ${y - 5} ${x + 5} ${y + 1}`}
      stroke={INK}
      strokeWidth={2.4}
      strokeLinecap="round"
      fill="none"
    />
  );
}

function RoundEye({ eyeColor }: { eyeColor: string }) {
  return (
    <>
      <Ellipse cx={EYE_X} cy={EYE_Y} rx={5} ry={5.5} fill="#FFFFFF" />
      <Iris eyeColor={eyeColor} />
    </>
  );
}

function Eye({
  eyes,
  eyeColor,
  skin,
  bodyType,
  side,
}: {
  eyes: AvatarEyes;
  eyeColor: string;
  skin: string;
  bodyType: AvatarBodyType;
  side: EyeSide;
}) {
  const x = EYE_X;
  const y = EYE_Y;
  const lash = bodyType === 'female' ? (
    <Path d={`M${x - 5.5} ${y - 2} L${x - 8.5} ${y - 4.5}`} stroke={INK} strokeWidth={1.4} strokeLinecap="round" />
  ) : null;

  switch (eyes) {
    case 'happy':
      return <ClosedEye />;
    case 'wink':
      return side === 'right' ? <ClosedEye /> : <RoundEye eyeColor={eyeColor} />;
    case 'almond':
      return (
        <>
          <Path d={`M${x - 6} ${y} Q${x} ${y - 6.5} ${x + 6} ${y} Q${x} ${y + 5} ${x - 6} ${y} Z`} fill="#FFFFFF" />
          <Iris eyeColor={eyeColor} />
          <Path
            d={`M${x - 6.5} ${y} Q${x} ${y - 7} ${x + 6.5} ${y}`}
            stroke={INK}
            strokeWidth={1.6}
            strokeLinecap="round"
            fill="none"
          />
          {lash}
        </>
      );
    case 'big':
      return (
        <>
          <Ellipse cx={x} cy={y} rx={6.5} ry={7} fill="#FFFFFF" />
          <Iris eyeColor={eyeColor} r={4.6} />
          {lash}
        </>
      );
    case 'narrow':
      return (
        <>
          <Path d={`M${x - 6} ${y} Q${x} ${y - 3.6} ${x + 6} ${y} Q${x} ${y + 3.2} ${x - 6} ${y} Z`} fill="#FFFFFF" />
          <Iris eyeColor={eyeColor} r={2.6} />
          <Path
            d={`M${x - 6.5} ${y} Q${x} ${y - 4.2} ${x + 6.5} ${y}`}
            stroke={INK}
            strokeWidth={1.6}
            strokeLinecap="round"
            fill="none"
          />
        </>
      );
    case 'lashes':
      return (
        <>
          <RoundEye eyeColor={eyeColor} />
          <G stroke={INK} strokeWidth={1.4} strokeLinecap="round">
            <Path d={`M${x - 4.5} ${y - 4} L${x - 7} ${y - 6.5}`} />
            <Path d={`M${x - 2} ${y - 5.2} L${x - 3.5} ${y - 8}`} />
            <Path d={`M${x + 1} ${y - 5.5} L${x + 0.5} ${y - 8.5}`} />
          </G>
        </>
      );
    case 'sleepy':
      return (
        <>
          <Ellipse cx={x} cy={y} rx={5} ry={5} fill="#FFFFFF" />
          <Iris eyeColor={eyeColor} />
          <Rect x={x - 6.5} y={y - 6.5} width={13} height={6.5} fill={skin} />
          <Path d={`M${x - 6} ${y} L${x + 6} ${y}`} stroke={INK} strokeWidth={1.8} strokeLinecap="round" />
        </>
      );
    case 'determined':
      // Lid slopes down toward the nose (inner corner is +x for the left eye).
      return (
        <>
          <Ellipse cx={x} cy={y} rx={5} ry={5.5} fill="#FFFFFF" />
          <Iris eyeColor={eyeColor} />
          <Path d={`M${x - 7} ${y - 8} L${x + 7} ${y - 8} L${x + 7} ${y - 0.5} L${x - 7} ${y - 3.5} Z`} fill={skin} />
          <Path d={`M${x - 6} ${y - 3.3} L${x + 6} ${y - 0.8}`} stroke={INK} strokeWidth={1.8} strokeLinecap="round" />
        </>
      );
    default:
      return (
        <>
          <RoundEye eyeColor={eyeColor} />
          {lash}
        </>
      );
  }
}

// Brows ---------------------------------------------------------------------

function Brow({ brows, color }: { brows: AvatarBrows; color: string }) {
  const x = EYE_X;
  const stroke = { stroke: color, strokeLinecap: 'round' as const, fill: 'none' };

  switch (brows) {
    case 'arched':
      return <Path d={`M${x - 6} 65 Q${x} 59.5 ${x + 6} 64`} strokeWidth={2.2} {...stroke} />;
    case 'thin':
      return <Path d={`M${x - 6} 64 Q${x} 61.5 ${x + 6} 63.5`} strokeWidth={1.4} {...stroke} />;
    case 'thick':
      return <Path d={`M${x - 7} 65 Q${x} 61.5 ${x + 6.5} 63.5`} strokeWidth={4.2} {...stroke} />;
    case 'bushy':
      return (
        <>
          <Path d={`M${x - 7.5} 65.5 Q${x} 60 ${x + 7} 63.5`} strokeWidth={5.5} {...stroke} />
          <Path d={`M${x - 6} 62.5 L${x - 7.5} 60.5 M${x - 2} 61 L${x - 3} 58.8`} strokeWidth={1.4} {...stroke} />
        </>
      );
    case 'raised':
      return <Path d={`M${x - 6} 62 Q${x} 55 ${x + 6} 60`} strokeWidth={2.2} {...stroke} />;
    case 'determined':
      return <Path d={`M${x - 6.5} 61 L${x + 6} 65.5`} strokeWidth={3} {...stroke} />;
    default:
      return <Path d={`M${x - 6} 64 L${x + 6} 63`} strokeWidth={2.6} {...stroke} />;
  }
}

// Nose ----------------------------------------------------------------------

function Nose({ nose, skin }: { nose: AvatarNose; skin: string }) {
  const shade = shadeColor(skin, -0.18);
  const line = { stroke: shade, strokeWidth: 1.8, strokeLinecap: 'round' as const, fill: 'none' };

  switch (nose) {
    case 'small':
      return <Ellipse cx={100} cy={88} rx={2.2} ry={1.6} fill={shade} />;
    case 'soft':
      return <Path d="M98 80 Q95.5 88 100 90 Q103 90 104 88" {...line} />;
    case 'pointed':
      return <Path d="M100 78 L95.5 89 Q100 92 104 89" strokeLinejoin="round" {...line} />;
    default:
      return <Ellipse cx={100} cy={88} rx={3.5} ry={2.6} fill={shade} />;
  }
}

// Mouth ---------------------------------------------------------------------

function Mouth({ mouth }: { mouth: AvatarMouth }) {
  const line = { stroke: LIP, strokeWidth: 2.4, strokeLinecap: 'round' as const, fill: 'none' };

  switch (mouth) {
    case 'grin':
      return (
        <>
          <Path d="M89 95 Q100 109 111 95 Z" fill={LIP} />
          <Path d="M91 96 Q100 98.5 109 96 L108 98.5 Q100 101 92 98.5 Z" fill="#FFFFFF" />
        </>
      );
    case 'laugh':
      return (
        <>
          <Path d="M88 94 L112 94 Q112 109 100 109 Q88 109 88 94 Z" fill={LIP} />
          <Rect x={89} y={94} width={22} height={4} rx={1.5} fill="#FFFFFF" />
          <Ellipse cx={100} cy={105} rx={6} ry={3} fill={TONGUE} />
        </>
      );
    case 'smirk':
      return <Path d="M92 99 Q101 101 109 94" {...line} />;
    case 'tongue':
      return (
        <>
          <Ellipse cx={101} cy={102} rx={4} ry={4.5} fill={TONGUE} />
          <Path d="M101 99 L101 104" stroke={shadeColor(TONGUE, -0.2)} strokeWidth={1} strokeLinecap="round" />
          <Path d="M90 96 Q100 102 110 96" {...line} />
        </>
      );
    case 'lips':
      return (
        <>
          <Path d="M90 97 Q95 93 100 95 Q105 93 110 97 Q100 99 90 97 Z" fill="#B9505F" />
          <Path d="M90 97 Q100 106 110 97 Q100 100 90 97 Z" fill="#CF6A7B" />
        </>
      );
    case 'neutral':
      return <Path d="M93 98 L107 98" {...line} />;
    case 'serious':
      return <Path d="M92 100 Q100 95.5 108 100" {...line} />;
    default:
      return <Path d="M91 96 Q100 104 109 96" {...line} />;
  }
}

export function AvatarFace({
  appearance,
  skin,
  eyeColor,
  hairColor,
}: {
  appearance: {
    bodyType: AvatarBodyType;
    eyes: AvatarEyes;
    brows: AvatarBrows;
    nose: AvatarNose;
    mouth: AvatarMouth;
  };
  skin: string;
  eyeColor: string;
  hairColor: string;
}) {
  const browColor = shadeColor(hairColor, -0.25);
  const eyeProps = { eyes: appearance.eyes, eyeColor, skin, bodyType: appearance.bodyType };

  return (
    <>
      <Eye {...eyeProps} side="left" />
      <Mirrored>
        <Eye {...eyeProps} side="right" />
      </Mirrored>
      <Both>
        <Brow brows={appearance.brows} color={browColor} />
      </Both>
      <Nose nose={appearance.nose} skin={skin} />
      <Mouth mouth={appearance.mouth} />
    </>
  );
}

// Accessories ---------------------------------------------------------------

/**
 * Hats with a crown (caps, bucket hats, beanies) draw it clipped to the head
 * outline, so the head never shows around it on any head shape. Brims and other
 * details are drawn over it, stretched per head shape with `fitTransform`.
 */
export function AvatarHeadwear({
  accessories,
  background,
  clipId,
  crownOutline,
  crownTop,
  fitTransform,
}: {
  accessories: AvatarAccessoryStyles;
  background: string;
  /** Clip that matches `crownOutline`. */
  clipId: string;
  /** Head outline grown slightly; the crown fills it above the hat line. */
  crownOutline: string;
  /** Top edge (y) of the crown, to sit buttons and pompoms on it. */
  crownTop: number;
  fitTransform: string;
}) {
  const headwear = accessories.headwear;
  if (!headwear) {
    return null;
  }

  const { primary, secondary } = headwear.colors;
  const outline = contrastOutline(primary, background);
  const edge = { stroke: outline, strokeWidth: outline ? 2.5 : 0 };

  /** Everything of the head above `bottom`, in the hat color. */
  const crown = (bottom: number, color: string, details?: React.ReactNode) => (
    <G clipPath={`url(#${clipId})`}>
      <Path d={`M20 0 H180 V${bottom} H20 Z`} fill={color} />
      {details}
      {outline ? <Path d={crownOutline} fill="none" stroke={outline} strokeWidth={5} /> : null}
    </G>
  );

  switch (headwear.style) {
    case 'crown':
      return (
        <G transform={fitTransform}>
          <Path
            d="M70 50 L68 26 L80 38 L90 20 L100 34 L110 20 L120 38 L132 26 L130 50 Q100 56 70 50 Z"
            fill={primary}
            {...edge}
          />
          <Path d="M70 50 Q100 56 130 50 L130 45 Q100 51 70 45 Z" fill={shadeColor(primary, -0.18)} />
          <Circle cx={100} cy={44} r={3.6} fill={secondary} />
          <Circle cx={84} cy={45} r={2.4} fill="#3B82F6" />
          <Circle cx={116} cy={45} r={2.4} fill="#10B981" />
          <G fill={shadeColor(primary, 0.35)}>
            <Circle cx={68} cy={26} r={2.6} />
            <Circle cx={90} cy={20} r={2.6} />
            <Circle cx={110} cy={20} r={2.6} />
            <Circle cx={132} cy={26} r={2.6} />
          </G>
        </G>
      );
    case 'cap':
      return (
        <>
          {crown(
            62,
            primary,
            <Path d="M100 0 L100 62" stroke={shadeColor(primary, -0.15)} strokeWidth={1.5} />,
          )}
          <G transform={fitTransform}>
            <Ellipse cx={100} cy={61} rx={38} ry={6.5} fill={secondary} {...edge} />
          </G>
          <Circle cx={100} cy={crownTop + 2.5} r={3} fill={shadeColor(primary, -0.15)} />
        </>
      );
    case 'cap_back':
      // Worn backwards: the adjuster opening faces forward, the brim sticks out behind.
      return (
        <>
          <Ellipse cx={100} cy={crownTop + 3} rx={18} ry={4} fill={shadeColor(primary, -0.3)} />
          {crown(
            58,
            primary,
            <>
              <Path d="M89 58 Q100 45 111 58 Z" fill={shadeColor(primary, -0.35)} />
              <Path d="M88 57 L112 57" stroke={shadeColor(primary, 0.3)} strokeWidth={2.5} strokeLinecap="round" />
            </>,
          )}
        </>
      );
    case 'bucket':
      return (
        <>
          {crown(
            54,
            primary,
            <Path d="M20 47 H180 V53 H20 Z" fill={secondary} />,
          )}
          <G transform={fitTransform}>
            <Path
              d="M56 63 Q60 50 72 50 L128 50 Q140 50 144 63 Q100 56 56 63 Z"
              fill={shadeColor(primary, -0.1)}
              {...edge}
            />
          </G>
        </>
      );
    case 'visor':
      return (
        <G transform={fitTransform}>
          <Rect x={67} y={49} width={66} height={8} rx={4} fill={secondary} {...edge} />
          <Path d="M72 56 Q100 50 128 56 Q127 66 100 67 Q73 66 72 56 Z" fill={primary} {...edge} />
          <Path d="M75 62 Q100 68 125 62" stroke={shadeColor(primary, -0.3)} strokeWidth={2} fill="none" />
        </G>
      );
    case 'beanie':
      return (
        <>
          {crown(
            62,
            primary,
            <G stroke={shadeColor(primary, -0.12)} strokeWidth={1.5}>
              {[80, 90, 100, 110, 120].map((x) => (
                <Path key={x} d={`M${x} 0 L${x} 54`} />
              ))}
            </G>,
          )}
          <G transform={fitTransform}>
            <Rect x={64} y={52} width={72} height={13} rx={6} fill={secondary} {...edge} />
          </G>
          <Circle cx={100} cy={crownTop - 4} r={7} fill={secondary} />
        </>
      );
    default:
      return (
        <G transform={fitTransform}>
          <Rect x={67} y={50} width={66} height={11} rx={5} fill={primary} {...edge} />
          <Rect x={67} y={54} width={66} height={3} fill={secondary} />
        </G>
      );
  }
}

export function AvatarEarrings({
  accessories,
  headShape,
}: {
  accessories: AvatarAccessoryStyles;
  headShape: AvatarHeadShape;
}) {
  const earrings = accessories.earrings;
  if (!earrings) {
    return null;
  }

  const { primary, secondary } = earrings.colors;
  const x = EAR_X[headShape] - 1.5;
  const y = EAR_Y + 7;

  let earring: React.ReactNode;
  switch (earrings.style) {
    case 'hoops':
      earring = <Circle cx={x} cy={y + 4.5} r={5.2} stroke={primary} strokeWidth={2.2} fill="none" />;
      break;
    case 'drops':
      earring = (
        <>
          <Circle cx={x} cy={y} r={2} fill={primary} />
          <Path d={`M${x} ${y} L${x} ${y + 5}`} stroke={primary} strokeWidth={1.2} />
          <Path d={`M${x} ${y + 4} Q${x + 4.5} ${y + 10} ${x} ${y + 13} Q${x - 4.5} ${y + 10} ${x} ${y + 4} Z`} fill={secondary} />
        </>
      );
      break;
    default:
      earring = (
        <>
          <Circle cx={x} cy={y} r={2.9} fill={primary} />
          <Circle cx={x + 0.9} cy={y - 0.9} r={1} fill="#FFFFFF" opacity={0.8} />
        </>
      );
  }

  return <Both>{earring}</Both>;
}
