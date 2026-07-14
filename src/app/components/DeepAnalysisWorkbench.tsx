import { useEffect, useRef } from 'react';
import {
  Download,
  ExternalLink,
  FileText,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { Message } from '../types';

type DeepAnalysisWorkbenchProps = {
  message: Message;
  tab?: DeepAnalysisWorkbenchTab;
  feedback?: DeepAnalysisFeedback;
  onFeedbackChange?: (feedback: DeepAnalysisFeedback) => void;
  onRegenerate?: (messageId: string) => void;
  onTabChange?: (tab: DeepAnalysisWorkbenchTab) => void;
};

export type DeepAnalysisWorkbenchTab = 'follow' | 'browser' | 'files';
export type DeepAnalysisFeedback = 'like' | 'dislike';

const workbenchTabs: Array<{ id: DeepAnalysisWorkbenchTab; label: string }> = [
  { id: 'follow', label: '实时结果' },
  { id: 'browser', label: '参考来源' },
  { id: 'files', label: '文件' },
];

function getVisibleMarkdown(message: Message) {
  const content = message.markdownArtifact?.content ?? '';
  const lines = content.split('\n');
  const visibleLineCount = Math.min(
    Math.max(message.visibleMarkdownLineCount ?? lines.length, 1),
    lines.length,
  );

  return {
    totalLineCount: lines.length,
    visibleLineCount,
    content: lines.slice(0, visibleLineCount).join('\n'),
  };
}

function MarkdownDocument({ content }: { content: string }) {
  const lines = content.split('\n');

  return (
    <div className="space-y-3 text-[15px] leading-7 text-gray-700">
      {lines.map((line, index) => {
        const key = `${index}-${line}`;
        const trimmed = line.trim();

        if (!trimmed) {
          return <div key={key} className="h-1" />;
        }

        if (trimmed.startsWith('# ')) {
          return (
            <h1
              key={key}
              className="flex flex-wrap items-center gap-3 pb-2 text-2xl font-semibold leading-8 text-gray-900"
            >
              <span>{trimmed.slice(2)}</span>
            </h1>
          );
        }

        if (trimmed.startsWith('## ')) {
          return (
            <h2
              key={key}
              className="border-b border-gray-200 pb-2 pt-5 text-xl font-semibold leading-7 text-gray-900"
            >
              {trimmed.slice(3)}
            </h2>
          );
        }

        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={key} className="pt-3 text-base font-semibold leading-7 text-gray-900">
              {trimmed.slice(4)}
            </h3>
          );
        }

        if (trimmed.startsWith('- ')) {
          return (
            <div key={key} className="flex gap-2.5">
              <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
              <span className="min-w-0">{trimmed.slice(2)}</span>
            </div>
          );
        }

        return <p key={key}>{trimmed}</p>;
      })}
    </div>
  );
}

function buildReferences() {
  return [
    {
      id: 'nhsa-drg-dip-action-plan',
      title: '国家医疗保障局关于印发DRG/DIP 支付方式改革三年行动计划的通知',
      source: '国家医疗保障局 / 政策法规',
      sourceLabel: '外部来源',
      url: 'https://www.nhsa.gov.cn/art/2021/11/26/art_37_7406.html',
    },
    {
      id: 'outpatient-drug-cost-knowledge-doc',
      title: '门诊药品费用结构分析与药占比治理知识文档',
      source: '知识库 / 经营分析知识文档',
      sourceLabel: '内部来源',
    },
  ];
}

function buildGeneratedFiles(message: Message) {
  return message.markdownArtifact
    ? [
        {
          id: message.markdownArtifact.fileName,
          name: message.markdownArtifact.fileName,
          type: 'Markdown',
          updatedAt: message.timestamp.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ]
    : [];
}

export function downloadMarkdownArtifact(message: Message) {
  if (!message.markdownArtifact) return;

  const blob = new Blob([message.markdownArtifact.content], {
    type: 'text/markdown;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = message.markdownArtifact.fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function getDeepAnalysisProgress(message: Message) {
  const markdown = getVisibleMarkdown(message);

  return {
    ...markdown,
    progress: Math.min(
      100,
      Math.round((markdown.visibleLineCount / Math.max(markdown.totalLineCount, 1)) * 100),
    ),
  };
}

export function DeepAnalysisWorkbench({
  message,
  tab = 'follow',
  feedback,
  onFeedbackChange,
  onRegenerate,
  onTabChange,
}: DeepAnalysisWorkbenchProps) {
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const markdown = getVisibleMarkdown(message);
  const markdownLineCount = message.markdownArtifact?.content.split('\n').length ?? 0;
  const visibleMarkdownLineCount = message.visibleMarkdownLineCount ?? markdownLineCount;
  const isResultComplete =
    markdownLineCount > 0 &&
    visibleMarkdownLineCount >= markdownLineCount &&
    !message.isGenerating &&
    !message.isInterrupted;
  const actionButtonClassName =
    'inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800';

  useEffect(() => {
    if (tab !== 'follow') return;

    const scrollContainer = contentScrollRef.current;
    if (!scrollContainer) return;

    const animationFrame = window.requestAnimationFrame(() => {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [message.id, markdown.visibleLineCount, tab]);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 md:px-5">
        <div className="inline-flex rounded-lg bg-gray-100 p-0.5">
          {workbenchTabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange?.(item.id)}
              className={`h-8 rounded-md px-3.5 text-sm font-medium transition-colors ${
                tab === item.id
                  ? 'bg-white text-gray-900 shadow-[0_1px_2px_rgba(15,23,42,0.08)]'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {isResultComplete && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onFeedbackChange?.('like')}
              className={`${actionButtonClassName} ${
                feedback === 'like'
                  ? 'bg-blue-50 text-blue-600 hover:bg-blue-50 hover:text-blue-600'
                  : ''
              }`}
              aria-label="点赞"
              aria-pressed={feedback === 'like'}
              title="点赞"
            >
              <ThumbsUp className={`h-4 w-4 ${feedback === 'like' ? 'fill-blue-600' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => onFeedbackChange?.('dislike')}
              className={`${actionButtonClassName} ${
                feedback === 'dislike'
                  ? 'bg-red-50 text-red-600 hover:bg-red-50 hover:text-red-600'
                  : ''
              }`}
              aria-label="点踩"
              aria-pressed={feedback === 'dislike'}
              title="点踩"
            >
              <ThumbsDown className={`h-4 w-4 ${feedback === 'dislike' ? 'fill-red-600' : ''}`} />
            </button>
            {onRegenerate && (
              <button
                type="button"
                onClick={() => onRegenerate(message.id)}
                className={actionButtonClassName}
                aria-label="重新生成回答"
                title="重新分析"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      <div
        ref={contentScrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-6 md:py-6"
      >
        {tab === 'browser' ? (
          <DeepAnalysisBrowserPanel />
        ) : tab === 'files' ? (
          <DeepAnalysisFilesPanel message={message} />
        ) : markdown.content ? (
          <MarkdownDocument content={markdown.content} />
        ) : (
          <div className="rounded-md border border-dashed border-gray-200 px-5 py-12 text-center text-sm text-gray-400">
            正在等待分析结果
          </div>
        )}
      </div>
    </section>
  );
}

export function DeepAnalysisBrowserPanel() {
  const references = buildReferences();

  return (
    <div className="space-y-3">
      <div className="text-sm text-gray-500">本次回答参考的资料和知识来源。</div>
      {references.map((reference) => (
        <div
          key={reference.id}
          className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              {reference.url ? (
                <a
                  href={reference.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-gray-900 hover:text-blue-700"
                >
                  {reference.title}
                </a>
              ) : (
                <div className="text-sm font-semibold text-gray-900">{reference.title}</div>
              )}
              <div className="mt-1 text-xs text-gray-500">{reference.source}</div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2.5 py-1 text-xs text-gray-500">
              <ExternalLink className="h-3.5 w-3.5" />
              {reference.sourceLabel}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DeepAnalysisFilesPanel({ message }: { message: Message }) {
  const generatedFiles = buildGeneratedFiles(message);
  const handleDownload = () => {
    downloadMarkdownArtifact(message);
  };

  return (
    <div className="space-y-3">
      <div className="text-sm text-gray-500">本次深度分析生成的文件。</div>
      {generatedFiles.length ? (
        generatedFiles.map((file) => (
          <div
            key={file.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-700">
                <FileText className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-gray-900">{file.name}</div>
                <div className="mt-1 text-xs text-gray-500">{file.type} / {file.updatedAt}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Download className="h-3.5 w-3.5" />
              下载
            </button>
          </div>
        ))
      ) : (
        <div className="rounded-md border border-dashed border-gray-200 px-5 py-12 text-center text-sm text-gray-400">
          暂无生成文件
        </div>
      )}
    </div>
  );
}
