import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  CircleSlash,
  Globe,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  SlidersHorizontal,
  Terminal,
} from 'lucide-react';
import { toast } from 'sonner';
import { McpCapability, McpEnvironment, McpServer, McpTransport } from '../types';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../components/ui/sheet';
import { ConfigActionIconButton } from '../components/ConfigActionIconButton';

const mcpPageSize = 10;

type McpServerFormState = {
  name: string;
  businessDomain: string;
  endpoint: string;
  transport: McpTransport;
  authType: McpServer['authType'];
  authConfigName: string;
  owner: string;
  environment: McpEnvironment;
};

const emptyServerForm: McpServerFormState = {
  name: '',
  businessDomain: '',
  endpoint: '',
  transport: 'Streamable HTTP',
  authType: 'OAuth 2.1',
  authConfigName: '',
  owner: 'admin',
  environment: '测试',
};

const riskClass = {
  低: 'bg-emerald-50 text-emerald-700',
  中: 'bg-amber-50 text-amber-700',
  高: 'bg-red-50 text-red-700',
};

function formatNow() {
  return new Date()
    .toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    .replaceAll('/', '-');
}

function createDiscoveredCapability(serverId: string): McpCapability {
  return {
    id: `cap-${Date.now()}`,
    serverId,
    name: 'search_operational_context',
    kind: 'tool',
    description: '同步发现的只读查询工具，可用于补充经营分析上下文。',
    inputSchema: '{ query: string; limit?: number }',
    outputSchema: '{ items: ContextItem[]; source: string }',
    scopes: ['context.read'],
    tags: ['只读查询', '自动发现'],
    sideEffect: false,
    riskLevel: '低',
    enabled: true,
    agentIds: [],
    skillIds: [],
  };
}

function Badge({ children, className = '' }: { children: string; className?: string }) {
  return (
    <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs ${className}`}>
      {children}
    </span>
  );
}

export default function McpAccessManagement() {
  const {
    mcpServers: servers,
    addMcpServer,
    updateMcpServer,
    updateMcpCapability,
  } = useWorkspace();
  const [selectedCapabilityId, setSelectedCapabilityId] = useState('');
  const [capabilityDrawerServerId, setCapabilityDrawerServerId] = useState<string | null>(null);
  const [isServerDialogOpen, setIsServerDialogOpen] = useState(false);
  const [editingServerId, setEditingServerId] = useState<string | null>(null);
  const [serverForm, setServerForm] = useState<McpServerFormState>(emptyServerForm);
  const [checkingServerId, setCheckingServerId] = useState<string | null>(null);
  const [syncingServerId, setSyncingServerId] = useState<string | null>(null);
  const [serverPage, setServerPage] = useState(1);
  const isStdioTransport = serverForm.transport === 'stdio';
  const connectionTargetLabel = isStdioTransport ? '启动命令' : 'Endpoint';
  const connectionTargetPlaceholder = isStdioTransport
    ? '例如：uvx mcp-server-medical'
    : 'https://mcp.example.com/service/mcp';
  const transportOptions: Array<{
    value: McpTransport;
    label: string;
    description: string;
    icon: typeof Globe;
  }> = [
    {
      value: 'Streamable HTTP',
      label: 'Streamable HTTP',
      description: '远程 MCP 服务，通过 HTTP endpoint 接入。',
      icon: Globe,
    },
    {
      value: 'stdio',
      label: 'stdio',
      description: '本地进程型 MCP 服务，由平台直接拉起。',
      icon: Terminal,
    },
  ];

  const capabilityDrawerServer =
    servers.find((server) => server.id === capabilityDrawerServerId) ?? null;
  const selectedCapability =
    capabilityDrawerServer?.capabilities.find((capability) => capability.id === selectedCapabilityId) ??
    capabilityDrawerServer?.capabilities[0] ??
    null;

  const serverTotalPages = Math.max(1, Math.ceil(servers.length / mcpPageSize));
  const pagedServers = useMemo(() => {
    const start = (serverPage - 1) * mcpPageSize;
    return servers.slice(start, start + mcpPageSize);
  }, [serverPage, servers]);

  useEffect(() => {
    setServerPage((current) => Math.min(current, serverTotalPages));
  }, [serverTotalPages]);

  const serverNameById = useMemo(
    () => new Map(servers.map((server) => [server.id, server.name])),
    [servers],
  );

  const updateServer = (serverId: string, updater: (server: McpServer) => McpServer) => {
    updateMcpServer(serverId, updater);
  };

  const updateCapability = (
    capabilityId: string,
    updater: (capability: McpCapability) => McpCapability,
  ) => {
    updateMcpCapability(capabilityId, updater);
  };

  const resetServerDialog = () => {
    setIsServerDialogOpen(false);
    setEditingServerId(null);
    setServerForm(emptyServerForm);
  };

  const openCreateServerDialog = () => {
    setEditingServerId(null);
    setServerForm(emptyServerForm);
    setIsServerDialogOpen(true);
  };

  const openEditServerDialog = (server: McpServer) => {
    setEditingServerId(server.id);
    setServerForm({
      name: server.name,
      businessDomain: server.businessDomain,
      endpoint: server.endpoint,
      transport: server.transport,
      authType: server.authType,
      authConfigName: server.authConfigName ?? '',
      owner: server.owner,
      environment: server.environment,
    });
    setIsServerDialogOpen(true);
  };

  const openCapabilityDrawer = (server: McpServer) => {
    setCapabilityDrawerServerId(server.id);
    setSelectedCapabilityId(server.capabilities[0]?.id ?? '');
  };

  const submitServerDialog = () => {
    const name = serverForm.name.trim();
    const businessDomain = serverForm.businessDomain.trim();
    const endpoint = serverForm.endpoint.trim();
    const needsAuthConfig =
      serverForm.transport === 'Streamable HTTP' && serverForm.authType === 'OAuth 2.1';
    const authConfigName = serverForm.authConfigName.trim();
    if (!name || !businessDomain || !endpoint || (needsAuthConfig && !authConfigName)) return;

    const serverId = editingServerId ?? `mcp-${Date.now()}`;
    const nextServer: McpServer = {
      id: serverId,
      name,
      businessDomain,
      endpoint,
      transport: serverForm.transport,
      authType: serverForm.transport === 'stdio' ? 'None' : serverForm.authType,
      authConfigName: needsAuthConfig ? authConfigName : undefined,
      owner: serverForm.owner.trim() || 'admin',
      environment: serverForm.environment,
      status: '已启用',
      healthStatus: '未检测',
      lastSyncedAt: '未同步',
      updatedAt: formatNow(),
      capabilities: editingServerId
        ? servers.find((server) => server.id === editingServerId)?.capabilities ?? []
        : [createDiscoveredCapability(serverId)],
    };

    if (editingServerId) {
      updateMcpServer(editingServerId, () => nextServer);
    } else {
      addMcpServer(nextServer);
    }
    setSelectedCapabilityId(nextServer.capabilities[0]?.id ?? selectedCapabilityId);
    resetServerDialog();
  };

  const syncCapabilities = (serverId: string) => {
    if (syncingServerId) return;
    const serverName = serverNameById.get(serverId) ?? 'MCP 服务';
    setSyncingServerId(serverId);
    setTimeout(() => {
      updateServer(serverId, (server) => ({
        ...server,
        healthStatus: '正常',
        lastSyncedAt: formatNow(),
        updatedAt: formatNow(),
        capabilities: server.capabilities.some((capability) => capability.tags.includes('自动发现'))
          ? server.capabilities
          : [...server.capabilities, createDiscoveredCapability(server.id)],
      }));
      setSyncingServerId(null);
      toast.success('能力已同步', {
        description: `${serverName} 的能力清单和最近同步时间已更新。`,
      });
    }, 500);
  };

  const runHealthCheck = (serverId: string) => {
    if (checkingServerId) return;
    const serverName = serverNameById.get(serverId) ?? 'MCP 服务';
    setCheckingServerId(serverId);
    setTimeout(() => {
      let nextHealthStatus: McpServer['healthStatus'] = '未检测';
      updateServer(serverId, (server) => {
        nextHealthStatus = server.status === '已启用' ? '正常' : '未检测';
        return {
          ...server,
          healthStatus: nextHealthStatus,
          updatedAt: formatNow(),
        };
      });
      setCheckingServerId(null);
      if (nextHealthStatus === '正常') {
        toast.success('连接测试通过', {
          description: `${serverName} 当前连接正常。`,
        });
      } else {
        toast.info('连接测试已跳过', {
          description: `${serverName} 当前未启用，连接状态保持未检测。`,
        });
      }
    }, 500);
  };

  const renderServerDialog = () => {
    const needsAuthConfig =
      serverForm.transport === 'Streamable HTTP' && serverForm.authType === 'OAuth 2.1';
    const canSubmit =
      Boolean(serverForm.name.trim()) &&
      Boolean(serverForm.businessDomain.trim()) &&
      Boolean(serverForm.endpoint.trim()) &&
      (!needsAuthConfig || Boolean(serverForm.authConfigName.trim()));

    return (
      <Dialog
        open={isServerDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetServerDialog();
            return;
          }
          setIsServerDialogOpen(true);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="border-b border-gray-100 px-6 py-5">
            <DialogTitle>{editingServerId ? '编辑 MCP 服务' : '新增 MCP 服务'}</DialogTitle>
          </DialogHeader>

          <div className="max-h-[calc(85vh-156px)] overflow-y-auto px-6 py-5">
            <div className="space-y-6">
              <section className="grid gap-5 md:grid-cols-2">
                <label className="text-sm text-gray-700">
                  1. 服务名称 <span className="text-red-500">*</span>
                  <input
                    value={serverForm.name}
                    onChange={(event) => setServerForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="例如：HIS 经营数据 MCP"
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </label>
                <label className="text-sm text-gray-700">
                  业务域 <span className="text-red-500">*</span>
                  <input
                    value={serverForm.businessDomain}
                    onChange={(event) => setServerForm((current) => ({ ...current, businessDomain: event.target.value }))}
                    placeholder="例如：门急诊/住院经营"
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </label>
              </section>

              <section className="space-y-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">2. 选择接入方式</div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {transportOptions.map((option) => {
                    const Icon = option.icon;
                    const active = serverForm.transport === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setServerForm((current) => ({
                            ...current,
                            transport: option.value,
                            authType:
                              option.value === 'stdio'
                                ? 'None'
                                : current.authType === 'None'
                                  ? 'OAuth 2.1'
                                  : current.authType,
                            authConfigName: option.value === 'stdio' ? '' : current.authConfigName,
                          }))
                        }
                        className={`rounded-lg border px-4 py-4 text-left transition-colors ${
                          active
                            ? 'border-blue-300 bg-blue-50'
                            : 'border-gray-200 bg-white hover:border-blue-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg ${
                              active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900">{option.label}</div>
                            <div className="mt-1 text-xs leading-5 text-gray-500">{option.description}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="grid gap-5 md:grid-cols-2">
                <label className="text-sm text-gray-700 md:col-span-2">
                  3. {connectionTargetLabel} <span className="text-red-500">*</span>
                  <input
                    value={serverForm.endpoint}
                    onChange={(event) => setServerForm((current) => ({ ...current, endpoint: event.target.value }))}
                    placeholder={connectionTargetPlaceholder}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                  <span className="mt-2 block text-xs leading-5 text-gray-500">
                    {isStdioTransport
                      ? 'stdio 由宿主进程直接拉起本地 MCP Server，这里填写启动命令或可执行入口。'
                      : 'Streamable HTTP 需要填写 MCP endpoint，客户端会向这个地址发起协议请求。'}
                  </span>
                </label>
                {!isStdioTransport ? (
                  <div className="space-y-3 md:col-span-2">
                    <div className="text-sm font-medium text-gray-900">
                      4. 认证方式 <span className="text-red-500">*</span>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {(['OAuth 2.1', 'None'] as const).map((authType) => {
                        const active = serverForm.authType === authType;
                        return (
                          <button
                            key={authType}
                            type="button"
                            onClick={() =>
                              setServerForm((current) => ({
                                ...current,
                                authType,
                                authConfigName: authType === 'OAuth 2.1' ? current.authConfigName : '',
                              }))
                            }
                            className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                              active
                                ? 'border-blue-300 bg-blue-50 text-blue-900'
                                : 'border-gray-200 bg-white text-gray-700 hover:border-blue-200 hover:bg-gray-50'
                            }`}
                          >
                            <div className="font-medium">
                              {authType === 'OAuth 2.1' ? 'OAuth 2.1' : '无认证'}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {needsAuthConfig && (
                      <label className="block text-sm text-gray-700">
                        认证配置标识 <span className="text-red-500">*</span>
                        <input
                          value={serverForm.authConfigName}
                          onChange={(event) =>
                            setServerForm((current) => ({
                              ...current,
                              authConfigName: event.target.value,
                            }))
                          }
                          placeholder="例如：his-oauth-prod"
                          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </label>
                    )}
                  </div>
                ) : null}
              </section>
            </div>
          </div>

          <DialogFooter className="border-t border-gray-100 px-6 py-4">
            <button
              onClick={resetServerDialog}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              取消
            </button>
            <button
              disabled={!canSubmit}
              onClick={submitServerDialog}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              <Save className="h-4 w-4" />
              保存
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  const renderServers = () => (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px]">
        <thead className="bg-gray-50">
          <tr className="border-b border-gray-200 text-left text-sm text-gray-600">
            <th className="px-5 py-3">服务名称</th>
            <th className="px-5 py-3">业务域</th>
            <th className="px-5 py-3">协议/认证</th>
            <th className="px-5 py-3">连接</th>
            <th className="px-5 py-3">最近同步</th>
            <th className="px-5 py-3">状态</th>
            <th className="px-5 py-3">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {pagedServers.map((server) => (
            <tr key={server.id} className="text-sm text-gray-700 hover:bg-gray-50">
              <td className="px-5 py-4">
                <div className="font-medium text-gray-900">{server.name}</div>
                <div className="mt-1 max-w-xs break-all text-xs text-gray-500">{server.endpoint}</div>
              </td>
              <td className="px-5 py-4">{server.businessDomain}</td>
              <td className="px-5 py-4">
                <div>{server.transport}</div>
                <div className="mt-1 text-xs text-gray-500">{server.authType}</div>
              </td>
              <td className="px-5 py-4">
                <Badge
                  className={
                    server.healthStatus === '正常'
                      ? 'bg-emerald-50 text-emerald-700'
                      : server.healthStatus === '异常'
                        ? 'bg-red-50 text-red-700'
                        : 'bg-gray-100 text-gray-600'
                  }
                >
                  {server.healthStatus}
                </Badge>
              </td>
              <td className="px-5 py-4">{server.lastSyncedAt}</td>
              <td className="px-5 py-4">
                <button
                  type="button"
                  role="switch"
                  aria-checked={server.status === '已启用'}
                  onClick={() =>
                    updateServer(server.id, (current) => ({
                      ...current,
                      status: current.status === '已启用' ? '已停用' : '已启用',
                    }))
                  }
                  className={`inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${
                    server.status === '已启用'
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-gray-300 hover:bg-gray-400'
                  }`}
                  title={server.status === '已启用' ? '点击停用' : '点击启用'}
                  aria-label={`${server.name}当前${server.status}，点击${server.status === '已启用' ? '停用' : '启用'}`}
                >
                  <span
                    className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                      server.status === '已启用' ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </td>
              <td className="px-5 py-4">
                <div className="flex items-center gap-1 whitespace-nowrap">
                  <ConfigActionIconButton
                    onClick={() => runHealthCheck(server.id)}
                    icon={CheckCircle2}
                    label={checkingServerId === server.id ? '检测中' : '连接测试'}
                    variant="test"
                    disabled={checkingServerId === server.id || syncingServerId === server.id}
                  />
                  <ConfigActionIconButton
                    onClick={() => syncCapabilities(server.id)}
                    icon={RefreshCw}
                    label={syncingServerId === server.id ? '同步中' : '同步能力'}
                    iconClassName={syncingServerId === server.id ? 'animate-spin' : undefined}
                    variant="sync"
                    disabled={checkingServerId === server.id || syncingServerId === server.id}
                  />
                  <button
                    type="button"
                    onClick={() => openCapabilityDrawer(server)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
                    title="查看能力"
                    aria-label="查看能力"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </button>
                  <ConfigActionIconButton
                    onClick={() => openEditServerDialog(server)}
                    icon={Pencil}
                    label="编辑"
                    variant="edit"
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-5 py-3 text-sm text-gray-500">
        <div>
          共 {servers.length} 条，每页 {mcpPageSize} 条
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setServerPage(Math.max(1, serverPage - 1))}
            disabled={serverPage === 1}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:border-gray-100 disabled:text-gray-300"
            aria-label="上一页"
            title="上一页"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {Array.from({ length: serverTotalPages }, (_, index) => index + 1).map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              onClick={() => setServerPage(pageNumber)}
              className={`h-8 min-w-8 rounded-md border px-2 text-sm transition-colors ${
                serverPage === pageNumber
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-blue-200 hover:text-blue-600'
              }`}
            >
              {pageNumber}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setServerPage(Math.min(serverTotalPages, serverPage + 1))}
            disabled={serverPage === serverTotalPages}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:border-blue-200 hover:text-blue-600 disabled:cursor-not-allowed disabled:border-gray-100 disabled:text-gray-300"
            aria-label="下一页"
            title="下一页"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  const renderCapabilityDrawer = () => (
    <Sheet
      open={Boolean(capabilityDrawerServer)}
      onOpenChange={(open) => {
        if (!open) {
          setCapabilityDrawerServerId(null);
          setSelectedCapabilityId('');
        }
      }}
    >
      <SheetContent className="w-[92vw] gap-0 p-0 sm:max-w-5xl">
        <SheetHeader className="border-b border-gray-200 px-6 py-5">
          <SheetTitle>{capabilityDrawerServer?.name ?? 'MCP 能力'}</SheetTitle>
          <SheetDescription>{capabilityDrawerServer?.endpoint}</SheetDescription>
        </SheetHeader>

        {capabilityDrawerServer ? (
          <div className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_380px]">
            <section className="min-h-0 overflow-y-auto border-r border-gray-200">
              <div className="border-b border-gray-100 px-5 py-4">
                <div className="text-base font-semibold text-gray-900">能力列表</div>
              </div>
              <div className="divide-y divide-gray-200">
                {capabilityDrawerServer.capabilities.map((capability) => (
                  <button
                    key={capability.id}
                    onClick={() => setSelectedCapabilityId(capability.id)}
                    className={`w-full px-5 py-4 text-left transition-colors ${
                      selectedCapability?.id === capability.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-gray-900">{capability.name}</span>
                          <Badge className="bg-blue-50 text-blue-700">{capability.kind}</Badge>
                          <Badge className={riskClass[capability.riskLevel]}>{capability.riskLevel}风险</Badge>
                          {capability.sideEffect && <Badge className="bg-red-50 text-red-700">有副作用</Badge>}
                        </div>
                        <div className="mt-2 text-sm leading-6 text-gray-600">{capability.description}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {capability.tags.map((tag) => (
                            <span
                              key={`${capability.id}-${tag}`}
                              className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span className={`text-sm ${capability.enabled ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {capability.enabled ? '已启用' : '已停用'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <aside className="min-h-0 overflow-y-auto bg-white p-5">
              {selectedCapability ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-base font-semibold text-gray-900">{selectedCapability.name}</div>
                    <div className="mt-1 text-sm text-gray-500">{capabilityDrawerServer.name}</div>
                  </div>
                  <div className="grid gap-3">
                    <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                      <span className="text-sm text-gray-700">能力启用</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={selectedCapability.enabled}
                        onClick={() =>
                          updateCapability(selectedCapability.id, (capability) => ({
                            ...capability,
                            enabled: !capability.enabled,
                          }))
                        }
                        className={`inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${
                          selectedCapability.enabled
                            ? 'bg-blue-600 hover:bg-blue-700'
                            : 'bg-gray-300 hover:bg-gray-400'
                        }`}
                        title={selectedCapability.enabled ? '停用能力' : '启用能力'}
                        aria-label={selectedCapability.enabled ? '停用能力' : '启用能力'}
                      >
                        <span
                          className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                            selectedCapability.enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">权限 Scope</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedCapability.scopes.map((scope) => (
                        <span key={scope} className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs text-indigo-700">
                          {scope}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">输入 Schema</div>
                    <pre className="mt-2 overflow-x-auto rounded-lg bg-gray-950 p-3 text-xs text-gray-100">
                      {selectedCapability.inputSchema}
                    </pre>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">输出 Schema</div>
                    <pre className="mt-2 overflow-x-auto rounded-lg bg-gray-950 p-3 text-xs text-gray-100">
                      {selectedCapability.outputSchema}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                  暂无能力，请先同步该 MCP 服务。
                </div>
              )}
            </aside>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-gray-200 bg-white px-6 py-5 shadow-sm">
        <div>
          <div className="text-lg font-semibold text-gray-900">MCP 接入</div>
          <div className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
            统一管理 MCP 服务、能力清单和连接状态。
          </div>
        </div>
        <button
          onClick={openCreateServerDialog}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          新增 MCP 服务
        </button>
      </div>
      {!servers.length && (
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-5 py-8 text-sm text-gray-500">
          <CircleSlash className="h-5 w-5" />
          暂无 MCP 服务，请新增服务并同步能力。
        </div>
      )}

      {servers.length ? renderServers() : null}
      {renderCapabilityDrawer()}
      {renderServerDialog()}
    </div>
  );
}
