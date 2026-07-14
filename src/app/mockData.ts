import {
  Agent,
  AgentRoutingTrace,
  AgentClarificationOption,
  AnalysisResultData,
  AnalysisMcpMatch,
  AnalysisProcessData,
  AgentType,
  ChartDatum,
  Conversation,
  DatabaseConnection,
  DimensionMember,
  DimensionSemantic,
  IndicatorAsset,
  KnowledgeBase,
  KnowledgeDocument,
  KnowledgeHit,
  KnowledgeSnippet,
  LlmConnection,
  Message,
  McpAuditLog,
  McpServer,
  MetricDatasetBinding,
  MetricSemantic,
  ReportResultData,
  ReportSubscription,
  ReportTemplate,
  ReportTemplateUsage,
  RootCauseResultData,
  ResultScope,
  SemanticDataset,
  Skill,
  SkillTrace,
  TimeGrain,
} from './types';

export const skills: Skill[] = [
  {
    id: 'skill-outpatient-ops',
    name: '门诊经营分析',
    scene: '门诊运营',
    description: '汇总门诊量、门诊收入和药耗结构，并输出经营结论。',
    triggerPhrases: ['门诊经营', '门诊收入', '门诊量'],
    skillMarkdown: `# 门诊经营分析

1. 聚焦门诊量、门诊收入和药耗结构。
2. 输出指标概览、趋势分析和经营结论。`,
    applicableAgentTypes: ['ask', 'report'],
    builtin: true,
    status: '已启用',
    version: 'v1.2',
    debugState: '已验证',
    tags: ['门诊', '经营', '日报'],
    metricIds: ['metric-outpatient-revenue', 'metric-outpatient-visits', 'metric-drug-ratio', 'metric-inspection-revenue'],
    dimensionIds: ['dim-visit-date', 'dim-department', 'dim-doctor', 'dim-fee-group'],
    analysisRules: ['同比/环比对比', '科室贡献拆分', '药耗结构提示'],
    outputArtifacts: ['指标卡', '趋势图', '经营结论', '推荐追问'],
  },
  {
    id: 'skill-pharmacy-structure',
    name: '药占比/耗占比分析',
    scene: '成本结构',
    description: '识别药品、耗材、治疗费用结构和异常波动。',
    triggerPhrases: ['药占比', '耗占比', '成本结构'],
    skillMarkdown: `# 药占比/耗占比分析

1. 对药品、耗材和治疗费用结构做拆解。
2. 输出占比变化、异常项和经营提示。`,
    applicableAgentTypes: ['ask', 'report', 'rca'],
    builtin: true,
    status: '已启用',
    version: 'v1.1',
    debugState: '已验证',
    tags: ['药占比', '耗占比', '异常'],
    metricIds: ['metric-drug-ratio', 'metric-consumable-ratio', 'metric-total-fee', 'metric-high-value-consumable'],
    dimensionIds: ['dim-visit-date', 'dim-discharge-date', 'dim-department', 'dim-disease-group', 'dim-fee-group'],
    analysisRules: ['药耗占比阈值', '费用结构偏移', '异常费用组识别'],
    outputArtifacts: ['结构拆分图', '异常提示', '治理建议'],
  },
  {
    id: 'skill-department-revenue',
    name: '科室收入结构分析',
    scene: '科室经营',
    description: '按科室拆分收入、检查、治疗和患者流量。',
    triggerPhrases: ['科室收入', '科室结构', '检查收入'],
    skillMarkdown: `# 科室收入结构分析

1. 按科室拆解收入、检查和治疗贡献。
2. 输出重点科室变化、结构差异和归因线索。`,
    applicableAgentTypes: ['ask', 'report', 'rca'],
    builtin: true,
    status: '已启用',
    version: 'v1.0',
    debugState: '已验证',
    tags: ['科室', '收入', '结构'],
    metricIds: ['metric-outpatient-revenue', 'metric-inpatient-revenue', 'metric-inspection-revenue'],
    dimensionIds: ['dim-department', 'dim-doctor', 'dim-fee-group', 'dim-disease-group'],
    analysisRules: ['科室贡献度', '收入结构拆分', '重点科室排序'],
    outputArtifacts: ['科室排行', '结构结论', '下钻建议'],
  },
  {
    id: 'skill-abnormal-fee',
    name: '异常费用识别',
    scene: '经营诊断',
    description: '识别异常费用群组并输出候选根因。',
    triggerPhrases: ['异常费用', '费用波动', '根因候选'],
    skillMarkdown: `# 异常费用识别

1. 识别费用异常点、异常群组和波动来源。
2. 输出候选根因、证据和后续验证建议。`,
    applicableAgentTypes: ['report', 'rca'],
    builtin: true,
    status: '已启用',
    version: 'v1.0',
    debugState: '调试中',
    tags: ['异常', '费用', '归因'],
    metricIds: ['metric-total-fee', 'metric-high-value-consumable', 'metric-drug-ratio', 'metric-consumable-ratio'],
    dimensionIds: ['dim-visit-date', 'dim-discharge-date', 'dim-department', 'dim-disease-group', 'dim-fee-group'],
    analysisRules: ['异常波动规则', '费用分组聚类', '候选根因排序'],
    outputArtifacts: ['异常费用组', '证据链', '根因候选'],
  },
  {
    id: 'skill-patient-flow',
    name: '患者流量趋势分析',
    scene: '流量分析',
    description: '按时间和人群层次分析患者流量变化。',
    triggerPhrases: ['患者流量', '流量趋势', '就诊人数'],
    skillMarkdown: `# 患者流量趋势分析

1. 分析门急诊、住院和重点人群的流量变化。
2. 输出趋势判断、峰谷时段和资源匹配建议。`,
    applicableAgentTypes: ['ask', 'report', 'rca'],
    builtin: true,
    status: '已启用',
    version: 'v1.0',
    debugState: '待调试',
    tags: ['患者', '流量', '趋势'],
    metricIds: ['metric-outpatient-visits', 'metric-inpatient-admissions', 'metric-average-length-of-stay'],
    dimensionIds: ['dim-visit-date', 'dim-discharge-date', 'dim-department', 'dim-patient-type'],
    analysisRules: ['峰谷识别', '人群分层', '资源匹配提示'],
    outputArtifacts: ['流量趋势', '人群拆分', '运营建议'],
  },
  {
    id: 'skill-custom-surgery',
    name: '手术量专题追踪',
    scene: '自定义专题',
    description: '围绕手术量、平均住院日和术后随访做专题分析。',
    triggerPhrases: ['手术量', '平均住院日', '术后随访'],
    skillMarkdown: `# 手术量专题追踪

1. 追踪手术量、平均住院日和术后随访指标。
2. 输出专题变化、异常点和运营建议。`,
    applicableAgentTypes: ['rca'],
    builtin: false,
    status: '已停用',
    version: 'draft-03',
    debugState: '待调试',
    tags: ['手术', '专题', '自定义'],
    metricIds: ['metric-surgery-count', 'metric-average-length-of-stay'],
    dimensionIds: ['dim-surgery-date', 'dim-department', 'dim-disease-group'],
    analysisRules: ['专题趋势追踪', '术后随访校验'],
    outputArtifacts: ['专题结论', '随访提示'],
  },
];

export const knowledgeBases: KnowledgeBase[] = [
  {
    id: 'kb-outpatient-policy',
    name: '门诊经营口径库',
    businessTheme: '门诊经营',
    applicableAgentTypes: ['ask', 'report', 'rca'],
    datasetIds: ['semantic-outpatient'],
    permissionGroups: ['经营分析组', '院领导、经营分析组'],
    status: '已启用',
  },
  {
    id: 'kb-inpatient-policy',
    name: '住院经营口径库',
    businessTheme: '住院经营',
    applicableAgentTypes: ['ask', 'report', 'rca'],
    datasetIds: ['semantic-inpatient'],
    permissionGroups: ['经营分析组', '质控管理组', '经营分析组、质控管理组'],
    status: '已启用',
  },
  {
    id: 'kb-governance-compliance',
    name: '医疗数据合规规则库',
    businessTheme: '数据权限与合规',
    applicableAgentTypes: ['ask', 'report', 'rca'],
    datasetIds: ['semantic-outpatient', 'semantic-inpatient'],
    permissionGroups: ['经营分析组', '院领导、经营分析组', '经营分析组、质控管理组'],
    status: '已启用',
  },
];

export const knowledgeDocuments: KnowledgeDocument[] = [
  {
    id: 'doc-outpatient-revenue',
    knowledgeBaseId: 'kb-outpatient-policy',
    title: '门诊收入统计口径',
    source: '经营分析部 / 门诊经营指标手册 v2026.05',
    type: '统计口径',
    updatedAt: '2026-05-20',
    applicableScenes: ['门诊收入查询', '门诊经营日报', '科室收入拆分'],
    tags: ['门诊收入', '结算口径', '收入归属'],
  },
  {
    id: 'doc-drug-consumable-rules',
    knowledgeBaseId: 'kb-outpatient-policy',
    title: '药占比/耗占比管理规则',
    source: '运营管理部 / 药耗结构治理规则 v2026.04',
    type: '业务规则',
    updatedAt: '2026-04-28',
    applicableScenes: ['药占比分析', '耗占比分析', '费用结构异常识别'],
    tags: ['药占比', '耗占比', '异常阈值'],
  },
  {
    id: 'doc-department-revenue',
    knowledgeBaseId: 'kb-inpatient-policy',
    title: '科室收入归属说明',
    source: '财务处 / 科室经营归属规则 v2026.03',
    type: '指标口径',
    updatedAt: '2026-03-31',
    applicableScenes: ['科室收入排行', '住院经营分析', '收入结构拆分'],
    tags: ['科室收入', '归属规则', '住院收入'],
  },
  {
    id: 'doc-patient-privacy',
    knowledgeBaseId: 'kb-governance-compliance',
    title: '患者隐私与明细展示规则',
    source: '数据治理委员会 / 医疗数据安全规范 v2026.05',
    type: '权限规则',
    updatedAt: '2026-05-18',
    applicableScenes: ['患者明细查询', '敏感字段展示', '报告导出'],
    tags: ['患者明细', '隐私', '脱敏', '权限'],
  },
  {
    id: 'doc-operation-daily',
    knowledgeBaseId: 'kb-outpatient-policy',
    title: '经营日报口径说明',
    source: '经营分析部 / 经营日报模板说明 v2026.05',
    type: '统计口径',
    updatedAt: '2026-05-22',
    applicableScenes: ['经营日报', '日报推送', '管理层摘要'],
    tags: ['经营日报', '日报', '异常提示'],
  },
];

export const knowledgeSnippets: KnowledgeSnippet[] = [
  {
    id: 'snippet-outpatient-revenue-settlement',
    documentId: 'doc-outpatient-revenue',
    summary: '门诊收入默认按结算日期统计，包含挂号、检查、检验、治疗、药品等门诊收费项目；退费按结算日冲减。',
    keywords: ['门诊收入', '门诊总收入', '收入', '结算日期', '退费', '收费'],
    metricIds: ['metric-outpatient-revenue', 'metric-inspection-revenue'],
    dimensionIds: ['dim-visit-date', 'dim-department', 'dim-fee-group'],
    skillIds: ['skill-outpatient-ops', 'skill-department-revenue'],
    datasetIds: ['semantic-outpatient'],
    confidence: '高',
  },
  {
    id: 'snippet-drug-ratio-rule',
    documentId: 'doc-drug-consumable-rules',
    summary: '药占比按药品费用除以总费用计算，经营分析中通常同时观察门诊量、处方结构和重点科室贡献，避免只看单一占比。',
    keywords: ['药占比', '药品费用', '处方结构', '费用结构', '占比', '上升', '下降'],
    metricIds: ['metric-drug-ratio', 'metric-total-fee'],
    dimensionIds: ['dim-department', 'dim-fee-group', 'dim-visit-date'],
    skillIds: ['skill-pharmacy-structure', 'skill-outpatient-ops'],
    datasetIds: ['semantic-outpatient', 'semantic-inpatient'],
    confidence: '高',
  },
  {
    id: 'snippet-consumable-threshold',
    documentId: 'doc-drug-consumable-rules',
    summary: '耗占比或高值耗材费用连续两期高于阈值时，应优先按科室、病种组、费用组拆解贡献，再复核是否存在结构偏移。',
    keywords: ['耗占比', '高值耗材', '异常费用', '阈值', '结构偏移', '费用波动'],
    metricIds: ['metric-consumable-ratio', 'metric-high-value-consumable'],
    dimensionIds: ['dim-department', 'dim-disease-group', 'dim-fee-group'],
    skillIds: ['skill-pharmacy-structure', 'skill-abnormal-fee'],
    datasetIds: ['semantic-outpatient', 'semantic-inpatient'],
    confidence: '高',
  },
  {
    id: 'snippet-department-revenue-owner',
    documentId: 'doc-department-revenue',
    summary: '科室收入默认归属到执行科室；涉及检查、检验等协作项目时，需确认当前报表是否切换为开单科室口径。',
    keywords: ['科室收入', '执行科室', '开单科室', '收入归属', '检查收入', '住院收入'],
    metricIds: ['metric-inpatient-revenue', 'metric-inspection-revenue', 'metric-outpatient-revenue'],
    dimensionIds: ['dim-department', 'dim-doctor', 'dim-fee-group'],
    skillIds: ['skill-department-revenue'],
    datasetIds: ['semantic-outpatient', 'semantic-inpatient'],
    confidence: '中',
    conflictNote: '若当前业务要求使用开单科室口径，应先确认口径后再输出最终排行。',
  },
  {
    id: 'snippet-patient-detail-privacy',
    documentId: 'doc-patient-privacy',
    summary: '默认不向经营分析用户展示患者姓名、证件号、联系方式、住院号等患者级明细；必要时只返回聚合结果或脱敏统计。',
    keywords: ['患者', '患者明细', '名单', '姓名', '证件号', '住院号', '隐私', '脱敏', '敏感'],
    metricIds: [],
    dimensionIds: ['dim-patient-type', 'dim-department', 'dim-doctor'],
    skillIds: ['skill-patient-flow'],
    datasetIds: ['semantic-outpatient', 'semantic-inpatient'],
    confidence: '高',
  },
  {
    id: 'snippet-operation-daily-scope',
    documentId: 'doc-operation-daily',
    summary: '经营日报默认覆盖昨日门急诊与住院核心指标，异常提示优先展示连续两期异常、收入与流量背离、药耗结构抬升。',
    keywords: ['经营日报', '日报', '昨日', '昨天', '异常提示', '管理层摘要'],
    metricIds: ['metric-outpatient-revenue', 'metric-outpatient-visits', 'metric-drug-ratio', 'metric-inpatient-revenue'],
    dimensionIds: ['dim-visit-date', 'dim-discharge-date', 'dim-department'],
    skillIds: ['skill-outpatient-ops', 'skill-department-revenue', 'skill-patient-flow'],
    datasetIds: ['semantic-outpatient', 'semantic-inpatient'],
    confidence: '高',
  },
];
export const agents: Agent[] = [
  {
    id: 'agent-ask-outpatient',
    name: '门诊经营问答',
    type: 'ask',
    group: 'ask',
    description: '面向门诊经营分析的语义问数助手。',
    creator: 'admin',
    updatedAt: new Date('2026-05-10 09:20:00'),
    status: '已启用',
    skills: ['skill-outpatient-ops', 'skill-pharmacy-structure'],
    datasetIds: ['semantic-outpatient'],
    isDefault: true,
    responseStyle: '经营分析口径优先，默认展示指标解释和 SQL 摘要。',
    showSql: true,
    allowExport: true,
    allowCrossDataset: false,
    anomalyPolicy: '药占比、耗占比和收入波动超过阈值时提示异常。',
    exampleQuestions: [
      '上月门诊总收入和药占比情况如何？',
      '今年以来门诊检查收入变化趋势如何？',
      '眼科近三个月门诊量是否异常？',
      '门诊治疗收入贡献最大的三个科室是哪些？',
    ],
    capabilitySummary: '自动识别门诊收入、药耗结构和科室贡献。',
  },
  {
    id: 'agent-ask-inpatient',
    name: '住院经营问答',
    type: 'ask',
    group: 'ask',
    description: '面向住院业务和科室经营分析。',
    creator: 'admin',
    updatedAt: new Date('2026-05-12 16:30:00'),
    status: '已启用',
    skills: ['skill-department-revenue', 'skill-patient-flow'],
    datasetIds: ['semantic-inpatient'],
    responseStyle: '先解释住院经营口径，再输出科室和病种下钻建议。',
    showSql: true,
    allowExport: true,
    allowCrossDataset: false,
    anomalyPolicy: '住院收入、平均住院日、高值耗材占比出现异常时触发诊断提示。',
    exampleQuestions: [
      '住院收入增长最快的科室有哪些？',
      '本季度平均住院日变化如何？',
      '住院患者流量高峰主要集中在哪些周？',
      '耗材费用同比增长的主要来源是什么？',
    ],
    capabilitySummary: '支持住院结构分析、患者流量和科室收益问答。',
  },
  {
    id: 'agent-report-daily',
    name: '经营日报',
    type: 'report',
    group: 'report',
    description: '自动生成门急诊和住院经营日报。',
    creator: 'admin',
    updatedAt: new Date('2026-05-15 08:10:00'),
    status: '已启用',
    skills: ['skill-outpatient-ops', 'skill-department-revenue', 'skill-patient-flow'],
    datasetIds: ['semantic-outpatient', 'semantic-inpatient'],
    isDefault: true,
    responseStyle: '面向管理层，强调摘要、异常项和可推送报告片段。',
    showSql: false,
    allowExport: true,
    allowCrossDataset: true,
    anomalyPolicy: '日报中自动突出连续两期异常和重点科室贡献。',
    exampleQuestions: [
      '生成昨天的门诊经营日报。',
      '给我做一份本周门急诊周报。',
      '输出本月经营月报并突出异常项。',
      '做一个节假日运营专题分析。',
    ],
    capabilitySummary: '支持日报、周报、月报和专题报告自动生成。',
    reportConfig: {
      theme: '门急诊经营分析',
      metrics: ['门诊收入', '门诊量', '药占比', '检查收入'],
      scheduleEnabled: true,
      boundTemplateIds: ['template-operation-daily', 'template-dept-monthly'],
      defaultTemplateId: 'template-operation-daily',
      autoMatchTemplate: true,
    },
  },
  {
    id: 'agent-report-special',
    name: '药耗结构专题报告',
    type: 'report',
    group: 'report',
    description: '针对固定主题生成可视化 BI 专题报告。',
    creator: 'lxy',
    updatedAt: new Date('2026-05-16 14:45:00'),
    status: '已启用',
    skills: ['skill-pharmacy-structure', 'skill-abnormal-fee', 'skill-patient-flow'],
    datasetIds: ['semantic-outpatient', 'semantic-inpatient'],
    responseStyle: '专题报告优先展示结构拆分、异常提示和治理建议。',
    showSql: false,
    allowExport: true,
    allowCrossDataset: true,
    anomalyPolicy: '药耗结构和异常费用组持续偏离时生成专题风险提示。',
    exampleQuestions: [
      '生成一份药耗结构专题分析。',
      '围绕眼科业务做一份专题经营报告。',
      '输出异常费用专题并给出结论。',
      '做一个患者流量变化专题分析。',
    ],
    capabilitySummary: '支持多图表编排、异常提示和专题导出。',
    reportConfig: {
      theme: '专题经营分析',
      metrics: ['药占比', '耗占比', '异常费用组'],
      scheduleEnabled: true,
      boundTemplateIds: ['template-pharmacy-structure', 'template-abnormal-fee'],
      defaultTemplateId: 'template-pharmacy-structure',
      autoMatchTemplate: true,
    },
  },
  {
    id: 'agent-rca-expense',
    name: '费用波动深度分析',
    type: 'rca',
    group: 'rca',
    description: '面向费用波动、结构异常和维度贡献归因。',
    creator: 'admin',
    updatedAt: new Date('2026-05-18 11:30:00'),
    status: '已启用',
    skills: ['skill-abnormal-fee', 'skill-pharmacy-structure', 'skill-department-revenue'],
    datasetIds: ['semantic-outpatient', 'semantic-inpatient'],
    isDefault: true,
    responseStyle: '围绕异常指标逐层下钻，输出候选根因和证据链。',
    showSql: true,
    allowExport: true,
    allowCrossDataset: false,
    anomalyPolicy: '费用波动超过历史区间时按科室、病种、费用组分解贡献。',
    exampleQuestions: [
      '为什么本月门诊药品费用上升？',
      '检查收入下降的主要原因是什么？',
      '最近两周异常费用群组有哪些？',
      '哪个维度导致住院收入偏离目标？',
    ],
    capabilitySummary: '支持维度贡献、结构变化和异常群组归因。',
    rcaConfig: {
      drilldownStrategy: '总体到科室到费用组',
      ruleSet: ['异常波动规则', '结构占比规则'],
      statisticalMethod: '环比 + 同比 + 贡献度',
    },
  },
  {
    id: 'agent-rca-diagnosis',
    name: '经营诊断深度分析',
    type: 'rca',
    group: 'rca',
    description: '面向经营专题诊断和开放式归因问答。',
    creator: 'lxy',
    updatedAt: new Date('2026-05-19 15:00:00'),
    status: '已启用',
    skills: ['skill-abnormal-fee', 'skill-patient-flow', 'skill-custom-surgery'],
    datasetIds: ['semantic-inpatient', 'semantic-outpatient'],
    responseStyle: '先给出诊断链路，再展示关键维度和候选业务假设。',
    showSql: true,
    allowExport: true,
    allowCrossDataset: true,
    anomalyPolicy: '目标偏离、流量下滑和手术量波动触发专题诊断。',
    exampleQuestions: [
      '为什么眼科本季度收入未达目标？',
      '本周患者流量下滑的根因有哪些？',
      '专题诊断一下骨科住院经营情况。',
      '最近手术量下降主要受什么影响？',
    ],
    capabilitySummary: '支持经营诊断、专题归因和候选根因排序。',
    rcaConfig: {
      drilldownStrategy: '总体到时间到结构到异常分组',
      ruleSet: ['专题诊断规则', '业务假设匹配'],
      statisticalMethod: '趋势分解 + 异常识别',
    },
  },
];

export const reportTemplates: ReportTemplate[] = [
  {
    id: 'template-operation-daily',
    name: '经营日报模板',
    description: '面向院级管理层的门急诊与住院经营日报，突出关键指标、异常项和推送摘要。',
    category: '日报',
    version: 'v1.0',
    createdAt: '2026-06-18 09:00',
    status: 'published',
    triggerPhrases: ['经营日报', '日报', '昨天', '今日经营', '门诊经营日报', '住院经营日报'],
    templatePrompt: `你是医院经营分析负责人，请按“日报”方式生成报告。
报告先输出 3 条以内的管理层摘要，再展开关键指标、趋势对比、异常提示和行动建议。
分析时重点关注收入、门诊量/住院量、药占比、耗占比、检查收入和重点科室贡献变化。
结论必须先说业务影响，再说明可能原因；如果缺少口径或周期，请在报告开头标注默认假设。`,
    applicableAgentIds: ['agent-report-daily'],
    datasetIds: ['semantic-outpatient', 'semantic-inpatient'],
    skillIds: ['skill-outpatient-ops', 'skill-department-revenue', 'skill-patient-flow'],
    parameters: [
      { id: 'param-date', name: 'date', label: '统计日期', required: true, defaultValue: '昨天' },
      { id: 'param-hospital', name: 'hospital', label: '院区', required: false, defaultValue: '全院' },
    ],
    analysisSteps: ['识别统计日期和院区', '汇总关键经营指标', '对比昨日与近7日均值', '识别异常科室和费用结构'],
    comparisonMethods: ['环比', '近7日均值', '目标值对比'],
    anomalyRules: ['连续两期超过阈值', '收入增速与流量增速偏离', '药耗结构异常抬升'],
    attributionPath: ['全院', '科室', '费用组', '时段'],
    sections: [
      { id: 'daily-summary', title: '经营摘要', required: true, description: '给出日报核心结论。' },
      { id: 'daily-metrics', title: '关键指标', required: true, description: '展示收入、流量和结构指标。' },
      { id: 'daily-alerts', title: '异常提示', required: true, description: '突出需要关注的异常项。' },
      { id: 'daily-actions', title: '管理建议', required: false, description: '给出排班和资源投放建议。' },
    ],
    metricBlocks: [
      { id: 'metric-outpatient-revenue-daily', metricId: 'metric-outpatient-revenue', label: '门诊收入', dimensionIds: ['dim-visit-date', 'dim-department'], comparison: ['环比'] },
      { id: 'metric-outpatient-visits-daily', metricId: 'metric-outpatient-visits', label: '门诊量', dimensionIds: ['dim-visit-date', 'dim-department'], comparison: ['近7日均值'] },
      { id: 'metric-drug-ratio-daily', metricId: 'metric-drug-ratio', label: '药占比', dimensionIds: ['dim-visit-date', 'dim-fee-group'], comparison: ['阈值'] },
    ],
    chartBlocks: [
      { id: 'chart-daily-trend', title: '关键经营指标趋势', type: 'bar', metricIds: ['metric-outpatient-revenue', 'metric-outpatient-visits'], dimensionIds: ['dim-visit-date'], sortBy: 'date' },
    ],
    outputFormats: ['PDF', 'PNG', 'CSV'],
    pushChannels: ['站内消息', '邮件'],
    complianceNotes: ['报告仅反映经营统计口径，不用于临床诊断。', '敏感指标需遵循当前用户的数据权限。'],
  },
  {
    id: 'template-dept-monthly',
    name: '科室运营月报模板',
    description: '面向科室负责人的月度运营报告，强调趋势、同比环比、结构拆解和管理建议。',
    category: '月报',
    version: 'v1.0',
    createdAt: '2026-06-17 10:30',
    status: 'published',
    triggerPhrases: ['科室运营月报', '运营月报', '月报', '本月', '上月', '科室经营'],
    templatePrompt: `你是科室运营分析专家，请按“月报”方式生成结构化报告。
报告结构包含：科室总览、同比环比趋势、收入/流量/费用结构拆解、异常科室或病种提示、下月管理建议。
分析时优先解释趋势背后的结构变化，不只罗列数字；需要突出对科室负责人的可执行动作。
输出语气面向经营管理场景，结论清晰、证据充分、建议具体。`,
    applicableAgentIds: ['agent-report-daily'],
    datasetIds: ['semantic-outpatient', 'semantic-inpatient'],
    skillIds: ['skill-department-revenue', 'skill-patient-flow', 'skill-pharmacy-structure'],
    parameters: [
      { id: 'param-month', name: 'month', label: '统计月份', required: true, defaultValue: '本月' },
      { id: 'param-department', name: 'department', label: '科室', required: true },
    ],
    analysisSteps: ['识别月份与科室', '计算同比环比', '拆解流量、收入和费用结构', '输出科室经营建议'],
    comparisonMethods: ['同比', '环比', '全院均值对比'],
    anomalyRules: ['科室收入偏离目标', '平均费用异常抬升', '流量与收入趋势背离'],
    attributionPath: ['科室', '医生组', '病种组', '费用组'],
    sections: [
      { id: 'dept-overview', title: '科室总览', required: true, description: '概览科室月度表现。' },
      { id: 'dept-trend', title: '趋势对比', required: true, description: '展示同比和环比变化。' },
      { id: 'dept-structure', title: '结构拆解', required: true, description: '按病种、医生和费用组拆解。' },
      { id: 'dept-suggestion', title: '经营建议', required: true, description: '给出科室管理动作。' },
    ],
    metricBlocks: [
      { id: 'metric-inpatient-revenue-monthly', metricId: 'metric-inpatient-revenue', label: '住院收入', dimensionIds: ['dim-department', 'dim-discharge-date'], comparison: ['同比', '环比'] },
      { id: 'metric-average-los-monthly', metricId: 'metric-average-length-of-stay', label: '平均住院日', dimensionIds: ['dim-department', 'dim-disease-group'], comparison: ['全院均值'] },
      { id: 'metric-consumable-ratio-monthly', metricId: 'metric-consumable-ratio', label: '耗占比', dimensionIds: ['dim-department', 'dim-fee-group'], comparison: ['阈值'] },
    ],
    chartBlocks: [
      { id: 'chart-dept-monthly', title: '科室运营趋势', type: 'line', metricIds: ['metric-inpatient-revenue', 'metric-average-length-of-stay'], dimensionIds: ['dim-discharge-date'], sortBy: 'month' },
    ],
    outputFormats: ['PDF', 'PNG', 'CSV'],
    pushChannels: ['邮件'],
    complianceNotes: ['科室对比需说明统计时间与出院口径。', '涉及医生组时需遵循绩效数据权限。'],
  },
  {
    id: 'template-pharmacy-structure',
    name: '药耗结构专题模板',
    description: '围绕药占比、耗占比和费用结构变化生成专题报告。',
    category: '专题',
    version: 'v1.1',
    createdAt: '2026-06-16 14:20',
    status: 'published',
    triggerPhrases: ['药耗结构', '药占比', '耗占比', '费用结构', '药耗专题'],
    templatePrompt: `你是药耗结构专题分析专家，请围绕药占比、耗占比和费用结构变化生成专题报告。
报告先判断总体是否异常，再拆解到费用组、科室、病种或项目，并说明主要贡献项。
对异常项要给出可复核线索，例如变化幅度、连续期数、贡献排名和建议复核方向。
最后输出控费、结构优化或进一步核查建议，避免直接给出临床诊断结论。`,
    applicableAgentIds: ['agent-report-special'],
    datasetIds: ['semantic-outpatient', 'semantic-inpatient'],
    skillIds: ['skill-pharmacy-structure', 'skill-abnormal-fee', 'skill-department-revenue'],
    parameters: [
      { id: 'param-range', name: 'range', label: '统计周期', required: true, defaultValue: '本月' },
      { id: 'param-scope', name: 'scope', label: '分析范围', required: false, defaultValue: '全院' },
    ],
    analysisSteps: ['识别药耗指标范围', '拆解药品、耗材、检查和治疗费用', '定位异常费用组', '生成治理建议'],
    comparisonMethods: ['环比', '同比', '阈值对比'],
    anomalyRules: ['药占比超过阈值', '耗占比连续抬升', '高值耗材费用组异常'],
    attributionPath: ['费用组', '科室', '病种组', '项目'],
    sections: [
      { id: 'pharmacy-summary', title: '专题摘要', required: true, description: '总结药耗结构变化。' },
      { id: 'pharmacy-breakdown', title: '费用结构拆解', required: true, description: '拆解药品和耗材贡献。' },
      { id: 'pharmacy-alerts', title: '异常费用组', required: true, description: '列出异常费用组和证据。' },
      { id: 'pharmacy-actions', title: '治理建议', required: true, description: '输出控费和复核建议。' },
    ],
    metricBlocks: [
      { id: 'metric-drug-ratio-special', metricId: 'metric-drug-ratio', label: '药占比', dimensionIds: ['dim-fee-group', 'dim-department'], comparison: ['阈值', '环比'] },
      { id: 'metric-consumable-ratio-special', metricId: 'metric-consumable-ratio', label: '耗占比', dimensionIds: ['dim-fee-group', 'dim-department'], comparison: ['阈值', '环比'] },
      { id: 'metric-high-value-special', metricId: 'metric-high-value-consumable', label: '高值耗材费用', dimensionIds: ['dim-fee-group', 'dim-disease-group'], comparison: ['同比'] },
    ],
    chartBlocks: [
      { id: 'chart-pharmacy-structure', title: '费用结构分布', type: 'pie', metricIds: ['metric-drug-ratio', 'metric-consumable-ratio'], dimensionIds: ['dim-fee-group'], sortBy: 'value' },
    ],
    outputFormats: ['PDF', 'PNG', 'CSV'],
    pushChannels: ['邮件', '站内消息'],
    complianceNotes: ['费用结构报告应说明药品、耗材和治疗费用口径。', '异常提示用于经营复核，不直接作为医疗质量结论。'],
  },
  {
    id: 'template-abnormal-fee',
    name: '异常费用专题模板',
    description: '聚焦异常费用组、异常记录和候选原因的专题复核报告。',
    category: '专题',
    version: 'v1.0',
    createdAt: '2026-06-15 16:45',
    status: 'published',
    triggerPhrases: ['异常费用', '费用异常', '异常费用专题', '费用波动', '异常组'],
    templatePrompt: `你是异常费用复核分析专家，请按“异常概览 -> 异常聚类 -> 证据链 -> 复核建议”的结构生成报告。
先界定观察期、影响范围和异常等级，再列出主要异常费用组及其贡献。
分析中要区分经营异常、结构变化和可能的数据口径问题；每个结论都要附带可复核的数据线索。
报告末尾给出下一步人工复核路径和优先级。`,
    applicableAgentIds: ['agent-report-special'],
    datasetIds: ['semantic-outpatient', 'semantic-inpatient'],
    skillIds: ['skill-abnormal-fee', 'skill-pharmacy-structure', 'skill-patient-flow'],
    parameters: [
      { id: 'param-period', name: 'period', label: '异常观察期', required: true, defaultValue: '最近30天' },
      { id: 'param-threshold', name: 'threshold', label: '异常阈值', required: false, defaultValue: '系统默认' },
    ],
    analysisSteps: ['确定异常观察期', '识别异常费用组', '聚类异常记录', '输出复核路径和候选原因'],
    comparisonMethods: ['历史区间', '阈值对比', '同类病例对比'],
    anomalyRules: ['费用组超过历史区间', '单项目费用异常抬升', '同类病例费用偏离'],
    attributionPath: ['异常费用组', '科室', '病种组', '项目', '病例'],
    sections: [
      { id: 'abnormal-overview', title: '异常概览', required: true, description: '概览异常数量和影响范围。' },
      { id: 'abnormal-cluster', title: '异常聚类', required: true, description: '展示异常费用组和记录聚类。' },
      { id: 'abnormal-evidence', title: '证据链', required: true, description: '列出规则命中和数据证据。' },
      { id: 'abnormal-next', title: '复核建议', required: true, description: '输出后续复核动作。' },
    ],
    metricBlocks: [
      { id: 'metric-total-fee-abnormal', metricId: 'metric-total-fee', label: '总费用', dimensionIds: ['dim-fee-group', 'dim-department'], comparison: ['历史区间'] },
      { id: 'metric-high-value-abnormal', metricId: 'metric-high-value-consumable', label: '高值耗材费用', dimensionIds: ['dim-fee-group', 'dim-item'], comparison: ['阈值'] },
    ],
    chartBlocks: [
      { id: 'chart-abnormal-fee', title: '异常费用组贡献', type: 'bar', metricIds: ['metric-total-fee', 'metric-high-value-consumable'], dimensionIds: ['dim-fee-group'], sortBy: 'contribution' },
    ],
    outputFormats: ['PDF', 'PNG'],
    pushChannels: ['站内消息'],
    complianceNotes: ['异常费用结果需要人工复核后再进入治理流程。', '病例级明细受权限控制，默认只展示汇总证据。'],
  },
];

export const reportSubscriptions: ReportSubscription[] = [
  {
    id: 'sub-operation-daily',
    name: '院级经营日报推送',
    reportTemplateId: 'template-operation-daily',
    agentId: 'agent-report-daily',
    reportTheme: '门急诊与住院经营日报',
    period: '昨日',
    frequency: 'daily',
    runTime: '08:00',
    timezone: 'Asia/Shanghai',
    holidayPolicy: 'run',
    recipients: ['医院经营班子', '经营分析组'],
    channels: ['站内消息', '邮件'],
    outputFormats: ['在线报告链接', 'PDF 附件'],
    permissionPolicy: '按收件人权限自动脱敏，默认仅展示汇总指标。',
    nextRunAt: '2026-07-02 08:00',
    lastRunAt: '2026-07-01 08:00',
    lastStatus: '成功',
    status: 'running',
    retryLimit: 3,
    createdBy: 'admin',
    createdAt: '2026-06-20 10:12',
    updatedAt: '2026-07-01 08:03',
    runs: [
      {
        id: 'run-operation-daily-20260701',
        subscriptionId: 'sub-operation-daily',
        generatedAt: '2026-07-01 08:00',
        reportTitle: '2026-06-30 院级经营日报',
        status: '成功',
        retryCount: 0,
        link: '/report/preview/report-1',
      },
    ],
    pushRecords: [
      {
        id: 'push-operation-daily-1',
        channel: '站内消息',
        target: '医院经营班子',
        sentAt: '2026-07-01 08:01',
        status: '成功',
        note: '已推送至 12 位接收人',
      },
      {
        id: 'push-operation-daily-2',
        channel: '邮件',
        target: '经营分析组',
        sentAt: '2026-07-01 08:02',
        status: '成功',
        note: '邮件正文包含摘要、关键指标和完整报告链接',
      },
    ],
  },
  {
    id: 'sub-pharmacy-weekly',
    name: '药耗结构周报',
    reportTemplateId: 'template-pharmacy-structure',
    agentId: 'agent-report-special',
    reportTheme: '药耗结构与异常费用专题',
    period: '上周',
    frequency: 'weekly',
    runTime: '08:30',
    timezone: 'Asia/Shanghai',
    holidayPolicy: 'next_workday',
    recipients: ['医务管理组', '药事管理组'],
    channels: ['邮件'],
    outputFormats: ['在线报告链接', 'PDF 附件'],
    permissionPolicy: '按用户组过滤科室明细，患者级数据默认不进入报告。',
    nextRunAt: '2026-07-06 08:30',
    lastRunAt: '2026-06-29 08:30',
    lastStatus: '重试中',
    status: 'running',
    retryLimit: 3,
    createdBy: 'lxy',
    createdAt: '2026-06-22 15:30',
    updatedAt: '2026-06-29 08:36',
    runs: [
      {
        id: 'run-pharmacy-weekly-20260629',
        subscriptionId: 'sub-pharmacy-weekly',
        generatedAt: '2026-06-29 08:30',
        reportTitle: '药耗结构周报',
        status: '重试中',
        retryCount: 1,
        failureReason: '1 个邮箱退信，等待第二次重试。',
        link: '/report/preview/report-2',
      },
    ],
    pushRecords: [
      {
        id: 'push-pharmacy-weekly-1',
        channel: '邮件',
        target: '药事管理组',
        sentAt: '2026-06-29 08:33',
        status: '失败',
        note: '1 个邮箱退信，待重试',
      },
    ],
  },
  {
    id: 'sub-dept-monthly-attention',
    name: '科室运营月报',
    reportTemplateId: 'template-dept-monthly',
    agentId: 'agent-report-daily',
    reportTheme: '重点科室运营月报',
    period: '上月',
    frequency: 'monthly',
    runTime: '09:00',
    timezone: 'Asia/Shanghai',
    holidayPolicy: 'skip',
    recipients: ['科室负责人'],
    channels: ['站内消息'],
    outputFormats: ['在线报告链接'],
    permissionPolicy: '收件人仅查看本人负责科室及汇总对比。',
    nextRunAt: '2026-08-01 09:00',
    lastRunAt: '2026-07-01 09:00',
    lastStatus: '失败',
    status: 'needs_attention',
    retryLimit: 3,
    createdBy: 'admin',
    createdAt: '2026-06-25 11:06',
    updatedAt: '2026-07-01 09:04',
    runs: [
      {
        id: 'run-dept-monthly-20260701',
        subscriptionId: 'sub-dept-monthly-attention',
        generatedAt: '2026-07-01 09:00',
        reportTitle: '2026-06 科室运营月报',
        status: '失败',
        retryCount: 3,
        failureReason: '模板参数“科室”未配置默认值，需要补充订阅参数。',
        link: '/report/preview/report-3',
      },
    ],
    pushRecords: [
      {
        id: 'push-dept-monthly-1',
        channel: '站内消息',
        target: '科室负责人',
        sentAt: '2026-07-01 09:04',
        status: '失败',
        note: '报告生成失败，未触达接收人',
      },
    ],
  },
];

export const mcpServers: McpServer[] = [
  {
    id: 'mcp-his-query',
    name: 'HIS 经营数据 MCP',
    businessDomain: '门急诊/住院经营',
    endpoint: 'https://mcp.medical.local/his/mcp',
    transport: 'Streamable HTTP',
    authType: 'OAuth 2.1',
    authConfigName: 'his-oauth-prod',
    owner: '经营分析部',
    environment: '生产',
    status: '已启用',
    healthStatus: '正常',
    lastSyncedAt: '2026-06-16 21:30',
    updatedAt: '2026-06-16 21:30',
    capabilities: [
      {
        id: 'cap-his-query-charge',
        serverId: 'mcp-his-query',
        name: 'query_charge_summary',
        kind: 'tool',
        description: '按科室、费用组和时间范围查询收费汇总数据。',
        inputSchema: '{ department?: string; dateRange: [string, string]; feeGroup?: string }',
        outputSchema: '{ rows: ChargeSummary[]; totalAmount: number; rowCount: number }',
        scopes: ['charge.read.summary', 'department.read'],
        tags: ['只读查询', '经营汇总'],
        sideEffect: false,
        riskLevel: '低',
        enabled: true,
        agentIds: ['agent-ask-outpatient', 'agent-report-daily', 'agent-rca-expense'],
        skillIds: ['skill-outpatient-ops', 'skill-department-revenue'],
      },
      {
        id: 'cap-his-query-patient-detail',
        serverId: 'mcp-his-query',
        name: 'query_patient_detail',
        kind: 'tool',
        description: '按授权条件查询脱敏患者级就诊明细，用于异常样本核验。',
        inputSchema: '{ visitIds: string[]; fields: string[]; desensitize: boolean }',
        outputSchema: '{ rows: PatientVisit[]; maskedFields: string[] }',
        scopes: ['patient.read.masked', 'visit.read.detail'],
        tags: ['患者敏感信息', '脱敏明细'],
        sideEffect: false,
        riskLevel: '高',
        enabled: true,
        agentIds: ['agent-rca-expense'],
        skillIds: ['skill-abnormal-fee'],
      },
    ],
  },
  {
    id: 'mcp-knowledge-governance',
    name: '院内知识库 MCP',
    businessDomain: '口径/制度/合规',
    endpoint: 'https://mcp.medical.local/knowledge/mcp',
    transport: 'Streamable HTTP',
    authType: 'OAuth 2.1',
    authConfigName: 'knowledge-oauth-prod',
    owner: '数据治理委员会',
    environment: '生产',
    status: '已启用',
    healthStatus: '正常',
    lastSyncedAt: '2026-06-15 18:05',
    updatedAt: '2026-06-15 18:05',
    capabilities: [
      {
        id: 'cap-knowledge-search-policy',
        serverId: 'mcp-knowledge-governance',
        name: 'search_policy_snippets',
        kind: 'tool',
        description: '检索指标口径、权限规则和经营分析制度片段。',
        inputSchema: '{ query: string; tags?: string[]; topK?: number }',
        outputSchema: '{ snippets: PolicySnippet[]; citations: Citation[] }',
        scopes: ['knowledge.read.policy'],
        tags: ['只读查询', '口径检索'],
        sideEffect: false,
        riskLevel: '低',
        enabled: true,
        agentIds: ['agent-ask-outpatient', 'agent-report-daily', 'agent-rca-diagnosis'],
        skillIds: ['skill-outpatient-ops', 'skill-pharmacy-structure', 'skill-abnormal-fee'],
      },
      {
        id: 'cap-knowledge-resource-policy',
        serverId: 'mcp-knowledge-governance',
        name: 'policy://medical-governance',
        kind: 'resource',
        description: '医疗数据治理规则资源目录。',
        inputSchema: 'uri: policy://medical-governance/{documentId}',
        outputSchema: 'text/markdown',
        scopes: ['knowledge.read.policy'],
        tags: ['资源能力', '合规说明'],
        sideEffect: false,
        riskLevel: '低',
        enabled: true,
        agentIds: ['agent-ask-outpatient', 'agent-report-daily'],
        skillIds: ['skill-outpatient-ops'],
      },
    ],
  },
  {
    id: 'mcp-insurance-reconcile',
    name: '医保对账 MCP',
    businessDomain: '医保结算',
    endpoint: 'https://mcp.medical.local/insurance/mcp',
    transport: 'Streamable HTTP',
    authType: 'OAuth 2.1',
    authConfigName: 'insurance-oauth-test',
    owner: '医保办',
    environment: '测试',
    status: '已停用',
    healthStatus: '异常',
    lastSyncedAt: '2026-06-10 11:12',
    updatedAt: '2026-06-10 11:12',
    capabilities: [
      {
        id: 'cap-insurance-reconcile',
        serverId: 'mcp-insurance-reconcile',
        name: 'run_insurance_reconcile',
        kind: 'tool',
        description: '发起指定批次的医保结算差异核对任务。',
        inputSchema: '{ batchNo: string; dateRange: [string, string] }',
        outputSchema: '{ taskId: string; rejectedCount: number; warningCount: number }',
        scopes: ['insurance.reconcile.write', 'insurance.read.summary'],
        tags: ['写入操作', '医保对账'],
        sideEffect: true,
        riskLevel: '高',
        enabled: true,
        agentIds: ['agent-report-special'],
        skillIds: ['skill-abnormal-fee'],
      },
    ],
  },
  {
    id: 'mcp-ultrasound-analysis',
    name: '超声检查分析 MCP',
    businessDomain: '超声检查',
    endpoint: 'https://mcp.medical.local/ultrasound/mcp',
    transport: 'Streamable HTTP',
    authType: 'OAuth 2.1',
    authConfigName: 'ultrasound-oauth-test',
    owner: '超声医学科',
    environment: '测试',
    status: '已启用',
    healthStatus: '正常',
    lastSyncedAt: '2026-06-17 13:20',
    updatedAt: '2026-06-17 13:20',
    capabilities: [
      {
        id: 'cap-ultrasound-positive-rate',
        serverId: 'mcp-ultrasound-analysis',
        name: 'analyze_ultrasound_positive_rate',
        kind: 'tool',
        description: '按科室、部位和时间范围分析超声检查阳性率及异常波动。',
        inputSchema: '{ dateRange: [string, string]; department?: string; bodyPart?: string }',
        outputSchema: '{ positiveRate: number; trend: TrendPoint[]; contributors: Contributor[] }',
        scopes: ['ultrasound.read.summary'],
        tags: ['只读分析', '超声阳性率'],
        sideEffect: false,
        riskLevel: '中',
        enabled: true,
        agentIds: ['agent-ask-outpatient', 'agent-report-special', 'agent-rca-diagnosis'],
        skillIds: ['skill-department-revenue', 'skill-patient-flow'],
      },
    ],
  },
];

export const mcpAuditLogs: McpAuditLog[] = [
  {
    id: 'mcp-audit-1',
    calledAt: '2026-06-16 21:42:08',
    user: 'admin',
    agentId: 'agent-ask-outpatient',
    skillId: 'skill-outpatient-ops',
    serverId: 'mcp-his-query',
    capabilityId: 'cap-his-query-charge',
    status: '成功',
    durationMs: 842,
    reason: '用户询问门诊收入与费用组结构，命中经营汇总查询能力。',
    inputSummary: 'dateRange=2026-05-01~2026-05-31, feeGroup=全部',
    resultSummary: '返回 18 行科室费用汇总，合计金额 482.6 万。',
  },
  {
    id: 'mcp-audit-2',
    calledAt: '2026-06-16 20:18:31',
    user: 'admin',
    agentId: 'agent-rca-expense',
    skillId: 'skill-abnormal-fee',
    serverId: 'mcp-his-query',
    capabilityId: 'cap-his-query-patient-detail',
    status: '拦截',
    durationMs: 0,
    reason: '患者明细工具包含敏感字段，当前会话改用脱敏聚合结果。',
    inputSummary: 'visitIds=27 条, fields=patientName/chargeAmount/doctorName',
    resultSummary: '未调用外部服务，提示使用脱敏聚合结果。',
  },
  {
    id: 'mcp-audit-3',
    calledAt: '2026-06-15 18:12:54',
    user: 'lxy',
    agentId: 'agent-report-daily',
    skillId: 'skill-pharmacy-structure',
    serverId: 'mcp-knowledge-governance',
    capabilityId: 'cap-knowledge-search-policy',
    status: '成功',
    durationMs: 316,
    reason: '生成日报时补充药占比和耗占比口径引用。',
    inputSummary: 'query=药占比 耗占比 管理规则, topK=5',
    resultSummary: '返回 5 条制度片段和 3 个引用来源。',
  },
];

export const databases: DatabaseConnection[] = [
  {
    id: 1,
    name: '医疗数据',
    type: 'PostgreSQL',
    jdbcUrl: 'jdbc:postgresql://192.168.11.39:5432/medical_dw',
    username: 'admin',
    password: 'medical123',
    databaseName: '医院数据',
    admins: ['admin'],
    users: ['admin'],
    creator: 'admin',
    description: '门急诊、住院、收费和药耗经营数据。',
    updatedAt: '2026-05-11 18:20',
  },
  {
    id: 2,
    name: '汽车数据',
    type: 'MySQL',
    jdbcUrl: 'jdbc:mysql://192.168.11.40:3306/auto_bi',
    username: 'liyue',
    password: 'auto123',
    databaseName: '汽车数据',
    admins: ['liyue'],
    users: ['admin', 'liyue'],
    creator: 'liyue',
    description: '汽车销售、售后和经营分析数据。',
    updatedAt: '2026-05-17 11:05',
  },
];

export const llmConnections: LlmConnection[] = [
  {
    id: 1,
    connectionName: 'OpenAI 模型 DEMO',
    modelName: 'gpt-4o-mini',
    version: 'OPEN_AI',
    creator: 'admin',
    description: '通用语义问答与经营分析演示模型。',
    updatedAt: '2026-05-09 09:40',
  },
  {
    id: 2,
    connectionName: 'Qwen Plus',
    modelName: 'qwen-plus',
    version: 'OPEN_AI',
    creator: 'admin',
    description: '报告生成与长上下文分析。',
    updatedAt: '2026-05-13 15:20',
  },
  {
    id: 3,
    connectionName: 'DeepSeek V3',
    modelName: 'deepseek-v3',
    version: 'HTTP',
    creator: 'lxy',
    description: '深度分析实验模型。',
    updatedAt: '2026-05-19 17:30',
  },
];

export const dimensionSemantics: DimensionSemantic[] = [
  {
    id: 'dim-hospital',
    name: 'hospital',
    label: '医院',
    description: '用于组织层级的顶层经营分析。',
    type: '普通',
    synonyms: ['医院', '院区医院'],
    hierarchyId: 'org-clinic',
    memberResolver: 'dictionary',
    bindings: [
      { id: 'bind-outpatient-hospital', datasetId: 'semantic-outpatient', field: 'hospital_name', memberSource: 'dim_hospital', enabled: true },
      { id: 'bind-inpatient-hospital', datasetId: 'semantic-inpatient', field: 'org_name', memberSource: 'dim_hospital', enabled: true },
    ],
  },
  {
    id: 'dim-department',
    name: 'department',
    label: '科室',
    description: '支持门诊、住院科室经营分析和贡献拆分。',
    type: '普通',
    synonyms: ['科室', '门诊科室', '住院科室'],
    hierarchyId: 'org-clinic',
    memberResolver: 'dictionary',
    bindings: [
      { id: 'bind-outpatient-department', datasetId: 'semantic-outpatient', field: 'department_name', memberSource: 'dim_department', enabled: true },
      { id: 'bind-inpatient-department', datasetId: 'semantic-inpatient', field: 'department_name', memberSource: 'dim_department', enabled: true },
    ],
  },
  {
    id: 'dim-doctor',
    name: 'doctor',
    label: '医生',
    description: '支持医生维度追踪与下钻。',
    type: '普通',
    synonyms: ['医生', '医师', '接诊医生'],
    hierarchyId: 'org-clinic',
    memberResolver: 'dictionary',
    bindings: [
      { id: 'bind-outpatient-doctor', datasetId: 'semantic-outpatient', field: 'doctor_name', memberSource: 'dim_doctor', enabled: true },
    ],
  },
  {
    id: 'dim-fee-group',
    name: 'fee_group',
    label: '费用组',
    description: '支持药品、检查、治疗、耗材等结构拆分。',
    type: '普通',
    synonyms: ['费用组', '费用分类', '费用结构'],
    hierarchyId: 'fee-breakdown',
    memberResolver: 'enum',
    bindings: [
      { id: 'bind-outpatient-fee-group', datasetId: 'semantic-outpatient', field: 'fee_group', memberSource: 'dim_fee_item', enabled: true },
      { id: 'bind-inpatient-fee-group', datasetId: 'semantic-inpatient', field: 'fee_group', memberSource: 'fact_inpatient_charge', enabled: true },
    ],
  },
  {
    id: 'dim-item',
    name: 'item',
    label: '项目',
    description: '收费项目或检查项目的最细粒度视角。',
    type: '普通',
    synonyms: ['项目', '收费项目', '检查项目'],
    hierarchyId: 'fee-breakdown',
    memberResolver: 'runtime_search',
    bindings: [
      { id: 'bind-outpatient-item', datasetId: 'semantic-outpatient', field: 'item_name', memberSource: 'dim_fee_item', enabled: true },
    ],
  },
  {
    id: 'dim-patient-type',
    name: 'patient_type',
    label: '患者类型',
    description: '用于新诊、复诊、医保、自费等人群分层。',
    type: '普通',
    synonyms: ['患者类型', '就诊人群', '患者分层'],
    memberResolver: 'enum',
    bindings: [
      { id: 'bind-outpatient-patient-type', datasetId: 'semantic-outpatient', field: 'patient_type', memberSource: 'dim_patient', enabled: true },
    ],
  },
  {
    id: 'dim-disease-group',
    name: 'disease_group',
    label: '病种组',
    description: '支持病种结构变化和平均费用诊断。',
    type: '普通',
    synonyms: ['病种组', '病种', '疾病分组'],
    hierarchyId: 'disease-breakdown',
    memberResolver: 'dictionary',
    bindings: [
      { id: 'bind-inpatient-disease-group', datasetId: 'semantic-inpatient', field: 'disease_group', memberSource: 'dim_disease_group', enabled: true },
    ],
  },
  {
    id: 'dim-visit-date',
    name: 'visit_date',
    label: '就诊日期',
    description: '门诊业务发生的默认统计时间。',
    type: '时间',
    synonyms: ['日期', '时间', '就诊时间', '门诊日期', '业务日期', '发生日期', '按天', '按月'],
    memberResolver: 'runtime_search',
    bindings: [
      { id: 'bind-time-outpatient-visit-date', datasetId: 'semantic-outpatient', field: 'visit_date', memberSource: 'time', enabled: true },
    ],
    timeConfig: {
      fieldRole: '就诊日期',
      supportedGrains: ['日', '周', '月', '季', '年'],
      relativePresets: ['今日', '本周', '本月', '上月', '今年以来', '近7天', '最近30天', '去年同期'],
    },
  },
  {
    id: 'dim-discharge-date',
    name: 'discharge_date',
    label: '出院日期',
    description: '住院经营统计默认使用的时间口径。',
    type: '时间',
    synonyms: ['日期', '时间', '出院时间', '住院结算日期', '离院日期', '住院业务日期', '按天', '按月'],
    memberResolver: 'runtime_search',
    bindings: [
      { id: 'bind-time-inpatient-discharge-date', datasetId: 'semantic-inpatient', field: 'discharge_date', memberSource: 'time', enabled: true },
    ],
    timeConfig: {
      fieldRole: '出院日期',
      supportedGrains: ['日', '周', '月', '季', '年'],
      relativePresets: ['本周', '本月', '本季度', '今年以来', '近7天', '去年同期'],
    },
  },
  {
    id: 'dim-surgery-date',
    name: 'surgery_date',
    label: '手术日期',
    description: '手术量专题默认时间口径。',
    type: '时间',
    synonyms: ['手术时间', '手术发生日期', '手术完成日期'],
    memberResolver: 'runtime_search',
    bindings: [
      { id: 'bind-time-inpatient-surgery-date', datasetId: 'semantic-inpatient', field: 'surgery_date', memberSource: 'time', enabled: true },
    ],
    timeConfig: {
      fieldRole: '手术日期',
      supportedGrains: ['日', '周', '月'],
      relativePresets: ['本周', '本月', '近7天', '最近30天', '去年同期'],
    },
  },
];

export const dimensionMembers: DimensionMember[] = [
  {
    id: 'member-hospital-main',
    dimensionId: 'dim-hospital',
    name: '总院',
    aliases: ['本院', '主院区'],
    valueMappings: [
      { id: 'value-map-hospital-main-outpatient', datasetId: 'semantic-outpatient', rawValues: ['总院'], enabled: true },
      { id: 'value-map-hospital-main-inpatient', datasetId: 'semantic-inpatient', rawValues: ['主院区'], enabled: true },
    ],
  },
  {
    id: 'member-department-cardiology',
    dimensionId: 'dim-department',
    name: '心内科',
    aliases: ['心内', '心血管内科'],
    valueMappings: [
      { id: 'value-map-department-cardiology-outpatient', datasetId: 'semantic-outpatient', rawValues: ['心内科'], enabled: true },
      { id: 'value-map-department-cardiology-inpatient', datasetId: 'semantic-inpatient', rawValues: ['心血管内科'], enabled: true },
    ],
    parentId: 'member-hospital-main',
  },
  {
    id: 'member-department-ophthalmology',
    dimensionId: 'dim-department',
    name: '眼科',
    aliases: ['眼病科'],
    valueMappings: [
      { id: 'value-map-department-ophthalmology-outpatient', datasetId: 'semantic-outpatient', rawValues: ['眼科'], enabled: true },
      { id: 'value-map-department-ophthalmology-inpatient', datasetId: 'semantic-inpatient', rawValues: ['眼病科'], enabled: true },
    ],
    parentId: 'member-hospital-main',
  },
  { id: 'member-doctor-zhang', dimensionId: 'dim-doctor', name: '张医生', aliases: ['张主任', '张医师'], parentId: 'member-department-cardiology' },
  { id: 'member-fee-drug', dimensionId: 'dim-fee-group', name: '药品', aliases: ['药品费用', '药费'] },
  { id: 'member-fee-inspection', dimensionId: 'dim-fee-group', name: '检查', aliases: ['检查类', '检查项目'] },
  { id: 'member-fee-consumable', dimensionId: 'dim-fee-group', name: '高值耗材', aliases: ['耗材', '高值耗材组'] },
  { id: 'member-patient-followup', dimensionId: 'dim-patient-type', name: '复诊', aliases: ['复诊患者'] },
  { id: 'member-disease-ortho', dimensionId: 'dim-disease-group', name: '骨科病种组', aliases: ['骨科病种', '骨科'] },
];

export const semanticDatasets: SemanticDataset[] = [
  {
    id: 'semantic-outpatient',
    name: '门诊经营数据集',
    description: '覆盖门诊收入、患者流量、药耗结构。',
    businessTheme: '门诊经营',
    subjectObject: '就诊',
    sourceName: '医疗数据',
    datasourceCount: 8,
    drilldownRule: '医院 > 科室 > 费用组 > 医生',
    tables: [
      {
        name: 'fact_outpatient_charge',
        type: '事实表',
        fields: [
          { name: 'charge_amount', semanticName: '收费金额', description: '门诊收费确认后的明细金额。' },
          { name: 'visit_id', semanticName: '就诊 ID', description: '门诊就诊唯一标识。' },
          { name: 'visit_date', semanticName: '就诊日期', description: '门诊业务发生日期。' },
          { name: 'hospital_name', semanticName: '医院名称', description: '门诊记录所属医院或院区。' },
          { name: 'doctor_name', semanticName: '医生名称', description: '门诊接诊医生。' },
          { name: 'patient_type', semanticName: '患者类型', description: '新诊、复诊、医保、自费等患者分层。' },
        ],
      },
      {
        name: 'dim_department',
        type: '维度表',
        fields: [
          { name: 'department_id', semanticName: '科室 ID', description: '科室主键。' },
          { name: 'department_name', semanticName: '科室名称', description: '经营分析使用的科室名称。' },
        ],
      },
      {
        name: 'dim_fee_item',
        type: '维度表',
        fields: [
          { name: 'fee_group', semanticName: '费用组', description: '药品、检查、治疗、耗材等费用分类。' },
          { name: 'item_name', semanticName: '收费项目', description: '收费明细项目名称。' },
        ],
      },
    ],
    metricIds: [
      'metric-outpatient-revenue',
      'metric-outpatient-visits',
      'metric-drug-ratio',
      'metric-consumable-ratio',
      'metric-inspection-revenue',
      'metric-total-fee',
      'metric-high-value-consumable',
    ],
    synonyms: ['门诊收入', '门急诊经营', '就诊人次', '药耗结构', '检查收入'],
    permissionScope: '经营分析组、院领导、科室负责人',
    relations: [
      'fact_outpatient_charge.department_id = dim_department.department_id',
      'fact_outpatient_charge.item_id = dim_fee_item.item_id',
      'fact_outpatient_charge.visit_id = fact_outpatient_visit.visit_id',
    ],
    owner: '数据治理组',
    updatedAt: '2026-05-16 10:15',
  },
  {
    id: 'semantic-inpatient',
    name: '住院经营数据集',
    description: '覆盖住院收入、床位、手术和结构变化。',
    businessTheme: '住院经营',
    subjectObject: '住院患者',
    sourceName: '医疗数据',
    datasourceCount: 6,
    drilldownRule: '医院 > 科室 > 病种组 > 费用组',
    tables: [
      {
        name: 'fact_inpatient_charge',
        type: '事实表',
        fields: [
          { name: 'charge_amount', semanticName: '住院收费金额', description: '住院收费确认后的明细金额。' },
          { name: 'admission_id', semanticName: '住院 ID', description: '住院记录唯一标识。' },
          { name: 'discharge_date', semanticName: '出院日期', description: '用于住院经营统计的默认时间字段。' },
          { name: 'org_name', semanticName: '院区组织', description: '住院记录所属医院或院区。' },
          { name: 'department_name', semanticName: '科室名称', description: '住院患者所属科室。' },
          { name: 'fee_group', semanticName: '费用组', description: '住院费用分类。' },
        ],
      },
      {
        name: 'fact_surgery',
        type: '事实表',
        fields: [
          { name: 'surgery_id', semanticName: '手术 ID', description: '手术记录唯一标识。' },
          { name: 'surgery_date', semanticName: '手术日期', description: '用于手术量专题追踪。' },
        ],
      },
      {
        name: 'dim_disease_group',
        type: '维度表',
        fields: [
          { name: 'disease_group', semanticName: '病种组', description: '经营诊断使用的病种分组。' },
          { name: 'severity_level', semanticName: '病例复杂度', description: '用于解释平均费用和住院日变化。' },
        ],
      },
    ],
    metricIds: [
      'metric-inpatient-revenue',
      'metric-inpatient-admissions',
      'metric-average-length-of-stay',
      'metric-surgery-count',
      'metric-total-fee',
      'metric-high-value-consumable',
    ],
    synonyms: ['住院收入', '住院人次', '平均住院日', '手术量', '病种结构'],
    permissionScope: '经营分析组、住院部、院领导',
    relations: [
      'fact_inpatient_charge.admission_id = fact_inpatient_record.admission_id',
      'fact_inpatient_record.disease_group_id = dim_disease_group.disease_group_id',
      'fact_surgery.admission_id = fact_inpatient_record.admission_id',
    ],
    owner: '住院经营数据管理员',
    updatedAt: '2026-05-18 14:25',
  },
];

export const indicatorAssets: IndicatorAsset[] = [
  {
    id: 'metric-outpatient-revenue',
    numericId: 75,
    name: '门诊收入',
    nameEn: 'outpatient_revenue',
    datasetId: 'semantic-outpatient',
    datasetName: '门诊经营数据集',
    type: '原子指标',
    formula: 'SUM(fact_outpatient_charge.charge_amount)',
    businessDefinition: '统计门诊收费确认后的总收入，默认剔除退费记录。',
    availableDimensions: ['日期', '科室', '医生', '费用组'],
    defaultGrain: '日 / 周 / 月',
    sensitivity: '普通',
    status: '已发布',
    creator: 'admin',
    updatedAt: '2026-05-21 10:24:06',
    referencedBy: ['门诊经营分析', '科室收入结构分析', '经营日报 Agent'],
    lineage: ['医疗经营数仓', 'fact_outpatient_charge', 'dim_department', '指标市场'],
    synonyms: ['门诊营收', '门诊收费', '门诊总收入', '门急诊收入'],
    sampleQuestions: ['上月门诊总收入是多少？', '按科室拆分门诊收入贡献。'],
    recentUsage: ['问数 Agent - 门诊经营', '报告 Agent - 经营日报'],
    metricBindings: [
      {
        id: 'bind-metric-outpatient-revenue',
        datasetId: 'semantic-outpatient',
        mode: 'field',
        field: 'charge_amount',
        enabled: true,
        defaultTimeDimensionId: 'dim-visit-date',
        allowedDimensionIds: ['dim-hospital', 'dim-department', 'dim-doctor', 'dim-fee-group', 'dim-item'],
      },
    ],
  },
  {
    id: 'metric-outpatient-visits',
    numericId: 34,
    name: '门诊量',
    nameEn: 'outpatient_visits',
    datasetId: 'semantic-outpatient',
    datasetName: '门诊经营数据集',
    type: '原子指标',
    formula: 'COUNT(DISTINCT fact_outpatient_visit.visit_id)',
    businessDefinition: '统计有效门诊就诊记录数量。',
    availableDimensions: ['日期', '科室', '医生', '患者类型'],
    defaultGrain: '日 / 周 / 月',
    sensitivity: '普通',
    status: '已发布',
    creator: 'admin',
    updatedAt: '2026-05-20 16:05:02',
    referencedBy: ['门诊经营分析', '患者流量趋势分析'],
    lineage: ['医疗经营数仓', 'fact_outpatient_visit', 'dim_department', '指标市场'],
    synonyms: ['门诊人次', '就诊人次', '门诊访问量', '门急诊量'],
    sampleQuestions: ['本周门诊量趋势如何？', '眼科近三个月门诊量是否异常？'],
    recentUsage: ['问数 Agent - 门诊经营'],
    metricBindings: [
      {
        id: 'bind-metric-outpatient-visits',
        datasetId: 'semantic-outpatient',
        mode: 'field',
        field: 'visit_id',
        enabled: true,
        defaultTimeDimensionId: 'dim-visit-date',
        allowedDimensionIds: ['dim-hospital', 'dim-department', 'dim-doctor', 'dim-patient-type'],
      },
    ],
  },
  {
    id: 'metric-outpatient-revenue-mom-growth',
    numericId: 85,
    name: '门诊收入环比增长率',
    nameEn: 'outpatient_revenue_mom_growth',
    datasetId: 'semantic-outpatient',
    datasetName: '门诊经营数据集',
    type: '派生指标',
    formula: '(门诊收入 - 上期门诊收入) / 上期门诊收入',
    businessDefinition: '基于门诊收入计算本期相对上期的增长率，用于观察经营收入变化速度。',
    availableDimensions: ['日期', '科室', '费用组'],
    defaultGrain: '月',
    sensitivity: '普通',
    status: '已发布',
    creator: 'admin',
    updatedAt: '2026-05-22 10:18:00',
    referencedBy: ['经营日报模板', '门诊经营分析'],
    lineage: ['指标市场', '门诊收入', '门诊收入环比增长率'],
    synonyms: ['门诊收入环比', '门诊营收环比', '门诊收入增长率'],
    sampleQuestions: ['本月门诊收入环比增长率是多少？', '哪些科室拉动门诊收入环比增长？'],
    recentUsage: ['报告 Agent - 经营日报'],
    sourceMetricIds: ['metric-outpatient-revenue'],
    ruleDescription: '使用门诊收入按月聚合后计算本期与上期的相对变化。',
    metricBindings: [
      {
        id: 'bind-metric-outpatient-revenue-mom-growth',
        datasetId: 'semantic-outpatient',
        mode: 'formula',
        formulaOverride: '(SUM(charge_amount) - LAG(SUM(charge_amount))) / LAG(SUM(charge_amount))',
        enabled: true,
        defaultTimeDimensionId: 'dim-visit-date',
        allowedDimensionIds: ['dim-hospital', 'dim-department', 'dim-fee-group'],
      },
    ],
  },
  {
    id: 'metric-drug-ratio',
    numericId: 76,
    name: '药占比',
    nameEn: 'drug_ratio',
    datasetId: 'semantic-outpatient',
    datasetName: '门诊经营数据集',
    type: '派生指标',
    formula: 'SUM(drug_fee) / SUM(total_fee)',
    businessDefinition: '药品费用占总费用比例，用于观察用药结构变化。',
    availableDimensions: ['日期', '科室', '费用组', '患者类型'],
    defaultGrain: '月',
    sensitivity: '普通',
    status: '已发布',
    creator: 'admin',
    updatedAt: '2026-05-22 09:12:31',
    referencedBy: ['药占比/耗占比分析', '门诊经营分析', '费用波动深度分析'],
    lineage: ['医疗经营数仓', 'fact_outpatient_charge', 'dim_fee_item', '指标市场'],
    synonyms: ['药品占比', '药费占比', '药品收入占比'],
    sampleQuestions: ['上月药占比是多少？', '药占比下降来自哪些科室？'],
    recentUsage: ['问数 Agent - 门诊经营', '深度分析 Agent - 费用波动'],
    metricBindings: [
      {
        id: 'bind-metric-drug-ratio',
        datasetId: 'semantic-outpatient',
        mode: 'formula',
        formulaOverride: 'SUM(drug_fee) / SUM(total_fee)',
        enabled: true,
        defaultTimeDimensionId: 'dim-visit-date',
        allowedDimensionIds: ['dim-hospital', 'dim-department', 'dim-fee-group', 'dim-patient-type'],
      },
    ],
  },
  {
    id: 'metric-consumable-ratio',
    numericId: 77,
    name: '耗占比',
    nameEn: 'consumable_ratio',
    datasetId: 'semantic-outpatient',
    datasetName: '门诊经营数据集',
    type: '派生指标',
    formula: 'SUM(consumable_fee) / SUM(total_fee)',
    businessDefinition: '耗材费用占总费用比例，用于识别耗材结构偏移。',
    availableDimensions: ['日期', '科室', '病种组', '费用组'],
    defaultGrain: '月',
    sensitivity: '重要',
    status: '已发布',
    creator: 'admin',
    updatedAt: '2026-05-22 09:18:05',
    referencedBy: ['药占比/耗占比分析', '异常费用识别'],
    lineage: ['医疗经营数仓', 'fact_outpatient_charge', 'dim_fee_item', '指标市场'],
    synonyms: ['耗材占比', '材料占比', '耗材费用占比'],
    sampleQuestions: ['耗占比最近是否异常？', '高值耗材是否拉高耗占比？'],
    recentUsage: ['报告 Agent - 专题分析'],
    metricBindings: [
      {
        id: 'bind-metric-consumable-ratio',
        datasetId: 'semantic-outpatient',
        mode: 'formula',
        formulaOverride: 'SUM(consumable_fee) / SUM(total_fee)',
        enabled: true,
        defaultTimeDimensionId: 'dim-visit-date',
        allowedDimensionIds: ['dim-hospital', 'dim-department', 'dim-fee-group', 'dim-patient-type'],
      },
    ],
  },
  {
    id: 'metric-inspection-revenue',
    numericId: 78,
    name: '检查收入',
    nameEn: 'inspection_revenue',
    datasetId: 'semantic-outpatient',
    datasetName: '门诊经营数据集',
    type: '原子指标',
    formula: "SUM(charge_amount) WHERE fee_group = '检查'",
    businessDefinition: '统计门诊检查类项目确认收入。',
    availableDimensions: ['日期', '科室', '医生', '项目'],
    defaultGrain: '日 / 周 / 月',
    sensitivity: '普通',
    status: '已发布',
    creator: 'admin',
    updatedAt: '2026-05-21 18:44:05',
    referencedBy: ['门诊经营分析', '科室收入结构分析'],
    lineage: ['医疗经营数仓', 'fact_outpatient_charge', 'dim_fee_item', '指标市场'],
    synonyms: ['检查营收', '检查收费', '检查类收入'],
    sampleQuestions: ['今年以来门诊检查收入变化趋势如何？'],
    recentUsage: ['问数 Agent - 门诊经营'],
    metricBindings: [
      {
        id: 'bind-metric-inspection-revenue',
        datasetId: 'semantic-outpatient',
        mode: 'formula',
        formulaOverride: "SUM(charge_amount) WHERE fee_group = '检查'",
        enabled: true,
        defaultTimeDimensionId: 'dim-visit-date',
        allowedDimensionIds: ['dim-hospital', 'dim-department', 'dim-doctor', 'dim-fee-group', 'dim-item'],
      },
    ],
  },
  {
    id: 'metric-total-fee',
    numericId: 79,
    name: '总费用',
    nameEn: 'total_fee',
    datasetId: 'semantic-outpatient',
    datasetName: '门诊经营数据集',
    type: '原子指标',
    formula: 'SUM(total_fee)',
    businessDefinition: '统计指定范围内的医疗总费用。',
    availableDimensions: ['日期', '科室', '费用组', '病种组'],
    defaultGrain: '日 / 月',
    sensitivity: '重要',
    status: '已发布',
    creator: 'admin',
    updatedAt: '2026-05-19 11:30:00',
    referencedBy: ['异常费用识别', '药占比/耗占比分析', '经营诊断 Agent', '费用异常归因 Skill'],
    lineage: ['医疗经营数仓', 'fact_outpatient_charge', 'fact_inpatient_charge', '指标市场'],
    synonyms: ['医疗总费用', '总收费', '总金额', '费用总额'],
    sampleQuestions: ['最近两周异常费用群组有哪些？'],
    recentUsage: ['深度分析 Agent - 费用波动'],
    metricBindings: [
      {
        id: 'bind-metric-total-fee-outpatient',
        datasetId: 'semantic-outpatient',
        mode: 'field',
        field: 'total_fee',
        enabled: true,
        defaultTimeDimensionId: 'dim-visit-date',
        allowedDimensionIds: ['dim-hospital', 'dim-department', 'dim-fee-group'],
      },
      {
        id: 'bind-metric-total-fee-inpatient',
        datasetId: 'semantic-inpatient',
        mode: 'field',
        field: 'charge_amount',
        enabled: true,
        defaultTimeDimensionId: 'dim-discharge-date',
        allowedDimensionIds: ['dim-hospital', 'dim-department', 'dim-fee-group', 'dim-disease-group'],
      },
    ],
  },
  {
    id: 'metric-high-value-consumable',
    numericId: 80,
    name: '高值耗材费用',
    nameEn: 'high_value_consumable_fee',
    datasetId: 'semantic-inpatient',
    datasetName: '住院经营数据集',
    type: '复合指标',
    formula: "SUM(charge_amount) WHERE fee_group = '高值耗材'",
    businessDefinition: '统计高值耗材相关收费金额，用于费用结构和异常识别。',
    availableDimensions: ['日期', '科室', '病种组', '费用组'],
    defaultGrain: '周 / 月',
    sensitivity: '核心',
    status: '已发布',
    creator: 'admin',
    updatedAt: '2026-05-22 14:20:00',
    referencedBy: ['异常费用识别', '药占比/耗占比分析', '经营诊断 Agent'],
    lineage: ['医疗经营数仓', 'fact_inpatient_charge', 'dim_fee_item', '指标市场'],
    synonyms: ['高耗费用', '高值耗材收费', '耗材费用'],
    sampleQuestions: ['高值耗材费用同比增长的主要来源是什么？'],
    recentUsage: ['深度分析 Agent - 费用波动'],
    metricBindings: [
      {
        id: 'bind-metric-high-value-consumable',
        datasetId: 'semantic-inpatient',
        mode: 'formula',
        formulaOverride: "SUM(charge_amount) WHERE fee_group = '高值耗材'",
        enabled: true,
        defaultTimeDimensionId: 'dim-discharge-date',
        allowedDimensionIds: ['dim-hospital', 'dim-department', 'dim-disease-group', 'dim-fee-group'],
      },
    ],
  },
  {
    id: 'metric-inpatient-revenue',
    numericId: 81,
    name: '住院收入',
    nameEn: 'inpatient_revenue',
    datasetId: 'semantic-inpatient',
    datasetName: '住院经营数据集',
    type: '原子指标',
    formula: 'SUM(fact_inpatient_charge.charge_amount)',
    businessDefinition: '统计住院收费确认后的总收入。',
    availableDimensions: ['日期', '科室', '病种组', '费用组'],
    defaultGrain: '日 / 周 / 月',
    sensitivity: '重要',
    status: '已发布',
    creator: 'admin',
    updatedAt: '2026-05-20 08:40:00',
    referencedBy: ['科室收入结构分析', '经营诊断 Agent'],
    lineage: ['医疗经营数仓', 'fact_inpatient_charge', 'dim_department', '指标市场'],
    synonyms: ['住院营收', '住院收费', '住院总收入', '住院费用收入'],
    sampleQuestions: ['住院收入增长最快的科室有哪些？'],
    recentUsage: ['问数 Agent - 住院经营'],
    metricBindings: [
      {
        id: 'bind-metric-inpatient-revenue',
        datasetId: 'semantic-inpatient',
        mode: 'field',
        field: 'charge_amount',
        enabled: true,
        defaultTimeDimensionId: 'dim-discharge-date',
        allowedDimensionIds: ['dim-hospital', 'dim-department', 'dim-disease-group', 'dim-fee-group'],
      },
    ],
  },
  {
    id: 'metric-inpatient-admissions',
    numericId: 82,
    name: '住院人次',
    nameEn: 'inpatient_admissions',
    datasetId: 'semantic-inpatient',
    datasetName: '住院经营数据集',
    type: '原子指标',
    formula: 'COUNT(DISTINCT admission_id)',
    businessDefinition: '统计有效住院记录数量。',
    availableDimensions: ['日期', '科室', '病种组'],
    defaultGrain: '周 / 月',
    sensitivity: '普通',
    status: '已发布',
    creator: 'admin',
    updatedAt: '2026-05-19 15:00:00',
    referencedBy: ['患者流量趋势分析'],
    lineage: ['医疗经营数仓', 'fact_inpatient_record', 'dim_department', '指标市场'],
    synonyms: ['住院量', '入院人次', '住院患者数'],
    sampleQuestions: ['住院患者流量高峰集中在哪些周？'],
    recentUsage: ['问数 Agent - 住院经营'],
    metricBindings: [
      {
        id: 'bind-metric-inpatient-admissions',
        datasetId: 'semantic-inpatient',
        mode: 'field',
        field: 'admission_id',
        enabled: true,
        defaultTimeDimensionId: 'dim-discharge-date',
        allowedDimensionIds: ['dim-hospital', 'dim-department', 'dim-disease-group'],
      },
    ],
  },
  {
    id: 'metric-average-length-of-stay',
    numericId: 83,
    name: '平均住院日',
    nameEn: 'average_length_of_stay',
    datasetId: 'semantic-inpatient',
    datasetName: '住院经营数据集',
    type: '派生指标',
    formula: 'AVG(discharge_date - admission_date)',
    businessDefinition: '统计出院患者的平均住院天数。',
    availableDimensions: ['日期', '科室', '病种组'],
    defaultGrain: '月',
    sensitivity: '普通',
    status: '已发布',
    creator: 'admin',
    updatedAt: '2026-05-18 16:10:00',
    referencedBy: ['患者流量趋势分析', '手术量专题追踪'],
    lineage: ['医疗经营数仓', 'fact_inpatient_record', '指标市场'],
    synonyms: ['平均住院天数', '平均住院时长', '住院日'],
    sampleQuestions: ['本季度平均住院日变化如何？'],
    recentUsage: ['问数 Agent - 住院经营'],
    metricBindings: [
      {
        id: 'bind-metric-average-length-of-stay',
        datasetId: 'semantic-inpatient',
        mode: 'formula',
        formulaOverride: 'AVG(discharge_date - admission_date)',
        enabled: true,
        defaultTimeDimensionId: 'dim-discharge-date',
        allowedDimensionIds: ['dim-hospital', 'dim-department', 'dim-disease-group'],
      },
    ],
  },
  {
    id: 'metric-surgery-count',
    numericId: 84,
    name: '手术量',
    nameEn: 'surgery_count',
    datasetId: 'semantic-inpatient',
    datasetName: '住院经营数据集',
    type: '原子指标',
    formula: 'COUNT(DISTINCT surgery_id)',
    businessDefinition: '统计指定时间范围内完成的手术数量。',
    availableDimensions: ['日期', '科室', '病种组'],
    defaultGrain: '周 / 月',
    sensitivity: '重要',
    status: '草稿',
    creator: 'lxy',
    updatedAt: '2026-05-17 12:00:00',
    referencedBy: ['手术量专题追踪', '经营诊断 Agent'],
    lineage: ['医疗经营数仓', 'fact_surgery', 'dim_disease_group', '指标市场'],
    synonyms: ['手术台次', '手术例数', '手术数量'],
    sampleQuestions: ['最近手术量下降主要受什么影响？'],
    recentUsage: ['深度分析 Agent - 经营诊断'],
    metricBindings: [
      {
        id: 'bind-metric-surgery-count',
        datasetId: 'semantic-inpatient',
        mode: 'field',
        field: 'surgery_id',
        enabled: true,
        defaultTimeDimensionId: 'dim-surgery-date',
        allowedDimensionIds: ['dim-hospital', 'dim-department', 'dim-disease-group'],
      },
    ],
  },
];

export const metricSemantics: MetricSemantic[] = [
  {
    id: 'metric-sem-outpatient-revenue',
    name: 'outpatient_revenue',
    label: '门诊收入',
    description: '统计门诊收费确认后的总收入，默认剔除退费记录。',
    indicatorIds: ['metric-outpatient-revenue'],
    defaultTimeDimensionId: 'dim-visit-date',
    allowedDimensionIds: ['dim-hospital', 'dim-department', 'dim-doctor', 'dim-fee-group', 'dim-item'],
  },
  {
    id: 'metric-sem-outpatient-visits',
    name: 'outpatient_visits',
    label: '门诊量',
    description: '统计有效门诊就诊记录数量。',
    indicatorIds: ['metric-outpatient-visits'],
    defaultTimeDimensionId: 'dim-visit-date',
    allowedDimensionIds: ['dim-hospital', 'dim-department', 'dim-doctor', 'dim-patient-type'],
  },
  {
    id: 'metric-sem-drug-ratio',
    name: 'drug_ratio',
    label: '药占比',
    description: '药品费用占总费用比例。',
    indicatorIds: ['metric-drug-ratio'],
    defaultTimeDimensionId: 'dim-visit-date',
    allowedDimensionIds: ['dim-hospital', 'dim-department', 'dim-fee-group', 'dim-patient-type'],
  },
  {
    id: 'metric-sem-inspection-revenue',
    name: 'inspection_revenue',
    label: '检查收入',
    description: '统计门诊检查类项目确认收入。',
    indicatorIds: ['metric-inspection-revenue'],
    defaultTimeDimensionId: 'dim-visit-date',
    allowedDimensionIds: ['dim-hospital', 'dim-department', 'dim-doctor', 'dim-fee-group', 'dim-item'],
  },
  {
    id: 'metric-sem-total-fee',
    name: 'total_fee',
    label: '总费用',
    description: '统计指定范围内的医疗总费用。',
    indicatorIds: ['metric-total-fee'],
    defaultTimeDimensionId: 'dim-visit-date',
    allowedDimensionIds: ['dim-hospital', 'dim-department', 'dim-fee-group', 'dim-disease-group'],
  },
  {
    id: 'metric-sem-inpatient-revenue',
    name: 'inpatient_revenue',
    label: '住院收入',
    description: '统计住院收费确认后的总收入。',
    indicatorIds: ['metric-inpatient-revenue'],
    defaultTimeDimensionId: 'dim-discharge-date',
    allowedDimensionIds: ['dim-hospital', 'dim-department', 'dim-disease-group', 'dim-fee-group'],
  },
  {
    id: 'metric-sem-inpatient-admissions',
    name: 'inpatient_admissions',
    label: '住院人次',
    description: '统计有效住院记录数量。',
    indicatorIds: ['metric-inpatient-admissions'],
    defaultTimeDimensionId: 'dim-discharge-date',
    allowedDimensionIds: ['dim-hospital', 'dim-department', 'dim-disease-group'],
  },
];

export const askSuggestions = {
  'agent-ask-outpatient': [
    '上月门诊总收入和药占比情况如何？',
    '今年以来门诊检查收入变化趋势如何？',
    '眼科近三个月门诊量是否异常？',
    '门诊治疗收入贡献最大的三个科室是哪些？',
  ],
  'agent-ask-inpatient': [
    '住院收入增长最快的科室有哪些？',
    '本季度平均住院日变化如何？',
    '住院患者流量高峰主要集中在哪些周？',
    '耗材费用同比增长的主要来源是什么？',
  ],
} satisfies Record<string, string[]>;

export const reportSuggestions = {
  'agent-report-daily': [
    '生成昨天的门诊经营日报。',
    '给我做一份本周门急诊周报。',
    '输出本月经营月报并突出异常项。',
    '做一个节假日运营专题分析。',
  ],
  'agent-report-special': [
    '生成一份药耗结构专题分析。',
    '围绕眼科业务做一份专题经营报告。',
    '输出异常费用专题并给出结论。',
    '做一个患者流量变化专题分析。',
  ],
} satisfies Record<string, string[]>;

export const rcaSuggestions = {
  'agent-rca-expense': [
    '为什么本月门诊药品费用上升？',
    '检查收入下降的主要原因是什么？',
    '最近两周异常费用群组有哪些？',
    '哪个维度导致住院收入偏离目标？',
  ],
  'agent-rca-diagnosis': [
    '为什么眼科本季度收入未达目标？',
    '本周患者流量下滑的根因有哪些？',
    '专题诊断一下骨科住院经营情况。',
    '最近手术量下降主要受什么影响？',
  ],
} satisfies Record<string, string[]>;

export function getAgentsByType(type: AgentType) {
  return agents.filter((agent) => agent.type === type);
}

export function getSkillsForAgent(agent: Agent) {
  return skills.filter((skill) => agent.skills.includes(skill.id));
}

export function getSuggestionSet(agent: Agent) {
  if (agent.type === 'report') return reportSuggestions[agent.id] ?? [];
  if (agent.type === 'rca') return rcaSuggestions[agent.id] ?? [];
  return askSuggestions[agent.id] ?? [];
}

export function getDatasetForAgent(
  agent: Agent,
  datasetPool: SemanticDataset[] = semanticDatasets,
) {
  return (
    datasetPool.find((dataset) => agent.datasetIds?.includes(dataset.id)) ??
    datasetPool[0] ??
    semanticDatasets[0]
  );
}

export function getIndicatorsForDataset(
  datasetId: string,
  indicatorPool: IndicatorAsset[] = indicatorAssets,
) {
  return indicatorPool.filter(
    (indicator) => Boolean(getEnabledMetricBinding(indicator, datasetId)) && indicator.status === '已发布',
  );
}

export function getIndicatorsForAgent(
  agent: Agent,
  datasetPool: SemanticDataset[] = semanticDatasets,
  indicatorPool: IndicatorAsset[] = indicatorAssets,
) {
  const dataset = getDatasetForAgent(agent, datasetPool);
  return getIndicatorsForDataset(dataset.id, indicatorPool).slice(0, 4);
}

function getDatasetFields(dataset: SemanticDataset) {
  return dataset.queryFields ?? dataset.tables.flatMap((table) => table.fields);
}

function getEnabledDimensionBinding(dimension: DimensionSemantic | undefined, datasetId: string) {
  return dimension?.bindings.find((binding) => binding.datasetId === datasetId && binding.enabled);
}

function getBoundDimensionsForDataset(datasetId: string, includeTime = false) {
  return dimensionSemantics.filter(
    (dimension) =>
      (includeTime || dimension.type !== '时间') &&
      Boolean(getEnabledDimensionBinding(dimension, datasetId)),
  );
}

function getBoundTimeDimensionsForDataset(datasetId: string) {
  return dimensionSemantics.filter(
    (dimension) => dimension.type === '时间' && Boolean(getEnabledDimensionBinding(dimension, datasetId)),
  );
}

function getFallbackTimeField(dataset: SemanticDataset) {
  return (
    getDatasetFields(dataset).find((field) => field.fieldRole === '时间字段')?.name ??
    getDatasetFields(dataset).find((field) => field.dataType === 'date' || /date|time/i.test(field.name))?.name ??
    getDatasetFields(dataset)[0]?.name ??
    'date'
  );
}

function getEnabledMetricBinding(indicator: IndicatorAsset, datasetId: string): MetricDatasetBinding | undefined {
  const binding = indicator.metricBindings?.find((item) => item.datasetId === datasetId && item.enabled);
  if (binding) return binding;
  if (indicator.datasetId !== datasetId) return undefined;

  return {
    id: `legacy-binding-${indicator.id}`,
    datasetId,
    mode: indicator.sourceFieldName ? 'field' : 'formula',
    field: indicator.sourceFieldName,
    formulaOverride: indicator.sourceFieldName ? undefined : indicator.formula,
    enabled: true,
    defaultTimeDimensionId: indicator.defaultTimeDimensionId,
    allowedDimensionIds: indicator.allowedDimensionIds,
  };
}

function getMetricSemanticDatasetIds(semantic?: MetricSemantic) {
  if (!semantic) return [];

  return Array.from(
    new Set(
      semantic.indicatorIds.flatMap((indicatorId) => {
        const indicator = indicatorAssets.find((item) => item.id === indicatorId);
        if (!indicator) return [];
        if (indicator.metricBindings?.length) {
          return indicator.metricBindings.filter((binding) => binding.enabled).map((binding) => binding.datasetId);
        }
        return indicator.datasetId ? [indicator.datasetId] : [];
      }),
    ),
  );
}

function getMetricExpression(indicator: IndicatorAsset, datasetId: string) {
  const binding = getEnabledMetricBinding(indicator, datasetId);
  if (binding?.mode === 'formula' && binding.formulaOverride) return binding.formulaOverride;
  if (binding?.mode === 'field' && binding.field) {
    const distinctCount = indicator.formula.match(/COUNT\s*\(\s*DISTINCT\s+[^)]+\)/i);
    if (distinctCount) return `COUNT(DISTINCT ${binding.field})`;

    const aggregate = indicator.formula.match(/^(SUM|AVG|MIN|MAX|COUNT)\s*\(/i)?.[1]?.toUpperCase();
    if (aggregate) return `${aggregate}(${binding.field})`;

    return binding.field;
  }
  return indicator.formula;
}

function getMetricBindingLabel(indicator: IndicatorAsset, datasetId: string) {
  const binding = getEnabledMetricBinding(indicator, datasetId);
  if (!binding) return null;
  const target = binding.mode === 'formula' ? binding.formulaOverride ?? indicator.formula : binding.field ?? indicator.formula;
  return `指标：${indicator.name} -> ${target}`;
}

function normalizeIntentText(value: string) {
  return value.replace(/\s+/g, '').toLowerCase();
}

function findMatchedTerm(question: string, terms: string[]) {
  const normalized = normalizeIntentText(question);
  return terms.find((term) => term && normalized.includes(normalizeIntentText(term)));
}

function hasSharedValue(left: string[] = [], right: string[] = []) {
  const rightSet = new Set(right);
  return left.some((item) => rightSet.has(item));
}

function hasPermissionMatch(agent: Agent, permissionGroups: string[]) {
  const permissionGroup = agent.permissionConfig?.permissionGroup;
  if (!permissionGroup || !permissionGroups.length) return true;
  return permissionGroups.some((group) => permissionGroup.includes(group) || group.includes(permissionGroup));
}

function buildKnowledgeCitationReason({
  datasetMatched,
  metricMatched,
  skillMatched,
  keywordMatches,
}: {
  datasetMatched: boolean;
  metricMatched: boolean;
  skillMatched: boolean;
  keywordMatches: string[];
}) {
  const reasons = [
    datasetMatched ? '匹配当前数据集' : '',
    metricMatched ? '匹配命中指标' : '',
    skillMatched ? '匹配本次 Skill' : '',
    keywordMatches.length ? `命中关键词：${keywordMatches.join('、')}` : '',
  ].filter(Boolean);

  return reasons.join('；') || '匹配当前 Agent 的业务主题';
}

function getAgentKnowledgeBaseIds(agent: Agent, datasetId?: string) {
  if (agent.knowledgeConfig?.enabled === false) return [];

  const configuredIds = agent.knowledgeConfig?.knowledgeBaseIds ?? [];

  return knowledgeBases
    .filter((base) => {
      if (!isEnabledStatus(base.status)) return false;
      if (configuredIds.length && !configuredIds.includes(base.id)) return false;
      if (!base.applicableAgentTypes.includes(agent.type)) return false;
      if (datasetId && !base.datasetIds.includes(datasetId)) return false;
      return hasPermissionMatch(agent, base.permissionGroups);
    })
    .map((base) => base.id);
}

function getAgentKnowledgeDocumentIds(agent: Agent, datasetId?: string) {
  if (agent.knowledgeConfig?.enabled === false) return [];

  const configuredDocumentIds = agent.knowledgeConfig?.knowledgeDocumentIds ?? [];
  const knowledgeBaseIds = getAgentKnowledgeBaseIds(agent, datasetId);
  if (!knowledgeBaseIds.length) return [];

  return knowledgeDocuments
    .filter(
      (document) =>
        knowledgeBaseIds.includes(document.knowledgeBaseId) &&
        (!configuredDocumentIds.length || configuredDocumentIds.includes(document.id)),
    )
    .map((document) => document.id);
}

function searchKnowledgeHits({
  agent,
  question,
  dataset,
  indicators,
  skillIds,
  dimensionIds,
}: {
  agent: Agent;
  question: string;
  dataset?: SemanticDataset;
  indicators: IndicatorAsset[];
  skillIds: string[];
  dimensionIds: string[];
}): KnowledgeHit[] {
  const knowledgeDocumentIds = getAgentKnowledgeDocumentIds(agent, dataset?.id);
  if (!knowledgeDocumentIds.length) return [];

  const indicatorIds = indicators.map((indicator) => indicator.id);
  const questionKeywordText = normalizeIntentText(question);

  return knowledgeSnippets
    .map((snippet) => {
      const document = knowledgeDocuments.find((item) => item.id === snippet.documentId);
      const base = document
        ? knowledgeBases.find((item) => item.id === document.knowledgeBaseId)
        : undefined;

      if (!document || !base || !knowledgeDocumentIds.includes(document.id)) return null;

      const datasetMatched = Boolean(dataset?.id && snippet.datasetIds.includes(dataset.id));
      const metricMatched = hasSharedValue(snippet.metricIds, indicatorIds);
      const skillMatched = hasSharedValue(snippet.skillIds, skillIds);
      const dimensionMatched = hasSharedValue(snippet.dimensionIds, dimensionIds);
      const keywordMatches = snippet.keywords.filter((keyword) =>
        questionKeywordText.includes(normalizeIntentText(keyword)),
      );

      const score =
        (datasetMatched ? 30 : 0) +
        (metricMatched ? 24 : 0) +
        (skillMatched ? 18 : 0) +
        (dimensionMatched ? 10 : 0) +
        keywordMatches.length * 18 +
        (hasPermissionMatch(agent, base.permissionGroups) ? 6 : 0);

      if (score < 30) return null;

      return {
        hit: {
          id: snippet.id,
          knowledgeBaseId: base.id,
          knowledgeBaseName: base.name,
          documentId: document.id,
          documentTitle: document.title,
          documentSource: document.source,
          documentType: document.type,
          updatedAt: document.updatedAt,
          summary: snippet.summary,
          applicableScenes: document.applicableScenes,
          tags: document.tags,
          matchedKeywords: keywordMatches,
          citationReason: buildKnowledgeCitationReason({
            datasetMatched,
            metricMatched,
            skillMatched,
            keywordMatches,
          }),
          confidence: snippet.confidence,
          conflictNote: snippet.conflictNote,
        },
        score,
      };
    })
    .filter((item): item is { hit: KnowledgeHit; score: number } => Boolean(item))
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((item) => item.hit);
}

function isEnabledStatus(status: string) {
  return status === '已启用' || status.includes('启用') || status.includes('惎');
}

function scoreTextMatch(question: string, terms: Array<string | undefined>, weight: number) {
  const matched = terms.find((term) => term && findMatchedTerm(question, [term]));
  return matched ? { score: weight, matched } : { score: 0, matched: undefined };
}

function scoreDatasetForQuestion(
  question: string,
  dataset: SemanticDataset,
  indicatorPool: IndicatorAsset[] = indicatorAssets,
) {
  let score = 0;
  const signals: string[] = [];

  const datasetMatch = scoreTextMatch(
    question,
    [dataset.name, dataset.businessTheme, dataset.subjectObject, ...dataset.synonyms],
    8,
  );
  score += datasetMatch.score;
  if (datasetMatch.matched) signals.push(`数据集：${datasetMatch.matched}`);

  getDatasetFields(dataset).forEach((field) => {
    const fieldMatch = scoreTextMatch(question, [field.semanticName, field.description, field.name], 1);
    score += fieldMatch.score;
    if (fieldMatch.matched) signals.push(`字段：${fieldMatch.matched}`);
  });

  indicatorPool
    .filter((indicator) => Boolean(getEnabledMetricBinding(indicator, dataset.id)))
    .forEach((indicator) => {
      const indicatorMatch = scoreTextMatch(
        question,
        [indicator.name, indicator.businessDefinition, ...indicator.synonyms, ...indicator.sampleQuestions],
        3,
      );
      score += indicatorMatch.score;
      if (indicatorMatch.matched) signals.push(`指标：${indicatorMatch.matched}`);
    });

  return {
    dataset,
    score,
    signals: Array.from(new Set(signals)).slice(0, 5),
  };
}

function resolveDatasetsForQuestion(
  question: string,
  datasetPool: SemanticDataset[] = semanticDatasets,
  indicatorPool: IndicatorAsset[] = indicatorAssets,
) {
  const scored = datasetPool
    .map((dataset) => scoreDatasetForQuestion(question, dataset, indicatorPool))
    .sort((left, right) => right.score - left.score);
  const topScore = scored[0]?.score ?? 0;
  const closeMatches = scored.filter((item) => item.score > 0 && topScore - item.score <= 2);

  return {
    best: scored[0] ?? null,
    closeMatches,
    isAmbiguous: closeMatches.length > 1,
  };
}

function scoreAgentForQuestion(agent: Agent, question: string, skillPool: Skill[] = skills) {
  let score = agent.isDefault ? 1 : 0;
  const signals: string[] = [];

  const agentMatch = scoreTextMatch(
    question,
    [
      agent.name,
      agent.description,
      agent.capabilitySummary,
      agent.responseStyle,
      agent.anomalyPolicy,
      ...(agent.exampleQuestions ?? []),
      agent.reportConfig?.theme,
      ...(agent.reportConfig?.metrics ?? []),
      agent.rcaConfig?.drilldownStrategy,
      agent.rcaConfig?.statisticalMethod,
      ...(agent.rcaConfig?.ruleSet ?? []),
    ],
    5,
  );
  score += agentMatch.score;
  if (agentMatch.matched) signals.push(`Agent：${agentMatch.matched}`);

  skillPool
    .filter((skill) => agent.skills.includes(skill.id))
    .forEach((skill) => {
      const skillMatch = scoreTextMatch(
        question,
        [skill.name, skill.scene, skill.description, ...skill.triggerPhrases, ...(skill.analysisRules ?? [])],
        4,
      );
      score += skillMatch.score;
      if (skillMatch.matched) signals.push(`能力：${skillMatch.matched}`);
    });

  return {
    agent,
    score,
    signals: Array.from(new Set(signals)).slice(0, 6),
  };
}

function buildRoutingTrace(
  agent: Agent,
  confidence: AgentRoutingTrace['confidence'],
  datasetNames: string[],
  skillNames: string[],
  matchedSignals: string[],
): AgentRoutingTrace {
  return {
    agentId: agent.id,
    agentName: agent.name,
    agentType: agent.type,
    confidence,
    datasetNames,
    skillNames,
    matchedSignals: matchedSignals.length ? matchedSignals : ['使用默认分析配置'],
  };
}

export function resolveAgentForQuestion({
  mode,
  question,
  agentPool = agents,
  datasetPool = semanticDatasets,
  skillPool = skills,
  indicatorPool = indicatorAssets,
  forcedAgentId,
}: {
  mode: AgentType;
  question: string;
  agentPool?: Agent[];
  datasetPool?: SemanticDataset[];
  skillPool?: Skill[];
  indicatorPool?: IndicatorAsset[];
  forcedAgentId?: string;
}): {
  status: 'resolved' | 'clarification' | 'unavailable';
  agent?: Agent;
  dataset?: SemanticDataset;
  routingTrace?: AgentRoutingTrace;
  clarificationOptions?: AgentClarificationOption[];
  unavailableReason?: string;
} {
  const enabledAgents = agentPool.filter(
    (agent) => agent.type === mode && isEnabledStatus(String(agent.status)),
  );

  if (!enabledAgents.length) {
    return {
      status: 'unavailable',
      unavailableReason: '当前入口暂无已启用的分析配置，请在配置中心启用 Agent。',
    };
  }

  const forcedAgent = forcedAgentId
    ? enabledAgents.find((agent) => agent.id === forcedAgentId)
    : undefined;
  const datasetResolution = resolveDatasetsForQuestion(question, datasetPool, indicatorPool);
  const closeDatasetIds = new Set(datasetResolution.closeMatches.map((item) => item.dataset.id));

  if (forcedAgent) {
    const forcedDataset =
      datasetPool.find((dataset) => forcedAgent.datasetIds?.includes(dataset.id) && closeDatasetIds.has(dataset.id)) ??
      datasetPool.find((dataset) => forcedAgent.datasetIds?.includes(dataset.id));
    const skillNames = skillPool
      .filter((skill) => forcedAgent.skills.includes(skill.id))
      .slice(0, 3)
      .map((skill) => skill.name);

    if (!forcedDataset) {
      return {
        status: 'unavailable',
        agent: forcedAgent,
        routingTrace: buildRoutingTrace(
          forcedAgent,
          'high',
          [],
          skillNames,
          ['未匹配到可用数据集'],
        ),
        unavailableReason: '未匹配到可用数据集。',
      };
    }

    return {
      status: 'resolved',
      agent: forcedAgent,
      dataset: forcedDataset,
      routingTrace: buildRoutingTrace(
        forcedAgent,
        'high',
        forcedDataset ? [forcedDataset.name] : [],
        skillNames,
        ['用户已确认分析范围'],
      ),
    };
  }

  const datasetScopedAgents = enabledAgents.filter((agent) =>
    datasetResolution.closeMatches.length
      ? agent.datasetIds?.some((datasetId) => closeDatasetIds.has(datasetId))
      : true,
  );
  const candidates = datasetScopedAgents.length ? datasetScopedAgents : enabledAgents;

  const scoredAgents = candidates
    .map((agent) => scoreAgentForQuestion(agent, question, skillPool))
    .sort((left, right) => right.score - left.score);
  const topAgent = scoredAgents[0];
  const secondAgent = scoredAgents[1];

  if (!topAgent) {
    return {
      status: 'unavailable',
      unavailableReason: '当前数据范围暂无可用分析配置，请在配置中心补充 Agent 绑定。',
    };
  }

  const agentScoreGap = topAgent.score - (secondAgent?.score ?? -999);
  const agentStrongMatch = topAgent.score >= 5 && agentScoreGap >= 2;
  const onlyCandidate = scoredAgents.length === 1;
  const safeDefault =
    !datasetResolution.isAmbiguous &&
    (scoredAgents.find((item) => item.agent.isDefault) ?? topAgent);

  if (!onlyCandidate && datasetResolution.isAmbiguous && !agentStrongMatch) {
    const options = scoredAgents.slice(0, 4).map((item) => ({
      agentId: item.agent.id,
      label: item.agent.name,
      reason:
        item.signals[0] ??
        item.agent.datasetIds
          ?.map((datasetId) => datasetPool.find((dataset) => dataset.id === datasetId)?.name)
          .filter(Boolean)
          .join(' / ') ??
        item.agent.description,
    }));

    return {
      status: 'clarification',
      clarificationOptions: options,
    };
  }

  const selectedScore = agentStrongMatch || onlyCandidate ? topAgent : safeDefault;
  const selectedAgent = selectedScore.agent;
  const selectedDataset =
    datasetResolution.closeMatches.find((item) => selectedAgent.datasetIds?.includes(item.dataset.id))?.dataset ??
    datasetPool.find((dataset) => selectedAgent.datasetIds?.includes(dataset.id));
  const selectedSkills = skillPool.filter((skill) => selectedAgent.skills.includes(skill.id)).slice(0, 3);
  const confidence: AgentRoutingTrace['confidence'] =
    agentStrongMatch || onlyCandidate ? 'high' : selectedAgent.isDefault ? 'medium' : 'low';
  const matchedKnowledgeDocumentTitles = getAgentKnowledgeDocumentIds(selectedAgent, selectedDataset?.id)
    .map((documentId) => knowledgeDocuments.find((document) => document.id === documentId)?.title)
    .filter((title): title is string => Boolean(title));

  const routingTrace = buildRoutingTrace(
    selectedAgent,
    confidence,
    selectedDataset ? [selectedDataset.name] : [],
    selectedSkills.map((skill) => skill.name),
    [
      ...(datasetResolution.closeMatches.find((item) => item.dataset.id === selectedDataset?.id)?.signals ?? []),
      ...selectedScore.signals,
      ...matchedKnowledgeDocumentTitles.slice(0, 2).map((title) => `引用知识文档：${title}`),
    ],
  );

  if (!selectedDataset) {
    return {
      status: 'unavailable',
      agent: selectedAgent,
      routingTrace,
      unavailableReason: '未匹配到可用数据集。',
    };
  }

  return {
    status: 'resolved',
    agent: selectedAgent,
    dataset: selectedDataset,
    routingTrace,
  };
}

function escapeSqlLiteral(value: string) {
  return value.replace(/'/g, "''");
}

function resolveDimensionMemberRawValues(member: DimensionMember, datasetId: string) {
  const mapping = member.valueMappings?.find(
    (item) => item.datasetId === datasetId && item.enabled && item.rawValues.length,
  );
  return mapping?.rawValues.length ? mapping.rawValues : [member.name];
}

function buildDimensionMemberFilter(
  dataset: SemanticDataset,
  match: { dimension: DimensionSemantic; member?: DimensionMember },
) {
  if (!match.member) return null;

  const binding = getEnabledDimensionBinding(match.dimension, dataset.id);
  if (!binding) return null;

  const rawValues = resolveDimensionMemberRawValues(match.member, dataset.id);
  const values = rawValues.map((value) => `'${escapeSqlLiteral(value)}'`);
  const expression =
    values.length === 1
      ? `${binding.field} = ${values[0]}`
      : `${binding.field} IN (${values.join(', ')})`;

  return {
    field: binding.field,
    dimensionLabel: match.dimension.label,
    standardValue: match.member.name,
    rawValues,
    expression,
  };
}

const MOCK_TODAY = new Date('2026-06-10T00:00:00');

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfQuarter(date: Date) {
  return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
}

function resolveDateRange(label: string) {
  const today = new Date(MOCK_TODAY);
  const normalized = normalizeIntentText(label);

  if (normalized.includes('今日') || normalized.includes('今天')) {
    return { label: '今日', startDate: formatDate(today), endDate: formatDate(today) };
  }

  if (normalized.includes('本周')) {
    const day = today.getDay() || 7;
    return { label: '本周', startDate: formatDate(addDays(today, 1 - day)), endDate: formatDate(today) };
  }

  if (normalized.includes('上月')) {
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return { label: '上月', startDate: formatDate(startOfMonth(lastMonth)), endDate: formatDate(endOfMonth(lastMonth)) };
  }

  if (normalized.includes('本月')) {
    return { label: '本月', startDate: formatDate(startOfMonth(today)), endDate: formatDate(today) };
  }

  if (normalized.includes('本季度')) {
    return { label: '本季度', startDate: formatDate(startOfQuarter(today)), endDate: formatDate(today) };
  }

  if (normalized.includes('今年') || normalized.includes('今年以来')) {
    return { label: '今年以来', startDate: `${today.getFullYear()}-01-01`, endDate: formatDate(today) };
  }

  if (normalized.includes('去年同期')) {
    return {
      label: '去年同期',
      startDate: `${today.getFullYear() - 1}-${`${today.getMonth() + 1}`.padStart(2, '0')}-01`,
      endDate: formatDate(new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())),
    };
  }

  const rollingDaysMatch = normalized.match(/(?:近|最近)(\d+)天/);
  if (rollingDaysMatch) {
    const days = Number(rollingDaysMatch[1]);
    return {
      label,
      startDate: formatDate(addDays(today, -(Math.max(days, 1) - 1))),
      endDate: formatDate(today),
    };
  }

  if (normalized.includes('最近') || normalized.includes('近')) {
    return { label: '最近30天', startDate: formatDate(addDays(today, -29)), endDate: formatDate(today) };
  }

  return { label: '默认最近30天', startDate: formatDate(addDays(today, -29)), endDate: formatDate(today) };
}

function resolveTimeGrain(question: string): TimeGrain {
  if (question.includes('按年')) return '年';
  if (question.includes('按季')) return '季';
  if (question.includes('按月') || question.includes('趋势') || question.includes('变化')) return '月';
  if (question.includes('按周')) return '周';
  return '日';
}

function shouldGroupByTime(question: string) {
  return ['趋势', '变化', '按日', '按周', '按月', '按季', '按年'].some((term) => question.includes(term));
}

function buildTimeBucketExpression(field: string, grain: TimeGrain) {
  if (grain === '日') return field;
  const unitByGrain: Record<Exclude<TimeGrain, '日'>, string> = {
    周: 'week',
    月: 'month',
    季: 'quarter',
    年: 'year',
  };
  return `DATE_TRUNC('${unitByGrain[grain]}', ${field})`;
}

function resolveTimeDimension(question: string, dataset: SemanticDataset, indicators: IndicatorAsset[] = []) {
  const candidateTimeDimensions = getBoundTimeDimensionsForDataset(dataset.id);
  const preferredTimeDimensionId = indicators
    .map((indicator) => getEnabledMetricBinding(indicator, dataset.id)?.defaultTimeDimensionId)
    .find(Boolean);
  const timeDimension =
    candidateTimeDimensions.find((dimension) =>
      findMatchedTerm(question, [
        dimension.label,
        dimension.timeConfig?.fieldRole ?? '',
        ...dimension.synonyms,
        ...(dimension.timeConfig?.relativePresets ?? []),
      ]),
    ) ??
    candidateTimeDimensions.find((dimension) => dimension.id === preferredTimeDimensionId) ??
    candidateTimeDimensions[0] ??
    dimensionSemantics.find((dimension) => dimension.type === '时间');
  const timeTerms = candidateTimeDimensions.flatMap((dimension) => dimension.timeConfig?.relativePresets ?? []);
  const matchedRange = findMatchedTerm(question, timeTerms);
  const dateRange = resolveDateRange(matchedRange ?? question);
  const requestedGrain = resolveTimeGrain(question);
  const matchedTerm = findMatchedTerm(question, [
    timeDimension?.label ?? '',
    timeDimension?.timeConfig?.fieldRole ?? '',
    ...(timeDimension?.synonyms ?? []),
    ...(timeDimension?.timeConfig?.relativePresets ?? []),
  ]);
  const supportedGrains = timeDimension?.timeConfig?.supportedGrains ?? [];
  const grain = supportedGrains.length && !supportedGrains.includes(requestedGrain) ? supportedGrains[0] : requestedGrain;
  const timeBinding = timeDimension ? getEnabledDimensionBinding(timeDimension, dataset.id) : undefined;
  const timeField = timeBinding?.field ?? getFallbackTimeField(dataset);

  return { timeDimension, range: dateRange.label, dateRange, grain, matchedTerm, timeField, timeBinding };
}

function resolveMetricSemantic(question: string, agent: Agent) {
  const agentDatasetIds = agent.datasetIds ?? semanticDatasets.map((dataset) => dataset.id);
  const candidateSemantics = metricSemantics.filter((semantic) =>
    getMetricSemanticDatasetIds(semantic).some((datasetId) => agentDatasetIds.includes(datasetId)),
  );
  const matchesMetric = (semantic: MetricSemantic) =>
    findMatchedTerm(question, [
      semantic.label,
      ...semantic.indicatorIds.flatMap((indicatorId) => {
        const indicator = indicatorAssets.find((item) => item.id === indicatorId);
        return indicator
          ? [
              indicator.name,
              indicator.nameEn,
              ...indicator.synonyms,
              ...indicator.sampleQuestions,
            ]
          : [];
      }),
    ]);

  return (
    candidateSemantics.find((semantic) => Boolean(matchesMetric(semantic))) ??
    candidateSemantics[0] ??
    metricSemantics[0]
  );
}

function resolveDimensionMatches(question: string, dataset: SemanticDataset, metricSemantic?: MetricSemantic) {
  const boundDimensions = getBoundDimensionsForDataset(dataset.id);
  const candidateDimensions = metricSemantic?.allowedDimensionIds?.length
    ? boundDimensions.filter((dimension) => metricSemantic.allowedDimensionIds.includes(dimension.id))
    : boundDimensions;

  const matches = candidateDimensions.flatMap((dimension) => {
    const memberMatch = dimensionMembers.find((member) => {
      if (member.dimensionId !== dimension.id) return false;
      return Boolean(findMatchedTerm(question, [member.name, ...member.aliases]));
    });
    const memberTerm = memberMatch ? findMatchedTerm(question, [memberMatch.name, ...memberMatch.aliases]) : undefined;
    const dimensionTerm = findMatchedTerm(question, [dimension.label, ...dimension.synonyms]);

    if (!memberMatch && !dimensionTerm) return [];

    return [
      {
        dimension,
        member: memberMatch,
        matchedTerm: memberTerm ?? dimensionTerm,
      },
    ];
  });

  if (matches.length) return matches;

  const defaultDepartment = candidateDimensions.find((dimension) => dimension.id === 'dim-department');
  return defaultDepartment ? [{ dimension: defaultDepartment }] : [];
}

function selectDatasetForQuery(
  agent: Agent,
  metricSemantic?: MetricSemantic,
  dimensionMatches: Array<{ dimension: DimensionSemantic; member?: DimensionMember; matchedTerm?: string }> = [],
  question = '',
) {
  const candidateDatasetIds = getMetricSemanticDatasetIds(metricSemantic);
  const fallbackDatasetIds = agent.datasetIds ?? semanticDatasets.map((dataset) => dataset.id);
  const scopedCandidateDatasetIds = candidateDatasetIds.filter((datasetId) =>
    fallbackDatasetIds.includes(datasetId),
  );
  const datasetIds = scopedCandidateDatasetIds.length ? scopedCandidateDatasetIds : fallbackDatasetIds;
  const scoreDataset = (dataset: SemanticDataset) =>
    dimensionMatches.reduce((score, match) => {
      const mapped = Boolean(getEnabledDimensionBinding(match.dimension, dataset.id));

      return score + (mapped ? 1 : 0);
    }, findMatchedTerm(question, [dataset.name, dataset.businessTheme, ...dataset.synonyms]) ? 2 : 0);

  const datasets = semanticDatasets.filter((dataset) => datasetIds.includes(dataset.id));
  return datasets.sort((left, right) => scoreDataset(right) - scoreDataset(left))[0] ?? getDatasetForAgent(agent);
}

function buildEvidenceSql(
  dataset: SemanticDataset,
  indicators: IndicatorAsset[],
  timeResolution: ReturnType<typeof resolveTimeDimension>,
  question: string,
  dimensionMatches: Array<{ dimension: DimensionSemantic; member?: DimensionMember }> = [],
) {
  const selectMetrics = indicators
    .slice(0, 3)
    .map((indicator) => `${getMetricExpression(indicator, dataset.id)} AS ${indicator.nameEn}`)
    .join(',\n  ');
  const selectedDimension = dimensionMatches[0]?.dimension;
  const dimensionGroupField =
    (selectedDimension ? getEnabledDimensionBinding(selectedDimension, dataset.id)?.field : undefined) ??
    getEnabledDimensionBinding(dimensionSemantics.find((dimension) => dimension.id === 'dim-department') ?? getBoundDimensionsForDataset(dataset.id)[0], dataset.id)?.field ??
    getBoundDimensionsForDataset(dataset.id)[0]?.bindings.find((binding) => binding.datasetId === dataset.id && binding.enabled)?.field ??
    timeResolution.timeField;
  const groupField = shouldGroupByTime(question)
    ? `${buildTimeBucketExpression(timeResolution.timeField, timeResolution.grain)} AS time_bucket`
    : dimensionGroupField;
  const groupByField = shouldGroupByTime(question) ? 'time_bucket' : dimensionGroupField;
  const orderField = shouldGroupByTime(question) ? 'time_bucket' : indicators[0]?.nameEn ?? 'metric';
  const dimensionFilters = dimensionMatches
    .map((match) => buildDimensionMemberFilter(dataset, match)?.expression)
    .filter((expression): expression is string => Boolean(expression));
  const whereConditions = [
    `${timeResolution.timeField} BETWEEN '${timeResolution.dateRange.startDate}' AND '${timeResolution.dateRange.endDate}' -- ${timeResolution.range}`,
    ...dimensionFilters,
  ];

  return `SELECT\n  ${groupField},\n  ${selectMetrics}\nFROM ${dataset.tables[0]?.name ?? 'semantic_dataset'}\nWHERE ${whereConditions.join('\n  AND ')}\nGROUP BY ${groupByField}\nORDER BY ${orderField} DESC\nLIMIT 20;`;
}

function buildResultEvidence(
  agent: Agent,
  question: string,
  metricIds: string[] = [],
  skillIds: string[] = [],
) {
  const metricSemantic = resolveMetricSemantic(question, agent);
  const preliminaryDimensionMatches = resolveDimensionMatches(question, getDatasetForAgent(agent), metricSemantic);
  const dataset = selectDatasetForQuery(agent, metricSemantic, preliminaryDimensionMatches, question);
  const dimensionMatches = resolveDimensionMatches(question, dataset, metricSemantic);
  const metricsFromOptions = indicatorAssets.filter((indicator) => metricIds.includes(indicator.id));
  const mappedIndicators = (metricSemantic?.indicatorIds ?? [])
    .map((indicatorId) => indicatorAssets.find((indicator) => indicator.id === indicatorId))
    .filter((indicator): indicator is IndicatorAsset => Boolean(indicator));
  const candidateMetrics = metricsFromOptions.length
    ? metricsFromOptions
    : mappedIndicators.length
      ? mappedIndicators
      : getIndicatorsForAgent(agent);
  const indicators = candidateMetrics
    .filter((indicator) => Boolean(getEnabledMetricBinding(indicator, dataset.id)))
    .slice(0, 4);
  const fallbackIndicators = indicators.length ? indicators : getIndicatorsForDataset(dataset.id).slice(0, 4);
  const timeResolution = resolveTimeDimension(question, dataset, fallbackIndicators);
  const { timeDimension, range, dateRange, grain, matchedTerm: timeMatchedTerm, timeField, timeBinding } = timeResolution;
  const dimensions = dimensionMatches.length
    ? dimensionMatches.map((match) => match.dimension.label)
    : getBoundDimensionsForDataset(dataset.id).slice(0, 4).map((dimension) => dimension.label);
  const evidenceDimensionIds = dimensionMatches.length
    ? dimensionMatches.map((match) => match.dimension.id)
    : getBoundDimensionsForDataset(dataset.id).slice(0, 4).map((dimension) => dimension.id);
  const memberFilters = dimensionMatches
    .map((match) => buildDimensionMemberFilter(dataset, match))
    .filter((filter): filter is NonNullable<typeof filter> => Boolean(filter));
  const selectedMappings = dimensionMatches
    .map((match) => {
      const binding = getEnabledDimensionBinding(match.dimension, dataset.id);
      return binding ? `${match.dimension.label} -> ${binding.field}` : null;
    })
    .filter((mapping): mapping is string => Boolean(mapping));
  const selectedMetricBindings = fallbackIndicators
    .map((indicator) => getMetricBindingLabel(indicator, dataset.id))
    .filter((mapping): mapping is string => Boolean(mapping));
  const selectedMappingsWithTime = [
    ...selectedMetricBindings,
    ...selectedMappings,
    ...memberFilters.map(
      (filter) =>
        `维度值：${filter.dimensionLabel}=${filter.standardValue} -> ${filter.rawValues.join(' / ')}`,
    ),
    `时间维度：${timeDimension?.label ?? '默认时间'} -> ${timeField}`,
  ];
  const metricSynonymHits = fallbackIndicators.flatMap((indicator) => {
    const matchedTerm = findMatchedTerm(question, indicator.synonyms);
    return matchedTerm ? [`指标：${matchedTerm} -> ${indicator.name}`] : [];
  });
  const dimensionSynonymHits = dimensionMatches
    .filter((match) => match.matchedTerm)
    .map((match) =>
      match.member
        ? `维度值：${match.matchedTerm} -> ${match.member.name}`
        : `维度：${match.matchedTerm} -> ${match.dimension.label}`,
    );
  const timeSynonymHit = timeMatchedTerm ? [`时间维度：${timeMatchedTerm} -> ${timeDimension?.label ?? '默认时间'}`] : [];
  const datasetSynonymTerm = findMatchedTerm(question, dataset.synonyms);
  const datasetSynonymHit = datasetSynonymTerm ? [`数据集主题：${datasetSynonymTerm} -> ${dataset.name}`] : [];
  const synonymHits = Array.from(
    new Set([...metricSynonymHits, ...dimensionSynonymHits, ...timeSynonymHit, ...datasetSynonymHit]),
  );
  const selectedSkillIds = skillIds.length ? skillIds : agent.skills.slice(0, 3);
  const knowledgeHits = searchKnowledgeHits({
    agent,
    question,
    dataset,
    indicators: fallbackIndicators,
    skillIds: selectedSkillIds,
    dimensionIds: evidenceDimensionIds,
  });

  return {
    intent:
      agent.type === 'report'
        ? '生成经营报告'
        : agent.type === 'rca'
          ? '定位指标波动根因'
          : '自然语言指标问数',
    datasetId: dataset.id,
    datasetName: dataset.name,
    indicators: fallbackIndicators.map((indicator) => ({
      name: indicator.name,
      formula: getMetricExpression(indicator, dataset.id),
      description: indicator.businessDefinition,
    })),
    dimensions,
    filters: [
      `时间范围：${range}（${dateRange.startDate} 至 ${dateRange.endDate}）`,
      `时间粒度：${grain}`,
      `时间字段：${timeField}`,
      `业务主题：${dataset.businessTheme}`,
      ...memberFilters.map(
        (filter) =>
          `${filter.dimensionLabel}：${filter.standardValue}（当前数据集取值：${filter.rawValues.join(' / ')}）`,
      ),
    ],
    timeRange: `${range}（${dateRange.startDate} 至 ${dateRange.endDate}）`,
    timeField,
    dateRange,
    sql: buildEvidenceSql(dataset, fallbackIndicators, timeResolution, question, dimensionMatches),
    governanceNote: fallbackIndicators.length
      ? '已按指标、维度和时间维度的正式映射执行，底层字段只来自对象内的字段映射。'
      : '未命中已发布正式指标，当前结果仅可作为候选字段探索。',
    metricSemantic: metricSemantic?.label,
    dimensionMatches: dimensionMatches.map((match) =>
      match.member ? `${match.dimension.label}=${match.member.name}` : match.dimension.label,
    ),
    timeSemantic: `${timeDimension?.label ?? '默认时间'} / ${grain}`,
    synonymHits,
    selectedMappings: selectedMappingsWithTime,
    isOfficialMetric: fallbackIndicators.length > 0,
    knowledgeHits,
    lineage: Array.from(
      new Set([
        dataset.name,
        ...dataset.tables.slice(0, 2).map((table) => table.name),
        ...(metricSemantic ? [metricSemantic.label, timeDimension?.label ?? '默认时间'] : []),
        ...(timeBinding ? [`${timeDimension?.label ?? '默认时间'} -> ${timeBinding.field}`] : []),
        ...fallbackIndicators.flatMap((indicator) => indicator.lineage),
      ]),
    ).slice(0, 8),
  };
}

export function buildSkillTrace(
  agent: Agent,
  manualSkillIds: string[] = [],
  skillPool: Skill[] = skills,
  mode: 'auto' | 'manual' | 'rerun' = manualSkillIds.length ? 'manual' : 'auto',
): SkillTrace[] {
  const availableSkills = skillPool.filter((skill) =>
    mode === 'auto' ? agent.skills.includes(skill.id) : true,
  );
  const chosenSkills = manualSkillIds.length
    ? availableSkills.filter((skill) => manualSkillIds.includes(skill.id))
    : availableSkills.slice(0, Math.min(3, availableSkills.length));

  return chosenSkills.map((skill, index) => ({
    id: skill.id,
    name: skill.name,
    reason:
      mode === 'rerun'
        ? '按用户指定重新生成'
        : mode === 'manual'
          ? '用户手动指定'
        : index === 0
          ? '匹配当前问题主题'
          : index === 1
            ? '补充结构化分析'
            : '用于异常与结论校验',
  }));
}

export function buildAskChartData(agent: Agent): ChartDatum[] {
  return agent.id === 'agent-ask-inpatient'
    ? [
        { name: '骨科', value: 1320 },
        { name: '眼科', value: 980 },
        { name: '儿科', value: 860 },
        { name: '内科', value: 1420 },
      ]
    : [
        { name: '药品', value: 328 },
        { name: '检查', value: 205 },
        { name: '治疗', value: 186 },
        { name: '耗材', value: 92 },
      ];
}

type ResultBuildOptions = {
  resultScope?: ResultScope;
  primarySkillId?: string;
  manualSkillIds?: string[];
  reportTemplateId?: string;
  reportTemplates?: ReportTemplate[];
};

function includesLoose(source: string, target: string) {
  const normalizedSource = source.toLowerCase();
  const normalizedTarget = target.toLowerCase();
  return Boolean(normalizedTarget) && normalizedSource.includes(normalizedTarget);
}

function getReportTemplatePrompt(template: ReportTemplate) {
  return template.templatePrompt || template.description || template.sections.map((section) => section.description).join(' ');
}

function resolveReportTemplate(agent: Agent, question: string, options: ResultBuildOptions = {}) {
  const templatePool = options.reportTemplates ?? reportTemplates;
  const candidateTemplates = templatePool.filter((template) => {
    if (options.reportTemplateId) return template.id === options.reportTemplateId;
    return template.status === 'published';
  });

  const fallbackTemplate =
    candidateTemplates.find((template) => template.id === agent.reportConfig?.defaultTemplateId) ??
    candidateTemplates[0] ??
    templatePool.find((template) => template.status === 'published') ??
    templatePool[0];

  if (!agent.reportConfig?.autoMatchTemplate && !options.reportTemplateId) {
    return {
      template: fallbackTemplate,
      matchReason: fallbackTemplate ? '使用 Agent 默认报告模板' : '未配置报告模板',
    };
  }

  const scoredTemplates = candidateTemplates.map((template) => {
    let score = 0;
    const reasons: string[] = [];

    if (includesLoose(question, template.name) || includesLoose(question, template.category)) {
      score += 10;
      reasons.push('命中模板名称或类型');
    }

    template.triggerPhrases.forEach((phrase) => {
      if (includesLoose(question, phrase)) {
        score += 6;
        reasons.push(`命中触发词：${phrase}`);
      }
    });

    template.sections.forEach((section) => {
      if (includesLoose(question, section.title)) {
        score += 3;
        reasons.push(`命中章节：${section.title}`);
      }
    });

    const promptTerms = getReportTemplatePrompt(template)
      .split(/[，。；、\s]+/)
      .map((term) => term.trim())
      .filter((term) => term.length >= 2);
    promptTerms.forEach((term) => {
      if (includesLoose(question, term)) {
        score += 1;
        reasons.push(`命中模板提示词：${term}`);
      }
    });

    return { template, score, reasons };
  });

  const bestMatch = scoredTemplates.sort((left, right) => right.score - left.score)[0];

  if (!bestMatch || bestMatch.score <= 0) {
    return {
      template: fallbackTemplate,
      matchReason: fallbackTemplate ? '未命中明确模板，使用 Agent 默认报告模板' : '未配置报告模板',
    };
  }

  return {
    template: bestMatch.template,
    matchReason: bestMatch.reasons[0] ?? '根据问题自动匹配报告模板',
  };
}

function buildReportTemplateUsage(
  agent: Agent,
  question: string,
  options: ResultBuildOptions = {},
): ReportTemplateUsage | undefined {
  const { template, matchReason } = resolveReportTemplate(agent, question, options);

  if (!template) return undefined;

  return {
    templateId: template.id,
    name: template.name,
    category: template.category,
    version: template.version,
    sections: template.sections.map((section) => section.title),
    datasetNames: template.datasetIds
      .map((datasetId) => semanticDatasets.find((dataset) => dataset.id === datasetId)?.name)
      .filter(Boolean) as string[],
    skillNames: template.skillIds
      .map((skillId) => skills.find((skill) => skill.id === skillId)?.name)
      .filter(Boolean) as string[],
    metricLabels: template.metricBlocks.map((block) => block.label),
    complianceNotes: template.complianceNotes,
    matchReason,
  };
}

function buildSingleSkillAskResult(primarySkillId: string, question: string): AnalysisResultData {
  switch (primarySkillId) {
    case 'skill-outpatient-ops':
      return {
        title: '单 Skill 复核：门诊经营分析',
        summary: `本次仅基于“门诊经营分析”视角复核“${question}”，聚焦门诊收入、门诊量和重点科室贡献，不代表综合分析结论。`,
        metrics: [
          { label: '门诊收入', value: '¥482.6万', trend: 'up' },
          { label: '门诊量', value: '12,483', trend: 'up' },
          { label: '重点科室', value: '眼科', trend: 'flat' },
          { label: '增量来源', value: '检查项目', trend: 'up' },
        ],
        chartData: [
          { name: '眼科', value: 142 },
          { name: '骨科', value: 118 },
          { name: '内科', value: 97 },
          { name: '儿科', value: 76 },
        ],
        recommendations: [
          '继续拆分眼科的收入结构看看？',
          '看一下门诊量增长是否集中在特定时段。',
          '继续比较重点科室的收入贡献差异。',
        ],
      };
    case 'skill-pharmacy-structure':
      return {
        title: '单 Skill 复核：药占比/耗占比分析',
        summary: `本次仅基于“药占比/耗占比分析”视角复核“${question}”，聚焦药耗结构和占比变化，不代表综合分析结论。`,
        metrics: [
          { label: '药占比', value: '31.4%', trend: 'down' },
          { label: '耗占比', value: '18.2%', trend: 'up' },
          { label: '结构偏移', value: '+2.3pp', trend: 'up' },
          { label: '异常项', value: '高值耗材组', trend: 'up' },
        ],
        chartData: [
          { name: '药品', value: 314 },
          { name: '耗材', value: 182 },
          { name: '检查', value: 123 },
          { name: '治疗', value: 108 },
        ],
        recommendations: [
          '继续看药占比下降是否来自处方结构变化。',
          '拆分高值耗材组看看异常是否集中在少数病种。',
          '对比近四周药耗结构变化趋势。',
        ],
      };
    case 'skill-department-revenue':
      return {
        title: '单 Skill 复核：科室收入结构分析',
        summary: `本次仅基于“科室收入结构分析”视角复核“${question}”，聚焦科室贡献和收入结构，不代表综合分析结论。`,
        metrics: [
          { label: '重点科室', value: '骨科', trend: 'up' },
          { label: '收入占比', value: '24.8%', trend: 'up' },
          { label: '检查收入', value: '¥109.8万', trend: 'up' },
          { label: '结构变化', value: '+3.1pp', trend: 'up' },
        ],
        chartData: [
          { name: '骨科', value: 248 },
          { name: '眼科', value: 212 },
          { name: '内科', value: 176 },
          { name: '检验科', value: 132 },
        ],
        recommendations: [
          '继续拆分骨科的检查和治疗收入构成。',
          '比较眼科与骨科的收入增速差异。',
          '继续看结构变化是否集中在少数科室。',
        ],
      };
    case 'skill-abnormal-fee':
      return {
        title: '单 Skill 复核：异常费用识别',
        summary: `本次仅基于“异常费用识别”视角复核“${question}”，聚焦异常费用组和异常记录，不代表综合分析结论。`,
        metrics: [
          { label: '异常费用组', value: '3个', trend: 'up' },
          { label: '最大异常组', value: '高值耗材组', trend: 'up' },
          { label: '异常病例', value: '27例', trend: 'up' },
          { label: '风险等级', value: '中高', trend: 'up' },
        ],
        chartData: [
          { name: '高值耗材组', value: 41 },
          { name: '复诊费用组', value: 23 },
          { name: '检查组合组', value: 17 },
          { name: '其他', value: 9 },
        ],
        recommendations: [
          '继续下钻高值耗材组的异常记录。',
          '对比异常病例在科室间的分布差异。',
          '继续核查异常组的费用规则命中情况。',
        ],
      };
    case 'skill-patient-flow':
      return {
        title: '单 Skill 复核：患者流量趋势分析',
        summary: `本次仅基于“患者流量趋势分析”视角复核“${question}”，聚焦流量峰谷、时段和人群变化，不代表综合分析结论。`,
        metrics: [
          { label: '患者流量', value: '12,483', trend: 'up' },
          { label: '高峰时段', value: '周四-周五', trend: 'flat' },
          { label: '波动幅度', value: '8.2%', trend: 'up' },
          { label: '重点人群', value: '复诊患者', trend: 'up' },
        ],
        chartData: [
          { name: '周一', value: 88 },
          { name: '周二', value: 92 },
          { name: '周三', value: 101 },
          { name: '周四', value: 109 },
        ],
        recommendations: [
          '继续看周四到周五的流量高峰是否稳定。',
          '拆分复诊患者和新诊患者的流量变化。',
          '继续核对重点时段的资源匹配情况。',
        ],
      };
    case 'skill-custom-surgery':
      return {
        title: '单 Skill 复核：手术量专题追踪',
        summary: `本次仅基于“手术量专题追踪”视角复核“${question}”，聚焦手术量、平均住院日和术后随访，不代表综合分析结论。`,
        metrics: [
          { label: '手术量', value: '328台', trend: 'down' },
          { label: '平均住院日', value: '7.1天', trend: 'up' },
          { label: '术后随访率', value: '86.4%', trend: 'down' },
          { label: '重点科室', value: '骨科', trend: 'flat' },
        ],
        chartData: [
          { name: '骨科', value: 124 },
          { name: '普外科', value: 88 },
          { name: '眼科', value: 67 },
          { name: '妇科', value: 49 },
        ],
        recommendations: [
          '继续看骨科手术量下降是否集中在特定病种。',
          '比较术后随访率下降和平均住院日变化关系。',
          '继续核查专题周期内的手术排班变化。',
        ],
      };
    default:
      return {
        title: '单 Skill 复核',
        summary: `本次仅基于单一 Skill 视角复核“${question}”，结果用于局部验证，不代表综合分析结论。`,
        metrics: [
          { label: '复核范围', value: '单 Skill', trend: 'flat' },
          { label: '结果状态', value: '已生成', trend: 'flat' },
          { label: '分析视角', value: '聚焦复核', trend: 'flat' },
          { label: '建议动作', value: '继续追问', trend: 'flat' },
        ],
        chartData: [
          { name: '视角聚焦', value: 76 },
          { name: '结构验证', value: 54 },
          { name: '异常复核', value: 32 },
          { name: '结论确认', value: 21 },
        ],
        recommendations: [
          '继续补充该 Skill 视角下的追问。',
          '对比综合分析结果看看差异点。',
          '必要时再切回综合分析结论。',
        ],
      };
  }
}

export function buildAskResult(
  agent: Agent,
  question: string,
  options: ResultBuildOptions = {},
): AnalysisResultData {
  if (options.resultScope === 'single-skill' && options.primarySkillId) {
    const skill = skills.find((item) => item.id === options.primarySkillId);
    return {
      ...buildSingleSkillAskResult(options.primarySkillId, question),
      evidence: buildResultEvidence(agent, question, skill?.metricIds ?? [], [options.primarySkillId]),
    };
  }

  return {
    title: agent.id === 'agent-ask-inpatient' ? '住院经营分析结论' : '门诊经营分析结论',
    summary:
      agent.id === 'agent-ask-inpatient'
        ? `已围绕“${question}”完成住院经营问答，重点识别科室贡献、患者流量和费用结构变化。`
        : `已围绕“${question}”完成门诊经营问答，输出收入拆分、药耗结构和重点科室结论。`,
    metrics:
      agent.id === 'agent-ask-inpatient'
        ? [
            { label: '住院收入', value: '¥1,284万', trend: 'up' },
            { label: '平均住院日', value: '7.6天', trend: 'down' },
            { label: '高值耗材占比', value: '16.4%', trend: 'up' },
            { label: '重点科室', value: '骨科', trend: 'flat' },
          ]
        : [
            { label: '门诊收入', value: '¥482.6万', trend: 'up' },
            { label: '药占比', value: '31.5%', trend: 'down' },
            { label: '检查收入', value: '¥109.8万', trend: 'up' },
            { label: '重点科室', value: '眼科', trend: 'flat' },
          ],
    chartData: buildAskChartData(agent),
    recommendations:
      agent.id === 'agent-ask-inpatient'
        ? [
            '拆分骨科和眼科的收入结构看看？',
            '进一步分析平均住院日变化原因。',
            '看看高值耗材增长是否集中在特定病种组。',
          ]
        : [
            '按科室继续拆分门诊收入贡献。',
            '看看药占比下降是否来自处方结构变化。',
            '进一步分析检查收入增长的驱动因素。',
          ],
    evidence: buildResultEvidence(
      agent,
      question,
      options.manualSkillIds?.flatMap(
        (skillId) => skills.find((skill) => skill.id === skillId)?.metricIds ?? [],
      ) ?? [],
      options.manualSkillIds ?? [],
    ),
  };
}

function buildSingleSkillReportResult(
  agent: Agent,
  question: string,
  skillTrace: SkillTrace[],
  primarySkillId: string,
  options: ResultBuildOptions = {},
): ReportResultData {
  const primarySkillName = skillTrace[0]?.name ?? '指定 Skill';
  const templateUsage = buildReportTemplateUsage(agent, question, options);

  switch (primarySkillId) {
    case 'skill-pharmacy-structure':
      return {
        title: `单 Skill 复核：${primarySkillName}`,
        period: '2026年5月专题切片',
        summary: `本次仅基于“${primarySkillName}”视角复核“${question}”，重点验证药耗结构和占比变化，不代表综合报告结论。`,
        keyMetrics: [
          { label: '药占比', value: '34.8%', trend: 'up' },
          { label: '耗占比', value: '18.2%', trend: 'up' },
          { label: '结构偏移', value: '+2.6pp', trend: 'up' },
          { label: '异常费用组', value: '3个', trend: 'up' },
        ],
        chartTitle: '药耗结构复核',
        chartData: [
          { name: '药品', value: 182 },
          { name: '耗材', value: 95 },
          { name: '检查', value: 73 },
          { name: '治疗', value: 58 },
        ],
        findings: [
          '药占比小幅抬升，核心变化来自高值耗材组。',
          '耗占比连续两周高于历史均值，结构偏移更明显。',
        ],
        alerts: [
          '高值耗材门诊组连续两期超过阈值。',
        ],
        embeddedAnalysis: skillTrace.map(
          (trace) => `本次仅引用：${trace.name}，用于${trace.reason}。`,
        ),
        exportFormats: ['PDF', 'PNG'],
        templateUsage,
        pushConfig: {
          frequency: '按需生成',
          channel: '站内消息',
          audience: '当前操作人',
          nextRun: '未设置',
          lastRun: '2026-05-22 08:00',
          enabled: false,
          records: [
            {
              id: 'push-single-1',
              channel: '站内消息',
              target: '当前操作人',
              sentAt: '2026-05-22 08:00',
              status: '成功',
              note: '单 Skill 复核结果仅供当前会话查看',
            },
          ],
        },
      };
    case 'skill-patient-flow':
      return {
        title: `单 Skill 复核：${primarySkillName}`,
        period: '2026年5月流量复核',
        summary: `本次仅基于“${primarySkillName}”视角复核“${question}”，重点验证患者流量峰谷和时段变化，不代表综合报告结论。`,
        keyMetrics: [
          { label: '患者流量', value: '12,483', trend: 'up' },
          { label: '峰值时段', value: '周四-周五', trend: 'flat' },
          { label: '波动幅度', value: '8.2%', trend: 'up' },
          { label: '复诊占比', value: '42.6%', trend: 'up' },
        ],
        chartTitle: '患者流量趋势复核',
        chartData: [
          { name: '周一', value: 88 },
          { name: '周二', value: 92 },
          { name: '周三', value: 101 },
          { name: '周四', value: 109 },
        ],
        findings: [
          '患者流量峰值集中在后半周，复诊患者贡献更高。',
          '流量变化和门诊量提升方向一致，优先关注排班适配。',
        ],
        alerts: ['周中高峰时段资源承接能力接近上限。'],
        embeddedAnalysis: skillTrace.map(
          (trace) => `本次仅引用：${trace.name}，用于${trace.reason}。`,
        ),
        exportFormats: ['PDF', 'PNG'],
        templateUsage,
        pushConfig: {
          frequency: '按需生成',
          channel: '站内消息',
          audience: '当前操作人',
          nextRun: '未设置',
          lastRun: '2026-05-22 08:00',
          enabled: false,
          records: [
            {
              id: 'push-single-2',
              channel: '站内消息',
              target: '当前操作人',
              sentAt: '2026-05-22 08:00',
              status: '成功',
              note: '单 Skill 复核结果仅供当前会话查看',
            },
          ],
        },
      };
    default:
      return {
        title: `单 Skill 复核：${primarySkillName}`,
        period: '2026年5月局部复核',
        summary: `本次仅基于“${primarySkillName}”视角复核“${question}”，结果聚焦单一专题，不代表综合报告结论。`,
        keyMetrics: [
          { label: '复核范围', value: '单 Skill', trend: 'flat' },
          { label: '专题聚焦', value: '已收窄', trend: 'flat' },
          { label: '异常项', value: '2个', trend: 'up' },
          { label: '建议动作', value: '继续验证', trend: 'flat' },
        ],
        chartTitle: '单 Skill 复核指标',
        chartData: [
          { name: '主题匹配', value: 82 },
          { name: '结构验证', value: 64 },
          { name: '异常提示', value: 38 },
          { name: '结论收敛', value: 27 },
        ],
        findings: ['结果已明显收窄到单一 Skill 视角，更适合做局部复核。'],
        alerts: ['该结果不包含跨 Skill 的综合判断。'],
        embeddedAnalysis: skillTrace.map(
          (trace) => `本次仅引用：${trace.name}，用于${trace.reason}。`,
        ),
        exportFormats: ['PDF'],
        templateUsage,
        pushConfig: {
          frequency: '按需生成',
          channel: '站内消息',
          audience: '当前操作人',
          nextRun: '未设置',
          lastRun: '2026-05-22 08:00',
          enabled: false,
          records: [
            {
              id: 'push-single-3',
              channel: '站内消息',
              target: '当前操作人',
              sentAt: '2026-05-22 08:00',
              status: '成功',
              note: '单 Skill 复核结果仅供当前会话查看',
            },
          ],
        },
      };
  }
}

export function buildReportResult(
  agent: Agent,
  question: string,
  skillTrace: SkillTrace[],
  options: ResultBuildOptions = {},
): ReportResultData {
  if (options.resultScope === 'single-skill' && options.primarySkillId) {
    return buildSingleSkillReportResult(agent, question, skillTrace, options.primarySkillId, options);
  }

  const special = agent.id === 'agent-report-special';
  const templateUsage = buildReportTemplateUsage(agent, question, options);

  return {
    title: special ? '药耗结构专题分析' : '门急诊经营日报',
    period: special ? '2026年5月专题' : '2026年5月21日',
    summary: special
      ? `已围绕“${question}”生成专题 BI 看板，重点突出药占比、耗占比和异常费用组变化。`
      : `已围绕“${question}”生成日报看板，覆盖门诊量、收入、药占比和检查收入。`,
    keyMetrics: special
      ? [
          { label: '药占比', value: '34.8%', trend: 'up' },
          { label: '耗占比', value: '18.2%', trend: 'up' },
          { label: '异常费用组', value: '3个', trend: 'up' },
          { label: '专题评分', value: '82/100', trend: 'flat' },
        ]
      : [
          { label: '门诊收入', value: '¥482.6万', trend: 'up' },
          { label: '门诊量', value: '12,483', trend: 'up' },
          { label: '药占比', value: '31.4%', trend: 'down' },
          { label: '检查收入', value: '¥109.8万', trend: 'up' },
        ],
    chartTitle: special ? '费用结构分布' : '关键经营指标',
    chartData: special
      ? [
          { name: '药品', value: 182 },
          { name: '耗材', value: 95 },
          { name: '检查', value: 73 },
          { name: '治疗', value: 58 },
        ]
      : [
          { name: '周一', value: 88 },
          { name: '周二', value: 92 },
          { name: '周三', value: 101 },
          { name: '周四', value: 98 },
          { name: '周五', value: 103 },
        ],
    findings: [
      '眼科和骨科贡献了主要增量，其中眼科检查收入环比提升明显。',
      '药占比保持下降趋势，但耗材费用在部分病种组出现抬升。',
      '门诊量在工作日后段达到峰值，建议关注排班和资源投放。',
    ],
    alerts: [
      '异常费用组“高值耗材门诊组”连续两日高于阈值。',
      '部分科室检查收入增速明显高于门诊量增速，需要复核结构变化。',
    ],
    embeddedAnalysis: skillTrace.map((trace) => `分析卡片已引用：${trace.name}，用于${trace.reason}。`),
    exportFormats: ['PDF', 'PNG', 'CSV'],
    templateUsage,
    pushConfig: {
      frequency: special ? '每周一 08:30' : '每日 08:00',
      channel: special ? '邮件' : '站内消息',
      audience: special ? '经营分析组' : '医院经营班子',
      nextRun: '2026-05-23 08:00',
      lastRun: '2026-05-22 08:00',
      enabled: true,
      records: [
        {
          id: 'push-1',
          channel: '站内消息',
          target: '医院经营班子',
          sentAt: '2026-05-22 08:00',
          status: '成功',
          note: '日报已推送至 12 位接收人',
        },
        {
          id: 'push-2',
          channel: '邮件',
          target: special ? '经营分析组' : '科室负责人',
          sentAt: '2026-05-21 08:00',
          status: '失败',
          note: '2 个邮箱退信，待重试',
        },
      ],
    },
  };
}

function buildSingleSkillRootCauseResult(
  question: string,
  primarySkillId: string,
  primarySkillName: string,
): RootCauseResultData {
  switch (primarySkillId) {
    case 'skill-abnormal-fee':
      return {
        title: `单 Skill 复核：${primarySkillName}`,
        summary: `本次仅基于“${primarySkillName}”视角复核“${question}”，聚焦异常费用组、异常记录和候选归因，不代表完整根因链路。`,
        overviewMetrics: [
          { label: '异常费用组', value: '3个', trend: 'up' },
          { label: '异常病例', value: '27例', trend: 'up' },
          { label: '最大异常组', value: '高值耗材组', trend: 'up' },
          { label: '候选归因', value: '2条', trend: 'flat' },
        ],
        contributionChart: [
          { name: '高值耗材组', value: 41 },
          { name: '复诊费用组', value: 23 },
          { name: '检查组合组', value: 17 },
          { name: '其他', value: 9 },
        ],
        sections: [
          {
            title: '异常费用聚类',
            description: '只保留异常费用视角的局部复核结果。',
            bullets: [
              '异常记录集中在高值耗材门诊组和骨科复诊组。',
              '异常点主要发生在后半周，且与高单价项目组合重叠。',
            ],
          },
          {
            title: '异常规则命中',
            description: '只看费用规则和异常分组，不扩展到完整经营归因。',
            bullets: [
              '高值耗材组连续两期超过预设阈值。',
              '部分异常记录同时命中结构偏移和费用上浮规则。',
            ],
          },
        ],
        candidates: [
          {
            title: '高值耗材使用结构变化',
            confidence: '高',
            evidence: [
              '高值耗材组贡献度最高且持续抬升。',
              '异常记录与高单价项目组合变化一致。',
            ],
          },
          {
            title: '费用规则阈值过窄',
            confidence: '中',
            evidence: [
              '部分异常记录集中在规则边界附近。',
              '同类病例在相邻周期未持续超标。',
            ],
          },
        ],
        conclusion: '建议先复核异常费用规则和高值耗材组明细，再决定是否进入完整根因分析。',
      };
    case 'skill-patient-flow':
      return {
        title: `单 Skill 复核：${primarySkillName}`,
        summary: `本次仅基于“${primarySkillName}”视角复核“${question}”，聚焦流量峰谷、时段变化和重点人群，不代表完整根因链路。`,
        overviewMetrics: [
          { label: '流量波动', value: '-6.2%', trend: 'down' },
          { label: '重点时段', value: '2周', trend: 'flat' },
          { label: '高峰来源', value: '复诊患者', trend: 'up' },
          { label: '候选原因', value: '2条', trend: 'flat' },
        ],
        contributionChart: [
          { name: '复诊患者', value: 34 },
          { name: '新诊患者', value: 19 },
          { name: '节后回流', value: 27 },
          { name: '其他', value: 12 },
        ],
        sections: [
          {
            title: '流量趋势',
            description: '只保留患者流量视角的局部复核结果。',
            bullets: [
              '流量下滑主要集中在前两周，后半周出现温和恢复。',
              '复诊患者波动幅度明显高于新诊患者。',
            ],
          },
          {
            title: '时段与人群',
            description: '不扩展到结构和费用视角。',
            bullets: [
              '峰值时段仍集中在周四到周五。',
              '重点波动来自复诊患者和术后随访人群。',
            ],
          },
        ],
        candidates: [
          {
            title: '复诊患者回流不足',
            confidence: '高',
            evidence: [
              '复诊人群对总波动贡献最高。',
              '重点时段流量恢复慢于历史均值。',
            ],
          },
          {
            title: '节后排班承接不足',
            confidence: '中',
            evidence: [
              '周中高峰时段排班低于历史平均。',
              '流量高峰未被完全转化为有效接诊量。',
            ],
          },
        ],
        conclusion: '建议先复核流量排班和复诊回流策略，再决定是否进入完整经营诊断链路。',
      };
    case 'skill-custom-surgery':
      return {
        title: `单 Skill 复核：${primarySkillName}`,
        summary: `本次仅基于“${primarySkillName}”视角复核“${question}”，聚焦手术量、住院日和术后随访，不代表完整根因链路。`,
        overviewMetrics: [
          { label: '手术量波动', value: '-7.4%', trend: 'down' },
          { label: '平均住院日', value: '7.1天', trend: 'up' },
          { label: '随访率', value: '86.4%', trend: 'down' },
          { label: '候选原因', value: '2条', trend: 'flat' },
        ],
        contributionChart: [
          { name: '骨科', value: 38 },
          { name: '普外科', value: 24 },
          { name: '眼科', value: 18 },
          { name: '其他', value: 10 },
        ],
        sections: [
          {
            title: '手术量趋势',
            description: '只保留手术量专题视角的复核结果。',
            bullets: [
              '骨科手术量下降是主要波动来源。',
              '平均住院日上升和手术量下滑同时出现。',
            ],
          },
          {
            title: '术后随访',
            description: '不扩展到完整经营归因。',
            bullets: [
              '术后随访率下降集中在术后两周窗口。',
              '重点科室的随访策略执行不均衡。',
            ],
          },
        ],
        candidates: [
          {
            title: '骨科手术排班收缩',
            confidence: '高',
            evidence: [
              '骨科对总波动贡献最高。',
              '重点时段排班低于专题基线。',
            ],
          },
          {
            title: '术后随访承接不足',
            confidence: '中',
            evidence: [
              '随访率下降与平均住院日上升同步。',
              '重点病例回访节奏晚于常态。',
            ],
          },
        ],
        conclusion: '建议先复核骨科手术排班和术后随访承接，再决定是否扩展到完整经营诊断。',
      };
    default:
      return {
        title: `单 Skill 复核：${primarySkillName}`,
        summary: `本次仅基于“${primarySkillName}”视角复核“${question}”，结果用于局部验证，不代表完整根因链路。`,
        overviewMetrics: [
          { label: '复核范围', value: '单 Skill', trend: 'flat' },
          { label: '异常维度', value: '2个', trend: 'up' },
          { label: '候选原因', value: '2条', trend: 'flat' },
          { label: '诊断状态', value: '局部复核', trend: 'flat' },
        ],
        contributionChart: [
          { name: '主题匹配', value: 31 },
          { name: '异常信号', value: 22 },
          { name: '结构验证', value: 17 },
          { name: '结论确认', value: 12 },
        ],
        sections: [
          {
            title: '局部复核范围',
            description: '只保留当前 Skill 对应视角。',
            bullets: [
              '结果已收窄到单一 Skill 视角。',
              '未包含完整多维归因链路。',
            ],
          },
        ],
        candidates: [
          {
            title: '局部异常仍需验证',
            confidence: '中',
            evidence: ['建议与综合分析结果做交叉对比。'],
          },
        ],
        conclusion: '建议将该结果视为局部验证，再结合综合分析结论做最终判断。',
      };
  }
}

function buildRootCauseTitleFromQuestion(question: string, diagnosisMode: boolean) {
  const fallbackTitle = diagnosisMode ? '经营诊断链路' : '指标波动根因分析';
  const cleanedQuestion = question
    .replace(/^使用分析能力「.*?」重新生成：/, '')
    .replace(/^重新分析：/, '')
    .replace(/[？?。！!；;，,\s]+$/g, '')
    .trim();

  if (!cleanedQuestion) return fallbackTitle;

  const dimensionMatch = cleanedQuestion.match(/^哪个维度导致(.+)$/);
  if (dimensionMatch?.[1]?.trim()) {
    return `${dimensionMatch[1].trim()}维度归因分析`;
  }

  const asksForReason = /原因|根因|归因|为什么|为何|导致/.test(cleanedQuestion);
  const topic = cleanedQuestion
    .replace(/^为什么/, '')
    .replace(/^为何/, '')
    .replace(/^请(?:帮我)?(?:分析|看一下|找出|定位|说明)?/, '')
    .replace(/的?(?:主要|核心)?(?:原因|根因|影响因素)(?:是)?(?:什么|哪些|有哪些)?$/, '')
    .replace(/(?:是什么|有哪些|吗)$/, '')
    .trim();
  const titleTopic = topic || cleanedQuestion;

  if (/(分析|诊断|报告)$/.test(titleTopic)) return titleTopic;

  if (asksForReason) {
    return `${titleTopic}原因分析`;
  }

  return `${titleTopic}${diagnosisMode ? '诊断分析' : '根因分析'}`;
}

export function buildRootCauseResult(
  agent: Agent,
  question: string,
  options: ResultBuildOptions = {},
): RootCauseResultData {
  if (options.resultScope === 'single-skill' && options.primarySkillId) {
    const primarySkillName =
      skills.find((skill) => skill.id === options.primarySkillId)?.name ?? '指定 Skill';

    return buildSingleSkillRootCauseResult(
      question,
      options.primarySkillId,
      primarySkillName,
    );
  }

  const diagnosisMode = agent.id === 'agent-rca-diagnosis';

  return {
    title: buildRootCauseTitleFromQuestion(question, diagnosisMode),
    summary: diagnosisMode
      ? `已围绕“${question}”完成专题经营诊断，输出时间变化、结构变化和候选根因。`
      : `已围绕“${question}”完成费用波动根因分析，锁定主要贡献维度和异常分组。`,
    overviewMetrics: diagnosisMode
      ? [
          { label: '偏离目标', value: '-8.6%', trend: 'down' },
          { label: '异常维度', value: '4个', trend: 'up' },
          { label: '重点时段', value: '2周', trend: 'flat' },
          { label: '根因候选', value: '3条', trend: 'up' },
        ]
      : [
          { label: '费用波动', value: '+11.8%', trend: 'up' },
          { label: '最大贡献科室', value: '骨科', trend: 'up' },
          { label: '异常分组', value: '高值耗材组', trend: 'up' },
          { label: '结构偏移', value: '+4.1pp', trend: 'up' },
        ],
    contributionChart: diagnosisMode
      ? [
          { name: '患者流量', value: 26 },
          { name: '手术量', value: 34 },
          { name: '检查结构', value: 18 },
          { name: '病种结构', value: 22 },
        ]
      : [
          { name: '骨科', value: 41 },
          { name: '眼科', value: 23 },
          { name: '内科', value: 17 },
          { name: '异常费用组', value: 19 },
        ],
    sections: [
      {
        title: '总体指标',
        description: diagnosisMode ? '先看目标偏离与经营基线。' : '先看总体费用波动和环比偏移。',
        bullets: [
          diagnosisMode ? '收入未达目标 8.6%，主要偏差来自后两周。' : '门诊费用环比上涨 11.8%，高于历史正常波动区间。',
          diagnosisMode ? '患者流量下降与高值项目回落同时出现。' : '结构偏移主要集中在高值耗材和检查组合。',
        ],
      },
      {
        title: '维度贡献',
        description: '从科室、病种和费用组继续下钻。',
        bullets: [
          '骨科和眼科贡献了主要波动量，且波动集中在周中时段。',
          '高值耗材组贡献度显著提升，与部分病种结构变化同步。',
        ],
      },
      {
        title: '时间与结构变化',
        description: '识别关键时间窗口和结构替代关系。',
        bullets: [
          '最近两周检查收入增速高于门诊量增速，说明结构比流量变化更明显。',
          '部分病种由药品费用转向耗材费用，导致结构占比抬升。',
        ],
      },
      {
        title: '异常分组',
        description: '对异常记录进行聚类与规则识别。',
        bullets: [
          '异常病例集中在骨科复诊和高值耗材门诊组。',
          '两类异常分组在节假日后恢复期重叠出现。',
        ],
      },
    ],
    candidates: [
      {
        title: '高值耗材使用结构变化',
        confidence: '高',
        evidence: [
          '高值耗材组贡献度最高，且结构占比连续抬升。',
          '与骨科和眼科的高单价项目组合变化一致。',
        ],
      },
      {
        title: '重点科室排班与流量错配',
        confidence: '中',
        evidence: [
          '门诊量高峰时段资源承接不足，出现检查收入与患者量错配。',
          '部分周中排班低于历史平均。',
        ],
      },
      {
        title: '病种结构迁移导致平均费用提升',
        confidence: '中',
        evidence: [
          '部分高费用病种占比提升 3.2 个百分点。',
          '与专题诊断规则命中结果一致。',
        ],
      },
    ],
    conclusion: diagnosisMode
      ? '建议优先复核骨科与眼科的专题经营策略，再结合患者流量与病种结构做二次验证。'
      : '建议优先处置高值耗材结构变化，并联动重点科室复核排班与费用规则。'
  };
}

function getCapabilitiesForMockAgent(agentId: string) {
  return mcpServers.flatMap((server) =>
    server.capabilities.filter((capability) => capability.agentIds.includes(agentId)),
  );
}

function getProcessPreviewFromResult(
  agent: Agent,
  question: string,
  skillTrace: SkillTrace[],
): AnalysisProcessData['resultPreview'] {
  if (agent.type === 'report') {
    const reportResult = buildReportResult(agent, question, skillTrace);

    return {
      title: reportResult.title,
      metrics: reportResult.keyMetrics,
      chartData: reportResult.chartData,
    };
  }

  if (agent.type === 'rca') {
    const rootCauseResult = buildRootCauseResult(agent, question);

    return {
      title: rootCauseResult.title,
      metrics: rootCauseResult.overviewMetrics,
      chartData: rootCauseResult.contributionChart,
    };
  }

  const askResult = buildAskResult(agent, question);

  return {
    title: askResult.title,
    metrics: askResult.metrics,
    chartData: askResult.chartData,
  };
}

type BuildAgentAnalysisProcessOptions = {
  status?: AnalysisProcessData['status'];
  skillMatchSource?: '自动匹配' | '手动选择';
  visibleStepCount?: number;
  elapsedSeconds?: number;
};

export function buildAgentAnalysisProcess(
  agent: Agent,
  question: string,
  skillTrace: SkillTrace[],
  options: BuildAgentAnalysisProcessOptions = {},
): AnalysisProcessData {
  const status = options.status ?? 'completed';
  const selectedSkillIds = skillTrace.map((skill) => skill.id);
  const evidence = buildResultEvidence(
    agent,
    question,
    selectedSkillIds.flatMap(
      (skillId) => skills.find((skill) => skill.id === skillId)?.metricIds ?? [],
    ),
    selectedSkillIds,
  );
  const skillIdSet = new Set(selectedSkillIds);
  const mcpMatches: AnalysisMcpMatch[] = getCapabilitiesForMockAgent(agent.id)
    .filter((capability) => capability.enabled && capability.skillIds.some((skillId) => skillIdSet.has(skillId)))
    .map((capability) => ({
      id: capability.id,
      name: capability.name,
      serverName: capability.serverId,
      status: '可调用',
      reason: '',
    }));
  const metrics = evidence.indicators.map((indicator) => indicator.name);

  return {
    question,
    datasetName: evidence.datasetName,
    metrics,
    dimensions: evidence.dimensions,
    timeRange: evidence.timeRange,
    filters: evidence.filters,
    knowledgeHits: evidence.knowledgeHits ?? [],
    skillMatches: skillTrace.map((skill) => ({
      id: skill.id,
      name: skill.name,
      source: options.skillMatchSource ?? '自动匹配',
    })),
    mcpMatches,
    thoughtItems: [
      `理解问题：需要围绕“${question}”识别业务主题、时间范围、指标和维度。`,
      `分析数据：使用${evidence.datasetName}，提取${metrics.slice(0, 3).join('、') || '核心指标'}。`,
      `确定方案：按${evidence.dimensions.slice(0, 3).join('、') || '默认维度'}组织查询，并结合知识依据校验口径。`,
      `选择工具：使用语义问数 SQL 生成、指标映射和知识库检索完成取数。`,
      `输出格式：生成指标卡、图表、可信口径和推荐追问。`,
    ],
    sql: evidence.sql,
    resultPreview: getProcessPreviewFromResult(agent, question, skillTrace),
    status,
    visibleStepCount: options.visibleStepCount ?? (status === 'running' ? 1 : undefined),
    elapsedSeconds: options.elapsedSeconds ?? (status === 'completed' ? 4 : undefined),
  };
}

function buildHistoryMarkdownFileName(sentAt: Date) {
  const stamp = sentAt
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+$/, '')
    .replace('T', '_');

  return `deep_analysis_${stamp}.md`;
}

function buildHistoryDeepAnalysisMarkdown(result: RootCauseResultData) {
  const metricLines = result.overviewMetrics.map(
    (metric) => `- ${metric.label}: ${metric.value}`,
  );
  const contributionLines = result.contributionChart.map(
    (item) => `- ${item.name}: ${item.value}`,
  );
  const sectionLines = result.sections.flatMap((section, index) => [
    `### ${index + 1}. ${section.title}`,
    section.description,
    ...section.bullets.map((bullet) => `- ${bullet}`),
    '',
  ]);
  const candidateLines = result.candidates.flatMap((candidate, index) => [
    `### ${index + 1}. ${candidate.title}`,
    `置信度: ${candidate.confidence}`,
    ...candidate.evidence.map((evidence) => `- ${evidence}`),
    '',
  ]);

  return [
    `# ${result.title}`,
    '',
    '## 一、核心结论',
    result.summary,
    '',
    result.conclusion,
    '',
    '## 二、指标概览',
    ...metricLines,
    '',
    '## 三、趋势与维度拆解',
    ...contributionLines,
    '',
    ...sectionLines,
    '## 四、候选原因与证据',
    ...candidateLines,
    '## 五、业务建议',
    '- 优先核查贡献度最高的维度和异常分组明细。',
    '- 对关键科室、病种和费用结构进行二次复核。',
    '- 将本次结论沉淀为后续看板或周期报告的重点观察项。',
    '',
    '## 六、数据口径与说明',
    '- 本报告基于当前 ChatBI 可访问的数据、指标口径和模拟分析链路生成。',
    '- 结论用于经营分析辅助判断，正式发布前建议结合业务人员复核。',
  ].join('\n');
}

function buildHistoryMessages(agent: Agent, question: string, sentAt: Date): Message[] {
  const skillTrace = buildSkillTrace(agent);
  const routingTrace = resolveAgentForQuestion({
    mode: agent.type,
    question,
    forcedAgentId: agent.id,
  }).routingTrace;
  const userTimestamp = new Date(sentAt.getTime() - 5 * 60 * 1000);
  const analysisTimestamp = new Date(sentAt.getTime() - 4 * 60 * 1000);
  const assistantTimestamp = new Date(sentAt.getTime() - 2 * 60 * 1000);

  const userMessage: Message = {
    id: `msg-${agent.id}-${sentAt.getTime()}-user`,
    role: 'user',
    kind: 'text',
    content: question,
    timestamp: userTimestamp,
  };
  const analysisMessage: Message = {
    id: `msg-${agent.id}-${sentAt.getTime()}-analysis`,
    role: 'assistant',
    kind: 'analysis',
    content: '',
    timestamp: analysisTimestamp,
    skillTrace,
    routingTrace,
    analysisProcess: buildAgentAnalysisProcess(agent, question, skillTrace),
  };

  if (agent.type === 'report') {
    return [
      userMessage,
      analysisMessage,
      {
        id: `msg-${agent.id}-${sentAt.getTime()}-report`,
        role: 'assistant',
        kind: 'report-result',
        content: '',
        timestamp: assistantTimestamp,
        skillTrace,
        routingTrace,
        reportResult: buildReportResult(agent, question, skillTrace),
      },
    ];
  }

  if (agent.type === 'rca') {
    const rootCauseResult = buildRootCauseResult(agent, question);
    const markdownContent = buildHistoryDeepAnalysisMarkdown(rootCauseResult);

    return [
      userMessage,
      analysisMessage,
      {
        id: `msg-${agent.id}-${sentAt.getTime()}-rca`,
        role: 'assistant',
        kind: 'rca-result',
        content: '',
        timestamp: assistantTimestamp,
        skillTrace,
        routingTrace,
        rootCauseResult,
        markdownArtifact: {
          fileName: buildHistoryMarkdownFileName(sentAt),
          content: markdownContent,
        },
      },
    ];
  }

  return [
    userMessage,
    analysisMessage,
    {
      id: `msg-${agent.id}-${sentAt.getTime()}-ask`,
      role: 'assistant',
      kind: 'ask-result',
      content: '',
      timestamp: assistantTimestamp,
      skillTrace,
      routingTrace,
      analysisResult: buildAskResult(agent, question),
    },
  ];
}

function buildHistoryConversation(
  agentId: string,
  question: string,
  updatedAt: string,
): Conversation {
  const agent = agents.find((item) => item.id === agentId);
  const timestamp = new Date(updatedAt);

  if (!agent) {
    throw new Error(`Unknown agent for mock conversation: ${agentId}`);
  }

  return {
    id: `conv-${agentId}-${timestamp.getTime()}`,
    title: question.length > 18 ? `${question.slice(0, 18)}...` : question,
    agentId: agent.id,
    agentType: agent.type,
    workspaceType: agent.type === 'rca' ? 'ask' : agent.type,
    messages: buildHistoryMessages(agent, question, timestamp),
    createdAt: new Date(timestamp.getTime() - 10 * 60 * 1000),
    updatedAt: timestamp,
  };
}

type BoundaryCase =
  | 'mode-restriction'
  | 'missing-dataset'
  | 'missing-agent'
  | 'ambiguous-scope'
  | 'empty-result'
  | 'sql-failed'
  | 'interrupted';

function buildBoundaryCaseConversation(
  caseType: BoundaryCase,
  question: string,
  updatedAt: string,
): Conversation {
  const agent = agents.find((item) => item.id === 'agent-ask-outpatient');
  const timestamp = new Date(updatedAt);

  if (!agent) {
    throw new Error('Missing outpatient agent for mock boundary conversation');
  }

  const userMessage: Message = {
    id: `msg-boundary-${caseType}-${timestamp.getTime()}-user`,
    role: 'user',
    kind: 'text',
    content: question,
    timestamp: new Date(timestamp.getTime() - 5 * 60 * 1000),
  };
  const analysisTimestamp = new Date(timestamp.getTime() - 4 * 60 * 1000);
  const process = buildAgentAnalysisProcess(agent, question, buildSkillTrace(agent));
  let messages: Message[];

  switch (caseType) {
    case 'mode-restriction':
      messages = [
        userMessage,
        {
          id: `msg-boundary-${caseType}-${timestamp.getTime()}-notice`,
          role: 'assistant',
          kind: 'clarification',
          content: '当前为问数模式，暂不支持生成报告。请退出问数模式后再试。',
          timestamp: analysisTimestamp,
          originalQuestion: question,
        },
      ];
      break;
    case 'ambiguous-scope':
      messages = [
        userMessage,
        {
          id: `msg-boundary-${caseType}-${timestamp.getTime()}-clarification`,
          role: 'assistant',
          kind: 'clarification',
          content: '识别到多个可执行且置信度相近的分析范围，请确认本次分析范围。',
          timestamp: analysisTimestamp,
          originalQuestion: question,
          clarificationOptions: [
            { agentId: 'agent-ask-outpatient', label: '门诊收入', reason: '按门诊科室与收费项目分析' },
            { agentId: 'agent-ask-inpatient', label: '住院收入', reason: '按住院科室与结算收入分析' },
          ],
        },
      ];
      break;
    case 'missing-dataset':
      messages = [
        userMessage,
        {
          id: `msg-boundary-${caseType}-${timestamp.getTime()}-analysis`,
          role: 'assistant',
          kind: 'analysis',
          content: '',
          timestamp: analysisTimestamp,
          parentUserMessageId: userMessage.id,
          analysisProcess: {
            ...process,
            datasetName: '',
            metrics: [],
            dimensions: [],
            knowledgeHits: [],
            skillMatches: [],
            mcpMatches: [],
            thoughtItems: [],
            sql: '',
            resultPreview: { title: '', metrics: [], chartData: [] },
            status: 'unavailable',
            visibleStepCount: 3,
            matchStatus: 'missing-dataset',
            matchMessage: '暂未找到可用于分析的数据。请补充分析范围后重试。',
            sqlExecutionStatus: 'not-run',
            sqlExecutionMessage: 'SQL 未执行。',
          },
        },
      ];
      break;
    case 'missing-agent':
      messages = [
        userMessage,
        {
          id: `msg-boundary-${caseType}-${timestamp.getTime()}-analysis`,
          role: 'assistant',
          kind: 'analysis',
          content: '',
          timestamp: analysisTimestamp,
          parentUserMessageId: userMessage.id,
          analysisProcess: {
            ...process,
            datasetName: '',
            metrics: [],
            dimensions: [],
            knowledgeHits: [],
            skillMatches: [],
            mcpMatches: [],
            thoughtItems: [],
            sql: '',
            resultPreview: { title: '', metrics: [], chartData: [] },
            status: 'unavailable',
            visibleStepCount: 3,
            matchStatus: 'missing-agent',
            matchMessage: '暂未找到可处理该问题的分析能力。请调整问题描述后重试。',
            sqlExecutionStatus: 'not-run',
            sqlExecutionMessage: 'SQL 未执行。',
          },
        },
      ];
      break;
    case 'empty-result':
      messages = [
        userMessage,
        {
          id: `msg-boundary-${caseType}-${timestamp.getTime()}-analysis`,
          role: 'assistant',
          kind: 'analysis',
          content: '',
          timestamp: analysisTimestamp,
          parentUserMessageId: userMessage.id,
          analysisProcess: {
            ...process,
            resultPreview: { title: '未查询到符合条件的数据', metrics: [], chartData: [] },
            sqlExecutionStatus: 'empty',
            sqlExecutionMessage: '未查询到符合当前条件的数据。请检查筛选条件或调整查询范围后重试。',
          },
        },
      ];
      break;
    case 'sql-failed':
      messages = [
        userMessage,
        {
          id: `msg-boundary-${caseType}-${timestamp.getTime()}-analysis`,
          role: 'assistant',
          kind: 'analysis',
          content: '',
          timestamp: analysisTimestamp,
          parentUserMessageId: userMessage.id,
          analysisProcess: {
            ...process,
            sqlExecutionStatus: 'failed',
            sqlExecutionMessage: '查询暂未完成，请稍后重试。',
          },
        },
      ];
      break;
    case 'interrupted':
      messages = [
        userMessage,
        {
          id: `msg-boundary-${caseType}-${timestamp.getTime()}-analysis`,
          role: 'assistant',
          kind: 'analysis',
          content: '',
          timestamp: analysisTimestamp,
          parentUserMessageId: userMessage.id,
          isInterrupted: true,
          analysisProcess: {
            ...process,
            status: 'interrupted',
            visibleStepCount: 3,
            sql: '',
            sqlExecutionStatus: 'not-run',
            sqlExecutionMessage: '查询已中断，未生成结果或模拟 SQL。',
          },
        },
      ];
      break;
  }

  return {
    id: `conv-boundary-${caseType}-${timestamp.getTime()}`,
    title: question,
    agentId: agent.id,
    agentType: 'ask',
    workspaceType: 'ask',
    messages,
    createdAt: new Date(timestamp.getTime() - 10 * 60 * 1000),
    updatedAt: timestamp,
  };
}

export const initialConversations: Conversation[] = [
  buildBoundaryCaseConversation('mode-restriction', '生成本周门诊经营周报', '2026-07-12T11:30:00'),
  buildBoundaryCaseConversation('missing-dataset', '查询儿童保健疫苗接种率', '2026-07-12T11:20:00'),
  buildBoundaryCaseConversation('missing-agent', '分析海外院区床位周转率', '2026-07-12T11:10:00'),
  buildBoundaryCaseConversation('ambiguous-scope', '分析上月收入增长情况', '2026-07-12T11:00:00'),
  buildBoundaryCaseConversation('empty-result', '查询眼科 2020 年诊量', '2026-07-12T10:50:00'),
  buildBoundaryCaseConversation('sql-failed', '查询门诊收入趋势', '2026-07-12T10:40:00'),
  buildBoundaryCaseConversation('interrupted', '查询住院费用明细', '2026-07-12T10:35:00'),
  buildHistoryConversation('agent-ask-outpatient', '眼科近三个月诊量是否异常', '2026-07-12T10:30:00'),
  buildHistoryConversation('agent-ask-outpatient', '上月门诊总收入和药占比情况', '2026-07-12T10:20:00'),
  buildHistoryConversation('agent-ask-inpatient', '本季度平均住院日变化', '2026-07-12T09:24:00'),
  buildHistoryConversation('agent-ask-inpatient', '住院收入增长最快的科室', '2026-07-12T09:20:00'),
  buildHistoryConversation('agent-ask-outpatient', '门诊治疗收入贡献最大的三个科室', '2026-06-18T15:17:00'),
  buildHistoryConversation('agent-ask-outpatient', '来诊检查收入变化趋势如何', '2026-06-18T15:13:00'),
  buildHistoryConversation('agent-ask-outpatient', '近三个月诊量是否异常', '2026-06-15T14:48:00'),
  buildHistoryConversation('agent-ask-outpatient', '眼科诊量是否异常', '2026-06-12T16:20:00'),
  buildHistoryConversation('agent-report-daily', '生成本周门急诊经营周报。', '2026-06-18T09:40:00'),
  buildHistoryConversation('agent-report-special', '生成一份检查收入下降专题报告。', '2026-06-17T14:30:00'),
];


