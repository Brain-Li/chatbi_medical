export type RuntimeMode = {
  id: 'planner' | 'executor' | 'react' | 'summary';
  name: string;
  code: string;
  maxSteps: number | null;
  description: string;
  systemPrompt: string;
  nextStepPrompt: string;
};

export type RuntimeModeForm = Omit<RuntimeMode, 'id' | 'maxSteps'> & { maxSteps: string };

export const runtimeModesStorageKey = 'chatbi-medical-runtime-modes-v1';
export const runtimeTextLimits = { name: 20, description: 100, systemPrompt: 5000, nextStepPrompt: 5000 } as const;

export const initialRuntimeModes: RuntimeMode[] = [
  {
    id: 'planner', name: '规划 Agent (Planning)', code: 'planner', maxSteps: 40,
    description: '任务规划引擎：把复杂任务拆解为有序子任务（Plan-Solve 模式使用）。',
    systemPrompt: '# 角色\n你是一个智能助手，名叫 Genie。\n\n# 说明\n你是任务规划助手，根据用户需求，拆解任务列表，从而确定 planning 工具入参。每次执行 planning 工具前，必须先检查当前任务目标、可用信息和执行进度，再制定清晰、可执行的任务计划。\n\n# 要求\n明确各步骤的目标、依赖和预期产出；信息不足时先澄清，不编造数据。',
    nextStepPrompt: '工具 planning 的参数有：\n必填参数：命令 command。\n可选参数：当前步状态 step_status。\n\n根据当前任务进度，判断是创建计划、更新步骤状态还是结束规划。确认每一步有明确目标后，将计划交给执行 Agent。',
  },
  {
    id: 'executor', name: '执行 Agent (Executor)', code: 'executor', maxSteps: 40,
    description: '任务执行引擎：逐步推理并调用工具完成子任务（Plan-Solve 模式使用）。',
    systemPrompt: '# 角色\n你是任务执行助手，负责按照计划完成子任务。\n\n# 说明\n阅读当前计划与已有结果，选择合适的工具完成当前步骤。根据真实工具返回判断结果，不编造执行记录或数据。\n\n# 要求\n记录已完成步骤、关键证据和待解决问题；遇到阻塞时说明原因，必要时请求调整计划。',
    nextStepPrompt: '检查当前步骤的输入与依赖是否齐备，选择下一次工具调用。完成后更新执行状态，并判断是否进入下一步或交由总结 Agent 汇总。',
  },
  {
    id: 'react', name: '单体 Agent (React)', code: 'react', maxSteps: 40,
    description: 'ReAct 引擎：单 Agent 思考-行动循环（普通问答/报告使用）。',
    systemPrompt: '# 角色\n你是智能问数助手，通过分析问题、调用工具和观察结果完成用户任务。\n\n# 说明\n根据问题选择需要的数据和工具，以真实查询结果为依据给出回答。\n\n# 要求\n保持回答清晰，说明统计口径与必要限制；信息不足时主动澄清。',
    nextStepPrompt: '结合用户问题和最新工具结果，判断是否需要继续查询、计算或生成报告。信息充分时输出最终答案，避免重复调用工具。',
  },
  {
    id: 'summary', name: '总结 Agent (Summary)', code: 'summary', maxSteps: null,
    description: '总结引擎：基于执行过程汇总最终答案与交付文件。',
    systemPrompt: '# 角色\n你是结果总结助手，负责整理执行过程中的有效信息与交付文件。\n\n# 要求\n先给出结论，再说明关键数据、证据及限制。只引用已有执行结果，不编造事实；明确标注未完成事项。',
    nextStepPrompt: '整理已完成任务、关键结果和生成的文件，输出结构清晰的最终答复。存在缺失信息或执行失败时，说明影响及建议的下一步。',
  },
];

export function validateRuntimeMode(form: RuntimeModeForm, modes: RuntimeMode[], editingId: RuntimeMode['id']) {
  const errors = { name: '', code: '', maxSteps: '', description: '', systemPrompt: '', nextStepPrompt: '' };
  if (!form.name.trim()) errors.name = '请输入引擎名称';
  if (!form.code.trim()) errors.code = '请输入编码';
  else if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(form.code.trim())) errors.code = '以字母开头，仅支持字母、数字和下划线';
  else if (modes.some((mode) => mode.id !== editingId && mode.code.toLowerCase() === form.code.trim().toLowerCase())) errors.code = '该编码已存在，请更换';
  const steps = form.maxSteps.trim();
  if (!steps) errors.maxSteps = '请输入最大步数';
  else if (!/^[1-9]\d*$/.test(steps) || !Number.isSafeInteger(Number(steps)) || Number(steps) > 100) {
    errors.maxSteps = '请输入 1–100 的整数';
  }
  if (!form.systemPrompt.trim()) errors.systemPrompt = '请输入 system_prompt';
  if (!form.nextStepPrompt.trim()) errors.nextStepPrompt = '请输入 next_step_prompt';
  for (const field of Object.keys(runtimeTextLimits) as (keyof typeof runtimeTextLimits)[]) {
    if (Array.from(form[field]).length > runtimeTextLimits[field]) errors[field] = `最多输入 ${runtimeTextLimits[field]} 字`;
  }
  return errors;
}

export function buildRuntimePrompt(form: Pick<RuntimeModeForm, 'systemPrompt' | 'nextStepPrompt'>) {
  return [form.systemPrompt.trim(), form.nextStepPrompt.trim()].filter(Boolean).join('\n\n');
}

export function readRuntimeModes(): RuntimeMode[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(runtimeModesStorageKey) ?? 'null');
    if (!Array.isArray(stored)) return initialRuntimeModes;
    // Keep the four built-in engine identities even when browser storage is incomplete.
    return initialRuntimeModes.map((fallback) => {
      const saved = stored.find((mode) => mode?.id === fallback.id);
      if (!saved || !['name', 'code', 'description', 'systemPrompt', 'nextStepPrompt'].every((key) => typeof saved[key] === 'string')) return fallback;
      if (saved.maxSteps !== null && (!Number.isSafeInteger(saved.maxSteps) || saved.maxSteps < 1)) return fallback;
      // Preserve older configurations with missing required fields for correction in the editor.
      if (!saved.name.trim() || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(saved.code.trim())) return fallback;
      return { ...fallback, name: saved.name, code: saved.code, maxSteps: saved.maxSteps, description: saved.description, systemPrompt: saved.systemPrompt, nextStepPrompt: saved.nextStepPrompt };
    });
  } catch {
    return initialRuntimeModes;
  }
}
