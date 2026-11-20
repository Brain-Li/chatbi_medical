import { useEffect, useRef, useState } from 'react';
import { BookOpen, ChevronRight, Plus, Search, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { KnowledgeMemberPicker } from '../components/KnowledgeMemberPicker';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Switch } from '../components/ui/switch';
import { deleteKnowledgeLibrary, listKnowledgeLibraries, saveKnowledgeLibrary, updateKnowledgeLibraryStatus } from '../knowledge/api';
import { KnowledgeListPagination, PAGE_SIZES } from '../knowledge/KnowledgeListPagination';
import { knowledgeVisibilityLabels, type KnowledgeLibrary, type KnowledgeLibraryStatus, type KnowledgeVisibility } from '../knowledge/types';

const primaryButton = 'inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-[#165dff] px-3 text-sm font-medium text-white hover:bg-[#0f4fd4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#165dff] disabled:opacity-50';
const field = 'w-full rounded-md border border-[#e5e6eb] bg-white px-3 py-2 text-sm text-[#1d2129] outline-none focus:border-[#165dff]';
const rowAction = 'inline-flex h-8 items-center justify-center gap-0.5 whitespace-nowrap rounded px-2 text-sm focus-visible:outline-2 focus-visible:outline-[#165dff]';
const NAME_MAX_LENGTH = 20;
const DESCRIPTION_MAX_LENGTH = 500;
const createdAtFormat = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
});
const createdTime = (library: KnowledgeLibrary) => Date.parse(library.createdAt ?? '') || 0;

export default function KnowledgeOverviewPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const search = params.size ? '?' + params.toString() : '';
  const [data, setData] = useState<Awaited<ReturnType<typeof listKnowledgeLibraries>> | null>(null);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [editor, setEditor] = useState<{ library?: KnowledgeLibrary } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeLibrary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [savingStatusIds, setSavingStatusIds] = useState<string[]>([]);
  const listScrollRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    listKnowledgeLibraries(controller.signal).then(setData).catch((error: unknown) => {
      if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : '无法加载知识库');
    });
    return () => controller.abort();
  }, [attempt]);

  const setQuery = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set('q', value);
    else next.delete('q');
    next.delete('page');
    setParams(next, { replace: true, preventScrollReset: true });
    listScrollRef.current?.scrollTo({ top: 0 });
  };
  const openNew = () => setEditor({});
  const getLibraryLink = (id: string) => ({ pathname: '/knowledge/' + encodeURIComponent(id), search });
  const normalized = query.trim().toLocaleLowerCase();
  const libraries = data?.libraries
    .filter((library) => [library.name, library.description, library.createdBy || ''].some((value) => value.toLocaleLowerCase().includes(normalized)))
    .sort((a, b) => createdTime(b) - createdTime(a)) ?? [];
  const pageSize = PAGE_SIZES.find((size) => size === Number(params.get('pageSize'))) ?? PAGE_SIZES[0];
  const totalPages = Math.max(1, Math.ceil(libraries.length / pageSize));
  const requestedPage = Number(params.get('page'));
  const page = Number.isInteger(requestedPage) ? Math.min(totalPages, Math.max(1, requestedPage)) : 1;
  const start = (page - 1) * pageSize;
  const pageLibraries = libraries.slice(start, start + pageSize);

  const replaceLibrary = (library: KnowledgeLibrary) => {
    setData((current) => current && { ...current, libraries: current.libraries.map((entry) => entry.id === library.id ? library : entry) });
  };

  const changeStatus = async (library: KnowledgeLibrary, enabled: boolean) => {
    if (!library.canEdit || savingStatusIds.includes(library.id)) return;
    setSavingStatusIds((ids) => [...ids, library.id]);
    try {
      replaceLibrary(await updateKnowledgeLibraryStatus(library.id, enabled ? 'enabled' : 'disabled'));
      toast.success(enabled ? '知识库已启用' : '知识库已停用');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '无法更新知识库状态');
    } finally {
      setSavingStatusIds((ids) => ids.filter((id) => id !== library.id));
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteKnowledgeLibrary(deleteTarget.id);
      setData((current) => current && { ...current, libraries: current.libraries.filter((entry) => entry.id !== deleteTarget.id) });
      setDeleteTarget(null);
      toast.success('知识库已删除');
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : '无法删除知识库');
    } finally {
      setDeleting(false);
    }
  };

  const changePage = (nextPage: number) => {
    if (nextPage === page) return;
    const next = new URLSearchParams(params);
    if (nextPage === 1) next.delete('page');
    else next.set('page', String(nextPage));
    setParams(next, { preventScrollReset: true });
    listScrollRef.current?.scrollTo({ top: 0 });
  };

  const changePageSize = (size: number) => {
    const next = new URLSearchParams(params);
    next.delete('page');
    if (size === PAGE_SIZES[0]) next.delete('pageSize');
    else next.set('pageSize', String(size));
    setParams(next, { preventScrollReset: true });
    listScrollRef.current?.scrollTo({ top: 0 });
  };

  return (
    <section className="flex h-full min-h-0 flex-col bg-white text-[#1d2129]" data-testid="knowledge-page">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#e5e6eb] px-5 py-4 sm:px-7">
        <h1 className="text-[20px] font-semibold leading-7 text-[#1d2129]">知识库</h1>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <label className="flex h-9 w-56 max-w-full items-center gap-2 rounded-md border border-[#e5e6eb] px-3 text-[#86909c] focus-within:border-[#165dff] sm:w-64">
            <Search className="size-4 shrink-0" />
            <input ref={searchRef} aria-label="搜索知识库" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索知识库" className="min-w-0 flex-1 bg-transparent text-sm text-[#1d2129] outline-none placeholder:text-[#86909c]" />
            {query && <button type="button" aria-label="清除搜索" onClick={() => setQuery('')}><X className="size-4" /></button>}
          </label>
          {data?.session.canManage && <button type="button" onClick={openNew} className={primaryButton}><Plus className="size-4" />新建知识库</button>}
        </div>
      </header>
      <main ref={listScrollRef} className="min-h-0 min-w-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
        <div className="mx-auto max-w-[1440px]">
          {loadError ? (
            <div role="alert" className="py-16 text-center text-sm text-[#4e5969]">
              {loadError}
              <button type="button" onClick={() => { setLoadError(''); setAttempt((value) => value + 1); }} className="ml-3 text-[#165dff] hover:underline">重试</button>
            </div>
          ) : !data ? (
            <div role="status" className="py-16 text-center text-sm text-[#4e5969]">正在加载知识库…</div>
          ) : libraries.length ? (
            <div role="region" aria-label="知识库管理列表" tabIndex={0} className="overflow-x-auto rounded-lg border border-[#e5e6eb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#165dff]">
              <table className="w-full min-w-[820px] table-fixed text-left text-sm">
                <colgroup>
                  <col /><col /><col className="w-40" /><col className="w-20" />
                  <col className="w-28" /><col className="w-24" /><col className="w-40" />
                </colgroup>
                <thead className="bg-[#f7f8fa] text-[#4e5969]">
                  <tr>
                    <th scope="col" className="px-3 py-3 font-medium">知识库名称</th>
                    <th scope="col" className="px-3 py-3 font-medium">描述</th>
                    <th scope="col" aria-sort="descending" className="px-3 py-3 font-medium">创建时间</th>
                    <th scope="col" className="px-3 py-3 font-medium">创建人</th>
                    <th scope="col" className="px-3 py-3 font-medium">可见范围</th>
                    <th scope="col" className="px-2 py-3 font-medium">状态</th>
                    <th scope="col" className="sticky right-0 bg-[#f7f8fa] px-3 py-3 text-center font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pageLibraries.map((library) => {
                    const link = getLibraryLink(library.id);
                    const timestamp = createdTime(library);
                    const enabled = library.status !== 'disabled';
                    const savingStatus = savingStatusIds.includes(library.id);
                    return (
                      <tr key={library.id} className="group border-t border-[#e5e6eb] hover:bg-[#fafbfc] focus-within:bg-[#fafbfc]">
                        <th scope="row" className="px-3 py-2 font-medium">
                          <Link to={link} title={library.name} className="block truncate rounded-sm text-[#165dff] underline decoration-transparent underline-offset-2 hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#165dff]">{library.name}</Link>
                        </th>
                        <td className="px-3 py-2 text-[#4e5969]"><span className="block truncate" title={library.description || undefined}>{library.description || '—'}</span></td>
                        <td className="whitespace-nowrap px-3 py-2 text-[#4e5969] tabular-nums">
                          {timestamp ? <time dateTime={library.createdAt}>{createdAtFormat.format(timestamp).replaceAll('/', '-')}</time> : '—'}
                        </td>
                        <td className="px-3 py-2 text-[#4e5969]"><span className="block truncate">{library.createdBy || '—'}</span></td>
                        <td className="px-3 py-2">
                          <span title={knowledgeVisibilityLabels[library.visibility].label} className={'inline-flex whitespace-nowrap rounded px-2 py-1 text-xs font-medium ' + (library.visibility === 'team' ? 'bg-[#eaf2ff] text-[#165dff]' : 'bg-[#f2f3f5] text-[#4e5969]')}>{knowledgeVisibilityLabels[library.visibility].shortLabel}</span>
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center" title={library.canEdit ? undefined : '无权修改状态'}>
                            <Switch aria-label={'知识库状态：' + library.name} checked={enabled} disabled={!library.canEdit || savingStatus} onCheckedChange={(checked) => void changeStatus(library, checked)} className="data-[state=checked]:bg-[#165dff] motion-reduce:transition-none" />
                            <span aria-live="polite" className="sr-only">{savingStatus ? '保存中' : enabled ? '已启用' : '已停用'}</span>
                          </div>
                        </td>
                        <td className="sticky right-0 bg-white px-2 py-2 group-focus-within:bg-[#fafbfc] group-hover:bg-[#fafbfc]">
                          <div className="flex items-center justify-center gap-0.5">
                            <Link to={link} aria-label={'管理知识库：' + library.name} className={rowAction + ' font-medium text-[#165dff] hover:bg-[#eaf2ff]'}>管理<ChevronRight className="size-3.5" aria-hidden="true" /></Link>
                            {library.canEdit && <button type="button" aria-label={'编辑知识库：' + library.name} disabled={savingStatus} onClick={() => setEditor({ library })} className={rowAction + ' text-[#4e5969] enabled:hover:bg-[#f2f3f5] disabled:opacity-50'}>编辑</button>}
                            {library.canEdit && data.session.role === 'admin' && <button type="button" aria-label={'删除知识库：' + library.name} disabled={savingStatus} onClick={(event) => {
                              deleteTriggerRef.current = event.currentTarget;
                              setDeleteError('');
                              setDeleteTarget(library);
                            }} className={rowAction + ' text-[#d4380d] enabled:hover:bg-[#fff1f0] disabled:opacity-50'}>删除</button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center gap-3 px-6 text-center">
              {normalized ? <Search className="size-8 text-[#86909c]" /> : <BookOpen className="size-8 text-[#86909c]" />}
              <p className="text-sm font-medium">{normalized ? '没有匹配的知识库' : data.session.canManage ? '暂无知识库' : '暂无可查看的知识库'}</p>
              {normalized && <button type="button" onClick={() => setQuery('')} className="text-sm text-[#165dff] hover:underline">清除搜索</button>}
            </div>
          )}
          {!loadError && libraries.length > 0 && (
            <KnowledgeListPagination label="知识库列表分页" className="sticky bottom-0 z-10" count={libraries.length} pageSize={pageSize} page={page} totalPages={totalPages} onPageChange={changePage} onPageSizeChange={changePageSize} />
          )}
        </div>
      </main>
      {editor && data && <LibraryEditor library={editor.library} currentUserId={data.session.userId} onClose={() => setEditor(null)} onSaved={(library) => {
        setEditor(null);
        if (editor.library) {
          replaceLibrary(library);
          toast.success('知识库设置已保存');
        } else {
          setData((current) => current && { ...current, libraries: [library, ...current.libraries] });
          toast.success('知识库已创建');
        }
      }} />}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !deleting) setDeleteTarget(null); }}>
        <AlertDialogContent onCloseAutoFocus={(event) => {
          event.preventDefault();
          (deleteTriggerRef.current?.isConnected ? deleteTriggerRef.current : searchRef.current)?.focus();
        }}>
          <AlertDialogHeader>
            <AlertDialogTitle>删除知识库</AlertDialogTitle>
            <AlertDialogDescription>确认删除「{deleteTarget?.name}」？库内的所有文件将一并删除，此操作不可撤销。</AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p role="alert" className="text-sm text-[#d4380d]">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <button type="button" disabled={deleting} onClick={() => void confirmDelete()} className="h-9 rounded-md bg-[#d4380d] px-3 text-sm font-medium text-white enabled:hover:bg-[#ad2f0b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4380d] disabled:opacity-50">{deleting ? '删除中…' : '确认删除'}</button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function LibraryEditor({ library, currentUserId, onClose, onSaved }: { library?: KnowledgeLibrary; currentUserId: string; onClose: () => void; onSaved: (library: KnowledgeLibrary) => void }) {
  const [name, setName] = useState(library?.name ?? '');
  const [description, setDescription] = useState(library?.description ?? '');
  const [visibility, setVisibility] = useState<KnowledgeVisibility>(library?.visibility ?? 'team');
  const [status, setStatus] = useState<KnowledgeLibraryStatus>(library?.status ?? 'enabled');
  const [memberIds, setMemberIds] = useState(() => library?.memberIds?.filter((id) => id !== currentUserId) ?? []);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const canChangeVisibility = !library || library.createdBy === currentUserId;
  const nameTooLong = name.length > NAME_MAX_LENGTH;
  const canSave = !saving && name.trim().length > 0 && !nameTooLong && (visibility !== 'restricted' || memberIds.length > 0);

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <DialogContent showCloseButton={!saving} className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{library ? '编辑知识库' : '新建知识库'}</DialogTitle>
          <DialogDescription className="sr-only">知识库名称、可见范围、状态和描述</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={async (event) => {
          event.preventDefault();
          if (!canSave) return;
          setSaving(true);
          setError('');
          try { onSaved(await saveKnowledgeLibrary({ name, description, visibility, status, memberIds: visibility === 'restricted' ? memberIds : [] }, library?.id)); }
          catch (cause) { setError(cause instanceof Error ? cause.message : '无法保存知识库'); setSaving(false); }
        }}>
          <label className="grid gap-1.5 text-sm font-medium">
            <span>知识库名称<span aria-hidden="true" className="ml-0.5 text-[#f53f3f]">*</span></span>
            <span className="relative block">
              <input autoFocus required maxLength={NAME_MAX_LENGTH} aria-invalid={nameTooLong || undefined} className={field + ' pr-16'} value={name} onChange={(event) => setName(event.target.value)} placeholder="输入知识库名称" />
              <span aria-hidden="true" className={'pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-normal tabular-nums ' + (nameTooLong ? 'text-[#d4380d]' : 'text-[#646a73]')}>{name.length}/{NAME_MAX_LENGTH}</span>
            </span>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">可见范围<select className={field + ' disabled:cursor-not-allowed disabled:bg-[#f7f8fa]'} disabled={!canChangeVisibility} value={visibility} onChange={(event) => setVisibility(event.target.value as KnowledgeVisibility)}>
            <option value="team">{knowledgeVisibilityLabels.team.label}</option>
            <option value="restricted">{knowledgeVisibilityLabels.restricted.label}</option>
            <option value="private">{knowledgeVisibilityLabels.private.label}</option>
          </select></label>
          {visibility === 'restricted' && <KnowledgeMemberPicker memberIds={memberIds} onChange={setMemberIds} currentUserId={currentUserId} disabled={saving} />}
          <label className="grid gap-1.5 text-sm font-medium">状态
            <select className={field} value={status} onChange={(event) => setStatus(event.target.value === 'disabled' ? 'disabled' : 'enabled')}>
              <option value="enabled">启用</option>
              <option value="disabled">停用</option>
            </select>
          </label>
          <div className="grid gap-1.5">
            <label htmlFor="knowledge-description" className="text-sm font-medium">描述 <span className="font-normal text-[#646a73]">（选填）</span></label>
            <div className="grid overflow-hidden rounded-md border border-[#e5e6eb] bg-white focus-within:border-[#165dff]">
              <textarea id="knowledge-description" rows={3} maxLength={DESCRIPTION_MAX_LENGTH} aria-describedby="knowledge-description-count" className="block w-full resize-y border-0 bg-transparent px-3 pt-2 pb-1 text-sm text-[#1d2129] outline-none" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="输入知识库描述" />
              <span id="knowledge-description-count" className="px-3 pb-2 text-right text-xs font-normal tabular-nums text-[#646a73]">{description.length}/{DESCRIPTION_MAX_LENGTH}</span>
            </div>
          </div>
          {error && <p role="alert" className="text-sm text-[#d4380d]">{error}</p>}
          <DialogFooter>
            <button type="button" disabled={saving} onClick={onClose} className="h-9 rounded-md border border-[#e5e6eb] px-3 text-sm hover:bg-[#f7f8fa] disabled:opacity-50">取消</button>
            <button type="submit" disabled={!canSave} className={primaryButton}>{saving ? '保存中…' : library ? '保存' : '创建'}</button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
