import type { ExerciseType } from '@/constants/challenges';
import { parseStructureConfig } from '@/features/workouts/forTimeStructure';
import type { CustomWorkoutExercise, CustomWorkoutLaunchConfig } from '@/types/customWorkouts';
import type { FriendChallenge } from '@/types/friends';

export function isFriendWorkoutChallenge(challenge: Pick<FriendChallenge, 'challengeKind'>): boolean {
  return challenge.challengeKind === 'workout';
}

export function mapFriendWorkoutExercises(value: unknown): CustomWorkoutExercise[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const exerciseType = record.exercise_type ?? record.exerciseType;

      if (typeof exerciseType !== 'string' || typeof record.target_reps !== 'number') {
        if (typeof record.targetReps === 'number' && typeof exerciseType === 'string') {
          return {
            exerciseType: exerciseType as ExerciseType,
            targetReps: record.targetReps,
          };
        }

        return null;
      }

      return {
        exerciseType: exerciseType as ExerciseType,
        targetReps: record.target_reps,
      };
    })
    .filter((entry): entry is CustomWorkoutExercise => entry !== null);
}

export function buildFriendWorkoutLaunchConfig(challenge: FriendChallenge): CustomWorkoutLaunchConfig | null {
  if (!isFriendWorkoutChallenge(challenge) || !challenge.workoutType || !challenge.workoutExercises.length) {
    return null;
  }

  return {
    workoutType: challenge.workoutType,
    title: challenge.workoutTitle ?? 'Workout challenge',
    templateId: challenge.templateId,
    catalogWorkoutId: challenge.catalogWorkoutId,
    timeLimitSeconds: challenge.timeLimitSeconds ?? 0,
    exercises: challenge.workoutExercises,
    structureConfig: parseStructureConfig(challenge.structureConfig),
    friendChallengeParticipantId: challenge.participantId,
  };
}
