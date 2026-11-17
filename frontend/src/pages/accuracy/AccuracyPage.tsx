import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAccuracyComparison, type AccuracyModel, type AccuracyData } from '../../api/dashboard'
import { getModels } from '../../api/models'
import { getDatasets } from '../../api/datasets'
import Card from '../../components/Card'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorAlert from '../../components/ErrorAlert'
import {
  ComposedChart, LineChart, BarChart, Bar, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'

const CG_BADGE: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  moderate: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
}

function Pct({ v }: { v: number | null | undefined }) {
  if (v === null || v === undefined) return <span className="text-gray-400">—</span>
  const cls = v > 0 ? 'text-green-600' : v < 0 ? 'text-red-500' : 'text-gray-400'
  return <span className={`font-medium ${cls}`}>{v > 0 ? '+' : ''}{v.toFixed(1)}%</span>
}

function Metric({ v, digits = 1 }: { v?: number; digits?: number }) {
  return <span className="font-mono text-xs">{v !== undefined && v !== null ? v.toFixed(digits) : '—'}</span>
}

function ActualPredChart({ models, bestId }: { models: AccuracyModel[]; bestId: string | null }) {
  if (!models.length || !models[0].comparison_data.length) return null

  const data = models[0].comparison_data.map((d, i) => {
    const pt: Record<string, unknown> = {
      time: new Date(d.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' }),
      actual: d.actual,
    }
    for (const m of models) {
      if (m.comparison_data[i]) pt[m.model_name] = m.comparison_data[i].predicted
    }
    return pt
  })

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ left: 10, right: 10, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis dataKey="time" tick={{ fontSize: 9 }} interval={Math.floor(data.length / 8)} />
        <YAxis tick={{ fontSize: 10 }} width={45} />
        <Tooltip contentStyle={{ fontSize: 10 }} />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
        <Line type="monotone" dataKey="actual" stroke="#374151" dot={false} strokeWidth={2} name="Actual" />
        {models.map(m => (
          <Line key={m.model_id} type="monotone" dataKey={m.model_name}
            stroke={m.color} dot={false} strokeWidth={m.model_id === bestId ? 2.5 : 1.5}
            strokeDasharray={m.is_baseline ? '5 3' : undefined} name={m.model_name} />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  )
}

function ResidualsChart({ models }: { models: AccuracyModel[] }) {
  if (!models.length) return null
  const data = models[0].comparison_data.map((d, i) => {
    const pt: Record<string, unknown> = {
      time: new Date(d.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }
    for (const m of models) {
      if (m.comparison_data[i]) pt[m.model_name] = m.comparison_data[i].residual
    }
    return pt
  })

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ left: 10, right: 10, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis dataKey="time" tick={{ fontSize: 9 }} interval={Math.floor(data.length / 8)} />
        <YAxis tick={{ fontSize: 10 }} width={45} />
        <Tooltip contentStyle={{ fontSize: 10 }} />
        <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
        {models.map(m => (
          <Line key={m.model_id} type="monotone" dataKey={m.model_name}
            stroke={m.color} dot={false} strokeWidth={1.5} name={m.model_name} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

function ErrorByHourChart({ models }: { models: AccuracyModel[] }) {
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h }))
  const data = hours.map(({ hour }) => {
    const pt: Record<string, unknown> = { hour: `${String(hour).padStart(2, '0')}:00` }
    for (const m of models) {
      const entry = m.hourly_mae.find(e => e.hour === hour)
      pt[m.model_name] = entry?.mae ?? null
    }
    return pt
  })

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ left: 10, right: 10, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={3} />
        <YAxis tick={{ fontSize: 10 }} width={45} />
        <Tooltip contentStyle={{ fontSize: 10 }} />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
        {models.map(m => (
          <Bar key={m.model_id} dataKey={m.model_name} fill={m.color} name={m.model_name} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

function MetricsTable({ data }: { data: AccuracyData }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b">
            <th className="pb-2 font-medium">Model</th>
            <th className="text-center">Baseline</th>
            <th className="text-right">MAE</th>
            <th className="text-right">RMSE</th>
            <th className="text-right">MAPE %</th>
            <th className="text-right">sMAPE %</th>
            <th className="text-right">R²</th>
            <th className="text-center">vs Naive (MAE)</th>
            <th className="text-center">vs Naive (RMSE)</th>
          </tr>
        </thead>
        <tbody>
          {data.models.map(m => {
            const isBest = m.model_id === data.best_model_id
            return (
              <tr key={m.model_id} className={`border-b last:border-0 ${isBest ? 'bg-green-50' : ''}`}>
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full inline-block flex-shrink-0"
                      style={{ backgroundColor: m.color }} />
                    <span className="font-medium">{m.model_name}</span>
                    {isBest && <span className="text-xs bg-green-600 text-white px-1.5 py-0.5 rounded">Best</span>}
                  </div>
                  <div className="text-xs text-gray-400 ml-5">{m.algorithm} v{m.version}</div>
                </td>
                <td className="text-center">{m.is_baseline ? '✓' : ''}</td>
                <td className="text-right"><Metric v={m.metrics.mae} /></td>
                <td className="text-right"><Metric v={m.metrics.rmse} /></td>
                <td className="text-right"><Metric v={m.metrics.mape} digits={2} /></td>
                <td className="text-right"><Metric v={m.metrics.smape} digits={2} /></td>
                <td className="text-right"><Metric v={m.metrics.r2} digits={3} /></td>
                <td className="text-center"><Pct v={m.improvement_vs_baseline?.mae} /></td>
                <td className="text-center"><Pct v={m.improvement_vs_baseline?.rmse} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function JunctionStatusGrid({ junctions }: { junctions: Array<{ junction_id: string; junction_name: string; congestion_level: string; predicted: number }> }) {
  if (!junctions.length) return <p className="text-sm text-gray-400">No junction data</p>
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {junctions.map(j => (
        <div key={j.junction_id} className={`rounded-lg border p-3 ${CG_BADGE[j.congestion_level] ?? 'bg-gray-50 text-gray-700'}`}>
          <p className="font-semibold text-sm">{j.junction_id}</p>
          <p className="text-xs opacity-75">{j.junction_name}</p>
          <p className="text-lg font-bold mt-1">{Math.round(j.predicted)} <span className="text-xs font-normal">veh/h</span></p>
          <p className="text-xs font-medium mt-0.5 capitalize">{j.congestion_level}</p>
        </div>
      ))}
    </div>
  )
}

export default function AccuracyPage() {
  const [junctionId, setJunctionId] = useState('')
  const [datasetId, setDatasetId] = useState('')
  const [activeTab, setActiveTab] = useState<'actual' | 'residuals' | 'hourly'>('actual')

  const datasets = useQuery({ queryKey: ['datasets'], queryFn: () => getDatasets() })
  const selectedDs = datasets.data?.items.find(d => d._id === datasetId)

  const models = useQuery({
    queryKey: ['models', junctionId],
    queryFn: () => getModels({ junction_id: junctionId, page_size: 50 }),
    enabled: !!junctionId,
  })

  const accuracy = useQuery({
    queryKey: ['accuracy', junctionId, datasetId],
    queryFn: () => getAccuracyComparison(junctionId, datasetId),
    enabled: !!junctionId && !!datasetId,
  })

  const sel = 'border rounded px-3 py-2 text-sm w-full'

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Accuracy Dashboard</h1>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
          Test-set evaluation · 80/20 chronological split
        </span>
      </div>

      <Card>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Dataset</label>
            <select className={sel} value={datasetId}
              onChange={e => { setDatasetId(e.target.value); setJunctionId('') }}>
              <option value="">Select dataset…</option>
              {datasets.data?.items.filter(d => ['validated', 'processed'].includes(d.status)).map(d => (
                <option key={d._id} value={d._id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Junction</label>
            <select className={sel} value={junctionId} onChange={e => setJunctionId(e.target.value)} disabled={!selectedDs}>
              <option value="">Select junction…</option>
              {selectedDs?.junction_ids.map(j => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {models.data && (
        <Card title="Junction Congestion Overview">
          <JunctionStatusGrid
            junctions={(models.data.items ?? [])
              .filter(m => m.is_active && m.status === 'ready')
              .map(m => ({ junction_id: m.junction_id, junction_name: m.junction_id, congestion_level: 'low', predicted: 0 }))}
          />
        </Card>
      )}

      {accuracy.isLoading && junctionId && datasetId && (
        <Card><div className="flex items-center justify-center py-12"><LoadingSpinner /></div></Card>
      )}

      {accuracy.error && <ErrorAlert message={(accuracy.error as Error).message} />}

      {accuracy.data && (
        <>
          {!accuracy.data.models.length ? (
            <Card><p className="text-sm text-gray-400 text-center py-8">No ready models found for this junction/dataset.</p></Card>
          ) : (
            <>
              <Card title="Model Metrics">
                <MetricsTable data={accuracy.data} />
              </Card>

              <Card>
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h2 className="font-semibold text-gray-800">Test-window Charts</h2>
                  <div className="flex border border-gray-200 rounded overflow-hidden text-sm">
                    {([['actual', 'Actual vs Predicted'], ['residuals', 'Residuals'], ['hourly', 'Error by Hour']] as const).map(([tab, label]) => (
                      <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`px-3 py-1.5 ${activeTab === tab ? 'bg-brand-600 text-white' : 'bg-white text-gray-600'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {activeTab === 'actual' && <ActualPredChart models={accuracy.data.models} bestId={accuracy.data.best_model_id} />}
                {activeTab === 'residuals' && <ResidualsChart models={accuracy.data.models} />}
                {activeTab === 'hourly' && <ErrorByHourChart models={accuracy.data.models} />}
              </Card>
            </>
          )}
        </>
      )}

      {!junctionId && (
        <div className="flex items-center justify-center h-48 text-gray-300 text-sm border-2 border-dashed rounded-xl">
          Select a dataset and junction to compare models
        </div>
      )}
    </div>
  )
}
