import { Dataset } from '../../../types'
import { ExploreIcon, RefreshIcon } from '../../../components/Icons'

export interface ExploreFilters {
  datasetId: string
  junctionIds: string[]
  start: string
  end: string
  weekdays: number[]
  hourStart: number
  hourEnd: number
  weatherCondition: string
  isHoliday: string
}

export const DEFAULT_FILTERS: ExploreFilters = {
  datasetId: '',
  junctionIds: [],
  start: '',
  end: '',
  weekdays: [],
  hourStart: 0,
  hourEnd: 23,
  weatherCondition: '',
  isHoliday: 'all',
}

const WEEKDAY_OPTS = [
  { label: 'M', full: 'Mon', value: 0 },
  { label: 'T', full: 'Tue', value: 1 },
  { label: 'W', full: 'Wed', value: 2 },
  { label: 'T', full: 'Thu', value: 3 },
  { label: 'F', full: 'Fri', value: 4 },
  { label: 'S', full: 'Sat', value: 5 },
  { label: 'S', full: 'Sun', value: 6 },
]

const WEATHER_OPTS = [
  { value: '', label: 'All Weather' },
  { value: 'clear', label: '☀️ Clear' },
  { value: 'cloudy', label: '☁️ Cloudy' },
  { value: 'rain', label: '🌧️ Rain' },
  { value: 'fog', label: '🌫️ Fog' },
  { value: 'storm', label: '⛈️ Storm' },
]

const HOUR_PRESETS = [
  { label: 'All Day (24h)', start: 0, end: 23 },
  { label: 'Morning (06–10)', start: 6, end: 10 },
  { label: 'Evening (16–20)', start: 16, end: 20 },
]

interface Props {
  filters: ExploreFilters
  datasets: Dataset[]
  onChange: (f: ExploreFilters) => void
  onApply: () => void
}

export default function FilterPanel({ filters, datasets, onChange, onApply }: Props) {
  const selectedDs = datasets.find(d => d._id === filters.datasetId)
  const availableJunctions = selectedDs?.junction_ids ?? []

  const set = <K extends keyof ExploreFilters>(key: K, value: ExploreFilters[K]) =>
    onChange({ ...filters, [key]: value })

  const toggleJunction = (jid: string) => {
    const next = filters.junctionIds.includes(jid)
      ? filters.junctionIds.filter(j => j !== jid)
      : [...filters.junctionIds, jid]
    set('junctionIds', next)
  }

  const toggleWeekday = (d: number) => {
    const next = filters.weekdays.includes(d)
      ? filters.weekdays.filter(x => x !== d)
      : [...filters.weekdays, d]
    set('weekdays', next)
  }

  const resetFilters = () => {
    onChange({
      ...DEFAULT_FILTERS,
      datasetId: filters.datasetId,
    })
  }

  const hasModifications =
    filters.junctionIds.length > 0 ||
    filters.start !== '' ||
    filters.end !== '' ||
    filters.weekdays.length > 0 ||
    filters.hourStart !== 0 ||
    filters.hourEnd !== 23 ||
    filters.weatherCondition !== '' ||
    filters.isHoliday !== 'all'

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 space-y-4.5 w-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center">
            <ExploreIcon size={15} />
          </div>
          <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Telemetry Filters</h3>
        </div>
        {hasModifications && (
          <button
            onClick={resetFilters}
            className="text-[11px] font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1 transition-colors"
          >
            <RefreshIcon size={12} />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Dataset Selector */}
      <div>
        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
          Select Dataset <span className="text-rose-500">*</span>
        </label>
        <select
          className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium w-full bg-slate-50/50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-slate-800"
          value={filters.datasetId}
          onChange={e => onChange({ ...DEFAULT_FILTERS, datasetId: e.target.value })}
        >
          <option value="">Select a validated dataset…</option>
          {datasets
            .filter(d => ['validated', 'processed'].includes(d.status))
            .map(d => (
              <option key={d._id} value={d._id}>
                {d.name} ({d.row_count?.toLocaleString()} rows)
              </option>
            ))}
        </select>
      </div>

      {/* Junctions */}
      {availableJunctions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
              Junctions
            </label>
            <span className="text-[10px] text-slate-400 font-medium">
              {filters.junctionIds.length === 0 ? 'All active' : `${filters.junctionIds.length} selected`}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {availableJunctions.map(jid => {
              const active = filters.junctionIds.includes(jid) || filters.junctionIds.length === 0
              return (
                <button
                  type="button"
                  key={jid}
                  onClick={() => toggleJunction(jid)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition-all duration-150 ${
                    active
                      ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {jid}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Date Range */}
      <div>
        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
          Date Window
        </label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="block text-[10px] text-slate-400 mb-0.5 font-medium">From</span>
            <input
              type="date"
              className="border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono w-full bg-slate-50/50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-slate-800"
              value={filters.start}
              onChange={e => set('start', e.target.value)}
            />
          </div>
          <div>
            <span className="block text-[10px] text-slate-400 mb-0.5 font-medium">To</span>
            <input
              type="date"
              className="border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-mono w-full bg-slate-50/50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-slate-800"
              value={filters.end}
              onChange={e => set('end', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Weekdays Grid */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
            Days of Week
          </label>
          <span className="text-[10px] text-slate-400 font-medium">
            {filters.weekdays.length === 0 ? 'All 7 days' : `${filters.weekdays.length} days`}
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAY_OPTS.map(({ label, full, value }) => {
            const active = filters.weekdays.includes(value) || filters.weekdays.length === 0
            return (
              <button
                type="button"
                key={value}
                onClick={() => toggleWeekday(value)}
                title={full}
                className={`py-1.5 rounded-lg text-xs font-bold border transition-all text-center ${
                  active
                    ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Hour Range (Clean & Overflow-Free) */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">
            Hour Window
          </label>
          <span className="text-[11px] font-mono font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
            {String(filters.hourStart).padStart(2, '0')}:00 – {String(filters.hourEnd).padStart(2, '0')}:00
          </span>
        </div>

        {/* Quick presets */}
        <div className="grid grid-cols-3 gap-1 mb-2">
          {HOUR_PRESETS.map((p, idx) => {
            const isActive = filters.hourStart === p.start && filters.hourEnd === p.end
            return (
              <button
                type="button"
                key={idx}
                onClick={() => onChange({ ...filters, hourStart: p.start, hourEnd: p.end })}
                className={`py-1 px-1 rounded-md text-[10px] font-semibold border text-center transition-all truncate ${
                  isActive
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {p.label.split(' ')[0]}
              </button>
            )
          })}
        </div>

        {/* Custom Hour Selectors */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="block text-[10px] text-slate-400 mb-0.5 font-medium">Start Hour</span>
            <select
              className="border border-slate-200 rounded-xl px-2 py-1.5 text-xs font-mono w-full bg-slate-50/50 hover:bg-white text-slate-800 focus:ring-2 focus:ring-sky-500"
              value={filters.hourStart}
              onChange={e => {
                const val = Number(e.target.value)
                onChange({ ...filters, hourStart: val, hourEnd: Math.max(val, filters.hourEnd) })
              }}
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>
                  {String(i).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="block text-[10px] text-slate-400 mb-0.5 font-medium">End Hour</span>
            <select
              className="border border-slate-200 rounded-xl px-2 py-1.5 text-xs font-mono w-full bg-slate-50/50 hover:bg-white text-slate-800 focus:ring-2 focus:ring-sky-500"
              value={filters.hourEnd}
              onChange={e => {
                const val = Number(e.target.value)
                onChange({ ...filters, hourEnd: val, hourStart: Math.min(val, filters.hourStart) })
              }}
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>
                  {String(i).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Weather */}
      <div>
        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
          Weather Conditions
        </label>
        <select
          className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium w-full bg-slate-50/50 hover:bg-white focus:bg-white text-slate-800"
          value={filters.weatherCondition}
          onChange={e => set('weatherCondition', e.target.value)}
        >
          {WEATHER_OPTS.map(c => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Holiday */}
      <div>
        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
          Public Holiday Status
        </label>
        <select
          className="border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium w-full bg-slate-50/50 hover:bg-white focus:bg-white text-slate-800"
          value={filters.isHoliday}
          onChange={e => set('isHoliday', e.target.value)}
        >
          <option value="all">All Days (Normal & Holidays)</option>
          <option value="true">Holidays Only (🎉)</option>
          <option value="false">Standard Working Days Only</option>
        </select>
      </div>

      {/* Apply Button */}
      <button
        type="button"
        onClick={onApply}
        disabled={!filters.datasetId}
        className="w-full bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 text-white py-2.5 rounded-xl text-xs font-bold shadow-md shadow-sky-600/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
      >
        <ExploreIcon size={15} />
        <span>Apply Exploration Filters</span>
      </button>
    </div>
  )
}
