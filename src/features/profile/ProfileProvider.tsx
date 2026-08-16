import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '@/features/auth';
import { calculateLevel } from '@/features/xp/levelUtils';
import { formatUserError } from '@/lib/errors';
import { getProfile } from '@/services/profileService';
import type { Profile } from '@/types';

type ProfilePatch = Partial<
  Pick<
    Profile,
    | 'total_xp'
    | 'level'
    | 'current_streak'
    | 'longest_streak'
    | 'display_name'
    | 'username'
    | 'avatar_url'
    | 'coin_balance'
  >
>;

interface ProfileContextValue {
  profile: Profile | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  patchProfile: (patch: ProfilePatch) => void;
  applyXpDelta: (delta: number) => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(session));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session?.user.id) {
      setProfile(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextProfile = await getProfile(session.user.id);
      setProfile(nextProfile);
    } catch (err) {
      setProfile(null);
      setError(formatUserError(err, 'Failed to load profile'));
    } finally {
      setIsLoading(false);
    }
  }, [session?.user.id]);

  const patchProfile = useCallback((patch: ProfilePatch) => {
    setProfile((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const applyXpDelta = useCallback((delta: number) => {
    if (delta <= 0) {
      return;
    }

    setProfile((current) => {
      if (!current) {
        return current;
      }

      const total_xp = current.total_xp + delta;
      return {
        ...current,
        total_xp,
        level: calculateLevel(total_xp),
      };
    });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      profile,
      isLoading,
      error,
      refresh,
      patchProfile,
      applyXpDelta,
    }),
    [profile, isLoading, error, refresh, patchProfile, applyXpDelta],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within ProfileProvider');
  }
  return context;
}
