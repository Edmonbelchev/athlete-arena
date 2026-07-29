/**
 * Load MediaPipe Tasks Vision from CDN (web only).
 * Metro cannot bundle @mediapipe/tasks-vision due to dynamic import() in its ESM bundle.
 *
 * The IIFE bundle attaches exports to global `Vision`:
 *   Vision.FilesetResolver, Vision.PoseLandmarker, ...
 */

const VISION_BUNDLE_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.js';
export const MEDIAPIPE_WASM_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm';
export const POSE_MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export interface MediaPipeNormalizedLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface WebPoseLandmarker {
  detectForVideo: (
    video: HTMLVideoElement,
    timestampMs: number,
  ) => { landmarks: MediaPipeNormalizedLandmark[][] };
  close: () => void;
}

interface MediaPipeVisionModule {
  FilesetResolver: {
    forVisionTasks: (wasmPath: string) => Promise<unknown>;
  };
  PoseLandmarker: {
    createFromOptions: (
      vision: unknown,
      options: {
        baseOptions: {
          modelAssetPath: string;
          delegate: 'GPU' | 'CPU';
        };
        runningMode: 'VIDEO' | 'IMAGE';
        numPoses?: number;
      },
    ) => Promise<WebPoseLandmarker>;
  };
}

declare global {
  interface Window {
    Vision?: MediaPipeVisionModule;
  }
}

let loadPromise: Promise<MediaPipeVisionModule> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

function getVisionModule(): MediaPipeVisionModule {
  const vision = typeof window !== 'undefined' ? window.Vision : undefined;

  if (!vision?.FilesetResolver || !vision?.PoseLandmarker) {
    throw new Error(
      'MediaPipe vision bundle loaded but Vision.FilesetResolver / Vision.PoseLandmarker were not found',
    );
  }

  return vision;
}

export function loadMediaPipeVision(): Promise<MediaPipeVisionModule> {
  if (!loadPromise) {
    loadPromise = loadScript(VISION_BUNDLE_URL)
      .then(() => getVisionModule())
      .catch((error) => {
        loadPromise = null;
        throw error;
      });
  }

  return loadPromise;
}

export async function createWebPoseLandmarker(): Promise<WebPoseLandmarker> {
  const { FilesetResolver, PoseLandmarker } = await loadMediaPipeVision();
  const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_PATH);

  try {
    return await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: POSE_MODEL_PATH,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
    });
  } catch {
    return PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: POSE_MODEL_PATH,
        delegate: 'CPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
    });
  }
}
