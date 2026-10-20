import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Box,
  Database,
  HeartHandshake,
  Monitor,
  Radio,
  Trash2,
  Wrench,
} from 'lucide-react';
import type { AgentType, SemanticDataset } from '../types';
import AgentDatasetConfig from './AgentDatasetConfig';
import closeLargeFillIcon from '../../assets/figma-agent-management/close-large-fill.svg';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

type AgentFormValue = {
  name: string;
  type: AgentType;
  description: string;
  exampleQuestions: string[];
  datasetIds: string[];
};

type CreateAgentDialogProps = {
  open: boolean;
  datasets: SemanticDataset[];
  onOpenChange: (open: boolean) => void;
  onSave: (value: AgentFormValue) => void;
};

const agentTypeOptions: Array<{ value: AgentType; label: string }> = [
  { value: 'ask', label: '问数 Agent' },
  { value: 'report', label: '报告 Agent' },
  { value: 'rca', label: '深度分析 Agent' },
];

const navigationItems = [
  { label: '基础信息', icon: Monitor, active: true },
  { label: '数据集配置', icon: Database },
  { label: 'Skills 配置', icon: Wrench },
  { label: 'MCP能力', icon: Radio },
  { label: '知识库', icon: BookOpen },
  { label: '模型与策略', icon: Box },
  { label: '权限与发布', icon: HeartHandshake },
];

const fieldClass =
  "h-10 w-full rounded-xl border border-[#e5e6eb] bg-white px-3 font-['PingFang_SC','Microsoft_YaHei',sans-serif] text-sm leading-[22px] tracking-[0.15px] text-[#1d2129] outline-none transition-colors placeholder:text-[#86909c] hover:border-[#c9cdd4] focus:border-[#165dff] focus:ring-2 focus:ring-[#165dff]/10";

export default function CreateAgentDialog({
  open,
  datasets,
  onOpenChange,
  onSave,
}: CreateAgentDialogProps) {
  const [activeTab, setActiveTab] = useState('基础信息');
  const [datasetIds, setDatasetIds] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [type, setType] = useState<AgentType | ''>('');
  const [description, setDescription] = useState('');
  const [exampleQuestions, setExampleQuestions] = useState(['']);
  const [questionHints, setQuestionHints] = useState<string[]>(['']);
  const composingQuestions = useRef<boolean[]>([false]);
  const acceptedQuestions = useRef<string[]>(['']);
  const updateQuestion = (input: HTMLInputElement, index: number) => {
    let value = input.value;
    const overflow = Array.from(value).length - 20;
    if (overflow > 0) {
      const caret = input.selectionStart ?? value.length;
      const before = Array.from(value.slice(0, caret));
      const prefix = before.slice(0, Math.max(0, before.length - overflow)).join('');
      value = prefix + value.slice(caret);
      input.value = value;
      input.setSelectionRange(prefix.length, prefix.length);
      setQuestionHints((current) => current.map((hint, i) => i === index ? '最多输入 20 字' : hint));
    } else if (value !== acceptedQuestions.current[index]) {
      setQuestionHints((current) => current.map((hint, i) => i === index ? '' : hint));
    }
    acceptedQuestions.current[index] = value;
    setExampleQuestions((current) => current.map((item, i) => i === index ? value : item));
  };
  const [descriptionLimitMessage, setDescriptionLimitMessage] = useState('');
  const composingDescription = useRef(false);
  const [isComposingDescription, setIsComposingDescription] = useState(false);
  const acceptedDescription = useRef(description);
  const descriptionLength = Array.from(description).length;
  const descriptionError = isComposingDescription ? '' : (descriptionLength > 1000 ? '最多输入 1000 字' : descriptionLimitMessage);
  const [validated, setValidated] = useState(false);
  const [limitMessage, setLimitMessage] = useState('');
  const composing = useRef(false);
  const [isComposing, setIsComposing] = useState(false);
  const acceptedName = useRef('');
  const nameLength = Array.from(name).length;
  const nameError = isComposing ? '' : (validated && !name.trim() ? '请输入 Agent 名称' : nameLength > 20 ? '最多输入 20 字' : limitMessage);
  const typeError = validated && !type ? '请选择 Agent 类型' : '';
  const invalidClass = '!border-red-500 focus:!border-red-500 focus:!ring-red-100';

  const updateName = (input: HTMLInputElement) => {
    let value = input.value;
    const overflow = Array.from(value).length - 20;
    if (overflow > 0) {
      const caret = input.selectionStart ?? value.length;
      const beforeCaret = Array.from(value.slice(0, caret));
      const prefix = beforeCaret.slice(0, Math.max(0, beforeCaret.length - overflow)).join('');
      value = prefix + value.slice(caret);
      input.value = value;
      input.setSelectionRange(prefix.length, prefix.length);
      setLimitMessage('最多输入 20 字');
    } else if (value !== acceptedName.current) setLimitMessage('');
    acceptedName.current = value;
    setName(value);
  };

  const updateDescription = (input: HTMLTextAreaElement) => {
    let value = input.value;
    const overflow = Array.from(value).length - 1000;
    if (overflow > 0) {
      const caret = input.selectionStart ?? value.length;
      const beforeCaret = Array.from(value.slice(0, caret));
      const prefix = beforeCaret.slice(0, Math.max(0, beforeCaret.length - overflow)).join('');
      value = prefix + value.slice(caret);
      input.value = value;
      input.setSelectionRange(prefix.length, prefix.length);
      setDescriptionLimitMessage('最多输入 1000 字');
    } else if (value !== acceptedDescription.current) setDescriptionLimitMessage('');
    acceptedDescription.current = value;
    setDescription(value);
  };

  useEffect(() => {
    if (!open) return;
    setActiveTab('基础信息');
    setDatasetIds([]);
    setName('');
    setType('');
    setDescription('');
    acceptedDescription.current = '';
    setDescriptionLimitMessage('');
    composingDescription.current = false;
    setIsComposingDescription(false);
    setExampleQuestions(['']);
    setQuestionHints(['']);
    composingQuestions.current = [false];
    acceptedQuestions.current = [''];
    setValidated(false);
    setLimitMessage('');
    composing.current = false;
    setIsComposing(false);
    acceptedName.current = '';
  }, [open]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (composing.current || composingDescription.current || composingQuestions.current.some(Boolean)) return;
    setValidated(true);
    const trimmedName = name.trim();
    if (!trimmedName || nameLength > 20 || !type) {
      const id = !trimmedName || nameLength > 20 ? 'create-agent-name' : 'create-agent-type';
      setActiveTab('基础信息');
      const input = event.currentTarget.querySelector<HTMLElement>(`#${id}`);
      requestAnimationFrame(() => input?.focus());
      return;
    }
    if (descriptionLength > 1000) {
      setActiveTab('基础信息');
      const input = event.currentTarget.querySelector<HTMLElement>('#create-agent-description');
      requestAnimationFrame(() => input?.focus());
      return;
    }

    onSave({
      name: trimmedName,
      type,
      description: description.trim(),
      exampleQuestions: exampleQuestions.map((question) => question.trim()).filter(Boolean),
      datasetIds,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        showCloseButton={false}
        className="h-[610px] max-h-[calc(100vh-32px)] w-[820px] max-w-[calc(100vw-32px)] gap-0 overflow-hidden rounded-[20px] border-0 bg-white p-0 font-['PingFang_SC','Microsoft_YaHei',sans-serif] shadow-[0_20px_60px_rgba(0,0,0,0.18)] sm:max-w-[820px]"
      >
        <form noValidate onSubmit={submit} className="flex h-full min-h-0 flex-col">
          <div className="flex min-h-0 flex-1">
            <aside className="flex h-full w-60 shrink-0 flex-col items-start gap-4 bg-[#f7f8fa] px-3 py-6">
              <DialogTitle className="h-7 w-full shrink-0 pl-3 font-['Login_Figma_Sans','PingFang_SC','Microsoft_YaHei',sans-serif] text-xl font-medium leading-7 text-[#1d2129]">
                新建 Agent
              </DialogTitle>
              <nav className="flex min-h-0 w-full flex-1 flex-col overflow-hidden" aria-label="Agent 配置步骤">
                {navigationItems.map(({ label, icon: Icon }) => (
                  <button
                    key={label}
                    type="button"
                    disabled={label !== '基础信息' && label !== '数据集配置'}
                    onClick={() => setActiveTab(label)}
                    aria-current={activeTab === label ? 'step' : undefined}
                    className={`flex h-11 w-full shrink-0 items-center gap-2 rounded-[10px] p-3 text-left text-sm leading-[22px] tracking-[0.15px] text-[#1d2129] disabled:cursor-default disabled:opacity-100 ${
                      activeTab === label ? 'bg-[#edeff1] font-[500]' : 'bg-transparent font-normal'
                    }`}
                  >
                    <Icon aria-hidden="true" className="size-5 shrink-0 stroke-[1.6]" />
                    <span>{label}</span>
                  </button>
                ))}
              </nav>
            </aside>

            <section className="min-w-0 flex-1 overflow-y-auto bg-white px-6 py-4">
              <div className="flex h-7 items-center justify-end">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  aria-label="关闭"
                  title="关闭"
                  className="flex size-4 items-center justify-center"
                >
                  <img src={closeLargeFillIcon} alt="" className="size-4 shrink-0" />
                </button>
              </div>

              {activeTab === '数据集配置' && <AgentDatasetConfig datasets={datasets} selectedIds={datasetIds} onChange={setDatasetIds} />}
              <div className={activeTab === '基础信息' ? 'mt-4 flex flex-col gap-4' : 'hidden'}>
                <div className="flex flex-col gap-2 text-sm leading-[22px] text-[#4e5969]">
                  <label htmlFor="create-agent-name">Agent 名称<span className="ml-1 text-red-500">*</span></label>
                  <span className="relative block">
                    <input
                      autoFocus
                      required
                      id="create-agent-name"
                      value={name}
                      onChange={(event) => {
                        if (composing.current) setName(event.target.value);
                        else updateName(event.currentTarget);
                      }}
                      onPaste={(event) => {
                        if (composing.current) return;
                        event.preventDefault();
                        const input = event.currentTarget;
                        const start = input.selectionStart ?? input.value.length;
                        input.setRangeText(event.clipboardData.getData('text').replace(/[\r\n]/g, ''), start, input.selectionEnd ?? start, 'end');
                        updateName(input);
                      }}
                      onCompositionStart={() => { composing.current = true; setIsComposing(true); setLimitMessage(''); }}
                      onCompositionEnd={(event) => { composing.current = false; setIsComposing(false); updateName(event.currentTarget); }}
                      aria-invalid={Boolean(nameError)}
                      aria-describedby={`create-agent-name-count${nameError ? ' create-agent-name-error' : ''}`}
                      placeholder="请输入名称"
                      className={`${fieldClass} pr-14 ${nameError ? invalidClass : ''}`}
                    />
                    <span id="create-agent-name-count" className={`pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs leading-[22px] ${nameError ? 'text-red-600' : 'text-[#86909c]'}`}>
                      {nameLength}/20
                    </span>
                  </span>
                  {nameError && <p id="create-agent-name-error" aria-live="polite" className="-mt-1 text-xs leading-4 text-red-600">{nameError}</p>}
                </div>

                <div className="flex flex-col gap-2 text-sm leading-[22px] text-[#4e5969]">
                  <label htmlFor="create-agent-type">Agent 类型<span className="ml-1 text-red-500">*</span></label>
                  <Select required value={type} onValueChange={(value) => setType(value as AgentType)}>
                    <SelectTrigger id="create-agent-type" aria-invalid={Boolean(typeError)} aria-describedby={typeError ? 'create-agent-type-error' : undefined} className={`${fieldClass} data-[size=default]:h-10 data-[placeholder]:text-[#86909c] ${typeError ? invalidClass : ''}`}>
                      <SelectValue placeholder="请选择类型" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-[#e5e6eb] bg-white text-[#1d2129]">
                      {agentTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="rounded-lg">{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {typeError && <p id="create-agent-type-error" aria-live="polite" className="-mt-1 text-xs leading-4 text-red-600">{typeError}</p>}
                </div>

                <div className="flex flex-col gap-2 text-sm leading-[22px] text-[#4e5969]">
                  <label htmlFor="create-agent-description">适用场景</label>
                  <div className="relative">
                    <textarea
                      id="create-agent-description"
                      rows={4}
                      value={description}
                      placeholder="请输入 Agent 的适用场景"
                      onChange={(event) => {
                        if (composingDescription.current) setDescription(event.target.value);
                        else updateDescription(event.currentTarget);
                      }}
                      onPaste={(event) => {
                        if (composingDescription.current) return;
                        event.preventDefault();
                        const input = event.currentTarget;
                        const start = input.selectionStart ?? input.value.length;
                        input.setRangeText(event.clipboardData.getData('text').replace(/\r\n?/g, '\n'), start, input.selectionEnd ?? start, 'end');
                        updateDescription(input);
                      }}
                      onCompositionStart={() => { composingDescription.current = true; setIsComposingDescription(true); setDescriptionLimitMessage(''); }}
                      onCompositionEnd={(event) => { composingDescription.current = false; setIsComposingDescription(false); updateDescription(event.currentTarget); }}
                      aria-invalid={Boolean(descriptionError)}
                      aria-describedby={`create-agent-description-count${descriptionError ? ' create-agent-description-error' : ''}`}
                      className={`${fieldClass} block !h-32 min-h-32 resize-y pt-2 pb-7 ${descriptionError ? invalidClass : ''}`}
                    />
                    <span id="create-agent-description-count" className={`pointer-events-none absolute bottom-2 right-4 bg-white px-1 text-xs tabular-nums ${descriptionError ? 'text-red-600' : 'text-[#86909c]'}`}>{descriptionLength}/1000</span>
                  </div>
                  {descriptionError && <p id="create-agent-description-error" aria-live="polite" className="-mt-1 text-xs leading-4 text-red-600">{descriptionError}</p>}
                </div>

                <div className="flex flex-col gap-2 text-sm leading-[22px] text-[#4e5969]">
                  <div className="flex items-center justify-between">
                    <span>示例问题</span>
                    <button
                      type="button"
                      onClick={() => {
                        setExampleQuestions((current) => [...current, '']);
                        setQuestionHints((current) => [...current, '']);
                        acceptedQuestions.current.push('');
                        composingQuestions.current.push(false);
                      }}
                      disabled={exampleQuestions.length >= 5}
                      className="text-[14px] font-normal leading-[22px] text-[#165dff] disabled:cursor-not-allowed disabled:text-[#86909c]"
                    >
                      新增示例问题
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {exampleQuestions.map((question, index) => (
                      <div key={index} className="space-y-1">
                        <div className="flex items-center gap-2">
                        <span className="relative min-w-0 flex-1">
                          <input
                            value={question}
                            onChange={(event) => {
                              if (composingQuestions.current[index]) {
                                const value = event.target.value;
                                setExampleQuestions((current) => current.map((item, i) => i === index ? value : item));
                              } else updateQuestion(event.currentTarget, index);
                            }}
                            onPaste={(event) => {
                              if (composingQuestions.current[index]) return;
                              event.preventDefault();
                              const input = event.currentTarget;
                              const start = input.selectionStart ?? input.value.length;
                              input.setRangeText(event.clipboardData.getData('text').replace(/[\r\n]/g, ''), start, input.selectionEnd ?? start, 'end');
                              updateQuestion(input, index);
                            }}
                            onCompositionStart={() => {
                              composingQuestions.current[index] = true;
                              setQuestionHints((current) => current.map((hint, i) => i === index ? '' : hint));
                            }}
                            onCompositionEnd={(event) => { composingQuestions.current[index] = false; updateQuestion(event.currentTarget, index); }}
                            placeholder="请输入"
                            aria-label={`示例问题 ${index + 1}`}
                            aria-invalid={Boolean(questionHints[index])}
                            aria-describedby={questionHints[index] ? `agent-question-${index}-error` : undefined}
                            className={`${fieldClass} pr-14 ${questionHints[index] ? invalidClass : ''}`}
                          />
                          <span className={`pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs leading-[22px] ${questionHints[index] ? 'text-red-600' : 'text-[#86909c]'}`}>
                            {Array.from(question).length}/20
                          </span>
                        </span>
                        <span title={exampleQuestions.length === 1 ? '至少保留一个输入框' : '删除'} className={`shrink-0 ${exampleQuestions.length === 1 ? 'cursor-not-allowed' : ''}`}>
                        <button
                          type="button"
                          disabled={exampleQuestions.length === 1}
                          onClick={() => {
                            if (exampleQuestions.length <= 1) return;
                            setQuestionHints((current) => current.filter((_, i) => i !== index));
                            acceptedQuestions.current = acceptedQuestions.current.filter((_, i) => i !== index);
                            composingQuestions.current = composingQuestions.current.filter((_, i) => i !== index);
                            setExampleQuestions((current) =>
                              current.filter((_, itemIndex) => itemIndex !== index),
                            );
                          }}
                          aria-label={`删除示例问题 ${index + 1}`}
                          className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#e5e6eb] text-[#4e5969] transition-colors enabled:hover:bg-[#f7f8fa] disabled:pointer-events-none disabled:bg-[#f7f8fa] disabled:text-[#c9cdd4]"
                        >
                          <Trash2 aria-hidden="true" className="size-4 stroke-[1.5]" />
                        </button>
                        </span>
                        </div>
                        {questionHints[index] && <p id={`agent-question-${index}-error`} aria-live="polite" className="text-xs leading-4 text-red-600">{questionHints[index]}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>

          <footer className="flex h-16 shrink-0 items-center justify-end gap-4 border-t border-[#e5e6eb] bg-[#f7f8fa] px-6 py-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-10 rounded-xl border border-[#e5e6eb] bg-transparent px-6 text-sm leading-[22px] text-[rgba(0,0,0,0.9)] transition-colors hover:bg-[#edeff1]"
            >
              取消
            </button>
            <button
              type="submit"
              className="h-10 rounded-xl border border-[#1d2129] bg-[#1d2129] px-6 text-sm leading-[22px] tracking-[0.15px] text-white transition-colors hover:bg-[#272e3b]"
            >
              保存
            </button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}

