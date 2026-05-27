import { useState, useEffect, useCallback } from 'react'
import { fetchSectors } from '../services/api'
import { useI18n } from '../i18n/I18nProvider'
import { SkeletonTable } from './common/Skeleton'

interface Sector {
  code: string
  name: string
  change_pct: number
  change_amount: number
  lead_stock: string
  lead_name: string
  up_count: number
  down_count: number
}

interface Props {
  onSelectStock: (code: string) => void
}

export default function SectorBoard({ onSelectStock }: Props) {
  const { t } = useI18n()
  const [type, setType] = useState<'industry' | 'concept'>('industry')
  const [data, setData] = useState<Sector[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (t: string) => {
    setLoading(true)
    try {
      const res = await fetchSectors(t)
      setData(res || [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(type)
  }, [type, load])

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 px-3 py-1.5 border-b border-border-color">
        <button
          onClick={() => setType('industry')}
          className={`px-2 py-0.5 text-[10px] rounded ${
            type === 'industry'
              ? 'bg-accent-blue text-white'
              : 'text-text-secondary hover:text-text-primary bg-bg-primary'
          }`}
        >
          {t('dashboard.sectors.industry')}
        </button>
        <button
          onClick={() => setType('concept')}
          className={`px-2 py-0.5 text-[10px] rounded ${
            type === 'concept'
              ? 'bg-accent-blue text-white'
              : 'text-text-secondary hover:text-text-primary bg-bg-primary'
          }`}
        >
          {t('dashboard.sectors.concept')}
        </button>
      </div>
      {loading ? (
        <SkeletonTable rows={10} cols={4} />
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-bg-secondary border-b border-border-color">
              <tr className="text-text-secondary">
                <th className="text-left py-2 px-3 font-medium">{t('dashboard.sectors.name')}</th>
                <th className="text-right py-2 px-3 font-medium">{t('dashboard.sectors.change')}</th>
                <th className="text-right py-2 px-3 font-medium">{t('dashboard.sectors.updown')}</th>
                <th className="text-left py-2 px-3 font-medium">{t('dashboard.sectors.leadStock')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((sector) => {
                const up = sector.change_pct >= 0
                const color = up ? 'text-up' : 'text-down'
                return (
                  <tr
                    key={sector.code}
                    className="border-b border-border-color/50 hover:bg-bg-card cursor-pointer transition-colors"
                    onClick={() => sector.lead_stock && onSelectStock(sector.lead_stock)}
                    title={sector.lead_stock ? `${t('dashboard.sectors.leadStock')} ${sector.lead_name}` : ''}
                  >
                    <td className="py-1.5 px-3">
                      <span className="text-text-secondary text-[10px] mr-1">{sector.code}</span>
                      {sector.name}
                    </td>
                    <td className={`py-1.5 px-3 text-right font-medium ${color}`}>
                      {up ? '+' : ''}{sector.change_pct.toFixed(2)}%
                    </td>
                    <td className="py-1.5 px-3 text-right">
                      <span className="text-up">{sector.up_count}</span>
                      <span className="text-text-secondary">/</span>
                      <span className="text-down">{sector.down_count}</span>
                    </td>
                    <td className="py-1.5 px-3">
                      {sector.lead_name ? (
                        <>
                          <span className="text-accent-blue">{sector.lead_name}</span>
                          <span className="text-text-secondary ml-1 text-[10px]">{sector.lead_stock}</span>
                        </>
                      ) : (
                        <span className="text-text-secondary">--</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
