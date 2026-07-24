import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  ChartArea,
  ChartColumnStacked,
  ChartNoAxesCombined,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleX,
  Database,
  Download,
  FileText,
  FileSearch,
  LineChart as LineChartIcon,
  Loader2,
  PieChart as PieChartIcon,
  RefreshCw,
  Search,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Wrench,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { AgentRoutingTrace, AgentRuntimeConfig, AnalysisCandidateOption, AnalysisProcessData, AnalysisProcessStep, DatasetAnalysisResult, DeepAnalysisActivityId, Message, RootCauseResultData, SkillTrace } from '../types';
import { useWorkspace } from '../context/WorkspaceContext';
import { summarizeReportTopic } from '../utils/reportTopic';
import { ReportSubscriptionDialog } from './ReportSubscriptionDialog';
import {
  Tooltip as AppTooltip,
  TooltipContent,
  TooltipTrigger,
} from './ui/tooltip';
import arrowUpSLineIcon from '../../assets/figma-ask/arrow-up-s-line.svg';
import checkFillIcon from '../../assets/figma-ask/check-fill.svg';
import copyLineIcon from '../../assets/figma-ask/file-copy-line.svg';
import loadingLightIcon from '../../assets/figma-ask/loading-light.svg';
import refreshLineIcon from '../../assets/figma-ask/refresh-line.svg';

const chartColors = ['#2563eb', '#60a5fa', '#93c5fd', '#bfdbfe'];
type AnalysisProcessVariant = 'timeline' | 'workspace';
type BaseChartType = 'bar' | 'line' | 'pie';
type FigmaStepState = 'done' | 'active' | 'pending' | 'stopped' | 'waiting' | 'needs-input';

function isInterruptedQueryOutcome(scenarioCode: AnalysisProcessData['scenarioCode']) {
  return scenarioCode === 'sql-execution-failed'
    || scenarioCode === 'query-timeout';
}

const baseChartTypes: Array<{
  value: BaseChartType | 'stacked-bar' | 'stacked-area' | 'combo';
  label: string;
  icon: typeof BarChart3;
  disabled?: boolean;
}> = [
  { value: 'bar', label: '柱图', icon: BarChart3 },
  { value: 'line', label: '线图', icon: LineChartIcon },
  { value: 'pie', label: '饼图', icon: PieChartIcon },
  { value: 'stacked-bar', label: '堆叠柱状图', icon: ChartColumnStacked, disabled: true },
  { value: 'stacked-area', label: '堆叠面积图', icon: ChartArea, disabled: true },
  { value: 'combo', label: '柱折混合图', icon: ChartNoAxesCombined, disabled: true },
];

const defaultRuntimeConfig: AgentRuntimeConfig = {
  showSql: true,
  showQueryBasis: true,
  showDataSource: true,
  showConfidence: true,
  allowDetailView: true,
  allowExport: true,
  allowCrossDataset: false,
  permissionGroup: '经营分析组',
  desensitizeSensitiveData: true,
};

function getRuntimeConfig(message: Message) {
  return message.runtimeConfig ?? defaultRuntimeConfig;
}

function SingleSkillScopeNote({ visible }: { visible?: boolean }) {
  if (!visible) return null;

  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm leading-6 text-amber-900">
      本次仅基于该 Skill 视角生成，用于局部复核；如需完整结论，请结合综合分析结果。
    </div>
  );
}

function ClarificationCard({
  message,
  onClarificationSelect,
}: {
  message: Message;
  onClarificationSelect?: (question: string, agentId: string) => void;
}) {
  const options = message.clarificationOptions ?? [];
  const question = message.originalQuestion ?? '';

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="text-sm font-medium text-amber-900">
        {message.content || '请确认本次分析的范围。'}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.agentId}
            onClick={() => onClarificationSelect?.(question, option.agentId)}
            className="rounded-full border border-amber-200 bg-white px-4 py-2 text-sm text-amber-900 hover:border-amber-300 hover:bg-amber-50"
          >
            {option.label}
          </button>
        ))}
      </div>
      {options.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {options.map((option) => (
            <span
              key={`${option.agentId}-reason`}
              className="rounded-full bg-white/70 px-3 py-1 text-xs text-amber-800"
            >
              {option.label}：{option.reason}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function AssistantTextReply({
  message,
  onCandidateSelect,
}: {
  message: Message;
  onCandidateSelect?: (option: AnalysisCandidateOption) => void;
}) {
  const options = message.analysisClarification?.options ?? [];
  const selectedId = message.selectedAnalysisCandidateId;

  return (
    <div className="space-y-3 px-4 py-1" data-testid={`assistant-text-reply-${message.id}`}>
      <p className="whitespace-pre-wrap break-words text-base leading-6 text-[#1d2129]">
        {message.content}
      </p>
      {options.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {options.map((option) => {
            const isSelected = selectedId === option.id;
            const isDisabled = Boolean(selectedId);

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onCandidateSelect?.(option)}
                disabled={isDisabled}
                aria-pressed={isSelected}
                className={`h-[76px] rounded-[8px] border bg-white px-3.5 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/25 ${
                  isSelected
                    ? 'border-[#165dff] bg-[#f7fbff]'
                    : isDisabled
                      ? 'cursor-default border-[#e5e6eb] opacity-60'
                      : 'border-[#c9cdd4] hover:border-[#165dff] hover:bg-[#f7fbff]'
                }`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-sm font-medium leading-[22px] text-[#1d2129]">
                      {option.label}
                    </span>
                    {option.businessTopic ? (
                      <>
                        <span className="shrink-0 text-xs text-[#c9cdd4]">·</span>
                        <span className="shrink-0 text-xs text-[#4e5969]">
                          {option.businessTopic}
                        </span>
                      </>
                    ) : null}
                  </span>
                  {isSelected ? (
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#165dff] text-white"
                      aria-label="已选择"
                    >
                      <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block truncate text-xs leading-5 text-[#86909c]">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function SkillTraceRow({
  skillTrace,
  onRerunSkill,
}: {
  skillTrace?: SkillTrace[];
  onRerunSkill?: (skillId: string) => void;
}) {
  if (!skillTrace?.length) return null;

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
        <Sparkles className="h-4 w-4 text-blue-500" />
        本次使用的 Skills
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {skillTrace.map((skill) => (
          <div
            key={skill.id}
            className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-600"
          >
            <span className="font-medium text-gray-800">{skill.name}</span>
            <span className="ml-2 text-gray-500">{skill.reason}</span>
            {onRerunSkill && (
              <button
                onClick={() => onRerunSkill(skill.id)}
                className="ml-3 inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                按此 Skill 复核
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function getTimelineStepState(
  status: AnalysisProcessData['status'],
  index: number,
  visibleStepCount: number,
): 'done' | 'active' | 'pending' | 'stopped' {
  if (status === 'completed') return 'done';
  if (status === 'interrupted') return index < visibleStepCount - 1 ? 'done' : 'stopped';
  if (index < visibleStepCount - 1) return 'done';
  if (index === visibleStepCount - 1) return 'active';
  return 'pending';
}

function FeedbackTooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <AppTooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={6}
        className="border-0 bg-[#1d2129] px-2 py-1 text-xs font-medium text-white shadow-[0_6px_16px_rgba(15,23,42,0.18)]"
      >
        {label}
      </TooltipContent>
    </AppTooltip>
  );
}

function getAnalysisProcessTitle(status: AnalysisProcessData['status']) {
  if (status === 'running') return '正在分析';
  if (status === 'interrupted') return '分析中断';
  return '分析完成';
}

function getMessageAnalysisTitle(message: Message) {
  if (message.isGenerating) {
    return '正在分析';
  }

  if (message.isInterrupted) {
    return '分析中断';
  }

  return '分析完成';
}

function AnalysisTimelineStep({
  index,
  title,
  badge,
  children,
  state,
  isLast,
}: {
  index: number;
  title: string;
  badge?: string;
  children: ReactNode;
  state: 'done' | 'active' | 'pending' | 'stopped';
  isLast?: boolean;
}) {
  const isDone = state === 'done';
  const isActive = state === 'active';
  const isStopped = state === 'stopped';

  return (
    <div className="relative grid grid-cols-[24px_1fr] gap-3 pb-5 last:pb-0">
      {!isLast && (
        <div className="absolute left-3 top-7 h-[calc(100%-1.75rem)] w-px bg-gray-200" />
      )}
      <div
        className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold ${
          isDone
            ? 'border-blue-200 bg-blue-50 text-blue-600'
            : isActive
              ? 'border-blue-500 bg-white text-blue-600 shadow-[0_0_0_3px_rgba(37,99,235,0.08)]'
              : isStopped
                ? 'border-amber-200 bg-amber-50 text-amber-700'
                : 'border-gray-200 bg-white text-gray-400'
        }`}
      >
        {isDone ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : isActive ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : isStopped ? (
          <AlertTriangle className="h-3.5 w-3.5" />
        ) : (
          index + 1
        )}
      </div>
      <div className="min-w-0">
        <div className={`text-[13px] font-semibold leading-5 ${
          isActive ? 'text-blue-700' : isStopped ? 'text-amber-700' : 'text-gray-800'
        }`}>
          {title}
          {badge ? (
            <span className="ml-2 inline-flex max-w-full align-middle rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[12px] font-medium leading-4 text-blue-700">
              {badge}
            </span>
          ) : null}
        </div>
        {children ? <div className="mt-2.5">{children}</div> : null}
      </div>
    </div>
  );
}

function ProcessInfoCard({
  label,
  value,
  highlighted,
}: {
  label: string;
  value: ReactNode;
  highlighted?: boolean;
}) {
  return (
    <div className={`rounded-md border bg-white px-3 py-2.5 ${
      highlighted ? 'border-blue-200' : 'border-gray-200'
    }`}>
      <div className={highlighted ? 'text-[11px] leading-4 text-blue-700' : 'text-[11px] leading-4 text-gray-500'}>{label}</div>
      <div className="mt-1 text-[13px] font-medium leading-5 text-gray-900">{value}</div>
    </div>
  );
}

function SqlPreviewCard({ sql }: { sql: string }) {
  return (
    <div className="overflow-hidden rounded-md border border-gray-200 bg-slate-50/60">
      {sql ? (
        <pre className="max-h-52 overflow-x-auto overflow-y-auto p-3.5 text-[11px] leading-5 text-slate-700">
          {sql}
        </pre>
      ) : (
        <div className="px-4 py-3 text-sm text-gray-500">本次暂未生成 SQL 预览。</div>
      )}
    </div>
  );
}

function ChartLoadingDots() {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
        <span className="h-2 w-2 rounded-full bg-blue-300 animate-pulse" />
        <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse [animation-delay:160ms]" />
        <span className="h-2 w-2 rounded-full bg-blue-700 animate-pulse [animation-delay:320ms]" />
      </div>
    </div>
  );
}

function MarkdownPreview({ content }: { content: string }) {
  const lines = content.split('\n');

  return (
    <div className="space-y-3 text-sm leading-7 text-gray-700">
      {lines.map((line, index) => {
        const key = `${index}-${line}`;
        const trimmed = line.trim();

        if (!trimmed) {
          return <div key={key} className="h-1" />;
        }

        if (trimmed.startsWith('# ')) {
          return (
            <h1 key={key} className="text-2xl font-semibold leading-9 text-gray-900">
              {trimmed.slice(2)}
            </h1>
          );
        }

        if (trimmed.startsWith('## ')) {
          return (
            <h2 key={key} className="border-b border-gray-100 pb-2 pt-3 text-lg font-semibold leading-7 text-gray-900">
              {trimmed.slice(3)}
            </h2>
          );
        }

        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={key} className="pt-2 text-base font-semibold leading-6 text-gray-900">
              {trimmed.slice(4)}
            </h3>
          );
        }

        if (trimmed.startsWith('> ')) {
          return (
            <blockquote key={key} className="border-l-4 border-blue-200 bg-blue-50/60 px-4 py-2 text-gray-600">
              {trimmed.slice(2)}
            </blockquote>
          );
        }

        if (trimmed.startsWith('- ')) {
          return (
            <div key={key} className="flex gap-2">
              <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
              <span>{trimmed.slice(2)}</span>
            </div>
          );
        }

        return <p key={key}>{trimmed}</p>;
      })}
    </div>
  );
}

function MarkdownArtifactCard({
  fileName,
  content,
}: {
  fileName: string;
  content: string;
}) {
  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleDownload}
      className="inline-flex w-fit items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:bg-gray-50"
    >
      <Download className="h-4 w-4" />
      下载 Markdown 文件
    </button>
  );
}

function FigmaStepIcon({
  index,
  state,
}: {
  index: number;
  state: FigmaStepState;
}) {
  const isDone = state === 'done';
  const isActive = state === 'active';
  const isWaiting = state === 'waiting';
  const needsInput = state === 'needs-input';
  const isUnfinished = state === 'stopped' || isWaiting || needsInput;

  return (
    <span
      className={`relative z-10 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${
        isDone
          ? 'border-[#165dff] bg-[#e8f3ff]'
          : isActive
            ? 'border-transparent bg-transparent shadow-none'
            : isUnfinished
              ? 'border-red-300 bg-red-50 text-red-600'
              : 'border-[#c9cdd4] bg-white text-[#86909c]'
      }`}
    >
      {isDone ? <img alt="" src={checkFillIcon} className="h-[10.667px] w-[10.667px]" /> : null}
      {isActive ? (
        <span className="h-4 w-4 shrink-0 rounded-full border border-[#165dff] border-r-[#e8f3ff] animate-spin motion-reduce:animate-none" />
      ) : null}
      {isUnfinished ? <X className="h-[10.667px] w-[10.667px]" strokeWidth={2.5} /> : null}
      {state === 'pending' ? index + 1 : null}
    </span>
  );
}

function FigmaTimelineStep({
  index,
  title,
  children,
  state,
  isLast,
}: {
  index: number;
  title: string;
  children: ReactNode;
  state: FigmaStepState;
  isLast?: boolean;
}) {
  return (
    <div className="relative grid grid-cols-[24px_1fr] gap-2 pb-4 last:pb-0">
      {!isLast ? (
        <div className="absolute left-3 top-[19px] h-[calc(100%-19px)] w-px bg-[#e5e6eb]" />
      ) : null}
      <div className="flex h-6 items-center justify-center">
        <FigmaStepIcon index={index} state={state} />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium leading-[22px] text-[#1d2129]">{title}</div>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}

function FigmaInfoCard({
  label,
  value,
  highlighted,
}: {
  label: string;
  value: ReactNode;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`min-h-[72px] rounded-[8px] border p-4 ${
        highlighted ? 'border-[#94bfff] bg-[#f7fbff]' : 'border-[#e5e6eb] bg-white'
      }`}
    >
      <div className={highlighted ? 'text-sm leading-[14px] text-[#165dff]' : 'text-sm leading-[14px] tracking-[0.175px] text-[#4e5969]'}>
        {label}
      </div>
      <div className="mt-2 text-xl font-medium leading-7 text-[#1d2129]">{value}</div>
    </div>
  );
}

function FigmaChip({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'skill' | 'mcp';
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex min-h-[26px] max-w-full items-center rounded px-2 text-sm leading-[22px] whitespace-normal break-words ${
        tone === 'skill'
          ? 'bg-[#f2f3f5] text-[#4e5969]'
          : tone === 'mcp'
            ? 'bg-[#e8f3ff] text-[#165dff]'
            : 'bg-[#f7f8fa] text-[#1d2129]'
      }`}
    >
      {children}
    </span>
  );
}

function FigmaAnalysisProcessContent({
  processData,
  routingTrace,
}: {
  processData: AnalysisProcessData;
  routingTrace?: AgentRoutingTrace;
}) {
  const metrics = processData.metrics.slice(0, 3);
  const dimensions = processData.dimensions.slice(0, 3);
  const matchedMcpNames = Array.from(
    new Set((processData.mcpMatches ?? []).map((capability) => capability.serverName).filter(Boolean)),
  );
  const questionUnderstanding = [
    `用户想分析“${processData.question}”背后的业务原因`,
    metrics.length ? `需要围绕${metrics.join('、')}` : '',
    dimensions.length ? `按${dimensions.join('、')}拆解变化` : '',
    processData.timeRange ? `时间范围锁定为${processData.timeRange}` : '',
    '并结合知识依据与取数结果判断主要驱动因素',
  ].filter(Boolean).join('，') + '。';
  const [isSqlCopied, setIsSqlCopied] = useState(false);
  const sqlCopyFeedbackTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (sqlCopyFeedbackTimerRef.current) {
      window.clearTimeout(sqlCopyFeedbackTimerRef.current);
    }
  }, []);

  const handleCopySql = () => {
    if (!processData.sql || !navigator.clipboard) return;

    void navigator.clipboard.writeText(processData.sql);
    setIsSqlCopied(true);
    if (sqlCopyFeedbackTimerRef.current) {
      window.clearTimeout(sqlCopyFeedbackTimerRef.current);
    }
    sqlCopyFeedbackTimerRef.current = window.setTimeout(() => setIsSqlCopied(false), 1600);
  };
  const legacyStepDefinitions: Array<Pick<AnalysisProcessStep, 'id' | 'title'>> = [
    { id: 'understand-question', title: '理解用户问题' },
    { id: 'resolve-data-scope', title: '确定数据口径' },
    { id: 'match-capability', title: '匹配分析能力' },
    { id: 'retrieve-knowledge', title: '检索知识依据' },
    { id: 'generate-query', title: '执行查询语句' },
    { id: 'execute-query', title: '执行数据查询' },
  ];
  const visibleStepCount = Math.min(
    Math.max(processData.visibleStepCount ?? (processData.status === 'completed' ? 6 : 1), 1),
    6,
  );
  const processSteps = (processData.steps ?? legacyStepDefinitions
    .slice(0, visibleStepCount)
    .map((step, index, visibleSteps): AnalysisProcessStep => ({
      ...step,
      status:
        processData.status === 'completed'
          ? 'completed'
          : processData.status === 'interrupted' && index === visibleSteps.length - 1
            ? 'interrupted'
            : index === visibleSteps.length - 1
              ? 'running'
              : 'completed',
    })))
    .map((step) => step.id === 'generate-query'
      ? {
          ...step,
          title: '执行查询语句',
          status: processData.scenarioCode === 'empty-result'
            ? 'completed'
            : isInterruptedQueryOutcome(processData.scenarioCode)
              ? 'failed'
              : step.status,
        }
      : step)
    .filter((step) => step.id !== 'execute-query');

  const renderStepContent = (step: AnalysisProcessStep) => {
    if (step.status === 'needs-input' && step.detail) {
      return <p className="text-sm leading-[22px] text-[#4e5969]">{step.detail}</p>;
    }

    const isBlocked = step.status === 'failed' || step.status === 'interrupted';
    if (isBlocked && step.detail) {
      return <p className="text-sm leading-[22px] text-[#4e5969]">{step.detail}</p>;
    }

    if (step.id === 'understand-question') {
      if (step.detail) {
        return <p className="text-sm leading-[22px] text-[#4e5969]">{step.detail}</p>;
      }

      return <p className="text-sm leading-[22px] text-[#4e5969]">{questionUnderstanding}</p>;
    }

    if (step.id === 'resolve-data-scope') {
      return (
        <div>
          {step.detail ? <p className="text-sm leading-[22px] text-[#4e5969]">{step.detail}</p> : null}
          <div className={`${step.detail ? 'mt-2 ' : ''}flex flex-wrap items-center gap-x-4 gap-y-2 text-sm leading-[22px]`}>
            <span className="inline-flex items-center gap-2"><span className="text-[#4e5969]">数据集</span><FigmaChip>{processData.datasetName || '暂未匹配'}</FigmaChip></span>
            <span className="inline-flex items-center gap-2"><span className="text-[#4e5969]">指标</span><FigmaChip>{metrics.join('、') || '待确认'}</FigmaChip></span>
            <span className="inline-flex items-center gap-2"><span className="text-[#4e5969]">维度</span><FigmaChip>{dimensions.join('、') || '默认维度'}</FigmaChip></span>
            {processData.timeRange ? <span className="inline-flex items-center gap-2"><span className="text-[#4e5969]">时间范围</span><FigmaChip>{processData.timeRange}</FigmaChip></span> : null}
          </div>
        </div>
      );
    }

    if (step.id === 'match-capability') {
      return (
        <div className="flex flex-wrap items-center gap-2">
          {processData.skillMatches.map((skill) => <FigmaChip key={skill.id} tone="skill">Skill：{skill.name}</FigmaChip>)}
          {matchedMcpNames.map((name) => <FigmaChip key={name} tone="mcp">MCP：{name}</FigmaChip>)}
          {!routingTrace?.agentName && !processData.skillMatches.length && !matchedMcpNames.length ? <FigmaChip>本次未匹配可用能力</FigmaChip> : null}
        </div>
      );
    }

    if (step.id === 'retrieve-knowledge') {
      return (
        <div className="flex flex-wrap items-center gap-2">
          {processData.knowledgeHits.length
            ? processData.knowledgeHits.slice(0, 3).map((hit) => <FigmaChip key={hit.id}>{hit.documentTitle}</FigmaChip>)
            : <FigmaChip>{step.detail || '本次未引用知识依据'}</FigmaChip>}
        </div>
      );
    }

    const canShowSql = Boolean(processData.sql);
    if (!canShowSql) {
      return (
        <div className="rounded-[8px] border border-[#e5e6eb] bg-[#f7f8fa] px-3 py-2.5 text-sm leading-[22px] text-[#4e5969]">
          {step.detail || (step.status === 'completed' ? '查询语句已生成。' : '暂未生成查询语句。')}
        </div>
      );
    }

    return (
      <div className="relative max-h-[366px] rounded-[8px] border border-[#e5e6eb] bg-[#f7f8fa] py-2">
        <AppTooltip delayDuration={240}>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={`absolute right-4 top-3.5 inline-flex h-7 items-center justify-center gap-1 rounded-md text-xs transition-colors ${isSqlCopied ? 'bg-emerald-50 px-2 text-emerald-700' : 'w-7 text-[#86909c] hover:bg-white hover:text-[#4e5969]'}`}
              onClick={handleCopySql}
              aria-label={isSqlCopied ? 'SQL 已复制' : '复制 SQL'}
            >
              {isSqlCopied ? <><CheckCircle2 className="h-4 w-4" /><span>已复制</span></> : <img alt="" src={copyLineIcon} className="h-4 w-4" />}
            </button>
          </TooltipTrigger>
          {!isSqlCopied ? (
            <TooltipContent
              side="top"
              align="center"
              sideOffset={8}
              showArrow={false}
              className="relative rounded-[4px] bg-[#1d2129] px-3 py-1 text-center font-['PingFang_SC'] text-[14px] font-normal leading-[22px] tracking-normal text-white whitespace-nowrap shadow-none"
            >
              复制 SQL
              <span
                aria-hidden="true"
                className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-[5px] border-t-[4px] border-x-transparent border-t-[#1d2129]"
              />
            </TooltipContent>
          ) : null}
        </AppTooltip>
        <pre className="max-h-[350px] overflow-auto whitespace-pre px-3 py-2 pr-24 font-mono text-[13px] leading-5 text-[#1d2129]">{processData.sql}</pre>
      </div>
    );
  };

  const getStepState = (step: AnalysisProcessStep) => {
    if (step.status === 'completed') return 'done' as const;
    if (step.status === 'running') return 'active' as const;
    if (step.status === 'awaiting-confirmation') return 'waiting' as const;
    if (step.status === 'needs-input') return 'needs-input' as const;
    return 'stopped' as const;
  };

  return (
    <div className="border-t border-[#e5e6eb] bg-white p-4 font-['Login_Figma_Sans','PingFang_SC','Microsoft_YaHei',sans-serif]">
      {processSteps.map((step, index) => (
        <FigmaTimelineStep
          key={step.id}
          index={index}
          title={step.title}
          state={getStepState(step)}
          isLast={index === processSteps.length - 1}
        >
          {renderStepContent(step)}
        </FigmaTimelineStep>
      ))}
    </div>
  );
}

function AnalysisProcessContent({ processData }: { processData: AnalysisProcessData }) {
  const primaryMetrics = processData.metrics.slice(0, 3).join('、') || '核心指标';
  const primaryDimensions = processData.dimensions.slice(0, 3).join('、') || '默认维度';
  const timeScopeText = processData.timeRange ? `，时间范围锁定为${processData.timeRange}` : '';
  const questionUnderstanding = `用户想分析“${processData.question}”背后的业务原因，需要围绕${primaryMetrics}，按${primaryDimensions}拆解变化${timeScopeText}，并结合知识依据与取数结果判断主要驱动因素。`;

  const steps = [
    {
      title: '理解用户问题',
      content: (
        <div className="space-y-2.5">
          <div className="rounded-md border border-gray-200 bg-white px-3.5 py-3">
            <div className="text-[13px] leading-6 text-gray-700">{questionUnderstanding}</div>
          </div>
        </div>
      ),
    },
    {
      title: '确定数据口径',
      content: (
        <div className="space-y-2.5">
          <div className="grid gap-3 md:grid-cols-3">
            <ProcessInfoCard label="数据集" value={processData.datasetName} highlighted />
            <ProcessInfoCard label="指标" value={processData.metrics.slice(0, 3).join('、') || '-'} />
            <ProcessInfoCard label="维度" value={processData.dimensions.slice(0, 3).join('、') || '默认维度'} />
          </div>
          {processData.timeRange && (
            <ProcessInfoCard label="时间范围" value={processData.timeRange} />
          )}
        </div>
      ),
    },
    {
      title: '匹配分析能力',
      content: (
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-2">
            {(processData.skillMatches ?? []).map((skill) => (
              <span key={skill.id} className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-[12px] leading-4 text-gray-600">
                Skill：{skill.name} · {skill.source}
              </span>
            ))}
            {(processData.mcpMatches ?? []).map((capability) => (
              <span key={capability.id} className="rounded-md border border-blue-100 bg-blue-50 px-2.5 py-1 text-[12px] leading-4 text-blue-700">
                MCP：{capability.name} · {capability.status}
              </span>
            ))}
          </div>
          {!processData.mcpMatches?.length ? (
            <div className="rounded-md border border-gray-200 bg-white px-3 py-2.5 text-[13px] text-gray-500">
              本次未选择 MCP 能力。
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: '检索知识依据',
      content: (
        <div className="space-y-2.5">
          {processData.knowledgeHits.length ? (
            <div className="grid gap-2">
              {processData.knowledgeHits.slice(0, 3).map((hit) => (
                <div key={hit.id} className="rounded-md border border-gray-200 bg-white px-3.5 py-2.5 text-[13px] font-medium leading-5 text-gray-800">
                  {hit.documentTitle}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-gray-200 bg-white px-3 py-2.5 text-[13px] text-gray-500">
              本次未引用知识依据。
            </div>
          )}
        </div>
      ),
    },
    {
      title: '执行查询语句',
      content: <SqlPreviewCard sql={processData.sql} />,
    },
    {
      title: '分析完毕',
      content: null,
    },
  ];

  const visibleStepCount = Math.min(
    Math.max(processData.visibleStepCount ?? steps.length, 1),
    steps.length,
  );
  const visibleSteps = steps.slice(0, visibleStepCount);

  return (
    <div className="border-t border-gray-100 bg-gray-50/30 px-5 pb-5 pt-4">
      <div className="space-y-0">
        {visibleSteps.map((step, index) => (
          <AnalysisTimelineStep
            key={step.title}
            index={index}
            title={step.title}
            state={getTimelineStepState(processData.status, index, visibleStepCount)}
            isLast={index === visibleSteps.length - 1}
          >
            {step.content}
          </AnalysisTimelineStep>
        ))}
      </div>
    </div>
  );
}

type WorkspaceActivityState = 'completed' | 'running' | 'pending' | 'interrupted';

function getWorkspaceActivityState(
  status: AnalysisProcessData['status'],
  index: number,
  visibleStepCount: number,
): WorkspaceActivityState {
  if (status === 'completed') return 'completed';
  if (status === 'interrupted') {
    if (index < visibleStepCount - 1) return 'completed';
    if (index === visibleStepCount - 1) return 'interrupted';
    return 'pending';
  }
  if (index < visibleStepCount - 1) return 'completed';
  if (index === visibleStepCount - 1) return 'running';
  return 'pending';
}

function WorkspaceActivityItem({
  id,
  title,
  summary,
  state,
  icon,
  isSelected,
  isLast,
  onSelect,
}: {
  id: DeepAnalysisActivityId;
  title: string;
  summary: string;
  state: WorkspaceActivityState;
  icon: ReactNode;
  isSelected: boolean;
  isLast: boolean;
  onSelect: (id: DeepAnalysisActivityId) => void;
}) {
  const itemRef = useRef<HTMLDivElement>(null);
  const stateLabel = state === 'completed' ? '已完成' : state === 'running' ? '进行中' : state === 'interrupted' ? '已中断' : '等待中';

  useEffect(() => {
    if (state !== 'running' || !isSelected) return;
    const frame = window.requestAnimationFrame(() => {
      itemRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isSelected, state]);

  return (
    <div ref={itemRef} className="relative pb-1.5 last:pb-0">
      {!isLast ? (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute bottom-[-11px] left-[15.5px] top-[27px] z-10 w-px ${
            state === 'completed' ? 'bg-[#bedaff]' : 'bg-[#e5e6eb]'
          }`}
        />
      ) : null}
      <button
        type="button"
        onClick={() => onSelect(id)}
        aria-current={isSelected ? 'step' : undefined}
        aria-label={`${title}，${stateLabel}，查看步骤详情`}
        className={`flex w-full min-w-0 items-start gap-2 rounded-[8px] p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 ${
          isSelected ? 'bg-[#e8f3ff]' : 'hover:bg-[#f7f8fa]'
        }`}
      >
        <span className={`flex h-[22px] w-4 shrink-0 items-center justify-center ${
          state === 'completed' || state === 'running' ? 'text-[#165dff]' : state === 'interrupted' ? 'text-[#f53f3f]' : 'text-[#86909c]'
        }`}>
          {state === 'completed' ? <CheckCircle2 className="h-4 w-4" /> : state === 'running' ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : state === 'interrupted' ? <CircleX className="h-4 w-4" /> : icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1">
            <span className={`min-w-0 text-sm font-medium leading-[22px] ${isSelected ? 'text-[#165dff]' : 'text-[#1d2129]'}`}>{title}</span>
            {state === 'completed' || state === 'running' || state === 'interrupted' ? (
              <span className="sr-only">，{stateLabel}</span>
            ) : (
              <span className="shrink-0 text-xs leading-[18px] text-[#86909c]">{stateLabel}</span>
            )}
          </span>
          <span className={`mt-0.5 block truncate text-sm font-normal leading-[22px] ${isSelected ? 'text-[#4e5969]' : 'text-[#86909c]'}`}>
            {summary}
          </span>
        </span>
      </button>
    </div>
  );
}

function InlineDeepAnalysisResult({
  result,
  loading,
  autoFollow,
  visibleBlockCount,
  visibleTextLength,
  isGenerating,
  isInterrupted,
  feedback,
  onFeedbackChange,
  onRegenerate,
}: {
  result?: RootCauseResultData;
  loading?: boolean;
  autoFollow?: boolean;
  visibleBlockCount?: number;
  visibleTextLength?: number;
  isGenerating?: boolean;
  isInterrupted?: boolean;
  feedback?: 'like' | 'dislike';
  onFeedbackChange?: (feedback: 'like' | 'dislike') => void;
  onRegenerate?: () => void;
}) {
  const resultRef = useRef<HTMLElement>(null);
  const latestResultRef = useRef<HTMLDivElement>(null);
  const actionButtonClassName =
    'inline-flex h-8 w-8 items-center justify-center rounded bg-white p-2 text-gray-500 hover:bg-[#f7f8fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20';
  const leadingBlockCount = result
    ? 3 + (result.overviewMetrics.length ? 1 : 0)
    : 0;
  const totalTypingTextLength = result
    ? result.conclusion.length + result.sections.reduce(
        (count, section) => count
          + section.title.length
          + section.description.length
          + section.bullets.reduce((bulletCount, bullet) => bulletCount + bullet.length, 0),
        0,
      )
    : 0;
  const visibleResultBlockCount = result
    ? Math.min(Math.max(visibleBlockCount ?? leadingBlockCount, 1), leadingBlockCount)
    : 0;
  const visibleResultTextLength = result
    ? Math.min(Math.max(visibleTextLength ?? totalTypingTextLength, 0), totalTypingTextLength)
    : 0;
  const overviewMetricsBlockIndex = result?.overviewMetrics.length ? 3 : null;
  const conclusionBlockIndex = overviewMetricsBlockIndex ? 4 : 3;
  let typingTextCursor = 0;
  const takeVisibleText = (text: string) => {
    const startIndex = typingTextCursor;
    typingTextCursor += text.length;
    const visibleLength = Math.min(
      text.length,
      Math.max(0, visibleResultTextLength - startIndex),
    );

    return text.slice(0, visibleLength);
  };
  const visibleConclusion = result ? takeVisibleText(result.conclusion) : '';
  const visibleSections = result?.sections.map((section) => {
    const visibleTitle = takeVisibleText(section.title);
    const visibleDescription = takeVisibleText(section.description);
    const visibleBullets = section.bullets.map((bullet) => ({
      fullText: bullet,
      visibleText: takeVisibleText(bullet),
    }));

    return {
      ...section,
      visibleTitle,
      visibleDescription,
      visibleBullets: visibleBullets.filter((bullet) => bullet.visibleText.length > 0),
    };
  }).filter((section) => section.visibleTitle.length > 0) ?? [];
  const isConclusionComplete = Boolean(result && visibleConclusion.length >= result.conclusion.length);
  const isResultComplete = Boolean(
    result
    && !isGenerating
    && !isInterrupted
    && visibleResultBlockCount >= leadingBlockCount
    && visibleResultTextLength >= totalTypingTextLength,
  );

  useEffect(() => {
    if (!autoFollow || (!loading && !result)) return;

    let frame = 0;
    let settleTimer = 0;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const followBehavior: ScrollBehavior = prefersReducedMotion ? 'auto' : 'smooth';
    const finalTimer = window.setTimeout(() => {
      latestResultRef.current?.scrollIntoView({ behavior: followBehavior, block: 'end' });
    }, 320);
    const scrollToLatest = (behavior: ScrollBehavior = 'auto') => {
      latestResultRef.current?.scrollIntoView({
        behavior,
        block: 'end',
      });
    };
    const scheduleFollow = () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
      frame = window.requestAnimationFrame(() => scrollToLatest(followBehavior));
      settleTimer = window.setTimeout(() => scrollToLatest(followBehavior), 160);
    };

    scheduleFollow();
    const resultElement = resultRef.current;
    const resizeObserver = resultElement && typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(scheduleFollow)
      : null;

    resizeObserver?.observe(resultElement!);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
      window.clearTimeout(finalTimer);
      resizeObserver?.disconnect();
    };
  }, [autoFollow, isGenerating, isInterrupted, loading, result, visibleBlockCount]);

  return (
    <section
      ref={resultRef}
      data-testid="workspace-deep-analysis-result"
      className="mt-3 pb-2"
      aria-label="深度分析结果"
    >
      {!result || loading ? (
        <div
          className="flex h-7 items-center gap-1.5 px-2"
          role="status"
          aria-live="polite"
          aria-label="正在生成图表和分析结论"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8fbdff] [animation-duration:1.2s] motion-reduce:animate-none" aria-hidden="true" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#5b9cff] [animation-delay:160ms] [animation-duration:1.2s] motion-reduce:animate-none" aria-hidden="true" />
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#165dff] [animation-delay:320ms] [animation-duration:1.2s] motion-reduce:animate-none" aria-hidden="true" />
        </div>
      ) : (
        <div className="space-y-4" aria-busy={isGenerating}>
          {visibleResultBlockCount >= 1 ? (
            <BaseChart title="维度贡献分析" data={result.contributionChart} />
          ) : null}

          {visibleResultBlockCount >= 2 ? <div>
            <h3 className="text-base font-medium leading-6 text-[#1d2129]">{result.title}</h3>
            <p className="mt-1.5 text-sm leading-6 text-[#4e5969]">{result.summary}</p>
          </div> : null}

          {overviewMetricsBlockIndex && visibleResultBlockCount >= overviewMetricsBlockIndex ? (
            <div className="grid grid-cols-2 gap-2">
              {result.overviewMetrics.map((metric) => (
                <div key={metric.label} className="min-h-[68px] rounded-[8px] border border-[#e5e6eb] bg-white px-3 py-2.5">
                  <div className="text-xs leading-[18px] text-[#86909c]">{metric.label}</div>
                  <div className="mt-0.5 break-words text-base font-medium leading-6 text-[#1d2129]">{metric.value}</div>
                </div>
              ))}
            </div>
          ) : null}

          {visibleResultBlockCount >= conclusionBlockIndex ? <section className="border-y border-[#e5e6eb] py-4" aria-labelledby="inline-analysis-conclusion-title">
            <h3 id="inline-analysis-conclusion-title" className="text-[16px] font-medium leading-6 text-[#1d2129]">分析结论</h3>
            {visibleConclusion ? (
              <p className="mt-1.5 min-h-6 text-[15px] leading-6 text-[#4e5969]" aria-label={result.conclusion}>{visibleConclusion}</p>
            ) : null}
          </section> : null}

          {result.sections.length && isConclusionComplete ? (
            <details className="group border-b border-[#e5e6eb] pb-4" open>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[16px] font-medium leading-6 text-[#1d2129] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20">
                <span>详细分析</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-[#86909c] transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              {visibleSections.length ? <div className="mt-3 divide-y divide-[#f2f3f5]">
                {visibleSections.map((section, index) => (
                  <article key={section.title} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start gap-2.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e8f3ff] text-[11px] font-medium text-[#165dff]">{index + 1}</span>
                      <div className="min-w-0">
                        <h4 className="min-h-6 text-[15px] font-medium leading-6 text-[#1d2129]" aria-label={section.title}>{section.visibleTitle}</h4>
                        {section.visibleDescription ? (
                          <p className="mt-1 min-h-6 text-sm leading-6 text-[#657180]" aria-label={section.description}>{section.visibleDescription}</p>
                        ) : null}
                        {section.visibleBullets.length ? <ul className="mt-1.5 space-y-1.5">
                          {section.visibleBullets.map((bullet) => (
                            <li key={bullet.fullText} className="flex min-h-6 gap-2 text-[15px] leading-6 text-[#4e5969]" aria-label={bullet.fullText}>
                              <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#165dff]" />
                              <span className="min-w-0">{bullet.visibleText}</span>
                            </li>
                          ))}
                        </ul> : null}
                      </div>
                    </div>
                  </article>
                ))}
              </div> : null}
            </details>
          ) : null}

          {isResultComplete && (onFeedbackChange || onRegenerate) ? (
            <div className="flex flex-wrap items-center justify-start py-[5px]" aria-label="深度分析操作">
              {onFeedbackChange ? (
                <>
                  <FeedbackTooltip label="点赞">
                    <button
                      type="button"
                      onClick={() => onFeedbackChange('like')}
                      className={`${actionButtonClassName} ${
                        feedback === 'like' ? 'bg-blue-50 text-blue-600 hover:bg-blue-50 hover:text-blue-600' : ''
                      }`}
                      aria-label="点赞"
                      aria-pressed={feedback === 'like'}
                    >
                      <ThumbsUp className={`h-4 w-4 ${feedback === 'like' ? 'fill-blue-600' : ''}`} />
                    </button>
                  </FeedbackTooltip>
                  <FeedbackTooltip label="点踩">
                    <button
                      type="button"
                      onClick={() => onFeedbackChange('dislike')}
                      className={`${actionButtonClassName} ${
                        feedback === 'dislike' ? 'bg-red-50 text-red-600 hover:bg-red-50 hover:text-red-600' : ''
                      }`}
                      aria-label="点踩"
                      aria-pressed={feedback === 'dislike'}
                    >
                      <ThumbsDown className={`h-4 w-4 ${feedback === 'dislike' ? 'fill-red-600' : ''}`} />
                    </button>
                  </FeedbackTooltip>
                </>
              ) : null}
              {onFeedbackChange && onRegenerate ? <span className="h-4 w-px bg-[#e5e6eb]" aria-hidden="true" /> : null}
              {onRegenerate ? (
                <FeedbackTooltip label="重新分析">
                  <button
                    type="button"
                    onClick={onRegenerate}
                    className={actionButtonClassName}
                    aria-label="重新分析"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                </FeedbackTooltip>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
      <div
        ref={latestResultRef}
        data-testid="workspace-deep-analysis-result-latest"
        className="h-px scroll-mb-28"
        aria-hidden="true"
      />
    </section>
  );
}

function WorkspaceReportFileCard({
  fileName,
  state,
  feedback,
  isSelected,
  onSelect,
  onFeedbackChange,
  onRegenerate,
}: {
  fileName: string;
  state: Extract<WorkspaceActivityState, 'running' | 'completed' | 'interrupted'>;
  feedback?: 'like' | 'dislike';
  isSelected: boolean;
  onSelect: (id: DeepAnalysisActivityId) => void;
  onFeedbackChange?: (feedback: 'like' | 'dislike') => void;
  onRegenerate?: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLDivElement>(null);
  const stateLabel = state === 'completed' ? '已生成' : state === 'running' ? '生成中' : '生成已中断';
  const actionButtonClassName =
    'inline-flex h-8 w-8 items-center justify-center rounded bg-white p-2 text-gray-500 hover:bg-[#f7f8fa]';

  useEffect(() => {
    let settleTimer = 0;
    const scrollToCurrentTarget = () => {
      const target = state === 'completed' ? actionRef.current : cardRef.current;
      target?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    };
    const frame = window.requestAnimationFrame(() => {
      scrollToCurrentTarget();
    });
    settleTimer = window.setTimeout(scrollToCurrentTarget, 240);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
    };
  }, [state]);

  return (
    <div
      ref={cardRef}
      className="mr-auto mt-3 w-full max-w-[640px] xl:w-[90%]"
      data-testid="workspace-report-file-card"
    >
      <div className={`overflow-hidden rounded-[10px] border bg-white transition-colors ${
          isSelected
            ? 'border-[#94bfff] bg-[#f7fbff]'
            : 'border-[#e5e6eb] hover:border-[#bedaff] hover:bg-[#f7f8fa]'
        }`}>
        <button
          type="button"
          onClick={() => onSelect('draft-report')}
          aria-current={isSelected ? 'page' : undefined}
          aria-label={`${fileName}，${stateLabel}，查看报告文件`}
          className="flex min-h-[68px] w-full min-w-0 items-center gap-3 px-4 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#165dff]/20"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-[#e8f3ff] text-[#165dff]">
            <FileText className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-normal leading-[22px] text-[#1d2129]">
              {fileName}
            </span>
            {state !== 'completed' ? (
              <span className="mt-1.5 flex min-w-0 items-center gap-3">
                <span
                  className="h-1 w-full max-w-[220px] overflow-hidden rounded-full bg-[#e5e6eb]"
                  role="progressbar"
                  aria-label="报告文件生成状态"
                  aria-valuetext={state === 'running' ? '生成中' : '已中断'}
                >
                  <span
                    className={`block h-full rounded-full ${
                      state === 'interrupted'
                        ? 'w-2/5 bg-[#f53f3f]'
                        : 'report-progress-indeterminate w-[32%] bg-[#165dff]'
                    }`}
                  />
                </span>
                <span className={`shrink-0 text-xs leading-[18px] ${state === 'interrupted' ? 'text-[#f53f3f]' : 'text-[#86909c]'}`}>
                  {state === 'running' ? '生成中' : '已中断'}
                </span>
              </span>
            ) : null}
          </span>
          <span className="flex h-9 w-7 shrink-0 items-center justify-end text-[#86909c]">
            <ChevronRight className="h-4 w-4" />
          </span>
          <span className="sr-only">{stateLabel}</span>
        </button>
      </div>
      {state === 'completed' && (onFeedbackChange || onRegenerate) ? (
        <div
          ref={actionRef}
          data-testid="workspace-report-actions"
          className="mt-2 flex scroll-mb-28 flex-wrap items-center justify-start py-[5px]"
          aria-label="报告操作"
        >
          {onFeedbackChange ? (
            <>
              <FeedbackTooltip label="点赞">
                <button
                  type="button"
                  onClick={() => onFeedbackChange('like')}
                  className={`${actionButtonClassName} ${
                    feedback === 'like' ? 'bg-blue-50 text-blue-600 hover:bg-blue-50 hover:text-blue-600' : ''
                  }`}
                  aria-label="点赞"
                  aria-pressed={feedback === 'like'}
                >
                  <ThumbsUp className={`h-4 w-4 ${feedback === 'like' ? 'fill-blue-600' : ''}`} />
                </button>
              </FeedbackTooltip>
              <FeedbackTooltip label="点踩">
                <button
                  type="button"
                  onClick={() => onFeedbackChange('dislike')}
                  className={`${actionButtonClassName} ${
                    feedback === 'dislike' ? 'bg-red-50 text-red-600 hover:bg-red-50 hover:text-red-600' : ''
                  }`}
                  aria-label="点踩"
                  aria-pressed={feedback === 'dislike'}
                >
                  <ThumbsDown className={`h-4 w-4 ${feedback === 'dislike' ? 'fill-red-600' : ''}`} />
                </button>
              </FeedbackTooltip>
            </>
          ) : null}
          {onFeedbackChange && onRegenerate ? <span className="h-4 w-px bg-[#e5e6eb]" aria-hidden="true" /> : null}
          {onRegenerate ? (
            <FeedbackTooltip label="重新分析">
              <button
                type="button"
                onClick={onRegenerate}
                className={actionButtonClassName}
                aria-label="重新分析"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </FeedbackTooltip>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function WorkspaceAnalysisProcessContent({
  processData,
  variant = 'report',
  analysisResult,
  analysisResultLoading,
  analysisResultVisibleBlockCount,
  analysisResultVisibleTextLength,
  analysisResultGenerating,
  analysisResultInterrupted,
  analysisFeedback,
  reportState,
  reportFileName,
  reportFeedback,
  selectedActivityId,
  onActivitySelect,
  onAnalysisFeedbackChange,
  onAnalysisRegenerate,
  onReportFeedbackChange,
  onReportRegenerate,
}: {
  processData: AnalysisProcessData;
  variant?: 'deep-analysis' | 'report';
  analysisResult?: RootCauseResultData;
  analysisResultLoading?: boolean;
  analysisResultVisibleBlockCount?: number;
  analysisResultVisibleTextLength?: number;
  analysisResultGenerating?: boolean;
  analysisResultInterrupted?: boolean;
  analysisFeedback?: 'like' | 'dislike';
  reportState?: Extract<WorkspaceActivityState, 'running' | 'completed' | 'interrupted'>;
  reportFileName?: string;
  reportFeedback?: 'like' | 'dislike';
  selectedActivityId?: DeepAnalysisActivityId;
  onActivitySelect?: (id: DeepAnalysisActivityId) => void;
  onAnalysisFeedbackChange?: (feedback: 'like' | 'dislike') => void;
  onAnalysisRegenerate?: () => void;
  onReportFeedbackChange?: (feedback: 'like' | 'dislike') => void;
  onReportRegenerate?: () => void;
}) {
  const activityCount = 7;
  const visibleStepCount = Math.min(Math.max(processData.visibleStepCount ?? activityCount, 1), activityCount);
  const metrics = processData.metrics.slice(0, 3);
  const capabilityCalls = [
    ...processData.skillMatches.map((skill) => `Skill：${skill.name}`),
    ...processData.mcpMatches.map((mcp) => `MCP 工具：${mcp.name}`),
  ];
  const capabilityExecutionTitle = processData.skillMatches.length && processData.mcpMatches.length
    ? '调用 Skill 和 MCP'
    : processData.mcpMatches.length
      ? '调用 MCP 工具'
      : processData.skillMatches.length
        ? '调用 Skill'
        : '执行分析任务';
  const capabilityExecutionSummary = capabilityCalls.length > 2
    ? `${capabilityCalls.slice(0, 2).join(' · ')} 等 ${capabilityCalls.length} 项`
    : capabilityCalls.join(' · ') || '本次无需调用额外能力';
  const isWebTask = processData.knowledgeHits.some((hit) => /网页|官网|外部|http|政策法规/i.test(`${hit.documentSource} ${hit.documentType}`))
    || processData.mcpMatches.some((mcp) => /网页|搜索|浏览|web|browser/i.test(`${mcp.name} ${mcp.serverName}`));
  const plannedTaskCount = processData.plannedTaskCount ?? processData.steps?.filter(
    (step) => step.id !== 'understand-intent' && step.id !== 'plan-analysis',
  ).length ?? 0;
  const activities: Array<{
    id: DeepAnalysisActivityId;
    title: string;
    summary: string;
    icon: ReactNode;
    state?: WorkspaceActivityState;
  }> = [
    {
      id: 'understand-intent' as const,
      title: '理解用户问题',
      summary: variant === 'report'
        ? `报告主题：${summarizeReportTopic(processData.question)}`
        : `明确分析目标：${metrics.join('、') || '核心指标'}分析`,
      icon: <Sparkles className="h-4 w-4" />,
    },
    {
      id: 'plan-analysis' as const,
      title: '规划分析任务',
      summary: plannedTaskCount > 0 ? `共规划 ${plannedTaskCount} 个分析任务` : '正在规划分析任务',
      icon: <FileSearch className="h-4 w-4" />,
    },
    {
      id: 'resolve-data-scope' as const,
      title: '确定数据口径',
      summary: `${processData.datasetName || '待确认数据集'}${processData.timeRange ? ` · ${processData.timeRange}` : ''}`,
      icon: <Database className="h-4 w-4" />,
    },
    {
      id: 'load-skills' as const,
      title: '匹配分析能力',
      summary: `匹配到 ${processData.skillMatches.length} 个 Skill、${processData.mcpMatches.length} 个 MCP`,
      icon: <Wrench className="h-4 w-4" />,
    },
    {
      id: 'execute-skills' as const,
      title: capabilityExecutionTitle,
      summary: capabilityExecutionSummary,
      icon: <Wrench className="h-4 w-4" />,
    },
    {
      id: 'retrieve-knowledge' as const,
      title: isWebTask ? '搜索并浏览网页' : '检索知识依据',
      summary: processData.knowledgeHits.length ? `已获取 ${processData.knowledgeHits.length} 条知识依据` : '检索业务口径、规则与分析依据',
      icon: <Search className="h-4 w-4" />,
    },
    {
      id: 'execute-query' as const,
      title: '执行数据查询',
      summary: processData.sql ? '已生成取数 SQL 和维度下钻路径' : '等待生成查询语句',
      icon: <FileSearch className="h-4 w-4" />,
    },
  ];
  const visibleActivities = processData.status === 'completed'
    ? activities
    : activities.slice(0, Math.min(visibleStepCount, activities.length));

  return (
    <div
      data-process-layout="workspace-v3"
      className="font-['Login_Figma_Sans','PingFang_SC','Microsoft_YaHei',sans-serif]"
    >
      <div>
        {visibleActivities.map((activity, index) => (
          <WorkspaceActivityItem
            key={activity.id}
            id={activity.id}
            title={activity.title}
            summary={activity.summary}
            state={activity.state ?? getWorkspaceActivityState(processData.status, index, visibleStepCount)}
            icon={activity.icon}
            isSelected={selectedActivityId === activity.id}
            isLast={index === visibleActivities.length - 1}
            onSelect={onActivitySelect ?? (() => {})}
          />
        ))}
        {variant === 'deep-analysis' && (analysisResult || analysisResultLoading) ? (
          <InlineDeepAnalysisResult
            result={analysisResult}
            loading={analysisResultLoading}
            autoFollow={Boolean(analysisResult || analysisResultLoading)}
            visibleBlockCount={analysisResultVisibleBlockCount}
            visibleTextLength={analysisResultVisibleTextLength}
            isGenerating={analysisResultGenerating}
            isInterrupted={analysisResultInterrupted}
            feedback={analysisFeedback}
            onFeedbackChange={onAnalysisFeedbackChange}
            onRegenerate={onAnalysisRegenerate}
          />
        ) : reportState && reportFileName ? (
          <WorkspaceReportFileCard
            fileName={reportFileName}
            state={reportState}
            feedback={reportFeedback}
            isSelected={selectedActivityId === 'draft-report'}
            onSelect={onActivitySelect ?? (() => {})}
            onFeedbackChange={onReportFeedbackChange}
            onRegenerate={onReportRegenerate}
          />
        ) : null}
      </div>
    </div>
  );
}

function AnalysisCard({
  message,
  onRerunSkill,
  forceExpanded = false,
  processVariant = 'timeline',
}: {
  message: Message;
  onRerunSkill?: (skillId: string) => void;
  forceExpanded?: boolean;
  processVariant?: AnalysisProcessVariant;
}) {
  const [expanded, setExpanded] = useState(() =>
    forceExpanded || (message.analysisProcess ? message.analysisProcess.status === 'running' : true),
  );
  const isExpanded = forceExpanded || expanded;
  const visibleMessageStepCount = Math.min(
    Math.max(message.visibleStepCount ?? message.analysisSteps?.length ?? 0, 0),
    message.analysisSteps?.length ?? 0,
  );

  useEffect(() => {
    if (forceExpanded) {
      setExpanded(true);
      return;
    }

    if (!message.analysisProcess) return;

    if (message.analysisProcess.status === 'running') {
      setExpanded(true);
      return;
    }

    setExpanded(false);
  }, [forceExpanded, message.analysisProcess?.status]);

  useEffect(() => {
    if (forceExpanded) {
      setExpanded(true);
      return;
    }

    if (message.analysisProcess) return;

    if (message.isGenerating) {
      setExpanded(true);
      return;
    }

    setExpanded(false);
  }, [forceExpanded, message.analysisProcess, message.isGenerating, message.isInterrupted]);

  if (message.analysisProcess) {
    if (processVariant === 'workspace') {
      return (
        <WorkspaceAnalysisProcessContent
          processData={message.analysisProcess}
        />
      );
    }

    const displayStatus = message.analysisProcess.scenarioCode === 'empty-result'
      ? 'completed'
      : isInterruptedQueryOutcome(message.analysisProcess.scenarioCode)
        ? 'interrupted'
        : message.analysisProcess.status;
    const title = getAnalysisProcessTitle(displayStatus);

      return (
        <div className="space-y-1">
          <div className="overflow-hidden rounded-[12px] border border-[#ecebfd] bg-white">
            <button
              type="button"
              onClick={() => {
                if (!forceExpanded) setExpanded((current) => !current);
              }}
              aria-expanded={isExpanded}
              className="flex w-full items-center justify-between gap-4 bg-[#e8f3ff] px-4 py-3 text-left transition-colors hover:bg-[#dcecff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#165dff]/25"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                  {displayStatus === 'running' ? (
                    <img
                      src={loadingLightIcon}
                      alt=""
                      className="h-5 w-5 animate-spin motion-reduce:animate-none"
                    />
                  ) : displayStatus === 'completed' ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#00b42a]">
                      <Check aria-hidden="true" className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
                    </span>
                  ) : (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#f53f3f]">
                      <X aria-hidden="true" className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
                    </span>
                  )}
                </span>
                <span className="truncate text-base font-medium leading-6 text-[#1d2129]">{title}</span>
              </div>
              <span
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[#4e5969]"
                aria-label={isExpanded ? '收起分析过程' : '展开分析过程'}
              >
              <img
                alt=""
                src={arrowUpSLineIcon}
                className={`h-5 w-5 transition-transform ${isExpanded ? '' : 'rotate-180'}`}
              />
            </span>
          </button>
          {isExpanded && (
            <FigmaAnalysisProcessContent
              processData={message.analysisProcess}
              routingTrace={message.routingTrace}
            />
          )}
        </div>
        {!isExpanded && message.isAwaitingResult && <ChartLoadingDots />}
      </div>
    );
  }

  const title = getMessageAnalysisTitle(message);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <button
        onClick={() => {
          if (!forceExpanded) setExpanded((current) => !current);
        }}
        className="flex w-full items-center justify-between gap-3 border-b border-gray-100 bg-white px-4 py-3 text-left hover:bg-gray-50/70"
      >
        <div className="flex min-w-0 items-center gap-2">
          <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
            message.isGenerating
              ? 'bg-blue-50 text-blue-600'
              : message.isInterrupted
                ? 'bg-amber-50 text-amber-600'
                : 'bg-emerald-50 text-emerald-600'
          }`}>
            {message.isGenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : message.isInterrupted ? (
              <AlertTriangle className="h-3.5 w-3.5" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
          </div>
          <span className="text-sm font-medium text-gray-900">{title}</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100 bg-gray-50/30 px-5 pb-5 pt-4">
          <SingleSkillScopeNote visible={message.resultScope === 'single-skill'} />
          {message.analysisSteps?.length ? (
            <div className={message.resultScope === 'single-skill' ? 'mt-4 space-y-0' : 'space-y-0'}>
              {message.analysisSteps.slice(0, visibleMessageStepCount).map((step, index) => {
                const isActiveStep = message.isGenerating && index === visibleMessageStepCount - 1;
                const stepState = isActiveStep ? 'active' : 'done';
                return (
                  <AnalysisTimelineStep
                    key={step}
                    index={index}
                    title={step === '生成查询语句' ? '执行查询语句' : step}
                    state={stepState}
                    isLast={index === visibleMessageStepCount - 1}
                  >
                    {null}
                  </AnalysisTimelineStep>
                );
              })}
            </div>
          ) : null}
        </div>
      )}
      </div>
    </div>
  );
}

export function BaseChart({ title, data }: { title: string; data: { name: string; value: number }[] }) {
  const [chartType, setChartType] = useState<BaseChartType>('bar');
  const [isChartTypeMenuOpen, setIsChartTypeMenuOpen] = useState(false);
  const chartTypeMenuRef = useRef<HTMLDivElement>(null);
  const currentChartType = baseChartTypes.find((type) => type.value === chartType) ?? baseChartTypes[0];
  const CurrentChartIcon = currentChartType.icon;

  useEffect(() => {
    if (!isChartTypeMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (
        chartTypeMenuRef.current &&
        !chartTypeMenuRef.current.contains(event.target as Node)
      ) {
        setIsChartTypeMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsChartTypeMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isChartTypeMenuOpen]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/70 px-4 py-3">
        <div className="text-sm font-medium text-gray-900">{title}</div>
        <div className="relative" ref={chartTypeMenuRef}>
          <button
            type="button"
            onClick={() => setIsChartTypeMenuOpen((current) => !current)}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors ${
              isChartTypeMenuOpen
                ? 'border-blue-100 bg-blue-50 text-blue-600'
                : 'border-gray-200 bg-white text-blue-600 hover:border-blue-100 hover:bg-blue-50'
            }`}
            aria-label={`切换图表类型，当前为${currentChartType.label}`}
            aria-expanded={isChartTypeMenuOpen}
            title={`当前图表：${currentChartType.label}`}
          >
            <CurrentChartIcon className="h-4.5 w-4.5" />
          </button>

          {isChartTypeMenuOpen ? (
            <div className="absolute right-0 top-full z-20 mt-2 w-[240px] max-w-[calc(100vw-48px)] rounded-lg border border-gray-200 bg-white p-3 shadow-[0_12px_32px_rgba(15,23,42,0.14)]">
              <div className="absolute -top-1.5 right-4 h-3 w-3 rotate-45 border-l border-t border-gray-200 bg-white" />
              <div className="grid grid-cols-3 gap-2">
                {baseChartTypes.map((type) => {
                  const Icon = type.icon;
                  const isActive = chartType === type.value;
                  const isDisabled = Boolean(type.disabled);

                  return (
                    <button
                      key={type.value}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => {
                        if (isDisabled) return;
                        setChartType(type.value as BaseChartType);
                        setIsChartTypeMenuOpen(false);
                      }}
                      className={`flex h-[74px] flex-col items-center justify-center gap-1.5 rounded-md border text-xs transition-colors ${
                        isActive
                          ? 'border-blue-100 bg-blue-50 text-blue-600'
                          : isDisabled
                            ? 'cursor-not-allowed border-transparent bg-white text-gray-300'
                            : 'border-transparent bg-white text-gray-600 hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600'
                      }`}
                      aria-label={isDisabled ? `${type.label}暂不可用` : `切换为${type.label}`}
                      aria-pressed={!isDisabled && isActive}
                      title={isDisabled ? `${type.label}暂不可用` : type.label}
                    >
                      <Icon
                        className={`h-5 w-5 ${
                          isActive ? 'text-blue-600' : isDisabled ? 'text-blue-100' : 'text-blue-300'
                        }`}
                      />
                      <span className="max-w-[4.5rem] text-center leading-4">{type.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <div className="h-64 px-4 py-4">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'bar' ? (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 8px 18px rgba(15, 23, 42, 0.08)',
                }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {data.map((item, index) => (
                  <Cell
                    key={`${item.name}-${item.value}`}
                    fill={chartColors[index % chartColors.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          ) : chartType === 'line' ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ stroke: '#dbeafe', strokeWidth: 1 }}
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 8px 18px rgba(15, 23, 42, 0.08)',
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#2563eb', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          ) : (
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="45%"
                outerRadius={82}
                label={({ name }) => name}
              >
                {data.map((item, index) => (
                  <Cell
                    key={`${item.name}-${item.value}`}
                    fill={chartColors[index % chartColors.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 8px 18px rgba(15, 23, 42, 0.08)',
                }}
              />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                wrapperStyle={{ fontSize: 12, color: '#6b7280' }}
              />
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const askChartBars = [
  { name: '药品', blue: 68, teal: 126 },
  { name: '检查', blue: 96, teal: 65 },
  { name: '治疗', blue: 50, teal: 92 },
  { name: '耗材', blue: 108, teal: 31 },
  { name: '挂号', blue: 98, teal: 40 },
  { name: '检验', blue: 69, teal: 57 },
  { name: '手术', blue: 55, teal: 72 },
  { name: '康复', blue: 92, teal: 36 },
  { name: '其他', blue: 45, teal: 40 },
];

const askChartData = askChartBars.map((item) => ({
  ...item,
  value: item.blue + item.teal,
}));

function FigmaAskStackedChart() {
  const yLabels = ['1000', '800', '600', '400', '200', '0'];
  const [chartType, setChartType] = useState<BaseChartType>('bar');
  const [isChartTypeMenuOpen, setIsChartTypeMenuOpen] = useState(false);
  const chartTypeMenuRef = useRef<HTMLDivElement>(null);
  const currentChartType = baseChartTypes.find((type) => type.value === chartType) ?? baseChartTypes[0];
  const CurrentChartIcon = currentChartType.icon;

  useEffect(() => {
    if (!isChartTypeMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (chartTypeMenuRef.current && !chartTypeMenuRef.current.contains(event.target as Node)) {
        setIsChartTypeMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsChartTypeMenuOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isChartTypeMenuOpen]);

  return (
    <div className="relative rounded-[8px] border border-[#e5e6eb] bg-white">
      <div className="flex items-center justify-between border-b border-[#e5e6eb] bg-[#f7f8fa] px-4 py-2">
        <div className="text-base font-semibold leading-6 text-[#1d2129]">关键指标拆分</div>
        <div className="relative" ref={chartTypeMenuRef}>
          <button
            type="button"
            onClick={() => setIsChartTypeMenuOpen((current) => !current)}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
              isChartTypeMenuOpen
                ? 'border-blue-100 bg-blue-50 text-blue-600'
                : 'border-transparent text-blue-600 hover:border-blue-100 hover:bg-blue-50'
            }`}
            aria-label={`切换图表类型，当前为${currentChartType.label}`}
            aria-expanded={isChartTypeMenuOpen}
            title={`当前图表：${currentChartType.label}`}
          >
            <CurrentChartIcon className="h-5 w-5" />
          </button>

          {isChartTypeMenuOpen ? (
            <div className="absolute right-0 top-full z-30 mt-2 w-[240px] max-w-[calc(100vw-48px)] rounded-lg border border-gray-200 bg-white p-3 shadow-[0_12px_32px_rgba(15,23,42,0.14)]">
              <div className="absolute -top-1.5 right-2.5 h-3 w-3 rotate-45 border-l border-t border-gray-200 bg-white" />
              <div className="grid grid-cols-3 gap-2">
                {baseChartTypes.map((type) => {
                  const Icon = type.icon;
                  const isActive = chartType === type.value;
                  const isDisabled = Boolean(type.disabled);

                  return (
                    <button
                      key={type.value}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => {
                        if (isDisabled) return;
                        setChartType(type.value as BaseChartType);
                        setIsChartTypeMenuOpen(false);
                      }}
                      className={`flex h-[74px] flex-col items-center justify-center gap-1.5 rounded-md border text-xs transition-colors ${
                        isActive
                          ? 'border-blue-100 bg-blue-50 text-blue-600'
                          : isDisabled
                            ? 'cursor-not-allowed border-transparent bg-white text-gray-300'
                            : 'border-transparent bg-white text-gray-600 hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600'
                      }`}
                      aria-label={isDisabled ? `${type.label}暂不可用` : `切换为${type.label}`}
                      aria-pressed={!isDisabled && isActive}
                    >
                      <Icon className={`h-5 w-5 ${isActive ? 'text-blue-600' : isDisabled ? 'text-blue-100' : 'text-blue-300'}`} />
                      <span className="max-w-[4.5rem] text-center leading-4">{type.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <div className="px-4 pb-4 pt-4 font-['Roboto']">
        <div className="relative mb-2 flex items-center">
          <div className="w-9 text-right text-xs leading-5 text-[#4e5969]">金额</div>
          {chartType !== 'pie' ? (
            <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-4 text-xs leading-5 text-[#4e5969]">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 bg-[#165dff]" />
                Legend
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 bg-[#0fc6c2]" />
                Legend
              </span>
            </div>
          ) : null}
        </div>
        {chartType === 'bar' ? (
          <div className="grid h-[252px] grid-cols-[36px_1fr] gap-2">
          <div className="flex flex-col justify-between pb-6 text-right text-xs leading-5 text-[#86909c]">
            {yLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="relative">
            <div className="absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between">
              {yLabels.map((label) => (
                <span key={label} className="h-px w-full border-t border-dashed border-[#e5e6eb]" />
              ))}
            </div>
            <div className="absolute inset-x-0 bottom-0 top-0 grid grid-cols-9 items-end pb-6">
              {askChartBars.map((item) => (
                <div key={item.name} className="flex h-full min-w-0 flex-col items-center justify-end px-3">
                  <div className="flex w-full flex-col justify-end">
                    <div className="w-full bg-[#0fc6c2]" style={{ height: item.teal }} />
                    <div className="w-full bg-[#165dff]" style={{ height: item.blue }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="absolute inset-x-0 bottom-0 grid grid-cols-9 text-center text-xs leading-5 text-[#4e5969]">
              {askChartBars.map((item) => (
                <span key={item.name} className="truncate">
                  {item.name}
                </span>
              ))}
            </div>
          </div>
          </div>
        ) : (
          <div className="h-[252px]">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'line' ? (
                <LineChart data={askChartData} margin={{ top: 8, right: 8, bottom: 8, left: -12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e6eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#4e5969' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#86909c' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 8px 18px rgba(15, 23, 42, 0.08)',
                    }}
                  />
                  <Line type="monotone" dataKey="blue" name="Legend" stroke="#165dff" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="teal" name="Legend" stroke="#0fc6c2" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              ) : (
                <PieChart>
                  <Pie data={askChartData} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={84} label={({ name }) => name}>
                    {askChartData.map((item, index) => (
                      <Cell key={`${item.name}-${item.value}`} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 8px 18px rgba(15, 23, 42, 0.08)',
                    }}
                  />
                  <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12, color: '#4e5969' }} />
                </PieChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

function DatasetResultSection({
  result,
  index,
  total,
  onRetry,
}: {
  result: DatasetAnalysisResult;
  index: number;
  total: number;
  onRetry?: () => void;
}) {
  const statusConfig = {
    completed: {
      label: '已完成',
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    },
    empty: {
      label: '无数据',
      className: 'border-amber-200 bg-amber-50 text-amber-700',
    },
    failed: {
      label: '查询失败',
      className: 'border-red-200 bg-red-50 text-red-700',
    },
  }[result.status];
  const stateMessage = result.statusMessage
    ?? (result.status === 'empty'
      ? '该数据集未查询到符合当前条件的数据。'
      : '该数据集本次查询失败，其他数据集结果不受影响。');

  return (
    <section
      className="overflow-hidden rounded-[12px] border border-[#e5e6eb] bg-white"
      aria-labelledby={`dataset-result-${result.datasetId}`}
    >
      <div className="border-b border-[#e5e6eb] bg-[#f7f8fa] px-4 py-3.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-[#e8f3ff] text-[#165dff]">
              <Database className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="text-xs leading-5 text-[#86909c]">数据集 {index + 1}/{total}</div>
              <div className="flex flex-wrap items-center gap-2">
                <h3
                  id={`dataset-result-${result.datasetId}`}
                  className="break-words text-base font-semibold leading-6 text-[#1d2129]"
                >
                  {result.datasetName}
                </h3>
                <span className="rounded-full border border-[#e5e6eb] bg-white px-2 py-0.5 text-xs leading-5 text-[#4e5969]">
                  {result.businessTopic}
                </span>
              </div>
            </div>
          </div>
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${statusConfig.className}`}>
            {statusConfig.label}
          </span>
        </div>
        <p className="mt-2 break-words text-sm leading-6 text-[#4e5969]">{result.summary}</p>
      </div>

      {result.status === 'completed' ? (
        <div className="space-y-3 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {result.metrics.map((metric) => (
              <div
                key={metric.label}
                className="min-h-[72px] rounded-[8px] border border-[#e5e6eb] bg-white p-4"
              >
                <div className="text-sm leading-5 text-[#4e5969]">{metric.label}</div>
                <div className="mt-1 break-words text-xl font-medium leading-7 text-[#1d2129]">{metric.value}</div>
              </div>
            ))}
          </div>
          <BaseChart title={result.chartTitle} data={result.chartData} />
        </div>
      ) : (
        <div className="p-4">
          <div className={`flex flex-wrap items-center justify-between gap-3 rounded-[8px] border px-4 py-3 ${
            result.status === 'empty'
              ? 'border-amber-200 bg-amber-50/70 text-amber-900'
              : 'border-red-200 bg-red-50/70 text-red-900'
          }`}>
            <div className="flex min-w-0 items-start gap-2 text-sm leading-6">
              <AlertTriangle className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="break-words">{stateMessage}</span>
            </div>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="shrink-0 rounded-[6px] border border-current bg-white px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/25"
              >
                仅重试该数据集
              </button>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

function AskResultCard({
  message,
  onRegenerate,
  onRerunSkill,
}: {
  message: Message;
  onRegenerate?: (messageId: string) => void;
  onRerunSkill?: (skillId: string) => void;
}) {
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null);

  if (!message.analysisResult) return null;

  const actionButtonClassName =
    'inline-flex h-8 w-8 items-center justify-center rounded bg-white p-2 text-gray-500 hover:bg-[#f7f8fa]';
  const datasetResults = message.analysisResult.datasetResults ?? [];

  if (datasetResults.length > 1) {
    return (
      <div className="space-y-4">
        <div
          className="flex items-start gap-3 rounded-[10px] border border-[#bedaff] bg-[#f2f8ff] px-4 py-3 text-sm leading-6 text-[#245b9e]"
          role="status"
        >
          <Database className="mt-1 h-4 w-4 shrink-0 text-[#165dff]" aria-hidden="true" />
          <span>
            本次命中 {datasetResults.length} 个数据集，以下结果按各自口径独立展示，请勿直接相加。
          </span>
        </div>

        <div className="space-y-4">
          {datasetResults.map((result, index) => (
            <DatasetResultSection
              key={result.datasetId}
              result={result}
              index={index}
              total={datasetResults.length}
              onRetry={result.status === 'completed' || !onRegenerate
                ? undefined
                : () => onRegenerate(message.id)}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-start py-[5px]">
          <FeedbackTooltip label="点赞">
            <button
              type="button"
              onClick={() => setFeedback(feedback === 'like' ? null : 'like')}
              className={`${actionButtonClassName} ${
                feedback === 'like' ? 'bg-blue-50 text-blue-600 hover:bg-blue-50 hover:text-blue-600' : ''
              }`}
              aria-label="点赞"
              aria-pressed={feedback === 'like'}
            >
              <ThumbsUp className={`h-4 w-4 ${feedback === 'like' ? 'fill-blue-600' : ''}`} />
            </button>
          </FeedbackTooltip>
          <FeedbackTooltip label="点踩">
            <button
              type="button"
              onClick={() => setFeedback(feedback === 'dislike' ? null : 'dislike')}
              className={`${actionButtonClassName} ${
                feedback === 'dislike' ? 'bg-red-50 text-red-600 hover:bg-red-50 hover:text-red-600' : ''
              }`}
              aria-label="点踩"
              aria-pressed={feedback === 'dislike'}
            >
              <ThumbsDown className={`h-4 w-4 ${feedback === 'dislike' ? 'fill-red-600' : ''}`} />
            </button>
          </FeedbackTooltip>
          {onRegenerate ? (
            <>
              <span className="h-4 w-px bg-[#e5e6eb]" />
              <FeedbackTooltip label="重新分析">
                <button
                  type="button"
                  onClick={() => onRegenerate(message.id)}
                  className={actionButtonClassName}
                  aria-label="重新分析"
                >
                  <img alt="" src={refreshLineIcon} className="h-4 w-4" />
                </button>
              </FeedbackTooltip>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[12px] border border-[#e5e6eb] bg-white p-4">
        <div className="grid grid-cols-4 gap-4 max-md:grid-cols-2 max-sm:grid-cols-1">
          {message.analysisResult.metrics.map((metric) => (
            <div
              key={metric.label}
              className="min-h-[72px] rounded-[8px] border border-[#e5e6eb] bg-white p-4"
            >
              <div className="text-sm leading-[14px] tracking-[0.175px] text-[#4e5969]">{metric.label}</div>
              <div className="mt-2 text-xl font-medium leading-7 text-[#1d2129]">{metric.value}</div>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <FigmaAskStackedChart />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-start py-[5px]">
        <FeedbackTooltip label="点赞">
          <button
            type="button"
            onClick={() => setFeedback(feedback === 'like' ? null : 'like')}
            className={`${actionButtonClassName} ${
              feedback === 'like' ? 'bg-blue-50 text-blue-600 hover:bg-blue-50 hover:text-blue-600' : ''
            }`}
            aria-label="点赞"
            aria-pressed={feedback === 'like'}
          >
            <ThumbsUp className={`h-4 w-4 ${feedback === 'like' ? 'fill-blue-600' : ''}`} />
          </button>
        </FeedbackTooltip>
        <FeedbackTooltip label="点踩">
          <button
            type="button"
            onClick={() => setFeedback(feedback === 'dislike' ? null : 'dislike')}
            className={`${actionButtonClassName} ${
              feedback === 'dislike' ? 'bg-red-50 text-red-600 hover:bg-red-50 hover:text-red-600' : ''
            }`}
            aria-label="点踩"
            aria-pressed={feedback === 'dislike'}
          >
            <ThumbsDown className={`h-4 w-4 ${feedback === 'dislike' ? 'fill-red-600' : ''}`} />
          </button>
        </FeedbackTooltip>
        {onRegenerate && (
          <>
            <span className="h-4 w-px bg-[#e5e6eb]" />
            <FeedbackTooltip label="重新分析">
              <button
                type="button"
                onClick={() => onRegenerate(message.id)}
                className={actionButtonClassName}
                aria-label="重新分析"
              >
                <img alt="" src={refreshLineIcon} className="h-4 w-4" />
              </button>
            </FeedbackTooltip>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
        <div className="grid gap-3 px-5 py-4 md:grid-cols-4">
          {message.analysisResult.metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
            >
              <div className="text-xs text-gray-500">{metric.label}</div>
              <div className="mt-1 text-lg font-semibold text-gray-900">{metric.value}</div>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <BaseChart title="关键指标拆分" data={message.analysisResult.chartData} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FeedbackTooltip label="点赞">
          <button
            type="button"
            onClick={() => setFeedback(feedback === 'like' ? null : 'like')}
            className={`${actionButtonClassName} ${
              feedback === 'like' ? 'bg-blue-50 text-blue-600 hover:bg-blue-50 hover:text-blue-600' : ''
            }`}
            aria-label="点赞"
            aria-pressed={feedback === 'like'}
          >
            <ThumbsUp className={`h-4 w-4 ${feedback === 'like' ? 'fill-blue-600' : ''}`} />
          </button>
        </FeedbackTooltip>
        <FeedbackTooltip label="点踩">
          <button
            type="button"
            onClick={() => setFeedback(feedback === 'dislike' ? null : 'dislike')}
            className={`${actionButtonClassName} ${
              feedback === 'dislike' ? 'bg-red-50 text-red-600 hover:bg-red-50 hover:text-red-600' : ''
            }`}
            aria-label="点踩"
            aria-pressed={feedback === 'dislike'}
          >
            <ThumbsDown className={`h-4 w-4 ${feedback === 'dislike' ? 'fill-red-600' : ''}`} />
          </button>
        </FeedbackTooltip>
        {onRegenerate && (
          <FeedbackTooltip label="重新分析">
            <button
              type="button"
              onClick={() => onRegenerate(message.id)}
              className={actionButtonClassName}
              aria-label="重新生成回答"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </FeedbackTooltip>
        )}
      </div>
    </div>
  );
}

function ReportResultCard({
  message,
  onRegenerate,
}: {
  message: Message;
  onRegenerate?: (messageId: string) => void;
}) {
  const result = message.reportResult;
  const runtimeConfig = getRuntimeConfig(message);
  const { addReportTemplate, reportTemplates } = useWorkspace();
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null);
  const [isSubscriptionDialogOpen, setIsSubscriptionDialogOpen] = useState(false);

  if (!result) return null;

  const matchedTemplate =
    reportTemplates.find((template) => template.id === result.templateUsage?.templateId) ?? null;
  const unsavedGeneratedTemplate = result.templateUsage?.source === 'agent-generated' && !matchedTemplate;

  const actionButtonClassName =
    'inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800';

  const handleExportReport = () => {
    const metricLines = result.keyMetrics.map((metric) => `- ${metric.label}: ${metric.value}`);
    const findingLines = result.findings.map((finding) => `- ${finding}`);
    const alertLines = result.alerts.map((alert) => `- ${alert}`);
    const content = [
      `# ${result.title}`,
      '',
      `周期：${result.period}`,
      '',
      result.summary,
      '',
      '## 关键指标',
      ...metricLines,
      '',
      '## 关键结论',
      ...findingLines,
      '',
      '## 异常提示',
      ...alertLines,
    ].join('\n');
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `${result.title.replace(/[\\/:*?"<>|]/g, '_') || 'report'}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveGeneratedTemplate = () => {
    const templateUsage = result.templateUsage;
    if (!templateUsage || templateUsage.source !== 'agent-generated' || matchedTemplate) return;

    addReportTemplate({
      ...templateUsage.templateSnapshot,
      status: 'published',
    });
    toast.success(`已保存模板“${templateUsage.name}”`);
  };

  const handleOpenSubscription = () => {
    if (unsavedGeneratedTemplate) {
      toast.warning('请先保存 Agent 动态生成的模板，再设置报告订阅');
      return;
    }
    setIsSubscriptionDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#e5e6eb] bg-white p-4">
        <div className="border-b border-gray-100 px-5 py-4">
          <div>
            <div className="text-base font-medium text-gray-900">{result.title}</div>
            <div className="mt-1 text-sm text-gray-500">{result.period}</div>
            <p className="mt-3 text-sm leading-6 text-gray-600">{result.summary}</p>
            <SingleSkillScopeNote visible={message.resultScope === 'single-skill'} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {result.keyMetrics.map((metric) => (
            <div
              key={metric.label}
              className="min-h-[72px] rounded-lg border border-[#e5e6eb] bg-white px-4 py-3"
            >
              <div className="text-sm leading-[14px] tracking-[0.175px] text-[#4e5969]">{metric.label}</div>
              <div className="mt-2 text-xl font-medium leading-7 text-[#1d2129]">{metric.value}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-4 px-5 pb-5 lg:grid-cols-[1.7fr_1fr]">
          <BaseChart title={result.chartTitle} data={result.chartData} />
          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="text-sm font-medium text-gray-900">关键结论</div>
              <div className="mt-3 space-y-2">
                {result.findings.map((finding) => (
                  <div key={finding} className="flex items-start gap-2 text-sm text-gray-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                    <span>{finding}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                异常提示
              </div>
              <div className="mt-3 space-y-2 text-sm text-amber-900">
                {result.alerts.map((alert) => (
                  <div key={alert}>{alert}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FeedbackTooltip label="点赞">
          <button
            type="button"
            onClick={() => setFeedback(feedback === 'like' ? null : 'like')}
            className={`${actionButtonClassName} ${
              feedback === 'like' ? 'bg-blue-50 text-blue-600 hover:bg-blue-50 hover:text-blue-600' : ''
            }`}
            aria-label="点赞"
            aria-pressed={feedback === 'like'}
          >
            <ThumbsUp className={`h-4 w-4 ${feedback === 'like' ? 'fill-blue-600' : ''}`} />
          </button>
        </FeedbackTooltip>
        <FeedbackTooltip label="点踩">
          <button
            type="button"
            onClick={() => setFeedback(feedback === 'dislike' ? null : 'dislike')}
            className={`${actionButtonClassName} ${
              feedback === 'dislike' ? 'bg-red-50 text-red-600 hover:bg-red-50 hover:text-red-600' : ''
            }`}
            aria-label="点踩"
            aria-pressed={feedback === 'dislike'}
          >
            <ThumbsDown className={`h-4 w-4 ${feedback === 'dislike' ? 'fill-red-600' : ''}`} />
          </button>
        </FeedbackTooltip>
        {onRegenerate && (
          <FeedbackTooltip label="重新分析">
            <button
              type="button"
              onClick={() => onRegenerate(message.id)}
              className={actionButtonClassName}
              aria-label="重新生成报告"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </FeedbackTooltip>
        )}
        {runtimeConfig.allowExport && (
          <button
            type="button"
            onClick={handleExportReport}
            className={actionButtonClassName}
            aria-label="导出报告"
            title="导出报告"
          >
            <Download className="h-4 w-4" />
          </button>
        )}
        {unsavedGeneratedTemplate && (
          <button
            type="button"
            onClick={handleSaveGeneratedTemplate}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 text-sm text-blue-700 hover:bg-blue-100"
          >
            <FileText className="h-4 w-4" />
            保存为模板
          </button>
        )}
        <button
          type="button"
          onClick={handleOpenSubscription}
          className={actionButtonClassName}
          aria-label="设为订阅"
          title="设为订阅"
        >
          <CalendarClock className="h-4 w-4" />
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-gray-900">报告订阅</div>
            <div className="mt-1 text-sm text-gray-500">
              {result.pushConfig.enabled
                ? `${result.pushConfig.frequency} · ${result.pushConfig.channel} · ${result.pushConfig.audience}`
                : '当前报告尚未启用订阅'}
            </div>
          </div>
          <button
            type="button"
            onClick={handleOpenSubscription}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            <CalendarClock className="h-4 w-4" />
            设为订阅
          </button>
        </div>
        {result.pushConfig.records.length > 0 && (
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {result.pushConfig.records.map((record) => (
              <div key={record.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-gray-800">{record.channel} · {record.target}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      record.status === '成功' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {record.status}
                  </span>
                </div>
                <div className="mt-1 text-xs text-gray-500">{record.sentAt} · {record.note}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ReportSubscriptionDialog
        open={isSubscriptionDialogOpen}
        onOpenChange={setIsSubscriptionDialogOpen}
        template={matchedTemplate}
        reportTitle={result.title}
        reportPeriod={result.period}
      />
    </div>
  );
}

function RootCauseResultCard({
  message,
  onRegenerate,
  onRerunSkill,
}: {
  message: Message;
  onRegenerate?: (messageId: string) => void;
  onRerunSkill?: (skillId: string) => void;
}) {
  const result = message.rootCauseResult;

  if (!result) return null;

  if (message.markdownArtifact) {
    const visibleLineCount = Math.min(
      Math.max(message.visibleMarkdownLineCount ?? message.markdownArtifact.content.split('\n').length, 1),
      message.markdownArtifact.content.split('\n').length,
    );
    const visibleMarkdown = message.markdownArtifact.content
      .split('\n')
      .slice(0, visibleLineCount)
      .join('\n');

    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-gray-200 bg-white px-5 py-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <MarkdownPreview content={visibleMarkdown} />
        </div>
        {!message.isGenerating && (
          <MarkdownArtifactCard
            fileName={message.markdownArtifact.fileName}
            content={message.markdownArtifact.content}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <div className="border-b border-gray-100 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-base font-medium text-gray-900">{result.title}</div>
            <p className="mt-2 text-sm leading-6 text-gray-600">{result.summary}</p>
            <SingleSkillScopeNote visible={message.resultScope === 'single-skill'} />
          </div>
          {onRegenerate && (
            <button
              onClick={() => onRegenerate(message.id)}
              className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4" />
              重新生成回答
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3 px-5 py-4 md:grid-cols-4">
        {result.overviewMetrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
          >
            <div className="text-xs text-gray-500">{metric.label}</div>
            <div className="mt-1 text-lg font-semibold text-gray-900">{metric.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 px-5 pb-5 lg:grid-cols-[1.4fr_1fr]">
        <BaseChart title="维度贡献" data={result.contributionChart} />
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="text-sm font-medium text-gray-900">结论摘要</div>
          <p className="mt-3 text-sm leading-6 text-gray-600">{result.conclusion}</p>
        </div>
      </div>

      <div className="space-y-4 border-t border-gray-100 px-5 py-5">
        {result.sections.map((section, index) => (
          <div
            key={section.title}
            className="flex gap-4 rounded-lg border border-gray-200 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-600">
              {index + 1}
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">{section.title}</div>
              <div className="mt-1 text-sm text-gray-500">{section.description}</div>
              <div className="mt-3 space-y-2">
                {section.bullets.map((bullet) => (
                  <div key={bullet} className="text-sm text-gray-700">
                    {bullet}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-100 px-5 py-5">
        <div className="text-sm font-medium text-gray-900">候选根因</div>
        <div className="mt-3 grid gap-4 lg:grid-cols-3">
          {result.candidates.map((candidate) => (
            <div key={candidate.title} className="rounded-lg border border-gray-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-gray-900">{candidate.title}</div>
                <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600">
                  置信度 {candidate.confidence}
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {candidate.evidence.map((evidence) => (
                  <div key={evidence} className="text-sm text-gray-600">
                    {evidence}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <SkillTraceRow skillTrace={message.skillTrace} onRerunSkill={onRerunSkill} />
      </div>
      </div>
    </div>
  );
}

export function AssistantMessageCard({
  message,
  onRegenerate,
  onRerunSkill,
  onClarificationSelect,
  onAnalysisCandidateSelect,
  forceAnalysisExpanded,
  analysisProcessVariant,
}: {
  message: Message;
  onRegenerate?: (messageId: string) => void;
  onRerunSkill?: (skillId: string) => void;
  onClarificationSelect?: (question: string, agentId: string) => void;
  onAnalysisCandidateSelect?: (messageId: string, option: AnalysisCandidateOption) => void;
  forceAnalysisExpanded?: boolean;
  analysisProcessVariant?: AnalysisProcessVariant;
}) {
  if (message.kind === 'clarification') {
    return (
      <ClarificationCard
        message={message}
        onClarificationSelect={onClarificationSelect}
      />
    );
  }

  if (message.kind === 'text') {
    return (
      <AssistantTextReply
        message={message}
        onCandidateSelect={(option) => onAnalysisCandidateSelect?.(message.id, option)}
      />
    );
  }

  if (message.kind === 'analysis') {
    return (
      <AnalysisCard
        message={message}
        onRerunSkill={onRerunSkill}
        forceExpanded={forceAnalysisExpanded}
        processVariant={analysisProcessVariant}
      />
    );
  }

  if (message.kind === 'report-result') {
    return (
      <ReportResultCard
        message={message}
        onRegenerate={onRegenerate}
      />
    );
  }

  if (message.kind === 'rca-result') {
    return (
      <RootCauseResultCard
        message={message}
        onRegenerate={onRegenerate}
        onRerunSkill={onRerunSkill}
      />
    );
  }

  return (
    <AskResultCard
      message={message}
      onRegenerate={onRegenerate}
      onRerunSkill={onRerunSkill}
    />
  );
}
