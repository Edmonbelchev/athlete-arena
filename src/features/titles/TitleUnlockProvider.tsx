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
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { Radius, Spacing } from '@/constants/theme';
import { getMyTitles, syncUserTitles } from '@/services/titleService';
import type { TitleRecord } from '@/types/titles';
import { useTheme } from '@/hooks/use-theme';

const AUTO_DISMISS_MS = 4200;

interface TitleUnlockContextValue {
  syncAndCelebrateTitles: () => Promise<TitleRecord[]>;
}

const TitleUnlockContext = createContext<TitleUnlockContextValue | null>(null);

function TitleUnlockToast({
  title,
  onDismiss,
  onPress,
}: {
  title: TitleRecord;
  onDismiss: () => void;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={StyleSheet.flatten([
        styles.toast,
        { backgroundColor: theme.card, borderColor: theme.primary },
      ])}>
      <View style={StyleSheet.flatten([styles.iconWrap, { backgroundColor: theme.backgroundSelected }])}>
        <AppIcon name="medal" size={20} color={theme.primary} />
      </View>
      <View style={styles.copy}>
        <Text style={StyleSheet.flatten([styles.eyebrow, { color: theme.textSecondary }])}>Title unlocked</Text>
        <Text style={StyleSheet.flatten([styles.title, { color: theme.text }])}>{title.name}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={onDismiss}>
        <AppIcon name="close" size={18} color={theme.textSecondary} />
      </Pressable>
    </Pressable>
  );
}

export function TitleUnlockProvider({ children }: { children: ReactNode }) {
  const [activeUnlock, setActiveUnlock] = useState<TitleRecord | null>(null);
  const queueRef = useRef<TitleRecord[]>([]);
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
    (title: TitleRecord) => {
      queueRef.current.push(title);

      if (!isShowingRef.current) {
        showNextUnlock();
      }
    },
    [showNextUnlock],
  );

  const celebrateNewUnlocks = useCallback(
    (before: TitleRecord[], after: TitleRecord[]) => {
      const beforeIds = new Set(before.filter((title) => title.unlocked).map((title) => title.id));
      after
        .filter((title) => title.unlocked && !beforeIds.has(title.id))
        .forEach((title) => celebrateUnlock(title));
    },
    [celebrateUnlock],
  );

  const syncAndCelebrateTitles = useCallback(async (): Promise<TitleRecord[]> => {
    const before = await getMyTitles();
    await syncUserTitles();
    const after = await getMyTitles();
    celebrateNewUnlocks(before, after);
    return after;
  }, [celebrateNewUnlocks]);

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
      syncAndCelebrateTitles,
    }),
    [syncAndCelebrateTitles],
  );

  return (
    <TitleUnlockContext.Provider value={value}>
      {children}
      {activeUnlock ? (
        <View style={styles.overlay} pointerEvents="box-none">
          <TitleUnlockToast
            title={activeUnlock}
            onDismiss={dismissActiveUnlock}
            onPress={() => {
              dismissActiveUnlock();
              router.push('/profile/titles');
            }}
          />
        </View>
      ) : null}
    </TitleUnlockContext.Provider>
  );
}

export function useTitleUnlock(): TitleUnlockContextValue {
  const context = useContext(TitleUnlockContext);
  if (!context) {
    throw new Error('useTitleUnlock must be used within TitleUnlockProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 72,
    left: Spacing.three,
    right: Spacing.three,
    zIndex: 100,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.three,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
  },
});
