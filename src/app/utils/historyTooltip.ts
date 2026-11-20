import type { Conversation } from '../types';

export function formatHistoryTimestamp(date: Date) {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${hours}:${minutes}`;
}

export function formatHistoryRelativeTime(date: Date, now = Date.now()) {
  const elapsed = Math.max(0, now - date.getTime());
  if (elapsed < 60_000) return '刚刚';
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}分钟前`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}小时前`;
  if (elapsed < 7 * 86_400_000) return `${Math.floor(elapsed / 86_400_000)}天前`;
  return formatHistoryTimestamp(date);
}

export function getHistoryConversationStatus(conversation: Conversation) {
  if (conversation.isArchived) return '已归档';
  const latestMessage = conversation.messages[conversation.messages.length - 1];
  if (!latestMessage) return '空闲';
  if (latestMessage.isInterrupted || latestMessage.analysisProcess?.status === 'interrupted') return '已中断';
  if (latestMessage.isGenerating || latestMessage.isAwaitingResult || latestMessage.analysisProcess?.status === 'running') return '进行中';
  if (latestMessage.clarificationOptions?.length
    || latestMessage.analysisProcess?.steps?.some((step) => step.status === 'awaiting-confirmation' || step.status === 'needs-input')) return '待确认';
  return '空闲';
}
