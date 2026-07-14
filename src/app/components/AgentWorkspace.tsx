import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  Activity,
  ArrowUp,
  Check,
  Square,
  X,
} from 'lucide-react';
import {
  buildAskResult,
  buildAgentAnalysisProcess,
  buildReportResult,
  buildRootCauseResult,
  buildSkillTrace,
  getSuggestionSet,
  resolveAgentForQuestion,
} from '../mockData';
import { useWorkspace } from '../context/WorkspaceContext';
import { inferPromptMode } from '../utils/promptMode';
import { Agent, AgentClarificationOption, AgentRuntimeConfig, AgentType, AnalysisMcpMatch, AnalysisProcessData, AnalysisResultData, McpCapability, Message, ResultScope, RootCauseResultData, Skill, WorkspaceAutoSubmitPayload } from '../types';
import { ConversationHistorySidebar } from './ConversationHistorySidebar';
import { PromptComposerFrame } from './PromptComposerFrame';
import {
  DeepAnalysisWorkbench,
  type DeepAnalysisFeedback,
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
import globalLine from '../../assets/figma-home/global-line.svg';
import globalLineSelected from '../../assets/figma-home/global-line-selected.svg';
import micLine from '../../assets/figma-home/mic-line.svg';
import qaIcon from '../../assets/figma-home/qa-icon.svg';
import modeReportIcon from '../../assets/figma-home/mode-report-icon.svg';

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
const MARKDOWN_STREAM_INTERVAL_MS = 90;
const ASK_PROCESS_STEP_COUNT = 3;

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
};

type SlashMatch = {
  query: string;
  start: number;
  end: number;
};

type WorkspaceSwitchMode = Extract<AgentType, 'ask' | 'report'>;

const workspaceSwitchTabs: Array<{
  id: WorkspaceSwitchMode;
  label: string;
  icon: string;
}> = [
  { id: 'ask', label: '问数', icon: qaIcon },
  { id: 'report', label: '报告', icon: modeReportIcon },
];

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

function buildMarkdownFileName() {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+$/, '')
    .replace('T', '_');

  return `deep_analysis_${stamp}.md`;
}

function buildDeepAnalysisMarkdown(question: string, result: RootCauseResultData) {
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
      reason: '',
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
    status: 'unavailable',
    visibleStepCount: ASK_PROCESS_STEP_COUNT,
    matchStatus,
    matchMessage,
    sqlExecutionStatus: 'not-run',
    sqlExecutionMessage: '暂未执行查询。',
  };
}

export default function AgentWorkspace({
  mode,
  sidebarOpen = true,
}: {
  mode: AgentType;
  sidebarOpen?: boolean;
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
    updateConversation,
    deleteConversation,
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
    useState<WorkspaceSwitchMode | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [deepAnalysisDockTab, setDeepAnalysisDockTab] =
    useState<DeepAnalysisWorkbenchTab>('follow');
  const [deepAnalysisFeedbackByMessageId, setDeepAnalysisFeedbackByMessageId] =
    useState<Record<string, DeepAnalysisFeedback | undefined>>({});
  const timersRef = useRef<number[]>([]);
  const pendingAnalysisProcessRef = useRef<AnalysisProcessData | undefined>(undefined);
  const pendingAnalysisProcessTargetRef = useRef<{ conversationId: string; messageId: string } | null>(null);
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
  const resolvedConversationId = activeConversationIds[mode] || conversations[0]?.id || null;
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
          Boolean(message.markdownArtifact),
      );

    return resultMessage ?? null;
  }, [activeQuestionThread, mode]);
  const activeDeepAnalysisWorkbenchMessage =
    activeDeepAnalysisResultMessage ?? activeDeepAnalysisProcessMessage;
  const isDeepAnalysisWorkspace =
    mode === 'ask' &&
    Boolean(activeQuestionThread) &&
    Boolean(activeDeepAnalysisWorkbenchMessage);

  const newConversationLabel = newConversationLabels[mode];
  const inputPlaceholder =
    selectedComposerMode === 'ask'
      ? '查询指标、趋势、异常、对比等数据问题...'
      : selectedComposerMode === 'report'
        ? '描述报告主题、统计周期和关注重点...'
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
  const getDraftConversationForMode = (targetMode: WorkspaceSwitchMode) =>
    getConversationsForWorkspace(targetMode).find(
      (conversation) =>
        conversation.title === newConversationLabels[targetMode] &&
        conversation.messages.length === 0,
    );
  const switchMode = (nextMode: WorkspaceSwitchMode) => {
    if (nextMode === mode) {
      setSelectedComposerMode(nextMode);
      return;
    }

    const conversation =
      getDraftConversationForMode(nextMode) ??
      createConversation(nextMode, newConversationLabels[nextMode]);
    setActiveConversationForWorkspace(nextMode, conversation.id);
    setSelectedQuestionId(null);
    setInputValue('');
    setIsRecording(false);
    setIsDeepAnalysisEnabled(false);
    setSelectedComposerMode(nextMode);
    resetManualSkillState();
    navigate(nextMode === 'ask' ? '/ask' : '/report');
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

  const resizeTextarea = () => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = 'auto';
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
  };

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
    resizeTextarea();
  }, [inputValue]);

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
    setSelectedComposerMode(currentConversation?.messages.length ? mode : null);
    setSelectedQuestionId(null);
    setDeepAnalysisDockTab('follow');
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
      navigate('/', { state: { historyOpen: true } });
      return;
    }

    const conversation = createConversation(mode, newConversationLabel);
    setActiveConversationForWorkspace(mode, conversation.id);
    setInputValue('');
    setIsRecording(false);
    setIsDeepAnalysisEnabled(false);
    setSelectedComposerMode(null);
    resetManualSkillState();
  };

  const handleStopGeneration = () => {
    stopPendingTimers();
    setIsGenerating(false);

    if (pendingAnalysisProcessRef.current && pendingAnalysisProcessTargetRef.current) {
      updateMessage(
        pendingAnalysisProcessTargetRef.current.conversationId,
        pendingAnalysisProcessTargetRef.current.messageId,
        {
          isGenerating: false,
          isInterrupted: true,
          isAwaitingResult: false,
          analysisProcess: {
            ...pendingAnalysisProcessRef.current,
            status: 'interrupted',
            sqlExecutionStatus: 'not-run',
            sqlExecutionMessage: '查询已中断。',
          },
        },
      );
    }

    if (pendingConversationId && pendingMessageId) {
      const updates: Partial<Message> = {
        isGenerating: false,
        isInterrupted: true,
        isAwaitingResult: false,
      };

      if (
        pendingAnalysisProcessRef.current &&
        pendingAnalysisProcessTargetRef.current?.conversationId === pendingConversationId &&
        pendingAnalysisProcessTargetRef.current?.messageId === pendingMessageId
      ) {
        updates.analysisProcess = {
          ...pendingAnalysisProcessRef.current,
          status: 'interrupted',
          sqlExecutionStatus: 'not-run',
          sqlExecutionMessage: '查询已中断。',
        };
      }

      updateMessage(pendingConversationId, pendingMessageId, updates);
    }

    pendingAnalysisProcessRef.current = undefined;
    pendingAnalysisProcessTargetRef.current = null;
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

      return {
        id: `msg-${Date.now()}-report`,
        role: 'assistant',
        kind: 'report-result',
        ...baseMessage,
        reportResult,
      };
    }

    if (agent.type === 'rca') {
      const rootCauseResult = buildRootCauseResult(agent, question, {
        resultScope,
        manualSkillIds: selectedSkillIds,
        primarySkillId,
      });
      const markdownContent = buildDeepAnalysisMarkdown(question, rootCauseResult);

      return {
        id: `msg-${Date.now()}-rca`,
        role: 'assistant',
        kind: 'rca-result',
        ...baseMessage,
        rootCauseResult,
        isGenerating: streamMarkdown,
        visibleMarkdownLineCount: streamMarkdown ? 1 : markdownContent.split('\n').length,
        markdownArtifact: {
          fileName: buildMarkdownFileName(),
          content: markdownContent,
        },
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

    const routing = resolveAgentForQuestion({
      mode: executionMode,
      question: trimmedQuestion,
      agentPool: allAgents,
      datasetPool: semanticDatasets,
      skillPool: allSkills,
      indicatorPool: indicatorAssets,
      forcedAgentId,
    });

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
      appendMessages(conversation.id, [
        userMessage,
        {
          id: `msg-${Date.now()}-unavailable`,
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
        ? buildAskResult(routing.agent, trimmedQuestion, {
            resultScope,
            manualSkillIds: effectiveManualSkillIds,
            primarySkillId,
          })
        : null;
    const pendingReportTemplateName =
      routing.agent.type === 'report'
        ? buildReportResult(routing.agent, trimmedQuestion, skillTrace, {
            resultScope,
            manualSkillIds: effectiveManualSkillIds,
            primarySkillId,
            reportTemplateId: options?.reportTemplateId,
            reportTemplates,
          }).templateUsage?.name
        : undefined;
    const pendingDeepAnalysisProcess = usingDeepAnalysisInAsk
      ? buildAgentAnalysisProcess(routing.agent, trimmedQuestion, skillTrace, {
          status: 'running',
          skillMatchSource: resolvedManualSkillIds.length ? '手动选择' : '自动匹配',
          visibleStepCount: 1,
        })
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
            ? usingDeepAnalysisInAsk
              ? '已使用深度分析能力，正在基于指标口径下钻时间、维度和结构变化，并生成候选根因。'
              : '正在基于指标口径下钻时间、维度和结构变化，并生成候选根因。'
            : '正在识别数据集、指标口径、维度和 SQL 查询链路。',
      analysisSteps: getAnalysisSteps(routing.agent, trimmedQuestion),
      matchedReportTemplateName: pendingReportTemplateName,
      skillTrace,
      routingTrace: routing.routingTrace,
      manualSkillIds: effectiveManualSkillIds.length ? effectiveManualSkillIds : undefined,
      analysisProcess: pendingDeepAnalysisProcess ?? (pendingAskResult
        ? buildAnalysisProcessData({
            agent: routing.agent,
            question: trimmedQuestion,
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

    const streamStepCount = analysisMessage.analysisProcess
      ? usingDeepAnalysisInAsk
        ? 6
        : ASK_PROCESS_STEP_COUNT
      : analysisMessage.analysisSteps?.length ?? 1;
    const streamTimers = Array.from({ length: streamStepCount }, (_, index) =>
      window.setTimeout(() => {
        const visibleStepCount = index + 1;
        const isComplete = visibleStepCount >= streamStepCount;
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
            elapsedSeconds: isComplete ? Math.max(1, Math.round((streamStepCount * STREAM_STEP_INTERVAL_MS) / 1000)) : undefined,
            sqlExecutionStatus: isComplete ? 'success' : 'pending',
          };
          pendingAnalysisProcessRef.current = updates.analysisProcess;
        }

        updateMessage(conversation.id, analysisMessage.id, updates);

        if (isComplete && pendingAnalysisProcessTargetRef.current?.messageId === analysisMessage.id) {
          pendingAnalysisProcessRef.current = undefined;
          pendingAnalysisProcessTargetRef.current = null;
        }
      }, index * STREAM_STEP_INTERVAL_MS),
    );

    const resultAppendDelay = usingDeepAnalysisInAsk
      ? STREAM_STEP_INTERVAL_MS + RESULT_APPEND_DELAY_MS
      : streamStepCount * STREAM_STEP_INTERVAL_MS + RESULT_APPEND_DELAY_MS;
    const resultTimer = window.setTimeout(() => {
      const resultMessage = createResultMessage(
        routing.agent,
        trimmedQuestion,
        skillTrace,
        effectiveManualSkillIds,
        routing.routingTrace,
        userMessage.id,
        usingDeepAnalysisInAsk,
        options?.reportTemplateId,
      );
      updateMessage(conversation.id, analysisMessage.id, {
        isAwaitingResult: false,
      });
      appendMessages(conversation.id, [
        resultMessage,
      ]);

      const markdownLineCount = resultMessage.markdownArtifact?.content.split('\n').length ?? 0;

      if (usingDeepAnalysisInAsk && resultMessage.markdownArtifact && markdownLineCount > 1) {
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
          }, (index + 1) * MARKDOWN_STREAM_INTERVAL_MS),
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

    stopPendingTimers();
    setIsGenerating(true);

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
    const pendingDeepAnalysisProcess = usingDeepAnalysisInAsk
      ? buildAgentAnalysisProcess(routing.agent, baseQuestion, skillTrace, {
          status: 'running',
          skillMatchSource: resolvedManualSkillIds.length ? '手动选择' : '自动匹配',
          visibleStepCount: 1,
        })
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
            ? usingDeepAnalysisInAsk
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

    const streamStepCount = analysisMessage.analysisProcess
      ? usingDeepAnalysisInAsk
        ? 6
        : ASK_PROCESS_STEP_COUNT
      : analysisMessage.analysisSteps?.length ?? 1;
    const streamTimers = Array.from({ length: streamStepCount }, (_, index) =>
      window.setTimeout(() => {
        const visibleStepCount = index + 1;
        const isComplete = visibleStepCount >= streamStepCount;
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
            elapsedSeconds: isComplete ? Math.max(1, Math.round((streamStepCount * STREAM_STEP_INTERVAL_MS) / 1000)) : undefined,
            sqlExecutionStatus: isComplete ? 'success' : 'pending',
          };
          pendingAnalysisProcessRef.current = updates.analysisProcess;
        }

        updateMessage(currentConversation.id, targetMessage.id, updates);

        if (isComplete && pendingAnalysisProcessTargetRef.current?.messageId === targetMessage.id) {
          pendingAnalysisProcessRef.current = undefined;
          pendingAnalysisProcessTargetRef.current = null;
        }
      }, index * STREAM_STEP_INTERVAL_MS),
    );

    const resultAppendDelay = usingDeepAnalysisInAsk
      ? STREAM_STEP_INTERVAL_MS + RESULT_APPEND_DELAY_MS
      : streamStepCount * STREAM_STEP_INTERVAL_MS + RESULT_APPEND_DELAY_MS;
    const resultTimer = window.setTimeout(() => {
      const regeneratedMessage = createResultMessage(
        routing.agent,
        baseQuestion,
        skillTrace,
        effectiveManualSkillIds,
        routing.routingTrace,
        targetMessage.parentUserMessageId ?? previousUserMessage.id,
        usingDeepAnalysisInAsk,
        preservedReportTemplateId,
      );

      updateMessage(currentConversation.id, targetMessage.id, {
        kind: regeneratedMessage.kind,
        content: regeneratedMessage.content,
        timestamp: new Date(),
        skillTrace: regeneratedMessage.skillTrace,
        routingTrace: regeneratedMessage.routingTrace,
        resultScope: regeneratedMessage.resultScope,
        manualSkillIds: regeneratedMessage.manualSkillIds,
        runtimeConfig: regeneratedMessage.runtimeConfig,
        analysisResult: regeneratedMessage.analysisResult ?? undefined,
        reportResult: regeneratedMessage.reportResult ?? undefined,
        rootCauseResult: regeneratedMessage.rootCauseResult ?? undefined,
        analysisProcess: regeneratedMessage.analysisProcess,
        markdownArtifact: regeneratedMessage.markdownArtifact,
        visibleMarkdownLineCount: regeneratedMessage.visibleMarkdownLineCount,
        isInterrupted: false,
        isGenerating: regeneratedMessage.isGenerating,
        isAwaitingResult: false,
        visibleStepCount: undefined,
        analysisSummary: undefined,
        analysisSteps: undefined,
      });

      const markdownLineCount = regeneratedMessage.markdownArtifact?.content.split('\n').length ?? 0;

      if (usingDeepAnalysisInAsk && regeneratedMessage.markdownArtifact && markdownLineCount > 1) {
        const markdownTimers = Array.from({ length: markdownLineCount - 1 }, (_, index) =>
          window.setTimeout(() => {
            const visibleMarkdownLineCount = index + 2;
            const isMarkdownComplete = visibleMarkdownLineCount >= markdownLineCount;

            updateMessage(currentConversation.id, targetMessage.id, {
              visibleMarkdownLineCount,
              isGenerating: !isMarkdownComplete,
              isInterrupted: false,
            });

            if (isMarkdownComplete) {
              setIsGenerating(false);
              setPendingConversationId(null);
              setPendingMessageId(null);
            }
          }, (index + 1) * MARKDOWN_STREAM_INTERVAL_MS),
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
      resizeTextarea();
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

  const clearComposerMode = () => {
    setSelectedComposerMode(null);
    setIsDeepAnalysisEnabled(false);
    resetManualSkillState();
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const renderWorkspaceSwitch = () => (
    <div className="flex min-w-0 items-center gap-[13px] overflow-x-auto">
      {workspaceSwitchTabs.map((item) => {
        const active = selectedComposerMode === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => switchMode(item.id)}
            className={`flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg border px-[13px] text-[14px] font-normal leading-[22px] transition-colors ${
              active
                ? item.id === 'ask'
                  ? 'border-[#bcd4ff] bg-[#edf2ff] text-[#1f63d7]'
                  : 'border-[#b7ebc6] bg-[#f0fff4] text-[#00b42a]'
                : 'border-[#d4d6dc] bg-white text-[#333b46] hover:bg-[#f9fafc]'
            }`}
            aria-pressed={active}
            aria-label={`切换到${item.label}模式`}
          >
            <img src={item.icon} alt="" className="h-5 w-5" />
            {item.label}
          </button>
        );
      })}
    </div>
  );

  const renderComposer = ({
    showModeSwitch = true,
  }: {
    showModeSwitch?: boolean;
  } = {}) => (
    <div className="flex flex-col gap-3">
      {showModeSwitch && !selectedComposerMode && renderWorkspaceSwitch()}

      <PromptComposerFrame>
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

      <div className="relative flex min-h-[52px] w-full items-start gap-2">
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
          <span
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[14px] leading-[22px] ${
              selectedComposerMode === 'ask'
                ? 'border-[#bcd4ff] bg-[#edf2ff] text-[#1f63d7]'
                : 'border-[#b7ebc6] bg-[#f0fff4] text-[#00b42a]'
            }`}
          >
            <img
              src={selectedComposerMode === 'ask' ? qaIcon : modeReportIcon}
              alt=""
              className="h-4 w-4"
            />
            {selectedComposerMode === 'ask' ? '问数' : '报告'}
            <button
              type="button"
              onClick={clearComposerMode}
              className="flex h-4 w-4 items-center justify-center rounded-full transition-colors hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20"
              aria-label={`退出${selectedComposerMode === 'ask' ? '问数' : '报告'}模式`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        )}

        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(event) => handleInputChange(event.target.value)}
          onKeyDown={handleTextareaKeyDown}
          placeholder={inputPlaceholder}
          className="h-[52px] max-h-[112px] min-h-[52px] min-w-0 flex-1 resize-none overflow-y-auto bg-white pt-1 text-[14px] leading-[21px] text-[#1a1c26] placeholder:text-[#9ca3b0] focus:outline-none"
          rows={2}
          onInput={resizeTextarea}
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
                  className={`inline-flex h-8 items-center gap-1 rounded-lg p-2 text-[14px] font-normal leading-[22.5px] transition-colors ${
                    isDeepAnalysisEnabled
                      ? 'bg-[#e8f3ff] text-[#165dff]'
                      : 'bg-[#f9fafc] text-[#4e5969] hover:bg-[#f2f3f5]'
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
                  <div className="flex justify-end">
                    <div className="inline-flex max-w-3xl items-center justify-center gap-1 rounded-[24px] bg-[#f2f4f7] px-4 py-2 text-base leading-6 text-[#1d2129]">
                      <span className="whitespace-pre-wrap">{thread.userMessage.content.replace(/如何？$/, '')}</span>
                    </div>
                  </div>
                  {thread.assistantMessages.length > 0 ? (
                    <div className="space-y-4">
                    {thread.assistantMessages.map((message) => (
                      <div key={message.id} className="space-y-3">
                        <AssistantMessageCard
                          message={message}
                          onQuestionClick={executeQuestion}
                          onRegenerate={handleRegenerate}
                          onRerunSkill={handleSkillRerun}
                          onClarificationSelect={handleClarificationSelect}
                        />
                      </div>
                    ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-white px-5 py-10 text-center text-sm text-gray-400">
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
            className="shrink-0 bg-white px-4 pb-6 pt-3 sm:px-6 lg:px-10"
          >
            <div className="mx-auto w-full max-w-[1200px]">{renderComposer()}</div>
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
    if (!activeQuestionThread || !activeDeepAnalysisWorkbenchMessage) return renderStandardWorkspace();

    const analysisMessages = activeQuestionThread.assistantMessages.filter(
      (message) => message.kind === 'analysis',
    );
    const deepAnalysisWorkspaceTitle =
      activeDeepAnalysisResultMessage?.rootCauseResult?.title ??
      activeDeepAnalysisWorkbenchMessage.rootCauseResult?.title ??
      activeDeepAnalysisWorkbenchMessage.markdownArtifact?.content.match(/^#\s+(.+)$/m)?.[1]?.trim() ??
      activeDeepAnalysisProcessMessage?.analysisProcess?.resultPreview.title ??
      '分析过程';

    return (
      <div className="flex min-h-0 flex-1 overflow-hidden px-4 py-4 lg:px-5">
        <div className="mx-auto flex h-full min-h-0 w-full max-w-[1520px] flex-col gap-4">
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(360px,0.96fr)_minmax(420px,1.04fr)]">
            <section className="flex min-h-[360px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] xl:min-h-0">
              <div className="shrink-0 border-b border-gray-100 px-5 py-4">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="min-w-0 truncate text-sm font-semibold text-gray-900"
                    title={deepAnalysisWorkspaceTitle}
                  >
                    {deepAnalysisWorkspaceTitle}
                  </span>
                  <span className="inline-flex h-6 items-center rounded-full bg-blue-50 px-2.5 text-xs font-medium text-blue-700">
                    深度分析
                  </span>
                </div>
                <div className="mt-3 flex justify-end">
                  <div className="max-w-[88%] rounded-lg bg-blue-600 px-4 py-3 text-sm leading-6 text-white shadow-sm sm:max-w-[76%]">
                    <div className="whitespace-pre-wrap break-words">
                      {activeQuestionThread.userMessage.content}
                    </div>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50/40 px-4 py-4">
                {analysisMessages.length ? (
                  <div
                    key="deep-analysis-process-v2"
                    className="space-y-3"
                  >
                    {analysisMessages.map((message) =>
                      message.analysisProcess ? (
                        <WorkspaceAnalysisProcessContent
                          key={`workspace-process-v2-${message.id}`}
                          processData={message.analysisProcess}
                        />
                      ) : (
                        <AssistantMessageCard
                          key={message.id}
                          message={message}
                          onQuestionClick={executeQuestion}
                          onRegenerate={handleRegenerate}
                          onRerunSkill={handleSkillRerun}
                          onClarificationSelect={handleClarificationSelect}
                          forceAnalysisExpanded
                          analysisProcessVariant="workspace"
                        />
                      ),
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-gray-200 bg-white px-5 py-12 text-center text-sm text-gray-400">
                    正在准备分析过程
                  </div>
                )}
              </div>

              <div className="shrink-0 border-t border-gray-100 bg-white p-4">
                {renderComposer({ showModeSwitch: false })}
              </div>
            </section>

            <div className="min-h-[420px] xl:min-h-0">
              <DeepAnalysisWorkbench
                message={activeDeepAnalysisWorkbenchMessage}
                tab={deepAnalysisDockTab}
                feedback={
                  activeDeepAnalysisResultMessage
                    ? deepAnalysisFeedbackByMessageId[activeDeepAnalysisResultMessage.id]
                    : undefined
                }
                onFeedbackChange={
                  activeDeepAnalysisResultMessage
                    ? (feedback) =>
                        handleDeepAnalysisFeedbackChange(
                          activeDeepAnalysisResultMessage.id,
                          feedback,
                        )
                    : undefined
                }
                onRegenerate={
                  activeDeepAnalysisResultMessage ? handleRegenerate : undefined
                }
                onTabChange={setDeepAnalysisDockTab}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden bg-transparent">
      {renderHistorySidebar()}
      {isDeepAnalysisWorkspace ? renderDeepAnalysisWorkspace() : renderStandardWorkspace()}
    </div>
  );
}
