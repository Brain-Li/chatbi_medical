import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import {
  ArrowLeft,
  Blocks,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Database,
  Eye,
  Layers3,
  PencilLine,
  Play,
  Plus,
  Save,
  Search,
  Table2,
  Trash2,
  X,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { ConfigActionIconButton } from '../components/ConfigActionIconButton';
import { ConfigDetailHeader } from '../components/ConfigDetailHeader';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  AggregationMethod,
  DatabaseConnection,
  DatasetFieldDefinition,
  DatasetFieldRole,
  IndicatorAsset,
  SemanticDataset,
} from '../types';

const fieldRoleOptions: DatasetFieldRole[] = [
  '时间字段',
  '维度字段',
  '度量字段',
  '标识字段',
  '隐藏字段',
];

const aggregationOptions: AggregationMethod[] = [
  'NONE',
  'SUM',
  'COUNT',
  'COUNT DISTINCT',
  'AVG',
  'MAX',
  'MIN',
];

const datasetPageSize = 10;

type DatasetDeleteDialogState = {
  dataset: SemanticDataset;
  blockers: string[];
  afterDelete?: () => void;
};

const defaultSql = `SELECT
  visit_date,
  department_name,
  doctor_name,
  fee_group,
  charge_amount,
  drug_fee,
  total_fee,
  visit_id,
  is_refund
FROM fact_outpatient_charge
WHERE is_refund = 0`;

const semanticNameMap: Record<string, string> = {
  visit_date: '就诊日期',
  discharge_date: '出院日期',
  department_name: '科室',
  doctor_name: '医生',
  fee_group: '费用组',
  disease_group: '病种组',
  charge_amount: '门诊收入',
  drug_fee: '药品费用',
  consumable_fee: '耗材费用',
  total_fee: '总费用',
  visit_id: '就诊 ID',
  admission_id: '住院 ID',
  patient_id: '患者 ID',
  is_refund: '退款标记',
};

function splitSelectItems(selectText: string) {
  const items: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of selectText) {
    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(0, depth - 1);

    if (char === ',' && depth === 0) {
      items.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) items.push(current.trim());
  return items;
}

function getFieldName(expression: string) {
  const aliasMatch = expression.match(/\s+as\s+([a-zA-Z_][\w]*)$/i);
  if (aliasMatch?.[1]) return aliasMatch[1];

  const cleanExpression = expression.replace(/[`"'[\]]/g, '').trim();
  const lastToken = cleanExpression.split(/\s+/).pop() ?? cleanExpression;
  const dotted = lastToken.split('.').pop() ?? lastToken;

  return dotted.replace(/[^\w]/g, '') || `field_${Date.now()}`;
}

function isDimensionLikeField(fieldName: string) {
  const lower = fieldName.toLowerCase();

  return (
    lower.includes('group') ||
    lower.includes('category') ||
    lower.includes('type') ||
    lower.includes('name') ||
    lower.includes('department') ||
    lower.includes('doctor') ||
    lower.includes('disease')
  );
}

function inferFieldRole(fieldName: string): DatasetFieldRole {
  const lower = fieldName.toLowerCase();

  if (lower.includes('date') || lower.includes('time')) return '时间字段';
  if (
    lower.startsWith('is_') ||
    lower.includes('tenant') ||
    lower.includes('deleted') ||
    lower.includes('refund') ||
    lower.includes('etl') ||
    lower.includes('raw')
  ) {
    return '隐藏字段';
  }
  if (lower === 'id' || lower.endsWith('_id') || lower.endsWith('id')) return '标识字段';
  if (isDimensionLikeField(fieldName)) return '维度字段';
  if (
    lower.includes('amount') ||
    lower.includes('fee') ||
    lower.includes('cost') ||
    lower.includes('revenue') ||
    lower.includes('income') ||
    lower.includes('count') ||
    lower.includes('num') ||
    lower.includes('qty') ||
    lower.includes('ratio')
  ) {
    return '度量字段';
  }

  return '维度字段';
}

function inferDataType(fieldName: string): DatasetFieldDefinition['dataType'] {
  const lower = fieldName.toLowerCase();

  if (lower.includes('date') || lower.includes('time')) return 'date';
  if (lower.startsWith('is_')) return 'boolean';
  if (lower === 'id' || lower.endsWith('_id') || lower.endsWith('id')) return 'number';
  if (isDimensionLikeField(fieldName)) return 'string';
  if (
    lower.includes('amount') ||
    lower.includes('fee') ||
    lower.includes('cost') ||
    lower.includes('count') ||
    lower.includes('num') ||
    lower.includes('qty') ||
    lower.includes('ratio') ||
    lower.endsWith('_id')
  ) {
    return 'number';
  }

  return 'string';
}

function inferAggregation(fieldName: string, role: DatasetFieldRole): AggregationMethod {
  const lower = fieldName.toLowerCase();

  if (role === '标识字段') return 'COUNT DISTINCT';
  if (role !== '度量字段') return 'NONE';
  if (lower.includes('ratio') || lower.includes('rate')) return 'AVG';
  if (lower.includes('count') || lower.includes('num')) return 'COUNT';
  return 'SUM';
}

function buildSemanticName(fieldName: string) {
  return (
    semanticNameMap[fieldName] ??
    fieldName
      .split('_')
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(' ')
  );
}

function parseSqlFields(sql: string): DatasetFieldDefinition[] {
  const match = sql.match(/select([\s\S]+?)from/i);
  if (!match?.[1]) return [];

  return splitSelectItems(match[1]).map((expression) => {
    const name = getFieldName(expression);
    const fieldRole = inferFieldRole(name);

    return {
      name,
      semanticName: buildSemanticName(name),
      description: `${buildSemanticName(name)}，由 SQL 字段 ${name} 生成。`,
      fieldRole,
      dataType: inferDataType(name),
      defaultAggregation: inferAggregation(name, fieldRole),
    };
  });
}

function buildAtomicFormula(field: DatasetFieldDefinition) {
  if (field.fieldRole === '标识字段') {
    return `COUNT(DISTINCT ${field.name})`;
  }

  return `${field.defaultAggregation ?? 'SUM'}(${field.name})`;
}

function buildIndicatorFromField(
  field: DatasetFieldDefinition,
  dataset: SemanticDataset,
  index: number,
): IndicatorAsset {
  return {
    id: `metric-${Date.now()}-${index}-${field.name}`,
    numericId: Number(`${Date.now()}`.slice(-5)) + index,
    name: field.semanticName,
    nameEn: field.name,
    datasetId: dataset.id,
    datasetName: dataset.name,
    type: '原子指标',
    formula: buildAtomicFormula(field),
    businessDefinition: `${field.semanticName}由数据集字段 ${field.name} 发布，默认聚合方式为 ${field.defaultAggregation ?? 'NONE'}。`,
    availableDimensions: getDatasetFields(dataset)
      .filter((item) => item.fieldRole === '维度字段' || item.fieldRole === '时间字段')
      .map((item) => item.semanticName),
    defaultGrain: '日 / 周 / 月',
    sensitivity: '普通',
    status: '已发布',
    creator: 'admin',
    updatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    referencedBy: ['指标市场', '待绑定 Agent'],
    lineage: [dataset.sourceName ?? '数据库连接', dataset.name, field.name, '指标市场'],
    synonyms: [field.semanticName, field.name],
    sampleQuestions: [`${field.semanticName}是多少？`, `按科室拆分${field.semanticName}。`],
    recentUsage: [],
    sourceFieldName: field.name,
    metricBindings: [
      {
        id: `bind-${Date.now()}-${index}-${field.name}`,
        datasetId: dataset.id,
        mode: 'field',
        field: field.name,
        enabled: true,
      },
    ],
  };
}

function normalizeDatasetField(field: DatasetFieldDefinition): DatasetFieldDefinition {
  const fieldRole = field.fieldRole ?? inferFieldRole(field.name);

  return {
    ...field,
    fieldRole,
    dataType: field.dataType ?? inferDataType(field.name),
    defaultAggregation: field.defaultAggregation ?? inferAggregation(field.name, fieldRole),
  };
}

function getDatasetFields(dataset: SemanticDataset) {
  const fields = dataset.queryFields ?? dataset.tables.flatMap((table) => table.fields) ?? [];
  return fields.map(normalizeDatasetField);
}

function getCandidateFields(fields: DatasetFieldDefinition[]) {
  return fields.filter((field) => field.fieldRole === '度量字段' || field.fieldRole === '标识字段');
}

function buildPreviewFields(sql: string) {
  const parsedFields = parseSqlFields(sql);
  const publishableFieldNames = getCandidateFields(parsedFields).map((field) => field.name);

  return { parsedFields, publishableFieldNames };
}

function getMetricBindingForDataset(indicator: IndicatorAsset, datasetId: string) {
  return indicator.metricBindings?.find((binding) => binding.datasetId === datasetId && binding.enabled);
}

function isIndicatorFromField(indicator: IndicatorAsset, datasetId: string, fieldName: string) {
  const binding = getMetricBindingForDataset(indicator, datasetId);
  if (!binding && indicator.datasetId !== datasetId) return false;
  if (binding?.mode === 'field') return binding.field === fieldName;
  if (binding?.mode === 'formula') {
    return formulaReferencesField(binding.formulaOverride ?? indicator.formula, fieldName);
  }
  if (indicator.sourceFieldName) return indicator.sourceFieldName === fieldName;

  return formulaReferencesField(indicator.formula, fieldName);
}

function formulaReferencesField(formula: string, fieldName: string) {
  return new RegExp(`(^|[^\\w])${fieldName}([^\\w]|$)`).test(formula);
}

function getFieldIndicatorReferences(
  dataset: SemanticDataset,
  fieldName: string,
  indicatorAssets: IndicatorAsset[],
) {
  return indicatorAssets.filter((indicator) => isIndicatorFromField(indicator, dataset.id, fieldName));
}

function isGeneratedAtomicIndicator(
  indicator: IndicatorAsset,
  dataset: SemanticDataset,
  fieldName: string,
) {
  if (!getMetricBindingForDataset(indicator, dataset.id) && indicator.datasetId !== dataset.id) return false;
  if (indicator.type !== '原子指标') return false;

  const binding = getMetricBindingForDataset(indicator, dataset.id);
  const hasDirectBinding = binding?.mode === 'field' && binding.field === fieldName;

  if (hasDirectBinding) return true;
  if (indicator.sourceFieldName) return indicator.sourceFieldName === fieldName;
  if (!formulaReferencesField(indicator.formula, fieldName)) return false;

  return !/\bWHERE\b/i.test(indicator.formula);
}

function getGeneratedAtomicIndicators(
  dataset: SemanticDataset,
  fieldName: string,
  indicatorAssets: IndicatorAsset[],
) {
  return indicatorAssets.filter((indicator) =>
    isGeneratedAtomicIndicator(indicator, dataset, fieldName),
  );
}

function getAssociatedIndicators(
  dataset: SemanticDataset,
  fieldName: string,
  indicatorAssets: IndicatorAsset[],
) {
  return getFieldIndicatorReferences(dataset, fieldName, indicatorAssets).filter(
    (indicator) => !isGeneratedAtomicIndicator(indicator, dataset, fieldName),
  );
}

function derivePublishedFieldNames(dataset: SemanticDataset, indicatorAssets: IndicatorAsset[]) {
  return getDatasetFields(dataset)
    .filter((field) => getFieldIndicatorReferences(dataset, field.name, indicatorAssets).length > 0)
    .map((field) => field.name);
}

function buildDatasetPayload(
  values: {
    datasetId: string;
    datasetName: string;
    businessTheme: string;
    description: string;
    sourceName: string;
    querySql: string;
    fields: DatasetFieldDefinition[];
  },
  preserved?: SemanticDataset,
) {
  const visibleFields = values.fields.filter((field) => field.fieldRole !== '隐藏字段');
  const dimensionFields = values.fields.filter(
    (field) => field.fieldRole === '维度字段' || field.fieldRole === '时间字段',
  );
  return {
    id: values.datasetId,
    name: values.datasetName.trim(),
    description: values.description.trim(),
    businessTheme: values.businessTheme.trim(),
    subjectObject: preserved?.subjectObject ?? 'SQL 结果集',
    sourceName: values.sourceName,
    querySql: values.querySql,
    queryFields: values.fields,
    datasourceCount: preserved?.datasourceCount ?? 1,
    drilldownRule: dimensionFields.map((field) => field.semanticName).join(' > ') || '未设置',
    tables: [
      {
        name: preserved?.tables[0]?.name ?? 'sql_result_view',
        type: preserved?.tables[0]?.type ?? '事实表',
        fields: values.fields,
      },
    ],
    metricIds: preserved?.metricIds ?? [],
    synonyms: visibleFields.map((field) => field.semanticName),
    permissionScope: preserved?.permissionScope ?? '经营分析组',
    relations:
      preserved?.relations.length
        ? preserved.relations
        : ['由 SQL 查询结果直接生成，暂不配置表关联关系。'],
    owner: preserved?.owner ?? 'admin',
    updatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
  } satisfies SemanticDataset;
}

type DatasetModalMode = 'create' | 'edit';
const emptyPublishedFieldNames: string[] = [];

function DatasetDeleteDialog({
  state,
  onClose,
  onConfirm,
}: {
  state: DatasetDeleteDialogState;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const canDelete = state.blockers.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <div className="text-lg font-semibold text-gray-900">
              {canDelete ? '删除数据集' : '无法删除数据集'}
            </div>
            <div className="mt-1 text-xs text-gray-500">{state.dataset.name}</div>
          </div>
          <button type="button" onClick={onClose} className="rounded p-2 text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-5 text-sm leading-6 text-gray-600">
          {canDelete ? (
            `确认删除数据集“${state.dataset.name}”？此操作不可恢复。`
          ) : (
            <div className="space-y-2">
              <div>该数据集当前仍被引用，请先处理以下依赖。</div>
              <ul className="list-disc space-y-1 pl-5">
                {state.blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            {canDelete ? '取消' : '我知道了'}
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
            >
              确认删除
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateDatasetModal({
  open,
  mode = 'create',
  initialDataset,
  initialPublishedFieldNames = emptyPublishedFieldNames,
  databaseConnections,
  indicatorAssets,
  onClose,
  onCreate,
  onUpdate,
}: {
  open: boolean;
  mode?: DatasetModalMode;
  initialDataset?: SemanticDataset | null;
  initialPublishedFieldNames?: string[];
  databaseConnections: DatabaseConnection[];
  indicatorAssets: IndicatorAsset[];
  onClose: () => void;
  onCreate: (dataset: SemanticDataset, indicators: IndicatorAsset[]) => void;
  onUpdate: (dataset: SemanticDataset, indicators: IndicatorAsset[]) => void;
}) {
  const [datasetName, setDatasetName] = useState('');
  const [businessTheme, setBusinessTheme] = useState('');
  const [description, setDescription] = useState('');
  const [sourceId, setSourceId] = useState(String(databaseConnections[0]?.id ?? ''));
  const [querySql, setQuerySql] = useState('');
  const [fields, setFields] = useState<DatasetFieldDefinition[]>([]);
  const [publishFieldNames, setPublishFieldNames] = useState<string[]>([]);

  const isEditMode = mode === 'edit' && Boolean(initialDataset);

  useEffect(() => {
    if (!open) return;

    if (isEditMode && initialDataset) {
      const datasetFields = getDatasetFields(initialDataset);
      const { parsedFields, publishableFieldNames } = buildPreviewFields(
        initialDataset.querySql ?? defaultSql,
      );
      const resolvedFields = datasetFields.length ? datasetFields : parsedFields;
      const selectedSource =
        databaseConnections.find((database) => database.name === initialDataset.sourceName) ??
        databaseConnections[0];

      setDatasetName(initialDataset.name);
      setBusinessTheme(initialDataset.businessTheme);
      setDescription(initialDataset.description);
      setSourceId(String(selectedSource?.id ?? databaseConnections[0]?.id ?? ''));
      setQuerySql(initialDataset.querySql ?? defaultSql);
      setFields(resolvedFields);
      setPublishFieldNames(
        initialPublishedFieldNames.filter((fieldName) => publishableFieldNames.includes(fieldName)),
      );
      return;
    }

    setDatasetName('');
    setBusinessTheme('');
    setDescription('');
    setSourceId(String(databaseConnections[0]?.id ?? ''));
    setQuerySql('');
    setFields([]);
    setPublishFieldNames([]);
  }, [databaseConnections, initialDataset, initialPublishedFieldNames, isEditMode, open]);

  if (!open) return null;

  const selectedSource =
    databaseConnections.find((database) => String(database.id) === sourceId) ??
    databaseConnections[0];
  const canSubmit = datasetName.trim() && querySql.trim() && fields.length > 0;

  const runPreview = () => {
    const { parsedFields, publishableFieldNames } = buildPreviewFields(querySql);

    setFields(parsedFields);
    setPublishFieldNames((current) => {
      if (!isEditMode) {
        return publishableFieldNames;
      }

      const preserved = current.filter((fieldName) => publishableFieldNames.includes(fieldName));
      return preserved.length
        ? preserved
        : initialPublishedFieldNames.filter((fieldName) => publishableFieldNames.includes(fieldName));
    });
  };

  const updateField = (fieldName: string, updates: Partial<DatasetFieldDefinition>) => {
    setFields((current) =>
      current.map((field) => {
        if (field.name !== fieldName) return field;

        const next = { ...field, ...updates };
        if (updates.fieldRole) {
          next.defaultAggregation = inferAggregation(next.name, updates.fieldRole);
        }
        return next;
      }),
    );
  };

  const togglePublishField = (fieldName: string) => {
    setPublishFieldNames((current) =>
      current.includes(fieldName)
        ? current.filter((item) => item !== fieldName)
        : [...current, fieldName],
    );
  };

  const submit = () => {
    if (!canSubmit) return;

    const datasetId = initialDataset?.id ?? `semantic-${Date.now()}`;
    const baseDataset = buildDatasetPayload(
      {
        datasetId,
        datasetName,
        businessTheme,
        description,
        sourceName: selectedSource?.name ?? '数据库连接',
        querySql,
        fields,
      },
      initialDataset ?? undefined,
    );

    if (isEditMode && initialDataset) {
      const newAtomicIndicators = fields
        .filter((field) => {
          const isPublishable = field.fieldRole === '度量字段' || field.fieldRole === '标识字段';
          const hasReferences = getFieldIndicatorReferences(initialDataset, field.name, indicatorAssets).length > 0;
          return isPublishable && publishFieldNames.includes(field.name) && !hasReferences;
        })
        .map((field, index) => buildIndicatorFromField(field, baseDataset, index));

      onUpdate({
        ...baseDataset,
        metricIds: [...initialDataset.metricIds, ...newAtomicIndicators.map((indicator) => indicator.id)],
      }, newAtomicIndicators);
      onClose();
      return;
    }

    const atomicIndicators = fields
      .filter((field) => publishFieldNames.includes(field.name))
      .map((field, index) => buildIndicatorFromField(field, baseDataset, index));

    onCreate(
      {
        ...baseDataset,
        metricIds: atomicIndicators.map((indicator) => indicator.id),
      },
      atomicIndicators,
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <div className="text-lg font-semibold text-gray-900">
              {isEditMode ? '编辑数据集' : '新建数据集'}
            </div>
          </div>
          <button onClick={onClose} className="rounded p-2 text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="text-sm text-gray-700">数据集名称</label>
                  <input
                    value={datasetName}
                    onChange={(event) => setDatasetName(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-700">业务主题</label>
                  <input
                    value={businessTheme}
                    onChange={(event) => setBusinessTheme(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-700">数据库连接</label>
                  <select
                    value={sourceId}
                    onChange={(event) => setSourceId(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    {databaseConnections.map((database) => (
                      <option key={database.id} value={database.id}>
                        {database.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm text-gray-700">描述</label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="text-sm text-gray-700">查询 SQL</label>
                  <button
                    onClick={runPreview}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                  >
                    <Play className="h-4 w-4" />
                    运行预览
                  </button>
                </div>
                <textarea
                  value={querySql}
                  onChange={(event) => setQuerySql(event.target.value)}
                  rows={9}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-5">
              <div className="text-sm text-gray-700">字段配置</div>
              <div className="rounded-lg border border-gray-200">
                <div className="max-h-[360px] overflow-auto">
                  <table className="w-full min-w-[860px]">
                    <thead className="bg-gray-50 text-left text-xs text-gray-500">
                      <tr>
                        <th className="px-3 py-2">字段</th>
                        <th className="px-3 py-2">业务名</th>
                        <th className="px-3 py-2">分类</th>
                        <th className="px-3 py-2">默认聚合</th>
                        <th className="px-3 py-2">
                          <div className="inline-flex items-center gap-1">
                            <span>发布为原子指标</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  aria-label="说明发布为原子指标"
                                  className="inline-flex items-center rounded-sm text-gray-400 transition-colors hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  <CircleHelp className="h-3.5 w-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" sideOffset={6} className="max-w-60">
                                <div className="space-y-1 leading-5">
                                  <div>度量字段、标识字段可发布为原子指标。</div>
                                  <div>
                                    时间字段、维度字段、隐藏字段不可发布为原子指标。
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {fields.map((field) => {
                        const referencedIndicators =
                          isEditMode && initialDataset
                            ? getFieldIndicatorReferences(initialDataset, field.name, indicatorAssets)
                            : [];
                        const isPublishable =
                          field.fieldRole === '度量字段' || field.fieldRole === '标识字段';
                        const isReferenced = referencedIndicators.length > 0;
                        const referencedIndicatorNames = referencedIndicators
                          .map((indicator) => indicator.name)
                          .join('、');
                        const lockedFieldTooltip = (
                          <div className="space-y-1 leading-5">
                            <div>该字段已被指标市场中的指标引用，分类、默认聚合和发布状态不可直接修改。</div>
                            <div>引用指标：{referencedIndicatorNames}</div>
                          </div>
                        );

                        return (
                          <tr key={field.name} className="text-sm">
                            <td className="px-3 py-3 font-mono text-xs text-gray-700">{field.name}</td>
                            <td className="px-3 py-3">
                              <input
                                value={field.semanticName}
                                onChange={(event) =>
                                  updateField(field.name, { semanticName: event.target.value })
                                }
                                className="w-full min-w-36 rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                              />
                            </td>
                            <td className="px-3 py-3">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span
                                    tabIndex={isReferenced ? 0 : undefined}
                                    className={isReferenced ? 'inline-flex cursor-not-allowed' : 'inline-flex'}
                                  >
                                    <select
                                      value={field.fieldRole}
                                      disabled={isReferenced}
                                      onChange={(event) =>
                                        updateField(field.name, {
                                          fieldRole: event.target.value as DatasetFieldRole,
                                        })
                                      }
                                      className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
                                    >
                                      {fieldRoleOptions.map((role) => (
                                        <option key={role} value={role}>
                                          {role}
                                        </option>
                                      ))}
                                    </select>
                                  </span>
                                </TooltipTrigger>
                                {isReferenced && (
                                  <TooltipContent side="top" sideOffset={6} className="max-w-72">
                                    {lockedFieldTooltip}
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </td>
                            <td className="px-3 py-3">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span
                                    tabIndex={isReferenced ? 0 : undefined}
                                    className={isReferenced ? 'inline-flex cursor-not-allowed' : 'inline-flex'}
                                  >
                                    <select
                                      value={field.defaultAggregation}
                                      disabled={isReferenced}
                                      onChange={(event) =>
                                        updateField(field.name, {
                                          defaultAggregation: event.target.value as AggregationMethod,
                                        })
                                      }
                                      className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
                                    >
                                      {aggregationOptions.map((aggregation) => (
                                        <option key={aggregation} value={aggregation}>
                                          {aggregation}
                                        </option>
                                      ))}
                                    </select>
                                  </span>
                                </TooltipTrigger>
                                {isReferenced && (
                                  <TooltipContent side="top" sideOffset={6} className="max-w-72">
                                    {lockedFieldTooltip}
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </td>
                            <td className="px-3 py-3">
                              {isReferenced ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span
                                      tabIndex={0}
                                      className="inline-flex cursor-not-allowed items-center"
                                      aria-label={`${field.semanticName}已被指标引用，不能取消发布`}
                                    >
                                      <input type="checkbox" checked disabled readOnly />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" sideOffset={6} className="max-w-64">
                                    {lockedFieldTooltip}
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={publishFieldNames.includes(field.name)}
                                  disabled={!isPublishable}
                                  onChange={() => togglePublishField(field.name)}
                                />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!fields.length && (
                    <div className="px-4 py-12 text-center text-sm text-gray-500">
                      运行预览后展示 SQL 返回字段
                    </div>
                  )}
                </div>
              </div>

              <div className="text-xs leading-5 text-gray-500">
                勾选“发布为原子指标”后，默认使用业务名作为指标名称、字段名作为英文标识，并按默认聚合生成计算公式。
              </div>

            </div>
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
            onClick={submit}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            <Save className="h-4 w-4" />
            {isEditMode ? '保存修改' : '保存数据集'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldRoleBadge({ role }: { role?: DatasetFieldRole }) {
  const value = role ?? '维度字段';
  const color =
    value === '时间字段'
      ? 'bg-indigo-50 text-indigo-700'
      : value === '度量字段'
        ? 'bg-emerald-50 text-emerald-700'
        : value === '标识字段'
          ? 'bg-amber-50 text-amber-700'
          : value === '隐藏字段'
            ? 'bg-gray-100 text-gray-500'
            : 'bg-blue-50 text-blue-700';

  return <span className={`rounded px-2 py-1 text-xs ${color}`}>{value}</span>;
}

function DatasetListView({
  datasets,
  totalCount,
  page,
  totalPages,
  indicatorAssets,
  keyword,
  onKeywordChange,
  onPageChange,
  onCreate,
  onView,
  onEdit,
  onDelete,
}: {
  datasets: SemanticDataset[];
  totalCount: number;
  page: number;
  totalPages: number;
  indicatorAssets: IndicatorAsset[];
  keyword: string;
  onKeywordChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onCreate: () => void;
  onView: (datasetId: string) => void;
  onEdit: (datasetId: string) => void;
  onDelete: (dataset: SemanticDataset) => void;
}) {
  return (
    <div className="h-full min-h-0 overflow-auto bg-gray-50">
      <div className="px-6 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-gray-900">数据集</div>
            <div className="mt-1 text-sm text-gray-500">管理语义数据集与字段映射，沉淀可复用指标。</div>
          </div>
          <button
            onClick={onCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            新建数据集
          </button>
        </div>

        <div className="mb-4 w-full min-w-[280px] sm:w-[420px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={keyword}
              onChange={(event) => onKeywordChange(event.target.value)}
              placeholder="搜索数据集名称、描述或业务主题"
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead className="bg-gray-50">
                <tr className="border-b border-gray-200 text-left text-sm font-medium text-gray-600">
                  <th className="px-6 py-3">数据集名称</th>
                  <th className="px-6 py-3">业务主题</th>
                  <th className="px-6 py-3 text-left">字段数</th>
                  <th className="px-6 py-3 text-left">原子指标发布</th>
                  <th className="px-6 py-3 text-left">数据库连接</th>
                  <th className="px-6 py-3">更新时间</th>
                  <th className="px-6 py-3">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {datasets.map((dataset) => {
                  const fields = getDatasetFields(dataset);
                  const formalCount = indicatorAssets.filter((indicator) =>
                    dataset.metricIds.includes(indicator.id),
                  ).length;

                  return (
                    <tr
                      key={dataset.id}
                      onClick={() => onView(dataset.id)}
                      className="cursor-pointer text-sm text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{dataset.name}</div>
                        <div className="mt-1 line-clamp-2 text-xs text-gray-500">{dataset.description}</div>
                      </td>
                      <td className="px-6 py-4">{dataset.businessTheme}</td>
                      <td className="px-6 py-4 text-left">{fields.length}</td>
                      <td className="px-6 py-4 text-left">{formalCount}</td>
                      <td className="px-6 py-4 text-left">{dataset.sourceName ?? '未配置'}</td>
                      <td className="px-6 py-4">{dataset.updatedAt}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          <ConfigActionIconButton
                            onClick={(event) => {
                              event.stopPropagation();
                              onView(dataset.id);
                            }}
                            icon={Eye}
                            label="查看"
                            variant="view"
                          />
                          <ConfigActionIconButton
                            onClick={(event) => {
                              event.stopPropagation();
                              onEdit(dataset.id);
                            }}
                            icon={PencilLine}
                            label="编辑"
                            variant="edit"
                          />
                          <ConfigActionIconButton
                            onClick={(event) => {
                              event.stopPropagation();
                              onDelete(dataset);
                            }}
                            icon={Trash2}
                            label="删除"
                            variant="delete"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!datasets.length && (
            <div className="px-6 py-16 text-center text-sm text-gray-500">未找到匹配的数据集</div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-1 pt-3 text-sm text-gray-500">
          <div>
            共 {totalCount} 条，每页 {datasetPageSize} 条
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page === 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:border-gray-100 disabled:text-gray-300"
              aria-label="上一页"
              title="上一页"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => onPageChange(pageNumber)}
                className={`h-8 min-w-8 rounded-md border px-2 text-sm transition-colors ${
                  page === pageNumber
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:text-blue-600'
                }`}
              >
                {pageNumber}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
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
  );
}

function DatasetDetailView({
  dataset,
  indicatorAssets,
  onBack,
  onEdit,
  onViewIndicator,
}: {
  dataset: SemanticDataset;
  indicatorAssets: IndicatorAsset[];
  onBack: () => void;
  onEdit: () => void;
  onViewIndicator: (indicatorId: string) => void;
}) {
  const queryFields = getDatasetFields(dataset);
  const datasetIndicators = indicatorAssets.filter((indicator) => dataset.metricIds.includes(indicator.id));

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-gray-50 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ConfigDetailHeader
        backLabel="返回数据集列表"
        onBack={onBack}
        icon={Layers3}
        title={dataset.name}
        subtitle={dataset.description}
        actions={
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <PencilLine className="h-4 w-4" />
            编辑数据集
          </button>
        }
        metaItems={[
          { label: '业务主题', value: dataset.businessTheme },
          { label: '数据库连接', value: dataset.sourceName ?? '未配置', tone: 'blue' },
          { label: '字段数', value: queryFields.length },
          { label: '原子指标', value: datasetIndicators.length },
        ]}
      />

      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="space-y-6">
          {dataset.querySql && (
            <section className="rounded-lg border border-gray-200 bg-white">
              <div className="flex items-center gap-2 border-b border-gray-200 px-5 py-4 text-sm font-medium text-gray-900">
                <Table2 className="h-4 w-4 text-blue-600" />
                数据集 SQL
              </div>
              <pre className="max-h-64 overflow-auto bg-slate-950 p-5 text-xs leading-6 text-slate-100">
                {dataset.querySql}
              </pre>
            </section>
          )}

            <section className="rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center gap-2 border-b border-gray-200 px-5 py-4 text-sm font-medium text-gray-900">
              <Blocks className="h-4 w-4 text-blue-600" />
              字段配置
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px]">
                <thead className="bg-gray-50 text-left text-sm text-gray-600">
                  <tr>
                    <th className="px-5 py-3">字段</th>
                    <th className="px-5 py-3">业务名</th>
                    <th className="px-5 py-3">分类</th>
                    <th className="px-5 py-3">类型</th>
                    <th className="px-5 py-3">默认聚合</th>
                    <th className="px-5 py-3">原子指标</th>
                    <th className="px-5 py-3">引用指标</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {queryFields.map((field) => {
                    const generatedIndicators = getGeneratedAtomicIndicators(
                      dataset,
                      field.name,
                      indicatorAssets,
                    );
                    const associatedIndicators = getAssociatedIndicators(
                      dataset,
                      field.name,
                      indicatorAssets,
                    );

                    return (
                      <tr key={field.name} className="text-sm text-gray-700">
                        <td className="px-5 py-3 font-mono text-xs">{field.name}</td>
                        <td className="px-5 py-3 font-medium text-gray-900">{field.semanticName}</td>
                        <td className="px-5 py-3">
                          <FieldRoleBadge role={field.fieldRole} />
                        </td>
                        <td className="px-5 py-3">{field.dataType ?? '-'}</td>
                        <td className="px-5 py-3">{field.defaultAggregation ?? 'NONE'}</td>
                        <td className="px-5 py-3">
                          {generatedIndicators.length ? (
                            <div className="flex flex-wrap gap-2">
                              {generatedIndicators.map((indicator) => (
                                <button
                                  key={indicator.id}
                                  onClick={() => onViewIndicator(indicator.id)}
                                  className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700 hover:bg-emerald-100"
                                >
                                  {indicator.name}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {associatedIndicators.length ? (
                            <div className="flex flex-wrap gap-2">
                              {associatedIndicators.map((indicator) => (
                                <button
                                  key={indicator.id}
                                  onClick={() => onViewIndicator(indicator.id)}
                                  className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700 hover:bg-blue-100"
                                >
                                  {indicator.name}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center gap-2 border-b border-gray-200 px-5 py-4 text-sm font-medium text-gray-900">
              <Database className="h-4 w-4 text-blue-600" />
              数据集关联指标
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr className="border-b border-gray-200 text-left text-sm text-gray-600">
                    <th className="px-5 py-3">指标</th>
                    <th className="px-5 py-3">类型</th>
                    <th className="px-5 py-3">公式</th>
                    <th className="px-5 py-3">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {datasetIndicators.map((indicator) => (
                    <tr key={indicator.id} className="text-sm text-gray-700">
                      <td className="px-5 py-3">
                        <div className="font-medium text-gray-900">{indicator.name}</div>
                        <div className="mt-1 text-xs text-gray-500">{indicator.nameEn}</div>
                      </td>
                      <td className="px-5 py-3">{indicator.type}</td>
                      <td className="px-5 py-3 font-mono text-xs text-blue-700">{indicator.formula}</td>
                      <td className="px-5 py-3">{indicator.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function DatasetNotFound({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center bg-gray-50 px-6">
      <div className="rounded-xl border border-gray-200 bg-white px-8 py-10 text-center shadow-sm">
        <div className="text-lg font-semibold text-gray-900">未找到对应的数据集</div>
        <div className="mt-2 text-sm text-gray-500">这个数据集可能已被删除，或者链接不再有效。</div>
        <button
          onClick={onBack}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          <ArrowLeft className="h-4 w-4" />
          返回数据集列表
        </button>
      </div>
    </div>
  );
}

export type DatasetManagementProps = {
  embedded?: boolean;
  selectedDatasetId?: string | null;
  onViewDataset?: (datasetId: string) => void;
  onBackToList?: () => void;
  onViewIndicator?: (indicatorId: string) => void;
};

export default function DatasetManagement({
  embedded = false,
  selectedDatasetId,
  onViewDataset,
  onBackToList,
  onViewIndicator,
}: DatasetManagementProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeDatasetId } = useParams();
  const id = selectedDatasetId ?? routeDatasetId ?? null;
  const editMode = new URLSearchParams(location.search).get('mode') === 'edit';
  const {
    agents,
    semanticDatasets,
  indicatorAssets,
  databaseConnections,
  dimensionSemantics,
    addSemanticDataset,
    addIndicatorAssets,
    updateSemanticDataset,
    deleteSemanticDataset,
  } = useWorkspace();

  const [searchKeyword, setSearchKeyword] = useState('');
  const [datasetPage, setDatasetPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingDatasetId, setEditingDatasetId] = useState<string | null>(null);
  const [deleteDialogState, setDeleteDialogState] = useState<DatasetDeleteDialogState | null>(null);

  const filteredDatasets = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();

    if (!keyword) return semanticDatasets;

    return semanticDatasets.filter((dataset) =>
      [
        dataset.name,
        dataset.description,
        dataset.businessTheme,
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword),
    );
  }, [searchKeyword, semanticDatasets]);

  const datasetTotalPages = Math.max(1, Math.ceil(filteredDatasets.length / datasetPageSize));
  const paginatedDatasets = useMemo(() => {
    const start = (datasetPage - 1) * datasetPageSize;
    return filteredDatasets.slice(start, start + datasetPageSize);
  }, [datasetPage, filteredDatasets]);

  useEffect(() => {
    setDatasetPage((current) => Math.min(current, datasetTotalPages));
  }, [datasetTotalPages]);

  useEffect(() => {
    if (!editMode || !id) return;
    setEditingDatasetId(id);
  }, [editMode, id]);

  const selectedDataset = semanticDatasets.find((dataset) => dataset.id === id) ?? null;
  const editingDataset = semanticDatasets.find((dataset) => dataset.id === editingDatasetId) ?? null;
  const editingPublishedFieldNames = editingDataset
    ? derivePublishedFieldNames(editingDataset, indicatorAssets)
    : [];

  const handleCreate = (dataset: SemanticDataset, indicators: IndicatorAsset[]) => {
    addSemanticDataset(dataset);
    addIndicatorAssets(indicators);
    setIsCreateOpen(false);
  };

  const handleUpdate = (dataset: SemanticDataset, indicators: IndicatorAsset[] = []) => {
    updateSemanticDataset(dataset.id, dataset);
    addIndicatorAssets(indicators);
    setEditingDatasetId(null);
  };

  const getDatasetDeleteBlockers = (dataset: SemanticDataset) => {
    const indicatorRefs = indicatorAssets.filter((indicator) =>
      indicator.metricBindings?.some((binding) => binding.datasetId === dataset.id),
    );
    const agentRefs = agents.filter((agent) => agent.datasetIds?.includes(dataset.id));
    const dimensionRefs = dimensionSemantics.filter((dimension) =>
      dimension.bindings.some((binding) => binding.datasetId === dataset.id),
    );

    return [
      indicatorRefs.length ? `已被 ${indicatorRefs.length} 个指标映射引用：${indicatorRefs.map((item) => item.name).join('、')}` : '',
      agentRefs.length ? `已被 ${agentRefs.length} 个 Agent 引用：${agentRefs.map((item) => item.name).join('、')}` : '',
      dimensionRefs.length ? `已被 ${dimensionRefs.length} 个维度字段映射引用：${dimensionRefs.map((item) => item.label).join('、')}` : '',
    ].filter(Boolean);
  };

  const handleDeleteDataset = (dataset: SemanticDataset, afterDelete?: () => void) => {
    const blockers = getDatasetDeleteBlockers(dataset);
    setDeleteDialogState({ dataset, blockers, afterDelete });
  };

  const confirmDeleteDataset = () => {
    if (!deleteDialogState || deleteDialogState.blockers.length) return;
    deleteSemanticDataset(deleteDialogState.dataset.id);
    const afterDelete = deleteDialogState.afterDelete;
    setDeleteDialogState(null);
    afterDelete?.();
  };

  const viewDataset = onViewDataset ?? ((datasetId: string) => navigate(`/semantic?tab=datasets&datasetId=${datasetId}`));
  const backToList = onBackToList ?? (() => navigate('/semantic?tab=datasets'));
  const viewIndicator = onViewIndicator ?? ((indicatorId: string) => navigate(`/indicator/${indicatorId}`));

  return (
    <div className={`relative flex h-full min-h-0 flex-col overflow-hidden ${embedded ? '' : 'bg-gray-50'}`}>
      <div className="min-h-0 flex-1">
        {id ? (
          selectedDataset ? (
            <DatasetDetailView
              dataset={selectedDataset}
              indicatorAssets={indicatorAssets}
              onBack={backToList}
              onEdit={() => setEditingDatasetId(selectedDataset.id)}
              onViewIndicator={viewIndicator}
            />
          ) : (
            <DatasetNotFound onBack={backToList} />
          )
        ) : (
          <DatasetListView
            datasets={paginatedDatasets}
            totalCount={filteredDatasets.length}
            page={datasetPage}
            totalPages={datasetTotalPages}
            indicatorAssets={indicatorAssets}
            keyword={searchKeyword}
            onKeywordChange={(value) => {
              setSearchKeyword(value);
              setDatasetPage(1);
            }}
            onPageChange={setDatasetPage}
            onCreate={() => setIsCreateOpen(true)}
            onView={viewDataset}
            onEdit={(datasetId) => setEditingDatasetId(datasetId)}
            onDelete={handleDeleteDataset}
          />
        )}
      </div>

      <CreateDatasetModal
        open={isCreateOpen}
        mode="create"
        databaseConnections={databaseConnections}
        indicatorAssets={indicatorAssets}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
      />

      <CreateDatasetModal
        open={Boolean(editingDataset)}
        mode="edit"
        initialDataset={editingDataset}
        initialPublishedFieldNames={editingPublishedFieldNames}
        databaseConnections={databaseConnections}
        indicatorAssets={indicatorAssets}
        onClose={() => setEditingDatasetId(null)}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
      />

      {deleteDialogState && (
        <DatasetDeleteDialog
          state={deleteDialogState}
          onClose={() => setDeleteDialogState(null)}
          onConfirm={confirmDeleteDataset}
        />
      )}
    </div>
  );
}
