import { describe, expect, it } from 'vitest';
import {
  compileStructurePrompt,
  generateReportStructure,
  getEffectiveNarrativePrompt,
  getStructureEditMode,
  getSectionCountError,
  getStructurePromptSectionCount,
  parseStructurePrompt,
  validateGeneratedStructure,
} from './reportTemplateStructure';
import { GeneratedReportStructure, ReportTemplate } from '../types';

const baseTemplate = (overrides: Partial<ReportTemplate> = {}): ReportTemplate => ({
  id: 'template-test',
  name: '测试模板',
  description: '',
  industry: '医疗',
  category: '专题',
  version: 'v1.0',
  status: 'published',
  triggerPhrases: [],
  templatePrompt: '',
  applicableAgentIds: [],
  datasetIds: [],
  skillIds: [],
  parameters: [],
  analysisSteps: [],
  comparisonMethods: [],
  anomalyRules: [],
  attributionPath: [],
  sections: [],
  metricBlocks: [],
  chartBlocks: [],
  outputFormats: [],
  pushChannels: [],
  complianceNotes: [],
  ...overrides,
});

describe('reportTemplateStructure', () => {
  it('syncs edited titles, requirements, numbering and section order from the full prompt', () => {
    const previous = [
      { title: '摘要', description: '旧摘要', required: true, metricIds: ['revenue'] },
      { title: '删除章节', description: '删除内容', required: true, metricIds: [] },
    ];
    const edited = [
      { title: '新建议', titlePrefix: '九、', description: '第一行\n第二行\n1. 分析维度\n2. 指标口径', required: true, metricIds: [] },
      { title: '摘要', titlePrefix: '', description: '新的写作要求', required: true, metricIds: ['revenue'] },
    ];
    expect(parseStructurePrompt(compileStructurePrompt('分析科室趋势', edited), previous)).toEqual(edited);
    expect(previous[0].description).toBe('旧摘要');
  });

  it('reads CRLF, markdown headings and full-width numbering without changing the source prompt', () => {
    const prompt = '用户需求：分析趋势\r\n结构要求：\r\n## １． 摘要\r\n写作要求: 先给结论\r\n\r\n### 二、建议\r\n写作要求：给出建议\r\n通用要求：不要编造';
    expect(parseStructurePrompt(prompt).map(({ title, titlePrefix, description }) => ({ title, titlePrefix, description }))).toEqual([
      { title: '摘要', titlePrefix: '１． ', description: '先给结论' },
      { title: '建议', titlePrefix: '二、', description: '给出建议' },
    ]);
  });

  it('rejects ambiguous, empty and oversized prompts without overwriting saved sections', () => {
    const previous = [{ title: '保留章节', description: '保留要求', required: true }];
    expect(() => parseStructurePrompt('自由描述一份报告', previous)).toThrow('无法识别章节');
    expect(() => parseStructurePrompt('写作要求：缺少标题', previous)).toThrow('无法识别章节');
    expect(() => parseStructurePrompt(' ', previous)).toThrow('不能为空');
    expect(() => parseStructurePrompt('字'.repeat(4001), previous)).toThrow('4000');
    expect(previous).toEqual([{ title: '保留章节', description: '保留要求', required: true }]);
  });

  it('validates parsed sections before committing a reverse sync', () => {
    expect(() => parseStructurePrompt('结构要求：\n1. 摘要\n写作要求：\n通用要求：真实')).toThrow('填写写作要求');
    expect(() => parseStructurePrompt(`1. ${'字'.repeat(21)}\n写作要求：有效内容`)).toThrow('标题最多支持 20 字');
    expect(() => parseStructurePrompt(`1. 摘要\n写作要求：${'字'.repeat(2001)}`)).toThrow('写作要求最多支持 2000 字');
    const tooMany = Array.from({ length: 9 }, (_, index) => `${index + 1}. 标题\n写作要求：内容`).join('\n');
    expect(parseStructurePrompt(tooMany)).toHaveLength(9);
  });

  it('retains all overflow chapters for editing but blocks submission in both modes', () => {
    const sections = Array.from({ length: 10 }, (_, index) => ({
      title: `章节${index + 1}`, titlePrefix: `${index + 1}. `, description: `写作要求${index + 1}`, required: true, metricIds: [],
    }));
    const prompt = compileStructurePrompt('分析趋势', sections);
    const parsed = parseStructurePrompt(prompt);
    expect(getStructurePromptSectionCount(prompt)).toBe(10);
    expect(parsed).toEqual(sections);
    const structure: GeneratedReportStructure = {
      schemaVersion: 'v1', requirement: '分析趋势', generatedAt: '', generatedPrompt: prompt, sections: parsed,
    };
    const countError = '当前共有 10 个章节，最多支持 8 个。请合并或删除至少 2 个章节后继续。';
    expect(getSectionCountError(10)).toBe(countError);
    for (const mode of ['basic', 'advanced'] as const) {
      expect(validateGeneratedStructure(structure, mode)).toEqual([countError]);
      expect(validateGeneratedStructure(structure, mode, { allowSectionOverflow: true })).toEqual([]);
      expect(validateGeneratedStructure({ ...structure, sections: parsed.slice(0, 8) }, mode)).toEqual([]);
    }
    expect(getSectionCountError(8)).toBeUndefined();
    expect(getSectionCountError(7)).toBeUndefined();
    expect(validateGeneratedStructure({ ...structure, sections: parsed.map((section) => ({ ...section, title: '' })) }, 'basic', { allowSectionOverflow: true })).toContain('每个报告章节都需要填写标题');
  });

  it('counts draft chapters before field validation without changing draft content', () => {
    const sections = Array.from({ length: 9 }, (_, index) => ({
      title: '字'.repeat(21) + index, description: '', required: true, metricIds: [],
    }));
    const prompt = compileStructurePrompt('分析趋势', sections);
    expect(getStructurePromptSectionCount(prompt)).toBe(9);
    expect(() => parseStructurePrompt(prompt)).toThrow('填写写作要求');
    expect(sections[0].description).toBe('');
    expect(getStructurePromptSectionCount(compileStructurePrompt('分析趋势', sections.slice(0, 8)))).toBe(8);
  });

  it('includes chapters appended below the general requirements footer', () => {
    const original = Array.from({ length: 8 }, (_, index) => ({ title: `章节${index + 1}`, description: '分析要求', required: true }));
    const prompt = compileStructurePrompt('分析趋势', original) + '\n9. 新增章节\n写作要求：补充分析';
    expect(getStructurePromptSectionCount(prompt)).toBe(9);
    const sections = parseStructurePrompt(prompt);
    expect(sections).toHaveLength(9);
    expect(sections[7].description).toBe('分析要求');
    expect(sections[8].title).toBe('新增章节');
    expect(sections[8].description).toBe('补充分析');
  });

  it('does not invent a chapter count for unrecognized drafts', () => {
    expect(getStructurePromptSectionCount('')).toBeUndefined();
    expect(getStructurePromptSectionCount('暂未写完的提示词')).toBeUndefined();
    expect(getStructurePromptSectionCount('写作要求：缺少章节标题')).toBeUndefined();
  });

  it('generates a standard structure for a medical requirement', async () => {
    const result = await generateReportStructure({
      requirement: '分析近12个月某科室药占比趋势，识别异常并给出管理建议',
      industry: '医疗',
      category: '专题',
    });

    expect(result.structure.sections.length).toBeGreaterThanOrEqual(3);
    expect(result.structure.sections.some((section) => section.title.includes('趋势'))).toBe(true);
    expect(result.structure.sections.some((section) => section.title === '异常与预警分析')).toBe(true);
    expect(result.structure.generatedPrompt).toContain('用户需求');
    expect(validateGeneratedStructure(result.structure)).toEqual([]);
  });

  it('rejects an overly simple requirement with an actionable message', async () => {
    await expect(generateReportStructure({
      requirement: '分析上个月的门诊收入、异常点、异常原因和经营建议。',
      industry: '医疗',
      category: '月报',
    })).rejects.toThrow('需求描述过于简略，无法生成报告结构，请调整后重试。');
  });

  it('rejects invalid section structures', () => {
    const structure: GeneratedReportStructure = {
      schemaVersion: 'v1',
      requirement: '测试',
      generatedPrompt: '提示词',
      generatedAt: new Date().toISOString(),
      sections: [
        { title: '', description: '描述', required: true, metricIds: [] },
        { title: '重复', description: '', required: false, metricIds: [] },
        { title: '重复', description: '描述', required: false, metricIds: [] },
      ],
    };

    expect(validateGeneratedStructure(structure)).toEqual([
      '每个报告章节都需要填写标题',
        '每个报告章节都需要填写写作要求',
    ]);
  });

  it('compiles edited sections into a prompt', () => {
    const prompt = compileStructurePrompt('分析药占比', [
      { title: '摘要', description: '先给结论', required: true, metricIds: [] },
    ]);

    expect(prompt).toContain('分析药占比');
    expect(prompt).toContain('1. 摘要');
    expect(prompt).toContain('先给结论');
  });

  it('preserves edited and removed numbering when compiling and reordering sections', () => {
    const sections = [
      { title: '摘要', titlePrefix: '', description: '结论', required: true },
      { title: '建议', titlePrefix: '九、', description: '行动', required: true },
    ];
    const prompt = compileStructurePrompt('分析趋势', sections);
    expect(prompt).toContain('\n摘要\n');
    expect(prompt).toContain('\n九、建议\n');
    expect(prompt).not.toContain('1. 摘要');
    const reordered = compileStructurePrompt('分析趋势', [...sections].reverse());
    expect(reordered).toContain('\n九、建议\n');
    expect(reordered).toContain('\n摘要\n');
  });

  it('keeps custom numbering when rebuilding a saved template prompt', () => {
    const prompt = getEffectiveNarrativePrompt(baseTemplate({
      narrativeMode: 'generated',
      structureEditMode: 'basic',
      structureRequest: '分析趋势',
      sections: [{ id: 'summary', title: '摘要', titlePrefix: '7. ', description: '结论', required: true }],
    }));
    expect(prompt).toContain('\n7. 摘要\n');
    expect(prompt).not.toContain('1. 摘要');
  });

  it('uses the advanced prompt before the generated prompt', () => {
    const generatedStructure: GeneratedReportStructure = {
      schemaVersion: 'v1',
      requirement: '分析趋势',
      generatedPrompt: 'AI 提示词',
      generatedAt: new Date().toISOString(),
      sections: [{ title: '摘要', description: '结论', required: true, metricIds: [] }],
    };

    expect(getEffectiveNarrativePrompt(baseTemplate({
      narrativeMode: 'generated',
      structureRequest: '分析趋势',
      generatedStructure,
      customNarrativePrompt: '人工提示词',
    }))).toBe('人工提示词');

    expect(getEffectiveNarrativePrompt(baseTemplate({
      narrativeMode: 'generated',
      structureRequest: '分析趋势',
      generatedStructure,
    }))).toBe('AI 提示词');
  });

  it('keeps legacy custom prompts working', () => {
    expect(getEffectiveNarrativePrompt(baseTemplate({
      narrativeMode: 'custom',
      customNarrativePrompt: '历史提示词',
    }))).toBe('历史提示词');
  });

  it('uses only the selected mode for generation', () => {
    const template = baseTemplate({
      narrativeMode: 'generated',
      structureEditMode: 'basic',
      structureRequest: '分析趋势',
      sections: [{ id: 'summary', title: '基础摘要', description: '总结趋势', required: true }],
      customNarrativePrompt: '旧高级内容',
    });
    expect(getEffectiveNarrativePrompt(template)).toContain('基础摘要');
    expect(getEffectiveNarrativePrompt(template)).not.toContain('旧高级内容');
    expect(getEffectiveNarrativePrompt({ ...template, structureEditMode: 'advanced' })).toBe('旧高级内容');
    expect(getEffectiveNarrativePrompt({ ...template, structureEditMode: 'advanced', customNarrativePrompt: '' })).toBe('');
  });

  it('restores an explicitly saved mode and infers legacy advanced templates', () => {
    expect(getStructureEditMode(baseTemplate())).toBe('basic');
    expect(getStructureEditMode(baseTemplate({ customNarrativePrompt: '历史修改' }))).toBe('advanced');
    expect(getStructureEditMode(baseTemplate({ structureEditMode: 'advanced' }))).toBe('advanced');
    expect(getStructureEditMode(baseTemplate({ structureEditMode: 'basic', customNarrativePrompt: '旧高级内容' }))).toBe('basic');
  });

  it('validates advanced text independently of hidden basic sections', () => {
    const structure: GeneratedReportStructure = {
      schemaVersion: 'v1', requirement: '分析趋势', generatedPrompt: '按自定义要求生成', generatedAt: '',
      sections: [{ title: '', description: '', required: true }],
    };
    expect(validateGeneratedStructure(structure, 'advanced')).toEqual([]);
    expect(validateGeneratedStructure(structure, 'basic')).toHaveLength(2);
    expect(validateGeneratedStructure({ ...structure, generatedPrompt: ' ' }, 'advanced')).toContain('生成的报告结构提示词不能为空');
    expect(validateGeneratedStructure({ ...structure, generatedPrompt: '字'.repeat(4001) }, 'advanced')).toContain('完整提示词最多支持 4000 字');
  });

  it('accepts section length limits and rejects oversized saved sections', () => {
    const structure: GeneratedReportStructure = {
      schemaVersion: 'v1', requirement: '分析趋势', generatedPrompt: '报告提示词', generatedAt: '',
      sections: [{ title: '字'.repeat(20), description: '字'.repeat(2000), required: true }],
    };
    expect(validateGeneratedStructure(structure)).toEqual([]);
    expect(validateGeneratedStructure({ ...structure, sections: [{ title: '医'.repeat(19) + '😀', description: '字'.repeat(1999) + '😀', required: true }] })).toEqual([]);
    expect(validateGeneratedStructure({ ...structure, sections: [{ title: '字'.repeat(21), description: '字'.repeat(2001), required: true }] })).toEqual([
      '章节标题最多支持 20 字', '写作要求最多支持 2000 字',
    ]);
  });
});
