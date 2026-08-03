import { useAuth } from '@/features/auth';

import { canShowPoseDebugOverlay } from './poseDebugAccess';

/** True when the signed-in user may see pose debug numbers on the camera preview. */
export function usePoseDebugOverlay(): boolean {
  const { session } = useAuth();
  return canShowPoseDebugOverlay(session?.user.email);
}
