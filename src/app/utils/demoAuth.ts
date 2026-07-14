export const AUTH_STORAGE_KEY = 'chatbi-medical-authenticated';
export const PERSISTENT_AUTH_STORAGE_KEY = 'chatbi-medical-persistent-authenticated';
export const PERSISTENT_AUTH_EXPIRES_AT_STORAGE_KEY = 'chatbi-medical-persistent-auth-expires-at';
const DEMO_PASSWORD_STORAGE_KEY = 'chatbi-medical-demo-password';
const DEFAULT_DEMO_PASSWORD = 'admin123';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function createDemoAuthSession(rememberMe: boolean) {
  if (rememberMe) {
    window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
    window.localStorage.setItem(PERSISTENT_AUTH_STORAGE_KEY, 'true');
    window.localStorage.setItem(PERSISTENT_AUTH_EXPIRES_AT_STORAGE_KEY, String(Date.now() + SEVEN_DAYS_MS));
    return;
  }

  window.localStorage.removeItem(PERSISTENT_AUTH_STORAGE_KEY);
  window.localStorage.removeItem(PERSISTENT_AUTH_EXPIRES_AT_STORAGE_KEY);
  window.sessionStorage.setItem(AUTH_STORAGE_KEY, 'true');
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
  }

  return isPersistentSessionValid;
}
