import type { ChartDatum, Conversation, Message, MetricChip, ResultEvidence } from '../types';

const bullets = (items: string[]) => items.map((item) => '- ' + item).join('\n');
const metrics = (items: MetricChip[]) => bullets(items.map((item) => item.label + '：' + item.value));
const chart = (items: ChartDatum[]) => bullets(items.map((item) => item.name + '：' + item.value));
const section = (title: string, content: string) => content ? '### ' + title + '\n\n' + content : '';
const sqlBlock = (sql: string) => sql ? section('SQL', sql.split('\n').map((line) => '    ' + line).join('\n')) : '';
const evidence = (value?: ResultEvidence) => value ? [
  section('数据来源', value.datasetName + '\n\n统计周期：' + value.timeRange),
  sqlBlock(value.sql),
].filter(Boolean).join('\n\n') : '';

function messageToMarkdown(message: Message) {
  const parts = [message.content];
  if (message.markdownArtifact?.content) {
    if (message.markdownArtifact.content !== message.content) parts.push(message.markdownArtifact.content);
  } else if (message.analysisResult) {
    const result = message.analysisResult;
    parts.push(section(result.title, result.summary), section('关键指标', metrics(result.metrics)),
      section('图表数据', chart(result.chartData)), section('建议', bullets(result.recommendations)), evidence(result.evidence));
    for (const dataset of result.datasetResults ?? []) {
      parts.push(section(dataset.datasetName, [dataset.summary, dataset.statusMessage, metrics(dataset.metrics),
        section(dataset.chartTitle, chart(dataset.chartData)), evidence(dataset.evidence)].filter(Boolean).join('\n\n')));
    }
  } else if (message.reportResult) {
    const result = message.reportResult;
    parts.push(section(result.title, '统计周期：' + result.period + '\n\n' + result.summary),
      section('关键指标', metrics(result.keyMetrics)), section(result.chartTitle, chart(result.chartData)),
      section('关键发现', bullets(result.findings)), section('风险提示', bullets(result.alerts)),
      section('分析依据', bullets(result.embeddedAnalysis)));
  } else if (message.rootCauseResult) {
    const result = message.rootCauseResult;
    parts.push(section(result.title, result.summary), section('关键指标', metrics(result.overviewMetrics)),
      section('贡献分析', chart(result.contributionChart)),
      ...result.sections.map((item) => section(item.title, item.description + '\n\n' + bullets(item.bullets))),
      ...result.candidates.map((item) => section(item.title, '置信度：' + item.confidence + '\n\n' + bullets(item.evidence))),
      section('结论', result.conclusion));
  }
  if (message.analysisProcess) {
    const process = message.analysisProcess;
    parts.push(section('分析过程', bullets((process.steps ?? []).map((step) => step.title + '（' + step.status + '）' + (step.detail ? '：' + step.detail : '')))), sqlBlock(process.sql));
  } else if (message.analysisSteps?.length) {
    parts.push(section('分析过程', bullets(message.analysisSteps)));
  }
  return ['## ' + (message.role === 'user' ? '用户' : '助手'), ...parts.filter(Boolean)].join('\n\n');
}

export function conversationToMarkdown(conversation: Conversation) {
  return ['# ' + conversation.title, ...conversation.messages.map(messageToMarkdown)].join('\n\n---\n\n') + '\n';
}

export function downloadSessionLog(conversation: Conversation) {
  const content = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), conversation }, null, 2);
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'session-' + conversation.id.replace(/[\\/:*?"<>|]/g, '_') + '.json';
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}