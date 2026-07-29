import { SymbolView } from 'expo-symbols';
import { StyleProp, ViewStyle } from 'react-native';

import { APP_ICONS, type AppIconName } from '@/constants/icons';
import { useTheme } from '@/hooks/use-theme';

interface AppIconProps {
  name: AppIconName;
  size?: number;
  color?: string;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
  style?: StyleProp<ViewStyle>;
}

export function AppIcon({ name, size = 22, color, weight = 'medium', style }: AppIconProps) {
  const theme = useTheme();

  return (
    <SymbolView
      name={APP_ICONS[name]}
      size={size}
      weight={weight}
      tintColor={color ?? theme.text}
      style={style}
    />
  );
}
