import { useAuth } from '@/features/auth';

/** The only account that sees the pose skeleton / rep progress bar settings and overlays. */
export const CAMERA_DEBUG_ACCESS_EMAIL = 'edmon.cekov@gmail.com';

export function canAccessCameraDebugOverlays(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === CAMERA_DEBUG_ACCESS_EMAIL;
}

export function useCameraDebugOverlaysAccess(): boolean {
  const { session } = useAuth();
  return canAccessCameraDebugOverlays(session?.user.email);
}
