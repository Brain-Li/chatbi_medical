function padTimestampPart(value: number) {
  return String(value).padStart(2, '0');
}

function formatLocalTimestamp(date: Date) {
  const datePart = [
    date.getFullYear(),
    padTimestampPart(date.getMonth() + 1),
    padTimestampPart(date.getDate()),
  ].join('');
  const timePart = [
    padTimestampPart(date.getHours()),
    padTimestampPart(date.getMinutes()),
    padTimestampPart(date.getSeconds()),
  ].join('');

  return `${datePart}_${timePart}`;
}

const MAX_REPORT_TITLE_LENGTH = 20;

function buildLimitedReportTitle(subject: string, suffix: string) {
  const suffixCharacters = Array.from(suffix);
  const availableSubjectLength = Math.max(0, MAX_REPORT_TITLE_LENGTH - suffixCharacters.length);
  const limitedSubject = Array.from(subject).slice(0, availableSubjectLength).join('');

  return `${limitedSubject}${suffix}`;
}

function summarizeQuestionAsReportTitle(question: string) {
  const asksForReason = /为什么|原因/.test(question);
  const normalizedQuestion = question
    .replace(/^使用分析能力「.*?」重新生成：/, '')
    .replace(/^重新分析：/, '')
    .replace(/[<>:"\/\\|?*\u0000-\u001f]/g, '')
    .replace(/[，。！？；：、,.!;:'"“”‘’（）]/g, '')
    .replace(/[\[\]{}()]/g, '')
    .replace(/\s+/g, '')
    .replace(/^(?:请帮我|帮我|请|麻烦|帮忙|给我|我想|想要)/, '')
    .replace(/^(?:看一下|看下|查看|查询|分析一下|分析|了解一下|了解)/, '')
    .replace(/^为什么/, '')
    .replace(/是否/g, '')
    .replace(/(?:怎么样|如何|是什么|有没有|吗|呢)$/, '')
    .replace(/情况$/, '');
  const subject = normalizedQuestion || '深度分析';

  if (subject.endsWith('报告')) {
    return buildLimitedReportTitle(subject.slice(0, -2), '报告');
  }
  if (subject.endsWith('分析')) {
    return buildLimitedReportTitle(subject.slice(0, -2), '分析报告');
  }
  if (asksForReason && !subject.includes('原因')) {
    return buildLimitedReportTitle(subject, '原因分析报告');
  }
  return buildLimitedReportTitle(subject, '分析报告');
}

export function buildAnalysisReportFileName(question: string, createdAt = new Date()) {
  return `${summarizeQuestionAsReportTitle(question)}_${formatLocalTimestamp(createdAt)}.md`;
}
