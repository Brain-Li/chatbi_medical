import { useEffect } from 'react';
import { Archive, ArchiveX, Check, ChevronsUpDown, Clock3, FolderClosed, FolderTree, List, MessageCircle, SlidersHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { HistoryViewOptions } from '../utils/historyViewOptions';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: HistoryViewOptions;
  onChange: (change: Partial<HistoryViewOptions>) => void;
};

export function HistoryViewOptionsMenu({ open, onOpenChange, options, onChange }: Props) {
  useEffect(() => {
    if (!open) return;
    const media = window.matchMedia('(max-width: 639px)');
    const closeOnSmallScreen = () => { if (media.matches) onOpenChange(false); };
    closeOnSmallScreen();
    media.addEventListener('change', closeOnSmallScreen);
    return () => media.removeEventListener('change', closeOnSmallScreen);
  }, [open, onOpenChange]);

  const option = (label: string, Icon: LucideIcon, selected: boolean, change: Partial<HistoryViewOptions>) => (
    <DropdownMenuItem
      key={label}
      role="menuitemradio"
      aria-checked={selected}
      onSelect={() => onChange(change)}
      className="h-9 gap-2.5 rounded-[6px] px-2.5 text-sm font-normal text-[#1d2129] focus:bg-[#eceeef]"
    >
      <Icon aria-hidden="true" className="h-4 w-4 text-[#4e5969]" strokeWidth={1.6} />
      <span className="flex-1">{label}</span>
      {selected && <Check aria-hidden="true" className="h-4 w-4 text-[#1d2129]" strokeWidth={1.8} />}
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="视图选项"
          title="视图选项"
          className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-transparent text-[#86909c] transition-colors hover:text-[#4e5969] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/20"
        >
          <SlidersHorizontal aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        hideWhenDetached
        aria-label="视图选项"
        className="w-[232px] rounded-[14px] border-[#e5e6eb] bg-[#fcfdfe] p-2 text-[#1d2129] shadow-[0_8px_24px_rgba(29,33,41,0.12)] max-sm:hidden"
      >
        <DropdownMenuLabel className="px-2.5 py-1.5 text-xs font-normal text-[#86909c]">分组方式</DropdownMenuLabel>
        <div role="group" aria-label="分组方式">
          {option('按工作区', FolderClosed, options.grouping === 'workspace', { grouping: 'workspace' })}
          {option('按工作区树', FolderTree, options.grouping === 'tree', { grouping: 'tree' })}
          {option('单列表', List, options.grouping === 'list', { grouping: 'list' })}
        </div>
        <DropdownMenuSeparator className="mx-2.5 my-1.5 bg-[#e5e6eb]" />
        <DropdownMenuLabel className="px-2.5 py-1.5 text-xs font-normal text-[#86909c]">排序方式</DropdownMenuLabel>
        <div role="group" aria-label="排序方式">
          {option('手动排序', ChevronsUpDown, options.sort === 'manual', { sort: 'manual' })}
          {option('最近更新', Clock3, options.sort === 'recent', { sort: 'recent' })}
        </div>
        <DropdownMenuSeparator className="mx-2.5 my-1.5 bg-[#e5e6eb]" />
        <DropdownMenuLabel className="px-2.5 py-1.5 text-xs font-normal text-[#86909c]">筛选会话</DropdownMenuLabel>
        <div role="group" aria-label="筛选会话">
          {option('隐藏已归档', ArchiveX, options.filter === 'all', { filter: 'all' })}
          {option('全部对话（显示已归档）', MessageCircle, options.filter === 'all-with-archived', { filter: 'all-with-archived' })}
          {option('仅显示已归档', Archive, options.filter === 'archived', { filter: 'archived' })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
