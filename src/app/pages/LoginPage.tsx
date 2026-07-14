import { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, EyeOff } from 'lucide-react';

import { AUTH_STORAGE_KEY, createDemoAuthSession, getDemoPassword, resetDemoPassword } from '../utils/demoAuth';

import brandLogo from '../../assets/figma-login/figma-brand-logo@2x.png';
import bannerConnectorBottom from '../../assets/figma-login/figma-banner-connector-bottom.svg';
import bannerConnectorDot from '../../assets/figma-login/figma-banner-connector-dot.svg';
import bannerConnectorRight from '../../assets/figma-login/figma-banner-connector-right.svg';
import bannerConnectorTop from '../../assets/figma-login/figma-banner-connector-top.svg';
import bannerIllustration from '../../assets/figma-login/figma-banner-illustration.png';
import bannerMask from '../../assets/figma-login/figma-banner-mask.svg';
import checkboxWrapper from '../../assets/figma-login/checkbox-wrapper.svg';
import eyeLine from '../../assets/figma-login/eye-line.svg';
import pieChartBoxLine from '../../assets/figma-login/pie-chart-box-line.svg';
import passwordResetSuccess from '../../assets/figma-login/password-reset-success.png';
import welcomeIcon from '../../assets/figma-login/welcome-sparkle.svg';

const DEMO_ADMIN_EMAIL = 'admin@chatbi.com';
const DEMO_VERIFICATION_CODE = '123456';
const VERIFICATION_CODE_LIFETIME_SECONDS = 60;
const MIN_PASSWORD_LENGTH = 8;

type RecoveryStep = 'form' | 'success';
type LoginErrors = { account?: string; password?: string; general?: string };
type RecoveryErrors = { email?: string; code?: string; password?: string; confirmPassword?: string };

function getNewPasswordError(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) return `密码至少需要 ${MIN_PASSWORD_LENGTH} 位`;
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return '密码需同时包含字母和数字';
  return undefined;
}

function getConfirmPasswordError(password: string, confirmation: string) {
  if (!confirmation) return '请再次输入新密码';
  if (password !== confirmation) return '两次输入的密码不一致';
  return undefined;
}

function BrandLogo() {
  return (
    <img
      className="h-10 w-[147px] select-none mix-blend-multiply"
      src={brandLogo}
      alt="智能问数"
      draggable={false}
    />
  );
}

function LoginField({
  label,
  placeholder,
  type = 'text',
  value,
  onChange,
  onTogglePassword,
  error,
  invalid = false,
  autoComplete,
  inputMode,
  hideLabel = false,
  disabled = false,
  onBlur,
  inputRef,
}: {
  label: string;
  placeholder: string;
  type?: 'text' | 'password' | 'email';
  value: string;
  onChange: (value: string) => void;
  onTogglePassword?: () => void;
  error?: string;
  invalid?: boolean;
  autoComplete?: string;
  inputMode?: 'email' | 'numeric' | 'text';
  hideLabel?: boolean;
  disabled?: boolean;
  onBlur?: () => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const errorId = `${label}-error`;

  return (
    <label className="flex flex-col gap-2 text-sm font-normal leading-[22px] tracking-[0.15px] text-[#4e5969]">
      {hideLabel ? <span className="sr-only">{label}</span> : label}
      <span
        className={`relative flex h-[42px] w-full items-center rounded-xl border px-3 transition-colors ${
          disabled
            ? 'border-[#e5e6eb] bg-[#f7f8fa]'
            : invalid
              ? 'border-[#ff4d4f] focus-within:border-[#ff4d4f]'
              : 'border-[#e5e6eb] bg-white focus-within:border-[#165dff]'
        }`}
      >
        <input
          className="login-input h-full min-w-0 flex-1 bg-transparent text-sm font-normal leading-[22px] tracking-[0.15px] text-[#1d2129] outline-none placeholder:text-[#86909c] disabled:cursor-not-allowed disabled:text-[#86909c]"
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={autoComplete ?? (onTogglePassword ? 'current-password' : 'username')}
          inputMode={inputMode}
          disabled={disabled}
          ref={inputRef}
          aria-invalid={invalid}
          aria-describedby={error ? errorId : undefined}
        />
        {onTogglePassword && (
          <button
            className="ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#165dff]"
            type="button"
            onClick={onTogglePassword}
            disabled={disabled}
            aria-label={type === 'password' ? '显示密码' : '隐藏密码'}
          >
            {type === 'password' ? (
              <EyeOff className="h-4 w-4 text-[#86909c]" aria-hidden="true" strokeWidth={1.5} />
            ) : (
              <img className="h-4 w-4" src={eyeLine} alt="" />
            )}
          </button>
        )}
      </span>
      {error && (
        <span id={errorId} className="text-xs leading-[18px] text-[#ff4d4f]" role="alert">
          {error}
        </span>
      )}
    </label>
  );
}

function LoginBanner() {
  return (
    <div className="absolute left-[95.5px] top-[132px] h-[511.38px] w-[718.5px]" aria-hidden="true">
      <div
        className="absolute left-[13.71px] top-[-78.47px] h-[642.388px] w-[642.388px] brightness-[1.01] mix-blend-darken"
        style={{
          maskImage: `url(${bannerMask})`,
          maskPosition: '-113.707px -21.415px',
          maskRepeat: 'no-repeat',
          maskSize: '846.5px 711.26px',
          WebkitMaskImage: `url(${bannerMask})`,
          WebkitMaskPosition: '-113.707px -21.415px',
          WebkitMaskRepeat: 'no-repeat',
          WebkitMaskSize: '846.5px 711.26px',
        }}
      >
        <img className="h-full w-full object-cover" src={bannerIllustration} alt="" draggable={false} />
      </div>

      <div className="absolute left-[29.5px] top-36 flex items-center gap-1 whitespace-nowrap rounded-lg border border-[#dee8fd] bg-[#e8f3ff] px-[13px] py-[5px] text-sm leading-[22px] text-[#165dff]">
        <img className="h-4 w-4" src={pieChartBoxLine} alt="" />
        报告生成
      </div>
      <div className="absolute left-[463.5px] top-0 whitespace-nowrap rounded-lg border border-[#bedaff] bg-[#e7f0fd] px-[13px] py-[5px] text-sm leading-[22px] text-[#165dff]">
        智能问答
      </div>
      <img className="absolute left-[375px] top-[17px] h-[69px] w-[89px] -rotate-90" src={bannerConnectorTop} alt="" />

      <div className="absolute left-[636.5px] top-[373px] whitespace-nowrap rounded-lg border border-[#bedaff] px-[13px] py-[5px] text-sm leading-[22px] text-[#165dff]">
        数据分析
      </div>
      <img className="absolute left-[567.5px] top-[339px] h-[9px] w-[9px]" src={bannerConnectorDot} alt="" />
      <img className="absolute left-[572px] top-[345px] h-11 w-[64.5px] rotate-90 scale-y-[-1]" src={bannerConnectorRight} alt="" />

      <div className="absolute left-[376.5px] top-[400px] whitespace-nowrap rounded-lg border border-[#bedaff] px-[13px] py-[5px] text-sm leading-[22px] text-[#165dff]">
        辅助决策
      </div>
      <img className="absolute left-[413.5px] top-[350px] h-[9px] w-[9px]" src={bannerConnectorDot} alt="" />
      <img className="absolute left-[418px] top-[356px] h-11 w-0 rotate-90 scale-y-[-1]" src={bannerConnectorBottom} alt="" />
    </div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [recoveryStep, setRecoveryStep] = useState<RecoveryStep | null>(null);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPasswordVisible, setNewPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [recoveryErrors, setRecoveryErrors] = useState<RecoveryErrors>({});
  const [isSendingVerificationCode, setIsSendingVerificationCode] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null);
  const [isVerificationCodeSent, setIsVerificationCodeSent] = useState(false);
  const [isNewPasswordTouched, setIsNewPasswordTouched] = useState(false);
  const [isConfirmPasswordTouched, setIsConfirmPasswordTouched] = useState(false);
  const recoveryEmailInputRef = useRef<HTMLInputElement>(null);
  const verificationCodeInputRef = useRef<HTMLInputElement>(null);

  const hasAccountError = Boolean(errors.account || errors.general);
  const hasPasswordError = Boolean(errors.password || errors.general);
  const isRecovering = recoveryStep !== null;
  const isNewPasswordValid = !getNewPasswordError(newPassword);
  const canResetPassword =
    isVerificationCodeSent &&
    resendSeconds > 0 &&
    verificationCode.length === 6 &&
    isNewPasswordValid &&
    newPassword === confirmPassword;
  const isRecoveryEmailFormatValid = /^\S+@\S+\.\S+$/.test(recoveryEmail.trim());

  useEffect(() => {
    if (resendSeconds <= 0) return;

    const timer = window.setTimeout(() => {
      setResendSeconds((seconds) => {
        const nextSeconds = seconds - 1;
        if (nextSeconds === 0 && isVerificationCodeSent) {
          setRecoveryErrors((current) => ({ ...current, code: '验证码已过期，请重新获取' }));
        }
        return nextSeconds;
      });
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [isVerificationCodeSent, resendSeconds]);

  useEffect(() => {
    if (isVerificationCodeSent && !isSendingVerificationCode) {
      verificationCodeInputRef.current?.focus();
    }
  }, [isSendingVerificationCode, isVerificationCodeSent]);

  function handleAccountChange(value: string) {
    setAccount(value);
    if (errors.account || errors.general) {
      setErrors((current) => ({ ...current, account: undefined, general: undefined }));
    }
  }

  function handlePasswordChange(value: string) {
    setPassword(value);
    if (errors.password || errors.general) {
      setErrors((current) => ({ ...current, password: undefined, general: undefined }));
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const nextErrors: LoginErrors = {};
    const trimmedAccount = account.trim();

    if (!trimmedAccount) nextErrors.account = '请输入账号';
    if (!password.trim()) nextErrors.password = '请输入密码';

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    window.setTimeout(() => {
      if (trimmedAccount === 'admin' && password === getDemoPassword()) {
        createDemoAuthSession(rememberMe);
        navigate('/home', { replace: true });
        return;
      }

      setIsSubmitting(false);
      setErrors({ general: '账号或密码错误，请重新输入' });
    }, 500);
  }

  function resetRecoveryForm() {
    setRecoveryEmail('');
    setVerificationCode('');
    setNewPassword('');
    setConfirmPassword('');
    setRecoveryErrors({});
    setIsSendingVerificationCode(false);
    setIsResettingPassword(false);
    setResendSeconds(0);
    setCodeExpiresAt(null);
    setIsVerificationCodeSent(false);
    setIsNewPasswordTouched(false);
    setIsConfirmPasswordTouched(false);
  }

  function openRecovery() {
    resetRecoveryForm();
    setRecoveryStep('form');
  }

  function returnToLogin() {
    resetRecoveryForm();
    setRecoveryStep(null);
  }

  function handleRecoveryEmailChange(value: string) {
    setRecoveryEmail(value);
    setVerificationCode('');
    setRecoveryErrors((current) => ({ ...current, email: undefined, code: undefined }));
    setResendSeconds(0);
    setCodeExpiresAt(null);
    setIsVerificationCodeSent(false);
  }

  function handleRecoveryEmailBlur() {
    if (recoveryEmail.trim() && !isRecoveryEmailFormatValid) {
      setRecoveryErrors((current) => ({ ...current, email: '请输入有效的邮箱地址' }));
    }
  }

  function sendVerificationCode() {
    setRecoveryErrors((current) => ({ ...current, email: undefined, code: undefined }));
    setResendSeconds(VERIFICATION_CODE_LIFETIME_SECONDS);
    setCodeExpiresAt(Date.now() + VERIFICATION_CODE_LIFETIME_SECONDS * 1000);
    setIsVerificationCodeSent(true);
  }

  function handleSendVerificationCode() {
    if (isSendingVerificationCode) return;

    const normalizedEmail = recoveryEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setRecoveryErrors((current) => ({ ...current, email: '请输入有效的邮箱地址' }));
      recoveryEmailInputRef.current?.focus();
      return;
    }
    if (normalizedEmail !== DEMO_ADMIN_EMAIL) {
      setRecoveryErrors((current) => ({ ...current, email: '未找到与该邮箱关联的账号' }));
      recoveryEmailInputRef.current?.focus();
      return;
    }

    setIsSendingVerificationCode(true);
    window.setTimeout(() => {
      setRecoveryEmail(normalizedEmail);
      sendVerificationCode();
      setIsSendingVerificationCode(false);
    }, 500);
  }

  function handleVerificationCodeChange(value: string) {
    const nextCode = value.replace(/\D/g, '').slice(0, 6);
    setVerificationCode(nextCode);
    const isExpired = isVerificationCodeSent && (!codeExpiresAt || Date.now() >= codeExpiresAt);
    setRecoveryErrors((current) => ({ ...current, code: isExpired ? '验证码已过期，请重新获取' : undefined }));
  }

  function handleRecoverySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isResettingPassword || recoveryStep !== 'form') return;

    const nextErrors: RecoveryErrors = {};
    if (!isVerificationCodeSent) nextErrors.code = '请先获取验证码';
    else if (!codeExpiresAt || Date.now() >= codeExpiresAt) nextErrors.code = '验证码已过期，请重新获取';
    else if (verificationCode.length !== 6) nextErrors.code = '请输入 6 位验证码';
    else if (verificationCode !== DEMO_VERIFICATION_CODE) nextErrors.code = '验证码错误，请重新输入';

    const passwordError = getNewPasswordError(newPassword);
    const confirmPasswordError = getConfirmPasswordError(newPassword, confirmPassword);
    if (passwordError) nextErrors.password = passwordError;
    if (confirmPasswordError) nextErrors.confirmPassword = confirmPasswordError;
    if (Object.keys(nextErrors).length) {
      setRecoveryErrors(nextErrors);
      setIsNewPasswordTouched(true);
      setIsConfirmPasswordTouched(true);
      if (nextErrors.code) verificationCodeInputRef.current?.focus();
      return;
    }

    setRecoveryErrors({});
    setIsResettingPassword(true);
    window.setTimeout(() => {
      resetDemoPassword(newPassword);
      setIsResettingPassword(false);
      setRecoveryStep('success');
    }, 500);
  }

  function resendVerificationCode() {
    if (!isVerificationCodeSent || resendSeconds > 0 || isSendingVerificationCode) return;

    setIsSendingVerificationCode(true);
    window.setTimeout(() => {
      sendVerificationCode();
      setIsSendingVerificationCode(false);
    }, 400);
  }

  return (
    <main
      className="min-h-dvh min-w-[1440px] w-full overflow-hidden bg-[#e7f0ff] text-[#1d2129]"
      style={{
        fontFamily: '"Login Figma Sans", "PingFang SC", "Noto Sans SC", sans-serif',
        fontSynthesis: 'none',
      }}
    >
      <section className="relative min-h-[754px] h-dvh min-w-[1440px] w-full overflow-hidden">
        <div className="absolute inset-y-0 left-0 w-[61.111111%] overflow-hidden">
          <div className="absolute left-[60px] top-10">
            <BrandLogo />
          </div>
          <LoginBanner />
        </div>

        <section
          className={`absolute inset-y-0 right-0 flex min-w-[560px] w-[38.888889%] overflow-y-auto bg-white p-10 shadow-[-2px_0_22.1px_rgba(0,0,0,0.01)] ${
            isRecovering ? 'items-start' : 'items-center'
          }`}
        >
          <form
            className={`flex w-full flex-col px-6 ${
              recoveryStep === 'success' ? 'gap-10 pt-[193px]' : isRecovering ? 'gap-12 pt-[50px]' : 'gap-10'
            }`}
            onSubmit={isRecovering ? handleRecoverySubmit : handleSubmit}
            noValidate
            aria-busy={isSubmitting || isSendingVerificationCode || isResettingPassword}
          >
            {isRecovering ? (
              <div className="flex w-full flex-col">
                {recoveryStep !== 'success' && (
                  <button
                    className="flex w-fit items-center gap-1 text-sm leading-[22px] text-[#4e5969] transition-colors hover:text-[#165dff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#165dff]"
                    type="button"
                    onClick={returnToLogin}
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    返回登录
                  </button>
                )}
                {recoveryStep === 'success' ? (
                  <div className="flex w-full flex-col items-center gap-6" aria-live="polite">
                    <img className="h-[120px] w-[120px] select-none" src={passwordResetSuccess} alt="" draggable={false} />
                    <div className="flex w-full flex-col items-center gap-2 text-center">
                      <h1 className="m-0 text-[24px] font-medium leading-8 text-[#1d2129]">密码修改成功</h1>
                      <p className="m-0 text-base font-normal leading-6 text-[#4e5969]">您的密码已成功更新，请使用新密码登录</p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-10 flex flex-col gap-2">
                    <h1 className="m-0 text-[24px] font-medium leading-8">找回密码</h1>
                    <p className="m-0 text-base font-normal leading-6 text-[#4e5969]">请输入邮箱获取验证码，并设置新密码</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex w-full flex-col gap-6">
                <img className="h-[36.67px] w-11 select-none" src={welcomeIcon} alt="" draggable={false} />
                <div className="flex flex-col gap-2">
                  <h1 className="m-0 text-[24px] font-medium leading-8">欢迎来到 智能问数</h1>
                  <p className="m-0 text-base font-normal leading-6 text-[#4e5969]">智能分析，让决策更高效。</p>
                </div>
              </div>
            )}

            {recoveryStep === 'success' ? (
              <button
                className="h-10 w-full rounded-xl bg-[#1d2129] text-base font-normal leading-[22px] tracking-[0.15px] text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#165dff]"
                type="button"
                onClick={returnToLogin}
              >
                使用新密码登录
              </button>
            ) : isRecovering ? (
              <div className="flex w-full flex-col gap-4">
                <LoginField
                  label="邮箱"
                  placeholder="请输入邮箱地址"
                  type="email"
                  value={recoveryEmail}
                  onChange={handleRecoveryEmailChange}
                  error={recoveryErrors.email}
                  invalid={Boolean(recoveryErrors.email)}
                  autoComplete="email"
                  inputMode="email"
                  onBlur={handleRecoveryEmailBlur}
                  inputRef={recoveryEmailInputRef}
                />

                <div className="flex flex-col gap-2 text-sm font-normal leading-[22px] tracking-[0.15px] text-[#4e5969]">
                  <span>验证码</span>
                  <div className="flex flex-row items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <LoginField
                        label="邮箱验证码"
                        placeholder="请输入6位验证码"
                        value={verificationCode}
                        onChange={handleVerificationCodeChange}
                        error={recoveryErrors.code}
                        invalid={Boolean(recoveryErrors.code)}
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        inputRef={verificationCodeInputRef}
                        hideLabel
                      />
                    </div>
                    <button
                      className="h-[42px] w-[160px] shrink-0 rounded-xl bg-[#e8f3ff] px-3 text-sm font-normal leading-[22px] tracking-[0.15px] text-[#165dff] transition-colors hover:bg-[#dbeaff] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#165dff]"
                      type="button"
                      onClick={isVerificationCodeSent ? resendVerificationCode : handleSendVerificationCode}
                      disabled={isSendingVerificationCode || (isVerificationCodeSent && resendSeconds > 0)}
                    >
                      {isSendingVerificationCode
                        ? '发送中...'
                        : isVerificationCodeSent && resendSeconds > 0
                          ? `${resendSeconds} 秒后重发`
                          : isVerificationCodeSent
                            ? '重新获取'
                            : '获取验证码'}
                    </button>
                  </div>
                  {isVerificationCodeSent && resendSeconds > 0 && !recoveryErrors.code && (
                    <span className="-mt-1 text-xs leading-[18px] text-[#4e5969]" role="status" aria-live="polite">
                      验证码已发送
                    </span>
                  )}
                </div>

                <LoginField
                  label="新密码"
                  placeholder={`至少 ${MIN_PASSWORD_LENGTH} 位，需包含字母和数字`}
                  type={newPasswordVisible ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(value) => {
                    setNewPassword(value);
                    if (isNewPasswordTouched || isConfirmPasswordTouched || recoveryErrors.password || recoveryErrors.confirmPassword) {
                      setRecoveryErrors((current) => ({
                        ...current,
                        password: isNewPasswordTouched || recoveryErrors.password ? getNewPasswordError(value) : current.password,
                        confirmPassword:
                          isConfirmPasswordTouched || recoveryErrors.confirmPassword
                            ? getConfirmPasswordError(value, confirmPassword)
                            : current.confirmPassword,
                      }));
                    }
                  }}
                  onBlur={() => {
                    setIsNewPasswordTouched(true);
                    setRecoveryErrors((current) => ({ ...current, password: getNewPasswordError(newPassword) }));
                  }}
                  onTogglePassword={() => setNewPasswordVisible((visible) => !visible)}
                  error={recoveryErrors.password}
                  invalid={Boolean(recoveryErrors.password)}
                  autoComplete="new-password"
                />
                <LoginField
                  label="确认新密码"
                  placeholder="请再次输入新密码"
                  type={confirmPasswordVisible ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(value) => {
                    setConfirmPassword(value);
                    if (isConfirmPasswordTouched || recoveryErrors.confirmPassword) {
                      setRecoveryErrors((current) => ({
                        ...current,
                        confirmPassword: getConfirmPasswordError(newPassword, value),
                      }));
                    }
                  }}
                  onBlur={() => {
                    setIsConfirmPasswordTouched(true);
                    setRecoveryErrors((current) => ({
                      ...current,
                      confirmPassword: getConfirmPasswordError(newPassword, confirmPassword),
                    }));
                  }}
                  onTogglePassword={() => setConfirmPasswordVisible((visible) => !visible)}
                  error={recoveryErrors.confirmPassword}
                  invalid={Boolean(recoveryErrors.confirmPassword)}
                  autoComplete="new-password"
                />

                <button
                  className={`h-10 w-full rounded-xl text-base font-normal leading-[22px] tracking-[0.15px] transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#165dff] ${
                    !canResetPassword ? 'cursor-not-allowed bg-[#f2f3f5] text-[#86909c]' : 'bg-[#1d2129] text-white'
                  } ${canResetPassword && !isResettingPassword ? 'hover:opacity-90' : ''}`}
                  type="submit"
                  disabled={!canResetPassword || isResettingPassword}
                >
                  确定修改
                </button>
              </div>
            ) : (
              <>
                <div className="flex w-full flex-col gap-4">
                  <LoginField
                    label="账号"
                    placeholder="请输入账号"
                    value={account}
                    onChange={handleAccountChange}
                    error={errors.account}
                    invalid={hasAccountError}
                  />
                  <LoginField
                    label="密码"
                    placeholder="请输入密码"
                    type={passwordVisible ? 'text' : 'password'}
                    value={password}
                    onChange={handlePasswordChange}
                    onTogglePassword={() => setPasswordVisible((visible) => !visible)}
                    error={errors.password ?? errors.general}
                    invalid={hasPasswordError}
                  />

                  <div className="flex h-[22px] items-start justify-between">
                    <button
                      className="flex items-center gap-2 text-sm font-normal leading-[22px] text-[#1d2129] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#165dff]"
                      type="button"
                      onClick={() => setRememberMe((selected) => !selected)}
                      aria-pressed={rememberMe}
                    >
                      {rememberMe ? (
                        <img className="h-[14px] w-[14px]" src={checkboxWrapper} alt="" />
                      ) : (
                        <span className="h-[14px] w-[14px] rounded-[2px] border border-[#c9cdd4] bg-white" aria-hidden="true" />
                      )}
                      7天内免登录
                    </button>
                    <button
                      className="text-sm font-normal leading-[22px] text-[#165dff] hover:text-[#0e42d2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#165dff]"
                      type="button"
                      onClick={openRecovery}
                    >
                      忘记密码？
                    </button>
                  </div>
                </div>

                <button
                  className="h-10 w-full rounded-xl bg-[#1d2129] text-base font-normal leading-[22px] tracking-[0.15px] text-white transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#165dff]"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? '登录中...' : '立即登录'}
                </button>
              </>
            )}
          </form>
        </section>
      </section>
    </main>
  );
}

export { AUTH_STORAGE_KEY };
