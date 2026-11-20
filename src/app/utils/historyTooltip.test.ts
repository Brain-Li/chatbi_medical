import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Conversation, Message } from '../types';
import { formatHistoryRelativeTime, formatHistoryTimestamp, getHistoryConversationStatus } from './historyTooltip';
import { DEFAULT_WORKSPACES, ensureWorkspaceCreatedAt, readWorkspaceCreatedAt, readWorkspaceNames, saveWorkspaceNames, WORKSPACE_CREATED_AT_STORAGE_KEY, WORKSPACE_STORAGE_KEY } from './workspaceStorage';

const now = new Date(2026, 10, 17, 14, 30);
const conversation = (messages: Message[] = []): Conversation => ({
  id: 'test', title: '测试会话', workspaceType: 'ask', messages, createdAt: now, updatedAt: now,
});
const message = (overrides: Partial<Message> = {}): Message => ({
  id: 'message', role: 'assistant', kind: 'text', content: '', timestamp: now, ...overrides,
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('history tooltip details', () => {
  it('formats relative time boundaries and older dates without negative durations', () => {
    const before = (milliseconds: number) => formatHistoryRelativeTime(new Date(now.getTime() - milliseconds), now.getTime());
    expect(before(-60_000)).toBe('刚刚');
    expect(before(59_999)).toBe('刚刚');
    expect(before(60_000)).toBe('1分钟前');
    expect(before(38 * 60_000)).toBe('38分钟前');
    expect(before(3_600_000)).toBe('1小时前');
    expect(before(86_400_000)).toBe('1天前');
    expect(before(7 * 86_400_000)).toBe('2026年11月10日 14:30');
    expect(formatHistoryTimestamp(new Date(2026, 0, 2, 9, 5))).toBe('2026年1月2日 09:05');
  });

  it('tracks generation, result waiting, interruption and archival instead of always displaying idle', () => {
    expect(getHistoryConversationStatus(conversation())).toBe('空闲');
    expect(getHistoryConversationStatus(conversation([message({ isGenerating: true })]))).toBe('进行中');
    expect(getHistoryConversationStatus(conversation([message({ isAwaitingResult: true })]))).toBe('进行中');
    expect(getHistoryConversationStatus(conversation([message({ isInterrupted: true, isGenerating: true })]))).toBe('已中断');
    expect(getHistoryConversationStatus({ ...conversation(), isArchived: true })).toBe('已归档');
    expect(getHistoryConversationStatus(conversation([message({ isGenerating: true }), message()]))).toBe('空闲');
  });

  it('handles stored process data with missing optional steps and recognizes confirmation steps', () => {
    const process = { status: 'completed' } as NonNullable<Message['analysisProcess']>;
    expect(getHistoryConversationStatus(conversation([message({ analysisProcess: process })]))).toBe('空闲');
    expect(getHistoryConversationStatus(conversation([message({ analysisProcess: { ...process, status: 'running' } })]))).toBe('进行中');
    expect(getHistoryConversationStatus(conversation([message({ analysisProcess: { ...process, steps: [{ id: 'confirm', title: '确认', status: 'awaiting-confirmation' }] } })]))).toBe('待确认');
  });
});

describe('workspace creation metadata', () => {
  const defaultCreationDates = Object.fromEntries(DEFAULT_WORKSPACES.map((name) => [name, now.toISOString()]));
  function setupStorage() {
    const storage = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
      dispatchEvent: vi.fn(),
    });
    vi.stubGlobal('CustomEvent', class { constructor(public type: string) {} });
    vi.useFakeTimers();
    vi.setSystemTime(now);
    return storage;
  }

  it('records new workspaces and preserves their creation time on later saves', () => {
    setupStorage();
    saveWorkspaceNames([...DEFAULT_WORKSPACES, ' 新建工作区 ']);
    expect(readWorkspaceNames()).toEqual([...DEFAULT_WORKSPACES, '新建工作区']);
    expect(readWorkspaceCreatedAt()).toEqual({ ...defaultCreationDates, 新建工作区: now.toISOString() });
    vi.setSystemTime(new Date(now.getTime() + 60_000));
    saveWorkspaceNames([...DEFAULT_WORKSPACES, '新建工作区', '另一个工作区']);
    expect(readWorkspaceCreatedAt()['新建工作区']).toBe(now.toISOString());
    expect(readWorkspaceCreatedAt()['另一个工作区']).toBe(new Date(now.getTime() + 60_000).toISOString());
  });

  it('initializes missing legacy timestamps once when saving', () => {
    const storage = setupStorage();
    storage.set(WORKSPACE_STORAGE_KEY, JSON.stringify(['已有工作区']));
    saveWorkspaceNames(['已有工作区', '新增']);
    expect(readWorkspaceCreatedAt()).toEqual({ 已有工作区: now.toISOString(), 新增: now.toISOString() });
    vi.setSystemTime(new Date(now.getTime() + 60_000));
    saveWorkspaceNames(['已有工作区', '新增']);
    expect(readWorkspaceCreatedAt()['已有工作区']).toBe(now.toISOString());
  });

  it('preserves creation metadata on rename and removes it on deletion', () => {
    setupStorage();
    saveWorkspaceNames([...DEFAULT_WORKSPACES, '旧名称']);
    vi.setSystemTime(new Date(now.getTime() + 60_000));
    saveWorkspaceNames([...DEFAULT_WORKSPACES, '新名称'], { from: '旧名称', to: '新名称' });
    expect(readWorkspaceCreatedAt()).toEqual({ ...defaultCreationDates, 新名称: now.toISOString() });
    expect(readWorkspaceNames()).not.toContain('旧名称');
    saveWorkspaceNames(DEFAULT_WORKSPACES);
    expect(readWorkspaceCreatedAt()).toEqual(defaultCreationDates);
    expect(readWorkspaceNames()).not.toContain('新名称');
  });

  it('backfills a legacy workspace during rename and preserves that recorded time on subsequent renames', () => {
    const storage = setupStorage();
    storage.set(WORKSPACE_STORAGE_KEY, JSON.stringify(['旧名称']));
    saveWorkspaceNames(['新名称'], { from: '旧名称', to: '新名称' });
    expect(readWorkspaceCreatedAt()).toEqual({ 新名称: now.toISOString() });
    vi.setSystemTime(new Date(now.getTime() + 60_000));
    saveWorkspaceNames(['再次改名'], { from: '新名称', to: '再次改名' });
    expect(readWorkspaceCreatedAt()).toEqual({ 再次改名: now.toISOString() });
  });

  it('initializes default and legacy workspaces on first display and keeps the persisted time after reload', () => {
    setupStorage();
    expect(ensureWorkspaceCreatedAt(DEFAULT_WORKSPACES)).toEqual(defaultCreationDates);
    vi.setSystemTime(new Date(now.getTime() + 60_000));
    expect(ensureWorkspaceCreatedAt(DEFAULT_WORKSPACES)).toEqual(defaultCreationDates);
    expect(readWorkspaceCreatedAt()).toEqual(defaultCreationDates);
  });

  it('fills missing or corrupt entries without overwriting valid historical timestamps', () => {
    const storage = setupStorage();
    const historical = new Date(now.getTime() - 86_400_000).toISOString();
    storage.set(WORKSPACE_CREATED_AT_STORAGE_KEY, JSON.stringify({ 有记录: historical, 无效: 'bad-date' }));
    const expected = { 有记录: historical, 无效: now.toISOString(), 无记录: now.toISOString() };
    expect(ensureWorkspaceCreatedAt(['有记录', '无效', '无记录'])).toEqual(expected);
    expect(readWorkspaceCreatedAt()).toEqual(expected);
  });

  it('ignores corrupt metadata and safely stores names that match object properties', () => {
    const storage = setupStorage();
    storage.set(WORKSPACE_CREATED_AT_STORAGE_KEY, '{bad json');
    expect(readWorkspaceCreatedAt()).toEqual({});
    storage.set(WORKSPACE_CREATED_AT_STORAGE_KEY, JSON.stringify({ invalid: 'not-a-date', valid: now.toISOString() }));
    expect(readWorkspaceCreatedAt()).toEqual({ valid: now.toISOString() });
    saveWorkspaceNames([...DEFAULT_WORKSPACES, '__proto__', 'constructor']);
    expect(Object.keys(readWorkspaceCreatedAt())).toEqual([...DEFAULT_WORKSPACES, '__proto__', 'constructor']);
  });
});
