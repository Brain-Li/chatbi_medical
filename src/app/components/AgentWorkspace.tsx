import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  Activity,
  ArrowUp,
  Check,
  ChevronsLeft,
  Square,
  X,
} from 'lucide-react';
import {
  buildAskResult,
  buildAgentAnalysisProcess,
  buildReportResult,
  buildRootCauseResult,
  buildSkillTrace,
  ASK_INTENT_BOUNDARY_COPY,
  classifyAskQuestionIntent,
  getSuggestionSet,
  resolveAgentForQuestion,
} from '../mockData';
import { useWorkspace } from '../context/WorkspaceContext';
import { inferPromptMode } from '../utils/promptMode';
import { buildAnalysisReportFileName } from '../utils/reportFileName';
import { Agent, AgentClarificationOption, AgentRuntimeConfig, AgentType, AnalysisCandidateOption, AnalysisMcpMatch, AnalysisProcessData, AnalysisProcessStep, AnalysisResultData, AskQuestionIntentClassification, DeepAnalysisActivityId, McpCapability, Message, ReportResultData, ResultScope, Skill, WorkspaceAutoSubmitPayload } from '../types';
import { ConversationHistorySidebar } from './ConversationHistorySidebar';
import { PromptModeBar, PromptModeTag } from './PromptModeBar';
import { PromptComposerFrame } from './PromptComposerFrame';
import {
  DeepAnalysisWorkbench,
  getCurrentDeepAnalysisActivityId,
  getDeepAnalysisStage,
  getWorkbenchTabForActivity,
  type DeepAnalysisFeedback,
  type DeepAnalysisStage,
  type DeepAnalysisWorkbenchTab,
} from './DeepAnalysisWorkbench';
import { AssistantMessageCard, WorkspaceAnalysisProcessContent } from './WorkspaceResultCards';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from './ui/command';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import globalLine from '../../assets/figma-home/global-line.svg';
import globalLineSelected from '../../assets/figma-home/global-line-selected.svg';
import micLine from '../../assets/figma-home/mic-line.svg';

const workspaceNames: Record<AgentType, string> = {
  ask: '智能问数',
  report: '报告生成',
  rca: '深度分析',
};

const newConversationLabels: Record<AgentType, string> = {
  ask: '新问答',
  report: '新报告',
  rca: '新分析',
};

const groupedLabels: Record<AgentType, string> = {
  ask: '历史',
  report: '历史',
  rca: '历史',
};

const agentTypeLabels: Record<AgentType, string> = {
  ask: '智能问数',
  report: '报告生成',
  rca: '深度分析',
};

const STREAM_STEP_INTERVAL_MS = 1500;
const RESULT_APPEND_DELAY_MS = 420;
const ASK_PROCESS_STEP_COUNT = 6;
const DEEP_ANALYSIS_PROCESS_STEP_COUNT = 7;
const FINAL_PROCESS_STEP_STREAM_DURATION_MS = 1000;
const REPORT_PROCESS_STEP_COUNT = 7;
const REPORT_STREAM_STEP_INTERVAL_MS = 1500;
const REPORT_MARKDOWN_STREAM_INTERVAL_MS = 90;
const REPORT_FINAL_PROCESS_STEP_STREAM_DURATION_MS = 1000;
const DEEP_ANALYSIS_LEADING_STREAM_INTERVAL_MS = 360;
const DEEP_ANALYSIS_TYPEWRITER_INTERVAL_MS = 40;
const DEEP_ANALYSIS_TYPEWRITER_CHARS_PER_TICK = 3;

function getDeepAnalysisLeadingBlockCount(result: Message['rootCauseResult']) {
  if (!result) return 0;

  return 3 + (result.overviewMetrics.length ? 1 : 0);
}

function getDeepAnalysisTypingTextLength(result: Message['rootCauseResult']) {
  if (!result) return 0;

  return result.conclusion.length + result.sections.reduce(
    (count, section) => count
      + section.title.length
      + section.description.length
      + section.bullets.reduce((bulletCount, bullet) => bulletCount + bullet.length, 0),
    0,
  );
}

function WorkbenchRestoreControl({
  label,
  onOpen,
}: {
  label: string;
  onOpen: () => void;
}) {
  return (
    <aside className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 xl:block" aria-label={`${label}控制`}>
      <Tooltip delayDuration={240}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onOpen}
            className="group inline-flex h-11 w-7 items-center justify-end rounded-l-[5px] bg-transparent text-[#6b7785] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#165dff]/20"
            aria-label={`展开${label}`}
          >
            <span className="inline-flex h-9 w-4 items-center justify-center rounded-l-[4px] border border-r-0 border-[#e5e6eb] bg-white transition-colors group-hover:border-[#bedaff] group-hover:bg-[#f2f7ff] group-hover:text-[#165dff]">
              <ChevronsLeft aria-hidden="true" className="h-3 w-3" strokeWidth={1.6} />
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="left"
          sideOffset={8}
          showArrow={false}
          className="relative rounded-[4px] bg-[#1d2129] px-3 py-1 text-sm font-normal leading-[22px] whitespace-nowrap text-white shadow-none"
        >
          展开工作台
          <span aria-hidden="true" className="absolute left-full top-1/2 h-0 w-0 -translate-y-1/2 border-y-[5px] border-l-[4px] border-y-transparent border-l-[#1d2129]" />
        </TooltipContent>
      </Tooltip>
    </aside>
  );
}

const askProcessStepDefinitions: Array<Pick<AnalysisProcessStep, 'id' | 'title'>> = [
  { id: 'understand-question', title: '理解用户问题' },
  { id: 'resolve-data-scope', title: '确定数据口径' },
  { id: 'match-capability', title: '匹配分析能力' },
  { id: 'retrieve-knowledge', title: '检索知识依据' },
  { id: 'generate-query', title: '执行查询语句' },
  { id: 'execute-query', title: '执行数据查询' },
];

const deepAnalysisProcessStepDefinitions: Array<Pick<AnalysisProcessStep, 'id' | 'title'>> = [
  { id: 'understand-intent', title: '理解用户问题' },
  { id: 'plan-analysis', title: '规划分析任务' },
  { id: 'resolve-data-scope', title: '确定数据口径' },
  { id: 'load-skills', title: '匹配分析能力' },
  { id: 'execute-skills', title: '调用 Skill 和 MCP' },
  { id: 'retrieve-knowledge', title: '检索知识依据' },
  { id: 'execute-query', title: '执行数据查询' },
];

function buildVisibleProcessSteps(
  definitions: Array<Pick<AnalysisProcessStep, 'id' | 'title'>>,
  visibleStepCount: number,
  status: AnalysisProcessData['status'],
): AnalysisProcessStep[] {
  return definitions.slice(0, visibleStepCount).map((step, index, visibleSteps) => ({
    ...step,
    status:
      status === 'completed'
        ? 'completed'
        : status === 'interrupted' && index === visibleSteps.length - 1
          ? 'interrupted'
          : index === visibleSteps.length - 1
            ? 'running'
            : 'completed',
  }));
}

function buildVisibleAskSteps(
  visibleStepCount: number,
  status: AnalysisProcessData['status'],
): AnalysisProcessStep[] {
  return buildVisibleProcessSteps(askProcessStepDefinitions, visibleStepCount, status);
}

function buildVisibleDeepAnalysisSteps(
  visibleStepCount: number,
  status: AnalysisProcessData['status'],
): AnalysisProcessStep[] {
  return buildVisibleProcessSteps(deepAnalysisProcessStepDefinitions, visibleStepCount, status);
}

const reportProcessStepDefinitions: Array<Pick<AnalysisProcessStep, 'id' | 'title'>> = [
  { id: 'understand-intent', title: '理解用户问题' },
  { id: 'plan-analysis', title: '规划分析任务' },
  { id: 'resolve-data-scope', title: '确定数据口径' },
  { id: 'load-skills', title: '匹配分析能力' },
  { id: 'execute-skills', title: '调用 Skill 和 MCP' },
  { id: 'retrieve-knowledge', title: '检索知识依据' },
  { id: 'execute-query', title: '执行数据查询' },
];

function buildVisibleReportSteps(
  visibleStepCount: number,
  status: AnalysisProcessData['status'],
): AnalysisProcessStep[] {
  return buildVisibleProcessSteps(reportProcessStepDefinitions, visibleStepCount, status);
}

type ProcessMcpCapability = McpCapability & { serverName?: string };

type ExecuteQuestionOptions = {
  kind?: Message['kind'];
  manualSkillIds?: string[];
  skillTraceMode?: 'auto' | 'manual' | 'rerun';
  userMessageContent?: string;
  forcedAgentId?: string;
  forceDeepAnalysis?: boolean;
  forceNewConversation?: boolean;
  reportTemplateId?: string;
  inheritedTimeRange?: string;
};

type SlashMatch = {
  query: string;
  start: number;
  end: number;
};

type WorkspaceSwitchMode = Extract<AgentType, 'ask' | 'report'>;

type QuestionThread = {
  userMessage: Message;
  assistantMessages: Message[];
};

function getAnalysisSteps(agent: Agent, question: string) {
  if (agent.type === 'report') {
    return [
      `解析报告需求并识别数据范围：${question}`,
      '匹配全局报告模板库，并确认章节结构、指标口径和图表编排',
      '匹配可访问数据集、指标口径和报告所需分析能力',
      '检索知识文档并筛选可引用口径、规则和合规说明',
      '按模板组合指标卡、图表、口径说明、异常提示和报告章节',
    ];
  }

  if (agent.type === 'rca') {
    return [
      `识别待诊断指标并定位问题：${question}`,
      '基于指标口径确定计算范围和可下钻维度',
      '检索知识文档并筛选可引用口径、规则和合规说明',
      '按时间、科室、病种和费用组逐层下钻，生成候选根因和证据链',
    ];
  }

  return [
    `识别问题意图、时间范围和业务主题：${question}`,
    '匹配语义数据集、指标口径、可用维度和默认下钻路径',
    '检索知识文档并筛选可引用口径、规则和合规说明',
    '生成 SQL、图表和经营结论，并保留指标口径与血缘链路',
  ];
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

function getSkillSearchText(skill: Skill) {
  return normalizeSearchValue(
    [skill.name, skill.scene, skill.description, ...skill.triggerPhrases].join(' '),
  );
}

function getActiveSlashMatch(value: string): SlashMatch | null {
  const match = value.match(/(?:^|\s)\/([^\s]*)$/);

  if (!match) return null;

  const matchedText = match[0];
  const offset = matchedText.startsWith(' ') ? 1 : 0;
  const start = value.length - matchedText.length + offset;

  return {
    query: match[1] ?? '',
    start,
    end: value.length,
  };
}

function removeActiveSlashToken(value: string, preserveTrailingSpace = false) {
  const match = getActiveSlashMatch(value);

  if (!match) return value;

  const prefix = value.slice(0, match.start).replace(/\s+$/, '');

  if (!preserveTrailingSpace) return prefix;

  return prefix ? `${prefix} ` : '';
}

function getMessageQuestionText(content: string) {
  return content
    .replace(/^使用分析能力「.*?」重新生成：/, '')
    .replace(/^重新分析：/, '')
    .trim();
}

function isEnabledStatus(status: string) {
  return status === '已启用' || status.includes('启用') || status.includes('惎');
}

function getAgentRuntimeConfig(agent: Agent): AgentRuntimeConfig {
  const visibility = agent.resultVisibility;

  return {
    showSql: visibility?.showSql ?? agent.showSql ?? true,
    showQueryBasis: visibility?.showQueryBasis ?? true,
    showDataSource: visibility?.showDataSource ?? true,
    showConfidence: visibility?.showConfidence ?? true,
    allowDetailView: visibility?.allowDetailView ?? true,
    allowExport: agent.allowExport ?? true,
    allowCrossDataset: agent.allowCrossDataset ?? false,
    permissionGroup: agent.permissionConfig?.permissionGroup ?? '经营分析组',
    desensitizeSensitiveData: agent.permissionConfig?.desensitizeSensitiveData ?? true,
  };
}

function buildAnalysisProcessData({
  agent,
  question,
  result,
  skillTrace,
  skillMatchSource,
  mcpCapabilities,
  status,
}: {
  agent: Agent;
  question: string;
  result: AnalysisResultData;
  skillTrace: ReturnType<typeof buildSkillTrace>;
  skillMatchSource: '自动匹配' | '手动选择';
  mcpCapabilities: ProcessMcpCapability[];
  status: AnalysisProcessData['status'];
}): AnalysisProcessData {
  const evidence = result.evidence;
  const metrics = evidence?.indicators.map((indicator) => indicator.name) ?? result.metrics.map((metric) => metric.label);
  const dimensions = evidence?.dimensions ?? [];
  const knowledgeHits = evidence?.knowledgeHits ?? [];
  const skillIds = new Set(skillTrace.map((skill) => skill.id));
  const skillRelatedMcpCapabilities = mcpCapabilities.filter((capability) =>
    capability.skillIds.some((skillId) => skillIds.has(skillId)),
  );
  const mcpMatches: AnalysisMcpMatch[] = skillRelatedMcpCapabilities
    .filter((capability) => capability.enabled)
    .map((capability) => ({
      id: capability.id,
      name: capability.name,
      serverName: capability.serverName ?? capability.serverId,
      status: '可调用',
      reason: capability.description,
    }));

  return {
    question,
    datasetName: evidence?.datasetName ?? agent.datasetIds?.[0] ?? '自动匹配数据集',
    metrics,
    dimensions,
    timeRange: evidence?.timeRange,
    filters: evidence?.filters,
    knowledgeHits,
    skillMatches: skillTrace.map((skill) => ({
      id: skill.id,
      name: skill.name,
      source: skillMatchSource,
    })),
    mcpMatches,
    thoughtItems: [
      `理解问题：需要围绕“${question}”识别业务主题、时间范围、指标和维度。`,
      `分析数据：使用${evidence?.datasetName ?? '已匹配数据集'}，提取${metrics.slice(0, 3).join('、') || '核心指标'}。`,
      `确定方案：按${dimensions.slice(0, 3).join('、') || '默认维度'}组织查询，并结合知识依据校验口径。`,
      `选择工具：使用语义问数 SQL 生成、指标映射和知识库检索完成取数。`,
      `输出格式：生成指标卡、图表、可信口径和推荐追问。`,
    ],
    sql: evidence?.sql ?? '',
    resultPreview: {
      title: result.title,
      metrics: result.metrics,
      chartData: result.chartData,
    },
    status,
    visibleStepCount: status === 'running' ? 1 : undefined,
    steps: buildVisibleAskSteps(status === 'running' ? 1 : ASK_PROCESS_STEP_COUNT, status),
    hasRealResult: true,
    canRetry: true,
    executionContext: { originalQuestion: question, filters: evidence?.filters },
    matchStatus: 'matched',
    sqlExecutionStatus: status === 'running' ? 'pending' : 'success',
  };
}

function buildUnavailableAskProcess({
  question,
  matchStatus,
  matchMessage,
}: {
  question: string;
  matchStatus: 'missing-agent' | 'missing-dataset';
  matchMessage: string;
}): AnalysisProcessData {
  return {
    question,
    datasetName: '',
    metrics: [],
    dimensions: [],
    knowledgeHits: [],
    skillMatches: [],
    mcpMatches: [],
    thoughtItems: [],
    sql: '',
    resultPreview: { title: '', metrics: [], chartData: [] },
    status: matchStatus === 'missing-dataset' ? 'completed' : 'interrupted',
    visibleStepCount: matchStatus === 'missing-dataset' ? 2 : 3,
    steps: matchStatus === 'missing-dataset'
      ? [
          { id: 'understand-question', title: '理解用户问题', status: 'completed' },
          { id: 'resolve-data-scope', title: '确定数据口径', status: 'needs-input', detail: matchMessage },
        ]
      : [
          { id: 'understand-question', title: '理解用户问题', status: 'completed' },
          { id: 'resolve-data-scope', title: '确定数据口径', status: 'completed' },
          { id: 'match-capability', title: '匹配分析能力', status: 'failed', detail: matchMessage },
        ],
    scenarioCode: matchStatus === 'missing-dataset' ? 'missing-information' : 'missing-agent',
    hasRealResult: false,
    canRetry: true,
    executionContext: { originalQuestion: question },
    matchStatus,
    matchMessage,
    sqlExecutionStatus: 'not-run',
    sqlExecutionMessage: '暂未执行查询。',
  };
}

function buildReportMarkdown(question: string, result: ReportResultData) {
  return [
    `# ${result.title}`,
    '',
    `统计周期：${result.period}`,
    '',
    '## 核心结论',
    result.summary,
    '',
    '## 关键指标',
    ...result.keyMetrics.map((metric) => `- ${metric.label}：${metric.value}`),
    '',
    `## ${result.chartTitle}`,
    ...result.chartData.map((item) => `- ${item.name}：${item.value}`),
    '',
    '## 关键发现',
    ...result.findings.map((finding) => `- ${finding}`),
    '',
    '## 风险提示',
    ...result.alerts.map((alert) => `- ${alert}`),
    '',
    '## 分析依据',
    ...result.embeddedAnalysis.map((item) => `- ${item}`),
    '',
    '## 推送配置',
    `- 频率：${result.pushConfig.frequency}`,
    `- 渠道：${result.pushConfig.channel}`,
    `- 接收对象：${result.pushConfig.audience}`,
    '',
    `问题：${question}`,
  ].join('\n');
}

function buildAskIntentBoundaryProcess({
  question,
  classification,
}: {
  question: string;
  classification: AskQuestionIntentClassification;
}): AnalysisProcessData {
  const isOutOfScope = classification.status === 'out-of-scope';
  const detail = isOutOfScope
    ? ASK_INTENT_BOUNDARY_COPY.outOfScope.processDetail
    : classification.reason || ASK_INTENT_BOUNDARY_COPY.missingInformation.processDetail;

  return {
    question,
    datasetName: '',
    metrics: [],
    dimensions: [],
    knowledgeHits: [],
    skillMatches: [],
    mcpMatches: [],
    thoughtItems: [],
    sql: '',
    resultPreview: { title: '', metrics: [], chartData: [] },
    status: 'completed',
    visibleStepCount: isOutOfScope ? 1 : 2,
    steps: isOutOfScope
      ? [
          {
            id: 'understand-question',
            title: '理解用户问题',
            status: 'completed',
            detail,
          },
        ]
      : [
          {
            id: 'understand-question',
            title: '理解用户问题',
            status: 'completed',
            detail: ASK_INTENT_BOUNDARY_COPY.missingInformation.understandingDetail,
          },
          {
            id: 'resolve-data-scope',
            title: '确定数据口径',
            status: 'needs-input',
            detail,
          },
        ],
    scenarioCode: isOutOfScope ? 'out-of-scope' : 'missing-information',
    hasRealResult: false,
    canRetry: true,
    executionContext: { originalQuestion: question },
    sqlExecutionStatus: 'not-run',
    sqlExecutionMessage: '本轮未执行查询。',
  };
}

export default function AgentWorkspace({
  mode,
  sidebarOpen = true,
  onExecutionStart,
  onDeepAnalysisStart,
}: {
  mode: AgentType;
  sidebarOpen?: boolean;
  onExecutionStart?: () => void;
  onDeepAnalysisStart?: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    agents: allAgents,
    skills: allSkills,
    semanticDatasets,
    indicatorAssets,
    reportTemplates,
    createConversation,
    appendMessages,
    updateMessage,
    replaceConversationMessages,
    updateConversation,
    deleteConversation,
    renameConversation,
    getConversationsForWorkspace,
    activeConversationIds,
    setActiveConversationForWorkspace,
    getCapabilitiesForAgent,
    mcpServers,
  } = useWorkspace();

  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [pendingMessageId, setPendingMessageId] = useState<string | null>(null);
  const [pendingConversationId, setPendingConversationId] = useState<string | null>(null);
  const [manualSkillIds, setManualSkillIds] = useState<string[]>([]);
  const [slashQuery, setSlashQuery] = useState('');
  const [isSlashMenuOpen, setIsSlashMenuOpen] = useState(false);
  const [highlightedSlashIndex, setHighlightedSlashIndex] = useState(0);
  const [isDeepAnalysisEnabled, setIsDeepAnalysisEnabled] = useState(false);
  const [selectedComposerMode, setSelectedComposerMode] =
    useState<WorkspaceSwitchMode | null>(mode);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [deepAnalysisDockTab, setDeepAnalysisDockTab] =
    useState<DeepAnalysisWorkbenchTab>('progress');
  const [deepAnalysisMobilePane, setDeepAnalysisMobilePane] =
    useState<'activity' | 'workbench'>('activity');
  const [isDeepAnalysisWorkbenchOpen, setIsDeepAnalysisWorkbenchOpen] =
    useState(true);
  const [selectedDeepAnalysisActivityId, setSelectedDeepAnalysisActivityId] =
    useState<DeepAnalysisActivityId>('understand-intent');
  const [deepAnalysisPreviewedFileMessageId, setDeepAnalysisPreviewedFileMessageId] =
    useState<string | null>(null);
  const [isFollowingDeepAnalysisActivity, setIsFollowingDeepAnalysisActivity] =
    useState(true);
  const [deepAnalysisFeedbackByMessageId, setDeepAnalysisFeedbackByMessageId] =
    useState<Record<string, DeepAnalysisFeedback | undefined>>({});
  const [reportDockTab, setReportDockTab] =
    useState<DeepAnalysisWorkbenchTab>('progress');
  const [reportMobilePane, setReportMobilePane] =
    useState<'activity' | 'workbench'>('activity');
  const [isReportWorkbenchOpen, setIsReportWorkbenchOpen] = useState(true);
  const [selectedReportActivityId, setSelectedReportActivityId] =
    useState<DeepAnalysisActivityId>('understand-intent');
  const [reportPreviewedFileMessageId, setReportPreviewedFileMessageId] =
    useState<string | null>(null);
  const [isFollowingReportActivity, setIsFollowingReportActivity] = useState(true);
  const [reportFeedbackByMessageId, setReportFeedbackByMessageId] =
    useState<Record<string, DeepAnalysisFeedback | undefined>>({});
  const timersRef = useRef<number[]>([]);
  const pendingAnalysisProcessRef = useRef<AnalysisProcessData | undefined>(undefined);
  const pendingAnalysisProcessTargetRef = useRef<{ conversationId: string; messageId: string } | null>(null);
  const interruptedReplyIdsRef = useRef<Set<string>>(new Set());
  const handledCandidateMessageIdsRef = useRef<Set<string>>(new Set());
  const consumedAutoSubmitNonceRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeAgentType: AgentType =
    mode === 'ask' && isDeepAnalysisEnabled ? 'rca' : mode;
  const cleanedInputValue = removeActiveSlashToken(inputValue).trim();

  const enabledModeAgents = useMemo(
    () =>
      allAgents.filter((agent) => agent.type === activeAgentType && isEnabledStatus(String(agent.status))),
    [activeAgentType, allAgents],
  );

  const defaultAgent = enabledModeAgents.find((agent) => agent.isDefault) ?? enabledModeAgents[0] ?? null;
  const defaultSkills = useMemo(() => {
    if (!defaultAgent) return [];
    return allSkills.filter((skill) => defaultAgent.skills.includes(skill.id));
  }, [allSkills, defaultAgent]);
  const defaultSkillIdSet = useMemo(
    () => new Set(defaultSkills.map((skill) => skill.id)),
    [defaultSkills],
  );
  const getProcessMcpCapabilities = (agentId: string): ProcessMcpCapability[] =>
    getCapabilitiesForAgent(agentId).map((capability) => {
      const server = mcpServers.find((item) => item.id === capability.serverId);
      return {
        ...capability,
        serverName: server?.name,
      };
    });

  const suggestions = useMemo(
    () => enabledModeAgents.flatMap((agent) => getSuggestionSet(agent)).slice(0, 6),
    [enabledModeAgents],
  );
  const conversations = getConversationsForWorkspace(mode);
  const resolvedConversationId = activeConversationIds[mode];
  const currentConversation =
    conversations.find((conversation) => conversation.id === resolvedConversationId) ?? null;
  const questionThreads = useMemo(() => {
    const threads: QuestionThread[] = [];
    const threadMap = new Map<string, QuestionThread>();
    let latestUserThread: QuestionThread | null = null;

    currentConversation?.messages.forEach((message) => {
      if (message.role === 'user') {
        const thread = {
          userMessage: message,
          assistantMessages: [],
        };

        threads.push(thread);
        threadMap.set(message.id, thread);
        latestUserThread = thread;
        return;
      }

      const parentThread = message.parentUserMessageId
        ? threadMap.get(message.parentUserMessageId)
        : latestUserThread;

      parentThread?.assistantMessages.push(message);
    });

    return threads;
  }, [currentConversation?.messages]);
  const activeQuestionId =
    selectedQuestionId && questionThreads.some((thread) => thread.userMessage.id === selectedQuestionId)
      ? selectedQuestionId
      : questionThreads[questionThreads.length - 1]?.userMessage.id ?? null;
  const activeQuestionThread =
    questionThreads.find((thread) => thread.userMessage.id === activeQuestionId) ?? null;
  const activeDeepAnalysisProcessMessage = useMemo(() => {
    if (mode !== 'ask' || !activeQuestionThread) return null;

    return (
      [...activeQuestionThread.assistantMessages]
        .reverse()
        .find(
          (message) =>
            message.kind === 'analysis' &&
            message.routingTrace?.agentType === 'rca',
        ) ?? null
    );
  }, [activeQuestionThread, mode]);
  const activeDeepAnalysisResultMessage = useMemo(() => {
    if (mode !== 'ask' || !activeQuestionThread) return null;

    const resultMessage = [...activeQuestionThread.assistantMessages]
      .reverse()
      .find(
        (message) =>
          message.kind === 'rca-result' &&
          Boolean(message.rootCauseResult),
      );

    return resultMessage ?? null;
  }, [activeQuestionThread, mode]);
  const activeReportProcessMessage = useMemo(() => {
    if (mode !== 'report' || !activeQuestionThread) return null;

    return (
      [...activeQuestionThread.assistantMessages]
        .reverse()
        .find(
          (message) =>
            message.kind === 'analysis' &&
            message.routingTrace?.agentType === 'report',
        ) ?? null
    );
  }, [activeQuestionThread, mode]);
  const activeReportResultMessage = useMemo(() => {
    if (mode !== 'report' || !activeQuestionThread) return null;

    const resultMessage = [...activeQuestionThread.assistantMessages]
      .reverse()
      .find((message) => message.kind === 'report-result' && Boolean(message.reportResult));

    if (!resultMessage?.reportResult || resultMessage.markdownArtifact) return resultMessage ?? null;

    const markdownContent = buildReportMarkdown(
      activeQuestionThread.userMessage.content,
      resultMessage.reportResult,
    );

    return {
      ...resultMessage,
      markdownArtifact: {
        fileName: buildAnalysisReportFileName(activeQuestionThread.userMessage.content),
        content: markdownContent,
      },
      visibleMarkdownLineCount: markdownContent.split('\n').length,
    };
  }, [activeQuestionThread, mode]);
  const activeDeepAnalysisStage: DeepAnalysisStage | null = activeDeepAnalysisProcessMessage
    ? getDeepAnalysisStage(activeDeepAnalysisProcessMessage, activeDeepAnalysisResultMessage, 'deep-analysis')
    : null;
  const activeReportStage: DeepAnalysisStage | null = activeReportProcessMessage
    ? getDeepAnalysisStage(activeReportProcessMessage, activeReportResultMessage, 'report')
    : null;
  const currentDeepAnalysisActivityId = activeDeepAnalysisProcessMessage && activeDeepAnalysisStage
    ? getCurrentDeepAnalysisActivityId(activeDeepAnalysisProcessMessage, activeDeepAnalysisStage, 'deep-analysis')
    : null;
  const isDeepAnalysisWorkspace =
    mode === 'ask' &&
    Boolean(activeQuestionThread) &&
    Boolean(activeDeepAnalysisProcessMessage);
  const isReportWorkspace =
    mode === 'report' &&
    Boolean(activeQuestionThread) &&
    Boolean(activeReportProcessMessage);

  const newConversationLabel = newConversationLabels[mode];
  const inputPlaceholder =
    selectedComposerMode === 'ask'
      ? '查询指标、走势、异常等各类数据问题...'
      : selectedComposerMode === 'report'
        ? '描述报告主题、统计周期、分析重点...'
        : '输入数据问题，或描述要生成的报告...';
  const currentGroupMeta = groupedLabels[mode];
  const resolveExecutionMode = (forceDeepAnalysis?: boolean): AgentType => {
    if (mode !== 'ask') return mode;

    if (typeof forceDeepAnalysis === 'boolean') {
      return forceDeepAnalysis ? 'rca' : 'ask';
    }

    return isDeepAnalysisEnabled ? 'rca' : 'ask';
  };
  const getAllowedForcedAgentId = (
    forcedAgentId: string | undefined,
    executionMode: AgentType,
  ) => {
    const forcedAgent = forcedAgentId
      ? allAgents.find((agent) => agent.id === forcedAgentId)
      : undefined;

    return forcedAgent?.type === executionMode ? forcedAgent.id : undefined;
  };
  const resolveMessageExecutionMode = (routingTrace?: Message['routingTrace']): AgentType => {
    if (mode === 'report') return 'report';

    if (routingTrace?.agentType === 'ask' || routingTrace?.agentType === 'rca') {
      return routingTrace.agentType;
    }

    return resolveExecutionMode();
  };
  const orderedSkills = useMemo(() => {
    return allSkills
      .filter((skill) => skill.applicableAgentTypes.includes(activeAgentType))
      .sort((left, right) => {
      const leftBound = defaultSkillIdSet.has(left.id) ? 0 : 1;
      const rightBound = defaultSkillIdSet.has(right.id) ? 0 : 1;

      if (leftBound !== rightBound) return leftBound - rightBound;

      return left.name.localeCompare(right.name, 'zh-CN');
    });
  }, [activeAgentType, allSkills, defaultSkillIdSet]);

  const filteredSlashSkills = useMemo(() => {
    const query = normalizeSearchValue(slashQuery);

    if (!query) return orderedSkills;

    return orderedSkills.filter((skill) => getSkillSearchText(skill).includes(query));
  }, [orderedSkills, slashQuery]);

  const slashSkillSections = useMemo(() => {
    let index = 0;

    const buildSection = (title: string, skills: Skill[]) => {
      if (!skills.length) return null;

      const items = skills.map((skill) => ({
        skill,
        index: index++,
      }));

      return { title, items };
    };

    const defaultBoundSkills = filteredSlashSkills.filter((skill) => defaultSkillIdSet.has(skill.id));
    const otherSkills = filteredSlashSkills.filter((skill) => !defaultSkillIdSet.has(skill.id));

    return [
      buildSection('默认配置内', defaultBoundSkills),
      buildSection('其他可用分析能力', otherSkills),
    ].filter(Boolean) as Array<{ title: string; items: Array<{ skill: Skill; index: number }> }>;
  }, [defaultSkillIdSet, filteredSlashSkills]);

  const selectedManualSkills = useMemo(
    () =>
      manualSkillIds
        .map((skillId) => allSkills.find((skill) => skill.id === skillId))
        .filter(
          (skill): skill is Skill =>
            Boolean(skill) && skill.applicableAgentTypes.includes(activeAgentType),
        ),
    [activeAgentType, allSkills, manualSkillIds],
  );

  const hasTemporaryUnboundSkills = selectedManualSkills.some(
    (skill) => !defaultSkillIdSet.has(skill.id),
  );

  const showEmptyConversationState =
    !currentConversation || currentConversation.messages.length === 0;

  const closeSlashMenu = () => {
    setIsSlashMenuOpen(false);
    setSlashQuery('');
    setHighlightedSlashIndex(0);
  };

  const resetManualSkillState = () => {
    setManualSkillIds([]);
    closeSlashMenu();
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentConversation?.messages]);

  useEffect(() => {
    if (
      !currentDeepAnalysisActivityId ||
      !activeQuestionId ||
      !isFollowingDeepAnalysisActivity
    ) return;

    setSelectedDeepAnalysisActivityId(currentDeepAnalysisActivityId);
    setDeepAnalysisDockTab(getWorkbenchTabForActivity(currentDeepAnalysisActivityId));
    setDeepAnalysisMobilePane(currentDeepAnalysisActivityId === 'understand-intent' ? 'activity' : 'workbench');
  }, [
    activeDeepAnalysisStage,
    activeQuestionId,
    currentDeepAnalysisActivityId,
    isFollowingDeepAnalysisActivity,
  ]);

  useEffect(() => {
    const shouldFocusDraftingReport = activeReportStage === 'drafting';
    if (
      !activeReportProcessMessage ||
      !activeReportStage ||
      !activeQuestionId ||
      (!isFollowingReportActivity && !shouldFocusDraftingReport)
    ) return;

    if (shouldFocusDraftingReport) setIsFollowingReportActivity(true);
    setSelectedReportActivityId(
      getCurrentDeepAnalysisActivityId(activeReportProcessMessage, activeReportStage, 'report'),
    );
    setReportDockTab(
      getWorkbenchTabForActivity(
        getCurrentDeepAnalysisActivityId(activeReportProcessMessage, activeReportStage, 'report'),
      ),
    );
    setReportMobilePane(
      getCurrentDeepAnalysisActivityId(activeReportProcessMessage, activeReportStage, 'report') === 'understand-intent'
        ? 'activity'
        : 'workbench',
    );
  }, [
    activeQuestionId,
    activeReportProcessMessage,
    activeReportStage,
    isFollowingReportActivity,
  ]);

  useEffect(() => {
    setHighlightedSlashIndex((current) => {
      if (!filteredSlashSkills.length) return 0;
      return Math.min(current, filteredSlashSkills.length - 1);
    });
  }, [filteredSlashSkills.length]);

  useEffect(() => {
    setManualSkillIds((current) =>
      current.filter((skillId) =>
        allSkills.some(
          (skill) =>
            skill.id === skillId && skill.applicableAgentTypes.includes(activeAgentType),
        ),
      ),
    );
  }, [activeAgentType, allSkills]);

  useEffect(() => {
    setInputValue('');
    setIsRecording(false);
    setIsDeepAnalysisEnabled(false);
    setSelectedComposerMode(currentConversation ? mode : null);
    setSelectedQuestionId(null);
    setDeepAnalysisDockTab('progress');
    setDeepAnalysisMobilePane('activity');
    setIsDeepAnalysisWorkbenchOpen(true);
    setSelectedDeepAnalysisActivityId('understand-intent');
    setDeepAnalysisPreviewedFileMessageId(null);
    setIsFollowingDeepAnalysisActivity(true);
    setReportDockTab('progress');
    setReportMobilePane('activity');
    setIsReportWorkbenchOpen(true);
    setSelectedReportActivityId('understand-intent');
    setReportPreviewedFileMessageId(null);
    setIsFollowingReportActivity(true);
    resetManualSkillState();
  }, [currentConversation?.id, mode]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  const stopPendingTimers = () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  };

  const handleNewConversation = () => {
    if (mode === 'ask') {
      setActiveConversationForWorkspace('ask', null);
      setInputValue('');
      setIsRecording(false);
      setIsDeepAnalysisEnabled(false);
      setSelectedComposerMode(null);
      resetManualSkillState();
      navigate('/home', {
        state: { historyOpen: true },
      });
      return;
    }

    const conversation = createConversation(mode, newConversationLabel);
    setActiveConversationForWorkspace(mode, conversation.id);
    setInputValue('');
    setIsRecording(false);
    setIsDeepAnalysisEnabled(false);
    setSelectedComposerMode(mode);
    resetManualSkillState();
  };

  const handleStopGeneration = () => {
    stopPendingTimers();
    setIsGenerating(false);

    const process = pendingAnalysisProcessRef.current;
    const processTarget = pendingAnalysisProcessTargetRef.current;

    if (process && processTarget) {
      updateMessage(processTarget.conversationId, processTarget.messageId, {
        isGenerating: false,
        isInterrupted: true,
        isAwaitingResult: false,
        analysisProcess: {
          ...process,
          status: 'interrupted',
          steps: (process.steps ?? buildVisibleAskSteps(process.visibleStepCount ?? 1, 'running')).map(
            (step, index, steps) => ({
              ...step,
              status: index === steps.length - 1 ? 'interrupted' : 'completed',
            }),
          ),
          scenarioCode: 'user-interrupted',
          hasRealResult: false,
          sqlExecutionStatus: 'not-run',
          sqlExecutionMessage: '查询已中断。',
        },
      });

      const replyId = `${processTarget.messageId}-reply`;
      if (!interruptedReplyIdsRef.current.has(replyId)) {
        interruptedReplyIdsRef.current.add(replyId);
        appendMessages(processTarget.conversationId, [
          {
            id: replyId,
            role: 'assistant',
            kind: 'text',
            content: '你已中断本次查询。',
            timestamp: new Date(),
            relatedAnalysisMessageId: processTarget.messageId,
            analysisExecutionContext: process.executionContext,
          },
        ]);
      }
    } else if (pendingConversationId && pendingMessageId) {
      updateMessage(pendingConversationId, pendingMessageId, {
        isGenerating: false,
        isInterrupted: true,
        isAwaitingResult: false,
      });
    }

    pendingAnalysisProcessRef.current = undefined;
    pendingAnalysisProcessTargetRef.current = null;
    setPendingConversationId(null);
    setPendingMessageId(null);
  };

  const createResultMessage = (
    agent: Agent,
    question: string,
    skillTrace: ReturnType<typeof buildSkillTrace>,
    selectedSkillIds: string[],
    routingTrace: Message['routingTrace'],
    parentUserMessageId?: string,
    streamMarkdown = false,
    reportTemplateId?: string,
  ): Message => {
    const resultScope: ResultScope =
      selectedSkillIds.length === 1 ? 'single-skill' : 'combined';
    const primarySkillId = resultScope === 'single-skill' ? selectedSkillIds[0] : undefined;

    const baseMessage = {
      timestamp: new Date(),
      content: '',
      parentUserMessageId,
      skillTrace,
      routingTrace,
      resultScope,
      manualSkillIds: selectedSkillIds.length ? selectedSkillIds : undefined,
      runtimeConfig: getAgentRuntimeConfig(agent),
    };

    if (agent.type === 'report') {
      const reportResult = buildReportResult(agent, question, skillTrace, {
        resultScope,
        manualSkillIds: selectedSkillIds,
        primarySkillId,
        reportTemplateId,
        reportTemplates,
      });
      const markdownContent = buildReportMarkdown(question, reportResult);

      return {
        id: `msg-${Date.now()}-report`,
        role: 'assistant',
        kind: 'report-result',
        ...baseMessage,
        reportResult,
        isGenerating: streamMarkdown,
        visibleMarkdownLineCount: streamMarkdown ? 1 : markdownContent.split('\n').length,
        markdownArtifact: {
          fileName: buildAnalysisReportFileName(question),
          content: markdownContent,
        },
      };
    }

    if (agent.type === 'rca') {
      const rootCauseResult = buildRootCauseResult(agent, question, {
        resultScope,
        manualSkillIds: selectedSkillIds,
        primarySkillId,
      });
      const deepAnalysisBlockCount = getDeepAnalysisLeadingBlockCount(rootCauseResult);
      const deepAnalysisTextLength = getDeepAnalysisTypingTextLength(rootCauseResult);

      return {
        id: `msg-${Date.now()}-rca`,
        role: 'assistant',
        kind: 'rca-result',
        ...baseMessage,
        rootCauseResult,
        isGenerating: streamMarkdown && (deepAnalysisBlockCount > 1 || deepAnalysisTextLength > 0),
        visibleDeepAnalysisBlockCount: streamMarkdown ? 1 : deepAnalysisBlockCount,
        visibleDeepAnalysisTextLength: streamMarkdown ? 0 : deepAnalysisTextLength,
      };
    }

    const analysisResult = buildAskResult(agent, question, {
      resultScope,
      manualSkillIds: selectedSkillIds,
      primarySkillId,
    });

    return {
      id: `msg-${Date.now()}-ask`,
      role: 'assistant',
      kind: 'ask-result',
      ...baseMessage,
      analysisResult,
      analysisProcess: buildAnalysisProcessData({
        agent,
        question,
        result: analysisResult,
        skillTrace,
        skillMatchSource: selectedSkillIds.length ? '手动选择' : '自动匹配',
        mcpCapabilities: getProcessMcpCapabilities(agent.id),
        status: 'completed',
      }),
    };
  };

  const startDeepAnalysisResultStream = (conversationId: string, resultMessage: Message) => {
    const leadingBlockCount = getDeepAnalysisLeadingBlockCount(resultMessage.rootCauseResult);
    const typingTextLength = getDeepAnalysisTypingTextLength(resultMessage.rootCauseResult);

    if (
      resultMessage.kind !== 'rca-result'
      || !resultMessage.isGenerating
      || (leadingBlockCount <= 1 && typingTextLength === 0)
    ) {
      return false;
    }

    setPendingConversationId(conversationId);
    setPendingMessageId(resultMessage.id);

    const leadingTimers = Array.from({ length: Math.max(0, leadingBlockCount - 1) }, (_, index) => {
      const visibleDeepAnalysisBlockCount = index + 2;
      const timerDelay = (index + 1) * DEEP_ANALYSIS_LEADING_STREAM_INTERVAL_MS;

      return window.setTimeout(() => {
        const isDeepAnalysisComplete = visibleDeepAnalysisBlockCount >= leadingBlockCount
          && typingTextLength === 0;

        updateMessage(conversationId, resultMessage.id, {
          visibleDeepAnalysisBlockCount,
          isGenerating: !isDeepAnalysisComplete,
          isInterrupted: false,
        });

        if (isDeepAnalysisComplete) {
          setIsGenerating(false);
          setPendingConversationId(null);
          setPendingMessageId(null);
        }
      }, timerDelay);
    });

    const typingStartDelay = Math.max(0, leadingBlockCount - 1)
      * DEEP_ANALYSIS_LEADING_STREAM_INTERVAL_MS;
    const typingTickCount = Math.ceil(
      typingTextLength / DEEP_ANALYSIS_TYPEWRITER_CHARS_PER_TICK,
    );
    const typingTimers = Array.from({ length: typingTickCount }, (_, index) =>
      window.setTimeout(() => {
        const visibleDeepAnalysisTextLength = Math.min(
          typingTextLength,
          (index + 1) * DEEP_ANALYSIS_TYPEWRITER_CHARS_PER_TICK,
        );
        const isDeepAnalysisComplete = visibleDeepAnalysisTextLength >= typingTextLength;

        updateMessage(conversationId, resultMessage.id, {
          visibleDeepAnalysisBlockCount: leadingBlockCount,
          visibleDeepAnalysisTextLength,
          isGenerating: !isDeepAnalysisComplete,
          isInterrupted: false,
        });

        if (isDeepAnalysisComplete) {
          setIsGenerating(false);
          setPendingConversationId(null);
          setPendingMessageId(null);
        }
      }, typingStartDelay + (index + 1) * DEEP_ANALYSIS_TYPEWRITER_INTERVAL_MS),
    );

    timersRef.current = [...timersRef.current, ...leadingTimers, ...typingTimers];
    return true;
  };

  const generateConversationTitle = (question: string) =>
    question.length > 18 ? `${question.slice(0, 18)}...` : question;

  const appendClarificationMessage = (
    conversationId: string,
    question: string,
    options: AgentClarificationOption[],
  ) => {
    const clarificationMessage: Message = {
      id: `msg-${Date.now()}-clarification`,
      role: 'assistant',
      kind: 'clarification',
      content: '请确认本次分析的范围。',
      timestamp: new Date(),
      clarificationOptions: options,
      originalQuestion: question,
    };

    appendMessages(conversationId, [clarificationMessage]);
  };

  const executeQuestion = (question: string, options?: ExecuteQuestionOptions) => {
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion || isGenerating) return;

    const executionMode = resolveExecutionMode(options?.forceDeepAnalysis);
    const forcedAgentId = getAllowedForcedAgentId(options?.forcedAgentId, executionMode);
    const usingDeepAnalysisInAsk = mode === 'ask' && executionMode === 'rca';
    const usingAnalysisWorkspace = usingDeepAnalysisInAsk || mode === 'report';
    if (usingDeepAnalysisInAsk) {
      onDeepAnalysisStart?.();
    } else {
      onExecutionStart?.();
    }
    const askIntentClassification = mode === 'ask'
      ? classifyAskQuestionIntent({
          question: trimmedQuestion,
          inheritedTimeRange: options?.inheritedTimeRange,
          agentPool: allAgents,
          datasetPool: semanticDatasets,
          skillPool: allSkills,
          indicatorPool: indicatorAssets,
        })
      : null;
    const executionQuestion = options?.inheritedTimeRange
      ? `${trimmedQuestion.replace(/[。！？!?，,]+$/, '')}，时间范围沿用上一轮：${options.inheritedTimeRange}`
      : trimmedQuestion;
    const routing = !askIntentClassification || askIntentClassification.status === 'routable'
      ? resolveAgentForQuestion({
          mode: executionMode,
          question: executionQuestion,
          agentPool: allAgents,
          datasetPool: semanticDatasets,
          skillPool: allSkills,
          indicatorPool: indicatorAssets,
          forcedAgentId,
        })
      : null;

    const conversation =
      options?.forceNewConversation || !currentConversation
        ? createConversation(mode, newConversationLabel)
        : currentConversation;

    if (
      conversation.title === newConversationLabel &&
      conversation.messages.length === 0
    ) {
      updateConversation(conversation.id, {
        title: generateConversationTitle(trimmedQuestion),
      });
    }

    setActiveConversationForWorkspace(mode, conversation.id);

    const userMessage: Message = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      kind: options?.kind ?? 'text',
      content: options?.userMessageContent ?? trimmedQuestion,
      timestamp: new Date(),
    };
    setSelectedQuestionId(userMessage.id);

    if (askIntentClassification && askIntentClassification.status !== 'routable') {
      const isOutOfScope = askIntentClassification.status === 'out-of-scope';
      const isDirectConversation = isOutOfScope;
      const reply = askIntentClassification.replyVariant === 'greeting'
        ? ASK_INTENT_BOUNDARY_COPY.conversation.greetingReply
        : askIntentClassification.replyVariant === 'capability'
          ? ASK_INTENT_BOUNDARY_COPY.conversation.capabilityReply
          : isOutOfScope
            ? ASK_INTENT_BOUNDARY_COPY.outOfScope.reply
            : ASK_INTENT_BOUNDARY_COPY.missingInformation.reply;

      if (isDirectConversation) {
        appendMessages(conversation.id, [
          userMessage,
          {
            id: `msg-${Date.now()}-conversation-reply`,
            role: 'assistant',
            kind: 'text',
            content: reply,
            timestamp: new Date(),
            parentUserMessageId: userMessage.id,
          },
        ]);
        setInputValue('');
        setIsRecording(false);
        resetManualSkillState();
        return;
      }

      const analysisMessageId = `msg-${Date.now()}-intent-boundary`;
      appendMessages(conversation.id, [
        userMessage,
        {
          id: analysisMessageId,
          role: 'assistant',
          kind: 'analysis',
          content: '',
          timestamp: new Date(),
          parentUserMessageId: userMessage.id,
          analysisSummary: askIntentClassification.reason,
          analysisProcess: buildAskIntentBoundaryProcess({
            question: trimmedQuestion,
            classification: askIntentClassification,
          }),
        },
        {
          id: `${analysisMessageId}-reply`,
          role: 'assistant',
          kind: 'text',
          content: reply,
          timestamp: new Date(),
          parentUserMessageId: userMessage.id,
          relatedAnalysisMessageId: analysisMessageId,
          analysisExecutionContext: { originalQuestion: trimmedQuestion },
        },
      ]);
      setInputValue('');
      setIsRecording(false);
      resetManualSkillState();
      return;
    }

    if (!routing) return;

    if (routing.status === 'clarification') {
      appendMessages(conversation.id, [userMessage]);
      appendClarificationMessage(conversation.id, trimmedQuestion, routing.clarificationOptions ?? []);
      setInputValue('');
      setIsRecording(false);
      resetManualSkillState();
      return;
    }

    if (routing.status === 'unavailable' || !routing.agent || !routing.dataset) {
      const matchStatus = routing.agent ? 'missing-dataset' : 'missing-agent';
      const matchMessage =
        matchStatus === 'missing-dataset'
          ? '暂未找到可用于分析的数据。请补充分析范围后重试。'
          : '暂未找到可处理该问题的分析能力。请调整问题描述后重试。';
      const analysisMessageId = `msg-${Date.now()}-unavailable`;
      appendMessages(conversation.id, [
        userMessage,
        {
          id: analysisMessageId,
          role: 'assistant',
          kind: 'analysis',
          content: '',
          timestamp: new Date(),
          parentUserMessageId: userMessage.id,
          analysisSummary: matchMessage,
          analysisProcess: buildUnavailableAskProcess({
            question: trimmedQuestion,
            matchStatus,
            matchMessage,
          }),
        },
        {
          id: `${analysisMessageId}-reply`,
          role: 'assistant',
          kind: 'text',
          content: matchMessage,
          timestamp: new Date(),
          parentUserMessageId: userMessage.id,
          relatedAnalysisMessageId: analysisMessageId,
          analysisExecutionContext: { originalQuestion: trimmedQuestion },
        },
      ]);
      setInputValue('');
      setIsRecording(false);
      resetManualSkillState();
      return;
    }

    stopPendingTimers();
    setIsGenerating(true);

    const resolvedManualSkillIds = (options?.manualSkillIds ?? manualSkillIds).filter((skillId) =>
      allSkills.some(
        (skill) =>
          skill.id === skillId && skill.applicableAgentTypes.includes(executionMode),
      ),
    );
    const skillTraceMode =
      options?.skillTraceMode ?? (resolvedManualSkillIds.length ? 'manual' : 'auto');
    const skillTrace = buildSkillTrace(
      routing.agent,
      resolvedManualSkillIds,
      allSkills,
      skillTraceMode,
    );
    const effectiveManualSkillIds = skillTrace.map((skill) => skill.id);
    const resultScope: ResultScope =
      effectiveManualSkillIds.length === 1 ? 'single-skill' : 'combined';
    const primarySkillId = resultScope === 'single-skill' ? effectiveManualSkillIds[0] : undefined;
    const pendingAskResult =
      routing.agent.type === 'ask'
        ? buildAskResult(routing.agent, executionQuestion, {
            resultScope,
            manualSkillIds: effectiveManualSkillIds,
            primarySkillId,
          })
        : null;
    const pendingReportTemplateName =
      routing.agent.type === 'report'
        ? buildReportResult(routing.agent, executionQuestion, skillTrace, {
            resultScope,
            manualSkillIds: effectiveManualSkillIds,
            primarySkillId,
            reportTemplateId: options?.reportTemplateId,
            reportTemplates,
          }).templateUsage?.name
        : undefined;
    const pendingDeepAnalysisProcess = usingAnalysisWorkspace
      ? {
          ...buildAgentAnalysisProcess(routing.agent, executionQuestion, skillTrace, {
          status: 'running',
          skillMatchSource: resolvedManualSkillIds.length ? '手动选择' : '自动匹配',
          visibleStepCount: 1,
          }),
          plannedTaskCount: (mode === 'report' ? reportProcessStepDefinitions : deepAnalysisProcessStepDefinitions).length - 2,
          steps: mode === 'report'
            ? buildVisibleReportSteps(1, 'running')
            : buildVisibleDeepAnalysisSteps(1, 'running'),
        }
      : undefined;

    userMessage.manualSkillIds = effectiveManualSkillIds.length ? effectiveManualSkillIds : undefined;

    const analysisMessage: Message = {
      id: `msg-${Date.now()}-analysis`,
      role: 'assistant',
      kind: 'analysis',
      content: '',
      timestamp: new Date(),
      parentUserMessageId: userMessage.id,
      isGenerating: true,
      visibleStepCount: 1,
      resultScope,
      analysisSummary:
        routing.agent.type === 'report'
          ? '正在识别数据范围、指标口径、报告模板和推送信息。'
          : routing.agent.type === 'rca'
            ? usingAnalysisWorkspace
              ? '已使用深度分析能力，正在基于指标口径下钻时间、维度和结构变化，并生成候选根因。'
              : '正在基于指标口径下钻时间、维度和结构变化，并生成候选根因。'
            : '正在识别数据集、指标口径、维度和 SQL 查询链路。',
      analysisSteps: getAnalysisSteps(routing.agent, executionQuestion),
      matchedReportTemplateName: pendingReportTemplateName,
      skillTrace,
      routingTrace: routing.routingTrace,
      manualSkillIds: effectiveManualSkillIds.length ? effectiveManualSkillIds : undefined,
      analysisProcess: pendingDeepAnalysisProcess ?? (pendingAskResult
        ? buildAnalysisProcessData({
            agent: routing.agent,
            question: executionQuestion,
            result: pendingAskResult,
            skillTrace,
            skillMatchSource: resolvedManualSkillIds.length ? '手动选择' : '自动匹配',
            mcpCapabilities: getProcessMcpCapabilities(routing.agent.id),
            status: 'running',
          })
        : undefined),
    };

    appendMessages(conversation.id, [userMessage, analysisMessage]);
    pendingAnalysisProcessRef.current = analysisMessage.analysisProcess;
    pendingAnalysisProcessTargetRef.current = analysisMessage.analysisProcess
      ? { conversationId: conversation.id, messageId: analysisMessage.id }
      : null;
    setPendingConversationId(conversation.id);
    setPendingMessageId(analysisMessage.id);
    setInputValue('');
    setIsRecording(false);
    resetManualSkillState();

    const streamStepIntervalMs = mode === 'report' ? REPORT_STREAM_STEP_INTERVAL_MS : STREAM_STEP_INTERVAL_MS;
    const finalProcessStepDurationMs = mode === 'report'
      ? REPORT_FINAL_PROCESS_STEP_STREAM_DURATION_MS
      : FINAL_PROCESS_STEP_STREAM_DURATION_MS;
    const workspaceProcessStepCount = mode === 'report'
      ? REPORT_PROCESS_STEP_COUNT
      : DEEP_ANALYSIS_PROCESS_STEP_COUNT;
    const streamStepCount = analysisMessage.analysisProcess
      ? usingAnalysisWorkspace
        ? workspaceProcessStepCount
        : ASK_PROCESS_STEP_COUNT
      : analysisMessage.analysisSteps?.length ?? 1;
    const shouldStreamFinalProcessStep = Boolean(
      analysisMessage.analysisProcess
      && streamStepCount === (usingAnalysisWorkspace ? workspaceProcessStepCount : ASK_PROCESS_STEP_COUNT),
    );
    const streamTimerCount = streamStepCount + (shouldStreamFinalProcessStep ? 1 : 0);
    const streamTimers = Array.from({ length: streamTimerCount }, (_, index) => {
      const isFinalStreamCompletion = shouldStreamFinalProcessStep && index === streamStepCount;
      const timerDelay = isFinalStreamCompletion
        ? (streamStepCount - 1) * streamStepIntervalMs + finalProcessStepDurationMs
        : index * streamStepIntervalMs;

      return window.setTimeout(() => {
        const visibleStepCount = Math.min(index + 1, streamStepCount);
        const isComplete = shouldStreamFinalProcessStep
          ? isFinalStreamCompletion
          : visibleStepCount >= streamStepCount;
        const updates: Partial<Message> = {
          visibleStepCount,
          isGenerating: !isComplete,
          isAwaitingResult: isComplete,
        };

        if (analysisMessage.analysisProcess) {
          updates.analysisProcess = {
            ...analysisMessage.analysisProcess,
            status: isComplete ? 'completed' : 'running',
            visibleStepCount,
            steps: usingAnalysisWorkspace
              ? mode === 'report'
                ? buildVisibleReportSteps(visibleStepCount, isComplete ? 'completed' : 'running')
                : buildVisibleDeepAnalysisSteps(visibleStepCount, isComplete ? 'completed' : 'running')
              : buildVisibleAskSteps(visibleStepCount, isComplete ? 'completed' : 'running'),
            elapsedSeconds: isComplete ? Math.max(1, Math.round((streamStepCount * streamStepIntervalMs) / 1000)) : undefined,
            sqlExecutionStatus: isComplete ? 'success' : 'pending',
          };
          pendingAnalysisProcessRef.current = updates.analysisProcess;
        }

        updateMessage(conversation.id, analysisMessage.id, updates);

        if (isComplete && !usingAnalysisWorkspace && pendingAnalysisProcessTargetRef.current?.messageId === analysisMessage.id) {
          pendingAnalysisProcessRef.current = undefined;
          pendingAnalysisProcessTargetRef.current = null;
        }
      }, timerDelay);
    });

    const resultAppendDelay = streamStepCount * streamStepIntervalMs + RESULT_APPEND_DELAY_MS;
    const resultTimer = window.setTimeout(() => {
      const resultMessage = createResultMessage(
        routing.agent,
        executionQuestion,
        skillTrace,
        effectiveManualSkillIds,
        routing.routingTrace,
        userMessage.id,
        usingAnalysisWorkspace,
        options?.reportTemplateId,
      );
      updateMessage(conversation.id, analysisMessage.id, {
        isAwaitingResult: false,
      });
      if (pendingAnalysisProcessTargetRef.current?.messageId === analysisMessage.id) {
        pendingAnalysisProcessRef.current = undefined;
        pendingAnalysisProcessTargetRef.current = null;
      }
      appendMessages(conversation.id, [
        resultMessage,
      ]);

      if (usingAnalysisWorkspace && startDeepAnalysisResultStream(conversation.id, resultMessage)) {
        return;
      }

      const markdownLineCount = resultMessage.markdownArtifact?.content.split('\n').length ?? 0;

      if (usingAnalysisWorkspace && resultMessage.markdownArtifact && markdownLineCount > 1) {
        setPendingConversationId(conversation.id);
        setPendingMessageId(resultMessage.id);

        const markdownTimers = Array.from({ length: markdownLineCount - 1 }, (_, index) =>
          window.setTimeout(() => {
            const visibleMarkdownLineCount = index + 2;
            const isMarkdownComplete = visibleMarkdownLineCount >= markdownLineCount;

            updateMessage(conversation.id, resultMessage.id, {
              visibleMarkdownLineCount,
              isGenerating: !isMarkdownComplete,
              isInterrupted: false,
            });

            if (isMarkdownComplete) {
              setIsGenerating(false);
              setPendingConversationId(null);
              setPendingMessageId(null);
            }
          }, (index + 1) * REPORT_MARKDOWN_STREAM_INTERVAL_MS),
        );

        timersRef.current = [...timersRef.current, ...markdownTimers];
        return;
      }

      setIsGenerating(false);
      setPendingConversationId(null);
      setPendingMessageId(null);
    }, resultAppendDelay);

    timersRef.current = [...streamTimers, resultTimer];
  };

  useEffect(() => {
    const autoSubmit = (location.state as { autoSubmit?: WorkspaceAutoSubmitPayload } | null)?.autoSubmit;

    if (!autoSubmit || autoSubmit.mode !== mode || !autoSubmit.question.trim()) return;

    const nonce = autoSubmit.nonce ?? `${autoSubmit.mode}:${autoSubmit.question}`;
    if (consumedAutoSubmitNonceRef.current === nonce) return;

    consumedAutoSubmitNonceRef.current = nonce;
    if (autoSubmit.mode === 'ask') {
      setIsDeepAnalysisEnabled(Boolean(autoSubmit.deepAnalysisEnabled));
    } else {
      setIsDeepAnalysisEnabled(false);
    }
    executeQuestion(autoSubmit.question, {
      manualSkillIds: autoSubmit.manualSkillIds,
      userMessageContent: autoSubmit.userMessageContent,
      forceDeepAnalysis: autoSubmit.deepAnalysisEnabled,
      forceNewConversation: autoSubmit.forceNewConversation,
      reportTemplateId: autoSubmit.reportTemplateId,
    });
    navigate('.', { replace: true, state: null });
  }, [location.state, mode, navigate]);

  const handleSend = () => {
    const cleanedQuestion = removeActiveSlashToken(inputValue).trim();

    if (!cleanedQuestion) return;

    const targetMode = inferPromptMode(cleanedQuestion, selectedComposerMode);

    if (mode === 'ask' && selectedComposerMode === 'ask' && targetMode === 'report') {
      const conversation = currentConversation ?? createConversation(mode, newConversationLabel);

      if (conversation.title === newConversationLabel && conversation.messages.length === 0) {
        updateConversation(conversation.id, {
          title: generateConversationTitle(cleanedQuestion),
        });
      }

      setActiveConversationForWorkspace(mode, conversation.id);
      appendMessages(conversation.id, [
        {
          id: `msg-${Date.now()}-user`,
          role: 'user',
          kind: 'text',
          content: cleanedQuestion,
          timestamp: new Date(),
        },
        {
          id: `msg-${Date.now()}-mode-restriction`,
          role: 'assistant',
          kind: 'clarification',
          content: '当前为问数模式，暂不支持生成报告。请退出问数模式后再试。',
          timestamp: new Date(),
        },
      ]);
      setInputValue('');
      setIsRecording(false);
      setIsDeepAnalysisEnabled(false);
      resetManualSkillState();
      return;
    }

    if (targetMode !== mode) {
      const autoSubmit: WorkspaceAutoSubmitPayload = {
        mode: targetMode,
        question: cleanedQuestion,
        nonce: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        forceNewConversation: true,
      };

      setInputValue('');
      setIsRecording(false);
      setIsDeepAnalysisEnabled(false);
      setSelectedComposerMode(targetMode);
      resetManualSkillState();
      navigate(targetMode === 'ask' ? '/ask' : '/report', { state: { autoSubmit } });
      return;
    }

    setSelectedComposerMode(targetMode);
    executeQuestion(cleanedQuestion, { manualSkillIds });
  };

  const handleClarificationSelect = (question: string, agentId: string) => {
    executeQuestion(question, { forcedAgentId: agentId });
  };

  const handleAnalysisCandidateSelect = (
    messageId: string,
    option: AnalysisCandidateOption,
  ) => {
    if (!currentConversation) return;

    const targetMessage = currentConversation.messages.find((message) => message.id === messageId);
    const clarification = targetMessage?.analysisClarification;
    const processMessage = currentConversation.messages.find(
      (message) => message.id === targetMessage?.relatedAnalysisMessageId,
    );
    const process = processMessage?.analysisProcess;

    if (
      !targetMessage
      || !clarification
      || !processMessage
      || !process
      || targetMessage.selectedAnalysisCandidateId
      || handledCandidateMessageIdsRef.current.has(messageId)
    ) return;

    handledCandidateMessageIdsRef.current.add(messageId);
    updateMessage(currentConversation.id, messageId, {
      selectedAnalysisCandidateId: option.id,
    });

    const originalQuestion =
      targetMessage.analysisExecutionContext?.originalQuestion
      ?? process.executionContext?.originalQuestion
      ?? process.question;
    const agent = allAgents.find((item) => item.id === processMessage.routingTrace?.agentId)
      ?? allAgents.find((item) => item.id === 'agent-ask-outpatient');
    if (!agent) return;

    const now = Date.now();
    const userSelectionMessage: Message = {
      id: `msg-${now}-candidate-user`,
      role: 'user',
      kind: 'text',
      content: option.type === 'dataset'
        ? `已选择数据集：${option.label}`
        : `已选择指标：${option.label}`,
      timestamp: new Date(now),
    };
    const analysisMessageId = `msg-${now}-candidate-analysis`;
    const skillTrace = buildSkillTrace(agent, [], allSkills, 'auto');

    if (clarification.stage === 'dataset' && option.type === 'dataset') {
      const metricOptions = clarification.nextOptions ?? [];
      const nextExecutionContext = {
        originalQuestion,
        selectedDatasetId: option.id,
      };

      appendMessages(currentConversation.id, [
        userSelectionMessage,
        {
          id: analysisMessageId,
          role: 'assistant',
          kind: 'analysis',
          content: '',
          timestamp: new Date(now + 1),
          parentUserMessageId: userSelectionMessage.id,
          routingTrace: processMessage.routingTrace,
          skillTrace,
          analysisProcess: {
            ...process,
            question: originalQuestion,
            datasetName: option.label,
            metrics: [],
            status: 'completed',
            visibleStepCount: 2,
            steps: [
              { id: 'understand-question', title: '理解用户问题', status: 'completed' },
              {
                id: 'resolve-data-scope',
                title: '确定数据口径',
                status: 'awaiting-confirmation',
                detail: `已确认数据集“${option.label}”，下一步需要确认分析指标。`,
              },
            ],
            scenarioCode: 'ambiguous-data-scope',
            hasRealResult: false,
            canRetry: false,
            sql: '',
            resultPreview: { title: '', metrics: [], chartData: [] },
            sqlExecutionStatus: 'not-run',
            sqlExecutionMessage: '等待确认分析指标。',
            executionContext: nextExecutionContext,
          },
        },
        {
          id: `${analysisMessageId}-reply`,
          role: 'assistant',
          kind: 'text',
          content: `已选择“${option.label}”，请继续确认本次分析使用的指标。`,
          timestamp: new Date(now + 2),
          parentUserMessageId: userSelectionMessage.id,
          relatedAnalysisMessageId: analysisMessageId,
          analysisClarification: {
            stage: 'metric',
            options: metricOptions,
            selectedDatasetId: option.id,
            selectedDatasetLabel: option.label,
          },
          analysisExecutionContext: nextExecutionContext,
        },
      ]);
      setSelectedQuestionId(userSelectionMessage.id);
      return;
    }

    if (clarification.stage !== 'metric' || option.type !== 'metric') {
      handledCandidateMessageIdsRef.current.delete(messageId);
      updateMessage(currentConversation.id, messageId, {
        selectedAnalysisCandidateId: undefined,
      });
      return;
    }

    const selectedDatasetLabel = clarification.selectedDatasetLabel ?? process.datasetName;
    const resultMessage = createResultMessage(
      agent,
      originalQuestion,
      skillTrace,
      [],
      processMessage.routingTrace,
      userSelectionMessage.id,
    );
    const completedProcess = resultMessage.analysisProcess ?? buildAgentAnalysisProcess(
      agent,
      originalQuestion,
      skillTrace,
      { status: 'completed' },
    );
    const nextExecutionContext = {
      originalQuestion,
      selectedDatasetId: clarification.selectedDatasetId,
      selectedMetricId: option.id,
    };

    appendMessages(currentConversation.id, [
      userSelectionMessage,
      {
        id: analysisMessageId,
        role: 'assistant',
        kind: 'analysis',
        content: '',
        timestamp: new Date(now + 1),
        parentUserMessageId: userSelectionMessage.id,
        routingTrace: processMessage.routingTrace,
        skillTrace,
        analysisProcess: {
          ...completedProcess,
          question: originalQuestion,
          datasetName: selectedDatasetLabel,
          metrics: [option.label],
          status: 'completed',
          visibleStepCount: ASK_PROCESS_STEP_COUNT,
          steps: buildVisibleAskSteps(ASK_PROCESS_STEP_COUNT, 'completed'),
          scenarioCode: undefined,
          hasRealResult: true,
          canRetry: true,
          sqlExecutionStatus: 'success',
          executionContext: nextExecutionContext,
        },
      },
      {
        ...resultMessage,
        timestamp: new Date(now + 2),
        parentUserMessageId: userSelectionMessage.id,
        analysisProcess: undefined,
      },
    ]);
    setSelectedQuestionId(userSelectionMessage.id);
  };

  const handleSkillRerun = (skillId: string) => {
    const lastUserMessage = [...(currentConversation?.messages ?? [])]
      .reverse()
      .find((message) => message.role === 'user');

    if (!lastUserMessage) return;

    const baseQuestion = getMessageQuestionText(lastUserMessage.content);
    const skill = allSkills.find((item) => item.id === skillId);

    if (!baseQuestion) return;

    executeQuestion(baseQuestion, {
      kind: 'skill-rerun',
      manualSkillIds: [skillId],
      skillTraceMode: 'rerun',
      userMessageContent: `使用分析能力「${skill?.name ?? '指定分析能力'}」重新生成：${baseQuestion}`,
    });
  };

  const handleRegenerate = (messageId: string) => {
    if (!currentConversation || isGenerating) return;

    const messageIndex = currentConversation.messages.findIndex(
      (message) => message.id === messageId,
    );
    const targetMessage = currentConversation.messages[messageIndex];
    const targetThread = questionThreads.find((thread) =>
      thread.assistantMessages.some((message) => message.id === messageId),
    );
    const previousUserMessage = [...currentConversation.messages.slice(0, messageIndex)]
      .reverse()
      .find((message) => message.role === 'user');

    if (!targetMessage || !previousUserMessage) return;

    const baseQuestion = getMessageQuestionText(previousUserMessage.content);

    if (!baseQuestion) return;

    const preservedSingleSkillId =
      targetMessage.resultScope === 'single-skill'
        ? targetMessage.manualSkillIds?.[0] ?? targetMessage.skillTrace?.[0]?.id
        : undefined;
    const preservedManualSkillIds = preservedSingleSkillId
      ? [preservedSingleSkillId]
      : targetMessage.manualSkillIds ?? [];
    const preservedSkillTraceMode =
      previousUserMessage.kind === 'skill-rerun'
        ? 'rerun'
        : preservedManualSkillIds.length
          ? 'manual'
          : 'auto';

    const executionMode = resolveMessageExecutionMode(targetMessage.routingTrace);
    const forcedAgentId = getAllowedForcedAgentId(targetMessage.routingTrace?.agentId, executionMode);
    const usingDeepAnalysisInAsk = mode === 'ask' && executionMode === 'rca';
    const usingAnalysisWorkspace = usingDeepAnalysisInAsk || mode === 'report';
    const preservedReportTemplateId = targetMessage.reportResult?.templateUsage?.templateId;
    const routing = resolveAgentForQuestion({
      mode: executionMode,
      question: baseQuestion,
      agentPool: allAgents,
      datasetPool: semanticDatasets,
      skillPool: allSkills,
      indicatorPool: indicatorAssets,
      forcedAgentId,
    });

    if (routing.status !== 'resolved' || !routing.agent) return;

    if (usingDeepAnalysisInAsk) {
      setIsFollowingDeepAnalysisActivity(true);
      setSelectedDeepAnalysisActivityId('understand-intent');
      setDeepAnalysisDockTab('progress');
      setDeepAnalysisMobilePane('activity');
      setIsDeepAnalysisWorkbenchOpen(true);
    }

    stopPendingTimers();
    setIsGenerating(true);

    const previousAnalysisMessageIds = new Set(
      targetThread?.assistantMessages
        .filter((message) => message.kind === 'analysis' && message.id !== targetMessage.id)
        .map((message) => message.id) ?? [],
    );

    if (previousAnalysisMessageIds.size > 0) {
      replaceConversationMessages(
        currentConversation.id,
        currentConversation.messages.filter(
          (message) => !previousAnalysisMessageIds.has(message.id),
        ),
      );
    }

    const resolvedManualSkillIds = preservedManualSkillIds.filter((skillId) =>
      allSkills.some(
        (skill) =>
          skill.id === skillId && skill.applicableAgentTypes.includes(executionMode),
      ),
    );
    const skillTrace = buildSkillTrace(
      routing.agent,
      resolvedManualSkillIds,
      allSkills,
      preservedSkillTraceMode,
    );
    const effectiveManualSkillIds = skillTrace.map((skill) => skill.id);
    const resultScope: ResultScope =
      effectiveManualSkillIds.length === 1 ? 'single-skill' : 'combined';
    const primarySkillId = resultScope === 'single-skill' ? effectiveManualSkillIds[0] : undefined;
    const pendingAskResult =
      routing.agent.type === 'ask'
        ? buildAskResult(routing.agent, baseQuestion, {
            resultScope,
            manualSkillIds: effectiveManualSkillIds,
            primarySkillId,
          })
        : null;
    const pendingReportTemplateName =
      routing.agent.type === 'report'
        ? buildReportResult(routing.agent, baseQuestion, skillTrace, {
            resultScope,
            manualSkillIds: effectiveManualSkillIds,
            primarySkillId,
            reportTemplateId: preservedReportTemplateId,
            reportTemplates,
          }).templateUsage?.name
        : undefined;
    const pendingDeepAnalysisProcess = usingAnalysisWorkspace
      ? {
          ...buildAgentAnalysisProcess(routing.agent, baseQuestion, skillTrace, {
          status: 'running',
          skillMatchSource: resolvedManualSkillIds.length ? '手动选择' : '自动匹配',
          visibleStepCount: 1,
          }),
          plannedTaskCount: (mode === 'report' ? reportProcessStepDefinitions : deepAnalysisProcessStepDefinitions).length - 2,
          steps: mode === 'report'
            ? buildVisibleReportSteps(1, 'running')
            : buildVisibleDeepAnalysisSteps(1, 'running'),
        }
      : undefined;

    const analysisMessage: Message = {
      id: targetMessage.id,
      role: 'assistant',
      kind: 'analysis',
      content: '',
      timestamp: new Date(),
      parentUserMessageId: targetMessage.parentUserMessageId ?? previousUserMessage.id,
      isGenerating: true,
      visibleStepCount: 1,
      resultScope,
      analysisSummary:
        routing.agent.type === 'report'
          ? '正在重新识别数据范围、指标口径、报告模板和推送信息。'
          : routing.agent.type === 'rca'
            ? usingAnalysisWorkspace
              ? '已使用深度分析能力，正在重新下钻时间、维度和结构变化，并生成候选根因。'
              : '正在重新下钻时间、维度和结构变化，并生成候选根因。'
            : '正在重新识别数据集、指标口径、维度和 SQL 查询链路。',
      analysisSteps: getAnalysisSteps(routing.agent, baseQuestion),
      matchedReportTemplateName: pendingReportTemplateName,
      skillTrace,
      routingTrace: routing.routingTrace,
      manualSkillIds: effectiveManualSkillIds.length ? effectiveManualSkillIds : undefined,
      analysisProcess: pendingDeepAnalysisProcess ?? (pendingAskResult
        ? buildAnalysisProcessData({
            agent: routing.agent,
            question: baseQuestion,
            result: pendingAskResult,
            skillTrace,
            skillMatchSource: resolvedManualSkillIds.length ? '手动选择' : '自动匹配',
            mcpCapabilities: getProcessMcpCapabilities(routing.agent.id),
            status: 'running',
          })
        : undefined),
      analysisResult: undefined,
      reportResult: undefined,
      rootCauseResult: undefined,
      markdownArtifact: undefined,
      visibleMarkdownLineCount: undefined,
      isInterrupted: false,
      isAwaitingResult: false,
    };

    updateMessage(currentConversation.id, targetMessage.id, analysisMessage);
    pendingAnalysisProcessRef.current = analysisMessage.analysisProcess;
    pendingAnalysisProcessTargetRef.current = analysisMessage.analysisProcess
      ? { conversationId: currentConversation.id, messageId: targetMessage.id }
      : null;
    setPendingConversationId(currentConversation.id);
    setPendingMessageId(targetMessage.id);
    setInputValue('');
    setIsRecording(false);
    resetManualSkillState();

    const streamStepIntervalMs = mode === 'report' ? REPORT_STREAM_STEP_INTERVAL_MS : STREAM_STEP_INTERVAL_MS;
    const finalProcessStepDurationMs = mode === 'report'
      ? REPORT_FINAL_PROCESS_STEP_STREAM_DURATION_MS
      : FINAL_PROCESS_STEP_STREAM_DURATION_MS;
    const workspaceProcessStepCount = mode === 'report'
      ? REPORT_PROCESS_STEP_COUNT
      : DEEP_ANALYSIS_PROCESS_STEP_COUNT;
    const streamStepCount = analysisMessage.analysisProcess
      ? usingAnalysisWorkspace
        ? workspaceProcessStepCount
        : ASK_PROCESS_STEP_COUNT
      : analysisMessage.analysisSteps?.length ?? 1;
    const shouldStreamFinalProcessStep = Boolean(
      analysisMessage.analysisProcess
      && streamStepCount === (usingAnalysisWorkspace ? workspaceProcessStepCount : ASK_PROCESS_STEP_COUNT),
    );
    const streamTimerCount = streamStepCount + (shouldStreamFinalProcessStep ? 1 : 0);
    const streamTimers = Array.from({ length: streamTimerCount }, (_, index) => {
      const isFinalStreamCompletion = shouldStreamFinalProcessStep && index === streamStepCount;
      const timerDelay = isFinalStreamCompletion
        ? (streamStepCount - 1) * streamStepIntervalMs + finalProcessStepDurationMs
        : index * streamStepIntervalMs;

      return window.setTimeout(() => {
        const visibleStepCount = Math.min(index + 1, streamStepCount);
        const isComplete = shouldStreamFinalProcessStep
          ? isFinalStreamCompletion
          : visibleStepCount >= streamStepCount;
        const updates: Partial<Message> = {
          visibleStepCount,
          isGenerating: !isComplete,
          isAwaitingResult: isComplete,
        };

        if (analysisMessage.analysisProcess) {
          updates.analysisProcess = {
            ...analysisMessage.analysisProcess,
            status: isComplete ? 'completed' : 'running',
            visibleStepCount,
            steps: usingAnalysisWorkspace
              ? mode === 'report'
                ? buildVisibleReportSteps(visibleStepCount, isComplete ? 'completed' : 'running')
                : buildVisibleDeepAnalysisSteps(visibleStepCount, isComplete ? 'completed' : 'running')
              : buildVisibleAskSteps(visibleStepCount, isComplete ? 'completed' : 'running'),
            elapsedSeconds: isComplete ? Math.max(1, Math.round((streamStepCount * streamStepIntervalMs) / 1000)) : undefined,
            sqlExecutionStatus: isComplete ? 'success' : 'pending',
          };
          pendingAnalysisProcessRef.current = updates.analysisProcess;
        }

        updateMessage(currentConversation.id, targetMessage.id, updates);

        if (isComplete && !usingAnalysisWorkspace && pendingAnalysisProcessTargetRef.current?.messageId === targetMessage.id) {
          pendingAnalysisProcessRef.current = undefined;
          pendingAnalysisProcessTargetRef.current = null;
        }
      }, timerDelay);
    });

    const resultAppendDelay = streamStepCount * streamStepIntervalMs + RESULT_APPEND_DELAY_MS;
    const resultTimer = window.setTimeout(() => {
      const regeneratedMessage = createResultMessage(
        routing.agent,
        baseQuestion,
        skillTrace,
        effectiveManualSkillIds,
        routing.routingTrace,
        targetMessage.parentUserMessageId ?? previousUserMessage.id,
        usingAnalysisWorkspace,
        preservedReportTemplateId,
      );

      updateMessage(currentConversation.id, targetMessage.id, {
        isAwaitingResult: false,
      });
      if (pendingAnalysisProcessTargetRef.current?.messageId === targetMessage.id) {
        pendingAnalysisProcessRef.current = undefined;
        pendingAnalysisProcessTargetRef.current = null;
      }
      appendMessages(currentConversation.id, [regeneratedMessage]);

      if (usingAnalysisWorkspace && startDeepAnalysisResultStream(currentConversation.id, regeneratedMessage)) {
        return;
      }

      const markdownLineCount = regeneratedMessage.markdownArtifact?.content.split('\n').length ?? 0;

      if (usingAnalysisWorkspace && regeneratedMessage.markdownArtifact && markdownLineCount > 1) {
        setPendingMessageId(regeneratedMessage.id);

        const markdownTimers = Array.from({ length: markdownLineCount - 1 }, (_, index) =>
          window.setTimeout(() => {
            const visibleMarkdownLineCount = index + 2;
            const isMarkdownComplete = visibleMarkdownLineCount >= markdownLineCount;

            updateMessage(currentConversation.id, regeneratedMessage.id, {
              visibleMarkdownLineCount,
              isGenerating: !isMarkdownComplete,
              isInterrupted: false,
            });

            if (isMarkdownComplete) {
              setIsGenerating(false);
              setPendingConversationId(null);
              setPendingMessageId(null);
            }
          }, (index + 1) * REPORT_MARKDOWN_STREAM_INTERVAL_MS),
        );

        timersRef.current = [...timersRef.current, ...markdownTimers];
        return;
      }

      setIsGenerating(false);
      setPendingConversationId(null);
      setPendingMessageId(null);
    }, resultAppendDelay);

    timersRef.current = [...streamTimers, resultTimer];
  };

  const startRecording = () => {
    if (!suggestions.length) return;

    setIsRecording(true);
    const sample = suggestions[Math.floor(Math.random() * suggestions.length)];
    let nextValue = '';

    stopPendingTimers();
    const timers = sample.split('').map((char, index) =>
      window.setTimeout(() => {
        nextValue += char;
        setInputValue(nextValue);
      }, index * 60),
    );
    timersRef.current = timers;
  };

  const stopRecording = () => {
    stopPendingTimers();
    setIsRecording(false);
    setInputValue('');
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);

    const slashMatch = getActiveSlashMatch(value);

    if (!slashMatch) {
      closeSlashMenu();
      return;
    }

    setSlashQuery(slashMatch.query);
    setIsSlashMenuOpen(true);
    setHighlightedSlashIndex(0);
  };

  const focusTextarea = () => {
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      const nextLength = textareaRef.current?.value.length ?? 0;
      textareaRef.current?.setSelectionRange(nextLength, nextLength);
    });
  };

  const handleSelectSlashSkill = (skill: Skill) => {
    setManualSkillIds((current) =>
      current.includes(skill.id) ? current : [...current, skill.id],
    );
    setInputValue(removeActiveSlashToken(inputValue, true));
    closeSlashMenu();
    focusTextarea();
  };

  const handleRemoveManualSkill = (skillId: string) => {
    setManualSkillIds((current) => current.filter((id) => id !== skillId));
    focusTextarea();
  };

  const handleTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isSlashMenuOpen) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightedSlashIndex((current) =>
          filteredSlashSkills.length ? (current + 1) % filteredSlashSkills.length : 0,
        );
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightedSlashIndex((current) =>
          filteredSlashSkills.length
            ? (current - 1 + filteredSlashSkills.length) % filteredSlashSkills.length
            : 0,
        );
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        setInputValue(removeActiveSlashToken(inputValue));
        closeSlashMenu();
        return;
      }

      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();

        if (filteredSlashSkills.length) {
          handleSelectSlashSkill(filteredSlashSkills[highlightedSlashIndex]);
        }
        return;
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const manualSkillSummary = selectedManualSkills.map((skill) => skill.name).join(' / ');

  const selectComposerMode = (nextMode: WorkspaceSwitchMode) => {
    setSelectedComposerMode(nextMode);
    if (nextMode !== 'ask') setIsDeepAnalysisEnabled(false);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const exitComposerMode = () => {
    if (isGenerating) return;

    stopPendingTimers();
    setIsRecording(false);
    setIsDeepAnalysisEnabled(false);
    setSelectedComposerMode(null);
    resetManualSkillState();
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const renderComposer = () => (
    <div className="flex flex-col gap-[6px]">
      {!selectedComposerMode ? (
        <PromptModeBar onSelect={selectComposerMode} className="w-full" />
      ) : null}
      <PromptComposerFrame
        bodyClassName="!gap-2 !py-2.5"
      >
      {selectedManualSkills.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-5 pb-3 pt-4">
          {selectedManualSkills.map((skill) => (
            <span
              key={skill.id}
              className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-700"
            >
              <span className="font-medium">{skill.name}</span>
              {!defaultSkillIdSet.has(skill.id) && (
                <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] text-amber-600">
                  临时使用
                </span>
              )}
              <button
                onClick={() => handleRemoveManualSkill(skill.id)}
                className="text-blue-500 hover:text-blue-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
          <button
            onClick={resetManualSkillState}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            清空
          </button>
        </div>
      )}

      <div className="relative flex min-h-[44px] w-full items-start gap-2">
        {isSlashMenuOpen && (
          <div className="absolute bottom-full left-5 right-5 z-20 mb-3 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
            <Command className="bg-white">
              <div className="border-b border-gray-100 px-4 py-3 text-xs text-gray-500">
                输入 / 指定分析能力
              </div>
              <CommandList className="max-h-80">
                {slashSkillSections.length > 0 ? (
                  slashSkillSections.map((section) => (
                    <CommandGroup key={section.title} heading={section.title}>
                      {section.items.map(({ skill, index }) => {
                        const isHighlighted = index === highlightedSlashIndex;
                        const isSelected = manualSkillIds.includes(skill.id);
                        const isBound = defaultSkillIdSet.has(skill.id);

                        return (
                          <CommandItem
                            key={skill.id}
                            value={`${skill.name}-${skill.id}`}
                            onMouseEnter={() => setHighlightedSlashIndex(index)}
                            onSelect={() => handleSelectSlashSkill(skill)}
                            data-selected={isHighlighted ? true : undefined}
                            className="items-start gap-3 px-3 py-3"
                          >
                            <div
                              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                                isSelected
                                  ? 'border-blue-600 bg-blue-600 text-white'
                                  : 'border-gray-300 bg-white text-transparent'
                              }`}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium text-gray-900">
                                  {skill.name}
                                </span>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] ${
                                    isBound
                                      ? 'bg-blue-50 text-blue-700'
                                      : 'bg-amber-50 text-amber-700'
                                  }`}
                                >
                                  {isBound ? '默认配置内' : '临时使用'}
                                </span>
                              </div>
                              <div className="mt-1 text-xs text-gray-500">
                                {skill.scene} · {skill.description}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {skill.applicableAgentTypes.map((agentType) => (
                                  <span
                                    key={`${skill.id}-${agentType}`}
                                    className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600"
                                  >
                                    {agentTypeLabels[agentType]}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  ))
                ) : (
                  <CommandEmpty>未找到匹配分析能力</CommandEmpty>
                )}
              </CommandList>
            </Command>
          </div>
        )}

        {selectedComposerMode && (
          <PromptModeTag
            mode={selectedComposerMode}
            onRemove={exitComposerMode}
            disabled={isGenerating}
            className="mt-px"
          />
        )}
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(event) => handleInputChange(event.target.value)}
          onKeyDown={handleTextareaKeyDown}
          placeholder={inputPlaceholder}
          className="h-[44px] min-w-0 flex-1 resize-none overflow-y-auto bg-white text-[14px] leading-[21px] text-[#1a1c26] placeholder:leading-[29px] placeholder:text-[#9ca3b0] focus:outline-none"
          rows={2}
        />
      </div>

      <div className="flex min-h-8 items-center justify-between gap-3">
        <div className="min-w-0 flex-1 text-xs text-gray-400">
          {selectedManualSkills.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-gray-600">本次指定分析能力：{manualSkillSummary}</span>
              {hasTemporaryUnboundSkills && (
                <span className="text-amber-600">仅本次使用，不影响配置中心绑定</span>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {selectedComposerMode === 'ask' ? (
                <button
                  type="button"
                  onClick={() => setIsDeepAnalysisEnabled((current) => !current)}
                  className={`inline-flex h-8 items-center gap-1 rounded-[8px] px-3 text-[14px] font-normal leading-[22px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/25 ${
                    isDeepAnalysisEnabled
                      ? 'bg-[#e8f3ff] text-[#165dff]'
                      : 'bg-[#f7f8fa] text-[#1d2129] hover:bg-[#f2f3f5]'
                  }`}
                  aria-pressed={isDeepAnalysisEnabled}
                >
                  <img
                    alt=""
                    src={isDeepAnalysisEnabled ? globalLineSelected : globalLine}
                    className="h-4 w-4"
                  />
                  深度分析
                </button>
              ) : selectedComposerMode === 'report' ? (
                <span aria-hidden="true" />
              ) : (
                <span aria-hidden="true" />
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
              isRecording ? 'bg-[#e8f3ff]' : 'hover:bg-[#f9fafc]'
            }`}
            aria-label={isRecording ? '停止语音输入' : '语音输入'}
            title={isRecording ? '停止语音输入' : '语音输入'}
          >
            <img src={micLine} alt="" className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={isGenerating ? handleStopGeneration : handleSend}
            disabled={!isGenerating && !cleanedInputValue}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
              isGenerating
                ? 'bg-red-600 hover:bg-red-700'
                : cleanedInputValue
                  ? 'bg-[#1677ff] hover:bg-[#0f6fe8]'
                  : 'cursor-not-allowed bg-[#e9e9ea]'
            }`}
            aria-label={
              isGenerating
                ? '停止生成'
                : selectedComposerMode === 'report'
                  ? '生成报告'
                  : selectedComposerMode === 'ask'
                    ? '发送问题'
                    : '智能识别并发送'
            }
            title={
              isGenerating
                ? '停止生成'
                : selectedComposerMode === 'report'
                  ? '生成报告'
                  : selectedComposerMode === 'ask'
                    ? '发送问题'
                    : '智能识别并发送'
            }
          >
            {isGenerating ? (
              <Square className="h-4 w-4 fill-white text-white" />
            ) : (
              <ArrowUp className={`h-4 w-4 ${cleanedInputValue ? 'text-white' : 'text-[#7f8896]'}`} />
            )}
          </button>
        </div>
      </div>
      </PromptComposerFrame>
    </div>
  );

  const renderHistorySidebar = () => {
    if (!sidebarOpen) return null;

    return (
      <ConversationHistorySidebar
        conversations={conversations}
        selectedConversationId={resolvedConversationId}
        newConversationLabel={mode === 'ask' ? '新对话' : newConversationLabel}
        historyLabel={mode === 'ask' ? '历史对话' : currentGroupMeta}
        onNewConversation={handleNewConversation}
        onSelectConversation={(conversationId) =>
          setActiveConversationForWorkspace(mode, conversationId)
        }
        onRenameConversation={renameConversation}
        onDeleteConversation={deleteConversation}
      />
    );
  };

  const renderStandardWorkspace = () => (
    <div
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-tl-[20px] rounded-tr-[20px] bg-white"
      style={{ fontFamily: '"PingFang SC", "PingFang_SC", "Microsoft YaHei", Arial, sans-serif' }}
    >
      {showEmptyConversationState ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-6 sm:px-6 lg:px-10 lg:pt-10">
          <div className="min-h-full w-full">
            <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col items-center pt-20">
              <div className="w-full max-w-4xl">
                {renderComposer()}
              </div>

              {suggestions.length > 0 && (
                <section className="mt-5 w-full max-w-4xl px-1">
                  <div className="text-sm text-gray-400">试试：</div>
                  <div className="mt-2 space-y-1.5">
                    {suggestions.slice(0, 3).map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => executeQuestion(suggestion)}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm leading-5 text-gray-500 transition-colors hover:bg-blue-50 hover:text-blue-700"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div
            data-testid="conversation-scroll-region"
            className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-6 sm:px-6 lg:px-10 lg:pt-10"
          >
            <div className="mx-auto w-full max-w-[1200px] space-y-6">
              {questionThreads.map((thread) => (
                <div key={thread.userMessage.id} className="space-y-6">
                  <div className="mx-auto flex w-full max-w-[1024px] justify-end">
                    <div className="inline-flex max-w-[720px] items-center justify-center gap-1 rounded-[24px] bg-[#f2f4f7] px-4 py-2 text-base leading-6 text-[#1d2129]">
                      <span className="whitespace-pre-wrap">{thread.userMessage.content.replace(/如何？$/, '')}</span>
                    </div>
                  </div>
                  {thread.assistantMessages.length > 0 ? (
                    <div className="space-y-4">
                    {thread.assistantMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`mx-auto w-full space-y-3 ${
                          message.kind === 'rca-result'
                            ? 'max-w-[1200px]'
                            : 'max-w-[1024px]'
                        }`}
                      >
                        <AssistantMessageCard
                          message={message}
                          onRegenerate={handleRegenerate}
                          onRerunSkill={handleSkillRerun}
                          onClarificationSelect={handleClarificationSelect}
                          onAnalysisCandidateSelect={handleAnalysisCandidateSelect}
                        />
                      </div>
                    ))}
                    </div>
                  ) : (
                    <div className="mx-auto max-w-[1024px] rounded-xl border border-dashed border-gray-200 bg-white px-5 py-10 text-center text-sm text-gray-400">
                      正在等待分析结果
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div
            data-testid="conversation-composer-dock"
            className="shrink-0 bg-white px-4 pb-2 pt-1 sm:px-6 lg:px-10"
          >
            <div className="mx-auto w-full max-w-[1024px]">{renderComposer()}</div>
          </div>
        </>
      )}
    </div>
  );

  const handleDeepAnalysisFeedbackChange = (
    messageId: string,
    nextFeedback: DeepAnalysisFeedback,
  ) => {
    setDeepAnalysisFeedbackByMessageId((current) => ({
      ...current,
      [messageId]: current[messageId] === nextFeedback ? undefined : nextFeedback,
    }));
  };

  const renderDeepAnalysisWorkspace = () => {
    if (!activeQuestionThread || !activeDeepAnalysisProcessMessage || !activeDeepAnalysisStage) {
      return renderStandardWorkspace();
    }

    const analysisMessages = activeQuestionThread.assistantMessages.filter(
      (message) => message.kind === 'analysis',
    );
    const selectActivity = (activityId: DeepAnalysisActivityId) => {
      setSelectedDeepAnalysisActivityId(activityId);
      setIsFollowingDeepAnalysisActivity(false);
      setDeepAnalysisPreviewedFileMessageId(null);
      setDeepAnalysisDockTab(getWorkbenchTabForActivity(activityId));
      setIsDeepAnalysisWorkbenchOpen(true);
      setDeepAnalysisMobilePane('workbench');
    };
    return (
      <div
        className="flex min-h-0 flex-1 overflow-hidden rounded-tl-[20px] rounded-tr-[20px] bg-white px-3 pt-3 sm:px-4 lg:px-5"
        style={{ fontFamily: '"PingFang SC", "PingFang_SC", "Microsoft YaHei", Arial, sans-serif' }}
      >
        <div className="mx-auto flex h-full min-h-0 w-full max-w-[1520px] flex-col gap-3">
          <div className="grid h-10 shrink-0 grid-cols-2 rounded-[10px] bg-[#f2f3f5] p-1 xl:hidden" role="group" aria-label="深度分析视图切换">
            <button
              type="button"
              onClick={() => setDeepAnalysisMobilePane('activity')}
              className={`rounded-[7px] text-sm font-normal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 ${deepAnalysisMobilePane === 'activity' ? 'bg-white text-[#165dff] shadow-[0_1px_2px_rgba(29,33,41,0.08)]' : 'text-[#4e5969]'}`}
              aria-pressed={deepAnalysisMobilePane === 'activity'}
            >
              分析过程
            </button>
            <button
              type="button"
              onClick={() => setDeepAnalysisMobilePane('workbench')}
              className={`rounded-[7px] text-sm font-normal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 ${deepAnalysisMobilePane === 'workbench' ? 'bg-white text-[#165dff] shadow-[0_1px_2px_rgba(29,33,41,0.08)]' : 'text-[#4e5969]'}`}
              aria-pressed={deepAnalysisMobilePane === 'workbench'}
            >
              工作台
            </button>
          </div>

          <div className={`relative grid min-h-0 flex-1 grid-cols-1 ${isDeepAnalysisWorkbenchOpen ? 'gap-4 xl:grid-cols-[minmax(480px,1fr)_minmax(480px,1fr)]' : 'xl:grid-cols-1'}`}>
            <section className={`${deepAnalysisMobilePane === 'activity' ? 'flex' : 'hidden'} min-h-0 flex-col overflow-hidden bg-transparent xl:flex ${isDeepAnalysisWorkbenchOpen ? '' : 'xl:mx-auto xl:w-full xl:max-w-[1024px]'}`}>
              <div className="shrink-0 px-4 py-3 md:px-5">
                <div className="flex justify-end">
                  <div className="inline-flex max-w-[720px] flex-wrap items-center justify-end gap-1.5 rounded-[18px] bg-[#f2f4f7] px-3 py-2 text-sm font-normal leading-[22px] text-[#1d2129]">
                    <span className="inline-flex h-[22px] shrink-0 items-center rounded-full bg-[#e8f3ff] px-2 text-xs font-normal leading-[18px] text-[#165dff]">
                      深度分析
                    </span>
                    <span className="whitespace-pre-wrap break-words">{activeQuestionThread.userMessage.content}</span>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-white px-4 py-4 md:px-5">
                {analysisMessages.length ? (
                  <div key="deep-analysis-process-v3" className="space-y-4">
                    {analysisMessages.map((message) =>
                      message.analysisProcess ? (
                        <WorkspaceAnalysisProcessContent
                          key={`workspace-process-v3-${message.id}`}
                          processData={message.analysisProcess}
                          variant="deep-analysis"
                          analysisResult={message.id === activeDeepAnalysisProcessMessage.id
                            ? activeDeepAnalysisResultMessage?.rootCauseResult
                            : undefined}
                          analysisResultVisibleBlockCount={message.id === activeDeepAnalysisProcessMessage.id
                            ? activeDeepAnalysisResultMessage?.visibleDeepAnalysisBlockCount
                            : undefined}
                          analysisResultVisibleTextLength={message.id === activeDeepAnalysisProcessMessage.id
                            ? activeDeepAnalysisResultMessage?.visibleDeepAnalysisTextLength
                            : undefined}
                          analysisResultGenerating={message.id === activeDeepAnalysisProcessMessage.id
                            ? activeDeepAnalysisResultMessage?.isGenerating
                            : undefined}
                          analysisResultInterrupted={message.id === activeDeepAnalysisProcessMessage.id
                            ? activeDeepAnalysisResultMessage?.isInterrupted
                            : undefined}
                          analysisResultLoading={message.id === activeDeepAnalysisProcessMessage.id
                            && message.analysisProcess.status === 'completed'
                            && !activeDeepAnalysisResultMessage}
                          analysisFeedback={message.id === activeDeepAnalysisProcessMessage.id && activeDeepAnalysisResultMessage
                            ? deepAnalysisFeedbackByMessageId[activeDeepAnalysisResultMessage.id]
                            : undefined}
                          selectedActivityId={
                            isDeepAnalysisWorkbenchOpen
                              ? selectedDeepAnalysisActivityId
                              : undefined
                          }
                          onActivitySelect={selectActivity}
                          onAnalysisFeedbackChange={message.id === activeDeepAnalysisProcessMessage.id && activeDeepAnalysisResultMessage
                            ? (feedback) => handleDeepAnalysisFeedbackChange(activeDeepAnalysisResultMessage.id, feedback)
                            : undefined}
                          onAnalysisRegenerate={message.id === activeDeepAnalysisProcessMessage.id && activeDeepAnalysisResultMessage
                            ? () => handleRegenerate(activeDeepAnalysisResultMessage.id)
                            : undefined}
                        />
                      ) : (
                        <AssistantMessageCard
                          key={message.id}
                          message={message}
                          onQuestionClick={executeQuestion}
                          onRegenerate={handleRegenerate}
                          onRerunSkill={handleSkillRerun}
                          onClarificationSelect={handleClarificationSelect}
                          onAnalysisCandidateSelect={handleAnalysisCandidateSelect}
                          forceAnalysisExpanded
                          analysisProcessVariant="workspace"
                        />
                      ),
                    )}
                  </div>
                ) : (
                  <div className="rounded-[12px] border border-dashed border-[#c9cdd4] bg-white px-5 py-12 text-center text-sm text-[#86909c]">
                    正在准备分析过程
                  </div>
                )}
              </div>

              <div className="shrink-0 bg-white px-4 pb-2 pt-1">
                {renderComposer()}
              </div>
            </section>

            {!isDeepAnalysisWorkbenchOpen ? (
              <WorkbenchRestoreControl
                label="深度分析工作台"
                onOpen={() => setIsDeepAnalysisWorkbenchOpen(true)}
              />
            ) : null}

            <div className={`${deepAnalysisMobilePane === 'workbench' ? 'block' : 'hidden'} h-full min-h-0 pb-2 ${isDeepAnalysisWorkbenchOpen ? 'xl:block' : 'xl:hidden'}`}>
              <DeepAnalysisWorkbench
                processMessage={activeDeepAnalysisProcessMessage}
                resultMessage={activeDeepAnalysisResultMessage}
                variant="deep-analysis"
                stage={activeDeepAnalysisStage}
                tab={deepAnalysisDockTab}
                selectedActivityId={selectedDeepAnalysisActivityId}
                previewedFileMessageId={deepAnalysisPreviewedFileMessageId}
                onRegenerate={handleRegenerate}
                onClose={() => {
                  setIsDeepAnalysisWorkbenchOpen(false);
                  setDeepAnalysisMobilePane('activity');
                }}
                onTabChange={(nextTab) => {
                  setDeepAnalysisDockTab(nextTab);
                  if (nextTab !== 'files') setDeepAnalysisPreviewedFileMessageId(null);
                }}
                onPreviewedFileMessageIdChange={setDeepAnalysisPreviewedFileMessageId}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleReportFeedbackChange = (
    messageId: string,
    nextFeedback: DeepAnalysisFeedback,
  ) => {
    setReportFeedbackByMessageId((current) => ({
      ...current,
      [messageId]: current[messageId] === nextFeedback ? undefined : nextFeedback,
    }));
  };

  const renderReportWorkspace = () => {
    if (!activeQuestionThread || !activeReportProcessMessage || !activeReportStage) {
      return renderStandardWorkspace();
    }

    const analysisMessages = activeQuestionThread.assistantMessages.filter(
      (message) => message.kind === 'analysis',
    );
    const selectActivity = (activityId: DeepAnalysisActivityId) => {
      const shouldPreviewCompletedReport =
        activityId === 'draft-report' &&
        activeReportStage === 'completed' &&
        Boolean(activeReportResultMessage?.markdownArtifact);

      setSelectedReportActivityId(activityId);
      setIsFollowingReportActivity(false);
      setReportPreviewedFileMessageId(
        shouldPreviewCompletedReport ? activeReportResultMessage?.id ?? null : null,
      );
      setReportDockTab(
        shouldPreviewCompletedReport ? 'files' : getWorkbenchTabForActivity(activityId),
      );
      setIsReportWorkbenchOpen(true);
      setReportMobilePane('workbench');
    };

    return (
      <div
        className="flex min-h-0 flex-1 overflow-hidden rounded-tl-[20px] rounded-tr-[20px] bg-white px-3 pt-3 sm:px-4 lg:px-5"
        style={{ fontFamily: '"PingFang SC", "PingFang_SC", "Microsoft YaHei", Arial, sans-serif' }}
      >
        <div className="mx-auto flex h-full min-h-0 w-full max-w-[1520px] flex-col gap-3">
          <div className="grid h-10 shrink-0 grid-cols-2 rounded-[10px] bg-[#f2f3f5] p-1 xl:hidden" role="group" aria-label="报告生成视图切换">
            <button
              type="button"
              onClick={() => setReportMobilePane('activity')}
              className={`rounded-[7px] text-sm font-normal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 ${reportMobilePane === 'activity' ? 'bg-white text-[#165dff] shadow-[0_1px_2px_rgba(29,33,41,0.08)]' : 'text-[#4e5969]'}`}
              aria-pressed={reportMobilePane === 'activity'}
            >
              生成过程
            </button>
            <button
              type="button"
              onClick={() => setReportMobilePane('workbench')}
              className={`rounded-[7px] text-sm font-normal transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 ${reportMobilePane === 'workbench' ? 'bg-white text-[#165dff] shadow-[0_1px_2px_rgba(29,33,41,0.08)]' : 'text-[#4e5969]'}`}
              aria-pressed={reportMobilePane === 'workbench'}
            >
              工作台
            </button>
          </div>

          <div className={`relative grid min-h-0 flex-1 grid-cols-1 ${isReportWorkbenchOpen ? 'gap-4 xl:grid-cols-[minmax(480px,1fr)_minmax(480px,1fr)]' : 'xl:grid-cols-1'}`}>
            <section className={`${reportMobilePane === 'activity' ? 'flex' : 'hidden'} min-h-0 flex-col overflow-hidden bg-transparent xl:flex ${isReportWorkbenchOpen ? '' : 'xl:mx-auto xl:w-full xl:max-w-[1024px]'}`}>
              <div className="shrink-0 px-4 py-3 md:px-5">
                <div className="flex justify-end">
                  <div className="inline-flex max-w-[720px] flex-wrap items-center justify-end gap-1.5 rounded-[18px] bg-[#f2f4f7] px-3 py-2 text-sm font-normal leading-[22px] text-[#1d2129]">
                    <span className="inline-flex h-[22px] shrink-0 items-center rounded-full bg-[#e8f3ff] px-2 text-xs font-normal leading-[18px] text-[#165dff]">
                      报告生成
                    </span>
                    <span className="whitespace-pre-wrap break-words">{activeQuestionThread.userMessage.content}</span>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-white px-4 py-4 md:px-5">
                {analysisMessages.length ? (
                  <div key="report-generation-process-v1" className="space-y-4">
                    {analysisMessages.map((message) =>
                      message.analysisProcess ? (
                        <WorkspaceAnalysisProcessContent
                          key={`report-process-${message.id}`}
                          processData={message.analysisProcess}
                          reportState={message.id === activeReportProcessMessage.id && activeReportResultMessage?.markdownArtifact
                            ? activeReportStage === 'completed'
                              ? 'completed'
                              : activeReportStage === 'interrupted'
                                ? 'interrupted'
                                : 'running'
                            : undefined}
                          reportFileName={message.id === activeReportProcessMessage.id
                            ? activeReportResultMessage?.markdownArtifact?.fileName
                            : undefined}
                          reportFeedback={message.id === activeReportProcessMessage.id && activeReportResultMessage
                            ? reportFeedbackByMessageId[activeReportResultMessage.id]
                            : undefined}
                          selectedActivityId={isReportWorkbenchOpen ? selectedReportActivityId : undefined}
                          onActivitySelect={selectActivity}
                          onReportFeedbackChange={message.id === activeReportProcessMessage.id && activeReportResultMessage
                            ? (feedback) => handleReportFeedbackChange(activeReportResultMessage.id, feedback)
                            : undefined}
                          onReportRegenerate={message.id === activeReportProcessMessage.id && activeReportResultMessage
                            ? () => handleRegenerate(activeReportResultMessage.id)
                            : undefined}
                        />
                      ) : (
                        <AssistantMessageCard
                          key={message.id}
                          message={message}
                          onQuestionClick={executeQuestion}
                          onRegenerate={handleRegenerate}
                          onRerunSkill={handleSkillRerun}
                          onClarificationSelect={handleClarificationSelect}
                          onAnalysisCandidateSelect={handleAnalysisCandidateSelect}
                          forceAnalysisExpanded
                          analysisProcessVariant="workspace"
                        />
                      ),
                    )}
                  </div>
                ) : (
                  <div className="rounded-[12px] border border-dashed border-[#c9cdd4] bg-white px-5 py-12 text-center text-sm text-[#86909c]">
                    正在准备报告生成过程
                  </div>
                )}
              </div>

              <div className="shrink-0 bg-white px-4 pb-2 pt-1">
                {renderComposer()}
              </div>
            </section>

            {!isReportWorkbenchOpen ? (
              <WorkbenchRestoreControl
                label="报告生成工作台"
                onOpen={() => setIsReportWorkbenchOpen(true)}
              />
            ) : null}

            <div className={`${reportMobilePane === 'workbench' ? 'block' : 'hidden'} h-full min-h-0 pb-2 ${isReportWorkbenchOpen ? 'xl:block' : 'xl:hidden'}`}>
              <DeepAnalysisWorkbench
                processMessage={activeReportProcessMessage}
                resultMessage={activeReportResultMessage}
                variant="report"
                workbenchLabel="报告生成工作台"
                stage={activeReportStage}
                tab={reportDockTab}
                selectedActivityId={selectedReportActivityId}
                previewedFileMessageId={reportPreviewedFileMessageId}
                onRegenerate={handleRegenerate}
                onClose={() => {
                  setIsReportWorkbenchOpen(false);
                  setReportMobilePane('activity');
                }}
                onTabChange={(nextTab) => {
                  setReportDockTab(nextTab);
                  if (nextTab !== 'files') setReportPreviewedFileMessageId(null);
                }}
                onPreviewedFileMessageIdChange={setReportPreviewedFileMessageId}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative flex h-full min-h-0 flex-1 overflow-hidden bg-transparent">
      {renderHistorySidebar()}
      {isDeepAnalysisWorkspace
        ? renderDeepAnalysisWorkspace()
        : isReportWorkspace
          ? renderReportWorkspace()
          : renderStandardWorkspace()}
    </div>
  );
}
