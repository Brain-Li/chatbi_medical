import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { AlertCircle, X } from 'lucide-react';
import { useLicense } from '../license/hooks';
import { DAY, LICENSE_PATH } from '../license/model';
import { isLicenseAdmin, LICENSE_DENIED_EVENT, refreshLicense, reloadLicenseStorage } from '../license/service';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from './ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { dismissLicenseReminder, getDismissedLicenseReminder, getDemoAuthUsername } from '../utils/demoAuth';

export default function LicenseBoundary({ children }: { children: ReactNode }) {
  const snapshot = useLicense();
  const { status, license, remainingDays } = snapshot;
  const [denied, setDenied] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(getDismissedLicenseReminder);
  const navigate = useNavigate();
  const location = useLocation();
  const admin = isLicenseAdmin();
  const searchParams = new URLSearchParams(location.search);
  const onLicensePage = location.pathname === '/settings' && searchParams.get('section') === 'system' && searchParams.get('systemTab') === 'license';
  const restricted = status === 'invalid';
  const reminderKey = license ? getDemoAuthUsername() + ':' + license.customerId + ':' + license.revision + ':' + license.expiresAt + ':' + admin : '';

  const showBanner = status === 'expired' || status === 'unactivated' || restricted || (status === 'expiring' && dismissed !== reminderKey);

  useEffect(() => {
    const deniedListener = () => setDenied(true);
    const focus = () => refreshLicense();
    const storage = (event: StorageEvent) => { setDismissed(getDismissedLicenseReminder()); if (!event.key || event.key.startsWith('chatbi.license') || event.key === 'chatbi-medical-users-v1') reloadLicenseStorage(); };
    window.addEventListener(LICENSE_DENIED_EVENT, deniedListener);
    window.addEventListener('focus', focus);
    window.addEventListener('storage', storage);
    const interval = window.setInterval(refreshLicense, 30000);
    return () => { window.removeEventListener(LICENSE_DENIED_EVENT, deniedListener); window.removeEventListener('focus', focus); window.removeEventListener('storage', storage); window.clearInterval(interval); };
  }, []);
  useEffect(() => {
    const end = license ? Date.parse(license.expiresAt) : 0;
    const next = [end - 7 * DAY, end].find(time => time > Date.now());
    if (!next) return;
    const timeout = window.setTimeout(refreshLicense, Math.min(next - Date.now() + 5, 2147483647));
    return () => window.clearTimeout(timeout);
  }, [snapshot]);
  useEffect(() => {
    if (!admin && onLicensePage) navigate('/home', { replace: true });
    else if (admin && restricted && !onLicensePage) navigate(LICENSE_PATH, { replace: true });
  }, [admin, restricted, onLicensePage, navigate]);
  useEffect(() => { if (status === 'active' || status === 'expiring') setDenied(false); }, [status]);

  function openLicense() {
    window.dispatchEvent(new Event('chatbi:license-navigate'));
    setDenied(false);
    navigate(LICENSE_PATH);
  }
  function closeExpiryReminder() {
    dismissLicenseReminder(reminderKey);
    setDismissed(reminderKey);
  }
  const title = status === 'expired' ? '授权已到期' : status === 'unactivated' ? '产品尚未激活' : '授权异常';
  const banner = status === 'expired' ? (admin ? (onLicensePage ? '产品授权已到期，请在下方更新许可证完成续期。' : '产品授权已到期，请及时续期。') : '产品授权已到期，请联系管理员续期。') : status === 'unactivated' ? (admin ? (onLicensePage ? '产品尚未激活，请在下方导入许可证完成激活。' : '产品尚未激活，请完成激活后使用。') : '产品尚未激活，请联系管理员完成激活。') : status === 'invalid' ? '产品授权异常，请联系管理员修复授权。' : '产品授权将在 ' + remainingDays + ' 天内到期，' + (admin ? (onLicensePage ? '请在下方更新许可证完成续期。' : '请及时续期。') : '请联系管理员续期。');
  const deniedDescription = status === 'unactivated'
    ? '激活产品后，即可使用此功能。'
    : status === 'expired' ? '当前无法执行此操作，续期后恢复使用。' : '当前无法执行此操作。授权恢复后可继续使用，已输入的内容将保留。';
  return <div className="flex h-full min-h-0 flex-col">
    {showBanner && <div role="status" className="relative flex shrink-0 items-center justify-center gap-2 border-b border-[#ffe7ba] bg-[#fff8eb] px-16 py-2.5 text-xs leading-5 text-[#ad6800]"><AlertCircle className="h-4 w-4 shrink-0" /><span className="text-center">{banner}</span>{admin && !onLicensePage && <button className="shrink-0 text-xs leading-5 font-medium underline" onClick={openLicense}>{status === 'unactivated' ? '去激活' : status === 'expired' || status === 'expiring' ? '去续期' : '更新授权'}</button>}{status === 'expiring' && <button className="absolute right-6 flex h-8 w-8 items-center justify-center rounded hover:bg-[#ffe7ba]" aria-label="关闭到期提醒" onClick={closeExpiryReminder}><X className="h-4 w-4" /></button>}</div>}
    <div className="min-h-0 flex-1">{(!admin && onLicensePage) || (admin && restricted && !onLicensePage) ? null : children}</div>
    <Dialog open={denied && status === 'unactivated'} onOpenChange={setDenied}>
      <DialogContent className="!z-[100] w-[calc(100vw_-_2rem)] max-w-[420px] gap-6 p-6 sm:max-w-[420px]" showCloseButton={false}>
        <DialogHeader className="gap-2 text-left">
          <DialogTitle className="leading-6">产品尚未激活</DialogTitle>
          <DialogDescription>激活产品后，即可使用此功能。</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row justify-end gap-2">
          <Button variant="outline" className="h-9" onClick={() => setDenied(false)}>我知道了</Button>
          {admin && <Button className="h-9 bg-[#1d2129] hover:bg-[#303744]" onClick={openLicense}>去激活</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <AlertDialog open={denied && status !== 'unactivated'} onOpenChange={setDenied}><AlertDialogContent className="!z-[100] w-[calc(100vw_-_2rem)] max-w-[420px] sm:max-w-[420px]"><AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{deniedDescription}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>我知道了</AlertDialogCancel>{admin && <AlertDialogAction onClick={openLicense} className="bg-[#1d2129] hover:bg-[#303744]">{status === 'unactivated' ? '去激活' : '更新授权'}</AlertDialogAction>}</AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
