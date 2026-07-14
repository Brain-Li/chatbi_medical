import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ArrowUp, Eye, EyeOff, X } from 'lucide-react';
import { WorkspaceAutoSubmitPayload } from '../types';

import checkboxChecked from '../../assets/figma-login/checkbox-checked.svg';
import closeLargeFill from '../../assets/figma-login/close-large-fill.svg';
import loginIllustration from '../../assets/figma-login/login-illustration.png';
import arrowRightUpLine from '../../assets/figma-home/arrow-right-up-line.svg';
import assistantImage from '../../assets/figma-home/assistant.png';
import caseArrowRightUp from '../../assets/figma-home/case-arrow-right-up.svg';
import caseTemplateIcon from '../../assets/figma-home/case-template-icon.svg';
import globalLine from '../../assets/figma-home/global-line.svg';
import globalLineSelected from '../../assets/figma-home/global-line-selected.svg';
import micLine from '../../assets/figma-home/mic-line.svg';
import qaIcon from '../../assets/figma-home/qa-icon.svg';
import modeReportIcon from '../../assets/figma-home/mode-report-icon.svg';
import { AppHeader } from '../components/AppHeader';
import { AppShellBackground } from '../components/AppShellBackground';
import { ConversationHistorySidebar } from '../components/ConversationHistorySidebar';
import { PrimaryIconNav } from '../components/PrimaryIconNav';
import { PromptComposerFrame } from '../components/PromptComposerFrame';
import { useWorkspace } from '../context/WorkspaceContext';
import { inferPromptMode, type PromptMode } from '../utils/promptMode';

type HomeMode = PromptMode;
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
  prompt: string;
};

const askSuggestions: HomeSuggestion[] = [
  { mode: 'ask', title: '本周门急诊收入环比变化如何？' },
  { mode: 'ask', title: '住院均次费用最高的科室有哪些？' },
  { mode: 'ask', title: '门诊治疗收入贡献最大的三个科室是哪些？' },
];
const initialSuggestions: HomeSuggestion[] = [
  { mode: 'ask', title: '上月门诊总收入和药占比情况' },
  { mode: 'ask', title: '眼科近三个月诊量是否异常', deepAnalysisEnabled: true },
  { mode: 'report', title: '生成昨天的门诊经营日报' },
];
const reportCases: ReportCase[] = [
  {
    title: '门诊经营日报',
    description: '汇总昨日门诊量、收入、药占比和重点科室表现，快速定位需要关注的异常项。',
    prompt: '生成昨天的门诊经营日报。',
  },
  {
    title: '门急诊运营周报',
    description: '按周复盘门急诊流量、收入趋势和资源使用情况，沉淀管理层可读的经营结论。',
    prompt: '给我做一份本周门急诊周报。',
  },
  {
    title: '月度经营分析',
    description: '面向经营例会输出月度指标、同比环比、结构拆解和管理建议。',
    prompt: '输出本月经营月报并突出异常项。',
  },
];
export default function HomePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    activeConversationIds,
    deleteConversation,
    getConversationsForWorkspace,
    setActiveConversationForWorkspace,
  } = useWorkspace();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectedMode, setSelectedMode] = useState<HomeMode | null>(null);
  const [draft, setDraft] = useState('');
  const [deepAnalysisEnabled, setDeepAnalysisEnabled] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(
    () => Boolean((location.state as { historyOpen?: boolean } | null)?.historyOpen),
  );
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
  const visibleSuggestions = selectedMode === 'ask' ? askSuggestions : initialSuggestions;
  const askConversations = getConversationsForWorkspace('ask');
  const inputPlaceholder =
    selectedMode === 'ask'
      ? '查询指标、趋势、异常、对比等数据问题...'
      : selectedMode === 'report'
        ? '描述报告主题、统计周期和关注重点...'
        : '输入数据问题，或描述要生成的报告...';

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = '52px';
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 112)}px`;
  }, [draft]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('login') === '1') {
      setLoginOpen(true);
    }
  }, []);

  useEffect(() => {
    if ((location.state as { historyOpen?: boolean } | null)?.historyOpen) {
      setHistoryOpen(true);
    }
  }, [location.state]);

  const selectMode = (nextMode: HomeMode) => {
    const nextSelectedMode = selectedMode === nextMode ? null : nextMode;
    setSelectedMode(nextSelectedMode);
    if (nextSelectedMode !== 'ask') setDeepAnalysisEnabled(false);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const clearSelectedMode = () => {
    setSelectedMode(null);
    setDeepAnalysisEnabled(false);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const submit = (
    submittedQuestion = draft,
    options?: { mode?: HomeMode; deepAnalysisEnabled?: boolean },
  ) => {
    const question = submittedQuestion.trim();
    if (!question) return;
    const resolvedMode = options?.mode ?? inferPromptMode(question, selectedMode);
    const shouldUseDeepAnalysis =
      resolvedMode === 'ask'
        ? options?.deepAnalysisEnabled ?? deepAnalysisEnabled
        : undefined;

    const autoSubmit: WorkspaceAutoSubmitPayload = {
      mode: resolvedMode,
      question,
      nonce: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      deepAnalysisEnabled: shouldUseDeepAnalysis,
      forceNewConversation: true,
    };

    navigate(resolvedMode === 'ask' ? '/ask' : '/report', { state: { autoSubmit } });
  };

  const handleSuggestionClick = (suggestion: HomeSuggestion) => {
    submit(suggestion.title, {
      mode: suggestion.mode,
      deepAnalysisEnabled: suggestion.deepAnalysisEnabled,
    });
  };

  const handleReportCaseClick = (reportCase: ReportCase) => {
    setDraft(reportCase.prompt);
    if (selectedMode !== 'report') {
      selectMode('report');
      return;
    }

    submit(reportCase.prompt);
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
    <div className="relative h-full min-h-[754px] overflow-hidden bg-white text-[#1a1c26]">
      <AppShellBackground />

      <div className="relative z-10 flex h-full min-w-[1280px] flex-col overflow-hidden">
        <AppHeader
          menuOpen={historyOpen}
          onMenuClick={() => setHistoryOpen((current) => !current)}
        />

        <div className="flex min-h-0 flex-1 items-stretch">
          <PrimaryIconNav />

          {historyOpen && (
            <ConversationHistorySidebar
              conversations={askConversations}
              selectedConversationId={activeConversationIds.ask}
              newConversationLabel="新对话"
              historyLabel="历史对话"
              onNewConversation={() => {
                setActiveConversationForWorkspace('ask', null);
                setDraft('');
                setSelectedMode(null);
                setDeepAnalysisEnabled(false);
                window.setTimeout(() => textareaRef.current?.focus(), 0);
              }}
              onSelectConversation={(conversationId) => {
                setActiveConversationForWorkspace('ask', conversationId);
                navigate('/ask');
              }}
              onDeleteConversation={deleteConversation}
            />
          )}

          <main className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-tl-[20px] rounded-tr-[20px] bg-white pb-[34px]">
            <div className="relative h-full overflow-hidden rounded-[inherit]">
              <div
                aria-hidden="true"
                className="absolute left-1/2 top-[151px] h-[230px] w-[940px] -translate-x-1/2 opacity-70"
                style={{
                  backgroundImage:
                    'linear-gradient(#edf1f7 1px, transparent 1px), linear-gradient(90deg, #edf1f7 1px, transparent 1px)',
                  backgroundSize: '100px 80px',
                  maskImage: 'linear-gradient(90deg, transparent 0%, #000 9%, #000 91%, transparent 100%)',
                }}
              />

              <section className="relative mx-auto flex w-[1208px] flex-col pt-[72px]">
                <div className="mx-auto flex w-[860px] flex-col gap-5">
                  <div className="flex w-[860px] items-center gap-3">
                    <div className="relative h-[104px] w-[104px] shrink-0">
                      <img
                        className="absolute left-0 top-[7px] h-[90px] w-[104px] object-cover"
                        src={assistantImage}
                        alt=""
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[18px] leading-[27px] text-[#6b7380]">
                        Hi，我是您的专属智能助手
                      </p>
                      <h1 className="mt-2 w-[672px] text-[24px] font-medium leading-[28.8px] text-[#1a1c26]">
                        擅长数据分析与报告生成，助你高效洞察数据价值
                      </h1>
                    </div>
                  </div>

                  <PromptComposerFrame className="w-[860px] items-end justify-end">
                    <div className="flex min-h-[100px] w-[829px] flex-col justify-between gap-3">
                      <div className="flex min-h-[52px] w-full items-start gap-2">
                        {selectedMode && (
                          <span
                            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[14px] leading-[22px] ${
                              selectedMode === 'ask'
                                ? 'border-[#bcd4ff] bg-[#edf2ff] text-[#1f63d7]'
                                : 'border-[#b7ebc6] bg-[#f0fff4] text-[#00b42a]'
                            }`}
                          >
                            <img
                              className="h-4 w-4"
                              src={selectedMode === 'ask' ? qaIcon : modeReportIcon}
                              alt=""
                            />
                            {selectedMode === 'ask' ? '问数' : '报告'}
                            <button
                              type="button"
                              onClick={clearSelectedMode}
                              className="flex h-4 w-4 items-center justify-center rounded-full transition-colors hover:bg-white/70"
                              aria-label={`取消${selectedMode === 'ask' ? '问数' : '报告'}`}
                              title="回到智能识别"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        )}
                        <textarea
                          ref={textareaRef}
                          value={draft}
                          onChange={(event) => setDraft(event.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder={inputPlaceholder}
                          rows={2}
                          className="h-[52px] max-h-[112px] min-h-[52px] min-w-0 flex-1 resize-none bg-white pt-1 text-[14px] leading-[21px] text-[#1a1c26] placeholder:text-[#9ca3b0] focus:outline-none"
                        />
                      </div>
                      <div className="flex h-8 items-center">
                        <div className="flex min-w-0 flex-1 items-center gap-2 pr-4">
                          {selectedMode === 'ask' && (
                            <button
                              type="button"
                              onClick={() => setDeepAnalysisEnabled((current) => !current)}
                              className={`flex h-8 items-center gap-1 rounded-lg p-2 text-[14px] leading-[22.5px] transition-colors ${
                                deepAnalysisEnabled
                                  ? 'bg-[#e8f3ff] text-[#165dff]'
                                  : 'bg-[#f9fafc] text-[#4e5969] hover:bg-[#f2f3f5]'
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
                        </div>
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center rounded-lg"
                            title="语音输入"
                          >
                            <img className="h-6 w-6" src={micLine} alt="" />
                          </button>
                          <button
                            type="button"
                            onClick={() => submit()}
                            className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                              canSubmit ? 'bg-[#1677ff]' : 'bg-[#e9e9ea]'
                            }`}
                            title={
                              selectedMode === 'report'
                                ? '生成报告'
                                : selectedMode === 'ask'
                                  ? '发送问题'
                                  : '智能识别并发送'
                            }
                          >
                            <ArrowUp className={`h-4 w-4 ${canSubmit ? 'text-white' : 'text-[#7f8896]'}`} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </PromptComposerFrame>

                  {!selectedMode && (
                    <div className="flex items-center gap-[13px]">
                      <button
                        type="button"
                        onClick={() => selectMode('ask')}
                        className="flex h-8 items-center justify-center gap-1 rounded-lg border border-[#d4d6dc] bg-white px-[13px] text-[14px] leading-[22px] text-[#333b46] transition-colors hover:bg-[#f9fafc]"
                        aria-label="选择问数"
                        aria-pressed={false}
                      >
                        <img className="h-5 w-5" src={qaIcon} alt="" />
                        问数
                      </button>
                      <button
                        type="button"
                        onClick={() => selectMode('report')}
                        className="flex h-8 items-center justify-center gap-1 rounded-lg border border-[#d4d6dc] bg-white px-[13px] text-[14px] leading-[22px] text-[#333b46] transition-colors hover:bg-[#f9fafc]"
                        aria-label="选择报告"
                        aria-pressed={false}
                      >
                        <img className="h-5 w-5" src={modeReportIcon} alt="" />
                        报告
                      </button>
                    </div>
                  )}
                </div>

                <div className="mx-auto mt-[clamp(57px,6vh,88px)] flex w-[862px] flex-col gap-4">
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        selectedMode === 'report'
                          ? 'h-[13px] w-[3px] shrink-0 rounded-xl bg-[#165dff]'
                          : 'h-[15px] w-[3px] shrink-0 rounded-full bg-[#1677ff]'
                      }
                    />
                    <h2
                      className={
                        selectedMode === 'report'
                          ? 'text-[16px] font-medium leading-6 text-[#1d2129]'
                          : 'text-[14px] font-semibold leading-[22px] text-[#1a1c26]'
                      }
                    >
                      {selectedMode === 'report'
                        ? '案例精选'
                        : selectedMode === 'ask'
                          ? '快捷提问'
                          : '从常用场景开始'}
                    </h2>
                  </div>
                  {selectedMode === 'report' ? (
                    <div className="flex w-full items-start gap-4">
                      {reportCases.map((reportCase) => (
                        <button
                          key={reportCase.title}
                          type="button"
                          onClick={() => handleReportCaseClick(reportCase)}
                          className="flex min-h-[128px] min-w-0 flex-1 flex-col items-start rounded-xl border border-[#e5e6eb] bg-white p-4 text-left shadow-[0_10px_12px_-10px_rgba(0,0,0,0.11)] transition-colors hover:bg-white"
                        >
                          <div className="flex w-full flex-col gap-2">
                            <div className="flex w-full items-center justify-between">
                              <div className="flex min-w-0 items-center gap-2">
                                <img className="h-6 w-6 shrink-0 object-contain" src={caseTemplateIcon} alt="" />
                                <span className="min-w-0 truncate text-[16px] font-medium leading-6 text-[#1d2129]">
                                  {reportCase.title}
                                </span>
                              </div>
                              <img
                                className="h-4 w-4 shrink-0"
                                src={caseArrowRightUp}
                                alt=""
                              />
                            </div>
                            <p className="text-[14px] leading-[22px] text-[#4e5969]">
                              {reportCase.description}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {visibleSuggestions.map((suggestion, index) => (
                        <button
                          key={`${suggestion.title}-${index}`}
                          type="button"
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="flex w-full items-center justify-between rounded-lg border border-[#e5e8f0] bg-white/90 px-4 py-2 text-left text-[14px] leading-[22px] text-[#1a1c26] transition-colors hover:border-[#bcd4ff] hover:bg-[#f9fbff]"
                        >
                          <span>{suggestion.title}</span>
                          <img className="h-4 w-4" src={arrowRightUpLine} alt="" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </main>
        </div>

        {loginOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#1e1f27]/45">
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
    </div>
  );
}
