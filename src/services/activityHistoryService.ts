import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import {
  ACTIVITY_HISTORY_PAGE_SIZE,
  mapActivityHistoryRow,
  type ActivityHistoryEntry,
  type ActivityHistoryFilter,
} from '@/types/activityHistory';

export async function getActivityHistory(
  filter: ActivityHistoryFilter,
  limit = ACTIVITY_HISTORY_PAGE_SIZE,
  offset = 0,
): Promise<ActivityHistoryEntry[]> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_activity_history', {
    p_filter: filter,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapActivityHistoryRow(row));
}
