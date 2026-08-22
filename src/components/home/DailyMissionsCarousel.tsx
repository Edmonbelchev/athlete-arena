import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ChallengeCard } from '@/components/ui/ChallengeCard';
import { ExercisePickerModal } from '@/components/workouts/ExercisePickerModal';
import { getQuestAccentColor } from '@/constants/dailyMissionQuest';
import { type ExerciseType } from '@/constants/challenges';
import { Radius, Spacing } from '@/constants/theme';
import {
  canRerollMission,
  getRerollEligibleExercises,
  resolveMissionIndex,
} from '@/services/challengeService';
import type { DailyChallengeHome } from '@/types';
import { useTheme } from '@/hooks/use-theme';

interface DailyMissionsCarouselProps {
  missions: DailyChallengeHome[];
  startingMissionIndex: number | null;
  rerollingMissionIndex: number | null;
  rerollUsedOn?: string | null;
  onStartMission: (mission: DailyChallengeHome, listIndex: number) => void;
  onRerollMission: (mission: DailyChallengeHome, listIndex: number, exerciseType: ExerciseType) => void;
}

export function DailyMissionsCarousel({
  missions,
  startingMissionIndex,
  rerollingMissionIndex,
  rerollUsedOn,
  onStartMission,
  onRerollMission,
}: DailyMissionsCarouselProps) {
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const slideWidthRef = useRef(0);
  const [slideWidth, setSlideWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [rerollTarget, setRerollTarget] = useState<{
    mission: DailyChallengeHome;
    listIndex: number;
  } | null>(null);

  const rerollEligibleExercises = useMemo(
    () => getRerollEligibleExercises(missions),
    [missions],
  );

  const snapOffsets = useMemo(
    () => missions.map((_, index) => index * slideWidth),
    [missions, slideWidth],
  );

  useEffect(() => {
    setActiveIndex(0);
    if (slideWidth > 0) {
      scrollRef.current?.scrollTo({ x: 0, animated: false });
    }
  }, [missions.length, slideWidth]);

  const scrollToIndex = useCallback(
    (index: number, animated = true) => {
      const width = slideWidthRef.current;
      if (width <= 0) {
        return;
      }

      const clampedIndex = Math.min(Math.max(index, 0), missions.length - 1);
      setActiveIndex(clampedIndex);
      scrollRef.current?.scrollTo({ x: clampedIndex * width, animated });
    },
    [missions.length],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const width = slideWidthRef.current;
      if (width <= 0) {
        return;
      }

      const index = Math.round(event.nativeEvent.contentOffset.x / width);
      const clampedIndex = Math.min(Math.max(index, 0), missions.length - 1);

      setActiveIndex((current) => (current === clampedIndex ? current : clampedIndex));
    },
    [missions.length],
  );

  return (
    <View
      style={styles.carousel}
      onLayout={(event) => {
        const nextWidth = Math.round(event.nativeEvent.layout.width);
        if (nextWidth > 0 && nextWidth !== slideWidthRef.current) {
          slideWidthRef.current = nextWidth;
          setSlideWidth(nextWidth);
        }
      }}>
      {slideWidth > 0 ? (
        <>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            nestedScrollEnabled
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            bounces={false}
            scrollEventThrottle={16}
            snapToOffsets={snapOffsets}
            snapToAlignment="start"
            disableIntervalMomentum
            onScroll={handleScroll}
            style={{ width: slideWidth }}
            contentContainerStyle={{ width: slideWidth * missions.length }}>
            {missions.map((mission, index) => {
              const missionIndex = resolveMissionIndex(
                mission.exerciseType,
                mission.missionIndex,
                index,
              );
              const slideKey = mission.templateId ?? `mission-${mission.exerciseType}-${missionIndex}`;
              const canReroll = canRerollMission(mission, rerollUsedOn);

              return (
                <View key={slideKey} style={{ width: slideWidth, paddingHorizontal: Spacing.half }}>
                  <ChallengeCard
                    missionIndex={missionIndex}
                    missionLabel={`QUEST ${missionIndex + 1}`}
                    exerciseType={mission.exerciseType}
                    targetReps={mission.targetReps}
                    status={mission.status === 'not_started' ? 'pending' : mission.status}
                    completedReps={mission.completedReps}
                    loading={startingMissionIndex === missionIndex}
                    rerollLoading={rerollingMissionIndex === missionIndex}
                    isRerolled={mission.isRerolled}
                    canReroll={canReroll && rerollEligibleExercises.length > 0}
                    onStart={() => onStartMission(mission, index)}
                    onReroll={() => setRerollTarget({ mission, listIndex: index })}
                  />
                </View>
              );
            })}
          </ScrollView>

          {missions.length > 1 ? (
            <View style={styles.footer}>
              <View style={styles.steps}>
                {missions.map((mission, index) => {
                  const missionIndex = resolveMissionIndex(
                    mission.exerciseType,
                    mission.missionIndex,
                    index,
                  );
                  const dotKey = mission.templateId ?? `mission-step-${missionIndex}`;
                  const isActive = index === activeIndex;
                  const isCleared = mission.status === 'completed';
                  const accentColor = theme[getQuestAccentColor(missionIndex)];

                  return (
                    <Pressable
                      key={dotKey}
                      accessibilityRole="button"
                      accessibilityLabel={`Go to quest ${missionIndex + 1}`}
                      onPress={() => scrollToIndex(index)}
                      style={StyleSheet.flatten([
                        styles.step,
                        {
                          backgroundColor: isActive ? `${accentColor}22` : theme.backgroundSelected,
                          borderColor: isActive || isCleared ? accentColor : theme.border,
                        },
                        isActive ? styles.stepActive : null,
                      ])}>
                      <Text
                        style={StyleSheet.flatten([
                          styles.stepLabel,
                          {
                            color: isCleared ? theme.success : isActive ? accentColor : theme.textSecondary,
                          },
                        ])}>
                        {missionIndex + 1}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={StyleSheet.flatten([styles.pageLabel, { color: theme.textSecondary }])}>
                Quest {activeIndex + 1} of {missions.length}
              </Text>
            </View>
          ) : null}
        </>
      ) : null}

      <ExercisePickerModal
        visible={rerollTarget !== null}
        mode="single"
        title="Swap quest exercise"
        subtitle="Pick a different exercise for this quest slot. You can do this once per day."
        allowedExerciseTypes={rerollEligibleExercises}
        onClose={() => setRerollTarget(null)}
        onSelect={(exerciseType) => {
          if (!rerollTarget) {
            return;
          }

          onRerollMission(rerollTarget.mission, rerollTarget.listIndex, exerciseType);
          setRerollTarget(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  carousel: {
    gap: Spacing.three,
    width: '100%',
    overflow: 'hidden',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.one,
    paddingBottom: 3,
  },
  steps: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  step: {
    width: 34,
    height: 34,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepActive: {
    transform: [{ scale: 1.06 }],
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  pageLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
