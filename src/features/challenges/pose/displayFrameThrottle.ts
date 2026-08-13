import { POSE_DISPLAY_UPDATE_MS as POSE_DISPLAY_UPDATE_MS_FROM_CONSTANTS } from '@/constants/poseDetection';

/** Target interval for skeleton / HUD display updates. */
export const POSE_DISPLAY_UPDATE_MS = POSE_DISPLAY_UPDATE_MS_FROM_CONSTANTS;

/** Clear the skeleton when no frames arrive for this long. */
export const POSE_DISPLAY_STALE_MS = 750;

export function shouldEmitDisplayFrame(lastAtMs: number, nowMs: number = performance.now()): boolean {
  return nowMs - lastAtMs >= POSE_DISPLAY_UPDATE_MS;
}

export function isDisplayFrameStale(lastAtMs: number, nowMs: number = performance.now()): boolean {
  return lastAtMs > 0 && nowMs - lastAtMs >= POSE_DISPLAY_STALE_MS;
}
