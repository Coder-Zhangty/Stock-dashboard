import clsx from 'clsx'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import {
  ArrowRight,
  Bot,
  Database,
  FileText,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import {
  HumanVerificationField,
  type HumanVerificationFieldHandle,
} from '../components/auth/HumanVerificationField'
import { LanguageSwitcher } from '../components/common/LanguageSwitcher'
import { useI18n } from '../i18n/I18nProvider'
import type { AuthSecurityConfig } from '../types/auth'

type AuthMode = 'login' | 'register' | 'forgot' | 'reset'

interface AuthPageProps {
  error: string | null
  security: AuthSecurityConfig
  loginFailureCount: number
  onLogin: (input: {
    email: string
    password: string
    captchaToken?: string | null
  }) => Promise<void>
  onRegister: (input: {
    name: string
    email: string
    password: string
    confirmPassword: string
    captchaToken: string
  }) => Promise<void>
  onForgotPassword: (input: {
    email: string
    captchaToken: string
  }) => Promise<{ message: string }>
  onResetPassword: (input: {
    token: string
    password: string
    confirmPassword: string
  }) => Promise<void>
}

interface AuthCopy {
  brand: string
  badge: string
  heroTitle: string
  heroBody: string
  primaryCta: string
  secondaryCta: string
  stageUser: string
  stageAssistant: string
  stageFile: string
  stageModel: string
  stageMemory: string
  stageStatus: string
  stageSync: string
  stageRoute: string
  scene2Title: string
  scene2Body: string
  scene3Title: string
  scene3Body: string
  scene4Title: string
  scene4Body: string
  scene5Title: string
  scene5Body: string
  workspaceTitle: string
  workspaceBody: string
  stickyTitle: string
  stickyBody: string
  detailTitle: string
  detailBody: string
  finalTitle: string
  finalBody: string
  authKicker: string
  description: string
  loginTitle: string
  registerTitle: string
  forgotTitle: string
  resetTitle: string
  loginTab: string
  registerTab: string
  forgotPassword: string
  backToLogin: string
  name: string
  email: string
  password: string
  confirmPassword: string
  verification: string
  verificationHelp: string
  resetToken: string
  loginAction: string
  registerAction: string
  forgotAction: string
  resetAction: string
  pleaseWait: string
  forgotSuccess: string
  resetHelp: string
}

const zhCopy: AuthCopy = {
  brand: 'Aurora',
  badge: 'AI 工作入口',
  heroTitle: '一个更完整的 AI 入口',
  heroBody: '对话、文件、模型和记忆，进入后都留在同一块工作表面。',
  primaryCta: '立即登录',
  secondaryCta: '创建账户',
  stageUser: '总结这份资料，并保持我的简洁语气。',
  stageAssistant: '资料已接入。下一步可以继续整理重点、风险和待办。',
  stageFile: '会议纪要.pdf',
  stageModel: 'Qwen3 / DeepSeek / GPT',
  stageMemory: '简洁 / 专业 / 记住偏好',
  stageStatus: 'summarizing',
  stageSync: 'memory active',
  stageRoute: 'files + chat synced',
  scene2Title: '不再在多个工具之间来回切换',
  scene2Body: '文件、模型和对话保持在同一条工作线上。',
  scene3Title: '从输入到沉淀，路径保持连续',
  scene3Body: '进入、对话、挂接资料、切模型、沉淀记忆，都发生在同一块表面。',
  scene4Title: '能力像产品切面一样展开',
  scene4Body: '文件接入、模型选择、偏好记忆和后台控制，不再是分散入口。',
  scene5Title: '稳定感来自同一个入口',
  scene5Body: '同域 API、Turnstile、账户状态和管理能力保持克制地存在。',
  workspaceTitle: '工作台在同一时间并行展开',
  workspaceBody: '资料、对话、模型与记忆不是排队出现，而是在同一个界面里互相接住。',
  stickyTitle: '滚动时，路径逐步亮起',
  stickyBody: '从进入到持续工作，Aurora 把关键状态留在同一块表面上。',
  detailTitle: '更具体的产品切片',
  detailBody: '文件理解、模型路由、用户记忆，用微型界面而不是解释文字呈现。',
  finalTitle: '进入 Aurora，让工作面开始运转',
  finalBody: '登录或创建账户，直接回到那块已经准备好的 AI 工作表面。',
  authKicker: '账户入口',
  description: '登录后进入你的 Aurora 工作台。',
  loginTitle: '登录 Aurora',
  registerTitle: '创建 Aurora 账户',
  forgotTitle: '找回密码',
  resetTitle: '重置密码',
  loginTab: '登录',
  registerTab: '注册',
  forgotPassword: '忘记密码？',
  backToLogin: '返回登录',
  name: '姓名',
  email: '邮箱',
  password: '密码',
  confirmPassword: '确认密码',
  verification: '人机验证',
  verificationHelp: '完成验证后继续。',
  resetToken: '重置令牌',
  loginAction: '登录',
  registerAction: '创建账户',
  forgotAction: '发送重置链接',
  resetAction: '更新密码',
  pleaseWait: '请稍候...',
  forgotSuccess: '如果该邮箱可接收邮件，重置说明将很快送达。',
  resetHelp: '把邮件中的重置 token 粘贴到这里即可完成密码更新。',
}

const enCopy: AuthCopy = {
  brand: 'Aurora',
  badge: 'AI work entrance',
  heroTitle: 'A more complete AI entrance',
  heroBody: 'Chat, files, models, and memory stay on the same working surface.',
  primaryCta: 'Log in now',
  secondaryCta: 'Create account',
  stageUser: 'Summarize this file and keep my concise tone.',
  stageAssistant: 'Context attached. Ready to organize highlights, risks, and next actions.',
  stageFile: 'Meeting notes.pdf',
  stageModel: 'Qwen3 / DeepSeek / GPT',
  stageMemory: 'Concise / Professional / Remembered',
  stageStatus: 'summarizing',
  stageSync: 'memory active',
  stageRoute: 'files + chat synced',
  scene2Title: 'Stop jumping between tools',
  scene2Body: 'Files, models, and conversation stay on the same working line.',
  scene3Title: 'From input to continuity',
  scene3Body: 'Enter, chat, attach files, switch models, and keep memory on one surface.',
  scene4Title: 'Capabilities appear as product slices',
  scene4Body: 'Files, models, memory, and control feel like one product, not scattered menus.',
  scene5Title: 'A calm surface for real use',
  scene5Body: 'Same-origin API, Turnstile, account state, and management stay quietly present.',
  workspaceTitle: 'The workspace unfolds in parallel',
  workspaceBody: 'Files, chat, models, and memory do not wait in separate lanes. They meet on one surface.',
  stickyTitle: 'The path lights up as you scroll',
  stickyBody: 'From entry to continued work, Aurora keeps the important state on the same surface.',
  detailTitle: 'More specific product slices',
  detailBody: 'File understanding, model routing, and user memory are shown as small interface moments.',
  finalTitle: 'Enter Aurora and let the workspace start moving',
  finalBody: 'Log in or create an account to return to the AI surface that is already waiting.',
  authKicker: 'Account access',
  description: 'Log in to enter your Aurora workspace.',
  loginTitle: 'Log in to Aurora',
  registerTitle: 'Create your Aurora account',
  forgotTitle: 'Forgot password',
  resetTitle: 'Reset password',
  loginTab: 'Log in',
  registerTab: 'Sign up',
  forgotPassword: 'Forgot password?',
  backToLogin: 'Back to login',
  name: 'Name',
  email: 'Email',
  password: 'Password',
  confirmPassword: 'Confirm password',
  verification: 'Human verification',
  verificationHelp: 'Complete verification before continuing.',
  resetToken: 'Reset token',
  loginAction: 'Log in',
  registerAction: 'Create account',
  forgotAction: 'Send reset link',
  resetAction: 'Update password',
  pleaseWait: 'Please wait...',
  forgotSuccess: 'If that email can receive reset instructions, they will arrive shortly.',
  resetHelp: 'Paste the one-time reset token from email to finish updating your password.',
}

const COPY_BY_LOCALE: Record<string, AuthCopy> = {
  'zh-CN': zhCopy,
  'en-US': enCopy,
  'ja-JP': enCopy,
  'es-ES': enCopy,
}

const EASE = [0.22, 1, 0.36, 1] as const

const drift = (duration: number, delay = 0) => ({
  duration,
  delay,
  ease: 'easeInOut' as const,
  repeat: Infinity,
  repeatType: 'mirror' as const,
})

const StageBadge = ({ children, active }: { children: ReactNode; active?: boolean }) => (
  <span
    className={clsx(
      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium shadow-[0_8px_20px_rgba(15,23,42,0.04)] backdrop-blur-xl',
      active
        ? 'border-[rgba(45,116,91,0.16)] bg-[rgba(236,253,245,0.8)] text-emerald-700'
        : 'border-black/6 bg-white/72 text-subtle',
      active && 'auth-breathe',
    )}
  >
    {active ? <span className="auth-pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-500" /> : null}
    {children}
  </span>
)

const SurfaceInput = ({
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  value: string
  onChange: (nextValue: string) => void
  placeholder: string
  type?: string
}) => (
  <input
    value={value}
    onChange={(event) => onChange(event.target.value)}
    type={type}
    placeholder={placeholder}
    className="h-12 w-full rounded-[20px] border border-black/7 bg-[rgba(250,251,253,0.88)] px-4 text-[15px] text-ink outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] transition duration-200 placeholder:text-subtle focus:border-[rgba(79,104,170,0.42)] focus:bg-white focus:shadow-[0_0_0_4px_rgba(79,104,170,0.1),inset_0_1px_0_rgba(255,255,255,0.8)]"
  />
)

const SceneShell = ({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) => {
  const reduceMotion = useReducedMotion()

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 42, scale: 0.985, filter: 'blur(10px)' }}
      whileInView={reduceMotion ? {} : { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      viewport={{ once: true, amount: 0.22 }}
      transition={{ duration: 0.92, ease: EASE }}
      className={clsx('mx-auto w-full max-w-[1440px] px-4 py-14 sm:px-6 lg:py-20 xl:px-8', className)}
    >
      {children}
    </motion.section>
  )
}

const SceneTitle = ({ title, body }: { title: string; body: string }) => {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      initial={reduceMotion ? false : 'hidden'}
      whileInView={reduceMotion ? undefined : 'visible'}
      viewport={{ once: true, amount: 0.6 }}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: 0.12,
          },
        },
      }}
      className="max-w-[560px]"
    >
      <motion.h2
        variants={{
          hidden: { opacity: 0, y: 18, filter: 'blur(8px)' },
          visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
        }}
        transition={{ duration: 0.72, ease: EASE }}
        className="text-balance text-[32px] font-semibold leading-[1.06] text-ink sm:text-[42px]"
      >
        {title}
      </motion.h2>
      <motion.p
        variants={{
          hidden: { opacity: 0, y: 14 },
          visible: { opacity: 1, y: 0 },
        }}
        transition={{ duration: 0.64, ease: EASE }}
        className="mt-4 text-[15px] leading-7 text-muted sm:text-[16px]"
      >
        {body}
      </motion.p>
    </motion.div>
  )
}

const ProductStage = ({ ui, compact }: { ui: AuthCopy; compact: boolean }) => {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.99 }}
      animate={reduceMotion ? {} : { opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.8, ease: EASE, delay: 0.06 }}
      className="relative min-h-[430px] overflow-hidden rounded-[30px] border border-black/6 bg-[rgba(255,255,255,0.48)] shadow-[0_28px_80px_rgba(15,23,42,0.1)] backdrop-blur-[24px] md:min-h-[520px] xl:min-h-[620px]"
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.52),rgba(245,247,251,0.34))]" />
      <div className="absolute inset-0 opacity-55 [background-image:linear-gradient(rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.035)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:linear-gradient(180deg,rgba(0,0,0,0.72),transparent_92%)]" />
      <div className="auth-scan-line" />
      <div className="absolute left-[8%] right-[8%] top-12 h-px bg-gradient-to-r from-transparent via-[rgba(79,104,170,0.24)] to-transparent" />
      <div className="absolute bottom-16 left-[10%] right-[14%] h-px bg-gradient-to-r from-transparent via-black/10 to-transparent" />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: [-8, 7], scale: 1 }}
        transition={reduceMotion ? undefined : drift(5.2)}
        className={clsx(
          'absolute left-[7%] top-[18%] z-20 w-[74%] max-w-[560px] overflow-hidden rounded-[26px] border border-white/72 bg-[rgba(255,255,255,0.9)] shadow-[0_22px_58px_rgba(15,23,42,0.1)]',
          compact && 'left-[5%] top-[20%] w-[86%]',
        )}
      >
        <div className="flex items-center justify-between border-b border-black/6 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#f16d6d]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#f1c56d]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#70c582]" />
          </div>
          <StageBadge>{ui.stageRoute}</StageBadge>
        </div>
        <div className="space-y-3 px-4 py-4 sm:px-5 sm:py-5">
          <motion.div
            animate={reduceMotion ? undefined : { y: [0, -3, 0], opacity: [0.88, 1, 0.88] }}
            transition={reduceMotion ? undefined : drift(4.8, 0.35)}
            className="auth-message-rise mr-8 rounded-[20px] bg-[rgba(246,247,250,0.9)] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]"
          >
            <div className="mb-2 flex items-center gap-2 text-[11px] font-medium text-subtle">
              <MessageSquareText size={13} />
              Aurora
            </div>
            <p className="text-[13px] leading-6 text-ink sm:text-[14px]">{ui.stageAssistant}</p>
          </motion.div>
          <motion.div
            animate={reduceMotion ? undefined : { y: [2, -2, 2] }}
            transition={reduceMotion ? undefined : drift(4.4, 0.85)}
            className="auth-message-rise ml-auto max-w-[82%] rounded-[20px] bg-[rgb(var(--accent-soft))] px-4 py-3"
          >
            <p className="text-[13px] leading-6 text-ink sm:text-[14px]">{ui.stageUser}</p>
          </motion.div>
          <div className="grid grid-cols-3 gap-2 pt-1">
            {['Context', 'Files', 'Tone'].map((item, index) => (
              <motion.div
                key={item}
                animate={reduceMotion ? undefined : { opacity: [0.62, 1, 0.62] }}
                transition={reduceMotion ? undefined : drift(3.6 + index * 0.45, index * 0.18)}
                className={clsx(
                  'rounded-[16px] border border-black/6 bg-white/72 px-3 py-2 text-[11px] font-medium text-subtle',
                  index === 1 && 'auth-cycle-chip',
                )}
              >
                {item}
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, x: 14, y: 8 }}
        animate={reduceMotion ? undefined : { opacity: 1, x: [0, 6], y: [0, -10] }}
        transition={reduceMotion ? undefined : drift(5.6, 0.22)}
        className={clsx(
          'auth-file-dock absolute right-[8%] top-[11%] z-30 w-[210px] rounded-[24px] border border-white/74 bg-[rgba(255,255,255,0.86)] p-4 shadow-[0_18px_46px_rgba(15,23,42,0.09)] backdrop-blur-xl',
          compact && 'right-[5%] top-[6%] w-[180px]',
        )}
      >
        <div className="flex items-center gap-2 text-[12px] font-medium text-ink">
          <FileText size={15} className="text-[rgb(var(--accent))]" />
          <span className="truncate">{ui.stageFile}</span>
        </div>
        <div className="mt-4 space-y-2">
          <div className="h-2 rounded-full bg-black/7" />
          <div className="h-2 w-[74%] rounded-full bg-black/7" />
          <div className="auth-path-flow h-2 w-[46%] rounded-full bg-[rgba(79,104,170,0.24)]" />
        </div>
        <div className="mt-4 flex items-center justify-between rounded-[16px] bg-[rgba(246,247,250,0.84)] px-3 py-2">
          <span className="text-[11px] font-medium text-subtle">indexed</span>
          <span className="h-1.5 w-12 rounded-full bg-[rgba(79,104,170,0.32)]" />
        </div>
      </motion.div>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: [0, 8] }}
        transition={reduceMotion ? undefined : drift(4.9, 0.12)}
        className={clsx(
          'absolute bottom-[13%] right-[10%] z-30 w-[230px] rounded-[24px] border border-[rgba(79,104,170,0.14)] bg-[rgba(236,241,252,0.78)] p-4 shadow-[0_18px_42px_rgba(79,104,170,0.09)] backdrop-blur-xl',
          compact && 'bottom-[10%] right-[5%] w-[192px]',
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <Bot size={16} className="text-[rgb(var(--accent))]" />
          <StageBadge>{ui.stageStatus}</StageBadge>
        </div>
        <p className="mt-3 text-[13px] font-medium leading-5 text-ink">{ui.stageModel}</p>
        <div className="mt-4 grid grid-cols-3 gap-1.5">
          {['fast', 'vision', 'reason'].map((item) => (
            <span
              key={item}
              className={clsx(
                'rounded-full bg-white/62 px-2 py-1 text-center text-[10px] text-subtle',
                item === 'vision' && 'auth-cycle-chip',
              )}
            >
              {item}
            </span>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, x: -14, y: 10 }}
        animate={reduceMotion ? undefined : { opacity: 1, x: [0, -5], y: [0, 8] }}
        transition={reduceMotion ? undefined : drift(6.1, 0.1)}
        className={clsx(
          'auth-memory-glow absolute bottom-[12%] left-[8%] z-30 w-[222px] rounded-[24px] border border-white/76 bg-[rgba(255,255,255,0.84)] p-4 shadow-[0_18px_42px_rgba(15,23,42,0.08)] backdrop-blur-xl',
          compact && 'bottom-[2%] left-[5%] w-[178px]',
        )}
      >
        <div className="flex items-center justify-between">
          <Sparkles size={15} className="text-[rgb(var(--accent))]" />
          <StageBadge active>{ui.stageSync}</StageBadge>
        </div>
        <p className="mt-3 text-[13px] font-medium leading-5 text-ink">{ui.stageMemory}</p>
        <div className="mt-4 flex gap-1.5">
          <span className="auth-path-flow h-1.5 flex-1 rounded-full bg-emerald-300/70" />
          <span className="auth-path-flow h-1.5 flex-1 rounded-full bg-[rgba(79,104,170,0.28)]" />
          <span className="h-1.5 flex-1 rounded-full bg-black/10" />
        </div>
      </motion.div>

      <motion.div
        animate={reduceMotion ? undefined : { opacity: [0.5, 1, 0.5] }}
        transition={reduceMotion ? undefined : drift(3.8)}
        className="absolute left-[45%] top-[10%] h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_8px_rgba(16,185,129,0.1)]"
      />
    </motion.div>
  )
}

const OperationScene = ({ ui }: { ui: AuthCopy }) => {
  const reduceMotion = useReducedMotion()

  return (
    <SceneShell>
      <div className="grid gap-8 lg:grid-cols-[0.42fr_1fr] lg:items-center">
        <SceneTitle title={ui.scene2Title} body={ui.scene2Body} />
        <div className="relative min-h-[500px] overflow-hidden rounded-[30px] border border-black/6 bg-[rgba(255,255,255,0.45)] p-5 shadow-[0_26px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.035)_1px,transparent_1px)] [background-size:34px_34px]" />
          <div className="auth-scan-line" />
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 22, scale: 0.985 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
            animate={reduceMotion ? undefined : { y: [-6, 8] }}
            viewport={{ once: true, amount: 0.42 }}
            transition={reduceMotion ? undefined : drift(5.4)}
            className="relative z-10 mx-auto mt-12 max-w-[620px] rounded-[26px] border border-white/72 bg-white/86 p-5 shadow-[0_22px_56px_rgba(15,23,42,0.09)]"
          >
            <div className="flex items-center justify-between">
              <StageBadge active>{ui.stageStatus}</StageBadge>
              <StageBadge>{ui.stageModel}</StageBadge>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_0.72fr]">
              <div className="space-y-3">
                <div className="auth-message-rise rounded-[20px] bg-[rgba(246,247,250,0.92)] px-4 py-4">
                  <p className="text-[13px] leading-6 text-ink">{ui.stageAssistant}</p>
                </div>
                <div className="auth-message-rise ml-auto max-w-[82%] rounded-[20px] bg-[rgb(var(--accent-soft))] px-4 py-4">
                  <p className="text-[13px] leading-6 text-ink">{ui.stageUser}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="auth-file-dock rounded-[20px] border border-black/6 bg-white/82 p-4">
                  <FileText size={16} className="text-[rgb(var(--accent))]" />
                  <p className="mt-3 truncate text-[13px] font-medium text-ink">{ui.stageFile}</p>
                  <div className="mt-3 h-2 rounded-full bg-black/7" />
                  <div className="mt-2 h-2 w-2/3 rounded-full bg-black/7" />
                </div>
                <div className="rounded-[20px] border border-[rgba(79,104,170,0.12)] bg-[rgba(236,241,252,0.72)] p-4">
                  <p className="text-[12px] font-medium text-[rgb(var(--accent))]">{ui.stageMemory}</p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/60">
                    <div className="auth-path-flow h-full w-2/3 rounded-full bg-[rgba(79,104,170,0.35)]" />
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
          <motion.div
            animate={reduceMotion ? undefined : { opacity: [0.45, 1, 0.45] }}
            transition={reduceMotion ? undefined : drift(2.8)}
            className="absolute left-[18%] top-[28%] h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_12px_rgba(16,185,129,0.08)]"
          />
          <motion.div
            animate={reduceMotion ? undefined : { x: [0, 12], y: [0, -8] }}
            transition={reduceMotion ? undefined : drift(5.9, 0.18)}
            className="absolute bottom-10 right-8 z-10 rounded-full border border-black/6 bg-white/80 px-4 py-2 text-[12px] font-medium text-subtle shadow-[0_12px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl"
          >
            {ui.stageRoute}
          </motion.div>
        </div>
      </div>
    </SceneShell>
  )
}

const WorkspaceMotionScene = ({ ui }: { ui: AuthCopy }) => {
  const reduceMotion = useReducedMotion()

  return (
    <SceneShell>
      <div className="space-y-8">
        <SceneTitle title={ui.workspaceTitle} body={ui.workspaceBody} />
        <div className="relative min-h-[620px] overflow-hidden rounded-[32px] border border-black/6 bg-[rgba(255,255,255,0.44)] p-5 shadow-[0_28px_78px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(15,23,42,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.035)_1px,transparent_1px)] [background-size:36px_36px]" />
          <div className="auth-scan-line" />
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 28, scale: 0.985 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
            animate={reduceMotion ? undefined : { y: [-7, 8] }}
            viewport={{ once: true, amount: 0.4 }}
            transition={reduceMotion ? undefined : drift(5.5)}
            className="absolute left-[6%] top-[12%] z-20 w-[52%] min-w-[280px] rounded-[28px] border border-white/74 bg-white/86 p-5 shadow-[0_24px_64px_rgba(15,23,42,0.09)] backdrop-blur-xl"
          >
            <div className="flex items-center justify-between">
              <StageBadge active>{ui.stageStatus}</StageBadge>
              <MessageSquareText size={16} className="text-[rgb(var(--accent))]" />
            </div>
            <div className="mt-5 space-y-3">
              <div className="auth-message-rise rounded-[20px] bg-[rgba(246,247,250,0.92)] px-4 py-3 text-[13px] leading-6 text-ink">
                {ui.stageAssistant}
              </div>
              <div className="auth-message-rise ml-auto max-w-[78%] rounded-[20px] bg-[rgb(var(--accent-soft))] px-4 py-3 text-[13px] leading-6 text-ink">
                {ui.stageUser}
              </div>
              <div className="overflow-hidden rounded-full bg-white/70 p-1">
                <div className="auth-path-flow h-1.5 w-3/5 rounded-full bg-[rgba(79,104,170,0.42)]" />
              </div>
              <div className="grid grid-cols-4 gap-2 pt-2">
                {['ctx', 'file', 'model', 'tone'].map((item, index) => (
                  <motion.span
                    key={item}
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.42, ease: EASE, delay: index * 0.06 }}
                    className={clsx(
                      'rounded-full bg-white/80 px-2 py-1 text-center text-[10px] font-medium text-subtle',
                      index === 2 && 'auth-breathe text-[rgb(var(--accent))]',
                    )}
                  >
                    {item}
                  </motion.span>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div
            animate={reduceMotion ? undefined : { x: [0, 8], y: [0, -9] }}
            transition={reduceMotion ? undefined : drift(5.8, 0.16)}
            className="auth-file-dock absolute right-[7%] top-[16%] z-30 w-[270px] rounded-[26px] border border-white/76 bg-white/82 p-5 shadow-[0_20px_54px_rgba(15,23,42,0.08)] backdrop-blur-xl"
          >
            <div className="flex items-center justify-between">
              <StageBadge>Library</StageBadge>
              <FileText size={16} className="text-[rgb(var(--accent))]" />
            </div>
            <div className="mt-5 space-y-3">
              {[ui.stageFile, 'brief.md', 'notes.docx'].map((file, index) => (
                <div key={file} className="rounded-[18px] border border-black/6 bg-white/72 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-[12px] font-medium text-ink">{file}</span>
                    <span className="auth-pulse-dot h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </div>
                  <div
                    className={clsx(
                      'mt-3 h-1.5 rounded-full',
                      index === 0 ? 'auth-path-flow w-full bg-[rgba(79,104,170,0.22)]' : 'w-2/3 bg-black/8',
                    )}
                  />
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            animate={reduceMotion ? undefined : { x: [0, -8], y: [0, 8] }}
            transition={reduceMotion ? undefined : drift(5.4, 0.32)}
            className="absolute bottom-[12%] left-[10%] z-20 w-[250px] rounded-[26px] border border-[rgba(79,104,170,0.12)] bg-[rgba(236,241,252,0.74)] p-5 shadow-[0_20px_50px_rgba(79,104,170,0.08)] backdrop-blur-xl"
          >
            <div className="flex items-center justify-between">
              <Bot size={17} className="text-[rgb(var(--accent))]" />
              <StageBadge>{ui.stageStatus}</StageBadge>
            </div>
            <p className="mt-4 text-[13px] font-medium leading-5 text-ink">{ui.stageModel}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {['vision', 'reason', 'fast', 'safe'].map((item) => (
                <span
                  key={item}
                  className={clsx(
                    'rounded-full bg-white/62 px-2 py-1 text-center text-[10px] text-subtle',
                    (item === 'reason' || item === 'fast') && 'auth-cycle-chip text-[rgb(var(--accent))]',
                  )}
                >
                  {item}
                </span>
              ))}
            </div>
          </motion.div>

          <motion.div
            animate={reduceMotion ? undefined : { y: [0, -8] }}
            transition={reduceMotion ? undefined : drift(4.9, 0.08)}
            className="auth-memory-glow absolute bottom-[18%] right-[12%] z-30 w-[280px] rounded-[26px] border border-white/76 bg-white/80 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl"
          >
            <div className="flex items-center justify-between">
              <StageBadge active>{ui.stageSync}</StageBadge>
              <Sparkles size={16} className="text-[rgb(var(--accent))]" />
            </div>
            <p className="mt-4 text-[13px] font-medium leading-5 text-ink">{ui.stageMemory}</p>
            <div className="mt-5 space-y-2">
              <div className="auth-path-flow h-2 rounded-full bg-emerald-300/60" />
              <div className="auth-path-flow h-2 w-[76%] rounded-full bg-[rgba(79,104,170,0.22)]" />
              <div className="h-2 w-[54%] rounded-full bg-black/8" />
            </div>
          </motion.div>
        </div>
      </div>
    </SceneShell>
  )
}

const StickyNarrativeScene = ({ ui }: { ui: AuthCopy }) => {
  const reduceMotion = useReducedMotion()
  const sceneRef = useRef<HTMLDivElement | null>(null)
  const { scrollYProgress } = useScroll({
    target: sceneRef,
    offset: ['start 70%', 'end 30%'],
  })
  const stageY = useTransform(scrollYProgress, [0, 0.45, 1], [24, 0, -24])
  const stageScale = useTransform(scrollYProgress, [0, 0.55, 1], [0.985, 1, 0.99])
  const memoryX = useTransform(scrollYProgress, [0, 0.5, 1], [10, 0, -8])
  const steps = ['Enter', 'Attach', 'Route', 'Remember']

  return (
    <SceneShell className="lg:py-8">
      <div ref={sceneRef} className="grid gap-8 lg:grid-cols-[1fr_0.42fr] lg:items-start">
        <div className="lg:sticky lg:top-8">
          <SceneTitle title={ui.stickyTitle} body={ui.stickyBody} />
          <motion.div
            style={reduceMotion ? undefined : { y: stageY, scale: stageScale }}
            className="relative mt-8 overflow-hidden rounded-[30px] border border-black/6 bg-white/54 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl"
          >
            <div className="auth-scan-line" />
            <div className="flex items-center justify-between">
              <StageBadge active>{ui.stageRoute}</StageBadge>
              <StageBadge>{ui.stageModel}</StageBadge>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-[0.78fr_1fr]">
              <div className="space-y-3">
                {steps.map((step, index) => (
                  <motion.div
                    key={step}
                    initial={{ opacity: 0.45, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: false, amount: 0.8 }}
                    transition={{ duration: 0.36, ease: EASE, delay: index * 0.04 }}
                    className={clsx(
                      'flex items-center gap-3 rounded-[20px] border border-black/6 bg-white/72 px-4 py-3',
                      (index === 1 || index === 2) && 'auth-cycle-chip',
                    )}
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgb(var(--accent-soft))] text-[11px] font-medium text-[rgb(var(--accent))]">
                      {index + 1}
                    </span>
                    <span className="text-[13px] font-medium text-ink">{step}</span>
                  </motion.div>
                ))}
              </div>
              <motion.div
                style={reduceMotion ? undefined : { x: memoryX }}
                className="auth-memory-glow rounded-[24px] border border-white/70 bg-[rgba(246,247,250,0.82)] p-5"
              >
                <div className="flex items-center justify-between">
                  <Database size={16} className="text-[rgb(var(--accent))]" />
                  <StageBadge active>{ui.stageSync}</StageBadge>
                </div>
                <div className="mt-7 space-y-3">
                  <div className="h-3 w-[86%] rounded-full bg-black/8" />
                  <div className="h-3 w-[62%] rounded-full bg-black/8" />
                  <div className="rounded-[20px] bg-white/80 p-4 text-[13px] font-medium leading-5 text-ink">
                    {ui.stageMemory}
                  </div>
                  <div className="rounded-[20px] bg-[rgb(var(--accent-soft))] p-4 text-[13px] font-medium leading-5 text-ink">
                    {ui.stageModel}
                  </div>
                  <div className="overflow-hidden rounded-full bg-white/70 p-1">
                    <div className="auth-path-flow h-1.5 w-3/4 rounded-full bg-emerald-300/70" />
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
        <div className="space-y-6 lg:pt-32">
          {steps.map((step, index) => (
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.45 }}
              transition={{ duration: 0.58, ease: EASE }}
              className={clsx(
                'rounded-[26px] border border-black/6 bg-white/58 p-5 shadow-[0_16px_42px_rgba(15,23,42,0.06)] backdrop-blur-xl',
                index === 1 && 'auth-file-dock',
              )}
            >
              <StageBadge active={index === 0}>{step}</StageBadge>
              <div className="mt-5 space-y-2">
                <div className="h-2 rounded-full bg-black/8" />
                <div className="h-2 w-[74%] rounded-full bg-black/8" />
                <div className="h-2 w-[48%] rounded-full bg-[rgba(79,104,170,0.24)]" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </SceneShell>
  )
}

const JourneyScene = ({ ui }: { ui: AuthCopy }) => (
  <SceneShell>
    <div className="grid gap-8 lg:grid-cols-[1fr_0.38fr] lg:items-center">
      <div className="relative min-h-[540px] overflow-hidden rounded-[30px] border border-black/6 bg-[rgba(255,255,255,0.44)] p-5 shadow-[0_26px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="absolute left-[12%] top-16 h-[76%] w-px bg-gradient-to-b from-transparent via-[rgba(79,104,170,0.24)] to-transparent" />
        {['Enter', 'Chat', 'Attach', 'Switch', 'Remember'].map((item, index) => (
          <motion.div
            key={item}
            initial={{ opacity: 0, x: -18 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.52, ease: EASE, delay: index * 0.08 }}
            className="relative z-10 ml-[8%] flex min-h-[84px] items-center gap-5"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white/86 text-[12px] font-medium text-ink shadow-[0_10px_24px_rgba(15,23,42,0.06)]">
              {index + 1}
            </span>
            <span className="rounded-full border border-black/6 bg-white/72 px-4 py-2 text-[13px] font-medium text-ink backdrop-blur-xl">
              {item}
            </span>
          </motion.div>
        ))}
        <div className="absolute bottom-10 right-7 top-10 w-[58%] rounded-[28px] border border-white/74 bg-white/80 p-5 shadow-[0_22px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <StageBadge active>{ui.stageSync}</StageBadge>
            <Database size={16} className="text-[rgb(var(--accent))]" />
          </div>
          <div className="mt-8 space-y-3">
            <div className="h-3 w-[78%] rounded-full bg-black/8" />
            <div className="h-3 w-[52%] rounded-full bg-black/8" />
            <div className="mt-7 rounded-[22px] bg-[rgb(var(--accent-soft))] p-4">
              <p className="text-[13px] font-medium leading-5 text-ink">{ui.stageMemory}</p>
            </div>
            <div className="rounded-[22px] border border-black/6 bg-white/86 p-4">
              <p className="text-[13px] font-medium leading-5 text-ink">{ui.stageModel}</p>
            </div>
          </div>
        </div>
      </div>
      <SceneTitle title={ui.scene3Title} body={ui.scene3Body} />
    </div>
  </SceneShell>
)

const CapabilityScene = ({ ui }: { ui: AuthCopy }) => (
  <SceneShell>
    <div className="space-y-8">
      <SceneTitle title={ui.scene4Title} body={ui.scene4Body} />
      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="min-h-[360px] rounded-[30px] border border-black/6 bg-white/58 p-5 shadow-[0_22px_60px_rgba(15,23,42,0.07)] backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <StageBadge>Library</StageBadge>
            <FileText size={17} className="text-[rgb(var(--accent))]" />
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {[ui.stageFile, 'notes.md', 'brief.docx'].map((file, index) => (
              <motion.div
                key={file}
                whileHover={{ y: -4 }}
                className="rounded-[22px] border border-black/6 bg-white/82 p-4 shadow-[0_12px_26px_rgba(15,23,42,0.04)]"
              >
                <p className="truncate text-[13px] font-medium text-ink">{file}</p>
                <div className="mt-5 h-2 rounded-full bg-black/7" />
                <div className={clsx('mt-2 h-2 rounded-full bg-black/7', index === 1 ? 'w-2/3' : 'w-1/2')} />
              </motion.div>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[0.72fr_1fr]">
            <div className="rounded-[22px] border border-black/6 bg-[rgba(246,247,250,0.84)] p-4">
              <StageBadge active>indexed</StageBadge>
              <div className="mt-4 space-y-2">
                <div className="h-2 rounded-full bg-black/8" />
                <div className="h-2 w-[68%] rounded-full bg-black/8" />
                <div className="h-2 w-[42%] rounded-full bg-[rgba(79,104,170,0.24)]" />
              </div>
            </div>
            <div className="rounded-[22px] border border-black/6 bg-white/72 p-4">
              <p className="text-[12px] font-medium text-ink">{ui.stageAssistant}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {['summary', 'risks', 'actions'].map((item) => (
                  <span key={item} className="rounded-full bg-[rgb(var(--accent-soft))] px-2.5 py-1 text-[10px] text-[rgb(var(--accent))]">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="grid gap-4">
          <div className="rounded-[30px] border border-[rgba(79,104,170,0.12)] bg-[rgba(236,241,252,0.66)] p-5 shadow-[0_18px_44px_rgba(79,104,170,0.08)] backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <StageBadge>{ui.stageStatus}</StageBadge>
              <Bot size={17} className="text-[rgb(var(--accent))]" />
            </div>
            <p className="mt-5 text-[14px] font-medium leading-6 text-ink">{ui.stageModel}</p>
            <div className="mt-5 space-y-2">
              {['reasoning', 'vision', 'cost'].map((item, index) => (
                <div key={item} className="flex items-center justify-between rounded-full bg-white/62 px-3 py-2">
                  <span className="text-[11px] font-medium text-subtle">{item}</span>
                  <span className={clsx('h-1.5 rounded-full bg-[rgba(79,104,170,0.34)]', index === 0 ? 'w-16' : index === 1 ? 'w-12' : 'w-10')} />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[30px] border border-black/6 bg-white/62 p-5 shadow-[0_18px_44px_rgba(15,23,42,0.06)] backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <StageBadge active>{ui.stageSync}</StageBadge>
              <Sparkles size={17} className="text-[rgb(var(--accent))]" />
            </div>
            <p className="mt-5 text-[14px] font-medium leading-6 text-ink">{ui.stageMemory}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {['tone', 'length', 'context', 'style'].map((item) => (
                <span key={item} className="rounded-full border border-black/6 bg-white/72 px-2.5 py-1 text-[10px] text-subtle">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  </SceneShell>
)

const DetailCapabilityScene = ({ ui }: { ui: AuthCopy }) => (
  <SceneShell>
    <div className="grid gap-8 lg:grid-cols-[0.36fr_1fr] lg:items-center">
      <SceneTitle title={ui.detailTitle} body={ui.detailBody} />
      <div className="grid gap-4 lg:grid-cols-3">
        {[
          { label: 'File understanding', icon: FileText, body: ui.stageFile, state: 'indexed' },
          { label: 'Model routing', icon: Bot, body: ui.stageModel, state: ui.stageStatus },
          { label: 'User memory', icon: Sparkles, body: ui.stageMemory, state: ui.stageSync },
        ].map((slice, index) => {
          const Icon = slice.icon
          return (
            <motion.div
              key={slice.label}
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.42 }}
              transition={{ duration: 0.58, ease: EASE, delay: index * 0.08 }}
              whileHover={{ y: -5 }}
              className="min-h-[390px] rounded-[30px] border border-black/6 bg-white/58 p-5 shadow-[0_22px_58px_rgba(15,23,42,0.07)] backdrop-blur-xl"
            >
              <div className="flex items-center justify-between">
                <StageBadge active={index === 2}>{slice.state}</StageBadge>
                <Icon size={18} className="text-[rgb(var(--accent))]" />
              </div>
              <p className="mt-8 text-[18px] font-semibold leading-6 text-ink">{slice.label}</p>
              <p className="mt-3 text-[13px] font-medium leading-6 text-muted">{slice.body}</p>
              <div className="mt-8 space-y-3">
                <div className="rounded-[20px] border border-black/6 bg-white/72 p-4">
                  <div className="h-2 rounded-full bg-black/8" />
                  <div className="mt-2 h-2 w-[72%] rounded-full bg-black/8" />
                  <div className="mt-2 h-2 w-[45%] rounded-full bg-[rgba(79,104,170,0.24)]" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {['live', 'scoped', 'ready', 'saved'].map((item) => (
                    <span key={item} className="rounded-full bg-[rgba(246,247,250,0.92)] px-2.5 py-1.5 text-center text-[10px] font-medium text-subtle">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  </SceneShell>
)

const StabilityScene = ({ ui }: { ui: AuthCopy }) => (
  <SceneShell>
    <div className="grid gap-8 lg:grid-cols-[0.4fr_1fr] lg:items-center">
      <SceneTitle title={ui.scene5Title} body={ui.scene5Body} />
      <div className="relative min-h-[430px] overflow-hidden rounded-[30px] border border-black/6 bg-[rgba(255,255,255,0.5)] p-6 shadow-[0_26px_70px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <div className="flex flex-wrap gap-2">
          <StageBadge active>Turnstile</StageBadge>
          <StageBadge>/api</StageBadge>
          <StageBadge>single entry</StageBadge>
          <StageBadge>managed</StageBadge>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-[1fr_0.8fr]">
          <div className="rounded-[26px] border border-white/72 bg-white/76 p-5 shadow-[0_18px_42px_rgba(15,23,42,0.06)]">
            {['auth verified', 'session active', 'files scoped', 'policy clean'].map((item) => (
              <div key={item} className="flex items-center justify-between border-b border-black/6 py-3 last:border-b-0">
                <span className="text-[13px] font-medium text-ink">{item}</span>
                <span className="auth-pulse-dot h-2 w-2 rounded-full bg-emerald-500" />
              </div>
            ))}
          </div>
          <div className="rounded-[26px] border border-[rgba(79,104,170,0.12)] bg-[rgba(236,241,252,0.7)] p-5 shadow-[0_18px_42px_rgba(79,104,170,0.07)]">
            <ShieldCheck size={20} className="text-[rgb(var(--accent))]" />
            <p className="mt-6 text-[20px] font-semibold leading-7 text-ink">Aurora</p>
            <p className="mt-2 text-[13px] leading-6 text-muted">{ui.stageRoute}</p>
          </div>
        </div>
      </div>
    </div>
  </SceneShell>
)

const FinalScene = ({
  ui,
  onLogin,
  onRegister,
}: {
  ui: AuthCopy
  onLogin: () => void
  onRegister: () => void
}) => (
  <SceneShell className="pb-20">
    <div className="mx-auto max-w-[920px] text-center">
      <h2 className="text-balance text-[36px] font-semibold leading-[1.05] text-ink sm:text-[52px]">{ui.finalTitle}</h2>
      <p className="mx-auto mt-5 max-w-[560px] text-[16px] leading-8 text-muted">{ui.finalBody}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={onLogin}
          className="auth-breathe inline-flex items-center gap-2 rounded-full bg-[#111111] px-5 py-3 text-sm font-medium text-white shadow-[0_16px_34px_rgba(17,17,17,0.14)] transition duration-200 hover:bg-[#222222]"
        >
          <span>{ui.primaryCta}</span>
          <ArrowRight size={15} />
        </button>
        <button
          type="button"
          onClick={onRegister}
          className="rounded-full border border-black/8 bg-white/58 px-5 py-3 text-sm font-medium text-ink shadow-[0_10px_26px_rgba(15,23,42,0.04)] backdrop-blur-md transition duration-200 hover:bg-white"
        >
          {ui.secondaryCta}
        </button>
      </div>
    </div>
  </SceneShell>
)

export const AuthPage = ({
  error,
  security,
  loginFailureCount,
  onLogin,
  onRegister,
  onForgotPassword,
  onResetPassword,
}: AuthPageProps) => {
  const { locale } = useI18n()
  const ui = COPY_BY_LOCALE[locale] ?? enCopy
  const reduceMotion = useReducedMotion()
  const initialResetToken =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('resetToken') ??
        new URLSearchParams(window.location.search).get('token') ??
        ''
      : ''
  const [mode, setMode] = useState<AuthMode>(initialResetToken ? 'reset' : 'login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [resetToken, setResetToken] = useState(initialResetToken)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isCompact, setIsCompact] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 1023px)').matches : false,
  )
  const humanVerificationRef = useRef<HumanVerificationFieldHandle | null>(null)
  const authCardRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const mediaQuery = window.matchMedia('(max-width: 1023px)')
    const handleChange = () => setIsCompact(mediaQuery.matches)
    handleChange()

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }

    mediaQuery.addListener(handleChange)
    return () => mediaQuery.removeListener(handleChange)
  }, [])

  const shouldShowCaptcha = useMemo(() => {
    if (mode === 'register' || mode === 'forgot') return true
    if (mode === 'login' && security.provider === 'turnstile') return true
    return mode === 'login' && loginFailureCount >= 3
  }, [loginFailureCount, mode, security.provider])

  const title = {
    login: ui.loginTitle,
    register: ui.registerTitle,
    forgot: ui.forgotTitle,
    reset: ui.resetTitle,
  }[mode]

  const focusAuthCard = (nextMode: AuthMode) => {
    setMode(nextMode)
    setFeedback(null)
    authCardRef.current?.scrollIntoView({ behavior: 'smooth', block: isCompact ? 'start' : 'center' })
  }

  const submit = async () => {
    setFeedback(null)
    setLoading(true)
    try {
      if (mode === 'login') {
        await onLogin({
          email,
          password,
          captchaToken: shouldShowCaptcha ? captchaToken : null,
        })
      } else if (mode === 'register') {
        await onRegister({
          name,
          email,
          password,
          confirmPassword,
          captchaToken,
        })
      } else if (mode === 'forgot') {
        await onForgotPassword({ email, captchaToken })
        setFeedback(ui.forgotSuccess)
      } else {
        await onResetPassword({
          token: resetToken,
          password,
          confirmPassword,
        })
        setFeedback(ui.backToLogin)
        setMode('login')
        setPassword('')
        setConfirmPassword('')
      }
    } finally {
      if (shouldShowCaptcha) {
        humanVerificationRef.current?.reset()
      }
      setLoading(false)
    }
  }

  const disabled =
    loading ||
    (mode === 'login' && (!email.trim() || !password.trim() || (shouldShowCaptcha && !captchaToken.trim()))) ||
    (mode === 'register' &&
      (!name.trim() ||
        !email.trim() ||
        !password.trim() ||
        !confirmPassword.trim() ||
        !captchaToken.trim())) ||
    (mode === 'forgot' && (!email.trim() || !captchaToken.trim())) ||
    (mode === 'reset' && (!resetToken.trim() || !password.trim() || !confirmPassword.trim()))

  return (
    <main className="auth-canvas min-h-screen overflow-x-hidden text-ink">
      <div className="mx-auto flex min-h-screen max-w-[1640px] flex-col px-4 py-4 sm:px-6 sm:py-6 xl:px-8">
        <motion.header
          initial={reduceMotion ? false : { opacity: 0, y: -10 }}
          animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ duration: 0.56, ease: EASE }}
          className="flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#111111] text-[10px] font-semibold text-white shadow-[0_12px_26px_rgba(17,17,17,0.14)]">
              AU
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase text-subtle">{ui.badge}</p>
              <p className="text-[17px] font-semibold text-ink">{ui.brand}</p>
            </div>
          </div>

          <LanguageSwitcher
            compact
            className="border-white/42 bg-white/58 text-subtle shadow-[0_10px_30px_rgba(17,24,39,0.05)] backdrop-blur-md"
          />
        </motion.header>

        <section className="grid flex-1 gap-6 py-5 lg:min-h-[calc(100svh-96px)] lg:grid-cols-[minmax(230px,0.45fr)_minmax(440px,1fr)] xl:grid-cols-[minmax(230px,0.45fr)_minmax(520px,1fr)_400px] xl:items-center">
          <motion.div
            initial={reduceMotion ? false : 'hidden'}
            animate={reduceMotion ? undefined : 'visible'}
            variants={{
              hidden: {},
              visible: {
                transition: {
                  staggerChildren: 0.11,
                  delayChildren: 0.08,
                },
              },
            }}
            className="flex flex-col justify-center"
          >
            <div className="max-w-[390px] space-y-5">
              <motion.div
                variants={{
                  hidden: { opacity: 0, x: -18, filter: 'blur(8px)' },
                  visible: { opacity: 1, x: 0, filter: 'blur(0px)' },
                }}
                transition={{ duration: 0.7, ease: EASE }}
              >
                <StageBadge active>{ui.brand}</StageBadge>
              </motion.div>
              <motion.h1
                variants={{
                  hidden: { opacity: 0, y: 22, filter: 'blur(10px)' },
                  visible: { opacity: 1, y: 0, filter: 'blur(0px)' },
                }}
                transition={{ duration: 0.78, ease: EASE }}
                className="text-balance text-[34px] font-semibold leading-[1.06] text-ink sm:text-[44px] lg:text-[52px]"
              >
                {ui.heroTitle}
              </motion.h1>
              <motion.p
                variants={{
                  hidden: { opacity: 0, y: 16 },
                  visible: { opacity: 1, y: 0 },
                }}
                transition={{ duration: 0.66, ease: EASE }}
                className="text-[15px] leading-7 text-muted sm:text-[16px]"
              >
                {ui.heroBody}
              </motion.p>
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 14 },
                  visible: { opacity: 1, y: 0 },
                }}
                transition={{ duration: 0.62, ease: EASE }}
                className="flex flex-wrap gap-3 pt-1"
              >
                <button
                  type="button"
                  onClick={() => focusAuthCard('login')}
                  className="auth-breathe inline-flex items-center gap-2 rounded-full bg-[#111111] px-5 py-3 text-sm font-medium text-white shadow-[0_16px_34px_rgba(17,17,17,0.14)] transition duration-200 hover:bg-[#222222]"
                >
                  <span>{ui.primaryCta}</span>
                  <ArrowRight size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => focusAuthCard('register')}
                  className="rounded-full border border-black/8 bg-white/58 px-5 py-3 text-sm font-medium text-ink shadow-[0_10px_26px_rgba(15,23,42,0.04)] backdrop-blur-md transition duration-200 hover:bg-white"
                >
                  {ui.secondaryCta}
                </button>
              </motion.div>
            </div>
          </motion.div>

          <ProductStage ui={ui} compact={isCompact} />

          <motion.aside
            ref={authCardRef}
            initial={reduceMotion ? false : { opacity: 0, x: 18, y: 12, scale: 0.985, filter: 'blur(8px)' }}
            animate={reduceMotion ? {} : { opacity: 1, x: 0, y: 0, scale: 1, filter: 'blur(0px)' }}
            transition={{ duration: 0.82, ease: EASE, delay: 0.24 }}
            className="lg:col-span-2 xl:col-span-1 xl:sticky xl:top-6 xl:self-center"
          >
            <div className="auth-shimmer mx-auto w-full max-w-[420px] rounded-[28px] border border-white/76 bg-[rgba(255,255,255,0.82)] p-4 shadow-[0_24px_70px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur-[26px] sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase text-subtle">{ui.authKicker}</p>
                  <p className="mt-1 text-[18px] font-semibold text-ink">{ui.brand}</p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#111111] text-[10px] font-semibold text-white shadow-[0_12px_26px_rgba(17,17,17,0.14)]">
                  AU
                </div>
              </div>

              {mode !== 'forgot' && mode !== 'reset' ? (
                <LayoutGroup>
                  <div className="mt-5 rounded-full bg-white/62 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.76)]">
                    <div className="grid grid-cols-2 gap-1">
                      {(['login', 'register'] as const).map((item) => {
                        const active = mode === item
                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => {
                              setMode(item)
                              setFeedback(null)
                            }}
                            className={clsx(
                              'relative rounded-full px-4 py-2.5 text-sm font-medium transition duration-200',
                              active ? 'text-ink' : 'text-muted hover:text-ink',
                            )}
                          >
                            {active ? (
                              <motion.span
                                layoutId="auth-tab-pill"
                                className="absolute inset-0 rounded-full bg-white shadow-[0_8px_20px_rgba(15,23,42,0.06)]"
                                transition={{ duration: 0.32, ease: EASE }}
                              />
                            ) : null}
                            <span className="relative z-10">{item === 'login' ? ui.loginTab : ui.registerTab}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </LayoutGroup>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMode('login')
                    setFeedback(null)
                  }}
                  className="mt-5 text-sm font-medium text-subtle transition hover:text-ink"
                >
                  {ui.backToLogin}
                </button>
              )}

              <div className="mt-5">
                <h2 className="text-[23px] font-semibold text-ink">{title}</h2>
                <p className="mt-2 text-[13px] leading-6 text-subtle">
                  {mode === 'reset'
                    ? ui.resetHelp
                    : shouldShowCaptcha
                      ? ui.verificationHelp
                      : ui.description}
                </p>
              </div>

              <div className="mt-5 space-y-3">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={mode}
                    initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                    animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
                    exit={reduceMotion ? {} : { opacity: 0, y: -8 }}
                    transition={{ duration: 0.24, ease: EASE }}
                    className="space-y-3"
                  >
                    {mode === 'register' ? (
                      <SurfaceInput value={name} onChange={setName} placeholder={ui.name} />
                    ) : null}

                    {mode === 'login' || mode === 'register' || mode === 'forgot' ? (
                      <SurfaceInput value={email} onChange={setEmail} placeholder={ui.email} type="email" />
                    ) : null}

                    {mode === 'login' || mode === 'register' || mode === 'reset' ? (
                      <SurfaceInput value={password} onChange={setPassword} placeholder={ui.password} type="password" />
                    ) : null}

                    {mode === 'register' || mode === 'reset' ? (
                      <SurfaceInput
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        placeholder={ui.confirmPassword}
                        type="password"
                      />
                    ) : null}

                    {mode === 'reset' ? (
                      <SurfaceInput value={resetToken} onChange={setResetToken} placeholder={ui.resetToken} />
                    ) : null}
                  </motion.div>
                </AnimatePresence>

                {shouldShowCaptcha ? (
                  <div className="max-w-full overflow-hidden">
                    <HumanVerificationField
                      ref={humanVerificationRef}
                      config={security}
                      value={captchaToken}
                      onChange={setCaptchaToken}
                      label={ui.verification}
                    />
                  </div>
                ) : null}
              </div>

              {mode === 'login' ? (
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot')
                    setFeedback(null)
                  }}
                  className="mt-3 text-sm font-medium text-subtle transition hover:text-ink"
                >
                  {ui.forgotPassword}
                </button>
              ) : null}

              {error || feedback ? (
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
                  className={clsx(
                    'mt-4 rounded-[18px] border px-4 py-3 text-sm leading-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]',
                    error
                      ? 'border-red-200/70 bg-red-50/80 text-[rgb(var(--danger))]'
                      : 'border-emerald-200/70 bg-emerald-50/80 text-emerald-700',
                  )}
                >
                  {error ?? feedback}
                </motion.div>
              ) : null}

              <motion.button
                type="button"
                onClick={() => void submit()}
                disabled={disabled}
                whileHover={reduceMotion || disabled ? undefined : { y: -1, scale: 1.005 }}
                whileTap={reduceMotion || disabled ? undefined : { scale: 0.985 }}
                className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-[22px] bg-[#111111] px-4 text-sm font-medium text-white shadow-[0_16px_34px_rgba(17,17,17,0.14)] transition duration-200 hover:bg-[#222222] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>
                  {loading
                    ? ui.pleaseWait
                    : mode === 'login'
                      ? ui.loginAction
                      : mode === 'register'
                        ? ui.registerAction
                        : mode === 'forgot'
                          ? ui.forgotAction
                          : ui.resetAction}
                </span>
                {!loading ? <ArrowRight size={15} /> : null}
              </motion.button>

              <div className="mt-5 flex items-center gap-3 border-t border-black/6 pt-4 text-[12px] text-subtle">
                <div className="flex items-center gap-2">
                  <LockKeyhole size={13} />
                  <span>Turnstile</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck size={13} />
                  <span>/api</span>
                </div>
              </div>
            </div>
          </motion.aside>
        </section>
      </div>

      <OperationScene ui={ui} />
      <WorkspaceMotionScene ui={ui} />
      <StickyNarrativeScene ui={ui} />
      <JourneyScene ui={ui} />
      <CapabilityScene ui={ui} />
      <DetailCapabilityScene ui={ui} />
      <StabilityScene ui={ui} />
      <FinalScene ui={ui} onLogin={() => focusAuthCard('login')} onRegister={() => focusAuthCard('register')} />
    </main>
  )
}
