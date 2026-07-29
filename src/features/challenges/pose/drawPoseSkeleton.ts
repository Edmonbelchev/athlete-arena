import { isLandmarkDrawable, type PoseLandmark } from './landmarks';

/** MediaPipe BlazePose skeleton connections (33 landmarks). */
export const POSE_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 7],
  [0, 4],
  [4, 5],
  [5, 6],
  [6, 8],
  [9, 10],
  [11, 12],
  [11, 13],
  [13, 15],
  [15, 17],
  [15, 19],
  [15, 21],
  [17, 19],
  [12, 14],
  [14, 16],
  [16, 18],
  [16, 20],
  [16, 22],
  [18, 20],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [24, 26],
  [25, 27],
  [26, 28],
  [27, 29],
  [28, 30],
  [29, 31],
  [30, 32],
  [27, 31],
  [28, 32],
];

export interface SkeletonDrawStyle {
  lineColor: string;
  lineWidth: number;
  jointColor: string;
  jointRadius: number;
  minVisibility: number;
}

export const DEFAULT_SKELETON_STYLE: SkeletonDrawStyle = {
  lineColor: '#818CF8',
  lineWidth: 3,
  jointColor: '#FFFFFF',
  jointRadius: 4,
  minVisibility: 0.5,
};

function isVisible(landmark: PoseLandmark | undefined, minVisibility: number): landmark is PoseLandmark {
  return Boolean(landmark && (landmark.visibility ?? 1) >= minVisibility);
}

function toCanvasPoint(landmark: PoseLandmark, width: number, height: number) {
  return {
    x: landmark.x * width,
    y: landmark.y * height,
  };
}

export function syncCanvasToVideo(canvas: HTMLCanvasElement, video: HTMLVideoElement): void {
  const width = video.clientWidth;
  const height = video.clientHeight;

  if (width > 0 && height > 0 && (canvas.width !== width || canvas.height !== height)) {
    canvas.width = width;
    canvas.height = height;
  }
}

export function drawPoseSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: PoseLandmark[],
  width: number,
  height: number,
  style: SkeletonDrawStyle = DEFAULT_SKELETON_STYLE,
): void {
  ctx.clearRect(0, 0, width, height);

  ctx.strokeStyle = style.lineColor;
  ctx.lineWidth = style.lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const [startIndex, endIndex] of POSE_CONNECTIONS) {
    const start = landmarks[startIndex];
    const end = landmarks[endIndex];

    if (!isVisible(start, style.minVisibility) || !isVisible(end, style.minVisibility)) {
      continue;
    }

    const startPoint = toCanvasPoint(start, width, height);
    const endPoint = toCanvasPoint(end, width, height);

    ctx.beginPath();
    ctx.moveTo(startPoint.x, startPoint.y);
    ctx.lineTo(endPoint.x, endPoint.y);
    ctx.stroke();
  }

  ctx.fillStyle = style.jointColor;

  for (const landmark of landmarks) {
    if (!isLandmarkDrawable(landmark) || (landmark.visibility ?? 1) < style.minVisibility) {
      continue;
    }

    const point = toCanvasPoint(landmark, width, height);
    ctx.beginPath();
    ctx.arc(point.x, point.y, style.jointRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function clearPoseSkeleton(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.clearRect(0, 0, width, height);
}
