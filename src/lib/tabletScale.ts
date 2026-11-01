import { Dimensions, Platform, StyleSheet } from 'react-native';

/**
 * Tablet scaling: on iPad the whole UI is drawn ~1.25-1.4x larger, so the phone layout fills the
 * screen like a big phone instead of a narrow strip.
 *
 * Every numeric size in a style (text, spacing, widths, radii, offsets) is multiplied as it is sent
 * to the native view, so layout happens at the larger size and text stays sharp (a zoom transform
 * on the root would blur it). Borders stay thin.
 *
 * Values that come from the screen in real points (onLayout, useWindowDimensions) are already full
 * size; divide them by UI_SCALE (see toLayoutUnits) before putting them back into a style.
 */

/** Phone-sized layout width the tablet screen is scaled from. */
const DESIGN_WIDTH = 600;
const MAX_SCALE = 1.4;

function computeScale(): number {
  if (Platform.OS !== 'ios' || !(Platform as { isPad?: boolean }).isPad) {
    return 1;
  }
  const { width, height } = Dimensions.get('screen');
  const shortSide = Math.min(width, height);
  return Math.min(MAX_SCALE, Math.max(1, shortSide / DESIGN_WIDTH));
}

export const UI_SCALE = computeScale();
export const IS_SCALED_TABLET = UI_SCALE > 1;

/** Converts real screen points (onLayout, window size) into style units. */
export function toLayoutUnits(points: number): number {
  return points / UI_SCALE;
}

/** Style width that fills the screen on tablets once scaled (portrait only). */
export function fullScreenLayoutWidth(): number {
  const { width, height } = Dimensions.get('screen');
  return toLayoutUnits(Math.min(width, height));
}

const SCALED_LENGTHS = [
  'width',
  'height',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
  'flexBasis',
  'top',
  'bottom',
  'left',
  'right',
  'start',
  'end',
  'inset',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginStart',
  'marginEnd',
  'marginHorizontal',
  'marginVertical',
  'padding',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingStart',
  'paddingEnd',
  'paddingHorizontal',
  'paddingVertical',
  'gap',
  'rowGap',
  'columnGap',
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'fontSize',
  'lineHeight',
  'letterSpacing',
  'shadowRadius',
  'textShadowRadius',
];

function scaleLength(value: unknown): unknown {
  return typeof value === 'number' ? value * UI_SCALE : value;
}

function scaleSize(value: unknown): unknown {
  if (value && typeof value === 'object' && 'width' in value && 'height' in value) {
    const size = value as { width: unknown; height: unknown };
    return { width: scaleLength(size.width), height: scaleLength(size.height) };
  }
  return value;
}

const TRANSLATIONS = new Set(['translateX', 'translateY']);

function scaleTransform(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value;
  }
  return value.map((entry) => {
    if (!entry || typeof entry !== 'object') {
      return entry;
    }
    const [key] = Object.keys(entry);
    if (!TRANSLATIONS.has(key)) {
      return entry;
    }
    return { [key]: scaleLength((entry as Record<string, unknown>)[key]) };
  });
}

let installed = false;

/** Installs the style preprocessors. Call once, before the first render. */
export function installTabletScale(): void {
  if (installed || !IS_SCALED_TABLET) {
    return;
  }
  installed = true;

  // Not public API (no types, native only): read to skip unknown properties and to find the
  // built-in transform preprocessor, so translations can be scaled on top of it.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const attributes = require('react-native/Libraries/Components/View/ReactNativeStyleAttributes')
    .default as Record<string, unknown>;
  for (const property of SCALED_LENGTHS) {
    if (property in attributes) {
      StyleSheet.setStyleAttributePreprocessor(property, scaleLength);
    }
  }
  StyleSheet.setStyleAttributePreprocessor('shadowOffset', scaleSize);
  StyleSheet.setStyleAttributePreprocessor('textShadowOffset', scaleSize);

  const transform = attributes.transform as { process?: (value: unknown) => unknown } | true | undefined;
  const processTransform = typeof transform === 'object' ? transform.process : undefined;
  StyleSheet.setStyleAttributePreprocessor('transform', (value) => {
    const scaled = scaleTransform(value);
    return processTransform ? processTransform(scaled) : scaled;
  });
}
