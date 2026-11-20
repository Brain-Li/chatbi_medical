import { useRef, useState, type RefObject } from 'react';
import { CircleDashed, DatabaseZap, Download, FilePenLine, Paperclip, Plus, Send, Target } from 'lucide-react';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from './ui/popover';

export type ComposerAction = 'file' | 'goal' | 'plan' | 'feedback' | 'compact' | 'model' | 'export';

const groups = [
  { label: '添加', items: [
    { id: 'file', label: '文件', icon: Paperclip, description: '' },
    { id: 'goal', label: '目标', icon: Target, description: '设置或查看长期任务目标' },
    { id: 'plan', label: '计划', icon: FilePenLine, description: '进入或退出计划模式' },
    { id: 'feedback', label: '反馈', icon: Send, description: '发送关于当前会话的反馈' },
  ] },
  { label: '指令', items: [
    { id: 'compact', label: '压缩', icon: CircleDashed, description: '压缩以上对话内容' },
    { id: 'model', label: '模型', icon: DatabaseZap, description: '查看和管理可用模型' },
    { id: 'export', label: '下载日志', icon: Download, description: '将当前会话内容导出为 ZIP' },
  ] },
] as const;

export function ComposerActionsMenu({ anchorRef, onAction }: {
  anchorRef: RefObject<HTMLDivElement | null>;
  onAction: (action: ComposerAction) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor virtualRef={anchorRef as RefObject<HTMLDivElement>} />
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="更多功能"
          title="更多功能"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f5f6f8] text-[#1d2129] transition-colors hover:bg-[#e8eaed] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/25"
        >
          <Plus aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        collisionPadding={16}
        aria-label="添加与指令"
        className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[16px] border-[#e5e6eb] bg-[#fcfdfe] p-1.5 text-[#1d2129] shadow-[0_8px_28px_rgba(29,33,41,0.10)]"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
        }}
      >
        <div
          ref={menuRef}
          role="menu"
          aria-label="添加与指令"
          className="history-scrollbar max-h-[min(340px,calc(var(--radix-popover-content-available-height)-14px))] overflow-y-auto overscroll-contain"
          onKeyDown={(event) => {
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
            const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
            const index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
            buttons[index]?.focus();
          }}
        >
          {groups.map((group) => (
            <div key={group.label} role="group" aria-label={group.label}>
              <p className="px-3 pb-1.5 pt-2 text-xs font-normal leading-5 text-[#86909c]">{group.label}</p>
              {group.items.map(({ id, label, icon: Icon, description }) => {
                const disabled = id === 'compact' || id === 'export' || id === 'feedback';
                const muted = id === 'compact' || id === 'export';
                return (
                  <button
                    key={id}
                    type="button"
                    role="menuitem"
                    disabled={disabled}
                    title={disabled ? '开始会话后可用' : undefined}
                    onClick={() => {
                      setOpen(false);
                      onAction(id);
                    }}
                    className={`flex min-h-10 w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-sm text-[#1d2129] transition-colors hover:bg-[#eceeef] focus-visible:bg-[#eceeef] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-100 ${muted ? 'disabled:text-[#a8adb5] disabled:hover:bg-transparent' : ''}`}
                  >
                    <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" strokeWidth={1.6} />
                    <span className="shrink-0">{label}</span>
                    {description && <span className={`ml-auto min-w-0 pl-3 text-right text-[13px] leading-5 max-sm:text-xs ${muted ? 'text-[#86909c]' : 'text-[#6b7280]'}`}>{description}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
