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
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  Download,
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
} from 'lucide-react';
import { AgentRoutingTrace, AgentRuntimeConfig, AnalysisProcessData, Message, SkillTrace } from '../types';
import { useWorkspace } from '../context/WorkspaceContext';
import { ReportSubscriptionDialog } from './ReportSubscriptionDialog';
import {
  Tooltip as AppTooltip,
  TooltipContent,
  TooltipTrigger,
} from './ui/tooltip';
import arrowRightUpLineIcon from '../../assets/figma-ask/arrow-right-up-line.svg';
import arrowUpSLineIcon from '../../assets/figma-ask/arrow-up-s-line.svg';
import checkFillIcon from '../../assets/figma-ask/check-fill.svg';
import copyLineIcon from '../../assets/figma-ask/file-copy-line.svg';
import refreshLineIcon from '../../assets/figma-ask/refresh-line.svg';

const chartColors = ['#2563eb', '#60a5fa', '#93c5fd', '#bfdbfe'];
type AnalysisProcessVariant = 'timeline' | 'workspace';
type BaseChartType = 'bar' | 'line' | 'pie';

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
  if (status === 'unavailable') {
    if (index === 0) return 'done';
    if (index === 1) return 'stopped';
    return 'pending';
  }
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
  if (status === 'interrupted') {
    return '分析中断';
  }

  if (status === 'unavailable') {
    return '无法继续分析';
  }

  if (status === 'completed') {
    return '分析完成';
  }

  return '分析中';
}

function getMessageAnalysisTitle(message: Message) {
  if (message.isGenerating) {
    return '分析中';
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
  state: 'done' | 'active' | 'pending' | 'stopped';
}) {
  const isDone = state === 'done';
  const isActive = state === 'active';
  const isStopped = state === 'stopped';

  return (
    <span
      className={`relative z-10 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${
        isDone
          ? 'border-[#165dff] bg-[#e8f3ff]'
          : isActive
            ? 'border-transparent bg-transparent text-[#165dff] shadow-none'
            : isStopped
              ? 'border-amber-300 bg-amber-50 text-amber-700'
              : 'border-[#c9cdd4] bg-white text-[#86909c]'
      }`}
    >
      {isDone ? <img alt="" src={checkFillIcon} className="h-[10.667px] w-[10.667px]" /> : null}
      {isActive ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {isStopped ? <AlertTriangle className="h-3 w-3" /> : null}
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
  state: 'done' | 'active' | 'pending' | 'stopped';
  isLast?: boolean;
}) {
  return (
    <div className="relative grid grid-cols-[16px_1fr] gap-2 pb-4 last:pb-0">
      {!isLast ? (
        <div className="absolute left-2 top-[19px] h-[calc(100%-19px)] w-px bg-[#e5e6eb]" />
      ) : null}
      <div className="mt-[3px]">
        <FigmaStepIcon index={index} state={state} />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold leading-[22px] text-[#1d2129]">{title}</div>
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

function FigmaChip({ tone = 'neutral', children }: { tone?: 'neutral' | 'blue'; children: ReactNode }) {
  return (
    <span
      className={`inline-flex min-h-[26px] max-w-full items-center rounded px-2 text-sm leading-[22px] whitespace-normal break-words ${
        tone === 'blue'
          ? 'border border-blue-100 bg-[#e8f3ff] text-[#165dff]'
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
  onRetry,
}: {
  processData: AnalysisProcessData;
  routingTrace?: AgentRoutingTrace;
  onRetry?: () => void;
}) {
  const metrics = processData.metrics.slice(0, 3);
  const dimensions = processData.dimensions.slice(0, 2);
  const questionUnderstanding = [
    `用户想分析“${processData.question}”`,
    metrics.length ? `需要围绕${metrics.join('、')}` : '',
    dimensions.length ? `按${dimensions.join('、')}拆解变化` : '',
    processData.timeRange ? `时间范围锁定为${processData.timeRange}` : '',
  ].filter(Boolean).join('，') + '。';
  const matchStatus = processData.matchStatus ?? 'matched';
  const sqlExecutionStatus = processData.sqlExecutionStatus ?? (
    processData.status === 'completed' ? 'success' : processData.status === 'running' ? 'pending' : 'not-run'
  );
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
  const visibleStepCount = processData.status === 'completed' || processData.status === 'unavailable'
    ? 3
    : Math.min(Math.max(processData.visibleStepCount ?? 1, 1), 3);
  const activeStepIndex = processData.status === 'running' ? visibleStepCount - 1 : null;
  const stepText = [
    questionUnderstanding,
    '本次分析已匹配：',
    processData.sql,
  ];
  const activeStepText = activeStepIndex === null ? '' : stepText[activeStepIndex] ?? '';
  const [visibleCharacterCount, setVisibleCharacterCount] = useState(0);

  useEffect(() => {
    if (activeStepIndex === null || !activeStepText) {
      setVisibleCharacterCount(activeStepText.length);
      return;
    }

    setVisibleCharacterCount(0);
    const characterChunkSize = Math.max(1, Math.ceil(activeStepText.length / 26));
    let characterCount = 0;
    const timer = window.setInterval(() => {
      characterCount = Math.min(activeStepText.length, characterCount + characterChunkSize);
      setVisibleCharacterCount(characterCount);
      if (characterCount >= activeStepText.length) {
        window.clearInterval(timer);
      }
    }, 36);

    return () => window.clearInterval(timer);
  }, [activeStepIndex, activeStepText]);

  const getStreamedStepText = (text: string, stepIndex: number) =>
    activeStepIndex === stepIndex ? text.slice(0, visibleCharacterCount) : text;
  const isActiveStepTextComplete = (stepIndex: number) =>
    activeStepIndex !== stepIndex || visibleCharacterCount >= (stepText[stepIndex]?.length ?? 0);
  const visibleQuestionUnderstanding = getStreamedStepText(questionUnderstanding, 0);
  const visibleMatchingSummary = getStreamedStepText(stepText[1], 1);
  const visibleSql = getStreamedStepText(processData.sql, 2);
  const isMatchingDetailVisible = isActiveStepTextComplete(1);
  const isSqlContentComplete = isActiveStepTextComplete(2);
  const steps = [
    {
      title: '问题理解',
      content: <p className="text-sm leading-[22px] text-[#4e5969]" aria-live="polite">{visibleQuestionUnderstanding}</p>,
    },
    {
      title: '匹配数据与能力',
      content: matchStatus === 'matched' ? (
        <div className="flex flex-wrap items-center gap-2 text-sm leading-[22px] text-[#4e5969]">
          <span aria-live="polite">{visibleMatchingSummary}</span>
          {isMatchingDetailVisible ? <FigmaChip>数据集 · {processData.datasetName || '暂未匹配'}</FigmaChip> : null}
          {isMatchingDetailVisible && routingTrace?.agentName ? <FigmaChip tone="blue">Agent · {routingTrace.agentName}</FigmaChip> : null}
        </div>
      ) : (
        <div className="rounded-[8px] border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm leading-[22px] text-amber-800">
          {processData.matchMessage}
        </div>
      ),
    },
    {
      title: '执行取数 SQL',
      content: (
        <div className="space-y-2">
          {processData.sql ? (
            <div className="relative max-h-[366px] rounded-[8px] border border-[#e5e6eb] bg-[#f7f8fa] py-2">
              {isSqlContentComplete ? (
                <button
                  type="button"
                  className={`absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded hover:bg-white ${
                    isSqlCopied ? 'text-emerald-600' : ''
                  }`}
                  onClick={handleCopySql}
                  aria-label={isSqlCopied ? 'SQL 已复制' : '复制 SQL'}
                  title={isSqlCopied ? '已复制' : '复制 SQL'}
                >
                  {isSqlCopied ? <CheckCircle2 className="h-4 w-4" /> : <img alt="" src={copyLineIcon} className="h-4 w-4" />}
                </button>
              ) : null}
              {isSqlCopied ? (
                <span
                  role="status"
                  className="absolute right-12 top-3.5 rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-700"
                >
                  已复制
                </span>
              ) : null}
              <div className="max-h-[350px] overflow-auto px-3 py-2 pr-10 font-mono text-[13px] leading-5 text-[#1d2129]">
                {visibleSql.split('\n').map((line, index) => (
                  <p key={`${line}-${index}`} className="whitespace-pre">
                    {line}
                  </p>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-[8px] border border-[#e5e6eb] bg-[#f7f8fa] px-3 py-2.5 text-sm leading-[22px] text-[#4e5969]">
              {processData.sqlExecutionMessage ?? '本次暂未生成 SQL 预览。'}
            </div>
          )}
          {sqlExecutionStatus === 'failed' && onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              重试
            </button>
          ) : null}
          {sqlExecutionStatus === 'empty' ? (
            <div className="rounded-[8px] border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm leading-[22px] text-amber-800">
              {processData.sqlExecutionMessage}
            </div>
          ) : null}
          {sqlExecutionStatus === 'failed' ? (
            <div className="rounded-[8px] border border-red-200 bg-red-50 px-3 py-2.5 text-sm leading-[22px] text-red-700">
              {processData.sqlExecutionMessage}
            </div>
          ) : null}
        </div>
      ),
    },
  ].slice(0, visibleStepCount);

  return (
    <div className="border-t border-[#e5e6eb] bg-white p-4">
      {steps.map((step, index) => (
        <FigmaTimelineStep
          key={step.title}
          index={index}
          title={step.title}
          state={getTimelineStepState(processData.status, index, visibleStepCount)}
          isLast={index === steps.length - 1}
        >
          {step.content}
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
      title: '理解问题',
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
      title: '选择能力与工具',
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
      title: '生成取数 SQL',
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

function getWorkspaceProcessState(
  status: AnalysisProcessData['status'],
  index: number,
  visibleStepCount: number,
): 'done' | 'active' | 'pending' | 'stopped' {
  if (status === 'completed') return 'done';
  if (status === 'unavailable') return index === 1 ? 'stopped' : index < 1 ? 'done' : 'pending';
  if (status === 'interrupted') return index < visibleStepCount - 1 ? 'done' : 'stopped';
  if (index < visibleStepCount - 1) return 'done';
  if (index === visibleStepCount - 1) return 'active';
  return 'pending';
}

function WorkspaceProcessItem({
  icon,
  label,
  detail,
  state,
}: {
  icon: ReactNode;
  label: string;
  detail: string;
  state: 'done' | 'active' | 'pending' | 'stopped';
}) {
  const isActive = state === 'active';
  const isDone = state === 'done';
  const isStopped = state === 'stopped';

  return (
    <div
      className={`inline-flex max-w-full items-center gap-2 rounded-full px-3 py-2 text-[13px] leading-5 transition-colors ${
        isActive
          ? 'bg-blue-50 text-blue-700'
          : isDone
            ? 'bg-gray-100 text-gray-700'
            : isStopped
              ? 'bg-amber-50 text-amber-700'
              : 'bg-gray-50 text-gray-400'
      }`}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        {isActive ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isDone ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        ) : isStopped ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          icon
        )}
      </span>
      <span className="shrink-0 font-medium">{label}</span>
      <span className="min-w-0 truncate text-gray-500">{detail}</span>
    </div>
  );
}

export function WorkspaceAnalysisProcessContent({ processData }: { processData: AnalysisProcessData }) {
  const primaryMetrics = processData.metrics.slice(0, 3).join('、') || '核心指标';
  const primaryDimensions = processData.dimensions.slice(0, 3).join('、') || '默认维度';
  const timeScopeText = processData.timeRange ? `，时间范围锁定为${processData.timeRange}` : '';
  const thoughtText =
    processData.thoughtItems[0] ??
    `需要围绕“${processData.question}”先确定指标口径，再按${primaryDimensions}拆解变化并寻找主要贡献因素。`;
  const actionText = `行动：先确认${primaryMetrics}的诊断口径${timeScopeText}，再检索知识依据、查询数据并生成实时结果。`;
  const knowledgeTarget =
    processData.knowledgeHits[0]?.documentTitle ?? '知识文档、规则口径和合规说明';
  const skillTarget =
    processData.skillMatches.slice(0, 2).map((skill) => skill.name).join('、') ||
    processData.mcpMatches.slice(0, 2).map((capability) => capability.name).join('、') ||
    '分析能力与工具链';
  const visibleStepCount = Math.min(
    Math.max(processData.visibleStepCount ?? 6, 1),
    6,
  );
  const toolVisibleCount =
    processData.status === 'completed'
      ? 5
      : Math.max(0, Math.min(visibleStepCount - 1, 5));
  const tools = [
    {
      label: '正在搜索',
      doneLabel: '已搜索',
      detail: knowledgeTarget,
      icon: <Search className="h-4 w-4" />,
    },
    {
      label: '正在查询',
      doneLabel: '已查询',
      detail: `${processData.datasetName} · ${primaryMetrics}`,
      icon: <Database className="h-4 w-4" />,
    },
    {
      label: '正在调用',
      doneLabel: '已调用',
      detail: skillTarget,
      icon: <Wrench className="h-4 w-4" />,
    },
    {
      label: '正在生成',
      doneLabel: '已生成',
      detail: '取数 SQL 与维度下钻路径',
      icon: <FileSearch className="h-4 w-4" />,
    },
    {
      label: '正在总结',
      doneLabel: '已总结',
      detail: processData.resultPreview.title,
      icon: <Sparkles className="h-4 w-4" />,
    },
  ];

  return (
    <div className="space-y-3 px-1 py-1" data-process-layout="workspace-v2">
      <div className="text-sm font-medium leading-6 text-gray-800">
        已接收到你的任务，将立即开始处理...
      </div>

      <div className="rounded-xl bg-gray-100 px-4 py-3 text-sm leading-6 text-gray-700">
        <div className="mb-1.5 flex items-center gap-2 font-semibold text-gray-900">
          <Sparkles className="h-4 w-4 text-gray-500" />
          思考过程
        </div>
        <div>思考：{thoughtText}</div>
        <div className="mt-1 text-gray-600">{actionText}</div>
      </div>

      {toolVisibleCount > 0 && (
        <div className="flex flex-col items-start gap-2">
          {tools.slice(0, toolVisibleCount).map((tool, index) => {
            const state = getWorkspaceProcessState(
              processData.status,
              index + 1,
              visibleStepCount,
            );
            const label = state === 'done' ? tool.doneLabel : tool.label;

            return (
              <WorkspaceProcessItem
                key={tool.label}
                icon={tool.icon}
                label={label}
                detail={tool.detail}
                state={state}
              />
            );
          })}
        </div>
      )}

      {processData.status === 'running' && (
        <div className="flex items-center gap-1 px-1 pt-1 text-blue-500">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-300 animate-pulse" />
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse [animation-delay:160ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-blue-700 animate-pulse [animation-delay:320ms]" />
        </div>
      )}
    </div>
  );
}

function AnalysisCard({
  message,
  onRerunSkill,
  onRetry,
  forceExpanded = false,
  processVariant = 'timeline',
}: {
  message: Message;
  onRerunSkill?: (skillId: string) => void;
  onRetry?: () => void;
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

    if (message.analysisProcess.status === 'completed') {
      setExpanded(false);
      return;
    }

    setExpanded(true);
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
      return <WorkspaceAnalysisProcessContent processData={message.analysisProcess} />;
    }

    const displayStatus = message.analysisProcess.status;
    const title = getAnalysisProcessTitle(displayStatus);

    return (
      <div className="space-y-1">
        <div className="overflow-hidden rounded-t-[12px] rounded-b-[16px] border border-[#e5e6eb] bg-white">
          <button
            onClick={() => {
              if (!forceExpanded) setExpanded((current) => !current);
            }}
            className="flex w-full items-center justify-between gap-3 bg-[#e8f3ff] p-4 text-left"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-base font-medium leading-6 text-[#1d2129]">{title}</span>
              {displayStatus === 'running' ? (
                <span className="flex items-center gap-1" aria-label="正在进行">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#4e83ea] animate-pulse" />
                  <span className="h-1.5 w-1.5 rounded-full bg-[#4e83ea] animate-pulse [animation-delay:160ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-[#4e83ea] animate-pulse [animation-delay:320ms]" />
                </span>
              ) : null}
            </div>
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[#86909c] hover:bg-white/60"
              aria-label={isExpanded ? '收起分析过程' : '展开分析过程'}
            >
              <img
                alt=""
                src={arrowUpSLineIcon}
                className={`h-6 w-6 transition-transform ${isExpanded ? '' : 'rotate-180'}`}
              />
            </span>
          </button>
          {isExpanded && (
            <FigmaAnalysisProcessContent
              processData={message.analysisProcess}
              routingTrace={message.routingTrace}
              onRetry={onRetry}
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
                const templateBadge =
                  message.matchedReportTemplateName && step.includes('匹配全局报告模板库')
                    ? `模板：${message.matchedReportTemplateName}`
                    : undefined;

                return (
                  <AnalysisTimelineStep
                    key={step}
                    index={index}
                    title={step}
                    badge={templateBadge}
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

function BaseChart({ title, data }: { title: string; data: { name: string; value: number }[] }) {
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
          <div className="text-xs leading-5 text-[#4e5969]">金额</div>
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

function AskResultCard({
  message,
  onQuestionClick,
  onRegenerate,
  onRerunSkill,
}: {
  message: Message;
  onQuestionClick?: (question: string) => void;
  onRegenerate?: (messageId: string) => void;
  onRerunSkill?: (skillId: string) => void;
}) {
  const recommendations = message.analysisResult?.recommendations ?? [];
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null);

  if (!message.analysisResult) return null;

  const actionButtonClassName =
    'inline-flex h-8 w-8 items-center justify-center rounded bg-white p-2 text-gray-500 hover:bg-[#f7f8fa]';

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

      {recommendations.length > 0 && (
        <div className="grid gap-4">
          {recommendations.map((question) => (
            <button
              key={question}
              onClick={() => onQuestionClick?.(question)}
              className="flex w-full items-center justify-between rounded-[8px] border border-[#e5e6eb] bg-white px-4 py-2 text-left text-sm font-normal leading-[22px] text-[#1d2129] hover:border-[#c9cdd4] hover:bg-[#f7f8fa]"
            >
              <span className="min-w-0 truncate">{question}</span>
              <img alt="" src={arrowRightUpLineIcon} className="ml-3 h-4 w-4 shrink-0" />
            </button>
          ))}
        </div>
      )}
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

      {recommendations.length > 0 && (
        <div className="grid max-w-3xl gap-2">
          {recommendations.map((question) => (
            <button
              key={question}
              onClick={() => onQuestionClick?.(question)}
              className="w-fit max-w-3xl whitespace-normal rounded-md border border-gray-200 bg-white px-3.5 py-2 text-left text-[13px] leading-5 text-gray-600 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900"
            >
              {question}
            </button>
          ))}
        </div>
      )}
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
  const { reportTemplates } = useWorkspace();
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null);
  const [isSubscriptionDialogOpen, setIsSubscriptionDialogOpen] = useState(false);

  if (!result) return null;

  const matchedTemplate =
    reportTemplates.find((template) => template.id === result.templateUsage?.templateId) ?? null;

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
        <button
          type="button"
          onClick={() => setIsSubscriptionDialogOpen(true)}
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
            onClick={() => setIsSubscriptionDialogOpen(true)}
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
  onQuestionClick,
  onRegenerate,
  onRerunSkill,
  onClarificationSelect,
  forceAnalysisExpanded,
  analysisProcessVariant,
}: {
  message: Message;
  onQuestionClick?: (question: string) => void;
  onRegenerate?: (messageId: string) => void;
  onRerunSkill?: (skillId: string) => void;
  onClarificationSelect?: (question: string, agentId: string) => void;
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

  if (message.kind === 'analysis') {
    return (
      <AnalysisCard
        message={message}
        onRerunSkill={onRerunSkill}
        onRetry={onRegenerate ? () => onRegenerate(message.id) : undefined}
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
      onQuestionClick={onQuestionClick}
      onRegenerate={onRegenerate}
      onRerunSkill={onRerunSkill}
    />
  );
}
