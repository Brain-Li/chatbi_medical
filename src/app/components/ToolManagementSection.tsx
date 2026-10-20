import { useRef, useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, Copy, PencilLine, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import ConfigCenterSection from './ConfigCenterSection';
import { ConfigActionIconButton } from './ConfigActionIconButton';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from './ui/alert-dialog';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

type Tool = {
  id: string;
  name: string;
  code: string;
  type: '' | 'builtin' | 'custom';
  enabled: boolean;
  description: string;
  parameters: string;
};

const storageKey = 'chatbi-medical-tools-v1';
const toolNameLimit = 20;
const toolCodeLimit = 20;
const toolDescriptionLimit = 100;
const toolParametersLimit = 500;
const initialTools: Tool[] = [
  { id: 'report-chart', name: '报告图表工具', code: 'report_chart', description: '报告 SOP 内置图表构建工具；只接收后端可信查询结果，生成报告图表。' },
  { id: 'code-interpreter', name: '代码解释器', code: 'code_interpreter', description: '执行代码完成数据处理、计算与可视化等任务。' },
  { id: 'report-tool', name: '报告工具', code: 'report_tool', description: '生成结构化网页/报告产物。' },
  { id: 'deep-search', name: '深度搜索', code: 'deep_search_tool', description: '联网深度检索资料，用于调研类任务。' },
  { id: 'file-tool', name: '文件工具', code: 'file_tool', description: '读取/写入工作区文件，处理报告、附件、知识文档等产物。' },
].map((tool) => ({ ...tool, type: 'builtin', enabled: true, parameters: '' }));

const emptyForm: Omit<Tool, 'id'> = {
  name: '', code: '', type: '', enabled: true, description: '', parameters: '',
};
const secondaryTabs = [
  { label: 'Agent 管理', section: 'agents' },
  { label: 'Skill 管理', section: 'skills' },
  { label: 'MCP 接入', section: 'mcp' },
  { label: '知识库管理', section: 'knowledge' },
  { label: '工具管理', section: 'tools' },
  { label: '运行模式', section: 'runtime' },
];
const fieldClass = 'w-full rounded-lg border border-[#e5e6eb] bg-white px-3 text-sm text-[#1d2129] outline-none transition-colors placeholder:text-[#86909c] focus:border-[#86909c] focus:ring-2 focus:ring-[#1d2129]/10';
const buttonClass = 'inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-[#e5e6eb] bg-white px-3 text-sm text-[#4e5969] transition-colors hover:bg-[#f2f3f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86909c] disabled:opacity-40';

function validateTool(form: Omit<Tool, 'id'>, tools: Tool[], editingId: string | null) {
  const errors = { name: '', code: '', description: '', parameters: '' };
  if (Array.from(form.description).length > toolDescriptionLimit) errors.description = '最多输入 100 字';
  if (!form.name.trim()) errors.name = '请输入工具名称';
  else if (Array.from(form.name).length > toolNameLimit) errors.name = '最多输入 20 字';
  if (!form.code.trim()) errors.code = '请输入编码';
  else if (Array.from(form.code).length > toolCodeLimit) errors.code = `最多输入 ${toolCodeLimit} 字`;
  else if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(form.code.trim())) errors.code = '以字母开头，仅支持字母、数字和下划线';
  else if (tools.some((tool) => tool.id !== editingId && tool.code.toLowerCase() === form.code.trim().toLowerCase())) errors.code = '该编码已存在，请更换';
  if (Array.from(form.parameters).length > toolParametersLimit) errors.parameters = '最多输入 500 字';
  else if (form.parameters.trim()) {
    try {
      JSON.parse(form.parameters);
    } catch {
      errors.parameters = '参数 JSON 格式不正确，请检查引号、逗号和括号';
    }
  }
  return errors;
}

function readTools(): Tool[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return initialTools;
    const stored: unknown = JSON.parse(raw);
    if (Array.isArray(stored) && stored.every((tool) =>
      tool && typeof tool.id === 'string' && typeof tool.name === 'string' &&
      typeof tool.code === 'string' && typeof tool.enabled === 'boolean' &&
      typeof tool.description === 'string' && typeof tool.parameters === 'string' &&
      ['', 'builtin', 'custom'].includes(tool.type),
    )) return stored;
  } catch {
    // The initial catalog remains available if browser storage cannot be read.
  }
  return initialTools;
}

export default function ToolManagementSection({ onOpenSection }: { onOpenSection: (section: string) => void }) {
  const [tools, setTools] = useState<Tool[]>(readTools);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [jumpPage, setJumpPage] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isComposingName, setIsComposingName] = useState(false);
  const composingName = useRef(false);
  const acceptedName = useRef('');
  const [nameLimitMessage, setNameLimitMessage] = useState('');
  const [isComposingCode, setIsComposingCode] = useState(false);
  const composingCode = useRef(false);
  const acceptedCode = useRef('');
  const [codeLimitMessage, setCodeLimitMessage] = useState('');
  const [isComposingDescription, setIsComposingDescription] = useState(false);
  const composingDescription = useRef(false);
  const acceptedDescription = useRef('');
  const [descriptionLimitMessage, setDescriptionLimitMessage] = useState('');
  const descriptionLength = Array.from(form.description).length;
  const descriptionTooLong = descriptionLength > toolDescriptionLimit && !isComposingDescription;
  const [isComposingParameters, setIsComposingParameters] = useState(false);
  const composingParameters = useRef(false);
  const acceptedParameters = useRef('');
  const [parametersLimitMessage, setParametersLimitMessage] = useState('');
  const parametersLength = Array.from(form.parameters).length;
  const parametersTooLong = parametersLength > toolParametersLimit && !isComposingParameters;
  const [validatedFields, setValidatedFields] = useState({ name: false, code: false, parameters: false });
  const validationErrors = validateTool(form, tools, editingId);
  const nameError = !isComposingName && validatedFields.name ? validationErrors.name : '';
  const codeError = !isComposingCode && validatedFields.code ? validationErrors.code : '';
  const parametersError = !isComposingParameters && validatedFields.parameters ? validationErrors.parameters : '';
  const showParametersError = Boolean(parametersError) || parametersTooLong;
  const parametersHint = parametersError || (parametersTooLong ? '最多输入 500 字' : parametersLimitMessage);
  const codeLength = Array.from(form.code).length;
  const codeTooLong = codeLength > toolCodeLimit;
  const showCodeError = Boolean(codeError) || (codeTooLong && !isComposingCode);
  const codeHint = codeError || (showCodeError ? `最多输入 ${toolCodeLimit} 字` : codeLimitMessage);
  const nameLength = Array.from(form.name).length;
  const nameTooLong = nameLength > toolNameLimit;
  const showNameError = Boolean(nameError) || (nameTooLong && !isComposingName);
  const nameHint = nameError || (showNameError
    ? `已超出 ${nameLength - toolNameLimit} 字，请缩短至 ${toolNameLimit} 字以内`
    : nameLimitMessage);
  const [pendingDelete, setPendingDelete] = useState<Tool | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredTools = tools.filter((tool) => `${tool.name} ${tool.code} ${tool.description}`.toLowerCase().includes(normalizedQuery));
  const totalPages = Math.max(1, Math.ceil(filteredTools.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleTools = filteredTools.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const updateLimitedField = (input: HTMLInputElement | HTMLTextAreaElement, field: 'name' | 'code' | 'description' | 'parameters') => {
    const limit = { name: toolNameLimit, code: toolCodeLimit, description: toolDescriptionLimit, parameters: toolParametersLimit }[field];
    const accepted = { name: acceptedName, code: acceptedCode, description: acceptedDescription, parameters: acceptedParameters }[field];
    const setLimitMessage = { name: setNameLimitMessage, code: setCodeLimitMessage, description: setDescriptionLimitMessage, parameters: setParametersLimitMessage }[field];
    let value = input.value;
    const overflow = Array.from(value).length - limit;
    if (overflow > 0) {
      // Remove excess inserted characters before the caret, preserving the text after it.
      const caret = input.selectionStart ?? value.length;
      const beforeCaret = Array.from(value.slice(0, caret));
      const prefix = beforeCaret.slice(0, Math.max(0, beforeCaret.length - overflow)).join('');
      value = prefix + value.slice(caret);
      input.value = value;
      input.setSelectionRange(prefix.length, prefix.length);
      setLimitMessage(`最多输入 ${limit} 字`);
    } else if (value !== accepted.current) {
      setLimitMessage('');
    }
    accepted.current = value;
    setForm((current) => ({ ...current, [field]: value }));
  };
  const updateName = (input: HTMLInputElement) => updateLimitedField(input, 'name');
  const updateCode = (input: HTMLInputElement) => updateLimitedField(input, 'code');

  const persist = (next: Tool[]) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setTools(next);
      return true;
    } catch {
      toast.error('保存失败，请检查浏览器存储空间或权限后重试');
      return false;
    }
  };

  const openForm = (tool?: Tool, copy = false) => {
    setEditingId(tool && !copy ? tool.id : null);
    let code = tool?.code ?? '';
    if (tool && copy) {
      const copyCode = (suffix: string) => `${Array.from(tool.code).slice(0, toolCodeLimit - suffix.length).join('')}${suffix}`;
      code = copyCode('_copy');
      let suffix = 2;
      while (tools.some((item) => item.code.toLowerCase() === code.toLowerCase())) code = copyCode(`_copy_${suffix++}`);
    }
    const name = tool ? (copy ? `${Array.from(tool.name).slice(0, toolNameLimit - 4).join('')}（副本）` : tool.name) : '';
    setForm(tool ? { ...tool, code, name } : { ...emptyForm });
    acceptedName.current = name;
    composingName.current = false;
    setNameLimitMessage('');
    setValidatedFields({ name: false, code: false, parameters: false });
    setIsComposingName(false);
    acceptedCode.current = code;
    composingCode.current = false;
    setIsComposingCode(false);
    setCodeLimitMessage('');
    acceptedDescription.current = tool?.description ?? '';
    composingDescription.current = false;
    setIsComposingDescription(false);
    setDescriptionLimitMessage('');
    acceptedParameters.current = tool?.parameters ?? '';
    composingParameters.current = false;
    setIsComposingParameters(false);
    setParametersLimitMessage('');
    setDialogOpen(true);
  };

  const saveTool = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (composingName.current || composingCode.current || composingDescription.current || composingParameters.current) return;
    const fields = ['name', 'code', 'description', 'parameters'] as const;
    setValidatedFields((current) => ({
      name: current.name || Boolean(validationErrors.name),
      code: current.code || Boolean(validationErrors.code),
      parameters: current.parameters || Boolean(validationErrors.parameters),
    }));
    const firstInvalid = fields.find((field) => validationErrors[field]);
    if (firstInvalid) {
      event.currentTarget.querySelector<HTMLElement>(`#tool-${firstInvalid}`)?.focus();
      return;
    }
    const name = form.name.trim();
    const code = form.code.trim();
    const parameters = form.parameters.trim();
    const tool: Tool = { ...form, id: editingId ?? crypto.randomUUID(), name, code, description: form.description.trim(), parameters };
    if (!persist(editingId ? tools.map((item) => item.id === editingId ? tool : item) : [tool, ...tools])) return;
    setQuery('');
    setPage(1);
    setDialogOpen(false);
    toast.success(editingId ? '工具已更新' : '工具已新增');
  };

  return (
    <ConfigCenterSection
      activePrimary="agents" activeSecondary="tools" secondaryTabs={secondaryTabs}
      onOpenPrimarySection={onOpenSection} onOpenSecondary={(tab) => onOpenSection(tab.section)}
    >
      <div className="flex min-h-full flex-col">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 py-2 sm:px-4">
          <input
            aria-label="搜索工具" placeholder="请输入工具名称、编码或描述" value={query}
            onChange={(event) => { setQuery(event.target.value); setPage(1); }}
            className={`${fieldClass} h-9 max-w-xs`}
          />
          <button type="button" className={buttonClass} onClick={() => openForm()}><Plus className="size-4" />新建工具</button>
        </div>
        <div className="shrink-0 overflow-x-auto">
          <table className="w-full min-w-[760px] table-fixed text-left text-sm">
            <colgroup><col className="w-[47%]" /><col className="w-[19%]" /><col className="w-[10%]" /><col className="w-[9%]" /><col className="w-[15%]" /></colgroup>
            <thead className="h-12 bg-[#f7f8fa] text-[#4e5969]">
              <tr>{['工具名称', '编码', '类型', '状态', '操作'].map((label) => <th key={label} className="px-4 font-normal">{label}</th>)}</tr>
            </thead>
            <tbody>
              {visibleTools.map((tool) => (
                <tr key={tool.id} className="h-[72px] border-b border-[#e5e6eb] hover:bg-[#fafbfc]">
                  <td className="px-4 py-3"><div className="truncate font-semibold" title={tool.name}>{tool.name}</div><p className="mt-1 truncate text-xs leading-5 text-[#86909c]" title={tool.description}>{tool.description || '暂无描述'}</p></td>
                  <td className="break-all px-4 py-3 text-[#4e5969]">{tool.code}</td>
                  <td className="px-4"><span className="rounded-md bg-[#f2f3f5] px-2 py-1 text-xs text-[#4e5969]">{tool.type || '—'}</span></td>
                  <td className="px-4"><Switch aria-label={`${tool.name}状态`} title={tool.enabled ? '已启用' : '已停用'} checked={tool.enabled} onCheckedChange={(enabled) => persist(tools.map((item) => item.id === tool.id ? { ...item, enabled } : item))} className="data-[state=checked]:bg-[#1d2129]" /></td>
                  <td className="px-3"><div className="flex items-center gap-1">
                    <ConfigActionIconButton icon={PencilLine} label="编辑" aria-label={`编辑${tool.name}`} onClick={() => openForm(tool)} />
                    <ConfigActionIconButton icon={Copy} label="复制" aria-label={`复制${tool.name}`} onClick={() => openForm(tool, true)} />
                    <ConfigActionIconButton icon={Trash2} label="删除" aria-label={`删除${tool.name}`} onClick={() => setPendingDelete(tool)} />
                  </div></td>
                </tr>
              ))}
              {visibleTools.length === 0 && <tr><td colSpan={5} className="py-16 text-center text-[#86909c]">{query ? '未找到匹配的工具，请尝试其他关键词' : '暂无工具，点击“新建工具”添加'}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="mt-auto flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#e5e6eb] bg-[#f7f8fa] px-4 py-3 text-sm">
          <div className="flex items-center gap-4"><span>共 {filteredTools.length} 条</span><select aria-label="每页条数" className={buttonClass} value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value={10}>10 条/页</option><option value={20}>20 条/页</option><option value={50}>50 条/页</option></select></div>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="上一页" className={`${buttonClass} w-8 px-0`} disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="size-4" /></button>
            <span aria-current="page" className="flex size-8 items-center justify-center rounded-lg bg-[#1d2129] text-white">{currentPage}</span>
            <span className="text-[#86909c]">/ {totalPages}</span>
            <button type="button" aria-label="下一页" className={`${buttonClass} w-8 px-0`} disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}><ChevronRight className="size-4" /></button>
            <form className="ml-2 flex items-center gap-2 whitespace-nowrap" onSubmit={(event) => { event.preventDefault(); if (jumpPage) { setPage(Math.max(1, Math.min(totalPages, Number(jumpPage)))); setJumpPage(''); } }}>
              <label htmlFor="tools-jump">跳至</label><input id="tools-jump" aria-label="跳转页码" type="number" min={1} max={totalPages} value={jumpPage} onChange={(event) => setJumpPage(event.target.value)} className={`${fieldClass} h-8 !w-12 px-1 text-center`} /><span>页</span>
            </form>
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent aria-describedby={undefined} className="max-h-[90dvh] overflow-y-auto rounded-2xl border-0 p-0 sm:max-w-[640px]">
          <form noValidate onSubmit={saveTool}>
            <DialogHeader className="border-b border-[#e5e6eb] px-5 py-5 text-left"><DialogTitle>{editingId ? '编辑工具' : '新建工具'}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-2">
              <div className="-mb-2 flex min-w-0 flex-col gap-2">
                <label htmlFor="tool-name" className="text-sm font-medium leading-5 text-[#4e5969]">工具名称 <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    id="tool-name" autoFocus required value={form.name} placeholder="请输入工具名称"
                    aria-invalid={showNameError} aria-describedby="tool-name-hint"
                    onChange={(event) => {
                      if (composingName.current) {
                        setForm((current) => ({ ...current, name: event.target.value }));
                      } else updateName(event.currentTarget);
                    }}
                    onPaste={(event) => {
                      if (composingName.current) return;
                      event.preventDefault();
                      const input = event.currentTarget;
                      const start = input.selectionStart ?? input.value.length;
                      const end = input.selectionEnd ?? start;
                      const text = event.clipboardData.getData('text').replace(/[\r\n]/g, '');
                      input.setRangeText(text, start, end, 'end');
                      updateName(input);
                    }}
                    onCompositionStart={() => {
                      composingName.current = true;
                      setIsComposingName(true);
                      setNameLimitMessage('');
                    }}
                    onCompositionEnd={(event) => {
                      composingName.current = false;
                      setIsComposingName(false);
                      updateName(event.currentTarget);
                    }}
                    className={`${fieldClass} block h-10 pr-16 ${showNameError ? '!border-red-500 focus:!ring-red-100' : ''}`}
                  />
                  <span aria-hidden="true" className={`pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs tabular-nums ${showNameError ? 'text-red-600' : 'text-[#86909c]'}`}>{nameLength}/{toolNameLimit}</span>
                </div>
                <p id="tool-name-hint" aria-live="polite" className="-mt-1 min-h-4 text-xs leading-4 text-red-600">
                  {nameHint}
                </p>
              </div>
              <div className="-mb-2 flex min-w-0 flex-col gap-2">
                <label htmlFor="tool-code" className="text-sm font-medium leading-5 text-[#4e5969]">编码 <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input
                    id="tool-code" required value={form.code} placeholder="例如：file_tool"
                    aria-invalid={showCodeError} aria-describedby="tool-code-hint"
                    onChange={(event) => {
                      if (composingCode.current) setForm((current) => ({ ...current, code: event.target.value }));
                      else updateCode(event.currentTarget);
                    }}
                    onPaste={(event) => {
                      if (composingCode.current) return;
                      event.preventDefault();
                      const input = event.currentTarget;
                      const start = input.selectionStart ?? input.value.length;
                      const end = input.selectionEnd ?? start;
                      input.setRangeText(event.clipboardData.getData('text').replace(/[\r\n]/g, ''), start, end, 'end');
                      updateCode(input);
                    }}
                    onCompositionStart={() => {
                      composingCode.current = true;
                      setIsComposingCode(true);
                      setCodeLimitMessage('');
                    }}
                    onCompositionEnd={(event) => {
                      composingCode.current = false;
                      setIsComposingCode(false);
                      updateCode(event.currentTarget);
                    }}
                    className={`${fieldClass} block h-10 pr-16 ${showCodeError ? '!border-red-500 focus:!ring-red-100' : ''}`}
                  />
                  <span aria-hidden="true" className={`pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs tabular-nums ${showCodeError ? 'text-red-600' : 'text-[#86909c]'}`}>{codeLength}/{toolCodeLimit}</span>
                </div>
                <p id="tool-code-hint" aria-live="polite" className="-mt-1 min-h-4 text-xs leading-4 text-red-600">{codeHint}</p>
              </div>
              <div className="min-w-0 space-y-2">
                <label htmlFor="tool-type" className="text-sm font-medium text-[#4e5969]">类型</label>
                <Select value={form.type} onValueChange={(value) => setForm((current) => ({ ...current, type: value as Tool['type'] }))}>
                  <SelectTrigger id="tool-type" aria-label="类型" className={`${fieldClass} data-[size=default]:h-10`}><SelectValue placeholder="请选择" /></SelectTrigger>
                  <SelectContent className="rounded-lg border-[#e5e6eb] bg-white text-[#1d2129]">
                    <SelectItem value="builtin" className="rounded-md focus:bg-[#f2f3f5]">内置工具</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-0 space-y-2">
                <label htmlFor="tool-status" className="text-sm font-medium text-[#4e5969]">状态 <span className="text-red-500">*</span></label>
                <Select required value={form.enabled ? 'enabled' : 'disabled'} onValueChange={(value) => setForm((current) => ({ ...current, enabled: value === 'enabled' }))}>
                  <SelectTrigger id="tool-status" aria-label="状态" className={`${fieldClass} data-[size=default]:h-10`}><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-lg border-[#e5e6eb] bg-white text-[#1d2129]">
                    <SelectItem value="enabled" className="rounded-md focus:bg-[#f2f3f5]">启用</SelectItem>
                    <SelectItem value="disabled" className="rounded-md focus:bg-[#f2f3f5]">停用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="-mb-2 flex min-w-0 flex-col gap-2 sm:col-span-2">
                <label htmlFor="tool-description" className="text-sm font-medium leading-5 text-[#4e5969]">描述</label>
                <div className="relative">
                  <textarea
                    id="tool-description" rows={3} value={form.description}
                    placeholder="请简要说明工具的用途和适用场景"
                    aria-invalid={descriptionTooLong} aria-describedby="tool-description-hint"
                    onChange={(event) => {
                      if (composingDescription.current) setForm((current) => ({ ...current, description: event.target.value }));
                      else updateLimitedField(event.currentTarget, 'description');
                    }}
                    onPaste={(event) => {
                      if (composingDescription.current) return;
                      event.preventDefault();
                      const input = event.currentTarget;
                      const start = input.selectionStart;
                      const end = input.selectionEnd;
                      input.setRangeText(event.clipboardData.getData('text').replace(/\r\n?/g, '\n'), start, end, 'end');
                      updateLimitedField(input, 'description');
                    }}
                    onCompositionStart={() => {
                      composingDescription.current = true;
                      setIsComposingDescription(true);
                      setDescriptionLimitMessage('');
                    }}
                    onCompositionEnd={(event) => {
                      composingDescription.current = false;
                      setIsComposingDescription(false);
                      updateLimitedField(event.currentTarget, 'description');
                    }}
                    className={`${fieldClass} block min-h-24 resize-y pt-2 pb-7 font-normal ${descriptionTooLong ? '!border-red-500 focus:!ring-red-100' : ''}`}
                  />
                  <span aria-hidden="true" className={`pointer-events-none absolute right-4 bottom-2 bg-white px-1 text-xs tabular-nums ${descriptionTooLong ? 'text-red-600' : 'text-[#86909c]'}`}>{descriptionLength}/{toolDescriptionLimit}</span>
                </div>
                <p id="tool-description-hint" aria-live="polite" className="-mt-1 min-h-4 text-xs leading-4 text-red-600">{descriptionTooLong ? '最多输入 100 字' : descriptionLimitMessage}</p>
              </div>
              <div className="-mb-2 flex min-w-0 flex-col gap-2 sm:col-span-2">
                <label htmlFor="tool-parameters" className="text-sm font-medium leading-5 text-[#4e5969]">参数 JSON</label>
                <div className="relative">
                  <textarea
                    id="tool-parameters" rows={3} spellCheck={false} value={form.parameters}
                    placeholder={'请输入 JSON 格式的工具参数，无需配置可留空\n例如：{"limit": 10}'}
                    aria-invalid={showParametersError} aria-describedby="tool-parameters-hint"
                    onChange={(event) => {
                      if (composingParameters.current) setForm((current) => ({ ...current, parameters: event.target.value }));
                      else updateLimitedField(event.currentTarget, 'parameters');
                    }}
                    onPaste={(event) => {
                      if (composingParameters.current) return;
                      event.preventDefault();
                      const input = event.currentTarget;
                      input.setRangeText(event.clipboardData.getData('text').replace(/\r\n?/g, '\n'), input.selectionStart, input.selectionEnd, 'end');
                      updateLimitedField(input, 'parameters');
                    }}
                    onCompositionStart={() => {
                      composingParameters.current = true;
                      setIsComposingParameters(true);
                      setParametersLimitMessage('');
                    }}
                    onCompositionEnd={(event) => {
                      composingParameters.current = false;
                      setIsComposingParameters(false);
                      updateLimitedField(event.currentTarget, 'parameters');
                    }}
                    className={`${fieldClass} block min-h-24 resize-y pt-2 pb-7 font-normal ${form.parameters ? 'font-mono' : ''} ${showParametersError ? '!border-red-500 focus:!ring-red-100' : ''}`}
                  />
                  <span aria-hidden="true" className={`pointer-events-none absolute right-4 bottom-2 bg-white px-1 text-xs tabular-nums ${showParametersError ? 'text-red-600' : 'text-[#86909c]'}`}>{parametersLength}/{toolParametersLimit}</span>
                </div>
                <p id="tool-parameters-hint" aria-live="polite" className="-mt-1 min-h-4 text-xs leading-4 text-red-600">{parametersHint}</p>
              </div>
            </div>
            <DialogFooter className="flex-row justify-end border-t border-[#e5e6eb] px-5 py-4"><button type="button" className={`${buttonClass} min-w-20`} onClick={() => setDialogOpen(false)}>取消</button><button type="submit" disabled={nameTooLong || isComposingName || codeTooLong || isComposingCode} className="h-9 min-w-20 rounded-lg bg-[#1d2129] px-5 text-sm font-medium text-white hover:bg-[#363c46] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#86909c] focus-visible:ring-offset-2 disabled:opacity-40">保存</button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>删除工具</AlertDialogTitle><AlertDialogDescription>确认删除「{pendingDelete?.name}」？删除后将从工具列表中移除。</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction className="bg-[#1d2129] text-white hover:bg-[#363c46]" onClick={(event) => {
            if (pendingDelete && persist(tools.filter((tool) => tool.id !== pendingDelete.id))) { setPendingDelete(null); toast.success('工具已删除'); } else event.preventDefault();
          }}>删除</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfigCenterSection>
  );
}
