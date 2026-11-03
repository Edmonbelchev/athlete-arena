/**
 * In-app purchases (Premium) are on for every platform. This single switch hides all purchase
 * screens and upgrade prompts and skips RevenueCat when false.
 *
 * If it is ever turned off for iOS again, Premium must also read as off there, even for people
 * who subscribed on Android: App Store Guideline 3.1.3(b) only allows unlocking content bought
 * elsewhere when the same content is also sold through In-App Purchase in the iOS app.
 */
export const IN_APP_PURCHASES_ENABLED = true;
