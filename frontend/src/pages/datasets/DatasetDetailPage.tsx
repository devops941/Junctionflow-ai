import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDataset, previewDataset, validateDataset } from '../../api/datasets'
import type { ColumnMapping } from '../../types'
import Card from '../../components/Card'
import LoadingSpinner from '../../components/LoadingSpinner'
import StatusBadge from '../../components/StatusBadge'
import ErrorAlert from '../../components/ErrorAlert'

const REQUIRED_FIELDS = ['timestamp', 'junction_id', 'vehicle_count'] as const
const OPTIONAL_FIELDS = ['temperature_c', 'rainfall_mm', 'humidity_pct', 'wind_speed_kmh', 'weather_condition', 'is_holiday', 'event_flag'] as const

export default function DatasetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const dataset = useQuery({ queryKey: ['dataset', id], queryFn: () => getDataset(id!) })
  const preview = useQuery({ queryKey: ['preview', id], queryFn: () => previewDataset(id!, 10) })
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>({})

  const validate = useMutation({
    mutationFn: () => validateDataset(id!, mapping as ColumnMapping),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dataset', id] }),
  })

  const columns: string[] = preview.data?.columns ?? []
  const ds = dataset.data

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">{ds?.name ?? 'Loading…'}</h1>
        {ds && <StatusBadge status={ds.status} />}
      </div>

      {dataset.isLoading ? <LoadingSpinner /> : ds && (
        <div className="grid grid-cols-3 gap-4 text-sm">
          <Card><p className="text-gray-500">File</p><p className="font-medium">{ds.original_filename}</p></Card>
          <Card><p className="text-gray-500">Rows</p><p className="font-medium">{ds.row_count.toLocaleString()}</p></Card>
          <Card><p className="text-gray-500">Junctions</p><p className="font-medium">{ds.junction_ids.join(', ') || '—'}</p></Card>
        </div>
      )}

      {ds?.validation_report && (
        <Card title="Validation Report">
          <div className="grid grid-cols-3 gap-4 text-sm mb-4">
            <div><span className="text-gray-500">Total rows: </span><strong>{ds.validation_report.total_rows}</strong></div>
            <div><span className="text-green-600">Valid: </span><strong>{ds.validation_report.valid_rows}</strong></div>
            <div><span className="text-red-500">Invalid: </span><strong>{ds.validation_report.invalid_rows}</strong></div>
          </div>
          {ds.validation_report.warnings.map((w: string, i: number) => (
            <p key={i} className="text-xs text-yellow-600">⚠ {w}</p>
          ))}
          {ds.validation_report.errors.map((e: string, i: number) => (
            <p key={i} className="text-xs text-red-600">✕ {e}</p>
          ))}
        </Card>
      )}

      {columns.length > 0 && (
        <Card title="Column Mapping">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map((field) => (
              <div key={field}>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {field} {REQUIRED_FIELDS.includes(field as typeof REQUIRED_FIELDS[number]) ? <span className="text-red-500">*</span> : ''}
                </label>
                <select className="border rounded px-2 py-1.5 text-sm w-full"
                  value={(mapping as Record<string, string>)[field] ?? ''}
                  onChange={e => setMapping(p => ({ ...p, [field]: e.target.value || undefined }))}>
                  <option value="">— skip —</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            ))}
          </div>
          {validate.error && <ErrorAlert message={(validate.error as Error).message} />}
          <button onClick={() => validate.mutate()} disabled={validate.isPending}
            className="mt-4 bg-brand-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">
            {validate.isPending ? 'Validating…' : 'Validate & Ingest'}
          </button>
        </Card>
      )}

      {preview.data?.rows && (
        <Card title="Preview (first 10 rows)">
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead><tr className="text-gray-400 border-b">
                {columns.map(c => <th key={c} className="text-left pb-1 pr-4">{c}</th>)}
              </tr></thead>
              <tbody>
                {preview.data.rows.map((row: Record<string, unknown>, i: number) => (
                  <tr key={i} className="border-b last:border-0">
                    {columns.map(c => <td key={c} className="py-1 pr-4">{String(row[c] ?? '')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
