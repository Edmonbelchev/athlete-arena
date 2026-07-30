export interface ProfileStats {
  completedChallenges: number;
  totalPushUps: number;
  totalSquats: number;
  totalPullUps: number;
  totalDips: number;
}

export interface UpdateProfileInput {
  username?: string;
  display_name?: string | null;
  avatar_url?: string | null;
}
