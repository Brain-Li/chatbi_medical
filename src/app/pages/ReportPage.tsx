import { useMemo, useState } from 'react';
import { Edit3, FileText, Plus, Save, Search, Trash2 } from 'lucide-react';
import AgentWorkspace from '../components/AgentWorkspace';
import { useWorkspace } from '../context/WorkspaceContext';
import { ReportTemplate, ReportTemplateSection, ReportTemplateStatus } from '../types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

type ReportView = 'workspace' | 'templates';

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
  status: 'draft',
  triggerPhrases: '',
  templatePrompt: '',
  sections: [
    { title: '核心摘要', description: '概括报告核心结论。', required: true },
    { title: '趋势分析', description: '说明关键指标变化。', required: true },
    { title: '行动建议', description: '给出后续管理动作。', required: false },
  ],
  outputFormats: 'PDF, PNG',
};

const statusLabels: Record<ReportTemplateStatus, string> = {
  draft: '草稿',
  published: '已发布',
  disabled: '已停用',
};

const statusClasses: Record<ReportTemplateStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  published: 'bg-emerald-50 text-emerald-700',
  disabled: 'bg-rose-50 text-rose-700',
};

function splitList(value: string) {
  return value
    .split(/[,，、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
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
    status: template.status,
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
  const sections = form.sections
    .map((section, index) => ({
      id: existing?.sections[index]?.id ?? `section-${Date.now()}-${index}`,
      title: section.title.trim(),
      description: section.description.trim(),
      required: section.required,
    }))
    .filter((section) => section.title);

  return {
    id: existing?.id ?? `template-${Date.now()}`,
    name: form.name.trim() || '未命名报告模板',
    description: form.templatePrompt.trim().slice(0, 80) || '通过提示词配置的报告模板。',
    category: form.category.trim() || '专题',
    version: existing?.version ?? 'v1.0',
    status: form.status,
    triggerPhrases: splitList(form.triggerPhrases),
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

export default function ReportPage() {
  const {
    reportTemplates,
    addReportTemplate,
    updateReportTemplate,
    deleteReportTemplate,
  } = useWorkspace();
  const [view, setView] = useState<ReportView>('workspace');
  const [query, setQuery] = useState('');
  const [editingTemplate, setEditingTemplate] = useState<ReportTemplate | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [form, setForm] = useState<TemplateFormState>(emptyTemplateForm);

  const filteredTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) return reportTemplates;

    return reportTemplates.filter((template) =>
      [
        template.name,
        template.category,
        template.templatePrompt,
        ...template.triggerPhrases,
        ...template.sections.map((section) => section.title),
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [query, reportTemplates]);

  const publishedCount = reportTemplates.filter((template) => template.status === 'published').length;

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

  const updateSection = (
    index: number,
    updates: Partial<TemplateFormState['sections'][number]>,
  ) => {
    setForm((current) => ({
      ...current,
      sections: current.sections.map((section, currentIndex) =>
        currentIndex === index ? { ...section, ...updates } : section,
      ),
    }));
  };

  const removeSection = (index: number) => {
    setForm((current) => ({
      ...current,
      sections: current.sections.filter((_, currentIndex) => currentIndex !== index),
    }));
  };

  const handleSaveTemplate = () => {
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
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-gray-50">
      <div className="shrink-0 border-b border-gray-200 bg-white px-6">
        <div className="flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {([
              ['workspace', '报告生成'],
              ['templates', '报告模板库'],
            ] as [ReportView, string][]).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  view === key
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {view === 'templates' && (
            <button
              type="button"
              onClick={openNewTemplateEditor}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              新建模板
            </button>
          )}
        </div>
      </div>

      {view === 'workspace' ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <AgentWorkspace mode="report" />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto max-w-6xl space-y-5">
            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-lg font-semibold text-gray-950">
                    <FileText className="h-5 w-5 text-blue-600" />
                    报告模板库
                  </div>
                  <p className="mt-2 text-sm leading-6 text-gray-500">
                    已发布模板会作为全局资产参与所有报告 Agent 的自动匹配。
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-gray-50 px-4 py-3">
                    <div className="text-xs text-gray-500">模板总数</div>
                    <div className="mt-1 text-lg font-semibold text-gray-900">{reportTemplates.length}</div>
                  </div>
                  <div className="rounded-lg bg-emerald-50 px-4 py-3">
                    <div className="text-xs text-emerald-700">已发布</div>
                    <div className="mt-1 text-lg font-semibold text-emerald-800">{publishedCount}</div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <Search className="h-4 w-4 text-gray-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索模板名称、分类、触发词或提示词"
                  className="w-full bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className="rounded-lg border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.05)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-gray-950">{template.name}</h3>
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700">
                          {template.category}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-xs ${statusClasses[template.status]}`}>
                          {statusLabels[template.status]}
                        </span>
                      </div>
                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-gray-600">
                        {getTemplatePrompt(template) || template.description}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditTemplateEditor(template)}
                        className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-blue-700"
                        title="编辑模板"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteReportTemplate(template.id)}
                        className="rounded-md p-2 text-gray-400 hover:bg-rose-50 hover:text-rose-600"
                        title="删除模板"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {template.triggerPhrases.slice(0, 5).map((phrase) => (
                      <span key={phrase} className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-600">
                        {phrase}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-3 border-t border-gray-100 pt-4 text-xs text-gray-500 md:grid-cols-2">
                    <div>章节：{template.sections.map((section) => section.title).join(' / ') || '-'}</div>
                    <div>输出：{template.outputFormats.join(' / ') || '-'}</div>
                  </div>
                </div>
              ))}
            </div>

            {!filteredTemplates.length && (
              <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-14 text-center text-sm text-gray-500">
                未找到匹配的报告模板
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? '编辑报告模板' : '新建报告模板'}</DialogTitle>
            <DialogDescription>
              通过提示词配置报告的分析思路和结构，已发布模板会参与全局自动匹配。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm text-gray-700">模板名称</label>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700">分类</label>
                <input
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700">状态</label>
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value as ReportTemplateStatus,
                    }))
                  }
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="draft">草稿</option>
                  <option value="published">已发布</option>
                  <option value="disabled">已停用</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-700">触发词</label>
              <input
                value={form.triggerPhrases}
                onChange={(event) => setForm((current) => ({ ...current, triggerPhrases: event.target.value }))}
                placeholder="日报, 月报, 药占比专题"
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700">模板提示词</label>
              <textarea
                value={form.templatePrompt}
                onChange={(event) => setForm((current) => ({ ...current, templatePrompt: event.target.value }))}
                rows={7}
                placeholder="描述这类报告的分析思路、章节顺序、重点关注指标和输出语气。"
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-3 text-sm leading-6 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-sm text-gray-700">章节结构</label>
                <button
                  type="button"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      sections: [
                        ...current.sections,
                        { title: '', description: '', required: true },
                      ],
                    }))
                  }
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  新增章节
                </button>
              </div>

              <div className="space-y-3">
                {form.sections.map((section, index) => (
                  <div key={`${index}-${section.title}`} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="grid gap-3 md:grid-cols-[1fr_1.8fr_auto_auto]">
                      <input
                        value={section.title}
                        onChange={(event) => updateSection(index, { title: event.target.value })}
                        placeholder="章节名称"
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      />
                      <input
                        value={section.description}
                        onChange={(event) => updateSection(index, { description: event.target.value })}
                        placeholder="章节说明"
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      />
                      <label className="flex items-center gap-2 text-sm text-gray-600">
                        <input
                          type="checkbox"
                          checked={section.required}
                          onChange={(event) => updateSection(index, { required: event.target.checked })}
                          className="h-4 w-4 rounded border-blue-300 text-blue-600"
                        />
                        必填
                      </label>
                      <button
                        type="button"
                        onClick={() => removeSection(index)}
                        className="rounded-md p-2 text-gray-400 hover:bg-white hover:text-rose-600"
                        title="删除章节"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-700">输出格式</label>
              <input
                value={form.outputFormats}
                onChange={(event) => setForm((current) => ({ ...current, outputFormats: event.target.value }))}
                placeholder="PDF, PNG, CSV"
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveTemplate}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Save className="h-4 w-4" />
                保存模板
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
