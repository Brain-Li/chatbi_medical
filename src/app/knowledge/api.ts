import type { KnowledgeItem, KnowledgeLibrary, KnowledgeLibraryInput, KnowledgeLibraryStatus, KnowledgeListResponse, KnowledgeSession } from './types';
import { getDemoAuthUsername } from '../utils/demoAuth';

const API_BASE = '/api/knowledge';
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['pdf', 'docx', 'xlsx', 'pptx', 'txt', 'md']);
export const unsupportedFileFormatMessage = '上传失败：暂不支持该文件格式。仅支持 PDF、Word、Excel、PPT、TXT 或 Markdown 文件。';
export const fileSizeLimitErrorMessage = '上传失败：文件大小超过 50 MB。';

function demoUserHeaders() {
  return { 'X-Demo-User-Encoded': encodeURIComponent(getDemoAuthUsername()) };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  for (const [key, value] of Object.entries(demoUserHeaders())) headers.set(key, value);
  if (init.body && !(init.body instanceof Blob) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(path, { ...init, headers });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ?? '知识库请求失败');
  }
  return response.json() as Promise<T>;
}

export async function listKnowledgeLibraries(signal?: AbortSignal) {
  return request<{ libraries: KnowledgeLibrary[]; session: KnowledgeSession }>(API_BASE + '/libraries', { signal });
}

export async function saveKnowledgeLibrary(data: KnowledgeLibraryInput, id?: string) {
  const suffix = id ? '/' + encodeURIComponent(id) : '';
  return request<KnowledgeLibrary>(API_BASE + '/libraries' + suffix, {
    method: id ? 'PATCH' : 'POST', body: JSON.stringify(data),
  });
}

export async function updateKnowledgeLibraryStatus(id: string, status: KnowledgeLibraryStatus) {
  return request<KnowledgeLibrary>(API_BASE + '/libraries/' + encodeURIComponent(id), {
    method: 'PATCH', body: JSON.stringify({ status }),
  });
}

export async function deleteKnowledgeLibrary(id: string) {
  return request<{ deleted: number }>(API_BASE + '/libraries/' + encodeURIComponent(id), { method: 'DELETE' });
}

export async function getKnowledgeLibrary(scopeId?: string, signal?: AbortSignal) {
  const params = new URLSearchParams();
  if (scopeId) params.set('scopeId', scopeId);
  return request<KnowledgeListResponse>(API_BASE + '?' + params.toString(), { signal });
}

export async function getKnowledgeSession() {
  return request<{ session: KnowledgeSession }>(API_BASE + '/session');
}

export async function uploadKnowledgeFile(scopeId: string, parentId: string | null, file: File, signal?: AbortSignal) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_EXTENSIONS.has(extension)) throw new Error(unsupportedFileFormatMessage);
  if (file.size > MAX_FILE_SIZE) throw new Error(fileSizeLimitErrorMessage);
  const params = new URLSearchParams({ scopeId, name: file.name });
  if (parentId) params.set('parentId', parentId);
  return request<KnowledgeItem>(API_BASE + '/files?' + params.toString(), {
    method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file, signal,
  });
}

export async function updateKnowledgeItem(id: string, updates: { name?: string; parentId?: string | null }) {
  return request<KnowledgeItem>(API_BASE + '/items/' + encodeURIComponent(id), {
    method: 'PATCH', body: JSON.stringify(updates),
  });
}

export async function deleteKnowledgeItem(id: string) {
  return request<{ deleted: number }>(API_BASE + '/items/' + encodeURIComponent(id), { method: 'DELETE' });
}

export async function retryKnowledgeIndex(id: string) {
  return request<KnowledgeItem>(API_BASE + '/items/' + encodeURIComponent(id) + '/retry', { method: 'POST' });
}

export async function readKnowledgeFile(id: string, signal?: AbortSignal) {
  const response = await fetch(API_BASE + '/items/' + encodeURIComponent(id) + '/content', {
    headers: demoUserHeaders(),
    signal,
  });
  if (!response.ok) throw new Error('无法读取该文档。');
  return response.blob();
}

export async function searchKnowledgeFiles(query: string) {
  if (!query.trim()) {
    const library = await getKnowledgeLibrary();
    return { items: library.items.filter((item) => item.kind === 'file') };
  }
  const params = new URLSearchParams({ query });
  return request<{ items: KnowledgeItem[] }>(API_BASE + '/search?' + params.toString());
}

export const knowledgeFileLimits = { maxSize: MAX_FILE_SIZE, extensions: [...ALLOWED_EXTENSIONS] };
