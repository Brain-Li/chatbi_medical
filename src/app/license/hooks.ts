import { useState, useSyncExternalStore, type SetStateAction } from 'react';
import { getLicenseSnapshot, subscribeLicense } from './service';
import { getDemoAuthUsername } from '../utils/demoAuth';

export function useLicense() { return useSyncExternalStore(subscribeLicense, getLicenseSnapshot, getLicenseSnapshot); }

// Configuration forms may contain credentials: keep these drafts in memory only.
const memoryDrafts = new Map<string, unknown>();
export function useMemoryDraft<T>(key: string, initial: T | (() => T)) {
  const id = getDemoAuthUsername() + '.' + key;
  const [value, setValue] = useState<T>(() => memoryDrafts.has(id) ? memoryDrafts.get(id) as T : typeof initial === 'function' ? (initial as () => T)() : initial);
  const update = (next: SetStateAction<T>) => setValue(current => {
    const resolved = typeof next === 'function' ? (next as (value: T) => T)(current) : next;
    memoryDrafts.set(id, resolved);
    return resolved;
  });
  return [value, update] as const;
}

export function useSessionDraft<T>(key: string, initial: T | (() => T)) {
  const storageKey = 'chatbi.draft.' + getDemoAuthUsername() + '.' + key;
  const [value, setValue] = useState<T>(() => {
    try { const raw = sessionStorage.getItem(storageKey); if (raw !== null) return JSON.parse(raw); } catch { /* Draft storage is optional. */ }
    return typeof initial === 'function' ? (initial as () => T)() : initial;
  });
  const update = (next: SetStateAction<T>) => {
    setValue(current => {
      const resolved = typeof next === 'function' ? (next as (value: T) => T)(current) : next;
      try { sessionStorage.setItem(storageKey, JSON.stringify(resolved)); } catch { /* Keep the in-memory draft. */ }
      return resolved;
    });
  };
  return [value, update] as const;
}
