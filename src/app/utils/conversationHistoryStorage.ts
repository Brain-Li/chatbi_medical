export const HISTORY_BATCH_SIZE = 30;
export const HISTORY_VISIBLE_COUNT_STORAGE_KEY =
  'chatbi_medical.historyVisibleConversationCount.v1';

function normalizeHistoryVisibleCount(value: number) {
  if (!Number.isFinite(value) || value <= HISTORY_BATCH_SIZE) {
    return HISTORY_BATCH_SIZE;
  }

  return Math.ceil(value / HISTORY_BATCH_SIZE) * HISTORY_BATCH_SIZE;
}

export function readHistoryVisibleCount() {
  if (typeof window === 'undefined') return HISTORY_BATCH_SIZE;

  try {
    return normalizeHistoryVisibleCount(
      Number(window.localStorage.getItem(HISTORY_VISIBLE_COUNT_STORAGE_KEY)),
    );
  } catch {
    return HISTORY_BATCH_SIZE;
  }
}

export function persistHistoryVisibleCount(value: number) {
  try {
    window.localStorage.setItem(
      HISTORY_VISIBLE_COUNT_STORAGE_KEY,
      String(normalizeHistoryVisibleCount(value)),
    );
  } catch {
    // Keep the in-memory count when local storage is unavailable.
  }
}

export function clearHistoryVisibleCount() {
  try {
    window.localStorage.removeItem(HISTORY_VISIBLE_COUNT_STORAGE_KEY);
  } catch {
    // Logging out must continue even when local storage is unavailable.
  }
}
