import { describe, expect, it } from 'vitest';
import type { Conversation } from '../types';
import { filterConversationsForHistory, getConversationWorkspaceName, groupConversationsByWorkspace, sortConversationsForHistory } from './conversationHistoryStorage';
import { DEFAULT_WORKSPACE_NAME } from './workspaceStorage';

const conversation = (id: string, workspaceName?: string): Conversation => ({
  id,
  title: id,
  workspaceName,
  workspaceType: 'ask',
  messages: [],
  createdAt: new Date('2026-11-17T00:00:00Z'),
  updatedAt: new Date('2026-11-17T00:00:00Z'),
});

describe('conversation archive and pin behavior', () => {
  it('shows archived and unarchived conversations of all modes together when requested', () => {
    const active = conversation('revenue active', 'A');
    const archived = { ...conversation('revenue archived', 'B'), isArchived: true };
    const report = { ...conversation('report', 'A'), workspaceType: 'report' as const };
    const archivedReport = { ...conversation('archived report', 'B'), workspaceType: 'report' as const, isArchived: true };
    const items = [active, archived, report, archivedReport];
    expect(filterConversationsForHistory(items, 'all-with-archived')).toEqual(items);
    expect(filterConversationsForHistory(items, 'all-with-archived', 'REVENUE')).toEqual([active, archived]);
    expect(filterConversationsForHistory(items, 'all-with-archived', 'missing')).toEqual([]);
    expect(archived.isArchived).toBe(true);
    expect(archivedReport.isArchived).toBe(true);
  });

  it('excludes archived conversations from normal lists and search, and allows archived-only search', () => {
    const active = conversation('revenue active', 'A');
    const archived = { ...conversation('revenue archived', 'A'), isArchived: true };
    const items = [active, archived];
    expect(filterConversationsForHistory(items, 'all', 'revenue')).toEqual([active]);
    expect(filterConversationsForHistory(items, 'ask')).toEqual([active]);
    expect(filterConversationsForHistory(items, 'archived', 'REVENUE')).toEqual([archived]);
    expect(filterConversationsForHistory(items, 'archived', 'missing')).toEqual([]);
  });

  it('places pinned conversations ahead of newer and demonstration conversations without mutating input', () => {
    const olderPinned = { ...conversation('pinned', 'A'), isPinned: true, updatedAt: new Date('2026-11-16T00:00:00Z') };
    const newer = conversation('newer', 'A');
    const demo = { ...conversation('demo', 'A'), isDemo: true };
    const items = [newer, demo, olderPinned];
    expect(sortConversationsForHistory(items).map((item) => item.id)).toEqual(['pinned', 'demo', 'newer']);
    expect(items.map((item) => item.id)).toEqual(['newer', 'demo', 'pinned']);
    expect(olderPinned.updatedAt.toISOString()).toBe('2026-11-16T00:00:00.000Z');
  });

  it('keeps pins inside their workspace and restores date order after unpinning', () => {
    const old = { ...conversation('old', 'A'), isPinned: true, updatedAt: new Date('2026-11-16T00:00:00Z') };
    const recent = conversation('recent', 'A');
    const other = { ...conversation('other', 'B'), isPinned: true };
    expect(groupConversationsByWorkspace(['A', 'B'], sortConversationsForHistory([recent, other, old]))
      .map((group) => [group.name, group.items.map((item) => item.id)])).toEqual([['A', ['old', 'recent']], ['B', ['other']]]);
    expect(sortConversationsForHistory([recent, { ...old, isPinned: false }]).map((item) => item.id)).toEqual(['recent', 'old']);
  });

  it('restores archived conversations to their original workspace with their pin state intact', () => {
    const archived = { ...conversation('saved', 'B'), isArchived: true, isPinned: true };
    expect(filterConversationsForHistory([archived], 'all')).toEqual([]);
    const restored = { ...archived, isArchived: false };
    expect(groupConversationsByWorkspace(['A', 'B'], filterConversationsForHistory([restored], 'all'))).toEqual([
      { name: 'A', items: [] }, { name: 'B', items: [restored] },
    ]);
    expect(restored.isPinned).toBe(true);
  });
});

describe('workspace conversation groups', () => {
  it('keeps each conversation in its own workspace and preserves input ordering', () => {
    const items = [conversation('a-new', 'A'), conversation('b', 'B'), conversation('a-old', 'A')];
    const groups = groupConversationsByWorkspace(['B', 'A', 'Empty'], items);
    expect(groups.map((group) => [group.name, group.items.map((item) => item.id)])).toEqual([
      ['B', ['b']], ['A', ['a-new', 'a-old']], ['Empty', []],
    ]);
    expect(items.map((item) => item.id)).toEqual(['a-new', 'b', 'a-old']);
  });

  it('places legacy unassigned conversations only in the default workspace', () => {
    const legacy = conversation('legacy');
    const groups = groupConversationsByWorkspace(['A', DEFAULT_WORKSPACE_NAME], [legacy]);
    expect(groups[0].items).toEqual([]);
    expect(groups[1].items).toEqual([legacy]);
    expect(legacy.workspaceName).toBeUndefined();
    expect(getConversationWorkspaceName(conversation('blank', '  '))).toBe(DEFAULT_WORKSPACE_NAME);
  });

  it('keeps stored conversations reachable when their workspace is missing from the name list', () => {
    const restored = conversation('restored', 'Stored workspace');
    const groups = groupConversationsByWorkspace(['A'], [restored]);
    expect(groups.map((group) => group.name)).toEqual(['A', 'Stored workspace']);
    expect(groups[1].items).toEqual([restored]);
  });

  it('shows a newly created empty conversation under its selected workspace without duplication', () => {
    const created = conversation('new', 'A');
    const groups = groupConversationsByWorkspace(['A', 'A', 'B'], [created]);
    expect(groups).toEqual([{ name: 'A', items: [created] }, { name: 'B', items: [] }]);
  });
});
