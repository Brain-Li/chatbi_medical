export type KnowledgeRole = 'admin' | 'maintainer' | 'member';
export type KnowledgeItemKind = 'folder' | 'file';
export type KnowledgeItemStatus = 'unindexed' | 'processing' | 'ready' | 'failed';
export type KnowledgeVisibility = 'team' | 'restricted' | 'private';
export type KnowledgeLibraryStatus = 'enabled' | 'disabled';

export const knowledgeVisibilityLabels = {
  team: { label: '当前租户全员可见', shortLabel: '租户全员' },
  restricted: { label: '仅当前租户的指定成员可见', shortLabel: '租户指定成员' },
  private: { label: '仅自己可见', shortLabel: '仅自己可见' },
} satisfies Record<KnowledgeVisibility, { label: string; shortLabel: string }>;

export interface KnowledgeLibraryInput {
  name: string;
  description: string;
  visibility: KnowledgeVisibility;
  status: KnowledgeLibraryStatus;
  memberIds: string[];
}

export interface KnowledgeLibrary extends Omit<KnowledgeLibraryInput, 'memberIds'> {
  id: string;
  createdBy: string;
  createdAt?: string;
  memberIds?: string[];
  fileCount: number;
  canManage: boolean;
  canEdit: boolean;
}

export interface KnowledgeItem {
  id: string;
  scopeId: string;
  parentId: string | null;
  kind: KnowledgeItemKind;
  name: string;
  mimeType?: string;
  size?: number;
  status?: KnowledgeItemStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeSession {
  userId: string;
  role: KnowledgeRole;
  canManage: boolean;
}

export interface KnowledgeListResponse {
  items: KnowledgeItem[];
  session: KnowledgeSession;
  library?: KnowledgeLibrary;
}
