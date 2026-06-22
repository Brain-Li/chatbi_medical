import { type MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowUp,
  BarChart3,
  CalendarDays,
  Check,
  ClipboardList,
  FileText,
  Mic,
  Pencil,
  Plus,
  Sparkles,
  Square,
  SunMedium,
  Trash2,
  X,
} from 'lucide-react';
import {
  buildAskResult,
  buildReportResult,
  buildRootCauseResult,
  buildSkillTrace,
  getSuggestionSet,
  resolveAgentForQuestion,
} from '../mockData';
import { sampleReportCards, type SampleReportCard } from '../sampleReports';
import { useWorkspace } from '../context/WorkspaceContext';
import { Agent, AgentClarificationOption, AgentRuntimeConfig, AgentType, AnalysisMcpMatch, AnalysisProcessData, AnalysisResultData, Conversation, McpCapability, Message, ResultScope, RootCauseResultData, Skill } from '../types';
import { AssistantMessageCard } from './WorkspaceResultCards';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from './ui/command';

const DEFAULT_NEW_CONVERSATION_TITLE = '新会话';

const workspaceNames: Record<AgentType, string> = {
  ask: '智能问数',
  report: '报告生成',
  rca: '深度分析',
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

const STREAM_STEP_INTERVAL_MS = 720;
const RESULT_APPEND_DELAY_MS = 420;
const MARKDOWN_STREAM_INTERVAL_MS = 90;

type ProcessMcpCapability = McpCapability & { serverName?: string };

type ExecuteQuestionOptions = {
  kind?: Message['kind'];
  manualSkillIds?: string[];
  skillTraceMode?: 'auto' | 'manual' | 'rerun';
  userMessageContent?: string;
  forcedAgentId?: string;
};

type SlashMatch = {
  query: string;
  start: number;
  end: number;
};

type ConversationGroup = {
  label: string;
  items: Conversation[];
};

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

function startOfDay(value: Date) {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getConversationGroupLabel(updatedAt: Date) {
  const today = startOfDay(new Date());
  const targetDay = startOfDay(updatedAt);
  const diffDays = Math.floor((today.getTime() - targetDay.getTime()) / 86400000);

  if (diffDays <= 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) return '近 7 天';
  return '更早';
}

function formatConversationTime(updatedAt: Date) {
  const groupLabel = getConversationGroupLabel(updatedAt);

  if (groupLabel === '今天' || groupLabel === '昨天') {
    return updatedAt.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return updatedAt.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  });
}

function groupConversationsByDate(conversations: Conversation[]): ConversationGroup[] {
  const order = ['今天', '昨天', '近 7 天', '更早'];
  const groups = new Map<string, Conversation[]>();

  conversations.forEach((conversation) => {
    const label = getConversationGroupLabel(conversation.updatedAt);
    groups.set(label, [...(groups.get(label) ?? []), conversation]);
  });

  return order
    .map((label) => ({
      label,
      items: groups.get(label) ?? [],
    }))
    .filter((group) => group.items.length > 0);
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
  };
}

export default function AgentWorkspace({ mode }: { mode: AgentType }) {
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
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [pendingMessageId, setPendingMessageId] = useState<string | null>(null);
  const [pendingConversationId, setPendingConversationId] = useState<string | null>(null);
  const [manualSkillIds, setManualSkillIds] = useState<string[]>([]);
  const [slashQuery, setSlashQuery] = useState('');
  const [isSlashMenuOpen, setIsSlashMenuOpen] = useState(false);
  const [highlightedSlashIndex, setHighlightedSlashIndex] = useState(0);
  const [isDeepAnalysisEnabled, setIsDeepAnalysisEnabled] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const timersRef = useRef<number[]>([]);
  const pendingAnalysisProcessRef = useRef<AnalysisProcessData | undefined>(undefined);
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
  const conversationGroups = useMemo(
    () => groupConversationsByDate(conversations),
    [conversations],
  );
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

  const pageTitle = workspaceNames[mode];
  const inputPlaceholder = mode === 'report' ? '请描述你想生成的报告' : '请输入你的问题';
  const currentGroupMeta = groupedLabels[mode];
  const resolveExecutionMode = (
    question: string,
    forcedAgentId?: string,
  ): AgentType => {
    if (forcedAgentId) {
      return allAgents.find((agent) => agent.id === forcedAgentId)?.type ?? activeAgentType;
    }

    if (mode === 'ask') {
      return isDeepAnalysisEnabled ? 'rca' : 'ask';
    }

    return mode;
  };

  const orderedSkills = useMemo(() => {
    return [...allSkills].sort((left, right) => {
      const leftBound = defaultSkillIdSet.has(left.id) ? 0 : 1;
      const rightBound = defaultSkillIdSet.has(right.id) ? 0 : 1;

      if (leftBound !== rightBound) return leftBound - rightBound;

      return left.name.localeCompare(right.name, 'zh-CN');
    });
  }, [allSkills, defaultSkillIdSet]);

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
        .filter(Boolean) as Skill[],
    [allSkills, manualSkillIds],
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
    setInputValue('');
    setIsRecording(false);
    setSelectedQuestionId(null);
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
    const conversation = createConversation(mode, DEFAULT_NEW_CONVERSATION_TITLE);
    setActiveConversationForWorkspace(mode, conversation.id);
    setEditingConversationId(null);
    setEditingTitle('');
    setInputValue('');
    setIsRecording(false);
    resetManualSkillState();
  };

  const handleOpenSampleReport = (event: MouseEvent<HTMLAnchorElement>, card: SampleReportCard) => {
    event.preventDefault();
    window.open(`/report/preview/${card.id}`, '_blank', 'noopener,noreferrer');
  };

  const handleRenameSubmit = (conversationId: string) => {
    if (!editingTitle.trim()) {
      setEditingConversationId(null);
      setEditingTitle('');
      return;
    }

    renameConversation(conversationId, editingTitle.trim());
    setEditingConversationId(null);
    setEditingTitle('');
  };

  const handleStopGeneration = () => {
    stopPendingTimers();
    setIsGenerating(false);

    if (pendingConversationId && pendingMessageId) {
      const updates: Partial<Message> = {
        isGenerating: false,
        isInterrupted: true,
        isAwaitingResult: false,
      };

      if (pendingAnalysisProcessRef.current) {
        updates.analysisProcess = {
          ...pendingAnalysisProcessRef.current,
          status: 'interrupted',
        };
      }

      updateMessage(pendingConversationId, pendingMessageId, updates);
    }

    pendingAnalysisProcessRef.current = undefined;
  };

  const createResultMessage = (
    agent: Agent,
    question: string,
    skillTrace: ReturnType<typeof buildSkillTrace>,
    selectedSkillIds: string[],
    routingTrace: Message['routingTrace'],
    parentUserMessageId?: string,
    streamMarkdown = false,
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
      return {
        id: `msg-${Date.now()}-report`,
        role: 'assistant',
        kind: 'report-result',
        ...baseMessage,
        reportResult: buildReportResult(agent, question, skillTrace, {
          resultScope,
          manualSkillIds: selectedSkillIds,
          primarySkillId,
          reportTemplates,
        }),
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
      content: '这个问题可能涉及多个分析范围，请选择一个继续。',
      timestamp: new Date(),
      clarificationOptions: options,
      originalQuestion: question,
    };

    appendMessages(conversationId, [clarificationMessage]);
  };

  const executeQuestion = (question: string, options?: ExecuteQuestionOptions) => {
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion || isGenerating) return;

    const executionMode = resolveExecutionMode(trimmedQuestion, options?.forcedAgentId);
    const usingDeepAnalysisInAsk = mode === 'ask' && executionMode === 'rca';

    const routing = resolveAgentForQuestion({
      mode: executionMode,
      question: trimmedQuestion,
      agentPool: allAgents,
      datasetPool: semanticDatasets,
      skillPool: allSkills,
      indicatorPool: indicatorAssets,
      forcedAgentId: options?.forcedAgentId,
    });

    const conversation =
      currentConversation ?? createConversation(mode, DEFAULT_NEW_CONVERSATION_TITLE);

    if (
      conversation.title === DEFAULT_NEW_CONVERSATION_TITLE &&
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

    if (routing.status === 'unavailable' || !routing.agent) {
      appendMessages(conversation.id, [
        userMessage,
        {
          id: `msg-${Date.now()}-unavailable`,
          role: 'assistant',
          kind: 'analysis',
          content: '',
          timestamp: new Date(),
          parentUserMessageId: userMessage.id,
          analysisSummary: routing.unavailableReason ?? '当前数据范围暂无可用分析配置。',
          analysisSteps: ['请在配置中心启用或补充对应类型的 Agent 配置。'],
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
      allSkills.some((skill) => skill.id === skillId),
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
      skillTrace,
      routingTrace: routing.routingTrace,
      manualSkillIds: effectiveManualSkillIds.length ? effectiveManualSkillIds : undefined,
      analysisProcess: pendingAskResult
        ? buildAnalysisProcessData({
            agent: routing.agent,
            question: trimmedQuestion,
            result: pendingAskResult,
            skillTrace,
            skillMatchSource: resolvedManualSkillIds.length ? '手动选择' : '自动匹配',
            mcpCapabilities: getProcessMcpCapabilities(routing.agent.id),
            status: 'running',
          })
        : undefined,
    };

    appendMessages(conversation.id, [userMessage, analysisMessage]);
    pendingAnalysisProcessRef.current = analysisMessage.analysisProcess;
    setPendingConversationId(conversation.id);
    setPendingMessageId(analysisMessage.id);
    setInputValue('');
    setIsRecording(false);
    resetManualSkillState();

    const streamStepCount = analysisMessage.analysisProcess ? 6 : analysisMessage.analysisSteps?.length ?? 1;
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
          };
          pendingAnalysisProcessRef.current = updates.analysisProcess;
        }

        updateMessage(conversation.id, analysisMessage.id, updates);
      }, index * STREAM_STEP_INTERVAL_MS),
    );

    const resultTimer = window.setTimeout(() => {
      updateMessage(conversation.id, analysisMessage.id, {
        isAwaitingResult: false,
      });
      const resultMessage = createResultMessage(
        routing.agent,
        trimmedQuestion,
        skillTrace,
        effectiveManualSkillIds,
        routing.routingTrace,
        userMessage.id,
        usingDeepAnalysisInAsk,
      );
      appendMessages(conversation.id, [
        resultMessage,
      ]);
      pendingAnalysisProcessRef.current = undefined;

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
    }, streamStepCount * STREAM_STEP_INTERVAL_MS + RESULT_APPEND_DELAY_MS);

    timersRef.current = [...streamTimers, resultTimer];
  };

  const handleSend = () => {
    const cleanedQuestion = removeActiveSlashToken(inputValue).trim();
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

    const executionMode = resolveExecutionMode(baseQuestion, targetMessage.routingTrace?.agentId);
    const usingDeepAnalysisInAsk = mode === 'ask' && executionMode === 'rca';
    const routing = resolveAgentForQuestion({
      mode: executionMode,
      question: baseQuestion,
      agentPool: allAgents,
      datasetPool: semanticDatasets,
      skillPool: allSkills,
      indicatorPool: indicatorAssets,
      forcedAgentId: targetMessage.routingTrace?.agentId,
    });

    if (routing.status !== 'matched' || !routing.agent) return;

    stopPendingTimers();
    setIsGenerating(true);

    const resolvedManualSkillIds = preservedManualSkillIds.filter((skillId) =>
      allSkills.some((skill) => skill.id === skillId),
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
      skillTrace,
      routingTrace: routing.routingTrace,
      manualSkillIds: effectiveManualSkillIds.length ? effectiveManualSkillIds : undefined,
      analysisProcess: pendingAskResult
        ? buildAnalysisProcessData({
            agent: routing.agent,
            question: baseQuestion,
            result: pendingAskResult,
            skillTrace,
            skillMatchSource: resolvedManualSkillIds.length ? '手动选择' : '自动匹配',
            mcpCapabilities: getProcessMcpCapabilities(routing.agent.id),
            status: 'running',
          })
        : undefined,
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
    setPendingConversationId(currentConversation.id);
    setPendingMessageId(targetMessage.id);
    setInputValue('');
    setIsRecording(false);
    resetManualSkillState();

    const streamStepCount = analysisMessage.analysisProcess ? 6 : analysisMessage.analysisSteps?.length ?? 1;
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
          };
          pendingAnalysisProcessRef.current = updates.analysisProcess;
        }

        updateMessage(currentConversation.id, targetMessage.id, updates);
      }, index * STREAM_STEP_INTERVAL_MS),
    );

    const resultTimer = window.setTimeout(() => {
      const regeneratedMessage = createResultMessage(
        routing.agent,
        baseQuestion,
        skillTrace,
        effectiveManualSkillIds,
        routing.routingTrace,
        targetMessage.parentUserMessageId ?? previousUserMessage.id,
        usingDeepAnalysisInAsk,
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
      pendingAnalysisProcessRef.current = undefined;

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
    }, streamStepCount * STREAM_STEP_INTERVAL_MS + RESULT_APPEND_DELAY_MS);

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

  const handleMicAction = () => {
    const cleanedInput = removeActiveSlashToken(inputValue).trim();

    if (cleanedInput) {
      handleSend();
      return;
    }

    if (isRecording) {
      stopRecording();
      return;
    }

    startRecording();
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
  const renderComposer = (isInitial = false) => (
    <div
      className={`rounded-[28px] border border-gray-200 bg-white ${
        isInitial ? 'shadow-[0_12px_32px_rgba(15,23,42,0.06)]' : 'shadow-sm'
      }`}
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

      <div className={`relative px-5 pb-3 ${selectedManualSkills.length ? 'pt-3' : 'pt-4'}`}>
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

        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(event) => handleInputChange(event.target.value)}
          onKeyDown={handleTextareaKeyDown}
          placeholder={inputPlaceholder}
          className="w-full resize-none bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
          rows={1}
          style={{ minHeight: isInitial ? '28px' : '24px', maxHeight: '180px' }}
          onInput={resizeTextarea}
        />
      </div>

      <div className="flex items-center justify-between gap-3 px-4 pb-4">
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
              {mode === 'ask' ? (
                <button
                  type="button"
                  onClick={() => setIsDeepAnalysisEnabled((current) => !current)}
                  className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                    isDeepAnalysisEnabled
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Activity className="h-3.5 w-3.5" />
                  深度分析
                </button>
              ) : mode === 'report' ? (
                <span aria-hidden="true" />
              ) : (
                <span>输入 / 指定分析能力；不指定时默认自动匹配</span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={isGenerating ? handleStopGeneration : handleMicAction}
          className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
            isGenerating
              ? 'bg-red-600 hover:bg-red-700'
              : cleanedInputValue || isRecording
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-gray-200 hover:bg-gray-300'
          }`}
        >
          {isGenerating ? (
            <Square className="h-4 w-4 fill-white text-white" />
          ) : cleanedInputValue ? (
            <ArrowUp className="h-5 w-5 text-white" />
          ) : (
            <Mic className={`h-5 w-5 ${isRecording ? 'text-white' : 'text-gray-600'}`} />
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden bg-gray-50">
      <aside className="flex h-full w-80 min-h-0 flex-col border-r border-gray-200 bg-white">
        <div className="shrink-0 border-b border-gray-100 px-4 py-3">
          <button
            onClick={handleNewConversation}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            新建会话
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center px-4 pb-2 pt-4">
              <span className="text-xs font-normal text-gray-400">
                {currentGroupMeta}
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
              {conversations.length > 0 ? (
                <div className="space-y-4">
                  {conversationGroups.map((group) => (
                    <div key={group.label}>
                      <div className="px-2 pb-1 text-[11px] font-medium text-gray-400">
                        {group.label}
                      </div>
                      <div className="space-y-1.5">
                        {group.items.map((conversation) => {
                          const isSelected = conversation.id === resolvedConversationId;
                          const isEditing = editingConversationId === conversation.id;

                          return (
                            <div
                              key={conversation.id}
                              className={`group relative rounded-md py-2 pl-3 pr-1 transition-colors ${
                                isSelected ? 'bg-gray-50' : 'hover:bg-gray-50'
                              }`}
                            >
                              {isEditing ? (
                                <input
                                  autoFocus
                                  value={editingTitle}
                                  onChange={(event) => setEditingTitle(event.target.value)}
                                  onBlur={() => handleRenameSubmit(conversation.id)}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') handleRenameSubmit(conversation.id);
                                    if (event.key === 'Escape') {
                                      setEditingConversationId(null);
                                      setEditingTitle('');
                                    }
                                  }}
                                  className="h-7 w-full rounded-md border border-blue-200 bg-white px-2 text-sm focus:border-blue-500 focus:outline-none"
                                />
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() =>
                                      setActiveConversationForWorkspace(mode, conversation.id)
                                    }
                                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                    title={conversation.title}
                                  >
                                    <span
                                      className={`min-w-0 flex-1 truncate text-sm ${
                                        isSelected ? 'font-medium text-gray-900' : 'text-gray-600'
                                      }`}
                                    >
                                      {conversation.title}
                                    </span>
                                    <span className="shrink-0 text-[11px] text-gray-400 group-hover:hidden">
                                      {formatConversationTime(conversation.updatedAt)}
                                    </span>
                                  </button>
                                  <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
                                    <button
                                      onClick={() => {
                                        setEditingConversationId(conversation.id);
                                        setEditingTitle(conversation.title);
                                      }}
                                      className="rounded p-1 text-gray-300 hover:bg-white hover:text-gray-500"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      onClick={() => deleteConversation(conversation.id)}
                                      className="rounded p-1 text-gray-300 hover:bg-white hover:text-red-500"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-3 py-10 text-center text-sm text-gray-400">
                  当前入口暂无会话
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className={`min-h-0 flex-1 overflow-y-auto px-6 pt-6 ${showEmptyConversationState ? 'pb-8' : 'pb-36'}`}>
          <div className="mx-auto min-h-full max-w-6xl">
            {showEmptyConversationState ? (
              mode === 'report' ? (
                <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col pt-10">
                  <div className="mb-5 text-center">
                    <h2 className="text-3xl font-semibold text-gray-900">想生成什么报告？</h2>
                  </div>

                  <div className="mx-auto w-full max-w-5xl">
                    {renderComposer(true)}
                  </div>

                  <section className="mt-7 w-full">
                    <div className="mb-4 flex items-end justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900">案例精选</h2>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      {sampleReportCards.map((card) => {
                        const Icon =
                          card.icon === 'daily'
                            ? FileText
                            : card.icon === 'weekly'
                              ? CalendarDays
                              : card.icon === 'monthly'
                                ? BarChart3
                                : SunMedium;

                        return (
                          <a
                            key={card.id}
                            href={`/report/preview/${card.id}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => handleOpenSampleReport(event, card)}
                            className="group flex min-h-[260px] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white text-left shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
                          >
                            <div className="p-4 pb-3">
                              <div className="flex items-center gap-3">
                                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${card.iconClassName}`}>
                                  <Icon className="h-4.5 w-4.5" />
                                </span>
                                <div className="min-w-0 text-base font-semibold text-gray-900">
                                  {card.title}
                                </div>
                              </div>

                              <p className="mt-3 line-clamp-2 min-h-11 text-sm leading-[22px] text-gray-500">
                                {card.description}
                              </p>
                            </div>

                            <div className="mx-4 mb-4 mt-auto overflow-hidden rounded-lg bg-gray-50 p-3">
                              <div className="mx-auto h-[118px] max-w-[210px] overflow-hidden rounded-md bg-white px-4 pt-4 shadow-[0_1px_6px_rgba(15,23,42,0.06)]">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="h-3 w-24 rounded-full bg-gray-800/80" />
                                  <ClipboardList className="h-4 w-4 text-gray-300" />
                                </div>
                                <div className="mt-3 space-y-1.5">
                                  <div className="h-1.5 w-full rounded-full bg-gray-200" />
                                  <div className="h-1.5 w-11/12 rounded-full bg-gray-200" />
                                  <div className="h-1.5 w-3/4 rounded-full bg-gray-200" />
                                </div>
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                  {card.metrics.map((metric) => (
                                    <div
                                      key={`${card.id}-${metric.label}`}
                                      className="rounded-md bg-gray-50 px-2 py-1.5"
                                    >
                                      <div className="truncate text-[10px] text-gray-500">
                                        {metric.label}
                                      </div>
                                      <div className="mt-0.5 truncate text-xs font-semibold text-gray-900">
                                        {metric.value}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <div className="mt-3 flex h-8 items-end gap-1.5">
                                  {[18, 26, 21, 31, 28].map((height, index) => (
                                    <span
                                      key={`${card.id}-bar-${index}`}
                                      className="w-full rounded-t-sm bg-blue-200 transition-colors group-hover:bg-blue-400"
                                      style={{ height }}
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  </section>
                </div>
              ) : (
                <div className="mx-auto flex min-h-full w-full max-w-[960px] flex-col items-center pt-20 text-center">
                  <h2 className="text-3xl font-semibold text-gray-900">今天想分析什么问题？</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500">
                    输入一个问题，或从下方示例开始
                  </p>
                  <div className="mt-8 w-full">
                    <div className="grid w-full gap-3 md:grid-cols-2">
                      {suggestions.slice(0, 4).map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => executeQuestion(suggestion)}
                          className="group flex min-h-14 items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm text-gray-700 transition-all hover:border-blue-200 hover:bg-blue-50/30 hover:text-gray-900 hover:shadow-sm"
                        >
                          <Sparkles className="h-3.5 w-3.5 shrink-0 text-gray-300" />
                          <span className="line-clamp-2 leading-5">{suggestion}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-14 w-full">
                    {renderComposer(true)}
                  </div>
                </div>
              )
            ) : (
              <div className="space-y-5">
                {activeQuestionThread ? (
                  <div className="space-y-5">
                    <div className="flex justify-end">
                      <div className="inline-flex max-w-3xl items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm leading-7 text-white shadow-sm">
                        <span className="whitespace-pre-wrap">{activeQuestionThread.userMessage.content}</span>
                      </div>
                    </div>
                    {activeQuestionThread.assistantMessages.length > 0 ? (
                      activeQuestionThread.assistantMessages.map((message) => (
                        <AssistantMessageCard
                          key={message.id}
                          message={message}
                          onQuestionClick={executeQuestion}
                          onRegenerate={handleRegenerate}
                          onRerunSkill={handleSkillRerun}
                          onClarificationSelect={handleClarificationSelect}
                        />
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-gray-200 bg-white px-5 py-10 text-center text-sm text-gray-400">
                        正在等待分析结果
                      </div>
                    )}
                  </div>
                ) : null}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {!showEmptyConversationState && (
          <div className="pointer-events-none fixed bottom-0 left-80 right-0 z-10 bg-gradient-to-t from-gray-50 via-gray-50/95 to-transparent px-6 pb-2 pt-6">
            <div className="pointer-events-auto mx-auto max-w-6xl">
              {renderComposer()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
