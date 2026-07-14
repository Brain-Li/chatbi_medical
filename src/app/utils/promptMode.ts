import type { AgentType } from '../types';

export type PromptMode = Extract<AgentType, 'ask' | 'report'>;

const reportIntentKeywords = [
  '报告',
  '日报',
  '周报',
  '月报',
  '生成',
  '输出',
  '模板',
  '订阅',
  '推送',
  '专题报告',
];

export function inferPromptMode(question: string, preferredMode: PromptMode | null): PromptMode {
  if (reportIntentKeywords.some((keyword) => question.includes(keyword))) return 'report';
  return preferredMode ?? 'ask';
}
