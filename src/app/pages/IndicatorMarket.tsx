import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  GitBranch,
  PencilLine,
  Plus,
  Power,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { ConfigActionIconButton } from '../components/ConfigActionIconButton';
import { ConfigDetailHeader } from '../components/ConfigDetailHeader';
import { Agent, DimensionSemantic, IndicatorAsset, IndicatorStatus, IndicatorType, MetricDatasetBinding, PermissionLevel, ReportTemplate, Skill } from '../types';

const typeOptions: Array<'全部' | IndicatorType> = ['全部', '原子指标', '派生指标', '复合指标'];
const statusOptions: Array<'全部' | IndicatorStatus> = ['全部', '草稿', '已发布', '已停用'];
const editableStatusOptions: IndicatorStatus[] = ['草稿', '已发布', '已停用'];
const sensitivityOptions: PermissionLevel[] = ['普通', '重要', '核心'];
const indicatorPageSize = 10;

type IndicatorConfirmAction = {
  type: 'disable' | 'enable' | 'delete' | 'blocked-delete';
  indicator: IndicatorAsset;
  afterDelete?: () => void;
  blockers?: string[];
};

type ReferenceListItem = {
  id: string;
  name: string;
  tag?: string;
};

type IndicatorReferenceSummary = {
  downstreamIndicators: ReferenceListItem[];
  referencingSkills: ReferenceListItem[];
  referencingAgents: ReferenceListItem[];
  referencingReportTemplates: ReferenceListItem[];
  fallbackReferences: ReferenceListItem[];
};

function getIndicatorReferenceSummary({
  indicator,
  allIndicators,
  skills,
  agents,
  reportTemplates,
}: {
  indicator: IndicatorAsset;
  allIndicators: IndicatorAsset[];
  skills: Skill[];
  agents: Agent[];
  reportTemplates: ReportTemplate[];
}): IndicatorReferenceSummary {
  const downstreamIndicators = allIndicators
    .filter((item) => item.id !== indicator.id && item.sourceMetricIds?.includes(indicator.id))
    .map((item) => ({ id: item.id, name: item.name, tag: item.type }));
  const referencingSkills = skills
    .filter((skill) => skill.metricIds?.includes(indicator.id))
    .map((skill) => ({ id: skill.id, name: skill.name, tag: skill.status }));
  const referencingAgents = agents
    .filter((agent) => {
      const agentSkills = skills.filter((skill) => agent.skills.includes(skill.id));
      return (
        agent.defaultMetricIds?.includes(indicator.id) ||
        agentSkills.some((skill) => skill.metricIds?.includes(indicator.id))
      );
    })
    .map((agent) => ({ id: agent.id, name: agent.name, tag: agent.status }));
  const referencingReportTemplates = reportTemplates
    .filter((template) => {
      return (
        template.metricBlocks.some((block) => block.metricId === indicator.id) ||
        template.chartBlocks.some((block) => block.metricIds.includes(indicator.id))
      );
    })
    .map((template) => ({ id: template.id, name: template.name }));
  const hasStructuredReferences =
    downstreamIndicators.length ||
    referencingSkills.length ||
    referencingAgents.length ||
    referencingReportTemplates.length;
  const fallbackReferences = hasStructuredReferences
    ? []
    : indicator.referencedBy.map((item) => ({ id: item, name: item, tag: '历史引用' }));

  return {
    downstreamIndicators,
    referencingSkills,
    referencingAgents,
    referencingReportTemplates,
    fallbackReferences,
  };
}

function getIndicatorReferenceTotal(summary: IndicatorReferenceSummary) {
  return (
    summary.downstreamIndicators.length +
    summary.referencingSkills.length +
    summary.referencingAgents.length +
    summary.referencingReportTemplates.length
  );
}

function parseSynonyms(value: string) {
  return value
    .split(/[\n,，;；]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseSampleQuestions(value: string) {
  return value
    .split(/[\n;；]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getBindingExpression(binding: MetricDatasetBinding | undefined, fallbackFormula = '') {
  if (!binding) return fallbackFormula;
  return binding.mode === 'formula' ? binding.formulaOverride ?? fallbackFormula : binding.field ?? fallbackFormula;
}

function StatusBadge({ status }: { status: IndicatorAsset['status'] }) {
  const className =
    status === '已发布'
      ? 'bg-emerald-50 text-emerald-700'
      : status === '草稿'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-gray-100 text-gray-600';

  return <span className={`rounded px-2 py-1 text-xs ${className}`}>{status}</span>;
}

function TypeBadge({ type }: { type: IndicatorAsset['type'] }) {
  return <span className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700">{type}</span>;
}

function getDatasetName(datasetId: string, datasets: Array<{ id: string; name: string }>) {
  return datasets.find((dataset) => dataset.id === datasetId)?.name ?? datasetId;
}

function getDimensionLabel(dimensionId: string, dimensions: DimensionSemantic[]) {
  return dimensions.find((dimension) => dimension.id === dimensionId)?.label ?? dimensionId;
}

function getMetricBindings(indicator: IndicatorAsset): MetricDatasetBinding[] {
  return indicator.metricBindings?.length
    ? indicator.metricBindings
    : [
        {
          id: `legacy-binding-${indicator.id}`,
          datasetId: indicator.datasetId,
          mode: indicator.sourceFieldName ? 'field' : 'formula',
          field: indicator.sourceFieldName,
          formulaOverride: indicator.sourceFieldName ? undefined : indicator.formula,
          enabled: true,
          defaultTimeDimensionId: indicator.defaultTimeDimensionId,
          allowedDimensionIds: indicator.allowedDimensionIds,
        },
      ];
}

function getIndicatorDatasetNames(indicator: IndicatorAsset, datasets: Array<{ id: string; name: string }>) {
  return getIndicatorDatasetNameList(indicator, datasets).join('、');
}

function getIndicatorDatasetNameList(indicator: IndicatorAsset, datasets: Array<{ id: string; name: string }>) {
  return Array.from(new Set(getMetricBindings(indicator).map((binding) => getDatasetName(binding.datasetId, datasets))));
}

function getIndicatorExpressionSummary(indicator: IndicatorAsset) {
  return getMetricBindings(indicator)
    .map((binding) => getBindingExpression(binding, indicator.formula))
    .filter(Boolean)
    .join(' / ');
}

function createDraftIndicator(semanticDatasets: Array<{ id: string; name: string }>): IndicatorAsset {
  const timestamp = Date.now();
  const defaultDataset = semanticDatasets[0];

  return {
    id: `metric-${timestamp}`,
    numericId: timestamp,
    name: '',
    nameEn: '',
    datasetId: defaultDataset?.id ?? '',
    datasetName: defaultDataset?.name ?? '',
    type: '原子指标',
    formula: '',
    businessDefinition: '',
    availableDimensions: [],
    defaultGrain: '日 / 周 / 月',
    sensitivity: '普通',
    status: '草稿',
    creator: 'admin',
    updatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    referencedBy: [],
    lineage: ['指标市场'],
    synonyms: [],
    sampleQuestions: [],
    recentUsage: [],
    metricBindings: defaultDataset
      ? [
          {
            id: `bind-metric-${timestamp}-${defaultDataset.id}`,
            datasetId: defaultDataset.id,
            mode: 'field',
            field: '',
            enabled: true,
          },
        ]
      : [],
  };
}

function IndicatorEditModal({
  indicator,
  mode = 'edit',
  semanticDatasets,
  dimensionSemantics,
  onClose,
  onSave,
}: {
  indicator: IndicatorAsset;
  mode?: 'create' | 'edit';
  semanticDatasets: Array<{ id: string; name: string }>;
  dimensionSemantics: DimensionSemantic[];
  onClose: () => void;
  onSave: (updates: Partial<IndicatorAsset>) => void;
}) {
  const [name, setName] = useState(indicator.name);
  const [nameEn, setNameEn] = useState(indicator.nameEn);
  const [type, setType] = useState<IndicatorType>(indicator.type);
  const [businessDefinition, setBusinessDefinition] = useState(indicator.businessDefinition);
  const [synonymText, setSynonymText] = useState((indicator.synonyms ?? []).join('\n'));
  const [sampleQuestionText, setSampleQuestionText] = useState((indicator.sampleQuestions ?? []).join('\n'));
  const [sensitivity, setSensitivity] = useState<PermissionLevel>(indicator.sensitivity);
  const [status, setStatus] = useState<IndicatorStatus>(indicator.status);
  const [metricBindings, setMetricBindings] = useState<MetricDatasetBinding[]>(getMetricBindings(indicator));

  useEffect(() => {
    const nextBindings = getMetricBindings(indicator);
    setName(indicator.name);
    setNameEn(indicator.nameEn);
    setType(indicator.type);
    setBusinessDefinition(indicator.businessDefinition);
    setSynonymText((indicator.synonyms ?? []).join('\n'));
    setSampleQuestionText((indicator.sampleQuestions ?? []).join('\n'));
    setSensitivity(indicator.sensitivity);
    setStatus(indicator.status);
    setMetricBindings(nextBindings);
  }, [indicator]);

  const fallbackFormula = getBindingExpression(metricBindings[0], indicator.formula);
  const canSave =
    Boolean(name.trim() && nameEn.trim() && businessDefinition.trim() && metricBindings.length) &&
    metricBindings.every((binding) =>
      binding.datasetId && (binding.mode === 'field' ? Boolean(binding.field?.trim()) : Boolean(binding.formulaOverride?.trim())),
    );
  const updateBinding = (bindingId: string, updates: Partial<MetricDatasetBinding>) => {
    setMetricBindings((current) =>
      current.map((binding) =>
        binding.id === bindingId
          ? {
              ...binding,
              ...updates,
            }
          : binding,
      ),
    );
  };

  const addBinding = () => {
    const usedDatasetIds = new Set(metricBindings.map((binding) => binding.datasetId));
    const datasetId = semanticDatasets.find((dataset) => !usedDatasetIds.has(dataset.id))?.id ?? semanticDatasets[0]?.id;
    if (!datasetId) return;

    setMetricBindings((current) => [
      ...current,
      {
        id: `bind-metric-${Date.now()}-${datasetId}`,
        datasetId,
        mode: 'field',
        field: '',
        enabled: true,
      },
    ]);
  };

  const removeBinding = (bindingId: string) => {
    setMetricBindings((current) => current.filter((binding) => binding.id !== bindingId));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4 py-6">
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
          <div className="text-lg font-semibold text-gray-900">{mode === 'create' ? '新建指标' : '编辑指标'}</div>
          <button onClick={onClose} className="rounded p-2 text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-sm text-gray-700">指标名称</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-gray-700">英文标识</label>
              <input
                value={nameEn}
                onChange={(event) => setNameEn(event.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-gray-700">指标类型</label>
              <select
                value={type}
                onChange={(event) => setType(event.target.value as IndicatorType)}
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                {typeOptions
                  .filter((option): option is IndicatorType => option !== '全部')
                  .map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-700">敏感度</label>
              <select
                value={sensitivity}
                onChange={(event) => setSensitivity(event.target.value as PermissionLevel)}
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                {sensitivityOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-gray-700">发布状态</label>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as IndicatorStatus)}
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                {editableStatusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="text-sm text-gray-700">指标同义词</label>
            <textarea
              value={synonymText}
              onChange={(event) => setSynonymText(event.target.value)}
              rows={2}
              placeholder="支持逗号或换行分隔，如：门诊营收、门诊收费"
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="mt-4">
            <label className="text-sm text-gray-700">指标定义</label>
            <textarea
              value={businessDefinition}
              onChange={(event) => setBusinessDefinition(event.target.value)}
              rows={3}
              placeholder="说明统计范围、排除规则、时间归属和适用场景"
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-gray-900">数据集映射</div>
                <div className="mt-1 text-xs text-gray-500">字段或公式映射在指标内维护，问数 SQL 只读取已启用映射。</div>
              </div>
              <button
                type="button"
                onClick={addBinding}
                disabled={!semanticDatasets.length}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
              >
                新增映射
              </button>
            </div>
            {!metricBindings.length && (
              <div className="mt-3 rounded-lg border border-dashed border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                创建指标前，请至少新增一条数据集映射。
              </div>
            )}
            <div className="mt-3 space-y-3">
              {metricBindings.map((binding, index) => (
                <div key={binding.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="text-sm text-gray-700">
                      数据集
                      <select
                        value={binding.datasetId}
                        onChange={(event) => updateBinding(binding.id, { datasetId: event.target.value })}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
                      >
                        {semanticDatasets.map((dataset) => (
                          <option key={dataset.id} value={dataset.id}>
                            {dataset.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm text-gray-700">
                      映射方式
                      <select
                        value={binding.mode}
                        onChange={(event) =>
                          updateBinding(binding.id, {
                            mode: event.target.value as MetricDatasetBinding['mode'],
                            field: event.target.value === 'field' ? binding.field ?? '' : undefined,
                            formulaOverride: event.target.value === 'formula' ? binding.formulaOverride ?? indicator.formula : undefined,
                          })
                        }
                        className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
                      >
                        <option value="field">字段</option>
                        <option value="formula">公式</option>
                      </select>
                    </label>
                  </div>

                  <div className="mt-3">
                    {binding.mode === 'field' ? (
                      <label className="text-sm text-gray-700">
                        字段名
                        <input
                          value={binding.field ?? ''}
                          onChange={(event) => updateBinding(binding.id, { field: event.target.value })}
                          className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 font-mono text-sm"
                          placeholder="charge_amount"
                        />
                      </label>
                    ) : (
                      <label className="text-sm text-gray-700">
                        公式
                        <textarea
                          value={binding.formulaOverride ?? ''}
                          onChange={(event) => updateBinding(binding.id, { formulaOverride: event.target.value })}
                          className="mt-1 min-h-20 w-full rounded-lg border border-gray-300 px-2 py-2 font-mono text-sm"
                          placeholder="SUM(charge_amount)"
                        />
                      </label>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={binding.enabled}
                        onChange={(event) => updateBinding(binding.id, { enabled: event.target.checked })}
                      />
                      启用这条映射
                    </label>
                    {metricBindings.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeBinding(binding.id)}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        删除映射
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <label className="text-sm text-gray-700">样例问法</label>
            <textarea
              value={sampleQuestionText}
              onChange={(event) => setSampleQuestionText(event.target.value)}
              rows={3}
              placeholder="支持回车分隔，多个样例每行一个问题，如：上月门诊收入是多少？"
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            取消
          </button>
          <button
            onClick={() =>
              onSave({
                name: name.trim(),
                nameEn: nameEn.trim(),
                type,
                formula: fallbackFormula.trim(),
                businessDefinition: businessDefinition.trim(),
                synonyms: parseSynonyms(synonymText),
                sampleQuestions: parseSampleQuestions(sampleQuestionText),
                sensitivity,
                status,
                datasetId: metricBindings[0]?.datasetId ?? '',
                datasetName: semanticDatasets.find((dataset) => dataset.id === metricBindings[0]?.datasetId)?.name ?? '',
                availableDimensions: [],
                metricBindings: metricBindings.map((binding) => ({
                  ...binding,
                  field: binding.field?.trim() || undefined,
                  formulaOverride: binding.formulaOverride?.trim() || undefined,
                })),
              })
            }
            disabled={!canSave}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            <Save className="h-4 w-4" />
            {mode === 'create' ? '创建指标' : '保存修改'}
          </button>
        </div>
      </div>
    </div>
  );
}

function IndicatorConfirmDialog({
  action,
  onClose,
  onConfirm,
}: {
  action: IndicatorConfirmAction;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const config = {
    disable: {
      title: '停用指标',
      description: '停用后，该指标将不再作为可用指标参与问答和报告口径。',
      confirmText: '确认停用',
      buttonClassName: 'bg-red-600 text-white hover:bg-red-700',
    },
    enable: {
      title: '启用指标',
      description: '启用后，该指标将重新作为已发布指标使用。',
      confirmText: '确认启用',
      buttonClassName: 'bg-emerald-600 text-white hover:bg-emerald-700',
    },
    delete: {
      title: '删除指标',
      description: `确认删除指标“${action.indicator.name}”？此操作不可恢复。`,
      confirmText: '确认删除',
      buttonClassName: 'bg-red-600 text-white hover:bg-red-700',
    },
    'blocked-delete': {
      title: '无法删除指标',
      description: action.blockers?.join('\n') ?? '该指标暂不满足删除条件。',
      confirmText: '知道了',
      buttonClassName: 'bg-blue-600 text-white hover:bg-blue-700',
    },
  }[action.type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <div className="text-lg font-semibold text-gray-900">{config.title}</div>
            <div className="mt-1 text-xs text-gray-500">{action.indicator.name}</div>
          </div>
          <button type="button" onClick={onClose} className="rounded p-2 text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-5 text-sm leading-6 text-gray-600">{config.description}</div>
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          {action.type !== 'blocked-delete' && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm ${config.buttonClassName}`}
          >
            {config.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReferenceGroup({
  title,
  items,
}: {
  title: string;
  items: ReferenceListItem[];
}) {
  if (!items.length) return null;

  return (
    <div>
      <div className="mb-2 text-xs font-medium text-gray-500">
        {title} · {items.length}
      </div>
      <div className="overflow-hidden rounded-lg border border-gray-200">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 border-b border-gray-100 px-3 py-2.5 text-sm last:border-b-0">
            <span className="min-w-0 truncate text-gray-700">{item.name}</span>
            {item.tag && (
              <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">{item.tag}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricDetail({
  indicator,
  allIndicators,
  skills,
  agents,
  reportTemplates,
  semanticDatasets,
  dimensionSemantics,
}: {
  indicator: IndicatorAsset;
  allIndicators: IndicatorAsset[];
  skills: Skill[];
  agents: Agent[];
  reportTemplates: ReportTemplate[];
  semanticDatasets: Array<{ id: string; name: string }>;
  dimensionSemantics: DimensionSemantic[];
}) {
  const bindings = getMetricBindings(indicator);
  const referenceSummary = getIndicatorReferenceSummary({
    indicator,
    allIndicators,
    skills,
    agents,
    reportTemplates,
  });
  const hasStructuredReferences = getIndicatorReferenceTotal(referenceSummary) > 0;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="px-6 py-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
              <SlidersHorizontal className="h-4 w-4 text-blue-600" />
              指标定义
            </div>
            <p className="mt-3 text-sm leading-6 text-gray-600">{indicator.businessDefinition}</p>
            {!!indicator.synonyms?.length && (
              <div className="mt-3 flex flex-wrap gap-2">
                {indicator.synonyms.map((synonym) => (
                  <span key={synonym} className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600">
                    {synonym}
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="lg:col-span-2">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
              <GitBranch className="h-4 w-4 text-blue-600" />
              数据集映射
            </div>
            <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full min-w-[760px]">
                <thead className="bg-gray-50 text-left text-xs text-gray-500">
                  <tr>
                    <th className="px-4 py-2">数据集</th>
                    <th className="px-4 py-2">字段/公式映射</th>
                    <th className="px-4 py-2">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {bindings.map((binding) => (
                    <tr key={binding.id} className="text-sm text-gray-700">
                      <td className="px-4 py-3">{getDatasetName(binding.datasetId, semanticDatasets)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-blue-700">
                        {binding.mode === 'formula' ? binding.formulaOverride ?? indicator.formula : binding.field ?? '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs ${binding.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                          {binding.enabled ? '已启用' : '已停用'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="lg:col-span-2">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              引用该指标的对象
            </div>
            <div className="mt-3 space-y-3">
              <ReferenceGroup title="下游指标" items={referenceSummary.downstreamIndicators} />
              <ReferenceGroup title="Skill" items={referenceSummary.referencingSkills} />
              <ReferenceGroup title="Agent" items={referenceSummary.referencingAgents} />
              <ReferenceGroup title="报告模板" items={referenceSummary.referencingReportTemplates} />
              <ReferenceGroup title="其他引用" items={referenceSummary.fallbackReferences} />
              {!hasStructuredReferences && !referenceSummary.fallbackReferences.length && (
                <div className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-500">
                  暂无引用对象
                </div>
              )}
            </div>
          </section>

          {!!indicator.sampleQuestions?.length && (
            <section className="lg:col-span-2">
              <div className="text-sm font-medium text-gray-900">样例问法</div>
              <div className="mt-3 space-y-2">
                {indicator.sampleQuestions.map((question) => (
                  <div key={question} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
                    {question}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

type IndicatorMarketProps = {
  embedded?: boolean;
  selectedIndicatorId?: string | null;
  onBackToList?: () => void;
  onViewIndicator?: (indicatorId: string) => void;
};

export default function IndicatorMarket({
  embedded = false,
  selectedIndicatorId,
  onBackToList,
  onViewIndicator,
}: IndicatorMarketProps = {}) {
  const {
    agents,
    skills,
    indicatorAssets,
    reportTemplates,
    semanticDatasets,
    dimensionSemantics,
    addIndicatorAssets,
    updateIndicatorAsset,
    deleteIndicatorAsset,
  } = useWorkspace();
  const navigate = useNavigate();
  const { id: routeIndicatorId } = useParams();
  const location = useLocation();
  const activeIndicatorId = selectedIndicatorId ?? routeIndicatorId ?? null;
  const editMode = new URLSearchParams(location.search).get('mode') === 'edit';
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedDatasetId, setSelectedDatasetId] = useState('all');
  const [selectedType, setSelectedType] = useState<(typeof typeOptions)[number]>('全部');
  const [selectedStatus, setSelectedStatus] = useState<(typeof statusOptions)[number]>('全部');
  const [indicatorPage, setIndicatorPage] = useState(1);
  const [editingIndicatorId, setEditingIndicatorId] = useState<string | null>(null);
  const [draftIndicator, setDraftIndicator] = useState<IndicatorAsset | null>(null);
  const [confirmAction, setConfirmAction] = useState<IndicatorConfirmAction | null>(null);
  const datasetOptions = [{ id: 'all', name: '全部' }, ...semanticDatasets];

  const filteredIndicators = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();

    return indicatorAssets.filter((indicator) => {
      const keywordMatched =
        !keyword ||
        [
          indicator.name,
          indicator.nameEn,
          getIndicatorDatasetNames(indicator, semanticDatasets),
          indicator.businessDefinition,
          ...(indicator.synonyms ?? []),
          ...getMetricBindings(indicator).flatMap((binding) => [binding.field ?? '', binding.formulaOverride ?? '']),
        ]
          .join(' ')
          .toLowerCase()
          .includes(keyword);
      const datasetMatched =
        selectedDatasetId === 'all' ||
        getMetricBindings(indicator).some((binding) => binding.datasetId === selectedDatasetId);
      const typeMatched = selectedType === '全部' || indicator.type === selectedType;
      const statusMatched = selectedStatus === '全部' || indicator.status === selectedStatus;

      return keywordMatched && datasetMatched && typeMatched && statusMatched;
    });
  }, [indicatorAssets, searchKeyword, selectedDatasetId, selectedStatus, selectedType]);

  const indicatorTotalPages = Math.max(1, Math.ceil(filteredIndicators.length / indicatorPageSize));
  const paginatedIndicators = useMemo(() => {
    const start = (indicatorPage - 1) * indicatorPageSize;
    return filteredIndicators.slice(start, start + indicatorPageSize);
  }, [filteredIndicators, indicatorPage]);

  useEffect(() => {
    setIndicatorPage((current) => Math.min(current, indicatorTotalPages));
  }, [indicatorTotalPages]);

  useEffect(() => {
    if (!editMode || !activeIndicatorId) return;
    setEditingIndicatorId(activeIndicatorId);
  }, [activeIndicatorId, editMode]);

  const detailIndicator = activeIndicatorId
    ? indicatorAssets.find((indicator) => indicator.id === activeIndicatorId)
    : null;
  const editingIndicator = indicatorAssets.find((indicator) => indicator.id === editingIndicatorId) ?? null;

  const createIndicator = (updates: Partial<IndicatorAsset>) => {
    if (!draftIndicator) return;

    const bindings = updates.metricBindings ?? draftIndicator.metricBindings ?? [];
    const primaryDatasetId = updates.datasetId ?? bindings[0]?.datasetId ?? draftIndicator.datasetId;
    const primaryDataset = semanticDatasets.find((dataset) => dataset.id === primaryDatasetId);

    addIndicatorAssets([
      {
        ...draftIndicator,
        ...updates,
        datasetId: primaryDatasetId,
        datasetName: primaryDataset?.name ?? draftIndicator.datasetName,
        availableDimensions: [],
        updatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
        metricBindings: bindings,
      },
    ]);
    setDraftIndicator(null);
  };

  const getIndicatorDeleteBlockers = (indicator: IndicatorAsset) => {
    if (indicator.status === '已发布') return ['已发布指标不能直接删除，请先停用。'];
    if (indicator.status === '已停用') {
      const referenceSummary = getIndicatorReferenceSummary({
        indicator,
        allIndicators: indicatorAssets,
        skills,
        agents,
        reportTemplates,
      });
      const referenceTotal = getIndicatorReferenceTotal(referenceSummary);
      if (referenceTotal > 0) {
        const referenceGroups = [
          referenceSummary.downstreamIndicators.length ? `下游指标 ${referenceSummary.downstreamIndicators.length} 个` : '',
          referenceSummary.referencingSkills.length ? `Skill ${referenceSummary.referencingSkills.length} 个` : '',
          referenceSummary.referencingAgents.length ? `Agent ${referenceSummary.referencingAgents.length} 个` : '',
          referenceSummary.referencingReportTemplates.length ? `报告模板 ${referenceSummary.referencingReportTemplates.length} 个` : '',
        ].filter(Boolean);
        return [`该指标仍被 ${referenceTotal} 个对象引用（${referenceGroups.join('、')}），请先解除引用。`];
      }
    }
    return [];
  };

  const requestDeleteIndicator = (indicator: IndicatorAsset, afterDelete?: () => void) => {
    const blockers = getIndicatorDeleteBlockers(indicator);
    if (blockers.length) {
      setConfirmAction({ type: 'blocked-delete', indicator, blockers });
      return;
    }
    setConfirmAction({ type: 'delete', indicator, afterDelete });
  };

  const requestIndicatorStatusChange = (indicator: IndicatorAsset, status: IndicatorStatus) => {
    setConfirmAction({
      type: status === '已停用' ? 'disable' : 'enable',
      indicator,
    });
  };

  const handleConfirmIndicatorAction = () => {
    if (!confirmAction) return;

    if (confirmAction.type === 'blocked-delete') {
      setConfirmAction(null);
      return;
    }

    if (confirmAction.type === 'delete') {
      deleteIndicatorAsset(confirmAction.indicator.id);
      setConfirmAction(null);
      confirmAction.afterDelete?.();
      return;
    }

    updateIndicatorAsset(confirmAction.indicator.id, {
      status: confirmAction.type === 'disable' ? '已停用' : '已发布',
    });
    setConfirmAction(null);
  };

  const renderIndicatorStatusAction = (
    indicator: IndicatorAsset,
    options: { variant: 'list' | 'detail'; afterDelete?: () => void } = { variant: 'list' },
  ) => {
    const detailClassName =
      'inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-gray-50';
    const listClassName = 'inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-sm';

    if (indicator.status === '已发布') {
      if (options.variant === 'list') {
        return (
          <ConfigActionIconButton
            onClick={(event) => {
              event.stopPropagation();
              requestIndicatorStatusChange(indicator, '已停用');
            }}
            icon={Power}
            label="停用"
            variant="neutral"
          />
        );
      }

      const className =
        options.variant === 'detail'
          ? `${detailClassName} border-amber-200 text-amber-700 hover:bg-amber-50`
          : `${listClassName} text-amber-700 hover:text-amber-800`;

      return (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            requestIndicatorStatusChange(indicator, '已停用');
          }}
          className={className}
        >
          <Power className="h-4 w-4" />
          停用
        </button>
      );
    }

    if (indicator.status === '已停用') {
      if (options.variant === 'list') {
        return (
          <>
            <ConfigActionIconButton
              onClick={(event) => {
                event.stopPropagation();
                requestIndicatorStatusChange(indicator, '已发布');
              }}
              icon={RotateCcw}
              label="启用"
              variant="sync"
            />
            <ConfigActionIconButton
              onClick={(event) => {
                event.stopPropagation();
                requestDeleteIndicator(indicator, options.afterDelete);
              }}
              icon={Trash2}
              label="删除"
              variant="delete"
            />
          </>
        );
      }

      return (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            requestIndicatorStatusChange(indicator, '已发布');
          }}
          className={`${detailClassName} border-emerald-200 text-emerald-700 hover:bg-emerald-50`}
        >
          <RotateCcw className="h-4 w-4" />
          启用
        </button>
      );
    }

    if (options.variant === 'list') {
      return (
        <ConfigActionIconButton
          onClick={(event) => {
            event.stopPropagation();
            requestDeleteIndicator(indicator, options.afterDelete);
          }}
          icon={Trash2}
          label="删除"
          variant="delete"
        />
      );
    }

    return null;
  };

  const backToList = onBackToList ?? (() => navigate('/indicator'));
  const viewIndicator = onViewIndicator ?? ((indicatorId: string) => navigate(`/indicator/${indicatorId}`));

  if (activeIndicatorId) {
    return (
      <div className={`h-full min-h-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${embedded ? '' : 'bg-gray-50'}`}>
        {detailIndicator ? (
          <>
            <ConfigDetailHeader
              backLabel="返回指标市场"
              onBack={backToList}
              icon={SlidersHorizontal}
              title={detailIndicator.name}
              subtitle={detailIndicator.nameEn}
              status={<StatusBadge status={detailIndicator.status} />}
              actions={
                <>
                  {renderIndicatorStatusAction(detailIndicator, {
                    variant: 'detail',
                    afterDelete: backToList,
                  })}
                  <button
                    type="button"
                    onClick={() => setEditingIndicatorId(detailIndicator.id)}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                  >
                    <PencilLine className="h-4 w-4" />
                    编辑
                  </button>
                </>
              }
              metaItems={[
                { label: '映射数据集', value: getIndicatorDatasetNames(detailIndicator, semanticDatasets) || detailIndicator.datasetName },
                { label: '指标类型', value: detailIndicator.type },
                { label: '敏感度', value: detailIndicator.sensitivity },
              ]}
            />
            <div className="mx-auto max-w-7xl px-6 py-6">
              <MetricDetail
                indicator={detailIndicator}
                allIndicators={indicatorAssets}
                skills={skills}
                agents={agents}
                reportTemplates={reportTemplates}
                semanticDatasets={semanticDatasets}
                dimensionSemantics={dimensionSemantics}
              />
            </div>
          </>
        ) : (
          <div className="mx-auto max-w-7xl px-6 py-6">
            <div className="rounded-lg border border-gray-200 bg-white px-6 py-14 text-center text-sm text-gray-500">
              未找到该指标
            </div>
          </div>
        )}

        {editingIndicator && (
          <IndicatorEditModal
            indicator={editingIndicator}
            semanticDatasets={semanticDatasets}
            dimensionSemantics={dimensionSemantics}
            onClose={() => setEditingIndicatorId(null)}
            onSave={(updates) => {
              updateIndicatorAsset(editingIndicator.id, updates);
              setEditingIndicatorId(null);
            }}
          />
        )}
        {confirmAction && (
          <IndicatorConfirmDialog
            action={confirmAction}
            onClose={() => setConfirmAction(null)}
            onConfirm={handleConfirmIndicatorAction}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden bg-gray-50">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-6 py-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-lg font-semibold text-gray-900">指标市场</div>
              <div className="mt-1 text-sm text-gray-500">
                集中维护指标资产、计算口径与权限范围。
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDraftIndicator(createDraftIndicator(semanticDatasets))}
                disabled={!semanticDatasets.length}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                title={semanticDatasets.length ? undefined : '请先创建语义数据集'}
              >
                <Plus className="h-4 w-4" />
                新建指标
              </button>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-start gap-3">
            <label className="inline-flex w-full items-center gap-2 sm:w-auto">
              <span className="whitespace-nowrap text-sm text-gray-500">数据集</span>
              <select
                value={selectedDatasetId}
                onChange={(event) => {
                  setSelectedDatasetId(event.target.value);
                  setIndicatorPage(1);
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none sm:w-auto"
              >
                {datasetOptions.map((dataset) => (
                  <option key={dataset.id} value={dataset.id}>
                    {dataset.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-flex w-full items-center gap-2 sm:w-auto">
              <span className="whitespace-nowrap text-sm text-gray-500">类型</span>
              <select
                value={selectedType}
                onChange={(event) => {
                  setSelectedType(event.target.value as typeof selectedType);
                  setIndicatorPage(1);
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none sm:w-auto"
              >
                {typeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-flex w-full items-center gap-2 sm:w-auto">
              <span className="whitespace-nowrap text-sm text-gray-500">状态</span>
              <select
                value={selectedStatus}
                onChange={(event) => {
                  setSelectedStatus(event.target.value as typeof selectedStatus);
                  setIndicatorPage(1);
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none sm:w-auto"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <div className="relative w-full min-w-[280px] sm:w-[420px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={searchKeyword}
                onChange={(event) => {
                  setSearchKeyword(event.target.value);
                  setIndicatorPage(1);
                }}
                placeholder="搜索指标名称或英文标识"
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] table-fixed">
                <colgroup>
                  <col className="w-[190px]" />
                  <col className="w-[160px]" />
                  <col className="w-[146px]" />
                  <col className="w-[90px]" />
                  <col className="w-[180px]" />
                  <col className="w-[70px]" />
                  <col className="w-[80px]" />
                  <col className="w-[108px]" />
                  <col className="w-[164px]" />
                </colgroup>
                <thead className="bg-gray-50">
                  <tr className="border-b border-gray-200 text-left text-sm text-gray-600">
                    <th className="px-3 py-3">指标名称</th>
                    <th className="px-3 py-3">同义词</th>
                    <th className="px-3 py-3">映射数据集</th>
                    <th className="whitespace-nowrap px-3 py-3">指标类型</th>
                    <th className="px-3 py-3">计算方式</th>
                    <th className="px-3 py-3">敏感度</th>
                    <th className="px-3 py-3">发布状态</th>
                    <th className="px-3 py-3">更新时间</th>
                    <th className="sticky right-0 z-20 bg-gray-50 px-3 py-3 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedIndicators.map((indicator) => (
                      <tr
                        key={indicator.id}
                        onClick={() => viewIndicator(indicator.id)}
                        className="group cursor-pointer text-sm transition-colors hover:bg-gray-50"
                      >
                        <td className="px-3 py-4">
                          <div className="flex items-start gap-2">
                            <div>
                              <div className="font-medium text-gray-900">{indicator.name}</div>
                              <div className="mt-1 text-xs text-gray-500">{indicator.nameEn}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {(indicator.synonyms ?? []).slice(0, 3).map((synonym) => (
                              <span key={synonym} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                                {synonym}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-4 text-gray-700">
                          <div className="space-y-1.5">
                            {getIndicatorDatasetNameList(indicator, semanticDatasets).map((datasetName) => (
                              <div key={datasetName} className="leading-5">
                                {datasetName}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <TypeBadge type={indicator.type} />
                        </td>
                        <td className="px-3 py-4 font-mono text-xs leading-5 text-blue-700">
                          <div className="line-clamp-2">{getIndicatorExpressionSummary(indicator)}</div>
                        </td>
                        <td className="px-3 py-4 text-gray-700">{indicator.sensitivity}</td>
                        <td className="px-3 py-4">
                          <StatusBadge status={indicator.status} />
                        </td>
                        <td className="px-3 py-4 text-gray-500">{indicator.updatedAt}</td>
                        <td className="sticky right-0 z-10 bg-white px-3 py-4 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)] group-hover:bg-gray-50">
                          <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                            <ConfigActionIconButton
                              onClick={(event) => {
                                event.stopPropagation();
                                viewIndicator(indicator.id);
                              }}
                              icon={Eye}
                              label="查看"
                              variant="view"
                            />
                            <ConfigActionIconButton
                              onClick={(event) => {
                                event.stopPropagation();
                                setEditingIndicatorId(indicator.id);
                              }}
                              icon={PencilLine}
                              label="编辑"
                              variant="edit"
                            />
                            {renderIndicatorStatusAction(indicator)}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {!filteredIndicators.length && (
              <div className="px-6 py-14 text-center text-sm text-gray-500">未找到匹配指标</div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-1 pt-3 text-sm text-gray-500">
            <div>
              共 {filteredIndicators.length} 条，每页 {indicatorPageSize} 条
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIndicatorPage((page) => Math.max(1, page - 1))}
                disabled={indicatorPage === 1}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:border-gray-100 disabled:text-gray-300"
                aria-label="上一页"
                title="上一页"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: indicatorTotalPages }, (_, index) => index + 1).map((page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => setIndicatorPage(page)}
                  className={`h-8 min-w-8 rounded-md border px-2 text-sm transition-colors ${
                    indicatorPage === page
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:text-blue-600'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setIndicatorPage((page) => Math.min(indicatorTotalPages, page + 1))}
                disabled={indicatorPage === indicatorTotalPages}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:border-gray-100 disabled:text-gray-300"
                aria-label="下一页"
                title="下一页"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {editingIndicator && (
        <IndicatorEditModal
          indicator={editingIndicator}
          semanticDatasets={semanticDatasets}
          dimensionSemantics={dimensionSemantics}
          onClose={() => setEditingIndicatorId(null)}
          onSave={(updates) => {
            updateIndicatorAsset(editingIndicator.id, updates);
            setEditingIndicatorId(null);
          }}
        />
      )}
      {draftIndicator && (
        <IndicatorEditModal
          mode="create"
          indicator={draftIndicator}
          semanticDatasets={semanticDatasets}
          dimensionSemantics={dimensionSemantics}
          onClose={() => setDraftIndicator(null)}
          onSave={createIndicator}
        />
      )}
      {confirmAction && (
        <IndicatorConfirmDialog
          action={confirmAction}
          onClose={() => setConfirmAction(null)}
          onConfirm={handleConfirmIndicatorAction}
        />
      )}
    </div>
  );
}
