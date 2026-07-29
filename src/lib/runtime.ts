import Constants, { ExecutionEnvironment } from 'expo-constants';

/** True when running inside the Expo Go sandbox (no custom native modules). */
export function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

/** Vision Camera + MediaPipe require a development or production build. */
export function supportsNativePoseDetection(): boolean {
  return !isExpoGo();
}
