import { guardLicense } from '../license/service';
import { useLicense } from '../license/hooks';
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  agents as initialAgents,
  databases as initialDatabaseConnections,
  dimensionMembers as initialDimensionMembers,
  dimensionSemantics as initialDimensionSemantics,
  indicatorAssets as initialIndicatorAssets,
  initialConversations,
  knowledgeBases as initialKnowledgeBases,
  knowledgeDocuments as initialKnowledgeDocuments,
  mcpServers as initialMcpServers,
  metricSemantics as initialMetricSemantics,
  reportTemplates as initialReportTemplates,
  defaultTemplateBindings as initialDefaultTemplateBindings,
  reportSubscriptions as initialReportSubscriptions,
  semanticDatasets as initialSemanticDatasets,
  skills as initialSkills,
  YESTERDAY_HISTORY_EXAMPLE_ID,
} from '../mockData';
import {
  Agent,
  AgentType,
  Conversation,
  DatabaseConnection,
  DimensionMember,
  DimensionSemantic,
  IndicatorAsset,
  KnowledgeBase,
  KnowledgeDocument,
  McpCapability,
  McpServer,
  Message,
  MetricSemantic,
  ReportSubscription,
  ReportTemplate,
  DefaultTemplateBinding,
  SemanticDataset,
  Skill,
} from '../types';

interface WorkspaceContextValue {
  agents: Agent[];
  skills: Skill[];
  semanticDatasets: SemanticDataset[];
  indicatorAssets: IndicatorAsset[];
  knowledgeBases: KnowledgeBase[];
  knowledgeDocuments: KnowledgeDocument[];
  metricSemantics: MetricSemantic[];
  reportTemplates: ReportTemplate[];
  defaultTemplateBindings: DefaultTemplateBinding[];
  reportSubscriptions: ReportSubscription[];
  dimensionSemantics: DimensionSemantic[];
  dimensionMembers: DimensionMember[];
  conversations: Conversation[];
  databaseConnections: DatabaseConnection[];
  mcpServers: McpServer[];
  updateAgent: (agentId: string, updates: Partial<Agent>) => void;
  addAgent: (agent: Agent) => void;
  copyAgent: (agentId: string) => Agent | null;
  deleteAgent: (agentId: string) => void;
  createConversation: (workspaceType: AgentType, title: string, agent?: Agent) => Conversation;
  appendMessages: (conversationId: string, messages: Message[]) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;
  replaceConversationMessages: (conversationId: string, messages: Message[]) => void;
  updateConversation: (conversationId: string, updates: Partial<Conversation>) => void;
  deleteConversation: (conversationId: string) => void;
  renameConversation: (conversationId: string, title: string) => void;
  getConversationsForWorkspace: (type: AgentType) => Conversation[];
  activeConversationIds: Record<AgentType, string | null>;
  setActiveConversationForWorkspace: (type: AgentType, conversationId: string | null) => void;
  updateSkill: (skillId: string, updates: Partial<Skill>) => void;
  addSkill: (skill: Skill) => void;
  copySkill: (skillId: string) => void;
  deleteSkill: (skillId: string) => void;
  addKnowledgeDocument: (document: KnowledgeDocument) => void;
  updateKnowledgeDocument: (documentId: string, updates: Partial<KnowledgeDocument>) => void;
  deleteKnowledgeDocument: (documentId: string) => void;
  addReportTemplate: (template: ReportTemplate) => void;
  updateReportTemplate: (templateId: string, updates: Partial<ReportTemplate>) => void;
  deleteReportTemplate: (templateId: string) => void;
  updateDefaultTemplateBinding: (industry: string, templateId: string) => void;
  addReportSubscription: (subscription: ReportSubscription) => void;
  updateReportSubscription: (subscriptionId: string, updates: Partial<ReportSubscription>) => void;
  deleteReportSubscription: (subscriptionId: string) => void;
  addSemanticDataset: (dataset: SemanticDataset) => void;
  updateSemanticDataset: (datasetId: string, updates: Partial<SemanticDataset>) => void;
  deleteSemanticDataset: (datasetId: string) => void;
  addIndicatorAssets: (indicators: IndicatorAsset[]) => void;
  updateIndicatorAsset: (indicatorId: string, updates: Partial<IndicatorAsset>) => void;
  deleteIndicatorAsset: (indicatorId: string) => void;
  addDimensionSemantic: (dimension: DimensionSemantic) => void;
  updateDimensionSemantic: (dimensionId: string, updates: Partial<DimensionSemantic>) => void;
  deleteDimensionSemantic: (dimensionId: string) => void;
  addDimensionMember: (member: DimensionMember) => void;
  updateDimensionMember: (memberId: string, updates: Partial<DimensionMember>) => void;
  deleteDimensionMember: (memberId: string) => void;
  addDatabaseConnection: (connection: DatabaseConnection) => void;
  updateDatabaseConnection: (connectionId: number, updates: Partial<DatabaseConnection>) => void;
  deleteDatabaseConnection: (connectionId: number) => void;
  getCapabilitiesForAgent: (agentId: string) => McpCapability[];
  getServersForAgent: (agentId: string) => McpServer[];
  updateMcpServer: (serverId: string, updater: (server: McpServer) => McpServer) => void;
  addMcpServer: (server: McpServer) => void;
  deleteMcpServer: (serverId: string) => void;
  updateMcpCapability: (
    capabilityId: string,
    updater: (capability: McpCapability) => McpCapability,
  ) => void;
  setMcpCapabilityAgentBinding: (capabilityId: string, agentId: string, enabled: boolean) => void;
  setMcpCapabilitySkillBinding: (capabilityId: string, skillId: string, enabled: boolean) => void;
  bulkSetMcpServerAgentBinding: (serverId: string, agentId: string, enabled: boolean) => void;
  setAgentMcpCapabilityBindings: (agentId: string, capabilityIds: string[]) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const CONVERSATIONS_STORAGE_KEY = 'chatbi_medical.conversations.v1';
const ACTIVE_CONVERSATIONS_STORAGE_KEY = 'chatbi_medical.activeConversationIds.v1';
const STORAGE_SCHEMA_VERSION_KEY = 'chatbi_medical.workspaceSchemaVersion';
const CURRENT_STORAGE_SCHEMA_VERSION = 'ask-exception-demos-20260717-v2';
const CONVERSATION_RETENTION_DAYS = 30;
const CONVERSATION_RETENTION_MS = CONVERSATION_RETENTION_DAYS * 24 * 60 * 60 * 1000;

type StoredConversation = Omit<Conversation, 'createdAt' | 'updatedAt' | 'messages'> & {
  createdAt: string;
  updatedAt: string;
  messages: Array<Omit<Message, 'timestamp'> & { timestamp: string }>;
};

const isAgentType = (value: unknown): value is AgentType =>
  value === 'ask' || value === 'report' || value === 'rca';

const parseStoredDate = (value: unknown) => {
  const parsedDate = value ? new Date(String(value)) : new Date();
  return Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
};

const toStoredConversation = (conversation: Conversation): StoredConversation => ({
  ...conversation,
  createdAt: conversation.createdAt.toISOString(),
  updatedAt: conversation.updatedAt.toISOString(),
  messages: conversation.messages.map((message) => ({
    ...message,
    timestamp: message.timestamp.toISOString(),
  })),
});

const fromStoredConversation = (conversation: StoredConversation): Conversation => ({
  ...conversation,
  createdAt: parseStoredDate(conversation.createdAt),
  updatedAt: parseStoredDate(conversation.updatedAt),
  messages: conversation.messages.map((message) => ({
    ...message,
    timestamp: parseStoredDate(message.timestamp),
  })),
});

const getRetainedConversations = (conversations: Conversation[], now = Date.now()) => {
  const cutoff = now - CONVERSATION_RETENTION_MS;
  return conversations.filter((conversation) => conversation.updatedAt.getTime() >= cutoff);
};

const mergeSeededConversations = (conversations: Conversation[]) => {
  const demos = initialConversations.filter((conversation) => conversation.isDemo);
  const yesterdayExample = initialConversations.find(
    (conversation) => conversation.id === YESTERDAY_HISTORY_EXAMPLE_ID,
  );
  const seededConversations = yesterdayExample ? [...demos, yesterdayExample] : demos;
  const seededConversationIds = new Set(
    seededConversations.map((conversation) => conversation.id),
  );
  const preserved = conversations.filter(
    (conversation) =>
      !seededConversationIds.has(conversation.id)
      && !conversation.id.startsWith('conv-boundary-')
      && !conversation.isDemo,
  );

  return [...seededConversations, ...preserved];
};

const readStoredConversations = () => {
  if (typeof window === 'undefined') return null;

  try {
    const rawValue = window.localStorage.getItem(CONVERSATIONS_STORAGE_KEY);
    if (!rawValue) return null;

    const parsedValue = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) return null;

    const storedConversations = parsedValue.map((conversation) =>
      fromStoredConversation(conversation as StoredConversation),
    );

    return mergeSeededConversations(storedConversations);
  } catch {
    return null;
  }
};

const readStoredActiveConversationIds = (
  conversations: Conversation[],
  fallback: Record<AgentType, string | null>,
) => {
  if (typeof window === 'undefined') return fallback;

  try {
    const rawValue = window.localStorage.getItem(ACTIVE_CONVERSATIONS_STORAGE_KEY);
    if (!rawValue) return fallback;

    const parsedValue = JSON.parse(rawValue) as Partial<Record<AgentType, string | null>>;
    const conversationIds = new Set(conversations.map((conversation) => conversation.id));

    return (['ask', 'report', 'rca'] as AgentType[]).reduce<Record<AgentType, string | null>>(
      (current, type) => {
        const nextId = parsedValue[type];
        current[type] = typeof nextId === 'string' && conversationIds.has(nextId) ? nextId : fallback[type];
        return current;
      },
      { ask: null, report: null, rca: null },
    );
  } catch {
    return fallback;
  }
};

const getDefaultActiveConversationIds = (conversations: Conversation[]) => {
  const defaults = conversations.reduce<Record<AgentType, string | null>>(
    (current, conversation) => {
      const workspaceType = isAgentType(conversation.workspaceType)
        ? conversation.workspaceType
        : conversation.agentType ?? 'ask';
      const previousConversationId = current[workspaceType];
      const previousConversation = conversations.find((item) => item.id === previousConversationId);

      if (!previousConversation || conversation.updatedAt.getTime() > previousConversation.updatedAt.getTime()) {
        current[workspaceType] = conversation.id;
      }

      return current;
    },
    { ask: null, report: null, rca: null },
  );
  const featuredAskConversation = conversations.find(
    (conversation) =>
      (conversation.workspaceType ?? conversation.agentType) === 'ask' &&
      conversation.title === '上月门诊总收入和药占比情况',
  );

  return {
    ...defaults,
    ask: featuredAskConversation?.id ?? defaults.ask,
  };
};

const storedInitialConversations = readStoredConversations();
const workspaceInitialConversations = getRetainedConversations(
  storedInitialConversations ?? initialConversations,
);
const defaultActiveConversationIds = getDefaultActiveConversationIds(workspaceInitialConversations);
const workspaceInitialActiveConversationIds = readStoredActiveConversationIds(
  workspaceInitialConversations,
  defaultActiveConversationIds,
);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { status: licenseStatus } = useLicense();
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [skills, setSkills] = useState<Skill[]>(initialSkills);
  const [semanticDatasets, setSemanticDatasets] =
    useState<SemanticDataset[]>(initialSemanticDatasets);
  const [indicatorAssets, setIndicatorAssets] =
    useState<IndicatorAsset[]>(initialIndicatorAssets);
  const [knowledgeBases] = useState<KnowledgeBase[]>(initialKnowledgeBases);
  const [knowledgeDocuments, setKnowledgeDocuments] =
    useState<KnowledgeDocument[]>(initialKnowledgeDocuments);
  const [metricSemantics] = useState<MetricSemantic[]>(initialMetricSemantics);
  const [reportTemplates, setReportTemplates] = useState<ReportTemplate[]>(initialReportTemplates);
  const [defaultTemplateBindings, setDefaultTemplateBindings] = useState<DefaultTemplateBinding[]>(initialDefaultTemplateBindings);
  const [reportSubscriptions, setReportSubscriptions] =
    useState<ReportSubscription[]>(() => {
      try {
        const saved = JSON.parse(localStorage.getItem('chatbi.subscriptions.v1') ?? 'null');
        if (Array.isArray(saved) && saved.every(item => typeof item.id === 'string' && Array.isArray(item.runs) && Array.isArray(item.pushRecords))) return saved;
      } catch { /* Use existing demo data. */ }
      return initialReportSubscriptions;
    });
  useEffect(() => {
    if (licenseStatus !== 'expired' && licenseStatus !== 'invalid' && licenseStatus !== 'unactivated') return;
    setReportSubscriptions(current => current.some(item => item.status === 'running' && !item.deletedAt)
      ? current.map(item => item.status === 'running' && !item.deletedAt ? { ...item, status: 'paused', licensePaused: true } : item)
      : current);
  }, [licenseStatus]);
  useEffect(() => {
    try { localStorage.setItem('chatbi.subscriptions.v1', JSON.stringify(reportSubscriptions)); } catch { /* Keep in-memory state. */ }
  }, [reportSubscriptions]);
  const [dimensionSemantics, setDimensionSemantics] = useState<DimensionSemantic[]>(initialDimensionSemantics);
  const [dimensionMembers, setDimensionMembers] = useState<DimensionMember[]>(initialDimensionMembers);
  const [conversations, setConversations] = useState<Conversation[]>(workspaceInitialConversations);
  const [databaseConnections, setDatabaseConnections] =
    useState<DatabaseConnection[]>(initialDatabaseConnections);
  const [mcpServers, setMcpServers] = useState<McpServer[]>(initialMcpServers);
  const [activeConversationIds, setActiveConversationIds] =
    useState<Record<AgentType, string | null>>(workspaceInitialActiveConversationIds);

  useEffect(() => {
    try {
      const retainedConversations = getRetainedConversations(conversations);
      window.localStorage.setItem(STORAGE_SCHEMA_VERSION_KEY, CURRENT_STORAGE_SCHEMA_VERSION);
      window.localStorage.setItem(
        CONVERSATIONS_STORAGE_KEY,
        JSON.stringify(retainedConversations.map(toStoredConversation)),
      );
    } catch {
      // Ignore storage quota and privacy-mode failures; in-memory state still works.
    }
  }, [conversations]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        ACTIVE_CONVERSATIONS_STORAGE_KEY,
        JSON.stringify(activeConversationIds),
      );
    } catch {
      // Ignore storage quota and privacy-mode failures; in-memory state still works.
    }
  }, [activeConversationIds]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      agents,
      skills,
      semanticDatasets,
      indicatorAssets,
      knowledgeBases,
      knowledgeDocuments,
      metricSemantics,
      reportTemplates,
      defaultTemplateBindings,
      reportSubscriptions,
      dimensionSemantics,
      dimensionMembers,
      conversations,
      databaseConnections,
      mcpServers,
      activeConversationIds,
      updateAgent: (agentId, updates) => {
        if (!guardLicense('configure')) return ;
        const targetAgent = agents.find((agent) => agent.id === agentId);
        const targetType = updates.type ?? targetAgent?.type;
        setAgents((current) =>
          current.map((agent) =>
            agent.id === agentId
              ? {
                  ...agent,
                  ...updates,
                  updatedAt: new Date(),
                }
              : updates.isDefault && targetType && agent.type === targetType
                ? {
                    ...agent,
                    isDefault: false,
                    updatedAt: new Date(),
                  }
              : agent,
          ),
        );
      },
      addAgent: (agent) => {
        if (!guardLicense('configure')) return ;
        setAgents((current) => [
          agent,
          ...current.map((item) =>
            agent.isDefault && item.type === agent.type ? { ...item, isDefault: false } : item,
          ),
        ]);
      },
      copyAgent: (agentId) => {
        if (!guardLicense('configure')) return null;
        const source = agents.find((agent) => agent.id === agentId);
        if (!source) return null;

        const copy: Agent = {
          ...source,
          id: `agent-${Date.now()}`,
          name: `${source.name}（副本）`,
          updatedAt: new Date(),
        };

        setAgents((current) => [copy, ...current]);
        return copy;
      },
      deleteAgent: (agentId) => {
        if (!guardLicense('configure')) return ;
        setAgents((current) => current.filter((agent) => agent.id !== agentId));
        setConversations((current) =>
          current.map((conversation) =>
            conversation.agentId === agentId
              ? {
                  ...conversation,
                  agentId: undefined,
                  agentType: undefined,
                  updatedAt: new Date(),
                }
              : conversation,
          ),
        );
      },
      createConversation: (workspaceType, title, agent) => {
        const conversation: Conversation = {
          id: `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          title,
          agentId: agent?.id,
          agentType: agent?.type,
          workspaceType,
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        setConversations((current) => [conversation, ...current]);
        setActiveConversationIds((current) => ({
          ...current,
          [workspaceType]: conversation.id,
        }));
        return conversation;
      },
      appendMessages: (conversationId, messages) => {
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  messages: [...conversation.messages, ...messages],
                  updatedAt: new Date(),
                }
              : conversation,
          ),
        );
      },
      updateMessage: (conversationId, messageId, updates) => {
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  messages: conversation.messages.map((message) =>
                    message.id === messageId
                      ? {
                          ...message,
                          ...updates,
                        }
                      : message,
                  ),
                  updatedAt: new Date(),
                }
              : conversation,
          ),
        );
      },
      replaceConversationMessages: (conversationId, messages) => {
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  messages,
                  updatedAt: new Date(),
                }
              : conversation,
          ),
        );
      },
      updateConversation: (conversationId, updates) => {
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  ...updates,
                  updatedAt: new Date(),
                }
              : conversation,
          ),
        );
      },
      deleteConversation: (conversationId) => {
        if (!guardLicense('configure')) return ;
        setConversations((current) =>
          current.filter((conversation) => conversation.id !== conversationId),
        );
        setActiveConversationIds((current) => {
          const next = { ...current };
          const affectedWorkspaceType = (Object.keys(next) as AgentType[]).find(
            (type) => next[type] === conversationId,
          );
          if (affectedWorkspaceType) {
            const fallbackConversation = conversations
              .filter(
                (conversation) =>
                  (conversation.workspaceType ?? conversation.agentType) === affectedWorkspaceType &&
                  conversation.id !== conversationId,
              )
              .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];

            next[affectedWorkspaceType] = fallbackConversation?.id ?? null;
          }
          return next;
        });
      },
      renameConversation: (conversationId, title) => {
        if (!guardLicense('configure')) return ;
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  title,
                  updatedAt: new Date(),
                }
              : conversation,
          ),
        );
      },
      getConversationsForWorkspace: (type) =>
        conversations
          .filter((conversation) => (conversation.workspaceType ?? conversation.agentType) === type)
          .sort((a, b) => {
            if (a.isDemo && b.isDemo) return (a.demoOrder ?? 0) - (b.demoOrder ?? 0);
            if (a.isDemo) return -1;
            if (b.isDemo) return 1;
            return b.updatedAt.getTime() - a.updatedAt.getTime();
          }),
      setActiveConversationForWorkspace: (type, conversationId) => {
        setActiveConversationIds((current) => ({
          ...current,
          [type]: conversationId,
        }));
      },
      updateSkill: (skillId, updates) => {
        if (!guardLicense('configure')) return ;
        setSkills((current) =>
          current.map((skill) =>
            skill.id === skillId
              ? {
                  ...skill,
                  ...updates,
                }
              : skill,
          ),
        );
      },
      addSkill: (skill) => {
        if (!guardLicense('configure')) return ;
        setSkills((current) => [skill, ...current]);
      },
      copySkill: (skillId) => {
        if (!guardLicense('configure')) return ;
        const source = skills.find((skill) => skill.id === skillId);
        if (!source) return;

        const copy: Skill = {
          ...source,
          id: `skill-${Date.now()}`,
          name: `${source.name}（副本）`,
          builtin: false,
          version: `draft-${Date.now().toString().slice(-4)}`,
          debugState: '待调试',
        };

        setSkills((current) => [copy, ...current]);
      },
      deleteSkill: (skillId) => {
        if (!guardLicense('configure')) return ;
        setSkills((current) => current.filter((skill) => skill.id !== skillId));
        setAgents((current) =>
          current.map((agent) => ({
            ...agent,
            skills: agent.skills.filter((item) => item !== skillId),
          })),
        );
      },
      addKnowledgeDocument: (document) => {
        if (!guardLicense('configure')) return ;
        setKnowledgeDocuments((current) => [document, ...current]);
      },
      updateKnowledgeDocument: (documentId, updates) => {
        if (!guardLicense('configure')) return ;
        setKnowledgeDocuments((current) =>
          current.map((document) =>
            document.id === documentId
              ? {
                  ...document,
                  ...updates,
                }
              : document,
          ),
        );
      },
      deleteKnowledgeDocument: (documentId) => {
        if (!guardLicense('configure')) return ;
        setKnowledgeDocuments((current) => current.filter((document) => document.id !== documentId));
        setAgents((current) =>
          current.map((agent) => ({
            ...agent,
            knowledgeConfig: agent.knowledgeConfig
              ? {
                  ...agent.knowledgeConfig,
                  knowledgeDocumentIds: agent.knowledgeConfig.knowledgeDocumentIds?.filter(
                    (id) => id !== documentId,
                  ),
                }
              : agent.knowledgeConfig,
          })),
        );
      },
      addReportTemplate: (template) => {
        if (!guardLicense('configure')) return ;
        setReportTemplates((current) => [template, ...current]);
      },
      updateReportTemplate: (templateId, updates) => {
        if (!guardLicense('configure')) return ;
        if (updates.status === 'disabled') {
          setDefaultTemplateBindings((current) => current.filter((binding) => binding.templateId !== templateId));
        }
        setReportTemplates((current) =>
          current.map((template) =>
            template.id === templateId
              ? {
                  ...template,
                  ...updates,
                }
              : template,
          ),
        );
      },
      deleteReportTemplate: (templateId) => {
        if (!guardLicense('configure')) return ;
        setReportTemplates((current) => current.filter((template) => template.id !== templateId));
        setDefaultTemplateBindings((current) => current.filter((binding) => binding.templateId !== templateId));
        setReportSubscriptions((current) =>
          current.map((subscription) =>
            subscription.reportTemplateId === templateId
              ? {
                  ...subscription,
                  status: 'needs_attention',
                  updatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
                }
              : subscription,
          ),
        );
      },
      addReportSubscription: (subscription) => {
        if (!guardLicense('manageSubscription')) return ;
        setReportSubscriptions((current) => [subscription, ...current]);
      },
      updateReportSubscription: (subscriptionId, updates) => {
        const onlyPausing = updates.status === 'paused' && Object.keys(updates).length === 1;
        if (!guardLicense(onlyPausing ? 'pauseSubscription' : 'manageSubscription')) return;
        if (updates.status === 'running') updates = { ...updates, licensePaused: false };
        setReportSubscriptions((current) =>
          current.map((subscription) =>
            subscription.id === subscriptionId
              ? {
                  ...subscription,
                  ...updates,
                  updatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
                }
              : subscription,
          ),
        );
      },
      deleteReportSubscription: (subscriptionId) => {
        if (!guardLicense('pauseSubscription')) return;
        setReportSubscriptions((current) =>
          current.map((subscription) =>
            subscription.id === subscriptionId
              ? {
                  ...subscription,
                  status: 'paused',
                  deletedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
                  updatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
                }
              : subscription,
          ),
        );
      },
      addSemanticDataset: (dataset) => {
        if (!guardLicense('configure')) return ;
        setSemanticDatasets((current) => [dataset, ...current]);
      },
      updateSemanticDataset: (datasetId, updates) => {
        if (!guardLicense('configure')) return ;
        setSemanticDatasets((current) =>
          current.map((dataset) =>
            dataset.id === datasetId
              ? {
                  ...dataset,
                  ...updates,
                }
              : dataset,
          ),
        );
      },
      deleteSemanticDataset: (datasetId) => {
        if (!guardLicense('configure')) return ;
        setSemanticDatasets((current) => current.filter((dataset) => dataset.id !== datasetId));
      },
      addIndicatorAssets: (indicators) => {
        if (!guardLicense('configure')) return ;
        if (!indicators.length) return;
        setIndicatorAssets((current) => [...indicators, ...current]);
      },
      updateIndicatorAsset: (indicatorId, updates) => {
        if (!guardLicense('configure')) return ;
        setIndicatorAssets((current) =>
          current.map((indicator) =>
            indicator.id === indicatorId
              ? {
                  ...indicator,
                  ...updates,
                  updatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
                }
              : indicator,
          ),
        );
      },
      deleteIndicatorAsset: (indicatorId) => {
        if (!guardLicense('configure')) return ;
        setIndicatorAssets((current) => current.filter((indicator) => indicator.id !== indicatorId));
      },
      addDimensionSemantic: (dimension) => {
        if (!guardLicense('configure')) return ;
        setDimensionSemantics((current) => [dimension, ...current]);
      },
      updateDimensionSemantic: (dimensionId, updates) => {
        if (!guardLicense('configure')) return ;
        setDimensionSemantics((current) =>
          current.map((dimension) =>
            dimension.id === dimensionId
              ? {
                  ...dimension,
                  ...updates,
                }
              : dimension,
          ),
        );
      },
      deleteDimensionSemantic: (dimensionId) => {
        if (!guardLicense('configure')) return ;
        setDimensionSemantics((current) => current.filter((dimension) => dimension.id !== dimensionId));
        setDimensionMembers((current) => current.filter((member) => member.dimensionId !== dimensionId));
      },
      addDimensionMember: (member) => {
        if (!guardLicense('configure')) return ;
        setDimensionMembers((current) => [member, ...current]);
      },
      updateDimensionMember: (memberId, updates) => {
        if (!guardLicense('configure')) return ;
        setDimensionMembers((current) =>
          current.map((member) =>
            member.id === memberId
              ? {
                  ...member,
                  ...updates,
                }
              : member,
          ),
        );
      },
      deleteDimensionMember: (memberId) => {
        if (!guardLicense('configure')) return ;
        setDimensionMembers((current) => current.filter((member) => member.id !== memberId));
      },
      addDatabaseConnection: (connection) => {
        if (!guardLicense('configure')) return ;
        setDatabaseConnections((current) => [connection, ...current]);
      },
      updateDatabaseConnection: (connectionId, updates) => {
        if (!guardLicense('configure')) return ;
        const previousConnection = databaseConnections.find((connection) => connection.id === connectionId);
        setDatabaseConnections((current) =>
          current.map((connection) =>
            connection.id === connectionId
              ? {
                  ...connection,
                  ...updates,
                }
              : connection,
          ),
        );
        if (previousConnection?.name && updates.name && previousConnection.name !== updates.name) {
          setSemanticDatasets((current) =>
            current.map((dataset) =>
              dataset.sourceName === previousConnection.name
                ? {
                    ...dataset,
                    sourceName: updates.name,
                  }
                : dataset,
            ),
          );
        }
      },
      deleteDatabaseConnection: (connectionId) => {
        if (!guardLicense('configure')) return ;
        setDatabaseConnections((current) =>
          current.filter((connection) => connection.id !== connectionId),
        );
      },
      getCapabilitiesForAgent: (agentId) =>
        mcpServers.flatMap((server) =>
          server.capabilities.filter((capability) => capability.agentIds.includes(agentId)),
        ),
      getServersForAgent: (agentId) =>
        mcpServers.filter((server) =>
          server.capabilities.some((capability) => capability.agentIds.includes(agentId)),
        ),
      updateMcpServer: (serverId, updater) => {
        if (!guardLicense('configure')) return ;
        setMcpServers((current) =>
          current.map((server) => (server.id === serverId ? updater(server) : server)),
        );
      },
      addMcpServer: (server) => {
        if (!guardLicense('configure')) return ;
        setMcpServers((current) => [server, ...current]);
      },
      updateDefaultTemplateBinding: (industry, templateId) => {
        if (!guardLicense('configure')) return ;
        setDefaultTemplateBindings((current) => {
          const updatedAt = new Date().toLocaleString('zh-CN', { hour12: false });
          const existing = current.find((binding) => binding.industry === industry);
          if (!templateId) {
            return existing ? current.filter((binding) => binding.id !== existing.id) : current;
          }
          if (existing) {
            return current.map((binding) => binding.id === existing.id ? { ...binding, templateId, updatedAt } : binding);
          }
          return [...current, { id: `default-binding-${industry}`, industry, templateId, updatedAt }];
        });
      },
      deleteMcpServer: (serverId) => {
        if (!guardLicense('configure')) return ;
        setMcpServers((current) => current.filter((server) => server.id !== serverId));
      },
      updateMcpCapability: (capabilityId, updater) => {
        if (!guardLicense('configure')) return ;
        setMcpServers((current) =>
          current.map((server) => ({
            ...server,
            capabilities: server.capabilities.map((capability) =>
              capability.id === capabilityId ? updater(capability) : capability,
            ),
          })),
        );
      },
      setMcpCapabilityAgentBinding: (capabilityId, agentId, enabled) => {
        if (!guardLicense('configure')) return ;
        setMcpServers((current) =>
          current.map((server) => ({
            ...server,
            capabilities: server.capabilities.map((capability) => {
              if (capability.id !== capabilityId) return capability;
              const hasAgent = capability.agentIds.includes(agentId);
              return {
                ...capability,
                agentIds: enabled
                  ? hasAgent
                    ? capability.agentIds
                    : [...capability.agentIds, agentId]
                  : capability.agentIds.filter((id) => id !== agentId),
              };
            }),
          })),
        );
      },
      setMcpCapabilitySkillBinding: (capabilityId, skillId, enabled) => {
        if (!guardLicense('configure')) return ;
        setMcpServers((current) =>
          current.map((server) => ({
            ...server,
            capabilities: server.capabilities.map((capability) => {
              if (capability.id !== capabilityId) return capability;
              const hasSkill = capability.skillIds.includes(skillId);
              return {
                ...capability,
                skillIds: enabled
                  ? hasSkill
                    ? capability.skillIds
                    : [...capability.skillIds, skillId]
                  : capability.skillIds.filter((id) => id !== skillId),
              };
            }),
          })),
        );
      },
      bulkSetMcpServerAgentBinding: (serverId, agentId, enabled) => {
        if (!guardLicense('configure')) return ;
        setMcpServers((current) =>
          current.map((server) =>
            server.id === serverId
              ? {
                  ...server,
                  capabilities: server.capabilities.map((capability) => {
                    const hasAgent = capability.agentIds.includes(agentId);
                    return {
                      ...capability,
                      agentIds: enabled
                        ? hasAgent
                          ? capability.agentIds
                          : [...capability.agentIds, agentId]
                        : capability.agentIds.filter((id) => id !== agentId),
                    };
                  }),
                }
              : server,
          ),
        );
      },
      setAgentMcpCapabilityBindings: (agentId, capabilityIds) => {
        if (!guardLicense('configure')) return ;
        const nextCapabilityIds = new Set(capabilityIds);
        setMcpServers((current) =>
          current.map((server) => ({
            ...server,
            capabilities: server.capabilities.map((capability) => {
              const shouldBind = nextCapabilityIds.has(capability.id);
              const hasAgent = capability.agentIds.includes(agentId);
              return {
                ...capability,
                agentIds: shouldBind
                  ? hasAgent
                    ? capability.agentIds
                    : [...capability.agentIds, agentId]
                  : capability.agentIds.filter((id) => id !== agentId),
              };
            }),
          })),
        );
      },
    }),
    [
      activeConversationIds,
      agents,
      conversations,
      databaseConnections,
      indicatorAssets,
      knowledgeBases,
      knowledgeDocuments,
      dimensionMembers,
      dimensionSemantics,
      metricSemantics,
      mcpServers,
      reportTemplates,
      defaultTemplateBindings,
      reportSubscriptions,
      semanticDatasets,
      skills,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error('useWorkspace must be used inside WorkspaceProvider');
  }

  return context;
}
