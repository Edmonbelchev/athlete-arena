export interface ProfileStats {
  completedChallenges: number;
  totalPushUps: number;
  totalSquats: number;
  totalPullUps: number;
  totalDips: number;
  totalBurpees: number;
  totalHalfBurpees: number;
  totalJumpingJacks: number;
  totalJumpingSquats: number;
  totalLunges: number;
}

export interface UpdateProfileInput {
  username?: string;
  display_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
}

export const PROFILE_BIO_MAX_LENGTH = 160;
