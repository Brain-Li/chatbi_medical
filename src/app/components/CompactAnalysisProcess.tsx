import { useEffect, useId, useRef, useState } from 'react';
import { BrainCircuit, ChevronDown, Copy, Database, FileCode2, FileSearch, Search, Sparkles, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import type { AnalysisProcessStep, Message } from '../types';
import { getCurrentProcessAction, getProcessDisplayStatus, getProcessOverview, getProcessRecords } from '../utils/analysisProcessPresentation';

function stepIcon(id: AnalysisProcessStep['id']) {
  if (id === 'resolve-data-scope' || id === 'execute-query') return Database;
  if (id === 'retrieve-knowledge') return FileSearch;
  if (id === 'generate-query') return FileCode2;
  if (id === 'match-capability' || id === 'load-skills' || id === 'execute-skills') return Wrench;
  return BrainCircuit;
}

function ProcessRecord({ step, message }: { step: AnalysisProcessStep; message: Message }) {
  const process = message.analysisProcess;
  const Icon = stepIcon(step.id);
  const isScope = step.id === 'resolve-data-scope';
  const isCapability = ['match-capability', 'load-skills', 'execute-skills'].includes(step.id);
  const isKnowledge = step.id === 'retrieve-knowledge';
  const isQuery = step.id === 'generate-query' || step.id === 'execute-query';
  const sql = isQuery && message.runtimeConfig?.showSql !== false ? process?.sql : undefined;
  const summary = isScope ? process?.datasetName
    : isCapability ? process?.skillMatches.map((skill) => skill.name).join('、')
    : isKnowledge ? process?.knowledgeHits.map((hit) => hit.documentTitle).join('、')
    : step.id === 'execute-query' ? process?.sqlExecutionMessage
    : undefined;
  const fields = isScope && process ? [
    ['数据集', process.datasetName], ['指标', process.metrics.join('、')],
    ['维度', process.dimensions.join('、')], ['时间范围', process.timeRange],
    ['筛选条件', process.filters?.join('、')],
  ].filter(([, value]) => value) : [];
  return (
    <li className="min-w-0">
      <details className="group/record">
        <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-md px-1 text-[13px] leading-6 text-[#86909c] hover:bg-[#f7f8fa] hover:text-[#4e5969] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/25 [&::-webkit-details-marker]:hidden">
          <Icon aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.6} />
          <span className="shrink-0">{step.title}</span>
          {summary && <span className="min-w-0 truncate" title={summary}>· {summary}</span>}
        </summary>
        <div className="mb-3 ml-7 space-y-3 py-2 pr-1 text-[13px] leading-6 text-[#4e5969] [overflow-wrap:anywhere]">
          {step.detail && <p className="whitespace-pre-wrap">{step.detail}</p>}
          {(step.id === 'understand-question' || step.id === 'understand-intent') && !step.detail && <p>{process?.question || message.originalQuestion || step.title}</p>}
          {fields.length > 0 && <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1">{fields.map(([label, value]) => <div key={label} className="contents"><dt className="text-[#86909c]">{label}</dt><dd>{value}</dd></div>)}</dl>}
          {isCapability && process && <div className="space-y-1">
            {message.routingTrace?.agentName && <p>分析助手：{message.routingTrace.agentName}</p>}
            {process.skillMatches.map((skill) => <p key={skill.id}>Skill：{skill.name} · {skill.source}{skill.description ? ' · ' + skill.description : ''}</p>)}
            {process.mcpMatches.map((tool) => <p key={tool.id}>MCP：{tool.name} · {tool.status}{tool.reason ? ' · ' + tool.reason : ''}</p>)}
            {!process.skillMatches.length && !process.mcpMatches.length && !message.routingTrace?.agentName && <p>本次未匹配可用分析能力。</p>}
          </div>}
          {isKnowledge && process && <div className="space-y-2">
            {process.knowledgeHits.map((hit) => <div key={hit.id}><p>{hit.documentTitle}</p><p className="text-[#86909c]">{hit.summary}</p></div>)}
            {process.referenceSources?.map((source) => <div key={source.id}><p>{source.title}</p><p className="text-[#86909c]">{source.summary}</p></div>)}
            {!process.knowledgeHits.length && !process.referenceSources?.length && <p>本次未引用知识依据。</p>}
          </div>}
          {isQuery && process?.sqlExecutionMessage && <p>{process.sqlExecutionMessage}</p>}
          {sql && <div className="overflow-hidden rounded-lg border border-[#e5e6eb] bg-[#f7f8fa]">
            <div className="flex items-center justify-between border-b border-[#e5e6eb] px-3 py-1.5"><span>SQL</span><button type="button" aria-label="复制 SQL" onClick={async () => {
              try { await navigator.clipboard.writeText(sql); toast.success('SQL 已复制'); }
              catch { toast.error('复制失败，请重试'); }
            }} className="flex h-7 items-center gap-1 rounded px-2 text-xs hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/25"><Copy aria-hidden="true" className="h-3.5 w-3.5" />复制</button></div>
            <pre className="max-h-64 overflow-auto whitespace-pre p-3 font-mono text-xs leading-5">{sql}</pre>
          </div>}
          {isQuery && !sql && !step.detail && !process?.sqlExecutionMessage && <p>{message.runtimeConfig?.showSql === false ? '当前设置不展示 SQL。' : '暂无查询语句。'}</p>}
          {!process && !step.detail && <p>{step.title}</p>}
        </div>
      </details>
    </li>
  );
}
export function CompactAnalysisProcess({ message }: { message: Message }) {
  const status = getProcessDisplayStatus(message);
  const running = status === 'running';
  const [expanded, setExpanded] = useState(false);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [now, setNow] = useState(Date.now);
  const lastLiveElapsed = useRef<number | undefined>(undefined);
  const overviewId = useId();
  const recordsId = useId();
  const records = getProcessRecords(message);
  const active = records.find((step) => step.status === 'running') ?? records[records.length - 1];
  const ActionIcon = message.isAwaitingResult ? Sparkles : active ? stepIcon(active.id) : Search;
  const start = message.timestamp.getTime();
  const liveElapsed = Number.isFinite(start) ? Math.max(0, Math.floor((now - start) / 1000)) : 0;
  if (running) lastLiveElapsed.current = liveElapsed;
  const savedElapsed = message.analysisProcess?.elapsedSeconds;
  const elapsed = running ? liveElapsed : typeof savedElapsed === 'number' && Number.isFinite(savedElapsed)
    ? Math.max(0, Math.round(savedElapsed), lastLiveElapsed.current ?? 0) : lastLiveElapsed.current;

  useEffect(() => {
    setExpanded(false);
    setRecordsOpen(false);
  }, [message.id, status]);

  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running, message.id]);

  if (running) {
    return (
      <section data-testid="analysis-process" data-state="running" aria-label="分析进度" className="text-[14px] leading-6">
        <div role="status" className="flex min-h-8 items-center pb-3 text-[14px] font-normal leading-6 text-[#86909c]">
          <span>分析中，用时 {elapsed} 秒…</span>
        </div>
        <div className="flex items-center gap-2 border-t border-[#e5e6eb] pt-3 text-[14px] font-normal leading-6 text-[#3564c8]">
          <ActionIcon aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.6} />
          <span className="analysis-action-text">{getCurrentProcessAction(message, records)}</span>
        </div>
      </section>
    );
  }

  const label = status === 'completed' ? '已完成' : status === 'interrupted' ? '已中断' : status === 'failed' ? '分析失败' : '待确认';
  return (
    <section data-testid="analysis-process" data-state={status} aria-label="分析过程" className="min-w-0 text-[14px] leading-6 text-[#86909c]">
      <div className="border-b border-[#e5e6eb] pb-2">
        <button type="button" aria-label={expanded ? '收起分析过程' : '展开分析过程'} aria-expanded={expanded} aria-controls={overviewId} onClick={() => setExpanded(!expanded)} className={'inline-flex min-h-8 max-w-full items-center gap-2 rounded-md text-left text-[14px] font-normal leading-6 hover:text-[#4e5969] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/25 ' + (status === 'failed' || status === 'interrupted' ? 'text-[#cb5b37]' : '')}>
          <span>{label}{elapsed !== undefined ? '，用时 ' + elapsed + ' 秒' : ''}</span>
          <ChevronDown aria-hidden="true" className={'h-3.5 w-3.5 shrink-0 ' + (expanded ? 'rotate-180' : '')} />
        </button>
      </div>
      {expanded && <div id={overviewId} className="min-w-0 pt-3">
        <button type="button" aria-label={recordsOpen ? '收起执行记录' : '展开执行记录'} aria-expanded={recordsOpen} aria-controls={recordsId} onClick={() => setRecordsOpen(!recordsOpen)} className="flex min-h-9 max-w-full items-start gap-2 rounded-md px-1 py-1 text-left text-[14px] font-normal leading-6 hover:text-[#4e5969] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/25">
          {recordsOpen ? <ChevronDown aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 rotate-180" /> : <Database aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" strokeWidth={1.6} />}
          <span className="min-w-0 [overflow-wrap:anywhere]">{getProcessOverview(message, status)}</span>
        </button>
        {recordsOpen && <ol id={recordsId} aria-label="执行记录" className="mt-2 space-y-1">
          {records.map((step, index) => <ProcessRecord key={step.id + '-' + index} step={step} message={message} />)}
          {!records.length && <li className="px-1 py-2 text-[13px]">暂无执行记录。</li>}
        </ol>}
      </div>}
    </section>
  );
}

