import type { AvatarBodyType, AvatarHeadShape } from '@/types/avatar';

/**
 * Avatar art template. Parts are drawn facing forward on a canvas centered on
 * x = 100. Paths describe the LEFT side of the face; the right side is the same
 * path mirrored with MIRROR_TRANSFORM.
 *
 * Anchors:
 *   head      center (100, 72), top ~36, chin ~108
 *   eyes      (88, 74) / (112, 74)
 *   brows     y ~63
 *   nose      y ~86-90
 *   mouth     y ~95-104
 *   ears      x per head shape (EAR_X), y 77; lobes y ~84
 *
 * New art (hand-drawn or commissioned) must keep these anchors so it lines up
 * with existing parts.
 */

/** Mirrors a left-side path to the right side of the face. */
export const MIRROR_TRANSFORM = 'matrix(-1 0 0 1 200 0)';

/** Visible square of the canvas: head, neck and a hint of shoulders. */
export const PORTRAIT_VIEWBOX = { x: 36, y: 6, size: 128 } as const;

/** Close-up of the face, used for option previews (eyes, mouth, beard...). */
export const FACE_VIEWBOX = { x: 58, y: 50, size: 84 } as const;

/** Female shoulders (neck + top) are drawn narrower around the center line. */
export function shoulderTransform(bodyType: AvatarBodyType): string | undefined {
  return bodyType === 'female' ? 'matrix(0.86 0 0 1 14 0)' : undefined;
}

export const EYE_X = 88;
export const EYE_Y = 74;
export const EAR_Y = 77;

export const EAR_X: Record<AvatarHeadShape, number> = {
  oval: 70,
  round: 68,
  square: 70,
  long: 73,
};

/**
 * Hair volume (spikes, curls, buns, locks) and headwear are drawn for the oval
 * head. Other shapes stretch them horizontally (sx) and shift them down (dy).
 * Hair caps and beards don't need this: they are clipped to the head outline.
 */
const HEAD_FIT: Record<AvatarHeadShape, { sx: number; dy: number }> = {
  oval: { sx: 1, dy: 0 },
  round: { sx: 1.07, dy: 3 },
  square: { sx: 1.02, dy: 1 },
  long: { sx: 0.9, dy: 0 },
};

export function headFitTransform(shape: AvatarHeadShape): string {
  const { sx, dy } = HEAD_FIT[shape];
  return `matrix(${sx} 0 0 1 ${100 * (1 - sx)} ${dy})`;
}

const HEAD_ORIGIN = { x: 100, y: 72 };

function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  return `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
}

/** Scales every absolute "x y" pair of an M/L/Q path around (ox, oy). */
function scalePath(d: string, sx: number, sy: number, ox: number, oy: number): string {
  return d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x: string, y: string) => {
    const px = ox + (Number(x) - ox) * sx;
    const py = oy + (Number(y) - oy) * sy;
    return `${Math.round(px * 100) / 100} ${Math.round(py * 100) / 100}`;
  });
}

function scaledHeadPath(shape: AvatarHeadShape, sx: number, sy: number, ox: number, oy: number): string {
  const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
    ellipsePath(ox + (cx - ox) * sx, oy + (cy - oy) * sy, rx * sx, ry * sy);

  switch (shape) {
    case 'round':
      return ellipse(100, 74, 32, 34);
    case 'long':
      return ellipse(100, 73, 27, 38);
    case 'square':
      return scalePath(
        'M70 54 Q70 38 86 38 L114 38 Q130 38 130 54 L130 84 Q130 108 100 108 Q70 108 70 84 Z',
        sx,
        sy,
        ox,
        oy
      );
    default:
      return ellipse(100, 72, 30, 36);
  }
}

/**
 * Head outline as a path. `scale` grows or shrinks it around `origin`
 * (default: head center), which is how beards get volume.
 */
export function headPath(
  shape: AvatarHeadShape,
  scale = 1,
  origin: { x: number; y: number } = HEAD_ORIGIN
): string {
  return scaledHeadPath(shape, scale, scale, origin.x, origin.y);
}

/**
 * Outline a hair cap is clipped to. `volume` lifts the hair above the crown;
 * the sides grow much less so hair hugs the head at the temples instead of
 * sticking out past it.
 */
/** Top of the head (y) for each shape. */
const HEAD_TOP: Record<AvatarHeadShape, number> = { oval: 36, round: 40, square: 38, long: 35 };

/** Top edge (y) of hairOutlinePath, e.g. to sit a pompom on a hat crown. */
export function hairOutlineTop(shape: AvatarHeadShape, volume: number): number {
  return 104 - (104 - HEAD_TOP[shape]) * volume;
}

export function hairOutlinePath(shape: AvatarHeadShape, volume: number): string {
  const sy = volume;
  const sx = 1 + (volume - 1) * 0.3;
  return scaledHeadPath(shape, sx, sy, 100, 104);
}

/**
 * Outline a beard is clipped to. `volume` lets the beard hang below the chin;
 * the sides grow much less so it stays on the jawline.
 */
export function beardOutlinePath(shape: AvatarHeadShape, volume: number): string {
  const sy = volume;
  const sx = 1 + (volume - 1) * 0.25;
  return scaledHeadPath(shape, sx, sy, 100, 60);
}
