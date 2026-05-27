import { useState, useEffect, useCallback } from 'react'
import { Bell, Plus, Trash2, Power, Clock, History } from 'lucide-react'
import { requestJson } from '../../../services/api'
import type { AuthSession } from '../../../types/auth'

interface AlertRule {
  id: number
  name: string
  alert_type: string
  code: string
  market: string
  condition_field: string
  condition_op: string
  condition_value: number
  enabled: number
  cooldown_minutes: number
  last_triggered_at: string | null
  notify_channels: string
}

interface AlertHistoryEntry {
  id: number
  rule_id: number
  message: string
  triggered_value: number
  created_at: string
}

const ALERT_TYPE_LABELS: Record<string, string> = {
  price: '价格', indicator: '指标', news: '新闻', pnl: '盈亏', volume: '成交量',
}
const OP_LABELS: Record<string, string> = {
  gt: '>', lt: '<', gte: '>=', lte: '<=', cross_above: '上穿', cross_below: '下穿', pct_change: '涨跌幅%',
}
const FIELD_LABELS: Record<string, string> = {
  latest_price: '最新价', change_pct: '涨跌幅', volume: '成交量', turnover_rate: '换手率',
  pe: 'PE', pb: 'PB', market_cap: '市值', amplitude: '振幅', high_52w: '52周高', low_52w: '52周低',
}

interface Props {
  session: AuthSession | null
}

export function AlertPanel({ session }: Props) {
  const [rules, setRules] = useState<AlertRule[]>([])
  const [history, setHistory] = useState<AlertHistoryEntry[]>([])
  const [tab, setTab] = useState<'rules' | 'history'>('rules')
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [form, setForm] = useState({
    name: '', alert_type: 'price', code: '', market: 'CN',
    condition_field: 'latest_price', condition_op: 'gt', condition_value: '0',
    cooldown_minutes: '60', notify_channels: '',
  })

  const fetchRules = useCallback(async () => {
    if (!session) return
    try {
      const data = await requestJson<{ data: AlertRule[] }>('/api/alerts')
      setRules(data.data || [])
    } catch { /* ignore */ }
  }, [session])

  const fetchHistory = useCallback(async () => {
    if (!session) return
    try {
      const data = await requestJson<{ data: AlertHistoryEntry[] }>('/api/alerts/history?limit=100')
      setHistory(data.data || [])
    } catch { /* ignore */ }
  }, [session])

  useEffect(() => {
    fetchRules()
    fetchHistory()
    const id = setInterval(() => { fetchRules(); fetchHistory() }, 30000)
    return () => clearInterval(id)
  }, [fetchRules, fetchHistory])

  const createRule = async () => {
    await requestJson('/api/alerts', {
      method: 'POST',
      body: JSON.stringify({
        ...form,
        condition_value: parseFloat(form.condition_value) || 0,
        cooldown_minutes: parseInt(form.cooldown_minutes) || 60,
      }),
    })
    setShowForm(false)
    setForm({ name: '', alert_type: 'price', code: '', market: 'CN',
      condition_field: 'latest_price', condition_op: 'gt', condition_value: '0',
      cooldown_minutes: '60', notify_channels: '' })
    fetchRules()
  }

  const toggleRule = async (rule: AlertRule) => {
    await requestJson(`/api/alerts/${rule.id}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled: rule.enabled ? 0 : 1 }),
    })
    fetchRules()
  }

  const deleteRule = async (id: number) => {
    await requestJson(`/api/alerts/${id}`, { method: 'DELETE' })
    fetchRules()
  }

  if (!session) {
    return <div className="p-4 text-text-secondary text-xs">请先登录</div>
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-border-color bg-bg-secondary">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-accent-yellow" />
          <span className="text-xs font-medium">告警管理</span>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="text-accent-blue hover:text-text-primary text-xs flex items-center gap-1"
        >
          <Plus size={14} /> 新建
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border-color bg-bg-secondary/30">
        <button
          onClick={() => setTab('rules')}
          className={`px-3 py-1.5 text-xs border-b-2 transition-colors ${
            tab === 'rules' ? 'border-accent-blue text-accent-blue' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          规则 ({rules.length})
        </button>
        <button
          onClick={() => setTab('history')}
          className={`px-3 py-1.5 text-xs border-b-2 transition-colors ${
            tab === 'history' ? 'border-accent-blue text-accent-blue' : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <History size={12} className="inline mr-1" />历史
        </button>
      </div>

      {/* Rule creation form */}
      {showForm && (
        <div className="p-3 border-b border-border-color bg-bg-secondary/30">
          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="告警名称" className="bg-bg-primary border border-border-color rounded px-1.5 py-0.5 text-text-primary" />
            <select value={form.alert_type} onChange={(e) => setForm({ ...form, alert_type: e.target.value })}
              className="bg-bg-primary border border-border-color rounded px-1.5 py-0.5 text-text-primary">
              {Object.entries(ALERT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="股票代码 (pnl类型填组合ID)" className="bg-bg-primary border border-border-color rounded px-1.5 py-0.5 text-text-primary" />
            <select value={form.market} onChange={(e) => setForm({ ...form, market: e.target.value })}
              className="bg-bg-primary border border-border-color rounded px-1.5 py-0.5 text-text-primary">
              <option value="CN">A股</option><option value="HK">港股</option><option value="US">美股</option>
            </select>
            <select value={form.condition_field} onChange={(e) => setForm({ ...form, condition_field: e.target.value })}
              className="bg-bg-primary border border-border-color rounded px-1.5 py-0.5 text-text-primary">
              {Object.entries(FIELD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={form.condition_op} onChange={(e) => setForm({ ...form, condition_op: e.target.value })}
              className="bg-bg-primary border border-border-color rounded px-1.5 py-0.5 text-text-primary">
              {Object.entries(OP_LABELS).map(([k, v]) => <option key={k} value={k}>{v} ({k})</option>)}
            </select>
            <input type="number" step="0.01" value={form.condition_value}
              onChange={(e) => setForm({ ...form, condition_value: e.target.value })}
              placeholder="阈值" className="bg-bg-primary border border-border-color rounded px-1.5 py-0.5 text-text-primary" />
            <input type="number" value={form.cooldown_minutes}
              onChange={(e) => setForm({ ...form, cooldown_minutes: e.target.value })}
              placeholder="冷却(分钟)" className="bg-bg-primary border border-border-color rounded px-1.5 py-0.5 text-text-primary" />
          </div>
          <div className="flex gap-1.5 mt-2">
            <button onClick={createRule} className="px-3 py-0.5 bg-accent-blue text-white rounded text-[10px]">创建</button>
            <button onClick={() => setShowForm(false)} className="text-text-secondary text-[10px]">取消</button>
          </div>
        </div>
      )}

      {/* Tab: Rules */}
      {tab === 'rules' && (
        <div className="flex-1 overflow-auto">
          {rules.length > 0 ? (
            rules.map((rule) => (
              <div key={rule.id} className={`p-3 border-b border-border-color/50 ${!rule.enabled ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{rule.name || '未命名'}</span>
                    <span className="text-[10px] px-1 py-0.5 rounded bg-bg-card text-text-secondary">
                      {ALERT_TYPE_LABELS[rule.alert_type] || rule.alert_type}
                    </span>
                    {rule.code && <span className="text-[10px] text-text-secondary">{rule.code}</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => toggleRule(rule)} title={rule.enabled ? '禁用' : '启用'}>
                      <Power size={12} className={rule.enabled ? 'text-up' : 'text-text-secondary'} />
                    </button>
                    <button onClick={() => deleteRule(rule.id)}>
                      <Trash2 size={12} className="text-text-secondary hover:text-down" />
                    </button>
                  </div>
                </div>
                <div className="text-[10px] text-text-secondary mt-1">
                  {FIELD_LABELS[rule.condition_field] || rule.condition_field} {OP_LABELS[rule.condition_op] || rule.condition_op} {rule.condition_value}
                  {rule.last_triggered_at && (
                    <span className="ml-2 flex items-center gap-1 inline-flex">
                      <Clock size={10} /> 上次触发: {rule.last_triggered_at.slice(0, 16)}
                    </span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 text-text-secondary text-xs text-center">暂无告警规则</div>
          )}
        </div>
      )}

      {/* Tab: History */}
      {tab === 'history' && (
        <div className="flex-1 overflow-auto">
          {history.length > 0 ? (
            history.map((h) => (
              <div key={h.id} className="p-2 border-b border-border-color/50 text-xs">
                <div className="text-text-primary">{h.message}</div>
                <div className="text-[10px] text-text-secondary mt-0.5">
                  {h.created_at?.slice(0, 16)} · 触发值: {h.triggered_value}
                </div>
              </div>
            ))
          ) : (
            <div className="p-4 text-text-secondary text-xs text-center">暂无告警历史</div>
          )}
        </div>
      )}
    </div>
  )
}
