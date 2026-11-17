import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDatasets, uploadDataset, deleteDataset } from '../../api/datasets'
import { Link } from 'react-router-dom'
import Card from '../../components/Card'
import LoadingSpinner from '../../components/LoadingSpinner'
import ErrorAlert from '../../components/ErrorAlert'
import StatusBadge from '../../components/StatusBadge'
import { DatasetIcon, ReportsIcon } from '../../components/Icons'

export default function DatasetsPage() {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const datasets = useQuery({ queryKey: ['datasets'], queryFn: () => getDatasets() })

  const upload = useMutation({
    mutationFn: () => uploadDataset(file!, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['datasets'] })
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] })
      setFile(null)
      setName('')
    },
  })

  const remove = useMutation({
    mutationFn: deleteDataset,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['datasets'] })
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] })
    },
  })

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted[0]) {
        setFile(accepted[0])
        if (!name) setName(accepted[0].name.replace(/\.[^.]+$/, ''))
      }
    },
    [name]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    maxFiles: 1,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Dataset Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Ingest raw intersection traffic observations in CSV or Excel format.
          </p>
        </div>
      </div>

      <Card title="Upload New Traffic Dataset" className="border-slate-200/90 shadow-xs">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
            isDragActive
              ? 'border-sky-500 bg-sky-50/70 shadow-inner'
              : 'border-slate-200 hover:border-sky-400 hover:bg-slate-50/50'
          }`}
        >
          <input {...getInputProps()} />
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 border border-sky-200 flex items-center justify-center mx-auto mb-3 shadow-2xs">
            <ReportsIcon size={24} />
          </div>
          {file ? (
            <div>
              <p className="text-xs font-bold text-slate-900">{file.name}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                {(file.size / (1024 * 1024)).toFixed(2)} MB • Ready to upload
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xs font-bold text-slate-700">Drop traffic CSV or XLSX file here</p>
              <p className="text-[11px] text-slate-400 mt-1">or click to browse from your computer</p>
            </div>
          )}
        </div>

        <div className="mt-4">
          <label className="block text-xs font-bold text-slate-700 mb-1">Dataset Label / Identifier</label>
          <input
            className="border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium w-full bg-slate-50/50 hover:bg-white focus:bg-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all text-slate-800"
            placeholder="e.g. Metro Q1 2026 Traffic Telemetry"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        {upload.error && <div className="mt-3"><ErrorAlert message={(upload.error as Error).message} /></div>}

        <button
          type="button"
          onClick={() => upload.mutate()}
          disabled={!file || !name || upload.isPending}
          className="mt-4 bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-sky-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 cursor-pointer"
        >
          <DatasetIcon size={16} />
          <span>{upload.isPending ? 'Uploading & Parsing…' : 'Upload Dataset'}</span>
        </button>
      </Card>

      {datasets.isLoading ? (
        <LoadingSpinner />
      ) : (
        <Card
          title={`Available Datasets (${datasets.data?.total ?? 0})`}
          className="border-slate-200/90 shadow-xs"
        >
          {!(datasets.data?.items?.length) ? (
            <div className="text-center py-10 text-slate-400">
              <DatasetIcon size={36} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-700">No Datasets Uploaded</p>
              <p className="text-xs text-slate-400 mt-0.5">Upload a CSV or XLSX file above to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-100 font-bold uppercase tracking-wider">
                    <th className="pb-3 pl-1">Dataset Name</th>
                    <th className="pb-3">Source File</th>
                    <th className="pb-3 text-right">Rows</th>
                    <th className="pb-3 text-center">Status</th>
                    <th className="pb-3 text-right">Uploaded At</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(datasets.data?.items ?? []).map((d) => (
                    <tr key={d._id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 pl-1">
                        <Link
                          to={`/datasets/${d._id}`}
                          className="font-bold text-sky-700 hover:underline flex items-center gap-1.5"
                        >
                          <span>{d.name}</span>
                          <span className="text-[10px] text-slate-400">↗</span>
                        </Link>
                      </td>
                      <td className="py-3 font-mono text-slate-600">{d.original_filename}</td>
                      <td className="py-3 text-right font-mono font-bold text-slate-700">
                        {d.row_count ? d.row_count.toLocaleString() : '—'}
                      </td>
                      <td className="py-3 text-center">
                        <StatusBadge status={d.status} />
                      </td>
                      <td className="py-3 text-right text-slate-400">
                        {new Date(d.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="py-3 text-right space-x-2">
                        <Link
                          to={`/datasets/${d._id}`}
                          className="text-xs font-semibold text-sky-600 hover:text-sky-700 hover:bg-sky-50 px-2.5 py-1 rounded-lg border border-transparent hover:border-sky-200 transition-all"
                        >
                          Inspect / Map
                        </Link>
                        <button
                          type="button"
                          onClick={() => remove.mutate(d._id)}
                          disabled={remove.isPending}
                          className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1 rounded-lg border border-transparent hover:border-rose-200 transition-all cursor-pointer"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
