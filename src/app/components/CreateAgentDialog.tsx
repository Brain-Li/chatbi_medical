import { useEffect, useState } from 'react';
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
import type { AgentType } from '../types';
import closeLargeFillIcon from '../../assets/figma-agent-management/close-large-fill.svg';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';

type AgentFormValue = {
  name: string;
  type: AgentType;
  description: string;
  exampleQuestions: string[];
};

type CreateAgentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (value: AgentFormValue) => void;
};

const agentTypeOptions: Array<{ value: AgentType; label: string; description: string }> = [
  { value: 'ask', label: '问数 Agent', description: '面向经营分析的语义问答 Agent。' },
  { value: 'report', label: '报告 Agent', description: '面向日报、周报、月报和专题分析的报告 Agent。' },
  { value: 'rca', label: '深度分析 Agent', description: '面向指标波动和经营诊断的深度分析 Agent。' },
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
  onOpenChange,
  onSave,
}: CreateAgentDialogProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AgentType | ''>('');
  const [description, setDescription] = useState(agentTypeOptions[0].description);
  const [exampleQuestions, setExampleQuestions] = useState(['']);

  useEffect(() => {
    if (!open) return;
    setName('');
    setType('');
    setDescription(agentTypeOptions[0].description);
    setExampleQuestions(['']);
  }, [open]);

  const handleTypeChange = (nextType: AgentType) => {
    const previousDefault = agentTypeOptions.find((option) => option.value === type)?.description;
    const nextDefault = agentTypeOptions.find((option) => option.value === nextType)?.description ?? '';
    setType(nextType);
    if (!description.trim() || description === previousDefault || description === agentTypeOptions[0].description) {
      setDescription(nextDefault);
    }
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || !type) return;

    onSave({
      name: trimmedName,
      type,
      description: description.trim(),
      exampleQuestions: exampleQuestions.map((question) => question.trim()).filter(Boolean),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        showCloseButton={false}
        className="h-[610px] max-h-[calc(100vh-32px)] w-[820px] max-w-[calc(100vw-32px)] gap-0 overflow-hidden rounded-[20px] border-0 bg-white p-0 font-['PingFang_SC','Microsoft_YaHei',sans-serif] shadow-[0_20px_60px_rgba(0,0,0,0.18)] sm:max-w-[820px]"
      >
        <form onSubmit={submit} className="flex h-full min-h-0 flex-col">
          <div className="flex h-[546px] min-h-0 shrink-0">
            <aside className="flex h-full w-60 shrink-0 flex-col items-start gap-4 bg-[#f7f8fa] px-3 py-6">
              <DialogTitle className="h-7 w-full shrink-0 pl-3 font-['Login_Figma_Sans','PingFang_SC','Microsoft_YaHei',sans-serif] text-xl font-medium leading-7 text-[#1d2129]">
                新建 Agent
              </DialogTitle>
              <nav className="flex min-h-0 w-full flex-1 flex-col overflow-hidden" aria-label="Agent 配置步骤">
                {navigationItems.map(({ label, icon: Icon, active }) => (
                  <button
                    key={label}
                    type="button"
                    disabled={!active}
                    aria-current={active ? 'step' : undefined}
                    className={`flex h-11 w-full shrink-0 items-center gap-2 rounded-[10px] p-3 text-left text-sm leading-[22px] tracking-[0.15px] text-[#1d2129] disabled:cursor-default disabled:opacity-100 ${
                      active ? 'bg-[#edeff1] font-[500]' : 'bg-transparent font-normal'
                    }`}
                  >
                    <Icon aria-hidden="true" className="size-5 shrink-0 stroke-[1.6]" />
                    <span>{label}</span>
                  </button>
                ))}
              </nav>
            </aside>

            <section className="min-w-0 flex-1 bg-white px-6 py-4">
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

              <div className="mt-4 flex flex-col gap-4">
                <label className="flex flex-col gap-2 text-sm leading-[22px] text-[#4e5969]">
                  <span>Agent 名称</span>
                  <span className="relative block">
                    <input
                      autoFocus
                      required
                      maxLength={20}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="请输入名称"
                      className={`${fieldClass} pr-14`}
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs leading-[22px] text-[#86909c]">
                      {name.length}/20
                    </span>
                  </span>
                </label>

                <label className="flex flex-col gap-2 text-sm leading-[22px] text-[#4e5969]">
                  <span>Agent 类型</span>
                  <span className="relative block">
                    <select
                      required
                      value={type}
                      onChange={(event) => handleTypeChange(event.target.value as AgentType)}
                      className={`${fieldClass} appearance-none pr-10 ${type ? 'text-[#1d2129]' : 'text-[#86909c]'}`}
                    >
                      <option value="" disabled>请选择类型</option>
                      {agentTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[#86909c]">
                      <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
                        <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.4" />
                      </svg>
                    </span>
                  </span>
                </label>

                <label className="flex flex-col gap-2 text-sm leading-[22px] text-[#4e5969]">
                  <span>适用场景</span>
                  <input
                    maxLength={80}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className={fieldClass}
                  />
                </label>

                <div className="flex flex-col gap-2 text-sm leading-[22px] text-[#4e5969]">
                  <div className="flex items-center justify-between">
                    <span>示例问题</span>
                    <button
                      type="button"
                      onClick={() => setExampleQuestions((current) => [...current, ''])}
                      disabled={exampleQuestions.length >= 5}
                      className="text-[14px] font-normal leading-[22px] text-[#165dff] disabled:cursor-not-allowed disabled:text-[#86909c]"
                    >
                      新增示例问题
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {exampleQuestions.map((question, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="relative min-w-0 flex-1">
                          <input
                            maxLength={20}
                            value={question}
                            onChange={(event) => {
                              const value = event.target.value;
                              setExampleQuestions((current) =>
                                current.map((item, itemIndex) => itemIndex === index ? value : item),
                              );
                            }}
                            placeholder="请输入"
                            aria-label={`示例问题 ${index + 1}`}
                            className={`${fieldClass} pr-14`}
                          />
                          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs leading-[22px] text-[#86909c]">
                            {question.length}/20
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setExampleQuestions((current) =>
                              current.length === 1 ? [''] : current.filter((_, itemIndex) => itemIndex !== index),
                            );
                          }}
                          aria-label={`删除示例问题 ${index + 1}`}
                          title="删除"
                          className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#e5e6eb] text-[#4e5969] transition-colors hover:bg-[#f7f8fa]"
                        >
                          <Trash2 aria-hidden="true" className="size-4 stroke-[1.5]" />
                        </button>
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

