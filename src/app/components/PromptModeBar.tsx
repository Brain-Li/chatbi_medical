import { X } from 'lucide-react';
import askIcon from '../../assets/figma-home/chat-bubble-line.svg';
import askMutedIcon from '../../assets/figma-home/chat-bubble-line-muted.svg';
import reportIcon from '../../assets/figma-home/pie-chart-box-line.svg';
import reportSelectedIcon from '../../assets/figma-home/pie-chart-box-line-selected.svg';
import type { PromptMode } from '../utils/promptMode';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

const modeMeta: Record<
  PromptMode,
  { label: string; icon: string; selectedIcon: string }
> = {
  ask: {
    label: '问数',
    icon: askMutedIcon,
    selectedIcon: askIcon,
  },
  report: {
    label: '报告',
    icon: reportIcon,
    selectedIcon: reportSelectedIcon,
  },
};

export function PromptModeBar({
  onSelect,
  disabled = false,
  className = '',
}: {
  onSelect: (mode: PromptMode) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex min-h-8 min-w-0 items-center gap-[13px] ${className}`}
      role="group"
      aria-label="对话模式"
    >
      {(Object.keys(modeMeta) as PromptMode[]).map((mode) => {
        const item = modeMeta[mode];

        return (
          <button
            key={mode}
            type="button"
            onClick={() => onSelect(mode)}
            disabled={disabled}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-[#d4d6dc] bg-white px-3 py-[5px] text-[14px] font-normal leading-[22px] text-[#1d2129] transition-colors hover:border-[#bcd4ff] hover:bg-[#f9fbff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/25 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={`切换到${item.label}模式`}
          >
            <img src={item.icon} alt="" className="h-4 w-4" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function PromptModeHeader({
  mode,
  onExit,
  disabled = false,
  className = '',
}: {
  mode: PromptMode;
  onExit: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const item = modeMeta[mode];
  const exitLabel = disabled ? '生成中暂不可退出模式' : `退出${item.label}模式`;

  return (
    <div
      className={`flex h-10 items-center justify-between gap-4 border-b border-[#e5e6eb] bg-[#f5f8ff] px-4 ${className}`}
    >
      <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-[#e8f3ff] px-3 text-[14px] font-normal leading-[22px] text-[#165dff]">
        <img src={item.selectedIcon} alt="" className="h-4 w-4" />
        {item.label}模式
      </span>
      <Tooltip delayDuration={240}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onExit}
            disabled={disabled}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#86909c] transition-colors hover:bg-[#e8f3ff] hover:text-[#165dff] active:bg-[#dbeafe] focus-visible:bg-[#e8f3ff] focus-visible:text-[#165dff] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[#165dff]/20 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-[#86909c]"
            aria-label={exitLabel}
          >
            <X className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="center"
          sideOffset={8}
          showArrow={false}
          className="relative rounded-[4px] bg-[#1d2129] px-3 py-1 text-center font-['PingFang_SC'] text-[14px] font-normal leading-[22px] tracking-normal text-white whitespace-nowrap shadow-none"
        >
          {exitLabel}
          <span
            aria-hidden="true"
            className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-[5px] border-t-[4px] border-x-transparent border-t-[#1d2129]"
          />
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
