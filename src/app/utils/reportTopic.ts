export function summarizeReportTopic(question: string) {
  const firstSentence = question
    .trim()
    .split(/[。；;！？!?]/, 1)[0]
    .replace(/[，,](?:统计|时间|周期|范围|重点|关注|要求|需要|并结合).*$/, '')
    .trim();
  const topic = firstSentence
    .replace(/^(?:请帮我|帮我|麻烦|请|给我|我想|想要)?\s*(?:使用「[^」]+」\s*)?(?:生成|制作|输出|创建|编写|撰写|写)(?:一份|一个|份)?\s*/, '')
    .replace(/^(?:关于|围绕)\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();

  return topic || '业务分析报告';
}
