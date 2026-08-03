/** Accounts allowed to see live joint-angle / rep-engine debug HUD on camera preview. */
const POSE_DEBUG_EMAILS = new Set(['edmon.cekov@gmail.com']);

export function canShowPoseDebugOverlay(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }

  return POSE_DEBUG_EMAILS.has(email.trim().toLowerCase());
}
