import {
  GeneratedReportStructure,
  ReportTemplate,
  ReportTemplateSection,
} from '../types';

export interface GenerateStructureInput {
  requirement: string;
  industry: string;
  category: string;
}

export interface GenerateStructureResult {
  structure: GeneratedReportStructure;
  warnings: string[];
}

type StructureSection = Pick<ReportTemplateSection, 'title' | 'description' | 'required' | 'metricIds'>;

export const sectionTitleMaxLength = 20;
export const sectionDescriptionMaxLength = 2000;
export const sectionCountMax = 8;

export function getSectionCountError(count: number) {
  return count > sectionCountMax
    ? `当前共有 ${count} 个章节，最多支持 ${sectionCountMax} 个。请合并或删除至少 ${count - sectionCountMax} 个章节后继续。`
    : undefined;
}

const baseSections: StructureSection[] = [
  {
    title: '分析目标与结论摘要',
    description: '说明本次分析要回答的业务问题，并先给出关键发现和管理结论。',
    required: true,
    metricIds: [],
  },
  {
    title: '指标口径与数据范围',
    description: '说明指标定义、统计周期、数据范围和必要的口径限制。',
    required: true,
    metricIds: [],
  },
  {
    title: '趋势或结构分析',
    description: '按照时间、科室、药品类别或其他关键维度，展示指标变化和结构特征。',
    required: true,
    metricIds: [],
  },
  {
    title: '对比与异常分析',
    description: '对比目标对象与历史、目标值或同类对象，识别需要关注的异常变化。',
    required: true,
    metricIds: [],
  },
  {
    title: '原因分析',
    description: '结合可用数据和业务规则，分析关键变化或异常的可能原因，并区分事实与推断。',
    required: true,
    metricIds: [],
  },
  {
    title: '管理建议',
    description: '给出可执行、可跟踪的后续动作，并尽量明确责任对象和建议关注的指标。',
    required: true,
    metricIds: [],
  },
];

function hasKeyword(source: string, keywords: string[]) {
  return keywords.some((keyword) => source.includes(keyword));
}

function cloneSections() {
  return baseSections.map((section) => ({ ...section, metricIds: [...(section.metricIds ?? [])] }));
}

function formatDate(date: Date) {
  return date.toISOString();
}

function hasEnoughRequirementDetail(requirement: string) {
  const hasAnalysisScope = hasKeyword(requirement, ['按', '维度', '科室', '药品', '病种', '医生', '类别', '分组']);
  const hasOutputExpectation = hasKeyword(requirement, ['展示', '对比', '同比', '环比', '趋势', '结构', '拆解', '识别', '定位', '输出']);
  return requirement.length >= 20 && hasAnalysisScope && hasOutputExpectation;
}

export function compileStructurePrompt(
  requirement: string,
  sections: GeneratedReportStructure['sections'],
) {
  const sectionLines = sections
    .map((section, index) => `${section.titlePrefix ?? `${index + 1}. `}${section.title}\n   写作要求：${section.description}`)
    .join('\n');

  return [
    '你正在生成智能问数报告，请严格按照以下结构输出并保留所有章节。',
    `用户需求：${requirement.trim()}`,
    '结构要求：',
    sectionLines,
    '通用要求：明确指标口径和数据范围；区分事实、推断与建议；没有数据支撑时不要编造结论。',
  ].join('\n');
}

// The prototype reads the same explicit section format that compileStructurePrompt emits.
// Reject ambiguous text instead of replacing saved sections with guessed content.
function readStructurePromptSections(
  prompt: string,
  previousSections: GeneratedReportStructure['sections'] = [],
): GeneratedReportStructure['sections'] {
  if (!prompt.trim()) throw new Error('生成的报告结构提示词不能为空');
  if (prompt.length > 4000) throw new Error('完整提示词最多支持 4000 字');
  const lines = prompt.replace(/\r\n?/g, '\n').split('\n');
  const start = lines.findIndex((line) => /^\s*(?:#{1,6}\s*)?结构要求[：:]\s*$/.test(line));
  const body = lines.slice(start < 0 ? 0 : start + 1);
  const sections: GeneratedReportStructure['sections'] = [];
  const formatError = '无法识别章节，请按“章节标题”换行“写作要求：具体内容”的格式修改完整提示词后重试';
  let pendingLines: string[] = [];
  let inGeneralRequirements = false;
  for (const line of body) {
    if (/^\s*(?:#{1,6}\s*)?通用要求[：:]/.test(line)) {
      if (sections.length && !inGeneralRequirements) {
        sections[sections.length - 1].description += `\n${pendingLines.join('\n')}`.trimEnd();
      }
      pendingLines = [];
      inGeneralRequirements = true;
      continue;
    }
    const description = line.match(/^\s*写作要求[：:][ \t]*(.*)$/);
    if (!description) {
      pendingLines.push(line);
      continue;
    }
    while (pendingLines.length && !pendingLines[pendingLines.length - 1].trim()) pendingLines.pop();
    const heading = pendingLines.pop()?.trim().replace(/^#{1,6}\s+/, '');
    if (!heading) throw new Error(formatError);
    if (sections.length && !inGeneralRequirements) {
      sections[sections.length - 1].description += `\n${pendingLines.join('\n')}`.trimEnd();
    } else if (!inGeneralRequirements && pendingLines.some((entry) => entry.trim())) {
      throw new Error(formatError);
    }
    inGeneralRequirements = false;
    const prefix = heading.match(/^(?:[一二三四五六七八九十百零〇]{1,4}|[0-9０-９]{1,4})[、.．][ \t]*/)?.[0] ?? '';
    const title = heading.slice(prefix.length).trim();
    const previous = previousSections.find((section) => section.title === title);
    sections.push({ title, titlePrefix: prefix, description: description[1], required: true, metricIds: [...(previous?.metricIds ?? [])] });
    pendingLines = [];
  }
  if (!sections.length) throw new Error(formatError);
  if (!inGeneralRequirements) sections[sections.length - 1].description += `\n${pendingLines.join('\n')}`.trimEnd();
  sections.forEach((section) => { section.description = section.description.trim(); });
  return sections;
}

// Count the current draft without committing sections or validating unfinished fields.
export function getStructurePromptSectionCount(prompt: string): number | undefined {
  try {
    return readStructurePromptSections(prompt).length;
  } catch {
    return undefined;
  }
}

export function parseStructurePrompt(
  prompt: string,
  previousSections: GeneratedReportStructure['sections'] = [],
): GeneratedReportStructure['sections'] {
  const sections = readStructurePromptSections(prompt, previousSections);
  const errors = validateGeneratedStructure({
    schemaVersion: 'v1', requirement: '同步章节', generatedPrompt: prompt, generatedAt: '', sections,
  }, 'basic', { allowSectionOverflow: true });
  if (errors.length) throw new Error(errors[0]);
  return sections;
}

export function validateGeneratedStructure(
  structure: GeneratedReportStructure,
  mode: 'basic' | 'advanced' = 'basic',
  { allowSectionOverflow = false }: { allowSectionOverflow?: boolean } = {},
) {
  const errors: string[] = [];
  const sections = structure.sections ?? [];
  const titles = sections.map((section) => section.title.trim()).filter(Boolean);

  if (!structure.requirement.trim()) errors.push('请填写报告需求');
  if (!structure.generatedPrompt.trim()) errors.push('生成的报告结构提示词不能为空');
  const countError = getSectionCountError(sections.length);
  if (!allowSectionOverflow && countError) errors.push(countError);
  if (mode === 'advanced') {
    if (structure.generatedPrompt.length > 4000) errors.push('完整提示词最多支持 4000 字');
    return errors;
  }
  if (sections.length < 1) errors.push('至少需要一个报告章节');
  if (titles.length !== sections.length) errors.push('每个报告章节都需要填写标题');
  if (sections.some((section) => !section.description.trim())) errors.push('每个报告章节都需要填写写作要求');
  if (sections.some((section) => Array.from(section.title).length > sectionTitleMaxLength)) errors.push('章节标题最多支持 20 字');
  if (sections.some((section) => Array.from(section.description).length > sectionDescriptionMaxLength)) errors.push('写作要求最多支持 2000 字');

  return errors;
}

export async function generateReportStructure(
  input: GenerateStructureInput,
): Promise<GenerateStructureResult> {
  const requirement = input.requirement.trim();
  if (!requirement) {
    throw new Error('请先描述报告需求');
  }
  if (!hasEnoughRequirementDetail(requirement)) {
    throw new Error('需求描述过于简略，无法生成报告结构，请调整后重试。');
  }

  const sections = cloneSections();
  const normalizedRequirement = requirement.toLowerCase();
  const warnings: string[] = [];

  const hasTrendSignal = hasKeyword(normalizedRequirement, ['趋势', '变化', '增长', '下降', '同比', '环比']);
  const hasStructureSignal = hasKeyword(normalizedRequirement, ['占比', '结构', '构成', '类别', '排名']);

  if (hasTrendSignal) {
    sections[2] = {
      ...sections[2],
      title: hasStructureSignal ? '趋势与结构分析' : '趋势变化分析',
      description: `围绕“${requirement.slice(0, 48)}”，按时间顺序展示趋势、增长或下降变化，并标注关键拐点。`,
    };
  }

  if (hasStructureSignal && !hasTrendSignal) {
    sections[2] = {
      ...sections[2],
      title: '结构与分布分析',
      description: '按关键分类维度展示构成、占比或排名，说明主要贡献项和结构变化。',
    };
  }

  if (hasKeyword(normalizedRequirement, ['异常', '波动', '预警', '超标', '偏离'])) {
    sections[3] = {
      ...sections[3],
      title: '异常与预警分析',
      description: '按照业务规则识别异常、波动或超出阈值的对象，说明异常程度、影响范围和优先级。',
    };
  }

  if (hasKeyword(normalizedRequirement, ['原因', '归因', '为什么', '驱动'])) {
    sections[4] = {
      ...sections[4],
      required: true,
      description: '围绕用户关注的问题拆解影响因素，优先使用可验证的数据证据，避免将推断写成事实。',
    };
  }

  if (hasKeyword(normalizedRequirement, ['建议', '措施', '改进', '行动', '优化'])) {
    sections[5] = {
      ...sections[5],
      description: '将分析结论转化为分优先级的行动建议，明确建议动作、跟踪指标和复盘周期。',
    };
  }

  if (!hasKeyword(normalizedRequirement, ['指标', '数据', '趋势', '占比', '结构', '异常', '建议', '原因'])) {
    warnings.push('需求中未识别到明确的指标或分析维度，建议生成后补充章节要求。');
  }

  const generatedAt = formatDate(new Date());
  const structure: GeneratedReportStructure = {
    schemaVersion: 'v1',
    requirement,
    generatedPrompt: compileStructurePrompt(requirement, sections),
    generatedAt,
    sections,
  };

  return { structure, warnings };
}

export function getStructureEditMode(template: ReportTemplate): 'basic' | 'advanced' {
  return template.structureEditMode ?? (template.customNarrativePrompt?.trim() ? 'advanced' : 'basic');
}

export function getEffectiveNarrativePrompt(template: ReportTemplate) {
  if (template.narrativeMode === 'generated') {
    if (getStructureEditMode(template) === 'advanced' && template.customNarrativePrompt !== undefined) {
      return template.customNarrativePrompt.trim();
    }
    return template.generatedStructure?.generatedPrompt?.trim()
      || compileStructurePrompt(
        template.structureRequest ?? '',
        template.sections.map((section) => ({
          title: section.title,
          titlePrefix: section.titlePrefix,
          description: section.description,
          required: section.required,
          metricIds: section.metricIds ?? [],
        })),
      );
  }

  return template.customNarrativePrompt?.trim() || template.templatePrompt?.trim() || '';
}
