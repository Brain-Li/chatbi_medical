export type AgentType = 'ask' | 'report' | 'rca';

export type AgentGroup = 'ask' | 'report' | 'rca';

export interface WorkspaceAutoSubmitPayload {
  mode: Extract<AgentType, 'ask' | 'report'>;
  question: string;
  conversationId?: string;
  nonce?: string;
  deepAnalysisEnabled?: boolean;
  reportTemplateId?: string;
  manualSkillIds?: string[];
  userMessageContent?: string;
  forceNewConversation?: boolean;
}

export interface HomePrefillPayload {
  mode: Extract<AgentType, 'ask' | 'report'> | null;
  draft: string;
  templateId?: string;
}

export type MessageKind =
  | 'text'
  | 'analysis'
  | 'clarification'
  | 'ask-result'
  | 'report-result'
  | 'rca-result'
  | 'skill-rerun';

export type ResultScope = 'combined' | 'single-skill';

export interface SkillTrace {
  id: string;
  name: string;
  reason: string;
}

export interface AgentRoutingTrace {
  agentId: string;
  agentName: string;
  agentType: AgentType;
  confidence: 'high' | 'medium' | 'low';
  datasetNames: string[];
  skillNames: string[];
  matchedSignals: string[];
}

export interface AgentClarificationOption {
  agentId: string;
  label: string;
  reason: string;
}

export type AnalysisStepId =
  | 'understand-question'
  | 'understand-intent'
  | 'plan-analysis'
  | 'resolve-data-scope'
  | 'match-capability'
  | 'load-skills'
  | 'execute-skills'
  | 'retrieve-knowledge'
  | 'generate-query'
  | 'execute-query';

export type AnalysisStepStatus =
  | 'running'
  | 'completed'
  | 'awaiting-confirmation'
  | 'needs-input'
  | 'failed'
  | 'interrupted';

export type AnalysisScenarioCode =
  | 'greeting-or-capability'
  | 'out-of-scope'
  | 'missing-information'
  | 'ambiguous-data-scope'
  | 'missing-agent'
  | 'capability-unavailable'
  | 'knowledge-missing'
  | 'sql-generation-failed'
  | 'empty-result'
  | 'sql-execution-failed'
  | 'query-timeout'
  | 'user-interrupted'
  | 'unexpected-error';

export type AskQuestionIntentStatus =
  | 'out-of-scope'
  | 'missing-information'
  | 'routable';

export interface AskQuestionIntentClassification {
  status: AskQuestionIntentStatus;
  reason: string;
  signals: string[];
  missingFields?: Array<'metric' | 'time-range'>;
  replyVariant?: 'standard' | 'greeting' | 'capability';
}

export interface AnalysisProcessStep {
  id: AnalysisStepId;
  title: string;
  status: AnalysisStepStatus;
  detail?: string;
}

export interface AnalysisCandidateOption {
  id: string;
  type: 'dataset' | 'metric';
  label: string;
  businessTopic?: string;
  description: string;
  confidence: number;
}

export interface AnalysisClarification {
  stage: 'dataset' | 'metric';
  options: AnalysisCandidateOption[];
  selectedDatasetId?: string;
  selectedDatasetLabel?: string;
  selectedMetricId?: string;
  selectedMetricLabel?: string;
  nextOptions?: AnalysisCandidateOption[];
}

export interface AskExecutionContext {
  originalQuestion: string;
  selectedDatasetId?: string;
  selectedMetricId?: string;
  filters?: string[];
}

export interface MetricChip {
  label: string;
  value: string;
  trend?: 'up' | 'down' | 'flat';
}

export interface ChartDatum {
  name: string;
  value: number;
}

export type IndicatorType = '原子指标' | '派生指标' | '复合指标';

export type IndicatorStatus = '草稿' | '已发布' | '已停用';

export type PermissionLevel = '普通' | '重要' | '核心';

export type DatasetFieldRole =
  | '时间字段'
  | '维度字段'
  | '度量字段'
  | '标识字段'
  | '隐藏字段';

export type AggregationMethod =
  | 'NONE'
  | 'SUM'
  | 'COUNT'
  | 'COUNT DISTINCT'
  | 'AVG'
  | 'MAX'
  | 'MIN';

export interface DatasetFieldDefinition {
  name: string;
  semanticName: string;
  description: string;
  fieldRole?: DatasetFieldRole;
  dataType?: 'string' | 'number' | 'date' | 'boolean';
  defaultAggregation?: AggregationMethod;
}

export interface MetricDefinition {
  name: string;
  formula: string;
  description: string;
}

export interface KnowledgeBase {
  id: string;
  name: string;
  businessTheme: string;
  applicableAgentTypes: AgentType[];
  datasetIds: string[];
  permissionGroups: string[];
  status: '已启用' | '已停用';
}

export interface KnowledgeDocument {
  id: string;
  knowledgeBaseId: string;
  title: string;
  source: string;
  type: '指标口径' | '业务规则' | '政策说明' | '统计口径' | '权限规则';
  updatedAt: string;
  applicableScenes: string[];
  tags: string[];
  fileName?: string;
  filePreviewUrl?: string;
  fileMimeType?: string;
}

export interface KnowledgeSnippet {
  id: string;
  documentId: string;
  summary: string;
  keywords: string[];
  metricIds: string[];
  dimensionIds: string[];
  skillIds: string[];
  datasetIds: string[];
  confidence: '高' | '中' | '低';
  conflictNote?: string;
}

export interface KnowledgeHit {
  id: string;
  knowledgeBaseId: string;
  knowledgeBaseName: string;
  documentId: string;
  documentTitle: string;
  documentSource: string;
  documentType: KnowledgeDocument['type'];
  updatedAt: string;
  summary: string;
  applicableScenes: string[];
  tags: string[];
  matchedKeywords: string[];
  citationReason: string;
  confidence: KnowledgeSnippet['confidence'];
  conflictNote?: string;
}

export interface ResultEvidence {
  intent: string;
  datasetId: string;
  datasetName: string;
  indicators: MetricDefinition[];
  dimensions: string[];
  filters: string[];
  timeRange: string;
  timeField?: string;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  sql: string;
  lineage: string[];
  governanceNote?: string;
  metricSemantic?: string;
  dimensionMatches?: string[];
  timeSemantic?: string;
  synonymHits?: string[];
  selectedMappings?: string[];
  isOfficialMetric?: boolean;
  knowledgeHits?: KnowledgeHit[];
}

export interface ReportPushRecord {
  id: string;
  channel: '站内消息' | '邮件';
  target: string;
  sentAt: string;
  status: '成功' | '失败';
  note: string;
}

export interface ReportPushConfig {
  frequency: string;
  channel: '站内消息' | '邮件';
  audience: string;
  nextRun: string;
  lastRun: string;
  enabled: boolean;
  records: ReportPushRecord[];
}

export type ReportSubscriptionFrequency = 'daily' | 'weekly' | 'monthly' | 'cron';
export type ReportSubscriptionChannel = '站内消息' | '邮件';
export type ReportSubscriptionStatus = 'running' | 'paused' | 'needs_attention';
export type ReportRunStatus = '成功' | '失败' | '重试中';
export type ReportHolidayPolicy = 'skip' | 'run' | 'next_workday';

export interface ReportSubscriptionRun {
  id: string;
  subscriptionId: string;
  generatedAt: string;
  reportTitle: string;
  status: ReportRunStatus;
  retryCount: number;
  failureReason?: string;
  link: string;
}

export interface ReportSubscription {
  id: string;
  name: string;
  reportTemplateId: string;
  agentId: string;
  reportTheme: string;
  period: string;
  frequency: ReportSubscriptionFrequency;
  cronExpression?: string;
  runTime: string;
  timezone: string;
  holidayPolicy: ReportHolidayPolicy;
  recipients: string[];
  channels: ReportSubscriptionChannel[];
  outputFormats: string[];
  permissionPolicy: string;
  nextRunAt: string;
  lastRunAt?: string;
  lastStatus: ReportRunStatus;
  status: ReportSubscriptionStatus;
  retryLimit: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  runs: ReportSubscriptionRun[];
  pushRecords: ReportPushRecord[];
}

export type ReportTemplateStatus = 'draft' | 'published' | 'disabled';

export type ReportTemplateChartType = 'line' | 'bar' | 'table' | 'pie' | 'metric-card';

export interface ReportTemplateParameter {
  id: string;
  name: string;
  label: string;
  required: boolean;
  defaultValue?: string;
}

export interface ReportTemplateSection {
  id: string;
  title: string;
  required: boolean;
  description: string;
}

export interface ReportTemplateMetricBlock {
  id: string;
  metricId: string;
  label: string;
  dimensionIds: string[];
  comparison: string[];
}

export interface ReportTemplateChartBlock {
  id: string;
  title: string;
  type: ReportTemplateChartType;
  metricIds: string[];
  dimensionIds: string[];
  sortBy?: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  createdAt?: string;
  status: ReportTemplateStatus;
  triggerPhrases: string[];
  templatePrompt: string;
  applicableAgentIds: string[];
  datasetIds: string[];
  skillIds: string[];
  parameters: ReportTemplateParameter[];
  analysisSteps: string[];
  comparisonMethods: string[];
  anomalyRules: string[];
  attributionPath: string[];
  sections: ReportTemplateSection[];
  metricBlocks: ReportTemplateMetricBlock[];
  chartBlocks: ReportTemplateChartBlock[];
  outputFormats: string[];
  pushChannels: string[];
  complianceNotes: string[];
}

export type ReportTemplateSource = 'user-selected' | 'library-matched' | 'agent-generated';

export interface ReportTemplateUsage {
  templateId: string;
  name: string;
  category: string;
  version: string;
  source: ReportTemplateSource;
  matchScore?: number;
  isTemporary: boolean;
  templateSnapshot: ReportTemplate;
  sections: string[];
  datasetNames: string[];
  skillNames: string[];
  metricLabels: string[];
  complianceNotes: string[];
  matchReason: string;
}

export interface ReportResultData {
  title: string;
  period: string;
  summary: string;
  keyMetrics: MetricChip[];
  chartTitle: string;
  chartData: ChartDatum[];
  findings: string[];
  alerts: string[];
  embeddedAnalysis: string[];
  exportFormats: string[];
  pushConfig: ReportPushConfig;
  templateUsage?: ReportTemplateUsage;
}

export interface RootCauseSection {
  title: string;
  description: string;
  bullets: string[];
}

export interface RootCauseCandidate {
  title: string;
  confidence: string;
  evidence: string[];
}

export interface RootCauseResultData {
  title: string;
  summary: string;
  overviewMetrics: MetricChip[];
  contributionChart: ChartDatum[];
  sections: RootCauseSection[];
  candidates: RootCauseCandidate[];
  conclusion: string;
}

export interface AnalysisResultData {
  title: string;
  summary: string;
  metrics: MetricChip[];
  chartData: ChartDatum[];
  recommendations: string[];
  evidence?: ResultEvidence;
  datasetResults?: DatasetAnalysisResult[];
}

export interface DatasetAnalysisResult {
  datasetId: string;
  datasetName: string;
  businessTopic: string;
  summary: string;
  metrics: MetricChip[];
  chartTitle: string;
  chartData: ChartDatum[];
  status: 'completed' | 'empty' | 'failed';
  statusMessage?: string;
  evidence?: ResultEvidence;
}

export interface AnalysisProcessResultPreview {
  title: string;
  metrics: MetricChip[];
  chartData: ChartDatum[];
}

export interface AnalysisSkillMatch {
  id: string;
  name: string;
  source: '自动匹配' | '手动选择';
  description?: string;
}

export type AnalysisMcpMatchStatus = '可调用' | '已调用' | '跳过';

export interface AnalysisMcpMatch {
  id: string;
  name: string;
  serverName: string;
  status: AnalysisMcpMatchStatus;
  reason: string;
}

export interface AnalysisReferenceSource {
  id: string;
  kind: 'knowledge-document' | 'webpage';
  title: string;
  source: string;
  summary: string;
  usedAt: string;
  url?: string;
  documentType?: KnowledgeDocument['type'];
  citationReason?: string;
}

export type DeepAnalysisActivityId =
  | 'understand-intent'
  | 'plan-analysis'
  | 'resolve-data-scope'
  | 'load-skills'
  | 'execute-skills'
  | 'retrieve-knowledge'
  | 'execute-query'
  | 'generate-insights'
  | 'draft-report';

export interface AnalysisProcessData {
  question: string;
  datasetName: string;
  metrics: string[];
  dimensions: string[];
  timeRange?: string;
  filters?: string[];
  knowledgeHits: KnowledgeHit[];
  referenceSources?: AnalysisReferenceSource[];
  skillMatches: AnalysisSkillMatch[];
  mcpMatches: AnalysisMcpMatch[];
  thoughtItems: string[];
  sql: string;
  resultPreview: AnalysisProcessResultPreview;
  status: 'running' | 'completed' | 'interrupted';
  plannedTaskCount?: number;
  visibleStepCount?: number;
  elapsedSeconds?: number;
  matchStatus?: 'matched' | 'missing-agent' | 'missing-dataset';
  matchMessage?: string;
  sqlExecutionStatus?: 'pending' | 'success' | 'empty' | 'failed' | 'not-run';
  sqlExecutionMessage?: string;
  steps?: AnalysisProcessStep[];
  scenarioCode?: AnalysisScenarioCode;
  hasRealResult?: boolean;
  canRetry?: boolean;
  executionContext?: AskExecutionContext;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  kind: MessageKind;
  content: string;
  timestamp: Date;
  parentUserMessageId?: string;
  manualSkillIds?: string[];
  resultScope?: ResultScope;
  isInterrupted?: boolean;
  isGenerating?: boolean;
  isAwaitingResult?: boolean;
  visibleStepCount?: number;
  visibleMarkdownLineCount?: number;
  visibleDeepAnalysisBlockCount?: number;
  visibleDeepAnalysisTextLength?: number;
  analysisSteps?: string[];
  matchedReportTemplateName?: string;
  reportTemplateUsage?: ReportTemplateUsage;
  analysisSummary?: string;
  skillTrace?: SkillTrace[];
  routingTrace?: AgentRoutingTrace;
  clarificationOptions?: AgentClarificationOption[];
  relatedAnalysisMessageId?: string;
  analysisClarification?: AnalysisClarification;
  analysisExecutionContext?: AskExecutionContext;
  selectedAnalysisCandidateId?: string;
  originalQuestion?: string;
  analysisResult?: AnalysisResultData;
  reportResult?: ReportResultData;
  rootCauseResult?: RootCauseResultData;
  runtimeConfig?: AgentRuntimeConfig;
  analysisProcess?: AnalysisProcessData;
  markdownArtifact?: {
    fileName: string;
    content: string;
  };
}

export interface Conversation {
  id: string;
  title: string;
  agentId?: string;
  agentType?: AgentType;
  workspaceType: AgentType;
  deepAnalysisEnabled?: boolean;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  isDemo?: boolean;
  demoOrder?: number;
}

export interface Skill {
  id: string;
  name: string;
  scene: string;
  description: string;
  triggerPhrases: string[];
  skillMarkdown: string;
  applicableAgentTypes: AgentType[];
  builtin: boolean;
  status: '已启用' | '已停用';
  version: string;
  debugState: '已验证' | '待调试' | '调试中';
  tags: string[];
  metricIds?: string[];
  dimensionIds?: string[];
  analysisRules?: string[];
  outputArtifacts?: string[];
}

export interface AgentReportConfig {
  theme: string;
  metrics: string[];
  scheduleEnabled: boolean;
  boundTemplateIds?: string[];
  defaultTemplateId?: string;
  autoMatchTemplate?: boolean;
}

export interface AgentRcaConfig {
  drilldownStrategy: string;
  ruleSet: string[];
  statisticalMethod: string;
}

export interface AgentKnowledgeConfig {
  enabled: boolean;
  mode: 'follow-agent' | 'manual-documents';
  knowledgeBaseIds?: string[];
  knowledgeDocumentIds?: string[];
}

export interface AgentBehaviorConfig {
  roleDefinition: string;
  answerPrinciples: string;
  clarificationPolicy: string;
  forbiddenTopics: string;
  outputFormat: string;
}

export interface AgentResultVisibilityConfig {
  showSql: boolean;
  showQueryBasis: boolean;
  showDataSource: boolean;
  showConfidence: boolean;
  allowDetailView: boolean;
}

export type AgentFieldAccessLevel = '汇总数据' | '科室明细' | '医生明细' | '患者明细';

export interface AgentPermissionConfig {
  permissionGroup: string;
  fieldAccessLevel: AgentFieldAccessLevel;
  allowPatientDetail: boolean;
  desensitizeSensitiveData: boolean;
  sensitiveQuestionPolicy: string;
}

export interface AgentRuntimeConfig {
  showSql: boolean;
  showQueryBasis: boolean;
  showDataSource: boolean;
  showConfidence: boolean;
  allowDetailView: boolean;
  allowExport: boolean;
  allowCrossDataset: boolean;
  permissionGroup: string;
  desensitizeSensitiveData: boolean;
}

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  group: AgentGroup;
  description: string;
  creator: string;
  updatedAt: Date;
  status: '已启用' | '已停用';
  skills: string[];
  exampleQuestions: string[];
  capabilitySummary: string;
  datasetIds?: string[];
  /** @deprecated Agent 管理不再配置指标；运行时从数据集语义和 Skill 线索推导。 */
  defaultMetricIds?: string[];
  behaviorConfig?: AgentBehaviorConfig;
  responseStyle?: string;
  showSql?: boolean;
  allowExport?: boolean;
  allowCrossDataset?: boolean;
  anomalyPolicy?: string;
  resultVisibility?: AgentResultVisibilityConfig;
  permissionConfig?: AgentPermissionConfig;
  knowledgeConfig?: AgentKnowledgeConfig;
  isDefault?: boolean;
  reportConfig?: AgentReportConfig;
  rcaConfig?: AgentRcaConfig;
}

export type McpTransport = 'Streamable HTTP' | 'stdio';

export type McpAuthType = 'OAuth 2.1' | 'None';

export type McpEnvironment = '生产' | '测试' | '沙箱';

export type McpHealthStatus = '正常' | '异常' | '未检测';

export type McpCapabilityKind = 'tool' | 'resource' | 'prompt';

export type McpRiskLevel = '低' | '中' | '高';

export type McpAuditStatus = '成功' | '失败' | '拦截';

export interface McpCapability {
  id: string;
  serverId: string;
  name: string;
  kind: McpCapabilityKind;
  description: string;
  inputSchema: string;
  outputSchema: string;
  scopes: string[];
  tags: string[];
  sideEffect: boolean;
  riskLevel: McpRiskLevel;
  enabled: boolean;
  agentIds: string[];
  skillIds: string[];
}

export interface McpServer {
  id: string;
  name: string;
  businessDomain: string;
  endpoint: string;
  transport: McpTransport;
  authType: McpAuthType;
  authConfigName?: string;
  owner: string;
  environment: McpEnvironment;
  status: '已启用' | '已停用';
  healthStatus: McpHealthStatus;
  lastSyncedAt: string;
  updatedAt: string;
  capabilities: McpCapability[];
}

export interface McpAuditLog {
  id: string;
  calledAt: string;
  user: string;
  agentId: string;
  skillId: string;
  serverId: string;
  capabilityId: string;
  status: McpAuditStatus;
  durationMs: number;
  reason: string;
  inputSummary: string;
  resultSummary: string;
}

export interface DatabaseConnection {
  id: number;
  name: string;
  type: string;
  jdbcUrl: string;
  username: string;
  password: string;
  databaseName: string;
  admins: string[];
  users: string[];
  creator: string;
  description: string;
  updatedAt: string;
}

export interface LlmConnection {
  id: number;
  connectionName: string;
  modelName: string;
  version: string;
  creator: string;
  description: string;
  updatedAt: string;
}

export interface DatasetTable {
  name: string;
  type: '事实表' | '维度表';
  fields: DatasetFieldDefinition[];
}

export interface MetricSemantic {
  id: string;
  name: string;
  label: string;
  description: string;
  indicatorIds: string[];
  defaultTimeDimensionId: string;
  allowedDimensionIds: string[];
}

export type TimeGrain = '日' | '周' | '月' | '季' | '年';

export type TimeFieldRole = '就诊日期' | '结算日期' | '出院日期' | '手术日期';

export interface DimensionDatasetBinding {
  id: string;
  datasetId: string;
  field: string;
  memberSource?: string;
  enabled: boolean;
}

export interface TimeDimensionConfig {
  fieldRole: TimeFieldRole;
  supportedGrains: TimeGrain[];
  relativePresets: string[];
}

export interface DimensionSemantic {
  id: string;
  name: string;
  label: string;
  description: string;
  type: '普通' | '时间';
  synonyms: string[];
  hierarchyId?: string;
  memberResolver: 'enum' | 'dictionary' | 'runtime_search';
  bindings: DimensionDatasetBinding[];
  timeConfig?: TimeDimensionConfig;
}

export interface DimensionMember {
  id: string;
  dimensionId: string;
  name: string;
  aliases: string[];
  valueMappings?: DimensionMemberValueMapping[];
  parentId?: string;
}

export interface DimensionMemberValueMapping {
  id: string;
  datasetId: string;
  rawValues: string[];
  enabled: boolean;
}

export interface MetricDatasetBinding {
  id: string;
  datasetId: string;
  mode: 'field' | 'formula';
  field?: string;
  formulaOverride?: string;
  enabled: boolean;
  defaultTimeDimensionId?: string;
  allowedDimensionIds?: string[];
}

export interface SemanticDataset {
  id: string;
  name: string;
  description: string;
  businessTheme: string;
  subjectObject: string;
  sourceName?: string;
  querySql?: string;
  queryFields?: DatasetFieldDefinition[];
  datasourceCount: number;
  drilldownRule: string;
  tables: DatasetTable[];
  metricIds: string[];
  synonyms: string[];
  permissionScope: string;
  relations: string[];
  owner: string;
  updatedAt: string;
}

export interface IndicatorAsset {
  id: string;
  numericId: number;
  name: string;
  nameEn: string;
  datasetId: string;
  datasetName: string;
  type: IndicatorType;
  formula: string;
  businessDefinition: string;
  availableDimensions: string[];
  defaultGrain: string;
  sensitivity: PermissionLevel;
  status: IndicatorStatus;
  creator: string;
  updatedAt: string;
  referencedBy: string[];
  lineage: string[];
  synonyms: string[];
  sampleQuestions: string[];
  recentUsage: string[];
  metricSemanticId?: string;
  defaultTimeDimensionId?: string;
  allowedDimensionIds?: string[];
  metricBindings?: MetricDatasetBinding[];
  sourceFieldName?: string;
  sourceMetricIds?: string[];
  ruleDescription?: string;
}
