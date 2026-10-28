function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

/**
 * Lightens (amount > 0) or darkens (amount < 0) a #RRGGBB color.
 * amount is a fraction between -1 and 1.
 */
export function shadeColor(hex: string, amount: number): string {
  const value = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    return hex;
  }

  const channels = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
  const shaded = channels.map((channel) =>
    amount >= 0 ? channel + (255 - channel) * amount : channel * (1 + amount)
  );

  return `#${shaded.map((channel) => clampChannel(channel).toString(16).padStart(2, '0')).join('')}`;
}

/** Blends two #RRGGBB colors; t = 0 returns `from`, t = 1 returns `to`. */
export function mixColors(from: string, to: string, t: number): string {
  const parse = (hex: string) => {
    const value = hex.replace('#', '');
    return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
  };

  if (!/^#[0-9a-fA-F]{6}$/.test(from) || !/^#[0-9a-fA-F]{6}$/.test(to)) {
    return from;
  }

  const a = parse(from);
  const b = parse(to);
  return `#${a
    .map((channel, index) => clampChannel(channel + (b[index] - channel) * t).toString(16).padStart(2, '0'))
    .join('')}`;
}

function toRgb(hex: string): [number, number, number] | null {
  const value = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    return null;
  }
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16)) as [number, number, number];
}

/** Distance between two colors in RGB space (0 = identical, ~441 = black vs white). */
export function colorDistance(a: string, b: string): number {
  const ca = toRgb(a);
  const cb = toRgb(b);
  if (!ca || !cb) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.hypot(ca[0] - cb[0], ca[1] - cb[1], ca[2] - cb[2]);
}

/** Below this distance an item would blend into the background. */
const BLEND_DISTANCE = 80;

/**
 * Outline color for an item drawn over `background`, or undefined when the two
 * already contrast. Light items get a darker outline, dark items a lighter one.
 */
export function contrastOutline(fill: string, background: string): string | undefined {
  if (colorDistance(fill, background) > BLEND_DISTANCE) {
    return undefined;
  }
  const rgb = toRgb(fill);
  const luminance = rgb ? (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255 : 0;
  return luminance > 0.55 ? shadeColor(fill, -0.45) : shadeColor(fill, 0.5);
}
