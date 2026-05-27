import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Briefcase, Upload, Shield, TrendingDown, AlertTriangle } from 'lucide-react'
import { requestJson } from '../../../services/api'
import type { AuthSession } from '../../../types/auth'

interface Position {
  code: string
  name: string
  quantity: number
  avg_cost: number
  current_price: number
  market_value: number
  cost_basis: number
  pnl: number
  pnl_pct: number
}

interface PortfolioSummary {
  id: number
  name: string
  initial_capital: number
  total_market_value: number
  total_cost: number
  total_pnl: number
  total_pnl_pct: number
  positions: Position[]
}

interface CashEntry {
  id: number
  type: string
  amount: number
  balance_after: number
  description: string
  created_at: string
}

interface CashSummary {
  current_balance: number
  total_deposits: number
  total_withdrawals: number
  total_dividends: number
  total_fees: number
  net_trade_cash: number
}

interface RiskReport {
  total_value: number
  var_95: number
  var_99: number
  max_drawdown: number
  max_drawdown_pct: number
  sharpe_ratio: number
  hhi: number
  concentration: Array<{ code: string; name: string; value: number; pct: number }>
  nav_count: number
}

interface CorpAction {
  id: number
  code: string
  action_type: string
  ratio: number
  amount: number
  ex_date: string
  notes: string
}

type Tab = 'positions' | 'ledger' | 'risk' | 'actions'

interface Props {
  session: AuthSession | null
}

export function PortfolioPanel({ session }: Props) {
  const [portfolios, setPortfolios] = useState<Array<{ id: number; name: string }>>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [summary, setSummary] = useState<PortfolioSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCapital, setNewCapital] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('positions')

  // Transaction form
  const [showTx, setShowTx] = useState(false)
  const [txCode, setTxCode] = useState('')
  const [txName, setTxName] = useState('')
  const [txType, setTxType] = useState<'buy' | 'sell'>('buy')
  const [txQty, setTxQty] = useState('')
  const [txPrice, setTxPrice] = useState('')

  // Cash ledger
  const [cashSummary, setCashSummary] = useState<CashSummary | null>(null)
  const [ledgerEntries, setLedgerEntries] = useState<CashEntry[]>([])
  const [showDeposit, setShowDeposit] = useState(false)
  const [depositType, setDepositType] = useState<'deposit' | 'withdraw'>('deposit')
  const [depositAmount, setDepositAmount] = useState('')
  const [depositDesc, setDepositDesc] = useState('')

  // Risk
  const [riskReport, setRiskReport] = useState<RiskReport | null>(null)

  // Corp actions
  const [corpActions, setCorpActions] = useState<CorpAction[]>([])
  const [showCorpAction, setShowCorpAction] = useState(false)
  const [caCode, setCaCode] = useState('')
  const [caType, setCaType] = useState<'dividend' | 'split' | 'rights_issue' | 'spinoff'>('dividend')
  const [caRatio, setCaRatio] = useState('')
  const [caAmount, setCaAmount] = useState('')
  const [caDate, setCaDate] = useState('')
  const [caNotes, setCaNotes] = useState('')

  // CSV import
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importMsg, setImportMsg] = useState('')

  const fetchPortfolios = useCallback(async () => {
    if (!session) return
    try {
      const data = await requestJson<any>('/api/portfolio')
      setPortfolios(data.data || [])
    } catch { /* ignore */ }
  }, [session])

  const fetchSummary = useCallback(async (id: number) => {
    setLoading(true)
    try {
      const data = await requestJson<{ data: PortfolioSummary }>(`/api/portfolio/${id}`)
      setSummary(data.data)
    } catch {
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchLedger = useCallback(async (id: number) => {
    try {
      const data = await requestJson<{ data: { entries: CashEntry[]; summary: CashSummary } }>(`/api/portfolio/${id}/ledger`)
      setLedgerEntries(data.data.entries || [])
      setCashSummary(data.data.summary || null)
    } catch { /* ignore */ }
  }, [])

  const fetchRisk = useCallback(async (id: number) => {
    try {
      const data = await requestJson<{ data: RiskReport }>(`/api/portfolio/${id}/risk`)
      setRiskReport(data.data || null)
    } catch { /* ignore */ }
  }, [])

  const fetchCorpActions = useCallback(async (id: number) => {
    try {
      const data = await requestJson<{ data: CorpAction[] }>(`/api/portfolio/${id}/corporate-actions`)
      setCorpActions(data.data || [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchPortfolios()
    const id = setInterval(fetchPortfolios, 30000)
    return () => clearInterval(id)
  }, [fetchPortfolios])

  useEffect(() => {
    if (selectedId) {
      fetchSummary(selectedId)
      fetchLedger(selectedId)
      fetchRisk(selectedId)
      fetchCorpActions(selectedId)
      const id = setInterval(() => {
        fetchSummary(selectedId)
        fetchLedger(selectedId)
      }, 5000)
      return () => clearInterval(id)
    }
  }, [selectedId, fetchSummary, fetchLedger, fetchRisk, fetchCorpActions])

  const createPortfolio = async () => {
    if (!newName.trim()) return
    const data = await requestJson<any>('/api/portfolio', {
      method: 'POST',
      body: JSON.stringify({ name: newName, initial_capital: Number(newCapital) || 0 }),
    })
    if (data) {
      setShowCreate(false)
      setNewName('')
      setNewCapital('')
      fetchPortfolios()
    }
  }

  const addTransaction = async () => {
    if (!selectedId || !txCode.trim() || !txQty || !txPrice) return
    await requestJson(`/api/portfolio/${selectedId}/transaction`, {
      method: 'POST',
      body: JSON.stringify({
        code: txCode.trim(),
        name: txName.trim(),
        tx_type: txType,
        quantity: parseInt(txQty),
        price: parseFloat(txPrice),
      }),
    })
    setShowTx(false)
    setTxCode(''); setTxName(''); setTxQty(''); setTxPrice('')
    fetchSummary(selectedId)
    fetchLedger(selectedId)
  }

  const addCashEntry = async () => {
    if (!selectedId || !depositAmount) return
    await requestJson(`/api/portfolio/${selectedId}/ledger`, {
      method: 'POST',
      body: JSON.stringify({
        type: depositType,
        amount: parseFloat(depositAmount),
        description: depositDesc,
      }),
    })
    setShowDeposit(false)
    setDepositAmount(''); setDepositDesc('')
    fetchLedger(selectedId)
  }

  const addCorpAction = async () => {
    if (!selectedId || !caCode.trim() || !caDate) return
    await requestJson(`/api/portfolio/${selectedId}/corporate-actions`, {
      method: 'POST',
      body: JSON.stringify({
        code: caCode.trim(),
        action_type: caType,
        ex_date: caDate,
        ratio: parseFloat(caRatio) || 0,
        amount: parseFloat(caAmount) || 0,
        notes: caNotes,
      }),
    })
    setShowCorpAction(false)
    setCaCode(''); setCaRatio(''); setCaAmount(''); setCaDate(''); setCaNotes('')
    fetchCorpActions(selectedId)
    fetchLedger(selectedId)
    fetchSummary(selectedId)
  }

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedId) return
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch(`/api/portfolio/${selectedId}/import`, {
        method: 'POST',
        body: form,
      })
      const json = await res.json()
      setImportMsg(`导入完成: ${json.data?.imported || 0} 条`)
      fetchSummary(selectedId)
      fetchLedger(selectedId)
    } catch {
      setImportMsg('导入失败')
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
    setTimeout(() => setImportMsg(''), 3000)
  }

  const takeSnapshot = async () => {
    if (!selectedId) return
    await requestJson(`/api/portfolio/${selectedId}/snapshot`, { method: 'POST' })
    fetchRisk(selectedId)
  }

  const pnlColor = (v: number) => v >= 0 ? 'text-up' : 'text-down'
  const fmt = (v: number, d = 2) => v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d })

  const tabs: { key: Tab; label: string }[] = [
    { key: 'positions', label: '持仓' },
    { key: 'ledger', label: '资金' },
    { key: 'risk', label: '风控' },
    { key: 'actions', label: '事件' },
  ]

  if (!session) {
    return <div className="p-4 text-text-secondary text-xs">请先登录以使用持仓管理</div>
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border-color bg-bg-secondary">
        <div className="flex items-center gap-3">
          <Briefcase size={16} className="text-accent-blue" />
          <select
            value={selectedId || ''}
            onChange={(e) => setSelectedId(Number(e.target.value) || null)}
            className="bg-bg-primary border border-border-color rounded px-2 py-1 text-xs text-text-primary"
          >
            <option value="">选择组合</option>
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleCsvImport}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-text-secondary hover:text-text-primary text-xs flex items-center gap-1"
            title="CSV导入"
          >
            <Upload size={12} />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="text-accent-blue hover:text-text-primary text-xs flex items-center gap-1"
          >
            <Plus size={14} /> 新建
          </button>
        </div>
      </div>

      {importMsg && (
        <div className="px-3 py-1 bg-accent-blue/10 text-accent-blue text-xs text-center">{importMsg}</div>
      )}

      {showCreate && (
        <div className="p-3 border-b border-border-color bg-bg-secondary/50 flex items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="组合名称"
            className="flex-1 bg-bg-primary border border-border-color rounded px-2 py-1 text-xs text-text-primary"
          />
          <input
            type="number"
            value={newCapital}
            onChange={(e) => setNewCapital(e.target.value)}
            placeholder="初始资金"
            className="w-24 bg-bg-primary border border-border-color rounded px-2 py-1 text-xs text-text-primary"
          />
          <button onClick={createPortfolio} className="px-3 py-1 bg-accent-blue text-white rounded text-xs">创建</button>
          <button onClick={() => setShowCreate(false)} className="text-text-secondary text-xs">取消</button>
        </div>
      )}

      {loading ? (
        <div className="p-4 text-text-secondary text-xs">加载中...</div>
      ) : summary ? (
        <div className="flex-1 overflow-auto flex flex-col">
          {/* Summary bar */}
          <div className="flex items-center gap-4 px-3 py-2 border-b border-border-color text-xs flex-wrap">
            <span className="text-text-secondary">{summary.name}</span>
            <span>市值 <span className="font-medium">{summary.total_market_value.toLocaleString()}</span></span>
            <span>成本 <span className="text-text-secondary">{summary.total_cost.toLocaleString()}</span></span>
            <span className={pnlColor(summary.total_pnl)}>
              {summary.total_pnl >= 0 ? '+' : ''}{summary.total_pnl.toLocaleString()}
              {' '}({summary.total_pnl_pct >= 0 ? '+' : ''}{summary.total_pnl_pct}%)
            </span>
            {cashSummary && (
              <span>现金 <span className="font-medium">{fmt(cashSummary.current_balance)}</span></span>
            )}
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-border-color bg-bg-secondary/30">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-3 py-1.5 text-xs border-b-2 transition-colors ${
                  activeTab === t.key
                    ? 'border-accent-blue text-accent-blue'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab: Positions */}
          {activeTab === 'positions' && (
            <div className="flex-1 overflow-auto">
              {summary.positions.length > 0 ? (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-bg-secondary border-b border-border-color">
                    <tr className="text-text-secondary">
                      <th className="text-left py-2 px-3">代码</th>
                      <th className="text-left py-2 px-3">名称</th>
                      <th className="text-right py-2 px-3">持仓</th>
                      <th className="text-right py-2 px-3">成本</th>
                      <th className="text-right py-2 px-3">现价</th>
                      <th className="text-right py-2 px-3">市值</th>
                      <th className="text-right py-2 px-3">盈亏</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.positions.map((pos) => (
                      <tr key={pos.code} className="border-b border-border-color/50 hover:bg-bg-card">
                        <td className="py-2 px-3 text-text-secondary">{pos.code}</td>
                        <td className="py-2 px-3">{pos.name}</td>
                        <td className="py-2 px-3 text-right">{pos.quantity}</td>
                        <td className="py-2 px-3 text-right">{pos.avg_cost.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right">{pos.current_price.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right">{pos.market_value.toLocaleString()}</td>
                        <td className={`py-2 px-3 text-right ${pnlColor(pos.pnl)}`}>
                          {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(2)} ({pos.pnl_pct >= 0 ? '+' : ''}{pos.pnl_pct}%)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-4 text-text-secondary text-xs text-center">暂无持仓</div>
              )}

              {/* Add transaction */}
              <div className="p-3 border-t border-border-color">
                <button
                  onClick={() => setShowTx(!showTx)}
                  className="text-xs text-accent-blue hover:text-text-primary flex items-center gap-1"
                >
                  <Plus size={12} /> 添加交易
                </button>
                {showTx && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <input value={txCode} onChange={(e) => setTxCode(e.target.value)} placeholder="股票代码"
                      className="w-20 bg-bg-primary border border-border-color rounded px-1.5 py-0.5 text-[10px] text-text-primary" />
                    <input value={txName} onChange={(e) => setTxName(e.target.value)} placeholder="名称"
                      className="w-20 bg-bg-primary border border-border-color rounded px-1.5 py-0.5 text-[10px] text-text-primary" />
                    <select value={txType} onChange={(e) => setTxType(e.target.value as 'buy' | 'sell')}
                      className="bg-bg-primary border border-border-color rounded px-1.5 py-0.5 text-[10px] text-text-primary">
                      <option value="buy">买入</option>
                      <option value="sell">卖出</option>
                    </select>
                    <input type="number" value={txQty} onChange={(e) => setTxQty(e.target.value)} placeholder="数量"
                      className="w-16 bg-bg-primary border border-border-color rounded px-1.5 py-0.5 text-[10px] text-text-primary" />
                    <input type="number" step="0.01" value={txPrice} onChange={(e) => setTxPrice(e.target.value)} placeholder="价格"
                      className="w-20 bg-bg-primary border border-border-color rounded px-1.5 py-0.5 text-[10px] text-text-primary" />
                    <button onClick={addTransaction}
                      className="px-2 py-0.5 bg-accent-blue text-white rounded text-[10px]">确认</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab: Ledger */}
          {activeTab === 'ledger' && (
            <div className="flex-1 overflow-auto">
              {cashSummary && (
                <div className="grid grid-cols-3 gap-2 p-3 text-xs">
                  <div className="bg-bg-card rounded p-2">
                    <div className="text-text-secondary">当前余额</div>
                    <div className="font-medium text-sm">{fmt(cashSummary.current_balance)}</div>
                  </div>
                  <div className="bg-bg-card rounded p-2">
                    <div className="text-text-secondary">累计存入</div>
                    <div className="text-up text-sm">{fmt(cashSummary.total_deposits)}</div>
                  </div>
                  <div className="bg-bg-card rounded p-2">
                    <div className="text-text-secondary">累计取出</div>
                    <div className="text-down text-sm">{fmt(cashSummary.total_withdrawals)}</div>
                  </div>
                  <div className="bg-bg-card rounded p-2">
                    <div className="text-text-secondary">股息收入</div>
                    <div className="text-up text-sm">{fmt(cashSummary.total_dividends)}</div>
                  </div>
                  <div className="bg-bg-card rounded p-2">
                    <div className="text-text-secondary">交易净现金</div>
                    <div className={`text-sm ${cashSummary.net_trade_cash >= 0 ? 'text-up' : 'text-down'}`}>
                      {cashSummary.net_trade_cash >= 0 ? '+' : ''}{fmt(cashSummary.net_trade_cash)}
                    </div>
                  </div>
                  <div className="bg-bg-card rounded p-2">
                    <div className="text-text-secondary">费用合计</div>
                    <div className="text-down text-sm">{fmt(cashSummary.total_fees)}</div>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center px-3 py-2">
                <button
                  onClick={() => { setDepositType('deposit'); setShowDeposit(true) }}
                  className="text-xs text-accent-blue hover:text-text-primary flex items-center gap-1"
                >
                  <Plus size={12} /> 出入金
                </button>
              </div>

              {showDeposit && (
                <div className="px-3 pb-2 flex items-center gap-1.5">
                  <select value={depositType} onChange={(e) => setDepositType(e.target.value as 'deposit' | 'withdraw')}
                    className="bg-bg-primary border border-border-color rounded px-1.5 py-0.5 text-[10px] text-text-primary">
                    <option value="deposit">存入</option>
                    <option value="withdraw">取出</option>
                  </select>
                  <input type="number" step="0.01" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="金额"
                    className="w-20 bg-bg-primary border border-border-color rounded px-1.5 py-0.5 text-[10px] text-text-primary" />
                  <input value={depositDesc} onChange={(e) => setDepositDesc(e.target.value)} placeholder="备注"
                    className="w-24 bg-bg-primary border border-border-color rounded px-1.5 py-0.5 text-[10px] text-text-primary" />
                  <button onClick={addCashEntry}
                    className="px-2 py-0.5 bg-accent-blue text-white rounded text-[10px]">确认</button>
                  <button onClick={() => setShowDeposit(false)} className="text-text-secondary text-[10px]">取消</button>
                </div>
              )}

              {ledgerEntries.length > 0 ? (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-bg-secondary border-b border-border-color">
                    <tr className="text-text-secondary">
                      <th className="text-left py-2 px-3">日期</th>
                      <th className="text-left py-2 px-3">类型</th>
                      <th className="text-right py-2 px-3">金额</th>
                      <th className="text-right py-2 px-3">余额</th>
                      <th className="text-left py-2 px-3">说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerEntries.map((e) => (
                      <tr key={e.id} className="border-b border-border-color/50">
                        <td className="py-1.5 px-3 text-text-secondary">{e.created_at?.slice(0, 16)}</td>
                        <td className="py-1.5 px-3">{e.type}</td>
                        <td className={`py-1.5 px-3 text-right ${e.amount >= 0 ? 'text-up' : 'text-down'}`}>
                          {e.amount >= 0 ? '+' : ''}{e.amount.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-3 text-right">{e.balance_after.toFixed(2)}</td>
                        <td className="py-1.5 px-3 text-text-secondary text-[10px] truncate max-w-[120px]">{e.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-4 text-text-secondary text-xs text-center">暂无流水</div>
              )}
            </div>
          )}

          {/* Tab: Risk */}
          {activeTab === 'risk' && (
            <div className="flex-1 overflow-auto p-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-text-secondary">风险指标</span>
                <button onClick={takeSnapshot} className="text-xs text-accent-blue hover:text-text-primary">
                  记录快照
                </button>
              </div>

              {riskReport ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-bg-card rounded p-2">
                      <div className="text-text-secondary">总资产</div>
                      <div className="font-medium">{fmt(riskReport.total_value)}</div>
                    </div>
                    <div className="bg-bg-card rounded p-2">
                      <div className="text-text-secondary">NAV 快照数</div>
                      <div className="font-medium">{riskReport.nav_count}</div>
                    </div>
                    <div className="bg-bg-card rounded p-2">
                      <div className="text-text-secondary flex items-center gap-1">
                        <Shield size={10} /> VaR 95%
                      </div>
                      <div className="text-down font-medium">{fmt(riskReport.var_95)}</div>
                    </div>
                    <div className="bg-bg-card rounded p-2">
                      <div className="text-text-secondary flex items-center gap-1">
                        <AlertTriangle size={10} /> VaR 99%
                      </div>
                      <div className="text-down font-medium">{fmt(riskReport.var_99)}</div>
                    </div>
                    <div className="bg-bg-card rounded p-2">
                      <div className="text-text-secondary flex items-center gap-1">
                        <TrendingDown size={10} /> 最大回撤
                      </div>
                      <div className="text-down font-medium">
                        {fmt(riskReport.max_drawdown)} ({riskReport.max_drawdown_pct.toFixed(2)}%)
                      </div>
                    </div>
                    <div className="bg-bg-card rounded p-2">
                      <div className="text-text-secondary">夏普比率</div>
                      <div className={`font-medium ${riskReport.sharpe_ratio >= 0 ? 'text-up' : 'text-down'}`}>
                        {riskReport.sharpe_ratio > 0 ? '+' : ''}{riskReport.sharpe_ratio.toFixed(3)}
                      </div>
                    </div>
                  </div>

                  {/* Concentration */}
                  {riskReport.concentration.length > 0 && (
                    <div>
                      <div className="text-xs text-text-secondary mb-1">
                        持仓集中度 (HHI: {riskReport.hhi.toFixed(1)})
                      </div>
                      <div className="space-y-1">
                        {riskReport.concentration.map((c) => (
                          <div key={c.code} className="flex items-center gap-2">
                            <span className="text-[10px] text-text-secondary w-14 truncate">{c.code}</span>
                            <div className="flex-1 h-3 bg-bg-primary rounded overflow-hidden">
                              <div
                                className="h-full bg-accent-blue/60 rounded transition-all"
                                style={{ width: `${Math.min(c.pct, 100)}%` }}
                              />
                            </div>
                            <span className="text-[10px] w-12 text-right">{c.pct.toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-text-secondary text-xs text-center py-4">
                  点击"记录快照"生成风险数据（需至少2天快照）
                </div>
              )}
            </div>
          )}

          {/* Tab: Corporate Actions */}
          {activeTab === 'actions' && (
            <div className="flex-1 overflow-auto">
              <div className="px-3 py-2">
                <button
                  onClick={() => setShowCorpAction(true)}
                  className="text-xs text-accent-blue hover:text-text-primary flex items-center gap-1"
                >
                  <Plus size={12} /> 添加事件
                </button>
              </div>

              {showCorpAction && (
                <div className="px-3 pb-2 flex flex-wrap items-center gap-1.5">
                  <input value={caCode} onChange={(e) => setCaCode(e.target.value)} placeholder="股票代码"
                    className="w-20 bg-bg-primary border border-border-color rounded px-1.5 py-0.5 text-[10px] text-text-primary" />
                  <select value={caType} onChange={(e) => setCaType(e.target.value as any)}
                    className="bg-bg-primary border border-border-color rounded px-1.5 py-0.5 text-[10px] text-text-primary">
                    <option value="dividend">分红</option>
                    <option value="split">拆股</option>
                    <option value="rights_issue">配股</option>
                    <option value="spinoff">分拆</option>
                  </select>
                  {caType === 'dividend' ? (
                    <input type="number" step="0.001" value={caAmount} onChange={(e) => setCaAmount(e.target.value)} placeholder="每股金额"
                      className="w-20 bg-bg-primary border border-border-color rounded px-1.5 py-0.5 text-[10px] text-text-primary" />
                  ) : (
                    <input type="number" step="0.01" value={caRatio} onChange={(e) => setCaRatio(e.target.value)} placeholder="比例"
                      className="w-16 bg-bg-primary border border-border-color rounded px-1.5 py-0.5 text-[10px] text-text-primary" />
                  )}
                  <input type="date" value={caDate} onChange={(e) => setCaDate(e.target.value)}
                    className="w-28 bg-bg-primary border border-border-color rounded px-1.5 py-0.5 text-[10px] text-text-primary" />
                  <input value={caNotes} onChange={(e) => setCaNotes(e.target.value)} placeholder="备注"
                    className="w-20 bg-bg-primary border border-border-color rounded px-1.5 py-0.5 text-[10px] text-text-primary" />
                  <button onClick={addCorpAction}
                    className="px-2 py-0.5 bg-accent-blue text-white rounded text-[10px]">确认</button>
                  <button onClick={() => setShowCorpAction(false)} className="text-text-secondary text-[10px]">取消</button>
                </div>
              )}

              {corpActions.length > 0 ? (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-bg-secondary border-b border-border-color">
                    <tr className="text-text-secondary">
                      <th className="text-left py-2 px-3">除权日</th>
                      <th className="text-left py-2 px-3">代码</th>
                      <th className="text-left py-2 px-3">类型</th>
                      <th className="text-right py-2 px-3">金额/比例</th>
                      <th className="text-left py-2 px-3">备注</th>
                    </tr>
                  </thead>
                  <tbody>
                    {corpActions.map((ca) => (
                      <tr key={ca.id} className="border-b border-border-color/50">
                        <td className="py-1.5 px-3 text-text-secondary">{ca.ex_date}</td>
                        <td className="py-1.5 px-3">{ca.code}</td>
                        <td className="py-1.5 px-3">
                          <span className={`px-1 py-0.5 rounded text-[10px] ${
                            ca.action_type === 'dividend' ? 'bg-up/10 text-up' :
                            ca.action_type === 'split' ? 'bg-accent-blue/10 text-accent-blue' :
                            'bg-text-secondary/10 text-text-secondary'
                          }`}>
                            {{ dividend: '分红', split: '拆股', rights_issue: '配股', spinoff: '分拆' }[ca.action_type] || ca.action_type}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-right">
                          {ca.action_type === 'dividend' ? `${ca.amount}/股` : ca.ratio || ca.amount || '-'}
                        </td>
                        <td className="py-1.5 px-3 text-text-secondary text-[10px]">{ca.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-4 text-text-secondary text-xs text-center">暂无公司事件</div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-text-secondary text-xs">
          {selectedId ? '加载失败' : '请选择或创建一个投资组合'}
        </div>
      )}
    </div>
  )
}
