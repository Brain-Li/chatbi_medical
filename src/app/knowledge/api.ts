import type { KnowledgeItem, KnowledgeLibrary, KnowledgeLibraryInput, KnowledgeLibraryStatus, KnowledgeListResponse, KnowledgeSession } from './types';
import { getDemoAuthUsername } from '../utils/demoAuth';

const STORAGE_KEY = 'chatbi-medical-knowledge-demo-v1';
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['pdf', 'docx', 'xlsx', 'pptx', 'txt', 'md']);
export const unsupportedFileFormatMessage = '上传失败：暂不支持该文件格式。仅支持 PDF、Word、Excel、PPT、TXT 或 Markdown 文件。';
export const fileSizeLimitErrorMessage = '上传失败：文件大小超过 50 MB。';

type StoredItem = KnowledgeItem & { demoText?: string };
type DemoStore = { libraries: KnowledgeLibrary[]; items: StoredItem[] };
const createdAt = '2026-11-19T05:39:00.000Z';
const seedStore: DemoStore = {
  libraries: [
    { id: 'demo-library-333', name: '3333333333333333333', description: '333333333333333333333333333333333333333333333333', visibility: 'private', status: 'enabled', memberIds: [], createdBy: 'admin', createdAt, fileCount: 0, canManage: true, canEdit: true },
    { id: 'demo-library-222', name: '2222222222222222222', description: '222222222222222222222222222222222222222222222222', visibility: 'restricted', status: 'enabled', memberIds: ['member'], createdBy: 'admin', createdAt, fileCount: 0, canManage: true, canEdit: true },
    { id: 'demo-library-111', name: '1111111111111111111', description: '111111111111111111111111111111111111111111111111', visibility: 'team', status: 'enabled', memberIds: [], createdBy: 'admin', createdAt, fileCount: 0, canManage: true, canEdit: true },
  ],
  items: [],
};
const transientFiles = new Map<string, Blob>();

function clone<T>(value: T): T { return structuredClone(value); }
function writeStore(store: DemoStore) {
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}
function readStore(): DemoStore {
  if (typeof window === 'undefined') return clone(seedStore);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoStore;
      if (Array.isArray(parsed.libraries) && Array.isArray(parsed.items)) return parsed;
    }
  } catch { window.localStorage.removeItem(STORAGE_KEY); }
  writeStore(clone(seedStore));
  return clone(seedStore);
}
function session(): KnowledgeSession {
  const userId = getDemoAuthUsername() || 'admin';
  const role = userId === 'member' ? 'member' : userId === 'maintainer' ? 'maintainer' : 'admin';
  return { userId, role, canManage: role !== 'member' };
}
function canView(library: KnowledgeLibrary, current: KnowledgeSession) {
  if (library.status === 'disabled') return current.canManage && (library.createdBy === current.userId || (current.role === 'admin' && library.visibility === 'team'));
  return library.visibility === 'team' || library.createdBy === current.userId || (library.visibility === 'restricted' && library.memberIds?.includes(current.userId));
}
function canEdit(library: KnowledgeLibrary, current: KnowledgeSession) {
  return current.canManage && (library.createdBy === current.userId || (current.role === 'admin' && library.visibility === 'team'));
}
function findLibrary(store: DemoStore, id: string, current = session()) {
  const library = store.libraries.find((entry) => entry.id === id);
  if (!library || !canView(library, current)) throw new Error('知识库不存在或你没有查看权限。');
  return library;
}
function summarized(library: KnowledgeLibrary, store: DemoStore, current: KnowledgeSession): KnowledgeLibrary {
  return { ...library, memberIds: canEdit(library, current) ? library.memberIds ?? [] : undefined,
    fileCount: store.items.filter((item) => item.scopeId === library.id && item.kind === 'file').length,
    canManage: current.canManage && (library.visibility === 'team' || library.createdBy === current.userId), canEdit: canEdit(library, current) };
}
function makeId() { return globalThis.crypto?.randomUUID?.() ?? 'demo-' + Date.now().toString(36) + Math.random().toString(36).slice(2); }
function checkAbort(signal?: AbortSignal) { if (signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError'); }
function findItem(store: DemoStore, id: string) {
  const item = store.items.find((entry) => entry.id === id);
  if (!item) throw new Error('文件或文件夹不存在。');
  findLibrary(store, item.scopeId);
  return item;
}

export async function listKnowledgeLibraries(signal?: AbortSignal) {
  checkAbort(signal);
  const store = readStore(); const current = session();
  return { libraries: store.libraries.filter((library) => canView(library, current)).map((library) => summarized(library, store, current)), session: current };
}

export async function saveKnowledgeLibrary(data: KnowledgeLibraryInput, id?: string) {
  const store = readStore(); const current = session(); const now = new Date().toISOString();
  if (id) {
    const library = findLibrary(store, id, current);
    if (!canEdit(library, current)) throw new Error('你没有此知识库的设置权限。');
    Object.assign(library, data, { memberIds: data.visibility === 'restricted' ? data.memberIds : [], updatedAt: now });
    writeStore(store); return summarized(library, store, current);
  }
  const library: KnowledgeLibrary = { ...data, id: makeId(), createdBy: current.userId, createdAt: now,
    memberIds: data.visibility === 'restricted' ? data.memberIds : [], fileCount: 0, canManage: true, canEdit: true };
  store.libraries.push(library); writeStore(store); return summarized(library, store, current);
}

export async function updateKnowledgeLibraryStatus(id: string, status: KnowledgeLibraryStatus) {
  const store = readStore(); const current = session(); const library = findLibrary(store, id, current);
  if (!canEdit(library, current)) throw new Error('你没有此知识库的设置权限。');
  library.status = status; writeStore(store); return summarized(library, store, current);
}

export async function deleteKnowledgeLibrary(id: string) {
  const store = readStore(); const current = session(); const library = findLibrary(store, id, current);
  if (!canEdit(library, current)) throw new Error('你没有此知识库的设置权限。');
  const removed = store.items.filter((item) => item.scopeId === id);
  store.items = store.items.filter((item) => item.scopeId !== id); store.libraries = store.libraries.filter((item) => item.id !== id);
  removed.forEach((item) => transientFiles.delete(item.id)); writeStore(store); return { deleted: removed.length };
}

export async function getKnowledgeLibrary(scopeId?: string, signal?: AbortSignal): Promise<KnowledgeListResponse> {
  checkAbort(signal);
  const store = readStore(); const current = session();
  if (!scopeId) return { items: store.items.filter((item) => canView(findLibrary(store, item.scopeId, current), current)).map(clone), session: current };
  const library = findLibrary(store, scopeId, current);
  if (library.status === 'disabled' && !canEdit(library, current)) throw new Error('知识库已停用。');
  return { items: store.items.filter((item) => item.scopeId === scopeId).map(clone), session: current, library: summarized(library, store, current) };
}

export async function getKnowledgeSession() { return { session: session() }; }

export async function uploadKnowledgeFile(scopeId: string, parentId: string | null, file: File, signal?: AbortSignal) {
  checkAbort(signal);
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_EXTENSIONS.has(extension)) throw new Error(unsupportedFileFormatMessage);
  if (file.size > MAX_FILE_SIZE) throw new Error(fileSizeLimitErrorMessage);
  const store = readStore(); const current = session(); const library = findLibrary(store, scopeId, current);
  if (!canEdit(library, current)) throw new Error('你没有此知识库的管理权限。');
  if (parentId && !store.items.some((item) => item.id === parentId && item.scopeId === scopeId && item.kind === 'folder')) throw new Error('目标文件夹不存在。');
  const now = new Date().toISOString(); const id = makeId();
  const item: StoredItem = { id, scopeId, parentId, kind: 'file', name: file.name, mimeType: file.type, size: file.size,
    status: 'unindexed', createdBy: current.userId, createdAt: now, updatedAt: now };
  if (['txt', 'md'].includes(extension) && file.size <= 200_000) item.demoText = await file.text();
  transientFiles.set(id, file); store.items.push(item); writeStore(store); return clone(item);
}

export async function updateKnowledgeItem(id: string, updates: { name?: string; parentId?: string | null }) {
  const store = readStore(); const item = findItem(store, id); const library = findLibrary(store, item.scopeId);
  if (!canEdit(library, session())) throw new Error('你没有此知识库的管理权限。');
  if (updates.parentId && !store.items.some((entry) => entry.id === updates.parentId && entry.scopeId === item.scopeId && entry.kind === 'folder')) throw new Error('目标文件夹不存在。');
  Object.assign(item, updates, { updatedAt: new Date().toISOString() }); writeStore(store); return clone(item);
}

export async function deleteKnowledgeItem(id: string) {
  const store = readStore(); const item = findItem(store, id); const library = findLibrary(store, item.scopeId);
  if (!canEdit(library, session())) throw new Error('你没有此知识库的管理权限。');
  const ids = new Set([id]);
  for (const parentId of ids) for (const child of store.items) if (child.parentId === parentId) ids.add(child.id);
  const removed = store.items.filter((entry) => ids.has(entry.id));
  store.items = store.items.filter((entry) => !ids.has(entry.id)); removed.forEach((entry) => transientFiles.delete(entry.id));
  writeStore(store); return { deleted: removed.length };
}

export async function retryKnowledgeIndex(id: string) {
  const store = readStore(); const item = findItem(store, id);
  item.status = 'ready'; item.updatedAt = new Date().toISOString(); writeStore(store); return clone(item);
}

export async function readKnowledgeFile(id: string, signal?: AbortSignal) {
  checkAbort(signal);
  const item = findItem(readStore(), id);
  const file = transientFiles.get(id);
  if (file) return file;
  if (item.demoText !== undefined) return new Blob([item.demoText], { type: item.mimeType || 'text/plain' });
  throw new Error('此演示文件仅保存了文件信息，重新选择文件后才能预览内容。');
}

export async function searchKnowledgeFiles(query: string) {
  const store = readStore(); const current = session(); const normalized = query.trim().toLocaleLowerCase();
  return { items: store.items.filter((item) => item.kind === 'file'
    && canView(findLibrary(store, item.scopeId, current), current)
    && (!normalized || item.name.toLocaleLowerCase().includes(normalized))).map(clone) };
}

export const knowledgeFileLimits = { maxSize: MAX_FILE_SIZE, extensions: [...ALLOWED_EXTENSIONS] };
