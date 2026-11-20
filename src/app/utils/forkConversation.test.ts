import { describe, expect, it } from 'vitest';
import type { Conversation } from '../types';
import { forkConversation } from './forkConversation';

const source: Conversation = {
  id: 'source', title: '本周门急诊收入环比变化如何？', workspaceName: '运营分析',
  workspaceType: 'ask', agentId: 'agent-ask', deepAnalysisEnabled: true,
  isPinned: true, isArchived: true, isDemo: true, demoOrder: 1,
  createdAt: new Date('2026-11-16T00:00:00Z'), updatedAt: new Date('2026-11-16T01:00:00Z'),
  messages: [
    { id: 'question', role: 'user', kind: 'text', content: '分析收入', timestamp: new Date('2026-11-16T00:00:00Z') },
    { id: 'analysis', role: 'assistant', kind: 'text', content: '分析中', parentUserMessageId: 'question', timestamp: new Date('2026-11-16T00:00:01Z'), isGenerating: true, analysisSteps: ['读取数据'] },
    { id: 'result', role: 'assistant', kind: 'text', content: '结果', parentUserMessageId: 'question', relatedAnalysisMessageId: 'analysis', timestamp: new Date('2026-11-16T00:00:02Z'), isAwaitingResult: true },
  ],
};

describe('forkConversation', () => {
  it('creates an independent session in the same workspace with fresh identity and dates', () => {
    const fork = forkConversation(source);
    expect(fork.id).not.toBe(source.id);
    expect(forkConversation(source).id).not.toBe(fork.id);
    expect(fork.workspaceName).toBe(source.workspaceName);
    expect(fork.agentId).toBe(source.agentId);
    expect(fork.deepAnalysisEnabled).toBe(true);
    expect(fork.title).toMatch(/（分叉）$/);
    expect(fork.title.length).toBeLessThanOrEqual(20);
    expect(fork.createdAt.getTime()).toBeGreaterThan(source.createdAt.getTime());
    expect(fork.updatedAt).toEqual(fork.createdAt);
    expect([fork.isPinned, fork.isArchived, fork.isDemo]).toEqual([false, false, false]);
    fork.messages[1].analysisSteps!.push('独立操作');
    expect(source.messages[1].analysisSteps).toEqual(['读取数据']);
    expect(fork.messages[0].timestamp).toEqual(source.messages[0].timestamp);
    expect(source.isArchived).toBe(true);
  });

  it('preserves message relationships without carrying a live generation into the fork', () => {
    const fork = forkConversation(source);
    expect(new Set(fork.messages.map((message) => message.id)).size).toBe(3);
    expect(fork.messages.every((message) => !source.messages.some((original) => original.id === message.id))).toBe(true);
    expect(fork.messages[1].parentUserMessageId).toBe(fork.messages[0].id);
    expect(fork.messages[2].relatedAnalysisMessageId).toBe(fork.messages[1].id);
    expect(fork.messages.every((message) => !message.isGenerating && !message.isAwaitingResult)).toBe(true);
    expect(fork.messages[1].isInterrupted).toBe(true);
    expect(fork.messages[2].isInterrupted).toBe(true);
    expect(source.messages[1].isGenerating).toBe(true);
  });

  it('supports empty sessions and preserves report mode', () => {
    const fork = forkConversation({ ...source, workspaceType: 'report', messages: [] });
    expect(fork.workspaceType).toBe('report');
    expect(fork.messages).toEqual([]);
  });
});
