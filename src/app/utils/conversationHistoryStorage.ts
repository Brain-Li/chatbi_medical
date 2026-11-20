import type { Conversation } from '../types';
import { DEFAULT_WORKSPACE_NAME } from './workspaceStorage';

export type HistoryFilter = 'all' | 'all-with-archived' | 'ask' | 'report' | 'archived';

export function getConversationLastQuestionAt(conversation: Conversation) {
  return conversation.messages.reduce<Date | null>((latest, message) => {
    if (message.role !== 'user') return latest;
    return !latest || message.timestamp.getTime() > latest.getTime() ? message.timestamp : latest;
  }, null) ?? conversation.updatedAt;
}

export function sortConversationsForHistory(conversations: Conversation[]) {
  return [...conversations].sort((first, second) => {
    const pinOrder = Number(Boolean(second.isPinned)) - Number(Boolean(first.isPinned));
    if (pinOrder) return pinOrder;
    if (first.isDemo && second.isDemo) return (first.demoOrder ?? 0) - (second.demoOrder ?? 0);
    if (first.isDemo) return -1;
    if (second.isDemo) return 1;
    return getConversationLastQuestionAt(second).getTime() - getConversationLastQuestionAt(first).getTime();
  });
}

export function filterConversationsForHistory(conversations: Conversation[], filter: HistoryFilter, query = '') {
  const normalizedQuery = query.trim().toLowerCase();
  return conversations.filter((conversation) => {
    if (filter !== 'all-with-archived' && Boolean(conversation.isArchived) !== (filter === 'archived')) return false;
    if ((filter === 'ask' || filter === 'report') && (conversation.workspaceType ?? 'ask') !== filter) return false;
    if (!normalizedQuery) return true;
    const firstQuestion = conversation.messages.find((message) => message.role === 'user')?.content ?? '';
    return `${conversation.title} ${firstQuestion}`.toLowerCase().includes(normalizedQuery);
  });
}

export function getConversationWorkspaceName(conversation: Pick<Conversation, 'workspaceName'>) {
  return conversation.workspaceName?.trim() || DEFAULT_WORKSPACE_NAME;
}

export function groupConversationsByWorkspace(workspaceNames: string[], conversations: Conversation[]) {
  const groups = new Map<string, Conversation[]>(workspaceNames.map((name) => [name, []]));
  for (const conversation of conversations) {
    const name = getConversationWorkspaceName(conversation);
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name)!.push(conversation);
  }
  return Array.from(groups, ([name, items]) => ({ name, items }));
}

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
