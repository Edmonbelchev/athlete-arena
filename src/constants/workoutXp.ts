import type { ExerciseType } from '@/constants/challenges';

/** Keep in sync with supabase/migrations/105_workout_session_xp.sql and 106_workout_xp_cap_debuff.sql */
export const WORKOUT_XP_PER_REP: Record<ExerciseType, number> = {
  jumping_jacks: 1,
  squats: 1,
  push_ups: 1,
  half_burpees: 1,
  jumping_squats: 1,
  burpees: 2,
  pull_ups: 2,
};

export const FOR_TIME_SECONDS_PER_REP = 3;
export const FOR_TIME_MIN_PAR_SECONDS = 120;
export const FOR_TIME_MIN_ELAPSED_SECONDS = 30;
export const FOR_TIME_SPEED_MULTIPLIER_MIN = 0.5;
export const FOR_TIME_SPEED_MULTIPLIER_MAX = 1.5;

export const AMRAP_XP_PER_WORKOUT_MINUTE = 4;
export const EMOM_INTERVAL_COMPLETION_BONUS_MAX = 30;

/** Applied to raw XP before min/max clamp (server uses the same factor). */
export const WORKOUT_XP_EARNINGS_SCALE = 0.75;

export const DAILY_FIRST_WORKOUT_COINS = 125;

export const WORKOUT_XP_MIN = 10;
export const WORKOUT_XP_MAX = 500;
