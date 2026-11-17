import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDatasets } from '../../api/datasets'
import { createFeatureSet, previewFeatures, getFeatureSets, deleteFeatureSet } from '../../api/features'
import type { FeatureConfig, FeaturePreview, FeatureSet } from '../../types'
import { DEFAULT_FEATURE_CONFIG } from '../../types'
import Card from '../../components/Card'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorAlert from '../../components/ErrorAlert'
import StatusBadge from '../../components/StatusBadge'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'

// ---------------------------------------------------------------------------
// Small toggle/checkbox helpers
// ---------------------------------------------------------------------------

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input type="checkbox" className="accent-brand-600 w-4 h-4" checked={checked}
        onChange={e => onChange(e.target.checked)} />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  )
}

function SectionCard({ title, badge, children }: { title: string; badge?: number; children: React.ReactNode }) {
  return (
    <div className="border border-gray-100 rounded-xl bg-gray-50/60 p-4">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-semibold text-gray-700 text-sm">{title}</h3>
        {badge !== undefined && (
          <span className="bg-brand-100 text-brand-700 text-xs font-bold px-2 py-0.5 rounded-full">
            {badge} features
          </span>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Lag / Window chip selectors
// ---------------------------------------------------------------------------

const PRESET_LAGS = [1, 2, 3, 6, 12, 24, 48, 72, 168]
const PRESET_WINDOWS = [3, 6, 12, 24, 48, 72, 168]
const ROLLING_STAT_OPTS = ['mean', 'std', 'min', 'max']

function ChipGroup({ options, selected, onChange }: {
  options: number[]; selected: number[]; onChange: (v: number[]) => void
}) {
  const toggle = (v: number) =>
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v].sort((a, b) => a - b))
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(v => (
        <button key={v} onClick={() => toggle(v)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
            selected.includes(v)
              ? 'bg-brand-600 text-white border-brand-600'
              : 'bg-white text-gray-500 border-gray-200 hover:border-brand-300'
          }`}>
          {v}h
        </button>
      ))}
    </div>
  )
}

function StatChipGroup({ options, selected, onChange }: {
  options: string[]; selected: string[]; onChange: (v: string[]) => void
}) {
  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v])
  return (
    <div className="flex gap-1.5">
      {options.map(v => (
        <button key={v} onClick={() => toggle(v)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
            selected.includes(v)
              ? 'bg-brand-600 text-white border-brand-600'
              : 'bg-white text-gray-500 border-gray-200'
          }`}>
          {v}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Correlation bar chart
// ---------------------------------------------------------------------------

function CorrelationChart({ correlation }: { correlation: Record<string, number> }) {
  if (!Object.keys(correlation).length)
    return <p className="text-sm text-gray-400 py-4 text-center">No correlation data</p>

  const sorted = Object.entries(correlation)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 25)
    .map(([feature, value]) => ({ feature, value, abs: Math.abs(value) }))

  return (
    <div>
      <p className="text-xs text-gray-400 mb-3">Top {sorted.length} features by |Pearson r| with vehicle_count (training set)</p>
      <ResponsiveContainer width="100%" height={Math.max(300, sorted.length * 22)}>
        <BarChart data={sorted} layout="vertical" margin={{ left: 120, right: 30, top: 4, bottom: 4 }}>
          <XAxis type="number" domain={[-1, 1]} tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="feature" tick={{ fontSize: 10 }} width={115} />
          <Tooltip
            formatter={(v: number) => [v.toFixed(4), 'Correlation']}
            contentStyle={{ fontSize: 11 }}
          />
          <ReferenceLine x={0} stroke="#d1d5db" />
          <Bar dataKey="value" radius={[0, 3, 3, 0]}>
            {sorted.map((entry) => (
              <Cell key={entry.feature} fill={entry.value >= 0 ? '#0ea5e9' : '#f43f5e'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Preview table
// ---------------------------------------------------------------------------

function PreviewTable({ preview }: { preview: FeaturePreview }) {
  const cols = preview.preview_columns
  const rows = preview.preview_rows

  const fmt = (v: unknown): string => {
    if (v === null || v === undefined) return '—'
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(3)
    if (typeof v === 'string' && v.includes('T')) {
      try { return new Date(v).toLocaleString() } catch { return v }
    }
    return String(v)
  }

  return (
    <div className="overflow-x-auto rounded border border-gray-100">
      <table className="text-xs w-max min-w-full">
        <thead className="bg-gray-50 sticky top-0">
          <tr>
            {cols.map(c => (
              <th key={c} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">
                {c === 'vehicle_count' ? (
                  <span className="text-brand-600 font-bold">{c} ★</span>
                ) : c === '_split' ? (
                  <span className="text-purple-600">{c}</span>
                ) : c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={`border-t ${(row['_split'] as string) === 'test' ? 'bg-amber-50/40' : ''}`}>
              {cols.map(c => (
                <td key={c} className="px-3 py-1.5 whitespace-nowrap font-mono">
                  {c === '_split' ? (
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      row[c] === 'train' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>{String(row[c])}</span>
                  ) : fmt(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Saved feature sets list
// ---------------------------------------------------------------------------

function SavedSetsList({ datasetId }: { datasetId: string }) {
  const qc = useQueryClient()
  const sets = useQuery({
    queryKey: ['feature-sets', datasetId],
    queryFn: () => getFeatureSets(datasetId),
    enabled: !!datasetId,
  })
  const remove = useMutation({
    mutationFn: deleteFeatureSet,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feature-sets', datasetId] }),
  })

  if (!datasetId) return null
  if (sets.isLoading) return <LoadingSpinner size={5} />
  const list: FeatureSet[] = sets.data ?? []
  if (!list.length) return <p className="text-sm text-gray-400">No feature sets saved yet.</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b text-xs">
            <th className="pb-2">Junction</th>
            <th>Features</th>
            <th>Train rows</th>
            <th>Test rows</th>
            <th>Status</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {list.map((fs) => (
            <tr key={fs._id} className="border-b last:border-0">
              <td className="py-2 font-mono text-xs">{fs.junction_id ?? 'all'}</td>
              <td className="font-bold">{fs.total_features}</td>
              <td>{fs.train_rows.toLocaleString()}</td>
              <td>{fs.test_rows.toLocaleString()}</td>
              <td><StatusBadge status={fs.status} /></td>
              <td className="text-gray-400 text-xs">{new Date(fs.created_at).toLocaleString()}</td>
              <td className="text-right">
                <button onClick={() => remove.mutate(fs._id)}
                  className="text-xs text-red-500 hover:underline">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function FeaturesPage() {
  const qc = useQueryClient()
  const [datasetId, setDatasetId] = useState('')
  const [junctionId, setJunctionId] = useState('')
  const [config, setConfig] = useState<FeatureConfig>(DEFAULT_FEATURE_CONFIG)
  const [preview, setPreview] = useState<FeaturePreview | null>(null)
  const [previewTab, setPreviewTab] = useState<'table' | 'correlation'>('correlation')

  const datasets = useQuery({ queryKey: ['datasets'], queryFn: () => getDatasets() })
  const selectedDs = datasets.data?.items.find(d => d._id === datasetId)

  const setKey = <K extends keyof FeatureConfig>(k: K, v: FeatureConfig[K]) =>
    setConfig(c => ({ ...c, [k]: v }))

  const previewMutation = useMutation({
    mutationFn: () => previewFeatures({
      ...config,
      dataset_id: datasetId,
      junction_id: junctionId,
      sample_size: 500,
    }),
    onSuccess: (data: FeaturePreview) => setPreview(data),
  })

  const saveMutation = useMutation({
    mutationFn: () => createFeatureSet({ dataset_id: datasetId, junction_id: junctionId || undefined, config }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feature-sets', datasetId] }),
  })

  const canPreview = !!datasetId && !!junctionId
  const canSave = canPreview

  // Count features per group for badges
  const countTimeCols = [
    config.include_hour && (config.cyclical_hour ? 2 : 1),
    config.include_dow && (config.cyclical_dow ? 2 : 1),
    config.include_dom && 1,
    config.include_month && 1,
    config.include_week_of_year && 1,
    config.include_is_weekend && 1,
  ].reduce<number>((a, b) => a + (typeof b === 'number' ? b : 0), 0)
  const countCalCols = (config.include_holiday ? 1 : 0) + (config.include_event ? 1 : 0)
  const countLagCols = config.lags.length
  const countRollCols = config.rolling_windows.length * config.rolling_stats.length
  const countWeatherCols =
    (config.include_weather_numeric ? 4 : 0) +
    (config.include_weather_onehot ? 5 : 0)

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Feature Engineering</h1>
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded px-3 py-1.5">
          <span className="text-amber-600 font-semibold">Leakage guard ON</span>
          — lags ≥ 1, rolling uses shift(1), 80/20 chronological split
        </div>
      </div>

      {/* Dataset + Junction */}
      <Card title="Data Source">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1 font-medium">Dataset</label>
            <select className="border rounded px-3 py-2 text-sm w-full" value={datasetId}
              onChange={e => { setDatasetId(e.target.value); setJunctionId('') }}>
              <option value="">Select validated dataset…</option>
              {datasets.data?.items.filter(d => ['validated', 'processed'].includes(d.status)).map(d => (
                <option key={d._id} value={d._id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1 font-medium">Junction</label>
            <select className="border rounded px-3 py-2 text-sm w-full" value={junctionId}
              onChange={e => setJunctionId(e.target.value)} disabled={!selectedDs}>
              <option value="">Select junction…</option>
              {selectedDs?.junction_ids.map(j => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {/* Feature configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <SectionCard title="Time Features" badge={countTimeCols}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <Toggle label="Hour of day" checked={config.include_hour} onChange={v => setKey('include_hour', v)} />
            <Toggle label="Day of week" checked={config.include_dow} onChange={v => setKey('include_dow', v)} />
            <Toggle label="Day of month" checked={config.include_dom} onChange={v => setKey('include_dom', v)} />
            <Toggle label="Month" checked={config.include_month} onChange={v => setKey('include_month', v)} />
            <Toggle label="Week of year" checked={config.include_week_of_year} onChange={v => setKey('include_week_of_year', v)} />
            <Toggle label="Is weekend" checked={config.include_is_weekend} onChange={v => setKey('include_is_weekend', v)} />
          </div>
          <div className="mt-2 pt-2 border-t border-gray-200 space-y-1.5">
            <p className="text-xs font-medium text-gray-500 mb-1">Cyclical encoding (sin/cos)</p>
            <div className="grid grid-cols-2 gap-x-4">
              <Toggle label="Encode hour" checked={config.cyclical_hour} onChange={v => setKey('cyclical_hour', v)} />
              <Toggle label="Encode weekday" checked={config.cyclical_dow} onChange={v => setKey('cyclical_dow', v)} />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Calendar" badge={countCalCols}>
          <Toggle label="Is holiday" checked={config.include_holiday} onChange={v => setKey('include_holiday', v)} />
          <Toggle label="Event flag" checked={config.include_event} onChange={v => setKey('include_event', v)} />
        </SectionCard>

        <SectionCard title="Lag Features" badge={countLagCols}>
          <p className="text-xs text-gray-400 mb-2">t − n (always ≥ 1 to prevent leakage)</p>
          <ChipGroup options={PRESET_LAGS} selected={config.lags} onChange={v => setKey('lags', v)} />
        </SectionCard>

        <SectionCard title="Rolling Statistics" badge={countRollCols}>
          <p className="text-xs text-gray-400 mb-1">Windows (hours)</p>
          <ChipGroup options={PRESET_WINDOWS} selected={config.rolling_windows} onChange={v => setKey('rolling_windows', v)} />
          <p className="text-xs text-gray-400 mt-2 mb-1">Statistics</p>
          <StatChipGroup options={ROLLING_STAT_OPTS} selected={config.rolling_stats} onChange={v => setKey('rolling_stats', v)} />
        </SectionCard>

        <SectionCard title="Weather" badge={countWeatherCols}>
          <Toggle label="Numeric (temp, rain, humidity, wind)" checked={config.include_weather_numeric}
            onChange={v => setKey('include_weather_numeric', v)} />
          <Toggle label="One-hot encode condition (5 categories)" checked={config.include_weather_onehot}
            onChange={v => setKey('include_weather_onehot', v)} />
          <div className="mt-2 pt-2 border-t border-gray-200">
            <Toggle label="StandardScaler on numeric weather" checked={config.scale_numeric}
              onChange={v => setKey('scale_numeric', v)} />
          </div>
        </SectionCard>

        <div className="flex flex-col justify-end gap-3 p-4 bg-brand-50 border border-brand-100 rounded-xl">
          <div>
            <p className="text-xs font-semibold text-brand-700 mb-0.5">Estimated feature count</p>
            <p className="text-3xl font-bold text-brand-600">
              {countTimeCols + countCalCols + countLagCols + countRollCols + countWeatherCols}
            </p>
            <p className="text-xs text-brand-500">features total</p>
          </div>
          <button onClick={() => previewMutation.mutate()} disabled={!canPreview || previewMutation.isPending}
            className="w-full bg-white border border-brand-300 text-brand-600 py-2 rounded text-sm font-medium disabled:opacity-50 hover:bg-brand-50">
            {previewMutation.isPending ? 'Computing…' : 'Preview Features'}
          </button>
          <button onClick={() => saveMutation.mutate()} disabled={!canSave || saveMutation.isPending}
            className="w-full bg-brand-600 text-white py-2 rounded text-sm font-medium disabled:opacity-50 hover:bg-brand-700">
            {saveMutation.isPending ? 'Saving…' : 'Save Feature Set'}
          </button>
          {saveMutation.isSuccess && (
            <p className="text-xs text-green-600 text-center">Feature set saved!</p>
          )}
          {previewMutation.error && (
            <ErrorAlert message={(previewMutation.error as Error).message} />
          )}
          {saveMutation.error && (
            <ErrorAlert message={(saveMutation.error as Error).message} />
          )}
        </div>
      </div>

      {/* Preview results */}
      {previewMutation.isPending && (
        <Card title="Computing Features…"><LoadingSpinner /></Card>
      )}

      {preview && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-gray-800">Feature Preview</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Sample: {preview.sample_size} obs &nbsp;|&nbsp;
                <span className="text-green-600">Train: {preview.train_rows} rows (80%)</span> &nbsp;|&nbsp;
                <span className="text-amber-600">Test: {preview.test_rows} rows (20%)</span> &nbsp;|&nbsp;
                <strong>{preview.total_features}</strong> features computed
              </p>
            </div>
            <div className="flex border border-gray-200 rounded overflow-hidden text-sm">
              {(['correlation', 'table'] as const).map(tab => (
                <button key={tab} onClick={() => setPreviewTab(tab)}
                  className={`px-3 py-1.5 capitalize ${previewTab === tab ? 'bg-brand-600 text-white' : 'bg-white text-gray-600'}`}>
                  {tab === 'correlation' ? 'Correlation' : 'Data Table'}
                </button>
              ))}
            </div>
          </div>

          {previewTab === 'correlation' ? (
            <CorrelationChart correlation={preview.correlation} />
          ) : (
            <div className="max-h-96 overflow-auto">
              <PreviewTable preview={preview} />
            </div>
          )}
        </Card>
      )}

      {/* Saved feature sets */}
      {datasetId && (
        <Card title="Saved Feature Sets">
          <SavedSetsList datasetId={datasetId} />
        </Card>
      )}
    </div>
  )
}
