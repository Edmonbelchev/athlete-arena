import type { ExerciseType } from '@/constants/challenges';

export type ChallengeStatus = 'pending' | 'in_progress' | 'completed' | 'declined' | 'expired';

import type { Json } from '@/types/database';

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  total_xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  coin_balance: number;
  preferences: Json;
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
  mission_index: number;
  status: ChallengeStatus;
  completed_at: string | null;
  created_at: string;
}

/** Global daily mission plus optional per-user progress for the home screen. */
export interface DailyChallengeHome {
  missionIndex: number;
  templateId: string;
  challengeDate: string;
  exerciseType: ExerciseType;
  targetReps: number;
  xpReward: number;
  catalogSlot: number | null;
  userChallengeId: string | null;
  status: ChallengeStatus | 'not_started';
  completedReps: number;
  completedAt: string | null;
}
