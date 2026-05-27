import { Filter, X } from 'lucide-react'
import { useI18n } from '../../../i18n/I18nProvider'

interface FilterBarProps {
  showFilters: boolean
  onToggle: () => void
  filterCount: number
  filterPriceMin: string; filterPriceMax: string
  filterChangeMin: string; filterChangeMax: string
  filterVolumeMin: string
  filterTurnoverMin: string; filterTurnoverMax: string
  filterVolumeRatioMin: string; filterVolumeRatioMax: string
  filterPeMin: string; filterPeMax: string
  filterPbMin: string; filterPbMax: string
  filterAmplitudeMin: string; filterAmplitudeMax: string
  filterMcapMin: string; filterMcapMax: string
  onPriceMinChange: (v: string) => void; onPriceMaxChange: (v: string) => void
  onChangeMinChange: (v: string) => void; onChangeMaxChange: (v: string) => void
  onVolumeMinChange: (v: string) => void
  onTurnoverMinChange: (v: string) => void; onTurnoverMaxChange: (v: string) => void
  onVolumeRatioMinChange: (v: string) => void; onVolumeRatioMaxChange: (v: string) => void
  onPeMinChange: (v: string) => void; onPeMaxChange: (v: string) => void
  onPbMinChange: (v: string) => void; onPbMaxChange: (v: string) => void
  onAmplitudeMinChange: (v: string) => void; onAmplitudeMaxChange: (v: string) => void
  onMcapMinChange: (v: string) => void; onMcapMaxChange: (v: string) => void
  onClear: () => void
}

const inputCls = 'w-16 bg-bg-primary border border-border-color rounded px-1.5 py-0.5 text-[10px] text-text-primary focus:outline-none focus:border-accent-blue'
const sep = <span className="text-text-secondary mx-0.5">-</span>
const divider = <span className="text-text-secondary mx-1">|</span>

function RangeInputs({ min, max, onMin, onMax, minPH, maxPH, step }: {
  min: string; max: string; onMin: (v: string) => void; onMax: (v: string) => void
  minPH: string; maxPH: string; step?: string
}) {
  return (
    <>
      <input type="number" step={step || '0.01'} placeholder={minPH} value={min}
        onChange={(e) => onMin(e.target.value)} className={inputCls} />
      {sep}
      <input type="number" step={step || '0.01'} placeholder={maxPH} value={max}
        onChange={(e) => onMax(e.target.value)} className={inputCls} />
    </>
  )
}

export function FilterBar({
  showFilters, onToggle, filterCount,
  filterPriceMin, filterPriceMax, filterChangeMin, filterChangeMax, filterVolumeMin,
  filterTurnoverMin, filterTurnoverMax, filterVolumeRatioMin, filterVolumeRatioMax,
  filterPeMin, filterPeMax, filterPbMin, filterPbMax,
  filterAmplitudeMin, filterAmplitudeMax, filterMcapMin, filterMcapMax,
  onPriceMinChange, onPriceMaxChange, onChangeMinChange, onChangeMaxChange, onVolumeMinChange,
  onTurnoverMinChange, onTurnoverMaxChange, onVolumeRatioMinChange, onVolumeRatioMaxChange,
  onPeMinChange, onPeMaxChange, onPbMinChange, onPbMaxChange,
  onAmplitudeMinChange, onAmplitudeMaxChange, onMcapMinChange, onMcapMaxChange,
  onClear,
}: FilterBarProps) {
  const { t } = useI18n()

  return (
    <div className="px-3 py-1 border-b border-border-color bg-bg-secondary/50">
      <button
        onClick={onToggle}
        className={`flex items-center gap-1 text-[10px] ${showFilters ? 'text-accent-blue' : 'text-text-secondary'} hover:text-text-primary`}
      >
        <Filter size={12} />
        {t('dashboard.filter.title')}
        {filterCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-accent-blue" />}
      </button>
      {showFilters && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px]">
          <RangeInputs min={filterPriceMin} max={filterPriceMax} onMin={onPriceMinChange} onMax={onPriceMaxChange}
            minPH={t('dashboard.filter.priceMin')} maxPH={t('dashboard.filter.priceMax')} />
          {divider}
          <RangeInputs min={filterChangeMin} max={filterChangeMax} onMin={onChangeMinChange} onMax={onChangeMaxChange}
            minPH={t('dashboard.filter.changeMin')} maxPH={t('dashboard.filter.changeMax')} step="0.1" />
          {divider}
          <input type="number" step="1" placeholder={t('dashboard.filter.volumeMin')}
            value={filterVolumeMin} onChange={(e) => onVolumeMinChange(e.target.value)}
            className="w-20 bg-bg-primary border border-border-color rounded px-1.5 py-0.5 text-text-primary focus:outline-none focus:border-accent-blue" />
          {divider}
          <RangeInputs min={filterTurnoverMin} max={filterTurnoverMax} onMin={onTurnoverMinChange} onMax={onTurnoverMaxChange}
            minPH={t('dashboard.filter.turnoverMin')} maxPH={t('dashboard.filter.turnoverMax')} step="0.1" />
          {divider}
          <RangeInputs min={filterVolumeRatioMin} max={filterVolumeRatioMax} onMin={onVolumeRatioMinChange} onMax={onVolumeRatioMaxChange}
            minPH={t('dashboard.filter.volumeRatioMin')} maxPH={t('dashboard.filter.volumeRatioMax')} step="0.1" />
          {divider}
          <RangeInputs min={filterPeMin} max={filterPeMax} onMin={onPeMinChange} onMax={onPeMaxChange}
            minPH={t('dashboard.filter.peMin')} maxPH={t('dashboard.filter.peMax')} step="1" />
          {divider}
          <RangeInputs min={filterPbMin} max={filterPbMax} onMin={onPbMinChange} onMax={onPbMaxChange}
            minPH={t('dashboard.filter.pbMin')} maxPH={t('dashboard.filter.pbMax')} step="0.1" />
          {divider}
          <RangeInputs min={filterAmplitudeMin} max={filterAmplitudeMax} onMin={onAmplitudeMinChange} onMax={onAmplitudeMaxChange}
            minPH={t('dashboard.filter.amplitudeMin')} maxPH={t('dashboard.filter.amplitudeMax')} step="0.1" />
          {divider}
          <RangeInputs min={filterMcapMin} max={filterMcapMax} onMin={onMcapMinChange} onMax={onMcapMaxChange}
            minPH={t('dashboard.filter.mcapMin')} maxPH={t('dashboard.filter.mcapMax')} step="1" />
          <button onClick={onClear} className="text-text-secondary hover:text-text-primary ml-1" title={t('dashboard.filter.clear')}>
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  )
}
