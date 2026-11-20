import { useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { useSessionDraft } from '../license/hooks';
import { llmConnections } from '../mockData';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuSub, DropdownMenuSubContent,
  DropdownMenuSubTrigger, DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useIsMobile } from './ui/use-mobile';

const reasoningLevels = ['Low', 'Medium', 'High'] as const;

export function HomeModelSelector() {
  const [selectedModelId, setSelectedModelId] = useSessionDraft('home.modelId', String(llmConnections[0].id));
  const [reasoningLevel, setReasoningLevel] = useSessionDraft('home.reasoningLevel', 'High');
  const [teamEnabled, setTeamEnabled] = useSessionDraft('home.teamEnabled', false);
  const [panel, setPanel] = useState<'model' | 'reasoning' | null>(null);
  const isMobile = useIsMobile();
  const selectedModel = llmConnections.find((model) => String(model.id) === selectedModelId) ?? llmConnections[0];
  const rowClassName = 'min-h-10 gap-2 rounded-lg px-2.5 py-2 text-sm text-[#1d2129] focus:bg-[#f2f3f5] focus:text-[#1d2129] data-[state=open]:bg-[#f2f3f5] data-[state=open]:text-[#1d2129]';
  const modelOptions = (
    <DropdownMenuRadioGroup value={String(selectedModel.id)} onValueChange={setSelectedModelId}>
      {llmConnections.map((model) => (
        <DropdownMenuRadioItem key={model.id} value={String(model.id)} className="min-h-11 rounded-lg text-[#4e5969] focus:bg-[#f2f3f5] focus:text-[#1d2129]">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm">{model.modelName}</span>
            <span className="text-xs leading-5 text-[#86909c]">{model.description}</span>
          </span>
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
  const reasoningOptions = (
    <DropdownMenuRadioGroup value={reasoningLevel} onValueChange={setReasoningLevel}>
      {reasoningLevels.map((level) => (
        <DropdownMenuRadioItem key={level} value={level} className="min-h-9 rounded-lg text-[#4e5969] focus:bg-[#f2f3f5] focus:text-[#1d2129]">{level}</DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );

  return (
    <DropdownMenu onOpenChange={(open) => { if (!open) setPanel(null); }}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`模型选项，当前为 ${selectedModel.modelName}，推理等级 ${reasoningLevel}`}
          title={`${selectedModel.modelName} ${reasoningLevel}`}
          className="group inline-flex h-8 min-w-0 max-w-[160px] items-center gap-1.5 rounded-lg px-2 text-[13px] text-[#6b7280] transition-colors hover:bg-[#f2f3f5] data-[state=open]:bg-[#f2f3f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/25 sm:max-w-[240px] sm:text-sm"
        >
          <span className="truncate">{selectedModel.modelName}</span>
          <span className="shrink-0 text-[#9ca3af]">{reasoningLevel}</span>
          <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#9ca3af] transition-transform group-data-[state=open]:rotate-180" strokeWidth={1.8} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" sideOffset={8} collisionPadding={12} className="w-[280px] max-w-[calc(100vw-1.5rem)] rounded-[14px] border-[#e5e6eb] bg-white p-1.5 shadow-[0_8px_28px_rgba(29,33,41,0.10)]">
        {isMobile && panel ? (
          <>
            <DropdownMenuItem onSelect={(event) => { event.preventDefault(); setPanel(null); }} className={rowClassName}>
              <ChevronLeft aria-hidden="true" className="size-4 text-[#86909c]" />
              {panel === 'model' ? '模型' : '推理等级'}
            </DropdownMenuItem>
            {panel === 'model' ? modelOptions : reasoningOptions}
          </>
        ) : <>
        {isMobile ? (
          <>
            <DropdownMenuItem onSelect={(event) => { event.preventDefault(); setPanel('model'); }} className={rowClassName}>
              <span>模型</span><span className="ml-auto truncate text-[#86909c]">{selectedModel.modelName}</span><ChevronRight aria-hidden="true" className="size-4 text-[#86909c]" />
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={(event) => { event.preventDefault(); setPanel('reasoning'); }} className={rowClassName}>
              <span>推理等级</span><span className="ml-auto text-[#86909c]">{reasoningLevel}</span><ChevronRight aria-hidden="true" className="size-4 text-[#86909c]" />
            </DropdownMenuItem>
          </>
        ) : <>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={rowClassName}>
            <span className="shrink-0">模型</span>
            <span className="ml-auto min-w-0 truncate text-[#86909c]">{selectedModel.modelName}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent collisionPadding={12} className="w-[240px] max-w-[calc(100vw-1.5rem)] rounded-xl border-[#e5e6eb] bg-white p-1.5">
            {modelOptions}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={rowClassName}>
            <span>推理等级</span>
            <span className="ml-auto text-[#86909c]">{reasoningLevel}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent collisionPadding={12} className="w-[144px] rounded-xl border-[#e5e6eb] bg-white p-1.5">
            {reasoningOptions}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        </>}
        <DropdownMenuItem
          role="menuitemcheckbox"
          aria-checked={teamEnabled}
          onSelect={(event) => { event.preventDefault(); setTeamEnabled(!teamEnabled); }}
          className={rowClassName}
        >
          <span>启用智能体团队协作</span>
          <span title="允许多个智能体协作处理任务" aria-label="允许多个智能体协作处理任务">
            <Info aria-hidden="true" className="size-3.5 text-[#a8adb5]" strokeWidth={1.7} />
          </span>
          <span aria-hidden="true" className={`ml-auto inline-flex h-[22px] w-10 shrink-0 items-center rounded-full p-[3px] transition-colors ${teamEnabled ? 'bg-[#165dff]' : 'bg-[#dcdee1]'}`}>
            <span className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${teamEnabled ? 'translate-x-[18px]' : 'translate-x-0'}`} />
          </span>
        </DropdownMenuItem>
        </>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
