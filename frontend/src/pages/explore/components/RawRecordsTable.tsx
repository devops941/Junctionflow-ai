import { ReportsIcon } from '../../../components/Icons'

interface RawRecord {
  timestamp: string
  junction_id: string
  vehicle_count: number
  temperature_c?: number
  rainfall_mm?: number
  weather_condition?: string
  is_holiday?: boolean
  event_flag?: boolean
}

interface PagedData {
  items: RawRecord[]
  total: number
  page: number
  page_size: number
  pages: number
}

interface Props {
  data: PagedData | undefined
  page: number
  sortBy: string
  sortDir: string
  onPage: (p: number) => void
  onSort: (col: string) => void
  onExportCsv: () => void
  onExportXlsx: () => void
  isLoading: boolean
}

const COLS: { key: keyof RawRecord; label: string; align?: 'left' | 'right' | 'center' }[] = [
  { key: 'timestamp', label: 'Timestamp', align: 'left' },
  { key: 'junction_id', label: 'Junction ID', align: 'left' },
  { key: 'vehicle_count', label: 'Vehicle Count', align: 'right' },
  { key: 'temperature_c', label: 'Temp (°C)', align: 'right' },
  { key: 'rainfall_mm', label: 'Rain (mm)', align: 'right' },
  { key: 'weather_condition', label: 'Weather', align: 'center' },
  { key: 'is_holiday', label: 'Holiday', align: 'center' },
]

const WEATHER_EMOJI: Record<string, string> = {
  clear: '☀️ Clear',
  cloudy: '☁️ Cloudy',
  rain: '🌧️ Rain',
  fog: '🌫️ Fog',
  storm: '⛈️ Storm',
}

export default function RawRecordsTable({
  data,
  page,
  sortBy,
  sortDir,
  onPage,
  onSort,
  onExportCsv,
  onExportXlsx,
  isLoading,
}: Props) {
  const total = data?.total ?? 0
  const pageSize = data?.page_size ?? 15
  const totalPages = data?.pages ?? 1
  const startRow = total > 0 ? (page - 1) * pageSize + 1 : 0
  const endRow = total > 0 ? Math.min(page * pageSize, total) : 0

  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-100">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Observation Records Table
          </h4>
          <p className="text-xs text-slate-600 mt-0.5 font-medium">
            Showing <span className="font-bold text-slate-900 font-mono">{startRow.toLocaleString()}</span>–
            <span className="font-bold text-slate-900 font-mono">{endRow.toLocaleString()}</span> of{' '}
            <span className="font-bold text-slate-900 font-mono">{total.toLocaleString()}</span> total records{' '}
            <span className="text-slate-400 font-normal">• (15 records per page)</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onExportCsv}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs transition-colors cursor-pointer"
          >
            <ReportsIcon size={14} className="text-slate-500" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={onExportXlsx}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/60 text-emerald-800 shadow-2xs transition-colors cursor-pointer"
          >
            <ReportsIcon size={14} className="text-emerald-600" />
            <span>Export XLSX</span>
          </button>
        </div>
      </div>

      {/* Responsive Table Container */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200/90 shadow-2xs bg-white">
        <table className="w-full text-xs">
          <thead className="bg-slate-50/80 border-b border-slate-200">
            <tr>
              {COLS.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 font-bold uppercase tracking-wider text-slate-500 cursor-pointer select-none hover:text-sky-600 transition-colors ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  }`}
                  onClick={() => onSort(col.key)}
                >
                  <div
                    className={`inline-flex items-center gap-1 ${
                      col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'
                    }`}
                  >
                    <span>{col.label}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {sortBy === col.key ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {isLoading && (
              <tr>
                <td colSpan={COLS.length} className="text-center py-12 text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
                    <span>Loading 15 records…</span>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading && (!data?.items?.length) && (
              <tr>
                <td colSpan={COLS.length} className="text-center py-10 text-slate-400 font-medium">
                  No records match the current filter selection.
                </td>
              </tr>
            )}

            {!isLoading &&
              data?.items.map((row, i) => (
                <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-slate-700 font-medium whitespace-nowrap">
                    {new Date(row.timestamp).toLocaleString([], {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className="font-mono font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                      {row.junction_id}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-extrabold text-slate-900">
                    {row.vehicle_count.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-600">
                    {row.temperature_c !== undefined && row.temperature_c !== null ? `${row.temperature_c.toFixed(1)}°` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-600">
                    {row.rainfall_mm !== undefined && row.rainfall_mm !== null ? `${row.rainfall_mm.toFixed(1)} mm` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-center whitespace-nowrap">
                    {row.weather_condition ? (
                      <span className="inline-block text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                        {WEATHER_EMOJI[row.weather_condition.toLowerCase()] ?? row.weather_condition}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center whitespace-nowrap">
                    {row.is_holiday ? (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        🎉 Holiday
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-400">Regular</span>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {data && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <p className="text-xs text-slate-500 font-medium">
            Page <span className="font-bold text-slate-800">{page}</span> of{' '}
            <span className="font-bold text-slate-800">{totalPages.toLocaleString()}</span>
          </p>

          <div className="flex items-center gap-1 select-none">
            {/* First Page */}
            <button
              type="button"
              onClick={() => onPage(1)}
              disabled={page === 1}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition-colors"
              title="First Page"
            >
              « First
            </button>

            {/* Prev Page */}
            <button
              type="button"
              onClick={() => onPage(page - 1)}
              disabled={page <= 1}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition-colors"
            >
              ‹ Prev
            </button>

            {/* Page Number Chips */}
            {(() => {
              const windowSize = 5
              const half = Math.floor(windowSize / 2)
              let start = Math.max(1, page - half)
              let end = Math.min(totalPages, start + windowSize - 1)
              if (end - start + 1 < windowSize) {
                start = Math.max(1, end - windowSize + 1)
              }
              const pagesArray = []
              for (let p = start; p <= end; p++) {
                pagesArray.push(p)
              }

              return pagesArray.map((p) => {
                const isActive = p === page
                return (
                  <button
                    type="button"
                    key={p}
                    onClick={() => onPage(p)}
                    className={`min-w-8 py-1.5 rounded-lg border text-xs font-bold font-mono transition-all ${
                      isActive
                        ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    {p}
                  </button>
                )
              })
            })()}

            {/* Next Page */}
            <button
              type="button"
              onClick={() => onPage(page + 1)}
              disabled={page >= totalPages}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition-colors"
            >
              Next ›
            </button>

            {/* Last Page */}
            <button
              type="button"
              onClick={() => onPage(totalPages)}
              disabled={page === totalPages}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition-colors"
              title="Last Page"
            >
              Last »
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
