export type LicenseStatus = 'unactivated' | 'active' | 'expiring' | 'expired' | 'invalid';
export type LicenseAction = 'execute' | 'manageSubscription' | 'configure' | 'read' | 'exportSaved' | 'pauseSubscription';
export type LicenseOperation = 'activate' | 'renew' | 'rebind';
export interface LicenseClaims {
  formatVersion: 1; productId: string; customerId: string; customerName: string;
  revision: number; machineCode: string;
  issuedAt: string; startsAt: string; expiresAt: string; operation: LicenseOperation;
}
export interface MachineInfo { machineCode: string; networkType: string; productVersion: string }
export interface LicenseRecord {
  id: string; operation: LicenseOperation; operator: string; updatedAt: string;
  customerId: string; revision: number; previousExpiry?: string; startsAt?: string; expiresAt: string; machineCode: string;
}
export interface LicenseSnapshot {
  status: LicenseStatus; license: LicenseClaims | null; machine: MachineInfo | null;
  updatedAt: string | null; reason?: string; remainingDays: number;
}
export interface LicensePreview { license: LicenseClaims; previous: LicenseClaims | null; duplicate: boolean }
export interface LicenseApi {
  getMachine(): Promise<MachineInfo>;
  getStatus(): Promise<LicenseSnapshot>;
  validate(token: string): Promise<LicensePreview>;
  activate(token: string): Promise<LicenseSnapshot>;
  getRecords(): Promise<LicenseRecord[]>;
  authorize(action: LicenseAction): Promise<{ allowed: boolean; status: LicenseStatus }>;
}
export const LICENSE_PATH = '/settings?section=system&systemTab=license';
export const DAY = 86400000;
export const statusLabels: Record<LicenseStatus, string> = {
  unactivated: '未激活', active: '正常', expiring: '即将到期', expired: '已到期', invalid: '授权异常',
};
export const operationLabels = { activate: '首次激活', renew: '续期', rebind: '环境换绑' };
export class LicenseError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = 'LicenseError'; }
}
export function getLicenseStatus(license: LicenseClaims | null, machineCode: string | null, now: number, invalidReason?: string): LicenseStatus {
  if (invalidReason) return 'invalid';
  if (!license) return 'unactivated';
  if (!Number.isFinite(Date.parse(license.startsAt)) || !Number.isFinite(Date.parse(license.expiresAt)) || Date.parse(license.expiresAt) <= Date.parse(license.startsAt)) return 'invalid';
  if (!machineCode || license.machineCode !== machineCode || now < Date.parse(license.startsAt)) return 'invalid';
  if (now >= Date.parse(license.expiresAt)) return 'expired';
  return Date.parse(license.expiresAt) - now <= 7 * DAY ? 'expiring' : 'active';
}
export function actionAllowed(status: LicenseStatus, action: LicenseAction): boolean {
  if (status === 'active' || status === 'expiring') return true;
  return (status === 'unactivated' || status === 'expired') && ['configure', 'read', 'exportSaved', 'pauseSubscription'].includes(action);
}
export function validateClaims(value: unknown, machineCode: string, previous: LicenseClaims | null, now = Date.now()): LicensePreview {
  const fail = (code: string, message: string): never => { throw new LicenseError(code, message); };
  if (!value || typeof value !== 'object') return fail('INVALID_FORMAT', '许可证格式不正确。');
  const c = value as LicenseClaims;
  const strings = ['productId', 'customerId', 'customerName', 'machineCode', 'issuedAt', 'startsAt', 'expiresAt'] as const;
  if (strings.some(key => typeof c[key] !== 'string' || !c[key].trim()) || !Number.isInteger(c.revision) || c.revision < 1 || !['activate', 'renew', 'rebind'].includes(c.operation)) return fail('INVALID_FORMAT', '许可证缺少必要字段或格式不正确。');
  if (c.formatVersion !== 1) return fail('UNSUPPORTED_FORMAT', '许可证版本不兼容。');
  if (c.productId !== 'chatbi') return fail('PRODUCT_MISMATCH', '许可证不适用于当前产品。');
  if (c.machineCode !== machineCode) return fail('MACHINE_MISMATCH', '许可证与当前部署环境不匹配。');
  const start = Date.parse(c.startsAt), end = Date.parse(c.expiresAt), issued = Date.parse(c.issuedAt);
  if (![start, end, issued].every(Number.isFinite) || end <= start) return fail('INVALID_TIME', '许可证有效期不正确。');
  if (now < start) return fail('NOT_YET_VALID', `许可证尚未生效，生效时间：${formatLicenseTime(c.startsAt)}。`);
  if (now >= end) return fail('EXPIRED', '许可证已经到期');
  if (previous) {
    if (c.customerId !== previous.customerId) return fail('OWNER_MISMATCH', '许可证客户与当前授权不一致。');
    if (JSON.stringify(c) === JSON.stringify(previous)) return { license: c, previous, duplicate: true };
    if (c.revision <= previous.revision) return fail('OLD_REVISION', '许可证版本不高于当前版本。');
    if (c.operation === 'activate') return fail('INVALID_UPDATE', '当前已有授权，不能使用首次激活许可证。');
    if (c.operation === 'renew' && end <= Date.parse(previous.expiresAt)) return fail('INVALID_RENEWAL', '续期后的到期时间未晚于当前到期时间。');
    if (c.operation === 'rebind' && (c.machineCode === previous.machineCode || end < Date.parse(previous.expiresAt))) return fail('INVALID_REBIND', '换绑未匹配新环境或缩短了原有效期。');
  }
  return { license: c, previous, duplicate: false };
}
export function formatLicenseTime(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(value));
}
