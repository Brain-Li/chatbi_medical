import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  CalendarClock,
  CheckCircle2,
  Edit3,
  FileText,
  Mail,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Search,
  Send,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { ReportSubscription, ReportSubscriptionStatus } from '../types';
import { ConfigActionIconButton } from '../components/ConfigActionIconButton';
import { ReportSubscriptionDialog } from '../components/ReportSubscriptionDialog';
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

const frequencyLabel: Record<ReportSubscription['frequency'], string> = {
  daily: '每日',
  weekly: '每周',
  monthly: '每月',
  cron: '自定义',
};

const statusLabel: Record<ReportSubscriptionStatus, string> = {
  running: '运行中',
  paused: '已暂停',
  needs_attention: '需处理',
};

const statusClass: Record<ReportSubscriptionStatus, string> = {
  running: 'bg-emerald-50 text-emerald-700',
  paused: 'bg-gray-100 text-gray-600',
  needs_attention: 'bg-amber-50 text-amber-700',
};

function getLastStatusClass(status: ReportSubscription['lastStatus']) {
  if (status === '成功') return 'bg-emerald-50 text-emerald-700';
  if (status === '重试中') return 'bg-blue-50 text-blue-700';
  return 'bg-red-50 text-red-700';
}

export default function ReportSubscriptionsPage() {
  const {
    agents,
    reportTemplates,
    reportSubscriptions,
    updateReportSubscription,
    deleteReportSubscription,
  } = useWorkspace();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ReportSubscriptionStatus>('all');
  const [editingSubscription, setEditingSubscription] = useState<ReportSubscription | null>(null);
  const [pendingDeleteSubscription, setPendingDeleteSubscription] =
    useState<ReportSubscription | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [testResultById, setTestResultById] = useState<Record<string, string>>({});

  const filteredSubscriptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return reportSubscriptions.filter((subscription) => {
      const template = reportTemplates.find((item) => item.id === subscription.reportTemplateId);
      const agent = agents.find((item) => item.id === subscription.agentId);
      const matchesStatus = statusFilter === 'all' || subscription.status === statusFilter;
      const matchesQuery =
        !normalizedQuery ||
        [
          subscription.name,
          subscription.reportTheme,
          subscription.period,
          template?.name,
          agent?.name,
          ...subscription.recipients,
          ...subscription.channels,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesStatus && matchesQuery;
    });
  }, [agents, query, reportSubscriptions, reportTemplates, statusFilter]);

  const summary = useMemo(
    () => ({
      running: reportSubscriptions.filter((item) => item.status === 'running').length,
      needsAttention: reportSubscriptions.filter((item) => item.status === 'needs_attention').length,
      retrying: reportSubscriptions.filter((item) => item.lastStatus === '重试中').length,
    }),
    [reportSubscriptions],
  );

  const openEditDialog = (subscription: ReportSubscription) => {
    setEditingSubscription(subscription);
    setIsDialogOpen(true);
  };

  const toggleSubscriptionStatus = (subscription: ReportSubscription) => {
    updateReportSubscription(subscription.id, {
      status: subscription.status === 'paused' ? 'running' : 'paused',
    });
  };

  const handleTestSend = (subscription: ReportSubscription) => {
    const target = subscription.recipients.slice(0, 2).join('、') || '经营分析组';
    setTestResultById((current) => ({
      ...current,
      [subscription.id]: `测试发送成功：通过${subscription.channels.join('、')}发送样例报告给 ${target}。`,
    }));
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-transparent px-6 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-lg font-semibold text-gray-950">
                <CalendarClock className="h-5 w-5 text-blue-600" />
                订阅管理
              </div>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                查看和维护从模板创建的订阅任务，管理定时生成、自动推送、运行记录和失败重试状态。
              </p>
            </div>
            <Link
              to="/templates"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
            >
              <FileText className="h-4 w-4" />
              去模板库订阅
            </Link>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-4">
              <div className="flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                运行中
              </div>
              <div className="mt-2 text-2xl font-semibold text-emerald-900">{summary.running}</div>
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4">
              <div className="flex items-center gap-2 text-sm text-blue-700">
                <RefreshCw className="h-4 w-4" />
                重试中
              </div>
              <div className="mt-2 text-2xl font-semibold text-blue-900">{summary.retrying}</div>
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-4">
              <div className="flex items-center gap-2 text-sm text-amber-700">
                <TriangleAlert className="h-4 w-4" />
                需处理
              </div>
              <div className="mt-2 text-2xl font-semibold text-amber-900">{summary.needsAttention}</div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 md:flex-row">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | ReportSubscriptionStatus)}
              className="h-11 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none md:w-40"
            >
              <option value="all">全部状态</option>
              <option value="running">运行中</option>
              <option value="paused">已暂停</option>
              <option value="needs_attention">需处理</option>
            </select>
            <div className="flex flex-1 items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <Search className="h-4 w-4 text-gray-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索任务、模板、Agent、接收对象"
                className="w-full bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
              />
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] table-fixed">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[14%]" />
                <col className="w-[15%]" />
                <col className="w-[14%]" />
                <col className="w-[13%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead className="bg-gray-50">
                <tr className="border-b border-gray-200 text-left text-sm text-gray-600">
                  <th className="px-6 py-3">订阅任务</th>
                  <th className="px-6 py-3">模板 / Agent</th>
                  <th className="px-6 py-3">频率</th>
                  <th className="px-6 py-3">接收对象</th>
                  <th className="px-6 py-3">下次执行</th>
                  <th className="px-6 py-3">状态</th>
                  <th className="px-6 py-3">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredSubscriptions.length ? (
                  filteredSubscriptions.map((subscription) => {
                    const template = reportTemplates.find((item) => item.id === subscription.reportTemplateId);
                    const agent = agents.find((item) => item.id === subscription.agentId);

                    return (
                      <tr key={subscription.id} className="align-top text-sm text-gray-700 hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{subscription.name}</div>
                          <div className="mt-1 text-xs text-gray-500">{subscription.reportTheme}</div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {subscription.channels.map((channel) => (
                              <span
                                key={channel}
                                className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
                              >
                                {channel === '邮件' ? <Mail className="h-3 w-3" /> : <Send className="h-3 w-3" />}
                                {channel}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{template?.name ?? '模板已删除'}</div>
                          <div className="mt-1 text-xs text-gray-500">{agent?.name ?? '未绑定 Agent'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div>{frequencyLabel[subscription.frequency]} {subscription.runTime}</div>
                          <div className="mt-1 text-xs text-gray-500">{subscription.period}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="line-clamp-2">{subscription.recipients.join('、')}</div>
                          <div className="mt-1 text-xs text-gray-500">{subscription.outputFormats.join('、')}</div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <div>{subscription.nextRunAt}</div>
                          <span
                            className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs ${getLastStatusClass(subscription.lastStatus)}`}
                          >
                            最近：{subscription.lastStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClass[subscription.status]}`}
                          >
                            {statusLabel[subscription.status]}
                          </span>
                          {testResultById[subscription.id] && (
                            <div className="mt-2 text-xs leading-5 text-emerald-700">
                              {testResultById[subscription.id]}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1 whitespace-nowrap">
                            <ConfigActionIconButton
                              onClick={() => toggleSubscriptionStatus(subscription)}
                              icon={subscription.status === 'paused' ? PlayCircle : PauseCircle}
                              label={subscription.status === 'paused' ? '启用' : '暂停'}
                              variant={subscription.status === 'paused' ? 'test' : 'neutral'}
                            />
                            <ConfigActionIconButton
                              onClick={() => handleTestSend(subscription)}
                              icon={Send}
                              label="测试发送"
                              variant="test"
                            />
                            <ConfigActionIconButton
                              onClick={() => openEditDialog(subscription)}
                              icon={Edit3}
                              label="编辑"
                              variant="edit"
                            />
                            <ConfigActionIconButton
                              onClick={() => setPendingDeleteSubscription(subscription)}
                              icon={Trash2}
                              label="删除"
                              variant="delete"
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-14 text-center text-sm text-gray-500">
                      暂无匹配的订阅任务
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {filteredSubscriptions.map((subscription) => (
            <div key={`${subscription.id}-records`} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-gray-900">{subscription.name}</div>
                  <div className="mt-1 text-sm text-gray-500">运行实例与推送记录</div>
                </div>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  重试上限 {subscription.retryLimit} 次
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {subscription.runs.map((run) => (
                  <div key={run.id} className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-medium text-gray-900">{run.reportTitle}</div>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${getLastStatusClass(run.status)}`}>
                        {run.status}
                      </span>
                    </div>
                    <div className="mt-2 text-xs leading-5 text-gray-500">
                      生成时间：{run.generatedAt} · 重试：{run.retryCount} 次
                    </div>
                    {run.failureReason && (
                      <div className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
                        {run.failureReason}
                      </div>
                    )}
                  </div>
                ))}
                {subscription.pushRecords.map((record) => (
                  <div key={record.id} className="flex items-start gap-3 text-sm">
                    <span
                      className={`mt-0.5 h-2 w-2 rounded-full ${
                        record.status === '成功' ? 'bg-emerald-500' : 'bg-red-500'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-gray-900">
                        {record.sentAt} · {record.channel} · {record.target}
                      </div>
                      <div className="mt-1 text-gray-500">{record.note}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>

      <ReportSubscriptionDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        subscription={editingSubscription}
      />

      <AlertDialog
        open={Boolean(pendingDeleteSubscription)}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteSubscription(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除订阅任务</AlertDialogTitle>
            <AlertDialogDescription>
              确认删除「{pendingDeleteSubscription?.name}」？历史运行记录也会从当前工作区移除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDeleteSubscription) deleteReportSubscription(pendingDeleteSubscription.id);
                setPendingDeleteSubscription(null);
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
