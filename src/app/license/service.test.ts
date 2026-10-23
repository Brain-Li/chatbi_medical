import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { getDemoLicenseToken, getLicenseSnapshot, guardLicense, licenseApi, reloadLicenseStorage, setDemoEnvironment, setDemoRole, setDemoScenario } from './service';
import { getDemoValidationToken, type ValidationDemo } from './service';
import { createDemoAuthSession, clearDemoAuthSession, dismissLicenseReminder, getDismissedLicenseReminder } from '../utils/demoAuth';

function memoryStorage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); }, clear: () => values.clear() };
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-22T04:00:00Z'));
  const storage = memoryStorage(), session = memoryStorage();
  vi.stubGlobal('localStorage', storage); vi.stubGlobal('sessionStorage', session);
  const target = new EventTarget();
  Object.assign(target, { localStorage: storage, sessionStorage: session });
  vi.stubGlobal('window', target);
  reloadLicenseStorage();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('demo license service contract', () => {
  it.each([false, true])('preserves dismissed reminder across reload but resets on login (rememberMe=%s)', rememberMe => {
    createDemoAuthSession(rememberMe, 'admin');
    dismissLicenseReminder('admin:current-license');
    reloadLicenseStorage();
    expect(getDismissedLicenseReminder()).toBe('admin:current-license');
    createDemoAuthSession(rememberMe, 'admin');
    expect(getDismissedLicenseReminder()).toBeNull();
    dismissLicenseReminder('admin:current-license');
    clearDemoAuthSession();
    expect(getDismissedLicenseReminder()).toBeNull();
    createDemoAuthSession(rememberMe, 'another-user');
    expect(getDismissedLicenseReminder()).toBeNull();
  });
  it.each<[ValidationDemo, string]>([
    ['format', 'INVALID_FORMAT'], ['integrity', 'INVALID_LICENSE'], ['version', 'UNSUPPORTED_FORMAT'],
    ['product', 'PRODUCT_MISMATCH'], ['machine', 'MACHINE_MISMATCH'], ['customer', 'OWNER_MISMATCH'],
    ['time', 'INVALID_TIME'], ['future', 'NOT_YET_VALID'], ['expired', 'EXPIRED'],
    ['revision', 'OLD_REVISION'], ['renewal', 'INVALID_RENEWAL'], ['update', 'INVALID_UPDATE'], ['rebind', 'INVALID_REBIND'],
  ])('demonstrates %s through real validation without replacing authorization', async (example, code) => {
    const before = getLicenseSnapshot();
    const token = getDemoValidationToken(example);
    await expect(licenseApi.validate(token)).rejects.toMatchObject({ code });
    await expect(licenseApi.activate(token)).rejects.toMatchObject({ code });
    expect(getLicenseSnapshot()).toEqual(before);
    expect(await licenseApi.getRecords()).toHaveLength(0);
  });
  it('demonstrates duplicate import without changing the update time or history', async () => {
    const before = getLicenseSnapshot();
    const token = getDemoValidationToken('duplicate');
    expect(await licenseApi.validate(token)).toMatchObject({ duplicate: true });
    await licenseApi.activate(token);
    expect(getLicenseSnapshot()).toEqual(before);
    expect(await licenseApi.getRecords()).toHaveLength(0);
  });
  it('explains prerequisites for examples and prevents users from generating tokens', () => {
    setDemoScenario('unactivated');
    expect(() => getDemoValidationToken('duplicate')).toThrow('请先切换');
    setDemoScenario('expired');
    expect(() => getDemoValidationToken('renewal')).toThrow('请先切换');
    setDemoRole('user');
    expect(() => getDemoValidationToken('format')).toThrow('管理员');
  });
  it('preserves each license validity period in history after renewal and reload', async () => {
    setDemoScenario('unactivated');
    const first = await licenseApi.activate(getDemoLicenseToken('activate'));
    vi.advanceTimersByTime(60000);
    const renewed = await licenseApi.activate(getDemoLicenseToken('renew'));
    reloadLicenseStorage();
    const records = await licenseApi.getRecords();
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ startsAt: renewed.license!.startsAt, expiresAt: renewed.license!.expiresAt });
    expect(records[1]).toMatchObject({ startsAt: first.license!.startsAt, expiresAt: first.license!.expiresAt });
    expect(records[0].startsAt).not.toBe(records[1].startsAt);
  });
  it('updates the old demo customer ID without losing precision or license history', async () => {
    expect(getLicenseSnapshot().license?.customerId).toBe('2101616099981336600');
    await licenseApi.activate(getDemoLicenseToken('renew'));
    const key = 'chatbi.license.demo.v1';
    const saved = JSON.parse(localStorage.getItem(key)!);
    saved.license.customerId = 'DEMO-CUSTOMER';
    saved.records[0].customerId = 'DEMO-CUSTOMER';
    localStorage.setItem(key, JSON.stringify(saved));
    reloadLicenseStorage();
    expect(getLicenseSnapshot().license).toEqual({ ...saved.license, customerId: '2101616099981336600' });
    expect(await licenseApi.getRecords()).toEqual([{ ...saved.records[0], customerId: '2101616099981336600' }]);
    expect((await licenseApi.validate(getDemoLicenseToken('renew'))).license.customerId).toBe('2101616099981336600');
  });
  it('keeps the customer ID through renewal, rebinding and reload', async () => {
    const customerId = getLicenseSnapshot().license!.customerId;
    const renewal = getDemoLicenseToken('renew');
    expect((await licenseApi.validate(renewal)).license.customerId).toBe(customerId);
    const renewed = await licenseApi.activate(renewal);
    expect(renewed.license?.customerId).toBe(customerId);
    expect(renewed.license).not.toHaveProperty('licenseId');
    setDemoEnvironment('migrated');
    const rebound = await licenseApi.activate(getDemoLicenseToken('rebind'));
    expect(rebound.license?.customerId).toBe(customerId);
    reloadLicenseStorage();
    expect(getLicenseSnapshot().license?.customerId).toBe(customerId);
    const records = await licenseApi.getRecords();
    expect(records).toHaveLength(2);
    expect(records.every(record => record.customerId === customerId)).toBe(true);
    expect(records[0]).not.toHaveProperty('licenseId');
  });
  it('preserves existing licenses and recovers customer IDs for older records', async () => {
    await licenseApi.activate(getDemoLicenseToken('renew'));
    const key = 'chatbi.license.demo.v1';
    const saved = JSON.parse(localStorage.getItem(key)!);
    saved.license.licenseId = 'LEGACY-LICENSE';
    saved.records.forEach((record: { customerId?: string; licenseId?: string }) => {
      delete record.customerId;
      record.licenseId = 'LEGACY-LICENSE';
    });
    localStorage.setItem(key, JSON.stringify(saved));
    reloadLicenseStorage();
    expect(getLicenseSnapshot().status).toBe('active');
    expect(getLicenseSnapshot().license?.customerId).toBe(saved.license.customerId);
    expect(getLicenseSnapshot().license?.expiresAt).toBe(saved.license.expiresAt);
    const records = await licenseApi.getRecords();
    expect(records).toHaveLength(1);
    expect(records[0].customerId).toBe(saved.license.customerId);
    const renewed = await licenseApi.activate(getDemoLicenseToken('renew'));
    expect(renewed.license?.customerId).toBe(saved.license.customerId);
    expect(renewed.license).not.toHaveProperty('licenseId');
  });
  it('activates offline, persists across reload, and does not duplicate records', async () => {
    setDemoScenario('unactivated');
    const machine = await licenseApi.getMachine();
    const token = getDemoLicenseToken('activate');
    expect((await licenseApi.validate(' \n' + token + '\n ')).license.machineCode).toBe(machine.machineCode);
    expect((await licenseApi.activate(token)).status).toBe('active');
    await licenseApi.activate(token);
    reloadLicenseStorage();
    expect((await licenseApi.getMachine()).machineCode).toBe(machine.machineCode);
    expect((await licenseApi.getRecords())).toHaveLength(1);
  });
  it('keeps a valid license when a damaged token is submitted', async () => {
    const previous = getLicenseSnapshot().license;
    await expect(licenseApi.activate(getDemoLicenseToken() + 'x')).rejects.toThrow();
    expect(getLicenseSnapshot().license).toEqual(previous);
    expect(await licenseApi.getRecords()).toHaveLength(0);
  });
  it('keeps the existing license if persistence fails', async () => {
    const token = getDemoLicenseToken(), previous = getLicenseSnapshot().license;
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    await expect(licenseApi.activate(token)).rejects.toThrow('保存失败');
    expect(getLicenseSnapshot().license).toEqual(previous);
  });
  it('does not trust the preview when confirming activation', async () => {
    const token = getDemoLicenseToken();
    await licenseApi.validate(token);
    setDemoEnvironment('migrated');
    await expect(licenseApi.activate(token)).rejects.toThrow('不匹配');
  });
  it('rejects authorization changes for ordinary users', async () => {
    const token = getDemoLicenseToken(); setDemoRole('user');
    await expect(licenseApi.validate(token)).rejects.toThrow('管理员');
    await expect(licenseApi.activate(token)).rejects.toThrow('管理员');
    await expect(licenseApi.getMachine()).rejects.toThrow('管理员');
    await expect(licenseApi.getRecords()).rejects.toThrow('管理员');
  });
  it('checks expiry at each operation, while keeping history and saved exports available', async () => {
    vi.setSystemTime(new Date(getLicenseSnapshot().license!.expiresAt));
    expect(guardLicense('execute')).toBe(false);
    expect(guardLicense('read')).toBe(true);
    expect(guardLicense('exportSaved')).toBe(true);
    expect(guardLicense('pauseSubscription')).toBe(true);
    expect((await licenseApi.authorize('configure')).allowed).toBe(true);
    expect((await licenseApi.authorize('manageSubscription')).allowed).toBe(false);
  });
  it.each(['unactivated', 'expired'] as const)('only emits denial for business execution and subscription changes when %s', async status => {
    setDemoScenario(status);
    const denied = vi.fn();
    window.addEventListener('chatbi:license-denied', denied);
    for (const action of ['configure', 'read', 'exportSaved', 'pauseSubscription'] as const) {
      expect(guardLicense(action)).toBe(true);
      expect((await licenseApi.authorize(action)).allowed).toBe(true);
    }
    expect(denied).not.toHaveBeenCalled();
    for (const action of ['execute', 'manageSubscription'] as const) {
      expect(guardLicense(action)).toBe(false);
      expect((await licenseApi.authorize(action)).allowed).toBe(false);
    }
    expect(denied).toHaveBeenCalledTimes(2);
  });
  it('restores an expired license immediately on renewal', async () => {
    setDemoScenario('expired');
    await licenseApi.activate(getDemoLicenseToken());
    expect(guardLicense('execute')).toBe(true);
  });
  it('supports migration and rejects unreadable environment', async () => {
    const original = getLicenseSnapshot().license!;
    setDemoEnvironment('migrated');
    expect(getLicenseSnapshot().status).toBe('invalid');
    const updated = await licenseApi.activate(getDemoLicenseToken('rebind'));
    expect(updated.status).toBe('active');
    expect(updated.license?.expiresAt).toBe(original.expiresAt);
    setDemoEnvironment('unreadable');
    await expect(licenseApi.getMachine()).rejects.toThrow('读取失败');
    expect(getLicenseSnapshot().machine).toBeNull();
  });
});
