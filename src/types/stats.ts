export interface MovementStats {
  totalPushUps: number;
  totalSquats: number;
  totalPullUps: number;
  totalDips: number;
  totalBurpees: number;
  totalHalfBurpees: number;
  totalJumpingJacks: number;
  totalJumpingSquats: number;
  dailyMissionsCompleted: number;
  friendRacesCompleted: number;
}

export const EMPTY_MOVEMENT_STATS: MovementStats = {
  totalPushUps: 0,
  totalSquats: 0,
  totalPullUps: 0,
  totalDips: 0,
  totalBurpees: 0,
  totalHalfBurpees: 0,
  totalJumpingJacks: 0,
  totalJumpingSquats: 0,
  dailyMissionsCompleted: 0,
  friendRacesCompleted: 0,
};
