import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronsRight,
  Download,
  Eye,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react';
import type { AnalysisProcessData, AnalysisReferenceSource, DeepAnalysisActivityId, Message } from '../types';
import {
  Tooltip as AppTooltip,
  TooltipContent,
  TooltipTrigger,
} from './ui/tooltip';
import copyLineIcon from '../../assets/figma-ask/file-copy-line.svg';

type DeepAnalysisWorkbenchProps = {
  processMessage: Message;
  resultMessage?: Message | null;
  variant?: 'deep-analysis' | 'report';
  workbenchLabel?: string;
  stage: DeepAnalysisStage;
  tab: DeepAnalysisWorkbenchTab;
  selectedActivityId: DeepAnalysisActivityId;
  previewedFileMessageId: string | null;
  onRegenerate?: (messageId: string) => void;
  onClose: () => void;
  onTabChange: (tab: DeepAnalysisWorkbenchTab) => void;
  onPreviewedFileMessageIdChange: (messageId: string | null) => void;
};

export type DeepAnalysisStage =
  | 'planning'
  | 'researching'
  | 'querying'
  | 'drafting'
  | 'completed'
  | 'interrupted';

export type DeepAnalysisWorkbenchTab = 'progress' | 'sources' | 'files';
export type DeepAnalysisFeedback = 'like' | 'dislike';

const AI_REPORT_DISCLAIMER = '内容由 AI 生成，仅供参考，无法保证完全真实';

const workbenchTabs: Array<{ id: DeepAnalysisWorkbenchTab; label: string }> = [
  { id: 'progress', label: '分析进展' },
  { id: 'sources', label: '参考来源' },
  { id: 'files', label: '生成文件' },
];

const stageProgress: Record<DeepAnalysisStage, number> = {
  planning: 20,
  researching: 45,
  querying: 70,
  drafting: 88,
  completed: 100,
  interrupted: 0,
};

const processStepDefinitions: Array<{ id: DeepAnalysisActivityId; label: string }> = [
  { id: 'understand-intent', label: '理解用户问题' },
  { id: 'plan-analysis', label: '规划分析任务' },
  { id: 'resolve-data-scope', label: '确定数据口径' },
  { id: 'load-skills', label: '匹配分析能力' },
  { id: 'execute-skills', label: '调用 Skill 和 MCP' },
  { id: 'retrieve-knowledge', label: '检索知识依据' },
  { id: 'execute-query', label: '执行数据查询' },
  { id: 'draft-report', label: '生成分析报告' },
];

export function getCurrentDeepAnalysisActivityId(
  processMessage: Message,
  stage: DeepAnalysisStage,
  variant: 'deep-analysis' | 'report' = 'deep-analysis',
): DeepAnalysisActivityId {
  if (variant === 'report' && (stage === 'drafting' || stage === 'completed')) return 'draft-report';
  if (variant === 'report' && stage === 'interrupted' && processMessage.analysisProcess?.status === 'completed') {
    return 'draft-report';
  }

  const visibleStepCount = processMessage.analysisProcess?.visibleStepCount
    ?? processMessage.analysisProcess?.steps?.length
    ?? 1;
  const processActivityCount = processStepDefinitions.length - 1;
  const currentIndex = Math.min(Math.max(visibleStepCount - 1, 0), processActivityCount - 1);
  return processStepDefinitions[currentIndex].id;
}

export function getWorkbenchTabForActivity(
  _activityId: DeepAnalysisActivityId,
): DeepAnalysisWorkbenchTab {
  return 'progress';
}

function getVisibleMarkdown(message?: Message | null) {
  const content = message?.markdownArtifact?.content ?? '';
  const lines = content ? content.split('\n') : [];
  const visibleLineCount = lines.length
    ? Math.min(Math.max(message?.visibleMarkdownLineCount ?? lines.length, 1), lines.length)
    : 0;

  return {
    totalLineCount: lines.length,
    visibleLineCount,
    content: lines.slice(0, visibleLineCount).join('\n'),
  };
}

export function getDeepAnalysisStage(
  processMessage: Message,
  resultMessage?: Message | null,
  variant: 'deep-analysis' | 'report' = 'deep-analysis',
): DeepAnalysisStage {
  if (
    processMessage.isInterrupted ||
    processMessage.analysisProcess?.status === 'interrupted' ||
    resultMessage?.isInterrupted
  ) {
    return 'interrupted';
  }

  if (resultMessage?.markdownArtifact) {
    const markdown = getVisibleMarkdown(resultMessage);
    return resultMessage.isGenerating || markdown.visibleLineCount < markdown.totalLineCount
      ? 'drafting'
      : 'completed';
  }

  if (resultMessage?.rootCauseResult) {
    return resultMessage.isGenerating ? 'drafting' : 'completed';
  }

  const process = processMessage.analysisProcess;
  const activeStep = [...(process?.steps ?? [])].reverse().find((step) => step.status === 'running')
    ?? (process?.steps ?? []).at(-1);

  if (activeStep?.id === 'retrieve-knowledge') return 'researching';
  if (activeStep?.id === 'execute-query') return 'querying';
  if (activeStep?.id === 'generate-insights') return 'drafting';
  if ((process?.visibleStepCount ?? 1) >= 7) return 'querying';
  if ((process?.visibleStepCount ?? 1) >= 6) return 'researching';
  return 'planning';
}

export function getDeepAnalysisProgress(
  processMessage: Message,
  resultMessage?: Message | null,
) {
  const stage = getDeepAnalysisStage(processMessage, resultMessage);
  const markdown = getVisibleMarkdown(resultMessage);
  const interruptedProgress = Math.min(
    88,
    Math.round(((processMessage.analysisProcess?.visibleStepCount ?? processMessage.analysisProcess?.steps?.length ?? 1) / 7) * 70)
      + (markdown.totalLineCount ? Math.round((markdown.visibleLineCount / markdown.totalLineCount) * 18) : 0),
  );
  const markdownProgress = markdown.totalLineCount
    ? Math.round((markdown.visibleLineCount / markdown.totalLineCount) * 12)
    : 0;

  return {
    ...markdown,
    stage,
    progress: stage === 'drafting' ? 88 + markdownProgress : stage === 'interrupted' ? interruptedProgress : stageProgress[stage],
  };
}

function ActionTooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <AppTooltip delayDuration={240}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={7}
        className="border-0 bg-[#1d2129] px-2.5 py-1 text-xs font-normal text-white shadow-[0_6px_16px_rgba(29,33,41,0.16)]"
      >
        {label}
      </TooltipContent>
    </AppTooltip>
  );
}

function SourceTitle({
  title,
  isKnowledgeDocument,
}: {
  title: string;
  isKnowledgeDocument: boolean;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const titleElement = titleRef.current;
    if (!titleElement) return;

    const updateTruncation = () => {
      setIsTruncated(titleElement.scrollWidth > titleElement.clientWidth);
    };
    updateTruncation();

    const resizeObserver = new ResizeObserver(updateTruncation);
    resizeObserver.observe(titleElement);
    return () => resizeObserver.disconnect();
  }, [title]);

  return (
    <AppTooltip delayDuration={240}>
      <TooltipTrigger asChild>
        <h3
          ref={titleRef}
          className={`truncate text-sm font-medium leading-[22px] ${isKnowledgeDocument ? 'text-[#1d2129]' : 'text-[#1d2129] underline-offset-4 transition-colors group-hover:text-[#165dff] group-hover:underline'}`}
        >
          {title}
        </h3>
      </TooltipTrigger>
      {isTruncated ? (
        <TooltipContent
          side="top"
          sideOffset={7}
          className="rounded-[4px] border-0 bg-[#1d2129] px-3 py-1 font-['PingFang_SC'] text-[14px] font-normal leading-[22px] tracking-normal text-white shadow-none whitespace-nowrap"
        >
          {title}
        </TooltipContent>
      ) : null}
    </AppTooltip>
  );
}

function getQuestionIntentSummary(process?: AnalysisProcessData) {
  const question = process?.question.trim() || '当前问题';
  const primaryMetrics = process?.metrics.slice(0, 3).join('、') || '核心指标';
  const primaryDimensions = process?.dimensions.slice(0, 3).join('、') || '关键业务维度';
  const timeScopeText = process?.timeRange ? `，时间范围锁定为${process.timeRange}` : '';

  return `用户想分析“${question}”背后的业务原因，需要围绕${primaryMetrics}，按${primaryDimensions}拆解变化${timeScopeText}，并结合知识依据与取数结果判断主要驱动因素。`;
}

function StreamingIntentText({ text, streaming }: { text: string; streaming: boolean }) {
  const shouldStream = useRef(streaming);
  const [visibleText, setVisibleText] = useState(streaming ? '' : text);

  useEffect(() => {
    if (!shouldStream.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisibleText(text);
      return;
    }

    let visibleLength = 0;
    setVisibleText('');
    const timer = window.setInterval(() => {
      visibleLength = Math.min(text.length, visibleLength + 3);
      setVisibleText(text.slice(0, visibleLength));
      if (visibleLength >= text.length) window.clearInterval(timer);
    }, 40);

    return () => window.clearInterval(timer);
  }, [text]);

  return (
    <p
      className="min-h-[44px] text-sm leading-[22px] text-[#4e5969]"
      aria-label={text}
    >
      {visibleText}
    </p>
  );
}

function StreamingPlanList({ items, streaming }: { items: string[]; streaming: boolean }) {
  const shouldStream = useRef(streaming);
  const itemSignature = items.join('\n');
  const [visibleItemCount, setVisibleItemCount] = useState(streaming ? 1 : items.length);

  useEffect(() => {
    if (!shouldStream.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisibleItemCount(items.length);
      return;
    }

    let nextVisibleCount = Math.min(1, items.length);
    setVisibleItemCount(nextVisibleCount);
    const timer = window.setInterval(() => {
      nextVisibleCount = Math.min(items.length, nextVisibleCount + 1);
      setVisibleItemCount(nextVisibleCount);
      if (nextVisibleCount >= items.length) window.clearInterval(timer);
    }, 320);

    return () => window.clearInterval(timer);
  }, [itemSignature, items.length]);

  return (
    <div className="min-h-[196px] divide-y divide-[#f2f3f5]" aria-label={items.join('，')}>
      {items.slice(0, visibleItemCount).map((item, index) => (
        <div
          key={item}
          className="animate-in fade-in-0 slide-in-from-top-1 flex gap-3 py-3 duration-200 first:pt-0 last:pb-0 motion-reduce:animate-none"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e8f3ff] text-xs text-[#165dff]">{index + 1}</span>
          <span className="text-sm leading-5 text-[#4e5969]">{item}</span>
        </div>
      ))}
    </div>
  );
}

type ActivityStreamItem = {
  id: string;
  source: string;
  action: string;
  detail: string;
};

function useStreamingItemCount(
  itemIds: string[],
  streaming: boolean,
  intervalMs: number,
) {
  const itemSignature = itemIds.join('\n');
  const [visibleItemCount, setVisibleItemCount] = useState(
    streaming ? Math.min(1, itemIds.length) : itemIds.length,
  );

  useEffect(() => {
    if (!streaming || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisibleItemCount(itemIds.length);
      return;
    }

    let nextVisibleCount = Math.min(1, itemIds.length);
    setVisibleItemCount(nextVisibleCount);
    if (nextVisibleCount >= itemIds.length) return;

    const timer = window.setInterval(() => {
      nextVisibleCount = Math.min(itemIds.length, nextVisibleCount + 1);
      setVisibleItemCount(nextVisibleCount);
      if (nextVisibleCount >= itemIds.length) window.clearInterval(timer);
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [intervalMs, itemIds.length, itemSignature, streaming]);

  return visibleItemCount;
}

function StreamingScopeList({
  items,
  streaming,
}: {
  items: Array<[string, string]>;
  streaming: boolean;
}) {
  const visibleItemCount = useStreamingItemCount(
    items.map(([label]) => label),
    streaming,
    240,
  );

  return (
    <dl className="divide-y divide-[#f2f3f5]" aria-live={streaming ? 'polite' : 'off'}>
      {items.slice(0, visibleItemCount).map(([label, value]) => (
        <div
          key={label}
          className="animate-in fade-in-0 slide-in-from-top-1 grid grid-cols-[88px_minmax(0,1fr)] gap-3 py-3 duration-200 first:pt-0 last:pb-0 motion-reduce:animate-none"
        >
          <dt className="text-sm leading-[22px] text-[#657180]">{label}</dt>
          <dd className="text-sm leading-[22px] text-[#1d2129]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function StreamingActivityList({
  items,
  streaming,
  interrupted = false,
  emptyText,
}: {
  items: ActivityStreamItem[];
  streaming: boolean;
  interrupted?: boolean;
  emptyText: string;
}) {
  const visibleItemCount = useStreamingItemCount(
    items.map((item) => item.id),
    streaming,
    180,
  );

  if (!items.length) {
    return (
      <div className="rounded-[8px] bg-[#f7f8fa] px-3 py-8 text-center text-sm leading-[22px] text-[#657180]">
        {emptyText}
      </div>
    );
  }

  return (
    <div
      className="space-y-2"
      role="log"
      aria-live={streaming ? 'polite' : 'off'}
      aria-label="分析步骤执行记录"
    >
      {items.slice(0, visibleItemCount).map((item, index) => {
        const isCurrent = streaming && index === visibleItemCount - 1;
        const isInterrupted = interrupted && index === visibleItemCount - 1;

        return (
          <div
            key={item.id}
            className={`animate-in fade-in-0 slide-in-from-top-1 grid min-w-0 grid-cols-[48px_minmax(0,1fr)_20px] items-start gap-x-2 gap-y-1 rounded-[8px] px-3 py-2 duration-200 motion-reduce:animate-none sm:grid-cols-[56px_72px_minmax(0,1fr)_20px] sm:gap-y-0 ${isCurrent ? 'bg-[#f2f7ff]' : 'bg-[#f7f8fa]'}`}
            aria-current={isCurrent ? 'step' : undefined}
          >
            <span className="col-start-1 row-start-1 text-sm font-medium leading-[22px] text-[#1d2129] sm:col-start-auto sm:row-start-auto">{item.source}</span>
            <span className="col-start-2 row-start-1 text-sm leading-[22px] text-[#4e5969] sm:col-start-auto sm:row-start-auto">{item.action}</span>
            <span className="col-span-2 col-start-1 row-start-2 min-w-0 text-sm leading-[22px] text-[#657180] sm:col-span-1 sm:col-start-auto sm:row-start-auto">{item.detail}</span>
            <span
              className={`col-start-3 row-start-1 flex h-[22px] w-5 items-center justify-end sm:col-start-auto sm:row-start-auto ${isInterrupted ? 'text-[#f53f3f]' : isCurrent ? 'text-[#165dff]' : 'text-[#00b42a]'}`}
              aria-label={isInterrupted ? '已中断' : isCurrent ? '进行中' : '已完成'}
            >
              {isInterrupted ? (
                <AlertTriangle className="h-3.5 w-3.5" />
              ) : isCurrent ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MarkdownDocument({ content }: { content: string }) {
  const lines = content.split('\n');

  return (
    <article className="mx-auto max-w-[760px] space-y-2 text-sm font-normal leading-6 text-[#4e5969]">
      {lines.map((line, index) => {
        const key = `${index}-${line}`;
        const trimmed = line.trim();

        if (!trimmed) return null;
        if (trimmed.startsWith('# ')) {
          return <h1 key={key} className="pb-1 text-[22px] font-medium leading-8 text-[#1d2129]">{trimmed.slice(2)}</h1>;
        }
        if (trimmed.startsWith('## ')) {
          return <h2 key={key} className="border-b border-[#e5e6eb] pb-1.5 pt-4 text-[18px] font-medium leading-[26px] text-[#1d2129]">{trimmed.slice(3)}</h2>;
        }
        if (trimmed.startsWith('### ')) {
          return <h3 key={key} className="pt-2 text-[15px] font-medium leading-6 text-[#1d2129]">{trimmed.slice(4)}</h3>;
        }
        if (trimmed.startsWith('- ')) {
          return (
            <div key={key} className="flex gap-2.5">
              <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#165dff]" />
              <span className="min-w-0">{trimmed.slice(2)}</span>
            </div>
          );
        }
        return <p key={key}>{trimmed}</p>;
      })}
    </article>
  );
}

function getStepStatus(processMessage: Message, stage: DeepAnalysisStage, index: number) {
  const process = processMessage.analysisProcess;
  if (index === processStepDefinitions.length - 1) {
    if (stage === 'completed') return 'completed';
    if (stage === 'drafting') return 'running';
    if (stage === 'interrupted' && process?.status === 'completed') return 'interrupted';
    return 'pending';
  }
  if (process?.status === 'interrupted') {
    return index < (process.visibleStepCount ?? 1) - 1 ? 'completed' : index === (process.visibleStepCount ?? 1) - 1 ? 'interrupted' : 'pending';
  }
  if (process?.status === 'completed') return 'completed';
  const visibleStepCount = process?.visibleStepCount ?? process?.steps?.length ?? 1;
  if (index < visibleStepCount - 1) return 'completed';
  if (index === visibleStepCount - 1) return 'running';
  return 'pending';
}

function ActivityDetailPanel({
  processMessage,
  resultMessage,
  stage,
  activityId,
  variant,
  onRetry,
}: {
  processMessage: Message;
  resultMessage?: Message | null;
  stage: DeepAnalysisStage;
  activityId: DeepAnalysisActivityId;
  variant: 'deep-analysis' | 'report';
  onRetry?: () => void;
}) {
  const [isSqlCopied, setIsSqlCopied] = useState(false);
  const sqlCopyFeedbackTimerRef = useRef<number | null>(null);
  const process = processMessage.analysisProcess;
  const metrics = process?.metrics ?? [];
  const dimensions = process?.dimensions ?? [];
  const hits = process?.knowledgeHits ?? [];
  const skills = process?.skillMatches ?? [];
  const mcpTools = process?.mcpMatches ?? [];
  const isWebTask = hits.some((hit) => /网页|官网|外部|http|政策法规/i.test(`${hit.documentSource} ${hit.documentType}`))
    || mcpTools.some((mcp) => /网页|搜索|浏览|web|browser/i.test(`${mcp.name} ${mcp.serverName}`));
  const activityIndex = Math.max(0, processStepDefinitions.findIndex((step) => step.id === activityId));
  const status = getStepStatus(processMessage, stage, activityIndex);
  const statusLabel = status === 'completed' ? '已完成' : status === 'running' ? '进行中' : status === 'interrupted' ? '已中断' : '等待中';
  const capabilityExecutionTitle = skills.length && mcpTools.length
    ? '调用 Skill 和 MCP'
    : mcpTools.length
      ? '调用 MCP 工具'
      : skills.length
        ? '调用 Skill'
        : '执行分析任务';
  const title = activityId === 'retrieve-knowledge' && isWebTask
    ? '搜索并浏览网页'
    : activityId === 'execute-skills'
      ? capabilityExecutionTitle
      : activityId === 'draft-report' && variant === 'report'
        ? '生成分析报告'
        : processStepDefinitions[activityIndex]?.label ?? '步骤详情';
  const planItems = [
    '确认数据集、指标、维度和时间范围',
    '调用本次分析所需的 Skill 和 MCP 工具',
    '检索分析依据，查阅内部知识文档，无结果再联网查询',
    ...(variant === 'report'
      ? ['执行数据查询和维度下钻', '整理证据并生成分析报告']
      : ['执行数据查询、生成图表并整理分析结论']),
  ];
  const questionIntentSummary = getQuestionIntentSummary(process);

  useEffect(() => () => {
    if (sqlCopyFeedbackTimerRef.current) {
      window.clearTimeout(sqlCopyFeedbackTimerRef.current);
    }
  }, []);

  const handleCopySql = () => {
    if (!process?.sql || !navigator.clipboard) return;

    void navigator.clipboard.writeText(process.sql);
    setIsSqlCopied(true);
    if (sqlCopyFeedbackTimerRef.current) {
      window.clearTimeout(sqlCopyFeedbackTimerRef.current);
    }
    sqlCopyFeedbackTimerRef.current = window.setTimeout(() => setIsSqlCopied(false), 1600);
  };

  let content: ReactNode;
  if (activityId === 'understand-intent') {
    content = (
      <StreamingIntentText
        key={`${processMessage.id}-${processMessage.timestamp.getTime()}`}
        text={questionIntentSummary}
        streaming={status === 'running'}
      />
    );
  } else if (activityId === 'plan-analysis') {
    content = (
      <StreamingPlanList
        key={`${processMessage.id}-${processMessage.timestamp.getTime()}`}
        items={planItems}
        streaming={status === 'running'}
      />
    );
  } else if (activityId === 'resolve-data-scope') {
    const scopeFilters = process?.filters ?? [];
    const metadataLabels = ['时间范围', '时间粒度', '时间字段', '业务主题'];
    const getMetadataValue = (label: string) => {
      const prefix = `${label}：`;
      return scopeFilters.find((filter) => filter.startsWith(prefix))?.slice(prefix.length).trim();
    };
    const appliedFilters = scopeFilters.filter(
      (filter) => !metadataLabels.some((label) => filter.startsWith(`${label}：`)),
    );
    const scopeItems: Array<[string, string]> = [
      ['数据集', process?.datasetName || '待确认'],
      ['指标', metrics.join('、') || '待确认'],
      ['维度', dimensions.join('、') || '待确认'],
      ['时间范围', process?.timeRange || getMetadataValue('时间范围') || '待确认'],
      ['筛选条件', appliedFilters.join('、') || '无额外筛选'],
    ];
    content = (
      <StreamingScopeList
        key={`${processMessage.id}-${activityId}`}
        items={scopeItems}
        streaming={status === 'running'}
      />
    );
  } else if (activityId === 'load-skills') {
    const capabilityItems: ActivityStreamItem[] = [
      ...skills.map((skill) => ({
        id: `match-skill-${skill.id}`,
        source: 'Skill',
        action: '匹配能力',
        detail: `${skill.name}${skill.description ? ` · ${skill.description}` : ''}`,
      })),
      ...mcpTools.map((mcp) => ({
        id: `match-mcp-${mcp.id}`,
        source: 'MCP',
        action: '匹配能力',
        detail: `${mcp.serverName}${mcp.name && mcp.name !== mcp.serverName ? ` · ${mcp.name}` : ''}`,
      })),
    ];
    content = (
      <StreamingActivityList
        key={`${processMessage.id}-${activityId}`}
        items={capabilityItems}
        streaming={status === 'running'}
        interrupted={status === 'interrupted'}
        emptyText="当前任务未匹配到额外 Skill 或 MCP 工具"
      />
    );
  } else if (activityId === 'execute-skills') {
    const demoWebActivities = [
      {
        id: 'demo-search-web',
        action: '搜索网页',
        detail: `检索“${process?.question || '门急诊收入环比变化'}”相关行业口径、政策和公开数据`,
      },
      {
        id: 'demo-browse-web',
        action: '浏览',
        detail: '浏览国家卫生健康委员会医疗服务统计与医院运营管理相关公开资料',
      },
    ];
    const executionItems: ActivityStreamItem[] = skills.length || mcpTools.length ? [
      ...skills.map((skill) => ({
        id: `execute-skill-${skill.id}`,
        source: 'Skill',
        action: '读取技能',
        detail: `${skill.name} · ${skill.description || `应用${skill.name}的分析规则与输出要求`}`,
      })),
      ...mcpTools.map((mcp) => ({
        id: `execute-mcp-${mcp.id}`,
        source: 'MCP',
        action: mcp.status === '跳过' ? '跳过工具' : '执行任务',
        detail: `${mcp.name}${mcp.reason ? ` · ${mcp.reason}` : ''}`,
      })),
      ...demoWebActivities.map((activity) => ({
        id: activity.id,
        source: 'MCP',
        action: activity.action,
        detail: activity.detail,
      })),
    ] : [];
    content = (
      <StreamingActivityList
        key={`${processMessage.id}-${activityId}`}
        items={executionItems}
        streaming={status === 'running'}
        interrupted={status === 'interrupted'}
        emptyText="本次无需调用额外 Skill 或 MCP 工具"
      />
    );
  } else if (activityId === 'retrieve-knowledge') {
    const knowledgeActivities = status === 'pending'
      ? [{
          id: 'prepare-knowledge-search',
          action: '准备检索',
          detail: `将围绕“${process?.question || '当前分析问题'}”查询业务口径、管理规则和分析依据`,
        }]
      : [
          {
            id: 'search-knowledge-base',
            action: '检索文档',
            detail: `在已配置知识库中检索“${process?.question || '当前分析问题'}”相关业务口径、管理规则和分析依据`,
          },
          ...hits.map((hit) => ({
            id: `browse-${hit.id}`,
            action: '浏览文档',
            detail: `查阅《${hit.documentTitle}》 · ${hit.knowledgeBaseName}${hit.matchedKeywords.length ? ` · 命中：${hit.matchedKeywords.slice(0, 3).join('、')}` : ''}`,
          })),
        ];

    if (status === 'completed') {
      knowledgeActivities.push({
        id: 'organize-knowledge-evidence',
        action: '整理依据',
        detail: hits.length
          ? `已整理 ${hits.length} 条可引用知识依据，并按匹配关键词与置信度完成排序`
          : '内部知识库未命中可用依据，后续将按需联网查询',
      });
    } else if (status === 'interrupted') {
      knowledgeActivities.push({
        id: 'knowledge-search-interrupted',
        action: '检索中断',
        detail: `已保留 ${hits.length} 条检索记录，可重新分析后继续`,
      });
    }

    const knowledgeItems: ActivityStreamItem[] = knowledgeActivities.map((activity) => ({
      ...activity,
      source: '知识库',
    }));
    content = (
      <StreamingActivityList
        key={`${processMessage.id}-${activityId}`}
        items={knowledgeItems}
        streaming={status === 'running'}
        interrupted={status === 'interrupted'}
        emptyText="本次分析未检索到额外知识依据"
      />
    );
  } else if (activityId === 'execute-query') {
    content = (
      <div>
        {process?.sql ? (
          <div className="relative max-h-80 rounded-[8px] bg-[#f7f8fa]">
            <AppTooltip delayDuration={240}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={`absolute right-3 top-3 z-10 inline-flex h-7 items-center justify-center gap-1 rounded-md text-xs transition-colors ${isSqlCopied ? 'bg-[#e8f8ee] px-2 text-[#00b42a]' : 'w-7 text-[#86909c] hover:bg-white hover:text-[#4e5969]'}`}
                  onClick={handleCopySql}
                  aria-label={isSqlCopied ? 'SQL 已复制' : '复制 SQL'}
                >
                  {isSqlCopied ? <><CheckCircle2 className="h-4 w-4" /><span>已复制</span></> : <img alt="" src={copyLineIcon} className="h-4 w-4" />}
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                align="center"
                sideOffset={8}
                showArrow={false}
                className="relative rounded-[4px] bg-[#1d2129] px-3 py-1 text-center text-sm font-normal leading-[22px] text-white whitespace-nowrap shadow-none"
              >
                {isSqlCopied ? '已复制' : '复制 SQL'}
                <span aria-hidden="true" className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-[5px] border-t-[4px] border-x-transparent border-t-[#1d2129]" />
              </TooltipContent>
            </AppTooltip>
            <pre className="max-h-80 overflow-auto whitespace-pre p-3 pr-20 font-mono text-[13px] leading-5 text-[#4e5969]">{process.sql}</pre>
          </div>
        ) : (
          <div className="rounded-[8px] bg-[#f7f8fa] px-3 py-8 text-center text-sm text-[#86909c]">查询语句尚未生成</div>
        )}
      </div>
    );
  } else if (variant === 'report') {
    const reportFileName = resultMessage?.markdownArtifact?.fileName ?? '分析报告.md';
    const markdown = getVisibleMarkdown(resultMessage);
    const reportActivities: ActivityStreamItem[] = [
      {
        id: 'create-report-file',
        source: '报告',
        action: '创建文件',
        detail: reportFileName,
      },
      {
        id: 'organize-report-structure',
        source: '报告',
        action: '组织结构',
        detail: '汇总数据查询结果、分析结论与参考依据',
      },
      {
        id: 'write-report-content',
        source: '报告',
        action: '写入内容',
        detail: markdown.totalLineCount
          ? `正在生成报告正文，已写入 ${markdown.visibleLineCount}/${markdown.totalLineCount} 行`
          : '正在生成报告正文',
      },
    ];

    content = (
      <StreamingActivityList
        key={`${processMessage.id}-draft-report`}
        items={reportActivities}
        streaming={status === 'running'}
        interrupted={status === 'interrupted'}
        emptyText="正在准备报告文件"
      />
    );
  } else {
    content = (
      <div className="rounded-[8px] border border-dashed border-[#c9cdd4] bg-white px-4 py-8 text-center text-sm leading-6 text-[#86909c]">
        图表和分析结论已展示在左侧“执行数据查询”步骤下方
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-medium leading-[22px] text-[#1d2129]">{title}</h2>
          </div>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-[6px] px-2 py-1 text-xs ${status === 'completed' ? 'bg-[#e8f8ee] text-[#00b42a]' : status === 'running' ? 'bg-[#e8f3ff] text-[#165dff]' : status === 'interrupted' ? 'bg-[#fff2f0] text-[#f53f3f]' : 'bg-[#f2f3f5] text-[#657180]'}`} aria-live="polite">
          {status === 'running' ? <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" /> : null}
          {statusLabel}
        </span>
      </div>
      <div className="mt-4 border-t border-[#f2f3f5] pt-4">{content}</div>
      {stage === 'interrupted' && onRetry ? <button type="button" onClick={onRetry} className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-[8px] bg-[#165dff] px-3 text-sm font-normal text-white hover:bg-[#0e42d2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/25"><RefreshCw className="h-3.5 w-3.5" />重新分析</button> : null}
    </div>
  );
}

function SourcesPanel({ processMessage, stage }: { processMessage: Message; stage: DeepAnalysisStage }) {
  const process = processMessage.analysisProcess;
  const hits = process?.knowledgeHits ?? [];
  const isSearching = stage === 'planning' || stage === 'researching';
  const isInterrupted = stage === 'interrupted';
  const fallbackStartedAt = processMessage.timestamp.getTime();
  const fallbackKnowledgeSources: AnalysisReferenceSource[] = hits
    .filter((hit, index, allHits) => allHits.findIndex((item) => item.documentId === hit.documentId) === index)
    .map((hit, index) => ({
      id: `knowledge-${hit.id}`,
      kind: 'knowledge-document',
      title: hit.documentTitle,
      source: `${hit.knowledgeBaseName} · ${hit.documentSource}`,
      summary: hit.summary,
      usedAt: new Date(fallbackStartedAt + index * 1000).toISOString(),
      documentType: hit.documentType,
      citationReason: hit.citationReason,
    }));
  const fallbackWebSources: AnalysisReferenceSource[] = [
    {
      id: 'web-nhc-official',
      kind: 'webpage',
      title: '国家卫生健康委员会官方网站',
      source: '国家卫生健康委员会',
      summary: '医疗服务与卫生健康统计公开信息。',
      usedAt: new Date(fallbackStartedAt + (hits.length + 1) * 1000).toISOString(),
      url: 'https://www.nhc.gov.cn/',
    },
    {
      id: 'web-nhsa-official',
      kind: 'webpage',
      title: '国家医疗保障局官方网站',
      source: '国家医疗保障局',
      summary: '医保政策与医疗服务管理公开信息。',
      usedAt: new Date(fallbackStartedAt + (hits.length + 2) * 1000).toISOString(),
      url: 'https://www.nhsa.gov.cn/',
    },
  ];
  const sources = process?.referenceSources?.length
    ? process.referenceSources
    : [...fallbackKnowledgeSources, ...fallbackWebSources];
  const sourceKeys = new Set<string>();
  const uniqueSources = sources.filter((source) => {
    const key = source.kind === 'knowledge-document'
      ? `${source.kind}:${source.title}:${source.source}`
      : `${source.kind}:${source.url ?? source.id}`;
    if (sourceKeys.has(key)) return false;
    sourceKeys.add(key);
    return true;
  });
  const orderedSources = [...uniqueSources].sort(
    (left, right) => Date.parse(left.usedAt) - Date.parse(right.usedAt),
  );

  if (!orderedSources.length) {
    return (
      <div className="rounded-[12px] border border-dashed border-[#c9cdd4] bg-white px-5 py-14 text-center">
        {isSearching ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-[#165dff] motion-reduce:animate-none" /> : isInterrupted ? <AlertTriangle className="mx-auto h-5 w-5 text-[#f53f3f]" /> : <Search className="mx-auto h-5 w-5 text-[#86909c]" />}
        <div className="mt-3 text-sm font-medium text-[#1d2129]">{isSearching ? '正在检索参考来源' : isInterrupted ? '检索任务已中断' : '本次分析未引用额外来源'}</div>
        <div className="mt-1 text-xs leading-[18px] text-[#86909c]">来源将按分析使用时间依次展示</div>
      </div>
    );
  }

  return (
    <div>
      <div className="divide-y divide-[#f2f3f5] overflow-hidden rounded-[12px] border border-[#e5e6eb] bg-white">
        {orderedSources.map((source) => {
          const isKnowledgeDocument = source.kind === 'knowledge-document';
          const renderSourceContent = (title: ReactNode) => (
            <>
              <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] transition-colors ${isKnowledgeDocument ? 'bg-[#e8f3ff] text-[#165dff]' : 'bg-[#f2f3f5] text-[#657180] group-hover:bg-[#e8f3ff] group-hover:text-[#165dff]'}`} aria-hidden="true">
                {isKnowledgeDocument ? <FileText className="h-3.5 w-3.5" /> : <ExternalLink className="h-3.5 w-3.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  {title}
                  <span className="shrink-0 text-xs leading-[18px] text-[#86909c]">{isKnowledgeDocument ? '知识文档' : '外部网页'}</span>
                </div>
              </div>
            </>
          );

          return (
            <article key={source.id} className={isKnowledgeDocument ? 'px-4 py-3' : ''}>
              {isKnowledgeDocument ? (
                <div className="flex items-center gap-3">
                  {renderSourceContent(
                    <SourceTitle title={source.title} isKnowledgeDocument />,
                  )}
                </div>
              ) : (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[#f7f8fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#165dff]/25"
                  aria-label={`在新标签页打开网页：${source.title}`}
                >
                  {renderSourceContent(
                    <SourceTitle title={source.title} isKnowledgeDocument={false} />,
                  )}
                </a>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function downloadMarkdownArtifact(message?: Message | null) {
  if (!message?.markdownArtifact) return;
  const reportContent = message.markdownArtifact.content.trimEnd();
  const downloadContent = reportContent.includes(AI_REPORT_DISCLAIMER)
    ? reportContent
    : `${reportContent}\n\n---\n\n> ${AI_REPORT_DISCLAIMER}\n`;
  const blob = new Blob([downloadContent], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = message.markdownArtifact.fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function FilesPanel({
  resultMessage,
  variant,
  onPreview,
}: {
  resultMessage?: Message | null;
  variant: 'deep-analysis' | 'report';
  onPreview: () => void;
}) {
  const markdown = getVisibleMarkdown(resultMessage);
  const hasFile = Boolean(resultMessage?.markdownArtifact);
  const isInterrupted = Boolean(resultMessage?.isInterrupted);
  const isComplete = hasFile && !resultMessage?.isGenerating && !isInterrupted && markdown.visibleLineCount >= markdown.totalLineCount;
  const fileActionButtonClassName = 'inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-[#e5e6eb] bg-white px-3 text-sm font-normal text-[#4e5969] transition-colors hover:bg-[#f2f3f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 disabled:cursor-not-allowed disabled:bg-[#f7f8fa] disabled:text-[#a8abb2]';

  if (!hasFile) {
    return (
      <div className="rounded-[12px] border border-dashed border-[#c9cdd4] bg-white px-5 py-14 text-center">
        <FileText className="mx-auto h-5 w-5 text-[#86909c]" />
        <div className="mt-3 text-sm font-medium leading-[22px] text-[#1d2129]">暂无文件</div>
      </div>
    );
  }

  const progress = Math.round((markdown.visibleLineCount / Math.max(markdown.totalLineCount, 1)) * 100);
  return (
    <div className="rounded-[12px] border border-[#e5e6eb] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-[#e8f3ff] text-[#165dff]"><FileText className="h-5 w-5" /></span>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium leading-[22px] text-[#1d2129]">{resultMessage?.markdownArtifact?.fileName}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onPreview} className={fileActionButtonClassName}><Eye className="h-3.5 w-3.5" />预览</button>
          <button type="button" onClick={() => downloadMarkdownArtifact(resultMessage)} disabled={!isComplete} className={fileActionButtonClassName}><Download className="h-3.5 w-3.5" />下载</button>
        </div>
      </div>
      {!isComplete ? <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#f2f3f5]" role="progressbar" aria-label="文件生成进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div className="h-full rounded-full bg-[#165dff] transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${progress}%` }} /></div> : null}
    </div>
  );
}

function ReportPanel({ resultMessage, onBack }: {
  resultMessage?: Message | null;
  onBack?: () => void;
}) {
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const markdown = getVisibleMarkdown(resultMessage);
  const isGenerating = Boolean(resultMessage?.isGenerating && markdown.content);
  const isInterrupted = Boolean(resultMessage?.isInterrupted);
  const isComplete = Boolean(resultMessage?.markdownArtifact && !resultMessage?.isGenerating && !resultMessage?.isInterrupted && markdown.visibleLineCount >= markdown.totalLineCount);
  const actionButtonClassName = 'inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#86909c] transition-colors hover:bg-[#f2f3f5] hover:text-[#4e5969] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20';

  useEffect(() => {
    if (!isGenerating || !isNearBottomRef.current) return;
    const container = contentScrollRef.current;
    if (!container) return;
    const frame = window.requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isGenerating, markdown.visibleLineCount]);

  const handleScroll = () => {
    const container = contentScrollRef.current;
    if (!container) return;
    const nextIsNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 72;
    isNearBottomRef.current = nextIsNearBottom;
    setIsNearBottom(nextIsNearBottom);
  };

  const scrollToLatest = () => {
    const container = contentScrollRef.current;
    if (!container) return;
    isNearBottomRef.current = true;
    setIsNearBottom(true);
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  };

  if (!resultMessage?.markdownArtifact) {
    return (
      <div className="rounded-[12px] border border-dashed border-[#c9cdd4] bg-white px-5 py-14 text-center" aria-live="polite">
        <FileText className="mx-auto h-5 w-5 text-[#86909c]" />
        <div className="mt-3 text-sm font-medium text-[#1d2129]">正在等待分析报告</div>
        <div className="mt-1 text-xs leading-[18px] text-[#86909c]">数据查询完成后将自动切换到报告预览</div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[360px] flex-col overflow-hidden rounded-[12px] border border-[#e5e6eb] bg-white">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#e5e6eb] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {onBack ? (
            <>
              <ActionTooltip label="返回">
                <button
                  type="button"
                  onClick={onBack}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#4e5969] transition-colors hover:bg-[#f2f3f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20"
                  aria-label="返回文件列表"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              </ActionTooltip>
              <span className="h-4 w-px shrink-0 bg-[#e5e6eb]" aria-hidden="true" />
            </>
          ) : null}
          <FileText className="h-4 w-4 shrink-0 text-[#165dff]" />
          <span className="truncate text-sm font-medium leading-[22px] text-[#1d2129]">{resultMessage.markdownArtifact.fileName}</span>
          {!isComplete ? isInterrupted ? (
            <span className="shrink-0 rounded-[6px] bg-[#fff2f0] px-2 py-1 text-xs leading-[18px] text-[#f53f3f]">已中断</span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1.5 text-xs leading-[18px] text-[#86909c]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#165dff] motion-reduce:animate-none" aria-hidden="true" />
              生成中
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <ActionTooltip label="下载"><button type="button" onClick={() => downloadMarkdownArtifact(resultMessage)} disabled={!isComplete} className={`${actionButtonClassName} disabled:cursor-not-allowed disabled:opacity-40`} aria-label="下载报告"><Download className="h-4 w-4" /></button></ActionTooltip>
        </div>
      </div>
      <div ref={contentScrollRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto px-5 py-6 md:px-8 md:py-8">
        <MarkdownDocument content={markdown.content} />
        {isInterrupted ? <div className="mx-auto mt-5 flex max-w-[760px] items-center gap-2 rounded-[8px] bg-[#fff2f0] px-3 py-2 text-sm text-[#f53f3f]" role="status"><AlertTriangle className="h-4 w-4" />报告生成已中断，可重新发起分析。</div> : null}
      </div>
      <div className="shrink-0 bg-white px-4 py-1 text-center text-xs leading-4 text-[#a8abb2]" role="note">
        {AI_REPORT_DISCLAIMER}
      </div>
      {isGenerating && !isNearBottom ? <button type="button" onClick={scrollToLatest} className="absolute bottom-14 left-1/2 z-10 -translate-x-1/2 rounded-full border border-[#bedaff] bg-white px-3 py-1.5 text-xs text-[#165dff] shadow-[0_4px_12px_rgba(29,33,41,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20">回到最新</button> : null}
    </div>
  );
}

export function DeepAnalysisWorkbench({
  processMessage,
  resultMessage,
  variant = 'deep-analysis',
  workbenchLabel = '深度分析工作台',
  stage,
  tab,
  selectedActivityId,
  previewedFileMessageId,
  onRegenerate,
  onClose,
  onTabChange,
  onPreviewedFileMessageIdChange,
}: DeepAnalysisWorkbenchProps) {
  const isFilesPreviewOpen = Boolean(
    variant === 'report' && resultMessage?.markdownArtifact && previewedFileMessageId === resultMessage.id,
  );

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const offset = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (index + offset + workbenchTabs.length) % workbenchTabs.length;
    const nextTab = workbenchTabs[nextIndex].id;
    onTabChange(nextTab);
    window.requestAnimationFrame(() => document.getElementById(`deep-analysis-tab-${nextTab}`)?.focus());
  };
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-[12px] border border-[#dde2e8] bg-[#fafbfc] xl:shadow-[-6px_0_18px_rgba(29,33,41,0.04)]">
      <div className="shrink-0 border-b border-[#e5e6eb] bg-white px-4 md:px-5">
        <div className="flex items-center gap-2">
          <div role="tablist" aria-label={workbenchLabel} className="flex min-w-0 flex-1 gap-5 overflow-x-auto">
            {workbenchTabs.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`deep-analysis-tab-${item.id}`}
                aria-selected={tab === item.id}
                aria-controls={`deep-analysis-panel-${item.id}`}
                onClick={() => onTabChange(item.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                tabIndex={tab === item.id ? 0 : -1}
                className={`relative h-10 shrink-0 px-0.5 text-sm font-normal leading-[22px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 ${tab === item.id ? 'text-[#165dff]' : 'text-[#4e5969] hover:text-[#1d2129]'}`}
              >
                {item.label}
                {tab === item.id ? <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#165dff]" /> : null}
              </button>
            ))}
          </div>
          <ActionTooltip label="收起工作台">
            <button
              type="button"
              onClick={onClose}
              className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#86909c] transition-colors hover:bg-[#f2f3f5] hover:text-[#4e5969] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 xl:flex"
              aria-label={`收起${workbenchLabel}`}
            >
              <ChevronsRight aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </ActionTooltip>
        </div>
      </div>

      <div
        role="tabpanel"
        id={`deep-analysis-panel-${tab}`}
        aria-labelledby={`deep-analysis-tab-${tab}`}
        className="relative min-h-0 flex-1 overflow-y-auto bg-[#fafbfc] p-5 md:p-6"
      >
        {tab === 'progress' ? variant === 'report' && selectedActivityId === 'draft-report'
          ? <ReportPanel resultMessage={resultMessage} />
          : <ActivityDetailPanel processMessage={processMessage} resultMessage={resultMessage} stage={stage} activityId={selectedActivityId} variant={variant} onRetry={stage === 'interrupted' && onRegenerate ? () => onRegenerate((resultMessage ?? processMessage).id) : undefined} />
          : null}
        {tab === 'sources' ? <SourcesPanel processMessage={processMessage} stage={stage} /> : null}
        {tab === 'files' ? isFilesPreviewOpen ? (
          <ReportPanel
            resultMessage={resultMessage}
            onBack={() => onPreviewedFileMessageIdChange(null)}
          />
        ) : (
          <FilesPanel
            resultMessage={resultMessage}
            variant={variant}
            onPreview={() => onPreviewedFileMessageIdChange(resultMessage?.id ?? null)}
          />
        ) : null}
      </div>
    </section>
  );
}
