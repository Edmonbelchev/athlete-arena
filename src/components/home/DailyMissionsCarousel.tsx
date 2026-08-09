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
import { Spacing } from '@/constants/theme';
import { resolveMissionIndex } from '@/services/challengeService';
import type { DailyChallengeHome } from '@/types';
import { useTheme } from '@/hooks/use-theme';

interface DailyMissionsCarouselProps {
  missions: DailyChallengeHome[];
  startingMissionIndex: number | null;
  onStartMission: (mission: DailyChallengeHome, listIndex: number) => void;
}

export function DailyMissionsCarousel({
  missions,
  startingMissionIndex,
  onStartMission,
}: DailyMissionsCarouselProps) {
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const slideWidthRef = useRef(0);
  const [slideWidth, setSlideWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

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

              return (
                <View key={slideKey} style={{ width: slideWidth }}>
                  <ChallengeCard
                    missionLabel={`MISSION ${missionIndex + 1}`}
                    exerciseType={mission.exerciseType}
                    targetReps={mission.targetReps}
                    status={mission.status === 'not_started' ? 'pending' : mission.status}
                    completedReps={mission.completedReps}
                    loading={startingMissionIndex === missionIndex}
                    onStart={() => onStartMission(mission, index)}
                  />
                </View>
              );
            })}
          </ScrollView>

          {missions.length > 1 ? (
            <View style={styles.footer}>
              <View style={styles.dots}>
                {missions.map((mission, index) => {
                  const missionIndex = resolveMissionIndex(
                    mission.exerciseType,
                    mission.missionIndex,
                    index,
                  );
                  const dotKey = mission.templateId ?? `mission-dot-${mission.exerciseType}-${missionIndex}`;

                  return (
                    <Pressable
                      key={dotKey}
                      accessibilityRole="button"
                      accessibilityLabel={`Go to mission ${missionIndex + 1}`}
                      onPress={() => scrollToIndex(index)}
                      style={StyleSheet.flatten([
                        styles.dot,
                        {
                          backgroundColor:
                            index === activeIndex ? theme.primary : theme.backgroundSelected,
                          width: index === activeIndex ? 18 : 8,
                        },
                      ])}
                    />
                  );
                })}
              </View>
              <Text style={StyleSheet.flatten([styles.pageLabel, { color: theme.textSecondary }])}>
                {activeIndex + 1} / {missions.length}
              </Text>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  carousel: {
    gap: Spacing.two,
    width: '100%',
    overflow: 'hidden',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.one,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  pageLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
});
