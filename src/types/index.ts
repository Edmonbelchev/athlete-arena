import type { ExerciseType } from '@/constants/challenges';

export type ChallengeStatus = 'pending' | 'in_progress' | 'completed' | 'declined' | 'expired';

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  total_xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  created_at: string;
  updated_at: string;
}

export interface DailyChallenge {
  id: string;
  user_id: string;
  exercise_type: ExerciseType;
  target_reps: number;
  completed_reps: number;
  xp_reward: number;
  challenge_date: string;
  status: ChallengeStatus;
  completed_at: string | null;
  created_at: string;
}
