import { useWindowDimensions } from 'react-native';

export function useWorkoutLayout(): { isLandscape: boolean } {
  const { width, height } = useWindowDimensions();

  return { isLandscape: width > height };
}
