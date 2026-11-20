export const WORKSPACE_STORAGE_KEY = 'chatbi-medical-workspaces-v1';
export const WORKSPACE_CREATED_AT_STORAGE_KEY = 'chatbi-medical-workspace-created-at-v1';
export const DEFAULT_WORKSPACE_NAME = '默认工作区';

export const DEFAULT_WORKSPACES = [
  '【13】智能问数标品',
  '06 富通',
  DEFAULT_WORKSPACE_NAME,
];

export function readWorkspaceNames() {
  if (typeof window === 'undefined') return DEFAULT_WORKSPACES;

  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(parsed)) return DEFAULT_WORKSPACES;

    const names = parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
    return names.length ? names : DEFAULT_WORKSPACES;
  } catch {
    return DEFAULT_WORKSPACES;
  }
}

export function readWorkspaceCreatedAt(): Record<string, string> {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(WORKSPACE_CREATED_AT_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    return Object.fromEntries(Object.entries(parsed).filter(([, value]) =>
      typeof value === 'string' && Number.isFinite(new Date(value).getTime()),
    ));
  } catch {
    return {};
  }
}

// Legacy workspaces have no historical timestamp; initialize their first recorded
// time once, then preserve it across refreshes, saves and renames.
export function ensureWorkspaceCreatedAt(names: string[]): Record<string, string> {
  const createdAt = readWorkspaceCreatedAt();
  const missingNames = Array.from(new Set(names.map((name) => name.trim()).filter(Boolean)))
    .filter((name) => !Object.prototype.hasOwnProperty.call(createdAt, name));
  if (missingNames.length === 0) return createdAt;

  const recordedAt = new Date().toISOString();
  const nextCreatedAt = { ...createdAt, ...Object.fromEntries(missingNames.map((name) => [name, recordedAt])) };
  try {
    window.localStorage.setItem(WORKSPACE_CREATED_AT_STORAGE_KEY, JSON.stringify(nextCreatedAt));
  } catch {
    // Return initialized metadata to the current view even if storage is blocked.
  }
  return nextCreatedAt;
}

export function saveWorkspaceNames(names: string[], rename?: { from: string; to: string }) {
  const normalized = Array.from(new Set(names.map((name) => name.trim()).filter(Boolean)));
  if (typeof window === 'undefined') return normalized;

  const createdAt = readWorkspaceCreatedAt();
  const now = new Date().toISOString();
  const nextCreatedAt = Object.fromEntries(normalized.map((name) => {
    const sourceName = rename?.to === name ? rename.from : name;
    const existing = Object.prototype.hasOwnProperty.call(createdAt, sourceName) ? createdAt[sourceName] : undefined;
    return [name, existing ?? now];
  }));

  try {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Keep the change available to the current view when storage is unavailable.
  }

  try {
    window.localStorage.setItem(WORKSPACE_CREATED_AT_STORAGE_KEY, JSON.stringify(nextCreatedAt));
  } catch {
    // A missing creation time must not prevent workspace creation.
  }

  try {
    window.dispatchEvent(new CustomEvent('chatbi-medical-workspaces-changed'));
  } catch {
    // Keep the change available to the current view when storage is unavailable.
  }

  return normalized;
}

export function subscribeWorkspaceNames(onChange: (names: string[]) => void) {
  if (typeof window === 'undefined') return () => undefined;

  const handleChange = (event: Event) => {
    if (event instanceof StorageEvent && event.key !== null
      && event.key !== WORKSPACE_STORAGE_KEY && event.key !== WORKSPACE_CREATED_AT_STORAGE_KEY) return;
    onChange(readWorkspaceNames());
  };

  window.addEventListener('storage', handleChange);
  window.addEventListener('chatbi-medical-workspaces-changed', handleChange);
  return () => {
    window.removeEventListener('storage', handleChange);
    window.removeEventListener('chatbi-medical-workspaces-changed', handleChange);
  };
}
