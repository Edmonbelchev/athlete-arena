import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import { updateProfile } from '@/services/profileService';

const AVATAR_BUCKET = 'avatars';
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

function getExtension(contentType: string, uri: string): string {
  if (contentType.includes('png')) {
    return 'png';
  }

  if (contentType.includes('webp')) {
    return 'webp';
  }

  const fromUri = uri.split('.').pop()?.split('?')[0]?.toLowerCase();
  if (fromUri === 'png' || fromUri === 'webp' || fromUri === 'jpg' || fromUri === 'jpeg') {
    return fromUri === 'jpeg' ? 'jpg' : fromUri;
  }

  return 'jpg';
}

async function deleteExistingAvatars(userId: string): Promise<void> {
  const { data: files, error } = await supabase.storage.from(AVATAR_BUCKET).list(userId);
  if (error || !files?.length) {
    return;
  }

  const paths = files.map((file) => `${userId}/${file.name}`);
  await supabase.storage.from(AVATAR_BUCKET).remove(paths);
}

export async function uploadProfileAvatar(userId: string, localUri: string): Promise<string> {
  assertSupabaseConfigured();

  const response = await fetch(localUri);
  if (!response.ok) {
    throw new Error('Could not read the selected image.');
  }

  const blob = await response.blob();
  if (blob.size > MAX_AVATAR_BYTES) {
    throw new Error('Image must be 5 MB or smaller.');
  }

  const contentType = blob.type || 'image/jpeg';
  if (!contentType.startsWith('image/')) {
    throw new Error('Please choose a JPEG, PNG, or WebP image.');
  }

  const extension = getExtension(contentType, localUri);
  const filePath = `${userId}/avatar.${extension}`;

  await deleteExistingAvatars(userId);

  const { error: uploadError } = await supabase.storage.from(AVATAR_BUCKET).upload(filePath, blob, {
    upsert: true,
    contentType,
    cacheControl: '3600',
  });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);
  const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;

  await updateProfile(userId, { avatar_url: avatarUrl });
  return avatarUrl;
}

export async function removeProfileAvatar(userId: string): Promise<void> {
  assertSupabaseConfigured();

  await deleteExistingAvatars(userId);
  await updateProfile(userId, { avatar_url: null });
}
