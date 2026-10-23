import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, CheckCircle2, Copy, History, KeyRound, RefreshCw, ShieldCheck, Server } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { useLicense } from '../license/hooks';
import { formatLicenseTime, statusLabels, type LicensePreview, type LicenseRecord, type LicenseStatus, type MachineInfo } from '../license/model';
import { getDemoEnvironment, getDemoLicenseToken, isLicenseAdmin, licenseApi, setDemoEnvironment, setDemoRole, setDemoScenario } from '../license/service';
import { getDemoValidationToken, getValidationDemoUnavailableReason, validationDemoLabels, type ValidationDemo } from '../license/service';

const button = 'inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#e5e6eb] bg-white px-4 text-sm text-[#4e5969] transition-colors hover:bg-[#f7f8fa] disabled:cursor-not-allowed disabled:opacity-50';
const primary = button + ' !border-[#1d2129] !bg-[#1d2129] !text-white hover:!bg-[#303744]';
const statusStyle: Record<LicenseStatus, string> = { active: 'bg-[#e8f7ef] text-[#00875a]', expiring: 'bg-[#fff4df] text-[#ad6800]', expired: 'bg-[#fff0ee] text-[#d4380d]', invalid: 'bg-[#fff0ee] text-[#d4380d]', unactivated: 'bg-[#f2f3f5] text-[#4e5969]' };
const machineDemoLabels = { auto: '自动获取（默认）', loading: '获取中', success: '获取成功', error: '获取失败' };
function Field({ label, value }: { label: string; value: ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs leading-5 text-[#86909c]">{label}</dt><dd className="mt-1 break-all text-sm leading-6 text-[#1d2129]">{value || '—'}</dd></div>;
}
export default function LicenseManagementSection() {
  const { license, status, machine, reason, remainingDays, updatedAt } = useLicense();
  const admin = isLicenseAdmin();
  const canViewLicenseDetails = admin || status !== 'invalid';
  const [formOpen, setFormOpen] = useState(false);
  const [token, setToken] = useState('');
  const [validationDemo, setValidationDemo] = useState<ValidationDemo>('format');
  const validationDemoUnavailable = getValidationDemoUnavailableReason(validationDemo);
  const [preview, setPreview] = useState<LicensePreview | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const formBusy = busy === 'validate' || busy === 'activate';
  const formTrigger = useRef<HTMLButtonElement>(null);
  const [records, setRecords] = useState<LicenseRecord[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const historyScroll = useRef<HTMLDivElement>(null);
  const historyPages = Math.max(1, Math.ceil(records.length / 10));
  const visibleRecords = records.slice((historyPage - 1) * 10, historyPage * 10);
  function changeHistoryPage(page: number) {
    setHistoryPage(Math.max(1, Math.min(page, historyPages)));
    historyScroll.current?.scrollTo({ top: 0 });
  }
  const [machineRequest, setMachineRequest] = useState(0);
  const [machineDemo, setMachineDemo] = useState<keyof typeof machineDemoLabels>('auto');
  const [machineState, setMachineState] = useState<{ loading: boolean; data: MachineInfo | null; error: string }>({ loading: true, data: null, error: '' });
  const { loading: machineLoading, data: machineInfo, error: machineError } = machineState;
  const productVersion = machineInfo?.productVersion ?? machine?.productVersion;
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle');
  const copyRequest = useRef(0);
  useEffect(() => {
    setCopyState('idle');
    return () => { copyRequest.current += 1; };
  }, [admin, machineInfo?.machineCode]);
  useEffect(() => {
    if (copyState !== 'copied') return;
    const timeout = window.setTimeout(() => setCopyState('idle'), 2000);
    return () => window.clearTimeout(timeout);
  }, [copyState]);
  useEffect(() => {
    if (!admin) return;
    let cancelled = false;
    setMachineState({ loading: true, data: null, error: '' });
    async function loadMachine() {
      try {
        if (machineDemo === 'error') throw new Error('暂时无法获取机器码，请检查服务连接后重试。');
        const info = await licenseApi.getMachine();
        if (!info.machineCode?.trim()) throw new Error('未获取到有效机器码，请联系实施人员检查部署环境。');
        if (!cancelled) setMachineState({ loading: false, data: info, error: '' });
      } catch (err) {
        if (!cancelled) setMachineState({ loading: false, data: null, error: err instanceof Error ? err.message : '获取机器码失败，请重试。' });
      }
    }
    const timeout = machineDemo === 'loading' ? undefined : window.setTimeout(() => { void loadMachine(); }, machineRequest > 0 ? 1200 : 0);
    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, [admin, machine?.machineCode, machine?.productVersion, machineRequest, machineDemo]);
  function changeMachineDemo(value: keyof typeof machineDemoLabels) {
    if (value === 'success' && getDemoEnvironment() === 'unreadable') setDemoEnvironment('normal');
    setMachineRequest(0);
    setMachineDemo(value);
  }
  const message = (err: unknown) => err instanceof Error ? err.message : '操作失败，请重试。';
  async function copy(value: string) {
    const request = ++copyRequest.current;
    setCopyState('copying');
    try {
      await navigator.clipboard.writeText(value);
      if (request === copyRequest.current) setCopyState('copied');
    } catch {
      if (request === copyRequest.current) setCopyState('error');
    }
  }
  function changeFormOpen(open: boolean) {
    if (formBusy) return;
    setFormOpen(open); setPreview(null); setError('');
  }
  async function validate() {
    if (!token.trim() || formBusy) return;
    setBusy('validate'); setPreview(null); setError('');
    try { setPreview(await licenseApi.validate(token)); } catch (err) { setError(message(err)); } finally { setBusy(null); }
  }
  async function activate() {
    if (!preview || preview.duplicate || formBusy) return;
    setBusy('activate'); setError('');
    try {
      await licenseApi.activate(token);
      toast.success(license ? '许可证更新成功' : '产品激活成功');
      if (status === 'expired') toast.info('请检查并手动恢复因到期暂停的订阅；不会自动补跑或补发。');
      setToken(''); setPreview(null); setFormOpen(false);
    } catch (err) { setError(message(err)); setPreview(null); } finally { setBusy(null); }
  }
  async function openHistory() {
    setBusy('records');
    try {
      const history = await licenseApi.getRecords();
      setRecords([...history].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)));
      setHistoryPage(1);
      setHistoryOpen(true);
    } catch (err) { toast.error(message(err)); } finally { setBusy(null); }
  }
  function fillExample() {
    try { setToken(getDemoLicenseToken(getDemoEnvironment() === 'migrated' ? 'rebind' : license ? 'renew' : 'activate')); setPreview(null); setError(''); setFormOpen(true); } catch (err) { toast.error(message(err)); }
  }
  function fillValidationExample() {
    try { setToken(getDemoValidationToken(validationDemo)); setPreview(null); setError(''); setFormOpen(true); }
    catch (err) { toast.error(message(err)); }
  }
  return (
    <div className="space-y-5 pb-8 text-[#1d2129]">
      <section className="overflow-hidden rounded-xl border border-[#e5e6eb] bg-white">
        <div className={'flex flex-wrap items-center justify-between gap-4 px-6 py-5' + (canViewLicenseDetails || status === 'invalid' ? ' border-b border-[#f2f3f5]' : '')}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f2f3f5]"><ShieldCheck className="h-5 w-5 text-[#4e5969]" /></div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h3 className="font-medium">当前授权</h3>
              <span className={'rounded-md px-2 py-0.5 text-xs ' + statusStyle[status]}>{statusLabels[status]}</span>
              {license && (status === 'active' || status === 'expiring') && <span className={'text-sm ' + (status === 'expiring' ? 'text-[#ad6800]' : 'text-[#4e5969]')}>剩余 <span className="font-semibold tabular-nums">{remainingDays}</span> 天</span>}
            </div>
          </div>
          {admin && <div className="flex flex-wrap items-center gap-2">
            <button className={button + ' border-transparent px-3'} disabled={!!busy} onClick={openHistory}><History className="h-4 w-4" />授权记录</button>
            <button ref={formTrigger} className={primary} disabled={!!busy} onClick={() => changeFormOpen(true)}><KeyRound className="h-4 w-4" />{license ? '更新许可证' : '导入许可证'}</button>
          </div>}
        </div>
        {!canViewLicenseDetails ? (status === 'invalid' && <div className="px-6 py-6 text-sm text-[#4e5969]">仅系统管理员可查看授权详情及更新许可证。如需处理授权，请联系管理员。</div>) : <>
          {(reason || status === 'invalid') && <p role="alert" className="mx-6 mt-4 rounded-lg bg-[#fff0ee] px-4 py-3 text-sm leading-6 text-[#d4380d]">{reason || '许可证当前不可用，请核对生效时间和部署环境，或联系供应商更新许可证。'}</p>}
          {license ? <dl className="grid gap-x-8 gap-y-4 px-6 py-5 sm:grid-cols-2 xl:grid-cols-3">
            <Field label="客户ID" value={license.customerId} />
            <Field label="客户名称" value={license.customerName} />
            <Field label="授权模式" value="离线" />
            <Field label="生效时间" value={formatLicenseTime(license.startsAt)} />
            <Field label="到期时间" value={<span className={'font-medium tabular-nums ' + (status === 'expired' ? 'text-[#d4380d]' : status === 'expiring' ? 'text-[#ad6800]' : '')}>{formatLicenseTime(license.expiresAt)}</span>} />
            <Field label="最近许可证更新时间" value={<span className="text-[#86909c]">{formatLicenseTime(updatedAt)}</span>} />
          </dl> : <div className="px-6 py-4"><p className="text-sm leading-6 text-[#86909c]">{admin ? '复制下方机器码并提供给供应商，获取许可证后导入，完成激活。' : '请联系管理员完成激活。'}</p></div>}
        </>}
      </section>
      {admin && <>
        <section className="rounded-xl border border-[#e5e6eb] bg-white px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
              <h3 className="flex shrink-0 items-center gap-2 font-medium"><Server className="h-4 w-4 text-[#86909c]" />部署环境</h3>
              <span className="max-w-full break-all rounded-md bg-[#f2f3f5] px-2 py-0.5 text-xs leading-5 text-[#4e5969]"><span className="sr-only">当前产品版本 </span>{productVersion ? `v${productVersion.replace(/^v/i, '')}` : '—'}</span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2">
            <label htmlFor="license-machine-code" className="text-xs text-[#86909c]">当前环境机器码</label>
            <div className="flex min-w-0 items-center gap-3">
              <input id="license-machine-code" readOnly aria-busy={machineLoading} aria-describedby={machineError ? 'license-machine-error' : copyState === 'error' ? 'license-copy-error' : undefined} value={machineInfo?.machineCode ?? ''} placeholder={machineLoading ? '正在获取机器码…' : '—'} className="h-11 min-w-0 flex-1 rounded-lg border border-[#e5e6eb] bg-[#f7f8fa] px-3 font-mono text-sm" />
              {machineLoading ? <button className={button + ' w-[116px] shrink-0'} disabled aria-busy="true"><RefreshCw className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />获取中</button> : machineError ? <button className={button + ' w-[116px] shrink-0'} disabled={!!busy} onClick={() => setMachineRequest(request => request + 1)}><RefreshCw className="h-4 w-4" aria-hidden="true" />重新获取</button> : machineInfo && <button className={button + ' w-[116px] shrink-0'} disabled={!!busy || copyState === 'copying'} aria-busy={copyState === 'copying'} onClick={() => copy(machineInfo.machineCode)}>{copyState === 'copied' ? <Check className="h-4 w-4 text-[#00875a]" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}{copyState === 'copied' ? '已复制' : '复制'}</button>}
            </div>
            <p role="status" className="sr-only">{machineLoading ? '正在获取机器码…' : copyState === 'copied' ? '机器码已复制' : ''}</p>
            {machineError && <p id="license-machine-error" role="alert" className="text-sm leading-5 text-[#d4380d]">{machineError}</p>}
            {copyState === 'error' && <p id="license-copy-error" role="alert" className="text-sm leading-5 text-[#d4380d]">复制失败，请选中机器码手动复制。</p>}
          </div>
        </section>
        <Dialog open={formOpen} onOpenChange={changeFormOpen}>
          <DialogContent className="flex max-h-[85vh] w-[calc(100vw_-_2rem)] flex-col gap-5 overflow-hidden sm:max-w-2xl" aria-describedby={undefined} showCloseButton={!formBusy} onCloseAutoFocus={event => { event.preventDefault(); formTrigger.current?.focus(); }}>
            <DialogHeader className="shrink-0 pr-6 text-left">
              <DialogTitle className="leading-6">{license ? '更新许可证' : '导入许可证'}</DialogTitle>
            </DialogHeader>
            <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
              <div>
                <label htmlFor="license-token" className="block text-sm">许可证</label>
                <textarea id="license-token" value={token} onChange={e => { setToken(e.target.value); setPreview(null); setError(''); }} disabled={formBusy} aria-describedby={error ? 'license-form-error' : undefined} rows={4} placeholder="请粘贴供应商提供的完整许可证" spellCheck={false} className="mt-2 block w-full resize-y rounded-lg border border-[#e5e6eb] bg-white p-3 font-mono text-sm outline-none focus:border-[#86909c] focus:ring-2 focus:ring-[#1d2129]/10" />
                {error && <p id="license-form-error" role="alert" className="mt-2 text-sm leading-5 text-[#d4380d]">{error}</p>}
              </div>
              {preview && <div className="rounded-lg border border-[#b7ebcf] bg-[#f5fcf8] p-5">
                <p role="status" className={'flex items-center gap-2 text-sm font-medium ' + (preview.duplicate ? 'text-[#4e5969]' : 'text-[#00875a]')}><CheckCircle2 className="h-4 w-4 shrink-0" />{preview.duplicate ? '该许可证已生效，无需重复导入。' : '校验通过，请核对激活信息'}</p>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="客户ID" value={preview.license.customerId} />
                  <Field label="客户名称" value={preview.license.customerName} />
                  <Field label="生效时间" value={formatLicenseTime(preview.license.startsAt)} />
                  <Field label="到期时间" value={formatLicenseTime(preview.license.expiresAt)} />
                </dl>
              </div>}
            </div>
            <DialogFooter className="shrink-0 border-t border-[#f2f3f5] pt-4">
              <button className={button} disabled={formBusy} onClick={() => changeFormOpen(false)}>取消</button>
              {preview ? <button className={primary} disabled={formBusy || preview.duplicate} onClick={activate}>{busy === 'activate' ? (license ? '更新中…' : '激活中…') : license ? '确认更新' : '确认激活'}</button> : <button className={primary} disabled={!token.trim() || formBusy} onClick={validate}>{busy === 'validate' ? '校验中…' : '校验许可证'}</button>}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>}
      <details className="rounded-xl border border-dashed border-[#dce0e5] bg-[#fafbfc] px-5 py-4"><summary className="cursor-pointer text-sm text-[#86909c]">演示设置</summary><div className="mt-4 flex flex-wrap items-end gap-4">
        <label className="grid gap-2 text-xs text-[#86909c]">授权场景<select aria-label="演示授权场景" value={status === 'invalid' ? '' : status} onChange={e => { setDemoScenario(e.target.value as LicenseStatus); setPreview(null); setToken(''); setError(''); }} className={button}>{status === 'invalid' && <option value="" disabled hidden>请选择授权场景</option>}{Object.entries(statusLabels).filter(([value]) => value !== 'invalid').map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="grid gap-2 text-xs text-[#86909c]">查看身份<select aria-label="演示查看身份" value={admin ? 'admin' : 'user'} onChange={e => { setDemoRole(e.target.value as 'admin' | 'user'); setHistoryOpen(false); setPreview(null); }} className={button}><option value="admin">系统管理员</option><option value="user">普通用户</option></select></label>
        {admin && <label className="grid gap-2 text-xs text-[#86909c]">机器码获取<select aria-label="演示机器码获取" value={machineDemo} onChange={e => changeMachineDemo(e.target.value as keyof typeof machineDemoLabels)} className={button}>{Object.entries(machineDemoLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
        {admin && <button className={button} onClick={fillExample}>填入{getDemoEnvironment() === 'migrated' ? '换绑' : license ? '续期' : '激活'}示例</button>}
        {admin && <label className="grid gap-2 text-xs text-[#86909c]">许可证校验示例<select aria-label="演示许可证校验" value={validationDemo} onChange={event => setValidationDemo(event.target.value as ValidationDemo)} className={button}>{Object.entries(validationDemoLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
        {admin && <button className={button} disabled={!!validationDemoUnavailable || formBusy} onClick={fillValidationExample}>填入校验示例</button>}
        {admin && <p className="w-full text-xs leading-5 text-[#86909c]">{validationDemoUnavailable || '填入后点击“校验许可证”查看反馈；不会修改当前授权或新增授权记录。'}</p>}
      </div><p className="mt-3 text-xs leading-5 text-[#86909c]">用于演示不同授权状态及角色；切换授权场景会重置演示授权记录。正式接入后移除这些演示入口。</p>{admin && <p className="mt-2 text-xs leading-5 text-[#86909c]">“获取中”会保持加载；“获取失败”可重复重试。重新进入页面后恢复自动获取。</p>}</details>
      <Dialog open={historyOpen && admin} onOpenChange={setHistoryOpen}><DialogContent className="flex max-h-[80vh] flex-col gap-5 overflow-hidden sm:max-w-4xl" aria-describedby={undefined}><DialogHeader className="shrink-0 pr-6 text-left"><DialogTitle className="leading-6">授权记录</DialogTitle></DialogHeader><div ref={historyScroll} className="min-h-0 overflow-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="sticky top-0 bg-[#f7f8fa] text-xs text-[#86909c]"><tr>{['操作时间', '操作人', '生效时间', '到期时间'].map(label => <th key={label} className="px-3 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{visibleRecords.map(record => <tr key={record.id} className="border-b border-[#f2f3f5]"><td className="px-3 py-4">{formatLicenseTime(record.updatedAt)}</td><td className="px-3 py-4">{record.operator}</td><td className="px-3 py-4">{formatLicenseTime(record.startsAt)}</td><td className="px-3 py-4">{formatLicenseTime(record.expiresAt)}</td></tr>)}{!records.length && <tr><td colSpan={4} className="py-12 text-center text-[#86909c]">暂无记录</td></tr>}</tbody></table></div><nav aria-label="授权记录分页" className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#f2f3f5] pt-4 text-sm"><span className="text-[#86909c]">共 {records.length} 条，每页 10 条</span><div className="flex items-center gap-2"><button className={button} disabled={historyPage === 1} onClick={() => changeHistoryPage(historyPage - 1)}>上一页</button><span aria-live="polite" className="px-1 tabular-nums text-[#4e5969]">{historyPage} / {historyPages}</span><button className={button} disabled={historyPage === historyPages} onClick={() => changeHistoryPage(historyPage + 1)}>下一页</button></div></nav></DialogContent></Dialog>
    </div>
  );
}
