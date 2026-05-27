import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Minus, Target, Shield, AlertTriangle, Zap, BarChart3, Activity } from 'lucide-react'
import { requestJson } from '../../../services/api'

interface DecisionDashboard {
  code: string
  name: string
  market: string
  generated_at: string
  price_at_analysis: number
  core_conclusion: {
    direction: string
    confidence: number
    summary: string
  }
  data_perspective: {
    trend: {
      direction: string
      ma_arrangement: string
      strength: string
      description: string
    }
    price_position: {
      current: number
      support: number
      resistance: number
      pct_to_support: number
      pct_to_resistance: number
      description: string
    }
    volume: {
      status: string
      volume_ratio: number
      price_volume_relation: string
      description: string
    }
  }
  intelligence: {
    news_summary: string
    risk_alerts: string[]
    catalysts: string[]
    recent_news: { title: string; source: string; time: string; sentiment: string }[]
  }
  battle_plan: {
    buy_point: number
    sell_point: number
    stop_loss: number
    position_advice: string
    position_pct: number
    action_items: string[]
  }
}

function ConfidenceRing({ value }: { value: number }) {
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference
  const color = value >= 70 ? '#22c55e' : value >= 50 ? '#eab308' : '#ef4444'

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={72} height={72}>
        <circle cx={36} cy={36} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={5} />
        <circle
          cx={36} cy={36} r={radius}
          fill="none" stroke={color} strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 36 36)"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <span className="absolute text-lg font-bold" style={{ color }}>{value}</span>
    </div>
  )
}

function DecisionHeader({
  direction, confidence, summary, price, name
}: {
  direction: string; confidence: number; summary: string; price: number; name: string
}) {
  const icon = direction === 'bullish' ? <TrendingUp size={24} className="text-up" />
    : direction === 'bearish' ? <TrendingDown size={24} className="text-down" />
    : <Minus size={24} className="text-text-secondary" />

  const label = direction === 'bullish' ? '看多' : direction === 'bearish' ? '看空' : '中性'
  const bgColor = direction === 'bullish' ? 'bg-up/10 border-up/20' : direction === 'bearish' ? 'bg-down/10 border-down/20' : 'bg-text-secondary/10 border-text-secondary/20'

  return (
    <div className={`p-4 rounded-lg border ${bgColor} mb-3`}>
      <div className="flex items-center gap-4">
        <ConfidenceRing value={confidence} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {icon}
            <span className="text-sm font-bold">{name}</span>
            <span className="text-xs text-text-secondary">{price.toFixed(2)}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
              direction === 'bullish' ? 'bg-up/20 text-up' : direction === 'bearish' ? 'bg-down/20 text-down' : 'bg-text-secondary/20 text-text-secondary'
            }`}>
              {label} · 信心 {confidence}
            </span>
          </div>
          <p className="text-xs text-text-primary leading-relaxed">{summary}</p>
        </div>
      </div>
    </div>
  )
}

export default function AIDecisionPanel({ code, market }: { code: string; market: string }) {
  const [data, setData] = useState<DecisionDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!code) return
    let active = true
    setLoading(true)
    setError(null)
    // Use fast mode for instant results; remove 'fast' param for full LLM analysis
    requestJson<any>(`/api/analysis/stock/${code}?market=${market}&fast=true`)
      .then(d => { if (active) setData(d) })
      .catch(e => { if (active) setError(e.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [code, market])

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-accent-blue border-t-transparent rounded-full mb-2" />
        <p className="text-xs text-text-secondary animate-pulse">AI 正在分析 {code}...</p>
      </div>
    )
  }

  if (error || !data) {
    return <p className="text-xs text-text-secondary p-4">AI 分析暂不可用: {error || '无数据'}</p>
  }

  const { core_conclusion: cc, data_perspective: dp, intelligence: intel, battle_plan: bp } = data

  return (
    <div className="space-y-3">
      <DecisionHeader
        direction={cc.direction} confidence={cc.confidence}
        summary={cc.summary} price={data.price_at_analysis} name={data.name}
      />

      <div className="grid grid-cols-3 gap-3">
        {/* Trend */}
        <div className="card">
          <h4 className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1">
            <Activity size={12} /> 趋势状态
          </h4>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-text-secondary">方向</span>
              <span className={`font-medium ${
                dp.trend.direction === 'upward' ? 'text-up' : dp.trend.direction === 'downward' ? 'text-down' : 'text-text-secondary'
              }`}>{dp.trend.direction}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">均线</span>
              <span className="font-medium text-text-primary">{dp.trend.ma_arrangement}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">强度</span>
              <span className="font-medium text-text-primary">{dp.trend.strength}</span>
            </div>
            <p className="text-[10px] text-text-secondary leading-relaxed mt-1">{dp.trend.description}</p>
          </div>
        </div>

        {/* Price Position */}
        <div className="card">
          <h4 className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1">
            <Target size={12} /> 价格位置
          </h4>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-text-secondary">支撑</span>
              <span className="font-mono text-up">{dp.price_position.support?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">阻力</span>
              <span className="font-mono text-down">{dp.price_position.resistance?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">距支撑</span>
              <span className="font-mono text-up">+{dp.price_position.pct_to_support}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">距阻力</span>
              <span className="font-mono text-down">-{dp.price_position.pct_to_resistance}%</span>
            </div>
          </div>
        </div>

        {/* Volume */}
        <div className="card">
          <h4 className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1">
            <BarChart3 size={12} /> 量能分析
          </h4>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-text-secondary">状态</span>
              <span className="font-medium text-text-primary">{dp.volume.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">量价</span>
              <span className="font-medium text-text-primary">{dp.volume.price_volume_relation}</span>
            </div>
            <p className="text-[10px] text-text-secondary leading-relaxed mt-1">{dp.volume.description}</p>
          </div>
        </div>
      </div>

      {/* Battle Plan */}
      <div className="card">
        <h4 className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1">
          <Target size={12} /> 作战计划
        </h4>
        <div className="grid grid-cols-4 gap-3 mb-2">
          <div className="text-center">
            <span className="text-[10px] text-text-secondary block">入场点</span>
            <span className="text-sm font-mono font-bold text-up">{bp.buy_point?.toFixed(2)}</span>
          </div>
          <div className="text-center">
            <span className="text-[10px] text-text-secondary block">目标价</span>
            <span className="text-sm font-mono font-bold text-text-primary">{bp.sell_point?.toFixed(2)}</span>
          </div>
          <div className="text-center">
            <span className="text-[10px] text-text-secondary block">止损线</span>
            <span className="text-sm font-mono font-bold text-down">{bp.stop_loss?.toFixed(2)}</span>
          </div>
          <div className="text-center">
            <span className="text-[10px] text-text-secondary block">建议仓位</span>
            <span className="text-sm font-mono font-bold text-accent-blue">{bp.position_pct}%</span>
          </div>
        </div>
        {bp.position_advice && (
          <p className="text-[10px] text-text-secondary mb-2">{bp.position_advice}</p>
        )}
        {bp.action_items.length > 0 && (
          <ul className="space-y-0.5">
            {bp.action_items.map((item, i) => (
              <li key={i} className="text-[10px] text-text-primary flex items-start gap-1">
                <Zap size={10} className="text-accent-blue mt-0.5 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Intelligence */}
      <div className="card">
        <h4 className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1">
          <Activity size={12} /> 情报面
        </h4>
        {intel.news_summary && (
          <p className="text-xs text-text-primary mb-2">{intel.news_summary}</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          {intel.risk_alerts.length > 0 && (
            <div>
              <span className="text-[10px] font-medium text-down flex items-center gap-1 mb-1">
                <AlertTriangle size={10} /> 风险提示
              </span>
              <ul className="space-y-0.5">
                {intel.risk_alerts.map((r, i) => (
                  <li key={i} className="text-[10px] text-text-secondary">{r}</li>
                ))}
              </ul>
            </div>
          )}
          {intel.catalysts.length > 0 && (
            <div>
              <span className="text-[10px] font-medium text-up flex items-center gap-1 mb-1">
                <Shield size={10} /> 催化剂
              </span>
              <ul className="space-y-0.5">
                {intel.catalysts.map((c, i) => (
                  <li key={i} className="text-[10px] text-text-secondary">{c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
