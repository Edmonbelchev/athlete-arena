export { AuthProvider, useAuth, type Session } from './AuthProvider';
export { AuthDeepLinkHandler } from './AuthDeepLinkHandler';
export { getAuthErrorMessage, isEmailNotConfirmedError } from './authErrors';
export {
  authService,
  isEmailRegistered,
  isUsernameAvailable,
  requestPasswordReset,
  resendSignUpConfirmation,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  updatePassword,
} from './authService';
export {
  isValidEmail,
  isValidPassword,
  isValidUsername,
  normalizeUsername,
} from './validation';
