import { useRef, useState, type FormEvent, type ChangeEvent, type ClipboardEvent, type CompositionEvent } from 'react';
import { PencilLine } from 'lucide-react';
import { toast } from 'sonner';
import ConfigCenterSection from './ConfigCenterSection';
import { ConfigActionIconButton } from './ConfigActionIconButton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  buildRuntimePrompt, readRuntimeModes, runtimeModesStorageKey, runtimeTextLimits, validateRuntimeMode,
  type RuntimeMode, type RuntimeModeForm,
} from '../utils/runtimeModes';

const secondaryTabs = [
  { label: 'Agent 管理', section: 'agents' },
  { label: 'Skill 管理', section: 'skills' },
  { label: 'MCP 接入', section: 'mcp' },
  { label: '知识库管理', section: 'knowledge' },
  { label: '工具管理', section: 'tools' },
  { label: '运行模式', section: 'runtime' },
];
const fieldClass = 'w-full min-w-0 rounded-lg border border-[#e5e6eb] bg-white px-3 text-sm font-normal text-[#1d2129] outline-none transition-colors placeholder:text-[#86909c] focus:border-[#86909c] focus:ring-2 focus:ring-[#1d2129]/10';
const labelClass = 'block text-sm font-medium leading-5 text-[#4e5969]';
const secondaryButtonClass = 'inline-flex h-9 items-center justify-center rounded-lg border border-[#e5e6eb] bg-white px-4 text-sm font-medium text-[#4e5969] transition-colors hover:bg-[#f2f3f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86909c]';
const invalidClass = '!border-red-500 focus:!ring-red-100';

function RuntimeTextField({ field, label, value, onChange, placeholder, required, rows, error }: {
  field: keyof typeof runtimeTextLimits; label: string; value: string; onChange: (value: string) => void;
  placeholder: string; required?: boolean; rows?: number; error?: string;
}) {
  const composing = useRef(false);
  const [isComposing, setIsComposing] = useState(false);
  const accepted = useRef(value);
  const [limitMessage, setLimitMessage] = useState('');
  const limit = runtimeTextLimits[field];
  const length = Array.from(value).length;
  const hint = isComposing ? '' : (error || (length > limit ? `最多输入 ${limit} 字` : limitMessage));
  const id = `runtime-${field}`;
  const update = (input: HTMLInputElement | HTMLTextAreaElement) => {
    let next = input.value;
    const overflow = Array.from(next).length - limit;
    if (overflow > 0 && Array.from(next).length >= Array.from(accepted.current).length) {
      // Keep the existing suffix when typing or pasting in the middle of the field.
      const caret = input.selectionStart ?? next.length;
      const before = Array.from(next.slice(0, caret));
      const prefix = before.slice(0, Math.max(0, before.length - overflow)).join('');
      next = prefix + next.slice(caret);
      input.value = next;
      input.setSelectionRange(prefix.length, prefix.length);
      setLimitMessage(`最多输入 ${limit} 字`);
    } else if (next !== accepted.current) setLimitMessage('');
    accepted.current = next;
    onChange(next);
  };
  const props = {
    id, required, value, placeholder,
    'aria-invalid': Boolean(hint), 'aria-describedby': `${id}-count${hint ? ` ${id}-error` : ''}`,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (composing.current) onChange(event.currentTarget.value);
      else update(event.currentTarget);
    },
    onPaste: (event: ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (composing.current) return;
      event.preventDefault();
      const input = event.currentTarget;
      const text = event.clipboardData.getData('text').replace(rows ? /\r\n?/g : /[\r\n]/g, rows ? '\n' : '');
      const start = input.selectionStart ?? input.value.length;
      input.setRangeText(text, start, input.selectionEnd ?? start, 'end');
      update(input);
    },
    onCompositionStart: () => { composing.current = true; setIsComposing(true); setLimitMessage(''); },
    onCompositionEnd: (event: CompositionEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      composing.current = false; setIsComposing(false); update(event.currentTarget);
    },
    className: `${fieldClass} block ${rows ? 'resize-y pt-2 pb-7 leading-6' : 'h-10 pr-16'} ${hint ? invalidClass : ''}`,
  };
  return <div className="min-w-0 space-y-2">
    <label htmlFor={id} className={labelClass}>{label}{required && <span className="ml-1 text-red-500">*</span>}</label>
    <div className="relative">
      {rows ? <textarea {...props} rows={rows} spellCheck={false} /> : <input {...props} autoFocus />}
      <span id={`${id}-count`} className={`pointer-events-none absolute text-xs tabular-nums ${rows ? 'bottom-2 right-4 bg-white px-1' : 'inset-y-0 right-3 flex items-center'} ${hint ? 'text-red-600' : 'text-[#86909c]'}`}>{length}/{limit}</span>
    </div>
    {hint && <p id={`${id}-error`} aria-live="polite" className="!mt-1 text-xs leading-4 text-red-600">{hint}</p>}
  </div>;
}

export default function RuntimeModeSection({ onOpenSection }: { onOpenSection: (section: string) => void }) {
  const [modes, setModes] = useState(readRuntimeModes);
  const [editingMode, setEditingMode] = useState<RuntimeMode | null>(null);
  const [form, setForm] = useState<RuntimeModeForm>({ name: '', code: '', maxSteps: '', description: '', systemPrompt: '', nextStepPrompt: '' });
  const [validated, setValidated] = useState(false);
  const [stepsHint, setStepsHint] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pageSize, setPageSize] = useState('10');
  const [jumpPage, setJumpPage] = useState('');
  const errors = editingMode ? validateRuntimeMode(form, modes, editingMode.id) : { name: '', code: '', maxSteps: '', description: '', systemPrompt: '', nextStepPrompt: '' };
  const finalPrompt = buildRuntimePrompt(form);
  const stepsError = stepsHint || (validated ? errors.maxSteps : '');

  const openEdit = (mode: RuntimeMode) => {
    setForm({ name: mode.name, code: mode.code, maxSteps: mode.maxSteps === null ? '' : String(mode.maxSteps), description: mode.description, systemPrompt: mode.systemPrompt, nextStepPrompt: mode.nextStepPrompt });
    setValidated(false);
    setStepsHint('');
    setPreviewOpen(false);
    setEditingMode(mode);
  };

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingMode) return;
    setValidated(true);
    const firstError = (['name', 'code', 'maxSteps', 'description', 'systemPrompt', 'nextStepPrompt'] as const).find((key) => errors[key]);
    if (firstError) {
      event.currentTarget.querySelector<HTMLElement>(`#runtime-${firstError}`)?.focus();
      return;
    }
    const updated: RuntimeMode = {
      ...form, id: editingMode.id, name: form.name.trim(), code: editingMode.code,
      description: form.description.trim(), maxSteps: Number(form.maxSteps),
    };
    const nextModes = modes.map((mode) => mode.id === updated.id ? updated : mode);
    try {
      localStorage.setItem(runtimeModesStorageKey, JSON.stringify(nextModes));
      setModes(nextModes);
      setEditingMode(null);
      toast.success('运行模式已更新');
    } catch {
      toast.error('保存失败，请检查浏览器存储空间或权限后重试');
    }
  };

  return (
    <ConfigCenterSection activePrimary="agents" activeSecondary="runtime" secondaryTabs={secondaryTabs} onOpenPrimarySection={onOpenSection} onOpenSecondary={(tab) => onOpenSection(tab.section)}>
      <div className="flex min-h-full flex-col">
        <div className="shrink-0 overflow-x-auto">
          <table className="w-full min-w-[680px] table-fixed text-left text-sm">
            <colgroup><col className="w-[62%]" /><col className="w-[15%]" /><col className="w-[14%]" /><col className="w-[9%]" /></colgroup>
            <thead className="h-12 bg-[#f7f8fa] text-[#4e5969]">
              <tr>{['引擎 Agent', '编码', '最大步数', '操作'].map((label) => <th key={label} className="px-4 font-normal">{label}</th>)}</tr>
            </thead>
            <tbody>
              {modes.map((mode) => (
                <tr key={mode.id} className="h-20 border-b border-[#e5e6eb] hover:bg-[#fafbfc]">
                  <td className="px-4 py-4">
                    <div className="truncate font-semibold" title={mode.name}>{mode.name}</div>
                    <p className="mt-1 max-w-[440px] truncate text-xs leading-5 text-[#86909c]" title={mode.description}>{mode.description || '暂无描述'}</p>
                  </td>
                  <td className="break-all px-4 py-4 text-[#4e5969]">{mode.code}</td>
                  <td className="px-4 text-[#4e5969]">{mode.maxSteps ?? '—'}</td>
                  <td className="px-3"><ConfigActionIconButton icon={PencilLine} label="编辑" aria-label={`编辑${mode.name}`} onClick={() => openEdit(mode)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-auto flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#e5e6eb] bg-[#f7f8fa] px-4 py-3 text-sm">
          <div className="flex items-center gap-4">
            <span>共 {modes.length} 条</span>
            <Select value={pageSize} onValueChange={setPageSize}>
              <SelectTrigger aria-label="每页条数" className="w-[108px] rounded-lg border-[#e5e6eb] bg-white"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-lg border-[#e5e6eb]">
                {['10', '20', '50'].map((size) => <SelectItem key={size} value={size}>{size} 条/页</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-4">
            <span aria-label="第 1 页" aria-current="page" className="flex size-8 items-center justify-center rounded-lg bg-[#1d2129] text-white">1</span>
            <form className="flex items-center gap-2 whitespace-nowrap text-[#86909c]" onSubmit={(event) => { event.preventDefault(); setJumpPage(''); }}>
              <label htmlFor="runtime-jump">跳至</label>
              <input id="runtime-jump" aria-label="跳转页码" type="number" min={1} max={1} value={jumpPage} onChange={(event) => setJumpPage(event.target.value)} className={`${fieldClass} h-8 !w-12 px-1 text-center`} />
              <span>页</span>
            </form>
          </div>
        </div>
      </div>

      <Dialog open={Boolean(editingMode)} onOpenChange={(open) => { if (!open) { setPreviewOpen(false); setEditingMode(null); } }}>
        <DialogContent aria-describedby={undefined} className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden rounded-2xl border-0 p-0 font-['PingFang_SC','Microsoft_YaHei',sans-serif] text-[#1d2129] sm:max-w-[800px]">
          <DialogHeader className="shrink-0 border-b border-[#e5e6eb] px-5 py-5 pr-12 text-left">
            <DialogTitle className="break-words text-lg leading-6">编辑运行模式 · {editingMode?.name}</DialogTitle>
          </DialogHeader>
          <form noValidate onSubmit={save} className="flex min-h-0 flex-col">
            <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.2fr_1fr_0.8fr]">
                <RuntimeTextField field="name" label="名称" required value={form.name} placeholder="请输入引擎名称" onChange={(name) => setForm((current) => ({ ...current, name }))} error={validated ? errors.name : undefined} />
                <div className="min-w-0 space-y-2">
                  <label htmlFor="runtime-code" className={labelClass}>编码</label>
                  <input id="runtime-code" readOnly value={form.code} className={`${fieldClass} h-10 !bg-[#f7f8fa] !text-[#86909c]`} />
                  {validated && errors.code && <p id="runtime-code-error" aria-live="polite" className="text-xs text-red-600">{errors.code}</p>}
                </div>
                <div className="min-w-0 space-y-2">
                  <label htmlFor="runtime-maxSteps" className={labelClass}>最大步数<span className="ml-1 text-red-500">*</span></label>
                  <input id="runtime-maxSteps" required inputMode="numeric" value={form.maxSteps} placeholder="请输入 1–100" onChange={(event) => {
                    const value = event.target.value;
                    if (value !== '' && (!/^[1-9]\d*$/.test(value) || Number(value) > 100)) {
                      setStepsHint('请输入 1–100 的整数');
                      return;
                    }
                    setStepsHint('');
                    setForm((current) => ({ ...current, maxSteps: value }));
                  }} aria-invalid={Boolean(stepsError)} aria-describedby={stepsError ? 'runtime-maxSteps-error' : undefined} className={`${fieldClass} h-10 ${stepsError ? invalidClass : ''}`} />
                  {stepsError && <p id="runtime-maxSteps-error" aria-live="polite" className="text-xs text-red-600">{stepsError}</p>}
                </div>
              </div>
              <RuntimeTextField field="description" label="描述" rows={3} value={form.description} placeholder="请简要说明引擎的用途和适用场景" onChange={(description) => setForm((current) => ({ ...current, description }))} error={validated ? errors.description : undefined} />
              <RuntimeTextField field="systemPrompt" label="system_prompt" required rows={5} value={form.systemPrompt} placeholder="请输入引擎的角色、职责与执行规则" onChange={(systemPrompt) => setForm((current) => ({ ...current, systemPrompt }))} error={validated ? errors.systemPrompt : undefined} />
              <RuntimeTextField field="nextStepPrompt" label="next_step_prompt" required rows={5} value={form.nextStepPrompt} placeholder="请输入推进下一步骤的提示词" onChange={(nextStepPrompt) => setForm((current) => ({ ...current, nextStepPrompt }))} error={validated ? errors.nextStepPrompt : undefined} />
            </div>
            <DialogFooter className="shrink-0 flex-row flex-wrap justify-end border-t border-[#e5e6eb] px-5 py-4">
              <button type="button" className={secondaryButtonClass} onClick={() => setEditingMode(null)}>取消</button>
              <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogTrigger asChild><button type="button" className={secondaryButtonClass}>预览最终提示词</button></DialogTrigger>
                <DialogContent className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden rounded-2xl border-0 p-0 sm:max-w-[800px]">
                  <DialogHeader className="shrink-0 border-b border-[#e5e6eb] px-5 py-5 pr-12 text-left">
                    <DialogTitle className="leading-6">最终提示词预览</DialogTitle>
                    <DialogDescription className="text-xs leading-5">按 system_prompt、next_step_prompt 顺序拼接，包含当前未保存的修改。</DialogDescription>
                  </DialogHeader>
                  <div className="min-h-0 overflow-y-auto px-5 py-4">
                    {finalPrompt ? <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-[#1d2129]">{finalPrompt}</pre> : <p className="py-8 text-center text-sm text-[#86909c]">暂无提示词，请返回编辑后预览。</p>}
                  </div>
                  <DialogFooter className="shrink-0 border-t border-[#e5e6eb] px-5 py-4"><button type="button" className={secondaryButtonClass} onClick={() => setPreviewOpen(false)}>返回编辑</button></DialogFooter>
                </DialogContent>
              </Dialog>
              <button type="submit" className="h-9 rounded-lg bg-[#1d2129] px-6 text-sm font-medium text-white hover:bg-[#363c46] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86909c] focus-visible:ring-offset-2">保存</button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ConfigCenterSection>
  );
}
