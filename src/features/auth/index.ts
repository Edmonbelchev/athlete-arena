export { AuthProvider, useAuth, type Session } from './AuthProvider';
export { getAuthErrorMessage, isEmailNotConfirmedError } from './authErrors';
export {
  authService,
  isEmailRegistered,
  isUsernameAvailable,
  resendSignUpConfirmation,
  signInWithEmail,
  signOut,
  signUpWithEmail,
} from './authService';
export {
  isValidEmail,
  isValidPassword,
  isValidUsername,
  normalizeUsername,
} from './validation';
