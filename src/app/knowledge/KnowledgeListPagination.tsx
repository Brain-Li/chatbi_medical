import { ChevronLeft, ChevronRight } from 'lucide-react';

export const PAGE_SIZES = [10, 20, 50];

const pageButton = 'inline-flex h-8 items-center whitespace-nowrap rounded-md border border-[#e5e6eb] bg-white text-sm text-[#4e5969] enabled:hover:bg-[#f7f8fa] focus-visible:outline-2 focus-visible:outline-[#165dff] disabled:opacity-50';

type KnowledgeListPaginationProps = {
  label: string;
  className?: string;
  count: number;
  pageSize: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

export function KnowledgeListPagination({ label, className = '', count, pageSize, page, totalPages, onPageChange, onPageSizeChange }: KnowledgeListPaginationProps) {
  const firstMiddlePage = Math.max(2, Math.min(page - 1, totalPages - 3));
  const pageNumbers = totalPages <= 7
    ? Array.from({ length: totalPages }, (_, index) => index + 1)
    : [1, firstMiddlePage, firstMiddlePage + 1, firstMiddlePage + 2, totalPages];

  return (
    <nav aria-label={label} className={'mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-white py-2 text-sm ' + className}>
      <div className="flex items-center gap-3">
        <span aria-live="polite" className="whitespace-nowrap text-xs tabular-nums text-[#646a73]">共 {count} 条</span>
        <select aria-label="每页条数" value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className={pageButton + ' cursor-pointer px-2.5'}>
          {PAGE_SIZES.map((size) => <option key={size} value={size}>{size} 条/页</option>)}
        </select>
      </div>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
        <button type="button" aria-label="上一页" title="上一页" disabled={page === 1} onClick={() => onPageChange(page - 1)} className={pageButton + ' w-8 justify-center px-0'}><ChevronLeft aria-hidden="true" className="size-4" /></button>
        {pageNumbers.map((pageNumber, index) => (
          <div key={pageNumber} className="flex items-center gap-1">
            {index > 0 && pageNumber - pageNumbers[index - 1] > 1 && <span aria-hidden="true" className="px-0.5 text-[#646a73]">…</span>}
            <button type="button" aria-label={`第 ${pageNumber} 页`} aria-current={pageNumber === page ? 'page' : undefined} onClick={() => onPageChange(pageNumber)} className={pageButton + ' min-w-8 justify-center px-1.5 tabular-nums aria-[current=page]:border-[#165dff] aria-[current=page]:bg-[#eaf2ff] aria-[current=page]:font-medium aria-[current=page]:text-[#165dff]'}>{pageNumber}</button>
          </div>
        ))}
        <button type="button" aria-label="下一页" title="下一页" disabled={page === totalPages} onClick={() => onPageChange(page + 1)} className={pageButton + ' w-8 justify-center px-0'}><ChevronRight aria-hidden="true" className="size-4" /></button>
      </div>
    </nav>
  );
}
