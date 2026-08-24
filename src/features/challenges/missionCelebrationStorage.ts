import { getAppStorageItem, setAppStorageItem } from '@/lib/appStorage';
import type { DailyMissionCompletePayload } from '@/features/challenges/dailyMissionCelebration';

const STORAGE_KEY = 'daily-mission-celebrations';

export function getMissionCelebrationKey(mission: DailyMissionCompletePayload): string {
  return `${mission.challengeDate}:${mission.missionIndex}`;
}

export async function loadCelebratedMissionKeys(): Promise<Set<string>> {
  const raw = await getAppStorageItem(STORAGE_KEY);
  if (!raw) {
    return new Set();
  }

  try {
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export async function saveCelebratedMissionKeys(keys: Set<string>): Promise<void> {
  await setAppStorageItem(STORAGE_KEY, JSON.stringify([...keys]));
}

export async function markMissionCelebrated(mission: DailyMissionCompletePayload): Promise<void> {
  const keys = await loadCelebratedMissionKeys();
  keys.add(getMissionCelebrationKey(mission));
  await saveCelebratedMissionKeys(keys);
}
