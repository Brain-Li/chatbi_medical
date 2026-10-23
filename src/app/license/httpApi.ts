import { LicenseError, type LicenseApi } from './model';
// Reserved integration adapter. The demo never calls this adapter or a vendor service.
export function createHttpLicenseApi(baseUrl = '/api/license'): LicenseApi {
  async function request<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new LicenseError(result.code ?? 'REQUEST_FAILED', result.message ?? '授权服务请求失败，请稍后重试。');
    return result;
  }
  return {
    getMachine: () => request('/machine'), getStatus: () => request('/status'),
    validate: token => request('/validate', { token }), activate: token => request('/activate', { token }),
    getRecords: () => request('/records'), authorize: action => request('/authorize', { action }),
  };
}
