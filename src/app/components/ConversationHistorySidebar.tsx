import { type UIEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Ellipsis, PanelLeftClose, Pencil, Trash2 } from 'lucide-react';
import historyCorner from '../../assets/figma-home/history-corner.png';
import newQaIcon from '../../assets/figma-home/new-qa-icon.svg';
import askIcon from '../../assets/figma-home/chat-bubble-line.svg';
import askMutedIcon from '../../assets/figma-home/chat-bubble-line-muted.svg';
import reportIcon from '../../assets/figma-home/pie-chart-box-line.svg';
import reportSelectedIcon from '../../assets/figma-home/pie-chart-box-line-selected.svg';
import { Conversation } from '../types';
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
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

type ConversationGroup = {
  label: string;
  items: Conversation[];
};

type ConversationHistorySidebarProps = {
  conversations: Conversation[];
  selectedConversationId: string | null;
  newConversationLabel: string;
  historyLabel: string;
  onNewConversation: () => void;
  onSelectConversation: (conversationId: string) => void;
  onRenameConversation: (conversationId: string, title: string) => void;
  onDeleteConversation: (conversationId: string) => void;
  onCollapse?: () => void;
};

function startOfDay(value: Date) {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getConversationLastQuestionAt(conversation: Conversation) {
  return conversation.messages.reduce<Date | null>((latestQuestionAt, message) => {
    if (message.role !== 'user') return latestQuestionAt;
    if (!latestQuestionAt || message.timestamp.getTime() > latestQuestionAt.getTime()) {
      return message.timestamp;
    }
    return latestQuestionAt;
  }, null) ?? conversation.updatedAt;
}

function getConversationDisplayTitle(conversation: Conversation) {
  const firstQuestion = conversation.messages.find((message) => message.role === 'user')?.content;
  if (!firstQuestion) return conversation.title;

  const generatedTitle = firstQuestion.length > 18 ? `${firstQuestion.slice(0, 18)}...` : firstQuestion;
  return conversation.title === generatedTitle ? firstQuestion : conversation.title;
}

function getConversationGroupLabel(conversation: Conversation, lastQuestionAt: Date) {
  if (conversation.isDemo) return '异常演示';

  const today = startOfDay(new Date());
  const targetDay = startOfDay(lastQuestionAt);
  const diffDays = Math.floor((today.getTime() - targetDay.getTime()) / 86400000);

  if (diffDays <= 0) return '今天';
  return '更早';
}

function formatConversationDetailTimestamp(lastQuestionAt: Date) {
  const month = String(lastQuestionAt.getMonth() + 1).padStart(2, '0');
  const day = String(lastQuestionAt.getDate()).padStart(2, '0');
  const hours = String(lastQuestionAt.getHours()).padStart(2, '0');
  const minutes = String(lastQuestionAt.getMinutes()).padStart(2, '0');

  return `${month}-${day} ${hours}:${minutes}`;
}

function groupConversationsByDate(conversations: Conversation[]): ConversationGroup[] {
  const order = ['异常演示', '今天', '更早'];
  const groups = new Map<string, Conversation[]>();

  [...conversations]
    .sort((first, second) => {
      if (first.isDemo && second.isDemo) {
        return (first.demoOrder ?? 0) - (second.demoOrder ?? 0);
      }
      if (first.isDemo) return -1;
      if (second.isDemo) return 1;
      return getConversationLastQuestionAt(second).getTime()
        - getConversationLastQuestionAt(first).getTime();
    })
    .forEach((conversation) => {
      const label = getConversationGroupLabel(
        conversation,
        getConversationLastQuestionAt(conversation),
      );
      groups.set(label, [...(groups.get(label) ?? []), conversation]);
    });

  return order
    .map((label) => ({
      label,
      items: groups.get(label) ?? [],
    }))
    .filter((group) => group.items.length > 0);
}

export function ConversationHistorySidebar({
  conversations,
  selectedConversationId,
  newConversationLabel,
  historyLabel,
  onNewConversation,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
  onCollapse,
}: ConversationHistorySidebarProps) {
  const [pendingDeleteConversation, setPendingDeleteConversation] =
    useState<Conversation | null>(null);
  const [pendingRenameConversation, setPendingRenameConversation] =
    useState<Conversation | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [isScrolling, setIsScrolling] = useState(false);
  const [scrollbarThumb, setScrollbarThumb] = useState({
    height: 0,
    top: 0,
    visible: false,
  });
  const scrollTimerRef = useRef<number | null>(null);
  const conversationGroups = useMemo(
    () => groupConversationsByDate(conversations),
    [conversations],
  );

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

  return (
    <aside
      data-testid="conversation-history-sidebar"
      aria-label="历史对话"
      className="relative flex h-full w-[280px] min-h-0 shrink-0 flex-col rounded-tl-[20px] bg-white/50 max-sm:hidden"
    >
      <div
        className="flex h-full min-h-0 w-full flex-col px-4 pt-4"
        style={{ fontFamily: '"PingFang SC", "PingFang_SC", "Microsoft YaHei", Arial, sans-serif' }}
      >
        <div className="flex shrink-0 flex-col gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onNewConversation}
              className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-[8px] bg-white px-2 py-[6px] text-left text-[15px] font-normal leading-[22.5px] text-[#1d2129] transition-colors hover:bg-white"
            >
              <img alt="" src={newQaIcon} className="h-[23px] w-[21px] shrink-0" />
              <span className="min-w-0 flex-1 truncate">{newConversationLabel}</span>
            </button>
            {onCollapse && (
              <button
                type="button"
                onClick={onCollapse}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-white text-[#4e5969] transition-colors hover:bg-[#f7f8fa]"
                aria-label="收起历史对话"
                title="收起历史对话"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex h-10 items-center justify-between py-[6px]">
            <span className="text-[15px] font-normal leading-[22.5px] text-[#4e5969]">
              {historyLabel}
            </span>
          </div>
        </div>

        <div className="relative min-h-0 min-w-0 flex-1">
          <div
            onScroll={handleScroll}
            className="history-scrollbar h-full min-h-0 min-w-0 overflow-x-hidden overflow-y-auto pb-2"
          >
            {conversations.length > 0 ? (
              <div className="min-w-0 max-w-full space-y-2 text-sm font-normal leading-[22px]">
                {conversationGroups.map((group) => (
                  <div key={group.label} className="min-w-0 max-w-full space-y-2 overflow-visible">
                    <div className="overflow-hidden text-ellipsis text-sm leading-[22px] text-[#86909c]">
                      {group.label}
                    </div>
                    <div className="min-w-0 max-w-full space-y-2 overflow-visible">
                      {group.items.map((conversation) => {
                        const isSelected = conversation.id === selectedConversationId;
                        const lastQuestionAt = getConversationLastQuestionAt(conversation);
                        const displayTitle = getConversationDisplayTitle(conversation);
                        const isReportConversation = conversation.workspaceType === 'report';
                        const conversationIcon = isReportConversation
                          ? isSelected
                            ? reportSelectedIcon
                            : reportIcon
                          : isSelected
                            ? askIcon
                            : askMutedIcon;

                        return (
                          <Tooltip key={conversation.id} delayDuration={260}>
                            <TooltipTrigger asChild>
                              <div
                                data-testid={`conversation-history-item-${conversation.id}`}
                                className={`group relative box-border flex h-9 min-w-0 max-w-full items-center gap-2 overflow-visible rounded-[8px] border py-1 pl-[9px] pr-1 opacity-80 transition-colors ${
                                  isSelected
                                    ? 'border-[#e5e6eb] bg-[#e5e8f0]'
                                    : 'border-transparent hover:bg-[#f7f8fa]'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => onSelectConversation(conversation.id)}
                                  className="flex h-full min-w-0 flex-1 items-center gap-1.5 text-left transition-[padding] duration-150 group-focus-within:pr-7 group-hover:pr-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20"
                                >
                                  <img
                                    src={conversationIcon}
                                    alt=""
                                    className="h-3.5 w-3.5 shrink-0"
                                  />
                                  <span className="min-w-0 flex-1 truncate text-sm font-normal leading-[22px] text-[#1d2129]">
                                    {conversation.title}
                                  </span>
                                </button>
                                <div
                                  className="pointer-events-none absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center opacity-0 transition-opacity group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100"
                                >
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button
                                        type="button"
                                        className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#86909c] transition-colors hover:bg-white hover:text-[#4e5969] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20"
                                        aria-label={`更多操作：${conversation.title}`}
                                      >
                                        <Ellipsis className="h-4 w-4" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                      align="start"
                                      alignOffset={-10}
                                      className="min-w-[108px] rounded-[8px] border-[#e5e6eb] bg-white p-1 text-[#4e5969] shadow-[0_8px_20px_rgba(29,33,41,0.1)]"
                                    >
                                      <DropdownMenuItem
                                        onSelect={() => startRenameConversation(conversation)}
                                        className="h-8 rounded-[6px] px-2.5 text-[#4e5969]"
                                      >
                                        <Pencil className="h-4 w-4" />
                                        重命名
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        variant="destructive"
                                        onSelect={() => setPendingDeleteConversation(conversation)}
                                        className="h-8 rounded-[6px] px-2.5"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        删除
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent
                              data-testid={`conversation-history-tooltip-${conversation.id}`}
                              side="right"
                              align="center"
                              sideOffset={4}
                              collisionPadding={12}
                              className="max-w-[320px] rounded-[10px] border border-[#e5e6eb] bg-white px-3 py-2.5 text-left text-[#1d2129] shadow-[0_8px_24px_rgba(29,33,41,0.12)] [&_svg]:!bg-white [&_svg]:!fill-white [&_svg]:!drop-shadow-none"
                            >
                              <div className="max-w-[292px] whitespace-normal break-words text-sm font-medium leading-[22px]">
                                {displayTitle}
                              </div>
                              <div className="mt-1 text-xs font-normal leading-[18px] text-[#86909c]">
                                {formatConversationDetailTimestamp(lastQuestionAt)}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-2 py-10 text-center text-sm leading-[22px] text-[#86909c]">
                当前入口暂无会话
              </div>
            )}
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

      <img
        aria-hidden="true"
        alt=""
        src={historyCorner}
        className="pointer-events-none absolute left-full top-0 h-5 w-5 max-w-none object-cover"
      />

      <Dialog
        open={Boolean(pendingRenameConversation)}
        onOpenChange={(open) => {
          if (!open) setPendingRenameConversation(null);
        }}
      >
        <DialogContent className="max-w-[360px] gap-5 rounded-[8px] border-[#e5e6eb] p-5 shadow-[0_12px_32px_rgba(29,33,41,0.16)] [&>[data-slot=dialog-close]]:hidden">
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

      <Dialog
        open={Boolean(pendingDeleteConversation)}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteConversation(null);
        }}
      >
        <DialogContent className="max-w-[360px] gap-5 rounded-[8px] border-[#e5e6eb] p-5 shadow-[0_12px_32px_rgba(29,33,41,0.16)] [&>[data-slot=dialog-close]]:hidden">
          <DialogHeader className="gap-2">
            <DialogTitle className="text-[18px] leading-[26px]">删除历史对话</DialogTitle>
            <DialogDescription className="leading-[22px] text-[#4e5969]">
              删除后，聊天记录将不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <button
              type="button"
              onClick={() => setPendingDeleteConversation(null)}
              className="h-9 rounded-[6px] border border-[#d9dce3] px-4 text-[#4e5969] transition-colors hover:bg-[#f7f8fa] hover:text-[#1d2129]"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => {
                if (pendingDeleteConversation) {
                  onDeleteConversation(pendingDeleteConversation.id);
                }
                setPendingDeleteConversation(null);
              }}
              className="h-9 rounded-[6px] bg-[#f53f3f] px-4 text-white transition-colors hover:bg-[#d9363e]"
            >
              删除
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
