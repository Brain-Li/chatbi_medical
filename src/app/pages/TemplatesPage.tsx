import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, PencilLine, Settings2, X } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { ReportTemplate, ReportTemplateSection, ReportTemplateStatus } from '../types';
import templateModalChevronDown from '../../assets/figma-report-template/template-modal-chevron-down.svg';
import templateModalClose from '../../assets/figma-report-template/template-modal-close.svg';
import templateDeleteIcon from '../../assets/figma-report-template/template-delete.svg';
import templateEditIcon from '../../assets/figma-report-template/template-edit.svg';
import templatePageLeftIcon from '../../assets/figma-report-template/template-page-left.svg';
import templatePageRightIcon from '../../assets/figma-report-template/template-page-right.svg';
import templatePlusIcon from '../../assets/figma-report-template/template-plus.svg';
import templatePageSizeChevronIcon from '../../assets/figma-report-template/report-template-chevron-down.svg';
import templateSearchIcon from '../../assets/figma-report-template/report-template-search.svg';
import templateSubscriptionIcon from '../../assets/figma-report-template/template-subscription.svg';
import templateViewIcon from '../../assets/figma-report-template/template-subscribe.svg';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';

const templatePageSizeOptions = [10, 20, 50] as const;
const templateDescriptionMaxLength = 50;
const defaultTemplateIndustry = '医疗';
const templateIndustries = ['医疗', '汽车', '云管'];
const templateCategories = ['专题', '日报', '周报', '月报'];
const templateEditorSteps = [
  { value: 'basic', title: '基本信息' },
  { value: 'structure', title: '报告结构' },
  { value: 'style', title: '视觉风格' },
  { value: 'confirm', title: '确认创建' },
] as const;

const stylePreviewPalettes = [
  {
    canvas: '#f2f3f5',
    surface: '#ffffff',
    surfaceMuted: '#f7f8fa',
    accent: '#165dff',
    secondary: '#14c9c9',
    signal: '#f53f3f',
    text: '#1d2129',
    previewTitle: '经营概览',
    metrics: ['128.6', '86%', '+8.2%'],
  },
  {
    canvas: '#edf9f6',
    surface: '#ffffff',
    surfaceMuted: '#f2fbf8',
    accent: '#00a870',
    secondary: '#3491fa',
    signal: '#ff7d00',
    text: '#1d2129',
    previewTitle: '数据简报',
    metrics: ['96.4', '72%', '+5.6%'],
  },
  {
    canvas: '#111827',
    surface: '#1f2937',
    surfaceMuted: '#273449',
    accent: '#38bdf8',
    secondary: '#22c55e',
    signal: '#f59e0b',
    text: '#f8fafc',
    previewTitle: '实时监控',
    metrics: ['3.8k', '94%', '+12%'],
  },
  {
    canvas: '#edf8f7',
    surface: '#ffffff',
    surfaceMuted: '#f1faf8',
    accent: '#0e7c86',
    secondary: '#165dff',
    signal: '#f53f3f',
    text: '#1d2129',
    previewTitle: '诊疗运营',
    metrics: ['12.8k', '92%', '-1.6%'],
  },
  {
    canvas: '#f5f6f7',
    surface: '#ffffff',
    surfaceMuted: '#f7f8fa',
    accent: '#ff7d00',
    secondary: '#165dff',
    signal: '#00b42a',
    text: '#1d2129',
    previewTitle: '销量运营',
    metrics: ['3.2k', '68%', '+12%'],
  },
  {
    canvas: '#edf6ff',
    surface: '#ffffff',
    surfaceMuted: '#f2f7ff',
    accent: '#4e7cff',
    secondary: '#14c9c9',
    signal: '#00b42a',
    text: '#1d2129',
    previewTitle: '资源总览',
    metrics: ['72%', '99.9%', '-8.4%'],
  },
] as const;

const stylePreviewPaletteIndex: Record<string, number> = {
  'skill-clean-executive-style': 0,
  'skill-fresh-data-brief-style': 1,
  'skill-dark-operations-cockpit-style': 2,
  'skill-healthcare-operations-style': 3,
  'skill-automotive-business-style': 4,
  'skill-cloud-resource-management-style': 5,
};

function getStylePreviewPalette(skillId: string) {
  const knownIndex = stylePreviewPaletteIndex[skillId];
  if (knownIndex !== undefined) return stylePreviewPalettes[knownIndex];

  const fallbackIndex = Array.from(skillId).reduce((total, character) => total + character.charCodeAt(0), 0)
    % stylePreviewPalettes.length;
  return stylePreviewPalettes[fallbackIndex];
}

type TemplateEditorStep = (typeof templateEditorSteps)[number]['value'];

type TemplateFormState = {
  name: string;
  industry: string;
  category: string;
  status: ReportTemplateStatus;
  description: string;
  narrativeMode: 'skill' | 'adjusted' | 'custom';
  customNarrativePrompt: string;
  narrativeAdjustmentPrompt: string;
  narrativeOverridePrompt: string;
  narrativeSkillId: string;
  styleMode: 'skill' | 'adjusted' | 'custom';
  customStylePrompt: string;
  styleAdjustmentPrompt: string;
  styleOverridePrompt: string;
  styleSkillId: string;
  sections: Array<Pick<ReportTemplateSection, 'title' | 'description' | 'required' | 'metricIds'>>;
  outputFormats: string;
};

const emptyTemplateForm: TemplateFormState = {
  name: '',
  industry: defaultTemplateIndustry,
  category: '专题',
  status: 'published',
  description: '',
  narrativeMode: 'skill',
  customNarrativePrompt: '',
  narrativeAdjustmentPrompt: '',
  narrativeOverridePrompt: '',
  narrativeSkillId: 'skill-data-storytelling',
  styleMode: 'skill',
  customStylePrompt: '',
  styleAdjustmentPrompt: '',
  styleOverridePrompt: '',
  styleSkillId: 'skill-clean-executive-style',
  sections: [
    { title: '核心摘要', description: '概括报告核心结论。', required: true, metricIds: [] },
    { title: '趋势分析', description: '说明关键指标变化。', required: true, metricIds: [] },
    { title: '行动建议', description: '给出后续管理动作。', required: false, metricIds: [] },
  ],
  outputFormats: 'PDF, PNG',
};

function splitList(value: string) {
  return value
    .split(/[,，、/\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeTemplateCategory(value: string) {
  const category = value.trim();
  return templateCategories.find((option) => category === option || category.endsWith(option)) ?? '专题';
}

function formatTemplateCreatedAt(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');

  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  ].join(' ');
}

function getTemplateCreatedAtTime(template: ReportTemplate) {
  if (!template.createdAt) return 0;

  const timestamp = new Date(template.createdAt.replace(/-/g, '/')).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getTemplateCreatedAtLabel(template: ReportTemplate) {
  return template.createdAt?.trim() || '-';
}

function TemplateDescription({ description }: { description: string }) {
  return (
    <Tooltip delayDuration={240}>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          aria-label={`${description}，查看完整模板描述`}
          className="block max-w-full truncate text-[14px] leading-5 text-[#86909c] outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20"
        >
          {description}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="start"
        sideOffset={8}
        collisionPadding={12}
        arrowClassName="bg-[#1d2129] fill-[#1d2129]"
        className="z-[120] w-fit min-w-[220px] max-w-[min(320px,calc(100vw-32px))] whitespace-normal rounded-[6px] border-0 bg-[#1d2129] px-3 py-2.5 text-left font-['PingFang_SC'] text-[13px] font-normal leading-5 tracking-normal text-white text-wrap shadow-[0_6px_16px_rgba(29,33,41,0.16)]"
      >
        <p className="m-0 break-words">{description}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function toTemplateForm(template: ReportTemplate): TemplateFormState {
  return {
    name: template.name,
    industry: template.industry || defaultTemplateIndustry,
    category: normalizeTemplateCategory(template.category),
    status: template.status === 'disabled' ? 'disabled' : 'published',
    description: template.description.slice(0, templateDescriptionMaxLength),
    narrativeMode: template.narrativeMode ?? (template.narrativeSkillId ? 'skill' : 'custom'),
    customNarrativePrompt: template.customNarrativePrompt ?? '',
    narrativeAdjustmentPrompt: template.narrativeAdjustmentPrompt ?? '',
    narrativeOverridePrompt: template.narrativeOverridePrompt ?? '',
    narrativeSkillId: template.narrativeSkillId ?? '',
    styleMode: template.styleMode ?? 'skill',
    customStylePrompt: template.customStylePrompt ?? '',
    styleAdjustmentPrompt: template.styleAdjustmentPrompt ?? '',
    styleOverridePrompt: template.styleOverridePrompt ?? '',
    styleSkillId: template.styleSkillId ?? 'skill-clean-executive-style',
    sections: template.sections.length
      ? template.sections.map((section, index) => ({
          title: section.title,
          description: section.description,
          required: section.required,
          metricIds: section.metricIds ?? (index === 0 ? template.metricBlocks.map((block) => block.metricId) : []),
        }))
      : emptyTemplateForm.sections,
    outputFormats: template.outputFormats.join(', '),
  };
}

function createTemplateFromForm(form: TemplateFormState, existing?: ReportTemplate): ReportTemplate {
  const createdAt = new Date();
  const timestamp = createdAt.getTime();
  const sections = form.sections
    .map((section, index) => ({
      id: existing?.sections[index]?.id ?? `section-${timestamp}-${index}`,
      title: section.title.trim(),
      description: section.description.trim(),
      required: section.required,
      metricIds: section.metricIds ?? [],
    }))
    .filter((section) => section.title);

  return {
    id: existing?.id ?? `template-${timestamp}`,
    name: form.name.trim() || '未命名报告模板',
    description: (form.description ?? '').trim().slice(0, templateDescriptionMaxLength),
    industry: form.industry.trim() || defaultTemplateIndustry,
    category: normalizeTemplateCategory(form.category),
    version: existing?.version ?? 'v1.0',
    createdAt: existing?.createdAt ?? formatTemplateCreatedAt(createdAt),
    status: form.status,
    triggerPhrases: existing?.triggerPhrases ?? [],
    templatePrompt: '',
    narrativeMode: form.narrativeMode,
    customNarrativePrompt: form.narrativeMode === 'custom' ? form.customNarrativePrompt.trim() : undefined,
    narrativeAdjustmentPrompt: form.narrativeMode === 'adjusted' ? form.narrativeAdjustmentPrompt.trim() : undefined,
    narrativeOverridePrompt: form.narrativeMode === 'adjusted' ? form.narrativeOverridePrompt.trim() : undefined,
    applicableAgentIds: existing?.applicableAgentIds ?? [],
    datasetIds: existing?.datasetIds ?? [],
    skillIds: existing?.skillIds ?? [],
    narrativeSkillId: form.narrativeMode === 'skill' || form.narrativeMode === 'adjusted' ? form.narrativeSkillId || undefined : undefined,
    styleMode: form.styleMode,
    customStylePrompt: form.styleMode === 'custom' ? form.customStylePrompt.trim() : undefined,
    styleAdjustmentPrompt: form.styleMode === 'adjusted' ? form.styleAdjustmentPrompt.trim() : undefined,
    styleOverridePrompt: form.styleMode === 'adjusted' ? form.styleOverridePrompt.trim() : undefined,
    styleSkillId: form.styleMode === 'skill' || form.styleMode === 'adjusted' ? form.styleSkillId || undefined : undefined,
    parameters: existing?.parameters ?? [],
    analysisSteps: existing?.analysisSteps ?? [],
    comparisonMethods: existing?.comparisonMethods ?? [],
    anomalyRules: existing?.anomalyRules ?? [],
    attributionPath: existing?.attributionPath ?? [],
    sections,
    metricBlocks: existing?.metricBlocks ?? [],
    chartBlocks: existing?.chartBlocks ?? [],
    outputFormats: splitList(form.outputFormats),
    pushChannels: existing?.pushChannels ?? [],
    complianceNotes: existing?.complianceNotes ?? [],
  };
}

export default function TemplatesPage() {
  const {
    reportTemplates,
    defaultTemplateBindings,
    skills,
    addReportTemplate,
    updateReportTemplate,
    deleteReportTemplate,
    updateDefaultTemplateBinding,
  } = useWorkspace();
  const [query, setQuery] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [templatePage, setTemplatePage] = useState(1);
  const [templatePageSize, setTemplatePageSize] = useState<number>(templatePageSizeOptions[0]);
  const [editingTemplate, setEditingTemplate] = useState<ReportTemplate | null>(null);
  const [viewingTemplate, setViewingTemplate] = useState<ReportTemplate | null>(null);
  const [pendingDeleteTemplate, setPendingDeleteTemplate] = useState<ReportTemplate | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorStep, setEditorStep] = useState<TemplateEditorStep>('basic');
  const [showDefaultTemplateManager, setShowDefaultTemplateManager] = useState(false);
  const [defaultTemplateIndustry, setDefaultTemplateIndustry] = useState(templateIndustries[0]);
  const [defaultTemplateDraft, setDefaultTemplateDraft] = useState<Record<string, string>>({});
  const [form, setForm] = useState<TemplateFormState>(emptyTemplateForm);
  const editorContentRef = useRef<HTMLDivElement>(null);
  const templateNameRef = useRef<HTMLInputElement>(null);
  const customNarrativePromptRef = useRef<HTMLTextAreaElement>(null);
  const customStylePromptRef = useRef<HTMLTextAreaElement>(null);
  const [basicErrors, setBasicErrors] = useState<{ name?: string }>({});
  const [structureErrors, setStructureErrors] = useState<{ skill?: string; prompt?: string }>({});
  const [styleErrors, setStyleErrors] = useState<{ skill?: string; prompt?: string }>({});

  const narrativeSkills = useMemo(
    () => skills.filter((skill) => skill.kind === 'narrative' && skill.status === '已启用'),
    [skills],
  );
  const selectedNarrativeSkill = narrativeSkills.find((skill) => skill.id === form.narrativeSkillId);
  const styleSkills = useMemo(
    () => skills.filter((skill) => skill.kind === 'style' && skill.status === '已启用'),
    [skills],
  );
  const selectedStyleSkill = styleSkills.find((skill) => skill.id === form.styleSkillId);
  const defaultNarrativePrompt = selectedNarrativeSkill?.skillMarkdown ?? '';
  const displayedNarrativePrompt = form.narrativeMode === 'adjusted'
    ? form.narrativeOverridePrompt
      || form.narrativeAdjustmentPrompt
      || defaultNarrativePrompt
      || ''
    : defaultNarrativePrompt;
  const isNarrativePromptAdjusted = form.narrativeMode === 'adjusted'
    && displayedNarrativePrompt !== defaultNarrativePrompt;
  const currentEditorStepIndex = templateEditorSteps.findIndex((step) => step.value === editorStep);

  useEffect(() => {
    editorContentRef.current?.scrollTo({ top: 0 });
  }, [editorStep]);

  const filteredTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return reportTemplates
      .filter((template) => {
        const templateIndustry = template.industry || defaultTemplateIndustry;
        const matchesIndustry = selectedIndustry === 'all' || templateIndustry === selectedIndustry;
        const matchesCategory = selectedCategory === 'all' || normalizeTemplateCategory(template.category) === selectedCategory;
        const matchesQuery =
          !normalizedQuery ||
          [
            template.name,
            template.description,
            templateIndustry,
            template.templatePrompt,
            ...template.triggerPhrases,
            ...template.sections.map((section) => section.title),
          ]
            .join(' ')
            .toLowerCase()
            .includes(normalizedQuery);

        return matchesIndustry && matchesCategory && matchesQuery;
      })
      .sort((current, next) => getTemplateCreatedAtTime(next) - getTemplateCreatedAtTime(current));
  }, [query, reportTemplates, selectedCategory, selectedIndustry]);

  useEffect(() => {
    setTemplatePage(1);
  }, [query, selectedCategory, selectedIndustry]);

  const industryOptions = useMemo(() => {
    const industries = new Set(templateIndustries);

    reportTemplates.forEach((template) => {
      const industry = (template.industry || defaultTemplateIndustry).trim();
      if (industry) industries.add(industry);
    });

    const currentIndustry = form.industry.trim();
    if (currentIndustry) industries.add(currentIndustry);

    return Array.from(industries);
  }, [form.industry, reportTemplates]);

  const templateTotalPages = Math.max(1, Math.ceil(filteredTemplates.length / templatePageSize));
  const templatePageItems = useMemo<Array<number | string>>(() => {
    if (templateTotalPages <= 5) {
      return Array.from({ length: templateTotalPages }, (_, index) => index + 1);
    }

    if (templatePage <= 3) return [1, 2, 3, 'ellipsis-right', templateTotalPages];
    if (templatePage >= templateTotalPages - 2) {
      return [1, 'ellipsis-left', templateTotalPages - 2, templateTotalPages - 1, templateTotalPages];
    }

    return [
      1,
      'ellipsis-left',
      templatePage - 1,
      templatePage,
      templatePage + 1,
      'ellipsis-right',
      templateTotalPages,
    ];
  }, [templatePage, templateTotalPages]);
  const paginatedTemplates = useMemo(() => {
    const start = (templatePage - 1) * templatePageSize;
    return filteredTemplates.slice(start, start + templatePageSize);
  }, [filteredTemplates, templatePage, templatePageSize]);

  useEffect(() => {
    setTemplatePage((current) => Math.min(current, templateTotalPages));
  }, [templateTotalPages]);

  const openNewTemplateEditor = () => {
    setEditingTemplate(null);
    setForm(emptyTemplateForm);
    setBasicErrors({});
    setStructureErrors({});
    setStyleErrors({});
    setEditorStep('basic');
    setIsEditorOpen(true);
  };

  const openEditTemplateEditor = (template: ReportTemplate) => {
    setEditingTemplate(template);
    setForm(toTemplateForm(template));
    setBasicErrors({});
    setStructureErrors({});
    setStyleErrors({});
    setEditorStep('basic');
    setIsEditorOpen(true);
  };

  const validateBasicStep = () => {
    const nextErrors = {
      name: form.name.trim() ? undefined : '请输入模板名称',
    };
    setBasicErrors(nextErrors);

    if (nextErrors.name) {
      templateNameRef.current?.focus();
    }

    return !nextErrors.name;
  };

  const validateStructureStep = () => {
    const nextErrors = form.narrativeMode === 'custom'
      ? { prompt: form.customNarrativePrompt.trim() ? undefined : '请填写报告结构提示词' }
      : { skill: form.narrativeSkillId ? undefined : '请选择报告结构' };
    setStructureErrors(nextErrors);

    if (nextErrors.prompt) {
      customNarrativePromptRef.current?.focus();
    }

    return !nextErrors.skill && !nextErrors.prompt;
  };

  const validateStyleStep = () => {
    const nextErrors = form.styleMode === 'custom'
      ? { prompt: form.customStylePrompt.trim() ? undefined : '请填写视觉风格提示词' }
      : { skill: form.styleSkillId ? undefined : '请选择视觉风格' };
    setStyleErrors(nextErrors);

    if (nextErrors.prompt) {
      customStylePromptRef.current?.focus();
    }

    return !nextErrors.skill && !nextErrors.prompt;
  };

  const handleEditorStepChange = (requestedStep: TemplateEditorStep) => {
    const requestedStepIndex = templateEditorSteps.findIndex((step) => step.value === requestedStep);

    if (requestedStepIndex <= currentEditorStepIndex) {
      setEditorStep(requestedStep);
      return;
    }

    if (editorStep === 'basic' && !validateBasicStep()) return;
    if (editorStep === 'structure' && !validateStructureStep()) return;
    if (editorStep === 'style' && !validateStyleStep()) return;

    const nextStep = templateEditorSteps[currentEditorStepIndex + 1]?.value;
    if (nextStep) setEditorStep(nextStep);
  };

  const handleSaveTemplate = () => {
    if (!validateBasicStep()) {
      setEditorStep('basic');
      return;
    }
    if (!validateStructureStep()) {
      setEditorStep('structure');
      return;
    }
    if (!validateStyleStep()) {
      setEditorStep('style');
      return;
    }
    const nextTemplate = createTemplateFromForm(form, editingTemplate ?? undefined);

    if (editingTemplate) {
      updateReportTemplate(editingTemplate.id, nextTemplate);
    } else {
      addReportTemplate(nextTemplate);
    }

    setIsEditorOpen(false);
    setEditingTemplate(null);
    setForm(emptyTemplateForm);
    setBasicErrors({});
    setStructureErrors({});
    setStyleErrors({});
    setEditorStep('basic');
  };

  const getDefaultTemplate = (industry: string) => {
    const binding = defaultTemplateBindings.find((item) => item.industry === industry);
    return reportTemplates.find((template) => template.id === binding?.templateId && template.status === 'published');
  };

  const openDefaultTemplateManager = () => {
    setDefaultTemplateIndustry(templateIndustries[0]);
    setDefaultTemplateDraft(Object.fromEntries(
      defaultTemplateBindings.map((binding) => [binding.industry, binding.templateId]),
    ));
    setShowDefaultTemplateManager(true);
  };
  const saveDefaultTemplateManager = () => {
    templateIndustries.forEach((industry) => {
      updateDefaultTemplateBinding(industry, defaultTemplateDraft[industry] ?? '');
    });
    setShowDefaultTemplateManager(false);
  };

  const defaultTemplateCandidates = reportTemplates
    .filter((template) => template.status === 'published' && (template.industry || defaultTemplateIndustry) === defaultTemplateIndustry)
    .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
  const currentDefaultTemplateId = defaultTemplateDraft[defaultTemplateIndustry]
    ?? getDefaultTemplate(defaultTemplateIndustry)?.id
    ?? 'none';
  const isDefaultTemplateDraftDirty = templateIndustries.some((industry) => (
    (defaultTemplateDraft[industry] ?? '')
    !== (defaultTemplateBindings.find((binding) => binding.industry === industry)?.templateId ?? '')
  ));

  return (
    <div className="h-full min-h-0 flex-1 overflow-hidden bg-white px-4 pb-0 pt-4 font-['PingFang_SC','Microsoft_YaHei',sans-serif] md:px-[22px] md:pt-[22px]">
      <div className="flex h-full min-h-0 w-full flex-col">
        <div className="flex shrink-0 flex-col items-stretch justify-between gap-4 sm:h-10 sm:flex-row sm:items-center sm:gap-5 md:-translate-y-[6px]">
          <h1 className="text-[20px] font-semibold leading-7 text-[#1d2129]">模板库</h1>
          <div className="flex w-full shrink-0 items-center gap-3 sm:w-auto">
            <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-[#e5e6eb] bg-white px-3 transition-colors focus-within:border-[#165dff] focus-within:ring-2 focus-within:ring-[#165dff]/10 sm:w-[240px] sm:flex-none">
              <img aria-hidden="true" className="h-4 w-4 shrink-0" src={templateSearchIcon} alt="" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索模板名称或模板描述"
                className="min-w-0 flex-1 bg-transparent text-[14px] font-normal leading-[22px] text-[#1d2129] placeholder:text-[#c9cdd4] focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={openNewTemplateEditor}
              className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-[#e5e6eb] bg-white px-3.5 text-[14px] font-normal leading-[22px] text-[#1d2129] transition-colors hover:bg-[#f7f8fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20"
            >
              <img aria-hidden="true" className="h-4 w-4" src={templatePlusIcon} alt="" />
              新建模板
            </button>
            <button
              type="button"
              onClick={openDefaultTemplateManager}
              className={`inline-flex h-10 items-center rounded-[10px] border px-3.5 text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 ${
                showDefaultTemplateManager ? 'border-[#165dff] bg-[#e8f3ff] text-[#165dff]' : 'border-[#e5e6eb] bg-white text-[#1d2129] hover:bg-[#f7f8fa]'
              }`}
            >
              <Settings2 aria-hidden="true" className="h-4 w-4" />
              默认模板管理
            </button>
          </div>
        </div>

        <div
          className="mt-4 flex min-h-8 shrink-0 flex-wrap items-center gap-x-5 gap-y-3"
          aria-label="模板筛选"
        >
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-[14px] leading-[22px] text-[#4e5969]">行业</span>
            <Select
              value={selectedIndustry}
              onValueChange={(value) => {
                setSelectedIndustry(value);
                setSelectedCategory('all');
              }}
            >
              <SelectTrigger
                aria-label="选择模板业务线"
                size="sm"
                className="group h-8 w-[112px] rounded-[8px] border-[#e5e6eb] bg-white px-3 text-[14px] leading-[22px] text-[#1d2129] shadow-none focus-visible:border-[#165dff] focus-visible:ring-2 focus-visible:ring-[#165dff]/10"
                icon={
                  <span className="relative h-4 w-4 shrink-0 overflow-hidden transition-transform duration-150 group-data-[state=open]:rotate-180">
                    <img aria-hidden="true" className="absolute left-[3.76px] top-[5.48px] h-[5.19px] w-[8.49px]" src={templatePageSizeChevronIcon} alt="" />
                  </span>
                }
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                position="popper"
                sideOffset={4}
                viewportClassName="h-auto min-h-0 w-full !min-w-0 p-0"
                className="w-[var(--radix-select-trigger-width)] !min-w-0 rounded-[8px] border-[#e5e6eb] bg-white p-1 text-[#1d2129] shadow-[0_4px_12px_rgba(29,33,41,0.08)] data-[side=bottom]:!translate-y-0 data-[side=top]:!translate-y-0"
              >
                <SelectItem value="all" className="h-8 rounded-[6px] py-0 pl-2 pr-8 text-[14px] focus:bg-[#f7f8fa] focus:text-[#1d2129]">
                  全部
                </SelectItem>
                {industryOptions.map((industry) => (
                  <SelectItem key={industry} value={industry} className="h-8 rounded-[6px] py-0 pl-2 pr-8 text-[14px] focus:bg-[#f7f8fa] focus:text-[#1d2129]">
                    {industry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <span aria-hidden="true" className="hidden h-4 w-px bg-[#e5e6eb] sm:block" />

          <div className="flex min-w-0 items-center gap-3 overflow-x-auto" aria-label="模板分类">
            <span className="shrink-0 text-[14px] leading-[22px] text-[#4e5969]">分类</span>
            <button
              type="button"
              aria-pressed={selectedCategory === 'all'}
              onClick={() => setSelectedCategory('all')}
              className={`h-7 shrink-0 rounded-[14px] px-3 text-[14px] font-normal leading-7 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 ${
                selectedCategory === 'all'
                  ? 'bg-[#1d2129] text-white'
                  : 'bg-[#f2f3f5] text-[#4e5969] hover:bg-[#e5e6eb]'
              }`}
            >
              全部
            </button>
            {templateCategories.map((category) => (
              <button
                key={category}
                type="button"
                aria-pressed={selectedCategory === category}
                onClick={() => setSelectedCategory(category)}
                className={`h-7 shrink-0 rounded-[14px] px-3 text-[14px] font-normal leading-7 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 ${
                  selectedCategory === category
                    ? 'bg-[#1d2129] text-white'
                    : 'bg-[#f2f3f5] text-[#4e5969] hover:bg-[#e5e6eb]'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <Dialog open={showDefaultTemplateManager} onOpenChange={setShowDefaultTemplateManager}>
          <DialogContent
            aria-describedby={undefined}
            showCloseButton={false}
            className="!flex h-[494px] max-h-[calc(100vh-32px)] w-[680px] !max-w-[calc(100vw-32px)] flex-col gap-0 overflow-hidden rounded-[12px] border-0 bg-white p-0 font-['PingFang_SC','Microsoft_YaHei',sans-serif] shadow-[0_12px_32px_rgba(29,33,41,0.16)] sm:!max-w-[680px]"
          >
            <DialogHeader className="h-[60px] shrink-0 flex-row items-center justify-between border-b border-[#e5e6eb] px-6 text-left">
              <DialogTitle className="text-[18px] font-semibold leading-7 text-[#1d2129]">默认模板管理</DialogTitle>
              <DialogClose asChild>
                <button type="button" aria-label="关闭默认模板管理" className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#86909c] hover:bg-[#f2f3f5] hover:text-[#1d2129]"><X aria-hidden="true" className="h-4 w-4" /></button>
              </DialogClose>
            </DialogHeader>
            <section className="min-h-0 flex-1 overflow-y-auto px-6 py-6" aria-label="默认模板管理">
              <div className="space-y-5">
                <div className="grid gap-2">
                  <span className="text-[14px] font-medium leading-[22px] text-[#1d2129]">行业</span>
                  <div className="flex flex-wrap items-center gap-2" role="group" aria-label="选择配置行业">
                    {templateIndustries.map((industry) => {
                      const isSelected = defaultTemplateIndustry === industry;
                      return (
                        <button
                          key={industry}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => setDefaultTemplateIndustry(industry)}
                          className={`h-9 min-w-[72px] rounded-[18px] px-4 text-[14px] font-normal leading-9 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 ${
                            isSelected
                              ? 'bg-[#1d2129] text-white'
                              : 'bg-[#f2f3f5] text-[#4e5969] hover:bg-[#e5e6eb]'
                          }`}
                        >
                          {industry}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="grid gap-2">
                  <span className="text-[14px] font-medium leading-[22px] text-[#1d2129]">默认模板</span>
                  <Select
                    value={currentDefaultTemplateId}
                    onValueChange={(value) => setDefaultTemplateDraft((current) => ({ ...current, [defaultTemplateIndustry]: value === 'none' ? '' : value }))}
                  >
                    <SelectTrigger aria-label={`选择${defaultTemplateIndustry}行业默认模板`} className="h-10 w-full rounded-[8px] border-[#e5e6eb] bg-white px-3 text-[14px] shadow-none focus-visible:border-[#165dff] focus-visible:ring-2 focus-visible:ring-[#165dff]/10">
                      <SelectValue placeholder="未配置" />
                    </SelectTrigger>
                    <SelectContent
                      sideOffset={4}
                      collisionPadding={24}
                      className="max-h-[240px] w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-80px)] rounded-[8px] border-[#e5e6eb] shadow-[0_8px_24px_rgba(29,33,41,0.12)] [&_[data-slot=select-scroll-down-button]]:hidden [&_[data-slot=select-scroll-up-button]]:hidden"
                      viewportClassName="!h-auto max-h-[238px] !overflow-y-auto ![scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    >
                      <SelectItem value="none">未配置</SelectItem>
                      {defaultTemplateCandidates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          <span className="min-w-0 truncate">{template.name}</span>
                          <span className="shrink-0 rounded-[4px] bg-[#f2f3f5] px-1.5 py-0.5 text-[12px] text-[#86909c]">
                            {normalizeTemplateCategory(template.category)}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

              </div>
            </section>
            <div className="flex h-14 shrink-0 items-center justify-end gap-3 border-t border-[#e5e6eb] bg-[#f7f8fa] px-6">
              <DialogClose asChild><button type="button" className="h-9 rounded-[8px] border border-[#e5e6eb] px-4 text-[14px] text-[#4e5969] hover:bg-[#f7f8fa]">取消</button></DialogClose>
              <button type="button" disabled={!isDefaultTemplateDraftDirty} onClick={saveDefaultTemplateManager} className="h-9 rounded-[8px] bg-[#1d2129] px-4 text-[14px] text-white hover:bg-[#000000] disabled:cursor-not-allowed disabled:bg-[#c9cdd4]">保存设置</button>
            </div>
          </DialogContent>
        </Dialog>

        <section className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden" aria-label="报告模板列表">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="-mt-2 w-full min-w-[1160px] table-fixed border-separate border-spacing-x-0 border-spacing-y-2">
              <colgroup>
                <col />
                <col className="w-[116px]" />
                <col className="w-[100px]" />
                <col className="w-[184px]" />
                <col className="w-[104px]" />
                <col className="w-[216px]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-[#f7f8fa]">
                <tr className="h-12 text-left text-[14px] font-medium leading-6 text-[#4e5969]">
                  <th className="border-b border-[#e5e6eb] px-4 py-3 font-medium">模板名称</th>
                  <th className="border-b border-[#e5e6eb] px-4 py-3 font-medium">行业</th>
                  <th className="border-b border-[#e5e6eb] px-4 py-3 font-medium">分类</th>
                  <th className="border-b border-[#e5e6eb] px-4 py-3 font-medium">创建时间</th>
                  <th className="border-b border-[#e5e6eb] px-4 py-3 font-medium">状态</th>
                  <th className="border-b border-[#e5e6eb] px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTemplates.length ? (
                  paginatedTemplates.map((template) => {
                    const enabled = template.status !== 'disabled';
                    const templateSummary = template.description.trim();

                    return (
                      <tr
                        key={template.id}
                        className="h-[72px] bg-white text-[14px] font-normal leading-[22px] text-[#1d2129] transition-colors hover:bg-[#f7f8fa] [&>td]:align-middle"
                      >
                        <td className="min-w-0 border-b border-[#e5e6eb] px-4 py-3">
                          <div className="flex h-12 min-w-0 flex-col items-start gap-1 overflow-hidden">
                            <span className="block max-w-full truncate text-[16px] font-medium leading-6 text-[#1d2129]">
                              {template.name}
                            </span>
                            <TemplateDescription description={templateSummary || '-'} />
                          </div>
                        </td>
                        <td className="whitespace-nowrap border-b border-[#e5e6eb] p-4 text-[#4e5969]">
                          {template.industry || defaultTemplateIndustry}
                        </td>
                        <td className="border-b border-[#e5e6eb] p-4">
                          <span className="inline-flex items-center justify-center rounded-[8px] bg-[#e8f3ff] px-2 py-1 text-[14px] leading-[22px] text-[#165dff]">
                            {normalizeTemplateCategory(template.category)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap border-b border-[#e5e6eb] p-4 text-[#1d2129]">
                          {getTemplateCreatedAtLabel(template)}
                        </td>
                        <td className="border-b border-[#e5e6eb] p-4">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={enabled}
                            onClick={() =>
                              updateReportTemplate(template.id, {
                                status: enabled ? 'disabled' : 'published',
                              })
                            }
                            className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 ${
                              enabled ? 'bg-[#1d2129]' : 'bg-[#c9cdd4]'
                            }`}
                            title={enabled ? '点击停用' : '点击启用'}
                            aria-label={`${template.name}当前${enabled ? '已启用' : '已停用'}，点击${
                              enabled ? '停用' : '启用'
                            }`}
                          >
                            <span
                              className={`absolute rounded-full bg-white shadow-[0_1px_2px_rgba(29,33,41,0.12)] transition-all ${
                                enabled
                                  ? 'right-[2.5px] top-[2.5px] h-[15px] w-[15px]'
                                  : 'left-1 top-1 h-3 w-3'
                              }`}
                            />
                          </button>
                        </td>
                        <td className="border-b border-[#e5e6eb] p-4">
                          <div className="flex items-center justify-start gap-2 whitespace-nowrap">
                            {[
                              {
                                tooltipLabel: '订阅功能开发中，敬请期待',
                                ariaLabel: `订阅${template.name}，功能开发中`,
                                icon: templateSubscriptionIcon,
                                onClick: undefined,
                                unavailable: true,
                              },
                              { tooltipLabel: '编辑', ariaLabel: `编辑${template.name}`, icon: templateEditIcon, onClick: () => openEditTemplateEditor(template), unavailable: false },
                              { tooltipLabel: '查看', ariaLabel: `查看${template.name}`, icon: templateViewIcon, onClick: () => setViewingTemplate(template), unavailable: false },
                              { tooltipLabel: '删除', ariaLabel: `删除${template.name}`, icon: templateDeleteIcon, onClick: () => setPendingDeleteTemplate(template), unavailable: false },
                            ].map((action) => (
                              <Tooltip key={action.ariaLabel} delayDuration={240}>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={action.unavailable ? undefined : action.onClick}
                                    aria-disabled={action.unavailable || undefined}
                                    className={`inline-flex h-8 w-8 items-center justify-center rounded-[8px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 ${
                                      action.unavailable
                                        ? '!cursor-not-allowed'
                                        : 'hover:bg-[#f2f3f5]'
                                    }`}
                                    aria-label={action.ariaLabel}
                                  >
                                    <img aria-hidden="true" className="h-4 w-4" src={action.icon} alt="" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent
                                  side="top"
                                  align="center"
                                  sideOffset={8}
                                  showArrow={false}
                                  className="relative rounded-[4px] bg-[#1d2129] px-3 py-1 text-center font-['PingFang_SC'] text-[14px] font-normal leading-[22px] tracking-normal text-white whitespace-nowrap shadow-none"
                                >
                                  {action.tooltipLabel}
                                  <span
                                    aria-hidden="true"
                                    className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-[5px] border-t-[4px] border-x-transparent border-t-[#1d2129]"
                                  />
                                </TooltipContent>
                              </Tooltip>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="h-40 px-4 text-center text-[14px] text-[#86909c]">
                      未找到匹配的报告模板
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="-mx-[22px] flex h-14 w-[calc(100%+44px)] shrink-0 items-center justify-between border-t border-[#e5e6eb] bg-[#f7f8fa] py-3 pl-[38px] pr-[38px] text-[14px] font-normal text-[#4e5969]">
            <div className="flex items-center gap-4">
              <span className="leading-[22px] text-[#1d2129]">共 {filteredTemplates.length} 条</span>
              <Select
                value={String(templatePageSize)}
                onValueChange={(value) => {
                  setTemplatePageSize(Number(value));
                  setTemplatePage(1);
                }}
              >
                <SelectTrigger
                  aria-label="每页条数"
                  size="sm"
                  className="group h-8 w-auto gap-2.5 rounded-[8px] border-[#e5e6eb] bg-transparent p-2 text-[14px] font-normal leading-5 text-[#4e5969] shadow-none focus-visible:border-[#165dff] focus-visible:ring-2 focus-visible:ring-[#165dff]/10"
                  icon={
                    <span className="relative h-4 w-4 shrink-0 overflow-hidden transition-transform duration-150 group-data-[state=open]:rotate-180">
                      <img aria-hidden="true" className="absolute left-[3.76px] top-[5.48px] h-[5.19px] w-[8.49px]" src={templatePageSizeChevronIcon} alt="" />
                    </span>
                  }
                >
                  <SelectValue>{templatePageSize} 条/页</SelectValue>
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  sideOffset={4}
                  align="start"
                  viewportClassName="h-auto min-h-0 w-full !min-w-0 p-0"
                  className="w-[112px] min-w-[112px] rounded-[8px] border-[#e5e6eb] bg-white p-1 text-[#1d2129] shadow-[0_4px_12px_rgba(29,33,41,0.08)] data-[side=bottom]:!translate-y-0 data-[side=top]:!translate-y-0"
                >
                  {templatePageSizeOptions.map((pageSize) => (
                    <SelectItem
                      key={pageSize}
                      value={String(pageSize)}
                      className="h-8 whitespace-nowrap rounded-[6px] py-0 pl-2 pr-2 text-[14px] leading-5 text-[#4e5969] focus:bg-[#f7f8fa] focus:text-[#1d2129] data-[state=checked]:bg-[#f2f3f5] [&>span:first-child]:hidden"
                    >
                      {pageSize} 条/页
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTemplatePage((page) => Math.max(1, page - 1))}
                  disabled={templatePage === 1}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#f2f3f5] bg-[#f7f8fa] transition-colors hover:bg-[#f2f3f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 disabled:opacity-40"
                  aria-label="上一页"
                  title="上一页"
                >
                  <img aria-hidden="true" className="h-6 w-6" src={templatePageLeftIcon} alt="" />
                </button>
                {templatePageItems.map((item) =>
                  typeof item === 'number' ? (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setTemplatePage(item)}
                      aria-current={templatePage === item ? 'page' : undefined}
                      className={`h-8 min-w-8 rounded-[8px] border px-2 text-center text-[14px] leading-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 ${
                        templatePage === item
                          ? 'border-[#1d2129] bg-[#1d2129] font-medium text-white'
                          : 'border-[#f2f3f5] text-[#4e5969] hover:bg-[#f2f3f5]'
                      }`}
                    >
                      {item}
                    </button>
                  ) : (
                    <span key={item} className="inline-flex h-8 w-8 items-center justify-center text-[14px] leading-5 text-[#4e5969]">
                      ...
                    </span>
                  ),
                )}
                <button
                  type="button"
                  onClick={() => setTemplatePage((page) => Math.min(templateTotalPages, page + 1))}
                  disabled={templatePage === templateTotalPages}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#f2f3f5] bg-[#f7f8fa] transition-colors hover:bg-[#f2f3f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 disabled:opacity-40"
                  aria-label="下一页"
                  title="下一页"
                >
                  <img aria-hidden="true" className="h-6 w-6" src={templatePageRightIcon} alt="" />
                </button>
              </div>

              <div className="flex items-center gap-4">
                <label htmlFor="template-page-jump" className="leading-[22px] text-[#1d2129]">跳至</label>
                <input
                  id="template-page-jump"
                  aria-label="跳转页码"
                  key={`${templatePage}-${templatePageSize}`}
                  inputMode="numeric"
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    const page = Number(event.currentTarget.value);
                    if (Number.isFinite(page) && event.currentTarget.value.trim()) {
                      setTemplatePage(Math.min(templateTotalPages, Math.max(1, page)));
                      event.currentTarget.value = '';
                    }
                  }}
                  className="h-8 w-11 rounded-[8px] border border-[#e5e6eb] bg-transparent p-2 text-center text-[14px] leading-5 text-[#4e5969] outline-none focus:border-[#165dff] focus:ring-2 focus:ring-[#165dff]/10"
                />
                <span className="leading-5">页</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <Dialog
        open={isEditorOpen}
        onOpenChange={(open) => {
          setIsEditorOpen(open);
          if (!open) {
            setBasicErrors({});
            setStructureErrors({});
            setStyleErrors({});
            setEditorStep('basic');
          }
        }}
      >
        <DialogContent
          aria-describedby={undefined}
          showCloseButton={false}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            event.currentTarget.focus();
          }}
          className="!flex h-[760px] w-[760px] max-h-[calc(100vh-32px)] !max-w-[calc(100vw-32px)] flex-col gap-0 overflow-hidden rounded-[16px] border-0 bg-white p-0 font-['PingFang_SC','Microsoft_YaHei',sans-serif] shadow-[-2px_0_22.1px_rgba(0,0,0,0.01)] lg:!max-w-[760px]"
        >
          <div className="shrink-0 border-b border-[#e5e6eb] px-6 pb-3 pt-4">
            <DialogHeader className="flex-row items-center justify-between gap-0 text-left">
              <DialogTitle className="font-['Login_Figma_Sans','PingFang_SC','Microsoft_YaHei',sans-serif] text-[20px] font-medium leading-7 text-[#1d2129]">
                {editingTemplate ? '编辑模板' : '新建模板'}
              </DialogTitle>
              <DialogClose className="relative h-4 w-4 shrink-0 overflow-hidden rounded-[4px] border-0 bg-transparent p-0 transition-colors hover:bg-[#f2f3f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20">
                <img aria-hidden="true" className="absolute inset-[1.862px] h-[12.276px] w-[12.276px]" src={templateModalClose} alt="" />
                <span className="sr-only">关闭</span>
              </DialogClose>
            </DialogHeader>

            <nav aria-label="模板配置步骤" className="mt-3">
              <ol className="grid grid-cols-4">
                {templateEditorSteps.map((step, index) => {
                  const isActive = editorStep === step.value;
                  const isComplete = index < currentEditorStepIndex;
                  return (
                    <li key={step.value} className="relative min-w-0">
                      {index < templateEditorSteps.length - 1 && (
                        <span
                          aria-hidden="true"
                          className={`absolute left-[calc(50%+18px)] top-3 h-px w-[calc(100%-36px)] ${
                            index < currentEditorStepIndex ? 'bg-[#165dff]' : 'bg-[#c9cdd4]'
                          }`}
                        />
                      )}
                      <button
                        type="button"
                        aria-current={isActive ? 'step' : undefined}
                        onClick={() => handleEditorStepChange(step.value)}
                        className="relative z-10 flex min-h-[48px] w-full min-w-0 flex-col items-center px-1 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20"
                      >
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[12px] font-medium leading-5 transition-colors ${
                          isActive
                            ? 'border-[#165dff] bg-[#165dff] text-white'
                            : isComplete
                              ? 'border-[#165dff] bg-[#e8f3ff] text-[#165dff]'
                              : 'border-[#c9cdd4] bg-white text-[#86909c]'
                        }`}>
                          {isComplete ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : index + 1}
                        </span>
                        <span className={`mt-1 block text-[13px] leading-5 ${isActive ? 'font-medium text-[#1d2129]' : 'text-[#4e5969]'}`}>
                          {step.value === 'confirm' && editingTemplate ? '确认修改' : step.title}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </nav>
          </div>

          <div ref={editorContentRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
            {editorStep === 'basic' && <>

            <div className="flex flex-col gap-2">
              <label htmlFor="template-name" className="text-[14px] leading-[22px] tracking-[0.15px] text-[#4e5969]">
                模板名称<span aria-hidden="true" className="ml-0.5 text-[#f53f3f]">*</span>
              </label>
              <div className="relative h-10">
                <input
                  id="template-name"
                  ref={templateNameRef}
                  required
                  maxLength={20}
                  value={form.name}
                  aria-invalid={Boolean(basicErrors.name)}
                  aria-describedby={basicErrors.name ? 'template-name-error' : undefined}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, name: event.target.value }));
                    if (basicErrors.name) setBasicErrors((current) => ({ ...current, name: undefined }));
                  }}
                  placeholder="请输入模板名称"
                  className={`h-full w-full rounded-[12px] border bg-white px-3 pr-14 text-[14px] leading-[22px] tracking-[0.15px] text-[#1d2129] outline-none placeholder:text-[#86909c] focus:ring-2 focus:ring-[#165dff]/10 ${basicErrors.name ? 'border-[#f53f3f] focus:border-[#f53f3f]' : 'border-[#e5e6eb] focus:border-[#165dff]'}`}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] leading-[22px] text-[#86909c]">
                  {form.name.length}/20
                </span>
              </div>
              {basicErrors.name && <p id="template-name-error" className="text-[12px] leading-5 text-[#f53f3f]">{basicErrors.name}</p>}
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="template-industry" className="text-[14px] leading-[22px] tracking-[0.15px] text-[#4e5969]">
                  行业
                </label>
                <Select
                  value={form.industry}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      industry: value,
                      category: normalizeTemplateCategory(current.category),
                    }))
                  }
                >
                  <SelectTrigger
                    id="template-industry"
                    className="group h-10 w-full rounded-[12px] border-[#e5e6eb] bg-white px-3 text-[14px] leading-[22px] tracking-[0.15px] text-[#1d2129] shadow-none outline-none focus-visible:border-[#165dff] focus-visible:ring-2 focus-visible:ring-[#165dff]/10"
                    icon={
                      <span className="relative h-4 w-4 shrink-0 overflow-hidden transition-transform duration-150 group-data-[state=open]:rotate-180">
                        <img className="absolute left-[3.757px] top-[5.482px] h-[5.186px] w-[8.486px]" src={templateModalChevronDown} alt="" />
                      </span>
                    }
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    sideOffset={4}
                    viewportClassName="h-auto min-h-0 w-full !min-w-0 p-0"
                    className="z-[70] w-[var(--radix-select-trigger-width)] !min-w-0 rounded-[12px] border-[#e5e6eb] bg-white p-1 text-[#1d2129] shadow-[0_4px_12px_rgba(29,33,41,0.08)] data-[side=bottom]:!translate-y-0 data-[side=top]:!translate-y-0"
                  >
                    {industryOptions.map((industry) => (
                      <SelectItem
                        key={industry}
                        value={industry}
                        className="h-10 rounded-[8px] py-0 pl-3 pr-9 text-[14px] leading-[22px] text-[#1d2129] focus:bg-[#f7f8fa] focus:text-[#1d2129] data-[state=checked]:bg-[#f2f3f5] data-[state=checked]:font-medium"
                      >
                        {industry}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="template-category" className="text-[14px] leading-[22px] tracking-[0.15px] text-[#4e5969]">
                  分类
                </label>
                <Select
                  value={form.category}
                  onValueChange={(value) => setForm((current) => ({ ...current, category: value }))}
                >
                  <SelectTrigger
                    id="template-category"
                    className="group h-10 w-full rounded-[12px] border-[#e5e6eb] bg-white px-3 text-[14px] leading-[22px] tracking-[0.15px] text-[#1d2129] shadow-none outline-none focus-visible:border-[#165dff] focus-visible:ring-2 focus-visible:ring-[#165dff]/10"
                    icon={
                      <span className="relative h-4 w-4 shrink-0 overflow-hidden transition-transform duration-150 group-data-[state=open]:rotate-180">
                        <img className="absolute left-[3.757px] top-[5.482px] h-[5.186px] w-[8.486px]" src={templateModalChevronDown} alt="" />
                      </span>
                    }
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    sideOffset={4}
                    viewportClassName="h-auto min-h-0 w-full !min-w-0 p-0"
                    className="z-[70] w-[var(--radix-select-trigger-width)] !min-w-0 rounded-[12px] border-[#e5e6eb] bg-white p-1 text-[#1d2129] shadow-[0_4px_12px_rgba(29,33,41,0.08)] data-[side=bottom]:!translate-y-0 data-[side=top]:!translate-y-0"
                  >
                    {templateCategories.map((category) => (
                      <SelectItem
                        key={category}
                        value={category}
                        className="h-10 rounded-[8px] py-0 pl-3 pr-9 text-[14px] leading-[22px] text-[#1d2129] focus:bg-[#f7f8fa] focus:text-[#1d2129] data-[state=checked]:bg-[#f2f3f5] data-[state=checked]:font-medium"
                      >
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="template-description" className="text-[14px] leading-[22px] tracking-[0.15px] text-[#4e5969]">
                模板描述<span className="ml-1 text-[12px] text-[#86909c]">（选填）</span>
              </label>
              <div className="relative h-32">
                <textarea
                  id="template-description"
                  value={form.description ?? ''}
                  onChange={(event) => {
                    const description = event.currentTarget.value.slice(0, templateDescriptionMaxLength);
                    setForm((current) => ({ ...current, description }));
                  }}
                  placeholder="请输入模板描述"
                  maxLength={templateDescriptionMaxLength}
                  className="h-full w-full resize-none rounded-[12px] border border-[#e5e6eb] bg-white px-3 py-2.5 pr-14 text-[14px] leading-[22px] tracking-[0.15px] text-[#1d2129] outline-none placeholder:text-[#86909c] focus:border-[#165dff] focus:ring-2 focus:ring-[#165dff]/10"
                />
                <span className="pointer-events-none absolute bottom-2 right-3 text-[12px] leading-5 text-[#86909c]">
                  {(form.description ?? '').length}/{templateDescriptionMaxLength}
                </span>
              </div>
            </div>

            </>}

            {editorStep === 'structure' && <div className="flex flex-col gap-3">
              <div className="text-[14px] leading-[22px] text-[#4e5969]">报告结构</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  { value: 'skill' as const, title: '标准结构', detail: '选择完整的报告结构 Skill，由 Skill 统一定义叙事风格与分析内容。' },
                  { value: 'custom' as const, title: '自定义结构', detail: '自行填写报告章节顺序和写作要求。' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={option.value === 'custom' ? form.narrativeMode === 'custom' : form.narrativeMode !== 'custom'}
                    onClick={() => {
                      setForm((current) => ({
                        ...current,
                        narrativeMode: option.value,
                        ...(option.value === 'skill'
                          ? { narrativeAdjustmentPrompt: '', narrativeOverridePrompt: '' }
                          : {}),
                      }));
                      setStructureErrors({});
                    }}
                    className={`rounded-[10px] border p-3 text-left transition-colors ${
                      (option.value === 'custom' ? form.narrativeMode === 'custom' : form.narrativeMode !== 'custom')
                        ? 'border-[#165dff] bg-[#e8f3ff]'
                        : 'border-[#e5e6eb] bg-white hover:bg-[#f7f8fa]'
                    }`}
                  >
                    <div className={`text-[14px] font-medium ${(option.value === 'custom' ? form.narrativeMode === 'custom' : form.narrativeMode !== 'custom') ? 'text-[#165dff]' : 'text-[#1d2129]'}`}>
                      {option.title}
                    </div>
                    <div className="mt-1 text-[12px] leading-5 text-[#86909c]">{option.detail}</div>
                  </button>
                ))}
              </div>

              {form.narrativeMode === 'skill' || form.narrativeMode === 'adjusted' ? (
                <>
                  <Select
                    value={form.narrativeSkillId || undefined}
                    onValueChange={(value) => {
                      setForm((current) => ({
                        ...current,
                        narrativeMode: 'skill',
                        narrativeSkillId: value,
                        narrativeOverridePrompt: '',
                        narrativeAdjustmentPrompt: '',
                      }));
                      if (structureErrors.skill) setStructureErrors((current) => ({ ...current, skill: undefined }));
                    }}
                  >
                    <div className="flex flex-col gap-2">
                      <label htmlFor="template-narrative-skill" className="text-[13px] leading-5 text-[#4e5969]">
                        报告结构 Skill
                      </label>
                      <SelectTrigger
                        id="template-narrative-skill"
                        aria-invalid={Boolean(structureErrors.skill)}
                        aria-describedby={structureErrors.skill ? 'template-narrative-skill-error' : undefined}
                        className={`h-10 w-full rounded-[12px] bg-white px-3 text-[14px] shadow-none focus-visible:ring-2 focus-visible:ring-[#165dff]/10 ${
                          structureErrors.skill
                            ? 'border-[#f53f3f] focus-visible:border-[#f53f3f]'
                            : 'border-[#e5e6eb] focus-visible:border-[#165dff]'
                        }`}
                      >
                        <SelectValue placeholder="请选择报告结构 Skill">{selectedNarrativeSkill?.name}</SelectValue>
                      </SelectTrigger>
                      {structureErrors.skill && <p id="template-narrative-skill-error" className="text-[12px] leading-5 text-[#f53f3f]">{structureErrors.skill}</p>}
                    </div>
                    <SelectContent className="min-w-[var(--radix-select-trigger-width)]">
                      {narrativeSkills.map((skill) => (
                        <SelectItem
                          key={skill.id}
                          value={skill.id}
                          className="h-auto items-start py-2 pr-9"
                        >
                          <span className="flex min-w-0 flex-col items-start gap-0.5 py-0.5">
                            <span className="text-[14px] leading-5 text-[#1d2129]">{skill.name}</span>
                            <span className="text-[12px] leading-5 text-[#86909c]">{skill.description}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-col gap-3 rounded-[10px] border border-[#e5e6eb] bg-[#f7f8fa] p-3">
                    <div className="group/prompt flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5">
                          <Tooltip delayDuration={240}>
                            <TooltipTrigger asChild>
                              <label
                                htmlFor="narrative-override-prompt"
                                className="inline-flex shrink-0 cursor-text items-center gap-1.5 text-[13px] leading-5 text-[#4e5969]"
                              >
                                <span>报告结构提示词</span>
                                <PencilLine
                                  aria-hidden="true"
                                  className="h-3.5 w-3.5 shrink-0 text-[#86909c] transition-colors group-focus-within/prompt:text-[#165dff]"
                                />
                              </label>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              sideOffset={6}
                              className="rounded-[6px] border-0 bg-[#1d2129] px-2 py-1 text-[12px] leading-5 text-white shadow-[0_4px_12px_rgba(29,33,41,0.16)]"
                            >
                              编辑提示词
                            </TooltipContent>
                          </Tooltip>
                          <span className="text-[12px] leading-5 text-[#86909c]">修改仅对当前模板生效</span>
                        </div>
                        {isNarrativePromptAdjusted && (
                          <button
                            type="button"
                            onClick={() => setForm((current) => ({
                              ...current,
                              narrativeMode: 'skill',
                              narrativeOverridePrompt: '',
                              narrativeAdjustmentPrompt: '',
                            }))}
                            className="shrink-0 text-[12px] leading-5 text-[#165dff] hover:text-[#0e42d2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20"
                          >
                            恢复默认
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <textarea
                          id="narrative-override-prompt"
                          maxLength={1000}
                          value={displayedNarrativePrompt}
                          onChange={(event) => {
                            const nextPrompt = event.currentTarget.value;
                            const isDefaultPrompt = nextPrompt === defaultNarrativePrompt;
                            setForm((current) => ({
                              ...current,
                              narrativeMode: isDefaultPrompt ? 'skill' : 'adjusted',
                              narrativeOverridePrompt: isDefaultPrompt ? '' : nextPrompt,
                              narrativeAdjustmentPrompt: '',
                            }));
                          }}
                          placeholder="当前 Skill 暂无报告结构提示词"
                          className="min-h-[260px] w-full cursor-text resize-y rounded-[8px] border border-[#e5e6eb] bg-white p-3 pb-8 text-[14px] leading-[22px] text-[#1d2129] outline-none transition-[border-color,box-shadow] placeholder:text-[#86909c] hover:border-[#c9cdd4] focus:border-[#165dff] focus:ring-2 focus:ring-[#165dff]/10 focus:hover:border-[#165dff]"
                        />
                        <span className="pointer-events-none absolute bottom-2 right-3 text-[12px] leading-5 text-[#86909c]">
                          {displayedNarrativePrompt.length}/1000
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-3 rounded-[10px] border border-[#e5e6eb] bg-[#f7f8fa] p-3">
                  <label htmlFor="custom-narrative-prompt" className="text-[13px] leading-5 text-[#4e5969]">
                    报告结构提示词
                  </label>
                  <div className="relative">
                    <textarea
                      id="custom-narrative-prompt"
                      ref={customNarrativePromptRef}
                      maxLength={1000}
                      value={form.customNarrativePrompt}
                      aria-invalid={Boolean(structureErrors.prompt)}
                      aria-describedby={structureErrors.prompt ? 'custom-narrative-prompt-error' : undefined}
                      onChange={(event) => {
                        setForm((current) => ({ ...current, customNarrativePrompt: event.target.value }));
                        if (structureErrors.prompt) setStructureErrors((current) => ({ ...current, prompt: undefined }));
                      }}
                      placeholder="请填写完整报告结构，包括章节、顺序和写作要求，并说明要分析的指标、问题和时间范围。"
                      className={`min-h-[260px] w-full resize-y rounded-[8px] border bg-white p-3 pb-8 text-[14px] leading-[22px] text-[#1d2129] outline-none placeholder:text-[#86909c] focus:ring-2 focus:ring-[#165dff]/10 ${
                        structureErrors.prompt ? 'border-[#f53f3f] focus:border-[#f53f3f]' : 'border-[#e5e6eb] focus:border-[#165dff]'
                      }`}
                    />
                    <span className="pointer-events-none absolute bottom-2 right-3 text-[12px] leading-5 text-[#86909c]">
                      {(form.customNarrativePrompt ?? '').length}/1000
                    </span>
                  </div>
                  {structureErrors.prompt && <p id="custom-narrative-prompt-error" className="text-[12px] leading-5 text-[#f53f3f]">{structureErrors.prompt}</p>}
                </div>
              )}
            </div>}

            {editorStep === 'style' && <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[14px] leading-[22px] text-[#4e5969]">视觉风格</div>
                <div role="group" aria-label="视觉风格配置方式" className="inline-flex shrink-0 rounded-[8px] bg-[#f2f3f5] p-1">
                  <button
                    type="button"
                    aria-pressed={form.styleMode !== 'custom'}
                    onClick={() => {
                      setForm((current) => ({
                        ...current,
                        styleMode: 'skill',
                        styleOverridePrompt: '',
                        styleAdjustmentPrompt: '',
                      }));
                      setStyleErrors({});
                    }}
                    className={`h-7 rounded-[6px] px-3 text-[12px] leading-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 ${
                      form.styleMode !== 'custom' ? 'bg-white font-medium text-[#1d2129] shadow-sm' : 'text-[#4e5969] hover:text-[#1d2129]'
                    }`}
                  >
                    风格模板
                  </button>
                  <button
                    type="button"
                    aria-pressed={form.styleMode === 'custom'}
                    onClick={() => {
                      setForm((current) => ({ ...current, styleMode: 'custom' }));
                      setStyleErrors({});
                    }}
                    className={`h-7 rounded-[6px] px-3 text-[12px] leading-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 ${
                      form.styleMode === 'custom' ? 'bg-white font-medium text-[#1d2129] shadow-sm' : 'text-[#4e5969] hover:text-[#1d2129]'
                    }`}
                  >
                    自定义
                  </button>
                </div>
              </div>

              {form.styleMode !== 'custom' ? (
                <>
                  <fieldset aria-describedby={styleErrors.skill ? 'template-style-skill-error' : undefined} className="min-w-0">
                    <legend className="sr-only">选择视觉风格</legend>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {styleSkills.map((skill) => {
                        const palette = getStylePreviewPalette(skill.id);
                        const isSelected = form.styleSkillId === skill.id;

                        return (
                          <label key={skill.id} className="min-w-0 cursor-pointer">
                            <input
                              type="radio"
                              name="template-style-skill"
                              value={skill.id}
                              aria-label={`选择${skill.name}`}
                              checked={isSelected}
                              onChange={() => {
                                setForm((current) => ({
                                  ...current,
                                  styleMode: 'skill',
                                  styleSkillId: skill.id,
                                  styleOverridePrompt: '',
                                  styleAdjustmentPrompt: '',
                                }));
                                if (styleErrors.skill) setStyleErrors((current) => ({ ...current, skill: undefined }));
                              }}
                              className="peer sr-only"
                            />
                            <span className={`block h-full overflow-hidden rounded-[8px] border bg-white transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-[#c9cdd4] hover:shadow-[0_4px_12px_rgba(29,33,41,0.08)] peer-focus-visible:ring-2 peer-focus-visible:ring-[#165dff]/25 ${
                              isSelected ? 'border-[#165dff] shadow-[0_0_0_1px_#165dff]' : 'border-[#e5e6eb]'
                            }`}>
                              <span className="block h-[108px] p-2.5" style={{ backgroundColor: palette.canvas }}>
                                <span className="flex h-full flex-col rounded-[5px] p-2 shadow-[0_1px_4px_rgba(29,33,41,0.08)]" style={{ backgroundColor: palette.surface }}>
                                  <span className="flex items-center justify-between gap-2">
                                    <span className="h-1.5 w-12 rounded-full" style={{ backgroundColor: palette.accent }} />
                                    <span className="text-[7px] font-medium leading-none" style={{ color: palette.text }}>{palette.previewTitle}</span>
                                  </span>
                                  <span className="mt-2 grid grid-cols-3 gap-1">
                                    {palette.metrics.map((value, index) => (
                                      <span key={value} className="rounded-[2px] px-1 py-1" style={{ backgroundColor: palette.surfaceMuted }}>
                                        <span className="block text-[7px] font-semibold leading-none" style={{ color: index === 2 ? palette.secondary : palette.text }}>{value}</span>
                                        <span className="mt-1 block h-0.5 w-4 rounded-full opacity-60" style={{ backgroundColor: index === 1 ? palette.signal : palette.accent }} />
                                      </span>
                                    ))}
                                  </span>
                                  <span className="mt-2 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_44px] gap-1.5">
                                    <span className="flex items-end gap-1 border-b border-l px-1" style={{ borderColor: `${palette.text}26` }}>
                                      {[42, 68, 54, 82, 66, 92].map((height, index) => (
                                        <span key={index} className="flex-1 rounded-t-[1px]" style={{ height: `${height}%`, backgroundColor: index > 3 ? palette.secondary : palette.accent }} />
                                      ))}
                                    </span>
                                    <span className="flex flex-col justify-center gap-1 rounded-[2px] px-1" style={{ backgroundColor: palette.surfaceMuted }}>
                                      <span className="h-0.5 w-full rounded-full" style={{ backgroundColor: palette.signal }} />
                                      <span className="h-0.5 w-4/5 rounded-full opacity-50" style={{ backgroundColor: palette.text }} />
                                      <span className="h-0.5 w-3/5 rounded-full opacity-30" style={{ backgroundColor: palette.text }} />
                                    </span>
                                  </span>
                                </span>
                              </span>
                              <span className="block px-2.5 py-2.5">
                                <span className="flex min-h-10 items-start justify-between gap-2">
                                  <span className="line-clamp-2 min-w-0 text-[13px] font-medium leading-5 text-[#1d2129]">{skill.name}</span>
                                  {isSelected && (
                                    <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] leading-5 text-[#165dff]">
                                      <Check aria-hidden="true" className="h-3 w-3" />
                                      已选
                                    </span>
                                  )}
                                </span>
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    {styleErrors.skill && <p id="template-style-skill-error" className="mt-2 text-[12px] leading-5 text-[#f53f3f]">{styleErrors.skill}</p>}
                  </fieldset>
                </>
              ) : (
                <div className="flex flex-col gap-3 rounded-[10px] border border-[#e5e6eb] bg-[#f7f8fa] p-3">
                  <label htmlFor="custom-style-prompt" className="text-[13px] leading-5 text-[#4e5969]">视觉风格提示词</label>
                  <div className="relative">
                    <textarea
                      id="custom-style-prompt"
                      ref={customStylePromptRef}
                      maxLength={1000}
                      value={form.customStylePrompt}
                      aria-invalid={Boolean(styleErrors.prompt)}
                      aria-describedby={styleErrors.prompt ? 'custom-style-prompt-error' : undefined}
                      onChange={(event) => {
                        setForm((current) => ({ ...current, customStylePrompt: event.target.value }));
                        if (styleErrors.prompt) setStyleErrors((current) => ({ ...current, prompt: undefined }));
                      }}
                      placeholder="请填写颜色、字体、图表样式和视觉表达要求。"
                      className={`min-h-[260px] w-full resize-y rounded-[8px] border bg-white p-3 pb-8 text-[14px] leading-[22px] text-[#1d2129] outline-none placeholder:text-[#86909c] focus:ring-2 focus:ring-[#165dff]/10 ${
                        styleErrors.prompt ? 'border-[#f53f3f] focus:border-[#f53f3f]' : 'border-[#e5e6eb] focus:border-[#165dff]'
                      }`}
                    />
                    <span className="pointer-events-none absolute bottom-2 right-3 text-[12px] leading-5 text-[#86909c]">
                      {(form.customStylePrompt ?? '').length}/1000
                    </span>
                  </div>
                  {styleErrors.prompt && <p id="custom-style-prompt-error" className="text-[12px] leading-5 text-[#f53f3f]">{styleErrors.prompt}</p>}
                </div>
              )}
            </div>}

            {editorStep === 'confirm' && (
              <div className="flex min-h-0 flex-col gap-6 py-1">
                <section aria-labelledby="template-information-heading">
                  <h3 id="template-information-heading" className="text-[15px] font-medium leading-6 text-[#1d2129]">
                    模板信息
                  </h3>
                  <dl className="mt-3 border-y border-[#e5e6eb] text-[14px] leading-[22px]">
                    <div className="grid grid-cols-1 sm:grid-cols-2">
                      <div className="min-w-0 py-3 sm:pr-6">
                        <dt className="text-[12px] leading-5 text-[#86909c]">模板名称</dt>
                        <dd className="mt-1 break-words font-medium text-[#1d2129]">{form.name || '未命名模板'}</dd>
                      </div>
                      <div className="min-w-0 border-t py-3 sm:border-l sm:border-t-0 sm:pl-6">
                        <dt className="text-[12px] leading-5 text-[#86909c]">行业与分类</dt>
                        <dd className="mt-1 break-words text-[#1d2129]">{form.industry} · {form.category}</dd>
                      </div>
                    </div>
                    <div className="border-t border-[#e5e6eb] py-3">
                      <dt className="text-[12px] leading-5 text-[#86909c]">模板描述</dt>
                      <dd className={`mt-1 break-words ${form.description.trim() ? 'text-[#1d2129]' : 'text-[#86909c]'}`}>
                        {form.description.trim() || '未填写'}
                      </dd>
                    </div>
                  </dl>
                </section>

                <section aria-labelledby="template-generation-heading">
                  <h3 id="template-generation-heading" className="text-[15px] font-medium leading-6 text-[#1d2129]">
                    生成配置
                  </h3>
                  <dl className="mt-3 divide-y divide-[#e5e6eb] border-y border-[#e5e6eb]">
                    <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-4 py-4 sm:grid-cols-[112px_minmax(0,1fr)]">
                      <dt className="text-[13px] leading-5 text-[#4e5969]">报告结构</dt>
                      <dd className="min-w-0 break-words text-[14px] font-medium leading-[22px] text-[#1d2129]">
                        {form.narrativeMode === 'custom' ? '自定义报告结构' : selectedNarrativeSkill?.name ?? '未选择'}
                      </dd>
                    </div>
                    <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-4 py-4 sm:grid-cols-[112px_minmax(0,1fr)]">
                      <dt className="text-[13px] leading-5 text-[#4e5969]">视觉风格</dt>
                      <dd className="min-w-0 break-words text-[14px] font-medium leading-[22px] text-[#1d2129]">
                        {form.styleMode === 'custom' ? '自定义视觉风格' : selectedStyleSkill?.name ?? '未选择'}
                      </dd>
                    </div>
                  </dl>
                </section>
              </div>
            )}
          </div>

          <div className="flex h-16 shrink-0 items-center justify-end gap-4 border-t border-[#e5e6eb] bg-[#f7f8fa] px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              {editorStep !== 'basic' && (
                <button
                  type="button"
                  onClick={() => {
                    const previousStep = templateEditorSteps[currentEditorStepIndex - 1]?.value;
                    if (previousStep) setEditorStep(previousStep);
                  }}
                  className="inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-[12px] border border-[#e5e6eb] bg-transparent px-3 text-[14px] leading-[22px] text-[#4e5969] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 sm:px-5"
                >
                  上一步
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-[12px] border border-[#e5e6eb] bg-transparent px-3 text-[14px] leading-[22px] text-[rgba(0,0,0,0.9)] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 sm:px-5"
              >
                取消
              </button>
              {editorStep !== 'confirm' ? (
                <button
                  type="button"
                  onClick={() => {
                    const nextStep = templateEditorSteps[currentEditorStepIndex + 1]?.value;
                    if (nextStep) handleEditorStepChange(nextStep);
                  }}
                  className="inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-[12px] border border-[#1d2129] bg-[#1d2129] px-4 text-[14px] leading-[22px] tracking-[0.15px] text-white transition-colors hover:bg-[#2f3339] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 sm:px-6"
                >
                  下一步
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  className="inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-[12px] border border-[#1d2129] bg-[#1d2129] px-4 text-[14px] leading-[22px] tracking-[0.15px] text-white transition-colors hover:bg-[#2f3339] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 sm:px-6"
                >
                  {editingTemplate ? '保存' : '创建'}
                </button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(viewingTemplate)}
        onOpenChange={(open) => {
          if (!open) setViewingTemplate(null);
        }}
      >
        <DialogContent
          aria-describedby={undefined}
          showCloseButton={false}
          className="!flex h-[610px] w-[580px] max-h-[calc(100vh-32px)] max-w-[calc(100vw-32px)] flex-col gap-0 overflow-hidden rounded-[20px] border-0 bg-white p-0 font-['PingFang_SC','Microsoft_YaHei',sans-serif] shadow-[-2px_0_22.1px_rgba(0,0,0,0.01)] sm:max-w-[580px]"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
            <DialogHeader className="flex-row items-center justify-between gap-0 text-left">
              <DialogTitle className="font-['Login_Figma_Sans','PingFang_SC','Microsoft_YaHei',sans-serif] text-[20px] font-medium leading-7 text-[#1d2129]">
                查看模板
              </DialogTitle>
              <DialogClose className="relative h-4 w-4 shrink-0 overflow-hidden rounded-[4px] border-0 bg-transparent p-0 transition-colors hover:bg-[#f2f3f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20">
                <img aria-hidden="true" className="absolute inset-[1.862px] h-[12.276px] w-[12.276px]" src={templateModalClose} alt="" />
                <span className="sr-only">关闭</span>
              </DialogClose>
            </DialogHeader>

            {viewingTemplate && (
              <dl className="flex min-h-0 flex-1 flex-col gap-4">
                <div className="flex items-start border-b border-[#e5e6eb] pb-4 pt-1">
                  <dt className="w-20 shrink-0 text-[14px] leading-[22px] tracking-[0.15px] text-[#4e5969]">模板名称</dt>
                  <dd className="min-w-0 flex-1 break-words text-[14px] font-medium leading-[22px] text-[#1d2129]">
                    {viewingTemplate.name}
                  </dd>
                </div>

                <div className="grid grid-cols-2 gap-4 border-b border-[#e5e6eb] pb-4">
                  <div className="flex items-center gap-3">
                    <dt className="text-[14px] leading-[22px] tracking-[0.15px] text-[#4e5969]">业务线</dt>
                    <dd className="text-[14px] leading-[22px] text-[#1d2129]">
                      {viewingTemplate.industry || defaultTemplateIndustry}
                    </dd>
                  </div>
                  <div className="flex items-center gap-3">
                    <dt className="text-[14px] leading-[22px] tracking-[0.15px] text-[#4e5969]">分类</dt>
                    <dd className="text-[14px] leading-[22px] text-[#1d2129]">{normalizeTemplateCategory(viewingTemplate.category)}</dd>
                  </div>
                </div>

                <div className="flex items-start border-b border-[#e5e6eb] pb-4">
                  <dt className="w-28 shrink-0 text-[14px] leading-[22px] text-[#4e5969]">报告结构</dt>
                  <dd className="min-w-0 flex-1 text-[14px] leading-[22px] text-[#1d2129]">
                    {viewingTemplate.narrativeMode === 'custom'
                      ? '自定义报告结构'
                      : `使用标准报告结构 · ${skills.find((skill) => skill.id === viewingTemplate.narrativeSkillId)?.name ?? '未绑定报告结构 Skill'}`}
                  </dd>
                </div>

                {viewingTemplate.narrativeMode === 'custom' && (
                  <div className="flex flex-col gap-2 border-b border-[#e5e6eb] pb-4">
                    <dt className="text-[14px] leading-[22px] text-[#4e5969]">自定义报告组织要求</dt>
                    <dd className="whitespace-pre-wrap break-words rounded-[10px] border border-[#e5e6eb] bg-[#f7f8fa] px-3 py-2.5 text-[14px] leading-[22px] text-[#1d2129]">
                      {viewingTemplate.customNarrativePrompt?.trim() || '未配置'}
                    </dd>
                  </div>
                )}

                {viewingTemplate.narrativeMode === 'adjusted' && (
                  <div className="flex flex-col gap-2 border-b border-[#e5e6eb] pb-4">
                    <dt className="text-[14px] leading-[22px] text-[#4e5969]">本模板的报告结构提示词</dt>
                    <dd className="whitespace-pre-wrap break-words rounded-[10px] border border-[#e5e6eb] bg-[#f7f8fa] px-3 py-2.5 text-[14px] leading-[22px] text-[#1d2129]">
                      {viewingTemplate.narrativeOverridePrompt?.trim() || viewingTemplate.narrativeAdjustmentPrompt?.trim() || '未配置'}
                    </dd>
                  </div>
                )}

                <div className="flex items-start border-b border-[#e5e6eb] pb-4">
                  <dt className="w-28 shrink-0 text-[14px] leading-[22px] text-[#4e5969]">视觉风格</dt>
                  <dd className="min-w-0 flex-1 text-[14px] leading-[22px] text-[#1d2129]">
                    {viewingTemplate.styleMode === 'custom'
                      ? '自定义视觉风格'
                      : `使用标准视觉风格 · ${skills.find((skill) => skill.id === viewingTemplate.styleSkillId)?.name ?? '未绑定视觉风格 Skill'}`}
                  </dd>
                </div>

                {viewingTemplate.styleMode === 'custom' && (
                  <div className="flex flex-col gap-2 border-b border-[#e5e6eb] pb-4">
                    <dt className="text-[14px] leading-[22px] text-[#4e5969]">视觉风格提示词</dt>
                    <dd className="whitespace-pre-wrap break-words rounded-[10px] border border-[#e5e6eb] bg-[#f7f8fa] px-3 py-2.5 text-[14px] leading-[22px] text-[#1d2129]">
                      {viewingTemplate.customStylePrompt?.trim() || '未配置'}
                    </dd>
                  </div>
                )}

                {viewingTemplate.styleMode === 'adjusted' && (
                  <div className="flex flex-col gap-2 border-b border-[#e5e6eb] pb-4">
                    <dt className="text-[14px] leading-[22px] text-[#4e5969]">视觉风格提示词（编辑不影响 Skill）</dt>
                    <dd className="whitespace-pre-wrap break-words rounded-[10px] border border-[#e5e6eb] bg-[#f7f8fa] px-3 py-2.5 text-[14px] leading-[22px] text-[#1d2129]">
                      {viewingTemplate.styleOverridePrompt?.trim() || viewingTemplate.styleAdjustmentPrompt?.trim() || '未配置'}
                    </dd>
                  </div>
                )}

                <div className="flex flex-col gap-2 border-b border-[#e5e6eb] pb-4">
                  <dt className="text-[14px] leading-[22px] text-[#4e5969]">章节与指标</dt>
                  <dd className="space-y-2">
                    <div className="rounded-[8px] bg-[#f7f8fa] px-3 py-2 text-[13px] leading-5 text-[#4e5969]">
                      当前由所选报告结构 Skill 统一组织叙事风格与分析内容。
                    </div>
                  </dd>
                </div>
              </dl>
            )}
          </div>

          <div className="flex h-16 shrink-0 items-center justify-end gap-4 border-t border-[#e5e6eb] bg-[#f7f8fa] px-6 py-3">
            <button
              type="button"
              onClick={() => setViewingTemplate(null)}
              className="inline-flex h-10 items-center justify-center rounded-[12px] border border-[#1d2129] bg-[#1d2129] px-6 text-[14px] leading-[22px] tracking-[0.15px] text-white transition-colors hover:bg-[#2f3339] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20"
            >
              关闭
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(pendingDeleteTemplate)}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteTemplate(null);
        }}
      >
        <DialogContent
          onPointerDownOutside={() => setPendingDeleteTemplate(null)}
          className="max-w-[360px] gap-5 rounded-[8px] border-[#e5e6eb] p-5 shadow-[0_12px_32px_rgba(29,33,41,0.16)]"
        >
          <DialogHeader className="gap-2">
            <DialogTitle className="text-[18px] leading-[26px]">删除模板</DialogTitle>
            <DialogDescription className="leading-[22px] text-[#4e5969]">
              确认删除「{pendingDeleteTemplate?.name}」？删除后不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <button
              type="button"
              onClick={() => setPendingDeleteTemplate(null)}
              className="h-9 rounded-[6px] border border-[#d9dce3] px-4 text-[#4e5969] transition-colors hover:bg-[#f7f8fa] hover:text-[#1d2129]"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => {
                if (pendingDeleteTemplate) deleteReportTemplate(pendingDeleteTemplate.id);
                setPendingDeleteTemplate(null);
              }}
              className="h-9 rounded-[6px] bg-[#f53f3f] px-4 text-white transition-colors hover:bg-[#d9363e]"
            >
              删除
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
