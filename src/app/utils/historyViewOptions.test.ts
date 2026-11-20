import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Conversation } from '../types';
import { filterConversationsForHistory, groupConversationsByWorkspace } from './conversationHistoryStorage';
import { HISTORY_MANUAL_ORDER_KEY, HISTORY_VIEW_OPTIONS_KEY, moveHistoryItem, persistHistoryViewOptions, readHistoryManualOrder, readHistoryViewOptions, reorderWorkspaceConversations, sortHistoryConversations } from './historyViewOptions';

const conversation = (id: string, workspaceName = 'A', day = 17): Conversation => ({
  id, title: id, workspaceName, workspaceType: 'ask', messages: [],
  createdAt: new Date('2026-11-01T00:00:00Z'), updatedAt: new Date(`2026-11-${day}T00:00:00Z`),
});
afterEach(() => vi.unstubAllGlobals());

describe('history view ordering', () => {
  it('sorts by actual updates, including demo conversations, while retaining pinned priority', () => {
    const items = [{ ...conversation('demo', 'A', 12), isDemo: true }, conversation('new'), { ...conversation('pin', 'A', 10), isPinned: true }];
    expect(sortHistoryConversations(items, 'recent', ['demo', 'new', 'pin']).map((item) => item.id)).toEqual(['pin', 'new', 'demo']);
    expect(items.map((item) => item.id)).toEqual(['demo', 'new', 'pin']);
  });

  it('prioritizes pins over manual positions and restores manual positions after unpinning', () => {
    const items = [conversation('first', 'A', 10), { ...conversation('second'), isPinned: true }, conversation('new')];
    expect(sortHistoryConversations(items, 'manual', ['first', 'second']).map((item) => item.id)).toEqual(['second', 'first', 'new']);
    expect(sortHistoryConversations(items, 'recent', ['first', 'second']).map((item) => item.id)).toEqual(['second', 'new', 'first']);
    expect(sortHistoryConversations(items.map((item) => ({ ...item, isPinned: false })), 'manual', ['first', 'second'])
      .map((item) => item.id)).toEqual(['first', 'second', 'new']);
  });

  it.each(['manual', 'recent'] as const)('keeps pinned conversations above archived and active conversations in each workspace with %s sorting', (sort) => {
    const items = [
      { ...conversation('archived', 'A'), isArchived: true },
      conversation('active', 'A'),
      { ...conversation('pin-a', 'A', 10), isPinned: true },
      { ...conversation('archived-b', 'B'), isArchived: true },
      { ...conversation('pin-b', 'B', 11), isPinned: true },
    ];
    const ordered = filterConversationsForHistory(sortHistoryConversations(items, sort, items.map((item) => item.id)), 'all-with-archived');
    expect(groupConversationsByWorkspace(['B', 'A'], ordered).map((group) => [group.name, group.items.map((item) => item.id)]))
      .toEqual([['B', ['pin-b', 'archived-b']], ['A', ['pin-a', 'archived', 'active']]]);
    expect(items[0].isArchived).toBe(true);
    expect(items[2].workspaceName).toBe('A');
  });

  it('keeps pins first even after dragging an archived conversation ahead of them', () => {
    const items = [{ ...conversation('pin'), isPinned: true }, { ...conversation('archived'), isArchived: true }, conversation('active')];
    const order = reorderWorkspaceConversations(items, ['pin', 'active', 'archived'], 'archived', 'pin', 'before')!;
    expect(sortHistoryConversations(items, 'manual', order).map((item) => item.id)).toEqual(['pin', 'archived', 'active']);
  });

  it('moves workspaces both before and after other workspaces without losing empty ones', () => {
    const names = ['A', 'Empty', 'B'];
    expect(moveHistoryItem(names, 'A', 'B', 'after')).toEqual(['Empty', 'B', 'A']);
    expect(moveHistoryItem(names, 'B', 'A', 'before')).toEqual(['B', 'A', 'Empty']);
    expect(moveHistoryItem(names, 'A', 'missing', 'after')).toBe(names);
    expect(names).toEqual(['A', 'Empty', 'B']);
  });

  it('reorders only the source workspace and leaves other workspace positions intact', () => {
    const items = [conversation('a1'), conversation('b1', 'B'), conversation('a2'), conversation('b2', 'B'), conversation('a3')];
    const order = reorderWorkspaceConversations(items, [], 'a3', 'a1', 'before')!;
    expect(order).toEqual(['a3', 'b1', 'a1', 'b2', 'a2']);
    expect(groupConversationsByWorkspace(['A', 'B'], sortHistoryConversations(items, 'manual', order))
      .map((group) => group.items.map((item) => item.id))).toEqual([['a3', 'a1', 'a2'], ['b1', 'b2']]);
    expect(items.map((item) => item.id)).toEqual(['a1', 'b1', 'a2', 'b2', 'a3']);
  });

  it('rejects cross-workspace, missing and self drops without changing membership', () => {
    const items = [conversation('a'), conversation('b', 'B')];
    expect(reorderWorkspaceConversations(items, [], 'a', 'b', 'after')).toBeNull();
    expect(reorderWorkspaceConversations(items, [], 'missing', 'a', 'before')).toBeNull();
    expect(reorderWorkspaceConversations(items, [], 'a', 'a', 'before')).toBeNull();
    expect(items.map((item) => item.workspaceName)).toEqual(['A', 'B']);
  });

  it('retains hidden archived items when reordering filtered results and survives workspace renaming', () => {
    const items = [conversation('a1'), { ...conversation('archived'), isArchived: true }, conversation('a2')];
    const order = reorderWorkspaceConversations(items, [], 'a2', 'a1', 'before')!;
    const renamed = items.map((item) => ({ ...item, workspaceName: 'Renamed' }));
    expect(filterConversationsForHistory(sortHistoryConversations(renamed, 'manual', order), 'all').map((item) => item.id)).toEqual(['a2', 'a1']);
    expect(sortHistoryConversations(renamed, 'manual', order).map((item) => item.id)).toEqual(['a2', 'a1', 'archived']);
    expect(items[1].isArchived).toBe(true);
  });
});

describe('history view persistence', () => {
  it('restores view options and manual order from storage after a reload', () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('window', { localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } });
    const options = { grouping: 'tree' as const, sort: 'manual' as const, filter: 'all-with-archived' as const };
    persistHistoryViewOptions(options, ['a2', 'a1']);
    expect(readHistoryViewOptions()).toEqual(options);
    expect(readHistoryManualOrder()).toEqual(['a2', 'a1']);
    storage.set(HISTORY_VIEW_OPTIONS_KEY, '{broken');
    storage.set(HISTORY_MANUAL_ORDER_KEY, JSON.stringify(['a', 'a', 42, 'b']));
    expect(readHistoryViewOptions()).toEqual({ grouping: 'workspace', sort: 'recent', filter: 'all' });
    expect(readHistoryManualOrder()).toEqual(['a', 'b']);
  });

  it('falls back to usable defaults for invalid preferences or unavailable storage', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => JSON.stringify({ grouping: 'unknown', sort: 'unknown', filter: 'unknown' }) } });
    expect(readHistoryViewOptions()).toEqual({ grouping: 'workspace', sort: 'recent', filter: 'all' });
    vi.stubGlobal('window', { localStorage: { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } } });
    expect(readHistoryManualOrder()).toEqual([]);
    expect(() => persistHistoryViewOptions(readHistoryViewOptions(), [])).not.toThrow();
  });
});
