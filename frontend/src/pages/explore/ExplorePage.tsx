import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDatasets } from '../../api/datasets'
import {
  getFilteredSummary, getFilteredTimeseries, getHeatmap,
  getWeekdayAvg, getWeatherImpact, getStlDecomposition,
  getJunctionComparison, getRawRecords, getExportUrl,
} from '../../api/explore'
import FilterPanel, { ExploreFilters, DEFAULT_FILTERS } from './components/FilterPanel'
import SummaryCards from './components/SummaryCards'
import HeatmapGrid from './components/HeatmapGrid'
import WeatherBoxPlot from './components/WeatherBoxPlot'
import STLChart from './components/STLChart'
import RawRecordsTable from './components/RawRecordsTable'
import LoadingSpinner from '../../components/LoadingSpinner'
import {
  ExploreIcon, ForecastsIcon, DashboardIcon, AccuracyIcon,
  FeaturesIcon, JunctionIcon, DatasetIcon, SparklesIcon,
} from '../../components/Icons'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend,
} from 'recharts'

const TABS = [
  { id: 'timeseries', label: 'Time Series', icon: ForecastsIcon },
  { id: 'heatmap', label: 'Heatmap Matrix', icon: DashboardIcon },
  { id: 'weekday', label: 'Weekday Profile', icon: AccuracyIcon },
  { id: 'weather', label: 'Weather Impact', icon: ExploreIcon },
  { id: 'stl', label: 'STL Decomposition', icon: FeaturesIcon },
  { id: 'compare', label: 'Compare Junctions', icon: JunctionIcon },
  { id: 'records', label: 'Raw Records', icon: DatasetIcon },
] as const

type TabId = typeof TABS[number]['id']

const RESAMPLE_OPTS = [
  { value: '1h', label: 'Hourly Aggregation (1h)' },
  { value: '1D', label: 'Daily Aggregation (1D)' },
  { value: '1W', label: 'Weekly Aggregation (1W)' },
]

const LINE_COLORS = ['#0ea5e9', '#f59e0b', '#10b981', '#6366f1', '#f43f5e', '#8b5cf6', '#ec4899', '#14b8a6']

export default function ExplorePage() {
  const [filters, setFilters] = useState<ExploreFilters>(DEFAULT_FILTERS)
  const [applied, setApplied] = useState<ExploreFilters>(DEFAULT_FILTERS)
  const [activeTab, setActiveTab] = useState<TabId>('timeseries')
  const [resample, setResample] = useState('1h')
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState('timestamp')
  const [sortDir, setSortDir] = useState('asc')

  const hasDataset = !!applied.datasetId
  const filterKey = JSON.stringify(applied)

  const datasets = useQuery({ queryKey: ['datasets'], queryFn: () => getDatasets() })
  const validDatasets = (datasets.data?.items ?? []).filter(d => ['validated', 'processed'].includes(d.status))

  const f = applied
  const enabled = hasDataset

  const summary = useQuery({
    queryKey: ['explore-summary', filterKey],
    queryFn: () => getFilteredSummary(f),
    enabled,
  })

  const timeseries = useQuery({
    queryKey: ['explore-ts', filterKey, resample],
    queryFn: () => getFilteredTimeseries(f, resample),
    enabled: enabled && activeTab === 'timeseries',
  })

  const heatmap = useQuery({
    queryKey: ['explore-heatmap', filterKey],
    queryFn: () => getHeatmap(f),
    enabled: enabled && activeTab === 'heatmap',
  })

  const weekday = useQuery({
    queryKey: ['explore-weekday', filterKey],
    queryFn: () => getWeekdayAvg(f),
    enabled: enabled && activeTab === 'weekday',
  })

  const weather = useQuery({
    queryKey: ['explore-weather', filterKey],
    queryFn: () => getWeatherImpact(f),
    enabled: enabled && activeTab === 'weather',
  })

  const stlJunction = f.junctionIds[0] || ''
  const stl = useQuery({
    queryKey: ['explore-stl', f.datasetId, stlJunction, f.start, f.end],
    queryFn: () => getStlDecomposition({ ...f, junctionId: stlJunction }),
    enabled: enabled && activeTab === 'stl' && !!stlJunction,
  })

  const compare = useQuery({
    queryKey: ['explore-compare', filterKey],
    queryFn: () => getJunctionComparison(f, '1D'),
    enabled: enabled && activeTab === 'compare',
  })

  const records = useQuery({
    queryKey: ['explore-records', filterKey, page, sortBy, sortDir],
    queryFn: () => getRawRecords(f, page, 15, sortBy, sortDir),
    enabled: enabled && activeTab === 'records',
  })

  const handleApply = useCallback(() => {
    setApplied({ ...filters })
    setPage(1)
  }, [filters])

  const handleAutoSelectFirst = () => {
    if (validDatasets.length > 0) {
      const first = validDatasets[0]
      const newF = { ...DEFAULT_FILTERS, datasetId: first._id }
      setFilters(newF)
      setApplied(newF)
      setPage(1)
    }
  }

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(col)
      setSortDir('asc')
    }
    setPage(1)
  }

  const handleExport = (fmt: 'csv' | 'xlsx') => {
    const url = getExportUrl(applied, fmt)
    window.open(url, '_blank')
  }

  // Build time series chart data
  const tsData = (() => {
    if (!(timeseries.data as any)?.timestamps) return []
    const { timestamps, series } = timeseries.data as { timestamps: string[]; series: Record<string, (number | null)[]> }
    return timestamps.map((ts: string, i: number) => {
      const pt: Record<string, unknown> = { t: new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', hour: resample === '1h' ? '2-digit' : undefined }) }
      Object.entries(series).forEach(([jid, vals]: [string, (number | null)[]]) => { pt[jid] = vals[i] })
      return pt
    })
  })()

  const junctionKeys = timeseries.data?.series ? Object.keys(timeseries.data.series) : []

  // Weekday bar data
  const weekdayData = weekday.data?.days
    ? weekday.data.days.map((d: string, i: number) => ({ day: d, avg: weekday.data.values[i] }))
    : []

  // Compare data
  const compareData = (() => {
    if (!compare.data?.timestamps) return []
    const { timestamps, series } = compare.data as { timestamps: string[]; series: Record<string, (number | null)[]> }
    return timestamps.map((ts: string, i: number) => {
      const pt: Record<string, unknown> = { t: new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' }) }
      Object.entries(series).forEach(([jid, vals]) => { pt[jid] = vals[i] })
      return pt
    })
  })()

  const compareKeys = compare.data?.series ? Object.keys(compare.data.series) : []

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* Filter Sidebar Column */}
      <div className="w-full lg:w-76 xl:w-80 shrink-0">
        <FilterPanel
          filters={filters}
          datasets={validDatasets}
          onChange={setFilters}
          onApply={handleApply}
        />
      </div>

      {/* Main Exploration Content Column */}
      <div className="flex-1 min-w-0 space-y-6 w-full">
        {/* Page Title & Status */}
        <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Historical Trend Explorer</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Multi-resolution time-series decomposition, spatial junction matrix, and climate correlation.
            </p>
          </div>
          {hasDataset && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200 font-mono">
              Dataset: {validDatasets.find(d => d._id === applied.datasetId)?.name ?? applied.datasetId}
            </span>
          )}
        </div>

        {/* Empty State Hero Banner when no dataset applied */}
        {!hasDataset && (
          <div className="bg-gradient-to-br from-white via-sky-50/40 to-slate-100 rounded-2xl border border-sky-200/80 p-8 shadow-xs">
            <div className="max-w-2xl">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-600 to-cyan-500 text-white flex items-center justify-center shadow-md shadow-sky-500/25 mb-4">
                <ExploreIcon size={24} />
              </div>
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                Begin Deep Traffic Analytics
              </h2>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Select a validated traffic dataset from the filter panel on the left to reveal statistical trends, peak hourly traffic heatmaps, STL seasonal decompositions, and weather sensitivity models.
              </p>

              {validDatasets.length > 0 && (
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={handleAutoSelectFirst}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-sky-600/25 transition-all cursor-pointer"
                  >
                    <SparklesIcon size={16} />
                    <span>Explore with "{validDatasets[0].name}" ({validDatasets[0].row_count?.toLocaleString()} rows)</span>
                  </button>
                </div>
              )}

              {/* 4 Feature Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-200/60">
                <div className="p-2.5 bg-white rounded-xl border border-slate-200/60">
                  <p className="text-[11px] font-bold text-slate-800">📈 Time Series</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">1h / 1D / 1W trends</p>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200/60">
                  <p className="text-[11px] font-bold text-slate-800">🗺️ Heatmap Grid</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">24h × 7-day matrix</p>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200/60">
                  <p className="text-[11px] font-bold text-slate-800">🔬 STL Decomp</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Trend + Seasonality</p>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200/60">
                  <p className="text-[11px] font-bold text-slate-800">🌧️ Weather Impact</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Rain & Storm impact</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Populated Exploration Workspace */}
        {hasDataset && (
          <>
            {summary.isLoading ? <LoadingSpinner /> : <SummaryCards data={summary.data ?? {}} />}

            {/* Analysis Workspace Card with Tabs */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
              {/* Tab Navigation Header */}
              <div className="flex border-b border-slate-200 bg-slate-50/60 px-2 overflow-x-auto">
                {TABS.map(tab => {
                  const Icon = tab.icon
                  const active = activeTab === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-4 py-3 text-xs font-bold whitespace-nowrap transition-all border-b-2 cursor-pointer ${
                        active
                          ? 'border-sky-600 text-sky-700 bg-white shadow-2xs'
                          : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50'
                      }`}
                    >
                      <Icon size={15} className={active ? 'text-sky-600' : 'text-slate-400'} />
                      <span>{tab.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* Tab View Content */}
              <div className="p-6">
                {/* Time Series Tab */}
                {activeTab === 'timeseries' && (
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Vehicle Throughput Time Series</h3>
                        <p className="text-xs text-slate-500">Continuous observation timeline across filtered intersection sensors.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500">Resample Frequency:</span>
                        <select
                          className="border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium bg-slate-50 text-slate-800 focus:ring-2 focus:ring-sky-500"
                          value={resample}
                          onChange={e => setResample(e.target.value)}
                        >
                          {RESAMPLE_OPTS.map(o => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {timeseries.isLoading ? (
                      <LoadingSpinner />
                    ) : tsData.length > 0 ? (
                      <div className="w-full h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={tsData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                            <XAxis dataKey="t" tick={{ fontSize: 11, fill: '#64748b' }} />
                            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#0f172a',
                                borderRadius: '12px',
                                border: 'none',
                                color: '#fff',
                                fontSize: '12px',
                              }}
                            />
                            <Legend />
                            {junctionKeys.map((jid, i) => (
                              <Line
                                key={jid}
                                type="monotone"
                                dataKey={jid}
                                stroke={LINE_COLORS[i % LINE_COLORS.length]}
                                dot={false}
                                strokeWidth={2}
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 py-10 text-center font-medium">No matching data observations found for this filter combination.</p>
                    )}
                  </div>
                )}

                {/* Heatmap Tab */}
                {activeTab === 'heatmap' && (
                  <div>
                    <div className="mb-4">
                      <h3 className="text-sm font-bold text-slate-900">24-Hour × 7-Day Congestion Heatmap Matrix</h3>
                      <p className="text-xs text-slate-500">Highlights systemic diurnal rush hours versus weekend calm cycles.</p>
                    </div>
                    {heatmap.isLoading ? <LoadingSpinner /> : <HeatmapGrid data={heatmap.data} />}
                  </div>
                )}

                {/* Weekday Tab */}
                {activeTab === 'weekday' && (
                  <div>
                    <div className="mb-4">
                      <h3 className="text-sm font-bold text-slate-900">Weekday Average Volume Profile</h3>
                      <p className="text-xs text-slate-500">Compare average daily traffic loads across Monday through Sunday.</p>
                    </div>
                    {weekday.isLoading ? (
                      <LoadingSpinner />
                    ) : weekdayData.length > 0 ? (
                      <div className="w-full h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={weekdayData}>
                            <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#64748b' }} />
                            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                            <Tooltip formatter={(v: number) => [Math.round(v).toLocaleString(), 'Avg Vehicles/h']} />
                            <Bar dataKey="avg" fill="#0284c7" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 py-10 text-center">No weekday data available.</p>
                    )}
                  </div>
                )}

                {/* Weather Impact Tab */}
                {activeTab === 'weather' && (
                  <div>
                    <div className="mb-4">
                      <h3 className="text-sm font-bold text-slate-900">Weather Condition Throughput Distribution</h3>
                      <p className="text-xs text-slate-500">Demonstrates vehicular volume suppression under severe precipitation or visibility restrictions.</p>
                    </div>
                    {weather.isLoading ? <LoadingSpinner /> : <WeatherBoxPlot data={weather.data} />}
                  </div>
                )}

                {/* STL Decomposition Tab */}
                {activeTab === 'stl' && (
                  <div>
                    <div className="mb-3">
                      <h3 className="text-sm font-bold text-slate-900">Seasonal-Trend Decomposition using LOESS (STL)</h3>
                      <p className="text-xs text-slate-500">Deconstructs traffic observations into Trend Component, Seasonal Periodicity, and Residual Noise.</p>
                    </div>
                    {!stlJunction ? (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                        Please select <strong>one specific junction</strong> in the filter sidebar to render mathematical STL decomposition.
                      </div>
                    ) : stl.isLoading ? (
                      <LoadingSpinner />
                    ) : (
                      <STLChart data={stl.data} />
                    )}
                  </div>
                )}

                {/* Junction Comparison Tab */}
                {activeTab === 'compare' && (
                  <div>
                    <div className="mb-4">
                      <h3 className="text-sm font-bold text-slate-900">Multi-Junction Daily Comparison</h3>
                      <p className="text-xs text-slate-500">Compare inter-intersection capacity loads side by side.</p>
                    </div>
                    {compare.isLoading ? (
                      <LoadingSpinner />
                    ) : compareData.length > 0 ? (
                      <div className="w-full h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={compareData}>
                            <XAxis dataKey="t" tick={{ fontSize: 11, fill: '#64748b' }} />
                            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                            <Tooltip />
                            <Legend />
                            {compareKeys.map((jid, i) => (
                              <Line
                                key={jid}
                                type="monotone"
                                dataKey={jid}
                                stroke={LINE_COLORS[i % LINE_COLORS.length]}
                                dot={false}
                                strokeWidth={2}
                              />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 py-10 text-center">No comparison data available.</p>
                    )}
                  </div>
                )}

                {/* Raw Records Tab */}
                {activeTab === 'records' && (
                  <RawRecordsTable
                    data={records.data}
                    page={page}
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onPage={setPage}
                    onSort={handleSort}
                    onExportCsv={() => handleExport('csv')}
                    onExportXlsx={() => handleExport('xlsx')}
                    isLoading={records.isLoading}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
