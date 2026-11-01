import { useWindowDimensions } from 'react-native';
import { toLayoutUnits } from '@/lib/tabletScale';

export function useWorkoutLayout(): { isLandscape: boolean; hintPanelWidth: number } {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  return {
    isLandscape,
    // Style units: on scaled tablets window points are divided back down (see tabletScale).
    hintPanelWidth: toLayoutUnits(isLandscape ? Math.min(300, Math.max(240, width * 0.32)) : width),
  };
}
