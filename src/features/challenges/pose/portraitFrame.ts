import type { PoseLandmark } from './landmarks';
import { PoseLandmarkIndex } from './landmarks';

/**
 * Landscape → "virtual portrait" landmark conversion.
 *
 * Rep engines were tuned on portrait previews: x is a fraction of the short side,
 * y a fraction of the long side. The camera shows the same field of view rotated
 * in both orientations (cover-fit), so the landscape image is a crop of what a
 * portrait preview of the same phone would see, at the same pixels per meter.
 * Re-expressing landscape points in that portrait frame keeps every existing angle
 * and screen-fraction threshold meaning exactly what it means in portrait.
 *
 * The virtual frame is short side wide and long side tall, centered vertically on
 * the landscape view and horizontally on the body (a landscape view is wide, so the
 * user may stand off-center).
 */

export interface ViewSize {
  width: number;
  height: number;
}

/** Slow follow so body-centering never adds motion that rep engines could read as movement. */
const CENTER_FOLLOW_ALPHA = 0.04;

const CENTER_LANDMARKS = [
  PoseLandmarkIndex.LEFT_SHOULDER,
  PoseLandmarkIndex.RIGHT_SHOULDER,
  PoseLandmarkIndex.LEFT_HIP,
  PoseLandmarkIndex.RIGHT_HIP,
] as const;

function bodyCenterX(landmarks: PoseLandmark[]): number | null {
  const xs = CENTER_LANDMARKS.map((index) => landmarks[index])
    .filter((landmark) => landmark && (landmark.visibility ?? 1) >= 0.35)
    .map((landmark) => landmark.x);

  if (xs.length === 0) {
    return null;
  }

  return xs.reduce((sum, x) => sum + x, 0) / xs.length;
}

export function isLandscapeView(view: ViewSize | null | undefined): view is ViewSize {
  return Boolean(view && view.width > view.height && view.height > 0);
}

/** Maps landscape view-normalized landmarks into a portrait frame; tracks the body center between frames. */
export class PortraitFrameMapper {
  /** Body center in landscape view-normalized x, or null before the first body is seen. */
  private centerX: number | null = null;

  reset(): void {
    this.centerX = null;
  }

  map(landmarks: PoseLandmark[], view: ViewSize): PoseLandmark[] {
    if (landmarks.length === 0) {
      return landmarks;
    }

    const measuredCenter = bodyCenterX(landmarks);
    if (measuredCenter !== null) {
      this.centerX =
        this.centerX === null
          ? measuredCenter
          : this.centerX + (measuredCenter - this.centerX) * CENTER_FOLLOW_ALPHA;
    }

    const { width, height } = view;
    const centerPx = (this.centerX ?? 0.5) * width;
    // Portrait frame: width = landscape height (short side), height = landscape width (long side).
    const frameWidth = height;
    const frameHeight = width;
    const frameTop = (frameHeight - height) / 2;

    return landmarks.map((landmark) => ({
      ...landmark,
      x: (landmark.x * width - centerPx) / frameWidth + 0.5,
      y: (landmark.y * height + frameTop) / frameHeight,
    }));
  }
}

/** Converts a portrait-frame y (e.g. the pull-up bar line) back to landscape view-normalized y. */
export function portraitFrameYToView(y: number, view: ViewSize): number {
  const frameHeight = view.width;
  const frameTop = (frameHeight - view.height) / 2;
  return (y * frameHeight - frameTop) / view.height;
}

/** Width / height of the frame the engines see; portrait-shaped in both orientations. */
export function getPortraitFrameAspect(view: ViewSize | null | undefined): number {
  if (!view || view.width <= 0 || view.height <= 0) {
    return 9 / 19.5;
  }

  return Math.min(view.width, view.height) / Math.max(view.width, view.height);
}
