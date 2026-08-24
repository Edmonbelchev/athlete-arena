import { router } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';

import {
  MissionCompleteToast,
  MISSION_COMPLETE_AUTO_DISMISS_MS,
} from '@/components/challenges/MissionCompleteToast';
import type { DailyMissionCompletePayload } from '@/features/challenges/dailyMissionCelebration';
import { findNewlyCompletedMissions } from '@/features/challenges/dailyMissionCelebration';
import {
  getMissionCelebrationKey,
  loadCelebratedMissionKeys,
  markMissionCelebrated,
} from '@/features/challenges/missionCelebrationStorage';
import { notifyDailyChallengeRefresh } from '@/lib/dailyChallengeSync';
import { getDailyChallengeHome } from '@/services/challengeService';
import type { DailyChallengeHome } from '@/types';

interface MissionCompleteContextValue {
  celebrateMissionComplete: (mission: DailyMissionCompletePayload) => void;
  refreshMissionsAndCelebrate: () => Promise<DailyChallengeHome[]>;
}

const MissionCompleteContext = createContext<MissionCompleteContextValue | null>(null);

export function MissionCompleteProvider({ children }: { children: ReactNode }) {
  const [activeMission, setActiveMission] = useState<DailyMissionCompletePayload | null>(null);
  const queueRef = useRef<DailyMissionCompletePayload[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isShowingRef = useRef(false);
  const missionsSnapshotRef = useRef<DailyChallengeHome[]>([]);
  const celebratedKeysRef = useRef<Set<string>>(new Set());
  const isReadyRef = useRef(false);

  const showNextMission = useCallback(() => {
    const next = queueRef.current.shift() ?? null;
    setActiveMission(next);
    isShowingRef.current = Boolean(next);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (next) {
      timeoutRef.current = setTimeout(() => {
        showNextMission();
      }, MISSION_COMPLETE_AUTO_DISMISS_MS);
    }
  }, []);

  const enqueueCelebration = useCallback(
    (mission: DailyMissionCompletePayload) => {
      const key = getMissionCelebrationKey(mission);
      if (celebratedKeysRef.current.has(key)) {
        return;
      }

      celebratedKeysRef.current.add(key);
      void markMissionCelebrated(mission);

      queueRef.current.push(mission);

      if (!isShowingRef.current) {
        showNextMission();
      }
    },
    [showNextMission],
  );

  const celebrateMissionComplete = useCallback(
    (mission: DailyMissionCompletePayload) => {
      enqueueCelebration(mission);
    },
    [enqueueCelebration],
  );

  const refreshMissionsAndCelebrate = useCallback(async () => {
    const before = missionsSnapshotRef.current;
    const after = await getDailyChallengeHome();
    missionsSnapshotRef.current = after;

    if (isReadyRef.current) {
      findNewlyCompletedMissions(before, after).forEach((mission) => {
        enqueueCelebration(mission);
      });
    }

    notifyDailyChallengeRefresh();

    return after;
  }, [enqueueCelebration]);

  const dismissActiveMission = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    showNextMission();
  }, [showNextMission]);

  const handlePress = useCallback(() => {
    dismissActiveMission();
    router.push('/(tabs)');
  }, [dismissActiveMission]);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([loadCelebratedMissionKeys(), getDailyChallengeHome()])
      .then(([celebratedKeys, missions]) => {
        if (cancelled) {
          return;
        }

        celebratedKeysRef.current = celebratedKeys;
        missionsSnapshotRef.current = missions;
        isReadyRef.current = true;
      })
      .catch(() => {
        if (!cancelled) {
          isReadyRef.current = true;
        }
      });

    return () => {
      cancelled = true;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const value = useMemo(
    () => ({
      celebrateMissionComplete,
      refreshMissionsAndCelebrate,
    }),
    [celebrateMissionComplete, refreshMissionsAndCelebrate],
  );

  return (
    <MissionCompleteContext.Provider value={value}>
      <View style={styles.root} pointerEvents="box-none">
        {children}
        {activeMission ? (
          <MissionCompleteToast mission={activeMission} onDismiss={dismissActiveMission} onPress={handlePress} />
        ) : null}
      </View>
    </MissionCompleteContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

export function useMissionComplete(): MissionCompleteContextValue {
  const context = useContext(MissionCompleteContext);

  if (!context) {
    throw new Error('useMissionComplete must be used within MissionCompleteProvider');
  }

  return context;
}
