import barChartBoxIcon from '../../assets/figma-home/bar-chart-box-line.svg';
import barChartBoxSelectedIcon from '../../assets/figma-home/bar-chart-box-line-selected.svg';
import reportIcon from '../../assets/figma-home/pie-chart-box-line.svg';
import reportSelectedIcon from '../../assets/figma-home/pie-chart-box-line-selected.svg';
import type { PromptMode } from '../utils/promptMode';

const modeMeta: Record<
  PromptMode,
  { label: string; icon: string; selectedButtonIcon: string }
> = {
  ask: {
    label: '问数',
    icon: barChartBoxIcon,
    selectedButtonIcon: barChartBoxSelectedIcon,
  },
  report: {
    label: '报告',
    icon: reportIcon,
    selectedButtonIcon: reportSelectedIcon,
  },
};

export function PromptModeBar({
  onSelect,
  selectedMode = null,
  disabled = false,
  className = '',
}: {
  onSelect: (mode: PromptMode) => void;
  selectedMode?: PromptMode | null;
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
        const isSelected = selectedMode === mode;

        return (
          <button
            key={mode}
            type="button"
            onClick={() => onSelect(mode)}
            disabled={disabled}
            className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-[#d4d6dc] px-3 py-[5px] text-[14px] font-normal leading-[22px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/25 disabled:cursor-not-allowed disabled:opacity-50 ${
              isSelected
                ? 'bg-[#e8f3ff] text-[#165dff]'
                : 'bg-white text-[#1d2129] hover:border-[#bcd4ff] hover:bg-[#f9fbff]'
            }`}
            aria-label={isSelected ? `取消${item.label}模式` : `切换到${item.label}模式`}
            aria-pressed={isSelected}
          >
            <img
              src={isSelected ? item.selectedButtonIcon : item.icon}
              alt=""
              className="h-4 w-4"
            />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
