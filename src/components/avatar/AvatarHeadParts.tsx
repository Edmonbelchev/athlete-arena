import { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import { EAR_X, EAR_Y, EYE_X, EYE_Y, MIRROR_TRANSFORM, headPath } from '@/components/avatar/avatarGeometry';
import { shadeColor } from '@/features/avatar/avatarColors';
import type {
  AvatarAccessoryStyles,
  AvatarBodyType,
  AvatarBrows,
  AvatarEyes,
  AvatarHeadShape,
  AvatarMouth,
  AvatarNose,
  WearableColors,
  WearableStyle,
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
const DEFAULT_TOP: { style: WearableStyle; colors: WearableColors } = {
  style: 'tee',
  colors: { primary: '#3B82F6', secondary: '#1D4ED8' },
};

export function AvatarTop({ accessories }: { accessories: AvatarAccessoryStyles }) {
  const { style, colors } = accessories.top ?? DEFAULT_TOP;
  const { primary, secondary } = colors;
  const seam = shadeColor(primary, -0.12);

  if (style === 'hoodie') {
    return (
      <>
        <Path d={TOP_BODY} fill={primary} />
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
        <Path d="M64 120 Q66 128 66 142" stroke={seam} strokeWidth={1.2} fill="none" />
        <Path d="M136 120 Q134 128 134 142" stroke={seam} strokeWidth={1.2} fill="none" />
      </>
    );
  }

  return (
    <>
      <Path d={TOP_BODY} fill={primary} />
      <Path
        d="M86 110 Q100 122 114 110"
        stroke={secondary}
        strokeWidth={3.5}
        strokeLinecap="round"
        fill="none"
      />
      <Path d="M64 120 Q67 128 67 142" stroke={seam} strokeWidth={1.2} fill="none" />
      <Path d="M136 120 Q133 128 133 142" stroke={seam} strokeWidth={1.2} fill="none" />
    </>
  );
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

export function AvatarHeadwear({ accessories }: { accessories: AvatarAccessoryStyles }) {
  const headwear = accessories.headwear;
  if (!headwear) {
    return null;
  }

  const { primary, secondary } = headwear.colors;

  switch (headwear.style) {
    case 'cap':
      return (
        <>
          <Path d="M67 60 Q67 26 100 26 Q133 26 133 60 Z" fill={primary} />
          <Path d="M100 26 L100 60" stroke={shadeColor(primary, -0.15)} strokeWidth={1.5} />
          <Circle cx={100} cy={27} r={3} fill={shadeColor(primary, -0.15)} />
          <Ellipse cx={100} cy={61} rx={38} ry={6.5} fill={secondary} />
        </>
      );
    case 'beanie':
      return (
        <>
          <Path d="M66 62 Q64 22 100 22 Q136 22 134 62 Z" fill={primary} />
          <G stroke={shadeColor(primary, -0.12)} strokeWidth={1.5}>
            {[80, 90, 100, 110, 120].map((x) => (
              <Path key={x} d={`M${x} ${x === 100 ? 23 : 26} L${x} 54`} />
            ))}
          </G>
          <Rect x={64} y={52} width={72} height={13} rx={6} fill={secondary} />
          <Circle cx={100} cy={19} r={7} fill={secondary} />
        </>
      );
    default:
      return (
        <>
          <Rect x={67} y={50} width={66} height={11} rx={5} fill={primary} />
          <Rect x={67} y={54} width={66} height={3} fill={secondary} />
        </>
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
