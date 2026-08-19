import type { CustomWorkoutLaunchConfig } from '@/types/customWorkouts';

let pendingLaunch: CustomWorkoutLaunchConfig | null = null;

export function setPendingCustomWorkoutLaunch(config: CustomWorkoutLaunchConfig): void {
  pendingLaunch = config;
}

export function consumePendingCustomWorkoutLaunch(): CustomWorkoutLaunchConfig | null {
  const config = pendingLaunch;
  pendingLaunch = null;
  return config;
}

/** @deprecated Use setPendingCustomWorkoutLaunch */
export const setPendingAmrapLaunch = setPendingCustomWorkoutLaunch;

/** @deprecated Use consumePendingCustomWorkoutLaunch */
export const consumePendingAmrapLaunch = consumePendingCustomWorkoutLaunch;
