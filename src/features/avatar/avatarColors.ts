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
