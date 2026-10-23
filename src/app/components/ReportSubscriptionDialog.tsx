import { guardLicense } from '../license/service';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BellRing,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileText,
  Mail,
  Minus,
  Search,
  UserRound,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  ReportSubscription,
  ReportSubscriptionChannel,
  ReportSubscriptionFrequency,
  ReportTemplate,
} from '../types';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

type ReportSubscriptionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription?: ReportSubscription | null;
  template?: ReportTemplate | null;
  reportTitle?: string;
  reportPeriod?: string;
  recipientMode?: 'self' | 'admin';
  currentUserName?: string;
};

type SubscriptionFormState = {
  name: string;
  reportTemplateId: string;
  agentId: string;
  reportTheme: string;
  period: string;
  frequency: ReportSubscriptionFrequency;
  runDay: number;
  runTime: string;
  timezone: string;
  recipients: string;
  channels: ReportSubscriptionChannel[];
  outputFormats: string[];
  permissionPolicy: string;
};

type FormErrors = Partial<Record<'name' | 'template' | 'runTime' | 'recipients' | 'channels', string>>;

type ReportPeriodKind = 'daily' | 'weekly' | 'monthly';

type ReportPeriodOption = {
  value: string;
  label: string;
};

const frequencyOptions: Array<{ value: ReportSubscriptionFrequency; label: string }> = [
  { value: 'daily', label: '每日' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
];

const weekDayOptions = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((label, index) => ({
  value: index + 1,
  label,
}));
const monthDayOptions = Array.from({ length: 28 }, (_, index) => ({
  value: index + 1,
  label: `${index + 1} 号`,
}));

const periodOptions: ReportPeriodOption[] = [
  { value: '上一自然日', label: '上一自然日' },
  { value: '上一自然周', label: '上一自然周（周一至周日）' },
  { value: '上一自然月', label: '上一自然月' },
];

const defaultPeriodByKind: Record<ReportPeriodKind, string> = {
  daily: '上一自然日',
  weekly: '上一自然周',
  monthly: '上一自然月',
};

const periodValueAliases: Record<string, string> = {
  昨天: '上一自然日',
  昨日: '上一自然日',
  上周: '上一自然周',
  上月: '上一自然月',
};

const hourOptions = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'));
const minuteOptions = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));

const channelOptions: Array<{
  value: ReportSubscriptionChannel;
  icon: typeof Mail;
}> = [
  { value: '邮件', icon: Mail },
];

const recipientDepartments = [
  {
    name: '医院经营班子',
    members: [
      { name: '王建国', role: '院长' },
      { name: '刘芳', role: '副院长' },
      { name: '周宁', role: '运营副院长' },
    ],
  },
  {
    name: '经营分析组',
    members: [
      { name: '李敏', role: '组长' },
      { name: '孙悦', role: '数据分析师' },
      { name: '高远', role: '运营分析师' },
    ],
  },
  {
    name: '医务部',
    members: [
      { name: '张伟', role: '主任' },
      { name: '林晓', role: '医务专员' },
      { name: '何涛', role: '质控专员' },
    ],
  },
  {
    name: '财务部',
    members: [
      { name: '陈静', role: '主任' },
      { name: '吴迪', role: '财务分析师' },
      { name: '罗倩', role: '预算专员' },
    ],
  },
  {
    name: '门诊部',
    members: [
      { name: '赵磊', role: '主任' },
      { name: '郑欣', role: '门诊运营' },
      { name: '彭越', role: '排班专员' },
    ],
  },
];

const fieldClassName = 'h-10 w-full rounded-[8px] border border-[#e5e6eb] bg-white px-3 text-[14px] leading-[22px] text-[#1d2129] outline-none transition-colors placeholder:text-[#c9cdd4] focus:border-[#165dff] focus:ring-2 focus:ring-[#165dff]/10';
const errorFieldClassName = 'border-[#f53f3f] focus:border-[#f53f3f] focus:ring-[#f53f3f]/10';

function splitList(value: string) {
  return value
    .split(/[,，、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDateTime(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0');

  return [
    formatDate(date),
    `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  ].join(' ');
}

function normalizeRunDay(frequency: ReportSubscriptionFrequency, runDay?: number) {
  const maxDay = frequency === 'weekly' ? 7 : 28;
  const day = Number.isFinite(runDay) ? Math.trunc(runDay as number) : 1;
  return Math.min(maxDay, Math.max(1, day));
}

function resolveNextRunDate(
  frequency: ReportSubscriptionFrequency,
  runTime: string,
  runDay = 1,
  now = new Date(),
) {
  const [rawHour, rawMinute] = runTime.split(':').map(Number);
  const hour = Number.isFinite(rawHour) ? rawHour : 8;
  const minute = Number.isFinite(rawMinute) ? rawMinute : 0;
  let nextRun = new Date(now);

  nextRun.setSeconds(0, 0);
  nextRun.setHours(hour, minute, 0, 0);

  if (frequency === 'weekly') {
    const targetDay = normalizeRunDay(frequency, runDay) % 7;
    const daysUntilTarget = (targetDay - nextRun.getDay() + 7) % 7;
    nextRun.setDate(nextRun.getDate() + daysUntilTarget);
    if (nextRun <= now) nextRun.setDate(nextRun.getDate() + 7);
  } else if (frequency === 'monthly') {
    const targetDate = normalizeRunDay(frequency, runDay);
    const createMonthlyRun = (year: number, month: number) => {
      const lastDay = new Date(year, month + 1, 0).getDate();
      return new Date(year, month, Math.min(targetDate, lastDay), hour, minute, 0, 0);
    };
    nextRun = createMonthlyRun(now.getFullYear(), now.getMonth());
    if (nextRun <= now) nextRun = createMonthlyRun(now.getFullYear(), now.getMonth() + 1);
  } else if (nextRun <= now) {
    nextRun.setDate(nextRun.getDate() + 1);
  }

  return nextRun;
}

export function resolveNextRunAt(
  frequency: ReportSubscriptionFrequency,
  runTime: string,
  now = new Date(),
  runDay = 1,
) {
  return formatDateTime(resolveNextRunDate(frequency, runTime, runDay, now));
}

function getDefaultFrequency(template?: ReportTemplate | null): ReportSubscriptionFrequency {
  if (template?.category.includes('月')) return 'monthly';
  if (template?.category.includes('周')) return 'weekly';
  return 'daily';
}

function getPeriodKind(
  template?: ReportTemplate | null,
  frequency: ReportSubscriptionFrequency = getDefaultFrequency(template),
): ReportPeriodKind {
  if (template?.category.includes('月')) return 'monthly';
  if (template?.category.includes('周')) return 'weekly';
  if (template?.category.includes('日')) return 'daily';
  if (frequency === 'monthly' || frequency === 'weekly') return frequency;
  return 'daily';
}

function getDefaultPeriod(
  template?: ReportTemplate | null,
  currentPeriod?: string,
  frequency?: ReportSubscriptionFrequency,
) {
  const normalizedPeriod = currentPeriod ? periodValueAliases[currentPeriod] ?? currentPeriod : '';
  if (periodOptions.some((option) => option.value === normalizedPeriod)) return normalizedPeriod;
  return defaultPeriodByKind[getPeriodKind(template, frequency)];
}

function createEmptyForm(
  template: ReportTemplate | null | undefined,
  reportTitle?: string,
  reportPeriod?: string,
  recipientMode: 'self' | 'admin' = 'admin',
  currentUserName = '李敏',
): SubscriptionFormState {
  const frequency = getDefaultFrequency(template);

  return {
    name: '',
    reportTemplateId: template?.id ?? '',
    agentId: template?.applicableAgentIds[0] ?? '',
    reportTheme: reportTitle || template?.name || '',
    period: getDefaultPeriod(template, reportPeriod, frequency),
    frequency,
    runDay: 1,
    runTime: '08:00',
    timezone: 'Asia/Shanghai',
    recipients: recipientMode === 'self' ? currentUserName : '王建国, 李敏',
    channels: ['邮件'],
    outputFormats: template?.outputFormats.length ? template.outputFormats : ['在线报告链接', 'PDF 附件'],
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
    frequency: subscription.frequency === 'cron' ? 'daily' : subscription.frequency,
    runDay: normalizeRunDay(subscription.frequency, subscription.runDay),
    runTime: subscription.runTime,
    timezone: subscription.timezone,
    recipients: subscription.recipients.join(', '),
    channels: subscription.channels.includes('邮件') ? ['邮件'] : [],
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
  recipientMode = 'admin',
  currentUserName = '李敏',
}: ReportSubscriptionDialogProps) {
  const { agents, reportTemplates, addReportSubscription, updateReportSubscription } = useWorkspace();
  const draftKey = 'chatbi.subscription-draft.' + (subscription?.id ?? template?.id ?? reportTitle ?? 'new');
  const [form, setForm] = useState<SubscriptionFormState>(() =>
    subscription
      ? createFormFromSubscription(subscription)
      : createEmptyForm(template, reportTitle, reportPeriod, recipientMode, currentUserName),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [recipientPickerOpen, setRecipientPickerOpen] = useState(false);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [recipientDepartmentName, setRecipientDepartmentName] = useState(recipientDepartments[0].name);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const recipientsTriggerRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);
  const selectedHourRef = useRef<HTMLButtonElement>(null);
  const selectedMinuteRef = useRef<HTMLButtonElement>(null);

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
  const selectedPeriod = useMemo(
    () => getDefaultPeriod(selectedTemplate, form.period, form.frequency),
    [form.frequency, form.period, selectedTemplate],
  );
  const recipients = splitList(form.recipients);
  const recipientSearchTerm = recipientSearch.trim().toLocaleLowerCase();
  const filteredRecipientDepartments = recipientDepartments.filter((department) => (
    !recipientSearchTerm
    || department.name.toLocaleLowerCase().includes(recipientSearchTerm)
    || department.members.some((member) => (
      `${member.name} ${member.role}`.toLocaleLowerCase().includes(recipientSearchTerm)
    ))
  ));
  const activeRecipientDepartment = filteredRecipientDepartments.find(
    (department) => department.name === recipientDepartmentName,
  ) ?? filteredRecipientDepartments[0] ?? null;
  const visibleRecipientMembers = activeRecipientDepartment?.members.filter((member) => (
    !recipientSearchTerm
    || activeRecipientDepartment.name.toLocaleLowerCase().includes(recipientSearchTerm)
    || `${member.name} ${member.role}`.toLocaleLowerCase().includes(recipientSearchTerm)
  )) ?? [];
  const scheduleDayOptions = form.frequency === 'weekly' ? weekDayOptions : monthDayOptions;
  const [runHour = '08', runMinute = '00'] = form.runTime.split(':');
  const nextRunDate = resolveNextRunDate(form.frequency, form.runTime, form.runDay);
  const nextRunAt = formatDateTime(nextRunDate);
  const isSelfOnly = recipientMode === 'self';

  useEffect(() => {
    if (!open) return;
    try {
      const saved = sessionStorage.getItem(draftKey);
      if (saved) { setForm(JSON.parse(saved)); setErrors({}); return; }
    } catch { /* Fall back to the saved subscription. */ }
    setForm(
      subscription
        ? createFormFromSubscription(subscription)
        : createEmptyForm(template, reportTitle, reportPeriod, recipientMode, currentUserName),
    );
    setErrors({});
    setTimePickerOpen(false);
    setRecipientPickerOpen(false);
    setRecipientSearch('');
    setRecipientDepartmentName(recipientDepartments[0].name);
  }, [currentUserName, open, recipientMode, reportPeriod, reportTitle, subscription, template]);

  useEffect(() => {
    if (!open) return;
    const persistDraft = () => { try { sessionStorage.setItem(draftKey, JSON.stringify(form)); } catch { /* Keep local form. */ } };
    window.addEventListener('chatbi:license-navigate', persistDraft);
    return () => window.removeEventListener('chatbi:license-navigate', persistDraft);
  }, [draftKey, form, open]);

  useEffect(() => {
    if (!open || form.agentId || !availableAgents[0]) return;
    setForm((current) => ({ ...current, agentId: availableAgents[0].id }));
  }, [availableAgents, form.agentId, open]);

  useEffect(() => {
    if (!open) return;
    if (selectedPeriod === form.period) return;
    setForm((current) => ({ ...current, period: selectedPeriod }));
  }, [form.period, open, selectedPeriod]);

  useEffect(() => {
    if (!timePickerOpen) return;
    const lists = [hourListRef.current, minuteListRef.current].filter(
      (list): list is HTMLDivElement => Boolean(list),
    );
    const handleWheel = (event: WheelEvent) => {
      const list = event.currentTarget as HTMLDivElement;
      const deltaMultiplier = event.deltaMode === 1 ? 36 : event.deltaMode === 2 ? list.clientHeight : 1;
      list.scrollTop += event.deltaY * deltaMultiplier;
      event.preventDefault();
      event.stopPropagation();
    };

    lists.forEach((list) => list.addEventListener('wheel', handleWheel, { passive: false }));
    const frame = window.requestAnimationFrame(() => {
      [selectedHourRef.current, selectedMinuteRef.current].forEach((option) => {
        const list = option?.parentElement;
        if (!option || !list) return;
        list.scrollTop = option.offsetTop - (list.clientHeight - option.clientHeight) / 2;
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      lists.forEach((list) => list.removeEventListener('wheel', handleWheel));
    };
  }, [timePickerOpen]);

  const clearError = (field: keyof FormErrors) => {
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
  };

  const updateRunTime = (part: 'hour' | 'minute', value: string) => {
    setForm((current) => {
      const [currentHour = '08', currentMinute = '00'] = current.runTime.split(':');
      return {
        ...current,
        runTime: part === 'hour' ? `${value}:${currentMinute}` : `${currentHour}:${value}`,
      };
    });
    clearError('runTime');
  };

  const toggleChannel = (channel: ReportSubscriptionChannel) => {
    setForm((current) => ({
      ...current,
      channels: current.channels.includes(channel)
        ? current.channels.filter((item) => item !== channel)
        : [...current.channels, channel],
    }));
    clearError('channels');
  };

  const toggleRecipient = (recipient: string) => {
    setForm((current) => {
      const currentRecipients = splitList(current.recipients);
      const nextRecipients = currentRecipients.includes(recipient)
        ? currentRecipients.filter((item) => item !== recipient)
        : [...currentRecipients, recipient];

      return { ...current, recipients: nextRecipients.join(', ') };
    });
    clearError('recipients');
  };

  const toggleRecipientDepartment = (department: (typeof recipientDepartments)[number]) => {
    setForm((current) => {
      const currentRecipients = splitList(current.recipients);
      const memberNames = department.members.map((member) => member.name);
      const allSelected = memberNames.every((member) => currentRecipients.includes(member));
      const nextRecipients = allSelected
        ? currentRecipients.filter((recipient) => !memberNames.includes(recipient))
        : [...currentRecipients, ...memberNames.filter((member) => !currentRecipients.includes(member))];

      return { ...current, recipients: nextRecipients.join(', ') };
    });
    clearError('recipients');
  };

  const validate = () => {
    const nextErrors: FormErrors = {};
    if (!form.name.trim()) nextErrors.name = '请输入订阅名称';
    if (!selectedTemplate && !enabledTemplates[0]) nextErrors.template = '暂无可用报告模板';
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.runTime)) nextErrors.runTime = '请选择有效的推送时间';
    if (!splitList(form.recipients).length) nextErrors.recipients = '请选择至少一个接收对象';
    if (!form.channels.length) nextErrors.channels = '请选择至少一种推送渠道';
    setErrors(nextErrors);
    if (nextErrors.name) nameInputRef.current?.focus();
    else if (nextErrors.recipients) recipientsTriggerRef.current?.focus();
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = () => {
    if (!guardLicense('manageSubscription')) return;
    if (!validate()) return;

    const now = formatDateTime(new Date());
    const nextSubscription: ReportSubscription = {
      id: subscription?.id ?? `sub-${Date.now()}`,
      name: form.name.trim(),
      reportTemplateId: form.reportTemplateId || selectedTemplate?.id || enabledTemplates[0]?.id || '',
      agentId: form.agentId || availableAgents[0]?.id || '',
      reportTheme: form.reportTheme.trim() || selectedTemplate?.name || '经营报告',
      period: form.period || getDefaultPeriod(selectedTemplate, undefined, form.frequency),
      frequency: form.frequency,
      runDay: form.frequency === 'daily' ? undefined : form.runDay,
      runTime: form.runTime,
      timezone: form.timezone,
      holidayPolicy: subscription?.holidayPolicy ?? 'run',
      recipients: isSelfOnly ? [currentUserName] : splitList(form.recipients),
      channels: form.channels,
      outputFormats: form.outputFormats,
      permissionPolicy: form.permissionPolicy.trim() || '按收件人权限自动过滤数据范围。',
      nextRunAt,
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
    sessionStorage.removeItem(draftKey);
    toast.success(subscription ? '订阅已更新' : '订阅成功');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        showCloseButton={false}
        className="!flex max-h-[calc(100vh-32px)] w-[680px] !max-w-[calc(100vw-32px)] flex-col gap-0 overflow-hidden rounded-[12px] border-0 bg-white p-0 font-['PingFang_SC','Microsoft_YaHei',sans-serif] shadow-[0_12px_32px_rgba(29,33,41,0.16)] sm:!max-w-[680px]"
      >
        <DialogHeader className="shrink-0 gap-0 border-b border-[#e5e6eb] px-5 py-4 pr-14 text-left sm:px-6">
          <DialogTitle className="flex items-center gap-2 text-[18px] font-semibold leading-7 text-[#1d2129]">
            <BellRing aria-hidden="true" className="h-5 w-5 text-[#165dff]" />
            {subscription ? '编辑订阅' : '订阅报告'}
          </DialogTitle>
          <DialogClose asChild>
            <button
              type="button"
              aria-label="关闭订阅设置"
              className="absolute right-5 top-4 inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#86909c] transition-colors hover:bg-[#f2f3f5] hover:text-[#1d2129] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </DialogClose>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="space-y-5">
            <section aria-labelledby="subscription-basic-heading">
              <h3 id="subscription-basic-heading" className="text-[15px] font-medium leading-6 text-[#1d2129]">基本信息</h3>
              <div className="mt-3 rounded-[8px] bg-[#f7f8fa] px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-[#e8f3ff] text-[#165dff]">
                    <FileText aria-hidden="true" className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="min-w-0 truncate text-[14px] font-medium leading-[22px] text-[#1d2129]">{selectedTemplate?.name ?? '暂无可用模板'}</div>
                  </div>
                </div>
              </div>
              {errors.template && <p className="mt-1 text-[12px] leading-5 text-[#f53f3f]">{errors.template}</p>}

              <div className="mt-4 grid gap-4">
                <label className="grid gap-2">
                  <span className="text-[14px] leading-[22px] text-[#4e5969]">订阅名称<span aria-hidden="true" className="ml-0.5 text-[#f53f3f]">*</span></span>
                  <div className="relative">
                    <input
                      ref={nameInputRef}
                      value={form.name}
                      maxLength={20}
                      aria-invalid={Boolean(errors.name)}
                      onChange={(event) => {
                        setForm((current) => ({ ...current, name: event.target.value }));
                        clearError('name');
                      }}
                      placeholder="请输入订阅名称"
                      className={`${fieldClassName} pr-14 ${errors.name ? errorFieldClassName : ''}`}
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[12px] leading-[22px] text-[#86909c]">
                      {form.name.length}/20
                    </span>
                  </div>
                  {errors.name && <span className="text-[12px] leading-5 text-[#f53f3f]">{errors.name}</span>}
                </label>
                <label className="grid gap-2">
                  <span className="text-[14px] leading-[22px] text-[#4e5969]">数据周期</span>
                  <span className="relative">
                    <select
                      value={selectedPeriod}
                      onChange={(event) => setForm((current) => ({ ...current, period: event.target.value }))}
                      className={`${fieldClassName} appearance-none pr-9`}
                    >
                      {periodOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#86909c]" />
                  </span>
                </label>
              </div>
            </section>

            <section aria-labelledby="subscription-schedule-heading" className="border-t border-[#e5e6eb] pt-5">
              <h3 id="subscription-schedule-heading" className="text-[15px] font-medium leading-6 text-[#1d2129]">推送计划</h3>
              <fieldset className="mt-3">
                <legend className="text-[14px] leading-[22px] text-[#4e5969]">推送频率</legend>
                <div className="mt-2 grid grid-cols-3 rounded-[8px] bg-[#f2f3f5] p-1">
                  {frequencyOptions.map((option) => {
                    const selected = form.frequency === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setForm((current) => (
                          current.frequency === option.value
                            ? current
                            : { ...current, frequency: option.value, runDay: 1 }
                        ))}
                        className={`h-8 rounded-[6px] text-[13px] leading-5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 ${selected ? 'bg-white font-medium text-[#1d2129] shadow-[0_1px_3px_rgba(29,33,41,0.08)]' : 'text-[#4e5969] hover:text-[#1d2129]'}`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className="mt-4 grid gap-2">
                <legend className="text-[14px] leading-[22px] text-[#4e5969]">
                  {form.frequency === 'daily' ? '推送时间' : '推送日期与时间'}
                </legend>
                <div className={`grid gap-3 ${form.frequency === 'daily' ? '' : 'sm:grid-cols-[180px_minmax(0,1fr)]'}`}>
                  {form.frequency !== 'daily' && (
                    <span className="relative">
                      <CalendarDays aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#86909c]" />
                      <select
                        value={form.runDay}
                        aria-label={form.frequency === 'weekly' ? '每周推送日' : '每月推送日期'}
                        onChange={(event) => setForm((current) => ({ ...current, runDay: Number(event.target.value) }))}
                        className={`${fieldClassName} appearance-none pl-9 pr-9`}
                      >
                        {scheduleDayOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#86909c]" />
                    </span>
                  )}
                  <Popover open={timePickerOpen} onOpenChange={setTimePickerOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label={`推送时间，当前 ${form.runTime}`}
                      aria-invalid={Boolean(errors.runTime)}
                      className={`${fieldClassName} flex items-center justify-between pl-3 pr-3 text-left ${errors.runTime ? errorFieldClassName : ''}`}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Clock3 aria-hidden="true" className="h-4 w-4 shrink-0 text-[#86909c]" />
                        <span className="font-medium tabular-nums text-[#1d2129]">{form.runTime}</span>
                      </span>
                      <ChevronDown
                        aria-hidden="true"
                        className={`h-4 w-4 shrink-0 text-[#86909c] transition-transform ${timePickerOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    sideOffset={6}
                    className="w-[288px] overflow-hidden rounded-[8px] border border-[#e5e6eb] bg-white p-0 text-[#1d2129] shadow-[0_8px_24px_rgba(29,33,41,0.14)]"
                  >
                    <div className="grid h-56 grid-cols-2 divide-x divide-[#e5e6eb]">
                      <div
                        ref={hourListRef}
                        role="listbox"
                        aria-label="小时"
                        className="overscroll-contain overflow-y-auto p-1.5 [scrollbar-color:#c9cdd4_transparent] [scrollbar-width:thin]"
                      >
                        {hourOptions.map((hour) => {
                          const selected = hour === runHour;
                          return (
                            <button
                              key={hour}
                              ref={selected ? selectedHourRef : undefined}
                              type="button"
                              role="option"
                              aria-selected={selected}
                              onClick={() => updateRunTime('hour', hour)}
                              className={`flex h-9 w-full items-center justify-between rounded-[6px] px-3 text-[13px] tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#165dff]/20 ${selected ? 'bg-[#e8f3ff] font-medium text-[#165dff]' : 'text-[#4e5969] hover:bg-[#f2f3f5] hover:text-[#1d2129]'}`}
                            >
                              <span>{hour} 时</span>
                              {selected && <Check aria-hidden="true" className="h-3.5 w-3.5" />}
                            </button>
                          );
                        })}
                      </div>
                      <div
                        ref={minuteListRef}
                        role="listbox"
                        aria-label="分钟"
                        className="overscroll-contain overflow-y-auto p-1.5 [scrollbar-color:#c9cdd4_transparent] [scrollbar-width:thin]"
                      >
                        {minuteOptions.map((minute) => {
                          const selected = minute === runMinute;
                          return (
                            <button
                              key={minute}
                              ref={selected ? selectedMinuteRef : undefined}
                              type="button"
                              role="option"
                              aria-selected={selected}
                              onClick={() => {
                                updateRunTime('minute', minute);
                                setTimePickerOpen(false);
                              }}
                              className={`flex h-9 w-full items-center justify-between rounded-[6px] px-3 text-[13px] tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#165dff]/20 ${selected ? 'bg-[#e8f3ff] font-medium text-[#165dff]' : 'text-[#4e5969] hover:bg-[#f2f3f5] hover:text-[#1d2129]'}`}
                            >
                              <span>{minute} 分</span>
                              {selected && <Check aria-hidden="true" className="h-3.5 w-3.5" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </PopoverContent>
                  </Popover>
                </div>
                {errors.runTime && <span className="text-[12px] leading-5 text-[#f53f3f]">{errors.runTime}</span>}
              </fieldset>

              <div className="mt-3 flex items-center gap-2 text-[13px] leading-5 text-[#4e5969]">
                <Clock3 aria-hidden="true" className="h-4 w-4 shrink-0 text-[#165dff]" />
                <span>下次推送时间：<strong className="font-medium text-[#1d2129]">{nextRunAt}</strong></span>
              </div>
            </section>

            <section aria-labelledby="subscription-delivery-heading" className="border-t border-[#e5e6eb] pt-5">
              <h3 id="subscription-delivery-heading" className="text-[15px] font-medium leading-6 text-[#1d2129]">接收设置</h3>
              <div className="mt-3 grid gap-2">
                <span id="subscription-recipient-label" className="text-[14px] leading-[22px] text-[#4e5969]">
                  接收对象<span aria-hidden="true" className="ml-0.5 text-[#f53f3f]">*</span>
                </span>
                {isSelfOnly ? (
                  <div
                    ref={recipientsTriggerRef}
                    id="subscription-recipient-value"
                    aria-labelledby="subscription-recipient-label subscription-recipient-value"
                    aria-describedby={errors.recipients ? 'subscription-recipient-help' : undefined}
                    aria-invalid={Boolean(errors.recipients)}
                    className={`${fieldClassName} flex items-center gap-2 bg-[#f7f8fa] text-left ${errors.recipients ? errorFieldClassName : ''}`}
                  >
                    <UserRound aria-hidden="true" className="h-4 w-4 shrink-0 text-[#86909c]" />
                    <span className="truncate text-[#4e5969]">{currentUserName}（当前用户）</span>
                  </div>
                ) : (
                  <Popover
                    open={recipientPickerOpen}
                    onOpenChange={(nextOpen) => {
                      setRecipientPickerOpen(nextOpen);
                      if (!nextOpen) setRecipientSearch('');
                    }}
                  >
                    <PopoverTrigger asChild>
                      <div
                        ref={recipientsTriggerRef}
                        role="combobox"
                        tabIndex={0}
                        aria-labelledby="subscription-recipient-label subscription-recipient-value"
                        aria-describedby={errors.recipients ? 'subscription-recipient-help' : undefined}
                        aria-expanded={recipientPickerOpen}
                        aria-controls="subscription-recipient-list"
                        aria-invalid={Boolean(errors.recipients)}
                        className={`${fieldClassName} flex items-center justify-between gap-3 overflow-hidden text-left ${errors.recipients ? errorFieldClassName : ''}`}
                      >
                        <span id="subscription-recipient-value" className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                          {recipients.length ? (
                            <>
                              {recipients.slice(0, 5).map((recipient, index) => (
                                <span key={recipient} className={`${index > 1 ? 'hidden sm:inline-flex' : 'inline-flex'} h-7 min-w-0 max-w-[96px] shrink-0 items-center gap-1 rounded-[6px] bg-[#f2f3f5] pl-2.5 pr-1 text-[12px] text-[#4e5969] sm:max-w-[112px]`}>
                                  <span className="truncate">{recipient}</span>
                                  <button
                                    type="button"
                                    aria-label={`移除 ${recipient}`}
                                    onPointerDown={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                    }}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      toggleRecipient(recipient);
                                    }}
                                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] text-[#86909c] transition-colors hover:bg-[#e5e6eb] hover:text-[#1d2129] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20"
                                  >
                                    <X aria-hidden="true" className="h-3 w-3" />
                                  </button>
                                </span>
                              ))}
                              {recipients.length > 2 && (
                                <span className="shrink-0 text-[12px] text-[#86909c] sm:hidden">等 {recipients.length} 人</span>
                              )}
                              {recipients.length > 5 && (
                                <span className="hidden shrink-0 text-[12px] text-[#86909c] sm:inline">等 {recipients.length} 人</span>
                              )}
                            </>
                          ) : (
                            <span className="truncate text-[#86909c]">请选择接收人员</span>
                          )}
                        </span>
                        <ChevronDown
                          aria-hidden="true"
                          className={`h-4 w-4 shrink-0 text-[#86909c] transition-transform ${recipientPickerOpen ? 'rotate-180' : ''}`}
                        />
                      </div>
                    </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    sideOffset={6}
                    className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-48px)] overflow-hidden rounded-[8px] border border-[#e5e6eb] bg-white p-0 text-[#1d2129] shadow-[0_8px_24px_rgba(29,33,41,0.14)]"
                  >
                    <div className="flex h-10 items-center gap-2 border-b border-[#e5e6eb] px-3">
                      <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-[#86909c]" />
                      <input
                        value={recipientSearch}
                        onChange={(event) => setRecipientSearch(event.target.value)}
                        aria-label="搜索部门或人员"
                        placeholder="搜索部门或人员"
                        className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-[#1d2129] outline-none placeholder:text-[#c9cdd4]"
                      />
                      {recipientSearch && (
                        <button
                          type="button"
                          aria-label="清除搜索"
                          onClick={() => setRecipientSearch('')}
                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] text-[#86909c] hover:bg-[#f2f3f5] hover:text-[#1d2129] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20"
                        >
                          <X aria-hidden="true" className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <div id="subscription-recipient-list" className="grid h-64 grid-cols-[42%_minmax(0,1fr)] divide-x divide-[#e5e6eb] sm:grid-cols-[190px_minmax(0,1fr)]">
                      {activeRecipientDepartment ? (
                        <>
                          <div role="group" aria-label="部门" className="overscroll-contain overflow-y-auto bg-[#f7f8fa] p-1.5 [scrollbar-width:thin]">
                            <div className="px-2 py-1 text-[12px] leading-5 text-[#86909c]">部门</div>
                            {filteredRecipientDepartments.map((department) => {
                              const active = department.name === activeRecipientDepartment.name;
                              const selectedMemberCount = department.members.filter((member) => recipients.includes(member.name)).length;
                              const allSelected = selectedMemberCount === department.members.length;
                              const partiallySelected = selectedMemberCount > 0 && !allSelected;
                              return (
                                <div
                                  key={department.name}
                                  className={`flex h-10 w-full items-center rounded-[6px] px-1.5 text-[13px] transition-colors ${active ? 'bg-white font-medium text-[#165dff] shadow-[0_1px_3px_rgba(29,33,41,0.08)]' : 'text-[#4e5969] hover:bg-white hover:text-[#1d2129]'}`}
                                >
                                  <button
                                    type="button"
                                    role="checkbox"
                                    aria-checked={partiallySelected ? 'mixed' : allSelected}
                                    aria-label={`${allSelected ? '取消选择' : '选择'}${department.name}全部人员`}
                                    onClick={() => {
                                      setRecipientDepartmentName(department.name);
                                      toggleRecipientDepartment(department);
                                    }}
                                    className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 ${allSelected || partiallySelected ? 'border-[#165dff] bg-[#165dff] text-white' : 'border-[#c9cdd4] bg-white text-transparent'}`}
                                  >
                                    {partiallySelected
                                      ? <Minus aria-hidden="true" className="h-3.5 w-3.5" />
                                      : <Check aria-hidden="true" className="h-3.5 w-3.5" />}
                                  </button>
                                  <button
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() => setRecipientDepartmentName(department.name)}
                                    className="flex h-full min-w-0 flex-1 items-center gap-2 pl-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#165dff]/20"
                                  >
                                    <Building2 aria-hidden="true" className="h-4 w-4 shrink-0 text-[#86909c]" />
                                    <span className="min-w-0 flex-1 truncate">{department.name}</span>
                                    <span className="shrink-0 text-[11px] font-normal text-[#86909c]">{department.members.length}</span>
                                    <ChevronRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#86909c]" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>

                          <div className="flex min-w-0 flex-col">
                            <div className="flex h-9 shrink-0 items-center justify-between border-b border-[#e5e6eb] px-3">
                              <span className="truncate text-[12px] font-medium text-[#4e5969]">{activeRecipientDepartment.name}</span>
                              <span className="shrink-0 text-[11px] text-[#86909c]">{visibleRecipientMembers.length} 人</span>
                            </div>
                            <div role="group" aria-label={`${activeRecipientDepartment.name}人员`} className="overscroll-contain min-h-0 flex-1 overflow-y-auto p-1.5 [scrollbar-width:thin]">
                              {visibleRecipientMembers.map((member) => {
                                const selected = recipients.includes(member.name);
                                return (
                                  <button
                                    key={member.name}
                                    type="button"
                                    role="checkbox"
                                    aria-checked={selected}
                                    onClick={() => toggleRecipient(member.name)}
                                    className="flex h-10 w-full items-center gap-2 rounded-[6px] px-2.5 text-left text-[13px] text-[#1d2129] transition-colors hover:bg-[#f2f3f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#165dff]/20"
                                  >
                                    <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] border ${selected ? 'border-[#165dff] bg-[#165dff] text-white' : 'border-[#c9cdd4] bg-white text-transparent'}`}>
                                      <Check aria-hidden="true" className="h-3.5 w-3.5" />
                                    </span>
                                    <UserRound aria-hidden="true" className="h-4 w-4 shrink-0 text-[#86909c]" />
                                    <span className="min-w-0 flex-1 truncate">{member.name}</span>
                                    <span className="shrink-0 text-[12px] text-[#86909c]">{member.role}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="col-span-2 flex items-center justify-center px-4 text-center text-[13px] text-[#86909c]">
                          未找到匹配的部门或人员
                        </div>
                      )}
                    </div>
                    <div className="flex h-11 items-center justify-between border-t border-[#e5e6eb] bg-[#f7f8fa] px-3">
                      <span className="text-[12px] text-[#86909c]">已选择 {recipients.length} 项</span>
                      <button
                        type="button"
                        onClick={() => setRecipientPickerOpen(false)}
                        className="h-7 rounded-[6px] px-2.5 text-[13px] font-medium text-[#165dff] transition-colors hover:bg-[#e8f3ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20"
                      >
                        完成
                      </button>
                    </div>
                    </PopoverContent>
                  </Popover>
                )}

                {errors.recipients && (
                  <span id="subscription-recipient-help" className="text-[12px] leading-5 text-[#f53f3f]">
                    {errors.recipients}
                  </span>
                )}
              </div>

              <fieldset className="mt-4">
                <legend className="text-[14px] leading-[22px] text-[#4e5969]">接收渠道</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {channelOptions.map(({ value, icon: Icon }) => {
                    const selected = form.channels.includes(value);
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleChannel(value)}
                        className={`inline-flex h-9 items-center gap-2 rounded-[8px] border px-3 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 ${selected ? 'border-[#165dff] bg-[#e8f3ff] text-[#165dff]' : 'border-[#e5e6eb] bg-white text-[#4e5969] hover:bg-[#f7f8fa]'}`}
                      >
                        <span className={`inline-flex h-4 w-4 items-center justify-center rounded-[4px] border ${selected ? 'border-[#165dff] bg-[#165dff] text-white' : 'border-[#c9cdd4] bg-white'}`}>
                          {selected && <Check aria-hidden="true" className="h-3 w-3" />}
                        </span>
                        <Icon aria-hidden="true" className="h-4 w-4" />
                        {value}
                      </button>
                    );
                  })}
                </div>
                {errors.channels && <p className="mt-1 text-[12px] leading-5 text-[#f53f3f]">{errors.channels}</p>}
              </fieldset>
            </section>

          </div>
        </div>

        <div className="flex min-h-16 shrink-0 flex-wrap items-center justify-end gap-2.5 border-t border-[#e5e6eb] bg-[#f7f8fa] px-5 py-3 sm:px-6">
          <DialogClose asChild>
            <button type="button" className="h-10 min-w-[88px] rounded-[8px] border border-[#e5e6eb] bg-white px-5 text-[14px] leading-[22px] text-[#4e5969] transition-colors hover:bg-[#f2f3f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20">取消</button>
          </DialogClose>
          <button type="button" onClick={handleSave} className="h-10 min-w-[96px] rounded-[8px] bg-[#1d2129] px-5 text-[14px] leading-[22px] text-white transition-colors hover:bg-[#2f3339] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20">
            {subscription ? '保存修改' : '确认订阅'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
