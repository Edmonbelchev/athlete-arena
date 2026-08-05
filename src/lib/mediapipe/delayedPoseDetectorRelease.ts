import { Platform } from 'react-native';

/** Must exceed worst-case MediaPipe frame latency on iOS CPU delegate. */
export const POSE_DETECTOR_RELEASE_DELAY_MS = 850;

type ReleaseDetector = (handle: number) => void;

interface MediapipeNativeModule {
  releaseDetector: ReleaseDetector;
  __delayedReleasePatched?: boolean;
}

let installed = false;

/** Defer native detector release so in-flight TaskRunner callbacks can finish. */
export function installDelayedPoseDetectorRelease(): void {
  if (installed || Platform.OS === 'web') {
    return;
  }

  installed = true;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const moduleRef = require('react-native-mediapipe-posedetection/lib/module/NativeMediapipePosedetection.js')
      .default as MediapipeNativeModule | undefined;

    if (!moduleRef?.releaseDetector || moduleRef.__delayedReleasePatched) {
      return;
    }

    const releaseNow = moduleRef.releaseDetector.bind(moduleRef);
    const pendingHandles = new Set<number>();

    moduleRef.releaseDetector = (handle: number) => {
      if (pendingHandles.has(handle)) {
        return;
      }

      pendingHandles.add(handle);
      setTimeout(() => {
        pendingHandles.delete(handle);
        releaseNow(handle);
      }, POSE_DETECTOR_RELEASE_DELAY_MS);
    };

    moduleRef.__delayedReleasePatched = true;
  } catch {
    // Expo Go or native module unavailable.
  }
}

installDelayedPoseDetectorRelease();
