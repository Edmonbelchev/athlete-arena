import type { ActivityHistoryEntry } from '@/types/activityHistory';

/** Hands the tapped history entry to the detail screen without serializing it into params. */
let selectedEntry: ActivityHistoryEntry | null = null;

export function setSelectedHistoryEntry(entry: ActivityHistoryEntry): void {
  selectedEntry = entry;
}

export function getSelectedHistoryEntry(entryId: string | undefined): ActivityHistoryEntry | null {
  if (!selectedEntry || !entryId || selectedEntry.entryId !== entryId) {
    return null;
  }

  return selectedEntry;
}
