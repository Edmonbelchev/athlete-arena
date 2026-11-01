import { Platform } from 'react-native';

/**
 * In-app purchases (Premium) are switched off on iOS for now: no purchase screens, no upgrade
 * prompts, and RevenueCat is never configured there.
 *
 * Premium also reads as off on iOS, even for people who subscribed on Android: App Store
 * Guideline 3.1.3(b) only allows unlocking content bought elsewhere when the same content is
 * also sold through In-App Purchase in the iOS app.
 *
 * To turn purchases back on for iOS, return true here (and submit the subscription products
 * with the app version in App Store Connect).
 */
export const IN_APP_PURCHASES_ENABLED = Platform.OS !== 'ios';
