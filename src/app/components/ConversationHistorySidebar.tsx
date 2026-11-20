import { memo, type DragEvent, type KeyboardEvent, type UIEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { formatDistanceStrict } from 'date-fns';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ConversationActionsMenu } from './ConversationActionsMenu';
import { zhCN } from 'date-fns/locale';
import {
  Archive,
  ArchiveRestore,
  Ellipsis,
  FilePlus2,
  FolderClosed,
  FolderOpen,
  MessageCirclePlus,
  Clock3,
  Plus,
  Search,
  Pencil,
  Pin,
  Trash2,
  Triangle,
  X,
} from 'lucide-react';
import historyCorner from '../../assets/figma-home/history-corner.png';
import { Conversation } from '../types';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  HISTORY_BATCH_SIZE,
  type HistoryFilter,
  filterConversationsForHistory,
  getConversationLastQuestionAt,
  sortConversationsForHistory,
  getConversationWorkspaceName,
  groupConversationsByWorkspace,
  HISTORY_VISIBLE_COUNT_STORAGE_KEY,
  persistHistoryVisibleCount,
  readHistoryVisibleCount,
} from '../utils/conversationHistoryStorage';
import { ensureWorkspaceCreatedAt, readWorkspaceNames, saveWorkspaceNames, subscribeWorkspaceNames } from '../utils/workspaceStorage';
import { readWorkspaceFolders, WORKSPACE_FOLDERS_CHANGED } from '../utils/workspaceFolderStorage';
import { formatHistoryRelativeTime, formatHistoryTimestamp, getHistoryConversationStatus } from '../utils/historyTooltip';
import { HistoryDetailTooltipContent } from './HistoryDetailTooltipContent';
import { getWorkspaceDeletionTarget, getWorkspaceNames } from '../utils/workspaceManagement';
import { HistorySidebarToggle } from './HistorySidebarToggle';
import { HistoryViewOptionsMenu } from './HistoryViewOptionsMenu';
import {
  type DropPlacement,
  moveHistoryItem,
  persistHistoryViewOptions,
  readHistoryManualOrder,
  readHistoryViewOptions,
  reorderWorkspaceConversations,
  sortHistoryConversations,
} from '../utils/historyViewOptions';
import { WorkspaceCreateDialog } from './WorkspaceCreateDialog';
import { canShowWorkspaceFolder, showWorkspaceFolder } from './useWorkspaceFolderPicker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Tooltip, TooltipTrigger } from './ui/tooltip';

type ConversationHistorySidebarProps = {
  conversations: Conversation[];
  selectedConversationId: string | null;
  newConversationLabel: string;
  onNewConversation: (workspaceName?: string) => void;
  onSelectConversation: (conversationId: string) => void;
  onRenameConversation: (conversationId: string, title: string) => void;
  onArchiveConversation: (conversationId: string, isArchived: boolean) => void;
  onCollapse?: () => void;
  filterRequest?: { sequence: number; filter: HistoryFilter } | null;
};

let preservedHistoryScrollTop = 0;
const HISTORY_LOAD_MORE_THRESHOLD = 80;
type HistoryDragItem = { kind: 'workspace' | 'conversation'; id: string };

function getConversationDisplayTitle(conversation: Conversation) {
  const firstQuestion = conversation.messages.find((message) => message.role === 'user')?.content;
  if (!firstQuestion) return conversation.title;

  const generatedTitle = firstQuestion.length > 18 ? `${firstQuestion.slice(0, 18)}...` : firstQuestion;
  return conversation.title === generatedTitle ? firstQuestion : conversation.title;
}

function ConversationHistorySidebarComponent({
  conversations,
  selectedConversationId,
  newConversationLabel,
  onNewConversation,
  onSelectConversation,
  onRenameConversation,
  onArchiveConversation,
  onCollapse,
  filterRequest,
}: ConversationHistorySidebarProps) {
  const [pendingRenameConversation, setPendingRenameConversation] =
    useState<Conversation | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [historyQuery, setHistoryQuery] = useState('');
  const [viewOptions, setViewOptions] = useState(readHistoryViewOptions);
  const [manualOrder, setManualOrder] = useState(readHistoryManualOrder);
  const historyFilter = viewOptions.filter;
  const [draggedItem, setDraggedItem] = useState<HistoryDragItem | null>(null);
  const [dropTarget, setDropTarget] = useState<(HistoryDragItem & { placement: DropPlacement }) | null>(null);
  const [sortAnnouncement, setSortAnnouncement] = useState('');
  const dragSourceRef = useRef<HistoryDragItem | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [openConversationMenuId, setOpenConversationMenuId] = useState<string | null>(null);
  const [openWorkspaceMenu, setOpenWorkspaceMenu] = useState<string | null>(null);
  const [pendingRenameWorkspace, setPendingRenameWorkspace] = useState<string | null>(null);
  const [pendingDeleteWorkspace, setPendingDeleteWorkspace] = useState<string | null>(null);
  const [workspaceDeleteDialogOpen, setWorkspaceDeleteDialogOpen] = useState(false);
  const [workspaceDeleteError, setWorkspaceDeleteError] = useState('');
  const [workspaceNames, setWorkspaceNames] = useState(readWorkspaceNames);
  const [workspaceFolders, setWorkspaceFolders] = useState(() => new Map<string, FileSystemDirectoryHandle>());
  const [workspaceCreatedAt, setWorkspaceCreatedAt] = useState(() => ensureWorkspaceCreatedAt(workspaceNames));
  const [tooltipNow, setTooltipNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setTooltipNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const { setActiveWorkspaceName: setActiveWorkspace, setConversationPinned, forkConversation, renameWorkspace, deleteWorkspace, conversations: allConversations } = useWorkspace();
  const navigate = useNavigate();
  const allWorkspaceNames = useMemo(() => getWorkspaceNames(workspaceNames, allConversations), [workspaceNames, allConversations]);
  const workspaceNamesSnapshot = JSON.stringify(allWorkspaceNames);
  const deleteWorkspaceTarget = pendingDeleteWorkspace === null ? null : getWorkspaceDeletionTarget(allWorkspaceNames, pendingDeleteWorkspace);
  const deleteWorkspaceConversationCount = pendingDeleteWorkspace === null ? 0 : allConversations.filter((conversation) => getConversationWorkspaceName(conversation) === pendingDeleteWorkspace).length;
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(() => new Set());
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const [visibleConversationCount, setVisibleConversationCount] = useState(readHistoryVisibleCount);
  const [scrollbarThumb, setScrollbarThumb] = useState({
    height: 0,
    top: 0,
    visible: false,
  });
  const scrollTimerRef = useRef<number | null>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const selectedConversationRef = useRef<HTMLDivElement>(null);
  const closeSearch = () => {
    setSearchOpen(false);
    setHistoryQuery('');
    setVisibleConversationCount(HISTORY_BATCH_SIZE);
    requestAnimationFrame(() => searchButtonRef.current?.focus());
  };
  const orderedConversations = useMemo(
    () => sortHistoryConversations(conversations, viewOptions.sort, manualOrder),
    [conversations, viewOptions.sort, manualOrder],
  );
  const filteredConversations = useMemo(
    () => filterConversationsForHistory(orderedConversations, historyFilter, historyQuery),
    [historyFilter, historyQuery, orderedConversations],
  );
  const workspaceGroups = useMemo(
    () => groupConversationsByWorkspace(
      Array.from(new Set([...workspaceNames, ...conversations.map(getConversationWorkspaceName)])),
      filteredConversations,
    ),
    [workspaceNames, conversations, filteredConversations],
  );
  const selectedConversation = conversations.find((conversation) => conversation.id === selectedConversationId);
  const selectedWorkspaceName = selectedConversation ? getConversationWorkspaceName(selectedConversation) : null;

  useEffect(() => {
    persistHistoryViewOptions(viewOptions, manualOrder);
  }, [viewOptions, manualOrder]);

  useEffect(() => {
    if (!filterRequest) return;
    setViewOptions((current) => ({ ...current, filter: filterRequest.filter }));
    setHistoryQuery('');
    setSearchOpen(false);
    setFilterOpen(false);
    setVisibleConversationCount(HISTORY_BATCH_SIZE);
  }, [filterRequest]);

  useEffect(() => {
    if (!selectedWorkspaceName) return;
    setActiveWorkspace(selectedWorkspaceName);
    setExpandedWorkspaces((current) => current.has(selectedWorkspaceName) ? current : new Set([...current, selectedWorkspaceName]));
  }, [selectedConversationId, selectedWorkspaceName, setActiveWorkspace]);

  useEffect(() => {
    if (!historyQuery && historyFilter === 'all') return;
    setExpandedWorkspaces((current) => new Set([
      ...current,
      ...workspaceGroups.filter((group) => group.items.length > 0).map((group) => group.name),
    ]));
  }, [historyQuery, historyFilter, workspaceGroups]);

  useEffect(() => {
    const selectedIndex = filteredConversations.findIndex(
      (conversation) => conversation.id === selectedConversationId,
    );
    if (selectedIndex < visibleConversationCount) return;

    setVisibleConversationCount(
      Math.ceil((selectedIndex + 1) / HISTORY_BATCH_SIZE) * HISTORY_BATCH_SIZE,
    );
  }, [filteredConversations, selectedConversationId, visibleConversationCount]);

  useEffect(() => {
    persistHistoryVisibleCount(visibleConversationCount);
  }, [visibleConversationCount]);

  useEffect(() => {
    const syncVisibleConversationCount = (event: StorageEvent) => {
      if (event.key !== HISTORY_VISIBLE_COUNT_STORAGE_KEY) return;
      setVisibleConversationCount(readHistoryVisibleCount());
    };

    window.addEventListener('storage', syncVisibleConversationCount);
    return () => window.removeEventListener('storage', syncVisibleConversationCount);
  }, []);

  useEffect(() => subscribeWorkspaceNames(setWorkspaceNames), []);
  useEffect(() => {
    if (!canShowWorkspaceFolder()) return;
    let active = true;
    const refreshFolders = () => {
      void readWorkspaceFolders().then((folders) => {
        if (active) setWorkspaceFolders(folders);
      }).catch(() => {});
    };
    refreshFolders();
    window.addEventListener(WORKSPACE_FOLDERS_CHANGED, refreshFolders);
    window.addEventListener('focus', refreshFolders);
    return () => {
      active = false;
      window.removeEventListener(WORKSPACE_FOLDERS_CHANGED, refreshFolders);
      window.removeEventListener('focus', refreshFolders);
    };
  }, []);

  useEffect(() => {
    setWorkspaceCreatedAt(ensureWorkspaceCreatedAt(JSON.parse(workspaceNamesSnapshot)));
  }, [workspaceNames, workspaceNamesSnapshot]);

  useLayoutEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const maxScrollTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
    scrollContainer.scrollTop = Math.min(preservedHistoryScrollTop, maxScrollTop);
  }, []);

  useLayoutEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const selectedConversation = selectedConversationRef.current;
    if (!scrollContainer || !selectedConversation) return;

    const containerRect = scrollContainer.getBoundingClientRect();
    const selectedRect = selectedConversation.getBoundingClientRect();

    if (selectedRect.top < containerRect.top) {
      scrollContainer.scrollTop += selectedRect.top - containerRect.top;
    } else if (selectedRect.bottom > containerRect.bottom) {
      scrollContainer.scrollTop += selectedRect.bottom - containerRect.bottom;
    }
  }, [selectedConversationId, selectedWorkspaceName, expandedWorkspaces, visibleConversationCount]);

  useEffect(() => {
    return () => {
      if (scrollTimerRef.current !== null) {
        window.clearTimeout(scrollTimerRef.current);
      }
    };
  }, []);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const { clientHeight, scrollHeight, scrollTop } = event.currentTarget;
    const maxScrollTop = scrollHeight - clientHeight;

    preservedHistoryScrollTop = scrollTop;

    if (
      scrollHeight - clientHeight - scrollTop <= HISTORY_LOAD_MORE_THRESHOLD
      && visibleConversationCount < filteredConversations.length
    ) {
      setVisibleConversationCount((current) =>
        Math.min(current + HISTORY_BATCH_SIZE, filteredConversations.length),
      );
    }

    if (maxScrollTop <= 0) {
      setScrollbarThumb({ height: 0, top: 0, visible: false });
      return;
    }

    const thumbHeight = Math.max(40, (clientHeight / scrollHeight) * clientHeight);
    const maxThumbTop = clientHeight - thumbHeight;

    setIsScrolling(true);
    setScrollbarThumb({
      height: thumbHeight,
      top: (scrollTop / maxScrollTop) * maxThumbTop,
      visible: true,
    });

    if (scrollTimerRef.current !== null) {
      window.clearTimeout(scrollTimerRef.current);
    }

    scrollTimerRef.current = window.setTimeout(() => {
      setIsScrolling(false);
      setScrollbarThumb((current) => ({ ...current, visible: false }));
      scrollTimerRef.current = null;
    }, 900);
  };

  const createWorkspace = (name: string) => {
    const nextWorkspaceNames = saveWorkspaceNames([name, ...workspaceNames]);
    setWorkspaceNames(nextWorkspaceNames);
    setActiveWorkspace(name);
    setExpandedWorkspaces((current) => new Set([...current, name]));
    onNewConversation(name);
  };
  const startRenameConversation = (conversation: Conversation) => {
    setRenameDraft(conversation.title.slice(0, 20));
    setPendingRenameConversation(conversation);
  };

  const saveConversationRename = () => {
    const title = renameDraft.trim();
    if (pendingRenameConversation && title) {
      onRenameConversation(pendingRenameConversation.id, title);
    }
    setPendingRenameConversation(null);
  };

  const handleForkConversation = (conversation: Conversation) => {
    const fork = forkConversation(conversation.id);
    if (!fork) return;
    setActiveWorkspace(getConversationWorkspaceName(fork));
    setExpandedWorkspaces((current) => new Set([...current, getConversationWorkspaceName(fork)]));
    navigate(fork.workspaceType === 'report' ? '/report' : '/ask');
    toast.success('已创建分叉会话');
  };

  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.isComposing || !(event.ctrlKey || event.metaKey)) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, [role="dialog"]'))) return;
      if (pendingRenameConversation || workspaceDialogOpen || pendingRenameWorkspace || workspaceDeleteDialogOpen) return;
      const conversation = conversations.find((item) => item.id === (openConversationMenuId ?? selectedConversationId));
      if (!conversation || !conversation.messages.some((message) => message.role === 'user')) return;
      const rename = event.altKey && !event.shiftKey && event.code === 'KeyG';
      const fork = event.altKey && !event.shiftKey && event.code === 'KeyF';
      const archive = event.shiftKey && !event.altKey && event.code === 'KeyA';
      if (!rename && !fork && !archive) return;
      event.preventDefault();
      setOpenConversationMenuId(null);
      if (rename) startRenameConversation(conversation);
      if (fork) handleForkConversation(conversation);
      if (archive) onArchiveConversation(conversation.id, !conversation.isArchived);
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [conversations, openConversationMenuId, selectedConversationId, pendingRenameConversation, workspaceDialogOpen, pendingRenameWorkspace, workspaceDeleteDialogOpen, onArchiveConversation, forkConversation, navigate, setActiveWorkspace]);

  const canMove = (source: HistoryDragItem, target: HistoryDragItem) => {
    if (source.kind !== target.kind || source.id === target.id) return false;
    if (source.kind === 'workspace') return true;
    const sourceConversation = conversations.find((item) => item.id === source.id);
    const targetConversation = conversations.find((item) => item.id === target.id);
    return Boolean(sourceConversation && targetConversation
      && getConversationWorkspaceName(sourceConversation) === getConversationWorkspaceName(targetConversation));
  };

  const moveItem = (source: HistoryDragItem, target: HistoryDragItem, placement: DropPlacement) => {
    if (!canMove(source, target)) return;
    let nextOrder = orderedConversations.map((conversation) => conversation.id);
    if (source.kind === 'workspace') {
      setWorkspaceNames(saveWorkspaceNames(moveHistoryItem(allWorkspaceNames, source.id, target.id, placement)));
    } else {
      const next = reorderWorkspaceConversations(conversations, nextOrder, source.id, target.id, placement);
      if (!next) return;
      nextOrder = next;
    }
    setManualOrder(nextOrder);
    setViewOptions((current) => current.sort === 'manual' ? current : { ...current, sort: 'manual' });
    setSortAnnouncement(source.kind === 'workspace' ? '工作区顺序已更新' : '会话在当前工作区内的顺序已更新');
  };

  const endDrag = () => {
    dragSourceRef.current = null;
    setDraggedItem(null);
    setDropTarget(null);
  };

  const dragHandleProps = (item: HistoryDragItem) => ({
    draggable: true,
    'aria-keyshortcuts': 'Alt+ArrowUp Alt+ArrowDown',
    onDragStart: (event: DragEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      dragSourceRef.current = item;
      setDraggedItem(item);
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', item.id);
    },
    onDragEnd: endDrag,
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
      if (!event.altKey || !['ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const sourceConversation = conversations.find((conversation) => conversation.id === item.id);
      if (item.kind === 'conversation' && !sourceConversation) return;
      const sourceWorkspace = sourceConversation ? getConversationWorkspaceName(sourceConversation) : null;
      const ids = item.kind === 'workspace' ? allWorkspaceNames : filteredConversations
        .filter((conversation) => getConversationWorkspaceName(conversation) === sourceWorkspace)
        .map((conversation) => conversation.id);
      const offset = event.key === 'ArrowUp' ? -1 : 1;
      const targetId = ids[ids.indexOf(item.id) + offset];
      if (targetId) moveItem(item, { kind: item.kind, id: targetId }, offset < 0 ? 'before' : 'after');
    },
  });

  const dropProps = (item: HistoryDragItem) => ({
    onDragEnter: (event: DragEvent<HTMLDivElement>) => {
      if (dragSourceRef.current && canMove(dragSourceRef.current, item)) event.preventDefault();
    },
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      const source = dragSourceRef.current;
      if (!source || !canMove(source, item)) {
        event.dataTransfer.dropEffect = 'none';
        setDropTarget(null);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'move';
      const rect = event.currentTarget.getBoundingClientRect();
      const placement = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
      setDropTarget((current) => current?.id === item.id && current.kind === item.kind && current.placement === placement
        ? current : { ...item, placement });
    },
    onDragLeave: (event: DragEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null);
    },
    onDrop: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const rect = event.currentTarget.getBoundingClientRect();
      if (dragSourceRef.current) moveItem(dragSourceRef.current, item, event.clientY < rect.top + rect.height / 2 ? 'before' : 'after');
      endDrag();
    },
    style: {
      boxShadow: dropTarget?.kind === item.kind && dropTarget.id === item.id
        ? `inset 0 ${dropTarget.placement === 'before' ? '2px' : '-2px'} 0 #165dff` : undefined,
      opacity: draggedItem?.kind === item.kind && draggedItem.id === item.id ? 0.45 : undefined,
    },
  });

  const renderConversation = (conversation: Conversation) => {
    const hasStarted = conversation.messages.some((message) => message.role === 'user');
    const isSelected = conversation.id === selectedConversationId;
    const isArchived = Boolean(conversation.isArchived);
    const isMenuOpen = openConversationMenuId === conversation.id;
    const showArchiveRestore = isArchived && !isSelected;
    const titlePadding = !hasStarted ? 'pr-1' : isArchived
      ? `group-has-[:focus-visible]:pr-[62px] group-hover:pr-[62px] ${isMenuOpen ? 'pr-[62px]' : showArchiveRestore ? 'pr-7' : 'pr-[52px]'}`
      : `group-has-[:focus-visible]:pr-[92px] group-hover:pr-[92px] ${isMenuOpen ? 'pr-[92px]' : 'pr-[52px]'}`;
    const lastQuestionAt = getConversationLastQuestionAt(conversation);
    const displayTitle = getConversationDisplayTitle(conversation);

    return (
      <Tooltip key={conversation.id} delayDuration={400} onOpenChange={(open) => { if (open) setTooltipNow(Date.now()); }}>
        <div
          {...dropProps({ kind: 'conversation', id: conversation.id })}
          ref={isSelected ? selectedConversationRef : undefined}
          data-testid={`conversation-history-item-${conversation.id}`}
          className={`group relative box-border flex h-9 min-w-0 max-w-full items-center gap-2 overflow-visible rounded-[8px] border py-1 pr-1 transition-colors ${viewOptions.grouping === 'list' ? 'pl-2' : viewOptions.grouping === 'tree' ? 'pl-3' : 'pl-[33px]'} ${
            isSelected || isMenuOpen
              ? 'border-transparent bg-[#eceeef]'
              : 'border-transparent hover:bg-[#eceeef] focus-within:bg-[#eceeef]'
          }`}
        >
          <TooltipTrigger asChild>
            <button
              {...dragHandleProps({ kind: 'conversation', id: conversation.id })}
              type="button"
              onClick={() => {
                setActiveWorkspace(getConversationWorkspaceName(conversation));
                onSelectConversation(conversation.id);
              }}
              aria-current={isSelected ? 'page' : undefined}
              className={`flex h-full min-w-0 flex-1 cursor-grab items-center text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 active:cursor-grabbing ${titlePadding}`}
            >
              <span className={`min-w-0 flex-1 truncate text-sm font-normal leading-[22px] ${isArchived ? 'text-[#a8adb5]' : 'text-[#1d2129]'}`}>
                {hasStarted ? conversation.title : '新会话'}
              </span>
            </button>
          </TooltipTrigger>
          {hasStarted && !showArchiveRestore && !isMenuOpen && (
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 whitespace-nowrap text-[10px] leading-4 text-[#86909c] group-hover:opacity-0 group-has-[:focus-visible]:opacity-0">
              {tooltipNow - lastQuestionAt.getTime() < 60_000 ? '刚刚' : formatDistanceStrict(lastQuestionAt, tooltipNow, { locale: zhCN, roundingMethod: 'floor' }).replace(/\s/g, '')}
            </span>
          )}
          {hasStarted && <div
            className={`absolute right-1 top-1/2 flex h-7 -translate-y-1/2 items-center gap-0.5 transition-opacity motion-reduce:transition-none ${isMenuOpen || showArchiveRestore ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0 group-has-[:focus-visible]:pointer-events-auto group-has-[:focus-visible]:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100'}`}
          >
            <DropdownMenu open={isMenuOpen} onOpenChange={(open) => setOpenConversationMenuId(open ? conversation.id : null)}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={`flex h-7 w-7 items-center justify-center rounded-[6px] text-[#86909c] transition-colors hover:bg-white hover:text-[#4e5969] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 ${showArchiveRestore && !isMenuOpen ? 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-has-[:focus-visible]:pointer-events-auto group-has-[:focus-visible]:opacity-100' : ''}`}
                  aria-label={`更多操作：${conversation.title}`}
                  title="更多操作"
                >
                  <Ellipsis className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <ConversationActionsMenu
                conversation={conversation}
                onPin={() => setConversationPinned(conversation.id, !conversation.isPinned)}
                onRename={() => startRenameConversation(conversation)}
                onFork={() => handleForkConversation(conversation)}
                onArchive={() => onArchiveConversation(conversation.id, !conversation.isArchived)}
              />
            </DropdownMenu>
            <button
              type="button"
              onClick={() => onArchiveConversation(conversation.id, !conversation.isArchived)}
              className={`flex h-7 w-7 items-center justify-center rounded-[6px] text-[#86909c] transition-colors hover:bg-white hover:text-[#4e5969] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 ${isArchived ? 'order-last' : ''}`}
              aria-label={`${isArchived ? '取消归档' : '归档会话'}：${conversation.title}`}
              title={isArchived ? '取消归档' : '归档会话'}
            >
              {conversation.isArchived ? <ArchiveRestore aria-hidden="true" className="h-4 w-4" /> : <Archive aria-hidden="true" className="h-4 w-4" />}
            </button>
            {!isArchived && <button
              type="button"
              onClick={() => setConversationPinned(conversation.id, !conversation.isPinned)}
              className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#86909c] transition-colors hover:bg-white hover:text-[#4e5969] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20"
              aria-label={`${conversation.isPinned ? '取消置顶' : '置顶会话'}：${conversation.title}`}
              aria-pressed={Boolean(conversation.isPinned)}
              title={conversation.isPinned ? '取消置顶' : '置顶会话'}
            >
              <Pin
                aria-hidden="true"
                className={`h-4 w-4 rotate-[30deg] ${conversation.isPinned ? 'text-[#a8adb5]' : ''}`}
                fill={conversation.isPinned ? 'currentColor' : 'none'}
                strokeWidth={1.6}
              />
            </button>}
          </div>}
        </div>
        {hasStarted && <HistoryDetailTooltipContent
          testId={`conversation-history-tooltip-${conversation.id}`}
          sideOffset={25}
          alignOffset={-5}
          title={displayTitle}
          workspaceName={getConversationWorkspaceName(conversation)}
          timestamp={formatHistoryRelativeTime(lastQuestionAt, tooltipNow)}
          status={getHistoryConversationStatus(conversation)}
        />}
      </Tooltip>
    );
  };

  return (
    <aside
      data-testid="conversation-history-sidebar"
      aria-label="工作区侧栏"
      className="relative flex h-full w-[280px] min-h-0 shrink-0 flex-col rounded-tl-[20px] bg-[#f8f9fb]/80 max-sm:hidden"
    >
      <div
        className="flex h-full min-h-0 w-full flex-col px-4 pt-4"
        style={{ fontFamily: '"PingFang SC", "PingFang_SC", "Microsoft YaHei", Arial, sans-serif' }}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onNewConversation()}
              className="flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-[12px] border border-[#dedfe3] bg-white px-3 text-center text-[15px] font-normal leading-[22px] text-[#1d2129] transition-colors hover:border-[#c9cdd4] hover:bg-[#fcfdff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20"
            >
              <MessageCirclePlus aria-hidden="true" className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
              <span className="min-w-0 truncate">{newConversationLabel}</span>
            </button>
            {onCollapse && (
              <HistorySidebarToggle expanded onClick={onCollapse} />
            )}
          </div>

          <button
            type="button"
            onClick={() => navigate('/automations')}
            aria-current={window.location.pathname === '/automations' ? 'page' : undefined}
            className={`flex h-10 shrink-0 items-center gap-3 rounded-[10px] px-3 text-left text-[14px] text-[#4e5969] transition-colors hover:bg-[#eceeef] hover:text-[#1d2129] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 ${window.location.pathname === '/automations' ? 'bg-[#eceeef] text-[#1d2129]' : ''}`}
          >
            <Clock3 aria-hidden="true" className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
            <span>自动化任务</span>
          </button>

          <div className="flex min-h-0 flex-1 flex-col gap-2">
            {searchOpen ? (
              <div className="flex h-9 shrink-0 items-center gap-2 rounded-[12px] border border-[#d3d6db] bg-transparent pl-3 pr-1.5 transition-colors focus-within:border-[#86909c]">
                <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-[#86909c]" strokeWidth={1.8} />
                <input
                  autoFocus
                  value={historyQuery}
                  onChange={(event) => {
                    setHistoryQuery(event.target.value);
                    setVisibleConversationCount(HISTORY_BATCH_SIZE);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') closeSearch();
                  }}
                  className="min-w-0 flex-1 bg-transparent text-sm leading-5 text-[#1d2129] outline-none placeholder:text-[#86909c]"
                  placeholder="搜索会话名称"
                  aria-label="搜索会话名称"
                />
                <button
                  type="button"
                  onClick={closeSearch}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] text-[#86909c] transition-colors hover:bg-[#eceeef] hover:text-[#4e5969] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20"
                  aria-label="关闭会话搜索"
                  title="关闭搜索"
                >
                  <X aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </div>
            ) : (
            <div className="flex h-8 items-center justify-between px-1">
              <span className="text-[15px] font-normal leading-[22px] text-[#86909c]">{historyFilter === 'archived' ? '已归档会话' : '工作区'}</span>
              <div className="relative flex items-center gap-1">
                <button
                  ref={searchButtonRef}
                  type="button"
                  onClick={() => {
                    setSearchOpen((current) => !current);
                    setFilterOpen(false);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-transparent text-[#86909c] transition-colors hover:text-[#4e5969] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20"
                  aria-label="搜索"
                  aria-pressed={searchOpen}
                  title="搜索"
                >
                  <Search className="h-[18px] w-[18px]" strokeWidth={1.8} />
                </button>
                <HistoryViewOptionsMenu
                  open={filterOpen}
                  onOpenChange={setFilterOpen}
                  options={viewOptions}
                  onChange={(change) => {
                    setViewOptions((current) => ({ ...current, ...change }));
                    setVisibleConversationCount(HISTORY_BATCH_SIZE);
                    endDrag();
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setFilterOpen(false);
                    setWorkspaceDialogOpen(true);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-transparent text-[#86909c] transition-colors hover:text-[#4e5969] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20"
                  aria-label="添加工作区"
                  title="添加工作区"
                >
                  <FilePlus2 aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.8} />
                </button>
              </div>
            </div>
            )}
            <div className="relative min-h-0 flex-1">
              <div ref={scrollContainerRef} onScroll={handleScroll} className="history-scrollbar h-full space-y-1 overflow-x-hidden overflow-y-auto pb-2 pr-1">
                {viewOptions.grouping === 'list' ? (
                  <>
                    {filteredConversations.slice(0, visibleConversationCount).map(renderConversation)}
                    {filteredConversations.length > visibleConversationCount && (
                      <button type="button" onClick={() => setVisibleConversationCount((current) => current + HISTORY_BATCH_SIZE)} className="h-8 px-2 text-xs text-[#86909c] hover:text-[#4e5969]">加载更多会话</button>
                    )}
                    {filteredConversations.length === 0 && <p className="px-2 py-4 text-center text-xs text-[#86909c]">暂无符合条件的会话</p>}
                  </>
                ) : workspaceGroups.map(({ name: workspaceName, items }, workspaceIndex) => (
                  <div key={workspaceName}>
                    <Tooltip delayDuration={400}>
                      <div
                        {...dropProps({ kind: 'workspace', id: workspaceName })}
                        aria-current={selectedWorkspaceName === workspaceName ? 'true' : undefined}
                        className={`group relative flex h-9 w-full items-center gap-1 rounded-[8px] px-2 text-left text-sm text-[#4e5969] transition-colors hover:bg-[#eceeef] hover:text-[#1d2129] ${openWorkspaceMenu === workspaceName ? 'bg-[#eceeef] text-[#1d2129]' : ''}`}
                      >
                        <TooltipTrigger asChild>
                          <button
                            {...dragHandleProps({ kind: 'workspace', id: workspaceName })}
                            type="button"
                            onClick={() => {
                              setExpandedWorkspaces((current) => {
                                const next = new Set(current);
                                if (next.has(workspaceName)) next.delete(workspaceName);
                                else next.add(workspaceName);
                                return next;
                              });
                            }}
                            className="flex h-full min-w-0 flex-1 cursor-grab items-center gap-2 rounded-[6px] pr-[62px] text-left text-[14px] font-normal leading-[22px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 active:cursor-grabbing"
                            aria-label={`${expandedWorkspaces.has(workspaceName) ? '收起' : '展开'}工作区：${workspaceName}`}
                            aria-current={selectedWorkspaceName === workspaceName ? 'true' : undefined}
                            aria-expanded={expandedWorkspaces.has(workspaceName)}
                            aria-controls={`workspace-conversations-${workspaceIndex}`}
                          >
                            <span aria-hidden="true" className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
                              <Triangle
                                className={`${viewOptions.grouping === 'tree' ? '' : 'hidden group-hover:block'} h-2 w-2 text-[#a8adb5] transition-transform duration-150 motion-reduce:transition-none ${expandedWorkspaces.has(workspaceName) ? 'rotate-180' : 'rotate-90'}`}
                                fill="currentColor"
                                strokeWidth={0}
                              />
                              {viewOptions.grouping !== 'tree' && (selectedWorkspaceName === workspaceName ? (
                                <FolderOpen className="h-[18px] w-[18px] text-[#165dff] group-hover:hidden" fill="#e8efff" strokeWidth={1.7} />
                              ) : (
                                <FolderClosed className="h-[18px] w-[18px] text-[#86909c] group-hover:hidden" strokeWidth={1.7} />
                              ))}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{workspaceName}</span>
                          </button>
                        </TooltipTrigger>
                        <div className={`absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5 transition-opacity ${selectedWorkspaceName === workspaceName || openWorkspaceMenu === workspaceName ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`}>
                          <DropdownMenu open={openWorkspaceMenu === workspaceName} onOpenChange={(open) => setOpenWorkspaceMenu(open ? workspaceName : null)}>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                aria-label={`工作区更多操作：${workspaceName}`}
                                title="更多操作"
                                className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#86909c] transition-colors hover:bg-white hover:text-[#1d2129] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20 data-[state=open]:bg-white data-[state=open]:text-[#1d2129]"
                              >
                                <Ellipsis aria-hidden="true" className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="start"
                              sideOffset={6}
                              collisionPadding={12}
                              className="min-w-[160px] rounded-[12px] border-[#e5e6eb] bg-white p-1.5 text-[#1d2129] shadow-[0_8px_24px_rgba(29,33,41,0.12)]"
                            >
                              <DropdownMenuItem onSelect={() => setPendingRenameWorkspace(workspaceName)} className="h-9 gap-2.5 rounded-[6px] px-2.5">
                                <Pencil aria-hidden="true" className="h-4 w-4" />
                                重命名
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={!workspaceFolders.has(workspaceName)}
                                onSelect={() => {
                                  const directory = workspaceFolders.get(workspaceName);
                                  if (directory) void showWorkspaceFolder(directory);
                                }}
                                className="h-9 gap-2.5 rounded-[6px] px-2.5 data-[disabled]:text-[#86909c]"
                              >
                                <FolderOpen aria-hidden="true" className="h-4 w-4" />
                                在文件夹显示
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="mx-2 my-1 bg-[#e5e6eb]" />
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => { setWorkspaceDeleteError(''); setPendingDeleteWorkspace(workspaceName); setWorkspaceDeleteDialogOpen(true); }}
                                className="h-9 gap-2.5 rounded-[6px] px-2.5"
                              >
                                <Trash2 aria-hidden="true" className="h-4 w-4" />
                                删除工作区
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveWorkspace(workspaceName);
                              setExpandedWorkspaces((current) => new Set([...current, workspaceName]));
                              onNewConversation(workspaceName);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#86909c] transition-colors hover:bg-white hover:text-[#4e5969] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20"
                            aria-label={`在${workspaceName}中新建对话`}
                            title="新会话"
                          >
                            <MessageCirclePlus aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                          </button>
                        </div>
                      </div>
                      <HistoryDetailTooltipContent
                        testId={`workspace-history-tooltip-${workspaceIndex}`}
                        sideOffset={28}
                        title={workspaceName}
                        timestamp={Object.prototype.hasOwnProperty.call(workspaceCreatedAt, workspaceName)
                          ? `创建于 ${formatHistoryTimestamp(new Date(workspaceCreatedAt[workspaceName]))}`
                          : '正在记录创建时间…'}
                      />
                    </Tooltip>
                    <div
                      id={`workspace-conversations-${workspaceIndex}`}
                      role="group"
                      aria-label={`${workspaceName}的会话`}
                      hidden={!expandedWorkspaces.has(workspaceName) || items.length === 0}
                      className={`mt-1 space-y-1 ${viewOptions.grouping === 'tree' ? 'ml-4 border-l border-[#d9dce3] pl-1' : ''}`}
                    >
                      {expandedWorkspaces.has(workspaceName) && items.length > 0 && (
                        <>
                          {items.slice(0, visibleConversationCount).map(renderConversation)}
                          {items.length > visibleConversationCount && (
                            <button
                              type="button"
                              onClick={() => setVisibleConversationCount((current) => current + HISTORY_BATCH_SIZE)}
                              className="h-8 px-2 text-xs text-[#86909c] hover:text-[#4e5969] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20"
                            >
                              加载更多会话
                            </button>
                          )}
                        </>
                      )}
                </div>
                </div>
              ))}
            </div>
              {isScrolling && scrollbarThumb.visible && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-0 right-[-9px] top-0 w-1.5"
                >
                  <div
                    className="w-1.5 rounded-full bg-[#d6dbe3]"
                    style={{
                      height: `${scrollbarThumb.height}px`,
                      transform: `translateY(${scrollbarThumb.top}px)`,
                    }}
                  />
            </div>
          )}
            </div>
          </div>
        </div>
      </div>

      <img
        aria-hidden="true"
        alt=""
        src={historyCorner}
        className="pointer-events-none absolute left-full top-0 h-5 w-5 max-w-none object-cover"
      />
      <p role="status" aria-live="polite" className="sr-only">{sortAnnouncement}</p>

      <WorkspaceCreateDialog
        open={workspaceDialogOpen}
        workspaceNames={workspaceNames}
        onOpenChange={setWorkspaceDialogOpen}
        onCreated={createWorkspace}
      />
      <WorkspaceCreateDialog
        open={pendingRenameWorkspace !== null}
        mode="rename"
        initialName={pendingRenameWorkspace ?? undefined}
        workspaceNames={allWorkspaceNames}
        onOpenChange={(open) => { if (!open) setPendingRenameWorkspace(null); }}
        onCreated={(name) => {
          if (pendingRenameWorkspace === null) return;
          const error = renameWorkspace(pendingRenameWorkspace, name);
          if (error) return error;
          setExpandedWorkspaces((current) => {
            const next = new Set(current);
            if (next.delete(pendingRenameWorkspace)) next.add(name);
            return next;
          });
        }}
      />
      <Dialog
        open={workspaceDeleteDialogOpen}
        onOpenChange={setWorkspaceDeleteDialogOpen}
      >
        <DialogContent className="max-w-[400px] gap-5 rounded-[12px] border-[#e5e6eb] p-5 shadow-[0_12px_32px_rgba(29,33,41,0.16)]">
          <DialogHeader className="gap-2">
            <DialogTitle className="text-[18px] leading-[26px]">删除工作区</DialogTitle>
            <DialogDescription className="break-words leading-[22px] text-[#4e5969]">
              {deleteWorkspaceTarget === null
                ? '至少保留一个工作区，请先新建其他工作区。'
                : <>将把“{pendingDeleteWorkspace}”从工作区列表中移除。{deleteWorkspaceConversationCount > 0
                  ? `会话记录会保留，其会话将显示在“${deleteWorkspaceTarget}”下。`
                  : '该工作区为空。'}</>}
            </DialogDescription>
          </DialogHeader>
          {workspaceDeleteError && <p role="alert" className="text-xs text-[#f53f3f]">{workspaceDeleteError}</p>}
          <DialogFooter className="gap-2 sm:gap-2">
            <button
              type="button"
              onClick={() => setWorkspaceDeleteDialogOpen(false)}
              className="h-9 rounded-[6px] border border-[#d9dce3] px-4 text-[#4e5969] transition-colors hover:bg-[#f7f8fa]"
            >
              取消
            </button>
            <button
              type="button"
              disabled={deleteWorkspaceTarget === null}
              onClick={() => {
                if (pendingDeleteWorkspace === null) return;
                const error = deleteWorkspace(pendingDeleteWorkspace);
                if (error) { setWorkspaceDeleteError(error); return; }
                setExpandedWorkspaces((current) => {
                  const next = new Set(current);
                  next.delete(pendingDeleteWorkspace);
                  if (deleteWorkspaceTarget && deleteWorkspaceConversationCount > 0) next.add(deleteWorkspaceTarget);
                  return next;
                });
                setWorkspaceDeleteDialogOpen(false);
              }}
              className="h-9 rounded-[6px] bg-[#f53f3f] px-4 text-white transition-colors hover:bg-[#d9363e] disabled:cursor-not-allowed disabled:bg-[#c9cdd4]"
            >
              删除工作区
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(pendingRenameConversation)}
        onOpenChange={(open) => {
          if (!open) setPendingRenameConversation(null);
        }}
      >
        <DialogContent className="max-w-[360px] gap-5 rounded-[8px] border-[#e5e6eb] p-5 shadow-[0_12px_32px_rgba(29,33,41,0.16)]">
          <DialogHeader className="gap-2">
            <DialogTitle className="text-[18px] leading-[26px]">编辑对话名称</DialogTitle>
          </DialogHeader>
          <form onSubmit={(event) => { event.preventDefault(); saveConversationRename(); }}>
            <div className="relative">
              <input
                autoFocus
                value={renameDraft}
                onChange={(event) => setRenameDraft(event.target.value)}
                maxLength={20}
                className="h-9 w-full rounded-[6px] border border-[#d9dce3] py-0 pl-3 pr-[58px] text-sm text-[#1d2129] outline-none transition-colors placeholder:text-[#86909c] focus:border-[#165dff] focus:ring-2 focus:ring-[#165dff]/15"
                aria-label="历史对话标题"
              />
              <span
                aria-live="polite"
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs leading-[18px] text-[#86909c]"
              >
                {renameDraft.length}/20
              </span>
            </div>
            <DialogFooter className="mt-5 gap-2 sm:gap-2">
              <button
                type="button"
                onClick={() => setPendingRenameConversation(null)}
                className="h-9 rounded-[6px] border border-[#d9dce3] px-4 text-[#4e5969] transition-colors hover:bg-[#f7f8fa] hover:text-[#1d2129]"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={!renameDraft.trim()}
                className="h-9 rounded-[6px] bg-[#165dff] px-4 text-white transition-colors hover:bg-[#0e4edb] disabled:cursor-not-allowed disabled:bg-[#c9cdd4]"
              >
                保存
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </aside>
  );
}

function haveSameHistoryConversations(
  previousConversations: Conversation[],
  nextConversations: Conversation[],
) {
  if (previousConversations.length !== nextConversations.length) return false;

  const previousOrdered = sortConversationsForHistory(previousConversations);
  const nextOrdered = sortConversationsForHistory(nextConversations);

  return previousOrdered.every((previousConversation, index) => {
    const nextConversation = nextOrdered[index];
    if (!nextConversation) return false;

    const previousFirstQuestion = previousConversation.messages.find(
      (message) => message.role === 'user',
    );
    const nextFirstQuestion = nextConversation.messages.find(
      (message) => message.role === 'user',
    );

    return previousConversation.id === nextConversation.id
      && previousConversation.title === nextConversation.title
      && previousConversation.workspaceType === nextConversation.workspaceType
      && previousConversation.workspaceName === nextConversation.workspaceName
      && previousConversation.isPinned === nextConversation.isPinned
      && previousConversation.isArchived === nextConversation.isArchived
      && previousConversation.isDemo === nextConversation.isDemo
      && previousConversation.demoOrder === nextConversation.demoOrder
      && previousConversation.updatedAt.getTime() === nextConversation.updatedAt.getTime()
      && getHistoryConversationStatus(previousConversation) === getHistoryConversationStatus(nextConversation)
      && previousFirstQuestion?.content === nextFirstQuestion?.content
      && getConversationLastQuestionAt(previousConversation).getTime()
        === getConversationLastQuestionAt(nextConversation).getTime();
  });
}

export const ConversationHistorySidebar = memo(
  ConversationHistorySidebarComponent,
  (previousProps, nextProps) =>
    previousProps.selectedConversationId === nextProps.selectedConversationId
    && previousProps.newConversationLabel === nextProps.newConversationLabel
    && previousProps.onNewConversation === nextProps.onNewConversation
    && previousProps.onSelectConversation === nextProps.onSelectConversation
    && previousProps.onRenameConversation === nextProps.onRenameConversation
    && previousProps.onArchiveConversation === nextProps.onArchiveConversation
    && previousProps.onCollapse === nextProps.onCollapse
    && previousProps.filterRequest === nextProps.filterRequest
    && haveSameHistoryConversations(previousProps.conversations, nextProps.conversations),
);

ConversationHistorySidebar.displayName = 'ConversationHistorySidebar';
