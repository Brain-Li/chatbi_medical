import { useRef, useState, type FormEvent } from 'react';
import { Copy, Eye, EyeOff, PencilLine, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfigActionIconButton } from './ConfigActionIconButton';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

type UserRow = { id: string; username: string; name: string; email: string; role: '超级管理员' | '管理员' | '普通用户'; enabled: boolean };
type UserForm = Omit<UserRow, 'id' | 'enabled'> & { password: string };
const storageKey = 'chatbi-medical-users-v1';
const initialUsers: UserRow[] = [
  { id: '1', username: 'liusy', name: 'liusy', email: '320616101@qq.com', role: '普通用户', enabled: true },
  { id: '2', username: 'libin', name: '李斌', email: '862258792@qq.com', role: '普通用户', enabled: true },
  { id: '3', username: 'test2', name: 'test2', email: 'chenbai@futongdf.com.cn', role: '超级管理员', enabled: true },
  { id: '4', username: 'zhaoyy', name: 'zhaoyy', email: '', role: '普通用户', enabled: true },
  { id: '5', username: 'test', name: '测试', email: 'chenbai@futongdf.com.cn', role: '超级管理员', enabled: true },
  { id: '6', username: 'admin', name: '管理员', email: 'admin@example.com', role: '超级管理员', enabled: true },
];
const emptyForm: UserForm = { username: '', name: '', email: '', role: '普通用户', password: '' };
const fieldClass = 'h-10 w-full rounded-lg border border-[#e5e6eb] bg-white px-3 text-sm outline-none placeholder:text-[#86909c] focus:border-[#86909c] focus:ring-2 focus:ring-[#1d2129]/10';
const buttonClass = 'h-9 rounded-lg border border-[#e5e6eb] px-5 text-sm text-[#4e5969] hover:bg-[#f7f8fa]';
function readUsers(): UserRow[] {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    if (Array.isArray(value) && value.every((row) => row && ['id', 'username', 'name', 'email'].every((key) => typeof row[key] === 'string') && ['超级管理员', '管理员', '普通用户'].includes(row.role) && typeof row.enabled === 'boolean')) return value;
  } catch { /* Use sample users when browser storage is unavailable. */ }
  return initialUsers;
}

export default function UserManagementSection() {
  const [users, setUsers] = useState(readUsers);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [jump, setJump] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [validated, setValidated] = useState(false);
  const [usernameLimitHint, setUsernameLimitHint] = useState('');
  const composingUsername = useRef(false);
  const [isComposingUsername, setIsComposingUsername] = useState(false);
  const acceptedUsername = useRef('');
  const usernameLength = Array.from(form.username).length;
  const [nameLimitHint, setNameLimitHint] = useState('');
  const composingName = useRef(false);
  const [isComposingName, setIsComposingName] = useState(false);
  const acceptedName = useRef('');
  const nameLength = Array.from(form.name).length;
  const [showPassword, setShowPassword] = useState(false);
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const filtered = users.filter((user) => `${user.username} ${user.name} ${user.email}`.toLowerCase().includes(query.trim().toLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const errors = {
    username: !form.username.trim() ? '请输入用户名' : usernameLength > 20 ? '最多输入 20 字' : users.some((user) => user.id !== editing?.id && user.username.toLowerCase() === form.username.trim().toLowerCase()) ? '用户名已存在' : '',
    name: !form.name.trim() ? '请输入姓名' : nameLength > 20 ? '最多输入 20 字' : '',
    email: !form.email.trim() ? '请输入邮箱' : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) ? '' : '请输入有效的邮箱地址',
    password: editing ? '' : !form.password.trim() ? '请输入初始密码'
      : Array.from(form.password).length < 8 ? '密码至少需要 8 位'
      : !/[a-zA-Z]/.test(form.password) || !/[0-9]/.test(form.password) ? '密码需同时包含字母和数字' : '',
  };
  const usernameHint = isComposingUsername ? '' : ((validated ? errors.username : '') || (usernameLength > 20 ? '最多输入 20 字' : usernameLimitHint));
  const updateUsername = (input: HTMLInputElement) => {
    let value = input.value;
    const overflow = Array.from(value).length - 20;
    if (overflow > 0) {
      const caret = input.selectionStart ?? value.length;
      const before = Array.from(value.slice(0, caret));
      const prefix = before.slice(0, Math.max(0, before.length - overflow)).join('');
      value = prefix + value.slice(caret);
      input.value = value;
      input.setSelectionRange(prefix.length, prefix.length);
      setUsernameLimitHint('最多输入 20 字');
    } else if (value !== acceptedUsername.current) setUsernameLimitHint('');
    acceptedUsername.current = value;
    setForm((current) => ({ ...current, username: value }));
  };
  const nameHint = isComposingName ? '' : ((validated ? errors.name : '') || (nameLength > 20 ? '最多输入 20 字' : nameLimitHint));
  const updateName = (input: HTMLInputElement) => {
    let value = input.value;
    const overflow = Array.from(value).length - 20;
    if (overflow > 0) {
      const caret = input.selectionStart ?? value.length;
      const before = Array.from(value.slice(0, caret));
      const prefix = before.slice(0, Math.max(0, before.length - overflow)).join('');
      value = prefix + value.slice(caret);
      input.value = value;
      input.setSelectionRange(prefix.length, prefix.length);
      setNameLimitHint('最多输入 20 字');
    } else if (value !== acceptedName.current) setNameLimitHint('');
    acceptedName.current = value;
    setForm((current) => ({ ...current, name: value }));
  };
  const persist = (next: UserRow[]) => {
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setUsers(next); return true; }
    catch { toast.error('保存失败，请检查浏览器存储空间或权限'); return false; }
  };
  const openEditor = (user?: UserRow, copy = false) => {
    setUsernameLimitHint(''); composingUsername.current = false; setIsComposingUsername(false);
    acceptedUsername.current = user && !copy ? user.username : '';
    setNameLimitHint(''); composingName.current = false; setIsComposingName(false);
    acceptedName.current = user?.name ?? '';
    setEditing(user && !copy ? user : null);
    setForm(user ? { username: copy ? '' : user.username, name: user.name, email: user.email, role: user.role, password: '' } : { ...emptyForm });
    setValidated(false); setShowPassword(false); setOpen(true);
  };
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (composingUsername.current || composingName.current) return;
    setValidated(true);
    const first = (Object.keys(errors) as (keyof typeof errors)[]).find((key) => errors[key]);
    if (first) { event.currentTarget.querySelector<HTMLElement>(`#user-${first}`)?.focus(); return; }
    // This prototype stores profile data only; passwords are never persisted.
    const row: UserRow = { id: editing?.id ?? crypto.randomUUID(), username: form.username.trim(), name: form.name.trim(), email: form.email.trim(), role: form.role, enabled: editing?.enabled ?? true };
    if (persist(editing ? users.map((user) => user.id === row.id ? row : user) : [row, ...users])) {
      setOpen(false); setForm({ ...emptyForm }); setPage(1); setQuery(''); toast.success(editing ? '用户已更新' : '用户已新增');
    }
  };
  return <div className="flex h-full min-h-0 flex-col">
    <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3">
      <input aria-label="搜索用户" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="请输入用户名、姓名或邮箱" className={`${fieldClass} !w-[300px] max-w-full`} />
      <button type="button" onClick={() => openEditor()} className={`${buttonClass} inline-flex items-center gap-1`}><Plus className="size-4" />新建用户</button>
    </div>
    <div className="min-h-0 flex-1 overflow-auto">
      <table className="w-full min-w-[780px] table-fixed text-left text-sm">
        <colgroup>{['25%', '12%', '25%', '12%', '9%', '17%'].map((width, i) => <col key={i} style={{ width }} />)}</colgroup>
        <thead className="sticky top-0 z-10 h-12 bg-[#f7f8fa] text-[#4e5969]"><tr>{['用户名', '姓名', '邮箱', '角色', '状态', '操作'].map((label) => <th key={label} className="px-4 font-normal">{label}</th>)}</tr></thead>
        <tbody>{filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((user) => <tr key={user.id} className="h-20 border-b border-[#e5e6eb] hover:bg-[#fafbfc]">
          <td className="truncate px-4 font-semibold" title={user.username}>{user.username}</td>
          <td className="truncate px-4" title={user.name}>{user.name}</td>
          <td className="truncate px-4 text-[#4e5969]" title={user.email}>{user.email || '—'}</td>
          <td className="px-4 text-[#4e5969]">{user.role}</td>
          <td className="px-4"><button type="button" role="switch" aria-label={`${user.username}启用状态`} aria-checked={user.enabled} onClick={() => persist(users.map((item) => item.id === user.id ? { ...item, enabled: !item.enabled } : item))} className={`relative h-5 w-10 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86909c] ${user.enabled ? 'bg-[#1d2129]' : 'bg-[#c9cdd4]'}`}><span className={`absolute top-0.5 size-4 rounded-full bg-white transition-[left] ${user.enabled ? 'left-[22px]' : 'left-0.5'}`} /></button></td>
          <td className="px-4"><div className="flex gap-1"><ConfigActionIconButton icon={PencilLine} label="编辑" aria-label={`编辑${user.username}`} onClick={() => openEditor(user)} /><ConfigActionIconButton icon={Copy} label="复制" aria-label={`复制${user.username}`} onClick={() => openEditor(user, true)} /><ConfigActionIconButton icon={Trash2} label="删除" aria-label={`删除${user.username}`} onClick={() => setDeleting(user)} /></div></td>
        </tr>)}{!filtered.length && <tr><td colSpan={6} className="py-12 text-center text-[#86909c]">暂无匹配的用户</td></tr>}</tbody>
      </table>
    </div>
    <footer className="mt-auto flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#e5e6eb] bg-[#f7f8fa] px-4 py-3 text-sm">
      <div className="flex items-center gap-4"><span>共 {filtered.length} 条</span><Select value={String(pageSize)} onValueChange={(value) => { setPageSize(Number(value)); setPage(1); }}><SelectTrigger aria-label="每页条数" className="w-[108px] rounded-lg bg-white"><SelectValue /></SelectTrigger><SelectContent>{[10, 20, 50].map((size) => <SelectItem key={size} value={String(size)}>{size} 条/页</SelectItem>)}</SelectContent></Select></div>
      <div className="flex items-center gap-2"><button aria-label="上一页" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="px-2 disabled:opacity-30">‹</button><span className="rounded-lg bg-[#1d2129] px-3 py-1.5 text-white">{currentPage}</span><button aria-label="下一页" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)} className="px-2 disabled:opacity-30">›</button><form className="flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); const next = Number(jump); if (Number.isInteger(next) && next >= 1 && next <= pages) { setPage(next); setJump(''); } }}><label htmlFor="user-page">跳至</label><input id="user-page" aria-label="跳转页码" inputMode="numeric" value={jump} onChange={(event) => setJump(event.target.value)} className="h-8 w-11 rounded-lg border border-[#e5e6eb] bg-white text-center" /><span>页</span></form></div>
    </footer>
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) setForm({ ...emptyForm }); }}>
      <DialogContent aria-describedby={undefined} className="max-h-[90dvh] overflow-y-auto rounded-2xl p-0 sm:max-w-[600px]">
        <DialogHeader className="border-b border-[#e5e6eb] px-5 py-4"><DialogTitle>{editing ? '编辑用户' : '新建用户'}</DialogTitle></DialogHeader>
        <form noValidate onSubmit={save}>
          <div className="grid grid-cols-1 gap-x-4 gap-y-4 px-5 pb-5 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="user-username" className="text-sm font-medium text-[#4e5969]">用户名<span className="ml-1 text-red-500">*</span></label>
              <div className="relative">
                <input id="user-username" autoFocus required value={form.username} placeholder="请输入用户名"
                  onChange={(event) => {
                    if (composingUsername.current) setForm((current) => ({ ...current, username: event.target.value }));
                    else updateUsername(event.currentTarget);
                  }}
                  onPaste={(event) => {
                    if (composingUsername.current) return;
                    event.preventDefault();
                    const input = event.currentTarget;
                    const start = input.selectionStart ?? input.value.length;
                    input.setRangeText(event.clipboardData.getData('text').replace(/[\r\n]/g, ''), start, input.selectionEnd ?? start, 'end');
                    updateUsername(input);
                  }}
                  onCompositionStart={() => { composingUsername.current = true; setIsComposingUsername(true); setUsernameLimitHint(''); }}
                  onCompositionEnd={(event) => { composingUsername.current = false; setIsComposingUsername(false); updateUsername(event.currentTarget); }}
                  aria-invalid={Boolean(usernameHint)} aria-describedby={`user-username-count${usernameHint ? ' user-username-error' : ''}`}
                  className={`${fieldClass} pr-16 ${usernameHint ? '!border-red-500 focus:!ring-red-100' : ''}`} />
                <span id="user-username-count" className={`pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs tabular-nums ${usernameHint ? 'text-red-600' : 'text-[#86909c]'}`}>{usernameLength}/20</span>
              </div>
              {usernameHint && <p id="user-username-error" aria-live="polite" className="!mt-1 text-xs leading-4 text-red-600">{usernameHint}</p>}
            </div>
            <div className="space-y-2">
              <label htmlFor="user-name" className="text-sm font-medium text-[#4e5969]">姓名<span className="ml-1 text-red-500">*</span></label>
              <div className="relative">
                <input id="user-name" required value={form.name} placeholder="请输入姓名"
                  onChange={(event) => {
                    if (composingName.current) setForm((current) => ({ ...current, name: event.target.value }));
                    else updateName(event.currentTarget);
                  }}
                  onPaste={(event) => {
                    if (composingName.current) return;
                    event.preventDefault();
                    const input = event.currentTarget;
                    const start = input.selectionStart ?? input.value.length;
                    input.setRangeText(event.clipboardData.getData('text').replace(/[\r\n]/g, ''), start, input.selectionEnd ?? start, 'end');
                    updateName(input);
                  }}
                  onCompositionStart={() => { composingName.current = true; setIsComposingName(true); setNameLimitHint(''); }}
                  onCompositionEnd={(event) => { composingName.current = false; setIsComposingName(false); updateName(event.currentTarget); }}
                  aria-invalid={Boolean(nameHint)} aria-describedby={`user-name-count${nameHint ? ' user-name-error' : ''}`}
                  className={`${fieldClass} pr-16 ${nameHint ? '!border-red-500 focus:!ring-red-100' : ''}`} />
                <span id="user-name-count" className={`pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs tabular-nums ${nameHint ? 'text-red-600' : 'text-[#86909c]'}`}>{nameLength}/20</span>
              </div>
              {nameHint && <p id="user-name-error" aria-live="polite" className="!mt-1 text-xs leading-4 text-red-600">{nameHint}</p>}
            </div>
            {(['email'] as const).map((key) => <div key={key} className="space-y-2"><label htmlFor={`user-${key}`} className="text-sm font-medium text-[#4e5969]">{{ name: '姓名', email: '邮箱' }[key]}<span className="ml-1 text-red-500">*</span></label><input id={`user-${key}`} required value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} placeholder={{ name: '请输入姓名', email: '请输入邮箱' }[key]} aria-invalid={validated && Boolean(errors[key])} aria-describedby={validated && errors[key] ? `user-${key}-error` : undefined} className={`${fieldClass} ${validated && errors[key] ? '!border-red-500' : ''}`} />{validated && errors[key] && <p id={`user-${key}-error`} aria-live="polite" className="text-xs text-red-600">{errors[key]}</p>}</div>)}
            <div className="space-y-2"><label htmlFor="user-role" className="text-sm font-medium text-[#4e5969]">角色<span className="ml-1 text-red-500">*</span></label><Select required value={form.role} onValueChange={(role: UserRow['role']) => setForm({ ...form, role })}><SelectTrigger id="user-role" className="rounded-lg border-[#e5e6eb] bg-white data-[size=default]:h-10"><SelectValue /></SelectTrigger><SelectContent className="rounded-lg"><SelectItem value="超级管理员">超级管理员</SelectItem><SelectItem value="管理员">管理员</SelectItem><SelectItem value="普通用户">普通用户</SelectItem></SelectContent></Select></div>
            {!editing && <div className="mt-4 space-y-2 sm:col-span-2"><label htmlFor="user-password" className="text-sm font-medium text-[#4e5969]">初始密码<span className="ml-1 text-red-500">*</span></label><div className="relative"><input id="user-password" required type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="设置初始密码" aria-invalid={validated && Boolean(errors.password)} aria-describedby={validated && errors.password ? 'user-password-error' : undefined} className={`${fieldClass} pr-12 ${validated && errors.password ? '!border-red-500' : ''}`} /><button type="button" aria-label={showPassword ? '隐藏密码' : '显示密码'} onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center border-l border-[#e5e6eb] text-[#86909c]">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div>{validated && errors.password && <p id="user-password-error" aria-live="polite" className="text-xs text-red-600">{errors.password}</p>}</div>}
          </div>
          <DialogFooter className="flex-row justify-end border-t border-[#e5e6eb] px-5 py-4"><button type="button" onClick={() => { setOpen(false); setForm({ ...emptyForm }); }} className={buttonClass}>取消</button><button type="submit" className="h-9 rounded-lg bg-[#1d2129] px-6 text-sm text-white hover:bg-[#363c46]">保存</button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <Dialog open={Boolean(deleting)} onOpenChange={(value) => { if (!value) setDeleting(null); }}><DialogContent aria-describedby="delete-user-description" className="rounded-2xl sm:max-w-[420px]"><DialogHeader><DialogTitle>删除用户</DialogTitle></DialogHeader><p id="delete-user-description" className="break-words text-sm text-[#4e5969]">确认删除用户“{deleting?.username}”？删除后将从列表移除。</p><DialogFooter><button className={buttonClass} onClick={() => setDeleting(null)}>取消</button><button className="h-9 rounded-lg bg-red-600 px-5 text-sm text-white" onClick={() => { if (deleting && persist(users.filter((user) => user.id !== deleting.id))) { setDeleting(null); toast.success('用户已删除'); } }}>删除</button></DialogFooter></DialogContent></Dialog>
  </div>;
}
