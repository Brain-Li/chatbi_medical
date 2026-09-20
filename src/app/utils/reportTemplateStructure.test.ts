import { describe, expect, it } from 'vitest';
import {
  compileStructurePrompt,
  generateReportStructure,
  getEffectiveNarrativePrompt,
  getStructureEditMode,
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
      sections: [{ title: '字'.repeat(20), description: '字'.repeat(1000), required: true }],
    };
    expect(validateGeneratedStructure(structure)).toEqual([]);
    expect(validateGeneratedStructure({ ...structure, sections: [{ title: '字'.repeat(21), description: '字'.repeat(1001), required: true }] })).toEqual([
      '章节标题最多支持 20 字', '写作要求最多支持 1000 字',
    ]);
  });
});
