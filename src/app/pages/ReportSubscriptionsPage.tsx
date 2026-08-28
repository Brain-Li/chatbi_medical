import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Edit3,
  Eye,
  FileText,
  PauseCircle,
  PlayCircle,
  Search,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  ReportPushRecord,
  ReportSubscription,
  ReportSubscriptionRun,
  ReportTemplate,
} from '../types';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';

type ReportCenterTab = 'reports' | 'subscriptions';
type DeliveryStatus = '成功' | '失败';

type ReportRecord = {
  run: ReportSubscriptionRun;
  subscription: ReportSubscription;
  reportName: string;
  agentName: string;
  deliveryStatus: DeliveryStatus;
  pushedAt: string;
};

const frequencyLabel: Record<ReportSubscription['frequency'], string> = {
  daily: '每日',
  weekly: '每周',
  monthly: '每月',
  cron: '自定义',
};

const weekDayLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

const creatorNameById: Record<string, string> = {
  admin: '系统管理员',
  lxy: '李晓云',
};

function formatCreatorName(createdBy: string) {
  const normalizedCreator = createdBy.trim();
  return creatorNameById[normalizedCreator] ?? (normalizedCreator || '-');
}

function getTemplateReportName(template: ReportTemplate | undefined, fallback: string) {
  const prompt = template?.templatePrompt?.trim() ?? '';
  const configuredName = prompt.match(/报告(?:名称|名)\s*[：:]\s*([^\n。；;]+)/)?.[1]?.trim();
  if (configuredName) return configuredName;

  const templateName = template?.name?.replace(/模板$/, '').trim();
  return templateName || fallback;
}

function formatSubscriptionSchedule(subscription: ReportSubscription) {
  if (subscription.frequency === 'weekly') {
    return `每${weekDayLabels[(subscription.runDay ?? 1) - 1] ?? '周一'} ${subscription.runTime}`;
  }
  if (subscription.frequency === 'monthly') {
    const runDay = Math.min(28, Math.max(1, subscription.runDay ?? 1));
    return `每月${runDay}号 ${subscription.runTime}`;
  }
  return `${frequencyLabel[subscription.frequency]} ${subscription.runTime}`;
}

const deliveryStatusClass: Record<DeliveryStatus, string> = {
  成功: 'border-[#b7ebc6] bg-[#f0fff4] text-[#00a870]',
  失败: 'border-[#ffccc7] bg-[#fff1f0] text-[#f53f3f]',
};

function getDeliveryStatus(records: ReportPushRecord[]): DeliveryStatus {
  return records.length > 0 && records.every((record) => record.status === '成功') ? '成功' : '失败';
}

function getTimestamp(value: string) {
  const timestamp = new Date(value.replace(/-/g, '/')).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getLatestPushTime(records: ReportPushRecord[]) {
  return records.reduce(
    (latest, record) => getTimestamp(record.sentAt) > getTimestamp(latest) ? record.sentAt : latest,
    '',
  );
}

function StatusBadge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-[6px] border px-2 py-0.5 text-[12px] font-medium leading-5 ${className}`}>
      {label}
    </span>
  );
}

function IconLink({
  to,
  label,
  icon: Icon,
  disabledReason,
}: {
  to: string;
  label: string;
  icon: typeof Eye;
  disabledReason?: string;
}) {
  const disabled = Boolean(disabledReason);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {disabled ? (
          <span
            tabIndex={0}
            className="inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-[6px] text-[#c9cdd4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9cdd4]/60"
            aria-label={disabledReason}
          >
            <button
              type="button"
              disabled
              aria-label={disabledReason}
              className="inline-flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-[6px] text-[#c9cdd4]"
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
            </button>
          </span>
        ) : (
          <Link
            to={to}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] text-[#165dff] transition-colors hover:bg-[#e8f3ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20"
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
          </Link>
        )}
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>{disabledReason ?? label}</TooltipContent>
    </Tooltip>
  );
}

export default function ReportSubscriptionsPage() {
  const {
    agents,
    reportTemplates,
    reportSubscriptions,
    updateReportSubscription,
    deleteReportSubscription,
  } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: ReportCenterTab = searchParams.get('tab') === 'reports' ? 'reports' : 'subscriptions';
  const [query, setQuery] = useState('');
  const [reportStatusFilter, setReportStatusFilter] = useState<'all' | DeliveryStatus>('all');
  const [editingSubscription, setEditingSubscription] = useState<ReportSubscription | null>(null);
  const [pendingDeleteSubscription, setPendingDeleteSubscription] = useState<ReportSubscription | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const activeSubscriptions = useMemo(
    () => reportSubscriptions
      .filter((subscription) => !subscription.deletedAt)
      .sort((left, right) => getTimestamp(right.createdAt) - getTimestamp(left.createdAt)),
    [reportSubscriptions],
  );

  const reportRecords = useMemo<ReportRecord[]>(() => {
    return reportSubscriptions
      .flatMap((subscription) => {
        const agentName = agents.find((item) => item.id === subscription.agentId)?.name ?? '未绑定 Agent';
        const template = reportTemplates.find((item) => item.id === subscription.reportTemplateId);

        return subscription.runs.map((run) => {
          const pushRecords = subscription.pushRecords.filter((record) => !record.runId || record.runId === run.id);
          return {
            run,
            subscription,
            reportName: getTemplateReportName(template, run.reportTitle),
            agentName,
            deliveryStatus: getDeliveryStatus(pushRecords),
            pushedAt: getLatestPushTime(pushRecords),
          };
        });
      })
      .sort((left, right) => {
        const pushedAtDifference = getTimestamp(right.pushedAt) - getTimestamp(left.pushedAt);
        return pushedAtDifference || getTimestamp(right.run.generatedAt) - getTimestamp(left.run.generatedAt);
      });
  }, [agents, reportSubscriptions, reportTemplates]);

  const filteredReports = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return reportRecords.filter((record) => {
      const matchesStatus = reportStatusFilter === 'all' || record.deliveryStatus === reportStatusFilter;
      const matchesQuery = !normalizedQuery || [
        record.reportName,
        record.subscription.name,
        record.subscription.period,
        ...record.subscription.channels,
        formatCreatorName(record.subscription.createdBy),
        record.agentName,
        record.deliveryStatus,
      ].join(' ').toLowerCase().includes(normalizedQuery);
      return matchesStatus && matchesQuery;
    });
  }, [query, reportRecords, reportStatusFilter]);

  const filteredSubscriptions = useMemo(() => {
      const normalizedQuery = query.trim().toLowerCase();
    return activeSubscriptions.filter((subscription) => {
      const template = reportTemplates.find((item) => item.id === subscription.reportTemplateId);
      const agent = agents.find((item) => item.id === subscription.agentId);
      const matchesQuery = !normalizedQuery || [
        subscription.name,
        subscription.reportTheme,
        subscription.period,
        template?.name,
        agent?.name,
        ...subscription.recipients,
        ...subscription.channels,
      ].filter(Boolean).join(' ').toLowerCase().includes(normalizedQuery);
      return matchesQuery;
    });
  }, [activeSubscriptions, agents, query, reportTemplates]);

  const setActiveTab = (tab: ReportCenterTab) => {
    setQuery('');
    const nextParams = new URLSearchParams(searchParams);
    if (tab === 'subscriptions') nextParams.delete('tab');
    else nextParams.set('tab', 'reports');
    setSearchParams(nextParams, { replace: true });
  };

  const openEditDialog = (subscription: ReportSubscription) => {
    setEditingSubscription(subscription);
    setIsDialogOpen(true);
  };

  const toggleSubscriptionStatus = (subscription: ReportSubscription) => {
    const nextStatus = subscription.status === 'running' ? 'paused' : 'running';
    updateReportSubscription(subscription.id, { status: nextStatus });
    toast.success(nextStatus === 'running' ? '订阅任务已恢复' : '订阅任务已暂停');
  };

  return (
    <div className="h-full min-h-0 flex-1 overflow-hidden bg-white font-['PingFang_SC','Microsoft_YaHei',sans-serif]">
      <div className="flex h-full min-h-0 flex-col">
        <header className="shrink-0 border-b border-[#e5e6eb] px-5 pb-0 pt-4 sm:px-6">
          <h1 className="text-[20px] font-semibold leading-7 text-[#1d2129]">订阅与推送</h1>

          <nav aria-label="订阅与推送视图" className="mt-3 flex gap-6">
            {([
              { value: 'subscriptions', label: '订阅管理' },
              { value: 'reports', label: '推送记录' },
            ] as const).map((tab) => {
              const selected = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  aria-current={selected ? 'page' : undefined}
                  onClick={() => setActiveTab(tab.value)}
                  className={`relative flex h-10 items-center text-[14px] leading-[22px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 ${selected ? 'font-medium text-[#165dff]' : 'text-[#4e5969] hover:text-[#1d2129]'}`}
                >
                  {tab.label}
                  {selected && <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-[#165dff]" />}
                </button>
              );
            })}
          </nav>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          <section aria-label={activeTab === 'reports' ? '推送记录' : '订阅管理'}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className={`flex h-10 min-w-0 flex-1 items-center gap-2 rounded-[8px] border border-[#e5e6eb] bg-white px-3 transition-colors focus-within:border-[#165dff] focus-within:ring-2 focus-within:ring-[#165dff]/10 sm:max-w-[360px] ${activeTab === 'reports' ? 'sm:order-2' : ''}`}>
                <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-[#86909c]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={activeTab === 'reports' ? '搜索报告名称、订阅任务或创建人' : '搜索订阅任务、报告模板或接收对象'}
                  className="min-w-0 flex-1 bg-transparent text-[14px] leading-[22px] text-[#1d2129] placeholder:text-[#c9cdd4] focus:outline-none"
                />
              </label>
              {activeTab === 'reports' && (
                <div className="flex w-full shrink-0 items-center gap-2 sm:order-1 sm:w-auto">
                  <span className="shrink-0 text-[14px] leading-[22px] text-[#4e5969]">推送结果：</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`筛选报告推送状态：${reportStatusFilter === 'all' ? '全部' : reportStatusFilter}`}
                        className={`group flex h-10 min-w-0 flex-1 items-center justify-between rounded-[8px] border bg-white px-3 text-[14px] outline-none transition-colors hover:border-[#c9cdd4] focus-visible:border-[#165dff] focus-visible:ring-2 focus-visible:ring-[#165dff]/10 data-[state=open]:border-[#165dff] data-[state=open]:ring-2 data-[state=open]:ring-[#165dff]/10 sm:w-[140px] sm:flex-none ${reportStatusFilter === 'all' ? 'border-[#e5e6eb]' : 'border-[#bedaff] bg-[#f7fbff]'}`}
                      >
                        <span className={reportStatusFilter === 'all' ? 'text-[#4e5969]' : 'font-medium text-[#1d2129]'}>
                          {reportStatusFilter === 'all' ? '全部' : reportStatusFilter}
                        </span>
                        <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-[#86909c] transition-transform duration-150 group-data-[state=open]:rotate-180" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      sideOffset={6}
                      className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[var(--radix-dropdown-menu-trigger-width)] rounded-[8px] border-[#e5e6eb] bg-white p-1 text-[#1d2129] shadow-[0_4px_12px_rgba(29,33,41,0.08)]"
                    >
                      <DropdownMenuRadioGroup
                        value={reportStatusFilter}
                        onValueChange={(value) => setReportStatusFilter(value as 'all' | DeliveryStatus)}
                      >
                        {[
                          { value: 'all', label: '全部' },
                          { value: '成功', label: '成功' },
                          { value: '失败', label: '失败' },
                        ].map((option) => {
                          const selected = reportStatusFilter === option.value;
                          return (
                            <DropdownMenuRadioItem
                              key={option.value}
                              value={option.value}
                              className="h-10 rounded-[6px] py-0 pl-3 pr-3 text-[14px] focus:bg-[#f7f8fa] focus:text-[#1d2129] data-[state=checked]:bg-[#e8f3ff] data-[state=checked]:font-medium data-[state=checked]:text-[#165dff] [&>span:first-child]:hidden"
                            >
                              <span>{option.label}</span>
                              {selected && <Check aria-hidden="true" className="ml-auto h-4 w-4 text-[#165dff]" />}
                            </DropdownMenuRadioItem>
                          );
                        })}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>

            <div className="mt-4 overflow-hidden rounded-[8px] border border-[#e5e6eb]">
              <div className="overflow-x-auto">
                {activeTab === 'reports' ? (
                  <table className="w-full min-w-[960px] table-fixed">
                    <colgroup><col className="w-[230px]" /><col className="w-[160px]" /><col className="w-[100px]" /><col className="w-[120px]" /><col className="w-[170px]" /><col className="w-[100px]" /><col className="w-[80px]" /></colgroup>
                    <thead className="bg-[#f7f8fa]">
                      <tr className="h-11 text-left text-[13px] leading-5 text-[#4e5969]">
                        <th className="px-4 font-medium">报告名称</th><th className="px-4 font-medium">订阅任务</th><th className="px-4 font-medium">接收渠道</th><th className="px-4 font-medium">创建人</th><th className="px-4 font-medium">推送时间</th><th className="px-4 font-medium">推送结果</th><th className="px-4 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e5e6eb]">
                      {filteredReports.length ? filteredReports.map((record) => (
                        <tr key={record.run.id} className="h-16 text-[14px] text-[#1d2129] transition-colors hover:bg-[#f7f8fa]">
                          <td className="px-4 py-3">
                            <Tooltip delayDuration={240}>
                              <TooltipTrigger asChild>
                                <span
                                  tabIndex={0}
                                  aria-label={`报告名称：${record.reportName}`}
                                  className="block max-w-full truncate rounded-[4px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20"
                                >
                                  {record.reportName}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" sideOffset={6} className="max-w-[min(280px,calc(100vw-32px))] whitespace-normal break-words text-left text-wrap leading-5">
                                {record.reportName}
                              </TooltipContent>
                            </Tooltip>
                          </td>
                          <td className="px-4 py-3 text-[#4e5969]"><div className="truncate">{record.subscription.name}</div></td>
                          <td className="px-4 py-3 text-[#4e5969]">{record.subscription.channels.join('、') || '-'}</td>
                          <td className="px-4 py-3 text-[#4e5969]">{formatCreatorName(record.subscription.createdBy)}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-[#4e5969]">{record.pushedAt || '-'}</td>
                          <td className="px-4 py-3"><StatusBadge label={record.deliveryStatus} className={deliveryStatusClass[record.deliveryStatus]} /></td>
                          <td className="px-4 py-3">
                            <IconLink
                              to={record.run.link}
                              label="查看报告"
                              icon={Eye}
                              disabledReason={record.run.status === '成功' ? undefined : '报告生成失败'}
                            />
                          </td>
                        </tr>
                      )) : (
                        <tr><td colSpan={7} className="h-44 px-4 text-center"><FileText aria-hidden="true" className="mx-auto h-8 w-8 text-[#c9cdd4]" /><div className="mt-3 text-[14px] text-[#4e5969]">暂无匹配的报告</div><div className="mt-1 text-[12px] text-[#86909c]">订阅任务执行后，报告会出现在这里</div></td></tr>
                      )}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full min-w-[1160px] table-fixed">
                    <colgroup><col className="w-[180px]" /><col className="w-[150px]" /><col className="w-[100px]" /><col className="w-[130px]" /><col className="w-[170px]" /><col className="w-[100px]" /><col className="w-[194px]" /><col className="w-[136px]" /></colgroup>
                    <thead className="bg-[#f7f8fa]">
                      <tr className="h-11 text-left text-[13px] leading-5 text-[#4e5969]">
                        <th className="px-4 font-medium">订阅任务</th><th className="px-4 font-medium">报告模板</th><th className="px-4 font-medium">数据周期</th><th className="px-4 font-medium">推送计划</th><th className="px-4 font-medium">接收对象</th><th className="px-4 font-medium">接收渠道</th><th className="px-4 font-medium">创建时间</th><th className="px-4 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e5e6eb]">
                      {filteredSubscriptions.length ? filteredSubscriptions.map((subscription) => {
                        const template = reportTemplates.find((item) => item.id === subscription.reportTemplateId);
                        const visibleRecipients = subscription.recipients.slice(0, 2);
                        const hiddenRecipientCount = Math.max(0, subscription.recipients.length - visibleRecipients.length);
                        const channelText = subscription.channels.join('、') || '-';
                        const subscriptionNameCharacters = Array.from(subscription.name);
                        const displaySubscriptionName = subscriptionNameCharacters.length > 20
                          ? `${subscriptionNameCharacters.slice(0, 20).join('')}...`
                          : subscription.name;
                        return (
                          <tr key={subscription.id} className="h-[68px] text-[14px] text-[#1d2129] transition-colors hover:bg-[#f7f8fa]">
                            <td className="px-4 py-3">
                              <Tooltip delayDuration={240}>
                                <TooltipTrigger asChild>
                                  <span
                                    tabIndex={0}
                                    aria-label={`订阅任务：${subscription.name}`}
                                    className="block max-w-full truncate rounded-[4px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20"
                                  >
                                    {displaySubscriptionName}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" sideOffset={6} className="max-w-[min(280px,calc(100vw-32px))] whitespace-normal break-words text-left text-wrap leading-5">
                                  {subscription.name}
                                </TooltipContent>
                              </Tooltip>
                            </td>
                            <td className="px-4 py-3"><div className="truncate text-[#4e5969]">{template?.name ?? '模板已删除'}</div></td>
                            <td className="px-4 py-3 text-[#4e5969]">{subscription.period || '-'}</td>
                            <td className="px-4 py-3 text-[#4e5969]">{formatSubscriptionSchedule(subscription)}</td>
                            <td className="px-4 py-3">
                              <Tooltip delayDuration={240}>
                                <TooltipTrigger asChild>
                                  <div
                                    tabIndex={0}
                                    aria-label={`接收对象：${subscription.recipients.join('、') || '暂无'}`}
                                    className="flex min-w-0 items-center gap-1.5 rounded-[4px] text-[#4e5969] outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20"
                                  >
                                    <span className="truncate">{visibleRecipients.join('、') || '-'}</span>
                                    {hiddenRecipientCount > 0 && (
                                      <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-[#f2f3f5] px-1.5 text-[11px] leading-5 text-[#4e5969]">+{hiddenRecipientCount}</span>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" sideOffset={6} className="max-w-[280px] text-left">
                                  {subscription.recipients.length ? (
                                    <span className="flex flex-wrap">
                                      {subscription.recipients.map((recipient, index) => (
                                        <span key={`${recipient}-${index}`} className="whitespace-nowrap">
                                          {recipient}{index < subscription.recipients.length - 1 ? '、' : ''}
                                        </span>
                                      ))}
                                    </span>
                                  ) : '暂无接收对象'}
                                </TooltipContent>
                              </Tooltip>
                            </td>
                            <td className="px-4 py-3">
                              <Tooltip delayDuration={240}>
                                <TooltipTrigger asChild>
                                  <div
                                    tabIndex={0}
                                    aria-label={`接收渠道：${channelText}`}
                                    className="truncate rounded-[4px] text-[#4e5969] outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20"
                                  >
                                    {channelText}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" sideOffset={6}>
                                  {channelText === '-' ? '暂无接收渠道' : channelText}
                                </TooltipContent>
                              </Tooltip>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-[#4e5969]">{subscription.createdAt || '-'}</td>
                            <td className="px-4 py-3"><div className="flex items-center gap-1 whitespace-nowrap"><ConfigActionIconButton onClick={() => toggleSubscriptionStatus(subscription)} icon={subscription.status === 'running' ? PauseCircle : PlayCircle} label={subscription.status === 'running' ? '暂停任务' : '恢复任务'} variant={subscription.status === 'running' ? 'neutral' : 'test'} /><ConfigActionIconButton onClick={() => openEditDialog(subscription)} icon={Edit3} label="编辑订阅" variant="edit" /><ConfigActionIconButton onClick={() => setPendingDeleteSubscription(subscription)} icon={Trash2} label="删除订阅" variant="delete" /></div></td>
                          </tr>
                        );
                      }) : (
                        <tr><td colSpan={8} className="h-44 px-4 text-center"><CalendarClock aria-hidden="true" className="mx-auto h-8 w-8 text-[#c9cdd4]" /><div className="mt-3 text-[14px] text-[#4e5969]">暂无匹配的订阅任务</div><Link to="/templates" className="mt-2 inline-flex items-center gap-1 text-[13px] text-[#165dff]">去模板库创建订阅<ChevronRight aria-hidden="true" className="h-4 w-4" /></Link></td></tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      <ReportSubscriptionDialog
        open={isDialogOpen}
        onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingSubscription(null); }}
        subscription={editingSubscription}
      />

      <AlertDialog open={Boolean(pendingDeleteSubscription)} onOpenChange={(open) => { if (!open) setPendingDeleteSubscription(null); }}>
        <AlertDialogContent className="max-w-[400px] rounded-[8px] border-[#e5e6eb]">
          <AlertDialogHeader><AlertDialogTitle>删除订阅任务</AlertDialogTitle><AlertDialogDescription>确认删除「{pendingDeleteSubscription?.name}」？已有报告仍会保留在报告记录中。</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={() => { if (pendingDeleteSubscription) deleteReportSubscription(pendingDeleteSubscription.id); setPendingDeleteSubscription(null); toast.success('订阅任务已删除'); }} className="bg-[#f53f3f] text-white hover:bg-[#d9363e]">删除</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
