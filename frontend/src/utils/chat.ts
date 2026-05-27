import type { ChatMessage, Conversation } from '../types/chat'
import type { MarketContext } from '../types'

// ── Locale-aware market context strings ──

type Locale = 'zh-CN' | 'en-US' | 'ja-JP' | 'es-ES'

const strings = {
  'zh-CN': {
    currentTime: '当前时间',
    indicesTitle: '当前大盘指数实时数据',
    breadthTitle: '市场涨跌家数',
    up: '上涨',
    down: '下跌',
    flat: '平盘',
    total: '共',
    upRatio: '上涨占比',
    overviewPrompt: '请基于以上实时大盘数据，结合你的知识分析当前市场整体情况。引用具体指数涨跌和涨跌家数数据来支撑你的判断。',
    turnoverLabel: '两市成交额',
    turnoverSh: '沪市',
    turnoverSz: '深市',
    turnoverTotal: '合计',
    northbound: '北向资金',
    northboundNet: '净流入',
    northboundSh: '沪股通',
    northboundSz: '深股通',
    stock: '股票',
    price: '最新价',
    changePct: '涨跌幅',
    changeAmount: '涨跌额',
    prevClose: '前收盘',
    open: '开盘价',
    high: '最高价',
    low: '最低价',
    volume: '成交量',
    amount: '成交额',
    turnover: '换手率',
    marketCap: '总市值',
    pe: '市盈率PE',
    pb: '市净率PB',
    amplitude: '振幅',
    high52w: '52周最高',
    low52w: '52周最低',
    fundFlow: '资金流向（万元）',
    fundMainNet: '主力净流入',
    fundSuperLarge: '超大单净流入',
    fundLarge: '大单净流入',
    fundMedium: '中单净流入',
    fundSmall: '小单净流入',
    yuan: '元',
    yi: '亿',
    wan: '万',
    yiHand: '亿手',
    wanHand: '万手',
  },
  'en-US': {
    currentTime: 'Current time',
    indicesTitle: 'Current Market Indices (Real-time)',
    breadthTitle: 'Market Breadth',
    up: 'Up',
    down: 'Down',
    flat: 'Flat',
    total: 'Total',
    upRatio: 'Up ratio',
    overviewPrompt: 'Based on the above real-time market data, please analyze the current market situation. Reference specific index changes and breadth data to support your judgment.',
    turnoverLabel: 'Market Turnover',
    turnoverSh: 'Shanghai',
    turnoverSz: 'Shenzhen',
    turnoverTotal: 'Total',
    northbound: 'Northbound Capital',
    northboundNet: 'Net Inflow',
    northboundSh: 'SH Connect',
    northboundSz: 'SZ Connect',
    stock: 'Stock',
    price: 'Price',
    changePct: 'Change%',
    changeAmount: 'Change',
    prevClose: 'Prev Close',
    open: 'Open',
    high: 'High',
    low: 'Low',
    volume: 'Volume',
    amount: 'Amount',
    turnover: 'Turnover',
    marketCap: 'Market Cap',
    pe: 'P/E',
    pb: 'P/B',
    amplitude: 'Amplitude',
    high52w: '52W High',
    low52w: '52W Low',
    fundFlow: 'Fund Flow (10K CNY)',
    fundMainNet: 'Main Force Net',
    fundSuperLarge: 'Super Large Net',
    fundLarge: 'Large Net',
    fundMedium: 'Medium Net',
    fundSmall: 'Small Net',
    yuan: 'CNY',
    yi: '100M',
    wan: '10K',
    yiHand: '100M lots',
    wanHand: '10K lots',
  },
  'ja-JP': {
    currentTime: '現在時刻',
    indicesTitle: '現在の市場指数（リアルタイム）',
    breadthTitle: '値上がり/値下がり',
    up: '上昇',
    down: '下落',
    flat: '変わらず',
    total: '合計',
    upRatio: '上昇比率',
    overviewPrompt: '上記のリアルタイム市場データに基づいて、現在の市場全体の状況を分析してください。具体的な指数の変動と値上がり/値下がりのデータを引用して判断を裏付けてください。',
    turnoverLabel: '売買代金',
    turnoverSh: '上海',
    turnoverSz: '深セン',
    turnoverTotal: '合計',
    northbound: '北向資金',
    northboundNet: 'ネット流入',
    northboundSh: '滬股通',
    northboundSz: '深股通',
    stock: '銘柄',
    price: '価格',
    changePct: '変化率',
    changeAmount: '変動額',
    prevClose: '前日終値',
    open: '始値',
    high: '高値',
    low: '安値',
    volume: '出来高',
    amount: '売買代金',
    turnover: '回転率',
    marketCap: '時価総額',
    pe: 'PER',
    pb: 'PBR',
    amplitude: '値幅',
    high52w: '52週高値',
    low52w: '52週安値',
    fundFlow: '資金フロー（万人民元）',
    fundMainNet: '主力ネット',
    fundSuperLarge: '超大ロット',
    fundLarge: '大ロット',
    fundMedium: '中ロット',
    fundSmall: '小ロット',
    yuan: '元',
    yi: '億',
    wan: '万',
    yiHand: '億株',
    wanHand: '万株',
  },
  'es-ES': {
    currentTime: 'Hora actual',
    indicesTitle: 'Índices de Mercado Actuales (Tiempo Real)',
    breadthTitle: 'Amplitud del Mercado',
    up: 'Sube',
    down: 'Baja',
    flat: 'Plano',
    total: 'Total',
    upRatio: 'Ratio de subida',
    overviewPrompt: 'Basándose en los datos de mercado en tiempo real anteriores, analice la situación general del mercado. Haga referencia a los cambios específicos de los índices y los datos de amplitud para respaldar su juicio.',
    turnoverLabel: 'Volumen de Negociación',
    turnoverSh: 'Shanghái',
    turnoverSz: 'Shenzhen',
    turnoverTotal: 'Total',
    northbound: 'Capital Norte',
    northboundNet: 'Flujo Neto',
    northboundSh: 'SH Connect',
    northboundSz: 'SZ Connect',
    stock: 'Valor',
    price: 'Precio',
    changePct: '% Cambio',
    changeAmount: 'Cambio',
    prevClose: 'Cierre Ant.',
    open: 'Apertura',
    high: 'Máximo',
    low: 'Mínimo',
    volume: 'Volumen',
    amount: 'Importe',
    turnover: 'Rotación',
    marketCap: 'Cap. Mercado',
    pe: 'P/E',
    pb: 'P/B',
    amplitude: 'Amplitud',
    high52w: 'Máx 52 sem',
    low52w: 'Mín 52 sem',
    fundFlow: 'Flujo de Fondos (10K CNY)',
    fundMainNet: 'Neto Fuerza Principal',
    fundSuperLarge: 'Neto Súper Grande',
    fundLarge: 'Neto Grande',
    fundMedium: 'Neto Medio',
    fundSmall: 'Neto Pequeño',
    yuan: 'CNY',
    yi: '100M',
    wan: '10K',
    yiHand: '100M lotes',
    wanHand: '10K lotes',
  },
} as const

function s(locale: Locale) {
  return strings[locale] ?? strings['zh-CN']
}

// ── Formatting helpers ──

function fmtTime(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())} UTC+8`
}

export const fmtVol = (n: number, locale: Locale = 'zh-CN') => {
  const t = s(locale)
  if (n >= 1e8) return (n / 1e8).toFixed(2) + t.yiHand
  if (n >= 1e4) return (n / 1e4).toFixed(2) + t.wanHand
  return n.toFixed(0)
}

export const fmtAmt = (n: number, locale: Locale = 'zh-CN') => {
  const t = s(locale)
  if (n >= 1e8) return (n / 1e8).toFixed(2) + t.yi
  if (n >= 1e4) return (n / 1e4).toFixed(0) + t.wan
  return n.toFixed(0)
}

// ── Market context builders ──

export function buildMarketOverview(
  indices: Array<{ code: string; name: string; latest_price: number; change_pct: number }>,
  breadth: { up: number; down: number; flat: number; total: number },
  turnover: { sh_total: number; sz_total: number; total: number } | null,
  northbound: { sh_net: number; sz_net: number; total_net: number; date: string } | null,
  locale: Locale = 'zh-CN',
): string {
  const t = s(locale)
  const lines = [`【${t.currentTime}：${fmtTime()}】`, '', `【${t.indicesTitle}】`, '']
  for (const idx of indices) {
    const sign = idx.change_pct >= 0 ? '+' : ''
    lines.push(`${idx.name}（${idx.code}）：${idx.latest_price.toFixed(2)}，${t.changePct} ${sign}${idx.change_pct.toFixed(2)}%`)
  }
  lines.push('')
  lines.push(`【${t.breadthTitle}】`)
  lines.push(`${t.up} ${breadth.up} / ${t.down} ${breadth.down} / ${t.flat} ${breadth.flat}（${t.total} ${breadth.total}）`)
  const ratio = breadth.total > 0 ? ((breadth.up / breadth.total) * 100).toFixed(1) : '0'
  lines.push(`${t.upRatio}：${ratio}%`)

  if (turnover && turnover.total > 0) {
    lines.push('')
    lines.push(`【${t.turnoverLabel}】`)
    lines.push(`${t.turnoverSh}：${fmtAmt(turnover.sh_total, locale)} ${t.yuan}`)
    lines.push(`${t.turnoverSz}：${fmtAmt(turnover.sz_total, locale)} ${t.yuan}`)
    lines.push(`${t.turnoverTotal}：${fmtAmt(turnover.total, locale)} ${t.yuan}`)
  }

  if (northbound && northbound.date) {
    lines.push('')
    lines.push(`【${t.northbound}（${northbound.date}）】`)
    const nbSign = northbound.total_net >= 0 ? '+' : ''
    lines.push(`${t.northboundNet}：${nbSign}${northbound.total_net.toFixed(2)} ${t.yi}`)
    lines.push(`${t.northboundSh}：${northbound.sh_net >= 0 ? '+' : ''}${northbound.sh_net.toFixed(2)} ${t.yi}`)
    lines.push(`${t.northboundSz}：${northbound.sz_net >= 0 ? '+' : ''}${northbound.sz_net.toFixed(2)} ${t.yi}`)
  }

  lines.push('')
  lines.push(t.overviewPrompt)
  return lines.join('\n')
}

export function buildMarketContext(ctx: MarketContext, locale: Locale = 'zh-CN'): string {
  const t = s(locale)
  const lines = [
    `【${t.currentTime}：${fmtTime()}】`,
    '',
    `${t.stock}：${ctx.name}（${ctx.code}）`,
    `${t.price}：${ctx.price.toFixed(2)} ${t.yuan}`,
    `${t.changePct}：${ctx.changePct >= 0 ? '+' : ''}${ctx.changePct.toFixed(2)}%`,
    `${t.changeAmount}：${ctx.changePct >= 0 ? '+' : ''}${ctx.changeAmount.toFixed(2)}`,
    `${t.prevClose}：${ctx.prevClose.toFixed(2)}`,
    `${t.open}：${ctx.open.toFixed(2)}`,
    `${t.high}：${ctx.high.toFixed(2)}`,
    `${t.low}：${ctx.low.toFixed(2)}`,
    `${t.volume}：${fmtVol(ctx.volume, locale)}`,
    `${t.amount}：${fmtAmt(ctx.amount, locale)} ${t.yuan}`,
  ]
  if (ctx.turnover > 0) lines.push(`${t.turnover}：${ctx.turnover.toFixed(2)}%`)
  if (ctx.marketCap && ctx.marketCap > 0) lines.push(`${t.marketCap}：${ctx.marketCap.toFixed(0)} ${t.yi}`)
  if (ctx.pe && ctx.pe > 0) lines.push(`${t.pe}：${ctx.pe.toFixed(2)}`)
  if (ctx.pb && ctx.pb > 0) lines.push(`${t.pb}：${ctx.pb.toFixed(2)}`)
  if (ctx.amplitude && ctx.amplitude > 0) lines.push(`${t.amplitude}：${ctx.amplitude.toFixed(2)}%`)
  if (ctx.high52w && ctx.high52w > 0) lines.push(`${t.high52w}：${ctx.high52w.toFixed(2)}`)
  if (ctx.low52w && ctx.low52w > 0) lines.push(`${t.low52w}：${ctx.low52w.toFixed(2)}`)

  if (ctx.fundFlow) {
    lines.push('')
    lines.push(`【${t.fundFlow}】`)
    lines.push(`${t.fundMainNet}：${ctx.fundFlow.main_net >= 0 ? '+' : ''}${ctx.fundFlow.main_net.toFixed(2)} ${t.wan}`)
    lines.push(`${t.fundSuperLarge}：${ctx.fundFlow.super_large >= 0 ? '+' : ''}${ctx.fundFlow.super_large.toFixed(2)} ${t.wan}`)
    lines.push(`${t.fundLarge}：${ctx.fundFlow.large >= 0 ? '+' : ''}${ctx.fundFlow.large.toFixed(2)} ${t.wan}`)
    lines.push(`${t.fundMedium}：${ctx.fundFlow.medium >= 0 ? '+' : ''}${ctx.fundFlow.medium.toFixed(2)} ${t.wan}`)
    lines.push(`${t.fundSmall}：${ctx.fundFlow.small >= 0 ? '+' : ''}${ctx.fundFlow.small.toFixed(2)} ${t.wan}`)
  }

  return lines.join('\n')
}

// ── Chat helpers ──

export const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

interface ConversationSeed {
  selectedModelId?: string | null
  selectedProviderId?: string | null
  autoModelStrategy?: string | null
}

export const createConversation = (seed: ConversationSeed = {}): Conversation => {
  const now = new Date().toISOString()

  return {
    id: createId(),
    remoteId: null,
    title: 'New conversation',
    isCustomTitle: false,
    createdAt: now,
    updatedAt: now,
    selectedModelId: seed.selectedModelId ?? null,
    selectedProviderId: seed.selectedProviderId ?? null,
    autoModelStrategy: seed.autoModelStrategy ?? null,
    messages: [],
  }
}

export const createMessage = (
  role: ChatMessage['role'],
  content = '',
  status: ChatMessage['status'] = 'idle',
  attachments: ChatMessage['attachments'] = [],
): ChatMessage => ({
  id: createId(),
  role,
  content,
  createdAt: new Date().toISOString(),
  status,
  attachments,
})

export const deriveConversationTitle = (message: string) => {
  const clean = message.replace(/\s+/g, ' ').trim()
  if (!clean) return 'New conversation'
  return clean.length > 32 ? `${clean.slice(0, 32)}...` : clean
}

export const formatConversationTime = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))

export const formatMessageTime = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
