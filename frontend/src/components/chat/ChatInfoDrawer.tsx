import clsx from 'clsx'
import { X } from 'lucide-react'

import { useI18n } from '../../i18n/I18nProvider'
import type { ProviderCatalog, WorkspaceSummary } from '../../types/chat'
import type { LibraryItem } from '../../types/library'

interface ChatInfoDrawerProps {
  open: boolean
  catalog: ProviderCatalog | null
  libraryItems: LibraryItem[]
  workspaceSummary: WorkspaceSummary | null
  onClose: () => void
  onOpenSettings: () => void
}

const drawerCopy = {
  'zh-CN': {
    title: '工作台信息',
    runtime: '当前托管',
    notes: '工作台说明',
    usage: '使用情况',
    library: '资料库',
    noLibrary: '上传的文件会显示在这里，后续可继续追踪引用关系。',
    openSettings: '打开设置',
    switchLocked: '模型切换由管理员统一控制',
    switchOpen: '可在管理员开放的模型范围内切换',
    today: '今日',
    month: '本月',
    remaining: '剩余额度',
    cost: '预估费用',
    notesItems: [
      '普通用户直接使用平台已托管的模型，不需要自行配置 API 密钥。',
      '自动选模和手动切换都受后台策略约束，避免成本和权限失控。',
      '上传文件、对话调用和 token 消耗都会被记录，便于后续计费与追踪。',
    ],
  },
  'en-US': {
    title: 'Workspace info',
    runtime: 'Managed runtime',
    notes: 'Notes',
    usage: 'Usage',
    library: 'Library',
    noLibrary: 'Uploaded files appear here and can later be traced back to conversations.',
    openSettings: 'Open settings',
    switchLocked: 'Model switching is controlled by the administrator',
    switchOpen: 'Model switching is allowed within the managed pool',
    today: 'Today',
    month: 'Month',
    remaining: 'Remaining',
    cost: 'Est. cost',
    notesItems: [
      'Users consume managed models without entering their own API keys.',
      'Auto-routing and manual model switching are constrained by control-plane policy.',
      'Uploads, requests, and token usage are tracked for future billing and support.',
    ],
  },
  'ja-JP': {
    title: 'ワークスペース情報',
    runtime: '現在の構成',
    notes: 'メモ',
    usage: '利用状況',
    library: 'ライブラリ',
    noLibrary: 'アップロードしたファイルはここに表示され、後から会話との関連も追跡できます。',
    openSettings: '設定を開く',
    switchLocked: 'モデル切り替えは管理者が制御しています',
    switchOpen: '管理対象のモデル範囲内で切り替えできます',
    today: '今日',
    month: '今月',
    remaining: '残量',
    cost: '推定費用',
    notesItems: [
      '一般ユーザーは API キーを設定せず、管理済みモデルだけを利用します。',
      '自動選択と手動切り替えは管理者ポリシーの範囲内で動作します。',
      'アップロード、会話、token 使用量は課金や追跡のために保存されます。',
    ],
  },
  'es-ES': {
    title: 'Información',
    runtime: 'Entorno gestionado',
    notes: 'Notas',
    usage: 'Uso',
    library: 'Biblioteca',
    noLibrary: 'Los archivos cargados aparecerán aquí y luego podrán rastrearse por conversación.',
    openSettings: 'Abrir ajustes',
    switchLocked: 'El cambio de modelo está controlado por el administrador',
    switchOpen: 'Se permite cambiar dentro del conjunto gestionado',
    today: 'Hoy',
    month: 'Mes',
    remaining: 'Restante',
    cost: 'Costo est.',
    notesItems: [
      'Los usuarios consumen modelos gestionados sin configurar sus propias claves.',
      'La selección automática y el cambio manual siguen las políticas del panel de control.',
      'Las cargas, solicitudes y tokens se registran para facturación y soporte.',
    ],
  },
} as const

export const ChatInfoDrawer = ({
  open,
  catalog,
  libraryItems,
  workspaceSummary,
  onClose,
  onOpenSettings,
}: ChatInfoDrawerProps) => {
  const { locale } = useI18n()
  const copy = drawerCopy[locale]
  const runtimeProvider =
    catalog?.providers.find((provider) => provider.id === catalog.managedProviderId) ??
    catalog?.providers[0]

  return (
    <div
      className={clsx(
        'pointer-events-none fixed inset-0 z-40 transition duration-300',
        open ? 'pointer-events-auto' : '',
      )}
    >
      <div
        className={clsx(
          'absolute inset-0 bg-black/10 transition duration-300',
          open ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
      />

      <aside
        className={clsx(
          'absolute right-0 top-0 h-full w-full max-w-[390px] overflow-y-auto border-l border-white/8 bg-[#1a1a24]/98 px-5 py-5 shadow-[0_26px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl transition duration-300',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink">{copy.title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-subtle transition duration-200 hover:bg-[rgb(var(--surface-muted))] hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-8 space-y-8">
          <section>
            <p className="text-[11px] uppercase tracking-[0.22em] text-subtle">{copy.runtime}</p>
            <div className="mt-3 space-y-2 text-sm text-muted">
              <p className="font-medium text-ink">{runtimeProvider?.label ?? 'Aurora'}</p>
              <p>{catalog?.managedDefaultModel ?? workspaceSummary?.defaultModelId ?? 'qwen3-vl-plus'}</p>
              <p>{catalog?.allowUserModelSwitch ? copy.switchOpen : copy.switchLocked}</p>
            </div>
          </section>

          {workspaceSummary ? (
            <section>
              <p className="text-[11px] uppercase tracking-[0.22em] text-subtle">{copy.usage}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-[rgb(var(--surface-muted))] px-3 py-3">
                  <p className="text-xs text-subtle">{copy.today}</p>
                  <p className="mt-1 text-sm font-medium text-ink">
                    {workspaceSummary.usage.todayTokens.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-2xl bg-[rgb(var(--surface-muted))] px-3 py-3">
                  <p className="text-xs text-subtle">{copy.month}</p>
                  <p className="mt-1 text-sm font-medium text-ink">
                    {workspaceSummary.usage.monthTokens.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-2xl bg-[rgb(var(--surface-muted))] px-3 py-3">
                  <p className="text-xs text-subtle">{copy.remaining}</p>
                  <p className="mt-1 text-sm font-medium text-ink">
                    {workspaceSummary.usage.remainingMonthlyTokens.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-2xl bg-[rgb(var(--surface-muted))] px-3 py-3">
                  <p className="text-xs text-subtle">{copy.cost}</p>
                  <p className="mt-1 text-sm font-medium text-ink">
                    ${workspaceSummary.usage.monthlyEstimatedCost.toFixed(2)}
                  </p>
                </div>
              </div>

              {workspaceSummary.recentUsage.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {workspaceSummary.recentUsage.slice(0, 4).map((item) => (
                    <div key={item.id} className="rounded-2xl bg-[rgb(var(--surface-muted))] px-3 py-3">
                      <p className="line-clamp-1 text-sm font-medium text-ink">{item.lastUserMessagePreview}</p>
                      <p className="mt-1 text-xs text-subtle">
                        {item.model} · {item.totalTokens.toLocaleString()} Token · $
                        {item.estimatedCost.toFixed(3)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          <section>
            <p className="text-[11px] uppercase tracking-[0.22em] text-subtle">{copy.notes}</p>
            <div className="mt-3 space-y-2">
              {copy.notesItems.map((note) => (
                <p key={note} className="text-sm leading-6 text-muted">
                  {note}
                </p>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.22em] text-subtle">{copy.library}</p>
              <button
                type="button"
                onClick={onOpenSettings}
                className="text-xs text-subtle transition duration-200 hover:text-ink"
              >
                {copy.openSettings}
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {libraryItems.length === 0 ? (
                <p className="text-sm text-muted">{copy.noLibrary}</p>
              ) : (
                libraryItems.slice(0, 6).map((item) => (
                  <div key={item.id} className="rounded-2xl bg-[rgb(var(--surface-muted))] px-3 py-3">
                    <p className="line-clamp-1 text-sm font-medium text-ink">{item.name}</p>
                    <p className="mt-1 text-xs text-subtle">
                      {item.sizeLabel} · {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </aside>
    </div>
  )
}
