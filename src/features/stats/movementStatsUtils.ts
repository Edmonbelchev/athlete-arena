import type { MovementStats } from '@/types/stats';
import type { ProfileStats } from '@/types/profile';

export function movementStatsToProfileStats(movement: MovementStats): ProfileStats {
  return {
    completedChallenges: movement.dailyMissionsCompleted,
    totalPushUps: movement.totalPushUps,
    totalSquats: movement.totalSquats,
    totalPullUps: movement.totalPullUps,
    totalDips: movement.totalDips,
    totalBurpees: movement.totalBurpees,
    totalHalfBurpees: movement.totalHalfBurpees,
    totalJumpingJacks: movement.totalJumpingJacks,
    totalJumpingSquats: movement.totalJumpingSquats,
    totalLunges: movement.totalLunges,
    totalSitUps: movement.totalSitUps,
    totalPlankSeconds: movement.totalPlankSeconds,
    totalHighKnees: movement.totalHighKnees,
    totalShadowBoxing: movement.totalShadowBoxing,
    totalTuckJumps: movement.totalTuckJumps,
    totalStarJumps: movement.totalStarJumps,
    totalKneeStrikes: movement.totalKneeStrikes,
  };
}
