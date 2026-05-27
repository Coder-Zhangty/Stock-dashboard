import { useMemo, useState } from 'react'

import { useI18n } from '../../i18n/I18nProvider'
import type { PlatformQuotaPolicy } from '../../types/admin'
import type { UserPermissionPolicy } from '../../types/chat'
import { StatusBadge } from './StatusBadge'

interface PoliciesPanelProps {
  permissions: UserPermissionPolicy
  quotas: PlatformQuotaPolicy
  onPermissionChange: (patch: Partial<UserPermissionPolicy>) => void
  onQuotaPolicyChange: (patch: Partial<PlatformQuotaPolicy>) => void
  onSave: () => void
  saving?: boolean
}

const toggleCopy: Array<{ key: keyof UserPermissionPolicy; zh: string; en: string; zhDesc: string; enDesc: string }> = [
  {
    key: 'allowLibraryUpload',
    zh: '允许资料库上传',
    en: 'Library upload',
    zhDesc: '允许文件上传、建立索引并进入共享资料库。',
    enDesc: 'Allow file upload, indexing, and ingestion into the shared library.',
  },
  {
    key: 'allowVoiceMode',
    zh: '允许语音模式',
    en: 'Voice mode',
    zhDesc: '在普通用户工作台中开放语音模式。',
    enDesc: 'Expose voice mode in the end-user workspace.',
  },
  {
    key: 'allowWebSearch',
    zh: '允许网页搜索',
    en: 'Web search',
    zhDesc: '允许检索外部网页结果。',
    enDesc: 'Allow retrieval of current web results.',
  },
  {
    key: 'allowDeepResearch',
    zh: '允许深度研究',
    en: 'Deep research',
    zhDesc: '开放长链路推理与研究工作流。',
    enDesc: 'Expose extended reasoning and research workflows.',
  },
  {
    key: 'allowImageTools',
    zh: '允许图像工具',
    en: 'Image tools',
    zhDesc: '开放图像生成、多模态视觉能力。',
    enDesc: 'Allow image generation and multimodal visual tools.',
  },
  {
    key: 'allowAgentMode',
    zh: '允许代理模式',
    en: 'Agent mode',
    zhDesc: '允许长任务执行与自动化工作模式。',
    enDesc: 'Allow long-running agent and task automation mode.',
  },
]

type PolicyGroup = 'platform' | 'access' | 'governance'

export const PoliciesPanel = ({
  permissions,
  quotas,
  onPermissionChange,
  onQuotaPolicyChange,
  onSave,
  saving,
}: PoliciesPanelProps) => {
  const { locale } = useI18n()
  const isZh = locale === 'zh-CN'
  const [group, setGroup] = useState<PolicyGroup>('platform')

  const impactSummary = useMemo(() => {
    const affectedPolicies = [
      permissions.allowLibraryUpload,
      permissions.allowVoiceMode,
      permissions.allowWebSearch,
      permissions.allowDeepResearch,
      permissions.allowImageTools,
      permissions.allowAgentMode,
      quotas.allowModelSwitching,
      quotas.allowAutoModelSelect,
      quotas.allowVisualModels,
      quotas.allowHighCostModels,
    ].filter(Boolean).length

    const affectedFields = [
      permissions.allowLibraryUpload ? (isZh ? '资料库上传' : 'Library upload') : null,
      permissions.allowVoiceMode ? (isZh ? '语音模式' : 'Voice mode') : null,
      permissions.allowWebSearch ? (isZh ? '网页搜索' : 'Web search') : null,
      permissions.allowDeepResearch ? (isZh ? '深度研究' : 'Deep research') : null,
      permissions.allowImageTools ? (isZh ? '图像工具' : 'Image tools') : null,
      permissions.allowAgentMode ? (isZh ? '代理模式' : 'Agent mode') : null,
      quotas.allowModelSwitching ? (isZh ? '模型切换' : 'Model switching') : null,
      quotas.allowAutoModelSelect ? (isZh ? '自动选模' : 'Auto model select') : null,
      quotas.allowVisualModels ? (isZh ? '视觉模型访问' : 'Vision access') : null,
      quotas.allowHighCostModels ? (isZh ? '高成本模型访问' : 'High-cost model access') : null,
    ].filter(Boolean) as string[]

    return {
      affectedPolicies,
      affectedFields,
      affectedUsers: quotas.defaultModelLimit * 3 + quotas.defaultRequestLimitDaily,
      affectedModels: [
        quotas.allowVisualModels,
        quotas.allowHighCostModels,
        quotas.allowAutoModelSelect,
        quotas.allowModelSwitching,
      ].filter(Boolean).length + 2,
    }
  }, [isZh, permissions, quotas])

  return (
    <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
      <aside className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-subtle">
          {isZh ? '策略分组' : 'Policy areas'}
        </p>
        <div className="mt-4 space-y-2">
          {[
            ['platform', isZh ? '平台默认策略' : 'Platform defaults'],
            ['access', isZh ? '用户访问控制' : 'User access controls'],
            ['governance', isZh ? '模型治理策略' : 'Model governance'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setGroup(id as PolicyGroup)}
              className={`block w-full rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                group === id ? 'bg-[#111827] text-white' : 'text-muted hover:bg-[#fafbfd]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </aside>

      <section className="space-y-4">
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-panel">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-ink">
                {isZh ? '权限与策略' : 'Policies'}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {isZh
                  ? '维护平台默认能力开关、用户访问控制和模型治理规则。'
                  : 'Maintain platform defaults, user access controls, and model governance rules.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="rounded-full bg-[#111827] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0f172a] disabled:opacity-50"
            >
              {saving ? (isZh ? '保存中...' : 'Saving...') : isZh ? '保存变更' : 'Save changes'}
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-[#fbfcfe] px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">
                {isZh ? '策略字段数' : 'Affected policy fields'}
              </p>
              <p className="mt-2 text-2xl font-semibold text-ink">{impactSummary.affectedPolicies}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-[#fbfcfe] px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">
                {isZh ? '影响用户规模' : 'Estimated users impacted'}
              </p>
              <p className="mt-2 text-2xl font-semibold text-ink">{impactSummary.affectedUsers}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-[#fbfcfe] px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">
                {isZh ? '影响模型范围' : 'Estimated models impacted'}
              </p>
              <p className="mt-2 text-2xl font-semibold text-ink">{impactSummary.affectedModels}</p>
            </div>
          </div>
        </section>

        {group === 'platform' ? (
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-panel">
            <h3 className="text-lg font-semibold tracking-[-0.03em] text-ink">
              {isZh ? '平台默认能力' : 'Platform capabilities'}
            </h3>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {toggleCopy.map((item) => (
                <label
                  key={item.key}
                  className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-4"
                >
                  <div>
                    <p className="text-sm font-medium text-ink">{isZh ? item.zh : item.en}</p>
                    <p className="mt-1 text-sm text-muted">{isZh ? item.zhDesc : item.enDesc}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={permissions[item.key]}
                    onChange={(event) => onPermissionChange({ [item.key]: event.target.checked })}
                  />
                </label>
              ))}
            </div>
          </section>
        ) : null}

        {group === 'access' ? (
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-panel">
            <h3 className="text-lg font-semibold tracking-[-0.03em] text-ink">
              {isZh ? '用户访问控制' : 'User access control'}
            </h3>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm text-ink">
                <span>{isZh ? '允许切换模型' : 'Allow model switching'}</span>
                <input
                  type="checkbox"
                  checked={quotas.allowModelSwitching}
                  onChange={(event) => onQuotaPolicyChange({ allowModelSwitching: event.target.checked })}
                />
              </label>
              <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm text-ink">
                <span>{isZh ? '允许自动选模' : 'Allow auto model select'}</span>
                <input
                  type="checkbox"
                  checked={quotas.allowAutoModelSelect}
                  onChange={(event) => onQuotaPolicyChange({ allowAutoModelSelect: event.target.checked })}
                />
              </label>
              <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm text-ink">
                <span>{isZh ? '允许视觉模型' : 'Allow visual models'}</span>
                <input
                  type="checkbox"
                  checked={quotas.allowVisualModels}
                  onChange={(event) => onQuotaPolicyChange({ allowVisualModels: event.target.checked })}
                />
              </label>
              <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm text-ink">
                <span>{isZh ? '允许高成本模型' : 'Allow high-cost models'}</span>
                <input
                  type="checkbox"
                  checked={quotas.allowHighCostModels}
                  onChange={(event) => onQuotaPolicyChange({ allowHighCostModels: event.target.checked })}
                />
              </label>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {[
                [isZh ? '默认可见模型数' : 'Default visible models', quotas.defaultModelLimit],
                [isZh ? '默认单日请求上限' : 'Default daily requests', quotas.defaultRequestLimitDaily],
                [isZh ? '单次请求最大 Token' : 'Max tokens per request', quotas.defaultMaxRequestTokens],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-[#fbfcfe] px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-subtle">{label}</p>
                  <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {group === 'governance' ? (
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-panel">
            <h3 className="text-lg font-semibold tracking-[-0.03em] text-ink">
              {isZh ? '模型治理策略' : 'Model governance'}
            </h3>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 px-4 py-4">
                <p className="text-sm font-medium text-ink">{isZh ? '即时影响' : 'Immediate impact'}</p>
                <p className="mt-2 text-sm leading-7 text-muted">
                  {isZh
                    ? '保存后将立即影响普通用户可见模型范围、自动选模能力和高成本模型访问资格。'
                    : 'Saving will immediately affect visible models, auto-selection access, and high-cost model eligibility.'}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 px-4 py-4">
                <p className="text-sm font-medium text-ink">{isZh ? '受影响字段' : 'Affected fields'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {impactSummary.affectedFields.length ? (
                    impactSummary.affectedFields.map((field) => (
                      <StatusBadge key={field} tone="info">
                        {field}
                      </StatusBadge>
                    ))
                  ) : (
                    <StatusBadge tone="default">{isZh ? '暂无显著策略项' : 'No active policy flags'}</StatusBadge>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-amber-900">
                  {isZh ? '保存前提示' : 'Before saving'}
                </p>
                <StatusBadge tone="warning">{isZh ? '立即生效' : 'Immediate'}</StatusBadge>
              </div>
              <ul className="mt-3 space-y-2 text-sm leading-7 text-amber-800">
                <li>
                  {isZh
                    ? '将影响普通用户的模型切换能力、自动选模能力与高成本模型访问资格。'
                    : 'Will affect end-user model switching, auto model selection, and high-cost model access.'}
                </li>
                <li>
                  {isZh
                    ? '将影响后续新增用户继承的默认访问策略。'
                    : 'Will affect the default access baseline inherited by newly created users.'}
                </li>
                <li>
                  {isZh
                    ? '保存后会写入审计日志，并记录为策略变更事件。'
                    : 'Saving will write an audit-log record and register a policy-change event.'}
                </li>
              </ul>
            </div>
          </section>
        ) : null}
      </section>
    </div>
  )
}
