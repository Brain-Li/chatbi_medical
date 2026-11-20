import { useState } from 'react';
import { ChevronRight, Search, X } from 'lucide-react';
import { readDemoUsers } from '../utils/demoUserDirectory';

const departments = [
  { name: '经营分析组', userIds: ['1', '2'] },
  { name: '医务部', userIds: ['4'] },
  { name: '信息中心', userIds: ['3', '5', '6'] },
] as const;
const unassigned = '未分配部门';
const allDepartments = '全部部门';

export function KnowledgeMemberPicker({ memberIds, onChange, currentUserId, disabled }: {
  memberIds: string[];
  onChange: (ids: string[]) => void;
  currentUserId: string;
  disabled: boolean;
}) {
  const [users] = useState(readDemoUsers);
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState(allDepartments);
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const groups = [...departments, { name: unassigned, userIds: [] }].map(({ name, userIds }) => ({
    name,
    members: users.filter((user) => {
      if (!user.enabled || user.username === currentUserId) return false;
      const belongs = name === unassigned
        ? !departments.some((group) => group.userIds.some((id) => id === user.id))
        : userIds.some((id) => id === user.id);
      if (!belongs) return false;
      const text = `${name} ${user.name} ${user.username}`.toLocaleLowerCase();
      return terms.every((term) => text.includes(term));
    }),
  })).filter((group) => group.members.length > 0);
  const visibleGroups = department === allDepartments ? groups : groups.filter((group) => group.name === department);
  const departmentOptions = [{ name: allDepartments, members: groups.flatMap((group) => group.members) }, ...groups];
  const selectedIds = new Set(memberIds);
  const toggle = (id: string) => onChange(memberIds.includes(id) ? memberIds.filter((memberId) => memberId !== id) : [...memberIds, id]);
  const updateQuery = (value: string) => { setQuery(value); setDepartment(allDepartments); };

  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="mb-1.5 text-sm font-medium text-[#1d2129]">指定成员<span aria-hidden="true" className="ml-0.5 text-[#f53f3f]">*</span></legend>
      <div className="overflow-hidden rounded-md border border-[#e5e6eb] bg-white">
        <div className="flex h-9 items-center gap-2 border-b border-[#e5e6eb] px-3 focus-within:bg-[#fafcff]">
          <Search aria-hidden="true" className="size-4 shrink-0 text-[#86909c]" />
          <input
            type="search" aria-label="搜索部门或成员" placeholder="搜索部门或成员" value={query}
            onChange={(event) => updateQuery(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.preventDefault(); }}
            className="min-w-0 flex-1 bg-transparent text-sm text-[#1d2129] outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {query && <button type="button" aria-label="清除成员搜索" title="清除搜索" onClick={() => updateQuery('')} className="rounded p-1 text-[#4e5969] hover:bg-[#f2f3f5]"><X className="size-3.5" /></button>}
        </div>
        {groups.length ? (
          <div className="grid h-36 grid-cols-[minmax(6.5rem,1fr)_minmax(0,2fr)]">
            <div role="group" aria-label="部门" className="overflow-y-auto border-r border-[#e5e6eb] bg-[#f7f8fa] p-1.5">
              <p className="px-2 py-1 text-xs text-[#646a73]">部门</p>
              {departmentOptions.map(({ name, members }) => {
                const label = name === allDepartments ? '全部' : name;
                const ids = members.map((member) => member.username);
                const checked = ids.every((id) => selectedIds.has(id));
                const mixed = !checked && ids.some((id) => selectedIds.has(id));
                const checkboxLabel = `全选${name}的${terms.length ? '匹配成员' : '成员'}`;
                return (
                  <div key={name} className={'flex min-h-8 items-center rounded pl-2 ' + (department === name ? 'bg-[#eaf2ff]' : 'hover:bg-[#f2f3f5]')}>
                    <input
                      type="checkbox"
                      checked={checked}
                      ref={(input) => { if (input) input.indeterminate = mixed; }}
                      title={checkboxLabel}
                      aria-label={checkboxLabel}
                      className="size-4 shrink-0 accent-[#165dff]"
                      onChange={() => {
                        const groupIds = new Set(ids);
                        onChange(checked ? memberIds.filter((id) => !groupIds.has(id)) : [...new Set([...memberIds, ...ids])]);
                      }}
                    />
                    <button type="button" title={label} aria-pressed={department === name} onClick={() => setDepartment(name)} className="flex min-h-8 min-w-0 flex-1 items-center justify-between gap-1 rounded py-1 pr-2 pl-1.5 text-left text-xs text-[#4e5969] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#165dff] aria-pressed:font-medium aria-pressed:text-[#165dff]">
                      <span className="min-w-0 break-words">{label}</span><ChevronRight aria-hidden="true" className="size-3 shrink-0" />
                    </button>
                  </div>
                );
              })}
            </div>
            <div role="group" aria-label="成员" className="overflow-y-auto p-1.5">
              <p className="px-2 py-1 text-xs text-[#646a73]">成员</p>
              {visibleGroups.map((group) => (
                <div key={group.name} role="group" aria-label={group.name}>
                  {department === allDepartments && <p className="px-2 pt-1.5 pb-0.5 text-xs text-[#646a73]">{group.name}</p>}
                  {group.members.map((user) => (
                    <label key={user.username} className="flex min-h-8 cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-[#f7f8fa]">
                      <input type="checkbox" className="size-4 shrink-0 accent-[#165dff]" checked={memberIds.includes(user.username)} onChange={() => toggle(user.username)} />
                      <span className="min-w-0 break-all text-sm text-[#1d2129]">{user.name || user.username}{user.name && user.name !== user.username && <span className="ml-1.5 text-xs text-[#646a73]">{user.username}</span>}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : <p role="status" className="flex h-36 items-center justify-center px-3 text-center text-sm text-[#646a73]">{terms.length ? '未找到匹配的部门或成员' : '暂无可选成员'}</p>}
        <div className="flex min-h-9 items-start gap-2 border-t border-[#e5e6eb] px-3 py-1.5">
          <span aria-live="polite" className="shrink-0 pt-0.5 text-xs text-[#646a73]">已选 {memberIds.length} 人</span>
          {!!memberIds.length && <ul aria-label="已选成员" className="flex min-w-0 flex-1 flex-wrap gap-1 overflow-y-auto max-h-16">
            {memberIds.map((id) => {
              const name = users.find((user) => user.username === id)?.name || id;
              return <li key={id} className="min-w-0 max-w-full"><button type="button" aria-label={`移除 ${name}`} title={`移除 ${name}（${id}）`} onClick={() => toggle(id)} className="flex h-6 max-w-full items-center gap-1 rounded bg-[#eaf2ff] px-1.5 text-xs text-[#165dff] hover:bg-[#dce9ff]"><span className="min-w-0 truncate">{name}</span><X aria-hidden="true" className="size-3 shrink-0" /></button></li>;
            })}
          </ul>}
        </div>
      </div>
    </fieldset>
  );
}
