import Constants from 'expo-constants';

export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
export const APP_STAGE = 'beta' as const;
export const APP_VERSION_LABEL = `${APP_VERSION} (${APP_STAGE})`;

export const SUPPORT_EMAIL = 'support@athlete-arena.app';
export const AUTH_EMAIL_REDIRECT_URL = 'athletearena://login';
