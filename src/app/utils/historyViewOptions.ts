import type { Conversation } from '../types';
import { getConversationWorkspaceName, type HistoryFilter } from './conversationHistoryStorage';

export type HistoryGrouping = 'workspace' | 'tree' | 'list';
export type HistorySort = 'manual' | 'recent';
export type DropPlacement = 'before' | 'after';
export type HistoryViewOptions = {
  grouping: HistoryGrouping;
  sort: HistorySort;
  filter: HistoryFilter;
};

export const HISTORY_VIEW_OPTIONS_KEY = 'chatbi-medical-history-view-options-v1';
export const HISTORY_MANUAL_ORDER_KEY = 'chatbi-medical-history-manual-order-v1';
const DEFAULT_OPTIONS: HistoryViewOptions = { grouping: 'workspace', sort: 'recent', filter: 'all' };

export function readHistoryViewOptions(): HistoryViewOptions {
  try {
    const value = JSON.parse(window.localStorage.getItem(HISTORY_VIEW_OPTIONS_KEY) ?? 'null');
    return {
      grouping: ['workspace', 'tree', 'list'].includes(value?.grouping) ? value.grouping : DEFAULT_OPTIONS.grouping,
      sort: ['manual', 'recent'].includes(value?.sort) ? value.sort : DEFAULT_OPTIONS.sort,
      filter: ['all', 'all-with-archived', 'archived'].includes(value?.filter) ? value.filter : DEFAULT_OPTIONS.filter,
    };
  } catch {
    return { ...DEFAULT_OPTIONS };
  }
}

export function readHistoryManualOrder(): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(HISTORY_MANUAL_ORDER_KEY) ?? 'null');
    return Array.isArray(value) ? Array.from(new Set(value.filter((id): id is string => typeof id === 'string'))) : [];
  } catch {
    return [];
  }
}

export function persistHistoryViewOptions(options: HistoryViewOptions, manualOrder: string[]) {
  try {
    window.localStorage.setItem(HISTORY_VIEW_OPTIONS_KEY, JSON.stringify(options));
    window.localStorage.setItem(HISTORY_MANUAL_ORDER_KEY, JSON.stringify(manualOrder));
  } catch {
    // Keep view changes available in memory if local storage is unavailable.
  }
}

export function sortHistoryConversations(conversations: Conversation[], sort: HistorySort, manualOrder: string[]) {
  const ranks = new Map(manualOrder.map((id, index) => [id, index]));
  return [...conversations].sort((first, second) => {
    const pinOrder = Number(Boolean(second.isPinned)) - Number(Boolean(first.isPinned));
    if (pinOrder) return pinOrder;
    if (sort === 'manual') {
      const firstRank = ranks.get(first.id) ?? Number.MAX_SAFE_INTEGER;
      const secondRank = ranks.get(second.id) ?? Number.MAX_SAFE_INTEGER;
      if (firstRank !== secondRank) return firstRank - secondRank;
    }
    return second.updatedAt.getTime() - first.updatedAt.getTime();
  });
}

export function moveHistoryItem<T>(items: T[], source: T, target: T, placement: DropPlacement): T[] {
  if (source === target || !items.includes(source) || !items.includes(target)) return items;
  const next = items.filter((item) => item !== source);
  next.splice(next.indexOf(target) + Number(placement === 'after'), 0, source);
  return next;
}

export function reorderWorkspaceConversations(
  conversations: Conversation[], manualOrder: string[], sourceId: string, targetId: string, placement: DropPlacement,
): string[] | null {
  const source = conversations.find((item) => item.id === sourceId);
  const target = conversations.find((item) => item.id === targetId);
  if (!source || !target || sourceId === targetId
    || getConversationWorkspaceName(source) !== getConversationWorkspaceName(target)) return null;

  const ordered = sortHistoryConversations(conversations, 'manual', manualOrder);
  const workspace = getConversationWorkspaceName(source);
  const workspaceIds = ordered.filter((item) => getConversationWorkspaceName(item) === workspace).map((item) => item.id);
  const moved = moveHistoryItem(workspaceIds, sourceId, targetId, placement);
  let index = 0;
  return ordered.map((item) => getConversationWorkspaceName(item) === workspace ? moved[index++] : item.id);
}
