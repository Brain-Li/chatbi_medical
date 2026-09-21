import { useLayoutEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { sectionTitleMaxLength, sectionDescriptionMaxLength } from '../utils/reportTemplateStructure';

type SectionContent = { title: string; titlePrefix?: string; description: string };

function parseSectionContent(value: string): SectionContent {
  const newline = value.indexOf('\n');
  const heading = newline < 0 ? value : value.slice(0, newline);
  const prefix = heading.match(/^(?:[一二三四五六七八九十百零〇]{1,4}|[0-9０-９]{1,4})[、.．][ \t]*/)?.[0] ?? '';
  return { title: heading.slice(prefix.length), titlePrefix: prefix, description: newline < 0 ? '' : value.slice(newline + 1) };
}

// Plain-text editors may insert either newlines or block elements on Enter.
function readText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (node instanceof Element && node.hasAttribute('data-editor-end')) return node.textContent ?? '';
  if (node.nodeName === 'BR') return '\n';
  let text = '';
  node.childNodes.forEach((child, index) => {
    if (index && ['DIV', 'P'].includes(child.nodeName) && !text.endsWith('\n')) text += '\n';
    text += readText(child);
  });
  return text;
}

function caretOffset(editor: HTMLDivElement) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !editor.contains(selection.focusNode)) return 0;
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.setEnd(selection.focusNode!, selection.focusOffset);
  return readText(range.cloneContents()).length;
}

function renderText(editor: HTMLDivElement, value: string, caret?: number) {
  const { description } = parseSectionContent(value);
  const heading = document.createElement('span');
  heading.className = 'font-bold text-[#1d2129]';
  heading.textContent = value.split('\n', 1)[0];
  const body = document.createElement('span');
  body.className = 'font-normal text-[#86909c]';
  body.textContent = description;
  editor.replaceChildren(heading);
  if (value.includes('\n')) editor.append(document.createTextNode('\n'), body);
  if (!value || value.endsWith('\n')) {
    const end = document.createElement('span');
    end.setAttribute('data-editor-end', '');
    end.append(document.createElement('br'));
    editor.append(end);
  }
  if (caret === undefined) return;
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(true);
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let remaining = Math.min(caret, value.length);
  let node = walker.nextNode();
  while (node) {
    if (remaining <= (node.textContent?.length ?? 0)) {
      range.setStart(node, remaining);
      range.collapse(true);
      break;
    }
    remaining -= node.textContent?.length ?? 0;
    node = walker.nextNode();
  }
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
}

export function ReportStructureSectionInput({
  section, index, error, inputRef, onChange, onDelete, canDelete, disabled,
}: {
  section: SectionContent;
  index: number;
  error?: string;
  inputRef: (element: HTMLDivElement | null) => void;
  onChange: (content: SectionContent) => void;
  onDelete: () => void;
  canDelete: boolean;
  disabled: boolean;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const valueRef = useRef('');
  const composing = useRef(false);
  const previousCaret = useRef(0);
  const history = useRef<Array<{ value: string; caret: number }>>([]);
  const historyIndex = useRef(0);
  const [limitMessage, setLimitMessage] = useState('');
  const defaultPrefix = `${['一', '二', '三', '四', '五', '六', '七', '八'][index]}、`;
  const contentForValue = (value: string): SectionContent => {
    const content = parseSectionContent(value);
    return { ...content, titlePrefix: section.titlePrefix === undefined && content.titlePrefix === defaultPrefix ? undefined : content.titlePrefix };
  };

  useLayoutEffect(() => {
    const value = `${section.titlePrefix ?? defaultPrefix}${section.title}\n${section.description}`;
    if (valueRef.current === value && editorRef.current?.childNodes.length) return;
    // Keep an empty writing-requirements line available for pointer placement.
    valueRef.current = value;
    history.current = [{ value: valueRef.current, caret: 0 }];
    historyIndex.current = 0;
    if (editorRef.current) renderText(editorRef.current, valueRef.current);
    setLimitMessage('');
  }, [section.title, section.titlePrefix, section.description, defaultPrefix]);

  const commitInput = (editor: HTMLDivElement) => {
    const caret = caretOffset(editor);
    const text = readText(editor).replace(/\r\n?/g, '\n');
    const draft = text.includes('\n') ? text : `${text}\n`;
    const content = contentForValue(draft);
    const titleOver = Array.from(content.title).length > sectionTitleMaxLength;
    const descriptionOver = Array.from(content.description).length > sectionDescriptionMaxLength;
    if (titleOver || descriptionOver) {
      setLimitMessage(titleOver ? '章节标题最多支持 20 字' : '写作要求最多支持 2000 字，超出内容未输入。');
      renderText(editor, valueRef.current, previousCaret.current);
      return;
    }
    if (draft !== valueRef.current) {
      history.current = history.current.slice(0, historyIndex.current + 1);
      history.current.push({ value: draft, caret });
      if (history.current.length > 100) history.current.shift();
      historyIndex.current = history.current.length - 1;
    }
    valueRef.current = draft;
    setLimitMessage('');
    renderText(editor, draft, caret);
    onChange(content);
  };

  const message = limitMessage || error;
  return (
    <div className="min-w-0 flex-1">
      <div className="group relative rounded-[8px] bg-white">
        <div
          ref={(element) => { editorRef.current = element; inputRef(element); }}
          contentEditable={disabled ? false : 'plaintext-only'}
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={`第${index + 1}章节内容`}
          aria-disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={`section-content-hint${message ? ` section-content-error-${index}` : ''}`}
          tabIndex={disabled ? -1 : 0}
          onFocus={(event) => {
            if (!section.title && !section.description && section.titlePrefix === undefined) {
              renderText(event.currentTarget, valueRef.current, defaultPrefix.length);
            }
          }}
          onKeyDown={(event) => {
            if (disabled || composing.current) return;
            if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
              event.preventDefault();
              const redo = event.key.toLowerCase() === 'y' || event.shiftKey;
              const target = historyIndex.current + (redo ? 1 : -1);
              const entry = history.current[target];
              if (!entry) return;
              historyIndex.current = target;
              valueRef.current = entry.value;
              renderText(event.currentTarget, entry.value, entry.caret);
              setLimitMessage('');
              onChange(contentForValue(entry.value));
              return;
            }
            if (event.key !== 'Enter' || composing.current || disabled) return;
            event.preventDefault();
            const selection = window.getSelection();
            if (!selection?.rangeCount) return;
            previousCaret.current = caretOffset(event.currentTarget);
            const range = selection.getRangeAt(0);
            const content = parseSectionContent(valueRef.current);
            const headingLength = valueRef.current.indexOf('\n');
            if (range.collapsed && !content.description && previousCaret.current === headingLength) {
              renderText(event.currentTarget, valueRef.current, headingLength + 1);
              return;
            }
            range.deleteContents();
            const newline = document.createTextNode('\n');
            range.insertNode(newline);
            range.setStartAfter(newline);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            commitInput(event.currentTarget);
          }}
          onBeforeInput={() => { if (!composing.current && editorRef.current) previousCaret.current = caretOffset(editorRef.current); }}
          onCompositionStart={() => { composing.current = true; if (editorRef.current) previousCaret.current = caretOffset(editorRef.current); }}
          onCompositionEnd={(event) => { composing.current = false; commitInput(event.currentTarget); }}
          onInput={(event) => { if (!composing.current) commitInput(event.currentTarget); }}
          className={`block min-h-[76px] w-full resize-y overflow-auto whitespace-pre-wrap break-words rounded-[8px] border bg-transparent py-2.5 pl-4 pr-10 text-[14px] leading-6 caret-[#1d2129] outline-none focus:ring-2 focus:ring-[#165dff]/10 ${disabled ? 'cursor-wait opacity-60' : ''} ${error ? 'border-[#f53f3f] focus:border-[#f53f3f]' : 'border-[#e5e6eb] hover:border-[#c9cdd4] focus:border-[#165dff]'}`}
        />
        <button type="button" aria-label={`删除第${index + 1}章节`} title="删除章节" disabled={disabled || !canDelete} onClick={onDelete} className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-[4px] text-[#86909c] hover:bg-[#fff2f0] hover:text-[#f53f3f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/30 disabled:cursor-not-allowed disabled:opacity-40">
          <Trash2 aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
      {message && <p id={`section-content-error-${index}`} role="alert" className="mt-1 text-[12px] leading-5 text-[#f53f3f]">{message}</p>}
    </div>
  );
}
