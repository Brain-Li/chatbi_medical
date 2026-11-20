import type { AnalysisProcessStep, Message } from '../types';

export type ProcessDisplayStatus = 'running' | 'completed' | 'interrupted' | 'failed' | 'needs-input';

const legacySteps: Array<Pick<AnalysisProcessStep, 'id' | 'title'>> = [
  { id: 'understand-question', title: '理解用户问题' },
  { id: 'resolve-data-scope', title: '确定数据口径' },
  { id: 'match-capability', title: '匹配分析能力' },
  { id: 'retrieve-knowledge', title: '检索知识依据' },
  { id: 'generate-query', title: '生成查询语句' },
  { id: 'execute-query', title: '执行数据查询' },
];

export function getProcessDisplayStatus(message: Message): ProcessDisplayStatus {
  const process = message.analysisProcess;
  if (process?.scenarioCode === 'empty-result') return 'completed';
  if (process?.scenarioCode === 'user-interrupted') return 'interrupted';
  if (process?.steps?.some((step) => step.status === 'failed') || process?.sqlExecutionStatus === 'failed'
    || ['sql-execution-failed', 'query-timeout', 'sql-generation-failed', 'unexpected-error'].includes(process?.scenarioCode ?? '')) return 'failed';
  if (process?.steps?.some((step) => step.status === 'needs-input' || step.status === 'awaiting-confirmation')) return 'needs-input';
  if (message.isInterrupted || process?.status === 'interrupted') return 'interrupted';
  return process?.status === 'running' || message.isGenerating || message.isAwaitingResult ? 'running' : 'completed';
}

export function getProcessRecords(message: Message): AnalysisProcessStep[] {
  const process = message.analysisProcess;
  if (process?.steps) {
    return process.steps.slice(0, process.visibleStepCount ?? process.steps.length).map((step) => ({
      ...step,
      title: step.id === 'generate-query' ? '生成查询语句' : step.title,
    }));
  }
  if (process) {
    const visible = legacySteps.slice(0, process.visibleStepCount ?? (process.status === 'completed' ? legacySteps.length : 1));
    return visible.map((step, index) => ({
      ...step,
      status: index < visible.length - 1 || process.status === 'completed' ? 'completed'
        : process.status === 'interrupted' ? 'interrupted' : 'running',
    }));
  }
  const steps = message.analysisSteps?.slice(0, message.visibleStepCount ?? message.analysisSteps.length) ?? [];
  return steps.map((title, index) => ({
    id: 'understand-question',
    title,
    status: index < steps.length - 1 || (!message.isGenerating && !message.isInterrupted) ? 'completed'
      : message.isInterrupted ? 'interrupted' : 'running',
  }));
}

const runningLabels: Partial<Record<AnalysisProcessStep['id'], string>> = {
  'understand-question': '正在理解问题',
  'understand-intent': '正在分析请求',
  'plan-analysis': '正在规划分析任务',
  'resolve-data-scope': '正在确认数据口径',
  'match-capability': '正在匹配分析能力',
  'load-skills': '正在加载分析能力',
  'execute-skills': '正在调用分析工具',
  'retrieve-knowledge': '正在检索知识依据',
  'generate-query': '正在生成查询语句',
  'execute-query': '正在查询数据',
};

export function getCurrentProcessAction(message: Message, records = getProcessRecords(message)) {
  if (message.isAwaitingResult) return '正在生成结果';
  const active = records.find((step) => step.status === 'running') ?? records[records.length - 1];
  if (!active) return '正在分析请求';
  return message.analysisProcess ? runningLabels[active.id] ?? active.title : active.title;
}

export function getProcessOverview(message: Message, status = getProcessDisplayStatus(message)) {
  const process = message.analysisProcess;
  if (status === 'interrupted') return '分析已中断，查看已执行的操作';
  if (status === 'failed') return '分析未完成，查看执行记录';
  if (status === 'needs-input') return '需要补充信息或确认数据口径';
  if (process?.sqlExecutionStatus === 'empty' || process?.scenarioCode === 'empty-result') return '已完成数据查询，未找到符合条件的数据';
  const queried = process?.sqlExecutionStatus === 'success' || (!process?.sqlExecutionStatus && getProcessRecords(message).some((step) => step.id === 'execute-query' && step.status === 'completed'));
  if (queried) return '已查询' + (process?.datasetName || '数据') + '并完成分析';
  if (process?.scenarioCode === 'out-of-scope' || process?.scenarioCode === 'greeting-or-capability') return '已完成请求分析';
  if (process?.matchStatus === 'missing-agent' || process?.matchStatus === 'missing-dataset') return '已完成能力检查，当前缺少可用数据或分析能力';
  return '已完成请求处理，查看执行记录';
}
