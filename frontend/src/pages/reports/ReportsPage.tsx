import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getReports, createReport, downloadReport, deleteReport } from '../../api/reports'
import Card from '../../components/Card'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorAlert from '../../components/ErrorAlert'
import { ReportsIcon, ForecastsIcon, JunctionIcon, ModelsIcon, DatasetIcon } from '../../components/Icons'
import { formatSystemTime } from '../../utils/date'

const REPORT_OPTIONS = [
  {
    id: 'congestion_analysis',
    label: 'Congestion Intelligence & Bottleneck Analysis',
    desc: 'Intersection capacity loads, predicted peak bottleneck hours, capacity ratios, and actionable mitigation strategy.',
    icon: JunctionIcon,
  },
  {
    id: 'forecast_summary',
    label: 'Hourly Traffic Volume Forecast Summary',
    desc: 'Multi-horizon predicted vehicle volumes with 95% confidence intervals across all sensor intersections.',
    icon: ForecastsIcon,
  },
  {
    id: 'model_comparison',
    label: 'ML Model Evaluation & Benchmark Audit',
    desc: 'Comparative assessment across Seasonal Naive, SARIMAX, and Random Forest (MAE, RMSE, MAPE, R²).',
    icon: ModelsIcon,
  },
  {
    id: 'dataset_validation',
    label: 'Telemetry Dataset Validation & Quality Audit',
    desc: 'Summary of uploaded CSV/XLSX observations, data cleaning rules, duplicate elimination, and schema status.',
    icon: DatasetIcon,
  },
]

export default function ReportsPage() {
  const qc = useQueryClient()
  const [type, setType] = useState('congestion_analysis')
  const [format, setFormat] = useState('pdf')
  const reports = useQuery({ queryKey: ['reports'], queryFn: getReports })

  const create = useMutation({
    mutationFn: () => createReport({ type, format, params: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  })

  const remove = useMutation({
    mutationFn: deleteReport,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  })

  const handleDownload = async (id: string, fmt: string) => {
    const blob = await downloadReport(id)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report_${id}.${fmt}`
    a.click()
    URL.revokeObjectURL(url)
  }



  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Executive Report Generator</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Export presentation-ready PDF documents, Excel spreadsheets, and raw CSV analytics for traffic authorities.
          </p>
        </div>
      </div>

      {/* Generation Configuration Card */}
      <Card title="Configure & Export Report" className="border-slate-200/90 shadow-xs">
        <div className="space-y-4">
          {/* Report Type Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
              Select Analytical Report Type
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {REPORT_OPTIONS.map((opt) => {
                const Icon = opt.icon
                const isSelected = type === opt.id
                return (
                  <div
                    key={opt.id}
                    onClick={() => setType(opt.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                      isSelected
                        ? 'border-sky-500 bg-sky-50/70 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <Icon size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">{opt.label}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{opt.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Format Selector & Action */}
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-700">Output Format:</span>
              <div className="flex gap-1.5">
                {[
                  { id: 'pdf', label: '📄 PDF Document', note: 'ReportLab' },
                  { id: 'xlsx', label: '📊 Excel (.xlsx)', note: 'openpyxl' },
                  { id: 'csv', label: '📁 Raw CSV', note: 'pandas' },
                ].map((f) => (
                  <button
                    type="button"
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      format === f.id
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => create.mutate()}
              disabled={create.isPending}
              className="w-full sm:w-auto bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-sky-600/25 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shrink-0"
            >
              <ReportsIcon size={16} />
              <span>{create.isPending ? 'Generating Document…' : 'Generate Full Report'}</span>
            </button>
          </div>
        </div>

        {create.error && (
          <div className="mt-3">
            <ErrorAlert message={(create.error as Error).message} />
          </div>
        )}
      </Card>

      {/* Reports History */}
      {reports.isLoading ? (
        <LoadingSpinner />
      ) : (
        <Card
          title={`Generated Reports Library (${reports.data?.length ?? 0})`}
          className="border-slate-200/90 shadow-xs"
        >
          {!(reports.data?.length) ? (
            <div className="text-center py-10 text-slate-400">
              <ReportsIcon size={36} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-700">No Reports Generated Yet</p>
              <p className="text-xs text-slate-400 mt-0.5">Choose a report type and format above, then click Generate.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-100 font-bold uppercase tracking-wider">
                    <th className="pb-3 pl-1">Report Description</th>
                    <th className="pb-3">Format</th>
                    <th className="pb-3">Generated Timestamp</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(reports.data ?? []).map((r: { _id: string; type: string; format: string; created_at: string }) => {
                    const opt = REPORT_OPTIONS.find(o => o.id === r.type)
                    return (
                      <tr key={r._id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 pl-1">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                            <span className="font-bold text-slate-800">
                              {opt ? opt.label : r.type.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                        </td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] uppercase border ${
                              r.format === 'pdf'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : r.format === 'xlsx'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {r.format}
                          </span>
                        </td>
                        <td className="py-3 text-slate-500 font-mono">
                          {formatSystemTime(r.created_at)}
                        </td>
                        <td className="py-3 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => handleDownload(r._id, r.format)}
                            className="text-xs font-bold bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 px-3 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            ⬇ Download
                          </button>
                          <button
                            type="button"
                            onClick={() => remove.mutate(r._id)}
                            disabled={remove.isPending}
                            className="text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
