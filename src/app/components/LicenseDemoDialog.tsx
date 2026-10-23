import { useLicense } from '../license/hooks';
import { statusLabels, type LicenseStatus } from '../license/model';
import { isLicenseAdmin, setDemoRole, setDemoScenario } from '../license/service';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';

// Prototype controls stay accessible even when the license page is hidden.
export function LicenseDemoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { status } = useLicense();
  const selectClass = 'h-9 w-full rounded-lg border border-[#e5e6eb] bg-white px-3 text-sm text-[#4e5969]';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw_-_2rem)] sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>演示设置</DialogTitle>
          <DialogDescription>用于演示授权状态及角色；切换授权场景会重置演示授权记录。</DialogDescription>
        </DialogHeader>
        <label className="grid gap-2 text-sm text-[#4e5969]">
          授权场景
          <select aria-label="演示授权场景" className={selectClass} value={status === 'invalid' ? '' : status} onChange={event => setDemoScenario(event.target.value as LicenseStatus)}>
            {status === 'invalid' && <option value="" disabled hidden>请选择授权场景</option>}
            {Object.entries(statusLabels).filter(([value]) => value !== 'invalid').map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-sm text-[#4e5969]">
          查看身份
          <select aria-label="演示查看身份" className={selectClass} value={isLicenseAdmin() ? 'admin' : 'user'} onChange={event => setDemoRole(event.target.value as 'admin' | 'user')}>
            <option value="admin">系统管理员</option>
            <option value="user">普通用户</option>
          </select>
        </label>
      </DialogContent>
    </Dialog>
  );
}
