export interface ProfileStats {
  completedChallenges: number;
  totalPushUps: number;
  totalSquats: number;
}

export interface UpdateProfileInput {
  username?: string;
  display_name?: string | null;
  avatar_url?: string | null;
}
