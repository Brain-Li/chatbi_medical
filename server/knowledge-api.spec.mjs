import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createKnowledgeServer } from './knowledge-api.mjs';

const legacyFolder = {
  id: 'legacy-folder', workspaceId: 'old-workspace-name', parentId: null,
  kind: 'folder', name: 'Legacy', createdBy: 'admin',
  createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
};

test('knowledge API blocks folder creation and supports uploads to existing folders', async (context) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'knowledge-api-'));
  await fs.writeFile(path.join(dataDir, 'index.json'), JSON.stringify([legacyFolder]));
  const previousRoles = process.env.KNOWLEDGE_DEMO_USER_ROLES;
  process.env.KNOWLEDGE_DEMO_USER_ROLES = JSON.stringify({ member: 'member' });
  const server = createKnowledgeServer({ dataDir });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(async () => {
    server.close();
    await once(server, 'close');
    await fs.rm(dataDir, { recursive: true, force: true });
    if (previousRoles === undefined) delete process.env.KNOWLEDGE_DEMO_USER_ROLES;
    else process.env.KNOWLEDGE_DEMO_USER_ROLES = previousRoles;
  });

  const base = `http://127.0.0.1:${server.address().port}`;
  const admin = { 'X-Demo-User': 'admin' };
  const member = { 'X-Demo-User': 'member' };
  const currentSession = await fetch(`${base}/api/knowledge/session`, { headers: { 'X-Demo-User': 'current-user' } });
  assert.equal((await currentSession.json()).session.canManage, true);
  const folderResponse = await fetch(`${base}/api/knowledge/folders`, {
    method: 'POST', headers: { ...admin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Policies' }),
  });
  assert.equal(folderResponse.status, 403);

  const denied = await fetch(`${base}/api/knowledge/files?name=blocked.txt`, {
    method: 'POST', headers: { ...member, 'Content-Type': 'text/plain' }, body: 'blocked',
  });
  assert.equal(denied.status, 403);

  const upload = await fetch(`${base}/api/knowledge/files?parentId=${legacyFolder.id}&name=guide.txt`, {
    method: 'POST', headers: { ...admin, 'Content-Type': 'text/plain' }, body: 'clinic policy',
  });
  assert.equal(upload.status, 201);
  const file = await upload.json();
  assert.equal(file.status, 'unindexed');
  assert.equal(file.scopeId, 'company-team');
  assert.equal(file.parentId, legacyFolder.id);

  const retry = await fetch(`${base}/api/knowledge/items/${file.id}/retry`, { method: 'POST', headers: admin });
  assert.equal(retry.status, 501);

  const allTeamDocs = await fetch(`${base}/api/knowledge?workspaceId=renamed-workspace`, { headers: admin });
  const allTeamItems = (await allTeamDocs.json()).items;
  assert.equal(allTeamItems.length, 2);
  assert.equal(allTeamItems.find((item) => item.id === 'legacy-folder').scopeId, 'company-team');
  const content = await fetch(`${base}/api/knowledge/items/${file.id}/content`, { headers: member });
  assert.equal(await content.text(), 'clinic policy');

  const search = await fetch(`${base}/api/knowledge/search?query=policy`, { headers: member });
  assert.equal((await search.json()).items.length, 1);

  const teamPath = `${base}/api/knowledge/libraries/company-team`;
  const renameTeam = await fetch(teamPath, {
    method: 'PATCH', headers: { ...admin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Renamed team library', visibility: 'team' }),
  });
  assert.equal(renameTeam.status, 200);
  const teamList = await fetch(`${base}/api/knowledge/libraries`, { headers: admin }).then((response) => response.json());
  assert.equal(teamList.libraries.length, 1);
  assert.equal(teamList.libraries[0].name, 'Renamed team library');
  assert.equal(teamList.libraries[0].canEdit, true);
  assert.equal((await fetch(teamPath, { method: 'DELETE', headers: member })).status, 403);
  const deleteTeam = await fetch(teamPath, { method: 'DELETE', headers: admin });
  assert.equal(deleteTeam.status, 200);
  assert.equal((await deleteTeam.json()).deleted, 2);
  assert.equal((await fetch(`${base}/api/knowledge?scopeId=company-team`, { headers: admin })).status, 404);
  assert.equal((await fetch(`${base}/api/knowledge/items/${file.id}/content`, { headers: admin })).status, 404);
  assert.deepEqual((await fetch(`${base}/api/knowledge/libraries`, { headers: admin }).then((response) => response.json())).libraries, []);
  await assert.rejects(fs.access(path.join(dataDir, 'files', file.id)), { code: 'ENOENT' });
});

test('knowledge bases isolate files, search, and restricted member access', async (context) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'knowledge-libraries-'));
  await fs.writeFile(path.join(dataDir, 'index.json'), JSON.stringify([legacyFolder]));
  const server = createKnowledgeServer({ dataDir });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(async () => {
    server.close();
    await once(server, 'close');
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  const api = `http://127.0.0.1:${server.address().port}/api/knowledge`;
  const call = (route, user, init = {}) => fetch(api + route, {
    ...init, headers: { 'X-Demo-User': user, ...init.headers },
  });
  const settings = { name: 'Private policies', visibility: 'restricted', memberIds: ['member'] };
  const send = (route, user, method, data) => call(route, user, {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
  assert.equal((await send('/libraries', 'member', 'POST', settings)).status, 403);
  const libraryResponse = await send('/libraries', 'admin', 'POST', settings);
  assert.equal(libraryResponse.status, 201);
  const library = await libraryResponse.json();
  assert.equal(library.status, 'enabled');
  assert.ok(Number.isFinite(Date.parse(library.createdAt)));
  const scope = `?scopeId=${library.id}`;
  assert.equal((await call(`/files${scope}&parentId=${legacyFolder.id}&name=wrong-parent.txt`, 'admin', {
    method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'wrong parent',
  })).status, 400);

  const uploads = await Promise.all(['private-a.txt', 'private-b.txt'].map((name) => call(`/files${scope}&name=${name}`, 'admin', {
    method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'private policy',
  })));
  assert.deepEqual(uploads.map((response) => response.status), [201, 201]);
  const file = await uploads[0].json();
  const itemPath = `/items/${file.id}`;
  assert.equal((await call(scope, 'maintainer')).status, 404);
  assert.equal((await call(itemPath + '/content', 'maintainer')).status, 404);
  assert.equal((await call(itemPath, 'maintainer', { method: 'DELETE' })).status, 404);
  assert.deepEqual((await call('/search?query=private', 'maintainer').then((response) => response.json())).items, []);
  assert.equal((await call('/libraries', 'maintainer').then((response) => response.json())).libraries.some((entry) => entry.id === library.id), false);

  const detail = await call(scope, 'member').then((response) => response.json());
  assert.equal(detail.library.createdAt, library.createdAt);
  assert.equal(detail.library.fileCount, 2);
  assert.equal(detail.library.canManage, false);
  assert.equal(detail.items.length, 2);
  assert.equal(await call(itemPath + '/content', 'member').then((response) => response.text()), 'private policy');
  assert.equal((await send(itemPath, 'member', 'PATCH', { name: 'changed.txt' })).status, 403);

  const libraryPath = `/libraries/${library.id}`;
  assert.equal((await send(libraryPath, 'member', 'PATCH', { status: 'disabled' })).status, 403);
  assert.equal((await send(libraryPath, 'admin', 'PATCH', { status: 'invalid' })).status, 400);
  const disable = await send(libraryPath, 'admin', 'PATCH', { status: 'disabled' });
  assert.equal(disable.status, 200);
  const disabledLibrary = await disable.json();
  assert.equal(disabledLibrary.status, 'disabled');
  assert.equal(disabledLibrary.name, library.name);
  assert.equal(disabledLibrary.visibility, library.visibility);
  assert.deepEqual(disabledLibrary.memberIds, library.memberIds);
  assert.equal((await call(scope, 'member')).status, 404);
  assert.equal((await call(itemPath + '/content', 'member')).status, 404);
  assert.equal((await call(scope, 'admin').then((response) => response.json())).items.length, 2);
  assert.deepEqual((await call('/search?query=private', 'admin').then((response) => response.json())).items, []);
  assert.equal((await call('', 'admin').then((response) => response.json())).items.some((entry) => entry.scopeId === library.id), false);
  const enable = await send(libraryPath, 'admin', 'PATCH', { status: 'enabled' });
  assert.equal(enable.status, 200);
  assert.equal(await call(itemPath + '/content', 'member').then((response) => response.text()), 'private policy');

  const privateSettings = { ...settings, visibility: 'private' };
  const makePrivate = await send(libraryPath, 'admin', 'PATCH', privateSettings);
  assert.equal(makePrivate.status, 200);
  const privateLibrary = await makePrivate.json();
  assert.equal(privateLibrary.visibility, 'private');
  assert.equal(privateLibrary.createdAt, library.createdAt);
  assert.deepEqual(privateLibrary.memberIds, []);
  assert.equal(await call(itemPath + '/content', 'admin').then((response) => response.text()), 'private policy');
  for (const user of ['member', 'other-admin']) {
    assert.equal((await call(scope, user)).status, 404);
    assert.equal((await call(itemPath + '/content', user)).status, 404);
    assert.deepEqual((await call('/search?query=private', user).then((response) => response.json())).items, []);
    assert.equal((await call('/libraries', user).then((response) => response.json())).libraries.some((entry) => entry.id === library.id), false);
  }
  assert.equal((await call(libraryPath, 'other-admin', { method: 'DELETE' })).status, 404);

  const newPrivate = await send('/libraries', 'admin', 'POST', { name: 'Owner only', visibility: 'private' });
  assert.equal(newPrivate.status, 201);
  assert.equal((await newPrivate.json()).visibility, 'private');

  assert.equal((await send(libraryPath, 'admin', 'PATCH', { ...settings, memberIds: ['new-member'] })).status, 200);
  assert.equal((await call(itemPath + '/content', 'member')).status, 404);
  assert.equal((await call('?scopeId=company-team', 'admin').then((response) => response.json())).items.length, 1);
  assert.equal((await call(libraryPath, 'admin', { method: 'DELETE' })).status, 200);
  assert.equal((await call(scope, 'admin')).status, 404);
  assert.equal((await call(itemPath + '/content', 'admin')).status, 404);
  assert.equal((await call('?scopeId=company-team', 'admin').then((response) => response.json())).items.length, 1);
});
