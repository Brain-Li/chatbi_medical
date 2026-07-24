import { useEffect, useMemo, useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { ReportTemplate, ReportTemplateSection, ReportTemplateStatus } from '../types';
import templateModalChevronDown from '../../assets/figma-report-template/template-modal-chevron-down.svg';
import templateModalClose from '../../assets/figma-report-template/template-modal-close.svg';
import templateModalResizer from '../../assets/figma-report-template/template-modal-resizer.svg';
import templateDeleteIcon from '../../assets/figma-report-template/template-delete.svg';
import templateEditIcon from '../../assets/figma-report-template/template-edit.svg';
import templatePageLeftIcon from '../../assets/figma-report-template/template-page-left.svg';
import templatePageRightIcon from '../../assets/figma-report-template/template-page-right.svg';
import templatePlusIcon from '../../assets/figma-report-template/template-plus.svg';
import templatePageSizeChevronIcon from '../../assets/figma-report-template/report-template-chevron-down.svg';
import templateSearchIcon from '../../assets/figma-report-template/report-template-search.svg';
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
const triggerPhraseMaxCount = 10;
const triggerPhraseMaxLength = 10;

type TemplateFormState = {
  name: string;
  category: string;
  status: ReportTemplateStatus;
  triggerPhrases: string;
  templatePrompt: string;
  sections: Array<Pick<ReportTemplateSection, 'title' | 'description' | 'required'>>;
  outputFormats: string;
};

const emptyTemplateForm: TemplateFormState = {
  name: '',
  category: '专题',
  status: 'published',
  triggerPhrases: '',
  templatePrompt: '',
  sections: [
    { title: '核心摘要', description: '概括报告核心结论。', required: true },
    { title: '趋势分析', description: '说明关键指标变化。', required: true },
    { title: '行动建议', description: '给出后续管理动作。', required: false },
  ],
  outputFormats: 'PDF, PNG',
};

function splitList(value: string) {
  return value
    .split(/[,，、/\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitTriggerPhrases(value: string) {
  return value
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeTriggerPhrases(value: string) {
  return Array.from(new Set(splitTriggerPhrases(value)));
}

function validateTriggerPhrases(value: string) {
  const items = splitTriggerPhrases(value);
  const overlong = items.find((item) => [...item].length > triggerPhraseMaxLength);

  if (items.length > triggerPhraseMaxCount) {
    return {
      count: items.length,
      error: `最多支持 ${triggerPhraseMaxCount} 个触发词，请删减 ${items.length - triggerPhraseMaxCount} 个后保存`,
    };
  }

  if (overlong) {
    return {
      count: items.length,
      error: `单个触发词最多 ${triggerPhraseMaxLength} 个字符，请删减后保存`,
    };
  }

  return { count: items.length, error: '' };
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

function getTemplatePrompt(template: ReportTemplate) {
  if (template.templatePrompt?.trim()) return template.templatePrompt;

  if (template.name.includes('日报')) {
    return [
      '你是医院经营分析负责人，请按“日报”方式生成报告。',
      '报告先输出 3 条以内的管理层摘要，再展开关键指标、趋势对比、异常提示和行动建议。',
      '分析时重点关注收入、门诊量/住院量、药占比、耗占比、检查收入和重点科室贡献变化。',
      '结论必须先说业务影响，再说明可能原因；如果缺少口径或周期，请在报告开头标注默认假设。',
    ].join('\n');
  }

  if (template.name.includes('月报')) {
    return [
      '你是科室运营分析专家，请按“月报”方式生成结构化报告。',
      '报告结构包含：科室总览、同比环比趋势、收入/流量/费用结构拆解、异常科室或病种提示、下月管理建议。',
      '分析时优先解释趋势背后的结构变化，不只罗列数字；需要突出对科室负责人的可执行动作。',
      '输出语气面向经营管理场景，结论清晰、证据充分、建议具体。',
    ].join('\n');
  }

  if (template.name.includes('药耗') || template.name.includes('费用结构')) {
    return [
      '你是药耗结构专题分析专家，请围绕药占比、耗占比和费用结构变化生成专题报告。',
      '报告先判断总体是否异常，再拆解到费用组、科室、病种或项目，并说明主要贡献项。',
      '对异常项要给出可复核线索，例如变化幅度、连续期数、贡献排名和建议复核方向。',
      '最后输出控费、结构优化或进一步核查建议，避免直接给出临床诊断结论。',
    ].join('\n');
  }

  if (template.name.includes('异常')) {
    return [
      '你是异常费用复核分析专家，请按“异常概览 -> 异常聚类 -> 证据链 -> 复核建议”的结构生成报告。',
      '先界定观察期、影响范围和异常等级，再列出主要异常费用组及其贡献。',
      '分析中要区分经营异常、结构变化和可能的数据口径问题；每个结论都要附带可复核的数据线索。',
      '报告末尾给出下一步人工复核路径和优先级。',
    ].join('\n');
  }

  return [
    `你是医院经营分析专家，请围绕“${template.name || template.category}”生成报告。`,
    '报告需要先给结论摘要，再按章节展开关键指标、趋势变化、异常原因和行动建议。',
    '如果用户问题缺少周期、范围或对象，请使用模板默认假设并在报告中说明。',
  ].join('\n');
}

function toTemplateForm(template: ReportTemplate): TemplateFormState {
  return {
    name: template.name,
    category: template.category,
    status: template.status === 'disabled' ? 'disabled' : 'published',
    triggerPhrases: template.triggerPhrases.join(', '),
    templatePrompt: getTemplatePrompt(template),
    sections: template.sections.length
      ? template.sections.map((section) => ({
          title: section.title,
          description: section.description,
          required: section.required,
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
    }))
    .filter((section) => section.title);

  return {
    id: existing?.id ?? `template-${timestamp}`,
    name: form.name.trim() || '未命名报告模板',
    description: form.templatePrompt.trim().slice(0, 80) || '通过提示词配置的报告模板。',
    category: form.category.trim() || '专题',
    version: existing?.version ?? 'v1.0',
    createdAt: existing?.createdAt ?? formatTemplateCreatedAt(createdAt),
    status: form.status,
    triggerPhrases: normalizeTriggerPhrases(form.triggerPhrases),
    templatePrompt: form.templatePrompt.trim(),
    applicableAgentIds: existing?.applicableAgentIds ?? [],
    datasetIds: existing?.datasetIds ?? [],
    skillIds: existing?.skillIds ?? [],
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
    addReportTemplate,
    updateReportTemplate,
    deleteReportTemplate,
  } = useWorkspace();
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [templatePage, setTemplatePage] = useState(1);
  const [templatePageSize, setTemplatePageSize] = useState<number>(templatePageSizeOptions[0]);
  const [editingTemplate, setEditingTemplate] = useState<ReportTemplate | null>(null);
  const [viewingTemplate, setViewingTemplate] = useState<ReportTemplate | null>(null);
  const [pendingDeleteTemplate, setPendingDeleteTemplate] = useState<ReportTemplate | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [form, setForm] = useState<TemplateFormState>(emptyTemplateForm);
  const triggerPhraseValidation = validateTriggerPhrases(form.triggerPhrases);

  const filteredTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return reportTemplates
      .filter((template) => {
        const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
        const matchesQuery =
          !normalizedQuery ||
          [
            template.name,
            template.templatePrompt,
            ...template.triggerPhrases,
            ...template.sections.map((section) => section.title),
          ]
            .join(' ')
            .toLowerCase()
            .includes(normalizedQuery);

        return matchesCategory && matchesQuery;
      })
      .sort((current, next) => getTemplateCreatedAtTime(next) - getTemplateCreatedAtTime(current));
  }, [query, reportTemplates, selectedCategory]);

  useEffect(() => {
    setTemplatePage(1);
  }, [query, selectedCategory]);

  const categoryOptions = useMemo(() => {
    const categories = new Set(['专题']);

    reportTemplates.forEach((template) => {
      const category = template.category.trim();
      if (category) categories.add(category);
    });

    const currentCategory = form.category.trim();
    if (currentCategory) categories.add(currentCategory);

    return Array.from(categories);
  }, [form.category, reportTemplates]);

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
    setIsEditorOpen(true);
  };

  const openEditTemplateEditor = (template: ReportTemplate) => {
    setEditingTemplate(template);
    setForm(toTemplateForm(template));
    setIsEditorOpen(true);
  };

  const handleSaveTemplate = () => {
    if (triggerPhraseValidation.error) return;

    const nextTemplate = createTemplateFromForm(form, editingTemplate ?? undefined);

    if (editingTemplate) {
      updateReportTemplate(editingTemplate.id, nextTemplate);
    } else {
      addReportTemplate(nextTemplate);
    }

    setIsEditorOpen(false);
    setEditingTemplate(null);
    setForm(emptyTemplateForm);
  };

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
                placeholder="搜索模板名称或触发词"
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
          </div>
        </div>

        <div className="mt-4 flex h-7 shrink-0 items-center gap-3 overflow-x-auto" aria-label="模板分类">
          <button
            type="button"
            aria-pressed={selectedCategory === 'all'}
            onClick={() => setSelectedCategory('all')}
            className={`h-7 rounded-[14px] px-3 text-[14px] font-normal leading-7 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 ${
              selectedCategory === 'all'
                ? 'bg-[#1d2129] text-white'
                : 'bg-[#f2f3f5] text-[#4e5969] hover:bg-[#e5e6eb]'
            }`}
          >
            全部
          </button>
          {categoryOptions.map((category) => (
            <button
              key={category}
              type="button"
              aria-pressed={selectedCategory === category}
              onClick={() => setSelectedCategory(category)}
              className={`h-7 rounded-[14px] px-3 text-[14px] font-normal leading-7 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 ${
                selectedCategory === category
                  ? 'bg-[#1d2129] text-white'
                  : 'bg-[#f2f3f5] text-[#4e5969] hover:bg-[#e5e6eb]'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        <section className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden" aria-label="报告模板列表">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[1080px] table-fixed border-collapse">
              <colgroup>
                <col className="w-[260px] min-[1600px]:w-[16%]" />
                <col className="w-[90px] min-[1600px]:w-[7%]" />
                <col className="min-[1600px]:w-[44%]" />
                <col className="w-[165px] min-[1600px]:w-[15%]" />
                <col className="w-[90px] min-[1600px]:w-[10%]" />
                <col className="w-[136px] min-[1600px]:w-[8%]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-[#f7f8fa]">
                <tr className="h-12 border-b border-[#e5e6eb] text-left text-[14px] font-normal leading-[22px] text-[#4e5969]">
                  <th className="px-4 font-normal">模板名称</th>
                  <th className="px-3 font-normal">分类</th>
                  <th className="px-3 font-normal">触发词</th>
                  <th className="px-3 font-normal">创建时间</th>
                  <th className="px-3 font-normal">状态</th>
                  <th className="px-2 font-normal">操作</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTemplates.length ? (
                  paginatedTemplates.map((template) => {
                    const enabled = template.status !== 'disabled';
                    const triggerPhrasesLabel = template.triggerPhrases.join(', ');

                    return (
                      <tr
                        key={template.id}
                        className="h-16 border-b border-[#e5e6eb] text-[14px] font-normal leading-[22px] text-[#4e5969] transition-colors hover:bg-[#f7f8fa] [&>td]:align-middle"
                      >
                        <td className="min-w-0 px-4 py-2.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                tabIndex={0}
                                aria-label={`${template.name}，查看完整模板名称`}
                                className="inline-block max-w-full truncate align-middle font-medium text-[#1d2129] outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20"
                              >
                                {template.name}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              align="start"
                              sideOffset={8}
                              collisionPadding={12}
                              arrowClassName="bg-[#1d2129] fill-[#1d2129]"
                              className="relative max-w-[420px] rounded-[4px] border-0 bg-[#1d2129] px-3 py-2.5 text-left font-['PingFang_SC'] text-[14px] font-normal leading-[22px] tracking-normal text-white shadow-none"
                            >
                              <div className="break-words font-medium text-white">{template.name}</div>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex h-7 items-center rounded-[4px] bg-[#e8f3ff] px-2.5 text-[14px] leading-[22px] text-[#165dff]">
                            {template.category}
                          </span>
                        </td>
                        <td className="min-w-0 px-3 py-2.5">
                          {triggerPhrasesLabel ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span
                                  tabIndex={0}
                                  aria-label={`${template.name}完整触发词：${triggerPhrasesLabel}`}
                                  className="block max-w-full truncate outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20"
                                >
                                  {triggerPhrasesLabel}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                align="start"
                                sideOffset={8}
                                collisionPadding={12}
                                arrowClassName="bg-[#1d2129] fill-[#1d2129]"
                                className="max-w-[420px] whitespace-pre-wrap break-words rounded-[4px] border-0 bg-[#1d2129] px-3 py-2.5 text-left font-['PingFang_SC'] text-[14px] font-normal leading-[22px] tracking-normal text-white shadow-none"
                              >
                                {triggerPhrasesLabel}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-[#4e5969]">
                          {getTemplateCreatedAtLabel(template)}
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={enabled}
                            onClick={() =>
                              updateReportTemplate(template.id, {
                                status: enabled ? 'disabled' : 'published',
                              })
                            }
                            className={`inline-flex h-5 w-10 items-center rounded-full p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 ${
                              enabled ? 'bg-[#1d2129]' : 'bg-[#c9cdd4]'
                            }`}
                            title={enabled ? '点击停用' : '点击启用'}
                            aria-label={`${template.name}当前${enabled ? '已启用' : '已停用'}，点击${
                              enabled ? '停用' : '启用'
                            }`}
                          >
                            <span
                              className={`h-4 w-4 rounded-full bg-white shadow-[0_1px_2px_rgba(29,33,41,0.12)] transition-transform ${
                                enabled ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </td>
                        <td className="px-2 py-2.5">
                          <div className="flex items-center gap-1 whitespace-nowrap">
                            {[
                              { tooltipLabel: '编辑', ariaLabel: `编辑${template.name}`, icon: templateEditIcon, onClick: () => openEditTemplateEditor(template) },
                              { tooltipLabel: '查看', ariaLabel: `查看${template.name}`, icon: templateViewIcon, onClick: () => setViewingTemplate(template) },
                              { tooltipLabel: '删除', ariaLabel: `删除${template.name}`, icon: templateDeleteIcon, onClick: () => setPendingDeleteTemplate(template) },
                            ].map((action) => (
                              <Tooltip key={action.ariaLabel} delayDuration={240}>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={action.onClick}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-[4px] transition-colors hover:bg-[#f2f3f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20"
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

          <div className="-mx-[22px] flex h-14 w-[calc(100%+44px)] shrink-0 items-center justify-between border-t border-[#e5e6eb] bg-[#f7f8fa] py-3 pl-[38px] pr-6 text-[14px] font-normal text-[#4e5969]">
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
                      className="h-8 whitespace-nowrap rounded-[6px] py-0 pl-2 pr-7 text-[14px] leading-5 text-[#4e5969] focus:bg-[#f7f8fa] focus:text-[#1d2129] data-[state=checked]:bg-[#f2f3f5]"
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

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent
          aria-describedby={undefined}
          showCloseButton={false}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            event.currentTarget.focus();
          }}
          className="!flex h-[610px] w-[580px] max-h-[calc(100vh-32px)] max-w-[calc(100vw-32px)] flex-col gap-0 overflow-hidden rounded-[20px] border-0 bg-white p-0 font-['PingFang_SC','Microsoft_YaHei',sans-serif] shadow-[-2px_0_22.1px_rgba(0,0,0,0.01)] sm:max-w-[580px]"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
            <DialogHeader className="flex-row items-center justify-between gap-0 text-left">
              <DialogTitle className="font-['Login_Figma_Sans','PingFang_SC','Microsoft_YaHei',sans-serif] text-[20px] font-medium leading-7 text-[#1d2129]">
                {editingTemplate ? '编辑模板' : '新建模板'}
              </DialogTitle>
              <DialogClose className="relative h-4 w-4 shrink-0 overflow-hidden rounded-[4px] border-0 bg-transparent p-0 transition-colors hover:bg-[#f2f3f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20">
                <img aria-hidden="true" className="absolute inset-[1.862px] h-[12.276px] w-[12.276px]" src={templateModalClose} alt="" />
                <span className="sr-only">关闭</span>
              </DialogClose>
            </DialogHeader>

            <div className="flex flex-col gap-2">
              <label htmlFor="template-name" className="text-[14px] leading-[22px] tracking-[0.15px] text-[#4e5969]">
                模板名称
              </label>
              <div className="relative h-10">
                <input
                  id="template-name"
                  maxLength={20}
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="请输入模板名称"
                  className="h-full w-full rounded-[12px] border border-[#e5e6eb] bg-white px-3 pr-14 text-[14px] leading-[22px] tracking-[0.15px] text-[#1d2129] outline-none placeholder:text-[#86909c] focus:border-[#165dff] focus:ring-2 focus:ring-[#165dff]/10"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] leading-[22px] text-[#86909c]">
                  {form.name.length}/20
                </span>
              </div>
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
                  {categoryOptions.map((category) => (
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

            <div className="flex flex-col gap-2">
              <label htmlFor="template-trigger-phrases" className="text-[14px] leading-[22px] tracking-[0.15px] text-[#4e5969]">
                触发词
              </label>
              <div className="relative h-10">
                <input
                  id="template-trigger-phrases"
                  value={form.triggerPhrases}
                  onChange={(event) => setForm((current) => ({ ...current, triggerPhrases: event.target.value }))}
                  placeholder="多个触发词请使用逗号分隔，支持中英文逗号"
                  aria-invalid={Boolean(triggerPhraseValidation.error)}
                  aria-describedby={triggerPhraseValidation.error ? 'template-trigger-phrases-error' : undefined}
                  className={`h-10 w-full rounded-[12px] border bg-white py-0 pl-3 pr-[76px] text-[14px] leading-[22px] tracking-[0.15px] text-[#1d2129] outline-none placeholder:text-[#86909c] focus:ring-2 ${
                    triggerPhraseValidation.error
                      ? 'border-[#f53f3f] focus:border-[#f53f3f] focus:ring-[#f53f3f]/10'
                      : 'border-[#e5e6eb] focus:border-[#165dff] focus:ring-[#165dff]/10'
                  }`}
                />
                <span
                  className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] leading-[22px] ${
                    triggerPhraseValidation.count > triggerPhraseMaxCount ? 'text-[#f53f3f]' : 'text-[#86909c]'
                  }`}
                >
                  {triggerPhraseValidation.count}/{triggerPhraseMaxCount} 个
                </span>
              </div>
              {triggerPhraseValidation.error && (
                <p id="template-trigger-phrases-error" role="alert" className="text-[12px] leading-[18px] text-[#f53f3f]">
                  {triggerPhraseValidation.error}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="template-prompt" className="text-[14px] leading-[22px] tracking-[0.15px] text-[#4e5969]">
                模板提示词
              </label>
              <div className="relative h-24">
                <textarea
                  id="template-prompt"
                  maxLength={500}
                  value={form.templatePrompt}
                  onChange={(event) => setForm((current) => ({ ...current, templatePrompt: event.target.value }))}
                  placeholder="描述这类报告的分析思路、章节顺序、关注指标和输出语气。"
                  className="h-full w-full resize-none rounded-[12px] border border-[#e5e6eb] bg-white p-3 pb-8 text-[14px] leading-[22px] text-[#1d2129] outline-none placeholder:text-[#86909c] focus:border-[#165dff] focus:ring-2 focus:ring-[#165dff]/10"
                />
                <span className="pointer-events-none absolute bottom-[9px] right-3 text-[12px] leading-[22px] text-[#86909c]">
                  {form.templatePrompt.length}/500
                </span>
                <img aria-hidden="true" className="pointer-events-none absolute bottom-[7px] right-[7px] h-2 w-2" src={templateModalResizer} alt="" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="template-status" className="text-[14px] leading-[22px] tracking-[0.15px] text-[#4e5969]">
                状态
              </label>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    status: value as ReportTemplateStatus,
                  }))
                }
              >
                <SelectTrigger
                  id="template-status"
                  className="group h-10 w-full rounded-[12px] border-[#e5e6eb] bg-white px-3 text-[14px] leading-[22px] tracking-[0.15px] text-[#4e5969] shadow-none outline-none focus-visible:border-[#165dff] focus-visible:ring-2 focus-visible:ring-[#165dff]/10"
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
                  <SelectItem
                    value="published"
                    className="h-10 rounded-[8px] py-0 pl-3 pr-9 text-[14px] leading-[22px] text-[#1d2129] focus:bg-[#f7f8fa] focus:text-[#1d2129] data-[state=checked]:bg-[#f2f3f5] data-[state=checked]:font-medium"
                  >
                    已启用
                  </SelectItem>
                  <SelectItem
                    value="disabled"
                    className="h-10 rounded-[8px] py-0 pl-3 pr-9 text-[14px] leading-[22px] text-[#1d2129] focus:bg-[#f7f8fa] focus:text-[#1d2129] data-[state=checked]:bg-[#f2f3f5] data-[state=checked]:font-medium"
                  >
                    已停用
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex h-16 shrink-0 items-center justify-end gap-4 border-t border-[#e5e6eb] bg-[#f7f8fa] px-6 py-3">
            <button
              type="button"
              onClick={() => setIsEditorOpen(false)}
              className="inline-flex h-10 items-center justify-center rounded-[12px] border border-[#e5e6eb] bg-transparent px-6 text-[14px] leading-[22px] text-[rgba(0,0,0,0.9)] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSaveTemplate}
              disabled={Boolean(triggerPhraseValidation.error)}
              className="inline-flex h-10 items-center justify-center rounded-[12px] border border-[#1d2129] bg-[#1d2129] px-6 text-[14px] leading-[22px] tracking-[0.15px] text-white transition-colors hover:bg-[#2f3339] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 disabled:cursor-not-allowed disabled:border-[#c9cdd4] disabled:bg-[#c9cdd4] disabled:hover:bg-[#c9cdd4]"
            >
              保存
            </button>
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

                <div className="flex min-h-0 flex-1 flex-col gap-2">
                  <dt className="text-[14px] leading-[22px] tracking-[0.15px] text-[#4e5969]">模板提示词</dt>
                  <dd className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap break-words rounded-[12px] border border-[#e5e6eb] bg-[#f7f8fa] px-3 py-2.5 text-[14px] leading-[22px] text-[#1d2129]">
                    {viewingTemplate.templatePrompt.trim() || '未配置'}
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
