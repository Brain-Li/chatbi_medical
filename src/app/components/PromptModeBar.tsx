import { Sparkles } from 'lucide-react';

import barChartBoxIcon from '../../assets/figma-home/bar-chart-box-line.svg';
import reportIcon from '../../assets/figma-home/pie-chart-box-line.svg';
import type { PromptMode } from '../utils/promptMode';

export type PromptModeSelection = 'smart' | PromptMode;

const modeMeta: Record<PromptModeSelection, { label: string; icon?: string }> = {
  smart: {
    label: '智能',
  },
  ask: {
    label: '问数',
    icon: barChartBoxIcon,
  },
  report: {
    label: '报告',
    icon: reportIcon,
  },
};

export function PromptModeBar({
  onSelect,
  selectedMode = 'smart',
  disabled = false,
  className = '',
}: {
  onSelect: (mode: PromptModeSelection) => void;
  selectedMode?: PromptModeSelection;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex h-9 shrink-0 items-center rounded-full bg-[#eef0f3] p-0.5 ${className}`}
      role="radiogroup"
      aria-label="对话模式"
    >
      {(Object.keys(modeMeta) as PromptModeSelection[]).map((mode) => {
        const item = modeMeta[mode];
        const isSelected = selectedMode === mode;

        return (
          <button
            key={mode}
            type="button"
            onClick={() => onSelect(mode)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

              event.preventDefault();
              const buttons = Array.from(
                event.currentTarget.parentElement?.querySelectorAll('button') ?? [],
              );
              const currentIndex = buttons.indexOf(event.currentTarget);
              const direction = event.key === 'ArrowLeft' ? -1 : 1;
              const sibling = buttons[(currentIndex + direction + buttons.length) % buttons.length];
              if (!sibling) return;

              sibling.focus();
              sibling.click();
            }}
            disabled={disabled}
            tabIndex={isSelected ? 0 : -1}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-transparent px-3 text-[14px] leading-[22px] transition-[background-color,color,box-shadow] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/30 disabled:cursor-not-allowed disabled:opacity-50 ${
              isSelected
                ? 'bg-white font-medium text-[#1d2129] shadow-[0_1px_2px_rgba(15,23,42,0.08)]'
                : 'font-normal text-[#6b7280] hover:text-[#1d2129]'
            }`}
            role="radio"
            aria-label={`${item.label}模式`}
            aria-checked={isSelected}
          >
            {item.icon ? (
              <img src={item.icon} alt="" className="h-4 w-4" />
            ) : (
              <Sparkles aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
            )}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
