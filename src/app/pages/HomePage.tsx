import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useOutletContext } from 'react-router';
import { ArrowUp, Eye, EyeOff } from 'lucide-react';
import { HomePrefillPayload, WorkspaceAutoSubmitPayload } from '../types';

import checkboxChecked from '../../assets/figma-login/checkbox-checked.svg';
import closeLargeFill from '../../assets/figma-login/close-large-fill.svg';
import loginIllustration from '../../assets/figma-login/login-illustration.png';
import arrowRightUpLine from '../../assets/figma-home/arrow-right-up-line.svg';
import assistantImage from '../../assets/figma-home/assistant.png';
import caseArrowRightUp from '../../assets/figma-home/case-arrow-right-up.svg';
import caseMonthlyImage from '../../assets/figma-home/case-monthly.png';
import caseBydImage from '../../assets/figma-home/case-byd.png';
import caseGridImage from '../../assets/figma-home/case-grid.png';
import globalLine from '../../assets/figma-home/global-line.svg';
import globalLineSelected from '../../assets/figma-home/global-line-selected.svg';
import micLine from '../../assets/figma-home/mic-line.svg';
import { HistorySidebarToggle } from '../components/HistorySidebarToggle';
import { PromptModeBar, type PromptModeBarSelection } from '../components/PromptModeBar';
import { PromptComposerFrame } from '../components/PromptComposerFrame';
import { useWorkspace } from '../context/WorkspaceContext';
import { inferPromptMode, type PromptMode } from '../utils/promptMode';
import { ReportTemplateSelector } from '../components/ReportTemplateSelector';

type HomeMode = PromptMode;
type HomeInputMode = PromptModeBarSelection;
type AppShellOutletContext = {
  sidebarOpen?: boolean;
  openSidebar?: () => void;
};
type HomeLocationState = {
  prefill?: HomePrefillPayload;
  deleteConversationId?: string;
  deleteConversationWorkspace?: 'ask' | 'report';
  resetConversationWorkspace?: 'ask' | 'report';
};
type LoginErrors = {
  account?: string;
  password?: string;
  general?: string;
};
type HomeSuggestion = {
  mode: HomeMode;
  title: string;
  deepAnalysisEnabled?: boolean;
};
type ReportCase = {
  title: string;
  description: string;
  previewId: string;
  image: string;
};

const askSuggestions: HomeSuggestion[] = [
  { mode: 'ask', title: '本周门急诊收入环比变化如何？' },
  { mode: 'ask', title: '今年以来门诊检查收入变化趋势如何？' },
  { mode: 'ask', title: '眼科近三个月门诊量是否异常？' },
];
const smartSuggestions: HomeSuggestion[] = [
  { mode: 'ask', title: '上月门诊总收入和药占比情况' },
  { mode: 'ask', title: '眼科近三个月门诊量是否异常？', deepAnalysisEnabled: true },
  { mode: 'ask', title: '上月门诊总收入和药占比情况' },
];
const qaSuggestions: HomeSuggestion[] = [
  { mode: 'ask', title: '什么是药占比，如何合理控制？' },
  { mode: 'ask', title: '门诊次均费用的计算口径是什么？' },
  { mode: 'ask', title: '医院运营分析通常关注哪些核心指标？' },
];
const reportSuggestions: HomeSuggestion[] = [
  { mode: 'report', title: '生成昨日门诊经营日报' },
  { mode: 'report', title: '生成本周门急诊运营周报' },
  { mode: 'report', title: '生成上月医院经营分析报告' },
];
const reportCases: ReportCase[] = [
  {
    title: '门诊经营日报',
    description: '汇总昨日门诊量、收入、药占比和重点科室表现，快速定位需要关注的异常项。',
    previewId: 'outpatient-daily',
    image: caseMonthlyImage,
  },
  {
    title: '门急诊运营周报',
    description: '按周复盘门急诊流量、收入趋势和资源使用情况，沉淀管理层可读的经营结论。',
    previewId: 'emergency-weekly',
    image: caseBydImage,
  },
  {
    title: '月度经营分析',
    description: '面向经营例会输出月度指标、同比环比、结构拆解和管理建议。',
    previewId: 'operation-monthly',
    image: caseGridImage,
  },
];

function FeaturedCases({ className = '' }: { className?: string }) {
  return (
    <section className={`flex flex-col gap-4 ${className}`}>
      <div className="flex items-center gap-2">
        <span className="h-[13px] w-[3px] shrink-0 rounded-xl bg-[#165dff]" />
        <h2 className="text-[20px] font-medium leading-7 text-[#1d2129]">案例精选</h2>
      </div>
      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-3">
        {reportCases.map((reportCase, index) => (
          <Link
            key={reportCase.title}
            to={`/report/case/${reportCase.previewId}`}
            className={`group flex min-w-0 flex-col gap-3 rounded-[12px] border border-[#e5e6eb] bg-white p-4 text-left transition-colors hover:bg-[#f7f8fa] [@media(max-height:840px)]:gap-2 [@media(max-height:840px)]:p-3 ${index === 0 ? 'shadow-[0_10px_18px_rgba(29,33,41,0.1)]' : ''}`}
          >
            <img
              className="h-[126px] w-full rounded-[8px] object-cover [@media(max-height:840px)]:h-[104px]"
              src={reportCase.image}
              alt=""
            />
            <div className="flex min-w-0 items-center justify-between gap-2">
              <span className="truncate text-[16px] font-medium leading-6 text-[#1d2129]">
                {reportCase.title}
              </span>
              <img
                className="h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                src={caseArrowRightUp}
                alt=""
              />
            </div>
            <p className="line-clamp-2 text-[14px] leading-[22px] text-[#4e5969]">
              {reportCase.description}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

const homeVerticalOffsetStyle = {
  '--home-vertical-offset': '12px',
} as CSSProperties;
const homeHistoryOpenVerticalOffsetStyle = {
  ...homeVerticalOffsetStyle,
  '--home-vertical-offset': '36px',
} as CSSProperties;

export default function HomePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    sidebarOpen = false,
    openSidebar,
  } = useOutletContext<AppShellOutletContext>();
  const {
    createConversation,
    deleteConversation,
    reportTemplates,
    setActiveConversationForWorkspace,
    updateConversation,
  } = useWorkspace();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectedMode, setSelectedMode] = useState<HomeInputMode>('smart');
  const [selectedReportTemplateId, setSelectedReportTemplateId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [deepAnalysisEnabled, setDeepAnalysisEnabled] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loginAccount, setLoginAccount] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginErrors, setLoginErrors] = useState<LoginErrors>({});
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const hasAccountError = Boolean(loginErrors.account || loginErrors.general);
  const hasPasswordError = Boolean(loginErrors.password || loginErrors.general);
  const canSubmit = Boolean(draft.trim());
  const visibleSuggestions =
    selectedMode === 'smart'
      ? smartSuggestions
      : selectedMode === 'qa'
        ? qaSuggestions
        : selectedMode === 'report'
          ? reportSuggestions
          : askSuggestions;
  const inputPlaceholder =
    selectedMode === 'smart'
      ? '输入问题或需求，智能分析、解答或生成报告...'
      : selectedMode === 'qa'
      ? '咨询专业知识、业务相关问题...'
      : selectedMode === 'ask'
      ? '查询指标、走势、异常等各类数据问题...'
      : '描述报告主题、统计周期、分析重点...';

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = '104px';
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 132)}px`;
  }, [draft]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('login') === '1') {
      setLoginOpen(true);
    }
  }, []);

  useLayoutEffect(() => {
    const state = location.state as HomeLocationState | null;
    if (!state?.deleteConversationId) return;

    setActiveConversationForWorkspace(state.deleteConversationWorkspace ?? 'ask', null);
    deleteConversation(state.deleteConversationId);

    const {
      deleteConversationId: _consumedDeleteId,
      deleteConversationWorkspace: _consumedDeleteWorkspace,
      ...remainingState
    } = state;
    navigate('.', {
      replace: true,
      state: Object.keys(remainingState).length ? remainingState : null,
    });
  }, [location.state, navigate]);

  useLayoutEffect(() => {
    const state = location.state as HomeLocationState | null;
    if (!state?.resetConversationWorkspace) return;

    setActiveConversationForWorkspace(state.resetConversationWorkspace, null);
    setDraft('');
    setSelectedMode('smart');
    setSelectedReportTemplateId(null);
    setDeepAnalysisEnabled(false);

    const { resetConversationWorkspace: _consumedResetWorkspace, ...remainingState } = state;
    navigate('.', {
      replace: true,
      state: Object.keys(remainingState).length ? remainingState : null,
    });
  }, [location.state, navigate]);

  useEffect(() => {
    const state = location.state as HomeLocationState | null;
    if (!state?.prefill) return;

    setDraft(state.prefill.draft);
    setSelectedMode(state.prefill.mode);
    setDeepAnalysisEnabled(false);
    if (state.prefill.mode === 'report') {
      setSelectedReportTemplateId(state.prefill.templateId ?? null);
    }
    window.setTimeout(() => textareaRef.current?.focus(), 0);

    const { prefill: _consumedPrefill, ...remainingState } = state;
    navigate('.', {
      replace: true,
      state: Object.keys(remainingState).length ? remainingState : null,
    });
  }, [location.state, navigate]);

  const selectMode = (nextMode: HomeInputMode) => {
    if (selectedMode === nextMode) {
      window.setTimeout(() => textareaRef.current?.focus(), 0);
      return;
    }

    setSelectedMode(nextMode);
    if (nextMode !== 'ask') setDeepAnalysisEnabled(false);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const submit = (
    submittedQuestion = draft,
    options?: { mode?: HomeMode; deepAnalysisEnabled?: boolean },
  ) => {
    const question = submittedQuestion.trim();
    if (!question) return;
    const resolvedMode =
      options?.mode ??
      (selectedMode === 'smart'
        ? inferPromptMode(question, null)
        : selectedMode === 'qa'
          ? 'ask'
          : selectedMode);
    const shouldUseDeepAnalysis =
      resolvedMode === 'ask'
        ? options?.deepAnalysisEnabled ?? deepAnalysisEnabled
        : undefined;
    const conversationTitle = question.length > 18 ? `${question.slice(0, 18)}...` : question;
    const conversation = createConversation(resolvedMode, conversationTitle);

    if (resolvedMode === 'ask') {
      updateConversation(conversation.id, {
        deepAnalysisEnabled: Boolean(shouldUseDeepAnalysis),
      });
    }

    const autoSubmit: WorkspaceAutoSubmitPayload = {
      mode: resolvedMode,
      question,
      conversationId: conversation.id,
      nonce: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      deepAnalysisEnabled: shouldUseDeepAnalysis,
      reportTemplateId: resolvedMode === 'report' ? selectedReportTemplateId ?? undefined : undefined,
      forceNewConversation: false,
    };

    navigate(resolvedMode === 'ask' ? '/ask' : '/report', {
      state: {
        autoSubmit,
      },
    });
  };

  const handleSuggestionClick = (suggestion: HomeSuggestion) => {
    submit(suggestion.title, {
      mode: suggestion.mode,
      deepAnalysisEnabled: suggestion.deepAnalysisEnabled,
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const handleLoginSubmit = () => {
    if (loginSubmitting) return;

    if (!loginAccount.trim()) {
      setLoginErrors({ account: '请输入账号' });
      return;
    }

    if (!loginPassword.trim()) {
      setLoginErrors({ password: '请输入密码' });
      return;
    }

    setLoginErrors({});
    setLoginSubmitting(true);

    window.setTimeout(() => {
      setLoginSubmitting(false);
      setLoginErrors({ general: '账号或密码错误，请重新输入' });
    }, 500);
  };

  return (
    <div className="relative h-[calc(100%+34px)] min-h-0 overflow-hidden rounded-[inherit] bg-gradient-to-b from-[rgba(229,230,235,0.2)] via-[rgba(229,235,245,0.1)] to-white font-['Login_Figma_Sans','PingFang_SC','Microsoft_YaHei',sans-serif] text-[#1d2129]">
      <div
        className="relative h-full overflow-hidden rounded-[inherit]"
        style={sidebarOpen ? homeHistoryOpenVerticalOffsetStyle : homeVerticalOffsetStyle}
      >
              {!sidebarOpen && openSidebar && (
                <HistorySidebarToggle
                  expanded={false}
                  onClick={openSidebar}
                  className="absolute left-4 top-6 z-20"
                />
              )}
              <section
                className="relative mx-auto flex w-full max-w-[1208px] flex-col px-4 lg:px-6"
                style={{ paddingTop: 'calc(60px + var(--home-vertical-offset))' }}
              >
                <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5">
                  <div className="flex w-full items-center gap-3">
                    <div className="relative h-[104px] w-[104px] shrink-0">
                      <img
                        className="absolute left-0 top-[7px] h-[90px] w-[104px] object-cover"
                        src={assistantImage}
                        alt=""
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[16px] leading-6 text-[#4e5969]">
                        Hi，我是您的专属智能助手
                      </p>
                      <h1 className="mt-2 w-full text-[20px] font-normal leading-7 text-[#1d2129]">
                        <span>擅长</span>
                        <span className="font-medium">数据分析</span>
                        <span className="text-[#4e5969]">与</span>
                        <span className="font-medium">报告生成，</span>
                        <span>助你高效洞察数据价值</span>
                      </h1>
                    </div>
                  </div>

                  <div
                    className={`relative w-full ${
                      selectedMode === 'report' ? 'z-30' : 'z-0'
                    }`}
                  >
                    <PromptComposerFrame
                      className="w-full"
                      bodyClassName="items-end justify-end !py-3 !pl-4 !pr-3"
                      overflowVisible={selectedMode === 'report'}
                    >
                    <div className="flex min-h-[160px] w-full flex-col justify-between gap-4">
                      <div className="flex min-h-[104px] w-full items-start gap-2">
                        <textarea
                          ref={textareaRef}
                          value={draft}
                          onChange={(event) => setDraft(event.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder={inputPlaceholder}
                          rows={4}
                          className="h-[104px] max-h-[132px] min-h-[104px] min-w-0 flex-1 resize-none bg-white pt-[3px] text-[14px] leading-[22px] text-[#1d2129] placeholder:text-[#86909c] focus:outline-none"
                        />
                      </div>
                      <div className="flex min-h-10 flex-wrap items-center gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <PromptModeBar
                            onSelect={selectMode}
                            onQaSelect={() => selectMode('qa')}
                            selectedMode={selectedMode}
                            showQa
                          />
                          {(selectedMode === 'ask' || selectedMode === 'qa') && (
                            <button
                              type="button"
                              onClick={() => setDeepAnalysisEnabled((current) => !current)}
                              className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-[20px] border px-[13px] text-[14px] font-normal leading-[22px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/25 ${
                                deepAnalysisEnabled
                                  ? 'border-[#94bfff] bg-[#e8f3ff] text-[#165dff]'
                                  : 'border-[#e5e6eb] bg-[#f2f3f5] text-[#1d2129] hover:bg-[#e8eaed]'
                              }`}
                              aria-pressed={deepAnalysisEnabled}
                            >
                              <img
                                className="h-4 w-4"
                                src={deepAnalysisEnabled ? globalLineSelected : globalLine}
                                alt=""
                              />
                              深度分析
                            </button>
                          )}
                          {selectedMode === 'report' && (
                            <ReportTemplateSelector
                              templates={reportTemplates}
                              selectedId={selectedReportTemplateId}
                              onSelect={(template) => setSelectedReportTemplateId(template.id)}
                              onClear={() => setSelectedReportTemplateId(null)}
                            />
                          )}
                        </div>
                        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-4">
                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[#f2f3f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/25"
                            title="语音输入"
                            aria-label="语音输入"
                          >
                            <img className="h-6 w-6" src={micLine} alt="" />
                          </button>
                          <button
                            type="button"
                            onClick={() => submit()}
                            disabled={!canSubmit}
                            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#165dff]/30 focus-visible:ring-offset-2 ${
                              canSubmit ? 'bg-[#1677ff] hover:bg-[#0e6ee8]' : 'bg-[#94bfff]'
                            }`}
                            title={
                              selectedMode === 'report'
                                ? '生成报告'
                                : selectedMode === 'smart'
                                  ? '智能识别并发送'
                                  : '发送问题'
                            }
                          >
                            <ArrowUp className="h-4 w-4 text-white" />
                          </button>
                        </div>
                      </div>
                    </div>
                    </PromptComposerFrame>
                  </div>

                </div>

                <div
                  className="mx-auto mt-[50px] w-full max-w-[960px]"
                >
                  <div className="flex flex-col gap-12">
                    <div className="-mt-8 flex w-full flex-wrap items-start gap-4">
                      {visibleSuggestions.map((suggestion, index) => (
                        <button
                          key={`${suggestion.title}-${index}`}
                          type="button"
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="group inline-flex h-[38px] min-w-0 items-center justify-between gap-2 rounded-[20px] border border-[#e5e6eb] bg-[#f7f8fa] px-4 py-[7px] text-left text-[14px] font-normal leading-[22px] text-[#1d2129] transition-colors hover:border-[#bcd4ff] hover:bg-white"
                        >
                          <span className="whitespace-nowrap">{suggestion.title}</span>
                          <img
                            aria-hidden="true"
                            className="h-4 w-4 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 group-active:opacity-100"
                            src={arrowRightUpLine}
                            alt=""
                          />
                        </button>
                      ))}
                    </div>
                    <FeaturedCases className="-mt-4" />
                  </div>
                </div>
              </section>
      </div>

        {loginOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1e1f27]/45">
            <div className="flex h-[414px] w-[792px] origin-center overflow-hidden rounded-[20px] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
              <div className="relative h-full w-[414px] shrink-0 overflow-hidden bg-[#e7f0ff]">
                <img
                  className="absolute left-[23px] top-[23px] h-[368px] w-[368px] object-cover"
                  src={loginIllustration}
                  alt=""
                />
              </div>

              <div className="flex min-w-0 flex-1 flex-col overflow-hidden px-6 pb-10 pt-4 shadow-[-2px_0_11px_rgba(0,0,0,0.01)]">
                <div className="flex h-7 shrink-0 items-center justify-between">
                  <p className="text-[20px] font-medium leading-7 text-[#1a1c26] opacity-0">欢迎登录智能问数</p>
                  <button
                    type="button"
                    onClick={() => setLoginOpen(false)}
                    className="flex h-5 w-5 items-center justify-center"
                    aria-label="关闭登录弹窗"
                    title="关闭"
                  >
                    <img className="h-4 w-4" src={closeLargeFill} alt="" />
                  </button>
                </div>

                <div className="flex h-[314px] w-full shrink-0 flex-col justify-start px-6 pt-6">
                  <h2 className="text-[20px] font-medium leading-7 text-[#1a1c26]">登录解锁高效体验</h2>

                  <div className="mt-6 flex flex-col gap-4">
                    <div className="flex flex-col gap-3">
                      <label className="flex flex-col gap-1.5 text-[14px] leading-[22px] tracking-[0.15px] text-[#51525a]">
                        账号
                        <input
                          value={loginAccount}
                          onChange={(event) => {
                            setLoginAccount(event.target.value);
                            if (loginErrors.account || loginErrors.general) {
                              setLoginErrors((current) => ({ ...current, account: undefined, general: undefined }));
                            }
                          }}
                          aria-invalid={hasAccountError}
                          aria-describedby={loginErrors.account ? 'login-account-error' : undefined}
                          className={`h-[42px] w-full rounded-xl border bg-white px-3 py-2 text-[14px] leading-6 tracking-[0.15px] text-[#1a1c26] outline-none placeholder:text-[#a8a9ad] ${
                            hasAccountError ? 'border-[#ff4d4f] focus:border-[#ff4d4f]' : 'border-[#e9e9ea] focus:border-[#1677ff]'
                          }`}
                          placeholder="请输入账号"
                        />
                        {loginErrors.account && (
                          <span id="login-account-error" className="text-[12px] leading-[18px] text-[#ff4d4f]">
                            {loginErrors.account}
                          </span>
                        )}
                      </label>

                      <label className="flex flex-col gap-1.5 text-[14px] leading-[22px] tracking-[0.15px] text-[#51525a]">
                        密码
                        <span
                          className={`flex h-[42px] w-full items-center gap-4 rounded-xl border bg-white px-3 py-2 ${
                            hasPasswordError ? 'border-[#ff4d4f] focus-within:border-[#ff4d4f]' : 'border-[#e9e9ea] focus-within:border-[#1677ff]'
                          }`}
                        >
                          <input
                            type={passwordVisible ? 'text' : 'password'}
                            value={loginPassword}
                            onChange={(event) => {
                              setLoginPassword(event.target.value);
                              if (loginErrors.password || loginErrors.general) {
                                setLoginErrors((current) => ({ ...current, password: undefined, general: undefined }));
                              }
                            }}
                            aria-invalid={hasPasswordError}
                            aria-describedby={loginErrors.password ? 'login-password-error' : undefined}
                            className="min-w-0 flex-1 bg-transparent text-[14px] leading-6 tracking-[0.15px] text-[#1a1c26] outline-none placeholder:text-[#a8a9ad]"
                            placeholder="请输入密码"
                          />
                          <button
                            type="button"
                            onClick={() => setPasswordVisible((current) => !current)}
                            className="flex h-6 w-6 shrink-0 items-center justify-center text-[#8a8f99] transition-colors hover:text-[#4f5662]"
                            aria-label={passwordVisible ? '隐藏密码' : '显示密码'}
                            title={passwordVisible ? '隐藏密码' : '显示密码'}
                          >
                            {passwordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </span>
                        {loginErrors.password && (
                          <span id="login-password-error" className="text-[12px] leading-[18px] text-[#ff4d4f]">
                            {loginErrors.password}
                          </span>
                        )}
                      </label>

                      {loginErrors.general && (
                        <div className="rounded-lg bg-[#fff2f0] px-3 py-1.5 text-[12px] leading-[18px] text-[#ff4d4f]" role="alert">
                          {loginErrors.general}
                        </div>
                      )}

                      <div className="flex h-[22px] items-start justify-between">
                        <button
                          type="button"
                          onClick={() => setRememberMe((current) => !current)}
                          className="flex items-center gap-2 text-[14px] leading-[22px] text-[#1d2129]"
                        >
                          {rememberMe ? (
                            <img className="h-[14px] w-[14px]" src={checkboxChecked} alt="" />
                          ) : (
                            <span className="h-[14px] w-[14px] rounded-[2px] border-2 border-[#e5e6eb] bg-white" />
                          )}
                          记住我
                        </button>
                        <button type="button" className="text-[14px] leading-[22px] text-[#4f7dff]">
                          忘记密码？
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleLoginSubmit}
                      disabled={loginSubmitting}
                      className="mt-1 flex h-11 w-full items-center justify-center rounded-full bg-[#1677ff] py-2.5 text-[16px] leading-6 tracking-[0.15px] text-white transition-colors hover:bg-[#0f69e8] disabled:bg-[#8fbeff]"
                    >
                      {loginSubmitting ? '登录中...' : '立即登录'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
