import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Eye, Plus, Save, Trash2 } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { Agent, AgentBehaviorConfig, AgentFieldAccessLevel, AgentResultVisibilityConfig, AgentType, ReportTemplate, Skill } from '../types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

const defaultAgentByType: Record<AgentType, Pick<Agent, 'capabilitySummary' | 'description'>> = {
  ask: {
    description: '面向经营分析的语义问答 Agent。',
    capabilitySummary: '自动调用已配置 Skills 完成语义问答和经营分析。',
  },
  report: {
    description: '面向日报、周报、月报和专题分析的报告 Agent。',
    capabilitySummary: '自动生成 BI 看板、分析结论和推送配置。',
  },
  rca: {
    description: '面向指标波动和经营诊断的深度分析 Agent。',
    capabilitySummary: '自动下钻维度贡献、时间变化和异常分组。',
  },
};

const agentTypeLabel: Record<AgentType, string> = {
  ask: '问数 Agent',
  report: '报告 Agent',
  rca: '深度分析 Agent',
};

const defaultDatasetIdsByType: Record<AgentType, string[]> = {
  ask: ['semantic-outpatient'],
  report: ['semantic-outpatient', 'semantic-inpatient'],
  rca: ['semantic-outpatient', 'semantic-inpatient'],
};

const defaultBehaviorByType: Record<AgentType, AgentBehaviorConfig> = {
  ask: {
    roleDefinition: '作为医疗经营问数专家，围绕用户问题识别指标、维度、时间范围和经营口径。',
    answerPrinciples: '优先使用已发布指标和语义模型，先给结论，再说明口径、数据范围和可继续追问方向。',
    clarificationPolicy: '当时间范围、业务对象或指标口径不明确时，优先使用默认口径并在回答中说明；低置信度时先追问。',
    forbiddenTopics: '不得编造不存在的数据、不得输出患者隐私明细、不得绕过权限解释敏感字段。',
    outputFormat: '结论摘要 + 指标卡 + 图表 + 口径说明 + 推荐追问。',
  },
  report: {
    roleDefinition: '作为经营报告生成专家，按模板组织指标、图表、异常提示和管理层摘要。',
    answerPrinciples: '优先保证报告结构完整、指标口径一致，并突出异常项、贡献项和可执行建议。',
    clarificationPolicy: '报告周期或主题不明确时，先根据默认模板生成候选报告，并提示可调整周期和主题。',
    forbiddenTopics: '不得生成未授权导出的患者级明细，不得使用未发布指标作为正式结论。',
    outputFormat: '报告标题 + 周期 + 核心摘要 + 指标卡 + 图表 + 异常提示 + 导出入口。',
  },
  rca: {
    roleDefinition: '作为经营诊断和深度分析专家，围绕异常指标逐层下钻并输出候选根因。',
    answerPrinciples: '先定位异常，再按时间、科室、病种、费用组等维度拆解贡献，并给出证据链。',
    clarificationPolicy: '缺少目标指标或对比基线时，先追问；可推断时需标注默认基线。',
    forbiddenTopics: '不得把相关性直接表述为确定因果，不得展示未脱敏的患者级证据。',
    outputFormat: '异常概览 + 维度贡献 + 候选根因 + 证据链 + 后续验证建议。',
  },
};

const behaviorConfigToPrompt = (config: AgentBehaviorConfig) =>
  [
    config.roleDefinition,
    config.answerPrinciples,
    config.clarificationPolicy,
    config.forbiddenTopics,
    config.outputFormat,
  ]
    .map((item) => item.trim())
    .filter(Boolean)
    .join('\n\n');

const defaultResponseStyleByType: Record<AgentType, string> = {
  ask: '经营分析口径优先，默认展示指标解释、数据来源和 SQL 摘要。',
  report: '面向管理层，结论先行，强调摘要、异常项和可推送报告片段。',
  rca: '围绕异常指标逐层下钻，输出候选根因、证据链和验证建议。',
};

const defaultResultVisibilityByType: Record<AgentType, AgentResultVisibilityConfig> = {
  ask: {
    showSql: true,
    showQueryBasis: true,
    showDataSource: true,
    showConfidence: true,
    allowDetailView: true,
  },
  report: {
    showSql: false,
    showQueryBasis: true,
    showDataSource: true,
    showConfidence: true,
    allowDetailView: false,
  },
  rca: {
    showSql: true,
    showQueryBasis: true,
    showDataSource: true,
    showConfidence: true,
    allowDetailView: true,
  },
};

const defaultAnomalyPolicyByType: Record<AgentType, string> = {
  ask: '指标出现明显同比/环比波动、药占比或耗占比超过阈值时主动提示异常。',
  report: '报告中自动突出连续两期异常、结构占比明显偏移和重点科室贡献变化。',
  rca: '费用、收入、流量等指标超过历史区间时，按时间、科室、病种和费用组拆解贡献。',
};

const defaultPermissionByType: Record<AgentType, {
  permissionGroup: string;
  fieldAccessLevel: AgentFieldAccessLevel;
  allowPatientDetail: boolean;
  desensitizeSensitiveData: boolean;
  sensitiveQuestionPolicy: string;
}> = {
  ask: {
    permissionGroup: '经营分析组',
    fieldAccessLevel: '科室明细',
    allowPatientDetail: false,
    desensitizeSensitiveData: true,
    sensitiveQuestionPolicy: '涉及患者身份、联系方式、证件号、住院号等敏感信息时拒绝展示明细，仅返回汇总口径。',
  },
  report: {
    permissionGroup: '院领导、经营分析组',
    fieldAccessLevel: '科室明细',
    allowPatientDetail: false,
    desensitizeSensitiveData: true,
    sensitiveQuestionPolicy: '报告导出仅包含汇总指标、图表和管理层结论，不包含患者级明细。',
  },
  rca: {
    permissionGroup: '经营分析组、质控管理组',
    fieldAccessLevel: '医生明细',
    allowPatientDetail: false,
    desensitizeSensitiveData: true,
    sensitiveQuestionPolicy: '根因证据优先使用聚合数据；涉及敏感病种或患者明细时只展示脱敏统计。',
  },
};

const splitUserGroupNames = (value: string) =>
  value
    .split(/[、,，]/)
    .map((item) => item.trim())
    .filter(Boolean);

const fieldAccessOptions: AgentFieldAccessLevel[] = ['汇总数据', '科室明细', '医生明细', '患者明细'];
type AgentEditorTab = 'basic' | 'datasets' | 'knowledge' | 'skills' | 'mcp' | 'report' | 'model' | 'permission';

function ConfigSwitch({
  checked,
  title,
  description,
  onChange,
}: {
  checked: boolean;
  title: string;
  description: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-blue-300 text-blue-600"
      />
      <span>
        <span className="block text-sm font-medium text-gray-900">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-gray-500">{description}</span>
      </span>
    </label>
  );
}

function SkillCard({
  skill,
  checked,
  recommended,
  onToggle,
  onView,
}: {
  skill: Skill;
  checked: boolean;
  recommended: boolean;
  onToggle: (skillId: string) => void;
  onView: (skill: Skill) => void;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-4 text-left ${
        checked ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-gray-900">{skill.name}</div>
          <div className="mt-1 text-xs text-gray-500">{skill.scene}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onView(skill)}
            className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600 hover:border-blue-200 hover:text-blue-700"
          >
            <Eye className="h-3.5 w-3.5" />
            查看内容
          </button>
          {!recommended && (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-700">非推荐</span>
          )}
          <button
            type="button"
            onClick={() => onToggle(skill.id)}
            className={`rounded-full px-2.5 py-1 text-xs ${
              checked ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {checked ? '已配置' : '未配置'}
          </button>
        </div>
      </div>
      <div className="mt-3 text-sm leading-6 text-gray-600">{skill.description}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {skill.applicableAgentTypes.map((item) => (
          <span
            key={item}
            className={`rounded-full px-2.5 py-1 text-xs ${
              recommended && item === skill.applicableAgentTypes[0]
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {agentTypeLabel[item]}
          </span>
        ))}
      </div>
    </div>
  );
}

function ReportTemplateCard({
  template,
  checked,
  isDefault,
  datasetNames,
  skillNames,
  onToggle,
  onSetDefault,
}: {
  template: ReportTemplate;
  checked: boolean;
  isDefault: boolean;
  datasetNames: string;
  skillNames: string;
  onToggle: (templateId: string) => void;
  onSetDefault: (templateId: string) => void;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-4 text-left ${
        checked ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-medium text-gray-900">{template.name}</div>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs text-blue-700">
              {template.category}
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {template.version}
            </span>
          </div>
          <div className="mt-2 text-sm leading-6 text-gray-600">{template.description}</div>
        </div>
        <button
          type="button"
          onClick={() => onToggle(template.id)}
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${
            checked ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {checked ? '已绑定' : '未绑定'}
        </button>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-gray-500 md:grid-cols-2">
        <div>数据集：{datasetNames || '-'}</div>
        <div>Skills：{skillNames || '-'}</div>
        <div>章节：{template.sections.length} 个</div>
        <div>状态：{template.status}</div>
      </div>

      {checked && (
        <div className="mt-3 flex items-center justify-between border-t border-blue-100 pt-3">
          <span className="text-xs text-gray-500">
            {isDefault ? '当前默认模板' : '绑定后可作为自动匹配候选'}
          </span>
          <button
            type="button"
            onClick={() => onSetDefault(template.id)}
            className={`rounded-full px-2.5 py-1 text-xs ${
              isDefault ? 'bg-blue-600 text-white' : 'bg-white text-blue-700 hover:bg-blue-100'
            }`}
          >
            {isDefault ? '默认' : '设为默认'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function AssistantEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const {
    agents,
    knowledgeBases,
    knowledgeDocuments,
    skills,
    reportTemplates,
    semanticDatasets,
    mcpServers,
    addAgent,
    updateAgent,
    setAgentMcpCapabilityBindings,
  } = useWorkspace();
  const existingAgent = agents.find((agent) => agent.id === id);
  const [activeTab, setActiveTab] = useState<AgentEditorTab>('basic');
  const [name, setName] = useState('');
  const [type, setType] = useState<AgentType>('ask');
  const [description, setDescription] = useState('');
  const [capabilitySummary, setCapabilitySummary] = useState('');
  const [exampleQuestions, setExampleQuestions] = useState<string[]>(['']);
  const [selectedDatasetIds, setSelectedDatasetIds] = useState<string[]>(defaultDatasetIdsByType.ask);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedMcpCapabilityIds, setSelectedMcpCapabilityIds] = useState<string[]>([]);
  const [selectedMcpServerId, setSelectedMcpServerId] = useState('all');
  const [knowledgeEnabled, setKnowledgeEnabled] = useState(true);
  const [selectedKnowledgeDocumentIds, setSelectedKnowledgeDocumentIds] = useState<string[]>([]);
  const [knowledgeSelectionInitialized, setKnowledgeSelectionInitialized] = useState(false);
  const [status, setStatus] = useState<'已启用' | '已停用'>('已启用');
  const [modelName, setModelName] = useState('gpt-4o-mini');
  const [behaviorConfig, setBehaviorConfig] = useState<AgentBehaviorConfig>(defaultBehaviorByType.ask);
  const [agentPrompt, setAgentPrompt] = useState(behaviorConfigToPrompt(defaultBehaviorByType.ask));
  const [responseStyle, setResponseStyle] = useState(defaultResponseStyleByType.ask);
  const [resultVisibility, setResultVisibility] = useState<AgentResultVisibilityConfig>(defaultResultVisibilityByType.ask);
  const [allowExport, setAllowExport] = useState(true);
  const [allowCrossDataset, setAllowCrossDataset] = useState(false);
  const [anomalyPolicy, setAnomalyPolicy] = useState(defaultAnomalyPolicyByType.ask);
  const [permissionGroup, setPermissionGroup] = useState(defaultPermissionByType.ask.permissionGroup);
  const [fieldAccessLevel, setFieldAccessLevel] = useState<AgentFieldAccessLevel>(defaultPermissionByType.ask.fieldAccessLevel);
  const [allowPatientDetail, setAllowPatientDetail] = useState(defaultPermissionByType.ask.allowPatientDetail);
  const [desensitizeSensitiveData, setDesensitizeSensitiveData] = useState(defaultPermissionByType.ask.desensitizeSensitiveData);
  const [sensitiveQuestionPolicy, setSensitiveQuestionPolicy] = useState(defaultPermissionByType.ask.sensitiveQuestionPolicy);
  const [reportTheme, setReportTheme] = useState('门急诊经营分析');
  const [reportMetrics, setReportMetrics] = useState('门诊收入, 门诊量, 药占比');
  const [selectedReportTemplateIds, setSelectedReportTemplateIds] = useState<string[]>([]);
  const [defaultReportTemplateId, setDefaultReportTemplateId] = useState('');
  const [autoMatchTemplate, setAutoMatchTemplate] = useState(true);
  const [drilldownStrategy, setDrilldownStrategy] = useState('总体到科室到费用组');
  const [ruleSet, setRuleSet] = useState('异常波动规则, 结构占比规则');
  const [statisticalMethod, setStatisticalMethod] = useState('环比 + 同比 + 贡献度');
  const [viewingSkill, setViewingSkill] = useState<Skill | null>(null);

  useEffect(() => {
    if (!existingAgent) {
      setType('ask');
      setDescription(defaultAgentByType.ask.description);
      setCapabilitySummary(defaultAgentByType.ask.capabilitySummary);
      setSelectedDatasetIds(defaultDatasetIdsByType.ask);
      setSelectedMcpCapabilityIds([]);
      setSelectedMcpServerId('all');
      setKnowledgeEnabled(true);
      setSelectedKnowledgeDocumentIds([]);
      setKnowledgeSelectionInitialized(false);
      setBehaviorConfig(defaultBehaviorByType.ask);
      setAgentPrompt(behaviorConfigToPrompt(defaultBehaviorByType.ask));
      setResponseStyle(defaultResponseStyleByType.ask);
      setResultVisibility(defaultResultVisibilityByType.ask);
      setAllowExport(true);
      setAllowCrossDataset(false);
      setAnomalyPolicy(defaultAnomalyPolicyByType.ask);
      setPermissionGroup(defaultPermissionByType.ask.permissionGroup);
      setFieldAccessLevel(defaultPermissionByType.ask.fieldAccessLevel);
      setAllowPatientDetail(defaultPermissionByType.ask.allowPatientDetail);
      setDesensitizeSensitiveData(defaultPermissionByType.ask.desensitizeSensitiveData);
      setSensitiveQuestionPolicy(defaultPermissionByType.ask.sensitiveQuestionPolicy);
      return;
    }

    setName(existingAgent.name);
    setType(existingAgent.type);
    setDescription(existingAgent.description);
    setCapabilitySummary(existingAgent.capabilitySummary);
    setExampleQuestions(existingAgent.exampleQuestions.length ? existingAgent.exampleQuestions : ['']);
    setSelectedDatasetIds(existingAgent.datasetIds ?? defaultDatasetIdsByType[existingAgent.type]);
    setSelectedSkills(existingAgent.skills);
    setSelectedMcpCapabilityIds(
      mcpServers.flatMap((server) =>
        server.capabilities
          .filter((capability) => capability.agentIds.includes(existingAgent.id))
          .map((capability) => capability.id),
      ),
    );
    setSelectedMcpServerId('all');
    setKnowledgeEnabled(existingAgent.knowledgeConfig?.enabled ?? true);
    setSelectedKnowledgeDocumentIds(existingAgent.knowledgeConfig?.knowledgeDocumentIds ?? []);
    setKnowledgeSelectionInitialized(Boolean(existingAgent.knowledgeConfig?.knowledgeDocumentIds));
    setStatus(existingAgent.status as typeof status);
    const existingBehaviorConfig = existingAgent.behaviorConfig ?? defaultBehaviorByType[existingAgent.type];
    setBehaviorConfig(existingBehaviorConfig);
    setAgentPrompt(behaviorConfigToPrompt(existingBehaviorConfig));
    setResponseStyle(existingAgent.responseStyle ?? defaultResponseStyleByType[existingAgent.type]);
    setResultVisibility(existingAgent.resultVisibility ?? {
      ...defaultResultVisibilityByType[existingAgent.type],
      showSql: existingAgent.showSql ?? defaultResultVisibilityByType[existingAgent.type].showSql,
    });
    setAllowExport(existingAgent.allowExport ?? true);
    setAllowCrossDataset(existingAgent.allowCrossDataset ?? ((existingAgent.datasetIds?.length ?? 0) > 1));
    setAnomalyPolicy(existingAgent.anomalyPolicy ?? defaultAnomalyPolicyByType[existingAgent.type]);
    setPermissionGroup(
      existingAgent.permissionConfig?.permissionGroup ??
        defaultPermissionByType[existingAgent.type].permissionGroup,
    );
    setFieldAccessLevel(
      existingAgent.permissionConfig?.fieldAccessLevel ??
        defaultPermissionByType[existingAgent.type].fieldAccessLevel,
    );
    setAllowPatientDetail(
      existingAgent.permissionConfig?.allowPatientDetail ??
        defaultPermissionByType[existingAgent.type].allowPatientDetail,
    );
    setDesensitizeSensitiveData(
      existingAgent.permissionConfig?.desensitizeSensitiveData ??
        defaultPermissionByType[existingAgent.type].desensitizeSensitiveData,
    );
    setSensitiveQuestionPolicy(
      existingAgent.permissionConfig?.sensitiveQuestionPolicy ??
        defaultPermissionByType[existingAgent.type].sensitiveQuestionPolicy,
    );
    setReportTheme(existingAgent.reportConfig?.theme ?? '门急诊经营分析');
    setReportMetrics(existingAgent.reportConfig?.metrics.join(', ') ?? '门诊收入, 门诊量, 药占比');
    setSelectedReportTemplateIds(existingAgent.reportConfig?.boundTemplateIds ?? []);
    setDefaultReportTemplateId(existingAgent.reportConfig?.defaultTemplateId ?? '');
    setAutoMatchTemplate(existingAgent.reportConfig?.autoMatchTemplate ?? true);
    setDrilldownStrategy(existingAgent.rcaConfig?.drilldownStrategy ?? '总体到科室到费用组');
    setRuleSet(existingAgent.rcaConfig?.ruleSet.join(', ') ?? '异常波动规则, 结构占比规则');
    setStatisticalMethod(existingAgent.rcaConfig?.statisticalMethod ?? '环比 + 同比 + 贡献度');
  }, [existingAgent, mcpServers]);

  useEffect(() => {
    if (existingAgent) return;
    setDescription(defaultAgentByType[type].description);
    setCapabilitySummary(defaultAgentByType[type].capabilitySummary);
    setSelectedDatasetIds(defaultDatasetIdsByType[type]);
    setSelectedMcpCapabilityIds([]);
    setSelectedMcpServerId('all');
    setKnowledgeEnabled(true);
    setSelectedKnowledgeDocumentIds([]);
    setKnowledgeSelectionInitialized(false);
    setBehaviorConfig(defaultBehaviorByType[type]);
    setAgentPrompt(behaviorConfigToPrompt(defaultBehaviorByType[type]));
    setResponseStyle(defaultResponseStyleByType[type]);
    setResultVisibility(defaultResultVisibilityByType[type]);
    setAllowExport(true);
    setAllowCrossDataset(type === 'report');
    setAnomalyPolicy(defaultAnomalyPolicyByType[type]);
    setPermissionGroup(defaultPermissionByType[type].permissionGroup);
    setFieldAccessLevel(defaultPermissionByType[type].fieldAccessLevel);
    setAllowPatientDetail(defaultPermissionByType[type].allowPatientDetail);
    setDesensitizeSensitiveData(defaultPermissionByType[type].desensitizeSensitiveData);
    setSensitiveQuestionPolicy(defaultPermissionByType[type].sensitiveQuestionPolicy);
  }, [existingAgent, type]);

  useEffect(() => {
    if (existingAgent || type !== 'report') return;

    const initialTemplateIds = reportTemplates
      .filter((template) => template.status !== 'disabled')
      .slice(0, 2)
      .map((template) => template.id);

    setSelectedReportTemplateIds(initialTemplateIds);
    setDefaultReportTemplateId(initialTemplateIds[0] ?? '');
    setAutoMatchTemplate(true);
  }, [existingAgent, reportTemplates, type]);

  const recommendedSkills = useMemo(
    () => skills.filter((skill) => skill.applicableAgentTypes.includes(type)),
    [skills, type],
  );

  const optionalSkills = useMemo(
    () => skills.filter((skill) => !skill.applicableAgentTypes.includes(type)),
    [skills, type],
  );

  const availableKnowledgeDocuments = useMemo(
    () =>
      knowledgeDocuments.filter((document) => {
        const base = knowledgeBases.find((item) => item.id === document.knowledgeBaseId);

        return (
          base &&
          base.status === '已启用' &&
          base.applicableAgentTypes.includes(type) &&
          base.datasetIds.some((datasetId) => selectedDatasetIds.includes(datasetId)) &&
          (permissionGroup === '所有人' ||
            base.permissionGroups.some((group) => permissionGroup.includes(group) || group.includes(permissionGroup)))
        );
      }),
    [knowledgeBases, knowledgeDocuments, permissionGroup, selectedDatasetIds, type],
  );

  const userGroupOptions = useMemo(() => {
    const groupValues = [
      ...Object.values(defaultPermissionByType).map((config) => config.permissionGroup),
      ...knowledgeBases.flatMap((base) => base.permissionGroups),
      ...agents.map((agent) => agent.permissionConfig?.permissionGroup ?? ''),
      permissionGroup,
    ];
    const groups = groupValues.flatMap((value) => [value.trim(), ...splitUserGroupNames(value)]);

    return ['所有人', ...Array.from(new Set(groups.filter(Boolean)))];
  }, [agents, knowledgeBases, permissionGroup]);

  useEffect(() => {
    if (knowledgeSelectionInitialized || !availableKnowledgeDocuments.length) return;

    setSelectedKnowledgeDocumentIds(availableKnowledgeDocuments.map((document) => document.id));
    setKnowledgeSelectionInitialized(true);
  }, [availableKnowledgeDocuments, knowledgeSelectionInitialized]);

  const reportTemplateOptions = useMemo(() => {
    if (type !== 'report') return [];

    return reportTemplates.filter((template) => {
      if (template.status === 'disabled') return false;
      if (!existingAgent) return true;
      return (
        template.applicableAgentIds.length === 0 ||
        template.applicableAgentIds.includes(existingAgent.id) ||
        selectedReportTemplateIds.includes(template.id)
      );
    });
  }, [existingAgent, reportTemplates, selectedReportTemplateIds, type]);

  const editorTabs = useMemo<[AgentEditorTab, string][]>(
    () =>
      [
        ['basic', '基础信息'],
        ['datasets', '数据集配置'],
        ['skills', 'Skills 配置'],
        ['mcp', 'MCP 能力'],
        ['knowledge', '知识库'],
        ...(type === 'report' ? ([['report', '报告配置']] as [AgentEditorTab, string][]) : []),
        ['model', '模型与策略'],
        ['permission', '权限与发布'],
      ],
    [type],
  );

  useEffect(() => {
    if (type !== 'report' && activeTab === 'report') {
      setActiveTab('model');
    }
  }, [activeTab, type]);

  const toggleSkill = (skillId: string) => {
    setSelectedSkills((current) =>
      current.includes(skillId) ? current.filter((item) => item !== skillId) : [...current, skillId],
    );
  };

  const toggleMcpCapability = (capabilityId: string) => {
    setSelectedMcpCapabilityIds((current) =>
      current.includes(capabilityId)
        ? current.filter((item) => item !== capabilityId)
        : [...current, capabilityId],
    );
  };

  const allMcpCapabilities = useMemo(
    () =>
      mcpServers.flatMap((server) =>
        server.capabilities.map((capability) => ({
          ...capability,
          serverName: server.name,
          serverStatus: server.status,
          healthStatus: server.healthStatus,
        })),
      ),
    [mcpServers],
  );

  const visibleMcpCapabilities = useMemo(
    () =>
      selectedMcpServerId === 'all'
        ? allMcpCapabilities
        : allMcpCapabilities.filter((capability) => capability.serverId === selectedMcpServerId),
    [allMcpCapabilities, selectedMcpServerId],
  );

  const toggleKnowledgeDocument = (documentId: string) => {
    setKnowledgeSelectionInitialized(true);
    setSelectedKnowledgeDocumentIds((current) =>
      current.includes(documentId) ? current.filter((item) => item !== documentId) : [...current, documentId],
    );
  };

  const toggleDataset = (datasetId: string) => {
    setSelectedDatasetIds((current) => {
      const next = current.includes(datasetId)
        ? current.filter((item) => item !== datasetId)
        : [...current, datasetId];
      return next.length ? next : current;
    });
  };

  const toggleReportTemplate = (templateId: string) => {
    setSelectedReportTemplateIds((current) => {
      const next = current.includes(templateId)
        ? current.filter((item) => item !== templateId)
        : [...current, templateId];

      if (!next.includes(defaultReportTemplateId)) {
        setDefaultReportTemplateId(next[0] ?? '');
      }

      return next;
    });
  };

  const updateBehaviorConfig = <K extends keyof AgentBehaviorConfig>(
    key: K,
    value: AgentBehaviorConfig[K],
  ) => {
    setBehaviorConfig((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updateResultVisibility = <K extends keyof AgentResultVisibilityConfig>(
    key: K,
    value: AgentResultVisibilityConfig[K],
  ) => {
    setResultVisibility((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSave = () => {
    const nextBehaviorConfig: AgentBehaviorConfig = {
      roleDefinition: agentPrompt.trim(),
      answerPrinciples: '',
      clarificationPolicy: '',
      forbiddenTopics: '',
      outputFormat: '',
    };
    const baseAgent: Agent = {
      id: existingAgent?.id ?? `agent-${Date.now()}`,
      name: name || `${type === 'ask' ? '问答' : type === 'report' ? '报告' : '深度分析'} Agent`,
      type,
      group: type,
      description,
      creator: existingAgent?.creator ?? 'admin',
      updatedAt: new Date(),
      status,
      skills: selectedSkills,
      exampleQuestions: exampleQuestions.filter((question) => question.trim()),
      capabilitySummary,
      datasetIds: selectedDatasetIds,
      behaviorConfig: nextBehaviorConfig,
      responseStyle,
      showSql: resultVisibility.showSql,
      allowExport,
      allowCrossDataset,
      anomalyPolicy,
      resultVisibility,
      permissionConfig: {
        permissionGroup,
        fieldAccessLevel,
        allowPatientDetail,
        desensitizeSensitiveData,
        sensitiveQuestionPolicy,
      },
      knowledgeConfig: {
        enabled: knowledgeEnabled,
        mode: 'manual-documents',
        knowledgeDocumentIds: selectedKnowledgeDocumentIds.filter((documentId) =>
          availableKnowledgeDocuments.some((document) => document.id === documentId),
        ),
      },
      reportConfig:
        type === 'report'
          ? {
              theme: reportTheme,
              metrics: reportMetrics
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean),
              scheduleEnabled: true,
              boundTemplateIds: selectedReportTemplateIds,
              defaultTemplateId: defaultReportTemplateId || selectedReportTemplateIds[0],
              autoMatchTemplate,
            }
          : undefined,
      rcaConfig:
        type === 'rca'
          ? {
              drilldownStrategy,
              ruleSet: ruleSet
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean),
              statisticalMethod,
            }
          : undefined,
    };

    if (existingAgent) {
      updateAgent(existingAgent.id, baseAgent);
    } else {
      addAgent(baseAgent);
    }
    setAgentMcpCapabilityBindings(baseAgent.id, selectedMcpCapabilityIds);

    navigate('/settings');
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-gray-50">
      <div className="shrink-0 border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/settings')}
              className="rounded p-1 transition-colors hover:bg-gray-100"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <div className="text-lg font-semibold text-gray-900">{existingAgent ? '编辑 Agent' : '新建 Agent'}</div>
            </div>
          </div>
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm text-white hover:bg-blue-700"
          >
            <Save className="h-4 w-4" />
            保存 Agent
          </button>
        </div>
      </div>

      <div className="shrink-0 border-b border-gray-200 bg-white px-6">
        <div className="flex items-center gap-8">
          {editorTabs.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`relative px-1 py-4 text-sm ${
                activeTab === key ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {label}
              {activeTab === key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-5xl space-y-6">
          {activeTab === 'basic' && (
            <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="block text-sm text-gray-700">Agent 名称</label>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700">Agent 类型</label>
                  <select
                    value={type}
                    onChange={(event) => setType(event.target.value as AgentType)}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="ask">问答 Agent</option>
                    <option value="report">报告 Agent</option>
                    <option value="rca">深度分析 Agent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700">适用场景</label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-sm text-gray-700">示例问题</label>
                  <button
                    onClick={() => setExampleQuestions((current) => [...current, ''])}
                    className="inline-flex items-center gap-2 text-sm text-blue-600"
                  >
                    <Plus className="h-4 w-4" />
                    新增示例问题
                  </button>
                </div>
                <div className="mt-3 space-y-3">
                  {exampleQuestions.map((question, index) => (
                    <div key={`${index}-${question}`} className="flex items-center gap-2">
                      <input
                        value={question}
                        onChange={(event) =>
                          setExampleQuestions((current) =>
                            current.map((item, currentIndex) =>
                              currentIndex === index ? event.target.value : item,
                            ),
                          )
                        }
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                      />
                      <button
                        onClick={() =>
                          setExampleQuestions((current) =>
                            current.filter((_, currentIndex) => currentIndex !== index),
                          )
                        }
                        className="rounded p-2 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'datasets' && (
            <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div>
                <div className="text-base font-medium text-gray-900">可访问数据集</div>
                <div className="mt-1 text-sm text-gray-500">
                  数据集决定 Agent 的可问范围；指标口径会由语义层按问题自动识别。
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {semanticDatasets.map((dataset) => {
                  const checked = selectedDatasetIds.includes(dataset.id);
                  const fieldCount =
                    dataset.queryFields?.length ??
                    dataset.tables.reduce((total, table) => total + table.fields.length, 0);

                  return (
                    <button
                      key={dataset.id}
                      type="button"
                      onClick={() => toggleDataset(dataset.id)}
                      className={`rounded-xl border px-4 py-4 text-left transition-colors ${
                        checked
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium text-gray-900">{dataset.name}</div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs ${
                            checked ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {checked ? '已启用' : '未启用'}
                        </span>
                      </div>
                      <div className="mt-2 text-sm leading-6 text-gray-500">{dataset.description}</div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-600">
                          {dataset.businessTheme}
                        </span>
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-600">
                          {fieldCount} 个字段
                        </span>
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-600">
                          {dataset.sourceName ?? '未配置数据源'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

            </div>
          )}

          {activeTab === 'skills' && (
            <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-base font-medium text-gray-900">配置 Skills</div>
                  <div className="mt-1 text-sm text-gray-500">
                    默认自动调用已配置 Skills。推荐列表表示更适合当前 Agent 类型；其他 Skill 也允许手动配置。
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
                    {agentTypeLabel[type]}
                  </span>
                  <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700">
                    已配置 {selectedSkills.length} 个 Skills
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-900">推荐配置</div>
                  <div className="text-xs text-gray-500">{recommendedSkills.length} 个可选</div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {recommendedSkills.map((skill) => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      checked={selectedSkills.includes(skill.id)}
                      recommended
                      onToggle={toggleSkill}
                      onView={setViewingSkill}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-gray-900">其他可配置</div>
                  <div className="text-xs text-gray-500">支持跨类型配置，但不作为默认推荐</div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {optionalSkills.map((skill) => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      checked={selectedSkills.includes(skill.id)}
                      recommended={false}
                      onToggle={toggleSkill}
                      onView={setViewingSkill}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'mcp' && (
            <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-base font-medium text-gray-900">MCP 能力授权</div>
                  <div className="mt-1 text-sm leading-6 text-gray-500">
                    Agent 只能调用这里已授权的 MCP 能力。
                  </div>
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
                  已授权 {selectedMcpCapabilityIds.length} 个能力
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm text-gray-700">
                  MCP 服务
                  <select
                    value={selectedMcpServerId}
                    onChange={(event) => setSelectedMcpServerId(event.target.value)}
                    className="ml-3 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="all">全部服务</option>
                    {mcpServers.map((server) => (
                      <option key={server.id} value={server.id}>
                        {server.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-3">
                {visibleMcpCapabilities.length ? (
                  visibleMcpCapabilities.map((capability) => {
                    const checked = selectedMcpCapabilityIds.includes(capability.id);
                    return (
                      <button
                        key={capability.id}
                        type="button"
                        onClick={() => toggleMcpCapability(capability.id)}
                        className={`rounded-xl border px-4 py-4 text-left transition-colors ${
                          checked ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-gray-900">{capability.name}</span>
                              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">
                                {capability.kind}
                              </span>
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs ${
                                  capability.riskLevel === '高'
                                    ? 'bg-red-50 text-red-700'
                                    : capability.riskLevel === '中'
                                      ? 'bg-amber-50 text-amber-700'
                                      : 'bg-emerald-50 text-emerald-700'
                                }`}
                              >
                                {capability.riskLevel}风险
                              </span>
                            </div>
                            <div className="mt-2 text-sm leading-6 text-gray-600">{capability.description}</div>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                              <span className="rounded bg-gray-100 px-2 py-0.5">{capability.serverName}</span>
                              <span className="rounded bg-gray-100 px-2 py-0.5">{capability.serverStatus}</span>
                              <span className="rounded bg-gray-100 px-2 py-0.5">健康：{capability.healthStatus}</span>
                              {capability.scopes.map((scope) => (
                                <span key={`${capability.id}-${scope}`} className="rounded bg-white px-2 py-0.5">
                                  {scope}
                                </span>
                              ))}
                            </div>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${
                              checked ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {checked ? '已授权' : '未授权'}
                          </span>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-lg border border-gray-200 bg-white px-4 py-6 text-sm text-gray-500">
                    当前筛选下暂无 MCP 能力，请先在配置中心同步 MCP 服务能力。
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'knowledge' && (
            <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-base font-medium text-gray-900">知识文档引用</div>
                  <div className="mt-1 text-sm leading-6 text-gray-500">
                    问数时自动检索下方已关联的独立文档；检索范围跟随当前 Agent 的数据集和用户组。
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700">
                    已关联 {selectedKnowledgeDocumentIds.length} 份独立文档
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="font-medium text-gray-900">可引用文档</div>
                <div className="text-gray-500">
                  {availableKnowledgeDocuments.length} 份可选文档
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {availableKnowledgeDocuments.length ? (
                  availableKnowledgeDocuments.map((document) => {
                    const checked = selectedKnowledgeDocumentIds.includes(document.id);

                    return (
                    <button
                      key={document.id}
                      type="button"
                      onClick={() => toggleKnowledgeDocument(document.id)}
                      className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                        checked ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-medium text-gray-900">{document.title}</div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs ${
                            checked ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {checked ? '已关联' : '未关联'}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">{document.type}</span>
                        <span>{document.source}</span>
                        <span>{document.updatedAt}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {document.tags.map((tag) => (
                          <span key={tag} className="rounded bg-white px-2 py-0.5 text-xs text-gray-500">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </button>
                    );
                  })
                ) : (
                  <div className="rounded-lg border border-gray-200 bg-white px-4 py-6 text-sm text-gray-500 md:col-span-2">
                    当前数据集和用户组下暂无可引用文档。
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'report' && type === 'report' && (
            <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div>
                <div className="text-base font-medium text-gray-900">报告基础配置</div>
                <div className="mt-1 text-sm text-gray-500">
                  配置报告主题、指标组合，以及生成报告时可选用的模板。
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="block text-sm text-gray-700">报告主题</label>
                  <input
                    value={reportTheme}
                    onChange={(event) => setReportTheme(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700">报告指标组合</label>
                  <textarea
                    value={reportMetrics}
                    onChange={(event) => setReportMetrics(event.target.value)}
                    rows={3}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-base font-medium text-gray-900">报告模板绑定</div>
                    <div className="mt-1 text-sm leading-6 text-gray-500">
                      模板用于约束报告章节、分析路径、指标引用和图表编排。
                    </div>
                  </div>
                  <label className="flex shrink-0 items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={autoMatchTemplate}
                      onChange={(event) => setAutoMatchTemplate(event.target.checked)}
                      className="h-4 w-4 rounded border-blue-300 text-blue-600"
                    />
                    自动匹配模板
                  </label>
                </div>

                <div className="grid gap-3">
                  {reportTemplateOptions.map((template) => {
                    const datasetNames = template.datasetIds
                      .map((datasetId) => semanticDatasets.find((dataset) => dataset.id === datasetId)?.name)
                      .filter(Boolean)
                      .join(' / ');
                    const skillNames = template.skillIds
                      .map((skillId) => skills.find((skill) => skill.id === skillId)?.name)
                      .filter(Boolean)
                      .join(' / ');

                    return (
                      <ReportTemplateCard
                        key={template.id}
                        template={template}
                        checked={selectedReportTemplateIds.includes(template.id)}
                        isDefault={defaultReportTemplateId === template.id}
                        datasetNames={datasetNames}
                        skillNames={skillNames}
                        onToggle={toggleReportTemplate}
                        onSetDefault={setDefaultReportTemplateId}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'model' && (
            <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="block text-sm text-gray-700">默认模型</label>
                  <select
                    value={modelName}
                    onChange={(event) => setModelName(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="gpt-4o-mini">gpt-4o-mini</option>
                    <option value="qwen-plus">qwen-plus</option>
                    <option value="deepseek-v3">deepseek-v3</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700">Agent 提示词</label>
                <textarea
                  value={agentPrompt}
                  onChange={(event) => setAgentPrompt(event.target.value)}
                  rows={14}
                  className="mt-2 min-h-80 w-full rounded-lg border border-gray-300 px-3 py-3 text-sm leading-6 focus:border-blue-500 focus:outline-none"
                  placeholder="请输入 Agent 提示词"
                />
              </div>

              <div className="hidden space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-5">
                <div>
                  <div className="text-base font-medium text-gray-900">Agent 行为设定</div>
                  <div className="mt-1 text-sm text-gray-500">
                    用结构化配置约束 Agent 的角色、追问边界和输出格式，系统会据此生成最终提示词。
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm text-gray-700">角色定位</label>
                    <textarea
                      value={behaviorConfig.roleDefinition}
                      onChange={(event) => updateBehaviorConfig('roleDefinition', event.target.value)}
                      rows={3}
                      className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700">回答原则</label>
                    <textarea
                      value={behaviorConfig.answerPrinciples}
                      onChange={(event) => updateBehaviorConfig('answerPrinciples', event.target.value)}
                      rows={3}
                      className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700">追问原则</label>
                    <textarea
                      value={behaviorConfig.clarificationPolicy}
                      onChange={(event) => updateBehaviorConfig('clarificationPolicy', event.target.value)}
                      rows={3}
                      className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700">禁止事项</label>
                    <textarea
                      value={behaviorConfig.forbiddenTopics}
                      onChange={(event) => updateBehaviorConfig('forbiddenTopics', event.target.value)}
                      rows={3}
                      className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-700">输出格式</label>
                  <input
                    value={behaviorConfig.outputFormat}
                    onChange={(event) => updateBehaviorConfig('outputFormat', event.target.value)}
                    className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="hidden space-y-4 rounded-xl border border-gray-200 p-5">
                <div>
                  <div className="text-base font-medium text-gray-900">回答风格与可见性</div>
                  <div className="mt-1 text-sm text-gray-500">
                    控制 Agent 如何表达结果，以及哪些查询依据可以展示给用户。
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-700">回答风格</label>
                  <textarea
                    value={responseStyle}
                    onChange={(event) => setResponseStyle(event.target.value)}
                    rows={3}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <ConfigSwitch
                    checked={resultVisibility.showSql}
                    title="展示 SQL"
                    description="在可信口径展开区展示生成 SQL，适合分析师和开发联调场景。"
                    onChange={(checked) => updateResultVisibility('showSql', checked)}
                  />
                  <ConfigSwitch
                    checked={resultVisibility.showQueryBasis}
                    title="展示查询口径"
                    description="展示命中指标、过滤条件、时间口径和血缘链路。"
                    onChange={(checked) => updateResultVisibility('showQueryBasis', checked)}
                  />
                  <ConfigSwitch
                    checked={resultVisibility.showDataSource}
                    title="展示数据来源"
                    description="展示命中的数据集名称和来源说明。"
                    onChange={(checked) => updateResultVisibility('showDataSource', checked)}
                  />
                  <ConfigSwitch
                    checked={resultVisibility.showConfidence}
                    title="展示匹配置信度"
                    description="展示 Agent 自动路由置信度和命中信号。"
                    onChange={(checked) => updateResultVisibility('showConfidence', checked)}
                  />
                  <ConfigSwitch
                    checked={resultVisibility.allowDetailView}
                    title="允许查看明细依据"
                    description="允许用户展开查看维度、筛选条件和映射明细。"
                    onChange={(checked) => updateResultVisibility('allowDetailView', checked)}
                  />
                </div>
              </div>

              <div className="hidden space-y-3">
                <label className="block text-sm text-gray-700">异常策略</label>
                <textarea
                  value={anomalyPolicy}
                  onChange={(event) => setAnomalyPolicy(event.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              {type === 'rca' && (
                <div className="hidden grid gap-6">
                  <div>
                    <label className="block text-sm text-gray-700">下钻策略</label>
                    <input
                      value={drilldownStrategy}
                      onChange={(event) => setDrilldownStrategy(event.target.value)}
                      className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700">业务规则</label>
                    <textarea
                      value={ruleSet}
                      onChange={(event) => setRuleSet(event.target.value)}
                      rows={3}
                      className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700">统计方法</label>
                    <input
                      value={statisticalMethod}
                      onChange={(event) => setStatisticalMethod(event.target.value)}
                      className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'permission' && (
            <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div>
                <div className="text-base font-medium text-gray-900">权限与安全边界</div>
                <div className="mt-1 text-sm text-gray-500">
                  控制该 Agent 能服务哪些用户、能下钻到什么层级，以及敏感信息如何处理。
                </div>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <label className="block text-sm text-gray-700">用户组</label>
                  <select
                    value={permissionGroup}
                    onChange={(event) => setPermissionGroup(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    {userGroupOptions.map((group) => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700">可访问明细层级</label>
                  <select
                    value={fieldAccessLevel}
                    onChange={(event) => setFieldAccessLevel(event.target.value as AgentFieldAccessLevel)}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    {fieldAccessOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-700">发布状态</label>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value as typeof status)}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="已启用">已启用</option>
                    <option value="已停用">已停用</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <ConfigSwitch
                  checked={allowExport}
                  title="允许导出"
                  description="允许导出报告或分析结果；会受用户组和敏感字段策略约束。"
                  onChange={setAllowExport}
                />
                <ConfigSwitch
                  checked={desensitizeSensitiveData}
                  title="敏感信息脱敏"
                  description="对姓名、证件号、手机号、住院号等字段进行脱敏或拒绝展示。"
                  onChange={setDesensitizeSensitiveData}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-700">敏感问题处理规则</label>
                <textarea
                  value={sensitiveQuestionPolicy}
                  onChange={(event) => setSensitiveQuestionPolicy(event.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={Boolean(viewingSkill)} onOpenChange={(open) => !open && setViewingSkill(null)}>
        <DialogContent className="max-h-[82vh] overflow-hidden sm:max-w-3xl">
          {viewingSkill && (
            <>
              <DialogHeader>
                <DialogTitle>{viewingSkill.name}</DialogTitle>
                <DialogDescription>
                  {viewingSkill.scene} · {viewingSkill.description}
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 space-y-5 overflow-y-auto pr-1 text-sm">
                <div className="rounded-lg bg-gray-50 px-4 py-3">
                  <div className="text-xs font-medium text-gray-500">适用 Agent</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {viewingSkill.applicableAgentTypes.map((item) => (
                      <span key={item} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700">
                        {agentTypeLabel[item]}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-gray-500">触发词</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {viewingSkill.triggerPhrases.map((phrase) => (
                      <span key={phrase} className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">
                        {phrase}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-xs font-medium text-gray-500">分析规则</div>
                    <ul className="mt-2 space-y-1 text-gray-700">
                      {(viewingSkill.analysisRules ?? ['未配置']).map((rule) => (
                        <li key={rule}>· {rule}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-500">输出产物</div>
                    <ul className="mt-2 space-y-1 text-gray-700">
                      {(viewingSkill.outputArtifacts ?? ['未配置']).map((artifact) => (
                        <li key={artifact}>· {artifact}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-gray-500">Skill 内容</div>
                  <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs leading-6 text-gray-800">
                    {viewingSkill.skillMarkdown}
                  </pre>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
