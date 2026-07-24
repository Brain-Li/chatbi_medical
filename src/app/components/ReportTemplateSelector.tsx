import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

import templateCardIcon from '../../assets/figma-home/case-template-icon.svg';
import templateBillIcon from '../../assets/figma-report-template/report-template-bill.svg';
import templateChevronIcon from '../../assets/figma-report-template/report-template-chevron-down.svg';
import templateSearchIcon from '../../assets/figma-report-template/report-template-search.svg';
import templateSelectedIcon from '../../assets/figma-report-template/report-template-selected.svg';
import type { ReportTemplate as LibraryReportTemplate } from '../types';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

type ReportTemplateOption = {
  id: string;
  name: string;
  selectorLabel: string;
  category: string;
  prompt: string;
};

const featuredTemplateIds = [
  'template-operation-daily',
  'template-dept-monthly',
  'template-pharmacy-structure',
];

const featuredTemplateLabels: Record<string, { name: string; selectorLabel: string }> = {
  'template-operation-daily': {
    name: '门诊经营日报',
    selectorLabel: '经营日报模板',
  },
  'template-dept-monthly': {
    name: '科室运营月报模板',
    selectorLabel: '科室运营月报模板',
  },
  'template-pharmacy-structure': {
    name: '药耗结构专题模板',
    selectorLabel: '药耗结构专题模板',
  },
};

function toTemplateOption(template: LibraryReportTemplate): ReportTemplateOption {
  const featuredLabels = featuredTemplateLabels[template.id];

  return {
    id: template.id,
    name: featuredLabels?.name ?? template.name,
    selectorLabel: featuredLabels?.selectorLabel ?? template.name,
    category: template.category,
    prompt: template.templatePrompt.trim() || template.description,
  };
}

type ReportTemplateSelectorProps = {
  templates: LibraryReportTemplate[];
  selectedId: string | null;
  onSelect: (template: ReportTemplateOption) => void;
  onClear: () => void;
};

export function ReportTemplateSelector({
  templates,
  selectedId,
  onSelect,
  onClear,
}: ReportTemplateSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [popupPosition, setPopupPosition] = useState({ left: 16, top: 16, maxHeight: 400 });
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN');
  const availableTemplates = useMemo(
    () => templates.filter((template) => template.status === 'published').map(toTemplateOption),
    [templates],
  );
  const selectedTemplate = availableTemplates.find((template) => template.id === selectedId);
  const visibleTemplates = useMemo(() => {
    if (!normalizedQuery) {
      return featuredTemplateIds
        .map((templateId) => availableTemplates.find((template) => template.id === templateId))
        .filter((template): template is ReportTemplateOption => Boolean(template));
    }

    return availableTemplates.filter((template) =>
      template.name.toLocaleLowerCase('zh-CN').includes(normalizedQuery),
    );
  }, [availableTemplates, normalizedQuery]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popupRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;

    const updatePopupPosition = () => {
      const button = buttonRef.current;
      if (!button) return;

      const margin = 16;
      const gap = 8;
      const buttonRect = button.getBoundingClientRect();
      const popupWidth = popupRef.current?.getBoundingClientRect().width
        ?? Math.min(400, window.innerWidth - margin * 2);
      const popupHeight = Math.min(
        popupRef.current?.getBoundingClientRect().height ?? 400,
        400,
      );
      const availableBelow = window.innerHeight - margin - buttonRect.bottom - gap;
      const availableAbove = buttonRect.top - margin - gap;
      const placeBelow = availableBelow >= popupHeight || availableBelow >= availableAbove;
      const availableHeight = placeBelow ? availableBelow : availableAbove;
      const maxHeight = Math.min(400, Math.max(0, availableHeight));
      const renderedHeight = Math.min(popupHeight, maxHeight);
      const maxLeft = Math.max(margin, window.innerWidth - margin - popupWidth);

      setPopupPosition({
        left: Math.min(Math.max(margin, buttonRect.left), maxLeft),
        top: placeBelow
          ? buttonRect.bottom + gap
          : Math.max(margin, buttonRect.top - gap - renderedHeight),
        maxHeight,
      });
    };

    updatePopupPosition();
    const resizeObserver = new ResizeObserver(updatePopupPosition);
    if (popupRef.current) resizeObserver.observe(popupRef.current);
    window.addEventListener('resize', updatePopupPosition);
    window.addEventListener('scroll', updatePopupPosition, true);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updatePopupPosition);
      window.removeEventListener('scroll', updatePopupPosition, true);
    };
  }, [open]);

  const toggleOpen = () => {
    setOpen((current) => {
      const next = !current;
      if (next) window.setTimeout(() => searchRef.current?.focus(), 0);
      return next;
    });
  };

  const clearSelection = () => {
    setOpen(false);
    setQuery('');
    onClear();
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      {selectedTemplate ? (
        <div
          className="flex h-8 max-w-[240px] items-center overflow-hidden rounded-lg border border-[#e5e6eb] bg-white text-[#1d2129] transition-colors hover:border-[#c9cdd4]"
        >
          <button
            ref={buttonRef}
            type="button"
            onClick={toggleOpen}
            aria-expanded={open}
            aria-controls={listboxId}
            aria-haspopup="listbox"
            aria-label={`更换模板：${selectedTemplate.selectorLabel}`}
            title={selectedTemplate.selectorLabel}
            className="flex h-full min-w-0 items-center gap-1 pl-[13px] pr-1 text-[14px] font-normal leading-[22px] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#165dff]/25"
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
              <img className="h-[13.333px] w-3" src={templateBillIcon} alt="" />
            </span>
            <span className="truncate">{selectedTemplate.selectorLabel}</span>
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#86909c] transition-colors hover:bg-[#f7f8fa] hover:text-[#4e5969] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[#165dff]/40"
            aria-label={`移除${selectedTemplate.selectorLabel}`}
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        </div>
      ) : (
        <button
          ref={buttonRef}
          type="button"
          onClick={toggleOpen}
          aria-expanded={open}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          className="flex h-8 items-center gap-1 rounded-lg border border-[#e5e6eb] bg-white px-[13px] text-[14px] font-normal leading-[22px] text-[#1d2129] outline-none transition-colors hover:border-[#c9cdd4] focus-visible:border-[#165dff] focus-visible:ring-2 focus-visible:ring-[#165dff]/15"
        >
          <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
            <img className="h-[13.333px] w-3" src={templateBillIcon} alt="" />
          </span>
          <span className="whitespace-nowrap">模板</span>
          <span className="flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
            <img className="h-[5.185px] w-[8.485px]" src={templateChevronIcon} alt="" />
          </span>
        </button>
      )}

      {open && createPortal(
        <div
          ref={popupRef}
          style={popupPosition}
          className="fixed z-[100] flex w-[min(400px,calc(100vw-32px))] flex-col gap-3 rounded-2xl border-[1.5px] border-[#edeff1] bg-white p-[13.5px] shadow-[0_14px_14.1px_rgba(0,0,0,0.11)]"
        >
          <label className="mr-2 flex h-10 shrink-0 items-center gap-2 rounded-xl border border-[#e5e6eb] bg-white px-[17px] focus-within:border-[#165dff]">
            <img className="h-4 w-4 shrink-0" src={templateSearchIcon} alt="" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索模板名称"
              aria-label="搜索模板名称"
              className="min-w-0 flex-1 bg-transparent text-[14px] leading-[22px] text-[#1d2129] outline-none placeholder:text-[#86909c]"
            />
          </label>

          <div
            id={listboxId}
            role="listbox"
            aria-label="报告模板"
            className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-2 [scrollbar-color:rgba(229,230,235,0.5)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-2xl [&::-webkit-scrollbar-thumb]:bg-[#e5e6eb]/50 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-3"
          >
            {visibleTemplates.map((template) => {
              const selected = template.id === selectedId;

              return (
                <Tooltip key={template.id} delayDuration={240}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        onSelect(template);
                        setOpen(false);
                        setQuery('');
                      }}
                      className="flex w-full flex-col items-start rounded-xl border border-[#e5e6eb] bg-white p-4 text-left transition-colors hover:bg-[#f7f8fa] focus-visible:bg-[#f7f8fa] focus-visible:outline-none"
                    >
                      <span className="flex w-full items-center justify-between">
                        <span className="flex min-w-0 items-center gap-2">
                          <img className="h-6 w-6 shrink-0" src={templateCardIcon} alt="" />
                          <span className="truncate text-[16px] font-medium leading-6 text-[#1d2129]">
                            {template.name}
                          </span>
                          <span className="shrink-0 rounded-lg bg-[#e8f3ff] px-2 py-1 text-[14px] font-normal leading-[22px] text-[#165dff]">
                            {template.category}
                          </span>
                        </span>
                        {selected && (
                          <img className="h-4 w-4 shrink-0" src={templateSelectedIcon} alt="已选择" />
                        )}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    align="start"
                    sideOffset={8}
                    arrowClassName="bg-[#1d2129] fill-[#1d2129]"
                    className="z-[120] max-h-64 max-w-[420px] overflow-y-auto whitespace-pre-wrap rounded-[4px] bg-[#1d2129] px-3 py-2 text-left text-[12px] font-normal leading-5 text-white shadow-[0_6px_16px_rgba(29,33,41,0.16)]"
                  >
                    <div className="whitespace-pre-wrap">{template.prompt}</div>
                  </TooltipContent>
                </Tooltip>
              );
            })}

            {visibleTemplates.length === 0 && (
              <div className="flex h-full min-h-[120px] items-center justify-center text-[14px] leading-[22px] text-[#86909c]">
                未找到相关模板
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
