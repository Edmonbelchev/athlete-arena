import { StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** XP and coin tiles side by side; renders nothing when both are zero. */
export function RewardTiles({ xp, coins }: { xp: number; coins: number }) {
  const theme = useTheme();

  if (xp <= 0 && coins <= 0) {
    return null;
  }

  return (
    <View style={styles.row}>
      {xp > 0 ? (
        <View style={[styles.tile, { backgroundColor: `${theme.xp}14`, borderColor: `${theme.xp}40` }]}>
          <AppIcon name="star" size={16} color={theme.xp} weight="semibold" />
          <Text style={[styles.value, { color: theme.xp }]} numberOfLines={1}>
            +{xp.toLocaleString()} <Text style={styles.unit}>XP</Text>
          </Text>
        </View>
      ) : null}
      {coins > 0 ? (
        <View style={[styles.tile, { backgroundColor: `${theme.accent}14`, borderColor: `${theme.accent}40` }]}>
          <CoinIcon size={16} />
          <Text style={[styles.value, { color: theme.accent }]} numberOfLines={1}>
            +{coins.toLocaleString()} <Text style={styles.unit}>coins</Text>
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: Spacing.two,
  },
  tile: {
    flex: 1,
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  value: {
    fontSize: 18,
    fontWeight: '900',
    flexShrink: 1,
  },
  unit: {
    fontSize: 13,
    fontWeight: '800',
  },
});
