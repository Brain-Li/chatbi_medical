import { type FormEvent, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

type WorkspaceCreateDialogProps = {
  open: boolean;
  workspaceNames: string[];
  onOpenChange: (open: boolean) => void;
  onCreated: (name: string) => string | void;
  initialName?: string;
  mode?: 'create' | 'rename';
};

const maxLengthError = '工作区名称最多20个字';

export function WorkspaceCreateDialog({
  open,
  workspaceNames,
  onOpenChange,
  onCreated,
  initialName,
  mode = 'create',
}: WorkspaceCreateDialogProps) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setDraft(initialName ?? '');
      setError('');
    }
  }, [open, initialName]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = draft.trim();
    if (!name) {
      setError('请输入工作区名称');
      return;
    }
    if (draft.length > 20) {
      setError(maxLengthError);
      return;
    }

    const duplicateName = workspaceNames.find((workspace) => workspace !== initialName && workspace.toLowerCase() === name.toLowerCase());
    if (duplicateName) {
      setError(`已存在名为“${duplicateName}”的工作区。`);
      return;
    }

    const saveError = onCreated(name);
    if (saveError) {
      setError(saveError);
      return;
    }
    onOpenChange(false);
  };

  const overLimit = draft.length > 20;
  const hasLengthError = overLimit || error === maxLengthError;
  const visibleError = hasLengthError ? maxLengthError : error;
  const canSave = draft.trim().length > 0 && !overLimit;
  const title = mode === 'rename' ? '重命名工作区' : '新建工作区';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px] gap-0 overflow-hidden rounded-[16px] border-0 bg-white p-0 font-['PingFang_SC','Microsoft_YaHei',sans-serif] shadow-[0_16px_48px_rgba(29,33,41,0.18)]">
        <DialogHeader className="border-b border-[#e5e6eb] px-6 pb-5 pt-5 pr-14 text-left">
          <DialogTitle className="font-['Login_Figma_Sans','PingFang_SC','Microsoft_YaHei',sans-serif] text-[20px] font-medium leading-7 text-[#1d2129]">{title}</DialogTitle>
          <DialogDescription className="sr-only">请输入不超过20个字且不重复的工作区名称。</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-5 px-6 py-5" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <div className="relative">
              <input
                autoFocus
                value={draft}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setDraft(nextValue.slice(0, 20));
                  if (nextValue.length > 20) {
                    setError(maxLengthError);
                  } else if (error === maxLengthError || error) {
                    setError('');
                  }
                }}
                placeholder="请输入工作区名称"
                aria-label="工作区名称"
                aria-invalid={Boolean(visibleError)}
                className={`h-10 w-full rounded-[12px] border bg-white px-3 pr-14 text-[14px] leading-[22px] tracking-[0.15px] text-[#1d2129] outline-none placeholder:text-[#86909c] focus:border-[#165dff] focus:ring-2 focus:ring-[#165dff]/10 ${visibleError ? 'border-[#f53f3f] focus:border-[#f53f3f]' : 'border-[#e5e6eb]'}`}
              />
              <span className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] leading-[22px] ${overLimit ? 'text-[#f53f3f]' : 'text-[#86909c]'}`}>
                {draft.length}/20
              </span>
            </div>
            {visibleError && <span role="alert" className="text-xs leading-[18px] text-[#f53f3f]">{visibleError}</span>}
          </div>
          <DialogFooter className="-mx-6 -mb-5 flex-row justify-end gap-3 border-t border-[#e5e6eb] bg-[#f7f8fa] px-6 py-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-full border border-[#e5e6eb] bg-transparent px-5 text-[14px] leading-[22px] text-[rgba(0,0,0,0.9)] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-full border border-[#1d2129] bg-[#1d2129] px-5 text-[14px] leading-[22px] text-white transition-colors hover:bg-[#2f3339] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 disabled:cursor-not-allowed disabled:border-[#e5e6eb] disabled:bg-[#e5e6eb] disabled:text-[#86909c]"
            >
              保存
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
