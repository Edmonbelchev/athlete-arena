import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CoinBadge } from '@/components/shop/CoinBadge';
import { SpinRewardModal } from '@/components/spin/SpinRewardModal';
import { SpinWheel, type SpinTarget } from '@/components/spin/SpinWheel';
import { AppIcon } from '@/components/ui/AppIcon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import {
  COIN_MULTIPLIER_VALUE,
  formatTimeRemaining,
  getSegmentTitle,
  SPIN_RARITY_COLORS,
  SPIN_RARITY_LABELS,
} from '@/constants/spinWheel';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useDailySpin } from '@/features/spin/useDailySpin';
import { useTheme } from '@/hooks/use-theme';
import type { SpinResult } from '@/types/spin';

export default function SpinScreen() {
  const theme = useTheme();
  const { status, segments, isLoading, isSpinning, error, spin } = useDailySpin();

  const [target, setTarget] = useState<SpinTarget | null>(null);
  const [pendingResult, setPendingResult] = useState<SpinResult | null>(null);
  const [revealedResult, setRevealedResult] = useState<SpinResult | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const canSpin = Boolean(status?.canSpin) && !isSpinning && !isAnimating;
  const multiplierActive = (status?.coinMultiplier ?? 1) > 1;
  const multiplierRemaining = formatTimeRemaining(status?.coinMultiplierExpiresAt ?? null);
  const nextSpinRemaining = formatTimeRemaining(status?.nextSpinAt ?? null);

  const handleSpinEnd = useCallback(() => {
    setIsAnimating(false);
    setRevealedResult(pendingResult);
    setPendingResult(null);
  }, [pendingResult]);

  async function handleSpin() {
    if (!canSpin) {
      return;
    }

    const result = await spin();
    if (!result) {
      return;
    }

    const index = segments.findIndex((segment) => segment.rewardId === result.rewardId);

    setPendingResult(result);
    setIsAnimating(true);
    setTarget({ index: index >= 0 ? index : 0, nonce: Date.now() });
  }

  return (
    <SafeAreaView
      edges={['bottom']}
      style={StyleSheet.flatten([styles.safeArea, { backgroundColor: theme.background }])}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={StyleSheet.flatten([styles.subtitle, { color: theme.textSecondary }])}>
          One free spin every day. Land the {COIN_MULTIPLIER_VALUE}x segment to double every coin
          you earn for the rest of the day.
        </Text>

        {status ? (
          <View style={styles.balanceRow}>
            <Text style={StyleSheet.flatten([styles.balanceLabel, { color: theme.textSecondary }])}>
              Your coins
            </Text>
            <CoinBadge amount={status.coinBalance} large />
          </View>
        ) : null}

        {multiplierActive ? (
          <View
            style={StyleSheet.flatten([
              styles.banner,
              { backgroundColor: theme.backgroundElement, borderColor: theme.accent },
            ])}>
            <AppIcon name="bolt" size={22} color={theme.accent} weight="bold" />
            <View style={styles.bannerCopy}>
              <Text style={StyleSheet.flatten([styles.bannerTitle, { color: theme.text }])}>
                {COIN_MULTIPLIER_VALUE}x coins active
              </Text>
              <Text
                style={StyleSheet.flatten([styles.bannerMessage, { color: theme.textSecondary }])}>
                {multiplierRemaining
                  ? `All coin rewards are doubled for ${multiplierRemaining}.`
                  : 'All coin rewards are doubled for the rest of the day.'}
              </Text>
            </View>
          </View>
        ) : null}

        {isLoading && !status ? (
          <ActivityIndicator size="large" style={styles.loader} />
        ) : (
          <SpinWheel segments={segments} target={target} onSpinEnd={handleSpinEnd} />
        )}

        {error ? (
          <Text style={StyleSheet.flatten([styles.error, { color: theme.danger }])}>{error}</Text>
        ) : null}

        <PrimaryButton
          label={status?.canSpin ? 'Spin the wheel' : 'Come back tomorrow'}
          loading={isSpinning || isAnimating}
          disabled={!canSpin}
          onPress={() => void handleSpin()}
        />

        {!status?.canSpin && nextSpinRemaining ? (
          <Text style={StyleSheet.flatten([styles.nextSpin, { color: theme.textSecondary }])}>
            Next spin in {nextSpinRemaining}
          </Text>
        ) : null}

        <View style={styles.legend}>
          <Text style={StyleSheet.flatten([styles.legendTitle, { color: theme.text }])}>
            Rewards
          </Text>

          {segments.map((segment) => (
            <View
              key={segment.rewardId}
              style={StyleSheet.flatten([
                styles.legendRow,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              ])}>
              <View
                style={StyleSheet.flatten([
                  styles.legendDot,
                  { backgroundColor: SPIN_RARITY_COLORS[segment.rarity] },
                ])}
              />
              <View style={styles.legendCopy}>
                <Text style={StyleSheet.flatten([styles.legendReward, { color: theme.text }])}>
                  {getSegmentTitle(segment)}
                </Text>
                <Text
                  style={StyleSheet.flatten([
                    styles.legendRarity,
                    { color: SPIN_RARITY_COLORS[segment.rarity] },
                  ])}>
                  {SPIN_RARITY_LABELS[segment.rarity]}
                </Text>
              </View>
              <Text style={StyleSheet.flatten([styles.legendOdds, { color: theme.textSecondary }])}>
                {segment.weight}%
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <SpinRewardModal result={revealedResult} onClose={() => setRevealedResult(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  balanceLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  bannerCopy: {
    flex: 1,
    gap: Spacing.one,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  bannerMessage: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  loader: {
    marginVertical: Spacing.five,
  },
  error: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  nextSpin: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  legend: {
    gap: Spacing.two,
  },
  legendTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: Spacing.one,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  legendCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  legendReward: {
    fontSize: 15,
    fontWeight: '800',
  },
  legendRarity: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  legendOdds: {
    fontSize: 14,
    fontWeight: '700',
  },
});
