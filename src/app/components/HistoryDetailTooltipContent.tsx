import { TooltipContent } from './ui/tooltip';

type HistoryDetailTooltipContentProps = {
  title: string;
  workspaceName?: string;
  timestamp: string;
  status?: string;
  testId: string;
  sideOffset?: number;
  alignOffset?: number;
};

export function HistoryDetailTooltipContent({
  title,
  workspaceName,
  timestamp,
  status,
  testId,
  sideOffset = 20,
  alignOffset = 0,
}: HistoryDetailTooltipContentProps) {
  return (
    <TooltipContent
      data-testid={testId}
      side="right"
      align="start"
      sideOffset={sideOffset}
      alignOffset={alignOffset}
      collisionPadding={12}
      hideWhenDetached
      showArrow={false}
      className="w-[276px] max-w-[calc(100vw-24px)] max-h-[var(--radix-tooltip-content-available-height)] overflow-y-auto rounded-[14px] border-0 bg-[#2b2b2d] p-4 text-left font-normal text-[#c6c7ca] shadow-[0_8px_28px_rgba(0,0,0,0.16)] [overflow-wrap:anywhere] whitespace-normal text-wrap motion-reduce:animate-none max-sm:hidden"
    >
      <div className="text-sm font-medium leading-[22px] text-white">{title}</div>
      {workspaceName && <div className="mt-2 text-xs leading-[19px]">工作区 / {workspaceName}</div>}
      <div className="mt-2.5 text-xs leading-[19px]">{timestamp}</div>
      {status && (
        <div className="mt-2 flex items-center gap-2 text-xs leading-[19px]">
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${status === '进行中' ? 'bg-[#8ab4ff]' : status === '待确认' ? 'bg-[#f5c772]' : 'bg-[#bfc1c5]'}`}
          />
          {status}
        </div>
      )}
    </TooltipContent>
  );
}
