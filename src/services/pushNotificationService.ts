import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { assertSupabaseConfigured, supabase } from '@/lib/supabase';

if (Platform.OS === 'ios' || Platform.OS === 'android') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

function resolveExpoProjectId(): string | null {
  const fromConfig =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
  const fromEnv =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() ||
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim() ||
    null;

  return fromConfig || fromEnv;
}

export function isNativePushNotificationsPlatform(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export function canRegisterForPushNotifications(): boolean {
  if (!isNativePushNotificationsPlatform()) {
    return false;
  }

  return Device.isDevice;
}

export async function ensureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync('default', {
    name: 'Athlete Arena',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#111111',
  });
}

export async function requestPushNotificationPermissions(): Promise<boolean> {
  if (!canRegisterForPushNotifications()) {
    return false;
  }

  await ensureAndroidNotificationChannel();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') {
    return true;
  }

  const { status } = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });

  return status === 'granted';
}

export async function getExpoPushToken(): Promise<string | null> {
  if (!canRegisterForPushNotifications()) {
    return null;
  }

  const projectId = resolveExpoProjectId();
  if (!projectId) {
    if (__DEV__) {
      console.warn(
        '[push] Missing EAS project ID. Run `eas init` or set EXPO_PUBLIC_EAS_PROJECT_ID in .env.',
      );
    }
    return null;
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

export async function registerPushTokenWithBackend(token: string): Promise<void> {
  assertSupabaseConfigured();

  const platform =
    Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

  const { error } = await supabase.rpc('register_push_token', {
    p_expo_push_token: token,
    p_platform: platform,
    p_device_name: Device.modelName ?? null,
  });

  if (error) {
    throw error;
  }
}

export async function unregisterPushTokenFromBackend(token: string): Promise<void> {
  assertSupabaseConfigured();

  const { error } = await supabase.rpc('unregister_push_token', {
    p_expo_push_token: token,
  });

  if (error) {
    throw error;
  }
}

export async function registerForPushNotifications(): Promise<string | null> {
  const granted = await requestPushNotificationPermissions();
  if (!granted) {
    return null;
  }

  const token = await getExpoPushToken();
  if (!token) {
    return null;
  }

  await registerPushTokenWithBackend(token);
  return token;
}
