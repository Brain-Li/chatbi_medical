import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Send, Save } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  ReportSubscription,
  ReportSubscriptionChannel,
  ReportSubscriptionFrequency,
  ReportTemplate,
} from '../types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

type ReportSubscriptionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription?: ReportSubscription | null;
  template?: ReportTemplate | null;
  reportTitle?: string;
  reportPeriod?: string;
};

type SubscriptionFormState = {
  name: string;
  reportTemplateId: string;
  agentId: string;
  reportTheme: string;
  period: string;
  frequency: ReportSubscriptionFrequency;
  cronExpression: string;
  runTime: string;
  timezone: string;
  holidayPolicy: ReportSubscription['holidayPolicy'];
  recipients: string;
  channels: ReportSubscriptionChannel[];
  outputFormats: string[];
  permissionPolicy: string;
};

const frequencyLabels: Record<ReportSubscriptionFrequency, string> = {
  daily: '每日',
  weekly: '每周',
  monthly: '每月',
  cron: '自定义 Cron',
};

const holidayPolicyLabels: Record<ReportSubscription['holidayPolicy'], string> = {
  run: '照常推送',
  skip: '跳过节假日',
  next_workday: '顺延到工作日',
};

function splitList(value: string) {
  return value
    .split(/[,，、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDateTime(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');

  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  ].join(' ');
}

function resolveNextRunAt(frequency: ReportSubscriptionFrequency, runTime: string) {
  const [hour = '8', minute = '0'] = runTime.split(':');
  const nextRun = new Date('2026-07-01T00:00:00+08:00');

  if (frequency === 'weekly') nextRun.setDate(nextRun.getDate() + 5);
  else if (frequency === 'monthly') nextRun.setMonth(nextRun.getMonth() + 1, 1);
  else nextRun.setDate(nextRun.getDate() + 1);

  nextRun.setHours(Number(hour) || 8, Number(minute) || 0, 0, 0);
  return formatDateTime(nextRun);
}

function createEmptyForm(
  template: ReportTemplate | null | undefined,
  reportTitle?: string,
  reportPeriod?: string,
): SubscriptionFormState {
  return {
    name: reportTitle ? `${reportTitle}订阅` : template ? `${template.name}订阅` : '新建报告订阅',
    reportTemplateId: template?.id ?? '',
    agentId: template?.applicableAgentIds[0] ?? '',
    reportTheme: reportTitle || template?.name || '',
    period: reportPeriod || template?.parameters.find((param) => param.defaultValue)?.defaultValue || '昨日',
    frequency: template?.category.includes('月') ? 'monthly' : template?.category.includes('周') ? 'weekly' : 'daily',
    cronExpression: '0 8 * * *',
    runTime: '08:00',
    timezone: 'Asia/Shanghai',
    holidayPolicy: 'run',
    recipients: '医院经营班子, 经营分析组',
    channels: template?.pushChannels.includes('邮件') ? ['邮件'] : ['站内消息'],
    outputFormats: ['在线报告链接', 'PDF 附件'],
    permissionPolicy: '按收件人权限自动过滤数据范围，患者级明细默认脱敏。',
  };
}

function createFormFromSubscription(subscription: ReportSubscription): SubscriptionFormState {
  return {
    name: subscription.name,
    reportTemplateId: subscription.reportTemplateId,
    agentId: subscription.agentId,
    reportTheme: subscription.reportTheme,
    period: subscription.period,
    frequency: subscription.frequency,
    cronExpression: subscription.cronExpression ?? '0 8 * * *',
    runTime: subscription.runTime,
    timezone: subscription.timezone,
    holidayPolicy: subscription.holidayPolicy,
    recipients: subscription.recipients.join(', '),
    channels: subscription.channels,
    outputFormats: subscription.outputFormats,
    permissionPolicy: subscription.permissionPolicy,
  };
}

export function ReportSubscriptionDialog({
  open,
  onOpenChange,
  subscription,
  template,
  reportTitle,
  reportPeriod,
}: ReportSubscriptionDialogProps) {
  const {
    agents,
    reportTemplates,
    addReportSubscription,
    updateReportSubscription,
  } = useWorkspace();
  const [form, setForm] = useState<SubscriptionFormState>(() =>
    subscription ? createFormFromSubscription(subscription) : createEmptyForm(template, reportTitle, reportPeriod),
  );
  const [testMessage, setTestMessage] = useState('');

  const enabledTemplates = useMemo(
    () => reportTemplates.filter((item) => item.status !== 'disabled'),
    [reportTemplates],
  );
  const selectedTemplate = useMemo(
    () => reportTemplates.find((item) => item.id === form.reportTemplateId) ?? template ?? null,
    [form.reportTemplateId, reportTemplates, template],
  );
  const reportAgents = useMemo(
    () => agents.filter((agent) => agent.type === 'report' && agent.reportConfig?.scheduleEnabled !== false),
    [agents],
  );
  const availableAgents = useMemo(() => {
    if (!selectedTemplate?.applicableAgentIds.length) return reportAgents;

    return reportAgents.filter((agent) => selectedTemplate.applicableAgentIds.includes(agent.id));
  }, [reportAgents, selectedTemplate]);

  useEffect(() => {
    if (!open) return;
    setForm(subscription ? createFormFromSubscription(subscription) : createEmptyForm(template, reportTitle, reportPeriod));
    setTestMessage('');
  }, [open, reportPeriod, reportTitle, subscription, template]);

  useEffect(() => {
    if (!open) return;
    if (form.agentId || !availableAgents[0]) return;
    setForm((current) => ({ ...current, agentId: availableAgents[0].id }));
  }, [availableAgents, form.agentId, open]);

  const toggleChannel = (channel: ReportSubscriptionChannel) => {
    setForm((current) => {
      const hasChannel = current.channels.includes(channel);
      const nextChannels = hasChannel
        ? current.channels.filter((item) => item !== channel)
        : [...current.channels, channel];

      return {
        ...current,
        channels: nextChannels.length ? nextChannels : [channel],
      };
    });
  };

  const toggleOutputFormat = (format: string) => {
    setForm((current) => {
      const hasFormat = current.outputFormats.includes(format);
      const nextFormats = hasFormat
        ? current.outputFormats.filter((item) => item !== format)
        : [...current.outputFormats, format];

      return {
        ...current,
        outputFormats: nextFormats.length ? nextFormats : [format],
      };
    });
  };

  const handleSave = () => {
    const now = formatDateTime(new Date('2026-07-01T10:00:00+08:00'));
    const recipients = splitList(form.recipients);
    const nextSubscription: ReportSubscription = {
      id: subscription?.id ?? `sub-${Date.now()}`,
      name: form.name.trim() || '未命名报告订阅',
      reportTemplateId: form.reportTemplateId || selectedTemplate?.id || enabledTemplates[0]?.id || '',
      agentId: form.agentId || availableAgents[0]?.id || '',
      reportTheme: form.reportTheme.trim() || selectedTemplate?.name || '经营报告',
      period: form.period.trim() || '昨日',
      frequency: form.frequency,
      cronExpression: form.frequency === 'cron' ? form.cronExpression.trim() : undefined,
      runTime: form.runTime,
      timezone: form.timezone,
      holidayPolicy: form.holidayPolicy,
      recipients: recipients.length ? recipients : ['经营分析组'],
      channels: form.channels,
      outputFormats: form.outputFormats,
      permissionPolicy: form.permissionPolicy.trim() || '按收件人权限自动过滤数据范围。',
      nextRunAt: resolveNextRunAt(form.frequency, form.runTime),
      lastRunAt: subscription?.lastRunAt,
      lastStatus: subscription?.lastStatus ?? '成功',
      status: subscription?.status ?? 'running',
      retryLimit: subscription?.retryLimit ?? 3,
      createdBy: subscription?.createdBy ?? 'admin',
      createdAt: subscription?.createdAt ?? now,
      updatedAt: now,
      runs: subscription?.runs ?? [],
      pushRecords: subscription?.pushRecords ?? [],
    };

    if (subscription) updateReportSubscription(subscription.id, nextSubscription);
    else addReportSubscription(nextSubscription);

    onOpenChange(false);
  };

  const handleTestSend = () => {
    const channelText = form.channels.join('、');
    const targetText = splitList(form.recipients).slice(0, 2).join('、') || '经营分析组';
    setTestMessage(`测试发送已完成：通过${channelText}发送样例报告给 ${targetText}，未创建正式运行记录。`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-blue-600" />
            {subscription ? '编辑订阅' : template ? '订阅模板' : '新建订阅'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.9fr)]">
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm text-gray-700">任务名称</label>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="mt-2 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700">报告模板</label>
                <select
                  value={form.reportTemplateId}
                  onChange={(event) => {
                    const nextTemplate = reportTemplates.find((item) => item.id === event.target.value);
                    setForm((current) => ({
                      ...current,
                      reportTemplateId: event.target.value,
                      agentId: nextTemplate?.applicableAgentIds[0] ?? current.agentId,
                      reportTheme: nextTemplate?.name ?? current.reportTheme,
                    }));
                  }}
                  className="mt-2 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
                >
                  {(enabledTemplates.length ? enabledTemplates : reportTemplates).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700">报告 Agent</label>
                <select
                  value={form.agentId}
                  onChange={(event) => setForm((current) => ({ ...current, agentId: event.target.value }))}
                  className="mt-2 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
                >
                  {availableAgents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700">统计周期</label>
                <input
                  value={form.period}
                  onChange={(event) => setForm((current) => ({ ...current, period: event.target.value }))}
                  className="mt-2 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-700">报告主题</label>
              <input
                value={form.reportTheme}
                onChange={(event) => setForm((current) => ({ ...current, reportTheme: event.target.value }))}
                className="mt-2 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className="block text-sm text-gray-700">执行频率</label>
                <select
                  value={form.frequency}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      frequency: event.target.value as ReportSubscriptionFrequency,
                    }))
                  }
                  className="mt-2 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
                >
                  {Object.entries(frequencyLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700">推送时间</label>
                <input
                  type="time"
                  value={form.runTime}
                  onChange={(event) => setForm((current) => ({ ...current, runTime: event.target.value }))}
                  className="mt-2 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700">时区</label>
                <select
                  value={form.timezone}
                  onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))}
                  className="mt-2 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="Asia/Shanghai">Asia/Shanghai</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-700">节假日策略</label>
                <select
                  value={form.holidayPolicy}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      holidayPolicy: event.target.value as ReportSubscription['holidayPolicy'],
                    }))
                  }
                  className="mt-2 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
                >
                  {Object.entries(holidayPolicyLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {form.frequency === 'cron' && (
              <div>
                <label className="block text-sm text-gray-700">Cron 表达式</label>
                <input
                  value={form.cronExpression}
                  onChange={(event) => setForm((current) => ({ ...current, cronExpression: event.target.value }))}
                  className="mt-2 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-sm text-gray-700">接收对象</label>
              <textarea
                value={form.recipients}
                onChange={(event) => setForm((current) => ({ ...current, recipients: event.target.value }))}
                rows={3}
                placeholder="用户、用户组、角色或邮箱，多个对象用逗号分隔"
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm leading-6 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm text-gray-700">推送渠道</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(['站内消息', '邮件'] as ReportSubscriptionChannel[]).map((channel) => (
                    <button
                      key={channel}
                      type="button"
                      onClick={() => toggleChannel(channel)}
                      className={`h-9 rounded-lg border px-3 text-sm ${
                        form.channels.includes(channel)
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {channel}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-700">输出格式</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {['在线报告链接', 'PDF 附件', 'Markdown'].map((format) => (
                    <button
                      key={format}
                      type="button"
                      onClick={() => toggleOutputFormat(format)}
                      className={`h-9 rounded-lg border px-3 text-sm ${
                        form.outputFormats.includes(format)
                          ? 'border-blue-600 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {format}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-700">权限策略</label>
              <textarea
                value={form.permissionPolicy}
                onChange={(event) => setForm((current) => ({ ...current, permissionPolicy: event.target.value }))}
                rows={3}
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm leading-6 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4">
              <div className="text-sm font-medium text-blue-900">下次执行预估</div>
              <div className="mt-2 text-2xl font-semibold text-blue-700">
                {resolveNextRunAt(form.frequency, form.runTime)}
              </div>
              <div className="mt-2 text-sm leading-6 text-blue-900/80">
                调度器按 nextRunAt 拉取任务；失败后最多重试 3 次，失败原因会进入运行记录。
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="text-sm font-medium text-gray-900">推送预览</div>
              <div className="mt-3 space-y-2 text-sm text-gray-600">
                <div>模板：{selectedTemplate?.name ?? '-'}</div>
                <div>频率：{frequencyLabels[form.frequency]}</div>
                <div>渠道：{form.channels.join('、')}</div>
                <div>接收：{splitList(form.recipients).join('、') || '-'}</div>
              </div>
            </div>

            {testMessage && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
                {testMessage}
              </div>
            )}
          </aside>
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={handleTestSend}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Send className="h-4 w-4" />
            测试发送
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Save className="h-4 w-4" />
            保存订阅
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
