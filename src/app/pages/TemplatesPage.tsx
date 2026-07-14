import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ChevronLeft,
  ChevronRight,
  CalendarClock,
  Edit3,
  FileText,
  Plus,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { HomePrefillPayload, ReportTemplate, ReportTemplateSection, ReportTemplateStatus } from '../types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { ConfigActionIconButton } from '../components/ConfigActionIconButton';
import { ReportSubscriptionDialog } from '../components/ReportSubscriptionDialog';

const templatePageSize = 10;

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
    .split(/[,，、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
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

export default function TemplatesPage() {
  const navigate = useNavigate();
  const {
    reportTemplates,
    addReportTemplate,
    updateReportTemplate,
    deleteReportTemplate,
  } = useWorkspace();
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [templatePage, setTemplatePage] = useState(1);
  const [editingTemplate, setEditingTemplate] = useState<ReportTemplate | null>(null);
  const [pendingDeleteTemplate, setPendingDeleteTemplate] = useState<ReportTemplate | null>(null);
  const [subscriptionTemplate, setSubscriptionTemplate] = useState<ReportTemplate | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSubscriptionDialogOpen, setIsSubscriptionDialogOpen] = useState(false);
  const [form, setForm] = useState<TemplateFormState>(emptyTemplateForm);

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
  const paginatedTemplates = useMemo(() => {
    const start = (templatePage - 1) * templatePageSize;
    return filteredTemplates.slice(start, start + templatePageSize);
  }, [filteredTemplates, templatePage]);

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

  const useTemplate = (template: ReportTemplate) => {
    const prefill: HomePrefillPayload = {
      mode: 'report',
      templateId: template.id,
      draft: `使用「${template.name}」生成报告。请补充报告主题、时间范围、分析对象和关注重点。`,
    };

    navigate('/', { state: { prefill } });
  };

  const openSubscriptionDialog = (template: ReportTemplate) => {
    setSubscriptionTemplate(template);
    setIsSubscriptionDialogOpen(true);
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
    <div className="min-h-0 flex-1 overflow-y-auto bg-transparent px-6 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-lg font-semibold text-gray-950">
                <FileText className="h-5 w-5 text-blue-600" />
                模板库
              </div>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                维护报告模板的分类、触发词和生成提示词，并在操作列为模板创建订阅任务。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={openNewTemplateEditor}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                新建模板
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 md:flex-row">
            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="h-11 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none md:w-40"
            >
              <option value="all">全部分类</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <div className="flex flex-1 items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <Search className="h-4 w-4 text-gray-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索模板名称或触发词"
                className="w-full bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
              />
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] table-fixed">
              <colgroup>
                <col className="w-[23%]" />
                <col className="w-[9%]" />
                <col className="w-[27%]" />
                <col className="w-[16%]" />
                <col className="w-[10%]" />
                <col className="w-[15%]" />
              </colgroup>
              <thead className="bg-gray-50">
                <tr className="border-b border-gray-200 text-left text-sm text-gray-600">
                  <th className="px-6 py-3">模板名称</th>
                  <th className="px-6 py-3">分类</th>
                  <th className="px-6 py-3">触发词</th>
                  <th className="px-6 py-3">创建时间</th>
                  <th className="px-6 py-3">状态</th>
                  <th className="px-6 py-3">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedTemplates.length ? (
                  paginatedTemplates.map((template) => {
                    const enabled = template.status !== 'disabled';

                    return (
                      <tr key={template.id} className="text-sm text-gray-700 hover:bg-gray-50">
                        <td className="min-w-0 px-6 py-4">
                          <div className="truncate font-medium text-gray-900">{template.name}</div>
                          <div className="mt-1 truncate text-xs text-gray-400">
                            {getTemplatePrompt(template) || template.description}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                            {template.category}
                          </span>
                        </td>
                        <td className="max-w-xs px-6 py-4">
                          <div className="line-clamp-2">
                            {template.triggerPhrases.length ? template.triggerPhrases.join(' / ') : '-'}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-gray-500">
                          {getTemplateCreatedAtLabel(template)}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={enabled}
                            onClick={() =>
                              updateReportTemplate(template.id, {
                                status: enabled ? 'disabled' : 'published',
                              })
                            }
                            className={`inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${
                              enabled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 hover:bg-gray-400'
                            }`}
                            title={enabled ? '点击停用' : '点击启用'}
                            aria-label={`${template.name}当前${enabled ? '已启用' : '已停用'}，点击${
                              enabled ? '停用' : '启用'
                            }`}
                          >
                            <span
                              className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                                enabled ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1 whitespace-nowrap">
                            <ConfigActionIconButton
                              onClick={() => useTemplate(template)}
                              icon={FileText}
                              label="使用"
                              variant="view"
                            />
                            <ConfigActionIconButton
                              onClick={() => openEditTemplateEditor(template)}
                              icon={Edit3}
                              label="编辑"
                              variant="edit"
                            />
                            <button
                              type="button"
                              onClick={() => openSubscriptionDialog(template)}
                              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-medium text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100"
                              aria-label={`订阅${template.name}`}
                              title="订阅"
                            >
                              <CalendarClock className="h-4 w-4" />
                              订阅
                            </button>
                            <ConfigActionIconButton
                              onClick={() => setPendingDeleteTemplate(template)}
                              icon={Trash2}
                              label="删除"
                              variant="delete"
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-14 text-center text-sm text-gray-500">
                      未找到匹配的报告模板
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-1 pt-3 text-sm text-gray-500">
          <div>
            共 {filteredTemplates.length} 条，每页 {templatePageSize} 条
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setTemplatePage((page) => Math.max(1, page - 1))}
              disabled={templatePage === 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:border-gray-100 disabled:text-gray-300"
              aria-label="上一页"
              title="上一页"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: templateTotalPages }, (_, index) => index + 1).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setTemplatePage(page)}
                className={`h-8 min-w-8 rounded-md border px-2 text-sm transition-colors ${
                  templatePage === page
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:text-blue-600'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setTemplatePage((page) => Math.min(templateTotalPages, page + 1))}
              disabled={templatePage === templateTotalPages}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:border-gray-100 disabled:text-gray-300"
              aria-label="下一页"
              title="下一页"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

      </div>

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? '编辑报告模板' : '新建报告模板'}</DialogTitle>
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
                <select
                  value={form.category}
                  onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
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
                  <option value="published">已启用</option>
                  <option value="disabled">已停用</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-700">触发词</label>
              <input
                value={form.triggerPhrases}
                onChange={(event) => setForm((current) => ({ ...current, triggerPhrases: event.target.value }))}
                placeholder="多个触发词请用逗号或顿号隔开"
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

      <ReportSubscriptionDialog
        open={isSubscriptionDialogOpen}
        onOpenChange={setIsSubscriptionDialogOpen}
        template={subscriptionTemplate}
      />

      <AlertDialog
        open={Boolean(pendingDeleteTemplate)}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteTemplate(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除模板</AlertDialogTitle>
            <AlertDialogDescription>
              确认删除「{pendingDeleteTemplate?.name}」？删除后不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDeleteTemplate) deleteReportTemplate(pendingDeleteTemplate.id);
                setPendingDeleteTemplate(null);
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
