import { useWindowDimensions } from 'react-native';

export function useWorkoutLayout(): { isLandscape: boolean; hintPanelWidth: number } {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  return {
    isLandscape,
    hintPanelWidth: isLandscape ? Math.min(300, Math.max(240, width * 0.32)) : width,
  };
}
