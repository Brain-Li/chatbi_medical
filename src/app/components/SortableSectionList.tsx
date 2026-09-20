import { ReactNode, useEffect, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';

type DragState = { from: number; to: number; keyboard: boolean; startY: number; y: number; active: boolean };

export function SortableSectionList({ titles, disabled, onMove, children }: {
  titles: string[];
  disabled: boolean;
  onMove: (from: number, to: number) => void;
  children: (index: number, handle: ReactNode) => ReactNode;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const rows = useRef<Array<HTMLDivElement | null>>([]);
  const handles = useRef<Array<HTMLButtonElement | null>>([]);
  const dragRef = useRef<DragState | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const moveRef = useRef(onMove);
  moveRef.current = onMove;

  const updateDrag = (next: DragState | null) => {
    dragRef.current = next;
    setDrag(next);
  };
  const finish = (cancel = false) => {
    const current = dragRef.current;
    if (!current) return;
    updateDrag(null);
    if (!cancel && current.active && current.from !== current.to) moveRef.current(current.from, current.to);
    setAnnouncement(cancel ? '已取消排序' : `章节已放在第 ${current.active ? current.to + 1 : current.from + 1} 位`);
    requestAnimationFrame(() => handles.current[cancel || !current.active ? current.from : current.to]?.focus({ preventScroll: true }));
  };

  useEffect(() => {
    if (!drag) return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        finish(true);
      }
    };
    window.addEventListener('keydown', cancel, true);
    const blur = () => finish(true);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', cancel, true);
      window.removeEventListener('blur', blur);
    };
  }, [Boolean(drag)]);

  useEffect(() => {
    if (!drag || drag.keyboard) return;
    let frame = 0;
    let lastTime = 0;
    const tick = (time: number) => {
      const current = dragRef.current;
      if (!current) return;
      if (current.active) {
        let scroller = listRef.current?.parentElement;
        while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
        if (scroller) {
          const rect = scroller.getBoundingClientRect();
          const distance = current.y < rect.top + 48 ? current.y - rect.top - 48
            : current.y > rect.bottom - 48 ? current.y - rect.bottom + 48 : 0;
          scroller.scrollTop += Math.max(-1, Math.min(1, distance / 48)) * Math.min(time - (lastTime || time), 32) * 0.6;
        }
        const others = rows.current.filter((row, index) => row && index !== current.from);
        const target = others.filter(row => {
          const rect = row!.getBoundingClientRect();
          return current.y > rect.top + rect.height / 2;
        }).length;
        if (target !== current.to) updateDrag({ ...current, to: target });
      }
      lastTime = time;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [Boolean(drag), drag?.keyboard]);

  const boundary = drag && drag.active && drag.to !== drag.from
    ? drag.to > drag.from ? drag.to + 1 : drag.to : -1;
  return (
    <div ref={listRef} className="relative divide-y divide-[#e5e6eb]">
      <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
      {titles.map((title, index) => (
        <div key={index} ref={element => { rows.current[index] = element; }} className={`relative ${drag?.active && drag.from === index ? 'bg-[#e8f3ff] opacity-50' : ''}`}>
          {boundary === index && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 bg-[#165dff]" />}
          {children(index, (
            <button
              ref={element => { handles.current[index] = element; }}
              type="button"
              disabled={disabled || titles.length <= 1}
              aria-label={`拖拽第${index + 1}章节调整顺序`}
              aria-pressed={drag?.active && drag.from === index}
              title="拖拽调整顺序；空格拾起，方向键移动，空格放下，Esc 取消"
              className="flex h-8 w-7 touch-none select-none items-center justify-center rounded-[6px] text-[#86909c] hover:bg-[#e8f3ff] hover:text-[#165dff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/30 disabled:cursor-not-allowed disabled:opacity-40 cursor-grab active:cursor-grabbing"
              onPointerDown={event => {
                if (event.button !== 0 || dragRef.current) return;
                event.currentTarget.focus();
                event.currentTarget.setPointerCapture(event.pointerId);
                updateDrag({ from: index, to: index, keyboard: false, startY: event.clientY, y: event.clientY, active: false });
              }}
              onPointerMove={event => {
                const current = dragRef.current;
                if (!current || current.keyboard) return;
                updateDrag({ ...current, y: event.clientY, active: current.active || Math.abs(event.clientY - current.startY) > 5 });
              }}
              onPointerUp={() => { if (!dragRef.current?.keyboard) finish(); }}
              onPointerCancel={() => finish(true)}
              onLostPointerCapture={() => { if (!dragRef.current?.keyboard) finish(true); }}
              onKeyDown={event => {
                if (![' ', 'Enter', 'ArrowUp', 'ArrowDown', 'Tab'].includes(event.key)) return;
                const current = dragRef.current;
                if (event.key === 'Tab' && current) { finish(true); return; }
                if (event.key === ' ' || event.key === 'Enter') {
                  event.preventDefault();
                  if (current?.keyboard) finish();
                  else if (!current) {
                    updateDrag({ from: index, to: index, keyboard: true, startY: 0, y: 0, active: true });
                    setAnnouncement(`已拾起第 ${index + 1} 章节，使用上下方向键移动`);
                  }
                } else if (current?.keyboard) {
                  event.preventDefault();
                  const to = Math.max(0, Math.min(titles.length - 1, current.to + (event.key === 'ArrowUp' ? -1 : 1)));
                  updateDrag({ ...current, to });
                  rows.current[to]?.scrollIntoView({ block: 'nearest' });
                  setAnnouncement(`目标位置：第 ${to + 1} 位`);
                }
              }}
            ><GripVertical aria-hidden="true" className="h-4 w-4" /></button>
          ))}
          {boundary === titles.length && index === titles.length - 1 && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-0.5 bg-[#165dff]" />}
        </div>
      ))}
      {drag?.active && !drag.keyboard && (
        <div aria-hidden="true" className="pointer-events-none fixed z-[60] max-w-[240px] truncate rounded-[8px] border border-[#165dff] bg-white px-3 py-2 text-[13px] text-[#1d2129] shadow-lg"
          style={{ top: Math.max(8, Math.min(window.innerHeight - 48, drag.y - 20)), left: (listRef.current?.getBoundingClientRect().left ?? 0) + 32 }}>
          {titles[drag.from] || `第 ${drag.from + 1} 章节`}
        </div>
      )}
    </div>
  );
}
