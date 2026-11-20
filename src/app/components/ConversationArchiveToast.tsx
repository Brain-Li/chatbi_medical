import { CircleCheck } from 'lucide-react';

type ConversationArchiveToastProps = {
  onUndo: () => void;
  onShowArchived: () => void;
};

export function ConversationArchiveToast({ onUndo, onShowArchived }: ConversationArchiveToastProps) {
  const actionClassName = 'rounded-sm text-[#78a7ff] hover:text-[#a6c5ff] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#78a7ff]';

  return (
    <div
      role="status"
      data-testid="conversation-archive-toast"
      className="flex w-full items-center gap-2.5 rounded-[14px] bg-[#333335] px-4 py-3.5 text-sm font-normal leading-[22px] text-white shadow-[0_8px_28px_rgba(0,0,0,0.16)]"
    >
      <CircleCheck aria-hidden="true" className="h-5 w-5 shrink-0 text-[#19c15f]" strokeWidth={1.8} />
      <div>
        会话已归档，可
        <button type="button" onClick={onUndo} className={actionClassName}>撤销</button>
        或
        <button type="button" onClick={onShowArchived} className={actionClassName}>筛选已归档会话</button>
      </div>
    </div>
  );
}
