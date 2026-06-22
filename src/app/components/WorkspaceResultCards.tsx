import { type ReactNode, useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { AgentRuntimeConfig, AnalysisProcessData, Message, SkillTrace } from '../types';

const chartColors = ['#2563eb', '#60a5fa', '#93c5fd', '#bfdbfe'];

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
        {message.content || '这个问题可能涉及多个分析范围，请选择一个继续。'}
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
  if (status === 'interrupted') return index < visibleStepCount - 1 ? 'done' : 'stopped';
  if (index < visibleStepCount - 1) return 'done';
  if (index === visibleStepCount - 1) return 'active';
  return 'pending';
}

function getAnalysisProcessTitle(status: AnalysisProcessData['status']) {
  if (status === 'interrupted') {
    return '分析中断';
  }

  if (status === 'completed') {
    return '分析完成';
  }

  return '正在分析';
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

function AnalysisCard({
  message,
  onRerunSkill,
}: {
  message: Message;
  onRerunSkill?: (skillId: string) => void;
}) {
  const [expanded, setExpanded] = useState(() =>
    message.analysisProcess ? message.analysisProcess.status === 'running' : true,
  );
  const visibleMessageStepCount = Math.min(
    Math.max(message.visibleStepCount ?? message.analysisSteps?.length ?? 0, 0),
    message.analysisSteps?.length ?? 0,
  );

  useEffect(() => {
    if (!message.analysisProcess) return;

    if (message.analysisProcess.status === 'running') {
      setExpanded(true);
      return;
    }

    setExpanded(false);
  }, [message.analysisProcess?.status]);

  useEffect(() => {
    if (message.analysisProcess) return;

    if (message.isGenerating) {
      setExpanded(true);
      return;
    }

    setExpanded(false);
  }, [message.analysisProcess, message.isGenerating, message.isInterrupted]);

  if (message.analysisProcess) {
    const title = getAnalysisProcessTitle(message.analysisProcess.status);

    return (
      <div className="space-y-1">
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
          <button
            onClick={() => setExpanded((current) => !current)}
            className="flex w-full items-center justify-between gap-3 border-b border-gray-100 bg-white px-4 py-3 text-left hover:bg-gray-50/70"
          >
            <div className="flex min-w-0 items-center gap-2">
              <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                message.analysisProcess.status === 'running'
                  ? 'bg-blue-50 text-blue-600'
                  : message.analysisProcess.status === 'interrupted'
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-emerald-50 text-emerald-600'
              }`}>
                {message.analysisProcess.status === 'running' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : message.analysisProcess.status === 'interrupted' ? (
                  <AlertTriangle className="h-3.5 w-3.5" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">{title}</span>
                </div>
              </div>
            </div>
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-white hover:text-gray-700"
              aria-label={expanded ? '收起分析过程' : '展开分析过程'}
              title={expanded ? '收起分析过程' : '展开分析过程'}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              )}
            </span>
          </button>
          {expanded && <AnalysisProcessContent processData={message.analysisProcess} />}
        </div>
        {!expanded && message.isAwaitingResult && <ChartLoadingDots />}
      </div>
    );
  }

  const title = getMessageAnalysisTitle(message);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <button
        onClick={() => setExpanded((current) => !current)}
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
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {expanded && (
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
                    title={step}
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
  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="border-b border-gray-100 bg-gray-50/70 px-4 py-3 text-sm font-medium text-gray-900">
        {title}
      </div>
      <div className="h-64 px-4 py-4">
        <ResponsiveContainer width="100%" height="100%">
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
        </ResponsiveContainer>
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

  if (!message.analysisResult) return null;

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
        <div className="px-5 pb-5">
          <BaseChart title="关键指标拆分" data={message.analysisResult.chartData} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          aria-label="复制结论"
          title="复制"
        >
          <Copy className="h-4 w-4" />
        </button>
        {onRegenerate && (
          <button
            type="button"
            onClick={() => onRegenerate(message.id)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="重新生成回答"
            title="重新分析"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
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
  onRerunSkill,
}: {
  message: Message;
  onRegenerate?: (messageId: string) => void;
  onRerunSkill?: (skillId: string) => void;
}) {
  const result = message.reportResult;
  const runtimeConfig = getRuntimeConfig(message);

  if (!result) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
        <div className="border-b border-gray-100 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-base font-medium text-gray-900">{result.title}</div>
              <div className="mt-1 text-sm text-gray-500">{result.period}</div>
              <p className="mt-3 text-sm leading-6 text-gray-600">{result.summary}</p>
              <SingleSkillScopeNote visible={message.resultScope === 'single-skill'} />
            </div>
            <div className="flex items-center gap-2">
              {runtimeConfig.allowExport && (
                <button className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:bg-gray-50">
                  <Download className="h-4 w-4" />
                  导出
                </button>
              )}
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
        </div>

        <div className="grid gap-3 px-5 py-4 md:grid-cols-4">
          {result.keyMetrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
            >
              <div className="text-xs text-gray-500">{metric.label}</div>
              <div className="mt-1 text-lg font-semibold text-gray-900">{metric.value}</div>
            </div>
          ))}
        </div>

        {result.templateUsage && (
          <div className="border-t border-gray-100 px-5 py-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    使用报告模板：{result.templateUsage.name}
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {result.templateUsage.category} / {result.templateUsage.version} / {result.templateUsage.matchReason}
                  </div>
                </div>
                <div className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600">
                  {result.templateUsage.sections.length} 个章节
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <div className="text-xs font-medium text-gray-500">分析章节</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {result.templateUsage.sections.map((section) => (
                      <span key={section} className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600">
                        {section}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-500">指标口径</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {result.templateUsage.metricLabels.map((metric) => (
                      <span key={metric} className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600">
                        {metric}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 text-xs text-gray-600 md:grid-cols-2">
                <div>数据范围：{result.templateUsage.datasetNames.join(' / ') || '-'}</div>
                <div>引用 Skills：{result.templateUsage.skillNames.join(' / ') || '-'}</div>
              </div>

              {!!result.templateUsage.complianceNotes.length && (
                <div className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-xs text-gray-600">
                  {result.templateUsage.complianceNotes.map((note) => (
                    <div key={note}>{note}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

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

        <div className="border-t border-gray-100 px-5 py-5">
          <SkillTraceRow skillTrace={message.skillTrace} onRerunSkill={onRerunSkill} />
        </div>
      </div>
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
}: {
  message: Message;
  onQuestionClick?: (question: string) => void;
  onRegenerate?: (messageId: string) => void;
  onRerunSkill?: (skillId: string) => void;
  onClarificationSelect?: (question: string, agentId: string) => void;
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
    return <AnalysisCard message={message} onRerunSkill={onRerunSkill} />;
  }

  if (message.kind === 'report-result') {
    return (
      <ReportResultCard
        message={message}
        onRegenerate={onRegenerate}
        onRerunSkill={onRerunSkill}
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
