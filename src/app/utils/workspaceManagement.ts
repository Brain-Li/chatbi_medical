import type { Conversation } from '../types';
import { getConversationWorkspaceName } from './conversationHistoryStorage';
import { DEFAULT_WORKSPACE_NAME } from './workspaceStorage';

export function getWorkspaceNames(names: string[], conversations: Conversation[]) {
  return Array.from(new Set([...names, ...conversations.map(getConversationWorkspaceName)]));
}

export function validateWorkspaceRename(currentName: string, draft: string, names: string[]) {
  const name = draft.trim();
  if (!names.includes(currentName)) return '该工作区已不存在';
  if (!name) return '请输入工作区名称';
  if (name.length > 20) return '工作区名称最多20个字';
  const duplicateName = names.find((existing) => existing !== currentName && existing.toLowerCase() === name.toLowerCase());
  if (duplicateName) {
    return `已存在名为“${duplicateName}”的工作区。`;
  }
  return null;
}

export function getWorkspaceDeletionTarget(names: string[], name: string) {
  const remaining = names.filter((existing) => existing !== name);
  return remaining.includes(DEFAULT_WORKSPACE_NAME) ? DEFAULT_WORKSPACE_NAME : remaining[0] ?? null;
}

export function moveWorkspaceConversations(conversations: Conversation[], from: string, to: string) {
  return conversations.map((conversation) => getConversationWorkspaceName(conversation) === from
    ? { ...conversation, workspaceName: to }
    : conversation);
}
