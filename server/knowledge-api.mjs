import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_DIR = path.resolve(ROOT, '../data/knowledge');
const TEAM_SCOPE_ID = 'company-team';
const TEAM_LIBRARY = { id: TEAM_SCOPE_ID, name: '团队共享资料', description: '', visibility: 'team', memberIds: [], createdBy: '' };
const MAX_BYTES = 50 * 1024 * 1024;
const MAX_DESCRIPTION_LENGTH = 500;
const ALLOWED_EXTENSIONS = new Set(['pdf', 'docx', 'xlsx', 'pptx', 'txt', 'md']);

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

function safeName(value) {
  return typeof value === 'string' ? value.trim().replace(/[\/\0-\x1f]/g, '').slice(0, 180) : '';
}

function sessionFor(request) {
  let username = request.headers['x-demo-user'];
  if (typeof request.headers['x-demo-user-encoded'] === 'string') {
    try { username = decodeURIComponent(request.headers['x-demo-user-encoded']); } catch { username = ''; }
  }
  const userId = safeName(username) || 'admin';
  let configured = {};
  try { configured = JSON.parse(process.env.KNOWLEDGE_DEMO_USER_ROLES || '{}'); } catch { configured = {}; }
  const role = configured && Object.hasOwn(configured, userId) ? configured[userId]
    : userId === 'maintainer' || userId === 'member' ? userId : 'admin';
  return { userId, role: ['admin', 'maintainer', 'member'].includes(role) ? role : 'member', canManage: role === 'admin' || role === 'maintainer' };
}

function libraryFor(store, id) {
  return store.libraries.find((library) => library.id === id)
    ?? (id === TEAM_SCOPE_ID && !store.teamLibraryDeleted ? TEAM_LIBRARY : undefined);
}

function canEditLibrary(library, session) {
  return session.canManage && (library.createdBy === session.userId
    || (session.role === 'admin' && library.visibility === 'team'));
}

function canViewLibrary(library, session) {
  if (!library) return false;
  if (library.status === 'disabled') return canEditLibrary(library, session);
  return library.visibility === 'team' || library.createdBy === session.userId
    || (library.visibility === 'restricted' && library.memberIds.includes(session.userId));
}

function canRetrieveLibrary(library, session) {
  return library?.status !== 'disabled' && canViewLibrary(library, session);
}

function canManageLibrary(library, session) {
  return session.canManage && (library.visibility === 'team' || library.createdBy === session.userId);
}

function requireLibrary(store, id, session, write = false) {
  const library = libraryFor(store, id);
  if (!canViewLibrary(library, session)) throw Object.assign(new Error('知识库不存在或你没有查看权限。'), { status: 404 });
  if (write && !canManageLibrary(library, session)) throw Object.assign(new Error('你没有此知识库的管理权限。'), { status: 403 });
  return library;
}

function requireEditableLibrary(store, id, session) {
  const library = requireLibrary(store, id, session);
  if (!canEditLibrary(library, session)) throw Object.assign(new Error('你没有此知识库的设置权限。'), { status: 403 });
  return library;
}

function librarySummary(library, session, fileCount) {
  const canManage = canManageLibrary(library, session);
  const canEdit = canEditLibrary(library, session);
  const { memberIds, ...fields } = library;
  return { ...fields, status: fields.status ?? 'enabled', ...(canEdit ? { memberIds } : {}), fileCount, canManage, canEdit };
}

function validateLibraryStatus(status) {
  if (status !== 'enabled' && status !== 'disabled') throw Object.assign(new Error('请选择有效的知识库状态。'), { status: 400 });
  return status;
}

function libraryFields(body, session) {
  const name = safeName(body?.name).slice(0, 80);
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  const visibility = body?.visibility;
  const status = body?.status;
  const memberIds = visibility === 'restricted' && Array.isArray(body?.memberIds)
    ? Array.from(new Set(body.memberIds.map(safeName).filter((id) => id && id !== session.userId))) : [];
  if (!name) throw Object.assign(new Error('知识库名称不能为空。'), { status: 400 });
  if (description.length > MAX_DESCRIPTION_LENGTH) throw Object.assign(new Error(`知识库描述最多 ${MAX_DESCRIPTION_LENGTH} 字。`), { status: 400 });
  if (visibility !== 'team' && visibility !== 'restricted' && visibility !== 'private') throw Object.assign(new Error('请选择有效的可见范围。'), { status: 400 });
  if (status !== undefined) validateLibraryStatus(status);
  if (visibility === 'restricted' && !memberIds.length) throw Object.assign(new Error('请输入至少一个其他成员的用户名。'), { status: 400 });
  return { name, description, visibility, memberIds, ...(status !== undefined ? { status } : {}) };
}

async function readJson(request, max = 64 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > max) throw Object.assign(new Error('请求过大。'), { status: 413 });
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

export function createKnowledgeServer({ dataDir = process.env.KNOWLEDGE_DATA_DIR || DEFAULT_DATA_DIR } = {}) {
  const filesDir = path.join(dataDir, 'files');
  const indexPath = path.join(dataDir, 'index.json');
  let writeQueue = Promise.resolve();

  const readStore = async () => {
    let parsed;
    try { parsed = JSON.parse(await fs.readFile(indexPath, 'utf8')); }
    catch (error) {
      if (error.code === 'ENOENT') return { libraries: [], items: [] };
      throw error;
    }
    if (Array.isArray(parsed)) {
      return { libraries: [], items: parsed.map(({ workspaceId, ...item }) => ({ ...item, scopeId: TEAM_SCOPE_ID })) };
    }
    if (!Array.isArray(parsed?.libraries) || !Array.isArray(parsed?.items)) throw new Error('Invalid knowledge index');
    return parsed;
  };
  const mutateStore = (update) => {
    const result = writeQueue.then(async () => {
      const store = await readStore();
      const value = await update(store);
      await fs.mkdir(filesDir, { recursive: true });
      const tempPath = indexPath + '.tmp';
      await fs.writeFile(tempPath, JSON.stringify(store, null, 2));
      await fs.rename(tempPath, indexPath);
      return value;
    });
    writeQueue = result.catch(() => {});
    return result;
  };
  const requireManager = (session) => {
    if (!session.canManage) throw Object.assign(new Error('仅管理员或知识维护者可以管理资料。'), { status: 403 });
  };
  const assertParent = (items, scopeId, parentId) => {
    if (parentId == null) return;
    const parent = items.find((item) => item.id === parentId && item.scopeId === scopeId);
    if (!parent || parent.kind !== 'folder') throw Object.assign(new Error('目标文件夹不存在。'), { status: 400 });
  };
  const checkDuplicate = (items, scopeId, parentId, name, exceptId) => {
    if (items.some((item) => item.scopeId === scopeId && item.parentId === parentId && item.id !== exceptId && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw Object.assign(new Error('同一文件夹中已存在同名项目。'), { status: 409 });
    }
  };

  const server = createServer(async (request, response) => {
    const url = new URL(request.url || '/', 'http://localhost');
    const route = url.pathname;
    const session = sessionFor(request);
    try {
      if (request.method === 'GET' && route === '/api/knowledge/session') {
        return json(response, 200, { session });
      }
      if (request.method === 'GET' && route === '/api/knowledge/libraries') {
        const store = await readStore();
        const counts = new Map();
        for (const item of store.items) if (item.kind === 'file') counts.set(item.scopeId, (counts.get(item.scopeId) || 0) + 1);
        const teamLibrary = libraryFor(store, TEAM_SCOPE_ID);
        const libraries = teamLibrary === TEAM_LIBRARY && store.items.some((item) => item.scopeId === TEAM_SCOPE_ID)
          ? [TEAM_LIBRARY, ...store.libraries] : store.libraries;
        return json(response, 200, {
          libraries: libraries.filter((library) => canViewLibrary(library, session)).map((library) => librarySummary(library, session, counts.get(library.id) || 0)),
          session,
        });
      }
      if (request.method === 'POST' && route === '/api/knowledge/libraries') {
        requireManager(session);
        const fields = libraryFields(await readJson(request), session);
        const library = { status: 'enabled', ...fields, id: randomUUID(), createdBy: session.userId, createdAt: new Date().toISOString() };
        await mutateStore((store) => { store.libraries.unshift(library); });
        return json(response, 201, librarySummary(library, session, 0));
      }
      const libraryRoute = route.match(/^\/api\/knowledge\/libraries\/(company-team|[a-f0-9-]+)$/);
      if (request.method === 'PATCH' && libraryRoute) {
        const body = await readJson(request);
        const fields = body && Object.hasOwn(body, 'status') && Object.keys(body).length === 1
          ? { status: validateLibraryStatus(body.status) }
          : libraryFields(body, session);
        const library = await mutateStore((store) => {
          const entry = requireEditableLibrary(store, libraryRoute[1], session);
          if (fields.visibility !== undefined && fields.visibility !== entry.visibility && entry.createdBy !== session.userId) {
            throw Object.assign(new Error('仅创建人可以修改知识库可见范围。'), { status: 403 });
          }
          const updated = { ...entry, ...fields };
          if (entry === TEAM_LIBRARY) store.libraries.unshift(updated);
          else store.libraries = store.libraries.map((library) => library.id === entry.id ? updated : library);
          return librarySummary(updated, session, store.items.filter((item) => item.scopeId === entry.id && item.kind === 'file').length);
        });
        return json(response, 200, library);
      }
      if (request.method === 'DELETE' && libraryRoute) {
        if (session.role !== 'admin') return json(response, 403, { error: '仅管理员可以删除知识库。' });
        const scopeId = libraryRoute[1];
        const removed = await mutateStore((store) => {
          requireEditableLibrary(store, scopeId, session);
          const items = store.items.filter((item) => item.scopeId === scopeId);
          store.libraries = store.libraries.filter((library) => library.id !== scopeId);
          store.items = store.items.filter((item) => item.scopeId !== scopeId);
          if (scopeId === TEAM_SCOPE_ID) store.teamLibraryDeleted = true;
          return items;
        });
        const storageRoot = path.resolve(filesDir);
        await Promise.allSettled(removed.filter((item) => item.kind === 'file').map(async (item) => {
          const filePath = path.resolve(storageRoot, item.id);
          if (path.dirname(filePath) === storageRoot) await fs.rm(filePath, { force: true });
        }));
        console.info(JSON.stringify({ event: 'knowledge.library.delete', userId: session.userId, scopeId, count: removed.length }));
        return json(response, 200, { deleted: removed.length });
      }
      if (request.method === 'GET' && route === '/api/knowledge') {
        const store = await readStore();
        const scopeId = url.searchParams.get('scopeId');
        const library = scopeId ? requireLibrary(store, scopeId, session) : null;
        const query = (url.searchParams.get('query') || '').trim().toLocaleLowerCase();
        const scopedItems = store.items.filter((item) => library ? item.scopeId === library.id : canRetrieveLibrary(libraryFor(store, item.scopeId), session));
        const items = scopedItems.filter((item) => !query || item.name.toLocaleLowerCase().includes(query));
        return json(response, 200, { items, session, ...(library ? { library: librarySummary(library, session, scopedItems.filter((item) => item.kind === 'file').length) } : {}) });
      }
      if (request.method === 'GET' && route === '/api/knowledge/search') {
        const query = (url.searchParams.get('query') || '').trim().toLocaleLowerCase();
        if (!query) return json(response, 200, { items: [] });
        const store = await readStore();
        const results = [];
        for (const item of store.items) {
          if (item.kind !== 'file' || !canRetrieveLibrary(libraryFor(store, item.scopeId), session)) continue;
          let matched = item.name.toLocaleLowerCase().includes(query);
          if (!matched && /\.(txt|md)$/i.test(item.name)) {
            try { matched = (await fs.readFile(path.join(filesDir, item.id), 'utf8')).toLocaleLowerCase().includes(query); } catch { matched = false; }
          }
          if (matched) results.push(item);
        }
        return json(response, 200, { items: results.slice(0, 50) });
      }
      if (request.method === 'POST' && route === '/api/knowledge/folders') {
        return json(response, 403, { error: '知识库不支持新建文件夹，请上传文件。' });
      }
      if (request.method === 'POST' && route === '/api/knowledge/files') {
        requireManager(session);
        const scopeId = url.searchParams.get('scopeId') || TEAM_SCOPE_ID;
        requireLibrary(await readStore(), scopeId, session, true);
        const name = safeName(url.searchParams.get('name'));
        const parentId = url.searchParams.get('parentId') || null;
        const extension = name.split('.').pop()?.toLowerCase() || '';
        if (!name || !ALLOWED_EXTENSIONS.has(extension)) return json(response, 400, { error: '文件信息无效或格式不受支持。' });
        const declaredSize = Number(request.headers['content-length'] || 0);
        if (declaredSize > MAX_BYTES) return json(response, 413, { error: '单个文件不能超过 50 MB。' });
        const chunks = [];
        let size = 0;
        for await (const chunk of request) {
          size += chunk.length;
          if (size > MAX_BYTES) return json(response, 413, { error: '单个文件不能超过 50 MB。' });
          chunks.push(chunk);
        }
        if (!size) return json(response, 400, { error: '不能上传空文件。' });
        const id = randomUUID();
        const now = new Date().toISOString();
        const item = { id, scopeId, parentId, kind: 'file', name, mimeType: request.headers['content-type'] || 'application/octet-stream', size, status: 'unindexed', createdBy: session.userId, createdAt: now, updatedAt: now };
        const itemPath = path.join(filesDir, id);
        let contentWritten = false;
        try {
          await mutateStore(async (store) => {
            requireLibrary(store, scopeId, session, true);
            assertParent(store.items, scopeId, parentId);
            checkDuplicate(store.items, scopeId, parentId, name);
            await fs.mkdir(filesDir, { recursive: true });
            await fs.writeFile(itemPath, Buffer.concat(chunks, size), { flag: 'wx' });
            contentWritten = true;
            store.items.push(item);
          });
        } catch (error) {
          if (contentWritten) await fs.rm(itemPath, { force: true });
          throw error;
        }
        console.info(JSON.stringify({ event: 'knowledge.file.upload', userId: session.userId, scopeId, itemId: item.id, size }));
        return json(response, 201, item);
      }
      const itemRoute = route.match(/^\/api\/knowledge\/items\/([a-f0-9-]+)(?:\/(content|retry))?$/i);
      if (itemRoute) {
        const id = itemRoute[1];
        const suffix = itemRoute[2];
        const findItem = (store, write = false) => {
          const item = store.items.find((entry) => entry.id === id);
          if (!item) throw Object.assign(new Error('资料不存在或已删除。'), { status: 404 });
          requireLibrary(store, item.scopeId, session, write);
          return item;
        };
        if (request.method === 'GET' && suffix === 'content') {
          const item = findItem(await readStore());
          if (item.kind !== 'file') return json(response, 404, { error: '文件内容不存在。' });
          const itemPath = path.join(filesDir, item.id);
          try { await fs.access(itemPath); } catch { return json(response, 404, { error: '文件内容不存在。' }); }
          response.writeHead(200, { 'Content-Type': item.mimeType || 'application/octet-stream', 'Content-Length': String(item.size), 'Content-Disposition': "inline; filename*=UTF-8''" + encodeURIComponent(item.name), 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' });
          return createReadStream(itemPath).pipe(response);
        }
        if (request.method === 'POST' && suffix === 'retry') {
          const item = findItem(await readStore(), true);
          if (item.kind !== 'file') return json(response, 400, { error: '文件夹不能重新处理。' });
          return json(response, 501, { error: '尚未配置文档解析和索引服务。' });
        }
        if (request.method === 'PATCH' && !suffix) {
          const updates = await readJson(request);
          const item = await mutateStore((store) => {
            const item = findItem(store, true);
            const name = updates.name === undefined ? item.name : safeName(updates.name);
            const parentId = updates.parentId === undefined ? item.parentId : updates.parentId || null;
            if (!name) throw Object.assign(new Error('名称不能为空。'), { status: 400 });
            assertParent(store.items, item.scopeId, parentId);
            if (item.kind === 'folder' && parentId) {
              let cursor = store.items.find((entry) => entry.id === parentId);
              while (cursor) {
                if (cursor.id === item.id) throw Object.assign(new Error('不能将文件夹移动到自身或其子文件夹。'), { status: 400 });
                cursor = cursor.parentId ? store.items.find((entry) => entry.id === cursor.parentId) : null;
              }
            }
            checkDuplicate(store.items, item.scopeId, parentId, name, item.id);
            Object.assign(item, { name, parentId, updatedAt: new Date().toISOString() });
            return item;
          });
          return json(response, 200, item);
        }
        if (request.method === 'DELETE' && !suffix) {
          const { scopeId, removed } = await mutateStore((store) => {
            const item = findItem(store, true);
            const scoped = store.items.filter((entry) => entry.scopeId === item.scopeId);
            const ids = new Set([id]);
            for (const ancestorId of ids) {
              for (const child of scoped) if (child.parentId === ancestorId) ids.add(child.id);
            }
            const removed = scoped.filter((entry) => ids.has(entry.id));
            store.items = store.items.filter((entry) => !ids.has(entry.id));
            return { scopeId: item.scopeId, removed };
          });
          await Promise.allSettled(removed.filter((item) => item.kind === 'file').map((item) => fs.rm(path.join(filesDir, item.id), { force: true })));
          console.info(JSON.stringify({ event: 'knowledge.item.delete', userId: session.userId, scopeId, itemId: id, count: removed.length }));
          return json(response, 200, { deleted: removed.length });
        }
      }
      return json(response, 404, { error: '接口不存在。' });
    } catch (error) {
      const status = Number(error?.status) || 500;
      if (status >= 500) console.error(error);
      return json(response, status, { error: status === 500 ? '服务暂时不可用。' : error.message });
    }
  });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.KNOWLEDGE_API_PORT || 4174);
  createKnowledgeServer().listen(port, '127.0.0.1', () => console.info('Local knowledge API listening on 127.0.0.1:' + port));
}
