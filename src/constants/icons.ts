import type { SymbolViewProps } from 'expo-symbols';

export type AppIconName =
  | 'home'
  | 'profile'
  | 'history'
  | 'friends'
  | 'menu'
  | 'close'
  | 'logout'
  | 'bell'
  | 'sun'
  | 'moon'
  | 'target'
  | 'medal'
  | 'flame'
  | 'bolt'
  | 'star'
  | 'crown'
  | 'dumbbell'
  | 'rocket'
  | 'quiz'
  | 'gift'
  | 'camera'
  | 'chevronBack'
  | 'settings'
  | 'support';

export const APP_ICONS: Record<AppIconName, SymbolViewProps['name']> = {
  home: { ios: 'house.fill', android: 'home', web: 'home' },
  profile: { ios: 'person.fill', android: 'person', web: 'person' },
  history: { ios: 'clock.arrow.circlepath', android: 'history', web: 'history' },
  friends: { ios: 'person.2.fill', android: 'group', web: 'group' },
  menu: { ios: 'line.3.horizontal', android: 'menu', web: 'menu' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  bell: { ios: 'bell.fill', android: 'notifications', web: 'notifications' },
  logout: {
    ios: 'rectangle.portrait.and.arrow.right',
    android: 'logout',
    web: 'logout',
  },
  sun: { ios: 'sun.max.fill', android: 'wb_sunny', web: 'wb_sunny' },
  moon: { ios: 'moon.fill', android: 'dark_mode', web: 'dark_mode' },
  target: { ios: 'target', android: 'track_changes', web: 'track_changes' },
  medal: { ios: 'medal.fill', android: 'military_tech', web: 'military_tech' },
  flame: { ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' },
  bolt: { ios: 'bolt.fill', android: 'bolt', web: 'bolt' },
  star: { ios: 'star.fill', android: 'star', web: 'star' },
  crown: { ios: 'crown.fill', android: 'emoji_events', web: 'emoji_events' },
  dumbbell: { ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' },
  rocket: { ios: 'paperplane.fill', android: 'rocket_launch', web: 'rocket_launch' },
  quiz: { ios: 'questionmark.circle.fill', android: 'quiz', web: 'quiz' },
  gift: { ios: 'gift.fill', android: 'redeem', web: 'redeem' },
  camera: { ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' },
  chevronBack: { ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' },
  settings: { ios: 'gearshape.fill', android: 'settings', web: 'settings' },
  support: {
    ios: 'questionmark.bubble.fill',
    android: 'support_agent',
    web: 'support_agent',
  },
};
