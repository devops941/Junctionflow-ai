import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getModels, trainModel, activateModel, deleteModel, getFeatureImportance,
  type MLModelRow, type TrainModelBody,
} from '../../api/models'
import { getDatasets } from '../../api/datasets'
import { getFeatureSets } from '../../api/features'
import Card from '../../components/Card'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import ErrorAlert from '../../components/ErrorAlert'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

// ---------------------------------------------------------------------------
// Algorithm hyperparameter presets
// ---------------------------------------------------------------------------
const HP_PRESETS: Record<string, Record<string, unknown>> = {
  seasonal_naive: { season_length: 168 },
  sarimax: { order: [1, 1, 1], seasonal_order: [1, 1, 1, 24], auto: false },
  random_forest: { n_estimators: 200, max_depth: 15, min_samples_leaf: 5, cv_folds: 0 },
}

const ALGO_LABELS: Record<string, string> = {
  seasonal_naive: 'Seasonal Naive',
  sarimax: 'SARIMAX',
  random_forest: 'Random Forest',
}

const CONGESTION_ROW_COLORS: Record<string, string> = {
  training: 'bg-blue-50',
  failed: 'bg-red-50',
  ready: '',
}

// ---------------------------------------------------------------------------
// Feature importance modal
// ---------------------------------------------------------------------------
function ImportanceModal({ modelId, onClose }: { modelId: string; onClose: () => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['importance', modelId],
    queryFn: () => getFeatureImportance(modelId),
  })

  const chartData = data
    ? Object.entries(data)
        .sort((a: any, b: any) => b[1] - a[1])
        .slice(0, 20)
        .map(([feature, importance]: [string, any]) => ({ feature, importance: parseFloat(importance.toFixed(4)) }))
    : []

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-gray-800">Feature Importance</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="p-4">
          {isLoading && <LoadingSpinner />}
          {error && <ErrorAlert message="Could not load feature importance" />}
          {chartData.length > 0 && (
            <>
              <p className="text-xs text-gray-400 mb-3">Top {chartData.length} features (mean decrease impurity)</p>
              <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 22)}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 130, right: 20, top: 4, bottom: 4 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="feature" tick={{ fontSize: 10 }} width={125} />
                  <Tooltip formatter={(v: number) => [v.toFixed(4), 'Importance']} contentStyle={{ fontSize: 11 }} />
                  <Bar dataKey="importance" radius={[0, 3, 3, 0]}>
                    {chartData.map((_: any, i: number) => <Cell key={i} fill="#0ea5e9" />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
          {!isLoading && chartData.length === 0 && !error && (
            <p className="text-sm text-gray-400 text-center py-6">No importance data available</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Training form
// ---------------------------------------------------------------------------
interface FormState {
  name: string
  algorithm: string
  junction_id: string
  dataset_id: string
  feature_set_id: string
  hp_json: string
}

function TrainForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState<FormState>({
    name: '',
    algorithm: 'random_forest',
    junction_id: '',
    dataset_id: '',
    feature_set_id: '',
    hp_json: JSON.stringify(HP_PRESETS.random_forest, null, 2),
  })
  const [hpError, setHpError] = useState('')

  const datasets = useQuery({ queryKey: ['datasets'], queryFn: () => getDatasets() })
  const selectedDs = datasets.data?.items.find(d => d._id === form.dataset_id)

  const featureSets = useQuery({
    queryKey: ['feature-sets', form.dataset_id],
    queryFn: () => getFeatureSets(form.dataset_id),
    enabled: !!form.dataset_id,
  })

  const train = useMutation({
    mutationFn: (body: TrainModelBody) => trainModel(body),
    onSuccess,
  })

  const setAlgo = (algo: string) =>
    setForm(p => ({ ...p, algorithm: algo, hp_json: JSON.stringify(HP_PRESETS[algo] ?? {}, null, 2) }))

  const handleSubmit = () => {
    setHpError('')
    let hp: Record<string, unknown> = {}
    try {
      hp = JSON.parse(form.hp_json)
    } catch {
      setHpError('Invalid JSON in hyperparameters')
      return
    }
    train.mutate({
      name: form.name,
      algorithm: form.algorithm,
      junction_id: form.junction_id,
      dataset_id: form.dataset_id,
      feature_set_id: form.feature_set_id || undefined,
      hyperparameters: hp,
    })
  }

  const sel = 'border rounded px-3 py-2 text-sm w-full'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Model name</label>
          <input className={sel} placeholder="e.g. RF junction-A v1"
            value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Algorithm</label>
          <select className={sel} value={form.algorithm} onChange={e => setAlgo(e.target.value)}>
            {Object.entries(ALGO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Dataset</label>
          <select className={sel} value={form.dataset_id}
            onChange={e => setForm(p => ({ ...p, dataset_id: e.target.value, junction_id: '', feature_set_id: '' }))}>
            <option value="">Select dataset…</option>
            {datasets.data?.items.filter(d => ['validated', 'processed'].includes(d.status)).map((d: any) => (
              <option key={d._id} value={d._id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Junction</label>
          <select className={sel} value={form.junction_id}
            onChange={e => setForm(p => ({ ...p, junction_id: e.target.value }))} disabled={!selectedDs}>
            <option value="">Select junction…</option>
            {selectedDs?.junction_ids.map((j: any) => <option key={j} value={j}>{j}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-gray-500 mb-1">Feature set (optional)</label>
          <select className={sel} value={form.feature_set_id}
            onChange={e => setForm(p => ({ ...p, feature_set_id: e.target.value }))} disabled={!form.dataset_id}>
            <option value="">None (use defaults)</option>
            {(featureSets.data ?? []).filter((fs: any) => fs.status === 'ready').map((fs: any) => (
              <option key={fs._id} value={fs._id}>
                {fs.junction_id ?? 'all junctions'} — {fs.total_features} features
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs text-gray-500 mb-1">Hyperparameters (JSON)</label>
          <textarea rows={4} className="border rounded px-3 py-2 text-xs font-mono w-full"
            value={form.hp_json} onChange={e => setForm(p => ({ ...p, hp_json: e.target.value }))} />
          {hpError && <p className="text-xs text-red-500 mt-1">{hpError}</p>}
        </div>
      </div>
      {train.error && <ErrorAlert message={(train.error as Error).message} />}
      {train.isSuccess && <p className="text-sm text-green-600">Training started!</p>}
      <button onClick={handleSubmit}
        disabled={!form.name || !form.junction_id || !form.dataset_id || train.isPending}
        className="bg-brand-600 text-white px-4 py-2 rounded text-sm font-medium disabled:opacity-50 hover:bg-brand-700">
        {train.isPending ? 'Starting…' : 'Train Model'}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Metric cell
// ---------------------------------------------------------------------------
function M({ v, digits = 1 }: { v?: number; digits?: number }) {
  return <span>{v !== undefined && v !== null ? v.toFixed(digits) : '—'}</span>
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function ModelsPage() {
  const qc = useQueryClient()
  const [importanceModelId, setImportanceModelId] = useState<string | null>(null)
  const [filterAlgo, setFilterAlgo] = useState('')
  const [filterJunction, setFilterJunction] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['models', filterAlgo, filterJunction],
    queryFn: () => getModels({
      algorithm: filterAlgo || undefined,
      junction_id: filterJunction || undefined,
      page_size: 50,
    }),
    refetchInterval: (query) => {
      const items: MLModelRow[] = query.state.data?.items ?? []
      return items.some(m => m.status === 'training') ? 3000 : false
    },
  })

  const activate = useMutation({
    mutationFn: activateModel,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['models'] }),
  })

  const remove = useMutation({
    mutationFn: deleteModel,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['models'] }),
  })

  const models: MLModelRow[] = data?.items ?? []
  const junctions = [...new Set(models.map(m => m.junction_id))].sort()

  return (
    <div className="space-y-6 max-w-6xl">
      {importanceModelId && (
        <ImportanceModal modelId={importanceModelId} onClose={() => setImportanceModelId(null)} />
      )}

      <h1 className="text-2xl font-bold">Model Lab</h1>

      <Card title="Train New Model">
        <TrainForm onSuccess={() => qc.invalidateQueries({ queryKey: ['models'] })} />
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="font-semibold text-gray-800">
            Model Registry <span className="text-gray-400 font-normal text-sm">({data?.total ?? 0} total)</span>
          </h2>
          <div className="flex gap-2">
            <select className="border rounded px-2 py-1.5 text-sm" value={filterAlgo}
              onChange={e => setFilterAlgo(e.target.value)}>
              <option value="">All algorithms</option>
              {Object.entries(ALGO_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select className="border rounded px-2 py-1.5 text-sm" value={filterJunction}
              onChange={e => setFilterJunction(e.target.value)}>
              <option value="">All junctions</option>
              {junctions.map(j => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : models.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">No models yet — train one above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b">
                  <th className="pb-2 font-medium">Name / Version</th>
                  <th>Algorithm</th>
                  <th>Junction</th>
                  <th className="text-right">MAE</th>
                  <th className="text-right">RMSE</th>
                  <th className="text-right">MAPE %</th>
                  <th className="text-right">R²</th>
                  <th className="text-center">Status</th>
                  <th className="text-center">Active</th>
                  <th className="text-right">Duration</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {models.map(m => (
                  <tr key={m._id} className={`border-b last:border-0 ${CONGESTION_ROW_COLORS[m.status] ?? ''}`}>
                    <td className="py-2">
                      <div className="font-medium">{m.name}</div>
                      <div className="text-xs text-gray-400">v{m.version}</div>
                    </td>
                    <td className="text-gray-600 text-xs">{ALGO_LABELS[m.algorithm] ?? m.algorithm}</td>
                    <td className="font-mono text-xs">{m.junction_id}</td>
                    <td className="text-right font-mono text-xs"><M v={m.metrics?.mae} /></td>
                    <td className="text-right font-mono text-xs"><M v={m.metrics?.rmse} /></td>
                    <td className="text-right font-mono text-xs"><M v={m.metrics?.mape} digits={2} /></td>
                    <td className="text-right font-mono text-xs"><M v={m.metrics?.r2} digits={3} /></td>
                    <td className="text-center">
                      {m.status === 'training' ? (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                          <LoadingSpinner size={3} /> Training
                        </span>
                      ) : (
                        <StatusBadge status={m.status} />
                      )}
                      {m.status === 'failed' && m.error_message && (
                        <div className="text-xs text-red-500 mt-0.5 max-w-[160px] truncate" title={m.error_message}>
                          {m.error_message}
                        </div>
                      )}
                    </td>
                    <td className="text-center">
                      {m.is_active && <span className="text-xs font-bold text-green-600">●</span>}
                    </td>
                    <td className="text-right text-xs text-gray-400">
                      {m.training_duration_sec ? `${m.training_duration_sec.toFixed(1)}s` : '—'}
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        {m.algorithm === 'random_forest' && m.status === 'ready' && (
                          <button onClick={() => setImportanceModelId(m._id)}
                            className="text-xs text-brand-600 hover:underline whitespace-nowrap">
                            Importance
                          </button>
                        )}
                        {m.status === 'ready' && !m.is_active && (
                          <button onClick={() => activate.mutate(m._id)}
                            className="text-xs text-green-600 hover:underline whitespace-nowrap">
                            Activate
                          </button>
                        )}
                        <button onClick={() => remove.mutate(m._id)}
                          className="text-xs text-red-500 hover:underline">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
