import { describe, expect, it } from 'vitest';
import type { Conversation } from '../types';
import { getWorkspaceDeletionTarget, getWorkspaceNames, moveWorkspaceConversations, validateWorkspaceRename } from './workspaceManagement';
import { DEFAULT_WORKSPACE_NAME } from './workspaceStorage';

const conversation = (id: string, workspaceName?: string): Conversation => ({
  id, title: id, workspaceName, workspaceType: 'ask', messages: [],
  createdAt: new Date('2026-11-17T00:00:00Z'), updatedAt: new Date('2026-11-17T01:00:00Z'),
});

describe('workspace management', () => {
  it('validates empty, overlength, duplicate and stale names while allowing a case change', () => {
    const names = ['分析', 'Work'];
    expect(validateWorkspaceRename('分析', '  ', names)).toBe('请输入工作区名称');
    expect(validateWorkspaceRename('分析', 'a'.repeat(21), names)).toBe('工作区名称最多20个字');
    expect(validateWorkspaceRename('分析', ' work ', names)).toBe('已存在名为“Work”的工作区。');
    expect(validateWorkspaceRename('missing', '新名称', names)).toBe('该工作区已不存在');
    expect(validateWorkspaceRename('Work', 'work', names)).toBeNull();
    expect(validateWorkspaceRename('分析', '新名称', names)).toBeNull();
  });

  it('includes workspaces found only in stored conversations, including archived ones', () => {
    expect(getWorkspaceNames(['A', 'A'], [conversation('a', 'B'), { ...conversation('archived', 'C'), isArchived: true }])).toEqual(['A', 'B', 'C']);
  });

  it('prefers the default destination and preserves at least one workspace', () => {
    expect(getWorkspaceDeletionTarget(['A', 'B', DEFAULT_WORKSPACE_NAME], 'A')).toBe(DEFAULT_WORKSPACE_NAME);
    expect(getWorkspaceDeletionTarget(['A', 'B', DEFAULT_WORKSPACE_NAME], DEFAULT_WORKSPACE_NAME)).toBe('A');
    expect(getWorkspaceDeletionTarget(['A'], 'A')).toBeNull();
  });

  it('moves all conversation types and archived records while preserving IDs, messages, pins and dates', () => {
    const first = { ...conversation('ask', 'A'), isPinned: true };
    const archived = { ...conversation('report', 'A'), workspaceType: 'report' as const, isArchived: true };
    const rca = { ...conversation('rca', 'A'), workspaceType: 'rca' as const };
    const other = conversation('other', 'B');
    const input = [first, archived, rca, other];
    const moved = moveWorkspaceConversations(input, 'A', 'B');
    expect(moved).toEqual(input.map((item) => ({ ...item, workspaceName: 'B' })));
    expect(moved[0].messages).toBe(first.messages);
    expect(moved[0].updatedAt).toBe(first.updatedAt);
    expect(moved[3]).toBe(other);
    expect(input[0].workspaceName).toBe('A');
  });

  it('assigns legacy unassigned conversations explicitly when renaming the default workspace', () => {
    const legacy = conversation('legacy');
    const moved = moveWorkspaceConversations([legacy], DEFAULT_WORKSPACE_NAME, '重新命名');
    expect(moved[0].workspaceName).toBe('重新命名');
    expect(legacy.workspaceName).toBeUndefined();
  });
});
