import { type UIEvent, useEffect, useMemo, useRef, useState } from 'react';
import { PanelLeftClose, Trash2 } from 'lucide-react';
import historyCorner from '../../assets/figma-home/history-corner.png';
import newQaIcon from '../../assets/figma-home/new-qa-icon.svg';
import { Conversation } from '../types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

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
  onDeleteConversation: (conversationId: string) => void;
  onCollapse?: () => void;
};

function startOfDay(value: Date) {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getConversationGroupLabel(updatedAt: Date) {
  const today = startOfDay(new Date());
  const targetDay = startOfDay(updatedAt);
  const diffDays = Math.floor((today.getTime() - targetDay.getTime()) / 86400000);

  if (diffDays <= 0) return '今天';
  return '更早';
}

function groupConversationsByDate(conversations: Conversation[]): ConversationGroup[] {
  const order = ['今天', '更早'];
  const groups = new Map<string, Conversation[]>();

  conversations.forEach((conversation) => {
    const label = getConversationGroupLabel(conversation.updatedAt);
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
  onDeleteConversation,
  onCollapse,
}: ConversationHistorySidebarProps) {
  const [pendingDeleteConversation, setPendingDeleteConversation] =
    useState<Conversation | null>(null);
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

  return (
    <aside
      data-testid="conversation-history-sidebar"
      aria-label="历史对话"
      className="relative hidden h-full w-[280px] min-h-0 shrink-0 flex-col rounded-tl-[20px] bg-white/50 lg:flex"
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

                        return (
                          <div
                            key={conversation.id}
                            className={`group box-border flex h-9 min-w-0 max-w-full items-center gap-1 overflow-visible rounded-[8px] border py-1 pl-[9px] pr-1 opacity-80 transition-colors ${
                              isSelected
                                ? 'border-[#e5e6eb] bg-[#e5e8f0]'
                                : 'border-transparent hover:bg-[#f7f8fa]'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => onSelectConversation(conversation.id)}
                              className="flex h-full min-w-0 flex-1 items-center text-left focus-visible:outline-none"
                              title={conversation.title}
                            >
                              <span className="min-w-0 flex-1 truncate text-sm font-normal leading-[22px] text-[#1d2129]">
                                {conversation.title}
                              </span>
                            </button>
                            <div
                              className={`flex h-7 w-7 shrink-0 items-center justify-center transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 ${
                                isSelected ? 'opacity-100' : 'opacity-0'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => setPendingDeleteConversation(conversation)}
                                className="relative flex h-7 w-7 items-center justify-center rounded-[6px] text-[#86909c] transition-colors hover:bg-white hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/15 [&:focus-visible_.history-action-tooltip]:opacity-100 [&:hover_.history-action-tooltip]:opacity-100"
                                aria-label={`删除历史对话：${conversation.title}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span className="history-action-tooltip pointer-events-none absolute bottom-full left-1/2 z-40 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-[6px] bg-[rgba(29,33,41,0.92)] px-2 py-1 text-[12px] font-normal leading-[18px] text-white opacity-0 shadow-[0_4px_10px_rgba(29,33,41,0.14)] transition-opacity">
                                  删除
                                  <span className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-[4px] border-t-[4px] border-x-transparent border-t-[rgba(29,33,41,0.92)]" />
                                </span>
                              </button>
                            </div>
                          </div>
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

      <AlertDialog
        open={Boolean(pendingDeleteConversation)}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteConversation(null);
        }}
      >
        <AlertDialogContent className="max-w-[360px] gap-5 rounded-[8px] border-[#e5e6eb] p-5 shadow-[0_12px_32px_rgba(29,33,41,0.16)]">
          <AlertDialogHeader className="gap-2">
            <AlertDialogTitle className="text-[18px] leading-[26px]">删除历史对话</AlertDialogTitle>
            <AlertDialogDescription className="leading-[22px] text-[#4e5969]">
              删除后，聊天记录将不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel className="h-9 rounded-[6px] border-[#d9dce3] px-4 text-[#4e5969] hover:bg-[#f7f8fa] hover:text-[#1d2129]">
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDeleteConversation) {
                  onDeleteConversation(pendingDeleteConversation.id);
                }
                setPendingDeleteConversation(null);
              }}
              className="h-9 rounded-[6px] bg-[#f53f3f] px-4 text-white hover:bg-[#d9363e]"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
