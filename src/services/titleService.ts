import { isTitleRequirementType } from '@/features/titles/titleUtils';
import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import type { TitleRecord } from '@/types/titles';

interface TitleRpcRow {
  id: string;
  name: string;
  description: string;
  requirement_type: string;
  requirement_min: number;
  sort_order: number;
  unlocked: boolean;
  unlocked_at: string | null;
  equipped: boolean;
}

function mapTitle(row: TitleRpcRow): TitleRecord | null {
  if (!isTitleRequirementType(row.requirement_type)) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    requirementType: row.requirement_type,
    requirementMin: row.requirement_min,
    sortOrder: row.sort_order,
    unlocked: row.unlocked,
    unlockedAt: row.unlocked_at,
    equipped: row.equipped,
  };
}

export async function getEquippedTitleName(userId: string): Promise<string | null> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_equipped_title_name', {
    p_user_id: userId,
  });

  if (error) {
    throw error;
  }

  return typeof data === 'string' && data.length > 0 ? data : null;
}

export async function getMyTitles(): Promise<TitleRecord[]> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_my_titles');
  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((row) => mapTitle(row as TitleRpcRow))
    .filter((title): title is TitleRecord => title !== null);
}

export async function syncUserTitles(): Promise<number> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('sync_user_titles');
  if (error) {
    throw error;
  }

  return data ?? 0;
}

export async function equipUserTitle(titleId: string | null): Promise<void> {
  assertSupabaseConfigured();

  const { error } = await supabase.rpc('equip_user_title', {
    p_title_id: titleId,
  });

  if (error) {
    throw error;
  }
}
