import { Dimensions } from 'react-native';

/**
 * Web: no tablet scaling (the browser handles zoom). Same API as tabletScale.ts, which reads a
 * native-only React Native module that react-native-web doesn't have.
 */
export const UI_SCALE = 1;
export const IS_SCALED_TABLET = false;

export function toLayoutUnits(points: number): number {
  return points;
}

export function fullScreenLayoutWidth(): number {
  const { width, height } = Dimensions.get('screen');
  return Math.min(width, height);
}

export function installTabletScale(): void {}
