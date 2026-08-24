import { PrimaryButton } from '@/components/ui/PrimaryButton';

interface DevSimulateRepButtonProps {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}

/**
 * DEV ONLY — manual rep counter for testing workouts without pose detection.
 * Safe to delete: remove the entire `src/dev/` folder and its usages in
 * `ChallengeWorkoutMode` (stripped from production builds via `__DEV__`).
 */
export function DevSimulateRepButton({ onPress, disabled, loading }: DevSimulateRepButtonProps) {
  if (!__DEV__) {
    return null;
  }

  return (
    <PrimaryButton
      label="+ Dev Rep"
      variant="secondary"
      onPress={onPress}
      disabled={disabled}
      loading={loading}
    />
  );
}
