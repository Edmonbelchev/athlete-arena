import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const STORAGE_KEY_PREFIX = 'exercise-challenger.app.';

export async function getAppStorageItem(key: string): Promise<string | null> {
  const storageKey = `${STORAGE_KEY_PREFIX}${key}`;

  if (Platform.OS === 'web') {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    return localStorage.getItem(storageKey);
  }

  return SecureStore.getItemAsync(storageKey);
}

export async function setAppStorageItem(key: string, value: string): Promise<void> {
  const storageKey = `${STORAGE_KEY_PREFIX}${key}`;

  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(storageKey, value);
    }
    return;
  }

  await SecureStore.setItemAsync(storageKey, value);
}
