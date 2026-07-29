import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { SupportedStorage } from '@supabase/supabase-js';

const STORAGE_KEY_PREFIX = 'exercise-challenger.auth.';

/**
 * Supabase auth storage adapter.
 * Native: encrypted SecureStore (iOS Keychain / Android Keystore).
 * Web: localStorage fallback - SecureStore is not available on web.
 */
export const supabaseStorage: SupportedStorage = {
  getItem(key: string) {
    if (Platform.OS === 'web') {
      if (typeof localStorage === 'undefined') {
        return Promise.resolve(null);
      }
      return Promise.resolve(localStorage.getItem(`${STORAGE_KEY_PREFIX}${key}`));
    }

    return SecureStore.getItemAsync(`${STORAGE_KEY_PREFIX}${key}`);
  },

  setItem(key: string, value: string) {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}${key}`, value);
      }
      return Promise.resolve();
    }

    return SecureStore.setItemAsync(`${STORAGE_KEY_PREFIX}${key}`, value);
  },

  removeItem(key: string) {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(`${STORAGE_KEY_PREFIX}${key}`);
      }
      return Promise.resolve();
    }

    return SecureStore.deleteItemAsync(`${STORAGE_KEY_PREFIX}${key}`);
  },
};
