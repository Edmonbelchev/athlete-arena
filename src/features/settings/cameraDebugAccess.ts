import { Platform } from 'react-native';

import { useAuth } from '@/features/auth';

export const CAMERA_DEBUG_ACCESS_EMAIL = 'edmon.cekov@gmail.com';

export function canAccessCameraDebugOverlays(email: string | null | undefined): boolean {
  if (Platform.OS === 'web') {
    return true;
  }

  return email?.trim().toLowerCase() === CAMERA_DEBUG_ACCESS_EMAIL;
}

export function useCameraDebugOverlaysAccess(): boolean {
  const { session } = useAuth();
  return canAccessCameraDebugOverlays(session?.user.email);
}
