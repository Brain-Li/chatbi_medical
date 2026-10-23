import { clearHistoryVisibleCount } from './conversationHistoryStorage';

export const AUTH_STORAGE_KEY = 'chatbi-medical-authenticated';
export const PERSISTENT_AUTH_STORAGE_KEY = 'chatbi-medical-persistent-authenticated';
export const PERSISTENT_AUTH_EXPIRES_AT_STORAGE_KEY = 'chatbi-medical-persistent-auth-expires-at';
const AUTH_USERNAME_STORAGE_KEY = 'chatbi-medical-auth-username';
const DEMO_PASSWORD_STORAGE_KEY = 'chatbi-medical-demo-password';
const DEFAULT_DEMO_PASSWORD = 'admin123';
const LICENSE_REMINDER_DISMISSED_KEY = 'chatbi.license.reminder-dismissed';

function clearLicenseReminderDismissal() {
  window.sessionStorage.removeItem(LICENSE_REMINDER_DISMISSED_KEY);
  window.localStorage.removeItem(LICENSE_REMINDER_DISMISSED_KEY);
}

export function getDismissedLicenseReminder() {
  const storage = window.sessionStorage.getItem(AUTH_STORAGE_KEY) === 'true' ? window.sessionStorage : window.localStorage;
  return storage.getItem(LICENSE_REMINDER_DISMISSED_KEY);
}

export function dismissLicenseReminder(key: string) {
  const storage = window.sessionStorage.getItem(AUTH_STORAGE_KEY) === 'true' ? window.sessionStorage : window.localStorage;
  storage.setItem(LICENSE_REMINDER_DISMISSED_KEY, key);
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function createDemoAuthSession(rememberMe: boolean, username = 'admin') {
  clearLicenseReminderDismissal();
  if (rememberMe) {
    window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
    window.sessionStorage.removeItem(AUTH_USERNAME_STORAGE_KEY);
    window.localStorage.setItem(PERSISTENT_AUTH_STORAGE_KEY, 'true');
    window.localStorage.setItem(PERSISTENT_AUTH_EXPIRES_AT_STORAGE_KEY, String(Date.now() + SEVEN_DAYS_MS));
    window.localStorage.setItem(AUTH_USERNAME_STORAGE_KEY, username);
    return;
  }

  window.localStorage.removeItem(PERSISTENT_AUTH_STORAGE_KEY);
  window.localStorage.removeItem(PERSISTENT_AUTH_EXPIRES_AT_STORAGE_KEY);
  window.localStorage.removeItem(AUTH_USERNAME_STORAGE_KEY);
  window.sessionStorage.setItem(AUTH_STORAGE_KEY, 'true');
  window.sessionStorage.setItem(AUTH_USERNAME_STORAGE_KEY, username);
}

export function clearDemoAuthSession() {
  clearLicenseReminderDismissal();
  window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
  window.sessionStorage.removeItem(AUTH_USERNAME_STORAGE_KEY);
  window.localStorage.removeItem(PERSISTENT_AUTH_STORAGE_KEY);
  window.localStorage.removeItem(PERSISTENT_AUTH_EXPIRES_AT_STORAGE_KEY);
  window.localStorage.removeItem(AUTH_USERNAME_STORAGE_KEY);
  clearHistoryVisibleCount();
}

export function getDemoAuthUsername() {
  if (typeof window === 'undefined') return 'admin';

  return (
    window.sessionStorage.getItem(AUTH_USERNAME_STORAGE_KEY) ??
    window.localStorage.getItem(AUTH_USERNAME_STORAGE_KEY) ??
    'admin'
  );
}

export function getDemoPassword() {
  if (typeof window === 'undefined') return DEFAULT_DEMO_PASSWORD;

  return window.localStorage.getItem(DEMO_PASSWORD_STORAGE_KEY) ?? DEFAULT_DEMO_PASSWORD;
}

export function resetDemoPassword(password: string) {
  window.localStorage.setItem(DEMO_PASSWORD_STORAGE_KEY, password);
}

export function hasDemoAuthSession() {
  if (typeof window === 'undefined') return false;
  if (window.sessionStorage.getItem(AUTH_STORAGE_KEY) === 'true') return true;

  const expiresAt = Number(window.localStorage.getItem(PERSISTENT_AUTH_EXPIRES_AT_STORAGE_KEY));
  const isPersistentSessionValid =
    window.localStorage.getItem(PERSISTENT_AUTH_STORAGE_KEY) === 'true' && Number.isFinite(expiresAt) && expiresAt > Date.now();

  if (!isPersistentSessionValid) {
    window.localStorage.removeItem(PERSISTENT_AUTH_STORAGE_KEY);
    window.localStorage.removeItem(PERSISTENT_AUTH_EXPIRES_AT_STORAGE_KEY);
    window.localStorage.removeItem(AUTH_USERNAME_STORAGE_KEY);
    clearHistoryVisibleCount();
  }

  return isPersistentSessionValid;
}
