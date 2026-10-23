import { getDemoAuthUsername } from '../utils/demoAuth';
import { actionAllowed, DAY, getLicenseStatus, LicenseError, validateClaims, type LicenseAction, type LicenseApi, type LicenseClaims, type LicenseOperation, type LicenseRecord, type LicenseSnapshot, type LicenseStatus, type MachineInfo } from './model';

const STORAGE_KEY = 'chatbi.license.demo.v1';
const DEMO_CUSTOMER_ID = '2101616099981336600';
const listeners = new Set<() => void>();
export const LICENSE_DENIED_EVENT = 'chatbi:license-denied';
type DemoState = { license: LicenseClaims | null; records: LicenseRecord[]; updatedAt: string | null; environment: 'normal' | 'migrated' | 'unreadable'; corrupt: boolean; role: 'admin' | 'user' | null };
const normalMachine: MachineInfo = { machineCode: 'DEMO-CBI-1-A7F2-48C9-0E61-9B35', networkType: '固定有线网卡（演示）', productVersion: '1.0.0' };
const migratedMachine: MachineInfo = { ...normalMachine, machineCode: 'DEMO-CBI-1-B8E3-59DA-1F72-AC46', networkType: '虚拟机固定网卡（演示）' };
let state: DemoState | undefined;
let snapshot: LicenseSnapshot | undefined;

function sampleClaims(days: number, operation: LicenseOperation = 'activate', previous?: LicenseClaims | null, machineCode = normalMachine.machineCode): LicenseClaims {
  const now = Date.now();
  return { formatVersion: 1, productId: 'chatbi', customerId: previous?.customerId ?? DEMO_CUSTOMER_ID, customerName: previous?.customerName ?? '智能问数演示客户', revision: (previous?.revision ?? 0) + 1, machineCode, issuedAt: new Date(now - 365 * DAY).toISOString(), startsAt: new Date(now - 365 * DAY).toISOString(), expiresAt: new Date(now + days * DAY).toISOString(), operation };
}
function readState(): DemoState {
  if (state) return state;
  const initial: DemoState = { license: sampleClaims(180), records: [], updatedAt: new Date().toISOString(), environment: 'normal', corrupt: false, role: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed.records) || !['normal', 'migrated', 'unreadable'].includes(parsed.environment) || !('license' in parsed) || (parsed.license && (typeof parsed.license.customerName !== 'string' || !Number.isFinite(Date.parse(parsed.license.expiresAt)) || !Number.isFinite(Date.parse(parsed.license.startsAt))))) throw new Error('Invalid state');
      if (parsed.license?.customerId === 'DEMO-CUSTOMER') parsed.license.customerId = DEMO_CUSTOMER_ID;
      state = { ...parsed, records: parsed.records.map((record: LicenseRecord) => ({ ...record, customerId: record.customerId === 'DEMO-CUSTOMER' ? DEMO_CUSTOMER_ID : record.customerId ?? parsed.license?.customerId })) };
    } else { localStorage.setItem(STORAGE_KEY, JSON.stringify(initial)); state = initial; }
  } catch { state = { ...initial, license: null, corrupt: true }; }
  return state!;
}
function machine() { return readState().environment === 'unreadable' ? null : readState().environment === 'migrated' ? migratedMachine : normalMachine; }
export function getLicenseSnapshot(): LicenseSnapshot {
  if (snapshot) return snapshot;
  const current = readState(), m = machine();
  const reason = current.corrupt ? '许可证数据损坏，请重新填写有效许可证。' : !m ? '环境信息读取失败，请联系实施人员检查网卡配置。' : current.license && current.license.machineCode !== m.machineCode ? '许可证与当前部署环境不匹配。' : undefined;
  snapshot = { status: getLicenseStatus(current.license, m?.machineCode ?? null, Date.now(), reason), license: current.license, machine: m, updatedAt: current.updatedAt, reason, remainingDays: current.license ? Math.max(0, Math.ceil((Date.parse(current.license.expiresAt) - Date.now()) / DAY)) : 0 };
  return snapshot;
}
export function refreshLicense() { snapshot = undefined; getLicenseSnapshot(); listeners.forEach(fn => fn()); }
export function subscribeLicense(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function save(next: DemoState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { throw new LicenseError('SAVE_FAILED', '授权保存失败，原授权保持不变。'); }
  state = next; refreshLicense();
}
export function reloadLicenseStorage() { state = undefined; refreshLicense(); }
export function isLicenseAdmin() {
  const override = readState().role;
  if (override) return override === 'admin';
  const username = getDemoAuthUsername();
  try {
    const users = JSON.parse(localStorage.getItem('chatbi-medical-users-v1') ?? 'null');
    const user = Array.isArray(users) ? users.find(item => item.username === username) : null;
    if (user) return user.enabled && ['超级管理员', '管理员'].includes(user.role);
  } catch { /* Fall back to existing prototype accounts. */ }
  return ['admin', 'test', 'test2'].includes(username);
}
function requireAdmin() { if (!isLicenseAdmin()) throw new LicenseError('FORBIDDEN', '仅系统管理员可以管理授权。'); }
// This checksum only catches accidental edits to DEMO tokens; it is NOT a digital signature.
function checksum(value: string) { let h = 2166136261; for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619); return (h >>> 0).toString(16); }
function encode(claims: LicenseClaims) { const body = btoa(encodeURIComponent(JSON.stringify(claims))); return `DEMO1.${body}.${checksum(body)}`; }
function decode(token: string): unknown {
  const parts = token.replace(/\s/g, '').split('.');
  if (parts.length !== 3 || parts[0] !== 'DEMO1') throw new LicenseError('INVALID_FORMAT', '许可证格式不正确。');
  if (checksum(parts[1]) !== parts[2]) throw new LicenseError('INVALID_LICENSE', '许可证完整性校验失败。');
  try { return JSON.parse(decodeURIComponent(atob(parts[1]))); } catch { throw new LicenseError('INVALID_FORMAT', '许可证内容无法解析。'); }
}
function validate(token: string) {
  requireAdmin();
  const m = machine();
  if (!m) throw new LicenseError('ENVIRONMENT_UNAVAILABLE', '环境信息读取失败。');
  return validateClaims(decode(token), m.machineCode, readState().license);
}
export const licenseApi: LicenseApi = {
  async getMachine() { requireAdmin(); const m = machine(); if (!m) throw new LicenseError('ENVIRONMENT_UNAVAILABLE', '环境信息读取失败，请联系实施人员检查网卡配置。'); return m; },
  async getStatus() { refreshLicense(); return getLicenseSnapshot(); },
  async validate(token) { return validate(token); },
  async activate(token) {
    const preview = validate(token);
    if (preview.duplicate) return getLicenseSnapshot();
    const current = readState(), at = new Date().toISOString(), c = preview.license;
    const record: LicenseRecord = { id: `${Date.now()}-${c.revision}`, operation: current.license ? c.operation : 'activate', operator: getDemoAuthUsername(), updatedAt: at, customerId: c.customerId, revision: c.revision, previousExpiry: current.license?.expiresAt, startsAt: c.startsAt, expiresAt: c.expiresAt, machineCode: c.machineCode };
    save({ ...current, license: c, updatedAt: at, corrupt: false, records: [record, ...current.records] });
    return getLicenseSnapshot();
  },
  async getRecords() { requireAdmin(); return [...readState().records]; },
  async authorize(action) { refreshLicense(); const { status } = getLicenseSnapshot(); return { allowed: actionAllowed(status, action), status }; },
};
export function guardLicense(action: LicenseAction = 'execute'): boolean {
  refreshLicense();
  const { status } = getLicenseSnapshot();
  if (actionAllowed(status, action)) return true;
  window.dispatchEvent(new CustomEvent(LICENSE_DENIED_EVENT, { detail: { status } }));
  return false;
}
export function setDemoScenario(status: LicenseStatus) {
  const current = readState();
  save({ ...current, environment: 'normal', corrupt: status === 'invalid', license: status === 'unactivated' ? null : sampleClaims(status === 'expired' ? -1 : status === 'expiring' ? 7 : 180), records: [], updatedAt: status === 'unactivated' ? null : new Date().toISOString() });
}
export function setDemoRole(role: 'admin' | 'user') { save({ ...readState(), role }); }
export function setDemoEnvironment(environment: DemoState['environment']) { save({ ...readState(), environment }); }
export function getDemoEnvironment() { return readState().environment; }
export function getDemoLicenseToken(operation: LicenseOperation = 'renew') {
  requireAdmin();
  const current = readState().license;
  const days = operation === 'rebind' && current ? Math.max(1, (Date.parse(current.expiresAt) - Date.now()) / DAY) : Math.max(0, current ? (Date.parse(current.expiresAt) - Date.now()) / DAY : 0) + 365;
  const claims = sampleClaims(days, current ? operation : 'activate', current, machine()?.machineCode);
  if (operation === 'rebind' && current && Date.parse(current.expiresAt) > Date.now()) claims.expiresAt = current.expiresAt;
  claims.issuedAt = new Date().toISOString(); claims.startsAt = new Date(Date.now() - 1000).toISOString();
  return encode(claims);
}

export const validationDemoLabels = {
  format: '格式错误', integrity: '完整性校验失败', version: '许可证版本不兼容',
  product: '产品不匹配', machine: '部署环境不匹配', customer: '客户不匹配',
  time: '有效期非法', future: '尚未生效', expired: '许可证已到期',
  revision: '旧版本许可证', renewal: '续期未延长有效期', update: '误用首次激活许可证', rebind: '换绑信息不符合要求',
  duplicate: '重复导入当前许可证',
};
export type ValidationDemo = keyof typeof validationDemoLabels;
export function getValidationDemoUnavailableReason(example: ValidationDemo): string {
  const { license, status } = getLicenseSnapshot();
  if (['customer', 'revision', 'update', 'renewal', 'rebind', 'duplicate'].includes(example) && !license) return '请先切换为正常或即将到期场景。';
  if (['renewal', 'duplicate'].includes(example) && status !== 'active' && status !== 'expiring') return '请先切换为正常或即将到期场景，避免先触发已到期校验。';
  return '';
}
export function getDemoValidationToken(example: ValidationDemo): string {
  requireAdmin();
  const unavailable = getValidationDemoUnavailableReason(example);
  if (unavailable) throw new LicenseError('DEMO_UNAVAILABLE', unavailable);
  const current = readState().license;
  if (example === 'duplicate') return encode(current!);
  const token = getDemoLicenseToken();
  if (example === 'format') return 'DEMO-许可证示例不完整';
  if (example === 'integrity') return token + 'x';
  const claims = decode(token) as LicenseClaims;
  switch (example) {
    case 'version': return encode({ ...claims, formatVersion: 2 } as unknown as LicenseClaims);
    case 'product': claims.productId = 'another-product'; break;
    case 'machine': claims.machineCode = 'DEMO-OTHER-MACHINE'; break;
    case 'customer': claims.customerId = 'DEMO-OTHER-CUSTOMER'; break;
    case 'time': claims.expiresAt = claims.startsAt; break;
    case 'future': claims.startsAt = new Date(Date.now() + DAY).toISOString(); break;
    case 'expired': claims.startsAt = new Date(Date.now() - 2 * DAY).toISOString(); claims.expiresAt = new Date(Date.now() - DAY).toISOString(); break;
    case 'revision': claims.revision = current!.revision; break;
    case 'renewal': claims.expiresAt = current!.expiresAt; break;
    case 'update': claims.operation = 'activate'; break;
    case 'rebind': claims.operation = 'rebind'; break;
  }
  return encode(claims);
}
