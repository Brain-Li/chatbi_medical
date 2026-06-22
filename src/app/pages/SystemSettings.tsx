import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  Bot,
  BrainCircuit,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Database,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Mail,
  Network,
  PencilLine,
  Plus,
  RotateCcw,
  Settings2,
  Shapes,
  Sparkles,
  Star,
  Tags,
  Trash2,
  User,
  X,
  FileCode2,
} from 'lucide-react';
import { llmConnections } from '../mockData';
import { useWorkspace } from '../context/WorkspaceContext';
import { AgentType, DatabaseConnection, KnowledgeDocument, LlmConnection, Skill } from '../types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { ConfigActionIconButton } from '../components/ConfigActionIconButton';
import McpAccessManagement from './McpAccessManagement';
import IndicatorMarket from './IndicatorMarket';
import SemanticModel from './SemanticModel';

type SettingsSection =
  | 'agents'
  | 'skills'
  | 'knowledge'
  | 'datasets'
  | 'dimensions'
  | 'indicators'
  | 'synonyms'
  | 'database'
  | 'llm'
  | 'mcp'
  | 'system';

const sectionIds: SettingsSection[] = [
  'agents',
  'skills',
  'mcp',
  'knowledge',
  'datasets',
  'dimensions',
  'indicators',
  'synonyms',
  'database',
  'llm',
  'system',
];

function isSettingsSection(value: string | null): value is SettingsSection {
  return sectionIds.includes(value as SettingsSection);
}

const sectionGroups: Array<{
  title: string;
  items: Array<{ id: SettingsSection; label: string; icon: typeof Bot; systemTab?: SystemSettingsTab }>;
}> = [
  {
    title: '能力配置',
    items: [
      { id: 'agents', label: 'Agent 管理', icon: Bot },
      { id: 'skills', label: 'Skill 管理', icon: Sparkles },
      { id: 'mcp', label: 'MCP 接入', icon: Network },
      { id: 'knowledge', label: '知识库管理', icon: FileText },
    ],
  },
  {
    title: '语义资产',
    items: [
      { id: 'datasets', label: '数据集', icon: Database },
      { id: 'dimensions', label: '维度定义', icon: Shapes },
      { id: 'indicators', label: '指标市场', icon: Star },
      { id: 'synonyms', label: '同义词治理', icon: Tags },
    ],
  },
  {
    title: '平台接入',
    items: [
      { id: 'database', label: '数据库管理', icon: Database },
      { id: 'llm', label: '大模型管理', icon: BrainCircuit },
    ],
  },
  {
    title: '系统设置',
    items: [
      { id: 'system', label: '系统设置', icon: Settings2, systemTab: 'general' },
      { id: 'system', label: '邮件配置', icon: Mail, systemTab: 'mail' },
      { id: 'system', label: 'AppToken 管理', icon: KeyRound, systemTab: 'appToken' },
    ],
  },
];

const agentTypeLabel = {
  ask: '问数 Agent',
  report: '报告 Agent',
  rca: '深度分析 Agent',
};

const configurableSkillAgentTypes: AgentType[] = ['ask', 'report'];

const enabledStatus = '已启用';

type SystemSettingsTab = 'general' | 'mail' | 'appToken';

const systemSettingsTabs: Array<{ id: SystemSettingsTab; label: string }> = [
  { id: 'general', label: '系统设置' },
  { id: 'mail', label: '邮件配置' },
  { id: 'appToken', label: 'AppToken 管理' },
];

const databaseDialogInputClass =
  'h-11 rounded-lg border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-none transition-colors placeholder:text-gray-400 hover:bg-white focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-100';

const databaseDialogLabelClass = 'text-sm font-medium text-gray-800';
const systemSettingsCardClass = 'rounded-xl border border-gray-200 p-6';
const systemSettingsSectionTitleClass = 'text-base font-semibold text-blue-600';
const systemSettingsFieldLabelClass = 'text-sm font-medium text-gray-700';
const systemSettingsHelperTextClass = 'text-sm leading-6 text-gray-500';
const systemSettingsSecondaryButtonClass =
  'rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700';
const systemSettingsPrimaryButtonClass = 'rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white';
const systemSettingsDangerButtonClass =
  'rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-500';

const agentPageSize = 10;
const skillPageSize = 10;
const knowledgePageSize = 10;
const databasePageSize = 10;
const llmPageSize = 10;

type DatabaseConnectionForm = {
  name: string;
  type: string;
  jdbcUrl: string;
  username: string;
  password: string;
  databaseName: string;
  admins: string;
  users: string;
  description: string;
};

type SkillForm = {
  name: string;
  scene: string;
  description: string;
  triggerPhrases: string;
  skillMarkdown: string;
  applicableAgentTypes: AgentType[];
  status: Skill['status'];
};

type KnowledgeDocumentForm = {
  title: string;
  type: KnowledgeDocument['type'];
  applicableScenes: string;
  fileName: string;
  filePreviewUrl: string;
  fileMimeType: string;
};

const emptySkillForm: SkillForm = {
  name: '',
  scene: '',
  description: '',
  triggerPhrases: '',
  skillMarkdown: '',
  applicableAgentTypes: ['ask'],
  status: '已启用',
};

const emptyKnowledgeDocumentForm: KnowledgeDocumentForm = {
  title: '',
  type: '统计口径',
  applicableScenes: '',
  fileName: '',
  filePreviewUrl: '',
  fileMimeType: '',
};

const emptyDatabaseConnectionForm: DatabaseConnectionForm = {
  name: '',
  type: 'PostgreSQL',
  jdbcUrl: '',
  username: '',
  password: '',
  databaseName: '',
  admins: '',
  users: '',
  description: '',
};

const databaseTypeOptions = ['PostgreSQL', 'MySQL', 'SQL Server', 'Oracle', 'ClickHouse'];
const knowledgeDocumentTypeOptions: KnowledgeDocument['type'][] = [
  '指标口径',
  '业务规则',
  '政策说明',
  '统计口径',
  '权限规则',
];

type LlmConnectionForm = {
  connectionName: string;
  protocol: string;
  baseUrl: string;
  apiKey: string;
  modelName: string;
  apiVersion: string;
  temperature: string;
  timeoutSeconds: string;
  description: string;
};

type ManagedLlmConnection = LlmConnection & {
  protocol: string;
  baseUrl: string;
  apiKey: string;
  apiVersion: string;
  temperature: number;
  timeoutSeconds: number;
};

const emptyLlmConnectionForm: LlmConnectionForm = {
  connectionName: '',
  protocol: 'OPEN_AI',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  modelName: '',
  apiVersion: '2024-02-01',
  temperature: '0',
  timeoutSeconds: '60',
  description: '',
};

const llmProtocolOptions = ['OPEN_AI', 'HTTP'];

const createManagedLlmConnection = (connection: LlmConnection): ManagedLlmConnection => ({
  ...connection,
  protocol: connection.version,
  baseUrl: connection.version === 'HTTP' ? '' : 'https://api.openai.com/v1',
  apiKey: 'demo-api-key',
  apiVersion: '2024-02-01',
  temperature: 0,
  timeoutSeconds: 60,
});

const userOptions = ['admin', 'jack', 'tom', 'lucy', 'alice', 'liyijie', 'liyue', 'lxy', 'user'];

const splitUserList = (value: string) =>
  value
    .split(/[,\n，、]/)
    .map((item) => item.trim())
    .filter(Boolean);

const splitSkillList = (value: string) =>
  value
    .split(/[,\n/、，]/)
    .map((item) => item.trim())
    .filter(Boolean);

const formatDateTime = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
};

export default function SystemSettings() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    agents,
    skills,
    semanticDatasets,
    knowledgeBases,
    knowledgeDocuments,
    databaseConnections,
    getCapabilitiesForAgent,
    addDatabaseConnection,
    updateDatabaseConnection,
    updateAgent,
    copyAgent,
    deleteAgent,
    addSkill,
    updateSkill,
    copySkill,
    deleteSkill,
    addKnowledgeDocument,
    updateKnowledgeDocument,
    deleteKnowledgeDocument,
    deleteDatabaseConnection,
  } = useWorkspace();
  const [agentPendingDeleteId, setAgentPendingDeleteId] = useState<string | null>(null);
  const [skillPendingDeleteId, setSkillPendingDeleteId] = useState<string | null>(null);
  const [knowledgeDocumentPendingDeleteId, setKnowledgeDocumentPendingDeleteId] = useState<string | null>(null);
  const [databasePendingDeleteId, setDatabasePendingDeleteId] = useState<number | null>(null);
  const [llmPendingDeleteId, setLlmPendingDeleteId] = useState<number | null>(null);
  const [isDatabaseDialogOpen, setIsDatabaseDialogOpen] = useState(false);
  const [isSkillDialogOpen, setIsSkillDialogOpen] = useState(false);
  const [isKnowledgeDocumentDialogOpen, setIsKnowledgeDocumentDialogOpen] = useState(false);
  const [isLlmDialogOpen, setIsLlmDialogOpen] = useState(false);
  const [editingDatabaseId, setEditingDatabaseId] = useState<number | null>(null);
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [editingKnowledgeDocumentId, setEditingKnowledgeDocumentId] = useState<string | null>(null);
  const [viewingKnowledgeDocumentId, setViewingKnowledgeDocumentId] = useState<string | null>(null);
  const [editingLlmId, setEditingLlmId] = useState<number | null>(null);
  const [showDatabasePassword, setShowDatabasePassword] = useState(false);
  const [showLlmApiKey, setShowLlmApiKey] = useState(false);
  const [agentPage, setAgentPage] = useState(1);
  const [skillPage, setSkillPage] = useState(1);
  const [knowledgePage, setKnowledgePage] = useState(1);
  const [databasePage, setDatabasePage] = useState(1);
  const [llmPage, setLlmPage] = useState(1);
  const [systemSettingsTab, setSystemSettingsTab] = useState<SystemSettingsTab>('general');
  const [databaseForm, setDatabaseForm] =
    useState<DatabaseConnectionForm>(emptyDatabaseConnectionForm);
  const [skillForm, setSkillForm] = useState<SkillForm>(emptySkillForm);
  const [knowledgeDocumentForm, setKnowledgeDocumentForm] =
    useState<KnowledgeDocumentForm>(emptyKnowledgeDocumentForm);
  const [llmItems, setLlmItems] = useState<ManagedLlmConnection[]>(
    llmConnections.map(createManagedLlmConnection),
  );
  const [llmForm, setLlmForm] = useState<LlmConnectionForm>(emptyLlmConnectionForm);

  const searchParams = new URLSearchParams(location.search);
  const sectionParam = searchParams.get('section');
  const systemTabParam = searchParams.get('systemTab');
  const activeSection: SettingsSection = isSettingsSection(sectionParam) ? sectionParam : 'agents';
  const selectedDatasetId = searchParams.get('datasetId');
  const selectedIndicatorId = searchParams.get('indicatorId');

  const pendingDeleteAgent = agents.find((agent) => agent.id === agentPendingDeleteId) ?? null;
  const pendingDeleteSkill = skills.find((skill) => skill.id === skillPendingDeleteId) ?? null;
  const pendingDeleteKnowledgeDocument =
    knowledgeDocuments.find((document) => document.id === knowledgeDocumentPendingDeleteId) ?? null;
  const viewingKnowledgeDocument =
    knowledgeDocuments.find((document) => document.id === viewingKnowledgeDocumentId) ?? null;
  const pendingDeleteDatabase =
    databaseConnections.find((connection) => connection.id === databasePendingDeleteId) ?? null;
  const pendingDeleteLlm = llmItems.find((connection) => connection.id === llmPendingDeleteId) ?? null;

  const databaseDeleteBlockers = useMemo(() => {
    if (!pendingDeleteDatabase) return [];
    return semanticDatasets
      .filter((dataset) => dataset.sourceName === pendingDeleteDatabase.name)
      .map((dataset) => dataset.name);
  }, [pendingDeleteDatabase, semanticDatasets]);

  const agentTotalPages = Math.max(1, Math.ceil(agents.length / agentPageSize));
  const paginatedAgents = useMemo(() => {
    const start = (agentPage - 1) * agentPageSize;
    return agents.slice(start, start + agentPageSize);
  }, [agentPage, agents]);
  const skillTotalPages = Math.max(1, Math.ceil(skills.length / skillPageSize));
  const paginatedSkills = useMemo(() => {
    const start = (skillPage - 1) * skillPageSize;
    return skills.slice(start, start + skillPageSize);
  }, [skillPage, skills]);
  const knowledgeTotalPages = Math.max(1, Math.ceil(knowledgeDocuments.length / knowledgePageSize));
  const paginatedKnowledgeDocuments = useMemo(() => {
    const start = (knowledgePage - 1) * knowledgePageSize;
    return knowledgeDocuments.slice(start, start + knowledgePageSize);
  }, [knowledgeDocuments, knowledgePage]);
  const databaseTotalPages = Math.max(1, Math.ceil(databaseConnections.length / databasePageSize));
  const paginatedDatabaseConnections = useMemo(() => {
    const start = (databasePage - 1) * databasePageSize;
    return databaseConnections.slice(start, start + databasePageSize);
  }, [databaseConnections, databasePage]);
  const llmTotalPages = Math.max(1, Math.ceil(llmItems.length / llmPageSize));
  const paginatedLlmItems = useMemo(() => {
    const start = (llmPage - 1) * llmPageSize;
    return llmItems.slice(start, start + llmPageSize);
  }, [llmItems, llmPage]);

  useEffect(() => {
    if (!sectionParam || !isSettingsSection(sectionParam)) {
      navigate('/settings?section=agents', { replace: true });
    }
  }, [navigate, sectionParam]);

  useEffect(() => {
    setAgentPage((current) => Math.min(current, agentTotalPages));
  }, [agentTotalPages]);

  useEffect(() => {
    setSkillPage((current) => Math.min(current, skillTotalPages));
  }, [skillTotalPages]);

  useEffect(() => {
    setKnowledgePage((current) => Math.min(current, knowledgeTotalPages));
  }, [knowledgeTotalPages]);

  useEffect(() => {
    setDatabasePage((current) => Math.min(current, databaseTotalPages));
  }, [databaseTotalPages]);

  useEffect(() => {
    setLlmPage((current) => Math.min(current, llmTotalPages));
  }, [llmTotalPages]);

  useEffect(() => {
    if (activeSection !== 'system') return;
    if (systemTabParam === 'general' || systemTabParam === 'mail' || systemTabParam === 'appToken') {
      setSystemSettingsTab(systemTabParam);
      return;
    }
    setSystemSettingsTab('general');
  }, [activeSection, systemTabParam]);

  const openSection = (section: SettingsSection, systemTab?: SystemSettingsTab) => {
    if (section === 'system') {
      const params = new URLSearchParams({ section: 'system' });
      if (systemTab) params.set('systemTab', systemTab);
      navigate(`/settings?${params.toString()}`);
      return;
    }
    navigate(`/settings?section=${section}`);
  };

  const datasetName = (datasetId: string) =>
    semanticDatasets.find((dataset) => dataset.id === datasetId)?.name ?? datasetId;

  const systemAdminUsers = ['admin', 'liyijie', 'test-z', 'test-zd', 'auto_test', 'liusy', 'liusy_test'];
  const systemConfigMenu = ['向量数据库配置', '嵌入模型配置', '语音识别配置', '语义解析配置', '语义翻译配置'];
  const activeSystemConfigMenu = '向量数据库配置';
  const appTokenRows = [
    {
      name: '辅助决策系统',
      creator: 'admin',
      createdAt: '2026-03-05 14:35:27',
      status: '有效',
      expiresAt: '2027-03-05 14:35:27',
      token: 'eyJhbGci...TuV8qoNw',
    },
    {
      name: '机器人',
      creator: 'admin',
      createdAt: '2026-03-05 17:02:02',
      status: '有效',
      expiresAt: '2126-02-09 17:02:02',
      token: 'eyJhbGci...0FZ960Iw',
    },
    {
      name: '测试',
      creator: 'admin',
      createdAt: '2026-03-06 16:44:06',
      status: '已过期',
      expiresAt: '2026-04-05 16:44:06',
      token: 'eyJhbGci...HNjN8mew',
    },
  ];

  const renderSectionShell = (children: React.ReactNode) => (
    <div className="space-y-6">{children}</div>
  );

  const renderStaticSelect = (value: string) => (
    <div className="flex h-11 items-center justify-between rounded-lg border border-gray-200 px-4 text-sm text-gray-700">
      <span>{value}</span>
      <ChevronDown className="h-4 w-4 text-gray-400" />
    </div>
  );

  const updateDatabaseForm = (field: keyof DatabaseConnectionForm, value: string) => {
    setDatabaseForm((current) => ({ ...current, [field]: value }));
  };

  const updateSkillForm = (field: keyof SkillForm, value: SkillForm[keyof SkillForm]) => {
    setSkillForm((current) => ({ ...current, [field]: value }));
  };

  const updateKnowledgeDocumentForm = (
    field: keyof KnowledgeDocumentForm,
    value: KnowledgeDocumentForm[keyof KnowledgeDocumentForm],
  ) => {
    setKnowledgeDocumentForm((current) => ({ ...current, [field]: value }));
  };

  const updateLlmForm = (field: keyof LlmConnectionForm, value: string) => {
    setLlmForm((current) => ({ ...current, [field]: value }));
  };

  const openCreateDatabaseDialog = () => {
    setEditingDatabaseId(null);
    setDatabaseForm(emptyDatabaseConnectionForm);
    setShowDatabasePassword(false);
    setIsDatabaseDialogOpen(true);
  };

  const openCreateSkillDialog = () => {
    setEditingSkillId(null);
    setSkillForm(emptySkillForm);
    setIsSkillDialogOpen(true);
  };

  const openCreateKnowledgeDocumentDialog = () => {
    setEditingKnowledgeDocumentId(null);
    setKnowledgeDocumentForm(emptyKnowledgeDocumentForm);
    setIsKnowledgeDocumentDialogOpen(true);
  };

  const openCreateLlmDialog = () => {
    setEditingLlmId(null);
    setLlmForm(emptyLlmConnectionForm);
    setShowLlmApiKey(false);
    setIsLlmDialogOpen(true);
  };

  const openEditDatabaseDialog = (connection: DatabaseConnection) => {
    setEditingDatabaseId(connection.id);
    setDatabaseForm({
      name: connection.name,
      type: connection.type,
      jdbcUrl: connection.jdbcUrl,
      username: connection.username,
      password: connection.password,
      databaseName: connection.databaseName,
      admins: connection.admins.join('、'),
      users: connection.users.join('、'),
      description: connection.description,
    });
    setShowDatabasePassword(false);
    setIsDatabaseDialogOpen(true);
  };

  const openEditSkillDialog = (skill: Skill) => {
    setEditingSkillId(skill.id);
    setSkillForm({
      name: skill.name,
      scene: skill.scene,
      description: skill.description,
      triggerPhrases: skill.triggerPhrases.join(' / '),
      skillMarkdown: skill.skillMarkdown,
      applicableAgentTypes: skill.applicableAgentTypes,
      status: skill.status,
    });
    setIsSkillDialogOpen(true);
  };

  const openEditKnowledgeDocumentDialog = (document: KnowledgeDocument) => {
    setEditingKnowledgeDocumentId(document.id);
    setKnowledgeDocumentForm({
      title: document.title,
      type: document.type,
      applicableScenes: document.applicableScenes.join('、'),
      fileName: document.fileName ?? document.source.split('/').pop()?.trim() ?? '',
      filePreviewUrl: document.filePreviewUrl ?? '',
      fileMimeType: document.fileMimeType ?? '',
    });
    setIsKnowledgeDocumentDialogOpen(true);
  };

  const openEditLlmDialog = (connection: ManagedLlmConnection) => {
    setEditingLlmId(connection.id);
    setLlmForm({
      connectionName: connection.connectionName,
      protocol: connection.protocol,
      baseUrl: connection.baseUrl,
      apiKey: connection.apiKey,
      modelName: connection.modelName,
      apiVersion: connection.apiVersion,
      temperature: String(connection.temperature),
      timeoutSeconds: String(connection.timeoutSeconds),
      description: connection.description,
    });
    setShowLlmApiKey(false);
    setIsLlmDialogOpen(true);
  };

  const closeDatabaseDialog = () => {
    setIsDatabaseDialogOpen(false);
    setEditingDatabaseId(null);
    setShowDatabasePassword(false);
    setDatabaseForm(emptyDatabaseConnectionForm);
  };

  const closeSkillDialog = () => {
    setIsSkillDialogOpen(false);
    setEditingSkillId(null);
    setSkillForm(emptySkillForm);
  };

  const closeKnowledgeDocumentDialog = () => {
    setIsKnowledgeDocumentDialogOpen(false);
    setEditingKnowledgeDocumentId(null);
    setKnowledgeDocumentForm(emptyKnowledgeDocumentForm);
  };

  const closeLlmDialog = () => {
    setIsLlmDialogOpen(false);
    setEditingLlmId(null);
    setShowLlmApiKey(false);
    setLlmForm(emptyLlmConnectionForm);
  };

  const submitDatabaseConnection = () => {
    const name = databaseForm.name.trim();
    const jdbcUrl = databaseForm.jdbcUrl.trim();
    const username = databaseForm.username.trim();
    const databaseName = databaseForm.databaseName.trim();

    if (!name || !jdbcUrl || !username || !databaseName) return;

    const updatedAt = formatDateTime(new Date());
    const updates = {
      name,
      type: databaseForm.type,
      jdbcUrl,
      username,
      password: databaseForm.password,
      databaseName,
      admins: splitUserList(databaseForm.admins),
      users: splitUserList(databaseForm.users),
      description: databaseForm.description.trim(),
      updatedAt,
    };

    if (editingDatabaseId) {
      updateDatabaseConnection(editingDatabaseId, updates);
    } else {
      addDatabaseConnection({
        id: Date.now(),
        ...updates,
        creator: username,
      });
    }
    closeDatabaseDialog();
  };

  const toggleSkillAgentType = (type: AgentType) => {
    setSkillForm((current) => {
      const selected = current.applicableAgentTypes.includes(type);
      const applicableAgentTypes = selected
        ? current.applicableAgentTypes.filter((item) => item !== type)
        : [...current.applicableAgentTypes, type];

      return {
        ...current,
        applicableAgentTypes: applicableAgentTypes.length ? applicableAgentTypes : current.applicableAgentTypes,
      };
    });
  };

  const submitSkill = () => {
    const name = skillForm.name.trim();
    const scene = skillForm.scene.trim();
    const description = skillForm.description.trim();
    const skillMarkdown = skillForm.skillMarkdown.trim();

    if (!name || !scene || !description || !skillMarkdown) return;

    const existingSkill = editingSkillId
      ? skills.find((skill) => skill.id === editingSkillId)
      : null;
    const updates: Omit<Skill, 'id'> = {
      name,
      scene,
      description,
      triggerPhrases: splitSkillList(skillForm.triggerPhrases),
      skillMarkdown,
      applicableAgentTypes: skillForm.applicableAgentTypes,
      builtin: existingSkill?.builtin ?? false,
      status: skillForm.status,
      version: existingSkill?.version ?? `draft-${Date.now().toString().slice(-4)}`,
      debugState: existingSkill?.debugState ?? '待调试',
      tags: existingSkill?.tags ?? [],
      metricIds: existingSkill?.metricIds,
      dimensionIds: existingSkill?.dimensionIds,
      analysisRules: existingSkill?.analysisRules ?? [],
      outputArtifacts: existingSkill?.outputArtifacts ?? [],
    };

    if (editingSkillId) {
      updateSkill(editingSkillId, updates);
    } else {
      addSkill({
        id: `skill-${Date.now()}`,
        ...updates,
      });
    }

    closeSkillDialog();
  };

  const submitKnowledgeDocument = () => {
    const title = knowledgeDocumentForm.title.trim();
    const fileName = knowledgeDocumentForm.fileName.trim();
    const knowledgeBaseId = knowledgeBases[0]?.id ?? 'kb-operational';

    if (!title || !fileName) return;

    const updates = {
      knowledgeBaseId,
      title,
      source: `本地上传 / ${fileName}`,
      type: knowledgeDocumentForm.type,
      updatedAt: new Date().toISOString().slice(0, 10),
      applicableScenes: splitSkillList(knowledgeDocumentForm.applicableScenes),
      tags: [],
      fileName,
      filePreviewUrl: knowledgeDocumentForm.filePreviewUrl,
      fileMimeType: knowledgeDocumentForm.fileMimeType,
    };

    if (editingKnowledgeDocumentId) {
      updateKnowledgeDocument(editingKnowledgeDocumentId, updates);
    } else {
      addKnowledgeDocument({
        id: `knowledge-doc-${Date.now()}`,
        ...updates,
      });
    }

    closeKnowledgeDocumentDialog();
  };

  const submitLlmConnection = () => {
    const connectionName = llmForm.connectionName.trim();
    const baseUrl = llmForm.baseUrl.trim();
    const apiKey = llmForm.apiKey.trim();
    const modelName = llmForm.modelName.trim();
    const apiVersion = llmForm.apiVersion.trim();

    if (!connectionName || !baseUrl || !apiKey || !modelName) return;

    const temperature = Number(llmForm.temperature);
    const timeoutSeconds = Number(llmForm.timeoutSeconds);
    const updates = {
      connectionName,
      modelName,
      version: llmForm.protocol,
      protocol: llmForm.protocol,
      baseUrl,
      apiKey,
      apiVersion,
      temperature: Number.isFinite(temperature) ? temperature : 0,
      timeoutSeconds: Number.isFinite(timeoutSeconds) ? timeoutSeconds : 60,
      description: llmForm.description.trim(),
      updatedAt: formatDateTime(new Date()),
    };

    if (editingLlmId) {
      setLlmItems((current) =>
        current.map((connection) =>
          connection.id === editingLlmId
            ? {
                ...connection,
                ...updates,
              }
            : connection,
        ),
      );
    } else {
      setLlmItems((current) => [
        {
          id: Date.now(),
          ...updates,
          creator: 'admin',
        },
        ...current,
      ]);
    }
    closeLlmDialog();
  };

  const renderAgentSection = () =>
    renderSectionShell(
      <>
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm">
          <div>
            <div className="text-lg font-semibold text-gray-900">Agent 管理</div>
            <div className="mt-1 text-sm text-gray-500">
              管理问数和报告 Agent，配置可访问的数据集、Skill、MCP 能力和知识文档。
            </div>
          </div>
          <button
            onClick={() => navigate('/assistant-editor')}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            新建 Agent
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-200 text-left text-sm text-gray-600">
                <th className="px-6 py-3">Agent 名称</th>
                <th className="px-6 py-3">类型</th>
                <th className="px-6 py-3">数据集</th>
                <th className="px-6 py-3">Skills</th>
                <th className="px-6 py-3">MCP能力</th>
                <th className="px-6 py-3">知识文档</th>
                <th className="px-6 py-3">状态</th>
                <th className="px-6 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedAgents.map((agent) => (
                <tr key={agent.id} className="text-sm text-gray-700 hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{agent.name}</div>
                    <div className="mt-1 max-w-sm truncate text-xs text-gray-400">{agent.description}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700">
                      {agentTypeLabel[agent.type]}
                    </span>
                  </td>
                  <td className="px-6 py-4 max-w-xs">
                    <div className="line-clamp-2">
                      {agent.datasetIds?.length ? agent.datasetIds.map(datasetName).join('、') : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4">{agent.skills.length} 个</td>
                  <td className="px-6 py-4">
                    {getCapabilitiesForAgent(agent.id).length} 个
                  </td>
                  <td className="px-6 py-4">
                    {agent.knowledgeConfig?.knowledgeDocumentIds?.length ?? knowledgeDocuments.length} 个
                  </td>
                  <td className="px-6 py-4">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={agent.status === enabledStatus}
                      onClick={() =>
                        updateAgent(agent.id, {
                          status: agent.status === enabledStatus ? '已停用' : enabledStatus,
                        })
                      }
                      className={`inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${
                        agent.status === enabledStatus
                          ? 'bg-blue-600 hover:bg-blue-700'
                          : 'bg-gray-300 hover:bg-gray-400'
                      }`}
                      title={agent.status === enabledStatus ? '点击停用' : '点击启用'}
                      aria-label={`${agent.name}当前${agent.status}，点击${
                        agent.status === enabledStatus ? '停用' : '启用'
                      }`}
                    >
                      <span
                        className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                          agent.status === enabledStatus ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 whitespace-nowrap">
                      <ConfigActionIconButton
                        onClick={() => navigate(`/assistant-editor/${agent.id}`)}
                        icon={PencilLine}
                        label="编辑"
                        variant="edit"
                      />
                      <ConfigActionIconButton
                        onClick={() => copyAgent(agent.id)}
                        icon={Copy}
                        label="复制"
                        variant="copy"
                      />
                      <ConfigActionIconButton
                        onClick={() => setAgentPendingDeleteId(agent.id)}
                        icon={Trash2}
                        label="删除"
                        variant="delete"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-1 pt-3 text-sm text-gray-500">
          <div>
            共 {agents.length} 条，每页 {agentPageSize} 条
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setAgentPage((page) => Math.max(1, page - 1))}
              disabled={agentPage === 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:border-gray-100 disabled:text-gray-300"
              aria-label="上一页"
              title="上一页"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: agentTotalPages }, (_, index) => index + 1).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setAgentPage(page)}
                className={`h-8 min-w-8 rounded-md border px-2 text-sm transition-colors ${
                  agentPage === page
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:text-blue-600'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAgentPage((page) => Math.min(agentTotalPages, page + 1))}
              disabled={agentPage === agentTotalPages}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:border-gray-100 disabled:text-gray-300"
              aria-label="下一页"
              title="下一页"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </>,
    );

  const renderSkillSection = () =>
    renderSectionShell(
      <>
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm">
          <div>
            <div className="text-lg font-semibold text-gray-900">Skill 管理</div>
            <div className="mt-1 text-sm text-gray-500">
              维护可被 Agent 调用的分析技能、触发词和适用场景。
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              onClick={openCreateSkillDialog}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              新建 Skill
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr className="border-b border-gray-200 text-left text-sm text-gray-600">
                    <th className="px-6 py-3">Skill 名称</th>
                    <th className="px-6 py-3">场景</th>
                    <th className="px-6 py-3">适用 Agent</th>
                    <th className="px-6 py-3">触发词</th>
                    <th className="px-6 py-3">状态</th>
                    <th className="px-6 py-3">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedSkills.map((skill) => (
                    <tr key={skill.id} className="text-sm text-gray-700 hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{skill.name}</div>
                        <div className="mt-1 max-w-sm truncate text-xs text-gray-400">{skill.description}</div>
                      </td>
                      <td className="px-6 py-4">{skill.scene}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {skill.applicableAgentTypes.map((type) => (
                            <span key={type} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                              {agentTypeLabel[type]}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        <div className="line-clamp-2">
                          {skill.triggerPhrases.length ? skill.triggerPhrases.join(' / ') : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={skill.status === enabledStatus}
                          onClick={() =>
                            updateSkill(skill.id, {
                              status: skill.status === enabledStatus ? '已停用' : enabledStatus,
                            })
                          }
                          className={`inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${
                            skill.status === enabledStatus
                              ? 'bg-blue-600 hover:bg-blue-700'
                              : 'bg-gray-300 hover:bg-gray-400'
                          }`}
                          title={skill.status === enabledStatus ? '点击停用' : '点击启用'}
                          aria-label={`${skill.name}当前${skill.status}，点击${
                            skill.status === enabledStatus ? '停用' : '启用'
                          }`}
                        >
                          <span
                            className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                              skill.status === enabledStatus ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          <ConfigActionIconButton
                            onClick={() => openEditSkillDialog(skill)}
                            icon={PencilLine}
                            label="编辑"
                            variant="edit"
                          />
                          <ConfigActionIconButton
                            onClick={() => copySkill(skill.id)}
                            icon={Copy}
                            label="复制"
                            variant="copy"
                          />
                          <ConfigActionIconButton
                            onClick={() => setSkillPendingDeleteId(skill.id)}
                            icon={Trash2}
                            label="删除"
                            variant="delete"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-1 pt-3 text-sm text-gray-500">
              <div>
                共 {skills.length} 条，每页 {skillPageSize} 条
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSkillPage((page) => Math.max(1, page - 1))}
                  disabled={skillPage === 1}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:border-gray-100 disabled:text-gray-300"
                  aria-label="上一页"
                  title="上一页"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: skillTotalPages }, (_, index) => index + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setSkillPage(page)}
                    className={`h-8 min-w-8 rounded-md border px-2 text-sm transition-colors ${
                      skillPage === page
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:text-blue-600'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSkillPage((page) => Math.min(skillTotalPages, page + 1))}
                  disabled={skillPage === skillTotalPages}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:border-gray-100 disabled:text-gray-300"
                  aria-label="下一页"
                  title="下一页"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
      </>,
    );

  const renderKnowledgeSection = () =>
    renderSectionShell(
      <>
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm">
          <div>
            <div className="text-lg font-semibold text-gray-900">知识库管理</div>
            <div className="mt-1 text-sm text-gray-500">
              上传并管理 Agent 可检索的知识文档。
            </div>
          </div>
          <button
            type="button"
            onClick={openCreateKnowledgeDocumentDialog}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            上传文档
          </button>
        </div>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-200 text-left text-sm text-gray-600">
                <th className="px-6 py-3">文档名称</th>
                <th className="px-6 py-3">类型</th>
                <th className="px-6 py-3">适用场景</th>
                <th className="px-6 py-3">更新时间</th>
                <th className="px-6 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedKnowledgeDocuments.map((document) => (
                <tr key={document.id} className="text-sm text-gray-700 hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{document.title}</td>
                  <td className="px-6 py-4">{document.type}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {document.applicableScenes.length ? (
                        document.applicableScenes.map((scene) => (
                          <span key={scene} className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                            {scene}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">{document.updatedAt}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 whitespace-nowrap">
                      <ConfigActionIconButton
                        onClick={() => setViewingKnowledgeDocumentId(document.id)}
                        icon={Eye}
                        label="查看"
                        variant="neutral"
                      />
                      <ConfigActionIconButton
                        onClick={() => openEditKnowledgeDocumentDialog(document)}
                        icon={PencilLine}
                        label="编辑"
                        variant="edit"
                      />
                      <ConfigActionIconButton
                        onClick={() => setKnowledgeDocumentPendingDeleteId(document.id)}
                        icon={Trash2}
                        label="删除"
                        variant="delete"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-1 pt-3 text-sm text-gray-500">
          <div>
            共 {knowledgeDocuments.length} 条，每页 {knowledgePageSize} 条
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setKnowledgePage((page) => Math.max(1, page - 1))}
              disabled={knowledgePage === 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:border-gray-100 disabled:text-gray-300"
              aria-label="上一页"
              title="上一页"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: knowledgeTotalPages }, (_, index) => index + 1).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setKnowledgePage(page)}
                className={`h-8 min-w-8 rounded-md border px-2 text-sm transition-colors ${
                  knowledgePage === page
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:text-blue-600'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setKnowledgePage((page) => Math.min(knowledgeTotalPages, page + 1))}
              disabled={knowledgePage === knowledgeTotalPages}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:border-gray-100 disabled:text-gray-300"
              aria-label="下一页"
              title="下一页"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </>,
    );

  const renderDatabaseSection = () =>
    renderSectionShell(
      <>
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm">
          <div>
            <div className="text-lg font-semibold text-gray-900">数据库管理</div>
            <div className="mt-1 text-sm text-gray-500">
              集中管理数据源连接与访问权限。
            </div>
          </div>
          <button
            onClick={openCreateDatabaseDialog}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            新建数据库连接
          </button>
        </div>
        <ConnectionTable
          connections={paginatedDatabaseConnections}
          onEdit={openEditDatabaseDialog}
          onDelete={(connection) => setDatabasePendingDeleteId(connection.id)}
        />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-1 pt-3 text-sm text-gray-500">
          <div>
            共 {databaseConnections.length} 条，每页 {databasePageSize} 条
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setDatabasePage((page) => Math.max(1, page - 1))}
              disabled={databasePage === 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:border-gray-100 disabled:text-gray-300"
              aria-label="上一页"
              title="上一页"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: databaseTotalPages }, (_, index) => index + 1).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setDatabasePage(page)}
                className={`h-8 min-w-8 rounded-md border px-2 text-sm transition-colors ${
                  databasePage === page
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:text-blue-600'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setDatabasePage((page) => Math.min(databaseTotalPages, page + 1))}
              disabled={databasePage === databaseTotalPages}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:border-gray-100 disabled:text-gray-300"
              aria-label="下一页"
              title="下一页"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </>,
    );

  const renderLlmSection = () =>
    renderSectionShell(
      <>
        <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm">
          <div>
            <div className="text-lg font-semibold text-gray-900">大模型管理</div>
            <div className="mt-1 text-sm text-gray-500">
              管理平台内可用的大模型服务连接，用于 Agent 问答和报告生成。
            </div>
          </div>
          <button
            type="button"
            onClick={openCreateLlmDialog}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            创建大模型连接
          </button>
        </div>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-200 text-left text-sm text-gray-600">
                <th className="px-6 py-3">连接名称</th>
                <th className="px-6 py-3">模型名称</th>
                <th className="px-6 py-3">版本</th>
                <th className="px-6 py-3">创建人</th>
                <th className="px-6 py-3">描述</th>
                <th className="px-6 py-3">更新时间</th>
                <th className="px-6 py-3">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedLlmItems.map((item) => (
                <tr key={item.id} className="text-sm text-gray-700 hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900">{item.connectionName}</td>
                  <td className="px-6 py-4">{item.modelName}</td>
                  <td className="px-6 py-4">{item.version}</td>
                  <td className="px-6 py-4">{item.creator}</td>
                  <td className="max-w-xs truncate px-6 py-4 text-gray-500" title={item.description}>
                    {item.description || '-'}
                  </td>
                  <td className="px-6 py-4">{item.updatedAt}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 whitespace-nowrap">
                      <ConfigActionIconButton
                        onClick={() => openEditLlmDialog(item)}
                        icon={PencilLine}
                        label="编辑"
                        variant="edit"
                      />
                      <ConfigActionIconButton
                        onClick={() => setLlmPendingDeleteId(item.id)}
                        icon={Trash2}
                        label="删除"
                        variant="delete"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-1 pt-3 text-sm text-gray-500">
          <div>
            共 {llmItems.length} 条，每页 {llmPageSize} 条
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setLlmPage((page) => Math.max(1, page - 1))}
              disabled={llmPage === 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:border-gray-100 disabled:text-gray-300"
              aria-label="上一页"
              title="上一页"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: llmTotalPages }, (_, index) => index + 1).map((page) => (
              <button
                key={page}
                type="button"
                onClick={() => setLlmPage(page)}
                className={`h-8 min-w-8 rounded-md border px-2 text-sm transition-colors ${
                  llmPage === page
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:text-blue-600'
                }`}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setLlmPage((page) => Math.min(llmTotalPages, page + 1))}
              disabled={llmPage === llmTotalPages}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:border-gray-100 disabled:text-gray-300"
              aria-label="下一页"
              title="下一页"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </>,
    );

  const renderSystemSection = () =>
    renderSectionShell(
      <div className="space-y-5">
        <div className="rounded-xl border border-gray-200 bg-white px-7 py-7 shadow-sm">
          {systemSettingsTab === 'general' && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-lg font-semibold text-gray-900">系统设置</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className={systemSettingsDangerButtonClass}
                    >
                      重置
                    </button>
                    <button
                      type="button"
                      className={systemSettingsSecondaryButtonClass}
                    >
                      重新加载
                    </button>
                    <button
                      type="button"
                      className={systemSettingsPrimaryButtonClass}
                    >
                      保存
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-semibold text-gray-600">管理员</Label>
                  <div className="flex min-h-11 flex-wrap items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
                    {systemAdminUsers.map((userName) => (
                      <span
                        key={userName}
                        className="inline-flex items-center gap-2 rounded-md bg-gray-100 px-2 py-1 text-sm text-gray-700"
                      >
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-500">
                          <User className="h-4 w-4" />
                        </span>
                        {userName}
                        <X className="h-3.5 w-3.5 text-gray-400" />
                      </span>
                    ))}
                    <ChevronDown className="ml-auto h-4 w-4 text-gray-400" />
                  </div>
                </div>

                <div className={systemSettingsCardClass}>
                  <div className={systemSettingsSectionTitleClass}>向量数据库配置</div>

                  <div className="mt-6 space-y-6">
                    <div className="space-y-3">
                      <div className={systemSettingsFieldLabelClass}>向量库类型</div>
                      <div className={systemSettingsHelperTextClass}>
                        目前支持四种类型：IN_MEMORY、MILVUS、CHROMA、PGVECTOR、OPENSEARCH
                      </div>
                      {renderStaticSelect('IN_MEMORY')}
                    </div>

                    <div className="space-y-3">
                      <div className={systemSettingsFieldLabelClass}>持久化路径</div>
                      <div className={systemSettingsHelperTextClass}>
                        默认不持久化，如需持久化请填写持久化路径。注意：如果更变了向量模型需删除该路径下已保存的文件或修改持久化路径
                      </div>
                      <Input className={databaseDialogInputClass} value="" readOnly />
                    </div>

                    <div className="space-y-3">
                      <div className={systemSettingsFieldLabelClass}>超时时间(秒)</div>
                      <Input className={databaseDialogInputClass} value="60" readOnly />
                    </div>
                  </div>
                </div>

                <div className={systemSettingsCardClass}>
                  <div className={systemSettingsSectionTitleClass}>嵌入模型配置</div>

                  <div className="mt-6 space-y-6">
                    <div className="space-y-3">
                      <div className={systemSettingsFieldLabelClass}>接口协议</div>
                      {renderStaticSelect('IN_MEMORY')}
                    </div>
                    <div className="space-y-3">
                      <div className={systemSettingsFieldLabelClass}>ModelName</div>
                      <Input className={databaseDialogInputClass} value="bge-small-zh" readOnly />
                    </div>
                    <div className="space-y-3">
                      <div className={systemSettingsFieldLabelClass}>模型路径</div>
                      <Input className={databaseDialogInputClass} value="" readOnly />
                    </div>
                    <div className="space-y-3">
                      <div className={systemSettingsFieldLabelClass}>词汇表路径</div>
                      <Input className={databaseDialogInputClass} value="" readOnly />
                    </div>
                  </div>
                </div>

                <div className={systemSettingsCardClass}>
                  <div className={systemSettingsSectionTitleClass}>语音识别配置</div>

                  <div className="mt-6 space-y-6">
                    <div className="space-y-3">
                      <div className={systemSettingsFieldLabelClass}>启用语音输入</div>
                      <Switch checked />
                    </div>
                    <div className="space-y-3">
                      <div className={systemSettingsFieldLabelClass}>WebSocket 地址</div>
                      <div className={systemSettingsHelperTextClass}>科大讯飞语音识别 WebSocket 接口地址</div>
                      <Input
                        className={databaseDialogInputClass}
                        value="ws://healthai.iflyhealth.com:1028/aimed/v1/saber/iat/ws"
                        readOnly
                      />
                    </div>
                    <div className="space-y-3">
                      <div className={systemSettingsFieldLabelClass}>AppId</div>
                      <div className={systemSettingsHelperTextClass}>应用ID，当前可用值：MIME1000</div>
                      <Input className={databaseDialogInputClass} value="15962e2d" readOnly />
                    </div>
                    <div className="space-y-3">
                      <div className={systemSettingsFieldLabelClass}>ApiKey</div>
                      <div className={systemSettingsHelperTextClass}>鉴权 API Key，私有化无鉴权部署时留空</div>
                      <div className="relative">
                        <Input className={`${databaseDialogInputClass} pr-10`} value="••••••••••••••••••••••••••••••••" readOnly />
                        <EyeOff className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className={systemSettingsFieldLabelClass}>ApiSecret</div>
                      <div className={systemSettingsHelperTextClass}>鉴权 API Secret，私有化无鉴权部署时留空</div>
                      <div className="relative">
                        <Input className={`${databaseDialogInputClass} pr-10`} value="••••••••••••••••••••••••••••••••" readOnly />
                        <EyeOff className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className={systemSettingsFieldLabelClass}>用户ID(uid)</div>
                      <div className={systemSettingsHelperTextClass}>与 AppId 配合使用，最大32字符，用于热词匹配</div>
                      <Input className={databaseDialogInputClass} value="default_user" readOnly />
                    </div>
                    <div className="space-y-3">
                      <div className={systemSettingsFieldLabelClass}>专业领域(pd)</div>
                      <div className={systemSettingsHelperTextClass}>
                        语音识别专业领域：iat=通用，bingli=病历，chaosheng=超声，kouqiang=口腔，zhongyi=中医，yingxiang=影像
                      </div>
                      {renderStaticSelect('iat')}
                    </div>
                  </div>
                </div>

                <div className={systemSettingsCardClass}>
                  <div className={systemSettingsSectionTitleClass}>语义解析配置</div>

                  <div className="mt-6 space-y-6">
                    <div className="space-y-3">
                      <div className={systemSettingsFieldLabelClass}>是否将mapper探测识别到的维度值提供给大模型</div>
                      <Switch checked />
                    </div>
                    <div className="space-y-3">
                      <div className={systemSettingsFieldLabelClass}>是否开启规则修正器</div>
                      <Switch checked />
                    </div>
                    <div className="space-y-3">
                      <div className={systemSettingsFieldLabelClass}>few-shot样例个数</div>
                      <div className={systemSettingsHelperTextClass}>样例越多效果可能越好，但token消耗越大</div>
                      <Input className={databaseDialogInputClass} value="3" readOnly />
                    </div>
                    <div className="space-y-3">
                      <div className={systemSettingsFieldLabelClass}>self-consistency执行个数</div>
                      <div className={systemSettingsHelperTextClass}>执行越多效果可能越好，但token消耗越大</div>
                      <Input className={databaseDialogInputClass} value="1" readOnly />
                    </div>
                    <div className="space-y-3">
                      <div className={systemSettingsFieldLabelClass}>解析结果展示个数</div>
                      <div className={systemSettingsHelperTextClass}>前端展示的解析个数</div>
                      <Input className={databaseDialogInputClass} value="2" readOnly />
                    </div>
                    <div className="space-y-3">
                      <div className={systemSettingsFieldLabelClass}>语义字段个数阈值</div>
                      <div className={systemSettingsHelperTextClass}>如果映射字段小于该阈值，则将数据集所有字段输入LLM</div>
                      <Input className={databaseDialogInputClass} value="0" readOnly />
                    </div>
                    <div className="space-y-3">
                      <div className={systemSettingsFieldLabelClass}>多轮改写模式</div>
                      <div className={systemSettingsHelperTextClass}>OFF:关闭改写 PRE_ONLY:仅前置改写 PRE_AND_POST:前置改写+LLM阶段兜底</div>
                      {renderStaticSelect('OFF')}
                    </div>
                    <div className="space-y-3">
                      <div className={systemSettingsFieldLabelClass}>是否开启数据集语义召回</div>
                      <Switch checked />
                    </div>
                    <div className="space-y-3">
                      <div className={systemSettingsFieldLabelClass}>是否开启数据集资格门禁</div>
                      <Switch checked />
                    </div>
                    <div className="space-y-3">
                      <div className={systemSettingsFieldLabelClass}>是否开启新版数据集分层打分</div>
                      <Switch checked />
                    </div>
                    <div className="space-y-3">
                      <div className={systemSettingsFieldLabelClass}>数据集语义召回保留个数</div>
                      <div className={systemSettingsHelperTextClass}>基于语义文档检索后保留的候选数据集数</div>
                      <Input className={databaseDialogInputClass} value="5" readOnly />
                    </div>
                  </div>
                </div>

                <div className={systemSettingsCardClass}>
                  <div className={systemSettingsSectionTitleClass}>语义翻译配置</div>

                  <div className="mt-6 space-y-6">
                    <div className="space-y-3">
                      <div className={systemSettingsFieldLabelClass}>查询最大返回数据行数</div>
                      <div className={systemSettingsHelperTextClass}>为了前端展示性能考虑，请不要设置过大</div>
                      <Input className={databaseDialogInputClass} value="1000" readOnly />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-l border-gray-200 pl-5">
                <div className="space-y-3 pt-7 text-sm font-medium text-gray-700">
                  {systemConfigMenu.map((item) => (
                    <div
                      key={item}
                      className={`border-l-3 pl-6 ${
                        item === activeSystemConfigMenu
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-700'
                      }`}
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {systemSettingsTab === 'mail' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-5xl">
                  <div className="text-lg font-semibold text-gray-900">邮件配置</div>
                  <div className={`mt-2 ${systemSettingsHelperTextClass}`}>
                    配置 SMTP 服务器，启用后报告生成时将向模板配置的接收邮箱推送邮件正文（含报告链接）。常见参数：QQ/网易使用 465 端口 + SSL；Office365 / 自建邮件多用 587 端口 + STARTTLS。
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" className={systemSettingsSecondaryButtonClass}>
                    测试连接
                  </button>
                  <button type="button" className={systemSettingsSecondaryButtonClass}>
                    测试发送
                  </button>
                  <button type="button" className={systemSettingsSecondaryButtonClass}>
                    重新加载
                  </button>
                  <button type="button" className={systemSettingsPrimaryButtonClass}>
                    保存
                  </button>
                </div>
              </div>

              <div className={systemSettingsCardClass}>
                <div className={systemSettingsSectionTitleClass}>SMTP 服务器</div>
                <div className="mt-6 grid gap-6 md:grid-cols-3">
                  <div className="space-y-3 md:col-span-2">
                    <Label className={systemSettingsFieldLabelClass}>
                      <span className="text-red-500">*</span> SMTP 主机
                    </Label>
                    <Input className={databaseDialogInputClass} value="smtp.263.net" readOnly />
                  </div>
                  <div className="space-y-3">
                    <Label className={systemSettingsFieldLabelClass}>
                      <span className="text-red-500">*</span> 端口
                    </Label>
                    <Input className={databaseDialogInputClass} value="465" readOnly />
                  </div>
                  <div className="space-y-3">
                    <Label className={systemSettingsFieldLabelClass}>用户名【登录账号】</Label>
                    <Input className={databaseDialogInputClass} value="liusy@futongcloud.com.cn" readOnly />
                  </div>
                  <div className="space-y-3 md:col-span-2">
                    <Label className={systemSettingsFieldLabelClass}>密码 / 授权码</Label>
                    <div className="relative">
                      <Input className={`${databaseDialogInputClass} pr-10`} value="••••••••" readOnly />
                      <EyeOff className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    </div>
                    <div className={systemSettingsHelperTextClass}>
                      已保存密码。留空或保留 ******** 表示沿用旧密码，重新输入则覆盖。
                    </div>
                  </div>
                </div>

                <div className="mt-8 grid gap-6 md:grid-cols-3">
                  {[
                    ['启用 SSL', '465 端口通常需要', true],
                    ['启用 STARTTLS', '587 端口通常需要', false],
                    ['启用邮件推送', '关闭时不会发送任何邮件', true],
                  ].map(([label, hint, checked]) => (
                    <div key={label as string} className="space-y-3">
                      <div className={systemSettingsFieldLabelClass}>{label}</div>
                      <Switch checked={Boolean(checked)} />
                      <div className={systemSettingsHelperTextClass}>{hint}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={systemSettingsCardClass}>
                <div className={systemSettingsSectionTitleClass}>发件人</div>
                <div className="mt-6 grid gap-6 md:grid-cols-2">
                  <div className="space-y-3">
                    <Label className={systemSettingsFieldLabelClass}>发件地址【From】</Label>
                    <Input className={databaseDialogInputClass} value="liusy@futongcloud.com.cn" readOnly />
                  </div>
                  <div className="space-y-3">
                    <Label className={systemSettingsFieldLabelClass}>发件人显示名</Label>
                    <Input className={databaseDialogInputClass} value="智能问数报告" readOnly />
                  </div>
                </div>
              </div>

              <div className={systemSettingsCardClass}>
                <div className={systemSettingsSectionTitleClass}>报告链接</div>
                <div className="mt-6 space-y-3">
                  <Label className={systemSettingsFieldLabelClass}>报告访问域名</Label>
                  <Input className={databaseDialogInputClass} value="http://172.16.71.72:9082" readOnly />
                  <div className={systemSettingsHelperTextClass}>
                    邮件正文中「查看完整报告」按钮指向的 host（例如 https://chatbi.example.com）。须确保收件人能从外网访问到该地址。所有模板生成的报告共用此配置；留空时使用相对路径。
                  </div>
                </div>
              </div>
            </div>
          )}

          {systemSettingsTab === 'appToken' && (
            <div className="space-y-6">
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                >
                  <Plus className="h-4 w-4" />
                  新建 AppToken
                </button>
              </div>

              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr className="border-b border-gray-200 text-left text-sm text-gray-600">
                      <th className="px-6 py-3.5">名称</th>
                      <th className="px-6 py-3.5">创建人</th>
                      <th className="px-6 py-3.5">创建时间</th>
                      <th className="px-6 py-3.5">状态</th>
                      <th className="px-6 py-3.5">过期时间</th>
                      <th className="px-6 py-3.5">Token</th>
                      <th className="px-6 py-3.5">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {appTokenRows.map((row) => (
                      <tr key={row.name} className="text-sm text-gray-700">
                        <td className="px-6 py-4 font-medium text-gray-900">{row.name}</td>
                        <td className="px-6 py-4">{row.creator}</td>
                        <td className="px-6 py-4">{row.createdAt}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              row.status === '有效'
                                ? 'bg-green-50 text-green-600'
                                : 'bg-red-50 text-red-500'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">{row.expiresAt}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className="rounded-md bg-gray-100 px-2.5 py-1 font-mono text-xs text-gray-700">
                              {row.token}
                            </span>
                            <Copy className="h-4 w-4 text-blue-500" />
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-5">
                            <button type="button" className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-blue-600">
                              <FileCode2 className="h-3.5 w-3.5" />
                              嵌入代码
                            </button>
                            <button type="button" className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-red-500">
                              <Trash2 className="h-3.5 w-3.5" />
                              删除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex items-center justify-end gap-3 px-6 py-5 text-sm text-gray-600">
                  <span>第 1-3 条/总共 3 条</span>
                  <button type="button" className="text-gray-300" aria-label="上一页">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="flex h-8 min-w-8 items-center justify-center rounded-md border border-blue-500 px-2 text-blue-600"
                  >
                    1
                  </button>
                  <button type="button" className="text-gray-300" aria-label="下一页">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>,
    );

  const renderContent = () => {
    switch (activeSection) {
      case 'agents':
        return renderAgentSection();
      case 'skills':
        return renderSkillSection();
      case 'knowledge':
        return renderKnowledgeSection();
      case 'datasets':
        return (
          <SemanticModel
            embeddedTab="datasets"
            selectedDatasetId={selectedDatasetId}
            onViewDataset={(datasetId) => navigate(`/settings?section=datasets&datasetId=${datasetId}`)}
            onEditDataset={(datasetId) => navigate(`/settings?section=datasets&datasetId=${datasetId}&mode=edit`)}
            onViewIndicator={(indicatorId) => navigate(`/settings?section=indicators&indicatorId=${indicatorId}`)}
            onEditIndicator={(indicatorId) => navigate(`/settings?section=indicators&indicatorId=${indicatorId}&mode=edit`)}
            onSelectTab={(tab) => navigate(`/settings?section=${tab}`)}
          />
        );
      case 'dimensions':
        return (
          <SemanticModel
            embeddedTab="dimensions"
            onViewDataset={(datasetId) => navigate(`/settings?section=datasets&datasetId=${datasetId}`)}
            onEditDataset={(datasetId) => navigate(`/settings?section=datasets&datasetId=${datasetId}&mode=edit`)}
            onViewIndicator={(indicatorId) => navigate(`/settings?section=indicators&indicatorId=${indicatorId}`)}
            onEditIndicator={(indicatorId) => navigate(`/settings?section=indicators&indicatorId=${indicatorId}&mode=edit`)}
            onSelectTab={(tab) => navigate(`/settings?section=${tab}`)}
          />
        );
      case 'indicators':
        return (
          <IndicatorMarket
            embedded
            selectedIndicatorId={selectedIndicatorId}
            onBackToList={() => navigate('/settings?section=indicators')}
            onViewIndicator={(indicatorId) => navigate(`/settings?section=indicators&indicatorId=${indicatorId}`)}
          />
        );
      case 'synonyms':
        return (
          <SemanticModel
            embeddedTab="synonyms"
            onViewDataset={(datasetId) => navigate(`/settings?section=datasets&datasetId=${datasetId}`)}
            onEditDataset={(datasetId) => navigate(`/settings?section=datasets&datasetId=${datasetId}&mode=edit`)}
            onViewIndicator={(indicatorId) => navigate(`/settings?section=indicators&indicatorId=${indicatorId}`)}
            onEditIndicator={(indicatorId) => navigate(`/settings?section=indicators&indicatorId=${indicatorId}&mode=edit`)}
            onSelectTab={(tab) => navigate(`/settings?section=${tab}`)}
          />
        );
      case 'database':
        return renderDatabaseSection();
      case 'llm':
        return renderLlmSection();
      case 'mcp':
        return <McpAccessManagement />;
      case 'system':
        return renderSystemSection();
    }
  };

  const confirmDeleteDatabase = () => {
    if (!pendingDeleteDatabase || databaseDeleteBlockers.length) return;
    deleteDatabaseConnection(pendingDeleteDatabase.id);
    setDatabasePendingDeleteId(null);
  };

  const confirmDeleteLlm = () => {
    if (!pendingDeleteLlm) return;
    setLlmItems((current) => current.filter((connection) => connection.id !== pendingDeleteLlm.id));
    setLlmPendingDeleteId(null);
  };

  const confirmDeleteKnowledgeDocument = () => {
    if (!pendingDeleteKnowledgeDocument) return;
    deleteKnowledgeDocument(pendingDeleteKnowledgeDocument.id);
    setKnowledgeDocumentPendingDeleteId(null);
  };

  return (
    <div className="h-full min-h-0 overflow-hidden bg-gray-50">
      <div className="mx-auto flex h-full min-h-0 max-w-[1920px] gap-4 px-4 py-6">
        <aside className="min-h-0 w-64 shrink-0">
          <div className="h-full overflow-y-auto rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <nav className="space-y-3">
              {sectionGroups.map((group, groupIndex) => (
                <div key={group.title} className={groupIndex === 0 ? '' : 'pt-2'}>
                  <div className="px-3 pb-1.5 text-xs font-medium text-gray-400">{group.title}</div>
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active =
                        activeSection === item.id &&
                        (item.id !== 'system' || systemSettingsTab === (item.systemTab ?? 'general'));
                      return (
                        <button
                          key={`${item.id}-${item.systemTab ?? 'default'}`}
                          onClick={() => openSection(item.id, item.systemTab)}
                          className={`flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                            active
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                          }`}
                        >
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-md ${
                              active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="font-medium">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </aside>

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {renderContent()}
        </main>
      </div>

      <AlertDialog
        open={Boolean(pendingDeleteAgent)}
        onOpenChange={(open) => {
          if (!open) setAgentPendingDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除 Agent</AlertDialogTitle>
            <AlertDialogDescription>
              确认删除「{pendingDeleteAgent?.name}」？关联会话会保留，但不再绑定该 Agent。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDeleteAgent) deleteAgent(pendingDeleteAgent.id);
                setAgentPendingDeleteId(null);
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingDeleteSkill)}
        onOpenChange={(open) => {
          if (!open) setSkillPendingDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除 Skill</AlertDialogTitle>
            <AlertDialogDescription>
              确认删除「{pendingDeleteSkill?.name}」？已绑定该 Skill 的 Agent 需要重新配置。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDeleteSkill) deleteSkill(pendingDeleteSkill.id);
                setSkillPendingDeleteId(null);
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={isSkillDialogOpen}
        onOpenChange={(open) => {
          if (open) {
            setIsSkillDialogOpen(true);
          } else {
            closeSkillDialog();
          }
        }}
      >
        <DialogContent className="max-h-[88vh] overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="border-b border-gray-100 px-6 py-4">
            <DialogTitle>{editingSkillId ? '编辑 Skill' : '新建 Skill'}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[68vh] overflow-y-auto px-6 py-5">
            <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="skill-name" className={databaseDialogLabelClass}>
                  <span className="text-red-500">*</span> Skill 名称
                </Label>
                <Input
                  id="skill-name"
                  value={skillForm.name}
                  onChange={(event) => updateSkillForm('name', event.target.value)}
                  placeholder="请输入 Skill 名称"
                  className={databaseDialogInputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="skill-scene" className={databaseDialogLabelClass}>
                  <span className="text-red-500">*</span> 场景
                </Label>
                <Input
                  id="skill-scene"
                  value={skillForm.scene}
                  onChange={(event) => updateSkillForm('scene', event.target.value)}
                  placeholder="例如：门诊运营"
                  className={databaseDialogInputClass}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="skill-description" className={databaseDialogLabelClass}>
                  <span className="text-red-500">*</span> 描述
                </Label>
                <Input
                  id="skill-description"
                  value={skillForm.description}
                  onChange={(event) => updateSkillForm('description', event.target.value)}
                  placeholder="简要说明 Skill 能力"
                  className={databaseDialogInputClass}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="skill-trigger-phrases" className={databaseDialogLabelClass}>
                  触发词
                </Label>
                <Input
                  id="skill-trigger-phrases"
                  value={skillForm.triggerPhrases}
                  onChange={(event) => updateSkillForm('triggerPhrases', event.target.value)}
                  placeholder="可用 /、逗号或换行分隔"
                  className={databaseDialogInputClass}
                />
              </div>
              <div className="space-y-2">
                <Label className={databaseDialogLabelClass}>适用 Agent</Label>
                <div className="flex flex-wrap gap-2">
                  {configurableSkillAgentTypes.map((type) => {
                    const checked = skillForm.applicableAgentTypes.includes(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => toggleSkillAgentType(type)}
                        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                          checked
                            ? 'border-blue-300 bg-blue-50 text-blue-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded border ${
                            checked ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'
                          }`}
                        >
                          {checked && <Check className="h-3 w-3" />}
                        </span>
                        {agentTypeLabel[type]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="skill-status" className={databaseDialogLabelClass}>状态</Label>
                <select
                  id="skill-status"
                  value={skillForm.status}
                  onChange={(event) => updateSkillForm('status', event.target.value as Skill['status'])}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors hover:bg-white focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                >
                  <option value="已启用">已启用</option>
                  <option value="已停用">已停用</option>
                </select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="skill-markdown" className={databaseDialogLabelClass}>
                  <span className="text-red-500">*</span> Skill 内容
                </Label>
                <textarea
                  id="skill-markdown"
                  value={skillForm.skillMarkdown}
                  onChange={(event) => updateSkillForm('skillMarkdown', event.target.value)}
                  className="min-h-52 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm leading-6 text-gray-900 outline-none transition-colors placeholder:text-gray-400 hover:bg-white focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  placeholder="请输入 Skill Markdown 内容"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="border-t border-gray-100 px-6 py-4">
            <button
              type="button"
              onClick={closeSkillDialog}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={submitSkill}
              disabled={
                !skillForm.name.trim() ||
                !skillForm.scene.trim() ||
                !skillForm.description.trim() ||
                !skillForm.skillMarkdown.trim()
              }
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
            >
              保存
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(pendingDeleteKnowledgeDocument)}
        onOpenChange={(open) => {
          if (!open) setKnowledgeDocumentPendingDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除知识文档</AlertDialogTitle>
            <AlertDialogDescription>
              确认删除「{pendingDeleteKnowledgeDocument?.title}」？已绑定该文档的 Agent 会同步移除引用。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteKnowledgeDocument}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={Boolean(viewingKnowledgeDocument)}
        onOpenChange={(open) => {
          if (!open) setViewingKnowledgeDocumentId(null);
        }}
      >
        <DialogContent className="max-h-[88vh] overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="border-b border-gray-100 px-6 py-4">
            <DialogTitle>{viewingKnowledgeDocument?.title ?? '查看知识文档'}</DialogTitle>
          </DialogHeader>
          {viewingKnowledgeDocument && (
            <div className="max-h-[72vh] overflow-y-auto px-6 py-5">
              <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span className="rounded bg-blue-50 px-2 py-1 text-blue-700">{viewingKnowledgeDocument.type}</span>
                <span>{viewingKnowledgeDocument.updatedAt}</span>
                {viewingKnowledgeDocument.applicableScenes.map((scene) => (
                  <span key={scene} className="rounded bg-gray-100 px-2 py-1 text-gray-600">
                    {scene}
                  </span>
                ))}
              </div>
              {viewingKnowledgeDocument.filePreviewUrl ? (
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                  {viewingKnowledgeDocument.fileMimeType.startsWith('image/') ||
                  viewingKnowledgeDocument.fileMimeType === 'application/pdf' ||
                  viewingKnowledgeDocument.fileMimeType.startsWith('text/') ? (
                    <iframe
                      title={viewingKnowledgeDocument.title}
                      src={viewingKnowledgeDocument.filePreviewUrl}
                      className="h-[56vh] w-full bg-white"
                    />
                  ) : (
                    <div className="flex min-h-64 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
                      <FileText className="h-10 w-10 text-blue-600" />
                      <div>
                        <div className="font-medium text-gray-900">
                          {viewingKnowledgeDocument.fileName ?? '已上传文档'}
                        </div>
                        <div className="mt-1 text-sm text-gray-500">
                          当前文件格式不支持内嵌预览，可在新窗口打开查看。
                        </div>
                      </div>
                      <a
                        href={viewingKnowledgeDocument.filePreviewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                      >
                        打开文件
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 bg-white px-6 py-5">
                  <div className="mb-4 flex items-center gap-3 border-b border-gray-100 pb-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <FileText className="h-5 w-5" />
                    </span>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{viewingKnowledgeDocument.title}</div>
                      <div className="mt-1 text-xs text-gray-500">示例文档预览</div>
                    </div>
                  </div>
                  <div className="space-y-4 text-sm leading-7 text-gray-700">
                    <p>
                      本文档用于规范「{viewingKnowledgeDocument.title}」相关问数场景中的统计口径、适用范围和引用说明。
                      Agent 在回答问题时应优先引用本规则，并结合用户权限与已绑定数据集生成结论。
                    </p>
                    <div>
                      <div className="mb-2 font-medium text-gray-900">适用场景</div>
                      <ul className="list-disc space-y-1 pl-5">
                        {(viewingKnowledgeDocument.applicableScenes.length
                          ? viewingKnowledgeDocument.applicableScenes
                          : ['经营分析', '指标解释', '报告引用']
                        ).map((scene) => (
                          <li key={scene}>{scene}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="mb-2 font-medium text-gray-900">示例内容</div>
                      <p>
                        当用户问题命中该知识文档时，系统应返回标准口径说明、关键过滤条件和结果解释；
                        如涉及敏感明细，仅展示聚合结果或脱敏后的统计信息。
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isKnowledgeDocumentDialogOpen}
        onOpenChange={(open) => {
          if (open) {
            setIsKnowledgeDocumentDialogOpen(true);
          } else {
            closeKnowledgeDocumentDialog();
          }
        }}
      >
        <DialogContent className="max-h-[86vh] overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-gray-100 px-6 py-4">
            <DialogTitle>{editingKnowledgeDocumentId ? '编辑知识文档' : '新建知识文档'}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[62vh] overflow-y-auto px-6 py-5">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="knowledge-title" className={databaseDialogLabelClass}>文档名称</Label>
                <Input
                  id="knowledge-title"
                  value={knowledgeDocumentForm.title}
                  onChange={(event) => updateKnowledgeDocumentForm('title', event.target.value)}
                  placeholder="输入文档名称"
                  className={databaseDialogInputClass}
                />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="knowledge-type" className={databaseDialogLabelClass}>类型</Label>
                  <select
                    id="knowledge-type"
                    value={knowledgeDocumentForm.type}
                    onChange={(event) =>
                      updateKnowledgeDocumentForm('type', event.target.value as KnowledgeDocument['type'])
                    }
                    className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors hover:bg-white focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  >
                    {knowledgeDocumentTypeOptions.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="knowledge-scenes" className={databaseDialogLabelClass}>适用场景</Label>
                  <Input
                    id="knowledge-scenes"
                    value={knowledgeDocumentForm.applicableScenes}
                    onChange={(event) => updateKnowledgeDocumentForm('applicableScenes', event.target.value)}
                    placeholder="多个场景用顿号或逗号分隔"
                    className={databaseDialogInputClass}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="knowledge-file" className={databaseDialogLabelClass}>上传文件</Label>
                <input
                  id="knowledge-file"
                  type="file"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    updateKnowledgeDocumentForm('fileName', file.name);
                    updateKnowledgeDocumentForm('filePreviewUrl', URL.createObjectURL(file));
                    updateKnowledgeDocumentForm('fileMimeType', file.type);
                    if (!knowledgeDocumentForm.title.trim()) {
                      updateKnowledgeDocumentForm('title', file.name.replace(/\.[^.]+$/, ''));
                    }
                  }}
                />
                <div
                  className={`rounded-xl border px-4 py-4 transition-colors ${
                    knowledgeDocumentForm.fileName
                      ? 'border-blue-200 bg-blue-50'
                      : 'border-dashed border-gray-300 bg-gray-50'
                  }`}
                >
                  {knowledgeDocumentForm.fileName ? (
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                            <FileText className="h-5 w-5" />
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-gray-900">
                              {knowledgeDocumentForm.fileName}
                            </div>
                            <div className="mt-1 text-xs text-blue-700">已选择本地文件，保存后加入知识库。</div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label
                          htmlFor="knowledge-file"
                          className="cursor-pointer rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-blue-700 hover:bg-blue-50"
                        >
                          重新选择
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            updateKnowledgeDocumentForm('fileName', '');
                            updateKnowledgeDocumentForm('filePreviewUrl', '');
                            updateKnowledgeDocumentForm('fileMimeType', '');
                          }}
                          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                        >
                          移除
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label
                      htmlFor="knowledge-file"
                      className="flex cursor-pointer flex-wrap items-center justify-between gap-4"
                    >
                      <div>
                        <div className="text-sm font-medium text-gray-900">选择本地知识文档</div>
                        <div className="mt-1 text-xs text-gray-500">
                          支持上传 PDF、Word、Excel、Markdown、TXT 等本地文件。
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
                        <Plus className="h-4 w-4" />
                        上传文件
                      </span>
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="border-t border-gray-100 px-6 py-4">
            <button
              type="button"
              onClick={closeKnowledgeDocumentDialog}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={submitKnowledgeDocument}
              disabled={
                !knowledgeDocumentForm.title.trim() ||
                !knowledgeDocumentForm.fileName.trim()
              }
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
            >
              保存
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(pendingDeleteDatabase)}
        onOpenChange={(open) => {
          if (!open) setDatabasePendingDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {databaseDeleteBlockers.length ? '无法删除数据库连接' : '删除数据库连接'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {databaseDeleteBlockers.length
                ? `已被数据集引用：${databaseDeleteBlockers.join('、')}。请先调整数据库连接。`
                : `确认删除「${pendingDeleteDatabase?.name ?? ''}」？删除后数据集将无法继续使用该连接。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {databaseDeleteBlockers.length ? (
              <AlertDialogAction
                onClick={() => setDatabasePendingDeleteId(null)}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                知道了
              </AlertDialogAction>
            ) : (
              <>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={confirmDeleteDatabase}
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  删除
                </AlertDialogAction>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingDeleteLlm)}
        onOpenChange={(open) => {
          if (!open) setLlmPendingDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除大模型连接</AlertDialogTitle>
            <AlertDialogDescription>
              确认删除「{pendingDeleteLlm?.connectionName ?? ''}」？删除后不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteLlm}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={isDatabaseDialogOpen}
        onOpenChange={(open) => {
          if (open) {
            setIsDatabaseDialogOpen(true);
          } else {
            closeDatabaseDialog();
          }
        }}
      >
        <DialogContent className="max-h-[86vh] overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-b border-gray-100 px-6 py-4">
            <DialogTitle>{editingDatabaseId ? '编辑数据库连接' : '新建数据库连接'}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[62vh] overflow-y-auto px-6 py-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="database-name" className={databaseDialogLabelClass}>连接名称</Label>
                <Input
                  id="database-name"
                  value={databaseForm.name}
                  onChange={(event) => updateDatabaseForm('name', event.target.value)}
                  placeholder="输入连接名称"
                  className={databaseDialogInputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="database-type" className={databaseDialogLabelClass}>数据库类型</Label>
                <select
                  id="database-type"
                  value={databaseForm.type}
                  onChange={(event) => updateDatabaseForm('type', event.target.value)}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors hover:bg-white focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                >
                  {databaseTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="database-jdbc" className={databaseDialogLabelClass}>JDBC 地址</Label>
                <Input
                  id="database-jdbc"
                  value={databaseForm.jdbcUrl}
                  onChange={(event) => updateDatabaseForm('jdbcUrl', event.target.value)}
                  placeholder="输入JDBC连接串"
                  className={databaseDialogInputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="database-username" className={databaseDialogLabelClass}>用户名</Label>
                <Input
                  id="database-username"
                  value={databaseForm.username}
                  onChange={(event) => updateDatabaseForm('username', event.target.value)}
                  placeholder="输入用户名"
                  className={databaseDialogInputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="database-password" className={databaseDialogLabelClass}>密码</Label>
                <div className="relative">
                  <Input
                    id="database-password"
                    type={showDatabasePassword ? 'text' : 'password'}
                    value={databaseForm.password}
                    onChange={(event) => updateDatabaseForm('password', event.target.value)}
                    placeholder="输入密码"
                    className={`${databaseDialogInputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowDatabasePassword((current) => !current)}
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    aria-label={showDatabasePassword ? '隐藏密码' : '显示密码'}
                    title={showDatabasePassword ? '隐藏密码' : '显示密码'}
                  >
                    {showDatabasePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="database-db-name" className={databaseDialogLabelClass}>数据库名称</Label>
                <Input
                  id="database-db-name"
                  value={databaseForm.databaseName}
                  onChange={(event) => updateDatabaseForm('databaseName', event.target.value)}
                  placeholder="输入数据库名称"
                  className={databaseDialogInputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="database-admins" className={databaseDialogLabelClass}>管理员</Label>
                <UserMultiSelect
                  id="database-admins"
                  value={databaseForm.admins}
                  options={userOptions}
                  placeholder="选择管理员"
                  triggerClassName="min-h-11 rounded-lg border-gray-300 hover:bg-white focus-visible:bg-white"
                  onChange={(value) => updateDatabaseForm('admins', value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="database-users" className={databaseDialogLabelClass}>使用者</Label>
                <UserMultiSelect
                  id="database-users"
                  value={databaseForm.users}
                  options={userOptions}
                  placeholder="选择使用者"
                  triggerClassName="min-h-11 rounded-lg border-gray-300 hover:bg-white focus-visible:bg-white"
                  onChange={(value) => updateDatabaseForm('users', value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="database-description" className={databaseDialogLabelClass}>描述</Label>
                <textarea
                  id="database-description"
                  value={databaseForm.description}
                  onChange={(event) => updateDatabaseForm('description', event.target.value)}
                  className="min-h-24 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 hover:bg-white focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  placeholder="输入数据库描述"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="border-t border-gray-100 px-6 py-4">
            <button
              type="button"
              onClick={closeDatabaseDialog}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="button"
              onClick={submitDatabaseConnection}
              disabled={
                !databaseForm.name.trim() ||
                !databaseForm.jdbcUrl.trim() ||
                !databaseForm.username.trim() ||
                !databaseForm.databaseName.trim()
              }
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
            >
              保存
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isLlmDialogOpen}
        onOpenChange={(open) => {
          if (open) {
            setIsLlmDialogOpen(true);
          } else {
            closeLlmDialog();
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="border-b border-gray-100 px-6 py-4">
            <DialogTitle>{editingLlmId ? '编辑大模型连接' : '创建大模型连接'}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto px-6 pb-4 pt-3">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="llm-connection-name" className={databaseDialogLabelClass}>
                  <span className="text-red-500">*</span> 连接名称
                </Label>
                <Input
                  id="llm-connection-name"
                  value={llmForm.connectionName}
                  onChange={(event) => updateLlmForm('connectionName', event.target.value)}
                  placeholder="请输入连接名称"
                  className={databaseDialogInputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="llm-protocol" className={databaseDialogLabelClass}>接口协议</Label>
                <select
                  id="llm-protocol"
                  value={llmForm.protocol}
                  onChange={(event) => updateLlmForm('protocol', event.target.value)}
                  className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors hover:bg-white focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                >
                  {llmProtocolOptions.map((protocol) => (
                    <option key={protocol} value={protocol}>
                      {protocol}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="llm-base-url" className={databaseDialogLabelClass}>BaseUrl</Label>
                <Input
                  id="llm-base-url"
                  value={llmForm.baseUrl}
                  onChange={(event) => updateLlmForm('baseUrl', event.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className={databaseDialogInputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="llm-api-key" className={databaseDialogLabelClass}>ApiKey</Label>
                <div className="relative">
                  <Input
                    id="llm-api-key"
                    type={showLlmApiKey ? 'text' : 'password'}
                    value={llmForm.apiKey}
                    onChange={(event) => updateLlmForm('apiKey', event.target.value)}
                    placeholder="请输入 ApiKey"
                    className={`${databaseDialogInputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLlmApiKey((current) => !current)}
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    aria-label={showLlmApiKey ? '隐藏 ApiKey' : '显示 ApiKey'}
                    title={showLlmApiKey ? '隐藏 ApiKey' : '显示 ApiKey'}
                  >
                    {showLlmApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="llm-model-name" className={databaseDialogLabelClass}>ModelName</Label>
                <Input
                  id="llm-model-name"
                  value={llmForm.modelName}
                  onChange={(event) => updateLlmForm('modelName', event.target.value)}
                  placeholder="gpt-4o-mini"
                  className={databaseDialogInputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="llm-api-version" className={databaseDialogLabelClass}>ApiVersion</Label>
                <Input
                  id="llm-api-version"
                  value={llmForm.apiVersion}
                  onChange={(event) => updateLlmForm('apiVersion', event.target.value)}
                  placeholder="2024-02-01"
                  className={databaseDialogInputClass}
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="llm-temperature" className={databaseDialogLabelClass}>Temperature</Label>
                <input
                  id="llm-temperature"
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={llmForm.temperature}
                  onChange={(event) => updateLlmForm('temperature', event.target.value)}
                  className="h-2 w-full accent-blue-500"
                />
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>精确</span>
                  <span>随机</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="llm-timeout" className={databaseDialogLabelClass}>超时时间(秒)</Label>
                <Input
                  id="llm-timeout"
                  type="number"
                  min="1"
                  value={llmForm.timeoutSeconds}
                  onChange={(event) => updateLlmForm('timeoutSeconds', event.target.value)}
                  className={databaseDialogInputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="llm-description" className={databaseDialogLabelClass}>描述</Label>
                <textarea
                  id="llm-description"
                  value={llmForm.description}
                  onChange={(event) => updateLlmForm('description', event.target.value)}
                  className="min-h-32 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 hover:bg-white focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  placeholder="请输入大模型连接描述"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="border-t border-gray-100 px-6 py-4">
            <button
              type="button"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            >
              连接测试
            </button>
            <button
              type="button"
              onClick={submitLlmConnection}
              disabled={
                !llmForm.connectionName.trim() ||
                !llmForm.baseUrl.trim() ||
                !llmForm.apiKey.trim() ||
                !llmForm.modelName.trim()
              }
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
            >
              保存
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConnectionTable({
  connections,
  onEdit,
  onDelete,
}: {
  connections: DatabaseConnection[];
  onEdit: (connection: DatabaseConnection) => void;
  onDelete: (connection: DatabaseConnection) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr className="border-b border-gray-200 text-left text-sm text-gray-600">
            <th className="px-6 py-3">连接名称</th>
            <th className="px-6 py-3">类型</th>
            <th className="px-6 py-3">创建人</th>
            <th className="px-6 py-3">更新时间</th>
            <th className="px-6 py-3">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {connections.map((connection) => (
            <tr key={connection.id} className="text-sm text-gray-700 hover:bg-gray-50">
              <td className="px-6 py-4">
                <div className="font-medium text-gray-900">{connection.name}</div>
                <div className="mt-1 max-w-xs truncate text-xs text-gray-400">
                  {connection.description || '-'}
                </div>
              </td>
              <td className="px-6 py-4">{connection.type}</td>
              <td className="px-6 py-4">{connection.creator}</td>
              <td className="px-6 py-4">{connection.updatedAt}</td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-1 whitespace-nowrap">
                  <ConfigActionIconButton
                    onClick={() => onEdit(connection)}
                    icon={PencilLine}
                    label="编辑"
                    variant="edit"
                  />
                  <ConfigActionIconButton
                    onClick={() => onDelete(connection)}
                    icon={Trash2}
                    label="删除"
                    variant="delete"
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserMultiSelect({
  id,
  value,
  options,
  placeholder,
  triggerClassName = '',
  onChange,
}: {
  id: string;
  value: string;
  options: string[];
  placeholder: string;
  triggerClassName?: string;
  onChange: (value: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selectedUsers = splitUserList(value);
  const selectedSet = new Set(selectedUsers);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  const emitChange = (users: string[]) => {
    onChange(users.join('、'));
  };

  const toggleUser = (user: string) => {
    emitChange(
      selectedSet.has(user)
        ? selectedUsers.filter((item) => item !== user)
        : [...selectedUsers, user],
    );
  };

  const removeUser = (user: string) => {
    emitChange(selectedUsers.filter((item) => item !== user));
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`flex min-h-9 w-full items-center gap-1.5 rounded-md border bg-white px-2 py-1.5 text-left text-sm outline-none transition-colors focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-100 ${
          open ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200 hover:border-gray-300'
        } ${triggerClassName}`}
      >
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          {selectedUsers.length ? (
            selectedUsers.map((user) => (
              <span
                key={user}
                className="inline-flex max-w-[9rem] items-center gap-1 rounded-md bg-gray-100 px-1.5 py-1 text-gray-700"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  <User className="h-3.5 w-3.5" />
                </span>
                <span className="truncate">{user}</span>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`移除 ${user}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeUser(user);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      event.stopPropagation();
                      removeUser(user);
                    }
                  }}
                  className="rounded-full p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              </span>
            ))
          ) : (
            <span className="px-1 py-1 text-gray-400">{placeholder}</span>
          )}
        </div>
        {selectedUsers.length > 0 && (
          <span
            role="button"
            tabIndex={0}
            aria-label="清空管理员"
            onClick={(event) => {
              event.stopPropagation();
              emitChange([]);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                emitChange([]);
              }
            }}
            className="shrink-0 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </span>
        )}
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-[60] mt-1 max-h-64 overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg">
          {options.map((user) => {
            const selected = selectedSet.has(user);
            return (
              <button
                key={user}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => toggleUser(user)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-blue-50 ${
                  selected ? 'bg-blue-50 text-gray-900' : 'text-gray-700'
                }`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  <User className="h-4 w-4" />
                </span>
                <span className="flex-1 truncate">{user}</span>
                {selected && <Check className="h-4 w-4 text-blue-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
