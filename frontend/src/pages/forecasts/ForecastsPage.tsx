import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getModels, type MLModelRow } from '../../api/models'
import {
  generateForecast, listForecasts, getForecast,
  type ForecastResult, type ForecastPoint, type FutureWeather,
} from '../../api/forecasts'
import Card from '../../components/Card'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorAlert from '../../components/ErrorAlert'
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, Legend,
} from 'recharts'
import { formatSystemTime } from '../../utils/date'
import { EyeIcon, ForecastsIcon, ReportsIcon } from '../../components/Icons'

// ---------------------------------------------------------------------------
// Congestion colours
// ---------------------------------------------------------------------------
const CG_BG: Record<string, string> = {
  low: 'bg-green-400',
  moderate: 'bg-yellow-400',
  high: 'bg-orange-500',
  critical: 'bg-red-600',
}
const CG_TEXT: Record<string, string> = {
  low: 'text-green-700 bg-green-50',
  moderate: 'text-yellow-700 bg-yellow-50',
  high: 'text-orange-700 bg-orange-50',
  critical: 'text-red-700 bg-red-50',
}

// ---------------------------------------------------------------------------
// CI band chart
// ---------------------------------------------------------------------------
function ForecastChart({ predictions }: { predictions: ForecastPoint[] }) {
  const isMultiDay = predictions.length > 24
  const data = predictions.map(p => {
    const d = new Date(p.timestamp)
    const timeLabel = isMultiDay
      ? `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`
      : d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
    return {
      time: timeLabel,
      fullDate: d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }),
      predicted: Math.round(p.predicted),
      actual: p.actual != null ? Math.round(p.actual) : undefined,
      ci_base: Math.round(p.lower_ci ?? p.predicted * 0.9),
      ci_band: Math.round((p.upper_ci ?? p.predicted * 1.1) - (p.lower_ci ?? p.predicted * 0.9)),
    }
  })

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={data} margin={{ left: 10, right: 10, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10 }} width={45} />
        <Tooltip contentStyle={{ fontSize: 11 }}
          labelFormatter={(label, payload) => (payload?.[0]?.payload as { fullDate?: string })?.fullDate ?? label}
          formatter={(v: number, name: string) => [
            v.toLocaleString(),
            name === 'ci_base' ? 'CI lower' : name === 'ci_band' ? 'CI width' : name,
          ]} />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
        <Area type="monotone" dataKey="ci_base" stackId="ci"
          fill="transparent" stroke="none" legendType="none" name="ci_base" />
        <Area type="monotone" dataKey="ci_band" stackId="ci"
          fill="#bae6fd" fillOpacity={0.5} stroke="none" name="Confidence interval" />
        <Line type="monotone" dataKey="predicted" stroke="#0ea5e9"
          dot={false} strokeWidth={2} name="Predicted" />
        <Line type="monotone" dataKey="actual" stroke="#f43f5e"
          dot={false} strokeWidth={2} name="Actual" />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Congestion timeline
// ---------------------------------------------------------------------------
function CongestionTimeline({ predictions }: { predictions: ForecastPoint[] }) {
  const counts = { low: 0, moderate: 0, high: 0, critical: 0 }
  predictions.forEach(p => {
    if (p.congestion_level in counts) counts[p.congestion_level as keyof typeof counts]++
  })

  return (
    <div>
      <p className="text-xs text-gray-500 mb-1.5 font-medium">Congestion timeline (hover for detail)</p>
      <div className="flex gap-0.5 overflow-x-auto pb-1">
        {predictions.map((p, i) => (
          <div key={i}
            title={`${new Date(p.timestamp).toLocaleTimeString()}: ${Math.round(p.predicted)} vehicles — ${p.congestion_level}`}
            className={`h-5 flex-1 min-w-[6px] rounded-sm ${CG_BG[p.congestion_level] ?? 'bg-gray-300'}`} />
        ))}
      </div>
      <div className="flex gap-3 mt-2 flex-wrap">
        {(Object.keys(counts) as (keyof typeof counts)[]).map(level => (
          <span key={level} className={`text-xs px-2 py-0.5 rounded font-medium ${CG_TEXT[level]}`}>
            {level}: {counts[level]}h
          </span>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Summary stats
// ---------------------------------------------------------------------------
function ForecastSummary({ forecast }: { forecast: ForecastResult }) {
  const preds = forecast.predictions
  if (!preds.length) return null
  const values = preds.map(p => p.predicted)
  const peak = preds.reduce((a, b) => a.predicted > b.predicted ? a : b)
  const avg = values.reduce((a, b) => a + b, 0) / values.length

  const peakDate = new Date(peak.timestamp)
  const isMultiDay = preds.length > 24
  const peakFormatted = isMultiDay
    ? `${peakDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${peakDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`
    : peakDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })

  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: 'Avg hourly', value: `${Math.round(avg).toLocaleString()} veh/h` },
        { label: 'Peak count', value: `${Math.round(peak.predicted).toLocaleString()} veh/h` },
        { label: 'Peak hour', value: peakFormatted },
      ].map(s => (
        <div key={s.label} className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500">{s.label}</p>
          <p className="text-xl font-bold text-gray-800">{s.value}</p>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Weather input form
// ---------------------------------------------------------------------------
interface WeatherFormState {
  enabled: boolean
  temperature_c: string
  rainfall_mm: string
  humidity_pct: string
  wind_speed_kmh: string
  weather_condition: string
}

const DEFAULT_WEATHER: WeatherFormState = {
  enabled: false,
  temperature_c: '',
  rainfall_mm: '',
  humidity_pct: '',
  wind_speed_kmh: '',
  weather_condition: '',
}

// ---------------------------------------------------------------------------
// Recent forecasts list
// ---------------------------------------------------------------------------
function RecentForecasts({ junctionId }: { junctionId: string }) {
  const { data } = useQuery({
    queryKey: ['forecasts', junctionId],
    queryFn: () => listForecasts({ junction_id: junctionId }),
    enabled: !!junctionId,
  })
  if (!data?.length) return null

  return (
    <Card title="Recent Forecasts">
      <div className="space-y-1">
        {data.slice(0, 6).map((fc: ForecastResult) => (
          <div key={fc._id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
            <span className="text-gray-600">{fc.horizon_hours}h forecast</span>
            <span className="text-gray-400 text-xs">{formatSystemTime(fc.generated_at)}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function ForecastsPage() {
  const queryClient = useQueryClient()
  const [selectedModelId, setSelectedModelId] = useState('')
  const [horizon, setHorizon] = useState(24)
  const [weather, setWeather] = useState<WeatherFormState>(DEFAULT_WEATHER)
  const [result, setResult] = useState<ForecastResult | null>(null)
  const [loadingForecastId, setLoadingForecastId] = useState<string | null>(null)

  const recentForecastsQuery = useQuery({
    queryKey: ['forecasts-recent-top3'],
    queryFn: () => listForecasts(),
  })

  const top3 = (recentForecastsQuery.data ?? []).slice(0, 3)

  const loadForecast = async (id: string) => {
    try {
      setLoadingForecastId(id)
      const data = await getForecast(id)
      setResult(data)
      if (data.model_id) setSelectedModelId(data.model_id)
      if (data.horizon_hours) setHorizon(data.horizon_hours)
    } catch (err) {
      console.error('Failed to load forecast', err)
    } finally {
      setLoadingForecastId(null)
    }
  }

  // Auto-load latest forecast on mount if none loaded
  useEffect(() => {
    if (!result && top3.length > 0 && !loadingForecastId) {
      loadForecast(top3[0]._id)
    }
  }, [top3.length])

  const models = useQuery({
    queryKey: ['models', '', '', 50],
    queryFn: () => getModels({ page_size: 50 }),
  })

  const readyModels: MLModelRow[] = (models.data?.items ?? []).filter(m => m.status === 'ready')
  const selectedModel = readyModels.find(m => m._id === selectedModelId)

  const forecast = useMutation({
    mutationFn: () => {
      if (!selectedModel) throw new Error('Select a model first')
      const fw: FutureWeather | null = weather.enabled ? {
        temperature_c: weather.temperature_c ? parseFloat(weather.temperature_c) : null,
        rainfall_mm: weather.rainfall_mm ? parseFloat(weather.rainfall_mm) : null,
        humidity_pct: weather.humidity_pct ? parseFloat(weather.humidity_pct) : null,
        wind_speed_kmh: weather.wind_speed_kmh ? parseFloat(weather.wind_speed_kmh) : null,
        weather_condition: weather.weather_condition || null,
      } : null
      return generateForecast({
        model_id: selectedModelId,
        junction_id: selectedModel.junction_id,
        horizon_hours: horizon,
        future_weather: fw,
      })
    },
    onSuccess: (data: ForecastResult) => {
      setResult(data)
      queryClient.invalidateQueries({ queryKey: ['forecasts-recent-top3'] })
    },
  })

  const setW = (k: keyof WeatherFormState, v: string | boolean) =>
    setWeather(w => ({ ...w, [k]: v }))

  const inp = 'border rounded px-2.5 py-1.5 text-sm w-full'

  const horizonLabel = horizon >= 168
    ? `${horizon}h (7 days)`
    : horizon >= 48
    ? `${horizon}h (${Math.round(horizon / 24)} days)`
    : horizon === 24
    ? '24h (1 day)'
    : `${horizon}h`

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Forecast Builder</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time multi-step machine learning traffic predictions & congestion intelligence.
          </p>
        </div>
      </div>

      {/* Latest 3 Forecasting Reports Option Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center">
              <ForecastsIcon size={17} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Latest 3 Forecasting Reports
              </h2>
              <p className="text-xs text-slate-500">
                Click any report below to inspect its interactive telemetry chart, confidence intervals, and peak hour metrics.
              </p>
            </div>
          </div>
          {top3.length > 0 && (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-mono">
              {top3.length} Recent Inferences
            </span>
          )}
        </div>

        {recentForecastsQuery.isLoading ? (
          <div className="py-6 flex justify-center"><LoadingSpinner /></div>
        ) : !top3.length ? (
          <div className="text-center py-6 text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <p className="text-xs">No previous forecasts recorded yet. Select a model on the left and click Generate Forecast.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {top3.map((fc, idx) => {
              const isSelected = result?._id === fc._id
              const isFirst = idx === 0
              return (
                <div
                  key={fc._id}
                  onClick={() => loadForecast(fc._id)}
                  className={`group relative p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-b from-sky-50/80 to-sky-100/30 border-sky-400 shadow-sm ring-2 ring-sky-500/20'
                      : 'bg-slate-50/50 hover:bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                        isFirst
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-slate-200 text-slate-700'
                      }`}>
                        {isFirst ? 'Latest' : `Report #${idx + 1}`}
                      </span>
                      <span className="font-mono font-bold text-xs text-slate-800">
                        {fc.junction_id}
                      </span>
                    </div>

                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 shadow-2xs">
                      {fc.horizon_hours}h horizon
                    </span>
                  </div>

                  <div className="mt-3 space-y-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Generated Timestamp
                    </span>
                    <p className="text-xs font-semibold text-slate-800 font-mono">
                      {formatSystemTime(fc.generated_at)}
                    </p>
                  </div>

                  <div className="mt-3.5 pt-2.5 border-t border-slate-200/60 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-sky-500 animate-pulse' : 'bg-slate-300'}`} />
                      <span className={isSelected ? 'text-sky-700 font-semibold' : ''}>
                        {isSelected ? 'Active In Chart' : 'Click to View'}
                      </span>
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        loadForecast(fc._id)
                      }}
                      disabled={loadingForecastId === fc._id}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-xs'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 group-hover:border-slate-300'
                      }`}
                    >
                      <EyeIcon size={13} />
                      <span>{loadingForecastId === fc._id ? 'Loading…' : isSelected ? 'Viewing' : 'View Forecast'}</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config panel */}
        <div className="space-y-4">
          <Card title="Model & Horizon">
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Model</label>
                <select className={inp} value={selectedModelId}
                  onChange={e => { setSelectedModelId(e.target.value); setResult(null) }}>
                  <option value="">Select ready model…</option>
                  {readyModels.map(m => (
                    <option key={m._id} value={m._id}>
                      {m.name} — {m.junction_id} ({m.algorithm})
                    </option>
                  ))}
                </select>
              </div>

              {selectedModel && (
                <div className="text-xs text-gray-500 bg-gray-50 rounded p-2 space-y-0.5">
                  <div>Junction: <span className="font-mono">{selectedModel.junction_id}</span></div>
                  <div>RMSE: {selectedModel.metrics?.rmse?.toFixed(1) ?? '—'} &nbsp;R²: {selectedModel.metrics?.r2?.toFixed(3) ?? '—'}</div>
                </div>
              )}

              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Horizon: <span className="font-semibold text-gray-700">{horizonLabel}</span>
                </label>
                <input type="range" min={1} max={168} value={horizon}
                  onChange={e => setHorizon(parseInt(e.target.value))}
                  className="w-full accent-brand-600" />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>1h</span><span>24h</span><span>72h</span><span>168h</span>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <button onClick={() => setW('enabled', !weather.enabled)}
              className="flex items-center gap-2 text-sm font-medium text-gray-700 w-full">
              <input type="checkbox" checked={weather.enabled}
                onChange={e => setW('enabled', e.target.checked)}
                className="accent-brand-600" />
              Future Weather Override
            </button>

            {weather.enabled && (
              <div className="mt-3 space-y-2">
                {[
                  { key: 'temperature_c', label: 'Temperature (°C)' },
                  { key: 'rainfall_mm', label: 'Rainfall (mm)' },
                  { key: 'humidity_pct', label: 'Humidity (%)' },
                  { key: 'wind_speed_kmh', label: 'Wind (km/h)' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-500 mb-0.5">{label}</label>
                    <input type="number" className={inp} placeholder="leave blank for last-known"
                      value={weather[key as keyof WeatherFormState] as string}
                      onChange={e => setW(key as keyof WeatherFormState, e.target.value)} />
                  </div>
                ))}
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">Condition</label>
                  <select className={inp} value={weather.weather_condition}
                    onChange={e => setW('weather_condition', e.target.value)}>
                    <option value="">Last known</option>
                    {['clear', 'cloudy', 'fog', 'rain', 'storm'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </Card>

          <button onClick={() => forecast.mutate()}
            disabled={!selectedModelId || forecast.isPending}
            className="w-full bg-brand-600 text-white py-2.5 rounded-lg font-medium disabled:opacity-50 hover:bg-brand-700 transition-colors">
            {forecast.isPending ? 'Generating…' : 'Generate Forecast'}
          </button>

          {forecast.error && <ErrorAlert message={(forecast.error as Error).message} />}
        </div>

        {/* Result panel */}
        <div className="lg:col-span-2 space-y-4">
          {(forecast.isPending || loadingForecastId) && (
            <Card><div className="flex items-center justify-center py-12"><LoadingSpinner /></div></Card>
          )}

          {result && !forecast.isPending && !loadingForecastId && (
            <>
              <Card>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                      <span>{result.horizon_hours}-hour Forecast</span>
                      <span className="text-xs font-mono font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded">
                        Junction {result.junction_id}
                      </span>
                    </h2>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Generated {formatSystemTime(result.generated_at)}
                    </p>
                  </div>

                  <Link
                    to="/reports"
                    className="text-xs font-bold text-slate-700 hover:text-sky-600 bg-slate-50 hover:bg-sky-50 border border-slate-200 hover:border-sky-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <ReportsIcon size={14} />
                    <span>View / Export PDF Report</span>
                  </Link>
                </div>
                <ForecastChart predictions={result.predictions} />
              </Card>

              <Card>
                <CongestionTimeline predictions={result.predictions} />
              </Card>

              <Card title="Summary">
                <ForecastSummary forecast={result} />
              </Card>
            </>
          )}

          {!result && !forecast.isPending && !loadingForecastId && (
            <div className="flex items-center justify-center h-64 text-gray-300 text-sm border-2 border-dashed rounded-xl">
              Configure a model and click Generate Forecast or click View on any report above.
            </div>
          )}
        </div>
      </div>

      {selectedModel && <RecentForecasts junctionId={selectedModel.junction_id} />}
    </div>
  )
}
