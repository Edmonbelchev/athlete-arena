import type { ExerciseType } from '@/constants/challenges';
import type {
  CustomWorkoutExercise,
  CustomWorkoutExerciseBreakdown,
  ForTimeStructureConfig,
  LadderForTimeStructureConfig,
  LinearForTimeStructureConfig,
} from '@/types/customWorkouts';

export type {
  ForTimeWorkoutStructure,
  LinearForTimeStructureConfig,
  LadderForTimeStructureConfig,
  ForTimeStructureConfig,
} from '@/types/customWorkouts';

export function isLinearForTimeStructure(
  config: ForTimeStructureConfig | null | undefined,
): config is LinearForTimeStructureConfig {
  return !config || config.structure === 'linear';
}

export function isLadderForTimeStructure(
  config: ForTimeStructureConfig | null | undefined,
): config is LadderForTimeStructureConfig {
  return config?.structure === 'ladder';
}

export function parseRepScheme(input: string): number[] {
  return input
    .split(/[-,\s]+/)
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((value) => Number.isFinite(value) && value > 0);
}

export function formatRepScheme(repScheme: number[]): string {
  return repScheme.join('-');
}

export function expandLadderSteps(
  exercises: CustomWorkoutExercise[],
  repScheme: number[],
): CustomWorkoutExercise[] {
  const steps: CustomWorkoutExercise[] = [];

  for (const tierReps of repScheme) {
    for (const exercise of exercises) {
      steps.push({
        exerciseType: exercise.exerciseType,
        targetReps: tierReps,
      });
    }
  }

  return steps;
}

export function resolveForTimeSteps(
  exercises: CustomWorkoutExercise[],
  structureConfig: ForTimeStructureConfig | null | undefined,
): CustomWorkoutExercise[] {
  if (isLadderForTimeStructure(structureConfig)) {
    return expandLadderSteps(exercises, structureConfig.repScheme);
  }

  return exercises;
}

export function getForTimeStepCount(
  exercises: CustomWorkoutExercise[],
  structureConfig: ForTimeStructureConfig | null | undefined,
): number {
  if (isLadderForTimeStructure(structureConfig)) {
    return structureConfig.repScheme.length * exercises.length;
  }

  return exercises.length;
}

export function getForTimeStepContext(
  stepIndex: number,
  blockExercises: CustomWorkoutExercise[],
  structureConfig: ForTimeStructureConfig | null | undefined,
): {
  tierLabel?: string;
  tierIndex?: number;
  tierCount?: number;
} {
  if (!isLadderForTimeStructure(structureConfig) || blockExercises.length === 0) {
    return {};
  }

  const tierIndex = Math.floor(stepIndex / blockExercises.length);
  const tierReps = structureConfig.repScheme[tierIndex];

  if (!tierReps) {
    return {};
  }

  return {
    tierLabel: `${tierReps} rep tier`,
    tierIndex: tierIndex + 1,
    tierCount: structureConfig.repScheme.length,
  };
}

export function buildAggregatedExerciseBreakdown(
  exercises: CustomWorkoutExercise[],
  stepTotals: number[],
): CustomWorkoutExerciseBreakdown[] {
  const totals = new Map<ExerciseType, { targetReps: number; totalReps: number }>();

  exercises.forEach((exercise, index) => {
    const existing = totals.get(exercise.exerciseType) ?? { targetReps: 0, totalReps: 0 };
    existing.targetReps += exercise.targetReps;
    existing.totalReps += stepTotals[index] ?? 0;
    totals.set(exercise.exerciseType, existing);
  });

  const seen = new Set<ExerciseType>();

  return exercises.reduce<CustomWorkoutExerciseBreakdown[]>((breakdown, exercise) => {
    if (seen.has(exercise.exerciseType)) {
      return breakdown;
    }

    seen.add(exercise.exerciseType);
    const entry = totals.get(exercise.exerciseType);

    if (!entry) {
      return breakdown;
    }

    breakdown.push({
      exerciseType: exercise.exerciseType,
      targetReps: entry.targetReps,
      totalReps: entry.totalReps,
    });

    return breakdown;
  }, []);
}

export function parseStructureConfig(value: unknown): ForTimeStructureConfig | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (record.structure === 'ladder' && Array.isArray(record.repScheme)) {
    const repScheme = record.repScheme
      .map((entry) => Number(entry))
      .filter((entry) => Number.isFinite(entry) && entry > 0);

    if (repScheme.length === 0) {
      return null;
    }

    return { structure: 'ladder', repScheme };
  }

  if (record.structure === 'linear') {
    return { structure: 'linear' };
  }

  return null;
}

export function serializeStructureConfig(
  config: ForTimeStructureConfig | null | undefined,
): { structure: 'ladder'; repScheme: number[] } | null {
  if (!config || config.structure === 'linear') {
    return null;
  }

  return {
    structure: 'ladder',
    repScheme: config.repScheme,
  };
}
