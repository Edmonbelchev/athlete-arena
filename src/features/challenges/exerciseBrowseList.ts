import { EXERCISE_LABELS, type ExerciseType } from '@/constants/challenges';

export const EXERCISE_BROWSE_PAGE_SIZE = 6;

export function filterExercisesByQuery(
  exerciseTypes: readonly ExerciseType[],
  query: string,
): ExerciseType[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return exerciseTypes;
  }

  return exerciseTypes.filter((exerciseType) => {
    const label = EXERCISE_LABELS[exerciseType].toLowerCase();
    return label.includes(normalizedQuery) || exerciseType.replace(/_/g, ' ').includes(normalizedQuery);
  });
}

export function sortExercisesForBrowse(exerciseTypes: readonly ExerciseType[]): ExerciseType[] {
  return [...exerciseTypes].sort((left, right) =>
    EXERCISE_LABELS[left].localeCompare(EXERCISE_LABELS[right]),
  );
}
