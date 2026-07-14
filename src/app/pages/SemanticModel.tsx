import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ArrowRight, ChevronLeft, ChevronRight, CircleHelp, Clock3, Database, Eye, PencilLine, Plus, Search, Shapes, Tags, Trash2, Users, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { ConfigActionIconButton } from '../components/ConfigActionIconButton';
import { ConfigDetailHeader } from '../components/ConfigDetailHeader';
import { useWorkspace } from '../context/WorkspaceContext';
import { DimensionDatasetBinding, DimensionMember, DimensionSemantic, SemanticDataset, TimeFieldRole, TimeGrain } from '../types';
import DatasetManagement from './DatasetManagement';

type TabKey = 'datasets' | 'dimensions' | 'synonyms';
type SynonymRecordType = '指标' | '普通维度' | '时间维度' | '维度值别名' | '数据集主题';
type SynonymEditTarget = 'indicator' | 'dimension' | 'member' | 'dataset';
type ConflictType =
  | '指标 vs 指标'
  | '普通维度/时间维度 vs 普通维度/时间维度'
  | '维度值别名 vs 维度值别名'
  | '指标 vs 数据集主题'
  | '普通维度/时间维度 vs 数据集主题'
  | '普通维度/时间维度 vs 维度值别名'
  | '其他混合冲突';
type ConflictRisk = '高' | '中' | '低';

type SynonymRecord = {
  id: string;
  type: SynonymRecordType;
  module: string;
  name: string;
  aliases: string[];
  description: string;
  editTarget: SynonymEditTarget;
  dimensionId?: string;
};

type AliasConflict = {
  alias: string;
  aliasKey: string;
  records: SynonymRecord[];
  conflictType: ConflictType;
  risk: ConflictRisk;
};

type SynonymRiskFilter = 'all' | ConflictRisk | 'none';
type SynonymSortMode = 'risk';

type SynonymRow = {
  key: string;
  record: SynonymRecord;
  conflicts: AliasConflict[];
  highestRisk?: ConflictRisk;
  riskValue: ConflictRisk | 'none';
  conflictAliasKeys: Set<string>;
  topConflict?: AliasConflict;
};

type DimensionDeleteDialogState = {
  dimension: DimensionSemantic;
  memberCount: number;
  bindingCount: number;
};

const tabs: Array<{ id: TabKey; label: string; description?: string; icon: typeof Shapes }> = [
  { id: 'datasets', label: '数据集', icon: Database },
  { id: 'dimensions', label: '维度定义', icon: Shapes },
  { id: 'synonyms', label: '同义词治理', icon: Tags },
];

const dimensionTypes: Array<{ value: DimensionSemantic['type']; label: string }> = [
  { value: '普通', label: '普通维度' },
  { value: '时间', label: '时间维度' },
];
const dimensionPageSize = 10;
const synonymPageSize = 10;
const timeFieldRoles: TimeFieldRole[] = ['就诊日期', '结算日期', '出院日期', '手术日期'];
const timeGrainOptions: TimeGrain[] = ['日', '周', '月', '季', '年'];
const defaultRelativeTimePresets = ['今日', '本周', '本月', '上月', '近7天', '最近30天', '今年以来', '去年同期'];
const synonymRecordTypes: SynonymRecordType[] = ['指标', '普通维度', '时间维度', '维度值别名', '数据集主题'];
const synonymRiskRank: Record<ConflictRisk | 'none', number> = { 高: 0, 中: 1, 低: 2, none: 3 };

function FieldHelp({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-gray-400 hover:bg-white hover:text-blue-600"
        >
          <CircleHelp className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent sideOffset={8} className="max-w-80 bg-gray-900 text-left text-white">
        <div className="space-y-1 text-xs leading-5">{children}</div>
      </TooltipContent>
    </Tooltip>
  );
}

function isTabKey(value: string | null): value is TabKey {
  return tabs.some((tab) => tab.id === value);
}

function splitList(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,，、]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function joinList(values: string[]) {
  return values.join('\n');
}

function buildDimensionName(label: string) {
  return label.trim().toLowerCase().replace(/\s+/g, '_') || `dimension_${Date.now()}`;
}

function getDatasetFields(dataset?: SemanticDataset) {
  return dataset?.queryFields ?? dataset?.tables.flatMap((table) => table.fields) ?? [];
}

function normalizeAliasKey(alias: string) {
  return alias.replace(/\s+/g, '').toLowerCase();
}

function isDimensionRecordType(type: SynonymRecordType) {
  return type === '普通维度' || type === '时间维度';
}

function getConflictType(records: SynonymRecord[]): ConflictType {
  const types = Array.from(new Set(records.map((record) => record.type)));
  const hasOnly = (...targetTypes: SynonymRecordType[]) =>
    types.length === targetTypes.length && targetTypes.every((type) => types.includes(type));
  const hasIndicator = types.includes('指标');
  const hasDataset = types.includes('数据集主题');
  const hasMember = types.includes('维度值别名');
  const hasDimension = types.some(isDimensionRecordType);

  if (hasOnly('指标')) return '指标 vs 指标';
  if (types.every(isDimensionRecordType)) return '普通维度/时间维度 vs 普通维度/时间维度';
  if (hasOnly('维度值别名')) return '维度值别名 vs 维度值别名';
  if (hasIndicator && hasDataset && types.length === 2) return '指标 vs 数据集主题';
  if (hasDimension && hasDataset && !hasIndicator && !hasMember) return '普通维度/时间维度 vs 数据集主题';
  if (hasDimension && hasMember && !hasIndicator && !hasDataset) return '普通维度/时间维度 vs 维度值别名';

  return '其他混合冲突';
}

function getConflictRisk(conflictType: ConflictType): ConflictRisk {
  if (
    conflictType === '指标 vs 指标' ||
    conflictType === '普通维度/时间维度 vs 普通维度/时间维度' ||
    conflictType === '维度值别名 vs 维度值别名' ||
    conflictType === '普通维度/时间维度 vs 维度值别名'
  ) {
    return '高';
  }

  if (conflictType === '指标 vs 数据集主题' || conflictType === '普通维度/时间维度 vs 数据集主题') {
    return '中';
  }

  return '低';
}

function formatConflictTarget(record: SynonymRecord) {
  return record.type === '维度值别名' && record.description
    ? `${record.description}=${record.name}`
    : record.name;
}

function buildAliasConflicts(records: SynonymRecord[]): AliasConflict[] {
  const aliasGroups = records.reduce<Record<string, { alias: string; records: SynonymRecord[] }>>((groups, record) => {
    record.aliases.forEach((alias) => {
      const key = normalizeAliasKey(alias);
      if (!key) return;
      groups[key] = {
        alias: groups[key]?.alias ?? alias,
        records: [...(groups[key]?.records ?? []), record],
      };
    });
    return groups;
  }, {});

  return Object.entries(aliasGroups)
    .filter(([, group]) => group.records.length > 1)
    .map(([aliasKey, group]) => {
      const conflictType = getConflictType(group.records);

      return {
        alias: group.alias,
        aliasKey,
        records: group.records,
        conflictType,
        risk: getConflictRisk(conflictType),
      };
    });
}

function getRecordConflicts(record: SynonymRecord, conflicts: AliasConflict[]) {
  return conflicts.filter((conflict) =>
    conflict.records.some((item) => `${item.type}-${item.id}` === `${record.type}-${record.id}`),
  );
}

function getHighestRisk(conflicts: AliasConflict[]): ConflictRisk | undefined {
  if (conflicts.some((conflict) => conflict.risk === '高')) return '高';
  if (conflicts.some((conflict) => conflict.risk === '中')) return '中';
  if (conflicts.length) return '低';
  return undefined;
}

function getRiskBadgeClass(risk?: ConflictRisk) {
  if (risk === '高') return 'bg-red-50 text-red-700 ring-red-100';
  if (risk === '中') return 'bg-amber-50 text-amber-700 ring-amber-100';
  if (risk === '低') return 'bg-gray-100 text-gray-600 ring-gray-200';
  return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
}

function getRiskLabel(risk?: ConflictRisk) {
  return risk ? `${risk}风险` : '无风险';
}

function getSynonymRecordKey(record: SynonymRecord) {
  return `${record.type}-${record.id}`;
}

function getSynonymSuggestion(row: SynonymRow) {
  if (!row.highestRisk) return '当前未发现同义词冲突，建议保持现有配置并随新增指标、维度同步复核。';
  if (row.highestRisk === '高') return '优先回到归属模块调整命名或别名，避免问数时命中错误对象。';
  if (row.highestRisk === '中') return '建议确认该词更适合作为业务对象名称还是数据集主题，必要时减少跨层级复用。';
  return '建议在低峰期统一清理重复表达，提升语义资产整洁度。';
}

function ModalShell({
  title,
  description,
  children,
  footer,
  onClose,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  footer: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-6 py-4">
          <div>
            <div className="text-lg font-semibold text-gray-900">{title}</div>
            {description && <div className="mt-1 text-sm text-gray-500">{description}</div>}
          </div>
          <button type="button" onClick={onClose} className="rounded p-2 text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            取消
          </button>
          {footer}
        </div>
      </div>
    </div>
  );
}

function DimensionDeleteDialog({
  state,
  onClose,
  onConfirm,
}: {
  state: DimensionDeleteDialogState;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
          <div>
            <div className="text-lg font-semibold text-gray-900">删除维度</div>
            <div className="mt-1 text-sm text-gray-500">{state.dimension.label}</div>
          </div>
          <button type="button" onClick={onClose} className="rounded p-2 text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-6 py-5 text-sm leading-6 text-gray-600">
          <div className="space-y-3">
            <div>
              确认删除维度“{state.dimension.label}”？删除后，系统将不再使用该维度识别用户问题里的筛选和分组表达。
            </div>
            {(state.memberCount > 0 || state.bindingCount > 0 || state.dimension.synonyms.length > 0) && (
              <div className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
                <div className="font-medium">将一并移除以下语义配置：</div>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {state.memberCount > 0 && <li>{state.memberCount} 个维度值及其原始值映射</li>}
                  {state.bindingCount > 0 && <li>{state.bindingCount} 条数据集字段映射</li>}
                  {state.dimension.synonyms.length > 0 && <li>{state.dimension.synonyms.length} 个维度名称同义词</li>}
                </ul>
              </div>
            )}
            <div className="text-gray-500">此操作不可恢复。</div>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
          >
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
}

function DimensionEditorModal({
  dimension,
  semanticDatasets,
  onClose,
  onSubmit,
}: {
  dimension?: DimensionSemantic | null;
  semanticDatasets: SemanticDataset[];
  onClose: () => void;
  onSubmit: (dimension: DimensionSemantic) => void;
}) {
  const [label, setLabel] = useState(dimension?.label ?? '');
  const [description, setDescription] = useState(dimension?.description ?? '');
  const [type, setType] = useState<DimensionSemantic['type']>(dimension?.type ?? '普通');
  const [synonymsText, setSynonymsText] = useState(joinList(dimension?.synonyms ?? []));
  const [bindings, setBindings] = useState<DimensionDatasetBinding[]>(dimension?.bindings ?? []);
  const [fieldRole, setFieldRole] = useState<TimeFieldRole>(dimension?.timeConfig?.fieldRole ?? '就诊日期');

  const canSubmit =
    Boolean(label.trim() && description.trim()) &&
    bindings.every((binding) => binding.datasetId && binding.field.trim());

  const addBinding = () => {
    const usedDatasetIds = new Set(bindings.map((binding) => binding.datasetId));
    const datasetId = semanticDatasets.find((dataset) => !usedDatasetIds.has(dataset.id))?.id ?? semanticDatasets[0]?.id;
    if (!datasetId) return;

    setBindings((current) => [
      ...current,
      {
        id: `bind-${Date.now()}-${datasetId}`,
        datasetId,
        field: '',
        enabled: true,
      },
    ]);
  };

  const updateBinding = (bindingId: string, updates: Partial<DimensionDatasetBinding>) => {
    setBindings((current) =>
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

  const removeBinding = (bindingId: string) => {
    setBindings((current) => current.filter((binding) => binding.id !== bindingId));
  };

  return (
    <ModalShell
      title={dimension ? '编辑维度' : '新建维度'}
      onClose={onClose}
      footer={
        <button
          disabled={!canSubmit}
          onClick={() =>
            onSubmit({
              id: dimension?.id ?? `dim-${Date.now()}`,
              name: dimension?.name ?? buildDimensionName(label),
              label: label.trim(),
              description: description.trim(),
              type,
              synonyms: splitList(synonymsText),
              hierarchyId: type === '时间' ? undefined : dimension?.hierarchyId,
              memberResolver: type === '时间' ? 'runtime_search' : dimension?.memberResolver ?? 'dictionary',
              bindings: bindings.map((binding) => ({
                ...binding,
                field: binding.field.trim(),
                memberSource: binding.memberSource?.trim() || undefined,
              })),
              timeConfig:
                type === '时间'
                  ? {
                      fieldRole,
                      supportedGrains: dimension?.timeConfig?.supportedGrains ?? timeGrainOptions,
                      relativePresets: dimension?.timeConfig?.relativePresets ?? defaultRelativeTimePresets,
                    }
                  : undefined,
            })
          }
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          保存
        </button>
      }
    >
      <div className="grid gap-5">
        <section className="grid gap-4 md:grid-cols-2">
          <label className="text-sm text-gray-700">
            维度名称
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="如：科室、出院日期"
            />
          </label>
          <label className="text-sm text-gray-700">
            类型
            <select
              value={type}
              onChange={(event) => setType(event.target.value as DimensionSemantic['type'])}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              {dimensionTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-700 md:col-span-2">
            说明
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1 min-h-20 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="说明这个维度的业务含义和使用场景"
            />
          </label>
          <label className="text-sm text-gray-700 md:col-span-2">
            维度名称同义词
            <textarea
              value={synonymsText}
              onChange={(event) => setSynonymsText(event.target.value)}
              className="mt-1 min-h-20 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="例如：门诊科室、住院科室。支持逗号、顿号或换行分隔"
            />
          </label>
        </section>

        {type === '时间' && (
          <section className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
            <div className="grid gap-4">
              <label className="text-sm text-gray-700">
                <span className="inline-flex items-center gap-1">
                  时间角色
                  <FieldHelp label="时间角色说明">
                    <div>用来区分同一张表里不同日期口径，例如就诊日、结算日、出院日、手术日。</div>
                    <div>问数时如果用户说“按出院日期”或“手术完成时间”，系统会优先匹配对应时间维度和底层字段。</div>
                  </FieldHelp>
                </span>
                <select
                  value={fieldRole}
                  onChange={(event) => setFieldRole(event.target.value as TimeFieldRole)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  {timeFieldRoles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-gray-900">字段映射</div>
            </div>
            <button
              type="button"
              onClick={addBinding}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Plus className="h-4 w-4" />
              添加映射
            </button>
          </div>
          <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
            <div className="grid gap-2 bg-gray-50 px-3 py-2 text-xs text-gray-500 md:grid-cols-[1fr_1fr_80px_44px]">
              <div>数据集</div>
              <div>字段</div>
              <div>启用</div>
              <div />
            </div>
            <div className="divide-y divide-gray-200">
              {bindings.map((binding) => (
                <div key={binding.id} className="grid gap-2 px-3 py-3 md:grid-cols-[1fr_1fr_80px_44px]">
                  <select
                    value={binding.datasetId}
                    onChange={(event) => updateBinding(binding.id, { datasetId: event.target.value, field: '' })}
                    className="rounded-lg border border-gray-300 px-2 py-2 text-sm"
                  >
                    {semanticDatasets.map((dataset) => (
                      <option key={dataset.id} value={dataset.id}>
                        {dataset.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={binding.field}
                    onChange={(event) => updateBinding(binding.id, { field: event.target.value })}
                    className="rounded-lg border border-gray-300 px-2 py-2 text-sm"
                  >
                    <option value="">请选择</option>
                    {(() => {
                      const datasetFields = getDatasetFields(semanticDatasets.find((dataset) => dataset.id === binding.datasetId));
                      const fieldOptions =
                        binding.field && !datasetFields.some((field) => field.name === binding.field)
                          ? [
                              {
                                name: binding.field,
                                semanticName: binding.field,
                              },
                              ...datasetFields,
                            ]
                          : datasetFields;

                      return fieldOptions.map((field) => (
                        <option key={field.name} value={field.name}>
                          {field.semanticName ? `${field.semanticName}（${field.name}）` : field.name}
                        </option>
                      ));
                    })()}
                  </select>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={binding.enabled}
                      onChange={(event) => updateBinding(binding.id, { enabled: event.target.checked })}
                    />
                    启用
                  </label>
                  <button
                    type="button"
                    onClick={() => removeBinding(binding.id)}
                    aria-label="删除映射"
                    title="删除映射"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {!bindings.length && <div className="px-4 py-6 text-center text-sm text-gray-400">暂无映射字段</div>}
            </div>
          </div>
        </section>
      </div>
    </ModalShell>
  );
}

function DimensionMembersModal({
  dimension,
  members,
  semanticDatasets,
  onClose,
  onSaveMember,
  onAddMember,
  onDeleteMember,
}: {
  dimension: DimensionSemantic;
  members: DimensionMember[];
  semanticDatasets: SemanticDataset[];
  onClose: () => void;
  onSaveMember: (memberId: string, updates: Partial<DimensionMember>) => void;
  onAddMember: (member: DimensionMember) => void;
  onDeleteMember: (memberId: string) => void;
}) {
  const enabledBindings = dimension.bindings.filter((binding) => binding.enabled);
  const datasetNameById = new Map(semanticDatasets.map((dataset) => [dataset.id, dataset.name]));
  const formatBindingFieldLabel = (binding: DimensionDatasetBinding) => {
    const dataset = semanticDatasets.find((item) => item.id === binding.datasetId);
    const field = getDatasetFields(dataset).find((item) => item.name === binding.field);

    return field?.semanticName ? `${field.semanticName}（${field.name}）` : binding.field;
  };
  const formatBindingDatasetFieldLabel = (binding: DimensionDatasetBinding) =>
    `${datasetNameById.get(binding.datasetId) ?? binding.datasetId} - ${formatBindingFieldLabel(binding)}`;
  const buildMappingTexts = (member: DimensionMember) =>
    enabledBindings.reduce<Record<string, string>>((texts, binding) => {
      const mapping = member.valueMappings?.find((item) => item.datasetId === binding.datasetId && item.enabled);
      texts[binding.datasetId] = joinList(mapping?.rawValues ?? []);
      return texts;
    }, {});
  const buildMappingIds = (member: DimensionMember) =>
    enabledBindings.reduce<Record<string, string>>((ids, binding) => {
      const mapping = member.valueMappings?.find((item) => item.datasetId === binding.datasetId);
      if (mapping) ids[binding.datasetId] = mapping.id;
      return ids;
    }, {});
  const [drafts, setDrafts] = useState(
    members.map((member) => ({
      id: member.id,
      name: member.name,
      aliasesText: joinList(member.aliases),
      valueMappingTexts: buildMappingTexts(member),
      valueMappingIds: buildMappingIds(member),
    })),
  );
  const [newName, setNewName] = useState('');
  const [newAliasesText, setNewAliasesText] = useState('');
  const [newValueMappingTexts, setNewValueMappingTexts] = useState<Record<string, string>>({});
  const [deletedMemberIds, setDeletedMemberIds] = useState<string[]>([]);

  const buildValueMappings = (draft: {
    id: string;
    valueMappingTexts: Record<string, string>;
    valueMappingIds?: Record<string, string>;
  }) =>
    enabledBindings
      .map((binding) => {
        const rawValues = splitList(draft.valueMappingTexts[binding.datasetId] ?? '');
        if (!rawValues.length) return null;

        return {
          id: draft.valueMappingIds?.[binding.datasetId] ?? `value-map-${Date.now()}-${draft.id}-${binding.datasetId}`,
          datasetId: binding.datasetId,
          rawValues,
          enabled: true,
        };
      })
      .filter((mapping): mapping is NonNullable<typeof mapping> => Boolean(mapping));

  const updateDraft = (memberId: string, updates: Partial<{ name: string; aliasesText: string }>) => {
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === memberId
          ? {
              ...draft,
              ...updates,
            }
          : draft,
      ),
    );
  };

  const updateDraftValueMapping = (memberId: string, datasetId: string, value: string) => {
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === memberId
          ? {
              ...draft,
              valueMappingTexts: {
                ...draft.valueMappingTexts,
                [datasetId]: value,
              },
            }
          : draft,
      ),
    );
  };

  const addDraftMember = () => {
    const name = newName.trim();

    setDrafts((current) => [
      ...current,
      {
        id: `new-member-${Date.now()}`,
        name,
        aliasesText: newAliasesText,
        valueMappingTexts: newValueMappingTexts,
        valueMappingIds: {},
      },
    ]);
    setNewName('');
    setNewAliasesText('');
    setNewValueMappingTexts({});
  };

  const deleteDraftMember = (memberId: string) => {
    setDrafts((current) => current.filter((draft) => draft.id !== memberId));
    if (!memberId.startsWith('new-member-')) {
      setDeletedMemberIds((current) => [...current, memberId]);
    }
  };
  const getRawValueCandidates = (binding: DimensionDatasetBinding) =>
    Array.from(
      new Set(
        members.flatMap(
          (member) =>
            member.valueMappings
              ?.filter((mapping) => mapping.datasetId === binding.datasetId)
              .flatMap((mapping) => mapping.rawValues) ?? [],
        ),
      ),
    );

  return (
    <ModalShell
      title={`维度值管理-${dimension.label}`}
      onClose={onClose}
      footer={
        <button
          onClick={() => {
            deletedMemberIds.forEach((memberId) => onDeleteMember(memberId));
            drafts.forEach((draft) => {
              if (!draft.name.trim()) return;
              if (draft.id.startsWith('new-member-')) {
                onAddMember({
                  id: `member-${Date.now()}-${draft.id}`,
                  dimensionId: dimension.id,
                  name: draft.name.trim(),
                  aliases: splitList(draft.aliasesText),
                  valueMappings: buildValueMappings(draft),
                });
                return;
              }
              onSaveMember(draft.id, {
                name: draft.name.trim(),
                aliases: splitList(draft.aliasesText),
                valueMappings: buildValueMappings(draft),
              });
            });
            onClose();
          }}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          保存
        </button>
      }
    >
      <div className="space-y-3">
        <div className="hidden rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500 md:grid md:grid-cols-[150px_180px_1fr_44px] md:gap-3">
          <div>标准值</div>
          <div>别名</div>
          <div>数据集原始值</div>
          <div />
        </div>
        {drafts.map((draft) => (
          <div key={draft.id} className="grid gap-3 rounded-lg border border-gray-200 p-3 md:grid-cols-[150px_180px_1fr_44px]">
            <label className="text-xs text-gray-500 md:text-sm md:text-gray-700">
              <span className="md:hidden">标准值</span>
              <input
                value={draft.name}
                onChange={(event) => updateDraft(draft.id, { name: event.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none md:mt-0"
              />
            </label>
            <label className="text-xs text-gray-500 md:text-sm md:text-gray-700">
              <span className="md:hidden">别名</span>
              <textarea
                value={draft.aliasesText}
                onChange={(event) => updateDraft(draft.id, { aliasesText: event.target.value })}
                className="mt-1 min-h-20 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none md:mt-0"
                placeholder="支持逗号或换行分隔"
              />
            </label>
            <div className="space-y-2">
              {enabledBindings.length ? (
                enabledBindings.map((binding) => (
                  <div key={`${draft.id}-${binding.datasetId}`} className="block rounded-lg border border-gray-200 bg-gray-50 p-2 text-xs text-gray-600">
                    <div className="font-medium text-gray-700">{formatBindingDatasetFieldLabel(binding)}</div>
                    <RawValueSelector
                      value={draft.valueMappingTexts[binding.datasetId] ?? ''}
                      candidates={getRawValueCandidates(binding)}
                      onChange={(value) => updateDraftValueMapping(draft.id, binding.datasetId, value)}
                    />
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-4 text-center text-xs text-gray-400">
                  请先配置字段映射
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => deleteDraftMember(draft.id)}
              aria-label="删除维度值"
              title="删除维度值"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <div className="grid gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 md:grid-cols-[150px_180px_1fr_44px]">
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            placeholder="新增标准值"
          />
          <textarea
            value={newAliasesText}
            onChange={(event) => setNewAliasesText(event.target.value)}
            className="min-h-20 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            placeholder="别名"
          />
          <div className="space-y-2">
            {enabledBindings.length ? (
              enabledBindings.map((binding) => (
                <div key={`new-${binding.datasetId}`} className="block rounded-lg border border-gray-200 bg-white p-2 text-xs text-gray-600">
                  <div className="font-medium text-gray-700">{formatBindingDatasetFieldLabel(binding)}</div>
                  <RawValueSelector
                    value={newValueMappingTexts[binding.datasetId] ?? ''}
                    candidates={getRawValueCandidates(binding)}
                    onChange={(event) =>
                      setNewValueMappingTexts((current) => ({
                        ...current,
                        [binding.datasetId]: event,
                      }))
                    }
                  />
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-gray-200 bg-white px-3 py-4 text-center text-xs text-gray-400">
                请先配置字段映射
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={addDraftMember}
            aria-label="添加维度值"
            title="添加维度值"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-blue-200 bg-white text-blue-600 hover:bg-blue-50"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function RawValueSelector({
  value,
  candidates,
  onChange,
}: {
  value: string;
  candidates: string[];
  onChange: (value: string) => void;
}) {
  const selectedValue = splitList(value)[0] ?? '';
  const [query, setQuery] = useState(selectedValue);
  const [isOpen, setIsOpen] = useState(false);
  const normalizedCandidates = Array.from(
    new Set(candidates.map((candidate) => candidate.trim()).filter(Boolean)),
  );
  const filteredCandidates = normalizedCandidates
    .filter((candidate) => candidate.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 6);
  const customValue = query.trim();
  const canUseCustomValue =
    customValue && !normalizedCandidates.some((candidate) => candidate.toLowerCase() === customValue.toLowerCase());

  const selectValue = (nextValue: string) => {
    const cleanValue = nextValue.trim();
    if (!cleanValue) return;
    onChange(cleanValue);
    setQuery(cleanValue);
    setIsOpen(false);
  };

  return (
    <div className="relative mt-2">
      <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-2 py-2 focus-within:border-blue-500">
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
            if (!event.target.value.trim()) onChange('');
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setIsOpen(false)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              selectValue(query);
            }
          }}
          className="min-w-28 flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-gray-400"
          placeholder="搜索或手动添加原始值"
        />
        {selectedValue && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setQuery('');
              setIsOpen(false);
            }}
            aria-label="清空原始值"
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {isOpen && (filteredCandidates.length > 0 || canUseCustomValue) && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-44 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {filteredCandidates.map((candidate) => (
            <button
              key={candidate}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                selectValue(candidate);
              }}
              className={`block w-full px-3 py-2 text-left text-sm ${
                candidate === selectedValue
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-blue-50 hover:text-blue-700'
              }`}
            >
              {candidate}
            </button>
          ))}
          {canUseCustomValue && (
            <button
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                selectValue(customValue);
              }}
              className="block w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50"
            >
              添加“{customValue}”
            </button>
          )}
        </div>
      )}
      {!normalizedCandidates.length && !selectedValue && (
        <div className="mt-1 text-xs text-gray-400">暂无候选，可手动添加</div>
      )}
    </div>
  );
}

function formatBindingFieldLabel(binding: DimensionDatasetBinding, semanticDatasets: SemanticDataset[]) {
  const dataset = semanticDatasets.find((item) => item.id === binding.datasetId);
  const field = getDatasetFields(dataset).find((item) => item.name === binding.field);

  return field?.semanticName ? `${field.semanticName}（${field.name}）` : binding.field;
}

function getMappedDatasetNames(dimension: DimensionSemantic, semanticDatasets: SemanticDataset[]) {
  const datasetNameById = new Map(semanticDatasets.map((dataset) => [dataset.id, dataset.name]));

  return Array.from(
    new Set(dimension.bindings.map((binding) => datasetNameById.get(binding.datasetId) ?? binding.datasetId)),
  );
}

function DimensionDetailView({
  dimension,
  members,
  semanticDatasets,
  onBack,
  onEdit,
  onManageMembers,
}: {
  dimension: DimensionSemantic;
  members: DimensionMember[];
  semanticDatasets: SemanticDataset[];
  onBack: () => void;
  onEdit: () => void;
  onManageMembers: () => void;
}) {
  const isTimeDimension = dimension.type === '时间';
  const mappedDatasetNames = getMappedDatasetNames(dimension, semanticDatasets);
  const datasetNameById = new Map(semanticDatasets.map((dataset) => [dataset.id, dataset.name]));

  const renderValueMappings = (member: DimensionMember) => {
    const mappings = (member.valueMappings ?? []).filter((mapping) => mapping.enabled && mapping.rawValues.length);
    if (!mappings.length) return <span className="text-gray-400">-</span>;

    return (
      <div className="space-y-1.5">
        {mappings.map((mapping) => {
          const binding = dimension.bindings.find((item) => item.datasetId === mapping.datasetId);
          const mappingPrefix = binding
            ? `${datasetNameById.get(mapping.datasetId) ?? mapping.datasetId} - ${formatBindingFieldLabel(binding, semanticDatasets)}`
            : datasetNameById.get(mapping.datasetId) ?? mapping.datasetId;

          return (
            <div key={mapping.id} className="leading-5 text-gray-700">
              <span className="font-medium text-gray-900">{mappingPrefix}</span>
              <span className="text-gray-400"> - </span>
              {mapping.rawValues.join('、')}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <ConfigDetailHeader
        backLabel="返回维度定义"
        onBack={onBack}
        icon={Shapes}
        title={dimension.label}
        subtitle={dimension.description}
        status={
          <span className={`rounded-full px-2.5 py-1 text-xs ${isTimeDimension ? 'bg-indigo-50 text-indigo-700' : 'bg-blue-50 text-blue-700'}`}>
            {isTimeDimension ? '时间维度' : '普通维度'}
          </span>
        }
        actions={
          <>
            {!isTimeDimension && (
              <button
                type="button"
                onClick={onManageMembers}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Users className="h-4 w-4" />
                维度值管理
              </button>
            )}
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            >
              <PencilLine className="h-4 w-4" />
              编辑
            </button>
          </>
        }
        metaItems={[
          { label: '映射数据集', value: mappedDatasetNames.length ? mappedDatasetNames.join('、') : '-' },
          { label: isTimeDimension ? '时间粒度' : '维度值', value: isTimeDimension ? '-' : members.map((member) => member.name).join('、') || '-' },
        ]}
      />

      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="space-y-5">
          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-base font-semibold text-gray-900">维度名称同义词</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {dimension.synonyms.length ? (
                dimension.synonyms.map((synonym) => (
                  <span key={synonym} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                    {synonym}
                  </span>
                ))
              ) : (
                <span className="text-sm text-gray-400">未配置</span>
              )}
            </div>
          </section>

          {isTimeDimension && (
            <section className="rounded-lg border border-indigo-100 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-base font-semibold text-gray-900">
                <Clock3 className="h-4 w-4 text-indigo-600" />
                时间配置
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <div className="text-xs font-medium text-gray-500">时间角色</div>
                  <div className="mt-1 text-sm text-gray-900">{dimension.timeConfig?.fieldRole ?? '-'}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-500">支持粒度</div>
                  <div className="mt-1 text-sm text-gray-900">
                    {(dimension.timeConfig?.supportedGrains ?? []).join(' / ') || '-'}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-500">相对时间预设</div>
                  <div className="mt-1 text-sm text-gray-900">
                    {(dimension.timeConfig?.relativePresets ?? []).join('、') || '-'}
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-base font-semibold text-gray-900">字段映射</div>
            <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full min-w-[640px]">
                <thead className="bg-gray-50 text-left text-xs text-gray-500">
                  <tr>
                    <th className="px-4 py-2">数据集</th>
                    <th className="px-4 py-2">字段</th>
                    <th className="px-4 py-2">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {dimension.bindings.length ? (
                    dimension.bindings.map((binding) => (
                      <tr key={binding.id} className="text-sm text-gray-700">
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {datasetNameById.get(binding.datasetId) ?? binding.datasetId}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{formatBindingFieldLabel(binding, semanticDatasets)}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs ${binding.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                            {binding.enabled ? '已启用' : '已停用'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-400">
                        暂无映射字段
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-base font-semibold text-gray-900">维度值</div>

            {isTimeDimension ? (
              <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/60 px-4 py-8 text-center text-sm text-indigo-700">
                {(dimension.timeConfig?.supportedGrains ?? []).join(' / ') || '暂无时间粒度'}
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full min-w-[620px]">
                  <thead className="bg-gray-50 text-left text-xs text-gray-500">
                    <tr>
                      <th className="px-4 py-2">标准值</th>
                      <th className="px-4 py-2">别名</th>
                      <th className="px-4 py-2">原始值映射</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {members.length ? (
                      members.map((member) => (
                        <tr key={member.id} className="text-sm">
                          <td className="px-4 py-3 font-medium text-gray-900">{member.name}</td>
                          <td className="px-4 py-3">
                            {member.aliases.length ? (
                              <div className="flex flex-wrap gap-1.5">
                                {member.aliases.map((alias) => (
                                  <span key={alias} className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">
                                    {alias}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">{renderValueMappings(member)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-4 py-10 text-center text-sm text-gray-400">
                          暂无维度值
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

type SemanticModelProps = {
  embeddedTab?: TabKey;
  selectedDatasetId?: string | null;
  onSelectTab?: (tab: TabKey) => void;
  onViewDataset?: (datasetId: string) => void;
  onViewIndicator?: (indicatorId: string) => void;
  onEditDataset?: (datasetId: string) => void;
  onEditIndicator?: (indicatorId: string) => void;
};

export default function SemanticModel({
  embeddedTab,
  selectedDatasetId,
  onSelectTab,
  onViewDataset,
  onViewIndicator,
  onEditDataset,
  onEditIndicator,
}: SemanticModelProps = {}) {
  const {
    semanticDatasets,
    indicatorAssets,
    dimensionSemantics,
    dimensionMembers,
    addDimensionSemantic,
    updateDimensionSemantic,
    deleteDimensionSemantic,
    addDimensionMember,
    updateDimensionMember,
    deleteDimensionMember,
  } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const tabParam = params.get('tab');
  const activeTab: TabKey = embeddedTab ?? (isTabKey(tabParam) ? tabParam : 'datasets');
  const queryDatasetId = selectedDatasetId ?? params.get('datasetId');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [dimensionDatasetFilter, setDimensionDatasetFilter] = useState('all');
  const [dimensionTypeFilter, setDimensionTypeFilter] = useState<'all' | DimensionSemantic['type']>('all');
  const [dimensionPage, setDimensionPage] = useState(1);
  const [activeDimensionId, setActiveDimensionId] = useState<string | null>(null);
  const [editingDimension, setEditingDimension] = useState<DimensionSemantic | null>(null);
  const [isCreateDimensionOpen, setIsCreateDimensionOpen] = useState(false);
  const [membersDimension, setMembersDimension] = useState<DimensionSemantic | null>(null);
  const [deleteDialogState, setDeleteDialogState] = useState<DimensionDeleteDialogState | null>(null);
  const [synonymTypeFilter, setSynonymTypeFilter] = useState('all');
  const [synonymRiskFilter, setSynonymRiskFilter] = useState<SynonymRiskFilter>('all');
  const [synonymPage, setSynonymPage] = useState(1);
  const [activeSynonymRecordKey, setActiveSynonymRecordKey] = useState<string | null>(null);
  const [synonymSortMode] = useState<SynonymSortMode>('risk');

  useEffect(() => {
    if (embeddedTab) return;
    if (tabParam && !isTabKey(tabParam)) {
      const datasetQuery = queryDatasetId ? `&datasetId=${queryDatasetId}` : '';
      navigate(`/semantic?tab=datasets${datasetQuery}`, { replace: true });
    }
  }, [embeddedTab, navigate, queryDatasetId, tabParam]);

  const keyword = searchKeyword.trim().toLowerCase();
  const datasetNameById = useMemo(
    () => new Map(semanticDatasets.map((dataset) => [dataset.id, dataset.name])),
    [semanticDatasets],
  );

  const setTab = (tab: TabKey) => {
    if (onSelectTab) {
      onSelectTab(tab);
      return;
    }
    navigate(`/semantic?tab=${tab}`);
  };
  const viewDataset = onViewDataset ?? ((datasetId: string) => navigate(`/semantic?tab=datasets&datasetId=${datasetId}`));
  const editDataset = onEditDataset ?? viewDataset;
  const backToDatasetList = () => {
    if (onSelectTab) {
      onSelectTab('datasets');
      return;
    }
    navigate('/semantic?tab=datasets');
  };
  const viewIndicator = onViewIndicator ?? ((indicatorId: string) => navigate(`/indicator/${indicatorId}`));
  const editIndicator = onEditIndicator ?? viewIndicator;

  const filteredDimensions = useMemo(
    () =>
      dimensionSemantics.filter((dimension) => {
        const matchesDataset =
          dimensionDatasetFilter === 'all' ||
          dimension.bindings.some((binding) => binding.datasetId === dimensionDatasetFilter);
        const matchesType = dimensionTypeFilter === 'all' || dimension.type === dimensionTypeFilter;
        const members = dimensionMembers.filter((member) => member.dimensionId === dimension.id);
        const bindingText = dimension.bindings.flatMap((binding) => [
          datasetNameById.get(binding.datasetId) ?? binding.datasetId,
          binding.field,
          binding.memberSource ?? '',
        ]);
        const timeText = dimension.timeConfig
          ? [dimension.timeConfig.fieldRole, ...dimension.timeConfig.supportedGrains, ...dimension.timeConfig.relativePresets]
          : [];
        const matchesKeyword = [
          dimension.label,
          dimension.description,
          dimension.type,
          ...dimension.synonyms,
          ...bindingText,
          ...timeText,
          ...members.flatMap((member) => [
            member.name,
            ...member.aliases,
            ...(member.valueMappings?.flatMap((mapping) => mapping.rawValues) ?? []),
          ]),
        ]
          .join(' ')
          .toLowerCase()
          .includes(keyword);

        return matchesDataset && matchesType && matchesKeyword;
      }),
    [datasetNameById, dimensionDatasetFilter, dimensionMembers, dimensionSemantics, dimensionTypeFilter, keyword],
  );
  const dimensionTotalPages = Math.max(1, Math.ceil(filteredDimensions.length / dimensionPageSize));
  const paginatedDimensions = useMemo(() => {
    const start = (dimensionPage - 1) * dimensionPageSize;
    return filteredDimensions.slice(start, start + dimensionPageSize);
  }, [dimensionPage, filteredDimensions]);

  useEffect(() => {
    setDimensionPage(1);
  }, [dimensionDatasetFilter, dimensionTypeFilter, searchKeyword]);

  useEffect(() => {
    setDimensionPage((current) => Math.min(current, dimensionTotalPages));
  }, [dimensionTotalPages]);

  const detailDimension = activeDimensionId
    ? dimensionSemantics.find((dimension) => dimension.id === activeDimensionId)
    : null;
  const detailDimensionMembers = detailDimension
    ? dimensionMembers.filter((member) => member.dimensionId === detailDimension.id)
    : [];

  useEffect(() => {
    if (activeDimensionId && !dimensionSemantics.some((dimension) => dimension.id === activeDimensionId)) {
      setActiveDimensionId(null);
    }
  }, [activeDimensionId, dimensionSemantics]);

  const handleDeleteDimension = (dimension: DimensionSemantic) => {
    const memberCount = dimensionMembers.filter((member) => member.dimensionId === dimension.id).length;
    setDeleteDialogState({
      dimension,
      memberCount,
      bindingCount: dimension.bindings.length,
    });
  };

  const confirmDeleteDimension = () => {
    if (!deleteDialogState) return;
    deleteDimensionSemantic(deleteDialogState.dimension.id);
    if (activeDimensionId === deleteDialogState.dimension.id) {
      setActiveDimensionId(null);
    }
    setDeleteDialogState(null);
  };

  const openSynonymEditor = (record: SynonymRecord) => {
    setActiveSynonymRecordKey(null);
    if (record.editTarget === 'indicator') {
      editIndicator(record.id);
    } else if (record.editTarget === 'dimension') {
      const dimension = dimensionSemantics.find((item) => item.id === record.id);
      if (dimension) {
        setTab('dimensions');
        setEditingDimension(dimension);
      }
    } else if (record.editTarget === 'member') {
      const dimension = dimensionSemantics.find((item) => item.id === record.dimensionId);
      if (dimension) {
        setTab('dimensions');
        setMembersDimension(dimension);
      }
    } else if (record.editTarget === 'dataset') {
      editDataset(record.id);
    }
  };

  const synonymRecords: SynonymRecord[] = [
    ...indicatorAssets.map((indicator) => ({
      id: indicator.id,
      type: '指标',
      module: '指标市场',
      name: indicator.name,
      aliases: indicator.synonyms,
      description: indicator.businessDefinition,
      editTarget: 'indicator',
    })),
    ...dimensionSemantics.map((dimension) => ({
      id: dimension.id,
      type: dimension.type === '时间' ? '时间维度' : '普通维度',
      module: '维度定义',
      name: dimension.label,
      aliases: dimension.synonyms,
      description: dimension.description,
      editTarget: 'dimension',
    })),
    ...dimensionMembers.map((member) => {
      const dimension = dimensionSemantics.find((item) => item.id === member.dimensionId);
      if (!dimension) return null;

      return {
        id: member.id,
        type: '维度值别名',
        module: '维度定义',
        name: `${dimension.label}=${member.name}`,
        aliases: member.aliases,
        description: dimension.label,
        editTarget: 'member',
        dimensionId: member.dimensionId,
      };
    }).filter((record): record is Exclude<typeof record, null> => Boolean(record)),
    ...semanticDatasets.map((dataset) => ({
      id: dataset.id,
      type: '数据集主题',
      module: '数据集',
      name: dataset.name,
      aliases: dataset.synonyms,
      description: dataset.businessTheme,
      editTarget: 'dataset',
    })),
  ];
  const aliasConflicts = buildAliasConflicts(synonymRecords);
  const synonymRows = useMemo<SynonymRow[]>(
    () =>
      synonymRecords.map((record) => {
        const conflicts = getRecordConflicts(record, aliasConflicts);
        const highestRisk = getHighestRisk(conflicts);
        const sortedConflicts = [...conflicts].sort(
          (first, second) => synonymRiskRank[first.risk] - synonymRiskRank[second.risk],
        );

        return {
          key: getSynonymRecordKey(record),
          record,
          conflicts,
          highestRisk,
          riskValue: highestRisk ?? 'none',
          conflictAliasKeys: new Set(conflicts.map((conflict) => conflict.aliasKey)),
          topConflict: sortedConflicts[0],
        };
      }),
    [aliasConflicts, synonymRecords],
  );
  const synonymRiskStats = synonymRows.reduce<Record<ConflictRisk | 'none', number>>(
    (stats, row) => ({
      ...stats,
      [row.riskValue]: stats[row.riskValue] + 1,
    }),
    { 高: 0, 中: 0, 低: 0, none: 0 },
  );
  const filteredSynonymRows = useMemo(() => {
    const rows = synonymRows.filter((row) => {
      const { record, conflicts } = row;
      const matchesType = synonymTypeFilter === 'all' || record.type === synonymTypeFilter;
      const conflictText = conflicts.flatMap((conflict) => [
        conflict.alias,
        conflict.conflictType,
        `${conflict.risk}风险`,
        ...conflict.records.flatMap((item) => [formatConflictTarget(item), item.type, item.module]),
      ]);
      const matchesKeyword = [record.type, record.module, record.name, record.description, ...record.aliases, ...conflictText]
        .join(' ')
        .toLowerCase()
        .includes(keyword);
      const matchesRisk = synonymRiskFilter === 'all' || row.riskValue === synonymRiskFilter;

      return matchesType && matchesRisk && matchesKeyword;
    });

    if (synonymSortMode === 'risk') {
      return [...rows].sort((first, second) => {
        const riskOrder = synonymRiskRank[first.riskValue] - synonymRiskRank[second.riskValue];
        if (riskOrder !== 0) return riskOrder;
        const conflictOrder = second.conflicts.length - first.conflicts.length;
        if (conflictOrder !== 0) return conflictOrder;
        return first.record.name.localeCompare(second.record.name, 'zh-Hans-CN');
      });
    }

    return rows;
  }, [keyword, synonymRiskFilter, synonymRows, synonymSortMode, synonymTypeFilter]);
  const activeSynonymRow = activeSynonymRecordKey
    ? synonymRows.find((row) => row.key === activeSynonymRecordKey) ?? null
    : null;
  const hasSynonymFilters = synonymTypeFilter !== 'all' || synonymRiskFilter !== 'all' || Boolean(searchKeyword.trim());
  const synonymTotalPages = Math.max(1, Math.ceil(filteredSynonymRows.length / synonymPageSize));
  const paginatedSynonymRows = useMemo(() => {
    const start = (synonymPage - 1) * synonymPageSize;
    return filteredSynonymRows.slice(start, start + synonymPageSize);
  }, [filteredSynonymRows, synonymPage]);

  useEffect(() => {
    setSynonymPage(1);
  }, [searchKeyword, synonymRiskFilter, synonymTypeFilter]);

  useEffect(() => {
    setSynonymPage((current) => Math.min(current, synonymTotalPages));
  }, [synonymTotalPages]);

  const searchPlaceholder =
    activeTab === 'dimensions'
      ? '搜索维度名称、同义词或字段'
      : activeTab === 'synonyms'
        ? '搜索同义词'
        : '搜索数据集';

  return (
    <div className={`flex h-full min-h-0 flex-1 overflow-hidden ${embeddedTab ? '' : 'bg-gray-50'}`}>
      {!embeddedTab && (
      <aside className="h-full min-h-0 w-60 shrink-0 overflow-y-auto border-r border-gray-200 bg-white p-3">
        <div className="px-2 py-2">
          <div className="text-base font-semibold text-gray-900">语义模型</div>
          <div className="mt-1 text-xs text-gray-500">让问数理解数据含义</div>
        </div>

        <nav className="mt-3 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setTab(tab.id)}
                className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors ${
                  active ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                      active ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-600'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className={`text-sm font-medium ${active ? 'text-blue-700' : 'text-gray-900'}`}>
                      {tab.label}
                    </div>
                    {tab.description && <div className="mt-0.5 text-xs text-gray-500">{tab.description}</div>}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>
      </aside>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {activeTab === 'datasets' && (
            <DatasetManagement
              embedded
              selectedDatasetId={queryDatasetId}
              onBackToList={backToDatasetList}
              onViewDataset={viewDataset}
              onViewIndicator={viewIndicator}
            />
          )}

          {activeTab === 'dimensions' && (
            detailDimension ? (
              <DimensionDetailView
                dimension={detailDimension}
                members={detailDimensionMembers}
                semanticDatasets={semanticDatasets}
                onBack={() => setActiveDimensionId(null)}
                onEdit={() => setEditingDimension(detailDimension)}
                onManageMembers={() => setMembersDimension(detailDimension)}
              />
            ) : (
              <div className="space-y-4 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">维度定义</h1>
                  <div className="mt-1 text-sm text-gray-500">
                    管理业务维度、同义词和字段映射。
                  </div>
                </div>
                <button
                  onClick={() => setIsCreateDimensionOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                  新建维度
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-start gap-3">
                <label className="inline-flex w-full items-center gap-2 sm:w-auto">
                  <span className="whitespace-nowrap text-sm text-gray-500">数据集</span>
                  <select
                    value={dimensionDatasetFilter}
                    onChange={(event) => setDimensionDatasetFilter(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none sm:w-auto"
                  >
                    <option value="all">全部</option>
                    {semanticDatasets.map((dataset) => (
                      <option key={dataset.id} value={dataset.id}>
                        {dataset.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="inline-flex w-full items-center gap-2 sm:w-auto">
                  <span className="whitespace-nowrap text-sm text-gray-500">维度类型</span>
                  <select
                    value={dimensionTypeFilter}
                    onChange={(event) => setDimensionTypeFilter(event.target.value as typeof dimensionTypeFilter)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none sm:w-auto"
                  >
                    <option value="all">全部</option>
                    {dimensionTypes.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="relative w-full min-w-[280px] sm:w-[420px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={searchKeyword}
                    onChange={(event) => setSearchKeyword(event.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1120px]">
                    <thead className="bg-gray-50">
                      <tr className="border-b border-gray-200 text-left text-sm font-medium text-gray-600">
                        <th className="px-6 py-3">维度名称</th>
                        <th className="px-6 py-3">同义词</th>
                        <th className="px-6 py-3">映射数据集</th>
                        <th className="px-6 py-3">维度值</th>
                        <th className="sticky right-0 z-20 bg-gray-50 px-6 py-3 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]">
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginatedDimensions.map((dimension) => {
                        const members = dimensionMembers.filter((member) => member.dimensionId === dimension.id);
                        const isTimeDimension = dimension.type === '时间';
                        const mappedDatasetNames = getMappedDatasetNames(dimension, semanticDatasets);

                        return (
                          <tr
                            key={dimension.id}
                            onClick={() => setActiveDimensionId(dimension.id)}
                            className="group cursor-pointer text-sm text-gray-700 transition-colors hover:bg-gray-50"
                          >
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-gray-900">{dimension.label}</span>
                                <span className={`rounded px-2 py-1 text-xs ${isTimeDimension ? 'bg-indigo-50 text-indigo-700' : 'bg-blue-50 text-blue-700'}`}>
                                  {isTimeDimension ? '时间维度' : '普通维度'}
                                </span>
                              </div>
                              <div className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">
                                {dimension.description}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {dimension.synonyms.length ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {dimension.synonyms.slice(0, 2).map((synonym) => (
                                    <span key={synonym} className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">
                                      {synonym}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-400">未配置</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {mappedDatasetNames.length ? (
                                <div className="flex flex-wrap gap-1.5">
                                  {mappedDatasetNames.slice(0, 2).map((name) => (
                                    <span key={name} className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">
                                      {name}
                                    </span>
                                  ))}
                                  {mappedDatasetNames.length > 2 && (
                                    <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">
                                      +{mappedDatasetNames.length - 2}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400">未覆盖数据集</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {isTimeDimension ? (
                                <span className="text-gray-400">-</span>
                              ) : (
                                <span className="text-gray-900">{members.length}</span>
                              )}
                            </td>
                            <td className="sticky right-0 z-10 bg-white px-6 py-4 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)] group-hover:bg-gray-50">
                              <div className="flex items-center gap-1 whitespace-nowrap">
                                <ConfigActionIconButton
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setActiveDimensionId(dimension.id);
                                  }}
                                  icon={Eye}
                                  label="查看详情"
                                  variant="view"
                                />
                                <ConfigActionIconButton
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setEditingDimension(dimension);
                                  }}
                                  icon={PencilLine}
                                  label="编辑维度"
                                  variant="edit"
                                />
                                {!isTimeDimension && (
                                  <ConfigActionIconButton
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setMembersDimension(dimension);
                                    }}
                                    icon={Users}
                                    label="维度值管理"
                                    variant="neutral"
                                  />
                                )}
                                <ConfigActionIconButton
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleDeleteDimension(dimension);
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
                      {!filteredDimensions.length && (
                        <tr>
                          <td colSpan={5} className="px-6 py-16 text-center text-sm text-gray-500">
                            未找到匹配的维度
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-1 pt-3 text-sm text-gray-500">
                <div>
                  共 {filteredDimensions.length} 条，每页 {dimensionPageSize} 条
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setDimensionPage((page) => Math.max(1, page - 1))}
                    disabled={dimensionPage === 1}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:border-gray-100 disabled:text-gray-300"
                    aria-label="上一页"
                    title="上一页"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: dimensionTotalPages }, (_, index) => index + 1).map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setDimensionPage(page)}
                      className={`h-8 min-w-8 rounded-md border px-2 text-sm transition-colors ${
                        dimensionPage === page
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:text-blue-600'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setDimensionPage((page) => Math.min(dimensionTotalPages, page + 1))}
                    disabled={dimensionPage === dimensionTotalPages}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:border-gray-100 disabled:text-gray-300"
                    aria-label="下一页"
                    title="下一页"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              </div>
            )
          )}

          {activeTab === 'synonyms' && (
            <div className="space-y-4 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">同义词治理</h1>
                  <div className="mt-1 text-sm text-gray-500">
                    汇总同义词和别名，发现冲突后回到归属模块维护。
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    {
                      label: '高风险',
                      value: '高' as const,
                      count: synonymRiskStats.高,
                      baseClassName: 'border border-red-200 bg-red-50 text-red-700',
                      activeClassName: 'border-red-300 bg-red-100 text-red-800 shadow-sm',
                    },
                    {
                      label: '中风险',
                      value: '中' as const,
                      count: synonymRiskStats.中,
                      baseClassName: 'border border-amber-200 bg-amber-50 text-amber-700',
                      activeClassName: 'border-amber-300 bg-amber-100 text-amber-800 shadow-sm',
                    },
                    {
                      label: '低风险',
                      value: '低' as const,
                      count: synonymRiskStats.低,
                      baseClassName: 'border border-gray-200 bg-gray-100 text-gray-600',
                      activeClassName: 'border-gray-300 bg-gray-200 text-gray-800 shadow-sm',
                    },
                    {
                      label: '无风险',
                      value: 'none' as const,
                      count: synonymRiskStats.none,
                      baseClassName: 'border border-emerald-200 bg-emerald-50 text-emerald-700',
                      activeClassName: 'border-emerald-300 bg-emerald-100 text-emerald-800 shadow-sm',
                    },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setSynonymRiskFilter(item.value)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        synonymRiskFilter === item.value ? item.activeClassName : item.baseClassName
                      }`}
                    >
                      <span>{item.label}</span>
                      <span>{item.count}</span>
                    </button>
                  ))}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label="风险等级说明"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      >
                        <CircleHelp className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent sideOffset={8} className="max-w-80 bg-gray-900 text-left text-white">
                      <div className="space-y-1">
                        <div>高风险：指标 vs 指标、普通维度/时间维度 vs 普通维度/时间维度、维度值别名 vs 维度值别名、普通维度/时间维度 vs 维度值别名。</div>
                        <div>中风险：指标 vs 数据集主题、普通维度/时间维度 vs 数据集主题。</div>
                        <div>低风险：其他混合冲突或主要影响治理整洁度的重复。</div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>

              <div className="sticky top-0 z-20 -mx-1 bg-gray-50/95 px-1 py-3 backdrop-blur">
                <div className="flex flex-wrap items-center justify-start gap-3">
                  <label className="inline-flex w-full items-center gap-2 sm:w-auto">
                    <span className="whitespace-nowrap text-sm text-gray-500">对象类型</span>
                    <select
                      value={synonymTypeFilter}
                      onChange={(event) => setSynonymTypeFilter(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none sm:w-auto"
                    >
                      <option value="all">全部</option>
                      {synonymRecordTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="inline-flex w-full items-center gap-2 sm:w-auto">
                    <span className="whitespace-nowrap text-sm text-gray-500">风险程度</span>
                    <select
                      value={synonymRiskFilter}
                      onChange={(event) => setSynonymRiskFilter(event.target.value as SynonymRiskFilter)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none sm:w-auto"
                    >
                      <option value="all">全部</option>
                      <option value="高">高风险</option>
                      <option value="中">中风险</option>
                      <option value="低">低风险</option>
                      <option value="none">无风险</option>
                    </select>
                  </label>
                  <div className="relative w-full min-w-[280px] sm:w-[420px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      value={searchKeyword}
                      onChange={(event) => setSearchKeyword(event.target.value)}
                      placeholder={searchPlaceholder}
                      className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  {hasSynonymFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchKeyword('');
                        setSynonymTypeFilter('all');
                        setSynonymRiskFilter('all');
                      }}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                    >
                      清空筛选
                    </button>
                  )}
                </div>
              </div>

              <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1180px]">
                    <thead className="bg-gray-50">
                      <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-600">
                        <th className="px-4 py-3">对象名称</th>
                        <th className="w-[110px] px-4 py-3">对象类型</th>
                        <th className="w-[110px] px-4 py-3">来源模块</th>
                        <th className="w-[100px] px-4 py-3">风险等级</th>
                        <th className="w-[300px] px-4 py-3">同义词/别名</th>
                        <th className="w-[88px] whitespace-nowrap px-4 py-3">冲突数</th>
                        <th className="w-[220px] whitespace-nowrap px-4 py-3">冲突摘要</th>
                        <th className="sticky right-0 z-20 bg-gray-50 px-4 py-3 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]">
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginatedSynonymRows.map((row) => {
                        const { record } = row;

                        return (
                          <tr
                            key={row.key}
                            onClick={() => setActiveSynonymRecordKey(row.key)}
                            className="group cursor-pointer text-sm text-gray-700 transition-colors hover:bg-gray-50"
                          >
                            <td className="max-w-[220px] px-4 py-3">
                              <div className="truncate font-medium text-gray-900">{record.name}</div>
                              <div className="mt-1 line-clamp-1 text-xs text-gray-500">{record.description}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex whitespace-nowrap rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700">
                                {record.type}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex whitespace-nowrap rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-600">
                                {record.module}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs ring-1 ${getRiskBadgeClass(row.highestRisk)}`}>
                                {getRiskLabel(row.highestRisk)}
                              </span>
                            </td>
                            <td className="max-w-[300px] px-4 py-3">
                              {record.aliases.length ? (
                                <div className="flex max-w-full flex-nowrap gap-1.5 overflow-hidden">
                                  {record.aliases.slice(0, 3).map((alias) => (
                                    <span
                                      key={`${row.key}-${alias}`}
                                      className={`inline-block max-w-[92px] shrink-0 truncate whitespace-nowrap rounded px-2 py-1 text-xs ${
                                        row.conflictAliasKeys.has(normalizeAliasKey(alias))
                                          ? 'bg-amber-50 text-amber-700'
                                          : 'bg-gray-100 text-gray-600'
                                      }`}
                                    >
                                      {alias}
                                    </span>
                                  ))}
                                  {record.aliases.length > 3 && (
                                    <span className="shrink-0 whitespace-nowrap rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">
                                      +{record.aliases.length - 3}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-400">未配置</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-medium text-gray-900">{row.conflicts.length}</span>
                            </td>
                            <td className="max-w-[300px] px-4 py-3">
                              {row.topConflict ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="truncate text-gray-700">
                                      {row.topConflict.alias} · {row.topConflict.conflictType}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent sideOffset={8} className="max-w-96 bg-gray-900 text-left text-white">
                                    {row.topConflict.alias} · {row.topConflict.conflictType}
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="text-gray-400">无冲突</span>
                              )}
                            </td>
                            <td className="sticky right-0 z-10 bg-white px-4 py-3 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)] group-hover:bg-gray-50">
                              <div className="flex items-center gap-2 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setActiveSynonymRecordKey(row.key);
                                  }}
                                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                                >
                                  查看详情
                                </button>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openSynonymEditor(record);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg border border-blue-200 px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-50"
                                >
                                  去编辑
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {!filteredSynonymRows.length && (
                        <tr>
                          <td colSpan={8} className="px-6 py-16 text-center text-sm text-gray-500">
                            <div>未找到匹配同义词</div>
                            {hasSynonymFilters && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSearchKeyword('');
                                  setSynonymTypeFilter('all');
                                  setSynonymRiskFilter('all');
                                }}
                                className="mt-3 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                              >
                                清空筛选
                              </button>
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-1 pt-3 text-sm text-gray-500">
                <div>
                  共 {filteredSynonymRows.length} 条，每页 {synonymPageSize} 条
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSynonymPage((page) => Math.max(1, page - 1))}
                    disabled={synonymPage === 1}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:border-gray-100 disabled:text-gray-300"
                    aria-label="上一页"
                    title="上一页"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: synonymTotalPages }, (_, index) => index + 1).map((page) => (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setSynonymPage(page)}
                      className={`h-8 min-w-8 rounded-md border px-2 text-sm transition-colors ${
                        synonymPage === page
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:text-blue-600'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSynonymPage((page) => Math.min(synonymTotalPages, page + 1))}
                    disabled={synonymPage === synonymTotalPages}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:border-gray-100 disabled:text-gray-300"
                    aria-label="下一页"
                    title="下一页"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {activeSynonymRow && (
                <div className="fixed inset-0 z-50 flex justify-end bg-black/20">
                  <button
                    type="button"
                    aria-label="关闭同义词详情"
                    className="hidden flex-1 cursor-default md:block"
                    onClick={() => setActiveSynonymRecordKey(null)}
                  />
                  <aside className="flex h-full w-full max-w-[640px] flex-col bg-white shadow-2xl md:w-[56vw]">
                    <div className="border-b border-gray-200 px-6 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-lg font-semibold text-gray-900">{activeSynonymRow.record.name}</h2>
                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700">
                              {activeSynonymRow.record.type}
                            </span>
                            <span className={`rounded-full px-2.5 py-1 text-xs ring-1 ${getRiskBadgeClass(activeSynonymRow.highestRisk)}`}>
                              {getRiskLabel(activeSynonymRow.highestRisk)}
                            </span>
                          </div>
                          <div className="mt-2 text-sm text-gray-500">{activeSynonymRow.record.module}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveSynonymRecordKey(null)}
                          className="rounded p-2 text-gray-500 hover:bg-gray-100"
                          aria-label="关闭"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5 text-sm">
                      <section>
                        <div className="text-xs font-medium text-gray-500">基础信息</div>
                        <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 leading-6 text-gray-700">
                          {activeSynonymRow.record.description || '未配置描述'}
                        </div>
                      </section>

                      <section>
                        <div className="text-xs font-medium text-gray-500">同义词/别名</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {activeSynonymRow.record.aliases.length ? (
                            activeSynonymRow.record.aliases.map((alias) => (
                              <span
                                key={`${activeSynonymRow.key}-${alias}`}
                                className={`rounded-full px-2.5 py-1 text-xs ${
                                  activeSynonymRow.conflictAliasKeys.has(normalizeAliasKey(alias))
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {alias}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400">未配置</span>
                          )}
                        </div>
                      </section>

                      <section>
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs font-medium text-gray-500">冲突明细</div>
                          <span className="text-xs text-gray-400">{activeSynonymRow.conflicts.length} 项</span>
                        </div>
                        <div className="mt-2 space-y-3">
                          {activeSynonymRow.conflicts.length ? (
                            activeSynonymRow.conflicts.map((conflict) => (
                              <div key={`${activeSynonymRow.key}-${conflict.aliasKey}`} className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-medium">冲突词：{conflict.alias}</span>
                                  <span className={`rounded-full px-2 py-0.5 ring-1 ${getRiskBadgeClass(conflict.risk)}`}>
                                    {conflict.risk}风险
                                  </span>
                                </div>
                                <div className="mt-2 text-amber-900">冲突类型：{conflict.conflictType}</div>
                                <div className="mt-2 leading-5">
                                  涉及对象：
                                  {conflict.records.map((item) => `${formatConflictTarget(item)}（${item.type}）`).join('、')}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-6 text-center text-xs text-gray-400">
                              无冲突
                            </div>
                          )}
                        </div>
                      </section>

                      <section>
                        <div className="text-xs font-medium text-gray-500">涉及对象</div>
                        <div className="mt-2 grid gap-2">
                          {activeSynonymRow.conflicts.length ? (
                            Array.from(
                              new Map(
                                activeSynonymRow.conflicts
                                  .flatMap((conflict) => conflict.records)
                                  .map((record) => [getSynonymRecordKey(record), record]),
                              ).values(),
                            ).map((record) => (
                              <div key={getSynonymRecordKey(record)} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium text-gray-900">{formatConflictTarget(record)}</div>
                                  <div className="mt-1 text-xs text-gray-500">{record.module}</div>
                                </div>
                                <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700">{record.type}</span>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-500">
                              当前对象没有关联冲突对象。
                            </div>
                          )}
                        </div>
                      </section>

                      <section>
                        <div className="text-xs font-medium text-gray-500">处理建议</div>
                        <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 leading-6 text-blue-900">
                          {getSynonymSuggestion(activeSynonymRow)}
                        </div>
                      </section>
                    </div>

                    <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
                      <button
                        type="button"
                        onClick={() => setActiveSynonymRecordKey(null)}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        关闭
                      </button>
                      <button
                        type="button"
                        onClick={() => openSynonymEditor(activeSynonymRow.record)}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                      >
                        去编辑
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </aside>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {isCreateDimensionOpen && (
        <DimensionEditorModal
          semanticDatasets={semanticDatasets}
          onClose={() => setIsCreateDimensionOpen(false)}
          onSubmit={(dimension) => {
            addDimensionSemantic(dimension);
            setIsCreateDimensionOpen(false);
          }}
        />
      )}
      {editingDimension && (
        <DimensionEditorModal
          dimension={editingDimension}
          semanticDatasets={semanticDatasets}
          onClose={() => setEditingDimension(null)}
          onSubmit={(dimension) => {
            updateDimensionSemantic(editingDimension.id, dimension);
            setEditingDimension(null);
          }}
        />
      )}
      {membersDimension && (
        <DimensionMembersModal
          dimension={membersDimension}
          members={dimensionMembers.filter((member) => member.dimensionId === membersDimension.id)}
          semanticDatasets={semanticDatasets}
          onClose={() => setMembersDimension(null)}
          onSaveMember={updateDimensionMember}
          onAddMember={addDimensionMember}
          onDeleteMember={deleteDimensionMember}
        />
      )}
      {deleteDialogState && (
        <DimensionDeleteDialog
          state={deleteDialogState}
          onClose={() => setDeleteDialogState(null)}
          onConfirm={confirmDeleteDimension}
        />
      )}
    </div>
  );
}
