import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

type HistorySidebarToggleProps = {
  expanded: boolean;
  onClick: () => void;
  className?: string;
};

export function HistorySidebarToggle({
  expanded,
  onClick,
  className = '',
}: HistorySidebarToggleProps) {
  const label = expanded ? '收起侧边栏' : '展开侧边栏';
  const Icon = expanded ? PanelLeftClose : PanelLeftOpen;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-transparent text-[#86909c] transition-colors hover:text-[#4e5969] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/25 ${className}`}
      aria-label={label}
      aria-expanded={expanded}
    >
      <Icon
        aria-hidden="true"
        className="h-[18px] w-[18px]"
        strokeWidth={1.8}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-full top-1/2 z-30 ml-2 flex -translate-y-1/2 items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        <span className="h-0 w-0 border-y-[5px] border-r-[4px] border-y-transparent border-r-[#1d2129]" />
        <span className="min-w-[57px] rounded-[4px] bg-[#1d2129] px-3 py-1 text-center font-['PingFang_SC'] text-[14px] font-normal leading-[22px] tracking-normal text-white whitespace-nowrap">
          {label}
        </span>
      </span>
    </button>
  );
}
