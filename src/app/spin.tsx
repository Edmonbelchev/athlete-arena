import { useCallback, useEffect, useState } from 'react';
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
} from '@/constants/spinWheel';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useDailySpin } from '@/features/spin/useDailySpin';
import { useTheme } from '@/hooks/use-theme';
import type { SpinResult } from '@/types/spin';

/** Re-renders every minute so the countdowns stay current. */
function useMinuteTick(): void {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((value) => value + 1), 60_000);
    return () => clearInterval(id);
  }, []);
}

export default function SpinScreen() {
  const theme = useTheme();
  const { status, segments, isLoading, isSpinning, error, spin, commitSpinResult } = useDailySpin();

  const [target, setTarget] = useState<SpinTarget | null>(null);
  const [pendingResult, setPendingResult] = useState<SpinResult | null>(null);
  const [revealedResult, setRevealedResult] = useState<SpinResult | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const canSpin = Boolean(status?.canSpin) && !isSpinning && !isAnimating;
  const multiplierActive = (status?.coinMultiplier ?? 1) > 1;
  const multiplierRemaining = formatTimeRemaining(status?.coinMultiplierExpiresAt ?? null);
  const nextSpinRemaining = formatTimeRemaining(status?.nextSpinAt ?? null);
  useMinuteTick();

  const handleSpinEnd = useCallback(() => {
    setIsAnimating(false);

    if (pendingResult) {
      commitSpinResult(pendingResult);
      setRevealedResult(pendingResult);
    }

    setPendingResult(null);
  }, [commitSpinResult, pendingResult]);

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
        <View style={styles.topRow}>
          {status?.canSpin ? (
            <View style={StyleSheet.flatten([styles.statusPill, { backgroundColor: `${theme.success}1F` }])}>
              <View style={StyleSheet.flatten([styles.statusDot, { backgroundColor: theme.success }])} />
              <Text style={StyleSheet.flatten([styles.statusText, { color: theme.success }])}>Free spin ready</Text>
            </View>
          ) : status ? (
            <View style={StyleSheet.flatten([styles.statusPill, { backgroundColor: theme.backgroundSelected }])}>
              <AppIcon name="history" size={13} color={theme.textSecondary} />
              <Text style={StyleSheet.flatten([styles.statusText, { color: theme.textSecondary }])}>
                {nextSpinRemaining ? `Next spin in ${nextSpinRemaining}` : 'Back tomorrow'}
              </Text>
            </View>
          ) : (
            <View />
          )}
          {status ? <CoinBadge amount={status.coinBalance} large /> : null}
        </View>

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
          <View style={styles.wheelStage}>
            <View style={StyleSheet.flatten([styles.wheelGlow, { backgroundColor: `${theme.streak}1A` }])} />
            <SpinWheel segments={segments} target={target} onSpinEnd={handleSpinEnd} />
          </View>
        )}

        {error ? (
          <Text style={StyleSheet.flatten([styles.error, { color: theme.danger }])}>{error}</Text>
        ) : null}

        <PrimaryButton
          label={status?.canSpin ? 'Spin the wheel' : nextSpinRemaining ? `Next spin in ${nextSpinRemaining}` : 'Come back tomorrow'}
          loading={isSpinning || isAnimating}
          disabled={!canSpin}
          onPress={() => void handleSpin()}
        />

        <Text style={StyleSheet.flatten([styles.subtitle, { color: theme.textSecondary }])}>
          One free spin every day. Land {COIN_MULTIPLIER_VALUE}x to double every coin you earn for the rest of the day.
        </Text>
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
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    textAlign: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '800',
  },
  wheelStage: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three,
  },
  wheelGlow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
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
});
