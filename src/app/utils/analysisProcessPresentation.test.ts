import { describe, expect, it } from 'vitest';
import type { AnalysisProcessData, Message } from '../types';
import { getCurrentProcessAction, getProcessDisplayStatus, getProcessOverview, getProcessRecords } from './analysisProcessPresentation';

const process: AnalysisProcessData = {
  question: '上月门诊总收入和药占比情况', datasetName: '门诊经营数据集', metrics: ['门诊收入', '药占比'], dimensions: [],
  knowledgeHits: [], skillMatches: [], mcpMatches: [], thoughtItems: [], sql: 'SELECT total_fee FROM outpatient',
  resultPreview: { title: '', metrics: [], chartData: [] }, status: 'running', visibleStepCount: 2,
  steps: [
    { id: 'understand-question', title: '理解用户问题', status: 'completed' },
    { id: 'resolve-data-scope', title: '确定数据口径', status: 'running' },
    { id: 'execute-query', title: '执行数据查询', status: 'completed' },
  ],
};
const message: Message = { id: 'analysis', role: 'assistant', kind: 'analysis', content: '', timestamp: new Date(), isGenerating: true, analysisProcess: process };
const withProcess = (updates: Partial<AnalysisProcessData>, messageUpdates: Partial<Message> = {}): Message => ({ ...message, isGenerating: false, ...messageUpdates, analysisProcess: { ...process, ...updates } });

describe('compact analysis process presentation', () => {
  it('shows only reached steps and chooses the actual active operation', () => {
    expect(getProcessDisplayStatus(message)).toBe('running');
    expect(getProcessRecords(message).map((step) => step.id)).toEqual(['understand-question', 'resolve-data-scope']);
    expect(getCurrentProcessAction(message)).toBe('正在确认数据口径');
  });

  it('keeps result preparation running after the query ends', () => {
    const pending = withProcess({ status: 'completed', steps: [], elapsedSeconds: 8 }, { isAwaitingResult: true });
    expect(getProcessDisplayStatus(pending)).toBe('running');
    expect(getCurrentProcessAction(pending)).toBe('正在生成结果');
  });

  it('summarizes a successful query without inventing a web search', () => {
    const completed = withProcess({ status: 'completed', sqlExecutionStatus: 'success', visibleStepCount: 1, steps: [{ id: 'execute-query', title: '执行数据查询', status: 'completed' }] });
    expect(getProcessDisplayStatus(completed)).toBe('completed');
    expect(getProcessOverview(completed)).toBe('已查询门诊经营数据集并完成分析');
  });

  it('distinguishes failed queries, cancellation, empty results, and required input', () => {
    expect(getProcessDisplayStatus(withProcess({ status: 'interrupted', scenarioCode: 'query-timeout', sqlExecutionStatus: 'failed' }))).toBe('failed');
    expect(getProcessDisplayStatus(withProcess({ status: 'interrupted', scenarioCode: 'user-interrupted' }))).toBe('interrupted');
    const empty = withProcess({ status: 'interrupted', scenarioCode: 'empty-result', sqlExecutionStatus: 'empty' });
    expect(getProcessDisplayStatus(empty)).toBe('completed');
    expect(getProcessOverview(empty)).toContain('未找到符合条件的数据');
    expect(getProcessDisplayStatus(withProcess({ status: 'completed', steps: [{ id: 'resolve-data-scope', title: '确定数据口径', status: 'needs-input' }] }))).toBe('needs-input');
  });

  it('does not claim a query ran when it was skipped', () => {
    const skipped = withProcess({ status: 'completed', sqlExecutionStatus: 'not-run', visibleStepCount: 3 });
    expect(getProcessOverview(skipped)).not.toContain('已查询');
  });

  it('retains legacy records and corrects query-generation wording', () => {
    const legacy = { ...message, analysisProcess: undefined, analysisSteps: ['理解问题', '查询数据', '整理结果'], visibleStepCount: 2 };
    expect(getProcessRecords(legacy).map((step) => step.title)).toEqual(['理解问题', '查询数据']);
    expect(getCurrentProcessAction(legacy)).toBe('查询数据');
    expect(getProcessRecords(withProcess({ steps: [{ id: 'generate-query', title: '执行查询语句', status: 'running' }] }))[0].title).toBe('生成查询语句');
  });
});
