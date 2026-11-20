import { useState } from 'react';
import { Copy, Download, Ellipsis, Send } from 'lucide-react';
import { toast } from 'sonner';
import type { Conversation } from '../types';
import { conversationToMarkdown, downloadSessionLog } from '../utils/conversationExport';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';

const itemClass = 'h-10 gap-2.5 rounded-[8px] px-2.5 text-[14px] font-normal text-[#1d2129] focus:bg-[#f2f3f5] focus:text-[#1d2129] [&_svg]:text-[#4e5969]';

export function ConversationDetailHeader({ conversation, sidebarOpen }: {
  conversation: Conversation;
  sidebarOpen?: boolean;
}) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackDraft, setFeedbackDraft] = useState('');

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(conversationToMarkdown(conversation));
      toast.success('会话已复制为 Markdown');
    } catch {
      toast.error('复制失败，请允许浏览器访问剪贴板后重试');
    }
  };

  return (
    <header data-testid="conversation-detail-header" className={'relative flex h-12 shrink-0 items-center gap-3 bg-white pr-4 after:absolute after:bottom-0 after:left-5 after:right-5 after:h-px after:bg-[#e5e6eb] sm:gap-5 sm:pr-6 ' + (sidebarOpen ? 'pl-5 sm:pl-7' : 'pl-14')}>
      <h1 className="min-w-0 truncate text-[16px] font-medium leading-6 text-[#1d2129]" title={conversation.title}>{conversation.title}</h1>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label="当前会话更多操作" className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#86909c] transition-colors hover:bg-[#f2f3f5] hover:text-[#1d2129] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/25">
            <Ellipsis aria-hidden="true" className="h-5 w-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6} collisionPadding={12} className="w-[248px] max-w-[calc(100vw-24px)] rounded-[16px] border-[#e5e6eb] bg-white p-1.5 text-[#1d2129] shadow-[0_8px_28px_rgba(29,33,41,0.12)]">
          <DropdownMenuItem onSelect={() => { void copyMarkdown(); }} className={itemClass}>
            <Copy aria-hidden="true" />
            复制会话为 Markdown
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => {
            try {
              downloadSessionLog(conversation);
              toast.success('Session 日志已开始下载');
            } catch {
              toast.error('下载失败，请重试');
            }
          }} className={itemClass}>
            <Download aria-hidden="true" />
            下载 Session 日志
          </DropdownMenuItem>
          <DropdownMenuSeparator className="mx-2.5 my-1.5 bg-[#e5e6eb]" />
          <DropdownMenuItem onSelect={() => setFeedbackOpen(true)} className={itemClass}>
            <Send aria-hidden="true" />
            反馈
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent className="max-w-[440px] rounded-[16px]">
          <DialogHeader>
            <DialogTitle>会话反馈</DialogTitle>
            <DialogDescription>描述当前会话的问题或建议。反馈将保存在此浏览器中，暂不发送至服务器。</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => {
            event.preventDefault();
            const content = feedbackDraft.trim();
            if (!content) return;
            try {
              const key = 'chatbi_medical.conversationFeedback.v1';
              const saved = JSON.parse(localStorage.getItem(key) ?? '[]');
              if (!Array.isArray(saved)) throw new Error('Invalid feedback storage');
              localStorage.setItem(key, JSON.stringify([...saved, {
                id: crypto.randomUUID(),
                conversationId: conversation.id,
                conversationTitle: conversation.title,
                content,
                createdAt: new Date().toISOString(),
              }]));
              setFeedbackDraft('');
              setFeedbackOpen(false);
              toast.success('反馈已保存到此浏览器');
            } catch {
              toast.error('保存失败，请检查浏览器存储空间后重试');
            }
          }}>
            <label htmlFor="conversation-feedback" className="mb-2 block text-sm text-[#1d2129]">反馈内容</label>
            <textarea id="conversation-feedback" autoFocus required maxLength={2000} rows={5} value={feedbackDraft} onChange={(event) => setFeedbackDraft(event.target.value)} placeholder="请描述遇到的问题或改进建议…" className="w-full resize-y rounded-lg border border-[#d9dce3] px-3 py-2 text-sm outline-none focus:border-[#165dff] focus:ring-2 focus:ring-[#165dff]/15" />
            <p className="mt-1 text-right text-xs text-[#86909c]">{feedbackDraft.length}/2000</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setFeedbackOpen(false)} className="h-9 rounded-lg border border-[#e5e6eb] px-4 text-sm">取消</button>
              <button type="submit" disabled={!feedbackDraft.trim()} className="h-9 rounded-lg bg-[#1d2129] px-4 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40">保存反馈</button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </header>
  );
}
