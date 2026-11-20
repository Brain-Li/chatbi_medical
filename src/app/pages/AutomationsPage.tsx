import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { CalendarDays, Check, ChevronDown, Clock3, Ellipsis, FileText, Paperclip, Play, Plus, Search, X } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { readWorkspaceNames } from '../utils/workspaceStorage';

type TaskStatus = 'active' | 'paused' | 'ended';
type Repeat = '每周' | '周一至周五' | '每天' | '每 N 小时' | '每 N 分钟' | '每月' | '仅一次' | '自定义';
type AutomationAttachment = { name: string; size: number; type: string };
type Automation = { id: string; name: string; content: string; execution: string; workspace: string; repeat: Repeat; date: string; time: string; emailNotification?: boolean; status: TaskStatus; reportTemplateId?: string; reportTemplateName?: string; attachments?: AutomationAttachment[]; lastRun?: string };
type Filter = 'active' | 'paused' | 'ended' | 'all';
const STORAGE_KEY = 'chatbi-medical-automations-v1';
const filters: { id: Filter; label: string }[] = [{ id: 'active', label: '已开启' }, { id: 'paused', label: '已暂停' }, { id: 'ended', label: '已结束' }, { id: 'all', label: '全部' }];
const repeats: Repeat[] = ['每周', '周一至周五', '每天', '每 N 小时', '每 N 分钟', '每月', '仅一次', '自定义'];
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
const emptyDraft = (workspace: string): Omit<Automation, 'id' | 'status'> => ({ name: '', content: '', attachments: [], execution: '新建会话并复用', workspace, repeat: '仅一次', date: today, time: '09:00', emailNotification: false });
function readTasks(): Automation[] { try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }

export default function AutomationsPage() {
  const navigate = useNavigate();
  const { activeWorkspaceName, reportTemplates } = useWorkspace();
  const workspaceNames = readWorkspaceNames();
  const [tasks, setTasks] = useState<Automation[]>(readTasks);
  const [filter, setFilter] = useState<Filter>('active');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Automation | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [contentMenuOpen, setContentMenuOpen] = useState(false);
  const [templateSubmenuOpen, setTemplateSubmenuOpen] = useState(false);
  const [templateQuery, setTemplateQuery] = useState('');
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0, maxHeight: 320 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const plusButtonRef = useRef<HTMLButtonElement>(null);
  const contentMenuRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); }, [tasks]);
  const visible = useMemo(() => tasks.filter((task) => (filter === 'all' || task.status === filter) && task.name.toLowerCase().includes(query.toLowerCase())), [tasks, filter, query]);
  const selected = tasks.find((task) => task.id === selectedId) ?? null;
  const matchingTemplates = reportTemplates.filter((template) => template.status === 'published' && template.name.toLocaleLowerCase('zh-CN').includes(templateQuery.trim().toLocaleLowerCase('zh-CN')));
  const openContentMenu = () => {
    const rect = plusButtonRef.current?.getBoundingClientRect();
    if (rect) {
      const panelWidth = 144 + 4 + 256;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - panelWidth - 8));
      const top = Math.max(8, Math.min(rect.top - 94, window.innerHeight - 120));
      setMenuPosition({ left, top, maxHeight: Math.max(160, window.innerHeight - top - 12) });
    }
    setTemplateSubmenuOpen(false);
    setContentMenuOpen(true);
  };
  useEffect(() => {
    if (!contentMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!contentMenuRef.current?.contains(target) && !plusButtonRef.current?.contains(target)) setContentMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setContentMenuOpen(false); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('pointerdown', onPointerDown); document.removeEventListener('keydown', onKeyDown); };
  }, [contentMenuOpen]);
  const openCreate = () => { setDraft({ ...emptyDraft(activeWorkspaceName), id: '', status: 'active' }); setError(''); setMenuOpen(false); setContentMenuOpen(false); setTemplateSubmenuOpen(false); };
  const save = () => {
    if (!draft?.name.trim()) { setError('请输入自动化任务名称'); return; }
    if (!draft.content.trim()) { setError('请输入自动化任务内容'); return; }
    const saved = { ...draft, name: draft.name.trim() };
    setTasks((current) => draft.id ? current.map((task) => task.id === draft.id ? saved : task) : [{ ...saved, id: crypto.randomUUID() }, ...current]);
    setSelectedId(draft.id || null); setDraft(null); setError('');
  };
  const statusLabel: Record<TaskStatus, string> = { active: '已开启', paused: '已暂停', ended: '已结束' };
  const patchSelected = (updates: Partial<Automation>) => { if (selected) setTasks((current) => current.map((task) => task.id === selected.id ? { ...task, ...updates } : task)); };

  return <section className="relative flex h-full min-h-0 bg-white text-[#1d2129]" style={{ fontFamily: '"PingFang SC", "Microsoft YaHei", Arial, sans-serif' }}>
    <div className="flex min-w-0 flex-1 flex-col px-8 py-7 sm:px-10">
      <header className="mb-7 flex shrink-0 flex-wrap items-center justify-between gap-4">
        <h1 className="text-[21px] font-medium leading-7">自动化任务</h1>
        <div className="relative flex h-9 overflow-visible rounded-[9px] bg-[#1d2129] text-white">
          <button type="button" onClick={openCreate} className="flex items-center gap-1.5 px-3.5 text-[13px] hover:bg-black/10"><Plus size={17} />新建</button>
          <button type="button" aria-label="新建方式" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)} className="border-l border-white/20 px-2.5 hover:bg-black/10"><ChevronDown size={16} /></button>
          {menuOpen && <div className="absolute right-0 top-12 z-20 w-48 rounded-[10px] border border-[#e5e6eb] bg-white p-1.5 text-[#1d2129] shadow-lg">
            <button onClick={() => { setMenuOpen(false); navigate('/home'); }} className="w-full rounded-md px-3 py-2.5 text-left text-sm hover:bg-[#f5f6f7]">在会话中创建</button>
            <button onClick={openCreate} className="w-full rounded-md px-3 py-2.5 text-left text-sm hover:bg-[#f5f6f7]">手动创建</button>
          </div>}
        </div>
      </header>
      <div className="mb-4 flex shrink-0 gap-1" role="tablist" aria-label="任务状态">
        {filters.map((item) => <button key={item.id} role="tab" aria-selected={filter === item.id} onClick={() => setFilter(item.id)} className={`h-8 rounded-[8px] px-3.5 text-[13px] transition-colors ${filter === item.id ? 'bg-[#f2f3f5] font-medium text-[#1d2129]' : 'text-[#86909c] hover:bg-[#f7f8fa] hover:text-[#4e5969]'}`}>{item.label}</button>)}
      </div>
      <label className="flex h-10 shrink-0 items-center gap-2 rounded-[10px] border border-[#e5e6eb] px-3 text-[#86909c] focus-within:border-[#8ab4ff]"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="搜索自动化任务" placeholder="搜索自动化任务" className="min-w-0 flex-1 bg-transparent text-[13px] text-[#1d2129] outline-none placeholder:text-[#aeb4bc]" /></label>
      <div className="min-h-0 flex-1 overflow-y-auto py-4">
        {visible.length ? <div className="space-y-2">{visible.map((task) => <button type="button" key={task.id} onClick={() => setSelectedId(task.id)} className={`flex w-full items-start gap-3 rounded-[10px] px-4 py-3.5 text-left transition-colors hover:bg-[#f5f6f7] ${selectedId === task.id ? 'bg-[#f2f3f5]' : ''}`}>
          <Clock3 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#86909c]" strokeWidth={1.8} /><span className="min-w-0 flex-1"><span className="block truncate text-[15px] leading-6">{task.name}</span><span className="mt-0.5 block text-sm text-[#86909c]">{statusLabel[task.status]} · {task.repeat}{task.status === 'active' ? ' · ' + task.time : ''}</span></span>
        </button>)}</div> : <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
          <div className="relative mb-5 flex h-[88px] w-[104px] items-center justify-center rounded-[32px] bg-[#f5f7fa] text-[#b9c3cf]"><CalendarDays size={42} strokeWidth={1.5} /><Clock3 className="absolute bottom-2 right-2 bg-white" size={24} /></div>
          <p className="mb-5 text-[15px] text-[#86909c]">{query ? '没有找到匹配的自动化任务' : filter === 'active' ? '没有已开启的自动化任务' : '暂无自动化任务'}</p>
          {!query && filter === 'active' && <button onClick={openCreate} className="h-9 rounded-[9px] border border-[#e5e6eb] px-3.5 text-[13px] hover:bg-[#f7f8fa]">新建自动化任务</button>}
        </div>}
      </div>
    </div>
    {selected && !draft && <aside className="absolute inset-y-0 right-0 z-10 flex w-full max-w-[430px] flex-col border-l border-[#e5e6eb] bg-white shadow-[-12px_0_32px_rgba(29,33,41,0.06)] sm:static sm:shadow-none">
      <div className="flex h-[58px] shrink-0 items-center justify-between border-b border-[#e5e6eb] px-5"><div className="flex gap-5"><button className="border-b-2 border-[#165dff] py-4 text-sm text-[#165dff]">规则</button><button className="py-4 text-sm text-[#86909c]">任务运行记录</button></div><div className="flex gap-1"><button title="立即运行" onClick={() => patchSelected({ lastRun: new Date().toISOString() })} className="flex h-8 w-8 items-center justify-center rounded-md text-[#86909c] hover:bg-[#f2f3f5]"><Play size={16} /></button><button title="编辑" onClick={() => setDraft(selected)} className="flex h-8 w-8 items-center justify-center rounded-md text-[#86909c] hover:bg-[#f2f3f5]"><Ellipsis size={18} /></button><button title="关闭" onClick={() => setSelectedId(null)} className="flex h-8 w-8 items-center justify-center rounded-md text-[#86909c] hover:bg-[#f2f3f5]"><X size={18} /></button></div></div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5"><div><h2 className="text-[20px] font-medium">{selected.name}</h2><p className="mt-1 text-sm text-[#86909c]">{statusLabel[selected.status]}</p></div><label className="block text-sm">自动化任务名称<div className="mt-2 rounded-[9px] border border-[#e5e6eb] px-3 py-2.5">{selected.name}</div></label><label className="block text-sm">自动化任务内容<div className="mt-2 min-h-32 whitespace-pre-wrap rounded-[12px] border border-[#e5e6eb] p-3 text-sm leading-6">{selected.content}</div></label>{selected.reportTemplateName && <div className="flex items-center justify-between gap-3 rounded-[10px] border border-[#e5e6eb] px-3 py-2.5 text-sm"><span className="text-[#86909c]">报告模板</span><span className="truncate font-medium text-[#4e5969]">{selected.reportTemplateName}</span></div>}<div className="divide-y divide-[#e5e6eb] rounded-[12px] border border-[#e5e6eb] px-3 text-sm"><div className="flex justify-between py-3"><span>执行位置</span><span className="text-[#4e5969]">{selected.execution}</span></div><div className="flex justify-between py-3"><span>关联工作区</span><span className="text-[#4e5969]">{selected.workspace}</span></div></div><div><p className="mb-2 text-sm">运行时间</p><div className="divide-y divide-[#e5e6eb] rounded-[12px] border border-[#e5e6eb] px-3 text-sm"><div className="flex justify-between py-3"><span>重复</span><span>{selected.repeat}</span></div><div className="flex justify-between py-3"><span>日期</span><span>{selected.date}</span></div><div className="flex justify-between py-3"><span>时间</span><span>{selected.time}</span></div></div></div>{selected.lastRun && <p className="text-xs text-[#86909c]">最近运行：{new Date(selected.lastRun).toLocaleString('zh-CN')}</p>}</div>
      <div className="flex shrink-0 justify-end gap-2 border-t border-[#e5e6eb] p-4"><button onClick={() => patchSelected({ status: selected.status === 'active' ? 'paused' : 'active' })} className="h-9 rounded-[8px] border border-[#e5e6eb] px-3 text-sm">{selected.status === 'active' ? '暂停任务' : '重新开启'}</button><button onClick={() => { setDraft(selected); setError(''); }} className="h-9 rounded-[8px] bg-[#165dff] px-4 text-sm text-white hover:bg-[#0e63e5]">编辑任务</button></div>
    </aside>}
    {draft && <div className="absolute inset-0 z-20 flex justify-end bg-black/15" onMouseDown={(event) => { if (event.target === event.currentTarget) setDraft(null); }}>
      <aside className="flex h-full w-full max-w-[520px] flex-col border-l border-[#e5e6eb] bg-white shadow-[-12px_0_32px_rgba(29,33,41,0.12)]"><header className="flex h-[58px] shrink-0 items-center justify-between border-b border-[#e5e6eb] px-5"><h2 className="text-base font-medium">{draft.id ? '编辑自动化任务' : '手动创建'}</h2><button aria-label="关闭" onClick={() => setDraft(null)} className="flex h-8 w-8 items-center justify-center rounded-md text-[#86909c] hover:bg-[#f2f3f5]"><X size={18} /></button></header>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5"><label className="block text-sm font-medium">自动化任务名称<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="例如：每日阅读摘要" className="mt-2 h-11 w-full rounded-[9px] border border-[#e5e6eb] px-3 font-normal outline-none focus:border-[#8ab4ff]" /></label><div><label htmlFor="automation-content" className="block text-sm font-medium">自动化任务内容</label><div className="mt-2 overflow-hidden rounded-[12px] border border-[#e5e6eb] transition-colors focus-within:border-[#8ab4ff]"><input ref={fileInputRef} type="file" multiple className="hidden" onChange={(event) => { const picked = Array.from(event.currentTarget.files ?? []).map((file) => ({ name: file.name, size: file.size, type: file.type })); if (picked.length) setDraft({ ...draft, attachments: [...(draft.attachments ?? []), ...picked.filter((file) => !(draft.attachments ?? []).some((item) => item.name === file.name && item.size === file.size))] }); event.currentTarget.value = ''; }} /><textarea id="automation-content" value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} placeholder="说明任务内容和预期结果" className="block h-36 w-full resize-none border-0 bg-transparent p-3 text-sm font-normal leading-6 text-[#1d2129] outline-none placeholder:text-[#86909c]" /><div className="flex min-h-12 min-w-0 items-center gap-2 px-3 py-2"><button ref={plusButtonRef} type="button" aria-label="添加任务内容" aria-haspopup="menu" aria-expanded={contentMenuOpen} onClick={() => contentMenuOpen ? setContentMenuOpen(false) : openContentMenu()} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#4e5969] transition-colors hover:bg-[#f2f3f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/25"><Plus className="h-5 w-5" strokeWidth={1.8} /></button>{(draft.attachments ?? []).map((file) => <span key={file.name + file.size} title={file.name} className="inline-flex max-w-[180px] shrink-0 items-center gap-1 rounded-[7px] bg-[#f2f3f5] py-1 pl-2 pr-1 text-xs text-[#4e5969]"><Paperclip className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{file.name}</span><button type="button" aria-label={`移除文件：${file.name}`} onClick={() => setDraft({ ...draft, attachments: (draft.attachments ?? []).filter((item) => item.name !== file.name || item.size !== file.size) })} className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-white"><X className="h-3 w-3" /></button></span>)}{draft.reportTemplateName && <span className="inline-flex max-w-[200px] shrink-0 items-center gap-1 rounded-[7px] bg-[#f2f3f5] py-1 pl-2 pr-1 text-xs text-[#4e5969]" title={draft.reportTemplateName}><FileText className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{draft.reportTemplateName}</span><button type="button" aria-label="移除报告模板" onClick={() => setDraft({ ...draft, reportTemplateId: undefined, reportTemplateName: undefined })} className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-white"><X className="h-3 w-3" /></button></span>}{contentMenuOpen && createPortal(<div ref={contentMenuRef} style={{ left: menuPosition.left, top: menuPosition.top }} onMouseLeave={() => setTemplateSubmenuOpen(false)} className="fixed z-[80] flex items-start gap-1"><div role="menu" aria-label="添加任务内容" className="w-36 shrink-0 rounded-[10px] border border-[#e5e6eb] bg-white p-1.5 shadow-[0_8px_24px_rgba(29,33,41,0.14)]"><button type="button" role="menuitem" onClick={() => { setContentMenuOpen(false); fileInputRef.current?.click(); }} className="flex h-9 w-full items-center gap-2 rounded-[7px] px-2 text-left text-[13px] text-[#4e5969] hover:bg-[#f5f6f7]"><Paperclip className="h-4 w-4 shrink-0" strokeWidth={1.8} />选择文件</button><button type="button" role="menuitem" aria-haspopup="listbox" aria-expanded={templateSubmenuOpen} onMouseEnter={() => setTemplateSubmenuOpen(true)} onFocus={() => setTemplateSubmenuOpen(true)} onClick={() => setTemplateSubmenuOpen(true)} className={`flex h-9 w-full items-center gap-2 rounded-[7px] px-2 text-left text-[13px] text-[#4e5969] hover:bg-[#f5f6f7] ${templateSubmenuOpen ? 'bg-[#f5f6f7]' : ''}`}><FileText className="h-4 w-4 shrink-0" strokeWidth={1.8} /><span className="truncate">报告模板</span><ChevronDown className="ml-auto h-3.5 w-3.5 -rotate-90 shrink-0" /></button></div>{templateSubmenuOpen && <div role="listbox" aria-label="报告模板" style={{ maxHeight: menuPosition.maxHeight }} className="flex w-64 shrink-0 flex-col overflow-hidden rounded-[10px] border border-[#e5e6eb] bg-white p-2 shadow-[0_8px_24px_rgba(29,33,41,0.14)]"><label className="flex h-9 shrink-0 items-center gap-2 rounded-[7px] bg-[#f5f6f7] px-2.5 text-[#86909c]"><Search className="h-4 w-4 shrink-0" /><input value={templateQuery} onChange={(event) => setTemplateQuery(event.target.value)} placeholder="搜索报告模板" aria-label="搜索报告模板" className="min-w-0 flex-1 bg-transparent text-[13px] text-[#1d2129] outline-none placeholder:text-[#86909c]" /></label><div className="mt-1 min-h-0 flex-1 overflow-y-auto">{matchingTemplates.map((template) => <button key={template.id} type="button" role="option" aria-selected={draft.reportTemplateId === template.id} onClick={() => { setDraft({ ...draft, reportTemplateId: template.id, reportTemplateName: template.name }); setContentMenuOpen(false); setTemplateSubmenuOpen(false); setTemplateQuery(''); }} className="flex w-full items-center gap-2 rounded-[7px] px-2.5 py-2 text-left hover:bg-[#f5f6f7]"><span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#1d2129]">{template.name}</span>{draft.reportTemplateId === template.id && <Check className="h-3.5 w-3.5 shrink-0 text-[#165dff]" />}</button>)}{matchingTemplates.length === 0 && <p className="px-2 py-6 text-center text-xs text-[#86909c]">没有找到相关模板</p>}</div></div>}</div>, document.body)}</div></div></div>
      <div className="divide-y divide-[#e5e6eb] rounded-[12px] border border-[#e5e6eb] px-3"><label className="flex min-h-12 items-center justify-between gap-3 py-2 text-sm"><span>执行位置</span><select value={draft.execution} onChange={(event) => setDraft({ ...draft, execution: event.target.value })} className="max-w-[210px] bg-transparent text-right outline-none"><option>当前关联会话</option><option>新建会话并复用</option><option>每次新建会话</option></select></label><label className="flex min-h-12 items-center justify-between gap-3 py-2 text-sm"><span>关联工作区</span><select value={draft.workspace} onChange={(event) => setDraft({ ...draft, workspace: event.target.value })} className="max-w-[210px] bg-transparent text-right outline-none">{workspaceNames.map((name) => <option key={name}>{name}</option>)}</select></label></div>
      <div><p className="mb-2 text-sm font-medium">运行时间</p><div className="divide-y divide-[#e5e6eb] rounded-[12px] border border-[#e5e6eb] px-3"><label className="flex min-h-12 items-center justify-between text-sm"><span>重复</span><select value={draft.repeat} onChange={(event) => setDraft({ ...draft, repeat: event.target.value as Repeat })} className="bg-transparent text-right outline-none">{repeats.map((repeat) => <option key={repeat}>{repeat}</option>)}</select></label><label className="flex min-h-12 items-center justify-between text-sm"><span>日期</span><input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} className="bg-transparent text-right outline-none" /></label><label className="flex min-h-12 items-center justify-between text-sm"><span>时间</span><input type="time" value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} className="bg-transparent text-right outline-none" /></label><label className="flex min-h-12 items-center justify-between text-sm"><span>时区</span><span className="text-[#4e5969]">UTC+08:00 · 中国标准时间</span></label></div><div><p className="mb-2 mt-4 text-sm font-medium">通知方式</p><div className="flex min-h-12 items-center justify-between rounded-[12px] border border-[#e5e6eb] px-3 text-sm"><span>邮件通知</span><button type="button" role="switch" aria-checked={Boolean(draft.emailNotification)} aria-label="邮件通知" onClick={() => setDraft({ ...draft, emailNotification: !draft.emailNotification })} className={`relative h-5 w-10 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86909c] focus-visible:ring-offset-2 ${draft.emailNotification ? 'bg-[#165dff]' : 'bg-[#c9cdd4]'}`}><span className={`absolute top-0.5 size-4 rounded-full bg-white transition-[left] ${draft.emailNotification ? 'left-[22px]' : 'left-0.5'}`} /></button></div></div></div>{error && <p role="alert" className="text-sm text-[#d03050]">{error}</p>}</div>
      <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-[#e5e6eb] p-4"><button onClick={() => setDraft(null)} className="h-9 rounded-[8px] px-3 text-sm text-[#4e5969] hover:bg-[#f5f6f7]">放弃</button><button onClick={save} className="flex h-9 items-center gap-1.5 rounded-[8px] bg-[#165dff] px-4 text-sm text-white hover:bg-[#0e63e5]"><Check size={16} />{draft.id ? '保存修改' : '创建'}</button></footer>
      </aside>
    </div>}
  </section>;
}
