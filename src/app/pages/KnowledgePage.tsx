import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, Download, Eye, FileText, Folder, FolderOpen, LoaderCircle, RefreshCw, Search, Trash2, Upload, X } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router';
import { toast } from 'sonner';
import { deleteKnowledgeItem, fileSizeLimitErrorMessage, getKnowledgeLibrary, readKnowledgeFile, retryKnowledgeIndex, unsupportedFileFormatMessage, updateKnowledgeItem, uploadKnowledgeFile } from '../knowledge/api';
import { KnowledgeListPagination, PAGE_SIZES } from '../knowledge/KnowledgeListPagination';
import type { KnowledgeItem, KnowledgeLibrary } from '../knowledge/types';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../components/ui/sheet';

const formatSize = (bytes = 0) => bytes < 1024 * 1024 ? Math.max(1, Math.round(bytes / 1024)) + ' KB' : (bytes / (1024 * 1024)).toFixed(1) + ' MB';
const fileExtension = (name: string) => /\.([^.]+)$/.exec(name)?.[1]?.toUpperCase();
const previewFormat = (item: KnowledgeItem) => /\.(txt|md)$/i.test(item.name) ? 'text' : item.mimeType === 'application/pdf' ? 'pdf' : null;
const documentExtensions = 'PDF、DOCX、XLSX、PPTX、TXT、MD';
const uploadedAtFormat = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const fileStatuses = {
  ready: { label: '已完成', style: 'bg-[#e8ffea] text-[#217a35]' },
  processing: { label: '解析中', style: 'bg-[#fff7e8] text-[#975700]' },
  failed: { label: '解析失败', style: 'bg-[#fff1f0] text-[#bc2c12]' },
  unindexed: { label: '未接入索引', style: 'bg-[#f2f3f5] text-[#4e5969]' },
};
const statusDemoLibraryId = '740e358b-5838-4fbf-85d6-6bcedc6ad01e';
const demoFileSpecs = [
  { name: '【演示】产品说明.pdf', status: 'processing', size: 768 * 1024 },
  { name: '【演示】接口规范.docx', status: 'ready', size: 256 * 1024 },
  { name: '【演示】交付清单.xlsx', status: 'failed', size: 128 * 1024 },
] as const;
const secondaryButton = 'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-[#e5e6eb] px-2.5 text-sm text-[#4e5969] enabled:hover:bg-[#f7f8fa] disabled:opacity-50';
const rowAction = 'inline-flex size-[26px] shrink-0 items-center justify-center rounded text-[#4e5969] enabled:hover:bg-[#f2f3f5] enabled:hover:text-[#165dff] focus-visible:outline-[#165dff] disabled:cursor-not-allowed disabled:opacity-50';

type PendingUpload = { id: string; name: string; status: 'uploading' | 'failed'; error?: string };
type PreviewContent = { kind: 'loading' | 'unsupported' } | { kind: 'text'; text: string } | { kind: 'pdf'; url: string } | { kind: 'error'; message: string };

export default function KnowledgePage() {
  const { libraryId } = useParams();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const hasDemoParam = params.get('demo') === 'status';
  if (hasDemoParam) params.delete('demo');
  const showStatusDemo = libraryId === statusDemoLibraryId || hasDemoParam;
  return <LibraryFiles key={libraryId} libraryId={libraryId!} showStatusDemo={showStatusDemo} overview={{ pathname: '/knowledge', search: hasDemoParam ? params.toString() : search }} />;
}

function LibraryFiles({ libraryId, overview, showStatusDemo }: { libraryId: string; overview: { pathname: string; search: string }; showStatusDemo: boolean }) {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [library, setLibrary] = useState<KnowledgeLibrary | null>(null);
  const [loadError, setLoadError] = useState('');
  const canManage = Boolean(library?.canManage && !loadError);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
  const [requestedPage, setRequestedPage] = useState(1);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [moveItem, setMoveItem] = useState<KnowledgeItem | null>(null);
  const [moveTarget, setMoveTarget] = useState('root');
  const [deleteItem, setDeleteItem] = useState<KnowledgeItem | null>(null);
  const [preview, setPreview] = useState<{ item: KnowledgeItem; content: PreviewContent } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listScrollRef = useRef<HTMLDivElement>(null);
  const previewTriggerRef = useRef<HTMLButtonElement | null>(null);
  const uploadControllers = useRef(new Map<string, AbortController>());

  const refresh = async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError('');
    try {
      const result = await getKnowledgeLibrary(libraryId, signal);
      if (!result.library) throw new Error('无法读取知识库，请确认本地知识库服务已更新。');
      setLibrary(result.library);
      setItems(result.items);
      setSelectedFolderId((current) => current && result.items.some((item) => item.id === current && item.kind === 'folder') ? current : null);
    } catch (error) {
      if (!signal?.aborted) {
        setLibrary(null);
        setItems([]);
        setLoadError(error instanceof Error ? error.message : '无法加载知识库');
      }
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  };
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => controller.abort();
  }, []);
  useEffect(() => () => { uploadControllers.current.forEach((controller) => controller.abort()); }, []);

  const previewItem = preview?.item;
  useEffect(() => {
    const format = previewItem && previewFormat(previewItem);
    if (!previewItem || !format) return;
    const controller = new AbortController();
    let url: string | undefined;

    const loadPreview = async () => {
      try {
        const blob = await readKnowledgeFile(previewItem.id, controller.signal);
        if (format === 'text') {
          const text = await blob.text();
          if (!controller.signal.aborted) setPreview({ item: previewItem, content: { kind: 'text', text } });
        } else if (!controller.signal.aborted) {
          if (blob.type !== 'application/pdf') throw new Error('无法预览该 PDF 文件。');
          url = URL.createObjectURL(blob);
          setPreview({ item: previewItem, content: { kind: 'pdf', url } });
        }
      } catch (error) {
        if (!controller.signal.aborted) setPreview({ item: previewItem, content: { kind: 'error', message: error instanceof Error ? error.message : '无法加载文件预览。' } });
      }
    };

    void loadPreview();
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [previewItem]);

  const folders = useMemo(() => items.filter((item) => item.kind === 'folder'), [items]);
  const getFolderPath = (folderId: string | null) => {
    const names: string[] = [];
    let current = folders.find((item) => item.id === folderId);
    while (current) {
      names.unshift(current.name);
      current = current.parentId ? folders.find((item) => item.id === current?.parentId) : undefined;
    }
    return names.join(' / ');
  };
  const selectedFolder = folders.find((item) => item.id === selectedFolderId) ?? null;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const demoItems = useMemo<KnowledgeItem[]>(() => {
    if (!showStatusDemo) return [];
    const now = Date.now();
    return demoFileSpecs.map((spec, index) => {
      const timestamp = new Date(now - index * 60_000).toISOString();
      return { ...spec, id: `demo-${spec.status}`, scopeId: libraryId, parentId: null, kind: 'file', createdBy: 'demo', createdAt: timestamp, updatedAt: timestamp };
    });
  }, [libraryId, showStatusDemo]);
  const visibleItems = useMemo(() => {
    const matches = items.concat(demoItems).filter((item) => {
      if (normalizedQuery) return item.name.toLocaleLowerCase().includes(normalizedQuery) || getFolderPath(item.parentId).toLocaleLowerCase().includes(normalizedQuery);
      return item.parentId === selectedFolderId;
    });
    return matches.sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === 'folder' ? -1 : 1;
      if (left.kind === 'file') {
        const newestFirst = (Date.parse(right.createdAt) || 0) - (Date.parse(left.createdAt) || 0);
        if (newestFirst) return newestFirst;
      }
      return left.name.localeCompare(right.name, 'zh-CN');
    });
  }, [items, demoItems, normalizedQuery, selectedFolderId]);
  const pageCount = Math.max(1, Math.ceil(visibleItems.length / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const pageStart = (page - 1) * pageSize;
  const pageItems = visibleItems.slice(pageStart, pageStart + pageSize);
  useEffect(() => { setRequestedPage((current) => Math.min(current, pageCount)); }, [pageCount]);

  const changePage = (nextPage: number) => {
    setRequestedPage(nextPage);
    listScrollRef.current?.scrollTo({ top: 0 });
  };
  const changePageSize = (size: number) => { setPageSize(size); changePage(1); };
  const changeQuery = (value: string) => { setQuery(value); changePage(1); };
  const openFolder = (id: string | null) => { setSelectedFolderId(id); changeQuery(''); };
  const childCount = (folderId: string) => items.filter((item) => item.parentId === folderId).length;

  const uploadFiles = async (files: FileList | File[]) => {
    if (!canManage || !files.length) return;
    const selectedFiles = Array.from(files);
    const duplicateNames: string[] = [];
    const unsupportedFormatNames: string[] = [];
    const oversizedNames: string[] = [];
    const pending = selectedFiles.map((file) => ({ id: crypto.randomUUID(), name: file.name, status: 'uploading' as const }));
    setPendingUploads((current) => [...pending, ...current]);
    await Promise.all(selectedFiles.map(async (file, index) => {
      const pendingId = pending[index].id;
      const controller = new AbortController();
      uploadControllers.current.set(pendingId, controller);
      try {
        await uploadKnowledgeFile(libraryId, selectedFolderId, file, controller.signal);
        setPendingUploads((current) => current.filter((item) => item.id !== pendingId));
      } catch (error) {
        if (controller.signal.aborted) {
          setPendingUploads((current) => current.filter((item) => item.id !== pendingId));
          return;
        }
        const message = error instanceof Error ? error.message : '上传失败';
        if (message.includes('同一文件夹中已存在同名项目')) {
          duplicateNames.push(file.name);
          setPendingUploads((current) => current.filter((item) => item.id !== pendingId));
          return;
        }
        if (message === unsupportedFileFormatMessage) {
          unsupportedFormatNames.push(file.name);
          setPendingUploads((current) => current.filter((item) => item.id !== pendingId));
          return;
        }
        if (message === fileSizeLimitErrorMessage) {
          oversizedNames.push(file.name);
          setPendingUploads((current) => current.filter((item) => item.id !== pendingId));
          return;
        }
        setPendingUploads((current) => current.map((item) => item.id === pendingId ? { ...item, status: 'failed', error: message } : item));
        toast.error(file.name + '：' + message);
      } finally {
        uploadControllers.current.delete(pendingId);
      }
    }));
    if (duplicateNames.length === 1) {
      toast.error(`「${duplicateNames[0]}」此知识库已存在同名文件，未上传。`);
    } else if (duplicateNames.length > 1) {
      toast.error(`「${duplicateNames[0]}」等 ${duplicateNames.length} 个文件因同名未上传。`);
    }
    if (unsupportedFormatNames.length === 1) {
      toast.error(`「${unsupportedFormatNames[0]}」${unsupportedFileFormatMessage}`);
    } else if (unsupportedFormatNames.length > 1) {
      toast.error(`「${unsupportedFormatNames[0]}」等 ${unsupportedFormatNames.length} 个文件上传失败：暂不支持该文件格式。`);
    }
    if (oversizedNames.length === 1) {
      toast.error(`「${oversizedNames[0]}」${fileSizeLimitErrorMessage}`);
    } else if (oversizedNames.length > 1) {
      toast.error(`「${oversizedNames[0]}」等 ${oversizedNames.length} 个文件上传失败：文件大小超过 50 MB。`);
    }
    await refresh();
  };

  const submitMove = async () => {
    if (!moveItem) return;
    try {
      await updateKnowledgeItem(moveItem.id, { parentId: moveTarget === 'root' ? null : moveTarget });
      setMoveItem(null);
      await refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : '移动失败'); }
  };

  const openPreview = (item: KnowledgeItem, trigger: HTMLButtonElement) => {
    previewTriggerRef.current = trigger;
    setPreview({ item, content: { kind: previewFormat(item) ? 'loading' : 'unsupported' } });
  };

  const downloadFile = async (item: KnowledgeItem) => {
    try {
      const blob = await readKnowledgeFile(item.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = item.name;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) { toast.error(error instanceof Error ? error.message : '下载失败'); }
  };

  const confirmDelete = async () => {
    if (!deleteItem) return;
    try {
      await deleteKnowledgeItem(deleteItem.id);
      setDeleteItem(null);
      if (selectedFolderId === deleteItem.id) setSelectedFolderId(null);
      await refresh();
      toast.success('已删除资料');
    } catch (error) { toast.error(error instanceof Error ? error.message : '删除失败'); }
  };

  const retryIndex = async (item: KnowledgeItem) => {
    try { await retryKnowledgeIndex(item.id); await refresh(); }
    catch (error) { toast.error(error instanceof Error ? error.message : '重试失败'); }
  };

  const renderTree = (parentId: string | null, depth = 0): JSX.Element[] => folders
    .filter((folder) => folder.parentId === parentId)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    .flatMap((folder) => [
      <button key={folder.id} type="button" onClick={() => openFolder(folder.id)} aria-current={selectedFolderId === folder.id ? 'page' : undefined} className={'flex h-9 w-full min-w-0 items-center gap-2 rounded px-2 text-left text-sm hover:bg-[#f2f3f5] ' + (selectedFolderId === folder.id ? 'bg-[#eaf2ff] text-[#165dff]' : 'text-[#4e5969]')} style={{ paddingLeft: 8 + depth * 16 }}>
        {selectedFolderId === folder.id ? <FolderOpen className="h-4 w-4 shrink-0" /> : <Folder className="h-4 w-4 shrink-0" />}
        <span className="min-w-0 flex-1 truncate">{folder.name}</span><span className="text-xs text-[#86909c]">{childCount(folder.id)}</span>
      </button>,
      ...renderTree(folder.id, depth + 1),
    ]);

  return (
    <section className="flex h-full min-h-0 flex-col bg-white text-[#1d2129]" data-testid="knowledge-library-page">
      <header className="flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-2 border-b border-[#e5e6eb] px-3 py-4 sm:px-7">
        <div className="flex min-h-9 min-w-0 flex-1 items-center gap-3">
          <Link to={overview} aria-label="返回知识库列表" title="返回知识库列表" className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-[#4e5969] hover:bg-[#f2f3f5] hover:text-[#165dff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/25">
            <ArrowLeft aria-hidden="true" className="size-4" />
          </Link>
          <h1 aria-current="page" title={library?.name} className="min-w-0 truncate text-[20px] font-semibold leading-7 text-[#1d2129]">{library?.name ?? '知识库详情'}</h1>
        </div>
        <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-2 sm:w-auto">
          <label className="flex h-9 w-60 max-w-full grow items-center gap-2 rounded-md border border-[#e5e6eb] px-3 text-[#86909c] focus-within:border-[#165dff] sm:grow-0">
            <Search aria-hidden="true" className="size-4 shrink-0" />
            <input aria-label="搜索当前知识库文件" value={query} disabled={!library} onChange={(event) => changeQuery(event.target.value)} placeholder="搜索当前知识库文件" className="min-w-0 flex-1 bg-transparent text-sm text-[#1d2129] outline-none placeholder:text-[#86909c] disabled:opacity-50" />
            {query && library && <button type="button" aria-label="清除搜索" onClick={() => changeQuery('')}><X className="size-4" /></button>}
          </label>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" aria-label="刷新" title="刷新" disabled={isLoading} onClick={() => void refresh()} className={secondaryButton}>
              <RefreshCw aria-hidden="true" className={'size-4 ' + (isLoading ? 'motion-safe:animate-spin' : '')} /><span className="hidden sm:inline">刷新</span>
            </button>
            <button type="button" disabled={!canManage} title={library && !canManage ? '没有上传权限' : `支持 ${documentExtensions} · 单文件不超过 50 MB`} onClick={() => fileInputRef.current?.click()} className="inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-md bg-[#165dff] px-3 text-sm font-medium text-white enabled:hover:bg-[#0f4fd4] disabled:cursor-not-allowed disabled:opacity-50">
              <Upload aria-hidden="true" className="size-4" />上传文件
            </button>
            <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.xlsx,.pptx,.txt,.md" className="hidden" onChange={(event) => { if (event.target.files) void uploadFiles(event.target.files); event.target.value = ''; }} />
          </div>
        </div>
      </header>

      {loadError ? (
        <div role="alert" className="p-10 text-center text-sm text-[#4e5969]">{loadError}<button type="button" onClick={() => void refresh()} className="ml-3 text-[#165dff] hover:underline">重试</button></div>
      ) : !library ? (
        <div role="status" className="p-10 text-center text-sm text-[#4e5969]">正在加载知识库…</div>
      ) : <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {folders.length > 0 && <aside className="flex max-h-44 shrink-0 flex-col border-b border-[#e5e6eb] bg-[#fafbfc] p-3 md:max-h-none md:w-52 md:border-b-0 md:border-r xl:w-60">
          <button type="button" onClick={() => openFolder(null)} aria-current={selectedFolderId === null ? 'page' : undefined} className={'mb-2 flex h-9 items-center gap-2 rounded px-2 text-left text-sm ' + (selectedFolderId === null ? 'bg-[#eaf2ff] text-[#165dff]' : 'text-[#4e5969] hover:bg-[#f2f3f5]')}><FolderOpen className="h-4 w-4" />全部文件</button>
          <div className="mb-1 px-2 text-xs font-medium text-[#86909c]">文件夹</div>
          <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto" aria-label="知识库文件夹">{renderTree(null)}</nav>
        </aside>}

        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col px-3 py-5 sm:px-7" onDragEnter={(event) => { event.preventDefault(); if (canManage) setIsDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsDragging(false); }} onDrop={(event) => { event.preventDefault(); setIsDragging(false); if (event.dataTransfer.files.length) void uploadFiles(event.dataTransfer.files); }}>
          {(normalizedQuery || selectedFolder) && (
            <div className="mb-3 flex min-w-0 shrink-0 items-center gap-1.5 text-sm">
              {normalizedQuery ? <h2 className="font-medium">搜索结果</h2> : selectedFolder && <>
                <button type="button" onClick={() => openFolder(null)} className="shrink-0 text-[#4e5969] hover:text-[#165dff]">全部文件</button>
                <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-[#86909c]" />
                <h2 className="truncate font-medium" title={getFolderPath(selectedFolder.id)}>{getFolderPath(selectedFolder.id)}</h2>
              </>}
            </div>
          )}

          <div ref={listScrollRef} className="@container min-h-0 overflow-y-auto rounded-lg border border-[#e5e6eb]" aria-busy={isLoading}>
            <table aria-label="知识库文件列表" className="w-full table-fixed text-left text-sm">
              <thead className="sticky top-0 z-10 bg-[#f7f8fa] text-[#4e5969]">
                <tr>
                  <th scope="col" className="px-3 py-3 font-medium">文件名</th>
                  <th scope="col" className="hidden w-16 px-2 py-3 font-medium @xl:table-cell">类型</th>
                  <th scope="col" className="hidden w-20 px-2 py-3 font-medium @xl:table-cell">大小</th>
                  <th scope="col" className="hidden w-24 px-2 py-3 font-medium @lg:table-cell">状态</th>
                  <th scope="col" aria-sort="descending" className="hidden w-40 px-2 py-3 font-medium @3xl:table-cell">上传时间</th>
                  <th scope="col" className="w-36 px-3 py-3 text-right font-medium @lg:w-44">操作</th>
                </tr>
              </thead>
              <tbody>
                {!isLoading && pageItems.map((item) => {
                  const isFolder = item.kind === 'folder';
                  const isDemo = demoItems.includes(item);
                  const actionHint = isDemo ? '（演示文件，不可操作）' : '';
                  const status = fileStatuses[item.status ?? 'ready'];
                  const extension = fileExtension(item.name);
                  const timestamp = Date.parse(item.createdAt);
                  return (
                    <tr key={item.id} className="border-t border-[#e5e6eb] hover:bg-[#fafbfc] focus-within:bg-[#fafbfc]" onDoubleClick={isFolder ? () => openFolder(item.id) : undefined}>
                      <th scope="row" className="px-3 py-2 font-medium">
                        <button type="button" title={item.name} disabled={isDemo} onClick={isDemo ? undefined : (event) => isFolder ? openFolder(item.id) : openPreview(item, event.currentTarget)} className="flex w-full min-w-0 items-center gap-2 rounded text-left text-sm enabled:hover:text-[#165dff] focus-visible:outline-[#165dff]">
                          {isFolder && <span className="grid size-8 shrink-0 place-items-center rounded bg-[#fff7e8] text-[#975700]"><Folder aria-hidden="true" className="size-4" /></span>}
                          <span className="min-w-0 truncate">{item.name}{isFolder && <span className="ml-2 text-xs font-normal text-[#646a73]">{childCount(item.id)} 项</span>}</span>
                        </button>
                      </th>
                      <td className="hidden truncate px-2 py-2 text-[#4e5969] @xl:table-cell">{isFolder ? '文件夹' : extension || '—'}</td>
                      <td className="hidden whitespace-nowrap px-2 py-2 text-[#4e5969] tabular-nums @xl:table-cell">{isFolder ? '—' : formatSize(item.size)}</td>
                      <td className="hidden px-2 py-2 @lg:table-cell">{isFolder ? <span className="text-[#646a73]">—</span> : <span className={'inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ' + status.style}>{status.label}</span>}</td>
                      <td className="hidden whitespace-nowrap px-2 py-2 text-[#4e5969] tabular-nums @3xl:table-cell">{isFolder || Number.isNaN(timestamp) ? '—' : <time dateTime={item.createdAt}>{uploadedAtFormat.format(timestamp).replaceAll('/', '-')}</time>}</td>
                      <td className="px-1 py-2 @lg:px-2">
                        <div className="flex items-center justify-end gap-px">
                          {!isFolder && <>
                            <button type="button" disabled={isDemo} title={'预览' + actionHint} aria-label={'预览' + actionHint} onClick={isDemo ? undefined : (event) => openPreview(item, event.currentTarget)} className={rowAction}><Eye className="size-4" /></button>
                            <button type="button" disabled={isDemo} title={'下载' + actionHint} aria-label={'下载' + actionHint} onClick={isDemo ? undefined : () => void downloadFile(item)} className={rowAction}><Download className="size-4" /></button>
                            {item.status === 'failed' && canManage && <button type="button" disabled={isDemo} title={'重试处理' + actionHint} aria-label={'重试处理' + actionHint} onClick={isDemo ? undefined : () => void retryIndex(item)} className={rowAction}><RefreshCw className="size-4" /></button>}
                          </>}
                          {canManage && <>
                            {folders.length > 0 && <button type="button" disabled={isDemo} title={'移动' + actionHint} aria-label={'移动' + actionHint} onClick={isDemo ? undefined : () => { setMoveItem(item); setMoveTarget(item.parentId || 'root'); }} className={rowAction + ' hidden @lg:inline-flex'}><FolderOpen className="size-4" /></button>}
                            <button type="button" disabled={isDemo} title={'删除' + actionHint} aria-label={'删除' + actionHint} onClick={isDemo ? undefined : () => setDeleteItem(item)} className={rowAction + ' text-[#d4380d] enabled:hover:bg-[#fff1f0] enabled:hover:text-[#d4380d]'}><Trash2 className="size-4" /></button>
                          </>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {pendingUploads.map((upload) => (
              <div key={upload.id} className="flex min-h-12 items-center gap-2 border-t border-[#e5e6eb] px-3 text-sm">
                {upload.status === 'uploading' ? <LoaderCircle aria-hidden="true" className="size-4 shrink-0 text-[#165dff] motion-safe:animate-spin" /> : <FileText aria-hidden="true" className="size-4 shrink-0 text-[#d4380d]" />}
                <span className="min-w-0 flex-1 truncate" title={upload.name}>{upload.name}</span>
                <span className="max-w-[45%] truncate text-xs text-[#4e5969]" title={upload.error}>{upload.status === 'uploading' ? '上传中' : upload.error}</span>
                <button type="button" className={rowAction} aria-label={upload.status === 'uploading' ? '取消上传' : '移除失败上传'} onClick={() => { if (upload.status === 'uploading') uploadControllers.current.get(upload.id)?.abort(); else setPendingUploads((current) => current.filter((item) => item.id !== upload.id)); }}><X className="size-4" /></button>
              </div>
            ))}
            {isLoading ? <p role="status" className="border-t border-[#e5e6eb] p-10 text-center text-sm text-[#646a73]">正在加载资料…</p> : !visibleItems.length && !pendingUploads.length ? (
              <div className="flex min-h-52 flex-col items-center justify-center gap-3 border-t border-[#e5e6eb] px-4 text-center">
                {normalizedQuery ? <Search aria-hidden="true" className="size-8 text-[#86909c]" /> : <FolderOpen aria-hidden="true" className="size-8 text-[#86909c]" />}
                <p className="text-sm font-medium">{normalizedQuery ? '没有匹配的文件或文件夹' : selectedFolder ? '此文件夹为空' : '暂无文件'}</p>
              </div>
            ) : null}
          </div>

          <KnowledgeListPagination label="文件列表分页" className="shrink-0" count={visibleItems.length} pageSize={pageSize} page={page} totalPages={pageCount} onPageChange={changePage} onPageSizeChange={changePageSize} />
          {isDragging && canManage && <div className="pointer-events-none absolute inset-3 z-20 flex items-center justify-center border-2 border-dashed border-[#165dff] bg-white/90 text-sm font-medium text-[#165dff]">拖放文件以上传</div>}
        </main>
      </div>}

      <Dialog open={Boolean(moveItem)} onOpenChange={(open) => { if (!open) setMoveItem(null); }}><DialogContent><DialogHeader><DialogTitle>移动资料</DialogTitle><DialogDescription>选择「{moveItem?.name}」的新位置。</DialogDescription></DialogHeader><select value={moveTarget} onChange={(event) => setMoveTarget(event.target.value)} className="h-10 rounded-md border border-[#e5e6eb] bg-white px-3 text-sm"><option value="root">全部文件（根目录）</option>{folders.filter((folder) => folder.id !== moveItem?.id).map((folder) => <option key={folder.id} value={folder.id}>{getFolderPath(folder.id)}</option>)}</select><DialogFooter><button type="button" onClick={() => setMoveItem(null)} className="h-9 rounded-md border border-[#e5e6eb] px-3 text-sm">取消</button><button type="button" onClick={() => void submitMove()} className="h-9 rounded-md bg-[#165dff] px-3 text-sm text-white">移动</button></DialogFooter></DialogContent></Dialog>
      <Dialog open={Boolean(deleteItem)} onOpenChange={(open) => { if (!open) setDeleteItem(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{deleteItem?.kind === 'folder' ? '删除文件夹' : '删除文件'}</DialogTitle>
            <DialogDescription className="break-words">
              确认删除「{deleteItem?.name}」？{deleteItem?.kind === 'folder' ? '删除文件夹会同时删除其中的所有文件和子文件夹。' : '删除后无法恢复此文件。'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button type="button" onClick={() => setDeleteItem(null)} className="h-9 rounded-md border border-[#e5e6eb] px-3 text-sm">取消</button>
            <button type="button" onClick={() => void confirmDelete()} className="h-9 rounded-md bg-[#d4380d] px-3 text-sm text-white">删除</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Sheet open={Boolean(preview)} onOpenChange={(open) => { if (!open) setPreview(null); }}>
        <SheetContent
          showCloseButton={false}
          className="w-full gap-0 overflow-hidden sm:w-[86vw] sm:max-w-[1440px] motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none"
          onCloseAutoFocus={(event) => {
            const trigger = previewTriggerRef.current;
            if (trigger?.isConnected) { event.preventDefault(); trigger.focus(); }
          }}
        >
          {preview && <>
            <SheetHeader className="min-w-0 shrink-0 flex-row items-center gap-3 border-b border-[#e5e6eb] bg-white px-4 py-4 text-left sm:px-6">
              <div className="min-w-0 flex-1">
                <SheetTitle className="truncate text-base leading-6" title={preview.item.name}>{preview.item.name}</SheetTitle>
                <SheetDescription className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                  {preview.item.status && <span className={'inline-flex rounded-full px-2 py-0.5 font-medium ' + fileStatuses[preview.item.status].style}>{fileStatuses[preview.item.status].label}</span>}
                  {fileExtension(preview.item.name) && <span>{fileExtension(preview.item.name)} ·</span>}
                  <span>{formatSize(preview.item.size)}</span>
                </SheetDescription>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" aria-label="下载文件" title="下载文件" onClick={() => void downloadFile(preview.item)} className={secondaryButton}>
                  <Download aria-hidden="true" className="size-4" /><span className="hidden sm:inline">下载</span>
                </button>
                <SheetClose aria-label="关闭预览" title="关闭预览" className="inline-flex size-9 items-center justify-center rounded-md text-[#4e5969] hover:bg-[#f2f3f5] focus-visible:outline-2 focus-visible:outline-[#165dff]">
                  <X aria-hidden="true" className="size-4" />
                </SheetClose>
              </div>
            </SheetHeader>

            <div className="min-h-0 flex-1 overflow-auto bg-[#f7f8fa] p-3 sm:p-6">
              {preview.content.kind === 'pdf' ? (
                <iframe title={preview.item.name} src={preview.content.url} className="block h-full w-full rounded-lg border border-[#e5e6eb] bg-white" />
              ) : preview.content.kind === 'text' ? (
                <pre className="mx-auto min-h-full w-full max-w-5xl whitespace-pre-wrap break-words rounded-lg border border-[#e5e6eb] bg-white p-4 text-sm leading-6 text-[#1d2129] sm:p-8">{preview.content.text}</pre>
              ) : (
                <div className="flex min-h-full flex-col items-center justify-center gap-3 px-4 text-center text-sm text-[#646a73]">
                  {preview.content.kind === 'loading' ? <>
                    <LoaderCircle aria-hidden="true" className="size-6 text-[#165dff] motion-safe:animate-spin" />
                    <p role="status" className="text-sm">正在加载预览…</p>
                  </> : <>
                    <FileText aria-hidden="true" className="size-8 text-[#86909c]" />
                    {preview.content.kind === 'error'
                      ? <p role="alert" className="text-sm">{preview.content.message}</p>
                      : <p className="text-sm">此格式不支持在线预览，可下载后查看。</p>}
                  </>}
                </div>
              )}
            </div>
          </>}
        </SheetContent>
      </Sheet>
    </section>
  );
}
