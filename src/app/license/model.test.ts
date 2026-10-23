import { describe, expect, it } from 'vitest';
import { actionAllowed, DAY, getLicenseStatus, validateClaims, type LicenseClaims, type LicenseStatus } from './model';

const now = Date.parse('2026-10-22T04:00:00Z');
const claim: LicenseClaims = { formatVersion: 1, productId: 'chatbi', customerId: 'C1', customerName: '客户', revision: 1, machineCode: 'M1', issuedAt: new Date(now - DAY).toISOString(), startsAt: new Date(now - DAY).toISOString(), expiresAt: new Date(now + 90 * DAY).toISOString(), operation: 'activate' };
describe('license status and action policy', () => {
  it('changes at the exact expiry boundary without requiring another login', () => {
    const end = Date.parse(claim.expiresAt);
    expect(getLicenseStatus(claim, 'M1', end - 7 * DAY - 1)).toBe('active');
    expect(getLicenseStatus(claim, 'M1', end - 30 * DAY)).toBe('active');
    expect(getLicenseStatus(claim, 'M1', end - 7 * DAY)).toBe('expiring');
    expect(getLicenseStatus(claim, 'M1', end - 1)).toBe('expiring');
    expect(getLicenseStatus(claim, 'M1', end)).toBe('expired');
  });
  it('treats missing, changed, or unreadable environments separately from expiry', () => {
    expect(getLicenseStatus(null, 'M1', now)).toBe('unactivated');
    expect(getLicenseStatus(claim, 'M2', now)).toBe('invalid');
    expect(getLicenseStatus(claim, null, now)).toBe('invalid');
    expect(getLicenseStatus(claim, 'M1', now, 'signature invalid')).toBe('invalid');
    expect(getLicenseStatus({ ...claim, expiresAt: 'bad' }, 'M1', now)).toBe('invalid');
  });
  it.each(['active', 'expiring'] as LicenseStatus[])('%s permits all normal actions', status => {
    expect(actionAllowed(status, 'execute')).toBe(true);
    expect(actionAllowed(status, 'manageSubscription')).toBe(true);
    expect(actionAllowed(status, 'configure')).toBe(true);
  });
  it.each(['unactivated', 'expired'] as LicenseStatus[])('%s blocks business execution and subscription changes but allows other operations', status => {
    for (const action of ['configure', 'read', 'exportSaved', 'pauseSubscription'] as const) expect(actionAllowed(status, action)).toBe(true);
    expect(actionAllowed(status, 'execute')).toBe(false);
    expect(actionAllowed(status, 'manageSubscription')).toBe(false);
  });
  it('keeps invalid licenses restricted', () => {
    for (const action of ['execute', 'manageSubscription', 'configure', 'read', 'exportSaved', 'pauseSubscription'] as const) expect(actionAllowed('invalid', action)).toBe(false);
  });
});
describe('activation, renewal and rebinding', () => {
  it('accepts first activation and treats resubmission as idempotent', () => {
    expect(validateClaims(claim, 'M1', null, now).duplicate).toBe(false);
    expect(validateClaims(claim, 'M1', claim, now).duplicate).toBe(true);
  });
  it.each([
    { customerId: '' }, { customerId: undefined }, { customerName: '' }, { expiresAt: '' }, { expiresAt: 'bad' }, { revision: 0 },
    { formatVersion: 2 }, { productId: 'other' }, { machineCode: 'M2' },
    { startsAt: new Date(now + DAY).toISOString() }, { expiresAt: new Date(now).toISOString() },
  ])('rejects missing, incompatible or invalid claims: %o', patch => {
    expect(() => validateClaims({ ...claim, ...patch }, 'M1', null, now)).toThrow();
  });
  it('retains remaining days during an early renewal', () => {
    const renewal = { ...claim, revision: 2, operation: 'renew' as const, expiresAt: new Date(Date.parse(claim.expiresAt) + 365 * DAY).toISOString() };
    expect(validateClaims(renewal, 'M1', claim, now).license.expiresAt).toBe(renewal.expiresAt);
    for (const patch of [{ revision: 1 }, { expiresAt: claim.expiresAt }, { customerId: 'C2' }]) {
      expect(() => validateClaims({ ...renewal, ...patch }, 'M1', claim, now)).toThrow();
    }
  });
  it('allows rebind only to a changed environment with a newer version', () => {
    const rebind = { ...claim, revision: 2, machineCode: 'M2', operation: 'rebind' as const };
    expect(validateClaims(rebind, 'M2', claim, now).license.expiresAt).toBe(claim.expiresAt);
    expect(() => validateClaims(rebind, 'M1', claim, now)).toThrow();
    expect(() => validateClaims({ ...rebind, machineCode: 'M1' }, 'M1', claim, now)).toThrow();
  });
});
