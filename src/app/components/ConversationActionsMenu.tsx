import { Archive, ArchiveRestore, Copy, GitFork, Pin, PinOff, SquarePen } from 'lucide-react';
import { toast } from 'sonner';
import type { Conversation } from '../types';
import {
  DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut,
} from './ui/dropdown-menu';

type ConversationActionsMenuProps = {
  conversation: Conversation;
  onPin: () => void;
  onRename: () => void;
  onFork: () => void;
  onArchive: () => void;
};

const itemClass = 'h-10 gap-2.5 rounded-[8px] px-2.5 text-[14px] font-normal text-[#1d2129] focus:bg-[#f2f3f5] focus:text-[#1d2129] [&_svg]:text-[#4e5969]';
const shortcutClass = 'ml-auto pl-3 text-[11px] tracking-normal text-[#a8adb5]';

export function ConversationActionsMenu({ conversation, onPin, onRename, onFork, onArchive }: ConversationActionsMenuProps) {
  const copySessionId = async () => {
    try {
      await navigator.clipboard.writeText(conversation.id);
      toast.success('Session ID 已复制');
    } catch {
      toast.error('复制失败，请允许浏览器访问剪贴板后重试');
    }
  };

  return (
    <DropdownMenuContent
      align="start"
      alignOffset={-10}
      sideOffset={6}
      collisionPadding={12}
      className="w-[248px] max-w-[calc(100vw-24px)] rounded-[16px] border-[#e5e6eb] bg-white p-1.5 text-[#1d2129] shadow-[0_8px_28px_rgba(29,33,41,0.12)]"
    >
      <DropdownMenuItem onSelect={onPin} className={itemClass}>
        {conversation.isPinned ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" className="rotate-[30deg]" />}
        {conversation.isPinned ? '取消置顶' : '置顶会话'}
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={onRename} aria-keyshortcuts="Control+Alt+G" className={itemClass}>
        <SquarePen aria-hidden="true" />
        重命名
        <DropdownMenuShortcut className={shortcutClass}>Ctrl + Alt + G</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={onFork} aria-keyshortcuts="Control+Alt+F" className={itemClass}>
        <GitFork aria-hidden="true" className="rotate-90" />
        分叉会话
        <DropdownMenuShortcut className={shortcutClass}>Ctrl + Alt + F</DropdownMenuShortcut>
      </DropdownMenuItem>
      <DropdownMenuSeparator className="mx-2.5 my-1.5 bg-[#e5e6eb]" />
      <DropdownMenuItem onSelect={() => { void copySessionId(); }} className={itemClass}>
        <Copy aria-hidden="true" />
        复制 Session ID
      </DropdownMenuItem>
      <DropdownMenuSeparator className="mx-2.5 my-1.5 bg-[#e5e6eb]" />
      <DropdownMenuItem onSelect={onArchive} aria-keyshortcuts="Control+Shift+A" className={itemClass}>
        {conversation.isArchived ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}
        {conversation.isArchived ? '取消归档' : '归档会话'}
        <DropdownMenuShortcut className={shortcutClass}>Ctrl + Shift + A</DropdownMenuShortcut>
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}
