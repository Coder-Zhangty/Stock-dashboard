import { Check, ChevronDown, Info, Mic, MessageSquarePlus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useI18n } from '../../i18n/I18nProvider'
import type { Conversation, WorkspaceUsageSummary } from '../../types/chat'

interface ChatHeaderProps {
  conversation?: Conversation
  allowVoiceMode?: boolean
  allowModelSwitch?: boolean
  modelGroups?: Array<{
    providerId: string
    providerLabel: string
    models: Array<{
      id: string
      label: string
      description?: string | null
      type?: string | null
      contextWindow?: number | null
      tags: string[]
      inputPricePer1k?: number | null
      outputPricePer1k?: number | null
    }>
  }>
  currentProviderId?: string
  currentModel?: string
  usageSummary?: WorkspaceUsageSummary
  onCreateConversation: () => void
  onModelChange?: (modelId: string) => void
  onOpenInfo: () => void
  onToggleVoice: () => void
}

const infoLabels = {
  'zh-CN': '工作台信息',
  'en-US': 'Workspace info',
  'ja-JP': 'ワークスペース情報',
  'es-ES': 'Información',
} as const

const providerLabels = {
  'zh-CN': '模型厂家',
  'en-US': 'Provider',
  'ja-JP': '提供元',
  'es-ES': 'Proveedor',
} as const

const modelLabels = {
  'zh-CN': '具体模型',
  'en-US': 'Model',
  'ja-JP': 'モデル',
  'es-ES': 'Modelo',
} as const

const describeModel = (
  model: {
    label: string
    description?: string | null
    type?: string | null
    contextWindow?: number | null
    tags: string[]
    inputPricePer1k?: number | null
    outputPricePer1k?: number | null
  },
  locale: keyof typeof modelLabels,
) => {
  if (model.description) return model.description
  const isZh = locale === 'zh-CN'
  const traits = [
    model.type ? (isZh ? `类型：${model.type}` : `Type: ${model.type}`) : null,
    model.contextWindow ? (isZh ? `上下文：${model.contextWindow.toLocaleString()}` : `Context: ${model.contextWindow.toLocaleString()}`) : null,
    model.tags.length ? (isZh ? `标签：${model.tags.join(', ')}` : `Tags: ${model.tags.join(', ')}`) : null,
    typeof model.inputPricePer1k === 'number' || typeof model.outputPricePer1k === 'number'
      ? isZh
        ? `价格：$${model.inputPricePer1k ?? 0}/$${model.outputPricePer1k ?? 0} 每 1k tokens`
        : `Pricing: $${model.inputPricePer1k ?? 0}/$${model.outputPricePer1k ?? 0} per 1k tokens`
      : null,
  ].filter(Boolean)
  return traits.join(' · ') || (isZh ? '管理员开放的托管模型。' : 'Managed model enabled by the administrator.')
}

export const ChatHeader = ({
  conversation,
  allowVoiceMode = true,
  allowModelSwitch = false,
  modelGroups = [],
  currentProviderId,
  currentModel,
  usageSummary,
  onCreateConversation,
  onModelChange,
  onOpenInfo,
  onToggleVoice,
}: ChatHeaderProps) => {
  const { locale, t } = useI18n()
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeProviderId, setActiveProviderId] = useState<string | null>(
    () => currentProviderId ?? modelGroups[0]?.providerId ?? null,
  )
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [menuOpen])

  const selectedProvider =
    modelGroups.find((group) => group.providerId === currentProviderId) ?? modelGroups[0]
  const selectedModel =
    selectedProvider?.models.find((item) => item.id === currentModel) ?? selectedProvider?.models[0]
  const visibleProvider =
    modelGroups.find((group) => group.providerId === activeProviderId) ?? selectedProvider ?? modelGroups[0]

  const compactUsage = useMemo(() => {
    if (!usageSummary) return null
    return locale === 'zh-CN'
      ? `今日 ${usageSummary.todayTokens.toLocaleString()} Token`
      : `${usageSummary.todayTokens.toLocaleString()} today`
  }, [locale, usageSummary])

  return (
    <header className="aurora-enter-header relative z-20 border-b border-[rgb(var(--border))] bg-[rgb(var(--bg))]/80 px-6 py-3.5 backdrop-blur-xl sm:px-10">
      <div className="mx-auto flex w-full max-w-[900px] items-center justify-between gap-6">
        <div className="min-w-0">
          <p className="truncate text-[20px] font-semibold tracking-[-0.04em] text-ink">
            {conversation?.title ?? t('chat.titleFallback')}
          </p>
          {compactUsage ? (
            <div className="mt-1.5 inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-subtle">
              <span className="h-1.5 w-1.5 rounded-full bg-[rgba(79,104,170,0.76)] shadow-[0_0_10px_rgba(79,104,170,0.34)]" />
              <span>{compactUsage}</span>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {allowModelSwitch && modelGroups.length > 0 ? (
            <div ref={menuRef} className="relative hidden md:block">
              <button
                type="button"
                onClick={() => {
                  if (!menuOpen) {
                    setActiveProviderId(currentProviderId ?? modelGroups[0]?.providerId ?? null)
                  }
                  setMenuOpen((current) => !current)
                }}
                className="group inline-flex min-w-[324px] items-center gap-2.5 rounded-full border border-white/10 bg-[linear-gradient(180deg,rgba(40,40,52,0.96),rgba(30,30,42,0.92))] px-3.5 py-[7px] shadow-[0_14px_32px_rgba(0,0,0,0.2)] backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:border-[rgba(96,165,250,0.25)] hover:shadow-[0_18px_38px_rgba(0,0,0,0.3)] active:translate-y-0"
              >
                <span className="rounded-full border border-white/8 bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-semibold leading-none tracking-[0.05em] text-subtle">
                  {modelLabels[locale]}
                </span>
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-[10px] font-medium leading-[1.05] tracking-[0.02em] text-subtle">
                    {selectedProvider?.providerLabel}
                  </p>
                  <p className="truncate text-[16px] font-semibold leading-[1.05] tracking-[-0.025em] text-ink">
                    {selectedModel?.label}
                  </p>
                </div>
                <ChevronDown
                  size={14}
                  className={`shrink-0 text-subtle transition ${menuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {menuOpen ? (
                <div className="absolute right-0 top-[calc(100%+12px)] z-30 w-[520px] overflow-hidden rounded-[28px] border border-white/10 bg-[#1c1c28]/98 shadow-[0_30px_80px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
                  <div className="flex min-h-[280px]">
                    <div className="w-[190px] shrink-0 border-r border-white/6 bg-[linear-gradient(180deg,rgba(30,30,42,0.96),rgba(26,26,38,0.94))] p-3">
                      <p className="px-2.5 pb-3 pt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-subtle">
                        {providerLabels[locale]}
                      </p>
                      <div className="space-y-1">
                        {modelGroups.map((group) => {
                          const active = visibleProvider?.providerId === group.providerId
                          return (
                            <button
                              key={group.providerId}
                              type="button"
                              onClick={() => setActiveProviderId(group.providerId)}
                              className={`flex w-full items-center rounded-[18px] px-3 py-2.5 text-left text-[13px] font-medium transition ${
                                active
                                  ? 'bg-white/[0.10] text-ink shadow-[0_8px_18px_rgba(0,0,0,0.15)]'
                                  : 'text-muted hover:-translate-y-0.5 hover:bg-white/[0.08] hover:text-ink hover:shadow-[0_6px_14px_rgba(0,0,0,0.1)]'
                              }`}
                            >
                              <span className="truncate">{group.providerLabel}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1 p-3">
                      <p className="px-2.5 pb-3 pt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-subtle">
                        {modelLabels[locale]}
                      </p>
                      <div className="space-y-1">
                        {visibleProvider?.models.map((model) => {
                          const active = model.id === currentModel
                          return (
                            <button
                              key={model.id}
                              type="button"
                              onClick={() => {
                                onModelChange?.(model.id)
                                setMenuOpen(false)
                              }}
                              className={`flex w-full items-center justify-between rounded-[18px] px-3 py-2.5 text-left transition ${
                                active
                                  ? 'bg-[linear-gradient(145deg,#111827,#263249)] text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)]'
                                  : 'text-ink hover:-translate-y-0.5 hover:bg-[rgb(var(--surface-muted))] hover:shadow-[0_6px_14px_rgba(15,23,42,0.04)]'
                              }`}
                            >
                              <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{model.label}</span>
                              <span className="group/info relative shrink-0">
                                <span
                                  tabIndex={0}
                                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] transition ${
                                    active ? 'bg-white/12 text-white/78' : 'bg-white/[0.08] text-subtle hover:text-ink'
                                  }`}
                                  aria-label={describeModel(model, locale)}
                                >
                                  ?
                                </span>
                                <span className="pointer-events-none absolute right-0 top-[calc(100%+8px)] z-40 w-64 rounded-2xl border border-white/10 bg-[#282838] px-3 py-2 text-left text-xs leading-5 text-ink opacity-0 shadow-[0_18px_40px_rgba(0,0,0,0.5)] transition group-hover/info:opacity-100 group-focus-within/info:opacity-100">
                                  {describeModel(model, locale)}
                                </span>
                              </span>
                              {active ? <Check size={14} className="shrink-0" /> : null}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            onClick={onCreateConversation}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/8 bg-white/[0.06] text-muted transition duration-200 hover:-translate-y-0.5 hover:bg-white/[0.12] hover:text-ink md:hidden"
            aria-label={t('chat.newChat')}
          >
            <MessageSquarePlus size={16} />
          </button>

          {allowVoiceMode ? (
            <button
              type="button"
              onClick={onToggleVoice}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/8 bg-white/[0.06] text-muted transition duration-200 hover:-translate-y-0.5 hover:bg-white/[0.12] hover:text-ink"
              aria-label={t('chat.advancedVoice')}
            >
              <Mic size={15} />
            </button>
          ) : null}

          <button
            type="button"
            onClick={onOpenInfo}
            className="inline-flex h-10 items-center justify-center rounded-full border border-white/8 bg-white/[0.06] px-3.5 text-[13px] font-medium text-ink transition duration-200 hover:-translate-y-0.5 hover:bg-white/[0.12]"
            aria-label={infoLabels[locale]}
          >
            <Info size={15} />
          </button>
        </div>
      </div>
    </header>
  )
}
