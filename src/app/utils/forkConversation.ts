import type { Conversation } from '../types';

export function forkConversation(source: Conversation): Conversation {
  const now = new Date();
  const copy = structuredClone(source);
  const messageIds = new Map(copy.messages.map((message) => [message.id, 'msg-' + crypto.randomUUID()]));

  return {
    ...copy,
    id: 'conv-' + crypto.randomUUID(),
    title: source.title.slice(0, 16) + '（分叉）',
    isPinned: false,
    isArchived: false,
    isDemo: false,
    demoOrder: undefined,
    createdAt: now,
    updatedAt: now,
    messages: copy.messages.map((message) => ({
      ...message,
      id: messageIds.get(message.id)!,
      parentUserMessageId: message.parentUserMessageId ? messageIds.get(message.parentUserMessageId) : undefined,
      relatedAnalysisMessageId: message.relatedAnalysisMessageId ? messageIds.get(message.relatedAnalysisMessageId) : undefined,
      isInterrupted: message.isInterrupted || Boolean(message.isGenerating || message.isAwaitingResult),
      isGenerating: false,
      isAwaitingResult: false,
    })),
  };
}
