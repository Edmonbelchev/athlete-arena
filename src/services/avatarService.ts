import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import { normalizeAppearance } from '@/features/avatar/avatarOptions';
import { mapWearableItem, parseAccessories } from '@/features/avatar/avatarWardrobe';
import type { Json } from '@/types/database';
import type { AvatarAccessories, AvatarAppearance, UserAvatar, WearableItem } from '@/types/avatar';

const AVATAR_BUCKET = 'avatars';

export async function getMyAvatar(userId: string): Promise<UserAvatar | null> {
  assertSupabaseConfigured();

  const { data, error } = await supabase
    .from('user_avatars')
    .select('appearance, accessories, version')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    appearance: normalizeAppearance(data.appearance),
    accessories: parseAccessories(data.accessories),
    version: data.version,
  };
}

export async function getMyWardrobe(): Promise<WearableItem[]> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_my_wardrobe');

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((row) => mapWearableItem(row))
    .filter((item): item is WearableItem => item !== null);
}

/** Saves the avatar and returns its new version number. */
export async function saveMyAvatar(
  appearance: AvatarAppearance,
  accessories: AvatarAccessories
): Promise<number> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('save_my_avatar', {
    p_appearance: appearance as unknown as Json,
    p_accessories: accessories as unknown as Json,
  });

  if (error) {
    throw error;
  }

  return data ?? 1;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/**
 * Uploads the PNG headshot to {userId}/avatar.png and returns a public URL
 * versioned so clients don't keep showing a cached older image.
 */
export async function uploadAvatarHeadshot(
  userId: string,
  pngBase64: string,
  version: number
): Promise<string> {
  assertSupabaseConfigured();

  const path = `${userId}/avatar.png`;
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, base64ToBytes(pngBase64), { contentType: 'image/png', upsert: true });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${version}`;
}
