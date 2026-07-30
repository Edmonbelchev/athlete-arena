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

import {
  AchievementUnlockToast,
  AUTO_DISMISS_MS,
} from '@/components/achievements/AchievementUnlockToast';
import {
  getMyAchievements,
  syncUserAchievements,
} from '@/services/achievementService';
import type { AchievementRecord } from '@/types/achievements';

interface SyncAndCelebrateOptions {
  skipSync?: boolean;
}

interface AchievementUnlockContextValue {
  syncAndCelebrate: (options?: SyncAndCelebrateOptions) => Promise<AchievementRecord[]>;
  celebrateUnlock: (achievement: AchievementRecord) => void;
}

const AchievementUnlockContext = createContext<AchievementUnlockContextValue | null>(null);

function getUnlockedIds(achievements: AchievementRecord[]): Set<string> {
  return new Set(achievements.filter((achievement) => achievement.unlocked).map((achievement) => achievement.id));
}

export function AchievementUnlockProvider({ children }: { children: ReactNode }) {
  const [activeUnlock, setActiveUnlock] = useState<AchievementRecord | null>(null);
  const queueRef = useRef<AchievementRecord[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isShowingRef = useRef(false);

  const showNextUnlock = useCallback(() => {
    const next = queueRef.current.shift() ?? null;
    setActiveUnlock(next);
    isShowingRef.current = Boolean(next);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (next) {
      timeoutRef.current = setTimeout(() => {
        showNextUnlock();
      }, AUTO_DISMISS_MS);
    }
  }, []);

  const celebrateUnlock = useCallback(
    (achievement: AchievementRecord) => {
      queueRef.current.push(achievement);

      if (!isShowingRef.current) {
        showNextUnlock();
      }
    },
    [showNextUnlock],
  );

  const celebrateNewUnlocks = useCallback(
    (before: AchievementRecord[], after: AchievementRecord[]) => {
      const beforeIds = getUnlockedIds(before);
      after
        .filter((achievement) => achievement.unlocked && !beforeIds.has(achievement.id))
        .forEach((achievement) => celebrateUnlock(achievement));
    },
    [celebrateUnlock],
  );

  const syncAndCelebrate = useCallback(
    async (options?: SyncAndCelebrateOptions): Promise<AchievementRecord[]> => {
      const before = await getMyAchievements();

      if (!options?.skipSync) {
        await syncUserAchievements();
      }

      const after = await getMyAchievements();
      celebrateNewUnlocks(before, after);
      return after;
    },
    [celebrateNewUnlocks],
  );

  const dismissActiveUnlock = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setActiveUnlock(null);
    isShowingRef.current = false;

    if (queueRef.current.length > 0) {
      requestAnimationFrame(() => {
        showNextUnlock();
      });
    }
  }, [showNextUnlock]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const value = useMemo(
    () => ({
      syncAndCelebrate,
      celebrateUnlock,
    }),
    [syncAndCelebrate, celebrateUnlock],
  );

  return (
    <AchievementUnlockContext.Provider value={value}>
      {children}
      {activeUnlock ? (
        <AchievementUnlockToast
          achievement={activeUnlock}
          onDismiss={dismissActiveUnlock}
          onPress={() => {
            dismissActiveUnlock();
            router.push('/profile/achievements');
          }}
        />
      ) : null}
    </AchievementUnlockContext.Provider>
  );
}

export function useAchievementUnlock(): AchievementUnlockContextValue {
  const context = useContext(AchievementUnlockContext);
  if (!context) {
    throw new Error('useAchievementUnlock must be used within AchievementUnlockProvider');
  }
  return context;
}
